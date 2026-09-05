# VISUALIZE ADMIN, ARCHITECTURE (as of 3.0.0, Prompt 15, 2026-09-05)

The admin CRM at admin.visualizeclients.com and the marketing site at
visualizestudio.org share one Vite build. This file describes the app as it
is now. History lives in reports/PROMPT-NN-REPORT.md; operations live in
docs/RUNBOOK.md.

## Stack

| Layer | What it is |
|---|---|
| Framework | React 18, function components and hooks, no TypeScript |
| Build | Vite 6 with @vitejs/plugin-react; `__BUILD_SHA__` from VERCEL_GIT_COMMIT_SHA; the boot frame and the CSP hash are injected by two plugins in vite.config.js; one lazy chunk per admin screen and per marketing page (chunks under 20KB fold into their importer, so the entry carries the shell and the Dashboard), Leads and the Call Console prefetched after first paint, xlsx behind its own import; main.jsx starts the session check and the five list GETs with the entry on the admin host (`warm` in src/shared/api.js) |
| Routing | react-router-dom 6 for the marketing site; AdminApp switches sections on `location.pathname`; App.jsx branches on host first and loads only that host's chunks |
| Styling | CSS-in-JSX per file on `--v-` tokens (src/ui/tokens.js), one `uiStyles` string injected by the shell; src/index.css holds only marketing and maintenance rules; src/fonts.css declares the self hosted latin subsets in public/fonts (scripts/fetch-fonts.mjs) |
| State | useState and useMemo per screen; AdminApp lifts the shared lists (leads, submissions, projects, orders, packs) and passes optimistic patch helpers down |
| Data | apiFetch (src/shared/api.js) to same-origin /api/* Vercel functions with the X-Requested-With header, cookie auth; the service worker keeps the last successful GET of the five main lists for offline reading |
| Backend | Vercel serverless (ESM), MongoDB Atlas through the mongodb driver, one cached client per warm instance (api/_lib/mongo.js); every handler is wrapped by `route()` in api/_lib/handler.js (admin guard, method allow list, body cap, CSRF header, one try/catch). The Hobby plan's 12 function cap folds all 17 admin routes into one dynamic function (api/admin/[[...route]].js dispatching on req.query.route) and both crons into one more (api/cron/[job].js); the route logic itself lives in api/_routes/<name>.js, one file per endpoint, same as before |
| Auth | One admin password (scrypt hash in settings.auth, else ADMIN_PASSWORD, constant time compare), HMAC signed 30 day cookie with sliding renewal, login rate limited per IP (api/_lib/auth.js) |
| Push | web-push with VAPID keys; public/sw.js handles push, deep links, and the versioned offline caches (shell, fonts, icons, the last list GETs) |
| Crons | Vercel cron: /api/cron/reminders once a day (13:00 UTC, a morning digest; the Hobby plan only allows a daily schedule), /api/cron/daily at 06:00 UTC, both behind CRON_SECRET, both served by one function (api/cron/[job].js) |
| Integrations | Calendly (read), Stripe (read plus a signed webhook with a claim before side effects), Web3Forms (email backup) |
| Errors | ErrorBoundary per screen region (PageShell) and per section (AdminApp), ShellCrash at the top; client errors, rejections, refused writes, and 500s post to /api/admin/log (settings `client-log`, 500 entries); Settings, Automation shows the last 20 |
| Headers | vercel.json: nosniff, DENY framing, Referrer-Policy, Permissions-Policy everywhere; Content-Security-Policy and no-store on the admin host; immutable caching for /assets and /fonts |

## Directory map

```
api/                       Vercel functions (5 total: the Hobby plan caps a deployment at 12)
  _lib/                    auth, handler (route wrapper), mongo, notify (push + email), orders (shop order parser), stripe
  _semantics.js            id lists mirrored from src/shared/semantics.js (functions cannot import src/)
  _routes/                 one file per endpoint's logic (call-leads.js, settings.js, log.js, the two cron jobs, etc.), a plain
                           exported `handler(req, res)`; not deployed as routes itself (Vercel excludes underscore-prefixed
                           paths under api/), dispatched into by the two files below
  admin/[[...route]].js    every /api/admin/* endpoint (17 routes) in one function; req.query.route picks the _routes/ file,
                           each still wrapped in route() with its own method list, admin guard, CSRF, and body cap
  cron/[job].js            both Vercel crons in one function; req.query.job is 'reminders' or 'daily', URLs unchanged
  stripe/webhook.js        signed Stripe webhook (its own file: needs the raw body and its own config)
  submissions.js, push-key.js   public endpoints (their own files)
docs/                      this file, COMPONENTS.md, TOKENS.md, RUNBOOK.md, QA-CHECKLIST.md, RELEASE-NOTES-3.0.md, MIGRATION-MAP.md
public/                    logo, wordmark, PWA icons, manifest, sw.js, fonts/ (latin woff2 subsets)
reports/                   one build report per prompt
scripts/                   layout-audit, feel-audit, a11y-audit, regression, render-profile, lighthouse, mock-server, audit-fixtures, audit-screens, fetch-fonts, hex-count, css-orphans, dates-test, migrate-mongo
src/
  ui/                      the component kit (index.js exports everything and uiStyles); ErrorBoundary, motion, RecordSkeleton, useOnline
  shell/                   AppShell, Sidebar, TopBar, TabBar, MoreSheet, CommandBar, NotificationsDrawer, BootFrame and bootFrame.js, appearance.js, ShellCrash, nav.js, notifications.js, shortcuts.js, install.js, storage.js, search.js
  pages/                   one file per admin screen (each a lazy chunk) plus the marketing pages (lazy too)
  components/              shared lead and client components, LeadPicker, imports
  lib/                     pure logic: leads, calls, defaultLead, booked, projects, orders, reviews, events, exports, ics, socials, spreadsheet
  shared/                  semantics (enums), pricing (catalog), dates, phone, format, api (apiFetch with the CSRF header), copy (every empty and error string), log (the client error log), color
  data/                    the showcase client data for the marketing site, a bundled lead import
```

## Screens (all inside AdminApp, served on the admin host at root paths)

| Path | Screen | File |
|---|---|---|
| / | Dashboard: greeting, funnel, stats, Today panel, revenue, activity | pages/AdminDashboard.jsx |
| /leads | Leads: kanban and table, filters, bulk, duplicates, LeadDetail | pages/AdminLeads.jsx |
| /calls | Call Console: session builder, queue, call room, outcomes, summary | pages/AdminCalls.jsx |
| /booked | Booked workspace: meeting prep on LeadDetail | pages/AdminBooked.jsx |
| /calendar | Calendar: day, week, month over meetings, callbacks, Calendly, bills | pages/AdminCalendar.jsx |
| /clients | Clients: list, LeadDetail in client mode (projects, payments, retainer, deliverables) | pages/AdminClients.jsx, components/ClientWorkspace.jsx |
| /orders | Print Orders | pages/AdminOrders.jsx |
| /concepts | Concepts library | pages/AdminConcepts.jsx |
| /reviews | Reviews | pages/AdminReviews.jsx |
| /submissions | Submissions | pages/AdminSubmissions.jsx |
| /settings | Settings (Profile, Notifications, Integrations, Data, Automation, Shortcuts, Danger zone); /settings/deleted opens Data | pages/AdminSettings.jsx |
| /design | Design system reference | pages/AdminDesign.jsx |

Navigation is one list in src/shell/nav.js. Redirects: /prints and /admin/prints on the admin host go to /orders; /portal and /intake/* on the public host go to /contact?from=portal (the retired portal notice). The public site keeps /, /services, /work, /work/:slug, /contact, /book, /lead-partner, /start, /prints (the shop), and the maintenance screen when VITE_MAINTENANCE_MODE is true.

## Components

The kit (src/ui) is documented in docs/COMPONENTS.md. Shared record components: LeadCard, LeadDetail (lead, booked, and client modes), LeadForm, LeadHistory, LeadNotes, LeadPlaybook, Checklists, LinkedSubmissions, SocialLinks (SocialFields), CallbackPicker, LeadImport, OrdersImport, LeadPicker, ClientCard, ClientWorkspace. Marketing components stay under src/components as well (Navbar, Footer, Hero, Services, Process, Trust, Testimonials, CTA, ShowcasePreview, Wordmark, ThemeToggle).

## Endpoints

Every admin endpoint follows GET, POST, PATCH { id, set } with a sanitize() whitelist and `$set` only; nothing is renamed or dropped.

| Route | Methods | Callers |
|---|---|---|
| /api/admin/call-leads | GET (?deleted=1), POST (single or leads[]), PATCH ({id,set}, restore), DELETE (?id, ?ids, ?purgeDeleted=1) | AdminApp, AdminCalls, AdminLeads, AdminSettings, useOptimisticPatch |
| /api/admin/leads/import | POST rows[] | LeadImport |
| /api/admin/submissions | GET (?id, ?deleted=1, filters), PATCH (status, read, notes, socials, linkedLeadId, restore), DELETE (?ids) | AdminApp, AdminSettings |
| /api/admin/projects | GET (?leadId, ?archived=1), POST, PATCH | AdminApp |
| /api/admin/orders | GET (?status, returns unimported), POST (order or action import-submissions), PATCH | AdminApp |
| /api/admin/concept-packs | GET (?leadId, ?industryKey, ?kind; seeds one pack when empty), POST, PATCH | AdminApp |
| /api/admin/settings | GET (prefs, dashboard, notifications, profile, health, stripe, cron, calendly), PATCH (dailyCallTarget, dashboardLayout, notifications, profile), POST (password, prefs, test-push, purge) | AppShell, AdminDashboard, AdminSettings |
| /api/admin/calendly/events | GET ?from&to (5 minute cache) | AppShell |
| /api/admin/stripe/events | GET ?days or ?stored=1&unmatched=1 | AdminSettings |
| /api/admin/stripe/reconcile | POST { eventId, leadId } | AdminSettings |
| /api/admin/backup | GET, a JSON download | AdminSettings |
| /api/admin/export | GET ?type=submissions&format=csv or json | AdminSettings |
| /api/admin/push-subscribe | POST subscription (upsert by endpoint) | AdminSettings |
| /api/admin/login, logout, session | POST (rate limited), POST, GET (renews the cookie) | AdminApp, AdminCalls |
| /api/admin/log | GET ?limit, POST { kind, message, stack, url, at }, DELETE | src/shared/log.js, AdminSettings |
| /api/push-key | GET | AdminSettings |
| /api/submissions | POST (public: start, contact, review, shop-order; shop orders also create an orders document) | Start.jsx, Prints.jsx |
| /api/stripe/webhook | POST (Stripe signature) | Stripe |
| /api/cron/reminders (once a day, morning digest), /api/cron/daily | GET (CRON_SECRET) | Vercel cron |

## Collections and sanitize shapes

- call_leads: the lead, booked, and client record. Core fields business, industry, descriptor, phone, phoneNote, email, area, askFor, bestWindow, priority, callStatus, stage, angle, beforeYouDial[], script{}, objections[], close{}, afterCall{}, intel{}, socials{}, callLog[], contactLog[], notes, prepNotes, checklists[], meeting{date,time,type,location}, callbackAt, calendlyEventUri, concepts[]{id,label,status,link,packId}, gamePlan[], servicesPlanned[], pricingOptions[], conceptsTracker, purchases[]{id,label,amount,at,notes,projectId,source,stripeEventId}, bookedOutcome, clientSince, clientStatus, links{website,drive,clickup,instagram}, brand{primary,colors[],fontDisplay,fontBody,logoLink,notes}, retainer{projectId,planId,amount,status,startedAt,billDay,nextBillAt,cancelAt,stripeSubscriptionId,stripeCancelledAt}, reviews{nfcCard,nfcGivenAt,googleLink,baseline,latest,asks[]}, enrichment (written by the nightly job), sourceId, mergedInto, deleted, deletedAt, createdAt, updatedAt. Whitelist: api/_routes/call-leads.js sanitize().
- submissions: type, projectType, name, business, email, phone, fields{}, status, read, notes, socials, linkedLeadId, deleted, deletedAt, createdAt.
- projects: leadId, name, kind, packageId, custom, stage, stages[], total, schedule[]{id,amount,dueAt,status,ledgerId,label,paidAt,extra}, revisions{max,used,log[]}, plan{months,monthly,stripeCancelled,stripeSubscriptionId,stripeCancelledAt}, links{drive,clickup}, deliverables[], delivery{}, releasedAt, monthly[], retainer{planId,billDay,startedAt}, archived, createdAt, updatedAt.
- orders: source, status, leadId, projectId, submissionId, customer{name,email,phone}, items[]{id,productId,name,label,qty,options,artworkLink,priceTotal,quote}, subtotal, rush, dueAt, notes, paid{at,ledgerId,amount}, packaging{}, importKey, archived, createdAt, updatedAt.
- concept_packs: title, leadId, industryKey, kind, prompts[]{id,label,text}, images[]{id,label,link}, tags[], notes, usedFor[], lastUsedAt, archived, createdAt, updatedAt.
- stripe_events: id (unique), type, amount, currency, customerEmail, customerName, customerPhone, description, subscriptionId, paymentLinkId, at, matchedLeadId, ledgerId, raw (trimmed), receivedAt, reconciledAt.
- settings documents by _id: prefs {pushEnabled, emailEnabled}, auth {salt, hash, changedAt}, dashboard {dailyCallTarget, dashboardLayout}, notifications {readIds, lastSeenAt, snoozedUntil, sentReminderKeys, reminders{meetings,callbacks,bills,reviews}}, profile {name, businessHours{start,end}, theme, reduceMotion}, health {enrichment, scraper, crons, stripe, lastBackupAt}, login-limit {hits{ip: [timestamps]}}, client-log {items[]{kind,message,stack,url,at,ua,receivedAt}, capped at 500}.
- stripe_events also carries processedAt (Prompt 15): the row is inserted as a claim before the ledger write.
- push_subscriptions: one document per browser subscription (endpoint unique).

Enums live in src/shared/semantics.js with id lists mirrored in api/_semantics.js: CALL_STATUSES, PRIORITIES, STAGES, LEAD_STATUSES (submission statuses; the old ORDER_STATUS_IDS stay only in the server whitelist for old shop-order submissions), CONTACT_TYPES, MEETING_TYPES, PLANS, CONCEPT_STATUSES, PROJECT_KINDS, PROJECT_STAGES, SCHEDULE_STATUSES, RETAINER_STATUSES, CLIENT_STATUSES, PRINT_ORDER_STATUSES, ORDER_SOURCES, CONCEPT_KINDS, REVIEW_CHANNELS, REVIEW_RESULTS, SUBMISSION_TYPES, WINDOWS.

## Environment variables

See docs/RUNBOOK.md for what each unlocks and what breaks without it: MONGODB_URI, SESSION_SECRET, ADMIN_PASSWORD, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, WEB3FORMS_NOTIFY_KEY, CALENDLY_TOKEN (or CALENDLY_PAT), CRON_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ADMIN_URL, VITE_MAINTENANCE_MODE, VITE_MAINTENANCE_PASSWORD, VITE_WEB3FORMS_KEY.

## Crons and jobs

- reminders (every 15 minutes): callbacks due within 15 minutes, meetings within the hour, retainer bills due today, review asks three days after a release; once each through sentReminderKeys; stamps health.crons.reminders.
- daily (06:00 UTC): rolls retainer.nextBillAt, extends retainer schedules to six future months, cancels retainers past their notice, writes the health document.
- Outside this repo: the nightly enrichment scan and the scraper write straight into call_leads (enrichment{lastScanAt, scanCount}, sourceId); health reports when either is quiet for 36 hours.

## Browser storage

localStorage (admin, per device): vz_theme, vz_motion, vz_boot, vz_call_session, vz_builder_preset, vz_leads_view, vz_cal_view, vz_shell_collapsed, vz_notif_read, vz_cmd_recent, vz_callmode_<id>, vz_clients_cols, vz_orders_cols, vz_subs_cols, vz_leads_cols, vz_dash_today (the Today card's last row count, for its skeleton). Legacy keys that are read once by Settings Data (Import print orders saved on this device) and otherwise untouched: vz_print_orders. Keys nobody reads any more and nothing writes: vz_clients, vz_invoices, vz_intake_forms, vz_analytics, vz_maintenance_preview, vz_portal_session. sessionStorage: vz_cart (the public shop's cart, survives a refresh only).

## Scripts

All in docs/RUNBOOK.md with their flags. The walking audits (layout, feel,
a11y, regression, render-profile) share scripts/audit-fixtures.mjs (the
hostile data and the route mocks) and scripts/audit-screens.mjs (the screen
and state table); Lighthouse runs against scripts/mock-server.mjs over real
HTTP. hex-count, css-orphans, and dates-test are the static checks.

## Known issues

- Sign out everywhere is not available: sessions carry no generation number (RUNBOOK covers rotating SESSION_SECRET).
- The Call Console keeps its own copy of the leads list and pings the shell on changes; two tabs can briefly disagree.
- Reads keep the last list and show an ErrorState with Retry when a fetch fails; writes roll back and toast.
- Offline writes are refused, not queued (Prompt 14 decision); the service worker serves the last GET of each list for reading.
- The marketing site still carries raw hex in its own pages and index.css; the hex count script tracks the total (145 at 3.0.0).
