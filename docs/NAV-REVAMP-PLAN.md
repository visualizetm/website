# CRM nav revamp: pipeline and clients workspaces, overview strip, analytics home

Written before the build (milestone 1). Rubric: docs/MOBILE-UI-GUIDE.md. Decisions: docs/MOBILE-DECISIONS.md. Progress: docs/MOBILE-PROGRESS.md.

## One nav config

src/shell/nav.js stays the single source of truth. Every entry gains `workspace` (pipeline | clients | studio | system) and the shell reads `WORKSPACES` (the switcher), `PINNED_TOP` (Analytics), `PINNED_BOTTOM` (Settings, Design) and `navWorkspace(id)` (the items of one workspace, the Studio rows attached to Clients). The desktop sidebar, the phone More page, the tab bar and the command bar's Jump to list all render from it. A screen that does not exist yet is `soon: true` (rendered disabled, never a dead link) until its milestone lands.

| Workspace | Items (at most 7, no group headers) |
|---|---|
| pinned top | Analytics (the home, path `/`) |
| Pipeline | Dashboard (`/pipeline`), Triage, Leads, Call Console, Lists, Deals, Calendar |
| Clients | Dashboard (`/overview`), Clients, Projects, Docs, Planner, Tasks (`/tasks`); then a Studio row group: Print Orders, Concepts, Reviews, Submissions, Landing |
| pinned bottom | Settings, Design, the profile row, Collapse |

Studio is a row group under Clients because Clients plus Studio is eleven screens and the rule is seven per workspace; Submissions moves there (briefs and contacts from the site are what the studio answers) and Recently Deleted stays reachable from Settings and the More page. Docs (the client docs job, upstream of this one) sits between Projects and Planner.

The workspace follows the route: `workspaceOf(navId)` names the workspace of the active entry, and the switcher only changes what the sidebar lists, never where Rob is.

## Route map, old to new

| Old | New | How |
|---|---|---|
| `/` Next up (the task queue plus four tiles) | `/` Analytics (the home) | the section renders Analytics; the queue moves |
| `/` with `?open=<leadId>` (push deep links to a task) | `/tasks?open=<leadId>` | a redirect in AdminApp (replace) |
| the Next up list (overdue, today, this week, later, meetings, lists ready) | `/tasks` Tasks page (Clients workspace, also from the overview strip and the Analytics tasks card) | the queue component moves whole; the rules, the pin and Next up logic are unchanged |
| `shell.go('dashboard')`, `navById('dashboard')` | Analytics | an alias in nav.js |
| the sidebar funnel strip | the Pipeline dashboard's funnel bar | the strip is removed |
| phone tab 1 "Next up" | "Home" (Analytics with the overview strip on top) | nav.js tab label |
| the More page (one list of everything) | Pipeline, Clients, Studio, System sections from the config | AdminMore renders workspaces |
| `/clients?filter=planner` | unchanged | |
| `/projects`, `/clients/:id/*`, `/leads/:id/concepts`, `/settings/deleted` | unchanged | |

New routes: `/pipeline` (Pipeline dashboard), `/overview` (Clients dashboard), `/tasks` (the task queue). Every existing URL keeps working.

## Collapsible panes

`CollapsiblePane` (src/ui): the list pane of a list plus detail screen (Clients, Leads, Deals, Triage; the Tasks page's queue beside a record) with one shared collapse behaviour. Collapsed it is a narrow rail of avatars (initials, a tooltip with the name, the active one marked, 44px targets) and an expand button; the state is remembered per screen (localStorage through src/shell/storage.js, try/catch, works when storage is blocked); it is independent of the sidebar, and with both collapsed the detail takes the full width. Keyboard: the toggle is a button with a visible focus ring, aria-expanded, and the rail items are buttons.

## Overview strip

`OverviewStrip` (src/ui), in the desktop top bar's centre beside search and as one line at the top of the phone Home. Three chips: meetings in the next 7 days with the next one's day and time ("Thu 2:00"), tasks due today, overdue tasks (red only above zero). Meetings come from src/lib/events.js (meeting and calendly kinds, the same source the Calendar reads); due today and overdue come from nextUpItems over the task rules (today and overdue buckets). At 390 the labels drop to icons plus counts. About 36px tall, one line, no wrapping.

## Pipeline dashboard (`/pipeline`)

- The funnel bar: Triage, Leads, Contacted, Booked, Deals, Clients, counts and step conversion, one horizontal bar (`FunnelBar`), from `pipelineFunnel` plus the triage and deal counts.
- Triage queue card: the newest 5 in triage with Accept (keepPatch: stage lead) and Deny (the existing Decline sheet: stage declined, recoverable) and a link to Triage.
- Calling progress: calls today (computeDashboard.callsToday), the active list's progress (the first open hand list with a scheduledFor, else the fullest), its target and due date read from the list record (`target`, `scheduledFor`).
- Follow ups due: callbacks due today or overdue (callbacksDueIds).
- Upcoming meetings: the next 7 days.
- Ready to hand off: records at stage won or booked with a deal that is paid or won: one tap opens the client record (the existing conversion path stamps clientSince; this card only presents).

## Clients dashboard (`/overview`)

Active clients, projects in progress, retainers and the monthly recurring total, unpaid invoices, tasks due across clients, planner status (links on, items needing the client), recent activity (approvals, change requests, ideas, payments in the last 7 days). Same card grid as the pipeline dashboard.

## Analytics (`/`)

Range: Month (this calendar month to date), 90 days, Year (this calendar year to date), default Month; every KPI shows the change versus the previous period of the same length.

| KPI or chart | Data fields |
|---|---|
| Income | `call_leads.purchases[].amount` with `purchases[].at` in the range (the payments ledger; invoices and Stripe events point at it by ledgerId, so nothing is counted twice) |
| Outstanding (separate small number) | project `invoices[]` and `deal.invoices[]` with status sent and not paid: the sum of `amount` |
| Clients gained | `call_leads.clientSince` in the range (stage client or won) |
| Tasks completed | `checklists[].items[].doneAt` in the range (leads and projects), plus a legacy `nextAction.doneAt` on a custom manual action with no taskId. doneAt is stamped by setTaskDone (src/shared/taskRules.js) since the task system; the chart says "Tracking since <the earliest doneAt on record>" |
| Leads added | `call_leads.createdAt` in the range, every stage |
| Monthly recurring | `retainer.amount` on stage client with retainer status active or ending |
| Income over time | the same purchases, bucketed by week (Month and 90 days) or month (Year) |
| Clients gained over time, Tasks completed over time | the same fields, the same buckets |
| Funnel with conversion | pipelineFunnel plus triage and deals |
| Income by package | `purchases[].projectId` to `projects.packageId` (then the package label), unmatched purchases under their own `label` |

The numbers come from one pure function, `computeAnalytics`, in api/_lib/analytics.js, mirrored byte for byte below its header in src/lib/analytics.js (asserted by scripts/analytics-test.mjs). The server route `api/_routes/analytics.js` (GET ?range=, on the existing dispatcher, no new function) reads the leads and projects with a projection of only those fields and returns the computed payload (a few KB); the page caches each range for five minutes. The audits' mocks compute the same payload from the fixtures through the mirror. Real data only: an empty range shows an honest empty state per chart.

## Charts (src/ui)

`BarChart`, `LineChart`, `DonutChart`, `FunnelBar`, `KpiCard`, `PageHeader`, `OverviewStrip`, `CollapsiblePane`, `WorkspaceSwitcher`. Tokens only: the red for the main series, neutrals for the rest; direct value labels, a visually hidden table per chart, `aria-label` summaries; readable at 320 with fewer ticks; skeletons the same size as the loaded chart.

## Audits touched (each a real check, no exemptions added)

- audit-screens: `dashboard` entries become Analytics (the home at both widths, the range switch), new `pipeline`, `overview`, `tasks` entries, the collapsed pane states, the Tasks page record beside the queue.
- chrome-audit: `analytics`, `pipeline`, `overview`, `tasks-list` are tabs screens; `tasks-detail` focused.
- regression 2 and 3 (Next up) become the Tasks page checks; 25a's tab names and More rows follow the config.
- back-test: the Tasks page joins the list of screens with a record beside the list; `dashboard` stays as the home.
- layout-audit: the dashboard block walks Analytics, Pipeline, Overview and Tasks, the collapsed panes and the collapsed sidebar.
- gesture-test: the Tasks page row swipe (the queue's rows kept their gestures).
- A new node test, analytics-test, pins the mirror, the buckets, the previous period and the empty state.

## Plan changes (logged as built)

- The home keeps the nav id `dashboard` (Analytics); `analytics` stays an alias. The plan said rename; the rename would have touched every `go('dashboard')`, `rootOf`, the audit ids and the chrome roots for no behaviour.
- The Next up queue's AdminApp section is `tasksAll` at /tasks (nav id `tasks`), because `tasks` was already the per client Tasks screen's section (/clients/:id/tasks). The file is src/pages/AdminTasksHome.jsx (src/pages/AdminTasks.jsx is the per client screen).
- computeDashboard (the Pipeline numbers) moved out of the old home into src/lib/dashboardStats.js so the Pipeline dashboard reads it without importing a screen.
- The Clients dashboard reuses StatCard; no KpiCard. Deltas live on Analytics where a previous period exists.
- The funnel's conversion starts at Contacted (Triage is the intake; Leads shows no percentage) and the later steps are cumulative (Deals counts deal, won and client), which is the only reading under which every step is a share of the one before.
- The dashboards' cards carry one fixed height each (and the skeleton the same boxes) rather than a noFit exemption in the feel audit.
- The home keeps the two quick actions the old home had (Start call session, Add lead) beside the range switch.
- The More page renders from MORE_SECTIONS (Pipeline, Clients, Studio, System) in milestone 6 rather than 7, because the tab rename and the badge move landed together.
