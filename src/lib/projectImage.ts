import { getImageProps } from "next/image";
import { urlFor } from "../sanity/lib/image";
import type { Project } from "./projects";

/**
 * Detail-view project image parameters — shared by the render
 * (<ProjectDetail>) and the hover preload (<ProjectLink>), so both request
 * EXACTLY the same file from the CDN (otherwise the preload misses).
 */
export const DETAIL_IMAGE = {
  width: 1400,
  height: 1400,
  sizes: "(max-width: 1280px) 90vw, 45vw",
} as const;

/** Sanity URL (before next/image's optimizer) of the detail image. Must
 *  reproduce <SanityImage>'s urlFor chain identically. */
export function detailImageSrc(image: NonNullable<Project["image"]>): string {
  return urlFor(image)
    .width(DETAIL_IMAGE.width)
    .height(DETAIL_IMAGE.height)
    .fit("crop")
    .auto("format")
    .url();
}

// Once per project, per session — shared across every caller (ProjectLink's
// hover/focus/pointerdown, PreloadProjectImages' proactive warm-up).
const warmed = new Set<string>();

/**
 * Preloads a project's detail-view image file (real size + srcSet from
 * next/image, decoded) so the Flip morph (opening a project) has real
 * pixels ready instead of showing the LQIP background for a moment.
 * Idempotent per slug/session — called from more than one place.
 */
export function warmDetailImage(project: Project): void {
  if (!project.slug || !project.image?.asset || warmed.has(project.slug)) return;
  warmed.add(project.slug);

  const { props } = getImageProps({
    alt: "",
    src: detailImageSrc(project.image),
    width: DETAIL_IMAGE.width,
    height: DETAIL_IMAGE.height,
    sizes: DETAIL_IMAGE.sizes,
  });

  const img = new window.Image();
  if (props.srcSet) img.srcset = props.srcSet;
  if (props.sizes) img.sizes = props.sizes;
  img.src = props.src;
  // Decode right away -> ready before any click needs it, no
  // blur-to-sharp transition.
  void img.decode?.().catch(() => {});
}
