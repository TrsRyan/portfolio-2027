import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Police d'essai — remplacer par les fichiers sous licence avant toute mise en ligne publique.
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
  title: "Torres Ryan — Front-end Developer",
  description:
    "Portfolio of Torres Ryan, a motion-focused front-end developer based in Brussels.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={khTeka.variable}>
      <body>{children}</body>
    </html>
  );
}
