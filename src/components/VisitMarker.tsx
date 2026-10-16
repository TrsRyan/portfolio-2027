"use client";

import { useEffect } from "react";
import { markVisited } from "../lib/introSession";

/** Landing on a project page counts as a visit, so Return skips the intro. */
export default function VisitMarker() {
  useEffect(() => {
    markVisited();
  }, []);
  return null;
}
