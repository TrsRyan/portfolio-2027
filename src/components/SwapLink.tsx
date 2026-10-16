"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import {
  DUR,
  EASE as MOTION_EASE,
  HOVER_MEDIA,
  REDUCE_MOTION_MEDIA,
} from "../lib/motion";
import styles from "./SwapLink.module.css";

gsap.registerPlugin(useGSAP);

const DURATION = DUR.hover;
const EASE = MOTION_EASE.enter;
const GAP = 8; // px between the two copies while sliding

type Direction = "up" | "left" | "right";

const AXIS: Record<Direction, "x" | "y"> = { up: "y", left: "x", right: "x" };
const EXIT_SIGN: Record<Direction, 1 | -1> = { up: -1, left: -1, right: 1 };

export default function SwapLink({
  children,
  direction = "up",
}: {
  children: React.ReactNode;
  direction?: Direction;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const originalRef = useRef<HTMLSpanElement>(null);
  const duplicateRef = useRef<HTMLSpanElement>(null);

  const axis = AXIS[direction];
  const prop = axis === "y" ? "yPercent" : "xPercent";
  const pxProp = axis;
  const exitValue = 100 * EXIT_SIGN[direction];
  const enterFromValue = -exitValue;
  const exitGap = GAP * EXIT_SIGN[direction];
  const enterGap = -exitGap;

  useGSAP(
    (_context, contextSafe) => {
      const root = rootRef.current;
      const original = originalRef.current;
      const duplicate = duplicateRef.current;
      if (!root || !original || !duplicate) return;

      // Gated on hover capability, not width; the CSS uses the matching
      // (hover: none) query.
      const mm = gsap.matchMedia();
      mm.add(HOVER_MEDIA, () => {
        // Set through GSAP so it knows the starting transform.
        gsap.set(duplicate, { [prop]: enterFromValue, [pxProp]: enterGap });

        const onEnter = contextSafe!(() => {
          if (window.matchMedia(REDUCE_MOTION_MEDIA).matches) return;
          gsap.to(original, { [prop]: exitValue, [pxProp]: exitGap, duration: DURATION, ease: EASE, overwrite: true });
          gsap.to(duplicate, { [prop]: 0, [pxProp]: 0, duration: DURATION, ease: EASE, overwrite: true });
        });

        const onLeave = contextSafe!(() => {
          gsap.to(original, { [prop]: 0, [pxProp]: 0, duration: DURATION, ease: EASE, overwrite: true });
          gsap.to(duplicate, { [prop]: enterFromValue, [pxProp]: enterGap, duration: DURATION, ease: EASE, overwrite: true });
        });

        root.addEventListener("mouseenter", onEnter);
        root.addEventListener("mouseleave", onLeave);
        return () => {
          root.removeEventListener("mouseenter", onEnter);
          root.removeEventListener("mouseleave", onLeave);
        };
      });

      return () => mm.revert();
    },
    { scope: rootRef, dependencies: [prop, pxProp, exitValue, enterFromValue, exitGap, enterGap] }
  );

  return (
    <span ref={rootRef} className={styles.mask}>
      <span ref={originalRef} className={styles.line}>
        {children}
      </span>
      <span ref={duplicateRef} className={styles.lineDup} aria-hidden="true">
        {children}
      </span>
    </span>
  );
}
