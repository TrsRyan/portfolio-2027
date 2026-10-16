/**
 * Motion tokens shared by every animation on the site.
 *
 * Curves by role: entering = ease-out, leaving = ease-in, moving from A to
 * B = ease-in-out. Exits are shorter than entries.
 */

export const EASE = {
  enter: "power3.out",
  exit: "power3.in",
  move: "power4.inOut",
} as const;

/** Seconds. */
export const DUR = {
  hover: 0.35,
  recover: 0.6,
  exit: 0.85,
  enter: 1.15,
  move: 1.45,
} as const;

export const STAGGER = 0.05;

export const revealVars = Object.freeze({
  duration: DUR.enter,
  ease: EASE.enter,
  stagger: STAGGER,
});

export const concealVars = Object.freeze({
  duration: DUR.exit,
  ease: EASE.exit,
  stagger: STAGGER,
});

// Keep in sync with the CSS breakpoints.
export const NARROW_MEDIA = "(max-width: 768px)";
export const HOVER_MEDIA = "(hover: hover)";
export const REDUCE_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";

/**
 * yPercent overshoot for the homepage title masks. Clears the 0.4em
 * descender padding of `.workTitleClip` plus a 0.055em optical buffer,
 * relative to the 0.7em trimmed line: (0.4 + 0.055) / 0.7 ≈ 65%.
 */
export const TITLE_LINE_OVERSHOOT = 65;

/**
 * yPercent overshoot for the small masked links and the clock. Clears the
 * masks' 1px overflow-clip-margin: 10% of a ~15px line ≈ 1.5px.
 */
export const RISE_OVERSHOOT = 10;

/** Clears sub-pixel gaps at the thumbnail mask edge (Chrome/Edge). */
export const THUMB_OVERSHOOT = 5;
