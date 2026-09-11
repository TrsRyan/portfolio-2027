import type { NextConfig } from "next";

// Images served from the Sanity CDN, restricted to this project + dataset
// (not all of cdn.sanity.io: keeps the image optimizer from serving an
//  image from a different Sanity project).
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

const nextConfig: NextConfig = {
  // Next 16 otherwise scaffolds instruction files at the project root on every
  // `next dev`; not needed here, so we turn it off.
  agentRules: false,

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
};

export default nextConfig;
