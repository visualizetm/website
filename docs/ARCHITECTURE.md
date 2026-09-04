# VISUALIZE ADMIN, ARCHITECTURE (as of Prompt 13, 2026-09-04)

The admin CRM at admin.visualizeclients.com and the marketing site at
visualizestudio.org share one Vite build. This file describes the app as it
is now. History lives in reports/PROMPT-NN-REPORT.md; operations live in
docs/RUNBOOK.md.

## Stack

| Layer | What it is |
|---|---|
| Framework | React 18, function components and hooks, no TypeScript |
| Build | Vite 6 with @vitejs/plugin-react; `__BUILD_SHA__` from VERCEL_GIT_COMMIT_SHA |
| Routing | react-router-dom 6 for the marketing site; AdminApp switches sections on `location.pathname`; App.jsx branches on host first |
| Styling | CSS-in-JSX per file on `--v-` tokens (src/ui/tokens.js), one `uiStyles` string injected by the shell; src/index.css holds only marketing and maintenance rules plus the font loads |
| State | useState and useMemo per screen; AdminApp lifts the shared lists (leads, submissions, projects, orders, packs) and passes optimistic patch helpers down |
| Data | fetch to same-origin /api/* Vercel functions, cookie auth, no client cache layer |
| Backend | Vercel serverless (ESM), MongoDB Atlas through the mongodb driver, one cached client per warm instance (api/_lib/mongo.js) |
| Auth | One admin password (scrypt hash in settings.auth, else ADMIN_PASSWORD), HMAC signed 30 day cookie (api/_lib/auth.js) |
| Push | web-push with VAPID keys; public/sw.js handles push and deep links |
| Crons | Vercel cron: /api/cron/reminders every 15 minutes, /api/cron/daily at 06:00 UTC, both behind CRON_SECRET |
| Integrations | Calendly (read), Stripe (read plus a signed webhook), Web3Forms (email backup) |

## Directory map

```
api/                       Vercel functions
  _lib/                    auth, mongo, notify (push + email), orders (shop order parser), stripe
  _semantics.js            id lists mirrored from src/shared/semantics.js (functions cannot import src/)
  admin/                   admin guarded endpoints (requireAdmin on every handler)
  cron/                    reminders.js, daily.js
  stripe/webhook.js        signed Stripe webhook
  submissions.js, push-key.js   public endpoints
docs/                      this file, COMPONENTS.md, TOKENS.md, RUNBOOK.md, MIGRATION-MAP.md
public/                    logo, wordmark, PWA icons, manifest, sw.js
reports/                   one build report per prompt
scripts/                   layout-audit.mjs, hex-count.js, css-orphans.mjs, dates-test.mjs, migrate-mongo.mjs
src/
  ui/                      the component kit (index.js exports everything and uiStyles)
  shell/                   AppShell, Sidebar, TopBar, TabBar, MoreSheet, CommandBar, NotificationsDrawer, nav.js, notifications.js, shortcuts.js, install.js, storage.js, search.js
  pages/                   one file per admin screen plus the marketing pages
  components/              shared lead and client components, LeadPicker, imports
  lib/                     pure logic: leads, calls, booked, projects, orders, reviews, events, exports, ics, socials, spreadsheet
  shared/                  semantics (enums), pricing (catalog), dates, phone, format, api, color
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
| /api/admin/login, logout, session | POST, POST, GET | AdminApp, AdminCalls |
| /api/push-key | GET | AdminSettings |
| /api/submissions | POST (public: start, contact, review, shop-order; shop orders also create an orders document) | Start.jsx, Prints.jsx |
| /api/stripe/webhook | POST (Stripe signature) | Stripe |
| /api/cron/reminders, /api/cron/daily | GET (CRON_SECRET) | Vercel cron |

## Collections and sanitize shapes

- call_leads: the lead, booked, and client record. Core fields business, industry, descriptor, phone, phoneNote, email, area, askFor, bestWindow, priority, callStatus, stage, angle, beforeYouDial[], script{}, objections[], close{}, afterCall{}, intel{}, socials{}, callLog[], contactLog[], notes, prepNotes, checklists[], meeting{date,time,type,location}, callbackAt, calendlyEventUri, concepts[]{id,label,status,link,packId}, gamePlan[], servicesPlanned[], pricingOptions[], conceptsTracker, purchases[]{id,label,amount,at,notes,projectId,source,stripeEventId}, bookedOutcome, clientSince, clientStatus, links{website,drive,clickup,instagram}, brand{primary,colors[],fontDisplay,fontBody,logoLink,notes}, retainer{projectId,planId,amount,status,startedAt,billDay,nextBillAt,cancelAt,stripeSubscriptionId,stripeCancelledAt}, reviews{nfcCard,nfcGivenAt,googleLink,baseline,latest,asks[]}, enrichment (written by the nightly job), sourceId, mergedInto, deleted, deletedAt, createdAt, updatedAt. Whitelist: api/admin/call-leads.js sanitize().
- submissions: type, projectType, name, business, email, phone, fields{}, status, read, notes, socials, linkedLeadId, deleted, deletedAt, createdAt.
- projects: leadId, name, kind, packageId, custom, stage, stages[], total, schedule[]{id,amount,dueAt,status,ledgerId,label,paidAt,extra}, revisions{max,used,log[]}, plan{months,monthly,stripeCancelled,stripeSubscriptionId,stripeCancelledAt}, links{drive,clickup}, deliverables[], delivery{}, releasedAt, monthly[], retainer{planId,billDay,startedAt}, archived, createdAt, updatedAt.
- orders: source, status, leadId, projectId, submissionId, customer{name,email,phone}, items[]{id,productId,name,label,qty,options,artworkLink,priceTotal,quote}, subtotal, rush, dueAt, notes, paid{at,ledgerId,amount}, packaging{}, importKey, archived, createdAt, updatedAt.
- concept_packs: title, leadId, industryKey, kind, prompts[]{id,label,text}, images[]{id,label,link}, tags[], notes, usedFor[], lastUsedAt, archived, createdAt, updatedAt.
- stripe_events: id (unique), type, amount, currency, customerEmail, customerName, customerPhone, description, subscriptionId, paymentLinkId, at, matchedLeadId, ledgerId, raw (trimmed), receivedAt, reconciledAt.
- settings documents by _id: prefs {pushEnabled, emailEnabled}, auth {salt, hash, changedAt}, dashboard {dailyCallTarget, dashboardLayout}, notifications {readIds, lastSeenAt, snoozedUntil, sentReminderKeys, reminders{meetings,callbacks,bills,reviews}}, profile {name, businessHours{start,end}}, health {enrichment, scraper, crons, stripe, lastBackupAt}.
- push_subscriptions: one document per browser subscription (endpoint unique).

Enums live in src/shared/semantics.js with id lists mirrored in api/_semantics.js: CALL_STATUSES, PRIORITIES, STAGES, LEAD_STATUSES (submission statuses; the old ORDER_STATUS_IDS stay only in the server whitelist for old shop-order submissions), CONTACT_TYPES, MEETING_TYPES, PLANS, CONCEPT_STATUSES, PROJECT_KINDS, PROJECT_STAGES, SCHEDULE_STATUSES, RETAINER_STATUSES, CLIENT_STATUSES, PRINT_ORDER_STATUSES, ORDER_SOURCES, CONCEPT_KINDS, REVIEW_CHANNELS, REVIEW_RESULTS, SUBMISSION_TYPES, WINDOWS.

## Environment variables

See docs/RUNBOOK.md for what each unlocks and what breaks without it: MONGODB_URI, SESSION_SECRET, ADMIN_PASSWORD, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, WEB3FORMS_NOTIFY_KEY, CALENDLY_TOKEN (or CALENDLY_PAT), CRON_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ADMIN_URL, VITE_MAINTENANCE_MODE, VITE_MAINTENANCE_PASSWORD, VITE_WEB3FORMS_KEY.

## Crons and jobs

- reminders (every 15 minutes): callbacks due within 15 minutes, meetings within the hour, retainer bills due today, review asks three days after a release; once each through sentReminderKeys; stamps health.crons.reminders.
- daily (06:00 UTC): rolls retainer.nextBillAt, extends retainer schedules to six future months, cancels retainers past their notice, writes the health document.
- Outside this repo: the nightly enrichment scan and the scraper write straight into call_leads (enrichment{lastScanAt, scanCount}, sourceId); health reports when either is quiet for 36 hours.

## Browser storage

localStorage (admin, per device): vz_theme, vz_call_session, vz_builder_preset, vz_leads_view, vz_cal_view, vz_shell_collapsed, vz_notif_read, vz_callmode_<id>, vz_clients_cols, vz_orders_cols, vz_subs_cols. Legacy keys that are read once by Settings Data (Import print orders saved on this device) and otherwise untouched: vz_print_orders. Keys nobody reads any more and nothing writes: vz_clients, vz_invoices, vz_intake_forms, vz_analytics, vz_maintenance_preview, vz_portal_session. sessionStorage: vz_cart (the public shop's cart, survives a refresh only).

## Scripts

- `node scripts/layout-audit.mjs`: Playwright walk of every admin route at 320, 390, 430, 768, 1280 with mocked APIs; fails on any element past the viewport or a horizontal scroll. AUDIT_BASE, AUDIT_WIDTHS, AUDIT_ONLY (settings, clients, studio), AUDIT_SHOTS.
- `node scripts/hex-count.js`: raw hex literals in src and api (should only go down).
- `node scripts/css-orphans.mjs`: class selectors defined in style strings or index.css that no JSX renders.
- `TZ=America/New_York node scripts/dates-test.mjs`: date parsing cases across formats and DST.
- `node scripts/migrate-mongo.mjs`: one off copy of the database between clusters (env driven).

## Known issues

- Sign out everywhere is not available: sessions carry no generation number (RUNBOOK covers rotating SESSION_SECRET).
- The Call Console keeps its own copy of the leads list and pings the shell on changes; two tabs can briefly disagree.
- Reads swallow fetch errors and keep the last list; writes surface errors through toasts.
- The light theme is a stub on `.lay-root[data-v-theme='light']` in src/ui/tokens.js and is wired to nothing (Prompt 14).
- The marketing site still carries raw hex in its own pages and index.css; the hex count script tracks the total.
