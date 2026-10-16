import { getImageProps } from "next/image";
import { urlFor } from "../sanity/lib/image";
import { sanityLoader } from "./sanityImageLoader";
import type { Project } from "./projects";

/**
 * Shared by <ProjectDetail> and the preload so both request the exact same
 * file from the CDN.
 */
export const DETAIL_IMAGE = {
  width: 1400,
  height: 1400,
  sizes: "(max-width: 1279px) 90vw, 45vw",
} as const;

/** Must match the urlFor chain in <SanityImage>. */
export function detailImageSrc(image: NonNullable<Project["image"]>): string {
  return urlFor(image)
    .width(DETAIL_IMAGE.width)
    .height(DETAIL_IMAGE.height)
    .fit("crop")
    .auto("format")
    .url();
}

const warmed = new Set<string>();

/**
 * Preloads and decodes a project's detail image so the opening morph has
 * real pixels instead of the LQIP. Once per project per session.
 */
export function warmDetailImage(project: Project): void {
  if (!project.slug || !project.image?.asset || warmed.has(project.slug)) return;
  warmed.add(project.slug);

  const { props } = getImageProps({
    alt: "",
    src: detailImageSrc(project.image),
    loader: sanityLoader(project.image, DETAIL_IMAGE.height / DETAIL_IMAGE.width),
    width: DETAIL_IMAGE.width,
    height: DETAIL_IMAGE.height,
    sizes: DETAIL_IMAGE.sizes,
  });

  const img = new window.Image();
  if (props.srcSet) img.srcset = props.srcSet;
  if (props.sizes) img.sizes = props.sizes;
  img.src = props.src;
  void img.decode?.().catch(() => {});
}
