"use client";

import { useEffect } from "react";
import { warmDetailImage } from "../lib/projectImage";
import type { Project } from "../lib/projects";

/**
 * Preloads every project's detail image when the browser is idle, so a fast
 * click without hover still gets a sharp morph. Skipped with Data Saver on.
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

    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(run, 1000);
    return () => window.clearTimeout(timer);
  }, [projects]);

  return null;
}
