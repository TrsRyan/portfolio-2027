import type { QueryParams } from "next-sanity";

import { client } from "./client";

// Default freshness (seconds): a publish in the Studio shows up on the
// site at most this long after. Static pages, revalidated in the background.
const DEFAULT_REVALIDATE = 60;

/**
 * Wrapper around `client.fetch` — the official Sanity pattern for a static
 * site without the Live Content API (time- or tag-based revalidation).
 * https://www.sanity.io/docs/nextjs/caching-and-revalidation-in-nextjs
 *
 * `<const QueryString>`: keeps the query's literal string type so TypeGen
 * can automatically infer the result type (defineQuery + overloadClientMethods).
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
      // with tags, the TTL is disabled: invalidation comes from the webhook.
      revalidate: tags.length ? false : revalidate,
      tags,
    },
  });
}
