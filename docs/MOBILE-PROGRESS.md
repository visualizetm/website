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
- Milestone 1: the design doc and the decisions (this commit).

## Next
- Milestone 2: data, endpoints and tests (posts kind, ad and video fields, suggestions, the task rule and tasks-test).
