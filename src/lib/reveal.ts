import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

/**
 * Masked reveal and conceal helpers. Text helpers use SplitText, so call them
 * after `document.fonts.ready`. Each returns a handle, or null when there is
 * nothing to animate.
 */
export type RevealHandle = {
  /** Returns the target to a plain visible state. Idempotent. */
  settle: () => void;
  /** Animates back to the starting state, without settling. */
  reverse?: (vars?: gsap.TweenVars) => gsap.core.Tween | null;
  /** Exposed so it can be nested in a master timeline. */
  tween?: gsap.core.Tween | null;
};

type RevealOptions = {
  /** Delay in seconds. */
  at: number;
  vars?: gsap.TweenVars;
  ignore?: string | Element[];
  /** Extra travel in yPercent so the start clears the mask edge. */
  overshoot?: number;
  origin?: "left" | "right";
  dir?: "up" | "down";
  /** Re-split on resize. Disable to get a stable, nestable tween. */
  autoSplit?: boolean;
  /** Opacity and a small rise instead of a mask (mobile). */
  fade?: boolean;
};

function toEls(targets: Element | Element[] | null | undefined): HTMLElement[] {
  return (Array.isArray(targets) ? targets : [targets]).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}

const FADE_Y = 32;

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
 * Lines rise into view from under a per-line mask.
 *
 * SplitText's wrappers don't inherit `text-box-trim`, so the split element
 * grows taller; a matching negative margin-bottom prevents a jump on revert.
 */
export function revealLines(
  targets: Element | Element[] | null | undefined,
  { at, vars = {}, ignore, autoSplit = true, fade }: RevealOptions,
): RevealHandle | null {
  const els = toEls(targets);
  if (!els.length) return null;
  if (fade) return fadeReveal(els, { at, vars });

  const trimmedH = els.map((el) => el.getBoundingClientRect().height);

  let done = false;
  let animTween: gsap.core.Tween | null = null;

  function settle() {
    if (done) return;
    done = true;
    gsap.killTweensOf(split.lines);
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
      // Batch reads before writes to avoid forced reflows.
      const surpluses = self.elements.map(
        (el, i) => el.getBoundingClientRect().height - trimmedH[i],
      );
      self.elements.forEach((el, i) => {
        if (surpluses[i] > 0.5) gsap.set(el, { marginBottom: -surpluses[i] });
      });
      gsap.set(self.elements, { autoAlpha: 1 });
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
    reverse(rvars) {
      if (done || !split.lines.length) return null;
      gsap.killTweensOf(split.lines);
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
 * The direct parent must clip. will-change is kept until settle(): removing
 * it on complete forces a repaint and a visible micro-jump.
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

/** A rule drawing in with scaleX. transformOrigin is set through GSAP for
 *  cross-browser consistency. */
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

/** Lines leave through the top (or bottom) of their mask and stay hidden. */
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
    gsap.killTweensOf(split.lines);
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
      const surpluses = self.elements.map(
        (el, i) => el.getBoundingClientRect().height - trimmedH[i],
      );
      self.elements.forEach((el, i) => {
        if (surpluses[i] > 0.5) gsap.set(el, { marginBottom: -surpluses[i] });
      });
      gsap.set(self.elements, { autoAlpha: 1 });
      gsap.set(self.lines, { willChange: "transform" });
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
      gsap.killTweensOf(split.lines);
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
