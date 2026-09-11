"use client";

import { createContext, useContext } from "react";
import type { PROJECTS_QUERY_RESULT } from "../sanity.types";

/**
 * Project list (PROJECTS_QUERY result), provided once by the server layout
 * and available synchronously on the client. The intercepted modal reads
 * its project from here -> opens without a network round trip (the Flip
 * morph can start on the click's own tick).
 */
const ProjectsContext = createContext<PROJECTS_QUERY_RESULT | null>(null);

export function ProjectsProvider({
  projects,
  children,
}: {
  projects: PROJECTS_QUERY_RESULT;
  children: React.ReactNode;
}) {
  return (
    <ProjectsContext.Provider value={projects}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects(): PROJECTS_QUERY_RESULT {
  const projects = useContext(ProjectsContext);
  if (projects === null) {
    throw new Error("useProjects must be used inside <ProjectsProvider>");
  }
  return projects;
}
