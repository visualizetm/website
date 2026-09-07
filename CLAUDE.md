# Visualize admin and site: working notes for the next prompt

Start here, then read in this order: docs/ARCHITECTURE.md (what exists and
where), docs/RUNBOOK.md (how to run, deploy, secure, and check it),
docs/COMPONENTS.md (the kit), docs/TOKENS.md (the design tokens and both
contrast tables), LAYOUT.md (the layout contract and the boot frame), and
docs/QA-CHECKLIST.md (the daily walk). History is in reports/PROMPT-NN-REPORT.md.

## Standing rules

- Tokens only. Every CSS value in src/ui, src/shell, src/pages/Admin*, and src/components reads `var(--v-...)` from src/ui/tokens.js. No raw hex outside the token block; `node scripts/hex-count.js` must stay at 145 or lower and only ever go down.
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
npm run build                                   # also pins the CSP hash in vercel.json
npx vite preview --port 4330 &
node scripts/layout-audit.mjs                   # overflow and 44px targets, 5 widths
AUDIT_THEME=both AUDIT_MOTION=both node scripts/feel-audit.mjs
AUDIT_THEME=both node scripts/a11y-audit.mjs
node scripts/regression.mjs
node scripts/hex-count.js                       # 145 or lower
node scripts/css-orphans.mjs                    # 0
TZ=America/New_York node scripts/dates-test.mjs
```

Optional: `AUDIT_ONLY=a11y node scripts/layout-audit.mjs` (zoom and text
spacing), `node scripts/render-profile.mjs`, `node scripts/lighthouse.mjs`
against `scripts/mock-server.mjs`, `node scripts/feel-audit.mjs --boot`.

## Shape of the repo

api/ (8 Vercel functions, under the Hobby plan's cap of 12: api/admin/login.js,
logout.js, and session.js stand alone; api/admin/index.js dispatches every
other admin endpoint on ?r=<name>, put there by one vercel.json rewrite per
URL, to api/_routes/<name>.js, one file per route's logic, each still wrapped
in route(); api/cron/[job].js dispatches both crons; _lib for auth, config,
mongo, handler, notify, stripe, orders), src/ui (the kit), src/shell (AppShell, nav, command
bar, drawer, boot frame, appearance, ShellCrash), src/pages (one file per
admin screen, lazy chunks; the marketing pages are lazy too), src/components
(lead and client record pieces), src/lib (pure logic), src/shared (semantics,
pricing, dates, api, copy, log), scripts/ (the audits), docs/, reports/.
