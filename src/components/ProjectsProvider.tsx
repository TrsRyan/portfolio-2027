"use client";

import { createContext, useContext } from "react";
import type { PROJECTS_QUERY_RESULT } from "../sanity.types";

/** Lets the modal read its project synchronously, without a fetch. */
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
