import type { NextConfig } from "next";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;

const nextConfig: NextConfig = {
  // Strict Mode's double mount replays the GSAP intro in dev.
  reactStrictMode: false,

  images: {
    // Limited to this project's dataset, not all of cdn.sanity.io.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: `/images/${projectId}/${dataset}/**`,
      },
    ],
  },

  // Non-permanent so browsers don't cache the target.
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
