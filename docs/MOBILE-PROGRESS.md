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

## Next
- Milestone 4: Rob's planner tools (the Post or Ad toggle, the ad section, the video field, Download allowed, the suggestions inbox, ads on the calendar, the Client ideas setting).
