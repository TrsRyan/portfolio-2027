import type { MetadataRoute } from "next";
import { sanityFetch } from "../sanity/lib/fetch";
import { PROJECT_SLUGS_QUERY } from "../sanity/lib/queries";
import { SITE_URL } from "../lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await sanityFetch({ query: PROJECT_SLUGS_QUERY });

  return [
    { url: SITE_URL, priority: 1 },
    ...slugs.map((slug) => ({ url: `${SITE_URL}/${slug}`, priority: 0.8 })),
  ];
}
