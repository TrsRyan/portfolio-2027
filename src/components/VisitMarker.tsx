"use client";

import { useEffect } from "react";
import { markVisited } from "../lib/introSession";

/**
 * Sets the "already visited the site" flag as soon as a project page
 * mounts (direct access, refresh). Without it, arriving via a project link
 * then clicking "Return" would replay the full homepage intro. See
 * lib/introSession.ts. Renders nothing.
 */
export default function VisitMarker() {
  useEffect(() => {
    markVisited();
  }, []);
  return null;
}
