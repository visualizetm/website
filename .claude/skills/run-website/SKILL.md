---
name: run-website
description: Run, build, start, launch, preview, or smoke-test the Visualize marketing website (Vite + React SPA). Use this skill to verify changes, screenshot pages, or confirm routes work.
---

# run-website

Vite 6 + React 18 SPA. The smoke script builds the app, starts `vite preview`, and HTTP-checks all 8 routes. No browser or display needed — everything is curl-based.

The driver: `.claude/skills/run-website/smoke.sh`

---

## Prerequisites

Node ≥ 18 (container has v22). No system packages beyond Node/npm needed.

```bash
npm install
```

---

## Build

```bash
npm run build
```

Output lands in `dist/`. Bundle is ~491 kB JS + 8 kB CSS.

---

## Run (agent path)

Run the smoke script from the **repo root**:

```bash
# Build + start preview server + check all routes (default):
bash .claude/skills/run-website/smoke.sh

# Or explicitly:
bash .claude/skills/run-website/smoke.sh preview

# Build only (no server):
bash .claude/skills/run-website/smoke.sh build

# Dev server (HMR, no prior build needed):
bash .claude/skills/run-website/smoke.sh dev
```

The script exits 0 if all routes return HTTP 200, non-zero on any failure.
It kills the server on exit automatically.

**Routes checked:** `/` `/services` `/showcase` `/contact` `/book` `/pricing` `/prints` `/portal`

---

## Run (human path)

```bash
npm run dev       # http://localhost:5173 — HMR dev server
npm run preview   # http://localhost:4173 — serves built dist/
```

Both are useless headless — they open no window and produce no observable output beyond the URL.

---

## Key pages

| URL | Component |
|-----|----------|
| `/` | `src/pages/Home.jsx` |
| `/portal` | `src/pages/ClientPortal.jsx` — self-contained dark-themed app, no Navbar/Footer |
| `/prints` | `src/pages/Prints.jsx` — Instagram vinyl order flow |
| `/admin` | `src/pages/PrintsAdmin.jsx` — order management, password protected |

---

## Gotchas

- **SPA routing**: All routes return the same `index.html` shell. The React Router handles client-side routing. `vite preview` does this automatically. In production, `vercel.json` has `rewrites: [{ source: "/(.*)", destination: "/index.html" }]`.
- **`/portal`, `/prints`, `/admin`** render outside the Navbar/Footer layout (hardcoded check in `App.jsx` by `location.pathname`). They have their own full-screen styles.
- **`VisualizeWordmark.png`** must be in `public/` — referenced by Navbar, Footer, App loader, and SplashScreen. If missing, logos render broken but the app still loads.
- **`chromium-cli` not available** in this container. All verification is curl-based (HTTP status checks). For visual inspection, use the human path and a local browser.
- **Vercel serverless functions** live in `api/` (e.g. `api/calendly-meetings.js`). They don't run locally via `vite dev` — they need `vercel dev` or deployment.

---

## Troubleshooting

**Port already in use**: `kill $(lsof -ti:4173)` or `kill $(lsof -ti:5173)`

**Build fails on icons**: `@tabler/icons-react` v3 uses named exports — imports must match exactly (e.g. `IconUser`, not `IconUserCircle`).

**Preview server returns 404 on routes**: `dist/` is stale or missing — run `npm run build` first.
