# Mobile revamp progress

Resume with: "Continue the CRM mobile revamp from docs/MOBILE-PROGRESS.md."

Rubric: docs/MOBILE-UI-GUIDE.md. Baseline and plan: docs/MOBILE-AUDIT.md. Decisions: docs/MOBILE-DECISIONS.md.

## Done
- Guide committed (dc0beda).
- Milestone 1, measure: docs/MOBILE-AUDIT.md, scripts/mobile-measure.mjs.

## Done (second session)
- Verified on 554418f: back-test, regression (88 steps), site regression (14), a11y (400 rows, zero), layout-audit green at 320, 390, 430, 768, 1280 (973 views), every unit test script.
- Milestone 3: chrome modes and tab bar hiding, per screen top bar, More as a page, 11px tab labels, edge Back that follows the finger, sheet drag with a receding background.
- Milestone 4 (the parts that were not already built): phone editors as overview plus steps (Showcase, Planner setup and link, Concepts), Settings as rows, the Call room (D3).
- Milestone 5: NoResults for every list (D1, D2), row swipe on Leads and planner posts, long press sheets on lead, client and project rows.
- Milestone 6 scripts: gesture-test, chrome-audit, empty-audit, npm run preship and preship:full.
- Back on Projects CLS: reproduced in the feel audit (not a Back problem, the skeleton cards were 152px against 150px loaded); the skeleton card is now 150px.

## In progress
- Re-run on the final build: layout-audit and scene-audit at five widths, a11y (390 and 1280, both themes), the feel audit (both themes, both motion modes), regression, back-test, site regression.
- Docs: ARCHITECTURE (chrome modes, gestures, empty states), QA checklist rows, CLAUDE.md, the stale numbers, MOBILE-AUDIT-AFTER.md.
- npm audit fix for ip-address.

## Next
- Only what the final audits flag.

## Already built (found in milestone 1, do not redo)
- Lead, deal and client records on a phone are already a first screen of identity, next action and rows with a summary each.
- Editors (showcase, planner, concepts), new project and fill from filters are pages at every width.
- Sheet drag already follows the finger and dismisses on a third or a flick (no receding background yet).
- Row swipe exists on Next up, Triage and Lists; long press on Lists reorder, Next up snooze, kanban.
