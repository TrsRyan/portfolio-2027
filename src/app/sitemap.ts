import type { MetadataRoute } from "next";
import { sanityFetch } from "../sanity/lib/fetch";
import { PROJECT_SLUGS_QUERY } from "../sanity/lib/queries";

const BASE_URL = "https://ryantorres.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await sanityFetch({ query: PROJECT_SLUGS_QUERY });

  return [
    { url: BASE_URL, priority: 1 },
    ...slugs.map((slug) => ({ url: `${BASE_URL}/${slug}`, priority: 0.8 })),
  ];
}
