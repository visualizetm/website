# VISUALIZE ADMIN — ARCHITECTURE (as of commit 93f5def, 2026-09-03)

Prompt 1 of the CRM 3.0 rebuild. Documentation only; nothing in this file
changes code. Every claim below comes from reading the code in this repo or
from live queries against the production database. Items that could not be
verified are marked UNCONFIRMED.

Reading depth: every admin file, every api/ file, every src/lib file, the
app shell, entry, service worker, deploy config, and PrintsAdmin were read
line by line. Marketing pages (Home, Services, Work, Contact, Start,
LeadPartner) and ClientPortal/Prints/IntakeForm were read structurally
(component tree, all fetch/storage calls, all route logic) after having been
built/refactored in this same repo history; their inner copy was not
re-read line by line.

---

## a. Stack

| Layer | What it is |
|---|---|
| Framework | React 18.3.1, functions + hooks only, no class components |
| Language | JavaScript (JSX). No TypeScript anywhere |
| Build | Vite 6 (`@vitejs/plugin-react`), `__BUILD_SHA__` define from `VERCEL_GIT_COMMIT_SHA` |
| Routing | react-router-dom 6.28 — but only the marketing site uses `<Routes>`; AdminApp does its own `location.pathname` section switch; App.jsx does host-based branching before routing |
| Styling | **CSS-in-JSX template strings** per page/component (`<style>{xxStyles}</style>`), prefixed classes (`aa-` shell, `cc-/cq-/cs-/cb-/lk-` console, `bk-` booked, `ld-` leads, `cl-` clients, `ck-` checklists, `ls-` linked subs, `li-` import, `sl-` socials, `adm-` legacy print admin, `uc-` maintenance). Global tokens + resets live in `src/index.css`. No Tailwind, no CSS modules, no styled-components |
| State | Local `useState`/`useMemo` per page. No global store. AdminApp lifts submissions + call_leads state and passes down. No react-query/SWR; hand-rolled fetch + optimistic update + rollback |
| Data fetching | `fetch()` to same-origin `/api/*` Vercel serverless functions. Cookie auth (HttpOnly). No caching layer |
| Backend | Vercel serverless (ESM handlers in `api/`), MongoDB Atlas via `mongodb` driver 7.5, cached client on `globalThis._vzMongo` (`api/_lib/mongo.js`), db name from URI path else `visualize` |
| Auth | One admin password. HMAC-signed expiry cookie `vz_admin` (`SESSION_SECRET`), 30-day, timing-safe compare. Password = scrypt hash in `settings` collection if ever changed, else `ADMIN_PASSWORD` env (`api/_lib/auth.js`) |
| Notifications | Web push (`web-push`, VAPID env keys) + Web3Forms email fallback (`api/_lib/notify.js`), both best-effort, toggled by `settings._id='prefs'` |
| PWA | `public/manifest.webmanifest` (standalone, theme `#d44c43`), `public/sw.js` (skipWaiting/claim, no-op fetch handler for installability, push + notificationclick deep link). Registered in `main.jsx` |
| Deployment | Vercel. `vercel.json`: SPA rewrite to index.html, `/admin/*` redirected to `/` unless host is `admin.visualizeclients.com`, security headers. Repo now lives at `visualizetm/website` (old remote redirects) |
| Fonts | Google Fonts `<link>` in index.html: Inter 400–900, Barlow Condensed 500–800 |
| Dependencies | `@babel/runtime` pinned ^7 (v8 breaks the icon package), `@untitled-ui/icons-react` (deep ESM imports), `mongodb`, `react`, `react-dom`, `react-router-dom`, `web-push`, `xlsx` (dynamic import → own chunk). Dev: vite, plugin-react, playwright-core (layout audit), sharp (**unused — no script references it anymore**) |

## b. Directory map

```
api/                 Vercel serverless functions (ESM), one file = one route
api/_lib/            mongo client cache, auth (HMAC cookie + scrypt), notify (push+email)
api/admin/           admin-guarded endpoints (requireAdmin on every handler)
docs/                build prompts + this documentation
public/              static: logo.svg, wordmark png, PWA icons, sw.js, manifest, showcase imgs
scripts/             dev-only: layout-audit.mjs (overflow regression), migrate-mongo.mjs
src/App.jsx          host split (admin domain vs public), route table, splash, reveal observer
src/main.jsx         entry, theme pre-paint sync, maintenance gate (env or preview), SW register
src/index.css        design tokens (:root + [data-theme=light]), resets, layout guards, marketing styles
src/components/      shared UI: AdminLayout primitives, Checklists, LinkedSubmissions,
                     SocialLinks, LeadImport, Wordmark, ThemeToggle + marketing sections
src/pages/           one file per screen; the five Admin* files are the CRM
src/lib/             pure logic: phone, socials, booked (stage/pricing/prep), spreadsheet,
                     adminPaths (host detection)
src/data/            bundled call-leads-import.json (10 notepad leads), clients showcase data
src/hooks/useReveal.js  scroll reveal hook — UNUSED (App.jsx observes inline); dead code
```

## c. Screen inventory

### CRM (served on admin.visualizeclients.com, all inside AdminApp shell)

| Route | Screen | Renders / layout | Endpoints |
|---|---|---|---|
| `/` | **Dashboard** | Logo + rotating greeting hero ("Coffee and cold calls, Rob?"), clickable Leads→Booked→Clients funnel strip, 6 stat cards 3-up (calls today/week/month/90d from callLog+contactLog, money made from purchases ledger, clients on retainer), Recent Activity feed (submissions), shortcut buttons | GET submissions, GET call-leads (via shell) |
| `/leads` | **Leads** | 324px list panel (search, priority/status chips, industry select, per-row checkbox, bulk delete bar) + full-width detail (display-face business name, tap-to-call, socials, angle, notes editor, call history, checklists, linked submissions, edit form, guarded delete). Desktop detail = 2-col grid ≥1200px | GET/POST/PATCH/DELETE call-leads, POST leads/import, PATCH submissions (linking) |
| `/booked` | **Booked workspace** | List panel (prep-status pills, meeting countdown chips, closed toggle) + collapsible-section detail (Meeting, Services game plan, hero Pricing cards with bullet inclusions + "Lead with this", Concepts + big demo/Drive buttons, Prep notes, Checklists, Their submissions, context folds), CALL MODE toggle reorders call-critical column first, pinned Won/Lost/Reschedule bar | PATCH call-leads |
| `/clients` | **Clients** | List grouped Awaiting-first-invoice / Clients (total-paid + last-contacted chips) + detail: purchases ledger with big TOTAL PAID, manual contact log (Call/Meeting/Email/Text chips + date + note) merged with console history, notes, checklists, services sold, pricing presented, linked submissions, Add-client + edit/delete forms, pinned "First invoice paid" bar for won | PATCH/POST/DELETE call-leads, PATCH submissions |
| `/calls` | **Call Console** | Queue screen = session BUILDER (priority/status/industry count chips, include-no-phone, live "N leads in this queue" preview, pinned START). Session = fullscreen card (warning banner, tap-to-call hero, angle, facts, socials, folds) + pinned outcome bar (Booked/Callback/No/No-answer) + Reject-lead button; desktop 3-zone (rail / card / notes+log); keyboard (arrows, 1–4, N, ?, /); swipe on touch; localStorage session persistence; reverse phone lookup sheet; summary screen with Run-it-back. NO outcome soft-deletes the lead | GET/POST/PATCH/DELETE call-leads |
| `/submissions`, `/orders` | **ListSection ×2** | Panel (search, status groups w/ counts, select-all, skeletons, bulk bar) + detail (status pills, contact chips, socials, fields grid, private notes). Same component, different status sets | GET/PATCH/DELETE submissions, GET export |
| `/settings` | **Settings** | Sub-nav panel: Security (password change), Notifications (push/email prefs + this-device enable), Export (4 full exports), Recently deleted (submissions + leads groups, restore, purge all), Legacy tools (link to /prints dashboard) | GET/POST settings, submissions?deleted=1, call-leads?deleted=1/restore/purgeDeleted |
| (mobile) | **More sheet** | Bottom sheet with Dashboard/Submissions/Orders/Settings/Log out; the 5 thumb tabs are Leads/Booked/Clients/Calls/More | — |
| (unauth) | **Login** | Centered card, shake on error | POST login |

### Legacy admin (also on admin host)

| Route | Screen | Notes |
|---|---|---|
| `/prints` (admin host) or `/admin/prints` | **PrintsAdmin** — 7-tab dashboard (Overview w/ localStorage analytics charts, Orders, Clients, Invoices, Briefs, Shop, Settings w/ maintenance toggle). Own `adm-` design system (#0f0f11 surfaces — different greys than the CRM). **All data is per-device localStorage** (`vz_print_orders`, `vz_clients`, `vz_invoices`, `vz_intake_forms`, `vz_analytics`) — nothing touches Mongo. Shares the admin cookie session | GET session, POST logout only |

### Public site (visualizestudio.org)

`/` Home, `/services`, `/work` + `/work/:slug` case studies, `/contact` (+`/book` alias), `/lead-partner`, `/start` (animated multi-step brief → POST /api/submissions + Web3Forms fallback), `/prints` (print shop with cart in `vz_cart`, checkout → POST /api/submissions AND localStorage order for the legacy dashboard), `/portal` (ClientPortal: localStorage account auth, Dashboard/Orders/Invoices/Meetings/Briefs views, Calendly via /api/calendly-meetings), `/intake/*` (IntakeForm → localStorage briefs), redirects `/showcase→/work`, `/pricing→/services`. Plus the Maintenance screen (star field + rocket + password gate) rendered by main.jsx when `VITE_MAINTENANCE_MODE` or the per-device preview flag is on.

**Screens total: 27** (9 CRM incl. login+More, 1 PrintsAdmin multi-tab, 11 public, maintenance) + 2 redirects.

## d. Component inventory

**True shared primitives (used consistently across the CRM):**
- `AdminLayout.jsx` — `PageShell` (.lay-shell), `ScrollArea` (.lay-scroll, the ONLY sanctioned scroll container; gutter + safe-area padding), `StickyFooterBar` (.lay-footbar, in-flow pinned bars that cannot cover content), plus `.lay-card` row contract, `.lay-overlay`/`.lay-modal-box`, and all layout tokens on `.lay-root`. **Card is a CSS contract class, not a React component.** Adopted by every CRM section (verified: all pinned bars are StickyFooterBar; every scroller is ScrollArea). PrintsAdmin, ClientPortal, marketing pages do NOT use them.
- `Checklists.jsx` — named task lists, props `{lead, onPatch}`; used by Leads, Booked, Clients.
- `LinkedSubmissions.jsx` — linked + suggested submissions, props `{lead, submissions, onLinkSubmission}` + exported `suggestFor`; used by Leads, Booked, Clients.
- `SocialLinks.jsx` — `SocialButtons`/`SocialFields`; used by Leads/Booked/Clients/Calls/Submissions detail + marketing footer icons style.
- `LeadImport.jsx` — 3-step CSV/XLSX import sheet (dynamic `xlsx` chunk); used by Leads page only.
- `Wordmark.jsx`, `ThemeToggle.jsx` (marketing only), `SplashScreen.jsx` (unused by App — UNCONFIRMED whether any route mounts it; grep shows no import in App.jsx).

**One-file locals (defined inside pages, not shared):** AdminApp: StatusBadge, ConfirmModal, Skeletons, ItemDetail, ListSection, Dashboard, SettingsSection, Login, usePush. AdminCalls: PriorityPill, StatusChip, QaTable, NewLeadForm (+exported defaultLead), EditLead, Collapse, ScriptBody, CallLogList, NotesPanel, OutcomeSheet, LookupSheet, ShortcutsOverlay. AdminBooked: GrowInput, Section, PriceCard, Fold→Section, LogList, PrepPill. AdminLeads: Pill, LeadForm, Block, ConfirmDelete, LeadDetail. AdminClients: Block (duplicate), ClientForm, Purchases, ContactHistory, ClientDetail, ContactChip. PrintsAdmin: StatusBadge (duplicate), StatCard, MiniBar. Marketing: Hero, Services, Process, Trust, Testimonials, CTA, CaseStudies, ShowcasePreview, Navbar, Footer.

## e. Endpoint inventory (12 routes — all called; none dead)

| Route | Methods | Auth | Collections | Called by |
|---|---|---|---|---|
| `/api/admin/call-leads` | GET (`?deleted=1` lazy-purges >30d), POST (single/`{leads[]}` idempotent by business + socials backfill), PATCH (`{id,set}` whitelisted via `sanitize()`, skips undefined; `{action:'restore',ids}`), DELETE (`?id=`/`?ids=a,b,c` soft, `?purgeDeleted=1` hard) | admin | call_leads | AdminApp shell, AdminCalls, (Leads/Booked/Clients via props) |
| `/api/admin/leads/import` | POST `{rows[]}` ≤5000, match sourceId → business+last-10-phone, skip deleted, merge socials | admin | call_leads | LeadImport |
| `/api/admin/submissions` | GET (`?id=`, `?deleted=1`), PATCH (`{id,set}`: status/read/notes/socials/linkedLeadId; `{action:'restore'}`), DELETE (`?ids=` soft) | admin | submissions | AdminApp |
| `/api/admin/export` | GET `?type=&format=&status=&q=&days=` → CSV (RFC4180 + BOM, union field columns) or JSON | admin | submissions | ListSection, Settings, Dashboard shortcut |
| `/api/admin/login` / `logout` / `session` | POST / POST / GET | — / — / — | settings (auth doc) | Login, shells, PrintsAdmin |
| `/api/admin/settings` | GET (prefs+passwordOverridden), POST (`password`/`prefs`/`purge` — purge covers submissions only; leads purge lives on call-leads) | admin | settings, submissions | SettingsSection |
| `/api/admin/push-subscribe` | POST subscription upsert-ish (insert; UNCONFIRMED dedupe by endpoint) | admin | push_subscriptions | usePush |
| `/api/push-key` | GET VAPID public key | public | — | usePush |
| `/api/submissions` | POST public form intake → insert + push + email (prefs-gated) | public | submissions, settings, push_subscriptions | Start, Prints checkout |
| `/api/calendly-meetings` | GET `?email=` → upcoming events + cancel/reschedule URLs (CORS `*`) | public (email-keyed) | — (Calendly API, `CALENDLY_PAT`) | ClientPortal Meetings |

Env vars used by api/: `MONGODB_URI`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `WEB3FORMS_NOTIFY_KEY`, `CALENDLY_PAT`. Client-side: `VITE_MAINTENANCE_MODE`, `VITE_MAINTENANCE_PASSWORD`, Web3Forms access key in Prints/Start (VITE — ships in bundle; Web3Forms keys are designed to be public).

## f. Data model (live, from cluster VisualizeWebsite → db `visualize`, queried 2026-09-03)

Collections that actually exist: **call_leads, submissions, push_subscriptions** (3 — confirmed via listCollections). The `settings` collection is referenced by code but **does not exist yet**; it is created lazily on first password change / prefs save / notification prefs read returns defaults meanwhile.

### call_leads — 411 documents (359 live, 52 soft-deleted), 39 top-level fields

App-written fields (all pass through `sanitize()` in call-leads.js — caps in parens):

```
business(200) industry(80) descriptor(400) phone(40) phoneNote(200) email(200)
area(160) serviceInterest(200) sourceId(120|null) notes(3000) askFor(200)
bestWindow(300) priority: hot|warm|cold  callStatus: not-called|callback|booked|no|no-answer
angle(1200) beforeYouDial[≤30 str] 
script{confirm,intro,homework,question,likelyAnswers[{say,respond}≤12],hook,ask}
objections[{say,respond}≤12] close{lockIt,ifNo,noAnswer}
afterCall{meeting,email,whatTheySaid,nextAction} intel{accomplishments[],gaps[],dropLines[]}
socials{website,instagram,facebook,tiktok,google,yelp,linkedin,x,youtube — normalized URLs}
callLog[≤200 {at:ISO-string, outcome, note(1000), meeting(300), email(200)}]
stage: lead|booked|won|lost|client   clientSince: ISO-string
meeting{date:'YYYY-MM-DD', time:'HH:MM', type: call|video|in-person}
servicesPlanned[≤30 ids] pricingOptions[≤3 {label,price:num,plan:full|6mo|12mo,retainer,notes}]
conceptsTracker{items[≤20 {label,done}], demoUrl, driveUrl}
checklists[≤10 {name, items[≤50 {text,done}]}]
purchases[≤50 {label,amount:num,at:'YYYY-MM-DD',notes}]
contactLog[≤200 {type: call|meeting|email|text|other, at:'YYYY-MM-DD', note}]
bookedOutcome{result: won|lost, reason, at:ISO}
deleted:bool deletedAt:Date createdAt:Date updatedAt:Date
```

**Fields written by the external nightly enrichment/scraping jobs** (confirmed from live docs — none of this is written by app code):

- `enrichment: { lastScanAt: Date, scanCount: Number }` — present on **252 docs**
- `stage: ""` (empty string) on **249 docs** — the enricher writes an empty stage; `effectiveStage()` treats falsy as `'lead'`, so this is survivable, but any future strict stage handling MUST keep treating `""` as lead
- `updatedAt` (Date) bumped on scan
- The enricher also creates whole new leads (sample: created 2026-08-21, empty `script{}` skeleton unlike app-created leads which get the full defaultLead script) and fills/overwrites: `notes` (appends `[Enrichment YYYY-MM-DD] …` text), `phoneNote`, `askFor`, `bestWindow`, `angle`, `beforeYouDial`, `descriptor`, `area`, `industry` (**lowercase**, e.g. `food & beverage`, while imported data is Title Case — the industry facet now has case-variant duplicates), `priority`, `socials`, `phone`, `email`
- UNCONFIRMED: whether the enricher ever writes `callStatus` or touches `callLog` (no evidence it does in sampled docs)

### submissions — 4 documents (all currently soft-deleted test data)

`type: start|shop-order|contact|other`, `projectType`, `name`, `business`, `email`,
`phone`, `fields{}` (free-form Q→A map), `status: new|contacted|replied|landed|denied`
(orders reuse the field with order statuses), `read`, `notes`, `socials{}` (later
feature; absent on existing docs), `linkedLeadId` (later feature; absent on
existing docs), `deleted/deletedAt`, `createdAt`. No updatedAt.

### push_subscriptions — 2 documents

`subscription{ endpoint, keys{p256dh, auth}, expirationTime:null }`, `updatedAt`.

## g. Theming today

- **Tokens:** `src/index.css` `:root` defines 68 CSS variables (brand ramp `--brand/#d44c43` family, dark surface set `--bg #080808` / `--bg-elevated` / `--bg-card`, 4-level text ramp, borders, 8px-base `--space-1..32`, `--radius`, glass set, `--ease`, `--font-body` Inter / `--font-display` Barlow Condensed) + one `[data-theme='light']` override block. Theme is set pre-paint in index.html from `vz_theme` localStorage else OS preference. **The CRM ignores the light theme entirely** — every admin surface hardcodes its own dark palette on its root (`.aa-app`, `.cc-page`, `.adm-page` each re-declare local `--a-*`/`--c-*`/custom vars).
- **Hardcoded hex values: 629 occurrences, 102 unique colors** across src/+api (top offenders: AdminCalls 76, ClientPortal 73, AdminApp 64, PrintsAdmin 43, IntakeForm 42, AdminBooked 42). The same semantic colors are re-typed everywhere: `#d44c43` red, `#22c55e` green, `#f59e0b` amber, `#60a5fa` blue, `#ef4444`, `#8a8a8a` muted, `#121212/#1a1a1a` surfaces. PrintsAdmin uses a *different* dark ramp (`#0f0f11/#141418/#1a1a20`, muted `#636373`) than the CRM (`#080808/#121212/#1a1a1a`, muted `#8a8a8a`).
- Status/priority color maps are re-declared in at least 5 files (AdminApp LEAD/ORDER_STATUSES, AdminCalls CALL_STATUSES+OUTCOMES, AdminLeads CALL_STATUSES+OUTCOME_META, AdminBooked OUTCOME_COLORS/LABELS, server call-leads.js CALL_STATUSES).
- Fonts loaded once via Google Fonts link; admin re-declares `font-family: 'Inter', -apple-system…` per root and `'Barlow Condensed', 'Inter'` inline per display element rather than via `--font-display`.
- The faint red grid texture is a global `.grid-texture` utility in index.css.

## h. Loading and empty states today

- **Skeletons:** only Submissions/Orders list (`Skeletons` rows) and Settings→Recently deleted.
- **Text-only "Loading…":** Leads list, Clients list, Booked list, Call Console session card area.
- **No loading state at all:** Dashboard stats (render zeros then pop when data lands), console queue/builder counts, PrintsAdmin (sync localStorage so none needed), portal views.
- **Designed empty states:** console queue (import CTA), Leads, Clients, Booked, LinkedSubmissions, lookup sheet, Recently deleted, PrintsAdmin tabs, submissions/orders. Generally good coverage; copy uses em dashes (see bugs).

## i. Known issues / bugs found (logged, NOT fixed)

1. **Dashboard greeting name mangling (reported by Rob):** the GREETINGS array in AdminApp includes joke strings that read as a broken name, e.g. `"Hey there, Rob'neH?"`, `"Rob. The myth. The legend."`. Rendered verbatim in the hero. CRM 3.0: greetings must always address "Rob" cleanly.
2. **Em dashes in UI copy (policy violation going forward):** ~67 occurrences across the admin surfaces alone (empty states, placeholders, confirm bodies, hints — e.g. "No calls logged yet — dial them from the Call Console."). All UI copy must drop em dashes in the rebuild.
3. **Date-only strings display one day early in US timezones:** `fmtDate('2026-08-06')` → `new Date` parses as UTC midnight → renders Aug 5 in EDT/PDT. Affects purchases dates, contact-log dates, clientSince/won dates on Clients + Booked cards, and `lastContact` day-math ("Nd ago" can be off by one). PrintsAdmin already works around this exact bug for invoice due dates by appending `'T12:00:00'` — proof of the hazard. Meeting date/time is safe (parsed as local `date+'T'+time`).
4. **Industry facet case duplicates (live-data bug):** the nightly enricher writes lowercase industries (`food & beverage`) while spreadsheet/app data is Title Case, so console/leads industry chips can show the same industry twice with split counts.
5. **`stage: ""` on 249 live docs** (enricher). Tolerated by `effectiveStage()` only; any strict `stage === 'lead'` comparison would silently drop 249 leads.
6. **Dead CSS in AdminCalls:** the entire old queue-card family (`.cq-list, .cq-card, .cq-dot, .cq-main, .cq-sub, .cq-side, .cq-hasphone, .cq-controls, .cq-pills, .cq-filterbtn, .cq-count, .cq-filtersheet, .cq-sheet-pills, .cq-nophone, .cc-search-wrap, .cc-search`) survives from before the session-builder rewrite; `.aa-callprog*` block in AdminApp survives the removed progress bar; session card emits `cs-card--flash-<outcome>` classes with no matching CSS rule.
7. **Dead feature path:** the console still reads `vz_builder_preset` from localStorage on mount, but nothing writes it anymore (the stat cards that wrote it were replaced). Harmless today; either re-adopt or remove in 3.0.
8. **Dead code:** `src/hooks/useReveal.js` (unused — App.jsx observes inline), `SplashScreen.jsx` (no importer found — UNCONFIRMED), the non-embedded Call Console topbar branch (AdminCalls is only ever mounted `embedded` via AdminApp; the standalone header + its Wordmark import are unreachable), unused icon imports in AdminCalls (`Phone`, `Plus`), `sharp` devDependency, `.bk-` `planLabel`-era leftovers are clean.
9. **Duplicated logic (the copy count):** `normalizeSocials` ×3 (src/lib/socials.js, call-leads.js, submissions.js — serverless cannot import src/, documented but still 3 copies to keep in sync); phone last-10 normalizer ×2 (src/lib/phone.js + mirrored in leads/import.js, documented); `fmtDate`/`fmtLogTime`/`telOf`/`money` re-implemented in AdminLeads, AdminClients, AdminBooked; `Block` component duplicated (AdminLeads + AdminClients); ConfirmModal (AdminApp) vs ConfirmDelete (AdminLeads); StatusBadge duplicated (AdminApp + PrintsAdmin); status color maps ×5 (see g).
10. **Legacy print/portal stack is per-device localStorage:** orders, invoices, client accounts (with **plaintext passwords displayed in a table**), briefs, and analytics live only in the browser that created them. The CRM's Orders (Mongo `shop-order` submissions) and PrintsAdmin's Shop tab (localStorage `vz_print_orders`) are two disconnected views of "orders". `ClientPortal` auth is a localStorage account list with a decorative 31-bit hash — not security, and data does not roam devices.
11. **Small-target controls below 44px:** `aa-iconbtn`/`cc-iconbtn` 34×34, `aa-search-clear` ≈20×20, `ck-check` 24×24, delete `×` buttons ≈26px (measured from CSS). Collapse headers, tabs, chips are compliant (44–58px).
12. **Placeholder contrast fails AA:** `#6a6a6a` placeholders on `rgba(255,255,255,0.04)` over `#131313` ≈ 2.9:1 (SocialFields); `--text-muted #636373` in PrintsAdmin on `#0f0f11` ≈ 3.9:1. CRM muted `#8a8a8a` on `#121212` ≈ 4.6:1 passes for body text but is used at 9–11px label sizes where more contrast is warranted.
13. **Silent stale data on fetch failure:** console `load()` and shell `loadCallLeads()` swallow errors and keep the last list with no offline/error indicator (writes DO surface errors; reads don't).
14. **More sheet has no Escape/focus trap;** modals generally stop at click-outside + Escape in some (ConfirmModal has Escape; More sheet, reject sheet do not).
15. **`settings` purge asymmetry:** Settings "Purge all now" calls two endpoints (submissions purge via settings action, leads purge via call-leads `?purgeDeleted=1`) — works, but the settings action name `purge` now under-describes what the button does; a failure in the second call is unreported.
16. **Bundled lead data in the public JS bundle:** `src/data/call-leads-import.json` (the 10 Drive notepads incl. names/phones) ships inside the admin bundle chunk served from the public origin. Low risk (admin bundle is fetchable by anyone) but real data in a static asset.
17. **`push-subscribe` dedupe UNCONFIRMED:** repeated enables on one device may insert duplicate subscription docs (2 docs live; endpoint uniqueness not enforced in code).

## j. Dead code, unused deps, duplication — summary counts

Dead/unreachable: 3 files-or-branches (useReveal, SplashScreen UNCONFIRMED, console standalone header) + 2 orphaned CSS families + 1 dead localStorage feature path + 2 unused icon imports + 1 unused devDependency (sharp). Duplicated logic: 9 distinct clusters (item i.9). Legacy parallel systems: 2 (localStorage orders/invoices/portal vs Mongo submissions; two dark palettes).
