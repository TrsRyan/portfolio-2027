import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SmoothScroll from "../components/SmoothScroll";
import ProjectModalHost from "../components/ProjectModalHost";
import { ProjectsProvider } from "../components/ProjectsProvider";
import { sanityFetch } from "../sanity/lib/fetch";
import { PROJECTS_QUERY } from "../sanity/lib/queries";

// KH Teka — Light/Regular/Medium
const khTeka = localFont({
  src: [
    { path: "./fonts/KHTekaTRIAL-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/KHTekaTRIAL-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/KHTekaTRIAL-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-kh-teka",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ryan Torres — Front-end Developer",
  description:
    "Portfolio of Ryan Torres, a motion-focused front-end developer based in Brussels.",
  // Without this, iOS Safari turns lone numbers (project years like "2022")
  // into underlined "date" links. We turn off every auto-detection.
  formatDetection: { telephone: false, date: false, address: false, email: false },
};

// viewport-fit=cover: the page paints under the notch / Dynamic Island; we
// then recover the safe area via env(safe-area-inset-*) in CSS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, modal }: LayoutProps<"/">) {
  // Same query (60s cache) as the homepage and project pages: deduplicated
  // by Next. Feeds the client context -> the modal opens without a refetch.
  const projects = await sanityFetch({ query: PROJECTS_QUERY });

  return (
    <html lang="en" className={khTeka.variable}>
      <body>
        {/* No-JS fallback for the intro's anti-FOUC (globals.css): if JS
            doesn't run, nothing will set data-intro-ready -> force visibility. */}
        <noscript>
          <style>{`[data-intro-root] *{visibility:visible!important}`}</style>
        </noscript>
        <ProjectsProvider projects={projects}>
          <SmoothScroll>
            {children}
            {/* The @modal slot renders `null`: its only role is to keep
                `children` = the homepage when navigating to /[slug]. The
                modal itself is rendered by <ProjectModalHost> (persistent). */}
            {modal}
            <ProjectModalHost />
          </SmoothScroll>
        </ProjectsProvider>
        {/* Portal target for the intercepted modals (Phase 5). Must be in
            the server-rendered HTML so createPortal can find it on mount. */}
        <div id="modal-root" />
        {/* Page curtain (mobile): passing through white between the
            homepage and a project. Covers everything, fully opaque,
            animated by lib/projectTransition. */}
        <div id="page-curtain" aria-hidden="true" />
      </body>
    </html>
  );
}
