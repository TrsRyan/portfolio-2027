# Portfolio 2027 — Sanity Studio

Back office (CMS) for the portfolio. A **standalone** app: its own
dependencies, its own dev server. The Next.js site lives at the root of the
repo and reads this content via `next-sanity`.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3333
```

Connects to the Sanity project `81dz5o0t` / dataset `production` (hardcoded
in `sanity.config.ts` and `sanity.cli.ts` — these are public identifiers).

## Schemas

| Type | File | Role |
|---|---|---|
| `project` | `schemaTypes/projectType.ts` | one portfolio piece |
| `settings` | `schemaTypes/settingsType.ts` | site info (name, bio, links…) — singleton document |

## Scripts

| Command | Effect |
|---|---|
| `npm run dev` | dev server (Vite) |
| `npm run build` | production build |
| `npm run deploy` | deploys the Studio to `*.sanity.studio` |
