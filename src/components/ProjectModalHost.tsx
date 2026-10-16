"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   The modal state is derived from usePathname() changes. */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useProjects } from "./ProjectsProvider";
import { curtainReveal } from "../lib/projectTransition";
import { ModalView } from "./ModalView";

type State = {
  slug: string;
  phase: "in" | "out" | "swap";
  /** Incoming project during a swap; `slug` stays the outgoing one. */
  incoming?: string;
  /** Back button pressed mid-swap: finish the swap, then close. */
  pendingExit?: boolean;
};

/**
 * Persistent host for the project modal. Rendering <ModalView> here instead
 * of in the @modal slot lets the modal stay mounted while its exit
 * animation plays. A direct load of /[slug] renders the real page instead.
 */
export default function ProjectModalHost() {
  const pathname = usePathname();
  const projects = useProjects();
  const firstRef = useRef(true);
  const [state, setState] = useState<State | null>(null);

  // Stable callbacks: they are effect dependencies in ModalView, and a new
  // identity would restart the swap timeline.
  const onExitDone = useCallback(() => setState(null), []);
  const onSwapDone = useCallback(
    () =>
      setState((s) => {
        if (s?.phase !== "swap" || !s.incoming) return s;
        return s.pendingExit
          ? { slug: s.incoming, phase: "out" }
          : { slug: s.incoming, phase: "in" };
      }),
    [],
  );
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }

    const slug = pathname === "/" ? null : pathname.replace(/^\/+/, "");
    const isProject = !!slug && projects.some((p) => p.slug === slug);

    if (isProject) {
      setState((s) => {
        const isSwap = !!s && s.phase !== "out" && s.slug !== slug;
        if (isSwap && s) return { slug: s.slug, phase: "swap", incoming: slug };
        return { slug, phase: "in" };
      });
    } else {
      setState((s) => {
        if (!s || s.phase === "out") return s;
        if (s.phase === "swap") return { ...s, pendingExit: true };
        return { ...s, phase: "out" };
      });
    }
  }, [pathname, projects]);

  useEffect(() => {
    if (state === null || state.phase === "in") curtainReveal();
  }, [state]);

  if (!state) return null;

  return (
    <ModalView
      slug={state.slug}
      phase={state.phase}
      incoming={state.incoming}
      onExitDone={onExitDone}
      onSwapDone={onSwapDone}
    />
  );
}
