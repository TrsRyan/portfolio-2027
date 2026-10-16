import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import SmoothScroll from "../components/SmoothScroll";
import ProjectModalHost from "../components/ProjectModalHost";
import { ProjectsProvider } from "../components/ProjectsProvider";
import { sanityFetch } from "../sanity/lib/fetch";
import { PROJECTS_QUERY } from "../sanity/lib/queries";
import { SITE_URL } from "../lib/site";

const khTeka = localFont({
  src: [
    { path: "./fonts/KHTekaTRIAL-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/KHTekaTRIAL-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/KHTekaTRIAL-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-kh-teka",
  display: "swap",
});

const title = "Ryan Torres — Front-end Developer";
const description =
  "Portfolio of Ryan Torres, a motion-focused front-end developer based in Brussels.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  // iOS Safari otherwise turns project years into date links.
  formatDetection: { telephone: false, date: false, address: false, email: false },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Ryan Torres",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

// Safe areas are handled in CSS with env(safe-area-inset-*).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children, modal }: LayoutProps<"/">) {
  // Deduplicated with the page queries; lets the modal open without a fetch.
  const projects = await sanityFetch({ query: PROJECTS_QUERY });

  return (
    <html lang="en" className={khTeka.variable}>
      <body>
        {/* Without JS, nothing lifts the intro's hidden state. */}
        <noscript>
          <style>{`[data-intro-root] *{visibility:visible!important}`}</style>
        </noscript>
        <ProjectsProvider projects={projects}>
          <SmoothScroll>
            {children}
            {/* The slot renders nothing; it keeps the homepage mounted
                under the modal, which ProjectModalHost renders. */}
            {modal}
            <ProjectModalHost />
          </SmoothScroll>
        </ProjectsProvider>
        <div id="modal-root" />
        <div id="page-curtain" aria-hidden="true" />
        <Analytics />
      </body>
    </html>
  );
}
