# PROMPT 01 REPORT — CRM 3.0 codebase audit and architecture map

## 1. What was produced

**docs/ARCHITECTURE.md** — The app as it exists: stack table, directory map,
all 27 screens with endpoints and layout descriptions, component inventory
(confirming PageShell/ScrollArea/StickyFooterBar are real and consistently
used in the CRM, and that "Card" is a CSS contract, not a component), all 12
endpoints with shapes and callers (none dead), the live data model from
production queries including every field the nightly enrichment jobs write,
theming reality (629 hardcoded hex), loading/empty-state coverage, 17 logged
bugs, and the dead-code/duplication ledger.

**docs/MIGRATION-MAP.md** — Every current screen and major component mapped
to its 3.0 destination (app shell, Dashboard, Leads, Call Console, Booked,
Calendar, Clients, Studio, System) with REUSE/EXTEND/REBUILD/RETIRE verdicts,
plus a keep/extend/retire verdict for all 10 endpoint families. Headline:
the layout primitives, call loop, and Booked workspace are reused; Calendar
and Studio are new; PrintsAdmin's localStorage stack is absorbed and retired.

**docs/DESIGN-BASELINE.md** — What to keep (identity, layout system, the
call loop, optimistic writes), what is inconsistent (two dark palettes,
102 unique colors, 5 duplicated status maps, two modal systems), and the
top 10 daily friction points ranked, with measured tap targets, type sizes,
and contrast ratios for the token work.

## 2. The stack in one paragraph

React 18 + Vite 6 SPA in plain JavaScript, styled entirely with per-file
CSS-in-JSX template strings over a token sheet in index.css, react-router
only on the marketing site (the admin does host and pathname branching),
local state with hand-rolled optimistic fetch against Vercel serverless
functions in api/ that talk to MongoDB Atlas (cluster VisualizeWebsite,
db `visualize`) through a cached driver client; auth is one HMAC-signed
cookie with a scrypt-hashed password override in Mongo; notifications are
web-push (VAPID) plus Web3Forms email; the site is an installable PWA with
a push-only service worker, deployed on Vercel with host-split rules that
serve the admin exclusively on admin.visualizeclients.com.

## 3. Total counts

| Metric | Count |
|---|---|
| Screens | 27 (9 CRM, 1 legacy print admin w/ 7 tabs, 11 public, maintenance) + 2 redirects |
| Reusable components (files) | 18 shared + ~40 page-local components |
| Endpoints | 12 (10 admin-guarded, 2 public); 0 uncalled |
| Collections | 3 live (call_leads 411 docs / 359 active, submissions 4, push_subscriptions 2); `settings` referenced by code, created lazily, does not exist yet |
| Hardcoded hex values | 629 occurrences, 102 unique |
| Bugs found | 17 logged (incl. the two known: greeting name strings, em dashes ×~67) |
| Dead code items | 9 (2 dead files, 1 unreachable branch, 2 orphaned CSS families, 1 dead localStorage path, 2 unused icon imports, 1 unused devDependency) |

## 4. Five things Prompt 2 (design tokens and theme) must know

1. The layout tokens on `.lay-root` (AdminLayout.jsx) are the working
   foundation — extend that block; don't invent a parallel one. LAYOUT.md
   rules (ScrollArea-only scrolling, in-flow StickyFooterBar) must survive.
2. 629 hex occurrences / 102 unique colors need collapsing to a semantic
   set; the real palette is: ground #080808, surfaces #121212/#1a1a1a,
   red #d44c43 (+#c2413a hover, #e66b63 tint), green #22c55e, amber #f59e0b,
   blue #60a5fa, violet #a78bfa, danger #ef4444, text #fafafa/#cccccc/#8a8a8a.
   Status/priority colors are duplicated in five files and one server file.
3. Floors to enforce in tokens: 44px tap targets (today 20–34px on the most
   used controls), 12px minimum label size, muted text at or above 4.5:1
   (#8a8a8a passes on #121212; #6a6a6a and PrintsAdmin #636373 fail).
4. Styling is CSS-in-JSX strings with prefixed classes; tokens must be plain
   CSS variables consumable from those strings (no build-step theming), and
   the admin ignores the marketing light theme by design — decide explicitly
   whether 3.0 stays dark-only.
5. Fonts are Inter + Barlow Condensed via Google Fonts; `--font-display`
   exists but admin files hardcode the stack inline; radii (9 values) and
   spacing (raw px, unused --space scale) need a scale.

## 5. Five things the whole rebuild must respect to avoid breaking data

1. **The nightly enrichment jobs write directly to call_leads**: `enrichment
   {lastScanAt, scanCount}` (252 docs), `updatedAt`, appended `[Enrichment
   date]` notes, contact/socials/angle/beforeYouDial fields, lowercase
   `industry` values, and — critically — `stage: ""` (empty string) on 249
   docs. Every schema change must be additive, every PATCH must keep
   whitelisting only sent fields, and `""`/missing stage must always read as
   'lead' (`effectiveStage()` semantics).
2. **callLog/contactLog/purchases date formats are mixed** (ISO strings vs
   'YYYY-MM-DD'); stats, "last contacted", and any new Calendar must parse
   both — and fix the UTC-midnight day-shift bug rather than inheriting it.
3. **Soft delete is a tombstone contract**: `deleted/deletedAt` hides a lead
   everywhere, blocks import re-creation, powers 30-day restore and lazy
   purge. New list queries must always filter `deleted: {$ne: true}`.
4. **The sanitize() whitelist in api/admin/call-leads.js is the schema.**
   Fields it doesn't know (enrichment) survive because PATCH only $sets sent
   keys and skips undefined. Never switch to document replacement.
5. **Two "orders" systems exist** (Mongo shop-order submissions vs
   PrintsAdmin/portal localStorage incl. plaintext portal passwords and
   invoices that exist on one device only). Migrate/absorb deliberately in
   the Studio prompt; do not assume localStorage data is disposable until
   Rob confirms what's still real.

## 6. UNCONFIRMED items to verify manually

- Whether the enrichment job ever writes `callStatus`/`callLog` or only the
  fields listed (sampled docs show it doesn't touch them).
- The enrichment job's schedule, runner, and credentials (nothing in this
  repo runs it; "nightly" is per Rob).
- Whether `/api/admin/push-subscribe` duplicates subscriptions on repeated
  enables (code has no endpoint-level dedupe; 2 docs live).
- Whether SplashScreen.jsx is mounted anywhere (no importer found).
- Whether any real (non-test) submissions/portal/localStorage data exists on
  Rob's devices that must be migrated before PrintsAdmin/portal retire (the
  four Mongo submissions are all soft-deleted tests).
- sample_mflix (215MB Atlas sample dataset) sits on the same cluster; unused
  by the app — candidate for deletion to free storage, Rob's call.
