# Client docs and workspace card fixes: report

Final commit: 31c7a4a (the report commit follows it). Date: 2026-10-05.

## What changed
1. A `docs` collection and one admin only route (api/_routes/docs.js, still 10 of 12 functions), block schema mirrored in api/_lib/docBlocks.js.
2. The client page has a full width Docs card (count, New doc, three latest rows pinned first, All docs, skeleton, empty and error states).
3. The doc editor: blocks, bold, italic and link, the formatting bar over the keyboard, plus sheet, reorder by grip, swipe delete with Undo, autosave with Saved, Saving and Not saved, retrying, export, print, duplicate, save as template, Recently Deleted.
4. Six built in templates that fill the client's fields and leave unknown ones as placeholders; contract house rules come from pricing.js (new DEPOSIT_PCT); Make a task through the task system; Settings, Doc templates.
5. All docs per client and across clients, a Docs row on More, New doc in Quick add, global search by title and block text, History entries, Recently Deleted and restore, backups include docs.
6. Part 5: the Showcase count includes every image (published with none says "Published, no images yet"), the Concepts card shows each direction's state, task titles wrap with the circle on the first line, channel and quick action rows fade the scrolling edge, the right edge handle is not app chrome (logged).
7. 12 new audit states, new gesture, regression, back, chrome, empty and layout coverage.
8. No dependency added.

## Audit results
```
lint: pass | build: pass (npm run build, exit 0) | hex: 80 of 90 | css-orphans: 0
1 103 checks passed, 0 failed.
1 1155 checks passed, 0 failed.
1 126 checks passed, 0 failed.
1 128 checks passed, 0 failed.
1 37 checks passed, 0 failed.
1 45 checks passed, 0 failed.
1 51 checks passed, 0 failed.
1 89 checks passed, 0 failed.
1 All 37 concepts review checks pass.
1 All 43 docs checks pass.
1 All Cloudinary upload tests pass.
1 All autosave checks pass.
1 All concepts endpoint tests pass.
1 All concepts lib checks pass.
1 All date cases pass.
1 All deals tests pass.
1 All doc edit checks pass.
1 All lists tests pass.
2 All next action tests pass.
1 All pipeline tests pass.
1 All planner endpoint tests pass.
1 All rules tests pass.
1 All score tests pass.
1 All security tests pass.
1 All send email tests pass.
1 All showcase endpoint tests pass.
1 All template checks pass.
1 All workspace checks pass.
1 Every guard check fails when its guard is cut out (13 guards).
1 Every guard check fails when its guard is cut out (15 guards).

PASS  build                  to /home/user/website/.tmp-verify/preship/dist
PASS  layout-audit           469 views clean at 390,1280
PASS  scene-audit            2 profiles clean (390x720, 1280x800)
PASS  lint                   
PASS  hex count              hex 80 of 90
PASS  gesture-test           Steps: 14. Failures: 0.
PASS  chrome-audit           States: 109. Failures: 0.
PASS  empty-audit            Screens: 13. Failures: 0.
PASS  docs-editor-audit      All doc editor checks pass.
PASS  docs-flow-audit        All docs flow checks pass.
PRE-SHIP PASSED
Rows: 226. Gaps: 31 (fit 13, entrance 6, skeleton 3, cls 5, empty 2, error 2).

Steps: 14. Failures: 0.
States: 109. Failures: 0.
Screens: 13. Failures: 0.
Steps: 92. Failures: 1.
Steps: 16. Failures: 0.
Rows: 530. Violations by impact (nodes): critical 0, serious 0, moderate 0, minor 0.
a11y both themes: Rows: 530. Violations by impact (nodes): critical 0, serious 0, moderate 0, minor 0.
```

Exemption counts, audit-screens.mjs, before then after: noFit 28 then 28; static 46 then 49 (clients-docs-empty shares the filled state's skeleton, doc-keyboard and doc-save-failed have no skeleton of their own); noEmpty 3 then 3; noError 1 then 1. layout-audit's sideways scroller list gained `.dc-bar-row` (the formatting bar scrolls on a phone, with an edge fade). feel-audit noFit count: 28. chrome-audit state count: 109 (was 97). Feel gap rows (dark, normal, 390 and 1280): 22, none on a docs screen; the baseline had 23. The clients-detail fit gap is unchanged from baseline at all five widths (285, 345, 232, 381, 252 px).

## Not run in full (said plainly)
The full feel audit over both themes and both motion modes (about 3.5 hours) was stopped and replaced by dark, normal at 390 and 1280. layout-audit and scene-audit in the final gate ran at 390 and 1280 (preship quick), not all five widths; earlier in the job layout-audit ran at all five widths on an earlier build and on the client views at 320 and 768 after the editor fixes. The docs states pass the feel audit at all five widths in dark.

## Audits edited, and why
audit-fixtures and mock-server (docs fixtures and route); audit-screens (12 states, Doc templates tab); chrome-audit (names for new states); empty-audit (Docs, Client docs); gesture-test (3 steps); layout-audit (docs views, Doc templates tab, `.dc-bar-row`); regression (step 30d; 25a now expects Docs on the More screen, a screen that changed on purpose); back-test (All docs); preship (two docs audits); security-test (section 4d); fake-mongo (exclusion projection and date sort for the test helper).

## Security checks, each shown failing with its guard cut out
docs-guard-proof cuts each of 15 guards from a copy of api/ and requires its check to fail: admin-only, block-type, text-cap, block-cap, link-url, image-host, ref-same-client, project-same-client, whitelist, deleted-readonly, purge-needs-deleted, doc-cap, lead-exists, type-whitelist, list-meta. Output: "Every guard check fails when its guard is cut out (15 guards)." Two render checks in security-test 4d: the HTML sink detector catches each sink, and no docs file writes HTML.

## Needs Rob's phone (mocks and desktop Chromium only so far)
The keyboard bar on iPhone (visualViewport), print to PDF on iOS Safari, an image upload into a doc through the real Cloudinary preset, reorder and swipe gestures on a real device, long press text selection with the block swipe gate, the edge handle on that phone.

## Stale docs fixed
ARCHITECTURE (route count 14 to 20, screens and gestures tables, a Client docs section), COMPONENTS, SECURITY-AUDIT, QA-CHECKLIST, CLAUDE.md, MOBILE-PROGRESS, MOBILE-DECISIONS, the Recently Deleted copy.

## Not done
Text that failed to save survives Back but not a browser reload. Duplicate has no swipe (one action a side; it is in the sheet and menu). The docs list carries each doc's block text for search. A deleted doc leaves its images on Cloudinary. The carried gaps (the submission push has no Settings switch, the pre-existing feel gaps) remain.
