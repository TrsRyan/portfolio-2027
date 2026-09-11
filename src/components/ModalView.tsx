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

gsap.registerPlugin(Flip); // idempotent

// Before the first client paint -> Flip repositions .media onto the
// thumbnail without ever showing the image at its final size for an instant
// (the flash).
const useIsoLayoutEffect =
  typeof document !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Modal content, mounted/unmounted by <ProjectModalHost>. Owns the
 * transition: a dedicated Lenis for the content, the opening Flip morph
 * (`phase: "in"`), and the mirrored animated exit (`phase: "out"` ->
 * playExit -> onExitDone).
 *
 * We never touch .media's opacity during the morph — Flip would capture the
 * modified state and restore it at the end of the animation (the image
 * would disappear).
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
  // Set while a project is open (see the "mounted ONCE" effect below) if the
  // window resizes: concealHomepage()'s handles (autoSplit:false, "a resize
  // during the ~1.5s opening is negligible") are held in homeHandlesRef for
  // as long as the project stays open — a resize DURING that (much longer)
  // window leaves their SplitText lines split for the OLD width, so
  // reversing them straight on Return shows the bio (etc.) briefly
  // mis-wrapped until settle() reverts to plain, correctly-flowing text.
  // Read once on exit (below) to force fresh handles instead of stale ones.
  const homeResizedRef = useRef(false);
  // Containers for both pages during a swap (used for steps 4-5).
  const outgoingRef = useRef<HTMLDivElement>(null);
  const incomingRef = useRef<HTMLDivElement>(null);

  // --- Shell: mounted ONCE (survives Prev/Next) ----------------------
  // Lenis dedicated to the modal's content (the root is stopped +
  // data-lenis-prevent keeps it from eating wheel events here), on the same
  // GSAP ticker as the root.
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

  // --- Content: replayed for every project ---------------------------
  useIsoLayoutEffect(() => {
    const backdrop = document.querySelector<HTMLElement>(
      "#modal-root [data-lenis-prevent]",
    );
    if (!backdrop) return;
    const modalLenis = modalLenisRef.current;

    // Prev/Next doesn't unmount the modal: React reuses the same <main>,
    // which would keep the `position: fixed` set by freezeModalContent() on
    // the previous project (-> no longer scrollable). We thaw it on every
    // (re)target. A swap froze this `<main>` at `top: -S` to align the
    // images. We thaw it AND restore `scrollTop = S` in the SAME sync block
    // -> no paint between the two, no jump. (Also applies to a Prev/Next
    // that reuses the same `<main>` already frozen on the previous project.)
    const page = backdrop.querySelector<HTMLElement>("main");
    if (page) {
      page.style.position = "";
      page.style.top = "";
      page.style.left = "";
      page.style.width = "";
    }
    // Opening from the homepage -> starts at the top. Arriving via
    // Prev/Next -> we RESTORE the scroll position captured on pointerdown
    // (`setSwapScroll` with the real `scrollTop`). `takeSwapScroll` is
    // paired to the slug and clears itself.
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

    // Original thumbnail on the homepage (behind the modal): hidden for the
    // duration of the morph, otherwise it stays as a "ghost" under the
    // growing image.
    const sourceThumb = document.querySelector<HTMLElement>(
      `[data-project-thumb="${slug}"]`,
    );
    const backdropBg = backdrop.querySelector<HTMLElement>("[data-backdrop-bg]");

    homeHandlesRef.current = [];
    detailHandlesRef.current = [];
    masterTlRef.current = null;
    homeResizedRef.current = false;

    if (morph && pending && media) {
      // Signature gesture (image A -> B move): shared vocabulary.
      const DUR = MOTION_DUR.move;
      const EASE = MOTION_EASE.move;
      const img = media.querySelector<HTMLElement>("img");

      // Lock for the ENTIRE morph (Option B): without it, a Prev/Next click
      // before the opening finishes would start a swap ON TOP OF the morph
      // still in progress -> text already split by `revealDetail`, the
      // swap's SplitText produces nothing, the image mid-Flip throws off the
      // shift measurement. Only the browser's back button (unblockable) can
      // interrupt, via `masterTl.reverse()` in the "out" effect.
      lockTransition();
      modalLenis?.stop(); // no scrolling during the morph's travel
      if (sourceThumb) gsap.set(sourceThumb, { autoAlpha: 0 });

      // Transparent background during the transition (the homepage is seen
      // emptying out behind it).
      if (backdropBg) gsap.set(backdropBg, { opacity: 0 });

      // The ENTIRE opening in ONE master timeline (Codrops pattern): image +
      // homepage + detail. Lock released at the end (and by `done()` on a
      // reverse).
      // `paused: true`: concealHomepage()/revealDetail() below do the
      // Flip diff + SplitText setup, which takes real time. Nesting into a
      // timeline that hasn't ticked yet (paused, still at time 0) always
      // resets a child to the timeline's own position -> nothing to "catch
      // up" once `.play()` runs at the end. Left unpaused, the ticker's
      // first tick after this setup applies the whole elapsed gap in one
      // jump (GSAP ticker is wall-clock based, and lagSmoothing is off for
      // Lenis). Same principle as HomeIntro's `restTl`.
      const masterTl = gsap.timeline({ paused: true, onComplete: unlockTransition });
      masterTlRef.current = masterTl;

      // Without `scale: true` -> the box genuinely animates width/height and
      // object-fit:cover re-crops every frame (instead of stretching pixels).
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

      // Codrops-style settle: the image starts at the thumbnail's crop
      // (.workThumbInner sits at scale(1.2)) then settles into place.
      if (img) {
        masterTl.fromTo(
          img,
          { scale: 1.2 },
          { scale: 1, duration: DUR, ease: EASE },
          0,
        );
      }

      // Background locked opaque once the image has settled; on a reverse,
      // the playhead crosses back over this point -> the background turns
      // transparent again on its own and the homepage stays visible during
      // the rewind.
      if (backdropBg) masterTl.set(backdropBg, { opacity: 1 }, DUR);

      // Homepage (leaves right away) + detail (enters at ~mid-morph),
      // grafted onto the master via their exposed tween (.tween).
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
      // ≤768px: the transition visual is the WHITE CURTAIN (curtainCover set
      // on click in ProjectLink, curtainReveal called by ProjectModalHost
      // once this effect is mounted). Here we only LOCK — the project is
      // mounted and visible BEHIND the curtain, nothing to animate. The lock
      // is released by curtainReveal (onComplete); 4s safety net in
      // lockTransition.
      lockTransition();
    }

    return () => {
      masterTlRef.current?.kill();
      masterTlRef.current = null;
      // Both branches that lock (morph OR mobile fade) -> safety net in case
      // the transition is cut before it finishes.
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

  // --- Animated exit ---------------------------------------------------------
  // Settled close: opening finished, or arrived via Prev/Next. An
  // interruption of an opening IN PROGRESS goes through `masterTl.reverse()`
  // (a snappy rewind, see the effect further below), not through here.
  const playExit = useCallback(
    async () => {
      const media = document.querySelector<HTMLElement>(
        `#modal-root [data-flip-id="project-${slug}"]`,
      );
      const sourceThumb = document.querySelector<HTMLElement>(
        `[data-project-thumb="${slug}"]`,
      );

      // The return animates as soon as a morph is possible — not only when
      // the OPENING was one. `Flip.fit` targets a LIVE thumbnail, which
      // exists for every project (including one reached via Prev/Next,
      // without a pending flip).
      const canMorph =
        window.matchMedia(MORPH_MEDIA).matches && !!media && !!sourceThumb;

      if (!canMorph) {
        // ≤768px: the WHITE CURTAIN handles the exit (curtainCover set on a
        // Return / Escape click in ModalShell). Here we just wait for the
        // white to be fully opaque BEFORE letting the unmount happen -> no
        // flash of the homepage while the modal disappears. curtainReveal
        // (called by ProjectModalHost once the state goes back to null) will
        // reveal it afterwards.
        if (window.matchMedia(NARROW_MEDIA).matches) {
          lockTransition();
          await curtainCoverDone();
        }
        return;
      }

      lockTransition(); // no navigation clicks during the return

      const DUR = 1.15; // exit ≈ 79% of the entry — local value (no dedicated token)
      const EASE = MOTION_EASE.move; // same gesture as the opening
      const IMG_LATENCY = 0.35; // the image waits for the text to finish leaving

      modalLenisRef.current?.stop();

      // Original thumbnail hidden for the whole return, revealed at the last
      // instant when the morph's image lands on it (handoff without a
      // duplicate). The opening already does this; via Prev/Next it hasn't
      // -> hence here.
      if (sourceThumb) gsap.set(sourceThumb, { autoAlpha: 0 });

      const backdropBg = document.querySelector<HTMLElement>(
        "#modal-root [data-backdrop-bg]",
      );

      // Homepage coming back.
      // - Direct return (the opening concealed the homepage): replay ITS
      //   pieces in reverse -> exactly the earlier animation, nothing new.
      // - Via Prev/Next (no pieces yet): (re)create them, pushed to the
      //   hidden state without animation (the modal covers the homepage),
      //   then reversed.
      const homeVars = {
        duration: 0.58, // quick catch-up — local value
        ease: MOTION_EASE.enter, // arrival: sharp start then decelerating into rest
        stagger: 0.04,
        delay: 0.85,
      };
      // A resize while the project was open leaves the held handles split
      // for the OLD width (see homeResizedRef above) — settle() reverts
      // them to plain text (still hidden behind the modal, invisible) so
      // concealHomepage() can re-split fresh, at the CURRENT width, exactly
      // like the "no pieces yet" (Prev/Next) case just below already does.
      if (homeHandlesRef.current.length > 0 && homeResizedRef.current) {
        homeHandlesRef.current.forEach((h) => h.settle());
        homeHandlesRef.current = [];
      }
      if (homeHandlesRef.current.length === 0) {
        homeHandlesRef.current = concealHomepage();
        homeHandlesRef.current.forEach((h) => h.tween?.progress(1));
      }
      homeHandlesRef.current.forEach((h) => h.reverse?.(homeVars));

      // Detail: exits downward.
      detailHandlesRef.current.push(...concealDetail(0));

      await new Promise<void>((resolve) => {
        const tl = gsap.timeline({ onComplete: resolve });

        // Background: hard cut as soon as the image lifts off (no more fade
        // on return).
        if (backdropBg) tl.set(backdropBg, { opacity: 0 }, IMG_LATENCY);

        if (media && sourceThumb) {
          // Flip.fit with a `duration` returns a Tween (GSAP's typing is loose).
          // `absolute` is fine: the scrolled content is already frozen (see
          // the close layout effect), nothing can jump anymore.
          const fit = Flip.fit(media, sourceThumb, {
            absolute: true,
            duration: DUR,
            ease: EASE,
          }) as gsap.core.Tween | null;
          if (fit) tl.add(fit, IMG_LATENCY);
          const img = media.querySelector<HTMLElement>("img");
          if (img)
            tl.to(img, { scale: 1.2, duration: DUR, ease: EASE }, IMG_LATENCY);
          // the thumbnail reappears right before the landing (identical pixels)
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

    // Scrolled content frozen before the return morph. Normally already set
    // by ModalShell (Return / Escape click); safety net for the browser's
    // back button during a swap (ModalShell doesn't freeze in that case).
    freezeModalContent();

    const done = () => {
      unlockTransition();
      onExitDone();
    };

    // Interruption of an opening IN PROGRESS -> rewind it (snappy, retraces
    // the exact path, no SplitText re-split). Opening finished / Prev-Next
    // -> the settled close `playExit()`.
    const masterTl = masterTlRef.current;
    if (masterTl && masterTl.isActive()) {
      masterTl.eventCallback("onReverseComplete", done);
      masterTl.reverse();
      return;
    }

    void playExit().then(done);
  }, [phase, playExit, onExitDone]);

  // --- Project→project swap: master timeline (steps 4-5) ----------------
  // Both <ProjectDetail> instances are mounted (outgoing on a fixed layer
  // below, incoming on top). Codrops DoubleImageHoverEffects/fx1 model: two
  // stacked image copies in the same frame, the top one gets clipped.
  //   4a  INCOMING image: clip-path shutter bottom to top, covers the
  //       outgoing one pinned right underneath.
  //   4b  inner <img>: zoom out (scale) — on the image alone, never the frame.
  //   5a  text + rules: OUTGOING leaves (lines upward, rules to the right),
  //       INCOMING arrives (lines from the bottom, rules from the left),
  //       grafted onto the master via their `.tween`.
  //   5b  Return/Prev/Next: persistent furniture, not animated. The
  //       outgoing layer's set is hidden (visibility) for the duration of
  //       the swap; "Live Website" (data-detail-cross) does cross over like
  //       the text.
  // `onComplete` -> settles the pieces + onSwapDone(), which closes back onto
  // { incoming, phase: "in" } (the outgoing layer gets unmounted).
  // useIsoLayoutEffect (not useEffect): the clipped state must be set BEFORE
  // the first paint, otherwise one frame shows the incoming image in full ->
  // flash.
  useIsoLayoutEffect(() => {
    if (phase !== "swap") return;

    // "preventRunning" lock (Barba): during the swap, ModalShell swallows
    // navigation clicks — both Prev/Next AND Return/Escape (Option B,
    // standard agency practice). Only the browser's back button can get
    // through (unblockable): in that case we let the swap finish then close
    // (see `pendingExit`). Released at the end of the timeline AND on
    // cleanup. 4s safety net in lockTransition.
    lockTransition();

    const media = incomingRef.current?.querySelector<HTMLElement>(
      `[data-flip-id="project-${incoming}"]`,
    );

    // Project with no visual -> keep the swap as a hard cut. Lock released in
    // the cleanup (like the animated path), not before `onSwapDone()`.
    if (!media) {
      const id = requestAnimationFrame(() => onSwapDone?.());
      return () => {
        cancelAnimationFrame(id);
        unlockTransition();
      };
    }

    const img = media.querySelector<HTMLElement>("img");

    // --- Scroll (the image itself sits at a DETERMINISTIC position) ------------
    // Image area = constant height regardless of the project (see
    // ProjectDetail.module.css) -> both `.media` are already perfectly
    // aligned, nothing to "catch up" — the shutter plays over a static
    // image. What's left is just the scroll: we pin the incoming `<main>`
    // at the same spot as the outgoing one (`target` = S clamped to the
    // incoming layer's max scrollable), the [slug] effect restores it -> no
    // jump. Standard "capture / restore" pattern (Barba #537, mapbox
    // scroll-restorer).
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

    // Site motion family: opening morph 1.45s, close 1.15s, all on
    // EASE.move. The swap sits between the two (local duration).
    const SWAP_DUR = 1.4;
    const SWAP_EASE = MOTION_EASE.move;

    // Breathing room: the incoming content only arrives once the outgoing
    // one is WELL on its way — a short "empty" beat between the two, so it
    // reads as a genuinely new project (otherwise the text feels already
    // there, not striking enough). The outgoing conceal takes 0.85s -> here
    // ~0.3s of empty space. Tune the "blank" with this constant.
    const TEXT_IN_AT = 1.0;

    // "Live Website" underline sweep: played INSIDE the timeline, not on
    // onComplete -> it starts while the button is still arriving (revealBlock
    // takes 1.15s from TEXT_IN_AT), just before the swap ends. Tunable.
    const UNDERLINE_SWEEP_AT = TEXT_IN_AT + 0.9;

    // 5b: Return / Prev / Next (`[data-detail-rise]`) are identical from one
    // project to the next -> they don't animate and must not be duplicated
    // visually. The incoming layer (on top) carries the visible set; we hide
    // the outgoing layer's for the duration of the swap. Restored on
    // cleanup: if Return interrupts, the outgoing layer becomes the exit
    // layer and needs it back. `:not([data-detail-cross])` -> excludes
    // "Live Website": it animates on its own (swapOut/InDetail), hiding it
    // would just make it disappear.
    const outNav = Array.from(
      outgoingRef.current?.querySelectorAll<HTMLElement>(
        "[data-detail-rise]:not([data-detail-cross])",
      ) ?? [],
    );
    if (outNav.length) gsap.set(outNav, { visibility: "hidden" });

    // 5a: text/rule pieces, scoped to each layer (otherwise they'd catch
    // BOTH projects). `at: 0` -> positioned via tl.add().
    const outHandles = swapOutDetail(0, outgoingRef.current);
    const inHandles = swapInDetail(0, incomingRef.current);
    const allHandles = [...outHandles, ...inHandles];

    // `paused: true`: swapOutDetail/swapInDetail just above already did the
    // SplitText setup for both layers -> nesting their tweens here while `tl`
    // is still paused (never ticked) resets them to `tl`'s own position 0,
    // whatever time passed while they briefly existed on their own. `.play()`
    // runs once everything is wired, same fix as the opening morph above.
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        // Only the INCOMING one: settle() reverts the SplitText -> clean,
        // visible text for the "in" phase. The OUTGOING one is deliberately
        // NOT settled: that would make it visible in place for one frame
        // before onSwapDone() removes its layer (= the end-of-swap text
        // flash). We leave it wherever the tween put it, out of frame; its
        // layer gets unmounted.
        inHandles.forEach((h) => h.settle());
        gsap.set([media, img].filter(Boolean), {
          clearProps: "clipPath,transform,willChange",
        });
        // We do NOT release the lock here: `onSwapDone()` triggers an async
        // re-render, and the scroll is only recalculated in THAT render's
        // [slug] effect. Releasing the lock now would leave a window where
        // "unlocked but scroll not yet restored" lets an ultra-fast click
        // start a new swap pinned at scrollTop=0 -> jumping back to the top.
        // The lock is released in this effect's CLEANUP, in sync with the
        // scroll restore.
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
        { scale: 1, duration: SWAP_DUR, ease: SWAP_EASE },
        0,
      );
    }
    // Outgoing: leaves right away. Incoming: after the breathing gap (TEXT_IN_AT).
    outHandles.forEach((h) => h.tween && tl.add(h.tween, 0));
    inHandles.forEach((h) => h.tween && tl.add(h.tween, TEXT_IN_AT));

    // "Live Website" rule: one sweep pass, while the button is still
    // arriving (see UNDERLINE_SWEEP_AT). Detached timeline -> doesn't
    // extend the swap's duration.
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

    // Unmounting the swap layer. Two cases:
    //  - swap finished normally (onComplete already set everything) -> these
    //    `kill`/`settle`/`clearProps` are idempotent, no-ops.
    //  - swap abandoned (e.g. re-navigation) -> clean up everything here.
    return () => {
      tl.kill();
      allHandles.forEach((h) => h.settle());
      gsap.set([media, img].filter(Boolean), {
        clearProps: "clipPath,transform,willChange",
      });
      if (outNav.length) gsap.set(outNav, { clearProps: "visibility" });
      // Thaw the incoming `<main>` if the swap is abandoned before the
      // [slug] effect runs.
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

  // A single page outside a swap; two during a swap. `key={slug}` on each
  // layer -> on the swap→in transition, React keeps the already-mounted
  // incoming layer.
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
