# PROMPT 09 REPORT: Calendar and notifications

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`.
Commits: event model, Calendly, cron, settings doc (709377f); Calendar and drawer (0bdd9dd); this report.

## 1. What was built

- `src/lib/events.js`: one event source for the Calendar, the notifications drawer, and the Dashboard.
- `src/pages/AdminCalendar.jsx`: Day (mobile default), Week (desktop default), Month, persisted per device; prev / today / next, filter Chips (Meetings, Callbacks, Calendly, New leads), keyboard (arrows, T, D, W, M). Day: seven-day strip with tone dots and swipe, overdue callbacks pinned in danger tone, agenda ListRows with a Menu (Open lead, Reschedule, Mark done, Join link). Week: 7am to 9pm grid, all-day markers, a now line in `--v-red` refreshed every minute, event blocks in kit tones, click a block for a Popover with actions, click an empty slot to add a callback (lead search Sheet then the shared CallbackPicker prefilled to the slot). Month: up to three pills per day (dots on mobile) with "+N", tap opens Day.
- Notifications completed: groups Overdue, Today, Upcoming (7 days), New leads, System; enrichment summary and Calendly bookings; read state, lastSeenAt and snoozes on the settings `notifications` document with the localStorage copy as the offline fallback; Mark all read; per-item Menu with Snooze (1 hour, tomorrow 9am, next week), Open, Done. Snoozing a callback rewrites `callbackAt`; snoozing a meeting or Calendly item hides it until then. Bell badge = unread Overdue plus Today. The Calendar nav badge = meetings today plus callbacks due today or overdue.
- Calendly read sync: `GET /api/admin/calendly/events`, matched to leads on the client (uri, phone, email, normalized name); unmatched events offer Link to lead (writes `calendlyEventUri` and, when the lead has no meeting, `meeting {date, time, type: 'call', location: join link}`) and Create lead (LeadForm prefilled).
- Push reminders: `/api/cron/reminders` on a Vercel cron every 15 minutes with a `CRON_SECRET` check, once per event through `sentReminderKeys`. Settings gained meeting and callback reminder Toggles, a Send test notification button, the Calendly connected or missing-token row, and a hint when `CRON_SECRET` is not set.
- Dashboard's Today panel gained an Open calendar action. Settings CSS moved to tokens. Hex went from 472 to 449.

## 2. Files created, changed, deleted

Created: `src/lib/events.js`, `src/pages/AdminCalendar.jsx`, `api/admin/calendly/events.js`, `api/cron/reminders.js`, `reports/PROMPT-09-REPORT.md`.
Changed: `src/shell/notifications.js` (rebuilt on events), `src/shell/NotificationsDrawer.jsx` (groups, actions), `src/shell/AppShell.jsx` (server read state, snooze, Calendly fetch, events in the shell context), `src/shell/ShellContext.jsx`, `src/shell/nav.js` (Calendar), `src/pages/AdminApp.jsx` (calendar section, calendar badge count, Settings rows), `src/pages/AdminDashboard.jsx` (Open calendar), `api/admin/settings.js` (notifications document in GET and PATCH, `test-push` action, Calendly and reminder status), `api/admin/call-leads.js` (`calendlyEventUri`), `vercel.json` (cron), `scripts/layout-audit.mjs`.
Deleted: nothing. `api/calendly-meetings.js` (the portal's per-invitee lookup) is untouched.

## 3. Event model and source rules

`buildEvents(leads, extras, now)` returns `{ id, kind, at, end, title, subtitle, tone, leadId, lead, link, source, overdue, allDay }` sorted by `at`.
- Meetings: stage booked, won, or client with `meeting.date`; `at` from `meetingDate(lead)` (date plus time, 09:00 when time is empty), `end` = at + 45 minutes, subtitle = type, location, ask for; tone booked; id `mt:<leadId>:<date>:<time>`.
- Callbacks: `callStatus === 'callback'` and stage not lost; `at` = `callbackAt` when set, else the last callback log entry's time, else updatedAt or createdAt; `end` = at + 15 minutes; overdue = `callbackAt` in the past, or (without a date) logged on a previous day; tone callback, danger when overdue; id `cb:<leadId>:<callbackAt or logged at>`.
- Scraper batches: one all-day marker per local day on which leads with a `sourceId` were created, titled "N new leads from the scraper"; tone new; id `scrape:<YYYY-MM-DD>`.
- Calendly (extras): each event from the endpoint, `at` and `end` from Calendly, matched to a lead by `matchCalendly`; matched ones read "Meeting: <business>" in booked tone, unmatched "Calendly: <name>" in neutral tone; id `cal:<uri>`; `link` is the join URL.
- Lost leads emit nothing. Past meetings are on the Calendar but never in the drawer.

Notifications (`buildNotifications(leads, { calendly, lastSeenAt, snoozedUntil })`): Overdue = overdue callbacks and any past dated Calendly or callback; Today = same calendar day; Upcoming = the next 7 days; New leads = stage lead created in the last 48 hours; System = one enrichment summary when any lead was scanned in the last 24 hours ("Scan filled N fields on M leads", counting descriptor, industry, phone, email, socials, intel present on those leads). Snoozed items stay hidden until their time; a snoozed callback simply has a new `callbackAt`.

## 4. Endpoints, cron, env vars

- `GET /api/admin/calendly/events?from=ISO&to=ISO` (admin cookie). Response `{ configured: boolean, cached?: boolean, events: [{ uri, at, end, name, email, phone, eventType, join }] }`. Missing token returns `{ configured: false, events: [] }` with 200. Calendly errors return 502 with `events: []`. Range defaults to 7 days back and 30 ahead; results cached in memory for 5 minutes per range. Env: `CALENDLY_TOKEN` (or the existing `CALENDLY_PAT`).
- `GET /api/admin/settings` now also returns `notifications { readIds, lastSeenAt, snoozedUntil, reminders }`, `calendly { configured }`, `reminders { configured, push }`. `PATCH` accepts `{ set: { notifications: { readIds?, lastSeenAt?, snoozedUntil?, reminders? } } }` and $sets only the keys sent; readIds capped at 500 (oldest dropped), snoozedUntil at 200 keys. `POST { action: 'test-push' }` sends a test to every subscription.
- `GET /api/cron/reminders`, scheduled by `vercel.json` `crons` at `*/15 * * * *`. Auth: `Authorization: Bearer <CRON_SECRET>` (what Vercel sends) or `x-cron-secret`. Response `{ ok, checked, sent }`. Env: `CRON_SECRET`, the existing `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, `MONGODB_URI`, optional `ADMIN_URL` for deep links (defaults to the admin host).

## 5. Calendly matching and the missing token

Order: a lead whose `calendlyEventUri` equals the event uri; then `last10` phone match; then email match against `email` or `afterCall.email`; then a normalized business or contact name match (`normName`, the same function the duplicates finder uses). With no `CALENDLY_TOKEN` the endpoint answers `configured: false`, the Calendly filter chip is disabled with a hint pointing to Settings, the drawer simply has no Calendly items, and the Settings row says to add the token in Vercel. Nothing throws.

## 6. Push dedupe and reminders

- `/api/admin/push-subscribe` already upserts by `subscription.endpoint`, so a device re-enabling push updates its row instead of adding one; verified, no change needed.
- The cron loads live leads with a `callbackAt` or a `meeting.date`, builds due items (callbacks due within the next 15 minutes, meetings starting within the next 60 minutes, both honoring the reminder toggles), skips keys already in `sentReminderKeys`, sends through the existing `sendPush` (which prunes dead subscriptions), then appends the keys (kept to the last 500).

## 7. Additive schema

- `call_leads.calendlyEventUri` (string, 200) in sanitize().
- settings `_id: 'notifications'`: `{ readIds: string[], lastSeenAt: string|null, snoozedUntil: { [eventId]: ISO }, sentReminderKeys: string[], reminders: { meetings: bool, callbacks: bool } }`. Nothing else.

## 8. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 9 (a2b7266) | 472 | 100 |
| After Prompt 9 | 449 | 100 |

## 9. Layout audit

New checks: calendar Day, Week, Month, Day with each filter, add callback Sheet, Link to lead Sheet, Week event Popover (desktop), calendar skeleton, Settings notifications and Calendly rows; the fixtures gained a dated callback, an overdue callback, a meeting today, scraper leads, and two Calendly events (one unmatched).

Pending Prompt 8 tally: the Prompt 8 run was interrupted on this container before finishing; the combined run below covers every Prompt 8 check as well.

Combined run (Prompts 8 and 9), finished on this container, exit 0:

| Width | Checks | Result |
|---|---|---|
| 320 | 61 | all clean |
| 390 | 61 | all clean |
| 430 | 61 | all clean |
| 768 | 64 | all clean |
| 1280 | 64 | all clean |

311 checks, zero offenders, no horizontal scroll at any width.

## 10. Decisions

- The Booked tab long press was skipped: no tab uses long press today, and adding one gesture to one tab would be a surprise. Calendar sits in the More sheet on mobile.
- Snoozing a meeting hides the notification only; the meeting itself stays on the Calendar.
- The week grid shows 7am to 9pm with scroll; a callback outside those hours still renders at the clamped edge.
- Calendly events are fetched once per shell mount for 7 days back and 30 ahead; the Calendar reads that same array from the shell context rather than fetching per range.
- Mark done on a callback logs a no-answer entry and clears `callbackAt`; opening the room instead is one tap away through Open lead.
- The hook-order crash found by the screenshots (a count hook below AdminApp's early returns) was fixed before the audited build.

## 11. Skipped or deferred

- Calendly write-back (creating or moving Calendly events) is out of scope; the sync is read only.
- Drag to move events on the week grid.
- Time zone handling assumes the browser's zone; Calendly times are ISO and convert correctly, meeting times are local by construction.

## 12. What Prompt 10 must know

- Events: `buildEvents` and `matchCalendly` in `src/lib/events.js`; the shell exposes `shell.events` and `shell.calendly`.
- `calendlyEventUri` lives on the lead; the drawer and Calendar both read it.
- Settings `notifications` document shape in section 7; the shell owns the read state through `apiFetch('/api/admin/settings', PATCH)`.
- Hex baseline for Prompt 10 is 449.
