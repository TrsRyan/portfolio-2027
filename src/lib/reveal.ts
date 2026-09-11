import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

/**
 * "Mask + rise" building blocks, shared by the homepage intro and the
 * list -> detail transition (Phase 5).
 *
 * Entry (the element arrives):
 *   `revealLines` — text split into lines (SplitText + autoSplit -> survives
 *     a resize: re-splits and replays onSplit, GSAP realigns totalTime()).
 *   `revealBlock` — a single element rising under its mask (`yPercent`).
 *   `revealDraw`  — a rule drawing itself in (`scaleX` 0 -> 1).
 *
 * Exit (the element leaves) — exact mirror, the element ends up HIDDEN (no
 * automatic settle: in practice the homepage gets covered by the modal):
 *   `concealLines` — the lines rise OUT of frame (above the mask).
 *   `concealBlock` — the element rises out of its mask (`yPercent` -> negative).
 *   `undraw`       — the rule retracts (`scaleX` -> 0).
 *
 * Shared: `delay: at` · `force3D:false` (crisp glyphs/image) · `will-change`
 * for the duration of the animation. Tune duration / ease / stagger via
 * `vars`. SplitText: only call it AFTER `document.fonts.ready`.
 *
 * `settle()`: resets the target to a plain VISIBLE state (revert / kill +
 * cleanup). Idempotent. `null` if there's nothing to animate.
 */
export type RevealHandle = {
  /** Resets the target to a plain VISIBLE state (revert / kill + cleanup). Idempotent. */
  settle: () => void;
  /** Replays in reverse toward the STARTING state, without a final settle
   *  (entries -> hidden again; exits -> visible again). Used to interrupt an
   *  in-progress transition. Returns the tween. */
  reverse?: (vars?: gsap.TweenVars) => gsap.core.Tween | null;
  /** The brick's main tween — exposed so it can be nested inside a master
   *  timeline (interruptible transition, see ModalView). `null` if there's
   *  nothing to animate. */
  tween?: gsap.core.Tween | null;
};

type RevealOptions = {
  /** Delay (s) before the rise, measured from creation (= end of the name's flight). */
  at: number;
  /** duration / ease / stagger — tuned case by case. */
  vars?: gsap.TweenVars;
  /** revealLines: descendants SplitText must leave INTACT (e.g. a thumbnail). */
  ignore?: string | Element[];
  /** revealBlock / concealBlock: how far the start overshoots, in `yPercent`
   *  points (default 0). E.g. 8 to clear a small `overflow-clip-margin` on
   *  the mask. In `yPercent` (not a fixed height) -> the hidden state tracks
   *  the element's size if the window is resized mid-animation. */
  overshoot?: number;
  /** revealDraw / undraw: the rule's anchor edge (default "left"). */
  origin?: "left" | "right";
  /** concealLines / concealBlock: exit direction (default "up"). "down" for
   *  the mirror of a bottom entry (detail content sliding back down). */
  dir?: "up" | "down";
  /** revealLines / concealLines: SplitText re-splits on resize (default
   *  true). `false` -> a stable tween, nestable inside a master timeline
   *  (modal transition ~1.5s: a resize during that span is negligible).
   *  Codrops pattern. */
  autoSplit?: boolean;
  /** FADE mode (mobile ≤768px / reduced-motion): `opacity` + a small rise,
   *  NO mask, NO SplitText. Same handle shape. Ignores ignore / overshoot /
   *  origin / autoSplit. */
  fade?: boolean;
};

function toEls(targets: Element | Element[] | null | undefined): HTMLElement[] {
  return (Array.isArray(targets) ? targets : [targets]).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}

/** Fade's rise (px) — the "little something extra" layered on top of the opacity. */
const FADE_Y = 32;

/**
 * FADE mode shared by all 6 bricks when `fade: true` (mobile / RM):
 * `opacity` + a small rise, no mask, no SplitText. Returns the same
 * `RevealHandle` (settle / reverse / tween) -> nestable, interruptible.
 *   `exit`   : the element LEAVES (ends up hidden). Otherwise it ARRIVES (fromTo).
 *   `dir`    : exit direction ("down" -> downward, mirror of a low entry).
 *   `noMove` : opacity only, no `y` (header rules / meta rules).
 */
function fadeReveal(
  els: HTMLElement[],
  {
    at,
    vars = {},
    exit = false,
    dir = "up",
    noMove = false,
  }: {
    at: number;
    vars?: gsap.TweenVars;
    exit?: boolean;
    dir?: "up" | "down";
    noMove?: boolean;
  },
): RevealHandle {
  gsap.set(els, { willChange: "transform" });
  const outY = noMove ? 0 : dir === "down" ? FADE_Y : -FADE_Y;
  const inY = noMove ? 0 : FADE_Y;

  const tween = exit
    ? gsap.to(els, { autoAlpha: 0, y: outY, force3D: false, ...vars, delay: at })
    : gsap.fromTo(
        els,
        { autoAlpha: 0, y: inY },
        {
          autoAlpha: 1,
          y: 0,
          force3D: false,
          immediateRender: true,
          ...vars,
          delay: at,
        },
      );

  let done = false;
  const settle = () => {
    if (done) return;
    done = true;
    tween.kill();
    gsap.set(els, { clearProps: "opacity,visibility,transform,willChange" });
  };
  return {
    settle,
    reverse(rvars) {
      if (done) return null;
      tween.kill();
      return exit
        ? gsap.to(els, {
            autoAlpha: 1,
            y: 0,
            force3D: false,
            ...rvars,
            onComplete: settle,
          })
        : gsap.to(els, { autoAlpha: 0, y: inY, force3D: false, ...rvars });
    },
    tween,
  };
}

/**
 * Splits into masked lines (`type:"lines"` + `mask:"lines"`) with `autoSplit`.
 * The animation (`gsap.from`) is created INSIDE `onSplit` and returned -> on
 * a resize / font load, SplitText re-splits and GSAP realigns `totalTime()`.
 *
 * - each line starts from its REAL measured height (+1px) -> no sliver.
 * - `text-box-trim` compensation: SplitText's wrapper elements don't
 *   inherit the trim -> the split target ends up TALLER -> a jump on
 *   revert. We measure the excess and set an equal negative `margin-bottom`.
 *   (GSAP staff, forum threads 44573 / 45359)
 */
export function revealLines(
  targets: Element | Element[] | null | undefined,
  { at, vars = {}, ignore, autoSplit = true, fade }: RevealOptions,
): RevealHandle | null {
  const els = toEls(targets);
  if (!els.length) return null;
  if (fade) return fadeReveal(els, { at, vars });

  // Height BEFORE the split (native text-box-trim still active).
  const trimmedH = els.map((el) => el.getBoundingClientRect().height);

  let done = false;
  let animTween: gsap.core.Tween | null = null;

  function settle() {
    if (done) return;
    done = true;
    gsap.killTweensOf(split.lines); // from()/reverse() still in flight
    split.revert(); // masks + autoSplit observers
    gsap.set(els, {
      clearProps: "opacity,visibility,transform,willChange,marginBottom",
    });
  }

  const split = SplitText.create(els, {
    type: "lines",
    mask: "lines",
    autoSplit,
    ignore,
    onSplit(self) {
      if (done || !self.lines.length) return;
      self.elements.forEach((el, i) => {
        const surplus = el.getBoundingClientRect().height - trimmedH[i];
        if (surplus > 0.5) gsap.set(el, { marginBottom: -surplus });
      });
      gsap.set(self.elements, { autoAlpha: 1 }); // containers visible; lines clipped
      gsap.set(self.lines, { willChange: "transform" });
      animTween = gsap.from(self.lines, {
        y: (_i, el) => Math.ceil(el.getBoundingClientRect().height) + 1,
        force3D: false,
        ...vars,
        delay: at,
        onComplete: settle,
      });
      return animTween;
    },
  });

  if (!split.lines.length) settle();
  return {
    settle,
    // Interruption: the lines go back to sitting under their mask (the
    // from()'s starting state). No settle -> they stay hidden; unmount
    // cleans up.
    reverse(rvars) {
      if (done || !split.lines.length) return null;
      gsap.killTweensOf(split.lines); // cuts the from() (even if not started yet, due to delay)
      return gsap.to(split.lines, {
        y: (_i, el) => Math.ceil(el.getBoundingClientRect().height) + 1,
        force3D: false,
        ...rvars,
      });
    },
    get tween() {
      return animTween;
    },
  };
}

/**
 * Rises a single element under its mask: `yPercent` (100 + `overshoot`) -> 0.
 * The DIRECT parent must clip (`overflow:hidden`/`clip`).
 *
 * No cleanup on `onComplete`: removing `will-change` forces a repaint (a
 * micro-jump). We leave it; it goes away on `settle()`.
 */
export function revealBlock(
  targets: Element | Element[] | null | undefined,
  { at, vars = {}, overshoot = 0, fade }: RevealOptions,
): RevealHandle | null {
  const els = toEls(targets);
  if (!els.length) return null;
  if (fade) return fadeReveal(els, { at, vars });

  gsap.set(els, { willChange: "transform" });
  const tween = gsap.fromTo(
    els,
    { yPercent: 100 + overshoot },
    { yPercent: 0, force3D: false, immediateRender: true, ...vars, delay: at },
  );

  let done = false;
  return {
    settle() {
      if (done) return;
      done = true;
      tween.kill();
      gsap.set(els, { clearProps: "transform,willChange,opacity,visibility" });
    },
    reverse(rvars) {
      if (done) return null;
      tween.kill();
      return gsap.to(els, {
        yPercent: 100 + overshoot,
        force3D: false,
        ...rvars,
      });
    },
    tween,
  };
}

/**
 * A rule that "draws itself": `scaleX` 0 -> 1, anchored at `origin` (default
 * left). `transformOrigin` also set BY GSAP (not just CSS) -> cross-browser
 * consistency (GSAP recommendation). Pure transform: no layout, no paint.
 */
export function revealDraw(
  targets: Element | Element[] | null | undefined,
  { at, vars = {}, origin = "left", fade }: RevealOptions,
): RevealHandle | null {
  const els = toEls(targets);
  if (!els.length) return null;
  if (fade) return fadeReveal(els, { at, vars, noMove: true });

  gsap.set(els, {
    transformOrigin: `${origin} center`,
    willChange: "transform",
  });
  const tween = gsap.fromTo(
    els,
    { scaleX: 0 },
    { scaleX: 1, force3D: false, immediateRender: true, ...vars, delay: at },
  );

  let done = false;
  return {
    settle() {
      if (done) return;
      done = true;
      tween.kill();
      gsap.set(els, {
        clearProps: "transform,transformOrigin,willChange,opacity,visibility",
      });
    },
    reverse(rvars) {
      if (done) return null;
      tween.kill();
      return gsap.to(els, { scaleX: 0, force3D: false, ...rvars });
    },
    tween,
  };
}

/* ===================================================================
   Exits — exact mirror of the entries above. The element ends up HIDDEN;
   `settle()` returns it to a plain visible state (interruption / a return
   that doesn't animate).
   =================================================================== */

/**
 * Mirror of `revealLines`: the lines rise OUT of frame (above the mask)
 * instead of entering it from below.
 */
export function concealLines(
  targets: Element | Element[] | null | undefined,
  { at, vars = {}, ignore, dir = "up", autoSplit = true, fade }: RevealOptions,
): RevealHandle | null {
  const els = toEls(targets);
  if (!els.length) return null;
  if (fade) return fadeReveal(els, { at, vars, exit: true, dir });

  const trimmedH = els.map((el) => el.getBoundingClientRect().height);

  let done = false;
  let animTween: gsap.core.Tween | null = null;

  function settle() {
    if (done) return;
    done = true;
    gsap.killTweensOf(split.lines); // conceal/reverse still in flight
    split.revert();
    gsap.set(els, {
      clearProps: "opacity,visibility,transform,willChange,marginBottom",
    });
  }

  const split = SplitText.create(els, {
    type: "lines",
    mask: "lines",
    autoSplit,
    ignore,
    onSplit(self) {
      if (done || !self.lines.length) return;
      self.elements.forEach((el, i) => {
        const surplus = el.getBoundingClientRect().height - trimmedH[i];
        if (surplus > 0.5) gsap.set(el, { marginBottom: -surplus });
      });
      gsap.set(self.elements, { autoAlpha: 1 });
      gsap.set(self.lines, { willChange: "transform" });
      // No onComplete:settle -> the lines stay out of frame at the end.
      animTween = gsap.to(self.lines, {
        y: (_i, el) =>
          (dir === "down" ? 1 : -1) *
          (Math.ceil(el.getBoundingClientRect().height) + 1),
        force3D: false,
        ...vars,
        delay: at,
      });
      return animTween;
    },
  });

  if (!split.lines.length) settle();
  return {
    settle,
    reverse(rvars) {
      if (done || !split.lines.length) return null;
      gsap.killTweensOf(split.lines); // cuts an in-progress conceal (otherwise 2 tweens fight over y)
      return gsap.to(split.lines, {
        y: 0,
        force3D: false,
        ...rvars,
        onComplete: settle,
      });
    },
    get tween() {
      return animTween;
    },
  };
}

/**
 * Mirror of `revealBlock`: the element rises out of its mask (`yPercent` 0
 * -> -(100 + overshoot)). The DIRECT parent must clip.
 */
export function concealBlock(
  targets: Element | Element[] | null | undefined,
  { at, vars = {}, overshoot = 0, dir = "up", fade }: RevealOptions,
): RevealHandle | null {
  const els = toEls(targets);
  if (!els.length) return null;
  if (fade) return fadeReveal(els, { at, vars, exit: true, dir });

  gsap.set(els, { willChange: "transform" });
  const tween = gsap.to(els, {
    yPercent: (dir === "down" ? 1 : -1) * (100 + overshoot),
    force3D: false,
    ...vars,
    delay: at,
  });

  let done = false;
  const settle = () => {
    if (done) return;
    done = true;
    tween.kill();
    gsap.set(els, { clearProps: "transform,willChange,opacity,visibility" });
  };
  return {
    settle,
    reverse(rvars) {
      if (done) return null;
      tween.kill();
      return gsap.to(els, {
        yPercent: 0,
        force3D: false,
        ...rvars,
        onComplete: settle,
      });
    },
    tween,
  };
}

/**
 * Mirror of `revealDraw`: the rule retracts (`scaleX` -> 0), anchored at
 * `origin` (default left -> the right edge folds back toward the left).
 */
export function undraw(
  targets: Element | Element[] | null | undefined,
  { at, vars = {}, origin = "left", fade }: RevealOptions,
): RevealHandle | null {
  const els = toEls(targets);
  if (!els.length) return null;
  if (fade) return fadeReveal(els, { at, vars, exit: true, noMove: true });

  gsap.set(els, {
    transformOrigin: `${origin} center`,
    willChange: "transform",
  });
  const tween = gsap.to(els, {
    scaleX: 0,
    force3D: false,
    ...vars,
    delay: at,
  });

  let done = false;
  const settle = () => {
    if (done) return;
    done = true;
    tween.kill();
    gsap.set(els, {
      clearProps: "transform,transformOrigin,willChange,opacity,visibility",
    });
  };
  return {
    settle,
    reverse(rvars) {
      if (done) return null;
      tween.kill();
      return gsap.to(els, { scaleX: 1, force3D: false, ...rvars });
    },
    tween,
  };
}
