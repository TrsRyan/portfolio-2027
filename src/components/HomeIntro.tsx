"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import {
  revealLines,
  revealBlock,
  revealDraw,
  type RevealHandle,
} from "../lib/reveal";
import { setIntroFinisher } from "../lib/projectTransition";
import { hasVisited, markVisited } from "../lib/introSession";
import { NARROW_MEDIA, TITLE_LINE_OVERSHOOT } from "../lib/motion";
import styles from "./HomeIntro.module.css";

gsap.registerPlugin(useGSAP, SplitText);

/**
 * Homepage intro sequence.
 *
 *   3a  the name rises under a mask (SplitText reveal), then stays centered
 *       = LOADING MOMENT (a fixed minimum hold, see `pageReady`)
 *   3b  page ready -> the name's SplitText is reverted, flies to its place
 *       (plain text)
 *   4   the rest reveals in a top -> bottom CASCADE (playRest, measured on a
 *       stabilized layout): bio -> time -> "Work" -> rule -> project list,
 *       project by project (year + title + thumbnail) -> contact links LAST.
 *       power3.out, generous stagger (Material/Carbon "choreography" pattern).
 *   ~   resize during the intro -> restarted from scratch (debounced)
 *
 * Plays once per session: `hasVisited()` (lib/introSession.ts). Flag already
 * set (refresh, direct link to a project, coming back) -> a pure opacity
 * fade of the content, not the signature gesture.
 * prefers-reduced-motion: matchMedia never fires -> everything shows normally.
 */
export default function HomeIntro({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  // useLenis can return null on the first render; build() runs in a
  // microtask (after fonts.ready), so we keep an up-to-date ref via an effect.
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      // No width condition -> matchMedia doesn't revert on resize.
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const name = root.querySelector<HTMLElement>("[data-intro-name]");
        const slot = root.querySelector<HTMLElement>("[data-intro-name-slot]");
        if (!name || !slot) return;

        // Targets for step 4. bio = the only <p>; workLabel = the only <h2>;
        // years = the <span> DIRECT children of <li> (the title itself is a
        // <span> inside the <a>, never a direct child of <li>).
        const bio = root.querySelector<HTMLElement>("p[data-intro-split]");
        const workLabel = root.querySelector<HTMLElement>("h2[data-intro-split]");
        const years = Array.from(
          root.querySelectorAll<HTMLElement>("li > span[data-intro-split]"),
        );
        // Titles: NO SplitText (the .workTitleLine lines already exist).
        // titles = the containers (hidden before paint); titleTexts = what
        // rises (one per line); thumbReveals = the thumbnail intro wrapper.
        const titles = Array.from(
          root.querySelectorAll<HTMLElement>("a span[data-intro-split]"),
        );
        const titleTexts = Array.from(
          root.querySelectorAll<HTMLElement>("[data-intro-line]"),
        );
        const thumbReveals = Array.from(
          root.querySelectorAll<HTMLElement>("[data-intro-thumb]"),
        );
        // data-intro-rise: unsplit blocks (time + links). The container is
        // the mask (overflow:clip), riseLine is what rises underneath it.
        const riseContainers = Array.from(
          root.querySelectorAll<HTMLElement>("[data-intro-rise]"),
        );
        const riseLines = Array.from(
          root.querySelectorAll<HTMLElement>("[data-intro-rise-line]"),
        );
        // 4.6 — the rule under the header: scaleX 0 -> 1.
        const stroke = root.querySelector<HTMLElement>("[data-intro-stroke]");

        // Hidden before paint (useGSAP = layout effect) -> no flash of
        // unsplit text while the JS sets the starting state.
        const introHidden = [
          name,
          bio,
          workLabel,
          ...years,
          ...titles,
          ...riseContainers,
          stroke,
        ].filter((el): el is HTMLElement => el != null);
        gsap.set(introHidden, { autoAlpha: 0 });

        // Links (projects + contact) already exist at their real size during
        // the intro — only their CONTENT is hidden. Without this: hover =
        // pointer cursor, click = navigation, while nothing is visible yet.
        // Neutralized for the intro's duration (restored by `unlock()` on
        // every exit path).
        const links = Array.from(root.querySelectorAll<HTMLElement>("a"));
        gsap.set(links, { pointerEvents: "none" });

        // --- Returning within the session: skip the signature gesture -----------------
        // Flag set on the first page load anywhere on the site (see
        // lib/introSession.ts). Present -> the full intro (centered name +
        // flight) doesn't replay: a soft ~0.4s fade of the content, in its
        // natural place (the name stays in flow, revealed with the rest).
        // Fixes the "refresh on homepage" case (no more name flying off
        // screen while scrolled down) and "project then Return after a
        // refresh".
        const returning = hasVisited();
        markVisited();
        if (returning) {
          root.setAttribute("data-intro-ready", ""); // lifts the CSS anti-FOUC
          gsap.set(links, { clearProps: "pointerEvents" });
          setIntroFinisher(null); // no rich intro to wrap up
          // PURE opacity fade: everything together, no translation, no
          // stagger (explicit user request: "just a simple fade").
          const fade = gsap.fromTo(
            introHidden,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.4, ease: "power1.out" },
          );
          return () => fade.kill();
        }

        // Anti-FOUC: the intro content is hidden in CSS until this
        // attribute is set (see globals.css). Armed once the starting
        // states are in place, or via any fallback path. Never removed:
        // idempotent.
        const arm = () => root.setAttribute("data-intro-ready", "");

        let split: SplitText | null = null; // the name (handled separately: 3a/3b)
        let tl: gsap.core.Timeline | null = null; // rise + minimum hold
        let restTl: gsap.core.Timeline | null = null; // flight + reveal (paused while loading)
        let cancelled = false;
        let restartTimer: number | undefined;

        // Handles for step 4's reveals: settle() = revert + plain visible text.
        const handles: RevealHandle[] = [];
        const settleAll = () => handles.forEach((h) => h.settle());

        // introHidden doesn't cover the inner blocks (titleTexts /
        // thumbReveals / riseLines, translated via yPercent) -> their
        // transform is reset separately, on every exit path.
        const resetInnerBlocks = () =>
          gsap.set([...titleTexts, ...thumbReveals, ...riseLines], {
            clearProps: "transform",
          });

        // Fallback exit if build() stops before splitting anything.
        const showRaw = () => {
          arm();
          gsap.set(introHidden, { clearProps: "opacity,visibility,transform" });
          resetInnerBlocks();
        };
        // Scroll is locked for the intro's whole duration -> Lenis/
        // ScrollTrigger sync (the reason lagSmoothing is off app-wide, see
        // SmoothScroll.tsx) doesn't apply here. GSAP's default jump
        // protection is restored for that window, so a stalled main thread
        // (slow device, background tab) pauses the flight instead of
        // teleporting it to a later frame.
        const lockScroll = () => {
          lenisRef.current?.stop();
          gsap.ticker.lagSmoothing(500, 33);
        };
        const unlock = () => {
          lenisRef.current?.start();
          gsap.ticker.lagSmoothing(0);
          gsap.set(links, { clearProps: "pointerEvents" });
        };

        // The name always ends up visible and in flow, the slot always freed.
        const restore = () => {
          gsap.set(name, {
            clearProps: "position,left,top,margin,transform,opacity,visibility",
          });
          gsap.set(slot, { clearProps: "height" });
        };

        // Fully tears down the intro (timeline, splits, reveals) and hides
        // everything again.
        const teardown = () => {
          tl?.kill();
          tl = null;
          restTl?.kill();
          restTl = null;
          split?.revert();
          split = null;
          settleAll();
          handles.length = 0;
          restore();
          gsap.set(introHidden, { autoAlpha: 0 });
          resetInnerBlocks();
        };

        // Resize WHILE the intro is running: positions are only measured
        // once -> instead of a clumsy realignment, we RESTART the intro
        // from scratch once the window has settled (the pattern used by
        // sites that handle this cleanly, e.g. normalisboring.es). During
        // the drag, everything is cut and hidden: no stale animation stays
        // on screen.
        const onResize = () => {
          if (cancelled) return;
          teardown();
          window.clearTimeout(restartTimer);
          restartTimer = window.setTimeout(() => {
            // teardown() again: covers the case where build() ran in the
            // meantime (e.g. document.fonts.ready resolving mid-drag).
            if (cancelled) return;
            teardown();
            build();
          }, 180);
        };
        const stopWatchingResize = () => {
          window.removeEventListener("resize", onResize);
          window.clearTimeout(restartTimer);
        };

        // Anti-deadlock safety net: if fonts never load, give up on the
        // intro after 3s and show the content as-is (same actions as
        // fonts.ready's .catch). Auto-neutralized if build() has already armed.
        const armTimer = window.setTimeout(() => {
          if (cancelled || root.hasAttribute("data-intro-ready")) return;
          cancelled = true;
          restore();
          showRaw();
          unlock();
          stopWatchingResize();
        }, 3000);

        // Finishes the intro instantly: everything visible IN PLACE,
        // SplitText instances reverted, timers cleared. Called when a
        // project opens during the intro — otherwise HomeIntro and
        // concealHomepage() would split the same [data-intro-split] elements.
        const finish = () => {
          if (cancelled) return;
          cancelled = true;
          stopWatchingResize();
          tl?.kill();
          tl = null;
          restTl?.kill();
          restTl = null;
          split?.revert();
          split = null;
          settleAll();
          handles.length = 0;
          restore();
          gsap.set(introHidden, {
            clearProps: "opacity,visibility,transform",
          });
          resetInnerBlocks();
          unlock();
          arm();
        };

        // Once risen, the name stays centered = LOADING MOMENT: a fixed
        // minimum hold, no flicker on a warm cache. Nothing else worth
        // waiting for — fonts are already resolved before build() runs, and
        // every image (next/image, explicit width/height) reserves its
        // layout space before it's done decoding, so nothing shifts under
        // the reveal measurements later. `window.load` used to gate this
        // too (every image's network fetch, irrelevant to layout, and open-
        // ended on a slow connection) — preloader convention favors a short
        // fixed hold over an unbounded wait (see sources).
        const HOLD_MIN = 0.6;
        const pageReady = () =>
          new Promise<void>((r) => window.setTimeout(r, HOLD_MIN * 1000));

        // SplitText must run after fonts have loaded.
        const build = () => {
          if (cancelled || !name.isConnected) return;

          const home = name.getBoundingClientRect(); // natural position, before moving

          // Centering via layout (position:fixed), NOT via transform: no
          // transform on the <h1> during the rise -> no anti-aliasing shift.
          const centerLeft = Math.round(window.innerWidth / 2 - home.width / 2);
          const centerTop = Math.round(window.innerHeight / 2 - home.height / 2);
          // The slot keeps the name's height -> the content below doesn't jump up.
          gsap.set(slot, { height: home.height });
          gsap.set(name, {
            position: "fixed",
            left: centerLeft,
            top: centerTop,
            margin: 0,
          });

          // Split into lines AND words: the MASK is per LINE (tall enough
          // for descenders — "Ryan" has a y — unlike a per-word mask which
          // clipped them), the ANIMATION targets the WORDS: "Torres" then
          // "Ryan" rise one after the other (stagger 3a).
          split = SplitText.create(name, { type: "lines,words", mask: "lines" });
          if (!split.words.length) {
            restore();
            showRaw();
            unlock();
            stopWatchingResize();
            return;
          }
          gsap.set(split.words, { yPercent: 100 }); // under the line mask
          gsap.set(name, { autoAlpha: 1 });

          // Timeline 1: the name rising + a minimum hold. At its end, the
          // name is centered and the intro WAITS (see the chaining below).
          const RISE_DUR = 1.2; // also where prepChoreography() fires (mid-hold)
          tl = gsap.timeline({ delay: 0.4, onStart: lockScroll });
          tl
            // 3a — the words rise under the line mask, offset (first name
            // then last name). Duration / curve unchanged (user's values).
            .to(split.words, {
              yPercent: 0,
              duration: RISE_DUR,
              ease: "power4.out",
              stagger: 0.12,
            })
            .to({}, { duration: 0.6 }); // minimum hold, even with nothing to load

          // Timeline 2: flight to the corner + reveal. Empty and PAUSED for
          // now. Two things fill it in, independently:
          //  - prepChoreography() wires the REST's reveals (SplitText etc.)
          //    as soon as the rise's visible motion stops (mid-hold) —
          //    nothing is on screen moving then, so its real cost (5
          //    SplitText.create calls) is free to pay there instead of at
          //    the flight trigger.
          //  - playRest() adds the name's flight once the rise is FULLY
          //    done *and* the page is ready, then plays restTl.
          // Nesting into a still-paused timeline always resets a child to
          // the timeline's own position, whichever of the two runs first.
          restTl = gsap.timeline({
            paused: true,
            onComplete: () => {
              unlock();
              stopWatchingResize(); // intro finished: no more restarts on resize
            },
          });

          // ≤768px: FADE regime (name unchanged, the REST as opacity + rise).
          // The "reveal" family (homepage cascade + project detail) switches
          // together; the name stays identical everywhere (signature gesture).
          const isNarrow = window.matchMedia(NARROW_MEDIA).matches;

          // 4 — STARTING states for the rest. In the rich version: yPercent /
          // scaleX on the inner pieces (set WITHOUT measuring; the tweens
          // that DO measure are created later by prepChoreography, on a
          // stabilized layout). The overshoot MUST match here and there
          // (otherwise a sliver of the capital letters' tops shows while
          // loading).
          const OS_TITLE = TITLE_LINE_OVERSHOOT;
          const OS_RISE = 5;
          // No text/optical-overshoot concern (a plain rectangular frame),
          // just enough to clear the subpixel rounding gap between the
          // mask's edge and the transform's computed position — the same
          // "sliver at the start" class of bug as OS_TITLE/OS_RISE guard
          // against, reported on Chrome/Edge only.
          const OS_THUMB = 5;
          if (!isNarrow) {
            gsap.set(titleTexts, { yPercent: 100 + OS_TITLE });
            gsap.set(thumbReveals, { yPercent: 100 + OS_THUMB });
            gsap.set(riseLines, { yPercent: 100 + OS_RISE });
            if (stroke)
              gsap.set(stroke, { scaleX: 0, transformOrigin: "left center" });
            // Containers become visible (content already out of frame).
            gsap.set(
              [...titles, ...riseContainers, ...(stroke ? [stroke] : [])],
              { autoAlpha: 1 },
            );
          }
          // In fade mode: the blocks stay autoAlpha:0 (introHidden) ->
          // prepChoreography reveals them via opacity + rise. Nothing else
          // to set.

          // Starting states in place -> lift the anti-FOUC mask.
          window.clearTimeout(armTimer);
          arm();

          const REVEAL_AT = 2; // = end of the flight (its duration)

          // `restTl !== myRest`: a resize in between did a teardown + rebuild
          // -> this closure is stale, restTl now points at the NEW timeline.
          let prepped = false;
          let restStarted = false;
          const myRest = restTl;

          // Wires the REST's reveal choreography into restTl (still paused —
          // this only builds/positions tweens, nothing plays yet). Fired by
          // `tl.call()` below, mid-hold: the rise has stopped moving and the
          // flight hasn't started, so this is dead time to spend the
          // SplitText setup's real cost, instead of paying it at the flight
          // trigger (research-verified: pausing/playing a timeline only
          // fixes an animation's *timing*, not the main-thread stall a long
          // synchronous task like SplitText.create() causes while it runs —
          // that stall has to be moved earlier, not scheduled differently).
          const prepChoreography = () => {
            if (prepped || cancelled || restTl !== myRest || !restTl) return;
            prepped = true;

            // ≤768px — FADE regime: opacity + a small rise, no mask, no
            // SplitText, no thumbnail (display:none). A SINGLE continuous
            // wave top to bottom (blocks sorted by on-screen position, small
            // regular offset) -> no jerky "one by one", smoother than a
            // split choreography. The rule gets the SAME gesture as the
            // rest (fade + rise), not just a fade. Modeled on hirotos.com.
            if (isNarrow) {
              const blocks = introHidden
                .filter((el) => el !== name)
                .sort(
                  (a, b) =>
                    a.getBoundingClientRect().top - b.getBoundingClientRect().top,
                );
              const h = revealBlock(blocks, {
                at: 0,
                fade: true,
                // a touch slower + a touch more spaced out: less "hard",
                // same curve (expo.out, already validated).
                vars: { duration: 1.2, ease: "expo.out", stagger: 0.06 },
              });
              if (h) {
                handles.push(h);
                if (h.tween) restTl.add(h.tween, REVEAL_AT);
              }
              return;
            }

            // --- Choreography (≥769px): ONE top-to-bottom sweep ---
            // Material/Carbon "choreography" doc: never all at once, a
            // single path for the eye to follow. expo.out: a sharp start
            // (not soft) + a long final glide (stays fluid). Generous stagger.
            const EASE = "expo.out";
            const DUR = 1.15;
            const LINE_STAGGER = 0.09; // between lines of the same block
            const ITEM_STAGGER = 0.15; // between list items
            const v = { duration: DUR, ease: EASE };
            const vLines = { ...v, stagger: LINE_STAGGER };

            // Adds a handle to restTl at REVEAL_AT + `at`, and remembers it
            // for settle (finish / teardown / cleanup).
            const add = (h: RevealHandle | null, at: number) => {
              if (!h) return;
              handles.push(h);
              if (h.tween) restTl?.add(h.tween, REVEAL_AT + at);
            };

            // 1 bio · 2 time · 3 "Work" · 4 rule
            add(revealLines(bio, { at: 0, vars: vLines, autoSplit: false }), 0);
            const timeLine = root.querySelector<HTMLElement>(
              "p[data-intro-rise] [data-intro-rise-line]",
            );
            add(
              timeLine
                ? revealBlock(timeLine, { at: 0, overshoot: OS_RISE, vars: v })
                : null,
              0.12,
            );
            add(
              revealLines(workLabel, { at: 0, vars: v, autoSplit: false }),
              0.22,
            );
            add(revealDraw(stroke, { at: 0, vars: v }), 0.28);

            // 5 — the list, PROJECT BY PROJECT, top to bottom. Within a
            // project: year + title lines together, thumbnail slightly
            // after. overshoot OS_TITLE: clears the overflow-clip-margin +
            // the optical overshoot of round capitals -> no sliver at the start.
            const items = Array.from(
              root.querySelectorAll<HTMLElement>("ol > li"),
            );
            const LIST_AT = 0.38;
            items.forEach((li, i) => {
              const at = LIST_AT + i * ITEM_STAGGER;
              const year = li.querySelector<HTMLElement>(
                ":scope > span[data-intro-split]",
              );
              const lines = Array.from(
                li.querySelectorAll<HTMLElement>("[data-intro-line]"),
              );
              const thumb = li.querySelector<HTMLElement>("[data-intro-thumb]");
              add(
                year
                  ? revealLines(year, { at: 0, vars: v, autoSplit: false })
                  : null,
                at,
              );
              add(
                lines.length
                  ? revealBlock(lines, { at: 0, overshoot: OS_TITLE, vars: vLines })
                  : null,
                at,
              );
              add(
                thumb
                  ? revealBlock(thumb, { at: 0, overshoot: OS_THUMB, vars: v })
                  : null,
                at + 0.06,
              );
            });

            // 6 — contact links, LAST (after the last project).
            const listEnd =
              LIST_AT + Math.max(0, items.length - 1) * ITEM_STAGGER;
            const contacts = Array.from(
              root.querySelectorAll<HTMLElement>(
                "address [data-intro-rise-line]",
              ),
            );
            contacts.forEach((el, i) => {
              add(
                revealBlock(el, { at: 0, overshoot: OS_RISE, vars: v }),
                listEnd + 0.25 + i * 0.1,
              );
            });
          };

          // Adds the name's flight + plays restTl. Called ONCE, once the
          // rise is FULLY done *and* the page is READY.
          const playRest = () => {
            if (restStarted || cancelled || restTl !== myRest || !restTl) return;
            restStarted = true;

            // Safety net: prepChoreography() normally already ran mid-hold
            // (tl.call below always fires before tl's own onComplete, since
            // it sits earlier on the same timeline) — idempotent if it did.
            prepChoreography();

            // We REVERT the name's SplitText before the flight: the rise
            // needed it (per-line mask), the flight doesn't. Transforming
            // an <h1> that contains masks + split text = AA shimmer on GPU
            // during the move (a documented lesson: never nest a text
            // reveal inside a parent transform). The name is now static and
            // fully visible -> a seamless revert.
            split?.revert();
            split = null;

            // 3b — flight to the name's natural spot. We RE-MEASURE the
            // slot HERE (it stayed in flow, at its real landing position)
            // rather than reusing `home` measured earlier -> the name lands
            // PERFECTLY, no jump on restore(). `force3D: true`: keeps the
            // GPU layer until the very end (the "auto" default switches
            // back to 2D on the last frame = a jump).
            const dest = slot.getBoundingClientRect();
            restTl.to(
              name,
              {
                x: Math.round(dest.left - centerLeft),
                y: Math.round(dest.top - centerTop),
                duration: 2,
                ease: "power4.inOut",
                force3D: true,
                onComplete: restore,
              },
              0,
            );

            restTl.play();
          };

          // Chaining: prepChoreography fires mid-hold, as soon as the rise's
          // visible motion stops. The SEQUEL (flight) starts once the rise
          // is FULLY done *and* the page is READY — in between, the name
          // stays centered = loading.
          let riseDone = false;
          let pageIsReady = false;
          const maybeContinue = () => {
            if (riseDone && pageIsReady) playRest();
          };
          tl.call(prepChoreography, undefined, RISE_DUR);
          tl.eventCallback("onComplete", () => {
            riseDone = true;
            maybeContinue();
          });
          void pageReady().then(() => {
            pageIsReady = true;
            maybeContinue();
          });
        };

        window.addEventListener("resize", onResize);
        setIntroFinisher(finish); // concealHomepage() can wrap up the intro

        if (document.fonts?.status === "loaded") build();
        else
          void document.fonts?.ready.then(build).catch(() => {
            restore();
            showRaw();
            unlock();
            stopWatchingResize();
          });

        return () => {
          cancelled = true;
          setIntroFinisher(null);
          window.clearTimeout(armTimer);
          tl?.kill();
          restTl?.kill();
          split?.revert();
          restore();
          settleAll();
          showRaw();
          unlock();
          stopWatchingResize();
        };
      });

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className={styles.contents} data-intro-root>
      {children}
    </div>
  );
}
