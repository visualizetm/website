# Client planner dashboard and CRM task system: build report

One run, six milestones, one commit each on main. Design: docs/PLANNER-TASKS-DESIGN.md. Decisions: docs/MOBILE-DECISIONS.md (one line each). Resume notes: docs/MOBILE-PROGRESS.md.

## Milestones

| Milestone | Commit | What landed | Evidence |
|---|---|---|---|
| 1, design | 0241650 | docs/PLANNER-TASKS-DESIGN.md: what existed, the data model (posts extended, suggestions, checklists extended into tasks), the endpoints, the screen map, the tests each change touches. Seven decision lines. | Docs only. |
| 2, data and endpoints | a657e80 | Posts gain kind (post or ad), format video, video { url, durationSec, poster }, concept, ad { name, goal, audience, placements, buttonText, link, startDate, endDate, budget, showBudget, results }, allowDownload, and the ad statuses live and finished (refused on a post). The suggestions collection and api/_routes/suggestions.js on the dispatcher (no new function). api/planner.js answers suggestions and the new post fields, strips the budget unless showBudget and sends results only when entered, and takes the public suggest action (one every 20 seconds, 15 a day per token, every field capped, photos only on our Cloudinary cloud, the link through safeUrl, a New idea task on the client's Ideas checklist, a push unless Client ideas is off). The task rule in src/shared/taskRules.js mirrored byte for byte in api/_lib/taskRules.js; checklists on projects; a client's or a project's open task becomes its computed next action; the reminders cron reads checklist tasks; the retainer delivered count by kind; scripts/migrate-checklists.mjs. | tasks-test 64, task-reminder-test 26, planner-endpoint-test, security-test 1073, next-action-test in both zones, every existing suite. |
| 3, the client dashboard | be2be8e | src/pages/Planner.jsx: Home (the Needs you strip, "6 of 10 ready", the next three with Post or Ad pills, the first time How this works card), Posts (list and calendar), Ads (rows with the run dates, the goal and the headline result), Ideas (the client's ideas with Sent, In the plan, Not this time and Rob's note; the Suggest sheet with the three kinds, What is it about, the goal chips, details, a date, a link or up to three photos with Add a link instead), one detail for a post and an ad (a video plays inline, a planned video says what it will be, Copy on the caption and on the hashtags, Cost only when the budget is shown, Results only when entered). A bottom tab bar on a phone, a segmented control on a computer, hidden under a detail. Save to photos (src/lib/share.js). COPY.planner rewritten in Rob's first person. The marketing CSP opens connect-src and media-src to Cloudinary. | share-test 39 with navigator.share and canShare mocked; site-regression 13 (Home, approve, ask for a change, an idea refused empty then sent and listed); layout-audit and a11y-audit on nine new screens; audit-screens entries. |
| 4, Rob's planner tools | 26fddb1 | PostSheet is one editor for a post and an ad (the kind toggle, the ad section, the video field with an upload progress bar through the unsigned preset at /video/upload or a planned video's concept and length, Download allowed). The planner editor's rows carry the Ad pill and the run dates, Add ad and Add video, the ideas inbox (Make a post, an ad or a video prefills a draft from the brief and marks the idea In the plan; Decline with a note they read), the badge on the page and on the Planner nav entry. Ads on the calendar as a range under Ads. The drawer's approve and change lines cover ads. Settings gains Client ideas. The record's next action strip wraps a long task label. | layout-audit at 390 and 1280 (one pre-existing strip overflow found and fixed), a11y-audit on the planner entries, chrome-audit 87, back-test, empty-audit, regression 87. |
| 5, the task system | f41fa86 | src/pages/AdminTasks.jsx at /clients/:id/tasks (the client's lists and each project's, progress bars, 44px checkbox rows, due labels in accent when overdue, the pin, Undo on complete, swipe right completes, swipe left or a long press opens the task's sheet with Pin as Next up, Reschedule and Delete, Quick add with Today, Tomorrow, This week and Pick a date, Start from a template with a start date, a blank checklist, search with NoResults, the first time state). TaskSheet gains the checklist picker and the note. The record's Tasks section with "6 of 14 done" and a thin bar replaces the checklists under Notes; Next up rows show the task, its due label and a thin bar with Pin, Auto and Open tasks; src/lib/taskWrite.js is the one place a pin writes the next action. | tasks-test 65, back-test (Tasks, a checklist step, the ideas step), gesture-test (the task row swipe), regression 17c, chrome-audit 92, empty-audit (Tasks first time and no results), layout walk, a11y clean. |
| 6, prove it | see git log | The ideas inbox gains search; the Tasks skeleton takes the overview's shape; the docs (ARCHITECTURE, RUNBOOK, QA-CHECKLIST, CLAUDE.md) name the planner dashboard and the task system; scripts/report-shots.mjs. | The audits below. |

## Audits

Every number below is from this run, against the final code.

- lint clean; build clean; hex 80 of 90 (unchanged); css-orphans 0.
- Node suites: tasks-test 65, share-test 39, task-reminder-test 26, planner-endpoint-test 95 checks, security-test 1073 checks, next-action-test identical in America/New_York and UTC, dates-test, deals-test, lists-test, score-test, send-email-test, rules-test, pipeline-test, showcase-endpoint-test, concepts-endpoint-test: all pass.
- npm run preship:full: build, layout-audit 1029 views clean at 320, 390, 430, 768 and 1280, scene-audit 5 profiles clean, lint, hex, gesture-test 11 steps, chrome-audit 93 states, empty-audit 11 screens. PRE-SHIP PASSED.
- scene-audit on Home and on the concepts presentation at the five widths, normal and reduced motion: clean.
- a11y-audit in both themes at 390 and 1280: 452 rows, zero violations at every impact.
- feel-audit in both themes and both motion settings: 568 rows checked, zero failures (the skeleton fit gaps are the logged exemptions plus the Tasks overview, whose skeleton now takes the loaded shape).
- back-test at 390 and 1280 (Tasks, the checklist step, the ideas step added), gesture-test (the task row), chrome-audit, empty-audit, regression (89 steps, 17c added), site-regression (step 13 rewritten for the dashboard): all pass.
- Lighthouse, the client planner at 390 (mobile preset, dark, mock server): performance 96, accessibility 100, best practices 100, PWA 100, CLS 0, TBT 0 ms, 203 KB.

## Decisions

All in docs/MOBILE-DECISIONS.md. The ones that shaped the build:

- Tasks are the existing checklists extended, on leads and on projects, never a second collection; the pinned task is the manual next action; the rule is one function mirrored to the server and asserted by a test.
- Suggestions are a collection answered from the planner editor's inbox; the New idea push goes out when the idea is written, not from a cron.
- Video is a format, not a kind; a video ad is kind ad, format video.
- Save to photos reads the device (canShare with files), downloads the original on a computer, and falls back to the picture with "Press and hold, then Save to Photos" and Cloudinary's attachment link.
- The client's destination lives in the URL; Home has no month arrows; the legend became the first time How this works card.
- An ad's Cost section shows only when the budget is shown, and spend sits under it; Results never carry spend.
- Snooze on a task moves the task's own date; a legacy task reads a stable id until a write stores one.

## Open

- Cloudinary CORS on res.cloudinary.com could not be observed from this container (the proxy answers 403 to res.cloudinary.com), so the Save to photos fetch is guarded by the fallback rather than confirmed. The marketing CSP now allows connect-src and media-src to Cloudinary; the first real tap on a phone confirms which path runs.
- scripts/mobile-trace.mjs fails on the marketing Home page (four sections over 2.5 screens, "What I do for your kind of business" at 3.4). The same build of the pre-prompt commit b0acb89 fails with the same numbers, so it is not a regression of this run; Home was not touched.
- The video fixture (/showcase/fixtures/clip.mp4) does not exist (no ffmpeg here), so the audits exercise a video post through its poster; the inline player was checked for layout and a11y, not playback.
- The feel audit's light theme reduced motion pass was cut by the two hour background limit on its first run and rerun on its own afterwards: 175 rows, zero failures; its remaining fit gaps (the submission detail panel, the Settings Integrations and Danger zone tabs at 1280) are pre-existing: the same build of b0acb89 reports the same gap on the submission detail. The Tasks overview is a logged exemption (noFit, one row per checklist).
- The optional zoom and text spacing pass (AUDIT_ONLY=a11y layout-audit) clips the call room's business name at 200 percent zoom (.cc-biz, the hostile long name). The pre-prompt commit b0acb89 fails the same view the same way; the call room was not touched in this run.

## Notes

- No new serverless function (10 of 12), no new environment variable, no cron added. Reminder copy reuses the existing "Reminder timing" line.
- The public planner endpoint strips on the server: the budget unless showBudget, nothing internal, an exact per post whitelist asserted by planner-endpoint-test and security-test.
- Tested only with mocks: Save to photos on a real phone (navigator.share with a file), a real video upload to Cloudinary (the XHR progress path), the push for a new idea (sendPush is stubbed in the endpoint test), and Cloudinary's attachment flag download.

## Screenshots at 390 (scripts/report-shots.mjs, in the session scratchpad)

client-home.png, client-posts.png, client-ads.png, client-ideas.png, client-post-detail.png, client-ad-detail-image.png, client-ad-detail-video.png, client-suggest-sheet.png, admin-tasks.png, admin-tasks-checklist.png, admin-tasks-quick-add.png, admin-next-up.png, admin-ideas-inbox.png, admin-planner-ad-sheet.png, admin-planner-ad-section.png.
