"use client";

import { useRef, type AnchorHTMLAttributes } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { HOVER_MEDIA, REDUCE_MOTION_MEDIA } from "../lib/motion";
import styles from "./UnderlineLink.module.css";

gsap.registerPlugin(useGSAP);

// Accelerating out, decelerating in: the sweep is fastest at the midpoint
// instead of pausing there.
const SWEEP_RETRACT = { duration: 0.4, ease: "power2.in" };
const SWEEP_DRAW = { duration: 0.6, ease: "power3.out" };

/** The rule retracts to the right, then draws back in from the left. */
export function playUnderlineSweep(bar: Element): gsap.core.Timeline {
  return gsap
    .timeline()
    .to(bar, { scaleX: 0, transformOrigin: "right", ...SWEEP_RETRACT })
    .set(bar, { transformOrigin: "left" })
    .to(bar, { scaleX: 1, ...SWEEP_DRAW });
}

type UnderlineLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: React.ReactNode;
  /** Lets ModalView find the rule and play the sweep after a swap. */
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

  useGSAP(
    (_context, contextSafe) => {
      const root = rootRef.current;
      const bar = barRef.current;
      if (!root || !bar) return;

      // Gated on hover capability, not width; the CSS uses the matching
      // (hover: none) query.
      const mm = gsap.matchMedia();
      mm.add(HOVER_MEDIA, () => {
        let tl: gsap.core.Timeline | null = null;

        const onEnter = contextSafe!(() => {
          if (window.matchMedia(REDUCE_MOTION_MEDIA).matches) return;
          // overwrite doesn't work across steps of one timeline: kill and
          // recreate instead.
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
