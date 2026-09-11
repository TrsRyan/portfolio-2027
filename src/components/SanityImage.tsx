import Image from "next/image";
import { urlFor } from "../sanity/lib/image";
import type { PROJECTS_QUERY_RESULT } from "../sanity.types";

// The image as projected by PROJECTS_QUERY (dereferenced asset + lqip + crop/hotspot).
type ProjectImage = NonNullable<PROJECTS_QUERY_RESULT[number]["image"]>;

/**
 * Renders a Sanity image via next/image.
 * Sanity "image.md" pattern: URL built with urlFor (respects hotspot/crop),
 * auto format (webp/avif), and a blur placeholder from the lqip when present.
 *
 * width/height = size requested from the Sanity CDN (exact crop around the hotspot).
 * Actual display is driven by `className` (object-fit, position…).
 */
type SanityImageProps = {
  image: ProjectImage;
  width: number;
  height: number;
  sizes?: string;
  className?: string;
  preload?: boolean;
  blur?: boolean;
} & { [dataAttr: `data-${string}`]: string | undefined };

export default function SanityImage({
  image,
  width,
  height,
  sizes,
  className,
  preload = false,
  blur = true,
  ...rest // data-*: markers for a future animation layer, forwarded to the <img>
}: SanityImageProps) {
  if (!image.asset?._id) return null;

  const lqip = image.asset.metadata?.lqip ?? undefined;

  return (
    <Image
      {...rest}
      className={className}
      src={urlFor(image).width(width).height(height).fit("crop").auto("format").url()}
      alt={image.alt ?? ""}
      width={width}
      height={height}
      sizes={sizes}
      preload={preload}
      placeholder={blur && lqip ? "blur" : "empty"}
      blurDataURL={lqip}
    />
  );
}
