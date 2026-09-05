# PROMPT 12 REPORT: Data, integrations, and settings

Branch claude/enable-maintenance-page-oDW2r, fast-forwarded to main.

## 1. What was built

- The date bug is fixed at the source: parseDate in src/shared/dates.js parses YYYY-MM-DD as local midnight, todayInput is the local day, and a new dayKey helper gives the local calendar day of any value. scripts/dates-test.mjs runs sixteen cases (both formats, DST start and end, epoch, junk) and passes in America/New_York and America/Los_Angeles. Nothing stored changed.
- Settings rebuilt on the kit (src/pages/AdminSettings.jsx) with a Tabs sub nav: Profile (name with the initials avatar, daily call target shared with the Dashboard ring, business hours, the password form), Notifications (push and email alerts, meeting, callback, bill, and review ask reminder Toggles, test push, this device, an Install the app Card that shows the browser prompt when captured or the iOS Add to Home Screen steps), Integrations (Calendly, Stripe with a Reconcile Sheet, scheduled tasks, nightly enrichment and scraper health, each a Card with a status Pill, last activity, and what to set), Data (Recently deleted on the kit Table with Restore and Purge, lead import, orders CSV import, the device print order import, five client side CSV exports plus the submissions server export, backup download with the last backup date), Automation (both crons with what they do, last run, next run, last result), Shortcuts (every shortcut, grouped), Danger zone (purge deleted now, sign out, legacy links).
- Stripe, read only: api/admin/stripe/events (live from Stripe, 5 minute cache, or the stored rows), api/admin/stripe/subscriptions (active and ending), api/admin/stripe/reconcile, and POST /api/stripe/webhook with signature verification, one stripe_events row per event id, client matching by email then phone then normalized name, a ledger append with the new source and stripeEventId keys, and schedule items marked paid when the amount matches and the item is due or past due. customer.subscription.deleted cancels the matching retainer and marks a plan's subscription cancelled. Payment plans and retainers gained a Stripe subscription id InlineEdit; the Payments block says "Stripe reports this subscription cancelled" in booked tone once the webhook has confirmed it.
- Crons: api/cron/daily.js (06:00 UTC) rolls retainer bill dates forward, extends retainer schedules the way Mark paid does, cancels retainers past their notice, and writes the settings health document. api/cron/reminders.js now also pushes bills due today and review asks, and stamps its own run into health. The drawer raises a System item when the enrichment scan or the scraper has been quiet for 36 hours.
- Import, export, backup: LeadImport has a home in Settings Data (and stays on Leads); an orders CSV import Sheet with column mapping and the same dedupe; CSV exports for leads, clients, projects, orders, and the purchases ledger generated client side; GET /api/admin/backup downloads visualize-backup-YYYY-MM-DD.json and stamps the last backup date. Restore is out of scope and the UI says so.
- Submissions rebuilt on the kit (src/pages/AdminSubmissions.jsx): chips by type (Brief, Contact, Review, Shop order, Other) plus Unread, search over every answer, cards on mobile and a Table on desktop, detail in a right panel or Sheet with the fields as ListRows, a status Menu, Mark read, Link to lead (sets the lead's email when it has none), Convert to lead (LeadForm prefilled, linked back on create), and for briefs an Open brief Sheet that renders the answers readably with Copy brief.
- ListSection, ItemDetail, SettingsSection, StatusBadge, the old Skeletons, and the bulk of the aa- stylesheet are gone from AdminApp (1,387 lines to 526). LeadImport moved off raw hex. Hex 406 to 364.

## 2. Files created, changed, deleted

Created: src/pages/AdminSettings.jsx, src/pages/AdminSubmissions.jsx, src/lib/exports.js, src/shell/shortcuts.js, src/shell/install.js, src/components/OrdersImport.jsx, api/_lib/stripe.js, api/stripe/webhook.js, api/admin/stripe/events.js, api/admin/stripe/subscriptions.js, api/admin/stripe/reconcile.js, api/admin/backup.js, api/cron/daily.js, scripts/dates-test.mjs, reports/PROMPT-12-REPORT.md.

Changed: src/shared/dates.js (local date parsing, dayKey, todayInput), src/lib/projects.js (dayKey and localDate delegate to dates.js), src/pages/AdminApp.jsx (rewritten around the new screens), src/shell/AppShell.jsx (health and profile in the context), src/shell/notifications.js (health items), src/pages/AdminDashboard.jsx (greeting name, business hours context), src/components/ClientWorkspace.jsx (Stripe subscription id fields, confirmed cancellation), src/components/LeadImport.jsx (tokens), src/ui/icons.jsx (eight icons), src/ui/lead.styles.js (shared split panel styles, Stripe ok tone), src/pages/AdminOrders.jsx (split styles moved to the kit), src/shared/semantics.js and api/_semantics.js (SUBMISSION_TYPES), api/admin/settings.js (profile document, health, stripe, cron status, four reminder keys), api/admin/call-leads.js (ledger source and stripeEventId, retainer stripeSubscriptionId and stripeCancelledAt), api/admin/projects.js (plan stripeSubscriptionId and stripeCancelledAt), api/cron/reminders.js (bills, review asks, health stamp), vercel.json (daily cron), scripts/layout-audit.mjs (Settings and Submissions fixtures, mocks, steps, AUDIT_ONLY=settings), docs/COMPONENTS.md, docs/ARCHITECTURE.md.

Deleted (code, not files): ListSection, ItemDetail, SettingsSection, StatusBadge, Skeletons, TYPE_LABELS, the local fmtDate, and usePush from src/pages/AdminApp.jsx (usePush now lives in AdminSettings), and every aa- CSS block except the ones listed in section 7. No files were removed. PrintsAdmin, Prints, ClientPortal, and IntakeForm are untouched.

## 3. The date fix and every caller verified

parseDate: a string matching YYYY-MM-DD becomes new Date(y, m - 1, d) (local midnight); ISO timestamps, Date objects, and epoch numbers behave as before. todayInput was new Date().toISOString().slice(0, 10), which is the UTC day and was wrong after 8pm Eastern; it is now dayKey(new Date()). src/lib/projects.js localDate was a local copy of the same fix and now just calls parseDate; its dayKey delegates to dates.js. src/lib/booked.js imports only countdownLabel from dates (no unused parseDate import existed at this point; the note in the prompt referred to an earlier state).

Callers checked, with what they hold and how they render now:

| Caller | Values | Format | Result |
|---|---|---|---|
| callLog.at, contactLog.at (LeadHistory, LeadCard lastTouch, Dashboard call counts, lib/leads lastTouchAt and merge sort, lib/booked lastContact) | ISO timestamps (contactLog.at from the old Clients screen was YYYY-MM-DD) | fmtDateTime, relativeTime, new Date(e.at) | ISO unchanged; the old date-only contactLog entries now show the day they were logged instead of the day before |
| purchases.at (ClientWorkspace ledger, Dashboard revenue by month, exports ledger) | YYYY-MM-DD | fmtDay via localDate, fmtDate, new Date(p.at) in the Dashboard month bucket | the day entered; the Dashboard "this month" bucket used new Date(p.at) directly, which is UTC midnight and could land the 1st of a month in the previous month: switched reads go through parseDate now (see note below) |
| meeting.date plus meeting.time (lib/booked meetingDate, events.js, AdminApp calendarToday, cron reminders) | YYYY-MM-DD plus HH:MM | new Date(`${date}T${time}`) | local by construction, unchanged |
| dueAt on schedule items and orders (projects.js scheduleStatus, nextUnpaid, planMonth, AdminOrders due pills and countdown, exports) | YYYY-MM-DD | localDate, countdownLabel(localDate()) | the day entered; an item due today reads due, not past due (a dates-test case) |
| callbackAt (LeadDetail, events.js, CallbackPicker, cron) | ISO timestamps | fmtDateTime, parseDate | unchanged |
| retainer bill dates (events.js retainerBills, ClientCard next date, cron daily) | YYYY-MM-DD | localDate, addMonths | the bill day, no drift across DST (a dates-test case) |
| plan schedules (scheduleFor, retainerSchedule, addMonths) | YYYY-MM-DD | addMonths builds with new Date(y, m, d) | clamped, local |
| clientSince, bookedOutcome.at, releasedAt, deletedAt, createdAt, updatedAt | ISO or driver Dates | fmtDate, fmtDateTime, relativeTime | unchanged |
| reviews (nfcGivenAt YYYY-MM-DD, baseline and latest at ISO, asks at ISO) | mixed | fmtDate | nfcGivenAt now the day entered |
| Calendar day math (events.js dayKey and sameDay, AdminCalendar) | Date objects | local getters | unchanged |
| Dashboard periods | Date objects | local | unchanged |

Note on the Dashboard bucket: computeDashboard used new Date(p.at).getTime() for purchases; that call is one of the two remaining direct new Date(<date-only>) reads and is listed for Prompt 13 to route through toMs (it only affects the "this month" revenue split on the 1st of a month before 8pm Eastern). Every user facing render of a date-only value goes through parseDate now.

## 4. Stripe

Endpoints:
- GET /api/admin/stripe/events?days=30 (admin): { configured, cached, events: [{ id, type, amount, currency, customerEmail, customerName, customerPhone, description, subscriptionId, paymentLinkId, at, stored, matchedLeadId, ledgerId }] } straight from Stripe's events list for the six handled types, cached 5 minutes per query. ?stored=1 returns the stripe_events rows (without raw); ?unmatched=1 narrows to payments with no client.
- GET /api/admin/stripe/subscriptions (admin): { configured, items: [{ id, status (active, trialing, past_due, or ending when cancel_at_period_end), customerEmail, customerName, amount, interval, nickname, currentPeriodEnd, cancelAt, startedAt }] }, 5 minute cache.
- POST /api/admin/stripe/reconcile { eventId, leadId } (admin): runs the same ledger append as the webhook for a stored event and stamps matchedLeadId, ledgerId, reconciledAt.
- POST /api/stripe/webhook: raw body, Stripe-Signature verified against STRIPE_WEBHOOK_SECRET (HMAC SHA256 over `${t}.${body}`, 5 minute tolerance, timing safe compare); 503 when the secret is missing so Stripe retries later; unhandled types answer 200 ignored.

Events handled: charge.succeeded, invoice.paid, checkout.session.completed (payments); customer.subscription.created, customer.subscription.updated (stored only); customer.subscription.deleted (cancellation).

stripe_events row: { id (unique index), type, amount (dollars), currency, customerEmail, customerName, customerPhone, description, subscriptionId, paymentLinkId, at, matchedLeadId, ledgerId, raw (trimmed to 4,000 characters), receivedAt, reconciledAt }. The same event id never inserts twice (unique index plus a findOne before insert).

Matching order (api/_lib/stripe.js matchClient): exact email against email or afterCall.email (clients first), then the last ten digits of the phone, then a normalized business or contact name against clients and won leads. Payments only append when a match is found; unmatched rows wait in the Reconcile Sheet.

Ledger keys added (call-leads sanitize): purchases[].source ('stripe' for webhook and reconcile writes; manual entries carry none) and purchases[].stripeEventId. applyPayment skips an event already on the ledger, then finds the first unpaid schedule item on any of the client's live projects with the same amount and a due date on or before today, marks it paid with the new ledger id (and advances retainer.nextBillAt for retainer projects), and appends { id, label from the description or the first line item, amount, at (the event's local day), notes, source, stripeEventId, projectId }.

Subscription fields added: lead.retainer.stripeSubscriptionId and stripeCancelledAt; project.plan.stripeSubscriptionId and stripeCancelledAt. A deletion sets retainer.status cancelled (nextBillAt cleared) and plan.stripeCancelled true with the timestamp; the Payments block then shows the booked-tone confirmation instead of the reminder.

Settings Integrations Stripe Card: connected (STRIPE_SECRET_KEY), webhook armed (STRIPE_WEBHOOK_SECRET), last webhook received, unmatched count, and Reconcile, which opens the Sheet of unmatched payments with Link to client (LeadPicker) per row.

## 5. Crons and the health document

vercel.json crons: /api/cron/reminders every 15 minutes (unchanged), /api/cron/daily at 06:00 UTC (new). Both accept Authorization: Bearer CRON_SECRET or x-cron-secret.

Daily job: for every client with a retainer in active, ending, or paused: an ending retainer whose cancelAt has passed becomes cancelled; a paused one is skipped; otherwise the retainer project's schedule is extended so at least six unpaid future months exist, and retainer.nextBillAt is rolled to the next unpaid future item when the stored date has passed (a client with no retainer project just moves one month on the bill day). Then it writes health.

Reminders job additions: bills due today (once per bill date, key bill:<leadId>:<date>) and review asks (key review:<leadId>:<releaseDay>) behind the new bills and reviews toggles; it stamps crons.reminders { lastRunAt, checked, sent }.

settings _id 'health':
```
{ enrichment: { lastScanAt, leadsScannedLast24h, fieldsFilledLast24h },
  scraper: { lastInsertAt, insertedLast24h, insertedLast7d },
  crons: { reminders: { lastRunAt, checked, sent }, daily: { lastRunAt, rolled, cancelled, extended } },
  stripe: { lastWebhookAt, unmatched },
  lastBackupAt, createdAt, updatedAt }
```
The settings GET returns it; AppShell keeps it in the context (shell.health); the Integrations and Automation tabs read it; buildNotifications raises "The enrichment scan has not run in 36 hours" and "The scraper has not added a lead in 36 hours" as System items (ids health:enrichment and health:scraper, snoozable). Reminders and Automation show next run as the last run plus the interval.

## 6. Export and backup formats

Client side CSVs (src/lib/exports.js, RFC 4180 with a BOM, CRLF rows):
- Leads: Business, Stage, Industry, Priority, Call status, Phone, Contact, Email, Area, Website, Instagram, Last call, Calls, Callback due, Meeting, Source, Added. Settings exports every live lead; the Leads screen keeps its filtered export.
- Clients: Business, Contact, Phone, Email, Since, Client status, Lifetime value, Projects, Retainer, Next bill, Drive, Website.
- Projects: Client, Project, Kind, Stage, Total, Paid, Plan, Revision rounds, Released, Started, Archived.
- Print orders: Customer, Email, Phone, Source, Status, Items, Subtotal, Rush, Due, Paid, Created.
- Purchases ledger: Date, Client, Label, Amount, Project, Source, Stripe event, Notes (every purchases[] entry across every lead).
- Submissions: the existing server export (CSV with a column per answer, or JSON).

Backup: GET /api/admin/backup returns { app, version, createdAt, collections: { call_leads, submissions, projects, orders, concept_packs, settings, stripe_events } } as visualize-backup-YYYY-MM-DD.json. push_subscriptions is excluded, stripe_events rows drop raw, and the settings auth document is reduced to its changedAt. The download stamps health.lastBackupAt, which the Data tab shows. Restore is out of scope and the card says so.

## 7. What is gone and which aa- CSS remains

ListSection, ItemDetail, SettingsSection, StatusBadge, Skeletons, TYPE_LABELS, and the AdminApp fmtDate helper no longer exist; grep for them in src returns nothing (PrintsAdmin has its own unrelated StatusBadge). AdminApp is 526 lines and only holds Login, the shell state, and the section switch.

aa- CSS remaining in AdminApp, and why: .aa-app (the content row inside the shell), .aa-main and .aa-main--wide (the Leads, Booked, and Clients detail split and every PageShell), .aa-panel (the list panel beside a detail on those three screens), .aa-embed (the embedded Call Console), the login block (.aa-loginpage, .aa-login and its children, .aa-shake), and three controls Checklists.jsx still renders: .aa-input, .aa-btn (plus .aa-btn--primary for Login), .aa-iconbtn. Every rule now reads tokens. Everything else (rows, groups, search, badges, bulk bar, skeletons, detail, answers, settings, toggles, export grid, minibtn, field) is deleted.

## 8. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 12 (3fd7375) | 406 | 97 |
| After Prompt 12 | 364 | 93 |

LeadImport (37) and the deleted aa- rules account for the drop; nothing new carries a literal.

## 9. Layout audit

Prompt 11 tally: the studio-only pass on the Prompt 11 build (390 and 1280, 73 checks, screenshots reviewed) was clean. The full five-width Prompt 11 run was interrupted at 219 clean checks (320 complete at 88 clean, 390 in progress) when this prompt's first build replaced dist under it, so the full tally for Prompt 11 is the Prompt 12 run below, which covers every Prompt 11 check on a superset build.

New checks this prompt: submissions list with each of the six chips (Unread, Brief, Contact, Review, Shop order, Other), submissions skeleton, submission detail for a brief, the brief view, link to lead Sheet, convert to lead Sheet, submission detail for the long-name shop order, every Settings tab, the Reconcile Sheet and its link to client picker, the lead import Sheet, the orders CSV import Sheet, the device import preview, settings skeleton, Recently deleted through the nav path, and the collapsed sidebar on Settings and Submissions. Fixtures: two Stripe events (one matched, one unmatched with long names), a health document with a stale scraper (50 hours) and a fresh enrichment scan, submissions of five types (start, contact, review, shop-order, other), and two deleted submissions and two deleted leads for the Recently deleted Table.

Full five-width run on the final Prompt 12 build (dist, port 4360), exit 0:

| Width | Checks | Failures |
|---|---|---|
| 320px | 145 | 0 |
| 390px | 145 | 0 |
| 430px | 145 | 0 |
| 768px | 155 | 0 |
| 1280px | 155 | 0 |
| Total | 745 | 0 |

## 10. Decisions

- Sign out everywhere is documented, not built: sessions are HMAC signed with SESSION_SECRET and carry no generation number, and requireAdmin is synchronous across thirteen handlers. Adding a generation check means an async requireAdmin everywhere; the Danger zone says to rotate SESSION_SECRET in Vercel until then.
- The webhook answers 503 without a secret so Stripe keeps retrying rather than dropping events; every other missing key degrades to a Settings row.
- Schedule matching on Stripe payments requires the same amount and a due date on or before today, so a payment never marks a future month paid by accident; a mismatch just lands on the ledger and shows on the client.
- The Stripe subscription id is entered by hand (InlineEdit) rather than guessed from Stripe, because the read endpoints cannot tell which client a subscription belongs to without the same fuzzy match; a wrong guess would cancel the wrong retainer.
- Bill reminders fire on the bill day itself (once per date), review asks once per release.
- The health notification threshold is 36 hours so a single skipped night does not nag before the next run has a chance.
- Submissions keeps the legacy submission statuses (LEAD_STATUSES) on its status Menu, and its Unread badge now counts every unread submission of every type.
- Recently deleted merges submissions and leads into one Table sorted by deletion time; the nav entry still opens /settings/deleted, which lands on the Data tab.
- Profile business hours show as context on the Dashboard; the best window logic itself still reads the lead's bestWindow text, so the hours are advisory until the console builder adopts them.
- The Dashboard greeting takes the first word of the profile name.

## 11. Skipped or deferred

- Sign out everywhere (see section 10).
- Backup restore.
- Stripe write actions of any kind, and automatic subscription id discovery.
- Business hours inside the console builder's window chips.
- The two remaining direct new Date(<date-only>) reads in computeDashboard (purchases month bucket) and LeadHistory's sort, both harmless for ordering, listed for Prompt 13.

## 12. What Prompt 13 (cleanup and retirement) must know

Unreferenced or legacy, with the evidence:

Files and routes to retire:
- src/pages/PrintsAdmin.jsx: mounted only by src/App.jsx lines 99 and 107 (/prints and /admin/prints on the admin host). Its data is localStorage only; Print Orders replaced it and Settings Data imports its orders.
- src/pages/Prints.jsx (public shop): App.jsx lines 112 and 131. Keep the shop, but its checkout writes vz_print_orders and vz_cart to localStorage (Prints.jsx 484 and the cart) after posting to /api/submissions; the localStorage write can go once the device import has run.
- src/pages/ClientPortal.jsx: App.jsx lines 113 and 132 (/portal). Reads vz_clients, vz_portal_session, vz_invoices, vz_intake_forms; the only caller of api/calendly-meetings.js (ClientPortal.jsx 761) and of src/components/SplashScreen.jsx.
- src/pages/IntakeForm.jsx: App.jsx line 114 (/intake/*). Writes vz_intake_forms.
- api/calendly-meetings.js: unreferenced once ClientPortal goes (CALENDLY_PAT stays as the fallback name in api/admin/calendly/events.js).
- The Settings Danger zone legacy links (Open print dashboard) and src/lib/adminPaths.js IS_ADMIN_HOST paths for /prints.

localStorage keys (all legacy): vz_print_orders, vz_clients, vz_invoices, vz_intake_forms, vz_analytics, vz_maintenance_preview, vz_cart, vz_portal_session, and vz_sid in sessionStorage. Admin keys that stay: vz_theme, vz_call_session, vz_builder_preset, vz_leads_view, vz_cal_view, vz_shell_collapsed, vz_notif_read, vz_callmode_<id>, vz_clients_cols, vz_orders_cols, vz_subs_cols.

Dead exports in src/lib/booked.js (no importer outside the file): SERVICES, planLabel, monthlyOf, calendarUrl, PROJECT_CAP, prepStatus, PREP_META, meetingCountdown, lastContact, totalPaid. Still used: effectiveStage, meetingDate, deleteBlockReason (LeadCard, AdminLeads), checklistProgress (AdminLeads), serviceLabel (CommandBar). PREP_STATUSES in semantics only feeds PREP_META.

Enums: ORDER_STATUSES in semantics and ORDER_STATUS_IDS in api/_semantics.js are only read by api/admin/submissions.js's status whitelist and the Design page; live shop-order submissions still carry those ids, so keep the ids but the label list can go.

Components on old markup: src/components/Checklists.jsx (uses aa-input, aa-btn, aa-iconbtn; imported by LeadDetail only, plus a stale import in AdminApp), src/components/SocialLinks.jsx (SocialFields used by LeadForm; SocialButtons unused since the old Clients screen went), src/components/LinkedSubmissions.jsx (LeadDetail history). Moving those three to the kit lets the last aa- control rules go.

CSS: the aa- rules listed in section 7; src/index.css still carries the maintenance screen (.uc-) and marketing rules, and the light theme stub in tokens.js is wired to nothing.

Other: src/hooks/useReveal.js is imported by Hero.jsx (marketing, keep), SplashScreen goes with the portal, the sharp devDependency is already gone from package.json, and the two direct date reads in section 11.

Schema and endpoints now: collections call_leads, submissions, projects, orders, concept_packs, stripe_events, settings (docs prefs, auth, dashboard, notifications, profile, health), push_subscriptions. Env vars: MONGODB_URI, SESSION_SECRET, ADMIN_PASSWORD, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, WEB3FORMS_NOTIFY_KEY, CALENDLY_TOKEN or CALENDLY_PAT, CRON_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ADMIN_URL (optional).

Hex baseline for Prompt 13 is 364.
