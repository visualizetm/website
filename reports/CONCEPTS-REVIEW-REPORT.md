# Concepts review: Review each and whole section reveal

Final code commit: `aa7873b` (2026-10-05). This report and the progress notes are committed after it.

## What changed (8 lines)

1. Each concept set has an Approval mode (Pick one is the default and every older set reads as it; Review each asks an answer on every item that needs one), Needs a decision or For reference per item, and Allow "Not this one" per set. The editor shows "Client will review 4 items" and refuses to send a review set with nothing to decide.
2. The public page is rebuilt as one section per direction (visual, name and description, decision panel) that reveals as one unit, with no pinned scene and no scroll linked reveal; two columns with a sticky panel at 1280, stacked with 44px full width buttons below 768.
3. Review each saves every answer as it is given, shows "2 of 4 reviewed" and Send my answers in a bar fixed to the bottom (a tap on the count jumps to the next unanswered section), a summary sheet ("Here's what you picked", each row jumps back to its section), one send, and a read only thank you state that survives a reload.
4. The handler (api/_routes/concepts-public.js, no new function) gained decide and submit with 13 guards; the admin route locks the mode once the client has sent, keeps the client's answers across editor saves, and has Reopen for review.
5. One submission makes one task (Review concept answers, unless an open one exists), one push and one in-app note.
6. Rob's editor lists every answer with its note and time and a summary line, and Log as a round opens the existing Log a round modal (now shared in src/components/RoundLog.jsx) with the change notes as one round; nothing is logged for him.
7. The client page's Concepts card, the Concepts list and the menu read "Waiting on client, 2 of 4" or "3 approved, 1 needs changes" for a review set, and today's wording for Pick one.
8. Carried gaps: clients-profile and clients-profile-add are measured with no exemption (a phone refresh on the Profile screen now has its own skeleton and `?sec=profile` deep link). Commits: efda95a (1), 397c843 (2), f9d0467 (3 and 4 together, because the section card, its reveal and its decision panel are one component), 47bb54b and later (5), then the audits, docs and skeleton fixes.

## Audit results (final build)

| Audit | Result |
|---|---|
| lint, hex count | pass, hex 80 of 90 (unchanged) |
| build | pass |
| unit and handler tests | pass (security-test 1110 checks, was 1073 before section 4c; concepts-review-test 37; concepts-lib-test 19; guard proof 13 of 13) |
| back-test, regression (90 steps), site-regression (16 steps, 2 new) | pass |
| a11y-audit, both themes | pass, 484 rows, zero violations |
| layout-audit, five widths | pass, zero offenders (the preship run: 443 views at 390 and 1280) |
| scene-audit, Home five widths, reduced motion 390 | pass; the concepts page (five states) at five widths and reduced motion: pass |
| gesture-test, chrome-audit, empty-audit | pass: 11 steps, 97 states, 11 screens |
| security-test, pipeline-test | pass |
| npm run preship | PASS (run alone; the first run overlapped my unit tests, which cleared its working folder, and failed on every line, an artifact of how I ran it) |
| feel-audit, both themes, both motion modes, 390 and 1280 | 812 rows, 124 gaps. Not clean, and not new: the same audit on the commit before this job (dark, normal) has 23 gap rows in 197 rows; the final build has 22 in the same 203 rows plus the 6 new ones. No row that was clean before is a gap now |

Exemptions before and after (counted as `noFit: true` entries in scripts/audit-screens.mjs): 28 before, 28 after (the two profile entries lost theirs; two new Review each editor states, Setup and Sent, carry one for the same reason as their sibling editor states: the loaded editor is far taller than its three card skeleton). The target of 13 in the brief could not be reproduced by any count I tried (that report's 13 to 15 is not the number of `noFit` entries, which was 27 then 28); I report the count I can define. Sideways scroller allowances in layout-audit: 20 before, 20 after. No other exemption was added or loosened.

Chrome-audit state count: the script's own line says 97 now. At the commit before this job the same script counts 94 (computed from that commit's audit-screens with the script's filter), so 94 was the right earlier number and the 95 in the last report was wrong; 97 = 94 plus the three Review each editor states.

## Audits edited, and why

- scripts/scene-audit.mjs: a concepts mode, because the page no longer has scenes. Checks, made a moment after every scroll: a section with any part on screen is already revealed, no piece inside a section animates by itself, no step or reveal attribute inside a section, reduced motion shows every section whole, and the progress bar never covers the last decision button at the bottom. I proved it by making the reveal late (a 400px inset): it failed with "section 2 is on screen but not revealed yet" at four positions; I put the code back.
- scripts/layout-audit.mjs: it did not cover the public concepts page at all; it now walks every concepts state (11 of them, including the 6 new) at five widths. That found the page's images were not in .img-fit boxes (fixed in the page, not the audit). One audit change: the overlap check's overlay layer list now names the concepts approve panel, summary sheet and viewer, as it already names .v-sheet and .pl-panel.
- scripts/site-regression.mjs: step 14 clicks "Send to me" and reads `.cp-thanks` (the Pick one copy moved to first person, and the approved banner is now a plain thanks line); steps 15 and 16 are new (the Review each walk, and reduced motion).
- scripts/audit-screens.mjs and scripts/audit-fixtures.mjs: six public Review each states, three Review each editor states, five review sets and a mock of decide and submit; the two profile entries open the Profile screen by `?sec=profile` on a phone instead of clicking after load.
- scripts/security-test.mjs: section 4c (the review guard checks).
- scripts/feel-audit.mjs and the chrome, empty and regression scripts: no change this job.

## New security checks and proof each fails with its guard removed

The 37 checks live in scripts/concepts-review-lib.mjs and run in scripts/concepts-review-test.mjs and security-test section 4c. scripts/concepts-guard-proof.mjs copies api/, cuts one guard out of the real source, runs the same checks and requires that guard's own check to fail. Verbatim output is below; every guard fails when removed. Guards: another set's item id, note cap (1,000), HTML stripped from notes, For reference refused, Not this one refused when off, Needs changes needs a note, wrong mode 409, Send with an unanswered item 400, second submit 409, answer after submit 409, send a review set with nothing to decide, the admin lock after a submission, and the client's answer surviving an editor save. The token, rate limit and 404 checks are the existing ones (concepts-endpoint-test).

## Only tested with mocks (needs Rob's phone)

- The real link on an iPhone and an Android: the section reveal, the fixed bar and the safe area, the summary sheet as a bottom sheet, the keyboard over the note box, tap targets by thumb.
- The push on submit: tested only as "the push path ran once" (the subscriptions were read once); no device received one. It is gated on settings.notifications.reminders.concepts (unset reads as on); there is no switch for it in Settings.
- The in-app note for a submission (concepts-answered in the drawer) has no automated test; the Pick one notes do (step 14).
- Reduced motion with the real OS setting: tested by browser emulation and the in-app switch.
- Real images (Cloudinary) in the section visuals: the audits use the fixture SVGs.

## Stale docs fixed

docs/ARCHITECTURE.md (the concept_sets schema, both routes, the public endpoint, the tests), docs/SECURITY-AUDIT.md (the new guards and the notes rule for that door), docs/CONCEPTS-AUDIT.md (a Review each section), docs/COMPONENTS.md (useRoundLog, SocialsStrip), docs/SITE-QA-CHECKLIST.md (row 14 no longer says pinned scenes; rows 15 to 17), CLAUDE.md (the concepts rule and the new scripts), docs/MOBILE-DECISIONS.md and docs/MOBILE-PROGRESS.md.

## Not done, or done differently

- Image pins: the page has none, so change notes are text, as the brief says.
- The unit a client answers is a direction (its name, description and all its images), not a single image, per the rule for multi image items; logged in MOBILE-DECISIONS.md.
- Clients: client detail at 390 has a fit gap (345px) that the feel audit shows at the commit before this job too; I did not change that skeleton.
- The target noFit count of 13 (see above).
- The push has no Settings switch.

## Verbatim audit lines

### Unit and handler tests (verbatim)

```
security-test: All security tests pass.
pipeline-test: All pipeline tests pass.
next-action-test: The server results are identical in America/New_York and UTC.
lists-test: All lists tests pass.
score-test: All score tests pass.
send-email-test: All send email tests pass.
deals-test: All deals tests pass.
planner-endpoint-test: All planner endpoint tests pass.
showcase-endpoint-test: All showcase endpoint tests pass. (re-run alone; the first run overlapped a preship build that cleared .tmp-verify)
concepts-endpoint-test: All concepts endpoint tests pass.
concepts-review-test: All 37 concepts review checks pass.
concepts-lib-test: All concepts lib checks pass.
tasks-test: 65 passed, 0 failed.
task-reminder-test: 26 passed, 0 failed.
dates-test: All date cases pass.
security-test checks: 1110 checks passed, 0 failed.
```

### Hex count, css orphans

```
Raw hex literals in src + api: 80  (unique: 47)
No orphan class selectors across 1627 classes in 246 files.
```

### Guard proof (verbatim, scripts/concepts-guard-proof.mjs)

```
ok   belongs        cut 2 lines: check "a direction id from another set is the same 404 and writes nothing, here or there" fails with the guard removed (also failing: guard-html, guard-reference, guard-complete, submit-ok, submit-task, submit-push, submitted-r
ok   note-cap       cut 1 line: check "a note is cut at 1,000 characters" fails with the guard removed
ok   strip-html     cut 1 line: check "HTML tags are stripped from a note before it is stored" fails with the guard removed
ok   reference      cut 2 lines: check "an answer on a For reference direction is refused and nothing is stored" fails with the guard removed
ok   pass-off       cut 2 lines: check "Not this one is refused when the set does not allow it" fails with the guard removed
ok   changes-note   cut 1 line: check "Needs changes without a note is 400 and nothing is written" fails with the guard removed
ok   mode           cut 4 lines: check "a review answer on a Pick one set, and approve or change on a Review each set, are 409 and write nothing" fails with the guard removed
ok   complete       cut 1 line: check "Send my answers with one still unanswered is 400, names it, and does not lock" fails with the guard removed
ok   locked         cut 2 lines: check "a second submit is 409 and adds no task, push or submission" fails with the guard removed
ok   locked-decide  cut 2 lines: check "an answer after submit is 409 and the saved one stands" fails with the guard removed
ok   send-zero      cut 1 line: check "a Review each set with nothing that needs a decision cannot be sent" fails with the guard removed
ok   admin-lock     cut 1 line: check "after a submission the mode, Not this one and which items need an answer are locked (409)" fails with the guard removed (also failing: after-reopen)
ok   keep-decision  cut 1 line: check "rewriting directions[] from the editor keeps the client's saved answer" fails with the guard removed
Every guard check fails when its guard is cut out (13 guards).
```

### a11y-audit, both themes, every state

```
Rows: 484. Violations by impact (nodes): critical 0, serious 0, moderate 0, minor 0.
```

### layout-audit, five widths, every state (320, 390, 430, 768, 1280)

```
All routes clean at every width, zero offenders.
```

### layout-audit, the marketing block again on the final build (includes every concepts state)

```
All routes clean at every width, zero offenders.
```

### a11y-audit, marketing states again on the final build

```
Rows: 78. Violations by impact (nodes): critical 0, serious 0, moderate 0, minor 0.
```

### regression, back-test, site-regression (final build for site-regression)

```
Steps: 90. Failures: 0.
All steps pass.
Steps: 16. Failures: 0.
```

### gesture-test, chrome-audit, empty-audit

```
Steps: 11. Failures: 0.
States: 97. Failures: 0.
Screens: 11. Failures: 0.
```

### scene-audit: Home, five widths and reduced motion at 390

```
Home: f-scene__.log
| 320x500 | 21 | 17.9 | 90% | clean |
| 390x720 | 21 | 16.4 | 95% | clean |
| 430x800 | 21 | 16.2 | 95% | clean |
| 768x1024 | 21 | 21.8 | 95% | clean |
| 1280x800 | 21 | 22.2 | 89% | clean |
Home: f-scener__.log
| 390x720 reduce | 21 | 9.2 | 91% | clean |
```

### scene-audit: the concepts page (final build), five widths and reduced motion

```
Concepts: g-scene-cncpALLINtoken01234567890abcde.log
| 320x500 | 21 | 7.0 | 54% | clean |
| 390x720 | 21 | 5.0 | 44% | clean |
| 430x800 | 21 | 4.7 | 43% | clean |
| 768x1024 | 21 | 4.2 | 40% | clean |
| 1280x800 | 21 | 3.9 | 43% | clean |
Concepts: g-scene-cncpREVIEWtoken0123456789abc.log
| 320x500 | 21 | 6.4 | 58% | clean |
| 390x720 | 21 | 4.6 | 41% | clean |
| 430x800 | 21 | 4.3 | 40% | clean |
| 768x1024 | 21 | 3.9 | 42% | clean |
| 1280x800 | 21 | 3.8 | 45% | clean |
Concepts: g-scene-cncpTESTtoken0123456789abcdEF.log
| 320x500 | 21 | 9.0 | 85% | clean |
| 390x720 | 21 | 6.4 | 78% | clean |
| 430x800 | 21 | 5.9 | 76% | clean |
| 768x1024 | 21 | 4.1 | 64% | clean |
| 1280x800 | 21 | 4.6 | 82% | clean |
Concepts: g-scener-cncpALLINtoken01234567890abcde.log
| 390x720 reduce | 21 | 5.0 | 45% | clean |
Concepts: g-scener-cncpREVIEWtoken0123456789abc.log
| 390x720 reduce | 21 | 4.6 | 41% | clean |
Concepts: g-scener-cncpTESTtoken0123456789abcdEF.log
| 390x720 reduce | 21 | 6.4 | 78% | clean |
```

### feel-audit, both themes and both motion modes at 390 and 1280

```
Rows: 812. Gaps: 124 (fit 52, entrance 24, skeleton 12, cls 20, empty 8, error 8).
The same audit on the commit before this job (2696792), dark and normal, 390 and 1280: Rows: 197. Gaps: 32 (fit 13, entrance 6, skeleton 3, cls 6, empty 2, error 2).
```

### npm run preship (final build, run alone)

```
PASS  build                  to /home/user/website/.tmp-verify/preship/dist
PASS  layout-audit           443 views clean at 390,1280
PASS  scene-audit            2 profiles clean (390x720, 1280x800)
PASS  lint
PASS  hex count              hex 80 of 90
PASS  gesture-test           Steps: 11. Failures: 0.
PASS  chrome-audit           States: 97. Failures: 0.
PASS  empty-audit            Screens: 11. Failures: 0.
PRE-SHIP PASSED
```
