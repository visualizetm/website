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
| 2 | Sign in with the password | Next up greets you by name with today's date and the context line (how many overdue and due today). |
| 2a | Look at the bottom of the phone | The tab bar reads Next up, Lists, Call, Deals, More. More opens Triage, Leads, Clients, Projects, Orders, Reviews, Calendar, Submissions, Recently Deleted, Concepts, Declined, Settings and a greyed line naming Showcase, Planner, Concepts editor, Landing and Design as computer only. |
| 3 | Read Next up | The overdue rows come first in red, then today, then Later this week folded; each row's control does the action (a callback dials, an outcome opens the record on the meeting fold). Swipe a row right to mark it done and undo from the toast; open Stats and the funnel strip and the numbers are filled; no skeleton lingers. |
| 4 | Tap Start call session | The Call Console builder opens with the status and priority chips and a lead count on the Start button. |
| 5 | Tap Start call session in the builder | The queue (phone) or the room (desktop) opens with the first lead's card. |
| 6 | Tap the first lead in the queue (phone) | The call room shows the name, pills, the phone button, and the script tab. |
| 7 | Tap No answer, then Log | The sheet closes, the room moves to the next lead, the position reads 2 of N. |
| 8 | Tap Callback, pick a quick time, then Set callback | The sheet closes, the next lead shows, the callback lands on the Calendar and the drawer. |
| 9 | Tap Wrong number, then Log | The sheet closes and the phone note on that lead reads Wrong number with today's date. |
| 10 | Tap Booked, set a date and time, then Book it | The header pulses green, the sheet closes, the lead moves to Booked. |
| 11 | On the last lead tap Said no, then Log | The lead leaves the console with an undo toast for six seconds, and the session summary appears. It is parked in Nurture for 90 days (Leads, Pool: Nurture shows the day it comes back), not deleted; Undo puts it back on the list it came from, in its old place. |
| 11a | Open Triage; on a phone swipe the top card right, or tap the red check; on a desktop press K on the focused row | The Keep sheet opens with priority and best window; tap Hot, then Done. The card leaves with a "kept" undo toast and the lead is in Leads Open. Swipe left or X bins it (undo restores); the clock or L parks it 30 days; swipe down or D opens Decline. |
| 11b | Tap the plus button, Capture a lead, type @thebakeryco, tap Capture | The toast reads "Captured. It is waiting in Triage." and the pile gains a card with only the Instagram filled. |
| 11c | Open Leads, open a lead's menu and tap Decline, pick Out of area, tap Decline | The sheet closes, the lead leaves the list with a six second undo toast, and the Leads badge drops by one. |
| 11d | On Leads switch the Pool control to Declined | The declined lead is in the table with its reason and the date; the line above reads the reason counts; Bring back returns it to triage and it leaves the table. |
| 12 | Open Deals | A desktop shows the board, Booked to Invoice sent, a card in the column of its newest tick with the package, the days here and the next action; a phone shows the same as one grouped list. The one you just booked sits under Booked. |
| 13 | Open the booked lead | The record opens on Checkpoints (a computer shows the tabs under the facts; a phone shows the section rows): the header carries the checkpoint pill, the priority pill, the current checkpoint's button and Invoices, the next action strip sits under the header, and the outcome bar reads the same button plus Mark as lost. |
| 14 | Open Pricing and tap Add option twice | Two option cards appear with a package, a total, and the plan line. |
| 15 | On Checkpoints tap Met them, open Money, tap Add invoice (keep the prefilled package line), open the row's menu and tap Mark paid, then Mark paid in the confirm | Call done ticks and the record is a deal; the invoice row reads Sent; the confirm names the package, the total and the plan; the profile pulses red, the toast says they are a client and the project started (Undo for six seconds), and the Clients badge ticks up. Mark won without payment sits in the bar's menu for pro bono. |
| 16 | Open Clients and tap the client | The client record opens on Project with Money, Files, Retainer, Notes and History beside it (rows on a phone, with Details last); the header reads the status and priority pills, the next unpaid line's button (Send invoice, Mark paid or Add invoice) and Log a round. |
| 16a | Open Projects (More on a phone) | Every project with its client, package, stage, next action (red when overdue), next invoice with its status pill and last touch, overdue first; the strip above reads "N open, $X due this week, N past due". Tapping one opens the client record on its Projects fold. |
| 17 | Open the record menu and tap New project (on a computer; a phone shows the Open on your computer card with Copy link), keep the package, tap Create | The sheet closes and the Project card shows the new project's stage; its invoices are on Money. |
| 18 | On Money tap Mark paid on the first due line, confirm | The row pulses and its pill reads Paid; the one figure above the table moves and the ledger disclosure gains the entry. |
| 19 | On Retainer tap Start a retainer, keep the plan, tap Create | The retainer card shows the plan and amount. |
| 20 | Open a retainer client, on Retainer tap Log delivery, enter a count, tap Log | The month row's count and bar go up. |
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
| 30a | On the phone open a client's Showcase, Planner or Concepts editor, or Landing | The Open on your computer card with the record's name and Copy link, which copies the admin URL. On a computer the editor opens as before. |
| 31 | More (phone) or the avatar (desktop), Sign out | The login card returns. |
| 32 | Sign in again | Next up returns with the same data and the theme you left. |

Also once per release, by hand:

- Install to the Home Screen on the phone and open it: the boot frame shows, then the shell, without a browser bar.
- Turn on Airplane mode with the app open: the offline banner appears, every screen still reads, a write shows the refused toast, and the banner clears when the network is back.
- Send a test push from Settings, Notifications: it arrives on the phone and opens the right screen.
