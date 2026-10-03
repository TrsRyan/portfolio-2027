import { RESUME_PATH } from "../../lib/site";
import { sanityFetch } from "../../sanity/lib/fetch";
import { RESUME_QUERY } from "../../sanity/lib/queries";

/**
 * Serves the resume uploaded in Sanity (settings.resume) under its own
 * filename (RESUME_PATH) instead of the CDN's content-hashed URL. Replacing
 * the PDF in the Studio is picked up automatically; downloads keep the
 * filename it was uploaded with.
 */
export async function GET() {
  const resume = await sanityFetch({ query: RESUME_QUERY });
  if (!resume?.url) {
    return new Response("Not found", { status: 404 });
  }

  // no-store: the PDF can exceed Next's 2 MB data-cache entry limit;
  // caching happens at the CDN instead (Cache-Control below).
  const pdf = await fetch(resume.url, { cache: "no-store" });
  if (!pdf.ok || !pdf.body) {
    return new Response("Resume unavailable", { status: 502 });
  }

  const filename = resume.originalFilename ?? RESUME_PATH.slice(1);
  // RFC 6266: ASCII `filename` fallback + UTF-8 `filename*` for accents.
  const asciiFilename = filename.replace(/[^\x20-\x7e]|["\\]/g, "_");

  return new Response(pdf.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      // Same freshness as the rest of the site (see lib/fetch.ts).
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=86400",
      // Personal contact details: keep the file out of search results.
      "X-Robots-Tag": "noindex",
    },
  });
}
