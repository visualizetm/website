# Mobile revamp progress

Resume with: "Continue the CRM mobile revamp from docs/MOBILE-PROGRESS.md."

Rubric: docs/MOBILE-UI-GUIDE.md. Baseline and plan: docs/MOBILE-AUDIT.md. After: docs/MOBILE-AUDIT-AFTER.md. Decisions: docs/MOBILE-DECISIONS.md.

## Concepts review job (Review each and whole section reveal), done (reports/CONCEPTS-REVIEW-REPORT.md)
Resume with: "Continue the concepts review job from docs/MOBILE-PROGRESS.md." Milestones: 1 data model, handler and guards; 2 CRM editor; 3 public page sections and reveal; 4 Review each flow; 5 CRM results, Log as a round, Concepts card, review task; 6 carried feel gaps, audits, docs.
- [x] Milestone 2: the editor (Approval mode, Needs a decision or For reference, Not this one, the live preview line, reopen for review, send validation).
- [x] Milestones 3 and 4 shipped together (the section card, its reveal and its decision panel are one component in one file; splitting them would have left a Review each page with no way to answer): src/pages/Concepts.jsx rebuilt, sections reveal as one unit, review panel, saved answers, progress bar, summary sheet, submit, read only after sending. Carried: clients-profile and clients-profile-add fit gaps fixed (a profile skeleton and ?sec= deep link), noFit removed from both.
- [x] Milestone 5: the editor's Their answers card, Log as a round (src/components/RoundLog.jsx), the Concepts card and list wording, the in-app note; the task and push are in the handler.
- [x] Milestone 6: audits for every state, docs, the report. Open: the push has no Settings switch; the feel audit's pre-existing gaps (see the report).
- [x] Milestone 1: approvalMode, allowPass, needsDecision, decision and submissions on concept_sets; decide and submit on the public handler; admin lock, reopen, send validation; scripts/concepts-review-lib.mjs (37 checks), concepts-review-test.mjs, concepts-guard-proof.mjs (13 guards each cut out and shown to fail), security-test section 4c.

## Client docs and workspace card fixes (docs job)
Resume with: "Continue the client docs job from docs/MOBILE-PROGRESS.md." Milestones: 1 data model, route, schema and security tests; 2 the Docs card and the workspace card fixes; 3 the editor; 4 templates, client fields, Settings; 5 All docs, More, search, Recently Deleted, History; 6 audit states, docs, report.
- [x] Milestone 1: api/_routes/docs.js behind route(), src/shared/docBlocks.js and its api mirror, scripts/docs-lib.mjs (43 checks), docs-test.mjs, docs-guard-proof.mjs (15 guards), security-test 4d.
- [x] Milestone 2: the Docs card (full width, under the four cards), src/lib/workspace.js docsStatus, the five card fixes (Showcase count, Concepts middle, task rows, the edge handle logged, the scroll fade), fixtures and the mock server answer /api/admin/docs.
- [x] Milestone 3: the editor (blocks, marks, the bar above the keyboard, reorder, swipe delete, autosave, export, print), docs-edit-test, docs-save-test, docs-editor-audit.
- [x] Milestone 4: templates and client fields (docs-templates-test), the New doc sheet, Make a task, Settings Doc templates, docs-flow-audit.
- [x] Milestone 5: All docs per client and across clients, the More page Docs row, global search, Recently Deleted and History.
- [x] Milestone 6: audit states at five widths, the gate, docs, reports/CLIENT-DOCS-REPORT.md.

## Logo rollout (Brand v3), one run, five milestones
Resume with: "Continue the logo rollout from docs/MOBILE-PROGRESS.md." Checklist: docs/LOGO-INVENTORY.md. Decisions: the "Logo rollout" section of docs/MOBILE-DECISIONS.md.
- [x] M1: pack files placed (staging folder was the repo root, upload commit 55292f2), badge-96 and the two 480 wordmarks rendered (scripts/brand-render.mjs), src/ui/Logo.jsx, src/ui/LogoSpinner.jsx, scripts/logo-test.mjs, docs/LOGO-INVENTORY.md (37 rows: public 18, public and admin 2, admin 8, system 6, docs 2, staging 1).
- [x] M2: public site. Rows 1 to 17, 21 to 23 of the inventory: head block from the pack, JSON-LD, the parser splash (vite plugin, same stylesheet string as LogoSpinner), SiteLoading and ClientBoot on LogoSpinner with the 1300 ms timer gone, every public Wordmark call is Logo, maintenance page, og-default.png deleted, useHead and prerender on og-image, one manifest per host (the pre-paint script points the admin host at /manifest.webmanifest). Wordmark.jsx and the admin rows wait for M3.
- [ ] M3: admin CRM.
- [ ] M4: emails, templates, generated files, docs/LOGO-ROLLOUT.md.
- [ ] M5: verification and docs.

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
