import { defineQuery } from "next-sanity";

/**
 * All projects, ordered — reused by both the homepage AND the project pages
 * (4 projects: no need for a per-page query).
 *
 * - `titleLines`: the title is a `text` field with manual line breaks
 *   (e.g. "Marais de\nBiestebroeck"); we split it into an array in GROQ.
 * - `image`: full projection for `urlFor()` + blur placeholder (lqip) +
 *   ratio (dimensions), see Sanity image best practices.
 */
export const PROJECTS_QUERY = defineQuery(`
  *[_type == "project" && defined(slug.current)]
  | order(coalesce(order, 100) asc, year asc, _createdAt asc) {
    _id,
    "slug": slug.current,
    title,
    "titleLines": string::split(title, "\\n"),
    year,
    client,
    tools,
    overview,
    liveUrl,
    image{
      asset->{
        _id,
        url,
        metadata { lqip, dimensions { width, height } }
      },
      hotspot,
      crop,
      alt
    }
  }
`);

/** Slugs only — for generateStaticParams. */
export const PROJECT_SLUGS_QUERY = defineQuery(`
  *[_type == "project" && defined(slug.current)].slug.current
`);

/**
 * Site settings (singleton, fixed _id "settings").
 * `resumeUrl`: the uploaded PDF's direct URL, or null if there isn't one.
 */
export const SETTINGS_QUERY = defineQuery(`
  *[_id == "settings"][0]{
    name,
    bio,
    location,
    timezone,
    linkedinUrl,
    email,
    "resumeUrl": resume.asset->url
  }
`);
