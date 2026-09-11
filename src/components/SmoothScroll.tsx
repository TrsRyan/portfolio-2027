"use client";

import { useEffect, useState } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { REDUCE_MOTION_MEDIA } from "../lib/motion";

gsap.registerPlugin(ScrollTrigger);

// On touch devices, ignore vertical resizes caused by the URL bar
// showing/hiding (otherwise ScrollTrigger.refresh() -> scroll-linked
// animations jump mid-scroll, e.g. the parallax on tablet).
ScrollTrigger.config({ ignoreMobileResize: true });

/**
 * Rendered INSIDE <ReactLenis> so useLenis has access to the instance.
 * Runs Lenis on the GSAP ticker: a single rAF loop for the whole app
 * (hence autoRaf:false on <ReactLenis>). Pattern from the lenis/react and
 * lenis READMEs ("GSAP ScrollTrigger" section).
 */
function GsapSync() {
  // every Lenis scroll event -> ScrollTrigger recalculates
  const lenis = useLenis(() => ScrollTrigger.update());

  useEffect(() => {
    if (!lenis) return;
    const raf = (time: number) => lenis.raf(time * 1000); // GSAP ticker in seconds -> Lenis in ms
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33); // GSAP defaults, restored on unmount
    };
  }, [lenis]);

  return null;
}

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  // prefers-reduced-motion: SSR renders a neutral value, the effect adjusts
  // client-side. We don't gate the wrapper's render on it -> children never
  // remount; we just turn the smoothing off.
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(REDUCE_MOTION_MEDIA);
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <ReactLenis
      root
      options={{ autoRaf: false, smoothWheel: !reduced, syncTouch: false }}
    >
      <GsapSync />
      {children}
    </ReactLenis>
  );
}
