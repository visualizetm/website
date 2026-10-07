# CRM nav revamp: pipeline and clients workspaces, overview strip, analytics home
| M | Commit | Date | What |
|---|---|---|---|
| 1 | 702aaf0 | 2026-10-06 | the plan, the single nav config with workspaces, aliases, the redirect map |
| 2 | f44e4eb | 2026-10-06 | CollapsiblePane on Clients, Leads, Deals, Triage and the queue |
| 3 | a400ea0 | 2026-10-06 | the sidebar: WorkspaceSwitcher, pinned Analytics, Studio rows, the rail |
| 4 | f1009e7 | 2026-10-06 | PageHeader through the top bar, OverviewStrip, the phone Home line |
| 5 | 1fcaa4c | 2026-10-06 | /pipeline and /overview, FunnelBar (a staged `git mv` left this one tree with the home module renamed, so it does not build alone; b24b795 on does; a force push to replace it was declined, Rob's call) |
| 6 | b24b795 | 2026-10-06 | Analytics at /, /api/admin/analytics, the three charts, /tasks, the redirect, More by workspace, tab 1 Home |
| 7 | 3165a5c, f2e9a56, 5272dbc, fadbc5a, 01c177e and this one | 2026-10-07 | the full audits' findings on the new pieces, the empty-charts gate, docs, this report |
Audits on the final build (before = 702aaf0 and the previous reports):
| Audit | Before | After | Exemptions before, after |
|---|---|---|---|
| regression (390 and 1280) | 45 steps (90 runs) | 51 steps, 104 runs, 0 failures | 0, 0 |
| layout-audit, 5 widths | 140 screen entries | 147 entries, 1176 views, zero offenders | HSCROLL_OK 22, 22 |
| a11y-audit, both themes | 140 entries | 556 rows, 0 serious or critical (the drawer label fixed in 01c177e, rerun clean) | 0, 0 |
| feel-audit, both themes and motions | 568 rows | 239 rows a run; gaps only where the baseline build already had them, plus the queue's own (64px and 368px before, 34px and 132px after) and a cls flake on the planner sheets | noFit 28, 29 (clients-pane-rail: the collapsed pane re-flows the record) |
| chrome-audit | 109 states | 115 states, 0 failures | 0, 0 |
| back-test | 12 screens | 12 screens, 76 steps pass (dashboard entry now /tasks) | 0, 0 |
| gesture, empty, site-regression, docs-editor, docs-flow, scene-audit (Home and Concepts, normal and reduce, 5 widths) | 14, 13, 16, pass, pass, clean | the same, all pass | 0, 0 |
| mobile-trace | 4 Home profiles fail (pre-existing, reports/PLANNER-TASKS-REPORT.md) | the same 4, same reason | 0, 0 |
| the 26 node tests plus analytics-test (new, 45 checks, both zones); hex-count; css-orphans; preship | pass; 80; 0; pass | pass; 78; 0; PRE-SHIP PASSED | 0, 0 |
Fault proofs (one build with the four faults, regression at 1280: 4 of 53 steps fail, the rest pass): the pane's storage write removed, 16c fails "the collapse was forgotten after leaving and coming back"; the /?open= redirect removed, 2a fails "url /admin?open=L13"; two charts render nothing when empty, 2b fails "no empty state on income, clients"; the clients stat off by one, 25e fails "7 on the stat, All chip 6 on Clients".
Needs Rob's phone (mock only here): the rail avatars' tooltips on touch, the overview strip's sideways nudge at 320, push links landing on /tasks?open= from a real notification, the chart labels at 320 on a real screen.
Data fields: Income = `purchases[].amount` by `at` (every Mark paid, Stripe event and hand entry writes it); Outstanding = sent, due and past due lines from invoicesOf() on projects and `deal.invoices`, drafts out; Clients gained = `clientSince`; Tasks completed = `checklists[].items[].doneAt` on leads and projects plus a legacy `nextAction.doneAt`; Tracking since = the earliest doneAt anywhere; Leads added = `createdAt`; MRR = `retainer.amount` on active or ending retainers today. Ranges: the last 30 days, 90 days, 12 calendar months; deltas against the same length before. Server dates are America/New_York, the client mirror the browser's zone, identical below `ANALYTICS_RANGES` (scripts/analytics-test.mjs, both zones).
Plan changes: docs/NAV-REVAMP-PLAN.md "Plan changes" (the home keeps nav id `dashboard`; the queue's section is `tasksAll` because `tasks` was the per client screen; computeDashboard moved to src/lib/dashboardStats.js; StatCard, no KpiCard; the funnel is cumulative from Leads; fixed card heights instead of a noFit exemption on the dashboards; the home keeps Start call session and Add lead; More by workspace landed in milestone 6).
Not done: nothing from the brief. One exemption was added (noFit on the pane's rail state) against a target of none; the feel audit's fit for that state needs the record skeleton to follow the pane's width, left for a later pass.
