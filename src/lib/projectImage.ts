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
