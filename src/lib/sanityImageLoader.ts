import type { ImageLoaderProps } from "next/image";
import type { SanityImageSource } from "@sanity/image-url";
import { urlFor } from "../sanity/lib/image";

/**
 * The Sanity CDN already resizes and converts images, so this skips
 * next/image's own optimizer. `aspect` is height / width.
 */
export function sanityLoader(image: SanityImageSource, aspect: number) {
  return ({ width, quality }: ImageLoaderProps) =>
    urlFor(image)
      .width(Math.round(width))
      .height(Math.round(width * aspect))
      .fit("crop")
      .auto("format")
      .quality(quality ?? 75)
      .url();
}
