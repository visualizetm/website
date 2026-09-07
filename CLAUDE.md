# Visualize admin and site: working notes for the next prompt

Start here, then read in this order: docs/ARCHITECTURE.md (what exists and
where), docs/RUNBOOK.md (how to run, deploy, secure, and check it, including
"Prerender"), docs/COMPONENTS.md (the kit), docs/TOKENS.md (the design
tokens and both contrast tables), docs/MARKETING-MOTION.md (the public
site's reveal, parallax, counter, and marquee primitives), LAYOUT.md (the
layout contract and the boot frame), docs/QA-CHECKLIST.md (the admin's
daily walk), and docs/SITE-QA-CHECKLIST.md (the CRM-to-site walk). History
is in reports/PROMPT-NN-REPORT.md and reports/SITE-NN-REPORT.md.

## Standing rules

- Tokens only. Every CSS value in src/ui, src/shell, src/pages/Admin*, and src/components reads `var(--v-...)` from src/ui/tokens.js. No raw hex outside the token block; `node scripts/hex-count.js` must stay at 90 or lower and only ever go down.
- The marketing site is its own token set: src/index.css's `:root` (not `--v-*`), read by src/marketing/motion, src/marketing/showcase.jsx, and every marketing page. Brand-colored TEXT reads `--brand-text` (resolves to `--brand-light` on the dark theme, `--brand-dark` on the light theme), never `--brand` directly, which falls short of 4.5:1 in every context measured so far. Theme-aware assets (a logo, an image variant) use `src/marketing/useTheme.js`; every page's title, description, and og:image go through `src/marketing/useHead.js`.
- The marketing site is driven by the CRM, not typed in. `/api/showcase` (public, published clients only, an exact field whitelist) is its only connection: `src/marketing/showcase.jsx`'s `fetchShowcase()`/`fetchClient()` (60s cache) feed the Clients list and detail pages and every CRM-fed section of Home; what shows there, in what order, is set on a client's Showcase tab and the admin's Landing screen (Studio, /landing), never hardcoded on the site. Every new marketing page or state gets a `marketing: true` entry in scripts/audit-screens.mjs so it stays covered by a11y-audit.mjs.
- Build from the kit. Screens import from `'../ui'` only; no new one off components when a kit piece fits, no hand rolled scroll containers (PageShell, ScrollArea, StickyFooterBar).
- Additive schema. Never rename or drop a field; new fields are optional and older documents simply lack them.
- `$set` only. Every write is `updateOne({ _id }, { $set: allowed })` (plus `$push` with `$slice` for capped lists). sanitize() in each route is the schema: a field the whitelist does not know is not written.
- Every dispatched route uses `route()` from api/_lib/handler.js (admin guard, method allow list, body cap, one try/catch); the three auth endpoints (api/admin/login.js, logout.js, session.js) are plain handlers with their own method check. Auth is the signed `vz_admin` cookie alone: no CSRF header, no rate limit, no database lookup. The admin password is the constant in api/_lib/config.js (an ADMIN_PASSWORD env var overrides it); every other secret still comes from environment variables only, and nothing but config.js may hold a password.
- No em dashes anywhere: copy, comments, docs, reports.
- Skeletons ship with features. A new screen or region lands with its skeleton, its empty state (src/shared/copy.js), its error state with Retry, and its entrance; the feel audit checks all four.
- Motion reads `--v-dur-*` and `--v-ease-*` only, and JS timers read `durationMs()`; everything collapses under Reduce motion.
- Accessibility is part of done: one real control per card or row (the stretched `.v-stretch` button), 44px targets, labels on every icon button, live regions for status, landmarks named. `node scripts/a11y-audit.mjs` must show no serious or critical violation.
- Greetings and copy address Rob. Untitled UI icons only.
- Run the scripts before committing (see below); push to main after every prompt.

## Scripts (run before committing)

```
npm run build                                   # vite build, pins the CSP hash in vercel.json, prerenders published clients, writes the sitemap
npx vite preview --port 4330 &
node scripts/layout-audit.mjs                   # overflow and 44px targets, 5 widths, admin and marketing
AUDIT_THEME=both AUDIT_MOTION=both node scripts/feel-audit.mjs
AUDIT_THEME=both node scripts/a11y-audit.mjs
node scripts/regression.mjs
node scripts/site-regression.mjs                # docs/SITE-QA-CHECKLIST.md's CRM-to-site walk
node scripts/hex-count.js                       # 90 or lower
node scripts/css-orphans.mjs                    # 0
TZ=America/New_York node scripts/dates-test.mjs
```

Optional: `AUDIT_ONLY=a11y node scripts/layout-audit.mjs` (zoom and text
spacing), `AUDIT_ONLY=mkt node scripts/a11y-audit.mjs` (marketing pages
only), `node scripts/render-profile.mjs`, `node scripts/lighthouse.mjs`
against `scripts/mock-server.mjs` (`LH_FORM=desktop` for the 1280 preset,
`MOCK_SHOWCASE_EMPTY=1` on the mock server for an empty-CRM run), `node
scripts/feel-audit.mjs --boot`.

## Shape of the repo

api/ (9 Vercel functions, under the Hobby plan's cap of 12: api/admin/login.js,
logout.js, and session.js stand alone; api/admin/index.js dispatches every
other admin endpoint on ?r=<name>, put there by one vercel.json rewrite per
URL, to api/_routes/<name>.js, one file per route's logic, each still wrapped
in route(); api/cron/[job].js dispatches both crons; api/showcase.js is the
public, published-clients-only endpoint the marketing site reads;
submissions.js and push-key.js are the other two public endpoints; _lib for
auth, config, mongo, handler, notify, stripe, orders), src/ui (the kit),
src/shell (AppShell, nav, command bar, drawer, boot frame, appearance,
ShellCrash), src/pages (one file per admin screen, lazy chunks; the
marketing pages are lazy too), src/components (lead and client record
pieces, and the marketing shell: Navbar, Footer, Wordmark, ThemeToggle, and
Home's own sections), src/marketing (showcase.jsx, motion/, scroll.js and
ScrollRoot.jsx (the gsap + lenis scroll engine, marketing host only),
links.js, useHead.js, useTheme.js, the public site's own layer), src/lib (pure logic), src/shared
(semantics, pricing, dates, api, copy, log), scripts/ (the audits, plus
prerender-clients.mjs and build-sitemap.mjs, chained into `npm run build`),
docs/, reports/.
