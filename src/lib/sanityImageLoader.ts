import type { ImageLoaderProps } from "next/image";
import type { SanityImageSource } from "@sanity/image-url";
import { urlFor } from "../sanity/lib/image";

/**
 * Custom next/image loader for Sanity assets. Sanity's own CDN already
 * resizes and converts format on the fly (`auto("format")` -> webp/avif);
 * without this, next/image's default loader would route every request
 * through `/_next/image` too, decoding and re-encoding a file that's
 * already optimized. `aspect` = height/width of the requested crop, so the
 * generated URL keeps the same proportions at whatever width next/image
 * asks for (device pixel ratio, responsive `sizes`).
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
