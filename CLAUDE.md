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
- Home is scenes on one primitive: every section is a `Scene` (src/marketing/motion/Scene.jsx, docs/SCENE-ENGINE.md), pinned for steps times stepDistance, its children revealing off the scene's own progress by data-step; no Pin, Curtain or TrackScroll. A change to Home runs `scripts/scene-audit.mjs` at every width and under reduced motion before it is committed.
- Dial lists (lists collection, api/_routes/lists.js, src/lib/lists.js): a lead carries listId, the one open list it is on; every list write goes through AdminApp's listOps so the members and the listIds move together; the system list Callbacks due fills itself (route GET, the daily cron, the shared patch helper) and is never renamed, resized, finished or filled by hand; the Call Console runs a list and applies the outcome rule on the same write.
- The deal and its invoices (CRM revamp, step 5): a booked record carries `deal` (src/lib/deal.js, mirrored in api/_lib/deal.js); it becomes stage deal an hour past its meeting or on Met them; a card on /deals sits in the column of its newest ticked checkpoint; the first Mark paid on a deal invoice is the one conversion to client and project (src/lib/dealConvert.js). Invoices are one shape on deals and projects (src/lib/invoices.js, mirrored in api/_lib/invoices.js), status computed on read, entered and marked by hand only; projects read invoicesOf(), never schedule[].
- Dates on the server are America/New_York through api/_lib/zone.js (the cron, rules.js, nextAction.js, deal.js, invoices.js), never the process zone; the client mirrors keep the browser's zone in the clock at the top of the file and stay byte for byte identical below it. rules-test and next-action-test run in both zones and must agree.
- One task system: tasks are the `checklists` on leads and projects (src/shared/taskRules.js, mirrored byte for byte in api/_lib/taskRules.js, asserted by tasks-test), never a second collection. The Next up rule is `taskNextUp` and nothing else: pinned wins, else the earliest due open task overdue first, ties by checklist order then task order, undated only when nothing is dated. A pin IS the manual next action (auto false, taskId) and every write that pins, finishes, deletes or unpins goes through src/lib/taskWrite.js. The Tasks screen (/clients/:id/tasks) and the record's Tasks section are the only task UI; Notes has no checklists.
- The client planner is a dashboard (src/pages/Planner.jsx: Home, Posts, Ads, Ideas) in Rob's first person, fed only by /api/planner, which strips on the server what a client may not see (an ad's budget unless showBudget, nothing internal). A post carries kind post or ad; video is a format. Suggestions (a client's ideas) are their own collection, written only by the planner door and answered from the editor's inbox. Save to photos is src/lib/share.js (share-test).
- Every lead and project carries one next action (src/lib/nextAction.js, mirrored in api/_lib/nextAction.js): the rules are one pure function, the shared patch helpers in AdminApp (and the Call Console's own) recompute it on any write that touches the fields it reads, the daily cron repairs drift, a manual action (auto false) is never overwritten. The Tasks page (/tasks, the Next up queue; the first screen, nav id dashboard, is Analytics), its badge and the notifications drawer read nextUpItems and nothing else for what is due.
- Client docs (docs job; docs/ARCHITECTURE.md, "Client docs"): a doc is a title, a type and blocks, never HTML. `src/shared/docBlocks.js` is the schema and is mirrored byte for byte in `api/_lib/docBlocks.js` (docs-test asserts it); `sanitizeBlocks()` is the only door in, `domToRuns` in `src/components/docs/RichText.jsx` the only place page text becomes runs, and nothing that draws a doc writes HTML (security-test 4d scans for the sinks). Docs are admin only (api/_routes/docs.js behind route()); a reference block may only point at the same client's record; every doc read and write goes through `docsApi` (src/lib/useDocs.js) from the shell, so the client's Docs card, All docs, the More count, search and Recently Deleted read one list. Autosave is src/lib/docSave.js: Back saves first and text that could not be saved is kept in memory for the next open. Contract wording states the house rules from `src/shared/pricing.js` (never typed). A doc's checklist stays in the doc; only the explicit Make a task writes a task, through `addTask` and `checklistsPatch`.
- Concepts are a client presentation, not a library: a lead at any stage gets a concept set (concept_sets, api/_routes/concept-sets.js) built at /leads/:id/concepts and opened by the client at /concepts/:token (src/pages/Concepts.jsx: one section per direction, each revealing as one unit, no scenes; served by /api/concepts which rides on api/showcase.js by rewrite). The token is minted server side only; a draft never resolves publicly; the client can approve, ask for changes and leave notes, and nothing else. A set is Pick one (default, every older set) or Review each (an answer on every direction that needs one, saved as they go, one Send my answers, locked until Rob reopens it); the client's answers are written only by the public endpoint and survive an editor save. No prices on that page.
- The marketing site is driven by the CRM, not typed in. `/api/showcase` (public, published clients only, an exact field whitelist) is its only connection: `src/marketing/showcase.jsx`'s `fetchShowcase()`/`fetchClient()` (60s cache) feed the Clients list and detail pages and every CRM-fed section of Home; what shows there, in what order, is set on a client's Showcase tab and the admin's Landing screen (Studio, /landing), never hardcoded on the site. Every new marketing page or state gets a `marketing: true` entry in scripts/audit-screens.mjs so it stays covered by a11y-audit.mjs.
- Build from the kit. Screens import from `'../ui'` only; no new one off components when a kit piece fits, no hand rolled scroll containers (PageShell, ScrollArea, StickyFooterBar).
- Additive schema. Never rename or drop a field; new fields are optional and older documents simply lack them.
- `$set` only. Every write is `updateOne({ _id }, { $set: allowed })` (plus `$push` with `$slice` for capped lists). sanitize() in each route is the schema: a field the whitelist does not know is not written.
- Every dispatched route uses `route()` from api/_lib/handler.js (admin guard, method allow list, body cap, one try/catch); the three auth endpoints (api/admin/login.js, logout.js, session.js) are plain handlers with their own method check. Auth is the signed `vz_admin` cookie alone: no CSRF header, no rate limit, no database lookup. The admin password is the constant in api/_lib/config.js (an ADMIN_PASSWORD env var overrides it); every other secret still comes from environment variables only, and nothing but config.js may hold a password.
- No em dashes anywhere: copy, comments, docs, reports.
- The record (LeadDetail, UI simplification part A) keeps six laws, written at the top of src/components/LeadDetail.jsx: one number one place (the paid of figure renders once, in Money); one way into a section (a tab on a computer, a row on a phone, no folds); empty facts do not render (one Add a detail sheet); at most two pills in the header (status and priority); at most three header controls (primary, secondary, overflow); every section's empty state is one line with one action. Sections render from the one `rec` object; `checkpointAction` is the one rule the header primary, the outcome bar and the Checkpoints rows share.
- Pipeline position is normalizeStage on the stage field and nothing else; a client or won record only leaves that stage through an explicit user action (the PATCH carries explicit: true), never an import, a background job, or a status change. Every client carries clientSince (the PATCH and POST stamp it; the daily cron heals a wiped stage from the client evidence in api/_lib/pipeline.js and names each heal in the drawer). Every lead entering the app passes normalizeLead() (src/lib/leadShape.js); a screen never assumes a field's type.
- Security is docs/SECURITY-AUDIT.md. Every stored link or image goes through safeUrl() (api/_lib/url.js) in its sanitize() and safeHref() (src/lib/safeUrl.js) at the render; every request value in a Mongo filter is cast; every public door is behind the shared limiter (api/_lib/limit.js); SESSION_SECRET is required on Vercel. `node scripts/security-test.mjs` runs before every commit and must pass.
- Skeletons ship with features. A new screen or region lands with its skeleton, its empty state (src/shared/copy.js), its error state with Retry, and its entrance; the feel audit checks all four.
- Motion reads `--v-dur-*` and `--v-ease-*` only, and JS timers read `durationMs()`; everything collapses under Reduce motion.
- Accessibility is part of done: one real control per card or row (the stretched `.v-stretch` button), 44px targets, labels on every icon button, live regions for status, landmarks named. `node scripts/a11y-audit.mjs` must show no serious or critical violation.
- The phone is designed to docs/MOBILE-UI-GUIDE.md: a chrome mode per screen (src/shell/chrome.js: tabs on a section root, focused on a record, an editor, a setup page or the call room, where the tab bar is hidden and the top bar is Back, the title and only declared actions); More is a page; a phone editor is an overview of rows with a step per row and one draft; every list has an EmptyState (first time) and a NoResults (names the search) and never one for the other; every gesture (edge Back, sheet drag, row swipe, long press) follows the finger, has a visible equivalent and stays off sideways scrollers. Tab labels 11px, targets 44px, titles clamp to two lines (`.lay-title`).
- Greetings and copy address Rob. Untitled UI icons only.
- Run the scripts before committing (see below); push to main after every prompt.

## Scripts (run before committing)

```
npm run lint                                    # ESLint (eslint.config.js): no-undef and no-unused-vars are errors, the hooks rules; regression.mjs runs it first
npm run build                                   # vite build, pins the CSP hash in vercel.json, prerenders published clients, writes the sitemap
npx vite preview --port 4330 &
node scripts/layout-audit.mjs                   # overflow and 44px targets, 5 widths, admin and marketing
AUDIT_THEME=both AUDIT_MOTION=both node scripts/feel-audit.mjs
AUDIT_THEME=both node scripts/a11y-audit.mjs
node scripts/regression.mjs
node scripts/site-regression.mjs                # docs/SITE-QA-CHECKLIST.md's CRM-to-site walk
SCENE_PATH=/ SCENE_WIDTHS=320,390,430,768,1280 node scripts/scene-audit.mjs   # Home's gate at a phone's real viewport heights: painted-row dead bands, block placement, text overlap, navbar and indicator clearance, wrapped words, cover names, the strip (docs/SCENE-ENGINE.md); SCENE_MOTION=reduce for reduced motion
node scripts/mobile-trace.mjs                   # Home on a phone with real touch drags (390, 320, 430, reduce motion), against the mock server on 4350
node scripts/hex-count.js                       # 90 or lower
node scripts/gesture-test.mjs                   # edge Back, sheet drag, row swipe, long press, with real touch events at 390
node scripts/chrome-audit.mjs                   # the chrome mode of every admin state at 390: tab bar, top bar controls, nothing accumulates
node scripts/empty-audit.mjs                    # every list screen in its first time and no results states
npm run preship                                 # the gate in one command: layout-audit and scene-audit detached at 390 and 1280, then lint, hex, gesture, chrome, empty, docs-editor-audit, docs-flow-audit (preship:full: all five widths)
node scripts/css-orphans.mjs                    # 0
TZ=America/New_York node scripts/dates-test.mjs
node scripts/concepts-review-test.mjs            # Review each against the real handlers: answers, submit, locks, task, push, admin lock and reopen
node scripts/concepts-guard-proof.mjs            # each Review each guard cut out in turn, its check must fail
node scripts/concepts-lib-test.mjs               # the CRM side's pure logic: tally, review line, Log as a round note
node scripts/docs-test.mjs                      # client docs against the real handlers: admin only, the block schema, references on the client, edits, delete and restore, purge, caps, templates, the mirror (43 checks)
node scripts/docs-guard-proof.mjs               # each docs guard cut out in turn, its check must fail (15 guards)
node scripts/docs-edit-test.mjs                 # the editor's pure block operations: Enter, Backspace, markdown shortcuts, move, convert, numbering
node scripts/docs-save-test.mjs                 # autosave on a fake clock: the debounce, one request at a time, a failure keeps the text and retries, Back, the kept text
node scripts/docs-templates-test.mjs            # the templates: client fields fill, unknown fields stay placeholders, the contract's house rules from pricing.js, every template valid
node scripts/workspace-test.mjs                 # the workspace cards' logic: the Showcase count and state, the Concepts rows, the Docs card, the docs list helpers
AUDIT_BASE=http://127.0.0.1:4330 node scripts/docs-editor-audit.mjs   # the editor in a browser at 390 and 1280 (blocks, typing and autosave, marks, sheets, reorder, failure, print)
AUDIT_BASE=http://127.0.0.1:4330 node scripts/docs-flow-audit.mjs     # the Docs card, New doc and the templates, Make a task, All docs, search, History, Recently Deleted, Settings templates
node scripts/security-test.mjs                  # operator injection, javascript: URLs, script tags, the planner token, the login and form limiters, against the real handlers
node scripts/pipeline-test.mjs                  # a client stays a client: the stage guard, the import, the cron heal, the lead shape guard, declined records, the next action recompute, triage and nurture
node scripts/next-action-test.mjs               # the next action rules (src/lib/nextAction.js and its server mirror) in America/New_York
node scripts/lists-test.mjs                     # dial lists: the route whitelist, the Callbacks due system list rules, every outcome rule
node scripts/score-test.mjs                     # the lead score: every rule, the cap, the server mirror byte for byte, the cron and the backfill (scripts/backfill-triage.mjs)
node scripts/send-email-test.mjs                # the four emails: whitelist, payload shapes, 503 and 502, the stamps, the rate limit, hook URLs never leak
node scripts/tasks-test.mjs                     # the task rule (src/shared/taskRules.js and its api mirror byte for byte): pinned, due, ties, undated, templates, the checklist sanitizer on leads and projects, the retainer delivered count by kind
node scripts/share-test.mjs                     # Save to photos (src/lib/share.js) with navigator.share and canShare mocked: share, download, cancel, every fallback, the attachment link
node scripts/review-link-test.mjs; node scripts/review-guard-proof.mjs   # review links: the token, the public door's whitelist, validations and limits, the consent gate, the landing and showcase rules, the average rating; then each of the 23 guards cut out in turn, its check must fail
node scripts/portal-test.mjs; node scripts/portal-guard-proof.mjs       # the client portal against the real handlers: the token, the whitelist and the forbidden keys, module states, documents, the PIN limit and the sensitive gate, the 404s (68 checks); each guard cut in turn (28)
node scripts/portal-crm-test.mjs                 # the CRM side of the portal (src/lib/portal.js): the link, the patches, the message, the module rows, the status
node scripts/qr-test.mjs                        # the QR encoder decoded by jsqr down to 160px with and without the Aperture panel, module for module against qrcode
node scripts/analytics-test.mjs                 # the Analytics rules (src/lib/analytics.js and api/_lib/analytics.js byte for byte below ANALYTICS_RANGES) in both zones, and the route
node scripts/deals-test.mjs                     # the deal: every transition, every next action rule, stalledSince, the mark paid conversion and its undo, invoiceStatus across month ends, the mirrors, the handlers
node scripts/planner-endpoint-test.mjs; node scripts/showcase-endpoint-test.mjs; node scripts/concepts-endpoint-test.mjs   # the three public doors: exact whitelists, identical 404s, the limiters
SCENE_PATH=/concepts/cncpTESTtoken0123456789abcdEF SCENE_WIDTHS=320,390,430,768,1280 node scripts/scene-audit.mjs   # the concepts page: every section on screen is revealed whole, no piece animates alone, reduced motion shows all, the bar clears the last button (and SCENE_MOTION=reduce)
```

Optional: `AUDIT_ONLY=a11y node scripts/layout-audit.mjs` (zoom and text
spacing), `AUDIT_ONLY=mkt node scripts/a11y-audit.mjs` (marketing pages
only), `node scripts/render-profile.mjs`, `node scripts/lighthouse.mjs`
against `scripts/mock-server.mjs` (`LH_FORM=desktop` for the 1280 preset,
`MOCK_SHOWCASE_EMPTY=1` on the mock server for an empty-CRM run), `node
scripts/feel-audit.mjs --boot`.

## Shape of the repo

api/ (10 Vercel functions, under the Hobby plan's cap of 12: api/admin/login.js,
logout.js, and session.js stand alone; api/admin/index.js dispatches every
other admin endpoint on ?r=<name>, put there by one vercel.json rewrite per
URL, to api/_routes/<name>.js, one file per route's logic, each still wrapped
in route(); api/cron/[job].js dispatches both crons; api/showcase.js is the
public, published-clients-only endpoint the marketing site reads;
submissions.js and push-key.js are the other two public endpoints; _lib for
auth, config, mongo, handler, notify, stripe, orders), src/ui (the kit),
src/shell (AppShell, nav, command bar, drawer, boot frame, appearance,
ShellCrash), src/pages (one file per admin screen, lazy chunks; the
marketing pages are lazy too), src/components/record (the record: RecordHeader,
NextActionStrip, FactsGrid, one section component each, the registry of
sections by mode), src/components (lead and client record
pieces, and the marketing shell: Navbar, Footer, ThemeToggle, and
Home's own sections), src/marketing (showcase.jsx, motion/, scroll.js and
ScrollRoot.jsx (the gsap + lenis scroll engine, marketing host only),
links.js, useHead.js, useTheme.js, the public site's own layer), src/lib (pure logic), src/shared
(semantics, pricing, dates, api, copy, log), scripts/ (the audits, plus
prerender-clients.mjs and build-sitemap.mjs, chained into `npm run build`),
docs/, reports/.
