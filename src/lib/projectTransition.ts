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
import {
  DUR,
  EASE,
  revealVars,
  TITLE_LINE_OVERSHOOT,
  RISE_OVERSHOOT,
  THUMB_OVERSHOOT,
} from "./motion";

export const MODAL_ROOT_ID = "modal-root";
export const PAGE_CURTAIN_ID = "page-curtain";

const CONCEAL_DETAIL_VARS = Object.freeze({
  duration: DUR.exit,
  ease: EASE.exit,
  stagger: 0.04,
});

gsap.registerPlugin(Flip);

type FlipState = ReturnType<typeof Flip.getState>;

/** The thumbnail is hidden below 769px, so the morph only runs above. */
export const MORPH_MEDIA =
  "(min-width: 769px) and (prefers-reduced-motion: no-preference)";

type Pending = { slug: string; state: FlipState };

// Module-level so it survives the soft navigation between the homepage and
// the @modal slot.
let pending: Pending | null = null;

export function setPendingFlip(next: Pending): void {
  pending = next;
}

// Navigation clicks are ignored while a transition plays. Auto-released
// after 4s in case an unlock is missed.
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

// Mobile page transition: an opaque white layer covers the old view, the
// new one mounts behind it, then the layer fades out.
let curtainCovered = false;
let curtainCoverTween: gsap.core.Tween | null = null;
let curtainRevealTween: gsap.core.Tween | null = null;

/** Resolves once the screen is fully white; navigate only then. */
export function curtainCover(): Promise<void> {
  const el = document.getElementById(PAGE_CURTAIN_ID);
  if (!el) return Promise.resolve();
  curtainCovered = true;
  curtainCoverTween?.kill();
  curtainRevealTween?.kill();
  return new Promise((resolve) => {
    curtainCoverTween = gsap.to(el, {
      autoAlpha: 1,
      duration: 0.38,
      ease: "power2.inOut",
      onComplete: () => resolve(),
    });
  });
}

export function curtainCoverDone(): Promise<void> {
  if (curtainCoverTween?.isActive()) {
    return new Promise((r) =>
      curtainCoverTween?.eventCallback("onComplete", () => r()),
    );
  }
  return Promise.resolve();
}

/** No-op unless a curtainCover() is pending. */
export function curtainReveal(): void {
  if (!curtainCovered) return;
  const el = document.getElementById(PAGE_CURTAIN_ID);
  if (!el) {
    curtainCovered = false;
    return;
  }
  // Wait two frames: the first frame after the modal mounts is heavy and
  // would make the fade stutter.
  const play = () =>
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        curtainRevealTween = gsap.to(el, {
          autoAlpha: 0,
          duration: 0.4,
          ease: "power2.inOut",
          delay: 0.03,
          onComplete: () => {
            curtainCovered = false;
            curtainCoverTween = null;
            curtainRevealTween = null;
            unlockTransition();
          },
        });
      }),
    );
  if (curtainCoverTween?.isActive())
    curtainCoverTween.eventCallback("onComplete", play);
  else play();
}

// Lets concealHomepage() end the intro first, so the same elements are not
// split twice.
let introFinisher: (() => void) | null = null;
export function setIntroFinisher(fn: (() => void) | null): void {
  introFinisher = fn;
}

/** Cleared on read. No expiry: in dev the intercepted route can take
 *  seconds to compile. */
export function takePendingFlip(slug: string): Pending | null {
  const p = pending;
  pending = null;
  if (!p || p.slug !== slug) return null;
  return p;
}

// Scroll position kept across a Prev/Next swap, keyed by slug so a stale
// entry is ignored.
let swapScroll: { slug: string; y: number } | null = null;
export function setSwapScroll(slug: string, y: number): void {
  swapScroll = { slug, y };
}
export function takeSwapScroll(slug: string): number | null {
  const s = swapScroll;
  swapScroll = null;
  return s && s.slug === slug ? s.y : null;
}
export function peekSwapScroll(slug: string): number | null {
  return swapScroll && swapScroll.slug === slug ? swapScroll.y : null;
}

/**
 * Freezes the modal's scrolled content in place (`position: fixed; top: -S`)
 * so the App Router's scroll reset on navigation has nothing to scroll.
 * Must be called synchronously in the event handler.
 *
 * Returns the frozen offset, read before `position: fixed` resets
 * `scrollTop` to 0.
 */
export function freezeModalContent(
  root?: HTMLElement | null,
  atScroll?: number,
): number {
  const scope = root ?? document.getElementById(MODAL_ROOT_ID);
  const page = scope?.querySelector<HTMLElement>("main") ?? null;
  const backdrop = page?.closest<HTMLElement>("[data-lenis-prevent]") ?? null;
  if (!backdrop || !page) return 0;
  if (page.style.position === "fixed") {
    return Math.max(0, -parseFloat(page.style.top || "0")) || 0;
  }
  const s = atScroll ?? backdrop.scrollTop;
  if (s <= 0) return 0;
  page.style.position = "fixed";
  page.style.top = `${-s}px`;
  page.style.left = "0";
  // Measured width rather than 100%, so the image doesn't re-crop when
  // unfrozen.
  page.style.width = `${backdrop.clientWidth}px`;
  return s;
}

// The homepage can shrink by a few px when a project opens (the intro's
// SplitText settling). Scrolled to the bottom, the browser would clamp
// scrollY and jump, so the body is frozen the same way as the modal.
let homepageScrollY = 0;
let homepageFrozen = false;

export function freezeHomepageScroll(): void {
  if (homepageFrozen) return;
  const y = window.scrollY;
  if (y <= 0) return;
  homepageScrollY = y;
  homepageFrozen = true;
  document.body.style.position = "fixed";
  document.body.style.top = `${-y}px`;
  document.body.style.left = "0";
  document.body.style.width = "100%";
}

/**
 * The page may have shrunk while frozen, so the saved position is clamped to
 * the current max scroll. body.scrollHeight stays accurate while fixed.
 */
export function unfreezeHomepageScroll(): void {
  if (!homepageFrozen) return;
  homepageFrozen = false;
  const maxScroll = Math.max(0, document.body.scrollHeight - window.innerHeight);
  const target = Math.min(homepageScrollY, maxScroll);
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.width = "";
  window.scrollTo(0, target);
}

/** Homepage exit when a project opens: the intro elements, in reverse. */
export function concealHomepage(): RevealHandle[] {
  introFinisher?.();

  const one = (sel: string) => document.querySelector(sel);
  const all = (sel: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(sel));

  const DUR = 0.8;
  const EASE = "power3.inOut";
  const base = { duration: DUR, ease: EASE };
  const staggered = { ...base, stagger: 0.04 };

  // Title lines travel 165% (65% overshoot) instead of 115%; scale the
  // duration by the same ratio to keep the same speed.
  const titleVars = { ...staggered, duration: DUR * (165 / 115) };

  // autoSplit: false keeps the tweens stable so they can be nested in the
  // master timeline.
  const handles = [
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
    concealBlock(all("[data-intro-line]"), {
      at: 0,
      overshoot: TITLE_LINE_OVERSHOOT,
      vars: titleVars,
    }),
    concealBlock(all("[data-intro-thumb]"), {
      at: 0,
      overshoot: THUMB_OVERSHOOT,
      vars: staggered,
    }),
    concealBlock(all("[data-intro-rise-line]"), {
      at: 0,
      overshoot: RISE_OVERSHOOT,
      vars: staggered,
    }),
    undraw(all("[data-intro-stroke]"), {
      at: 0,
      vars: { ...base, duration: DUR * 1.2 },
    }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}

export function revealDetail(
  at: number,
  root?: HTMLElement | null,
  fade = false,
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
    revealBlock(all("[data-detail-rise]"), {
      at,
      overshoot: RISE_OVERSHOOT,
      vars: base,
      fade,
    }),
    revealDraw(all("[data-detail-draw]"), { at, origin: "left", vars: base, fade }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}

export function concealDetail(
  at: number,
  root?: HTMLElement | null,
  fade = false,
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
    concealBlock(all("[data-detail-rise]"), {
      at,
      overshoot: RISE_OVERSHOOT,
      vars: base,
      dir: "down",
      fade,
    }),
    undraw(all("[data-detail-draw]"), { at, origin: "left", vars: base, fade }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}

/**
 * Prev/Next swap, outgoing project: text exits up, rules exit right.
 * Return/Prev/Next stay in place.
 */
export function swapOutDetail(
  at: number,
  root?: HTMLElement | null,
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
      dir: "up",
      autoSplit: false,
    }),
    undraw(all("[data-detail-draw]"), { at, origin: "right", vars: base }),
    concealBlock(all("[data-detail-cross]"), {
      at,
      overshoot: RISE_OVERSHOOT,
      vars: base,
    }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}

/** Prev/Next swap, incoming project: text enters from below, rules from the left. */
export function swapInDetail(
  at: number,
  root?: HTMLElement | null,
): RevealHandle[] {
  const scope = root ?? document.getElementById(MODAL_ROOT_ID);
  if (!scope) return [];
  const all = (sel: string) =>
    Array.from(scope.querySelectorAll<HTMLElement>(sel));

  const base = revealVars;

  const handles = [
    revealLines(all("[data-detail-lines]"), { at, vars: base, autoSplit: false }),
    revealDraw(all("[data-detail-draw]"), { at, origin: "left", vars: base }),
    revealBlock(all("[data-detail-cross]"), {
      at,
      overshoot: RISE_OVERSHOOT,
      vars: base,
    }),
  ];

  return handles.filter((h): h is RevealHandle => h != null);
}
