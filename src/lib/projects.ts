import type { PROJECTS_QUERY_RESULT } from "../sanity.types";

export type Project = PROJECTS_QUERY_RESULT[number];

/** A project and its neighbors in the ordered list. */
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
