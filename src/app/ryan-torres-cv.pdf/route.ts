import { sanityFetch } from "../../sanity/lib/fetch";
import { SETTINGS_QUERY } from "../../sanity/lib/queries";

const FILENAME = "Ryan-Torres-CV.pdf";

/**
 * Serves the resume uploaded in Sanity (settings.resume) under a stable,
 * readable URL instead of the CDN's content-hashed one, and a
 * proper filename when downloaded. Replacing the PDF in the Studio is
 * picked up automatically.
 */
export async function GET() {
  const settings = await sanityFetch({ query: SETTINGS_QUERY });
  const resumeUrl = settings?.resumeUrl;
  if (!resumeUrl) {
    return new Response("Not found", { status: 404 });
  }

  // no-store: the PDF can exceed Next's 2 MB data-cache entry limit;
  // caching happens at the CDN instead (Cache-Control below).
  const pdf = await fetch(resumeUrl, { cache: "no-store" });
  if (!pdf.ok || !pdf.body) {
    return new Response("Resume unavailable", { status: 502 });
  }

  return new Response(pdf.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${FILENAME}"`,
      // Same freshness as the rest of the site (see lib/fetch.ts).
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
      // Personal contact details: keep the file out of search results.
      "X-Robots-Tag": "noindex",
    },
  });
}
