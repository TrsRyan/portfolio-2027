/**
 * Site-wide motion vocabulary — single source of truth.
 *
 * Motion is the central element of this portfolio: every animation (homepage
 * intro, opening morph, return, Prev/Next swap, hovers) pulls its durations /
 * curves / offsets from HERE, never from hardcoded values.
 *
 * Standard design-system model (Carbon, Material 3, Spectrum): motion breaks
 * down into two token families, DURATION and CURVE, plus an OFFSET between
 * sibling elements. Deliberately small set.
 *
 * Three curves, by role (a constant rule across Smashing Magazine /
 * DesignSystems.one, confirmed by Carbon + Material):
 *   - an element that ENTERS              -> ease-out
 *   - an element that LEAVES              -> ease-in
 *   - moving an element from A to B and leaving it there -> ease-in-out
 * (a continuous loop = linear; the only one concerned here is the parallax,
 *  which keeps `ease: "none"` on the ScrollTrigger side.)
 *
 * EXITS are shorter than ENTRIES (Material 225/195ms; DesignSystems.one
 * "opens in 400, closes in 200"): leaving is a quick gesture, entering is
 * informative.
 *
 * This file only describes the raw material (duration / curve / offset).
 * The choreography — the moment each piece starts relative to the others
 * (delays, breathing room between outgoing and incoming) — stays specific to
 * each sequence, it isn't reusable as-is.
 */

/** GSAP curves, by role. `as const` -> literal types. */
export const EASE = {
  /** An element arriving (text reveal, block rising). */
  enter: "power3.out",
  /** An element leaving. */
  exit: "power3.in",
  /** Moving an element from point A to point B: image morph, name flight.
   *  `power4` (heavier than `power3`) = the deliberate "cinematic" weight
   *  for the site's signature gesture. */
  move: "power4.inOut",
} as const;

/**
 * Durations (seconds). Scale named by use case, calibrated on what the site
 * already uses + the "exit faster than entry" principle.
 */
export const DUR = {
  /** Hovers / micro-interactions. Top of the usual range (100–300ms): a
   *  deliberately measured register for this site. */
  hover: 0.35,
  /** Quick catch-up, secondary movement (e.g. the homepage coming back). */
  recover: 0.6,
  /** What leaves. Shorter than `enter`. */
  exit: 0.85,
  /** What enters. */
  enter: 1.15,
  /** The signature gesture: image morph (open / return), name flight. */
  move: 1.45,
} as const;

/**
 * Offset (seconds) between sibling elements revealed together (lines of a
 * paragraph, items of a list). Comfortable range cited: 0.06–0.10s; 0.05 =
 * low end, the value already dominant across the site — kept as-is so the
 * feel of already-validated transitions doesn't change. Adjustable upward
 * for more cascade.
 */
export const STAGGER = 0.05;

/**
 * Ready-to-use shortcuts for the `reveal.ts` building blocks: most call
 * sites pass exactly this triplet. Spread + override as needed
 * (`{ ...revealVars, delay }`, dropping `stagger` for a single element…).
 * Frozen: read-only, never mutate.
 */
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

/**
 * Shared media queries — same threshold everywhere (JS and CSS), a single
 * source of truth to avoid drift if the breakpoint ever changes.
 */
export const NARROW_MEDIA = "(max-width: 768px)";
export const HOVER_MEDIA = "(hover: hover)"; // primary input can hover (mouse/trackpad) — same axis as (hover: none) tap-feedback rules, independent of viewport width
export const REDUCE_MOTION_MEDIA = "(prefers-reduced-motion: reduce)";

/**
 * `yPercent` overshoot for the homepage title lines' mask reveal/conceal
 * (`.workTitleClip`, page.module.css), shared by HomeIntro.tsx (entrance) and
 * projectTransition.ts's concealHomepage() (exit on a project click) — a
 * single source instead of two hardcoded copies that can drift apart.
 *
 * Must clear `.workTitleClip`'s `overflow-clip-margin` (0.25em, page.module
 * .css) PLUS a small optical buffer for round capitals, expressed as a
 * percentage of the trimmed line's own height (~0.7em of the font size —
 * KH Teka capHeight/unitsPerEm = 700/1000, same ratio already used for the
 * inter-line/inter-project spacing formulas):
 *   (0.25em clip margin + 0.055em optical buffer) / 0.7em box height ≈ 43.6%
 * Rounded up to 44 for headroom. Recompute if the clip-margin value, the
 * optical buffer, or the font's metrics change.
 */
export const TITLE_LINE_OVERSHOOT = 44;
