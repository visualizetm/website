# CRM nav revamp: pipeline and clients workspaces, overview strip, analytics home

Milestones (one commit each, on main):

| M | Commit | Date | What |
|---|---|---|---|
| 1 | 702aaf0 | 2026-10-06 | docs/NAV-REVAMP-PLAN.md, the single nav config with workspaces, the aliases and redirect map |
| 2 | f44e4eb | 2026-10-06 | CollapsiblePane on Clients, Leads, Deals, Triage and the queue |
| 3 | a400ea0 | 2026-10-06 | the sidebar with the WorkspaceSwitcher, pinned Analytics, Studio rows, the rail |
| 4 | f1009e7 | 2026-10-06 | PageHeader through the top bar, the OverviewStrip, the phone Home line |
| 5 | 1fcaa4c | 2026-10-06 | /pipeline and /overview dashboards, FunnelBar |
| 6 | b24b795 | 2026-10-06 | Analytics at /, /api/admin/analytics, the charts, /tasks, the redirect |
| 7 | HASH7 | 2026-10-06 | More by workspace, docs, the full audits, preship, this report |

Note on 1fcaa4c: its tree carries the home module already renamed to AdminTasksHome.jsx (a `git mv` staged before the split), so that one commit does not build on its own; b24b795 and every commit after it do. A rewritten pair was prepared locally but replacing a pushed commit needs a force push, which was left for Rob.

AUDIT_TABLE

Each new gate fails with its fault put back (one fault build, FAULT_RESULTS):

FAULT_LINES

Needs Rob's phone (mock only here): the rail avatars' tooltips on touch, the overview strip's horizontal nudge at 320, Save to photos on the planner, push links landing on /tasks?open= from a real notification.

Data fields: Income = `purchases[].amount` by `at` (every Mark paid, Stripe event and hand entry writes it); Outstanding = sent, due and past due lines from `invoicesOf()` on projects and `deal.invoices`, drafts out; Clients gained = `clientSince`; Tasks completed = `checklists[].items[].doneAt` on leads and projects plus a legacy `nextAction.doneAt`; Tracking since = the earliest `doneAt` anywhere; Leads added = `createdAt`; MRR = `retainer.amount` on active or ending retainers today. Ranges: the last 30 days, 90 days, 12 calendar months; deltas against the same length before. Server dates are America/New_York (api/_lib/zone.js), the client mirror the browser's zone, identical below `ANALYTICS_RANGES` (scripts/analytics-test.mjs, both zones).

Plan changes: docs/NAV-REVAMP-PLAN.md "Plan changes" (the home keeps nav id `dashboard`; the queue's section is `tasksAll` because `tasks` was the per client screen; computeDashboard moved to src/lib/dashboardStats.js; StatCard not KpiCard; the funnel is cumulative from Leads; fixed card heights instead of a noFit exemption; the home keeps Start call session and Add lead; More by workspace landed in milestone 6).

Not done: NOT_DONE
