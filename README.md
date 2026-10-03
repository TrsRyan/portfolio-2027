# Portfolio 2027 — Ryan Torres

Personal portfolio of Ryan Torres, motion-focused front-end developer (Brussels).

**Live → [torres-ryan.com](https://www.torres-ryan.com)**

## Highlights

- **Intro sequence** — GSAP SplitText reveal, played once per session, with an
  anti-FOUC gate so nothing flashes before it starts
- **Project pages as a modal over the homepage** (intercepting + parallel
  routes) — every project keeps a real, shareable URL, and a direct visit
  renders the full page
- **Shared-element transition** — the homepage thumbnail morphs into the
  project image (GSAP Flip) and back on Return; Prev/Next swap projects in place
- **Smooth scrolling** with Lenis, driven by GSAP's ticker (one rAF loop)
- **Respects `prefers-reduced-motion`**
- **Content managed in Sanity**, statically generated and revalidated in the
  background

## Stack

- **[Next.js 16](https://nextjs.org)** — App Router, Turbopack
- **React 19** + **TypeScript**
- **CSS Modules** — no CSS framework, styles co-located per component
- **[GSAP 3](https://gsap.com)** (`@gsap/react` / `useGSAP`) — animations
- **[Lenis](https://lenis.darkroom.engineering)** — smooth scroll
- **[Sanity v6](https://www.sanity.io)** — CMS, standalone Studio in `studio/`
- Hosting: site on **Vercel**, Studio on **Sanity** (`sanity deploy`)

## Structure

```
portfolio-2027/
├── src/
│   ├── app/            # routes (/, /[slug]) + layout, global styles
│   ├── components/     # reusable components (animated links, clock…)
│   └── sanity/         # client + Sanity read helpers (no schema here)
│       ├── env.ts
│       └── lib/        # client.ts, image.ts, fetch.ts, queries.ts
└── studio/             # standalone Sanity Studio (its own package.json)
    └── schemaTypes/    # project, settings
```

The site and the Studio are **two separate applications**, each with its own
dependencies. This is Sanity's recommended structure for a new project.

## Getting started

Requirements: **Node 22 or 24**, **npm ≥ 11.6.3**.

### The site

```bash
npm install
npm run dev          # http://localhost:3000
```

Requires a `.env.local` file at the root:

```
NEXT_PUBLIC_SANITY_PROJECT_ID=xxxxxxxx
NEXT_PUBLIC_SANITY_DATASET=production
```

### The Studio (back office)

```bash
cd studio
npm install
npm run dev          # http://localhost:3333
```

## Scripts

| Location | Command | Effect |
|---|---|---|
| root | `npm run dev` | site dev server |
| root | `npm run build` | site production build |
| root | `npm run lint` | ESLint |
| `studio/` | `npm run dev` | Studio dev server |
| `studio/` | `npm run build` | Studio build |
| `studio/` | `npm run deploy` | deploys the Studio to Sanity |

## Credits

Typeface: **KH Teka** by [KH Type](https://khtype.com).

## Contact

[LinkedIn](https://www.linkedin.com/in/torres-ryan/) · [ryan-torres@outlook.com](mailto:ryan-torres@outlook.com)
