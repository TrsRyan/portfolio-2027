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
  // Tracks whether this press ends up as a real, same-page navigation.
  // `capture()` freezes the homepage's scroll eagerly on pointerdown (see
  // freezeHomepageScroll) -- before we can know that. If the gesture never
  // completes as a click on this link (a scroll/drag started on it, the
  // pointer released elsewhere) or completes but opens a new tab (a
  // modifier key), nothing else in the app ever navigates away, so nothing
  // else would call unfreezeHomepageScroll() either: the page would stay
  // scroll-locked until a full reload.
  const navigatingRef = useRef(false);
  // Touch has no hover before the tap -> also warm on pointerdown, the only
  // head start available before the morph reads the image (still capture()'s job).
  const capture = () => {
    navigatingRef.current = false;
    freezeHomepageScroll();
    warm();
    if (!isTransitionRunning() && project.slug) captureThumb(project.slug);
  };
  // `click` fires synchronously right after `pointerup`/`pointercancel`
  // only when the press actually completed as an activation on this link --
  // checking one task later is enough to tell a cancelled gesture from a
  // real one, independent of how long the eventual navigation itself takes
  // (the intercepted route can take a while to mount, see takePendingFlip).
  // `isTransitionRunning()`: a second press blocked by `block()` below,
  // while an earlier click's transition is still genuinely in flight, must
  // never release ITS freeze.
  const releaseIfCancelled = () => {
    window.setTimeout(() => {
      if (!navigatingRef.current && !isTransitionRunning())
        unfreezeHomepageScroll();
    }, 0);
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
  // Blocked click / new tab -> normal behavior (this page isn't navigating,
  // navigatingRef stays false).
  const cover = (e: MouseEvent) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    navigatingRef.current = true;
    // Keyboard activation (Enter/Space) never fires pointerdown -> freeze
    // here too, or it's skipped entirely for keyboard/assistive-tech users.
    // Idempotent: a no-op if pointerdown already froze it for this press.
    freezeHomepageScroll();
    if (!window.matchMedia(NARROW_MEDIA).matches) return;
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
