import { defineQuery } from "next-sanity";

/**
 * All projects, shared by the homepage and the project pages. `titleLines`
 * splits the title on its manual line breaks.
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
    "typeLabel": *[_id == "settings"][0].typeLabel,
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

export const PROJECT_SLUGS_QUERY = defineQuery(`
  *[_type == "project" && defined(slug.current)].slug.current
`);

/** Singleton document with the fixed _id "settings". */
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

export const RESUME_QUERY = defineQuery(`
  *[_id == "settings"][0].resume.asset->{
    url,
    originalFilename
  }
`);
