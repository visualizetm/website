# PROMPT 05 REPORT: Dashboard

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`.
Commits: settings endpoint (dc4746d), Dashboard rebuild (9b47120), this report.

## 1. What was built

- `src/pages/AdminDashboard.jsx`: the Dashboard rebuilt on the kit inside the shell. Greeting by local hour, date and one dynamic context line, primary "Start call session" and secondary "Add lead" actions, a four-step pipeline strip with conversion percentages, eight StatCards with period trends, a Today panel with the daily target ring and today's items, a revenue snapshot, and an activity feed of the last 20 events with grouped scraper inserts.
- Every panel has a skeleton shaped like its loaded state, shown through useDelayedLoading, and the loaded page enters with Stagger.
- Mobile order: header, pipeline, Today, stats, revenue, activity. From 1024px: two columns, the Today panel and activity on the right (`--v-panel-w`, 360px from 1280px).
- The old Dashboard, its greetings array, and its CSS are gone. Hex count went from 606 to 593.
- One endpoint addition: the settings dashboard document with GET and PATCH.

## 2. Files created, changed, deleted

Created: `src/pages/AdminDashboard.jsx`, `reports/PROMPT-05-REPORT.md`.
Changed: `api/admin/settings.js` (dashboard document, PATCH), `src/pages/AdminApp.jsx` (mounts AdminDashboard, old Dashboard and GREETINGS and dashboard CSS removed, `presetReq` plumbing, `?loading=1` skeleton switch for the audit, unused icon imports pruned), `src/pages/AdminLeads.jsx` (`filterPreset` prop), `src/pages/AdminCalls.jsx` (`builderPreset` prop), `src/shell/AppShell.jsx` and `src/shell/ShellContext.jsx` (`go(navId, preset)`), `scripts/layout-audit.mjs` (dashboard skeleton state, `.db-funnel` scroller).
Deleted: nothing at file level.

## 3. Formulas

Periods are local time. Week starts Monday. A "call" is a `callLog` entry plus any `contactLog` entry of type call or meeting.

| Number | Formula |
|---|---|
| Calls today | calls with `at >= start of today` |
| Calls this week, last week | calls since Monday 00:00; calls in the previous Monday to Sunday |
| Calls this month, last month | calls since the 1st; calls in the previous calendar month |
| Trend on week and month | this period minus previous period, shown as "+N vs last week" with up, down, or flat; omitted for today and for stats with no previous period |
| Not yet called | stage lead and callStatus not-called (missing counts as not-called) |
| Booked | stage booked |
| Callbacks pending | callStatus callback and stage not lost |
| New leads 48h | createdAt within the last 48 hours, any stage |
| Connect rate this month | callLog entries this month with outcome other than no-answer, divided by callLog entries this month, rounded; "n/a" with no calls. contactLog entries are excluded because they carry no outcome. Trend is the difference in percentage points against last month, shown only when both months have calls |
| Pipeline Leads | every lead whose stage is not lost |
| Pipeline Contacted | of those, callLog has at least one entry or callStatus is not not-called |
| Pipeline Booked | stage booked, won, or client |
| Pipeline Clients | stage won or client |
| Conversion labels | Contacted divided by Leads, Booked divided by Contacted, Clients divided by Booked, rounded percent, hidden when the denominator is 0 |
| Money made all time | sum of `purchases[].amount` across all leads |
| This month | purchases with `at >= start of month` |
| Clients on retainer | stage client with any purchase whose label or notes match /retainer/i, shown as "N of M" over stage client count |
| Daily target ring | calls today divided by dailyCallTarget, capped at 100 |
| Context line | first of: callbacks pending, meetings today (from buildNotifications), new leads 48h, else "Queue is clear. Good day to dial." |
| Today list | callbacks (overdue first, then oldest), meetings today, then the five newest leads, all from `buildNotifications` |

Activity events: call logged (outcome pill), lead won (`bookedOutcome.result === 'won'` at its `at`), client added (`clientSince`), purchase recorded (each ledger entry), submission or shop order received (`createdAt`), new lead created (`createdAt`; leads with a `sourceId` are treated as scraper inserts and consecutive ones within 12 hours collapse into "N new leads added overnight"). Sorted newest first, first 20 rows.

## 4. Settings endpoint

`/api/admin/settings` already existed for prefs, password, and purge (GET and POST). Added:
- GET now also returns `dashboard: { dailyCallTarget, dashboardLayout }`, reading the `settings` document `_id: 'dashboard'` and creating it on first read with `{ dailyCallTarget: 25, dashboardLayout: null }`.
- PATCH with body `{ set: { dailyCallTarget?, dashboardLayout? } }` (bare keys also accepted) `$set`s only the keys sent, upserting the document. `dailyCallTarget` is clamped to 1..500; unknown keys are ignored; `dashboardLayout` is reserved and unused. Admin-guarded like the rest of the file. Nothing else in this prompt writes to the database.

## 5. Presets

`shell.go(navId, preset)` now takes an optional preset. AdminApp stores it as `presetReq = { section, preset, n }` and hands it to the target screen as a prop, so the same preset can be sent twice.
- Leads: `filterPreset={{ preset: { status: [...callStatus ids], prio: [...], industry }, n }}`. AdminLeads gained the prop and one effect that sets its existing status, priority, and industry filters, clears search, and closes any open detail. No redesign. The Dashboard sends `{ status: ['not-called'] }` from Not yet called, `{ status: ['callback', 'no-answer', 'no'] }` from Contacted, and `{}` (clear filters) from Leads and New leads 48h.
- Call Console: `builderPreset={{ preset: { status: [...], prio: [...] }, n }}`. AdminCalls gained the prop and one effect that sets the session builder's status and priority chips and returns to the queue view. Callbacks pending sends `{ status: ['callback'] }`.
- Booked and Clients steps and tiles navigate without a preset.

## 6. Old dashboard code removed

The `Dashboard` function (greeting, funnel pills, six stat buttons, recent-activity box, shortcuts row), the `GREETINGS` array with its broken "Rob'neH?" strings, the `.aa-dash`, `.aa-greet*`, `.aa-funnel*`, `.aa-cards`, `.aa-card*`, `.aa-panelbox*`, `.aa-feed*`, and `.aa-shortcuts` CSS, and fourteen icon imports that only the old dashboard used. Confirmed by grep: no `aa-dash`, `aa-feed`, `aa-funnel`, or `GREETINGS` left in `src`.

## 7. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 5 (c76aa02) | 606 | 107 |
| After Prompt 5 | 593 | 107 |

## 8. Layout audit

`scripts/layout-audit.mjs` now checks the dashboard loaded and in its skeleton state (`/admin/?loading=1`), with the sidebar expanded and collapsed on desktop. The pipeline strip is registered as an intended horizontal scroller.

| Width | Checks | Result |
|---|---|---|
| 320 | 20 | all clean |
| 390 | 20 | all clean |
| 430 | 20 | all clean |
| 768 | 23 | all clean |
| 1280 | 23 | all clean |

Exit 0, zero offenders on the final build. Two earlier runs caught defects that were fixed: the mobile skeleton's funnel row was a fixed-width flex row instead of the strip scroller, and the skeleton's styles were not injected in the loading branch. Screenshots at 390, 1280, and 1440 were reviewed for the loaded and skeleton states.

## 9. Decisions

- The greeting uses the display face at 44px only from 1280px up; below that it is 32px so it never wraps mid-word beside the action buttons.
- The two-column desktop layout raises the dashboard's content width to 1160px (a page-level override of `--v-content-w-wide`) so four stat columns fit beside the 324px panel.
- Stat grid uses `minColumnWidth` 120, which yields two columns at 390px and four at 1280px.
- "Contacted" counts any lead that has been dialed at least once, regardless of current stage, so the funnel never shows more booked than contacted.
- The connect rate ignores manual contact-log entries since they carry no outcome.
- Scraper inserts are recognized by the `sourceId` field the enricher writes; leads added by hand have none.
- Monthly recurring revenue is not shown as an amount because no retainer amount field exists; the card shows "N of M clients on retainer" exactly as before. Logged for Prompt 10.
- The daily target is saved on Enter or blur through the settings PATCH with a success toast; the ring animates to the new ratio.

## 10. Skipped or deferred

- Retainer amount field and true MRR (Prompt 10).
- Callback due dates still do not exist; callbacks show as due by status (Prompt 9).
- The Today list does not show meetings beyond today; the notifications drawer covers Upcoming.
- The activity feed reads only loaded data (the 500-lead list and current submissions); no paging.
- The "Print Orders" and "Submissions" sections keep their old list-panel headers under the top bar (screen internals, Prompts 6 to 12).

## 11. What Prompt 6 (Leads) must know

- Filter preset contract the Dashboard depends on: AdminLeads receives `filterPreset` as `{ preset: { status?: string[], prio?: string[], industry?: string }, n: number }`. Keys are call status ids from `CALL_STATUSES`, priority ids from `PRIORITIES`, and a raw industry string or `'all'`. A missing key clears that filter; `{}` clears everything. `n` changes on every send so an identical preset re-applies. Keep this shape working in the rebuilt Leads page, or update `AdminDashboard.jsx` (four `shell.go('leads', ...)` calls) and this section together.
- The Dashboard also sends `shell.go('calls', { status: ['callback'] })` to the Call Console builder and plain `shell.go('booked')` and `shell.go('clients')`.
- Opening a record from the Dashboard goes through `shell.openRecord(lead)`, which routes by stage and hands the screen `openId = { id, n }`.
- Stage counts and the funnel logic live in `computeDashboard` in `src/pages/AdminDashboard.jsx` (exported); a kanban grouped by stage can reuse `normalizeStage` the same way.
- The section root pattern is unchanged: `<main className="aa-main aa-main--wide lay-scroll">` with `.lay-content`, `useTopBar(null)` for the list and `useTopBar({ title, back })` for a detail.
- Hex baseline for Prompt 6 is 593.
