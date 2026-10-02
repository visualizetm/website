# Mobile revamp progress

Resume with: "Continue the CRM mobile revamp from docs/MOBILE-PROGRESS.md."

Rubric: docs/MOBILE-UI-GUIDE.md. Baseline and plan: docs/MOBILE-AUDIT.md. Decisions: docs/MOBILE-DECISIONS.md.

## Done
- Guide committed (dc0beda).
- Milestone 1, measure: docs/MOBILE-AUDIT.md, scripts/mobile-measure.mjs.

## In progress: Milestone 2 (partly done, committed as a partial)
Done and verified:
- Home scene-audit clean at 320, 390, 430, 768, 1280 (spacing only in src/index.css; Business types' tile row slot is marked data-scene-reserve and scripts/scene-audit.mjs counts a reserved slot as content, not a dead band; that is the one audit change).
- 320 money rows: invoice rows wrap their status, action and menu under the title (.cw-sched-row in src/ui/lead.styles.js). Verified clean at 320 on deal money by a direct probe.
- 768: the record context line (.rc-ctx) wraps to two lines instead of clipping. Verified clean on lead notes by a direct probe.
- D4 (phone link gets a 44px hit area), D6 (record title wraps two lines, pills wrap under it), D7 (sidebar percent badges moved off the numbers), D8 and the long name rule (.lay-title on the planner, concepts and triage titles and the record name).
- Triage desktop skeleton: no check column, a trailing actions cell, remembered row count (default 10), key legend moved above the table so nothing under it shifts; the ListSearch clear button no longer grows the field from 44 to 46.
- lint, build, security-test, pipeline-test, css-orphans pass; hex count 80.
NOT done or not verified (resume here):
- layout-audit at all five widths has not been re-run on this build (the earlier partial run was invalidated by a rebuild mid-run). Run it detached against a snapshot build (see the scratchpad snap.sh idea: build to another outDir, preview on 4331, AUDIT_BASE=http://127.0.0.1:4331).
- Triage record skeleton (LeadDetail.Skeleton triage flag, two groups plus the decision bar) is in but its 1280 fit was still 8 vs 6 rows; the last tweak (group item as a 40px text wrapper) is in the commit and was not measured. Re-run: AUDIT_ONLY=triage AUDIT_BOXES=1 node scripts/feel-audit.mjs.
- Back on Projects CLS 0.18 not yet reproduced or fixed (the highlight is already an outline; the shift is probably skeleton against loaded rows).
- Settings Integrations and Danger regions, sheet and modal regions (feel audit rows for the Keep sheet and Capture show skeleton=no), last rows clearing the tab bar, the full feel audit in both themes and both motion modes, npm audit fix for ip-address.
- Do not rebuild dist while an audit is running against it (it breaks chunk loading and produces false failures).

## Already built (found in milestone 1, do not redo)
- Lead, deal and client records on a phone are already a first screen of identity, next action and rows with a summary each.
- Editors (showcase, planner, concepts), new project and fill from filters are pages at every width.
- Sheet drag already follows the finger and dismisses on a third or a flick (no receding background yet).
- Row swipe exists on Next up, Triage and Lists; long press on Lists reorder, Next up snooze, kanban.
