"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   Documented pattern (Next App Router): a persistent component derives its
   open/closed state from `usePathname()`. Setting state in reaction to a
   pathname change is intrinsic to this pattern. */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useProjects } from "./ProjectsProvider";
import { curtainReveal } from "../lib/projectTransition";
import { ModalView } from "./ModalView";

// `incoming`: the ENTERING project during a project→project swap (phase
// "swap"). `slug` stays the outgoing project. <ModalView> calls back
// `onSwapDone` once the swap is done -> we close it onto { slug: incoming,
// phase: "in" }.
type State = {
  slug: string;
  phase: "in" | "out" | "swap";
  incoming?: string;
  /** Browser back button pressed WHILE a swap is running (Return/Escape,
   *  meanwhile, are blocked). Unblockable -> we let the swap finish at
   *  normal speed, then close from the INCOMING side (not a return to the
   *  outgoing one, which would jump). We keep `phase: "swap"` while waiting. */
  pendingExit?: boolean;
};

/**
 * Conductor for the project modal. Persistent (rendered by the layout,
 * never unmounted), it watches the URL and renders <ModalView> itself — so
 * it CONTROLS its own unmount and can delay it for the duration of the exit
 * animation (something the Next @modal slot doesn't allow).
 *
 * - soft navigation to /[slug]  -> opens (phase "in")
 * - back to /                   -> requests an exit (phase "out"), then
 *                                  onExitDone -> unmounts
 * - direct load of /[slug]      -> renders nothing (the real page shows)
 * - browser Prev / Next          -> usePathname updates -> same as above
 */
export default function ProjectModalHost() {
  const pathname = usePathname();
  const projects = useProjects();
  const firstRef = useRef(true);
  const [state, setState] = useState<State | null>(null);

  // Stable identities: ModalView has them as effect dependencies. Functions
  // recreated on every render would re-trigger the swap effect (-> its
  // timeline killed and replayed) as soon as `pendingExit` causes a re-render.
  const onExitDone = useCallback(() => setState(null), []);
  // End of the swap: finished normally -> open the incoming project ("in");
  // if it finished while an exit was requested, close from it instead.
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
    // Direct load on /[slug]: don't open a modal.
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }

    const slug = pathname === "/" ? null : pathname.replace(/^\/+/, "");
    const isProject = !!slug && projects.some((p) => p.slug === slug);

    if (isProject) {
      setState((s) => {
        // Project→project swap: a modal is ALREADY open on another
        // project. `slug` (the URL) becomes the INCOMING one; we keep the
        // outgoing one in `slug` and put the incoming one in `incoming`.
        // <ModalView> will call back onSwapDone.
        // (Otherwise = opening from the homepage, or Prev/Next on the real
        // page without a modal -> a plain retarget, edge case #4.)
        const isSwap = !!s && s.phase !== "out" && s.slug !== slug;
        if (isSwap && s) return { slug: s.slug, phase: "swap", incoming: slug };
        return { slug, phase: "in" };
      });
    } else {
      setState((s) => {
        if (!s || s.phase === "out") return s;
        // Exit requested during a swap = the browser's back button (Return
        // and Escape are blocked by the lock). We let the swap finish then
        // close from the incoming side -> keep `phase: "swap"` and set the flag.
        if (s.phase === "swap") return { ...s, pendingExit: true };
        return { ...s, phase: "out" };
      });
    }
  }, [pathname, projects]);

  // White curtain (mobile): once the new view is in place — a project
  // mounted ("in") or the homepage alone again (null) —, we reveal it.
  // No-op if no `curtainCover` is pending (desktop, or nav without a curtain).
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
