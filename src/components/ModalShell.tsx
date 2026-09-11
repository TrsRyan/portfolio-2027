"use client";

import { useEffect, useRef } from "react";
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
  MODAL_ROOT_ID,
} from "../lib/projectTransition";
import { NARROW_MEDIA } from "../lib/motion";

const isNarrow = () => window.matchMedia(NARROW_MEDIA).matches;

/**
 * Client shell for the intercepted modal. Knows nothing about the project:
 * it carries `children` (the server-rendered <ProjectDetail>) inside
 * #modal-root, freezes the homepage's scroll, and listens for Escape. The
 * content's smooth scroll + the morph are handled by <ModalView>.
 *
 * Return: the "Return" link from <ProjectDetail> (or Escape, or Prev).
 */
export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rootLenis = useLenis();
  const backdropRef = useRef<HTMLDivElement>(null);

  // Freezes the homepage mounted behind the overlay.
  useEffect(() => {
    rootLenis?.stop();
    return () => rootLenis?.start();
  }, [rootLenis]);

  // Chrome/Edge bug (Chromium issue 40909059, Firefox unaffected): <html>'s
  // `scrollbar-gutter: stable` (globals.css, needed to avoid a jump when
  // the homepage intro locks/unlocks scrolling) incorrectly shrinks
  // position:fixed descendants — .backdrop ends up narrower than the real
  // viewport (measured: 855px vs window.innerWidth's 885px on a project
  // page, a ~30px loss instead of none). We sidestep Chrome's broken gutter
  // math entirely: set .backdrop's width to the real, measured viewport
  // width directly, instead of trusting `inset: 0` + scrollbar-gutter to
  // compute it. Re-applied on resize (the loss isn't a fixed px value).
  useEffect(() => {
    const el = backdropRef.current;
    if (!el) return;
    const applyRealWidth = () => {
      el.style.width = `${window.innerWidth}px`;
    };
    applyRealWidth();
    window.addEventListener("resize", applyRealWidth);
    return () => window.removeEventListener("resize", applyRealWidth);
  }, []);

  // Keyboard comfort: Escape closes (restores the URL + slot via history).
  // Blocked while a transition is running (swap / close) — like the Return
  // click. Stays active during the opening morph (`isTransitionRunning()` is
  // false there), which it can therefore interrupt.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || isTransitionRunning()) return;
      freezeModalContent();
      if (isNarrow()) {
        // ≤768px: FULL white first, THEN we go back (behind the white).
        void curtainCover().then(() => router.back());
      } else {
        router.back();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  // On links inside the modal:
  // - while a transition is running (swap / close), block ALL internal
  //   links — Prev/Next AND Return (Option B, standard agency practice);
  //   the opening morph itself stays interruptible
  //   (`isTransitionRunning()` is false there);
  // - otherwise freeze the scrolled content BEFORE navigating (the App
  //   Router's scroll reset would otherwise arrive too late to prevent a jump).
  useEffect(() => {
    const el = document.getElementById(MODAL_ROOT_ID);
    if (!el) return;
    // true = this click must be blocked (transition running + internal link).
    const willBlock = (target: Element | null) => {
      if (!isTransitionRunning()) return false;
      const a = target?.closest("a[href]");
      const href = a?.getAttribute("href");
      return (
        !!href && href.startsWith("/") && a?.getAttribute("target") !== "_blank"
      );
    };
    const onClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // opening a new tab
      if (willBlock(e.target as Element | null)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // ALLOWED internal nav click (Prev/Next): we set the lock in the same
      // event, BEFORE the navigation fires. Otherwise there's a window
      // (click -> render -> layout effect that sets the lock) where a fast
      // second click gets through -> the swap gets retargeted mid-flight ->
      // text flash. Return (href="/") and external links (_blank): never locked.
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
      // Return (href="/") on ≤768px: FULL white first, THEN go back (the
      // <Link> doesn't navigate right away).
      if (href === "/" && isNarrow()) {
        e.preventDefault();
        e.stopPropagation();
        void curtainCover().then(() => router.back());
      }
    };
    const onDown = (e: Event) => {
      const target = e.target as Element | null;
      const a = target?.closest("a[href]");
      if (!a || willBlock(target)) return;
      // `freezeModalContent` returns the real scroll position (read before
      // setting position:fixed, which would otherwise drop it to 0).
      const frozenAt = freezeModalContent();
      // Prev/Next (internal link, not Return "/", not external): remember
      // this position to restore it on the target project.
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
  }, [router]); // router (next/navigation) is stable -> no re-attaching

  const root =
    typeof document !== "undefined"
      ? document.getElementById(MODAL_ROOT_ID)
      : null;
  if (!root) return null;

  // data-lenis-prevent: the root Lenis instance is stopped and would
  // otherwise swallow every wheel event, including here. <ModalView> sets up
  // a dedicated Lenis on top of it, and animates .backdropBg (the opaque
  // background) during the morph.
  return createPortal(
    <div ref={backdropRef} className={styles.backdrop} data-lenis-prevent="">
      <div className={styles.backdropBg} data-backdrop-bg="" />
      {children}
    </div>,
    root,
  );
}
