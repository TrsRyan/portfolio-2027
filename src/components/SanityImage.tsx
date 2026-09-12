"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { urlFor } from "../sanity/lib/image";
import type { PROJECTS_QUERY_RESULT } from "../sanity.types";
import styles from "./SanityImage.module.css";

// The image as projected by PROJECTS_QUERY (dereferenced asset + lqip + crop/hotspot).
type ProjectImage = NonNullable<PROJECTS_QUERY_RESULT[number]["image"]>;

/**
 * Renders a Sanity image via next/image.
 * Sanity "image.md" pattern: URL built with urlFor (respects hotspot/crop),
 * auto format (webp/avif), and a blur placeholder from the lqip when present.
 *
 * width/height = size requested from the Sanity CDN (exact crop around the hotspot).
 * Actual display is driven by `className` (object-fit, position…).
 *
 * Fades the real image in once it has actually finished loading (over
 * whatever LQIP/blur is sitting underneath it) — next/image's own
 * `placeholder="blur"` mode swaps to the sharp image the instant it decodes,
 * with no transition of its own (confirmed against the official docs: the
 * `onLoad` callback fires "once the image is completely loaded", nothing
 * about a built-in fade). On a warm/instant load the fade is too fast to
 * notice; on a slow/cold one it reads as a smooth reveal instead of a pop.
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
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // A cached/instant image can already be `complete` before this effect's
  // listener would ever see a fresh `load` event -> checked once on mount
  // (the native DOM way to ask "did I miss it"), so a warm load doesn't get
  // stuck invisible.
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  if (!image.asset?._id) return null;

  const lqip = image.asset.metadata?.lqip ?? undefined;

  return (
    <Image
      {...rest}
      ref={imgRef}
      className={`${styles.image} ${loaded ? styles.loaded : ""} ${className ?? ""}`}
      src={urlFor(image).width(width).height(height).fit("crop").auto("format").url()}
      alt={image.alt ?? ""}
      width={width}
      height={height}
      sizes={sizes}
      preload={preload}
      placeholder={blur && lqip ? "blur" : "empty"}
      blurDataURL={lqip}
      onLoad={() => setLoaded(true)}
    />
  );
}
