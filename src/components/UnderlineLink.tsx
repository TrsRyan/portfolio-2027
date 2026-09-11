"use client";

import { useRef, type AnchorHTMLAttributes } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { NARROW_MEDIA, REDUCE_MOTION_MEDIA } from "../lib/motion";
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
      // ≤768px: no hover on touch -> the rule stays permanently visible
      // (scaleX 1 by CSS default), no sweep.
      if (window.matchMedia(NARROW_MEDIA).matches) return;

      // Current timeline, local to the effect: recreated on every hover,
      // killed on the next hover (a new hover while the previous one is
      // still playing) and on unmount.
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
