# Mobile revamp progress

Resume with: "Continue the CRM mobile revamp from docs/MOBILE-PROGRESS.md."

Rubric: docs/MOBILE-UI-GUIDE.md. Baseline and plan: docs/MOBILE-AUDIT.md. After: docs/MOBILE-AUDIT-AFTER.md. Decisions: docs/MOBILE-DECISIONS.md.

## Done
- Guide committed (dc0beda). Milestone 1, measure (100d13f): docs/MOBILE-AUDIT.md, scripts/mobile-measure.mjs.
- Milestone 2 (554418f onward): Settings regions, sheet and modal entrance, last rows clear the tab bar, ip-address fix, Back on Projects CLS.
- Milestones 3 to 5 (cb2de6b and after): chrome modes and tab bar hiding, per screen top bar, More as a page, 11px tab labels, edge Back, sheet drag with a receding background, phone editors as overview plus steps, Settings as rows, the Call room (D3), NoResults on every list (D1, D2), row swipe and long press.
- Records on a phone push a section as its own screen (milestone 4 correction: they were inline accordions). The first screen is the header, the strip and the stage's first section, then rows.
- Milestone 6: gesture-test, chrome-audit, empty-audit, npm run preship and preship:full.
- Feel audit: the skeleton fit gaps at 390 went from about 45 rows to the logged exemptions (see MOBILE-DECISIONS.md).

## Planner dashboard and task system (docs/PLANNER-TASKS-DESIGN.md)
- Milestone 1: the design doc and the decisions.
- Milestone 2: posts gain kind, ad, video, concept, allowDownload and the ad statuses; the suggestions route and the public suggest action; the task rule in src/shared/taskRules.js with its api mirror, checklists on projects, the next action a client's or a project's task becomes; the reminders cron reads checklist tasks; the retainer delivered count by kind; tasks-test (64), task-reminder-test (26), planner-endpoint-test and security-test extended; scripts/migrate-checklists.mjs.

- Milestone 3: src/pages/Planner.jsx is the dashboard: Home (the Needs you strip, the month's progress, the next three, How this works), Posts (list and calendar), Ads (rows with run dates, the goal and the headline result), Ideas (the client's suggestions and the Suggest sheet), one detail for a post and an ad (video inline, Save to photos through src/lib/share.js, Copy on the caption and the hashtags), a bottom tab bar on a phone and a segmented control on a computer. COPY.planner rewritten in Rob's first person. share-test (39) with navigator.share mocked; the fixtures carry ads, a video post, a hidden and a shown budget and three suggestions (scripts/audit-fixtures.mjs, shared with the mock server); site-regression 13, layout-audit, a11y-audit and audit-screens cover every new screen. The marketing CSP opens connect-src and media-src to Cloudinary.

- Milestone 4: PostSheet is one editor for a post and an ad (the kind toggle, the ad section with budget, Show the budget and results, the video field with an upload progress bar or a planned video's concept and length, Download allowed, ad statuses); the planner editor's rows carry the Ad pill and the run dates, Add ad and Add video in the month menu, the ideas inbox (Make a post, an ad or a video, Decline with a note) with the badge on the page and on the Planner nav entry; ads on the calendar as a range under Ads; the drawer's approve and change lines cover ads; Settings gains Client ideas; the fixtures and mocks answer the suggestions route; audit-screens covers the ad and video sheets and the inbox.

- Milestone 5: src/pages/AdminTasks.jsx at /clients/:id/tasks (the client's and the projects' checklists, progress bars, 44px checkbox rows, due labels, the pin, Undo on complete, swipe right completes, swipe left or a long press opens the task sheet, Quick add with the day chips, templates with a start date, a blank checklist, search with NoResults, the first time state); TaskSheet gains the checklist picker and the note; the record's Tasks section (a row with the bar on a phone) replaces the Notes checklists; Next up rows show the task, its due label and a thin bar with Pin, Auto and Open tasks, and complete or snooze the task itself; src/lib/taskWrite.js is the one place a pin writes the next action; a legacy task reads a stable id. back-test, gesture-test (the task row swipe), regression 17c, chrome-audit, empty-audit (Tasks) and audit-screens cover it.

- Milestone 6: the gate in full. lint, build, hex 80, css-orphans 0, every node test (tasks 65, share 39, task-reminder 26, planner-endpoint 95 checks, security 1073, next-action in both zones, dates, deals, lists, score, send-email, showcase and concepts endpoints, pipeline, rules), a11y in both themes (452 rows, zero violations), the feel audit in both themes and both motion settings, layout-audit and scene-audit at 320, 390, 430, 768 and 1280 through preship:full, the zoom and text spacing pass, back-test, gesture-test, chrome-audit (92 states), empty-audit (Tasks included), regression (89 steps) and site-regression, mobile-trace, Lighthouse on the client planner at 390. The ideas inbox gained search. docs/ARCHITECTURE.md, RUNBOOK.md, QA-CHECKLIST.md and CLAUDE.md name the planner dashboard and the task system.

## Client page workspace redesign (one job, five milestones)
Plan: 1. Profile card and the full profile (grouped rows, inline edit, Add a detail, Edit all), a pushed screen on a phone and a side panel on a computer. 2. Four workspace cards on src/lib/workspace.js, the Tasks tab as a redirect. 3. Quick actions, the trimmed menu, the name wrap. 4. The five widths, the skeleton, gestures and Back, empty states. 5. Audits, docs, the report.
- Milestone 1: src/components/record/ProfileCard.jsx (avatar, name, contact, area and industry, phone, email, seven channel buttons that never hide, Copy phone, Copy brand, Open profile) and ProfileSection.jsx (Contact, Online, Business, Brand, Notes; inline edit; Add a detail; Edit all), registered as the `profile` section (a pushed screen on a phone, a Sheet on a computer).
- Milestone 2: src/lib/workspace.js (showcaseStatus, plannerStatus, tasksStatus, conceptsStatus; src/lib/showcaseMeter.js holds the completeness rule) and WorkspaceCards.jsx; the Tasks tab and row redirect to the Tasks screen.
- Milestone 3: QuickActions.jsx under the cards; the client menu keeps Edit all, Priority and status, Delete; the name wraps at every width; the header drops its context line on a client.
- Milestone 4: a container query sizes the workspace by the record's width; the client skeleton draws the profile card, the four cards and the chips; the profile screen goes through nav-history.
- Milestone 5: see reports/CLIENT-WORKSPACE-REPORT.md.

## Next
- Nothing queued.
