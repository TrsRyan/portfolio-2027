"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import Lenis from "lenis";
import { useProjects } from "./ProjectsProvider";
import { pickProject } from "../lib/projects";
import {
  takePendingFlip,
  takeSwapScroll,
  peekSwapScroll,
  setSwapScroll,
  concealHomepage,
  revealDetail,
  concealDetail,
  swapOutDetail,
  swapInDetail,
  freezeModalContent,
  lockTransition,
  unlockTransition,
  curtainCoverDone,
  unfreezeHomepageScroll,
  MORPH_MEDIA,
} from "../lib/projectTransition";
import type { RevealHandle } from "../lib/reveal";
import {
  DUR as MOTION_DUR,
  EASE as MOTION_EASE,
  NARROW_MEDIA,
} from "../lib/motion";
import ProjectDetail from "./ProjectDetail";
import { playUnderlineSweep } from "./UnderlineLink";
import { Modal } from "./ModalShell";
import styles from "./ModalView.module.css";

gsap.registerPlugin(Flip);

// Layout effect so the Flip starts before the first paint (no flash of the
// image at its final size).
const useIsoLayoutEffect =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Project modal content and its transitions: opening morph, Prev/Next swap
 * and return.
 */
export function ModalView({
  slug,
  phase,
  incoming,
  onExitDone,
  onSwapDone,
}: {
  slug: string;
  phase: "in" | "out" | "swap";
  incoming?: string;
  onExitDone: () => void;
  onSwapDone?: () => void;
}) {
  const projects = useProjects();
  const picked = pickProject(projects, slug);
  const incomingPicked =
    phase === "swap" && incoming ? pickProject(projects, incoming) : null;
  const isSwap = phase === "swap" && !!incomingPicked;

  const homeHandlesRef = useRef<RevealHandle[]>([]);
  const detailHandlesRef = useRef<RevealHandle[]>([]);
  const modalLenisRef = useRef<Lenis | null>(null);
  const exitStartedRef = useRef(false);
  const masterTlRef = useRef<gsap.core.Timeline | null>(null);
  // Homepage lines stay split while the modal is open; after a resize they
  // must be re-split at the new width before being reversed.
  const homeResizedRef = useRef(false);
  const outgoingRef = useRef<HTMLDivElement>(null);
  const incomingRef = useRef<HTMLDivElement>(null);

  // Runs once per modal (survives Prev/Next): a dedicated Lenis for the
  // modal's scroll container.
  useIsoLayoutEffect(() => {
    const backdrop = document.querySelector<HTMLElement>(
      "#modal-root [data-lenis-prevent]",
    );
    if (!backdrop) return;
    const modalLenis = new Lenis({ wrapper: backdrop, autoRaf: false });
    modalLenisRef.current = modalLenis;
    const raf = (time: number) => modalLenis.raf(time * 1000);
    gsap.ticker.add(raf);

    const onResize = () => {
      homeResizedRef.current = true;
    };
    window.addEventListener("resize", onResize);

    return () => {
      gsap.ticker.remove(raf);
      modalLenis.destroy();
      modalLenisRef.current = null;
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Runs for every project shown.
  useIsoLayoutEffect(() => {
    const backdrop = document.querySelector<HTMLElement>(
      "#modal-root [data-lenis-prevent]",
    );
    if (!backdrop) return;
    const modalLenis = modalLenisRef.current;

    // React reuses the same <main> across Prev/Next: thaw the previous
    // freeze and restore scroll in the same sync block to avoid a jump.
    const page = backdrop.querySelector<HTMLElement>("main");
    if (page) {
      page.style.position = "";
      page.style.top = "";
      page.style.left = "";
      page.style.width = "";
    }
    const restore = takeSwapScroll(slug);
    if (restore != null && restore > 0) {
      backdrop.scrollTop = restore;
      modalLenis?.resize();
      modalLenis?.scrollTo(restore, { immediate: true, force: true });
    } else {
      backdrop.scrollTop = 0;
    }

    const pending = takePendingFlip(slug);
    const media = document.querySelector<HTMLElement>(
      `#modal-root [data-flip-id="project-${slug}"]`,
    );
    const morph =
      !!pending && !!media && window.matchMedia(MORPH_MEDIA).matches;

    const sourceThumb = document.querySelector<HTMLElement>(
      `[data-project-thumb="${slug}"]`,
    );
    const backdropBg = backdrop.querySelector<HTMLElement>("[data-backdrop-bg]");

    homeHandlesRef.current = [];
    detailHandlesRef.current = [];
    masterTlRef.current = null;
    homeResizedRef.current = false;

    if (morph && pending && media) {
      const DUR = MOTION_DUR.move;
      const EASE = MOTION_EASE.move;
      const img = media.querySelector<HTMLElement>("img");

      // Locked for the whole morph: a swap started mid-Flip can't re-split
      // text that is already split.
      lockTransition();
      modalLenis?.stop();
      // Hide the homepage thumbnail so it doesn't ghost under the morph.
      if (sourceThumb) gsap.set(sourceThumb, { autoAlpha: 0 });
      if (backdropBg) gsap.set(backdropBg, { opacity: 0 });

      // Paused until all children are added: the Flip and SplitText setup
      // takes real time, and an unpaused timeline would jump ahead by that
      // gap on its first tick (lagSmoothing is off for Lenis).
      const masterTl = gsap.timeline({ paused: true, onComplete: unlockTransition });
      masterTlRef.current = masterTl;

      // No `scale: true`: animating width/height lets object-fit re-crop
      // each frame instead of stretching pixels.
      masterTl.add(
        Flip.from(pending.state, {
          targets: media,
          absolute: true,
          duration: DUR,
          ease: EASE,
          onComplete: () => {
            modalLenis?.resize();
            modalLenis?.start();
          },
        }),
        0,
      );

      // Starts at the thumbnail's 1.2 crop. force3D: Safari renders a
      // scaling <img> at reduced quality unless it has its own layer.
      if (img) {
        masterTl.fromTo(
          img,
          { scale: 1.2 },
          { scale: 1, duration: DUR, ease: EASE, force3D: true },
          0,
        );
      }

      // A set (not a tween) so a reverse turns it transparent again.
      if (backdropBg) masterTl.set(backdropBg, { opacity: 1 }, DUR);

      homeHandlesRef.current = concealHomepage();
      detailHandlesRef.current = revealDetail(0);
      homeHandlesRef.current.forEach((h) => {
        if (h.tween) masterTl.add(h.tween, 0);
      });
      detailHandlesRef.current.forEach((h) => {
        if (h.tween) masterTl.add(h.tween, DUR * 0.5);
      });
      masterTl.play();
    } else if (window.matchMedia(NARROW_MEDIA).matches) {
      // Mobile: the curtain is the transition; it releases the lock.
      lockTransition();
    }

    return () => {
      masterTlRef.current?.kill();
      masterTlRef.current = null;
      if (morph || window.matchMedia(NARROW_MEDIA).matches)
        unlockTransition();
      [...homeHandlesRef.current, ...detailHandlesRef.current].forEach((h) =>
        h.settle(),
      );
      if (morph && sourceThumb) {
        gsap.set(sourceThumb, { clearProps: "opacity,visibility" });
      }
    };
  }, [slug]);

  // Settled close. An opening still in progress is reversed instead (see
  // the effect below).
  const playExit = useCallback(
    async () => {
      const media = document.querySelector<HTMLElement>(
        `#modal-root [data-flip-id="project-${slug}"]`,
      );
      const sourceThumb = document.querySelector<HTMLElement>(
        `[data-project-thumb="${slug}"]`,
      );

      // Morph back whenever a thumbnail exists, even if the modal was
      // reached via Prev/Next.
      const canMorph =
        window.matchMedia(MORPH_MEDIA).matches && !!media && !!sourceThumb;

      if (!canMorph) {
        // Mobile: wait until the curtain is opaque before unmounting.
        if (window.matchMedia(NARROW_MEDIA).matches) {
          lockTransition();
          await curtainCoverDone();
        }
        return;
      }

      lockTransition();

      const DUR = 1.15;
      const EASE = MOTION_EASE.move;
      const IMG_LATENCY = 0.35; // image waits for the text to leave

      modalLenisRef.current?.stop();

      if (sourceThumb) gsap.set(sourceThumb, { autoAlpha: 0 });

      const backdropBg = document.querySelector<HTMLElement>(
        "#modal-root [data-backdrop-bg]",
      );

      const homeVars = {
        duration: 0.58,
        ease: MOTION_EASE.enter,
        stagger: 0.04,
        delay: 0.85,
      };
      if (homeHandlesRef.current.length > 0 && homeResizedRef.current) {
        homeHandlesRef.current.forEach((h) => h.settle());
        homeHandlesRef.current = [];
      }
      // Reached via Prev/Next: no homepage handles yet, create them hidden.
      if (homeHandlesRef.current.length === 0) {
        homeHandlesRef.current = concealHomepage();
        homeHandlesRef.current.forEach((h) => h.tween?.progress(1));
      }
      homeHandlesRef.current.forEach((h) => h.reverse?.(homeVars));

      detailHandlesRef.current.push(...concealDetail(0));

      await new Promise<void>((resolve) => {
        const tl = gsap.timeline({ onComplete: resolve });

        if (backdropBg) tl.set(backdropBg, { opacity: 0 }, IMG_LATENCY);

        if (media && sourceThumb) {
          // Flip.fit returns a Tween when given a duration.
          const fit = Flip.fit(media, sourceThumb, {
            absolute: true,
            duration: DUR,
            ease: EASE,
          }) as gsap.core.Tween | null;
          if (fit) tl.add(fit, IMG_LATENCY);
          const img = media.querySelector<HTMLElement>("img");
          if (img)
            tl.to(
              img,
              { scale: 1.2, duration: DUR, ease: EASE, force3D: true },
              IMG_LATENCY,
            );
          // Hand off to the real thumbnail just before landing.
          tl.set(sourceThumb, { autoAlpha: 1 }, IMG_LATENCY + DUR - 0.08);
        } else {
          tl.to({}, { duration: IMG_LATENCY + DUR });
        }
      });
    },
    [slug],
  );

  useEffect(() => {
    if (phase !== "out" || exitStartedRef.current) return;
    exitStartedRef.current = true;

    unfreezeHomepageScroll();

    // Already frozen by ModalShell on Return/Escape; needed for the
    // browser's back button.
    freezeModalContent();

    const done = () => {
      unlockTransition();
      onExitDone();
    };

    const masterTl = masterTlRef.current;
    if (masterTl && masterTl.isActive()) {
      masterTl.eventCallback("onReverseComplete", done);
      masterTl.reverse();
      return;
    }

    void playExit().then(done);
  }, [phase, playExit, onExitDone]);

  // Prev/Next swap: both projects are mounted, the incoming image is
  // revealed with a bottom-to-top clip-path over the outgoing one.
  // Layout effect so the clipped state is set before the first paint.
  useIsoLayoutEffect(() => {
    if (phase !== "swap") return;

    // Navigation is blocked during the swap; only the browser's back button
    // gets through.
    lockTransition();

    const media = incomingRef.current?.querySelector<HTMLElement>(
      `[data-flip-id="project-${incoming}"]`,
    );

    if (!media) {
      const id = requestAnimationFrame(() => onSwapDone?.());
      return () => {
        cancelAnimationFrame(id);
        unlockTransition();
      };
    }

    const img = media.querySelector<HTMLElement>("img");

    // The image area has a constant height, so only the scroll needs
    // matching: pin the incoming <main> at the outgoing scroll position,
    // clamped to what the incoming page can scroll.
    const S = incoming ? peekSwapScroll(incoming) ?? 0 : 0;
    if (S > 0 && incoming) {
      const inMain = incomingRef.current?.querySelector<HTMLElement>("main");
      const vh =
        document.querySelector<HTMLElement>("#modal-root [data-lenis-prevent]")
          ?.clientHeight || window.innerHeight;
      const maxScroll = inMain
        ? Math.max(0, inMain.getBoundingClientRect().height - vh)
        : S;
      const target = Math.min(S, maxScroll);
      setSwapScroll(incoming, target);
      if (target > 0) freezeModalContent(incomingRef.current, target);
    }

    const SWAP_DUR = 1.4;
    const SWAP_EASE = MOTION_EASE.move;

    // Short empty beat between the outgoing text leaving (0.85s) and the
    // incoming text arriving.
    const TEXT_IN_AT = 1.0;
    const UNDERLINE_SWEEP_AT = TEXT_IN_AT + 0.9;

    // Return/Prev/Next are identical across projects: hide the outgoing
    // copies instead of animating them. "Live Website" animates on its own.
    const outNav = Array.from(
      outgoingRef.current?.querySelectorAll<HTMLElement>(
        "[data-detail-rise]:not([data-detail-cross])",
      ) ?? [],
    );
    if (outNav.length) gsap.set(outNav, { visibility: "hidden" });

    const outHandles = swapOutDetail(0, outgoingRef.current);
    const inHandles = swapInDetail(0, incomingRef.current);
    const allHandles = [...outHandles, ...inHandles];

    // Paused for the same reason as the opening timeline.
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        // Outgoing handles are not settled: that would flash their text for
        // one frame before the layer unmounts.
        inHandles.forEach((h) => h.settle());
        gsap.set([media, img].filter(Boolean), {
          clearProps: "clipPath,transform,willChange",
        });
        // The lock is released in the cleanup, after the next render has
        // restored the scroll; releasing it here would let a fast click
        // start a swap at scrollTop 0.
        onSwapDone?.();
      },
    });
    tl.fromTo(
      media,
      { clipPath: "inset(100% 0 0 0)", willChange: "clip-path" },
      { clipPath: "inset(0% 0 0 0)", duration: SWAP_DUR, ease: SWAP_EASE },
    );
    if (img) {
      tl.fromTo(
        img,
        { scale: 1.8, willChange: "transform" },
        { scale: 1, duration: SWAP_DUR, ease: SWAP_EASE, force3D: true },
        0,
      );
    }
    outHandles.forEach((h) => h.tween && tl.add(h.tween, 0));
    inHandles.forEach((h) => h.tween && tl.add(h.tween, TEXT_IN_AT));

    tl.call(
      () => {
        const liveBar = incomingRef.current?.querySelector<HTMLElement>(
          "[data-underline-flash]",
        );
        if (liveBar) playUnderlineSweep(liveBar);
      },
      undefined,
      UNDERLINE_SWEEP_AT,
    );
    tl.play();

    return () => {
      tl.kill();
      allHandles.forEach((h) => h.settle());
      gsap.set([media, img].filter(Boolean), {
        clearProps: "clipPath,transform,willChange",
      });
      if (outNav.length) gsap.set(outNav, { clearProps: "visibility" });
      const inMain = incomingRef.current?.querySelector<HTMLElement>("main");
      if (inMain) {
        inMain.style.position = "";
        inMain.style.top = "";
        inMain.style.left = "";
        inMain.style.width = "";
      }
      unlockTransition();
    };
  }, [phase, incoming, onSwapDone]);

  if (!picked) return null;

  // `key={slug}` keeps the incoming layer mounted when the swap ends.
  const layers = isSwap
    ? ([
        { slug, picked, ref: outgoingRef, className: styles.swapOutgoing },
        {
          slug: incoming!,
          picked: incomingPicked!,
          ref: incomingRef,
          className: styles.swapIncoming,
        },
      ] as const)
    : ([{ slug, picked, ref: outgoingRef, className: styles.layer }] as const);

  return (
    <Modal>
      {layers.map((layer) => (
        <div key={layer.slug} ref={layer.ref} className={layer.className}>
          <ProjectDetail
            project={layer.picked.project}
            prev={layer.picked.prev}
            next={layer.picked.next}
          />
        </div>
      ))}
    </Modal>
  );
}
