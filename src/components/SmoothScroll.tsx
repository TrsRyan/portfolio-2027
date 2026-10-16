"use client";

import { useEffect, useState } from "react";
import { ReactLenis, useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { REDUCE_MOTION_MEDIA } from "../lib/motion";

gsap.registerPlugin(ScrollTrigger);

// Mobile URL bar resizes would refresh ScrollTrigger mid-scroll.
ScrollTrigger.config({ ignoreMobileResize: true });

/** Drives Lenis from the GSAP ticker, as in the Lenis docs. */
function GsapSync() {
  const lenis = useLenis(() => ScrollTrigger.update());

  useEffect(() => {
    if (!lenis) return;
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
    };
  }, [lenis]);

  return null;
}

export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  // Toggle smoothing instead of conditionally rendering, so children never
  // remount.
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
