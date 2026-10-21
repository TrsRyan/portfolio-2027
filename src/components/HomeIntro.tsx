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
import {
  NARROW_MEDIA,
  TITLE_LINE_OVERSHOOT,
  RISE_OVERSHOOT,
  THUMB_OVERSHOOT,
} from "../lib/motion";
import styles from "./HomeIntro.module.css";

gsap.registerPlugin(useGSAP, SplitText);

/**
 * Homepage intro: the name rises centered, holds, and flies to its place
 * while the rest of the page reveals top to bottom. Plays once per session;
 * later visits get a plain fade.
 */
export default function HomeIntro({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  // useLenis can be null on first render and build() runs later, so read it
  // through a ref.
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  useEffect(() => {
    lenisRef.current = lenis;
  }, [lenis]);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      // No width condition, so matchMedia doesn't revert on resize.
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const name = root.querySelector<HTMLElement>("[data-intro-name]");
        const slot = root.querySelector<HTMLElement>("[data-intro-name-slot]");
        if (!name || !slot) return;

        const bio = root.querySelector<HTMLElement>("p[data-intro-split]");
        const workLabel = root.querySelector<HTMLElement>("h2[data-intro-split]");
        const years = Array.from(
          root.querySelectorAll<HTMLElement>("li > span[data-intro-split]"),
        );
        // Titles are already split into lines in the markup.
        const titles = Array.from(
          root.querySelectorAll<HTMLElement>("a span[data-intro-split]"),
        );
        const titleTexts = Array.from(
          root.querySelectorAll<HTMLElement>("[data-intro-line]"),
        );
        const thumbReveals = Array.from(
          root.querySelectorAll<HTMLElement>("[data-intro-thumb]"),
        );
        const riseContainers = Array.from(
          root.querySelectorAll<HTMLElement>("[data-intro-rise]"),
        );
        const riseLines = Array.from(
          root.querySelectorAll<HTMLElement>("[data-intro-rise-line]"),
        );
        const stroke = root.querySelector<HTMLElement>("[data-intro-stroke]");

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

        // Links keep their size while their content is hidden: block hover
        // and clicks until the intro ends.
        const links = Array.from(root.querySelectorAll<HTMLElement>("a"));
        gsap.set(links, { pointerEvents: "none" });

        const returning = hasVisited();
        markVisited();
        if (returning) {
          root.setAttribute("data-intro-ready", "");
          gsap.set(links, { clearProps: "pointerEvents" });
          setIntroFinisher(null);
          const fade = gsap.fromTo(
            introHidden,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.4, ease: "power1.out" },
          );
          return () => fade.kill();
        }

        // Lifts the CSS anti-FOUC rule in globals.css.
        const arm = () => root.setAttribute("data-intro-ready", "");

        let split: SplitText | null = null;
        let tl: gsap.core.Timeline | null = null;
        let restTl: gsap.core.Timeline | null = null;
        let cancelled = false;
        let restartTimer: number | undefined;

        const handles: RevealHandle[] = [];
        const settleAll = () => handles.forEach((h) => h.settle());

        const resetInnerBlocks = () =>
          gsap.set([...titleTexts, ...thumbReveals, ...riseLines], {
            clearProps: "transform",
          });

        const showRaw = () => {
          arm();
          gsap.set(introHidden, { clearProps: "opacity,visibility,transform" });
          resetInnerBlocks();
        };
        // Scroll is locked during the intro, so GSAP's lag smoothing can be
        // restored: a stalled main thread pauses the flight instead of
        // skipping frames.
        const lockScroll = () => {
          lenisRef.current?.stop();
          gsap.ticker.lagSmoothing(500, 33);
        };
        const unlock = () => {
          lenisRef.current?.start();
          gsap.ticker.lagSmoothing(0);
          gsap.set(links, { clearProps: "pointerEvents" });
        };

        const restore = () => {
          gsap.set(name, {
            clearProps: "position,left,top,margin,transform,opacity,visibility",
          });
          gsap.set(slot, { clearProps: "height" });
        };

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

        // Positions are measured once, so a resize mid-intro restarts it
        // after the window settles.
        const onResize = () => {
          if (cancelled) return;
          teardown();
          window.clearTimeout(restartTimer);
          restartTimer = window.setTimeout(() => {
            if (cancelled) return;
            teardown();
            build();
          }, 180);
        };
        const stopWatchingResize = () => {
          window.removeEventListener("resize", onResize);
          window.clearTimeout(restartTimer);
        };

        // If fonts never load, show the content as-is after 3s.
        const armTimer = window.setTimeout(() => {
          if (cancelled || root.hasAttribute("data-intro-ready")) return;
          cancelled = true;
          restore();
          showRaw();
          unlock();
          stopWatchingResize();
        }, 3000);

        // Ends the intro instantly when a project opens mid-intro, so
        // concealHomepage() doesn't split the same elements twice.
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

        // Fixed minimum hold rather than waiting on window.load: images
        // already reserve their layout space, so nothing shifts later.
        const HOLD_MIN = 0.6;
        const pageReady = () =>
          new Promise<void>((r) => window.setTimeout(r, HOLD_MIN * 1000));

        // Runs after fonts load (SplitText needs final metrics).
        const build = () => {
          if (cancelled || !name.isConnected) return;

          const home = name.getBoundingClientRect();

          // Centered with position:fixed rather than a transform, to avoid
          // anti-aliasing shifts during the rise.
          const centerLeft = Math.round(window.innerWidth / 2 - home.width / 2);
          const centerTop = Math.round(window.innerHeight / 2 - home.height / 2);
          gsap.set(slot, { height: home.height });
          gsap.set(name, {
            position: "fixed",
            left: centerLeft,
            top: centerTop,
            margin: 0,
          });

          // Mask per line (tall enough for descenders), animate per word.
          split = SplitText.create(name, { type: "lines,words", mask: "lines" });
          if (!split.words.length) {
            restore();
            showRaw();
            unlock();
            stopWatchingResize();
            return;
          }
          gsap.set(split.words, { yPercent: 100 });
          gsap.set(name, { autoAlpha: 1 });

          const RISE_DUR = 1.2;
          tl = gsap.timeline({ delay: 0.4, onStart: lockScroll });
          tl
            .to(split.words, {
              yPercent: 0,
              duration: RISE_DUR,
              ease: "power4.out",
              stagger: 0.12,
            })
            .to({}, { duration: 0.6 });

          // Flight + page reveal. Paused while it is filled in: nesting into
          // a paused timeline keeps every child aligned to its start.
          restTl = gsap.timeline({
            paused: true,
            onComplete: () => {
              unlock();
              stopWatchingResize();
            },
          });

          const isNarrow = window.matchMedia(NARROW_MEDIA).matches;

          // Starting offsets must match the reveal overshoots, or the top of
          // the capitals peeks out while loading.
          const OS_TITLE = TITLE_LINE_OVERSHOOT;
          const OS_RISE = RISE_OVERSHOOT;
          const OS_THUMB = THUMB_OVERSHOOT;
          if (!isNarrow) {
            gsap.set(titleTexts, { yPercent: 100 + OS_TITLE });
            gsap.set(thumbReveals, { yPercent: 100 + OS_THUMB });
            gsap.set(riseLines, { yPercent: 100 + OS_RISE });
            if (stroke)
              gsap.set(stroke, { scaleX: 0, transformOrigin: "left center" });
            gsap.set(
              [...titles, ...riseContainers, ...(stroke ? [stroke] : [])],
              { autoAlpha: 1 },
            );
          }

          window.clearTimeout(armTimer);
          arm();

          // The page starts revealing before the name lands, so the two
          // motions overlap instead of chaining.
          const FLIGHT_DUR = 2;
          const REVEAL_AT = FLIGHT_DUR * 0.6;

          // `restTl !== myRest` means a resize rebuilt the intro and this
          // closure is stale.
          let prepped = false;
          let restStarted = false;
          const myRest = restTl;

          // Builds the reveal tweens during the hold, while nothing moves:
          // SplitText.create() blocks the main thread, and doing it at the
          // flight trigger would cause a visible stall.
          const prepChoreography = () => {
            if (prepped || cancelled || restTl !== myRest || !restTl) return;
            prepped = true;

            // Mobile: one fade-and-rise wave, blocks sorted by position.
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
                vars: { duration: 1.2, ease: "expo.out", stagger: 0.06 },
              });
              if (h) {
                handles.push(h);
                if (h.tween) restTl.add(h.tween, REVEAL_AT);
              }
              return;
            }

            const EASE = "expo.out";
            const DUR = 1.15;
            const LINE_STAGGER = 0.09;
            const ITEM_STAGGER = 0.15;
            const v = { duration: DUR, ease: EASE };
            const vLines = { ...v, stagger: LINE_STAGGER };
            // Title lines travel farther; same ratio as concealHomepage().
            const vTitleLines = { ...vLines, duration: DUR * (165 / 115) };

            const add = (h: RevealHandle | null, at: number) => {
              if (!h) return;
              handles.push(h);
              if (h.tween) restTl?.add(h.tween, REVEAL_AT + at);
            };

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
            add(
              revealDraw(stroke, { at: 0, vars: { ...v, duration: DUR * 1.2 } }),
              0.28,
            );

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
                  ? revealBlock(lines, {
                      at: 0,
                      overshoot: OS_TITLE,
                      vars: vTitleLines,
                    })
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

          const playRest = () => {
            if (restStarted || cancelled || restTl !== myRest || !restTl) return;
            restStarted = true;

            prepChoreography();

            // Revert the split before the flight: transforming an <h1> that
            // still holds masks causes anti-aliasing shimmer.
            split?.revert();
            split = null;

            // Measure the slot now, not earlier, so the name lands exactly.
            // force3D: true keeps the GPU layer to the last frame ("auto"
            // drops it and jumps).
            const dest = slot.getBoundingClientRect();
            restTl.to(
              name,
              {
                x: Math.round(dest.left - centerLeft),
                y: Math.round(dest.top - centerTop),
                duration: FLIGHT_DUR,
                ease: "power4.inOut",
                force3D: true,
                onComplete: restore,
              },
              0,
            );

            restTl.play();
          };

          // The flight starts once the rise is done AND the hold is over.
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
        setIntroFinisher(finish);

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
