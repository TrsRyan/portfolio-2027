import type { NextConfig } from "next";

// Images served from the Sanity CDN, restricted to this project + dataset
// (not all of cdn.sanity.io: keeps the image optimizer from serving an
//  image from a different Sanity project).
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

const nextConfig: NextConfig = {
  // Motion-heavy project: Strict Mode's double-mount makes GSAP intros stutter
  // in dev (the effect runs twice). Common practice for this kind of project —
  // `dev` then plays animations the same way production does.
  reactStrictMode: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: `/images/${projectId}/${dataset}/**`,
      },
    ],
  },

  // Memorable entry point to the Sanity-hosted Studio. Temporary (307) so the
  // target can change without browsers caching the old one.
  async redirects() {
    return [
      {
        source: "/studio",
        destination: "https://ryantorres.sanity.studio",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
