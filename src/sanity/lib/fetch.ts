import type { QueryParams } from "next-sanity";

import { client } from "./client";

const DEFAULT_REVALIDATE = 60; // seconds

/**
 * Time- or tag-based revalidation, see
 * https://www.sanity.io/docs/nextjs/caching-and-revalidation-in-nextjs
 */
export async function sanityFetch<const QueryString extends string>({
  query,
  params = {},
  revalidate = DEFAULT_REVALIDATE,
  tags = [],
}: {
  query: QueryString;
  params?: QueryParams;
  revalidate?: number | false;
  tags?: string[];
}) {
  return client.fetch(query, params, {
    next: {
      revalidate: tags.length ? false : revalidate,
      tags,
    },
  });
}
