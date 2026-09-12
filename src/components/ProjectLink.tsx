"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { Flip } from "gsap/Flip";
import { warmDetailImage } from "../lib/projectImage";
import type { Project } from "../lib/projects";
import {
  setPendingFlip,
  isTransitionRunning,
  curtainCover,
} from "../lib/projectTransition";
import { NARROW_MEDIA } from "../lib/motion";

/**
 * Snapshots the thumbnail's frame BEFORE navigating, so the modal can start
 * the morph from there. Absent on mobile (.workThumb is display:none).
 */
function captureThumb(slug: string) {
  const thumb = document.querySelector<HTMLElement>(
    `[data-project-thumb="${slug}"]`,
  );
  if (!thumb) return;

  // The Flip id only lives for the duration of the capture: set here,
  // removed right away, so that at Flip.from only .media (inside the modal)
  // carries it. Without this: a duplicate id -> Flip sees the thumbnail as
  // static and animates nothing.
  const id = `project-${slug}`;
  thumb.setAttribute("data-flip-id", id);
  const state = Flip.getState(thumb);
  thumb.removeAttribute("data-flip-id");

  setPendingFlip({ slug, state });
}

type Props = Omit<ComponentProps<typeof Link>, "href"> & { project: Project };

/**
 * <Link> to a project: warms the detail image on hover/focus and captures
 * the thumbnail's Flip state on pointerdown (consumed by <ModalView>).
 */
export default function ProjectLink({ project, ...rest }: Props) {
  const router = useRouter();
  const warm = () => warmDetailImage(project);
  // Touch has no hover before the tap -> also warm on pointerdown, the only
  // head start available before the morph reads the image (still capture()'s job).
  const capture = () => {
    warm();
    if (!isTransitionRunning() && project.slug) captureThumb(project.slug);
  };
  // preventRunning: a plain click during a transition doesn't navigate.
  // Cmd/Ctrl/Shift/Alt + click (open in a new tab) stays untouched.
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
  // ≤768px: passing through white, SEQUENTIALLY. We prevent the <Link>'s
  // navigation, cover the screen ENTIRELY, THEN navigate (behind the full
  // white). ProjectModalHost reveals it once the project is mounted.
  // Blocked click / new tab -> normal behavior.
  const cover = (e: MouseEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    if (!window.matchMedia(NARROW_MEDIA).matches) return;
    e.preventDefault();
    const href = `/${project.slug}`;
    void curtainCover().then(() => router.push(href));
  };
  return (
    <Link
      {...rest}
      href={`/${project.slug}`}
      onPointerEnter={warm}
      onFocus={warm}
      onPointerDown={capture}
      onClickCapture={block}
      onClick={cover}
    />
  );
}
