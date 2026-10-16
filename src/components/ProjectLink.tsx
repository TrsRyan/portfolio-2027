"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import type { ComponentProps, MouseEvent } from "react";
import { Flip } from "gsap/Flip";
import { warmDetailImage } from "../lib/projectImage";
import type { Project } from "../lib/projects";
import {
  setPendingFlip,
  isTransitionRunning,
  curtainCover,
  freezeHomepageScroll,
  unfreezeHomepageScroll,
} from "../lib/projectTransition";
import { NARROW_MEDIA } from "../lib/motion";

function captureThumb(slug: string) {
  const thumb = document.querySelector<HTMLElement>(
    `[data-project-thumb="${slug}"]`,
  );
  if (!thumb) return;

  // The flip id is removed right after capture: if the thumbnail kept it,
  // Flip would see a duplicate id and animate nothing.
  const id = `project-${slug}`;
  thumb.setAttribute("data-flip-id", id);
  const state = Flip.getState(thumb);
  thumb.removeAttribute("data-flip-id");

  setPendingFlip({ slug, state });
}

type Props = Omit<ComponentProps<typeof Link>, "href"> & { project: Project };

/**
 * Link to a project: preloads the detail image on hover and captures the
 * thumbnail's Flip state on pointerdown.
 */
export default function ProjectLink({ project, ...rest }: Props) {
  const router = useRouter();
  const warm = () => warmDetailImage(project);
  // The homepage scroll is frozen on pointerdown, before we know whether the
  // press becomes a navigation. If it doesn't (drag, modifier key), it must
  // be released here or the page stays locked.
  const navigatingRef = useRef(false);
  const capture = () => {
    navigatingRef.current = false;
    freezeHomepageScroll();
    warm();
    if (!isTransitionRunning() && project.slug) captureThumb(project.slug);
  };
  // `click` fires right after pointerup only for a real activation, so
  // checking one task later is enough.
  const releaseIfCancelled = () => {
    window.setTimeout(() => {
      if (!navigatingRef.current && !isTransitionRunning())
        unfreezeHomepageScroll();
    }, 0);
  };
  const block = (e: MouseEvent) => {
    if (
      isTransitionRunning() &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.altKey
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const cover = (e: MouseEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    navigatingRef.current = true;
    // Keyboard activation never fires pointerdown.
    freezeHomepageScroll();
    if (!window.matchMedia(NARROW_MEDIA).matches) return;
    // Mobile: cover the screen first, then navigate behind the curtain.
    e.preventDefault();
    const href = `/${project.slug}`;
    void curtainCover().then(() => router.push(href));
  };
  return (
    <Link
      {...rest}
      href={`/${project.slug}`}
      scroll={false}
      onPointerEnter={warm}
      onFocus={warm}
      onPointerDown={capture}
      onPointerUp={releaseIfCancelled}
      onPointerCancel={releaseIfCancelled}
      onClickCapture={block}
      onClick={cover}
    />
  );
}
