# QA checklist: the daily walk

The manual regression walk, phone first, in the order Rob uses the admin on
a normal day. Every step names one action and the one result to expect.
`node scripts/regression.mjs` runs the same walk against the audit fixtures
in Playwright at 390 and 1280 (the numbers match the steps below); the
release gate is that script plus the audits in docs/RUNBOOK.md.

Before the walk: a fresh build deployed, the phone signed out, Reduce motion
off, theme Dark.

| # | Do | Expect |
|---|---|---|
| 1 | Open admin.visualizeclients.com on the phone | The shell frame paints at once, the login card appears, no blank screen. |
| 2 | Sign in with the password | The Dashboard greets you by name with today's date and the context line. |
| 3 | Read the Dashboard | Funnel strip, the stats, and the Today card are filled; no skeleton lingers. |
| 4 | Tap Start call session | The Call Console builder opens with the status and priority chips and a lead count on the Start button. |
| 5 | Tap Start call session in the builder | The queue (phone) or the room (desktop) opens with the first lead's card. |
| 6 | Tap the first lead in the queue (phone) | The call room shows the name, pills, the phone button, and the script tab. |
| 7 | Tap No answer, then Log | The sheet closes, the room moves to the next lead, the position reads 2 of N. |
| 8 | Tap Callback, pick a quick time, then Set callback | The sheet closes, the next lead shows, the callback lands on the Calendar and the drawer. |
| 9 | Tap Wrong number, then Log | The sheet closes and the phone note on that lead reads Wrong number with today's date. |
| 10 | Tap Said no, then Log | The lead leaves the console with an undo toast for six seconds. |
| 11 | Tap Booked, set a date and time, then Book it | The header pulses green, the sheet closes, the lead moves to Booked. |
| 12 | Open Booked | The list shows the booked leads with the meeting date; the one you just booked is there. |
| 13 | Open the booked lead | The detail opens on Overview with the meeting block and the Pricing options block. |
| 14 | Tap Add option twice in Pricing options | Two option cards appear with a package, a total, and the plan line. |
| 15 | Tap Mark as won, then Won, convert to client | The profile pulses red, the detail closes, and the Clients badge ticks up. |
| 16 | Open Clients and tap the client | The client detail opens with Projects, Payments, Retainer, and Deliverables tabs. |
| 17 | On Projects tap New project, keep the package, tap Create | The sheet closes and the project card shows its stage and schedule. |
| 18 | On Payments tap Mark paid on the first due line, confirm | The row pulses and its pill reads Paid; the ledger gains the entry. |
| 19 | On Retainer tap Start a retainer, keep the plan, tap Create | The retainer card shows the plan and amount and the tab pulses. |
| 20 | Open a retainer client, on Retainer tap Log delivery, enter a count, tap Log | The month's delivered count goes up and the log line appears. |
| 21 | Open Print Orders and tap New order | The New order sheet opens with the customer fields and the item picker. |
| 22 | Type a name, add one item, tap Create | The sheet closes and the order shows at the top of the list as New. |
| 23 | Open that order and tap Mark paid, confirm | The paid line replaces the button and the customer card pulses. |
| 24 | Open Concepts and tap New pack | The New pack sheet opens with the title field focused. |
| 25 | Type a title and tap Create | The sheet closes and the pack card appears in the grid. |
| 26 | Open Reviews and open a client, tap Log ask | The asks list gains today's entry and a toast confirms it. |
| 27 | Open the Calendar | Day view shows today's meetings and callbacks, including the callback from step 8. |
| 28 | Tap the bell | The notifications drawer lists today's items with the callback from step 8. |
| 29 | Settings, Profile, Appearance: tap Light | The whole admin turns light at once; the sidebar stays black. Tap Dark to return. |
| 30 | Settings, Profile, Appearance: turn Reduce motion on | Skeleton shimmer, entrances, and pulses stop; turn it off again. |
| 31 | More (phone) or the avatar (desktop), Sign out | The login card returns. |
| 32 | Sign in again | The Dashboard returns with the same data and the theme you left. |

Also once per release, by hand:

- Install to the Home Screen on the phone and open it: the boot frame shows, then the shell, without a browser bar.
- Turn on Airplane mode with the app open: the offline banner appears, every screen still reads, a write shows the refused toast, and the banner clears when the network is back.
- Send a test push from Settings, Notifications: it arrives on the phone and opens the right screen.
