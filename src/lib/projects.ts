import type { PROJECTS_QUERY_RESULT } from "../sanity.types";

export type Project = PROJECTS_QUERY_RESULT[number];

/**
 * Finds a project by slug in the ordered list and returns its neighbors.
 * Shared by the real /[slug] page and the intercepted modal -> a single
 * source of truth for the prev/next calculation.
 */
export function pickProject(
  projects: PROJECTS_QUERY_RESULT,
  slug: string,
): { project: Project; prev: Project | null; next: Project | null } | null {
  const index = projects.findIndex((p) => p.slug === slug);
  if (index === -1) return null;
  return {
    project: projects[index],
    prev: index > 0 ? projects[index - 1] : null,
    next: index < projects.length - 1 ? projects[index + 1] : null,
  };
}
