import { createClient } from 'next-sanity'

import { apiVersion, dataset, projectId } from '../env'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  // true: served via the Sanity CDN (fast, ~1 min freshness). Our pages are
  // static with time-based revalidation -> see lib/fetch.ts.
  // For "always fresh" (generateStaticParams, webhooks): client.withConfig({ useCdn: false }).
  useCdn: true,
})
