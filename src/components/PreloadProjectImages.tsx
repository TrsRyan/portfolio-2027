"use client";

import { useEffect } from "react";
import { warmDetailImage } from "../lib/projectImage";
import type { Project } from "../lib/projects";

/**
 * Warms every project's detail-view image shortly after the homepage
 * mounts, instead of waiting for a hover/focus/pointerdown on each
 * <ProjectLink> (still the only trigger before this existed). A fast click
 * — little to no hover dwell time before it — could otherwise land before
 * the per-link warm-up has decoded anything, showing the LQIP background
 * through the Flip morph for a moment. With only a handful of projects on
 * this site, warming all of them is cheap.
 *
 * Scheduled on idle so it never competes with the intro animation or the
 * homepage's own critical rendering; falls back to a short timeout where
 * `requestIdleCallback` doesn't exist (Safari, at the time of writing).
 * Skipped under Data Saver (Network Information API) — unsupported in
 * Safari, where the check is simply absent and warming proceeds.
 */
export default function PreloadProjectImages({
  projects,
}: {
  projects: Project[];
}) {
  useEffect(() => {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean };
    };
    if (nav.connection?.saveData) return;

    const run = () => projects.forEach(warmDetailImage);

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(run, 1000);
    return () => window.clearTimeout(timer);
  }, [projects]);

  return null;
}
