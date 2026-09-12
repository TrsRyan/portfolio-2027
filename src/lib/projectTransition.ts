import gsap from "gsap";
import { Flip } from "gsap/Flip";
import {
  revealLines,
  revealBlock,
  revealDraw,
  concealLines,
  concealBlock,
  undraw,
  type RevealHandle,
} from "./reveal";
import { DUR, EASE, revealVars } from "./motion";

/** Id of the modal portal root (layout.tsx). Single source for the selector. */
export const MODAL_ROOT_ID = "modal-root";
/** Id of the mobile page curtain (layout.tsx). Single source for the selector. */
export const PAGE_CURTAIN_ID = "page-curtain";

// Shared by concealDetail + swapOutDetail: exit stagger is 0.04, not the
// standard STAGGER (0.05) — keeps the current entry/exit asymmetry.
const CONCEAL_DETAIL_VARS = Object.freeze({
  duration: DUR.exit,
  ease: EASE.exit,
  stagger: 0.04,
});

gsap.registerPlugin(Flip); // idempotent

type FlipState = ReturnType<typeof Flip.getState>;

/**
 * The Flip morph plays as soon as the thumbnail exists (>= 769px: below that
 * it's display:none, mobile layout) and outside reduced-motion. Otherwise:
 * plain open.
 */
export const MORPH_MEDIA =
  "(min-width: 769px) and (prefers-reduced-motion: no-preference)";

type Pending = { slug: string; state: FlipState };

// Relay between the click (homepage tree) and the modal mounting (@modal
// slot tree): a module-level singleton that survives the soft navigation,
// not React state.
let pending: Pending | null = null;

/** Set on pointerdown on a project row, before navigation. */
export function setPendingFlip(next: Pending): void {
  pending = next;
}

// --- Transition lock (Barba's "preventRunning" strategy) --------------------
// While a transition is playing (open / return), navigation clicks are
// blocked: they trigger nothing, the running transition finishes cleanly.
// Safety net: forced unlock after 4s if an `unlock` call is missed.
let transitionRunning = false;
let unlockTimer: ReturnType<typeof setTimeout> | undefined;

export function lockTransition(): void {
  transitionRunning = true;
  clearTimeout(unlockTimer);
  unlockTimer = setTimeout(() => {
    transitionRunning = false;
  }, 4000);
}

export function unlockTransition(): void {
  transitionRunning = false;
  clearTimeout(unlockTimer);
}

export function isTransitionRunning(): boolean {
  return transitionRunning;
}

// --- Page curtain (mobile): passing through white ---------------------------
// The screen turns FULL white (covers the old view), the new view mounts
// behind it, then the white fades out. A single opaque layer -> the two
// pages are never seen at once. `#page-curtain` lives in layout.
let curtainCovered = false;
let curtainCoverTween: gsap.core.Tween | null = null;
let curtainRevealTween: gsap.core.Tween | null = null;

/** Covers the screen in white. Resolves once the screen is FULLY white — the
 *  caller navigates ONLY at that point (never while it's covering, otherwise
 *  the new page would be seen appearing through it = flash). */
export function curtainCover(): Promise<void> {
  const el = document.getElementById(PAGE_CURTAIN_ID);
  if (!el) return Promise.resolve();
  curtainCovered = true;
  curtainCoverTween?.kill();
  curtainRevealTween?.kill(); // rapid taps: cut a reveal already in flight
  return new Promise((resolve) => {
    curtainCoverTween = gsap.to(el, {
      autoAlpha: 1,
      duration: 0.38,
      ease: "power2.inOut", // soft (power3 felt too hard)
      onComplete: () => resolve(),
    });
  });
}

/** Resolves once the cover is fully opaque (or immediately if none is in
 *  flight). Used to delay unmounting the modal. */
export function curtainCoverDone(): Promise<void> {
  if (curtainCoverTween?.isActive()) {
    return new Promise((r) =>
      curtainCoverTween?.eventCallback("onComplete", () => r()),
    );
  }
  return Promise.resolve();
}

/** Fades the white out to reveal the new view. No-op if no `curtainCover`
 *  is pending (desktop). Waits for the cover to finish, then one frame
 *  (new view painted) before revealing. */
export function curtainReveal(): void {
  if (!curtainCovered) return;
  const el = document.getElementById(PAGE_CURTAIN_ID);
  if (!el) {
    curtainCovered = false;
    return;
  }
  // 2 frames before revealing: on open, the first frame after the modal
  // mounts is heavy (ProjectDetail + Lenis render). Let the main thread
  // digest and paint it, otherwise the reveal stutters.
  const play = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        curtainRevealTween = gsap.to(el, {
          autoAlpha: 0,
          duration: 0.4,
          ease: "power2.inOut", // soft
          delay: 0.03, // the mount already held the white; just a beat
          onComplete: () => {
            curtainCovered = false;
            curtainCoverTween = null;
            curtainRevealTween = null;
            unlockTransition(); // safety net: the lock set on mobile open
          },
        });
      }),
    );
  if (curtainCoverTween?.isActive())
    curtainCoverTween.eventCallback("onComplete", play);
  else play();
}

// The homepage intro (HomeIntro) splits name / bio / "Work" / years with
// SplitText and only cleans up after ~6s. Clicking a project before that ->
// double-split on the same elements -> frozen text that jumps.
// `concealHomepage()` asks the intro to finish at once BEFORE re-splitting.
let introFinisher: (() => void) | null = null;
export function setIntroFinisher(fn: (() => void) | null): void {
  introFinisher = fn;
}

/** Read once when the modal mounts; cleared on read. null if the slug
 *  doesn't match (pointerdown on another project without navigation). No
 *  time-based expiry: in `dev` the intercepted route can take several
 *  seconds to compile on demand. */
export function takePendingFlip(slug: string): Pending | null {
  const p = pending;
  pending = null;
  if (!p || p.slug !== slug) return null;
  return p;
}

// `.backdrop` scroll captured on pointerdown of a Prev/Next link, restored
// once the modal retargets on the intended project -> a swap doesn't reset
// the page to the top. Paired with the slug (like `pending`): if the swap is
// interrupted, the stale entry is rejected on the next read for another slug.
let swapScroll: { slug: string; y: number } | null = null;
export function setSwapScroll(slug: string, y: number): void {
  swapScroll = { slug, y };
}
export function takeSwapScroll(slug: string): number | null {
  const s = swapScroll;
  swapScroll = null;
  return s && s.slug === slug ? s.y : null;
}
/** Like `takeSwapScroll` but WITHOUT clearing: the swap effect pins
 *  `.backdrop` to this position during the animation; the per-slug effect
 *  consumes it afterwards. */
export function peekSwapScroll(slug: string): number | null {
  return swapScroll && swapScroll.slug === slug ? swapScroll.y : null;
}

/**
 * Freezes the modal's scrolled content AT THIS INSTANT (pointerdown on a
 * link, Escape, popstate) — BEFORE any navigation. `position: fixed; top:
 * -S`: nothing moves on screen, but `.backdrop` has nothing left to scroll,
 * so the App Router (scrollIntoView) can no longer scroll it back up.
 * Idempotent. Cleaned up when the modal unmounts (the node disappears).
 *
 * Must be called SYNCHRONOUSLY in the handler: a native `scroll` triggered
 * by Next's reset would otherwise arrive too late.
 *
 * `root`: container of a specific `<main>` (project→project swap, two
 * `<main>` mounted). Absent -> global `#modal-root` (original behavior).
 * `atScroll`: offset to freeze explicitly (swap: freeze the incoming layer
 * at the same S as the outgoing one). Absent -> reads `backdrop.scrollTop`.
 *
 * Returns the offset `S` actually frozen (0 if nothing was frozen). Read
 * BEFORE setting `position: fixed`, so it's the real scroll position — the
 * caller (`onDown`) stores it to restore after the swap (setting
 * `position: fixed` drops `backdrop.scrollTop` back to 0: reading it
 * afterwards gives nothing).
 */
export function freezeModalContent(
  root?: HTMLElement | null,
  atScroll?: number,
): number {
  const scope = root ?? document.getElementById(MODAL_ROOT_ID);
  const page = scope?.querySelector<HTMLElement>("main") ?? null;
  const backdrop = page?.closest<HTMLElement>("[data-lenis-prevent]") ?? null;
  if (!backdrop || !page) return 0;
  // Already frozen -> return the current offset (read from `top: -Spx`).
  if (page.style.position === "fixed") {
    return Math.max(0, -parseFloat(page.style.top || "0")) || 0;
  }
  const s = atScroll ?? backdrop.scrollTop;
  if (s <= 0) return 0;
  page.style.position = "fixed";
  page.style.top = `${-s}px`;
  page.style.left = "0";
  // REAL in-flow width, measured live, not `100%` of the viewport: `.backdrop`'s
  // own scrollbar is hidden (ModalShell.module.css) so this stays constant
  // whether or not its content needs to scroll — otherwise the frozen
  // `<main>` could end up ~15px wider than once thawed -> the image
  // re-crops at the end of the swap.
  page.style.width = `${backdrop.clientWidth}px`;
  return s;
}

/**
 * Makes ALL of the homepage content EXIT (the same `[data-intro-*]` elements
 * as the intro, played in reverse) — called on a project click, at the same
 * time as the morph. Fonts are already loaded (the intro has already run).
 *
 * NOTE: clicking a project WHILE the intro is running (rare: ~4s, scroll
 * locked) means the intro's SplitText instances are still active -> a
 * double split is possible. To harden in a later step (an "intro finished"
 * signal).
 *
 * Returns the handles; the caller calls `settle()` on close (the homepage
 * comes back as-is; a later step will animate it).
 */
export function concealHomepage(): RevealHandle[] {
  introFinisher?.(); // the intro finishes first (otherwise a double SplitText split)

  const one = (sel: string) => document.querySelector(sel);
  const all = (sel: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(sel));

  const DUR = 0.8;
  const EASE = "power3.inOut";
  const base = { duration: DUR, ease: EASE };
  const staggered = { ...base, stagger: 0.04 };

  // autoSplit: false -> a stable tween, nestable inside the master timeline
  // (interruption). A resize during the ~0.7s exit is negligible.
  const handles = [
    // Name + bio + "Work" + years: split text, lines rise out of frame.
    concealLines([one("[data-intro-name]")].filter(Boolean) as Element[], {
      at: 0,
      vars: base,
      autoSplit: false,
    }),
    concealLines([one("p[data-intro-split]")].filter(Boolean) as Element[], {
      at: 0,
      vars: staggered,
      autoSplit: false,
    }),
    concealLines([one("h2[data-intro-split]")].filter(Boolean) as Element[], {
      at: 0,
      vars: base,
      autoSplit: false,
    }),
    concealLines(all("li > span[data-intro-split]"), {
      at: 0,
      vars: staggered,
      autoSplit: false,
    }),
    // Title lines + thumbnails + time/links: blocks rising out of their mask.
    concealBlock(all("[data-intro-line]"), {
      at: 0,
      overshoot: 15,
      vars: staggered,
    }),
    concealBlock(all("[data-intro-thumb]"), { at: 0, vars: staggered }),
    // data-intro-underlined (email): its rule sits flush with the mask's
    // bottom edge (UnderlineLink's .bar, bottom:0) — less natural buffer
    // than plain text (time/LinkedIn/Resume), needs a bigger overshoot.
    concealBlock(all("[data-intro-rise-line]:not([data-intro-underlined])"), {
      at: 0,
      overshoot: 5,
      vars: staggered,
    }),
    concealBlock(all("[data-intro-underlined]"), {
      at: 0,
      overshoot: 10,
      vars: staggered,
    }),
    // Header rule: retracts (right edge moving left).
    undraw(all("[data-intro-stroke]"), { at: 0, vars: base }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}

/**
 * Makes the project page content APPEAR (inside the modal), once the image
 * is settled. `at` = delay from creation (~ end of the morph).
 *   text (Overview, meta) -> revealLines (SplitText, per-line mask)
 *   links (Return, Prev/Next, Live Website) -> revealBlock under their mask
 * Handles `settle()` themselves once the animation ends (state = visible);
 * the caller also settles them on close if closing before it finishes.
 *
 * `root`: container of the detail to reveal. Absent -> global `#modal-root`.
 */
export function revealDetail(
  at: number,
  root?: HTMLElement | null,
  fade = false, // ≤768px: opacity + rise instead of the mask
): RevealHandle[] {
  const scope = root ?? document.getElementById(MODAL_ROOT_ID);
  if (!scope) return [];
  const all = (sel: string) =>
    Array.from(scope.querySelectorAll<HTMLElement>(sel));

  const base = revealVars;

  const handles = [
    revealLines(all("[data-detail-lines]"), {
      at,
      vars: base,
      autoSplit: false,
      fade,
    }),
    // "Live Website" (data-detail-cross, also carries data-detail-rise)
    // needs a bigger overshoot than Return/Prev/Next: its rule sits flush
    // with the mask's bottom edge, less natural buffer than plain text.
    revealBlock(all("[data-detail-rise]:not([data-detail-cross])"), {
      at,
      overshoot: 5,
      vars: base,
      fade,
    }),
    revealBlock(all("[data-detail-cross]"), { at, overshoot: 10, vars: base, fade }),
    // Meta rule lines: draw themselves in from the left.
    revealDraw(all("[data-detail-draw]"), { at, origin: "left", vars: base, fade }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}

/**
 * Mirror of `revealDetail`: makes the detail content EXIT (on clicking
 * Return / Escape / Prev). Called by <ModalView>'s animated exit.
 *
 * `root`: container of the detail to exit. Absent -> global `#modal-root`.
 */
export function concealDetail(
  at: number,
  root?: HTMLElement | null,
  fade = false, // ≤768px: opacity + descent instead of the mask
): RevealHandle[] {
  const scope = root ?? document.getElementById(MODAL_ROOT_ID);
  if (!scope) return [];
  const all = (sel: string) =>
    Array.from(scope.querySelectorAll<HTMLElement>(sel));

  const base = CONCEAL_DETAIL_VARS;

  const handles = [
    concealLines(all("[data-detail-lines]"), {
      at,
      vars: base,
      dir: "down",
      autoSplit: false,
      fade,
    }),
    // "Live Website" needs a bigger overshoot than Return/Prev/Next — see
    // revealDetail above.
    concealBlock(all("[data-detail-rise]:not([data-detail-cross])"), {
      at,
      overshoot: 5,
      vars: base,
      dir: "down",
      fade,
    }),
    concealBlock(all("[data-detail-cross]"), {
      at,
      overshoot: 10,
      vars: base,
      dir: "down",
      fade,
    }),
    undraw(all("[data-detail-draw]"), { at, origin: "left", vars: base, fade }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}

/**
 * Project→project swap, OUTGOING side: the content being replaced leaves
 * the frame.
 *   lines -> UP (`concealLines dir:"up"`)
 *   meta rules -> slide out to the RIGHT (`undraw origin:"right"`)
 * Distinct from `concealDetail` (modal close: content moves DOWN, rules
 * anchored left). Here it's the mirror of the entry (bottom / left).
 * Return/Prev/Next (fixed furniture) are NOT touched — they persist (5b).
 * "Live Website" (`data-detail-cross`) does cross over like the text.
 * `root`: the outgoing project's container.
 */
export function swapOutDetail(
  at: number,
  root?: HTMLElement | null,
): RevealHandle[] {
  const scope = root ?? document.getElementById(MODAL_ROOT_ID);
  if (!scope) return [];
  const all = (sel: string) =>
    Array.from(scope.querySelectorAll<HTMLElement>(sel));

  // Same values as `concealDetail` (site motion consistency).
  const base = CONCEAL_DETAIL_VARS;

  const handles = [
    concealLines(all("[data-detail-lines]"), {
      at,
      vars: base,
      dir: "up",
      autoSplit: false,
    }),
    undraw(all("[data-detail-draw]"), { at, origin: "right", vars: base }),
    // "Live Website" = content (its height follows the meta block above) ->
    // it rises out of its mask like the text. Return/Prev/Next don't move.
    // overshoot 10 (not the usual 5): its rule sits flush with the mask's
    // bottom edge, less natural buffer than plain text.
    concealBlock(all("[data-detail-cross]"), { at, overshoot: 10, vars: base }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}

/**
 * Project→project swap, INCOMING side: the new content arrives.
 *   lines -> from the BOTTOM (`revealLines`)
 *   meta rules -> drawn in from the LEFT (`revealDraw origin:"left"`)
 * Like `revealDetail` but the rise only concerns "Live Website"
 * (`data-detail-cross`); Return/Prev/Next persist (5b).
 * `root`: the incoming project's container.
 */
export function swapInDetail(
  at: number,
  root?: HTMLElement | null,
): RevealHandle[] {
  const scope = root ?? document.getElementById(MODAL_ROOT_ID);
  if (!scope) return [];
  const all = (sel: string) =>
    Array.from(scope.querySelectorAll<HTMLElement>(sel));

  // Same values as `revealDetail` (site motion consistency).
  const base = revealVars;

  const handles = [
    revealLines(all("[data-detail-lines]"), { at, vars: base, autoSplit: false }),
    revealDraw(all("[data-detail-draw]"), { at, origin: "left", vars: base }),
    // Counterpart of conceal: "Live Website" enters from the bottom of its
    // mask. overshoot 10 (not the usual 5): its rule sits flush with the
    // mask's bottom edge, less natural buffer than plain text.
    revealBlock(all("[data-detail-cross]"), { at, overshoot: 10, vars: base }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}
