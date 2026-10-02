# Mobile audit (after)

Taken on the final build of the revamp, at 390 by 844 (and again at 320 by 844: 83 states, no page overflow, the same grids) with a touch profile, dark theme, against the audit fixtures, by scripts/mobile-measure.mjs (the same script and fixtures as docs/MOBILE-AUDIT.md). The rubric is docs/MOBILE-UI-GUIDE.md.

## Before and after

| Measure | Before (dc0beda) | After |
|---|---|---|
| States measured | 82 | 83 |
| States with the tab bar visible | 82 | 41 (the section roots and More; every record, editor, setup page and the call room hides it) |
| Top bar on a record, editor or the room | Search, Quick add, Notifications (plus Back) | Back, the title and only declared actions (Done on a step) |
| Tab bar label size | 10px | 11px |
| More | a 3 by 5 grid in a sheet | a page |
| Nested cards three deep on a list screen | 0 | 0 (only the design page, a developer reference, has 3) |
| Pages that scroll sideways | 0 | 0 |
| Record sections | inline accordions | each a pushed screen; Back on Projects moved 0.18 to 0.20 down to 0.002 |
| Feel audit gaps at 390 (both themes, both motion modes) | not run on every state | 0 of 344 rows |

## Rubric items that still show in the measure, with the reason

- Tap 18 on a phone number link: the anchor is 18px tall but its hit area is extended to 44px by a pseudo element (.rc-tel::after); the measure reads the element's box, the layout audit reads the hit area and passes.
- Tap 42 on inputs and selects (search fields, form fields): the measure reads the input's own box inside a 44px field shell; the layout audit measures the shell and passes at every width.
- Tap 42 on Back or Search: these rows are states with a sheet open, where the screen behind is scaled to 96 percent (the recede); the controls are 44px unscaled and are not reachable while the sheet is up. The layout audit skips that receded screen.
- Text 0 on the calendar month: the day numbers are visually hidden text for screen readers, as in the baseline.
- Sideways scrollers: the Leads filter chips, the client and order stepper (cw-stepper), the data table on Settings Data and the design page tables. None carries a gesture.
- Grids with two or more columns: the Next up tiles (4 by 1), the room's outcome buttons (5 by 1), the calendar day strip and week (one row of 7 and 8), and the design page. The Call summary stats are one row each. The design page also has a 2 by 3 grid.
- Cards three deep: the design page only.

## Every state

| State | Tab bar | Top bar | Card depth | Smallest tap | Smallest text |
|---|---|---|---|---|---|
| dashboard | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| dashboard-snooze | Y | Search, Quick add, Notifications | 0 | 42 | 12 |
| back-leads | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| back-triage | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| back-lists | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| back-deals | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| back-clients | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| back-projects | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| back-orders | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| back-reviews | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| back-submissions | Y | Search, Quick add, Notifications | 0 | 42 | 12 |
| back-dashboard | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| leads-list | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| leads-filters | Y | Search, Quick add, Notifications | 0 | 42 | 12 |
| leads-detail | n | Back | 1 | 18 | 12 |
| calls-lists | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| calls-builder | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| calls-queue | n | Back | 1 | 44 | 10 |
| calls-room | n | Back | 1 | 44 | 12 |
| calls-summary | n | Back | 2 | 44 | 12 |
| triage-pile | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| triage-record | n | Back | 1 | 18 | 12 |
| triage-search | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| triage-keep | Y | Search, Quick add, Notifications | 0 | 42 | 12 |
| triage-capture | Y | Search, Quick add, Notifications | 0 | 42 | 12 |
| lists-grid | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| lists-detail | n | Back | 1 | 42 | 12 |
| lists-fill | n | Back | 0 | 44 | 12 |
| lists-picker | n | Back | 0 | 42 | 12 |
| deals-list | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| deals-detail | n | Back | 1 | 18 | 12 |
| deals-send | n | Back | 0 | 44 | 12 |
| deals-markpaid | n | Back | 0 | 42 | 12 |
| calendar-day | Y | Search, Quick add, Notifications | 2 | 44 | 10 |
| calendar-week | Y | Search, Quick add, Notifications | 1 | 44 | 10 |
| calendar-month | Y | Search, Quick add, Notifications | 0 | 44 | 0 |
| clients-list | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| clients-filters | Y | Search, Quick add, Notifications | 0 | 42 | 12 |
| clients-detail | n | Back | 1 | 44 | 12 |
| task-sheet | n | Back | 0 | 42 | 12 |
| clients-money | n | Back | 1 | 44 | 12 |
| record-add-detail | n | Back | 0 | 42 | 12 |
| projects-list | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| projects-archived | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| project-new | n | Back | 1 | 42 | 12 |
| project-new-retainer | n | Back | 1 | 42 | 12 |
| project-new-pick | n | Back | 1 | 42 | 12 |
| clients-showcase | n | Back | 1 | 44 | 12 |
| clients-showcase-shapes | n | Back | 1 | 44 | 12 |
| planner-on | n | Back | 2 | 44 | 12 |
| planner-off | n | Back | 1 | 44 | 12 |
| planner-empty | n | Back | 1 | 44 | 12 |
| planner-sheet | n | Back | 0 | 42 | 12 |
| planner-sheet-story | n | Back | 0 | 42 | 12 |
| planner-sheet-blocked | n | Back | 0 | 42 | 12 |
| orders-list | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| orders-detail | n | Back | 1 | 42 | 12 |
| concepts-list | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| leads-declined | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| leads-nurture | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| leads-decline-sheet | n | Back | 0 | 42 | 12 |
| concepts-list-filter | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| concepts-editor | n | Back | 1 | 44 | 12 |
| concepts-editor-draft | n | Back | 1 | 44 | 12 |
| concepts-editor-changes | n | Back | 1 | 44 | 12 |
| concepts-editor-approved | n | Back | 1 | 44 | 12 |
| concepts-editor-none | n | Back | 1 | 44 | 13 |
| concepts-editor-dirty | n | Back | 1 | 44 | 12 |
| concepts-editor-menu | n | Back, Done | 0 | 44 | 12 |
| reviews-list | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| reviews-sheet | n | Back | 2 | 42 | 12 |
| submissions-list | Y | Search, Quick add, Notifications | 0 | 42 | 12 |
| submissions-detail | n | Back | 2 | 42 | 12 |
| settings-profile | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| settings-notifications | n | Back | 1 | 44 | 12 |
| settings-integrations | n | Back | 1 | 44 | 12 |
| settings-data | n | Back | 2 | 44 | 12 |
| settings-danger-zone | n | Back | 1 | 44 | 12 |
| design | Y | Search, Quick add, Notifications | 3 | 42 | 10 |
| landing | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
| settings-emails | n | Back | 1 | 44 | 12 |
| notifications | Y | Search, Quick add, Notifications | 1 | 42 | 12 |
| more | Y | Search, Quick add, Notifications | 1 | 44 | 12 |
