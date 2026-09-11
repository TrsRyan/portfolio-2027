"use client";

import { useRef, type AnchorHTMLAttributes } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { WIDE_MEDIA, REDUCE_MOTION_MEDIA } from "../lib/motion";
import styles from "./UnderlineLink.module.css";

gsap.registerPlugin(useGSAP);

// Asymmetric sweep: the retraction accelerates on its way out, the return
// decelerates on arrival -> the midpoint (rule at zero) is the FASTEST
// point, not a stop. That's what makes the gesture feel continuous and
// fluid. Tune here.
const SWEEP_RETRACT = { duration: 0.4, ease: "power2.in" };
const SWEEP_DRAW = { duration: 0.6, ease: "power3.out" };

/** The exact hover sequence: the rule retracts to the right, then draws back
 *  in from the left. Reused as-is at the end of a project→project swap (see
 *  ModalView) — same speed, same ease. */
export function playUnderlineSweep(bar: Element): gsap.core.Timeline {
  return gsap
    .timeline()
    .to(bar, { scaleX: 0, transformOrigin: "right", ...SWEEP_RETRACT })
    .set(bar, { transformOrigin: "left" })
    .to(bar, { scaleX: 1, ...SWEEP_DRAW });
}

type UnderlineLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: React.ReactNode;
  /** Sets `data-underline-flash` on the rule -> ModalView finds it to play
   *  `playUnderlineSweep` once, at the end of the swap. */
  barFlash?: boolean;
};

export default function UnderlineLink({
  children,
  className,
  barFlash,
  ...rest
}: UnderlineLinkProps) {
  const rootRef = useRef<HTMLAnchorElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  // Everything happens INSIDE useGSAP (an effect): handler created with
  // contextSafe, event listener, cleanup. @gsap/react docs' "event
  // handlers" pattern — refs are only read here, never during render.
  useGSAP(
    (_context, contextSafe) => {
      const root = rootRef.current;
      const bar = barRef.current;
      if (!root || !bar) return;

      // Gated on a live media query, not a one-time check: a mouse can
      // hover at any width (a narrowed desktop window), and the sweep must
      // stop the instant the layout crosses into the touch/mobile regime
      // (the rule stays permanently visible there, scaleX 1 by CSS default)
      // — a one-time check at mount would leave it wired after a resize.
      const mm = gsap.matchMedia();
      mm.add(WIDE_MEDIA, () => {
        // Current timeline, local to this match: recreated on every hover,
        // killed on the next hover (a new hover while the previous one is
        // still playing) and when the query stops matching.
        let tl: gsap.core.Timeline | null = null;

        const onEnter = contextSafe!(() => {
          if (window.matchMedia(REDUCE_MOTION_MEDIA).matches) return;
          // overwrite:true across steps of the SAME timeline is a classic
          // GSAP pitfall -> kill and recreate instead.
          tl?.kill();
          tl = playUnderlineSweep(bar);
        });

        root.addEventListener("mouseenter", onEnter);
        return () => {
          root.removeEventListener("mouseenter", onEnter);
          tl?.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: rootRef }
  );

  return (
    <a {...rest} ref={rootRef} className={`${styles.link} ${className ?? ""}`}>
      {children}
      <span
        ref={barRef}
        className={styles.bar}
        aria-hidden="true"
        {...(barFlash ? { "data-underline-flash": true } : null)}
      />
    </a>
  );
}
