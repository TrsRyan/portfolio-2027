"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLenis } from "lenis/react";
import styles from "./ModalShell.module.css";
import {
  freezeModalContent,
  isTransitionRunning,
  lockTransition,
  setSwapScroll,
  curtainCover,
  unfreezeHomepageScroll,
  MODAL_ROOT_ID,
} from "../lib/projectTransition";
import { NARROW_MEDIA } from "../lib/motion";

const isNarrow = () => window.matchMedia(NARROW_MEDIA).matches;

/**
 * Portals the modal into #modal-root and handles its navigation: Escape,
 * Return, Prev/Next and the transition lock.
 */
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rootLenis = useLenis();

  useEffect(() => {
    rootLenis?.stop();
    return () => {
      // Restore the scroll position before Lenis resumes, so it resyncs
      // from the right place.
      unfreezeHomepageScroll();
      rootLenis?.start();
    };
  }, [rootLenis]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isTransitionRunning()) return;
      freezeModalContent();
      if (isNarrow()) {
        void curtainCover().then(() => router.back());
      } else {
        router.back();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    const el = document.getElementById(MODAL_ROOT_ID);
    if (!el) return;
    const willBlock = (target: Element | null) => {
      if (!isTransitionRunning()) return false;
      const a = target?.closest("a[href]");
      const href = a?.getAttribute("href");
      return (
        !!href && href.startsWith("/") && a?.getAttribute("target") !== "_blank"
      );
    };
    const onClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (willBlock(e.target as Element | null)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Lock in the same event as the Prev/Next click: waiting for the
      // render would let a fast second click retarget the swap mid-flight.
      const a = (e.target as Element | null)?.closest("a[href]");
      const href = a?.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        href !== "/" &&
        a?.getAttribute("target") !== "_blank"
      ) {
        lockTransition();
      }
      if (href === "/" && isNarrow()) {
        e.preventDefault();
        e.stopPropagation();
        void curtainCover().then(() => router.back());
      }
    };
    // Freeze on pointerdown: the App Router's scroll reset comes too late to
    // be prevented on click.
    const onDown = (e: Event) => {
      const target = e.target as Element | null;
      const a = target?.closest("a[href]");
      if (!a || willBlock(target)) return;
      const frozenAt = freezeModalContent();
      const href = a.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        href !== "/" &&
        a.getAttribute("target") !== "_blank"
      ) {
        setSwapScroll(href.replace(/^\/+/, ""), frozenAt);
      }
    };
    const onPop = () => {
      if (!isTransitionRunning()) freezeModalContent();
    };
    el.addEventListener("click", onClick, true);
    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("popstate", onPop);
    return () => {
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("popstate", onPop);
    };
  }, [router]);

  const root =
    typeof document !== "undefined"
      ? document.getElementById(MODAL_ROOT_ID)
      : null;
  if (!root) return null;

  // data-lenis-prevent: the stopped root Lenis would otherwise swallow wheel
  // events here.
  return createPortal(
    <div className={styles.backdrop} data-lenis-prevent="">
      <div className={styles.backdropBg} data-backdrop-bg="" />
      {children}
    </div>,
    root,
  );
}
