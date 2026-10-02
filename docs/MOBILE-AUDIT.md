# Mobile audit (baseline)

Taken on commit dc0beda (the app is unchanged since 5a3bb7a, the guide is the only commit since), at 390 by 844 with a touch profile, dark theme, against the audit fixtures. The rubric is docs/MOBILE-UI-GUIDE.md (R1 to R22, condensed in the revamp prompt). Numbers come from `scripts/mobile-measure.mjs` (82 admin states, reproducible with `node scripts/mobile-measure.mjs`), plus the earlier status report for 320, 768 and 1280.

Desktop notes (1280): D6 the client record title truncates to "LEAD BU..." because the buttons and pills take the width, D7 the sidebar stats widget overlaps its percent badges. 768: 17 views overflow by up to 20px at `.rc-ctx-part`. 320: four money views overflow at `.v-lrow-side`.

## What the baseline says in one paragraph

The app is already far along: records on a phone are a first screen of identity, the next action and rows (Project, Money, Files, Retainer, Notes, History, Details with a summary on each), but a row opened its section as an inline accordion on the same page (corrected after milestone 4: it did not push a screen), editors are separate pages, Back is one history model, every list has a first-time empty state, and there are no cards three deep on any list screen. What is wrong is the chrome and a few specifics: the tab bar is on all 82 states (R5, R11 fail), the top bar offers Search, Quick add and Notifications on every screen including records, editors and the call room (R12, R13 fail), More is a 3 by 5 grid in a sheet (R3, R6, R10), the tab labels are 10px (R4), search fields are 42px, the lead phone number is a 15px link, two search no-results states are wrong, and a few screens are crowded above the fold (Leads has nine controls before the first row).

## Tab usage ranking (decision input)

Badge and notification counts at the fixtures, with UX-AUDIT use notes: Next up 7 (the first screen), Call 3 (callbacks), Lists 1, Deals 1, More 28. The current tabs (Next up, Lists, Call, Deals, then More) are the four screens the badges say are the day's work. Decision: leave the tabs alone. What changes is More (a full screen with counts on the right of rows) and the 11px label.

## Screens

Columns: fold = text blocks and controls inside the first 844px, acts = distinct visible control names in the content, tab = bottom tab bar visible (and whether it should be), top = right hand controls plus Back when present (Search, Quick add, Notifications unless noted), cards = deepest card nesting, scroll = sideways scrollers and grids, tap = smallest tap target in px, text = smallest body text in px (tab labels 10 everywhere, badges 11), gestures today (from code).

| Screen | Job in one sentence | fold | acts | tab (should) | top | cards | scroll | tap | text | empty / no results | gestures |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Next up | Show what to do now (two verbs: act and start a call: flag, home exception) | 38t 21c | 19 | Y (Y) | S, Q, N | 1 | 4 tile grid 4x1 | 44 | 12 | yes / n.a. | row swipe done and snooze, long press snooze |
| Leads list | Find a lead to call or open | 47t 38c | 38 (flag: nine controls above the first row) | Y (Y) | S, Q, N | 1 | chip rows scroll sideways | 42 search | 12 | yes / yes | kanban long press drag |
| Lead record | Decide the next step on one lead | 16t 8c | 8 | Y (N) | Back, S, Q, N | 1 | none | 15 phone link | 12 | n.a. | none |
| Call console, lists | Choose what to run | 24t 9c | 7 | Y (Y) | S, Q, N | 1 | none | 44 | 12 | yes / n.a. | none |
| Call console, builder | Set up a session | 44t 17c | 17 | Y (Y) | S, Q, N | 1 | none | 42 select | 12 | n.a. | none |
| Call console, room | Make the call and log the outcome | 21t 17c | 17 | Y (N) | Back, S, Q, N | 1 | outcomes 5x1 | 44 | 12 | n.a. | swipe left and right between leads |
| Call console, summary | Review the session | 21t 3c | 3 | Y (N) | Back, S, Q, N | 2 | 2x3 grid | 44 | 12 | n.a. | none |
| Triage pile | Decide on new leads | 27t 14c | 14 | Y (Y) | S, Q, N | 1 | none | 42 search | 12 | yes / yes | row swipe |
| Triage record | Keep, Later, Decline or Bin one lead | 19t 11c | 11 | Y (N) | Back, S, Q, N | 1 | none | 15 phone link | 12 | n.a. | none |
| Lists grid | Choose a dial list | 24t 10c | 8 | Y (Y) | S, Q, N | 1 | none | 44 | 12 | yes / no search | long press reorder, swipe left |
| List detail | Work the members of one list | 17t 12c | 12 | Y (N) | Back, S, Q, N | 1 | none | 42 search | 12 | n.a. | reorder, swipe |
| Deals list | Find a deal | 20t 5c | 5 | Y (Y) | S, Q, N | 1 | none | 42 search | 12 | yes / BLANK (D1) | none |
| Deal record | Move a deal toward paid | 30t 15c | 14 | Y (N) | Back, S, Q, N | 1 | none | 15 phone link | 12 | n.a. | none |
| Calendar day | See what is booked today | 47t 30c | 25 | Y (Y) | S, Q, N | 2 | week strip 7x1 | 44 | 10 | empty state missing (no empty copy) | swipe week (on a sideways area) |
| Calendar week | See the week | 46t 24c | 24 | Y (Y) | S, Q, N | 1 | 8 column grid | 44 | 10 | as above | swipe |
| Calendar month | See the month | 87t 55c | 55 | Y (Y) | S, Q, N | 0 | 7 column grid | 44 | 0 (day numbers hidden text) | as above | swipe |
| Clients list | Find a client | 31t 14c | 14 | Y (Y) | S, Q, N | 1 | none | 42 search | 12 | yes / yes | none |
| Client record | Run one client | 21t 10c | 10 | Y (N) | Back, S, Q, N | 1 | none | 44 | 12 | n.a. | none |
| Client money | See and mark invoices | 32t 10c | 10 | Y (N) | Back, S, Q, N | 3 | none | 44 | 12 | n.a. | none |
| Projects | Find a project | 40t 7c | 7 | Y (Y) | S, Q, N | 1 | none | 42 search | 12 | yes / WRONG card (D2) | none |
| New project | Start a project | 29t 12c | 12 | Y (N) | Back, S, Q, N | 1 | none | 42 | 12 | n.a. | none |
| Showcase editor | Edit what the public site shows | 22t 8c | 7 | Y (N) | Back, S, Q, N | 1 | none | 42 | 12 | n.a. | none |
| Planner editor | Plan and approve a month of posts | 16t 5c | 5 | Y (N) | Back, S, Q, N | 2 | none | 44 | 12 | yes (empty month) | none |
| Concepts list | See which concept sets are out | 54t 11c | 10 | Y (Y) | S, Q, N | 1 | none | 44 | 12 | yes / no search | none |
| Concepts editor | Build a concept set | 18t 10c | 10 | Y (N) | Back, S, Q, N | 2 | grids 2x2 and 2x4 | 42 | 12 | yes (none state) | none |
| Orders list | Track print orders | 49t 14c | 14 | Y (Y) | S, Q, N | 1 | none | 42 search | 12 | yes / "in this filter" wording for a search | none |
| Order record | Move one order along | 84t 9c | 9 | Y (N) | Back, S, Q, N | 1 | 1 sideways area | 42 | 12 | n.a. | none |
| Reviews | Ask clients for reviews | 35t 11c | 11 | Y (Y) | S, Q, N | 1 | none | 42 search | 12 | yes / "in this filter" wording | none |
| Submissions | Read form briefs | 42t 12c | 11 | Y (Y) | S, Q, N | 0 | none | 42 search | 12 | yes / "in this filter" wording | none |
| Settings (Profile) | Change settings (flag: five tabs, a sideways tab strip) | 25t 10c | 10 | Y (Y) | S, Q, N | 1 | tab strip scrolls sideways | 42 | 12 | n.a. | none |
| Settings tabs (Notifications, Integrations, Data, Danger, Emails) | Change one group of settings | 21t to 42t | 5 to 14 | Y (Y) | Back, S, Q, N | 1 to 2 | tab strip, 2 sideways areas in Data | 44 | 12 | n.a. | none |
| Landing | Choose what the public Home shows | 20t 7c | 5 | Y (Y) | S, Q, N | 1 | none | 44 | 12 | not probed (UNVERIFIED) | none |
| Design system | Look at the kit (owner tool) | 38t 1c | 1 | Y (Y) | S, Q, N | 3 | 4x1 and 2x3 | 42 | 10 | n.a. | none |
| More sheet | Reach everything that is not a tab | 41t 16c | 16 | Y (Y) | S, Q, N | 0 | grid 3x5 | 44 | 12 | n.a. | sheet drag |
| Sheets and modals (filters, capture, send, mark paid, task, picker, add detail, decline) | One temporary action each | 28t to 70t | 2 to 11 | Y behind (N) | as screen | 0 | none | 42 to 44 | 12 | n.a. | sheet drag on handle and title |

Reading the top column: Search, Quick add and Notifications are offered unchanged on all 82 states. On a record, an editor and the call room two of the three do nothing for the task (R12, R13).

## Rubric scores (82 states unless stated)

| Item | Result | Number |
|---|---|---|
| R1 reorganize, never shrink | pass | no screen is a scaled desktop; records are rows (their sections were accordions, see the correction above) |
| R2 cut information before size | weak | Leads shows 38 controls above the fold (nine before the first row), Calendar month 55 |
| R3 three or four tabs, five at most | pass for tabs, fail for More | 4 tabs plus More; More is a 15 button grid in a sheet |
| R4 44px targets | fail | 42px: every search field (9 screens), selects, date inputs; 15px: phone number link on lead, triage and deal records; tab labels 10px |
| R5 tab bar not mandatory | fail | visible on 82 of 82 states, should be hidden on about 40 (records, editors, setup pages, the room, summary) |
| R6 one scroll direction, no mini grids | weak | 3 by 5 More grid, 2x3 summary grid, concept item grids, calendar 7 and 8 column grids, 4 stat tiles in one row |
| R7 no card in a card in a card | weak | 3 deep on Client money and Design; 2 deep on 14 states |
| R8 spacing is structure | pass | measured: consistent gutter and gaps via tokens |
| R9 one screen, one job | weak | Leads list (find, filter, sort, import, add, select, three views); Settings (five tab groups in one screen) |
| R10 desktop panels become screens or sheets | pass | editors and setup are pages on a phone, records pushed sections only after milestone 4; More is the exception |
| R11 global nav may disappear | fail | never does |
| R12 top bar controls match the task | fail | 82 of 82 identical right side |
| R13 controls replaced, not accumulated | fail | a record adds Back to the same three controls |
| R14 established gestures where they fit | weak | edge Back is the browser's only; row swipe on Next up, Triage, Lists; none on Leads, Clients, Projects |
| R15 gestures follow the finger | weak | Sheet follows the finger; Back does not; swipes commit on release without tracking (Next up, Triage, Room) |
| R16 bottom sheets for temporary actions | pass | filters, capture, task, picker are sheets; the background does not recede |
| R17 long press for context | weak | only Lists reorder, Next up snooze, kanban drag; no previews |
| R18 motion explains state change | weak | the view enters, but the tab bar and top bar do not transition |
| R19 first-time empty state designed | pass | 11 of 11 probed lists; Calendar has none |
| R20 next action obvious | pass | every probed empty state carries one action |
| R21 empty differs from no results | fail on 2 | D1 blank (Deals), D2 first-time card shown for a search (Projects); wording "in this filter" for a search on Orders, Reviews, Submissions, Clients |
| R22 recovery on failed search | weak | a Clear action exists on 6, none on Deals, Projects, Lists, Concepts |

## Fails per rubric item

R4: 9 search fields, 3 phone links, 10px tab labels. R5, R11: 82. R12, R13: 82. R6: 8 screens. R7: 2 (3 deep) and 14 (2 deep). R21: 2 wrong plus 4 weak wording. R14 R15 R17: gestures are partial.

## The five worst screens

1. Leads list: nine controls before the first row, a 42px search, a sideways chip rail, no gesture (R2, R4, R9, R14).
2. Lead, triage and deal records: a 15px phone link, tab bar and global controls on a focused task (R4, R5, R12).
3. Call room: global chrome around the most focused task, a long scraped name wraps to 8 lines and the Call button sits under the outcome bar at first paint (D3; R9, R11, R12).
4. More sheet: a 3 by 5 grid of 15 buttons in a sheet (R3, R6, R10).
5. Settings: five tabs on a sideways strip instead of rows that push screens (R9, R10).

## PLAN (Milestones 2 to 5)

M2 (red audits): money rows `.v-lrow-side` at 320, `.rc-ctx-part` and siblings at 768, Home scene fit at 320, 768, 1280, the Triage pile skeleton (CLS under 0.02), the Back highlight on Projects (outline, not size), D4 phone link 44px, D6, D7, D8 and the long name rule, regions for Settings Integrations and Danger and for sheets, last rows clear the tab bar, feel audit both themes both motion modes, `npm audit fix` for ip-address only if clean.
M3 (shell): chrome mode per route (tabs or focused) with a slide, tab labels at 11px (drop the label at 320 only if it cannot fit), More as a full screen with counts on the right of rows (R3 R5 R6 R10 R11), a top bar that declares left control, title and right controls per state and replaces them (R12 R13), interactive edge Back that tracks the finger (R15), sheet drag with a receding background (R15 R16 R18).
M4 (one job): lead, deal and client records are already first screen plus rows, so this means each row pushes its own focused screen through nav-history (it did not: the sections were inline accordions, so this was built, not checked); editors become overview plus step screens with one draft; Settings becomes rows that push screens; the Call room keeps the script, outcomes and essentials and moves the rest into one sheet (D3); nested cards (3 deep) flattened; calendar and concept grids reviewed.
M5 (rows and empty states): D1, D2, search wording that names the search, a Retry on every list load failure, row swipe with finger tracking on leads, tasks, planner posts and list members with a menu equivalent, long press sheets on lead, client and project rows.
M6: gesture-test, chrome-audit, empty-audit, the pre-ship command, MOBILE-AUDIT-AFTER.md, doc fixes.
