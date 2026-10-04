# Client planner dashboard and CRM task system: design

Written before any code (milestone 1 of six). Rubric: docs/MOBILE-UI-GUIDE.md. Decisions are logged one line each in docs/MOBILE-DECISIONS.md.

## What exists today (commit b0acb89)

- Posts: one `posts` document per scheduled post (api/_routes/posts.js, sanitize is the schema): leadId, month, date, time, platforms (platform kept for old readers), format portrait or story, imageUrl, caption, hashtags, status making, review, approved, posted, note (Rob to client), clientNote, clientNoteAt, approvedAt, postedAt, order, archived. src/lib/posts.js is the pure logic (platformsOf, formatOf, missingForReview, postLabel, recentClientActions, postsInReview).
- The client planner page: src/pages/Planner.jsx at /planner/:token, standalone chrome (ClientBar, ClientFoot), dark, noindex, marketing tokens. One month, calendar or list, a post detail dialog with Copy, Approve and Ask for a change. api/planner.js is its only endpoint: GET the month (a strict whitelist per post), POST approve or request-change, a per token limiter, one identical 404 for every bad token.
- The admin Planner editor: src/pages/AdminPlanner.jsx at /clients/:id/planner, a draft with a SaveBar, PostSheet.jsx as the post editor (ImageField through Cloudinary unsigned upload), a phone overview with Setup and Link as steps.
- Checklists: `call_leads.checklists[] { name, items[] { text, done } }` (at most 10 lists of 50), rendered by src/components/Checklists.jsx inside the Notes section of a record. Projects have none.
- nextAction: one object per lead and per project (src/lib/nextAction.js, mirrored byte for byte below its clock header in api/_lib/nextAction.js): kind, label, dueAt, auto, doneAt, remindAt, notifiedAt. auto false is a task Rob set in TaskSheet.jsx; the recompute never overwrites it. Next up (AdminDashboard) reads nextUpItems over every lead and project.
- Reminders: api/_routes/cron-reminders.js, once a day at 13:00 UTC on the Hobby plan: the digest lists today's tasks, and every call pushes "Task due" for a nextAction whose remindAt has passed with notifiedAt and doneAt empty, then stamps notifiedAt. settings.notifications.reminders.tasks is the toggle. Settings shows "Reminder timing".
- Retainer delivered counts: with the planner on, a retainer month's delivered count is the posts that reached approved or posted in that month (RetainerSection.jsx); otherwise it is logged by hand on project.monthly[].
- Audits: audit-screens entries for the editor and the client page, layout, a11y, chrome, empty, gesture, back-test, regression (17b sets a task), site-regression (13, the client page), planner-endpoint-test (47), security-test (78), task-reminder-test (22), Lighthouse (the planner target).

## Data model

Nothing is renamed or dropped. Every existing row keeps working with no migration: a post with no kind reads as a post, a checklist item with no id gets one on its next write (a script stamps the rest).

### Posts (extended)

- `kind`: 'post' (default) or 'ad'. POST_KIND_IDS mirrored in api/_semantics.js.
- `format`: 'portrait', 'story' or 'video'. A video post or ad carries `video { url, durationSec, poster }` and `concept` (a planned video with no file is valid: concept and durationSec, no url).
- Ad fields: `ad { name, goal (calls, messages, visits, offer, awareness), audience (sentence), placements[] (feed, stories, reels), buttonText, link, startDate, endDate, budget, showBudget (false), results { reach, clicks, messages, spend } }`. AD_GOAL_IDS and AD_PLACEMENT_IDS mirrored.
- `status` gains `live` and `finished` (ads only; the sanitizer refuses them on a post). POST_STATUS_IDS mirrored.
- `allowDownload` (default true).
- The public API strips on the server: `ad.budget` unless showBudget, `note` stays (it is written to the client), `clientNote` stays, nothing else internal exists on a post. `ad.results` is sent only when any value is set.

### Suggestions (new collection, admin route api/_routes/suggestions.js on the dispatcher, not a function)

`{ leadId, kind (post, ad, video), subject (120), goal (one of the five chips plus other), details (1000), preferredDate (YYYY-MM-DD), link (safeUrl), photos[] (up to 3 https URLs on our Cloudinary cloud), status (new, planned, declined), postId, note (Rob's, 500), seenAt, createdAt, updatedAt }`. SUGGESTION_KIND_IDS, SUGGESTION_GOAL_IDS, SUGGESTION_STATUS_IDS mirrored.

### Tasks: extend checklists, never a second system

Decision (DECISION RULES, "one task system"): tasks are the existing `checklists` lists, extended, on both leads and projects. No new collection, no new route, the same `$set` of the whole array through the existing optimistic patch helpers, the same 10 by 50 caps.

`checklists[] { id, name, templateId, items[] { id, text, done, doneAt, due (ISO, '' for none), note (300), order, pinned, remindAt, notifiedAt, source ('manual', 'template', 'suggestion'), suggestionId } }`

- `id` on lists and items: eight character uids (src/lib/projects.js uid). Items without one are stamped on the next write by normalizeChecklists; scripts/migrate-checklists.mjs stamps the rest, reporting first and writing with --apply.
- Projects gain `checklists` with the same sanitizer (api/_routes/projects.js).
- The "pinned task" IS the existing next action: pinning writes `nextAction { kind: 'custom', label: item.text, dueAt: item.due, auto: false, doneAt: '', remindAt: '', notifiedAt: '', taskId }`. Auto clears it (the recompute takes over). The task keeps its own remindAt, so the reminder is sent once, from the task, never twice. NEXT_ACTION_FIELDS gains `taskId`.
- Completing a task that is pinned clears the next action on the same write.
- Legacy: a nextAction set in TaskSheet before this (auto false, no taskId) keeps working untouched as a pinned action with no task behind it.

### The Next up rule (one function)

`taskNextUp(record)` in src/shared/taskRules.js, mirrored byte for byte in api/_lib/taskRules.js (a serverless function cannot import src/; the mirror is asserted in tasks-test the way deals-test asserts deal.js). The rule: the pinned task wins; otherwise the earliest due open task, overdue first; ties break by checklist order then task order; tasks with no date only win when nothing has a date; done tasks never count.

nextActionFor(record) for a client stage lead and for a project: when taskNextUp gives a task, the computed action is that task (kind custom, label, dueAt, auto true, taskId); otherwise the existing rules. Leads at every other stage keep the pipeline rules untouched. resolveNextAction is unchanged: a pinned (auto false) action still wins over the computed one.

## Endpoints

- api/planner.js (public, token): GET adds `suggestions` (the client's own, whitelisted: id, kind, subject, goal, status, note, createdAt) and `kind`, `format`, `video`, `ad` (filtered), `allowDownload` per post. POST gains action `suggest` ({ kind, subject, goal, details, preferredDate, link, photos }), one every 20 seconds and 15 a day per token through api/_lib/limit.js (two keys), every field capped, photos checked against the Cloudinary cloud name, link through safeUrl. Approve and request-change work on ads too (an ad in review).
- api/admin/index.js gains `suggestions` (GET ?leadId, ?status; PATCH { id, set } for status, note, postId, seenAt). The rewrite is one line in vercel.json. Converting is a client side flow: create the post with the brief, then PATCH the suggestion.
- api/_routes/posts.js: the new fields in sanitize. api/_routes/projects.js: checklists. api/_routes/call-leads.js: the extended item shape. api/_routes/settings.js: `reminders.ideas` (default true).
- api/_routes/cron-reminders.js: tasks come from checklists (leads and projects) plus legacy nextAction tasks without a taskId; the digest and the per task push are unchanged in shape; notifiedAt is stamped on the item. The push for a new suggestion is sent by the planner endpoint at the moment it is written (a public write, not a cron), guarded by reminders.ideas; it also writes the "New idea" task onto the client's checklist "Ideas".

## Screen map (one job each)

Client side (standalone, /planner/:token, four destinations as a bottom tab bar on a phone, a segmented control on a computer; the tab bar hides on a detail and on the Suggest sheet):

- Home: see what needs me and how the month is going. Needs you strip, one month progress bar, the next three items, the first time How this works card.
- Posts: see my posts and save what I need to post them. The month's posts (calendar from 430 up, else the list).
- Post detail: read one post, save its picture, copy its words, approve it or ask for a change.
- Ads: see the ads planned and running and how they did.
- Ad detail: read one ad (what it says, who sees it, where, when, cost if shown, results if entered), save the creative, approve or ask for a change.
- Ideas: tell Rob what I want next and see what happened to it.
- Suggest sheet: send Rob one idea (kind, subject, goal, details, date, link or photos).

Rob's side (admin):

- Client record, Tasks row: see how far the client's work is (count and bar) and open it.
- Tasks screen (/clients/:id/tasks, a focused screen; projects too at /clients/:id/tasks?project=): tick things off, pin the Next up, add and reschedule.
- Checklist screen (a step of Tasks on a phone): one checklist, its tasks, its progress.
- Template picker (a sheet): start a checklist from a template with a start date.
- Quick add (a sheet): a title and a day.
- Next up (existing): each client row shows the task, its due label and a thin progress bar; Pin and Auto in the row menu.
- Suggestions inbox (/clients/:id/planner, an Ideas step, badge on the Planner entry points): read a brief and make a post, an ad, a video, or decline with a note.
- Planner editor and PostSheet: the Post or Ad toggle, the ad section, the video field, the Download allowed switch.
- Settings, Notifications: the Client ideas toggle.

## Tests and audits each change touches

- Posts and suggestions: planner-endpoint-test (new fields, budget leakage, suggest action, cross client suggestions, photo URL, javascript link, rate limit, bad enum, oversize), security-test (the same through the operator injection sweep), site-regression step 13 and new steps.
- Tasks: tasks-test.mjs (the rule, ties, undated, pinned, completing, template due dates, the mirror), next-action-test (client with tasks), task-reminder-test (a checklist task with remindAt pushes once; the digest), regression 17b (create, pin, complete), back-test (Tasks, a checklist, the inbox), audit-screens, chrome-audit (Tasks focused), empty-audit (Tasks first time and no results), gesture-test (the task row swipe).
- Client page: audit-screens (Home, Posts, Ads, Ideas, Post detail, Ad detail video and image, Suggest), layout and a11y at five widths, Lighthouse at 390, a download test with navigator.share mocked.
- Retainer counts: deals-test or a small assertion in tasks-test (posts to Content Kit, ads to Ad Creatives, Growth both).
- Docs: ARCHITECTURE (post kinds, suggestions, the Next up rule, the planner API actions), QA checklist, RUNBOOK (the suggestion push), CLAUDE.md (10 of 12 functions).
