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

// Shared motion vocabulary (lib/motion.ts): hover = DUR.hover, arrival = EASE.enter.
const DURATION = DUR.hover;
const EASE = MOTION_EASE.enter;
const GAP = 8; // visual gap (px) between the two copies while sliding — without it they touch

type Direction = "up" | "left" | "right";

// axis + exit direction of the original copy; the incoming copy always starts from the opposite side.
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
  const pxProp = axis; // "x" or "y" — the pixel counterpart on the same axis, for the fixed gap
  const exitValue = 100 * EXIT_SIGN[direction];
  const enterFromValue = -exitValue;
  const exitGap = GAP * EXIT_SIGN[direction];
  const enterGap = -exitGap;

  // All DOM-related work happens INSIDE useGSAP (an effect): setting the
  // starting position, creating the handlers, listening for events.
  // @gsap/react docs' "event handlers" pattern — refs are only read there,
  // never during render.
  useGSAP(
    (_context, contextSafe) => {
      const root = rootRef.current;
      const original = originalRef.current;
      const duplicate = duplicateRef.current;
      if (!root || !original || !duplicate) return;

      // Gated on the input device (hover: hover), not viewport width: a
      // mouse can hover at any width (a narrowed desktop window), and a
      // touch-capable device gets no rolling effect at any width (a wide
      // touchscreen). SwapLink.module.css's ≤768px CSS used to gate
      // .lineDup/.mask the same way this used to — both now key off the
      // same live media query, live (gsap.matchMedia re-runs this on every
      // actual change, not just at mount), so the two can never disagree.
      const mm = gsap.matchMedia();
      mm.add(HOVER_MEDIA, () => {
        // Starting position set BY GSAP (not raw CSS, otherwise GSAP
        // doesn't "see" the transform and would animate from zero).
        gsap.set(duplicate, { [prop]: enterFromValue, [pxProp]: enterGap });

        // contextSafe: tweens created in these handlers are attached to
        // useGSAP's context, so they get reverted on unmount / StrictMode's
        // double-mount.
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
