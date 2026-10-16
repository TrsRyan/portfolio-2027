"use client";

import Image from "next/image";
import { urlFor } from "../sanity/lib/image";
import { sanityLoader } from "../lib/sanityImageLoader";
import type { PROJECTS_QUERY_RESULT } from "../sanity.types";

type ProjectImage = NonNullable<PROJECTS_QUERY_RESULT[number]["image"]>;

/** width/height set the crop requested from the CDN; layout comes from CSS. */
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
  ...rest
}: SanityImageProps) {
  if (!image.asset?._id) return null;

  const lqip = image.asset.metadata?.lqip ?? undefined;

  return (
    <Image
      {...rest}
      className={className}
      loader={sanityLoader(image, height / width)}
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
