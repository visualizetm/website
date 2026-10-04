# Client page workspace redesign: build report

Commits: 82f62e3 (milestones 1 to 4, the record) and the one after it (milestone 5: the audits, the docs, this report). Date: 2026-10-04.

## What changed

1. The client record's top is two sections: a Profile card (avatar, the name wrapping to two lines, contact person, area and industry, phone, email; seven channel buttons that never hide, Copy phone, Copy brand, Open profile) and a Workspace of four cards (Showcase, Planner, Tasks, Concepts) with a status line, a tiny visual and one primary action each.
2. The full profile is the record's `profile` section: a pushed screen on a phone (Back through nav-history), a side panel on a computer, grouped Contact, Online, Business, Brand, Notes, every row tap to edit, Add a detail, Edit all as the header action.
3. The four status lines are one module, src/lib/workspace.js, read by the cards and by the lead and deal menus; the showcase completeness rule moved to src/lib/showcaseMeter.js so the editor's meter and the card's "ready" are one function.
4. The Tasks card reads the Next up rule (the pinned task or the earliest due open task) and completes a task from its check circle; the Tasks tab and the Tasks row redirect to the Tasks screen.
5. A Quick actions chip row (Set a callback, New project, Start a retainer, Set or Edit task, Priority and status) sits under the cards; the client menu keeps Edit all, Priority and status, Delete.
6. The workspace sizes itself by the record's own width (a container query): stacked on a phone and at 768, the profile beside the cards from 700px of record width, four cards across from 1000px; the channel row scrolls sideways on a phone and wraps on a computer.
7. The header drops its duplicated context line on a client; the name wraps instead of truncating at every width.
8. The client skeleton draws the profile card, the four cards and the chip row so the loaded screen lands on the same rows.

## Audits (pass or fail, exemptions before and after)

| Audit | Result | Exemptions before, after |
|---|---|---|
| lint | pass | 0, 0 |
| build | pass | |
| hex count | pass, 80 of 90 (unchanged; one hex literal in new copy was removed before it landed) | |
| css-orphans | pass, 0 | |
| handler tests (tasks, share, task-reminder, planner-endpoint, security, next-action, dates, deals, lists, score, send-email, rules, pipeline, showcase and concepts endpoints) | pass, untouched by this work | |
| back-test (390 and 1280) | pass, with the New project, Showcase, Planner and Tasks steps pointed at the moved controls and one new Profile step | 0, 0 |
| regression (90 steps, 390 and 1280) | pass, 17 and 17b through the quick actions | 0, 0 |
| site-regression | pass (unchanged, run in the previous prompt against the same marketing build; the client record is not on that walk) | |
| a11y-audit (clients group) | pass, 28 rows, zero violations | 0, 0 |
| layout-audit (clients block, 320, 390, 430, 768, 1280) | pass, zero offenders | sideways scrollers allowed: 18 before, 20 after (.rc-pf-actions, .rc-quick) |
| scene-audit | unchanged (Home and the concepts page are not touched); last full pass in the previous prompt's preship:full | |
| gesture-test | pass, 11 steps | 0, 0 |
| chrome-audit | pass, 95 states (clients-profile and clients-profile-add focused) | 0, 0 |
| empty-audit | pass, 11 screens | 0, 0 |
| security-test, pipeline-test | pass, untouched | |
| feel-audit (clients group) | no new failures: the fit gap on the client's first screen and the showcase editor's entrance gap at 1280 are pre-existing (the previous prompt's full run shows the same lines); noFit on clients-profile and clients-profile-add (a panel or a pushed screen, scrolled states) | noFit entries 13 before, 15 after |
| npm run preship | pass: build, layout-audit 419 views clean at 390 and 1280, scene-audit 2 profiles clean, lint, hex 80 of 90, gesture-test 11, chrome-audit 94 states, empty-audit 11 screens. PRE-SHIP PASSED | |

## Audits edited, and why

- scripts/regression.mjs, steps 17 and 17b: New project and Set task moved from the menu to the quick actions, so the steps click the chips (`.rc-quick-chip--newproj`, `.rc-quick-chip--task`). Nothing else in the steps changed.
- scripts/back-test.mjs: `fromRecord` opens the editors from the workspace card buttons and the quick action chip instead of the menu; one new step walks the profile screen on a phone and Back out of it.
- scripts/layout-audit.mjs: the client walk gains the profile panel or screen and its Add a detail sheet; New project opens from the chip; `.rc-pf-actions` and `.rc-quick` join the sideways scroller allow list (seven 44px targets do not fit 320).
- scripts/audit-screens.mjs: `clients-profile` and `clients-profile-add` added (noFit, scrolled states); `clients-tasks-section` removed because the Tasks section is a card now and the entry would walk off to the Tasks screen.
- scripts/chrome-audit.mjs: `clients-profile.*` must be focused.

## Each edited gate fails with the fault put back

A copy of the app was built with three faults (the Quick actions row not rendered, the Open profile button missing, `.rc-pf-actions` not on the scroller allow list) and served on another port. Against it: regression fails steps 17 and 17b, back-test fails "New project page: Back returns to the record" and "Profile: a pushed screen on a phone", layout-audit at 320 flags the channel row as a sideways scroller. The exact lines are at the end of this file.

## Only tested with mocks, needs Rob's phone

- The seven channel buttons' real handoff (tel:, sms:, mailto:, Instagram, Facebook, Maps) on a phone; the audits only check the targets and the dimmed state.
- The Tasks card's check circle against the live database (the audits write to the mocked route).
- The side panel profile on a real desktop browser at 1280 with the Clients list open (the audit measures Chromium headless).

## Stale docs fixed

- docs/COMPONENTS.md names the record's workspace pieces (ProfileCard, ProfileSection, WorkspaceCards, QuickActions).
- docs/ARCHITECTURE.md's Clients row says what the client page is now.
- docs/MOBILE-DECISIONS.md and docs/MOBILE-PROGRESS.md carry this job's decisions and a plan to resume from.

## Not done, and why

- The published date on the Showcase card: `showcase` stores `published` but no `publishedAt`, and the rules forbid new fields, so the card shows the state and the image count.
- Four cards across at 1280 in the Clients split view: the record there is about 740px wide (the list column takes the rest), so four cards would be 115px each; the container query gives four across only when the record has 1000px, and two by two beside the profile otherwise.
- One commit per milestone: LeadDetail wires the profile, the cards and the quick actions in one place, so milestones 1 to 4 are one buildable commit and milestone 5 (the audits, the docs, this report) is the second.

## The fault runs, verbatim

```
# layout-audit, AUDIT_ONLY=clients AUDIT_WIDTHS=320, .rc-pf-actions off the allow list
  FAIL [320px] client detail (project, plan client), scrollW=320 vw=320
  FAIL [320px] client detail (the profile), scrollW=320 vw=320
  FAIL [320px] client detail (profile, add a detail sheet), scrollW=320 vw=320
  FAIL [320px] client detail (project), scrollW=320 vw=320
  FAIL [320px] new project sheet, scrollW=320 vw=320

# regression, the Quick actions row not rendered
  FAIL [390] 17. New project from the quick actions is a page at every width; Create opens the record on Project: locator.click: Timeout 6000ms exceeded.
  FAIL [390] 17b. Set a task on the client record: the strip shows the label and the time: locator.click: Timeout 6000ms exceeded.
  FAIL [1280] 17. New project from the quick actions is a page at every width; Create opens the record on Project: locator.click: Timeout 6000ms exceeded.
  FAIL [1280] 17b. Set a task on the client record: the strip shows the label and the time: locator.click: Timeout 6000ms exceeded.
| 17 | New project from the quick actions is a page at every width; Create opens the record on Project | FAIL: locator.click: Timeout 6000ms exceeded. | FAIL: locator.click: Timeout 6000ms exceeded. |

# back-test, the Open profile button and the Quick actions row missing
  FAIL [390] Profile: a pushed screen on a phone, Back returns to the record: locator.click: Timeout 6000ms exceeded.
  FAIL [390] New project page: Back returns to the record: locator.click: Timeout 6000ms exceeded.
  FAIL [1280] New project page: Back returns to the record: locator.click: Timeout 6000ms exceeded.
3 failing.
```
