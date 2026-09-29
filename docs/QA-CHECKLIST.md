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
| 2a | Look at the bottom of the phone | The tab bar reads Next up, Lists, Call, Deals, More. More opens Triage, Leads, Clients, Projects, Orders, Reviews, Calendar, Submissions, Recently Deleted, Concepts, Declined, Settings, Landing and Design. Nothing is greyed out and nothing says computer only. |
| 2b | From any list (Leads, Triage, Lists, Deals, Clients, Projects, Orders, Reviews, Submissions, Next up, the Calendar, the command bar, the bell) open a record; from a record open the Showcase, the Planner, the Concepts editor, New project; from Lists open Fill from filters; in the Call Console start a session | Every one of them shows Back in the top bar (a phone sheet shows Close). Back returns to the exact screen you left: the same list, the same filter chips and search, the same scroll, with the row you opened lit for a moment; the browser's back and the phone's edge swipe do the same, and Forward re-opens the record. The section roots (Next up, Triage, Leads, Lists, Call, Deals, Clients, Projects, Orders, Reviews, Landing, Submissions, Settings, Design) show no Back. A record opened from a link (?open=) shows Back to its section root. A dirty editor asks before it leaves. |
| 3 | Read Next up | Four tiles under the greeting (Calls today, Callbacks pending, Deals stalled, Due this week in dollars), then six sections, every one open with nothing to unfold: Overdue in red (oldest first), Today, This week grouped by day with a small day label, Later, Meetings (every booked meeting from today on with Reschedule in its row menu) and Lists ready (a full dial list with Start). An empty section is one line like "Nothing overdue." Each row keeps its one control, its row menu (Done, Snooze a day, Snooze until, Open) and the phone swipes. No Stats, no funnel, no Revenue on this screen; no skeleton lingers. |
| 4 | Tap Start call session | The Call Console builder opens with the status and priority chips and a lead count on the Start button. |
| 5 | Tap Start call session in the builder | The queue (phone) or the room (desktop) opens with the first lead's card. |
| 6 | Tap the first lead in the queue (phone) | The call room shows the name, pills, the phone button, and the script tab. |
| 7 | Tap No answer, then Log | The sheet closes, the room moves to the next lead, the position reads 2 of N. |
| 8 | Tap Callback, pick a quick time, then Set callback | The sheet closes, the next lead shows, the callback lands on the Calendar and the drawer. |
| 9 | Tap Wrong number, then Log | The sheet closes and the phone note on that lead reads Wrong number with today's date. |
| 10 | Tap Booked, set a date and time, then Book it | The header pulses green, the sheet closes, the lead moves to Booked. |
| 11 | On the last lead tap Said no, then Log | The lead leaves the console with an undo toast for six seconds, and the session summary appears. It is parked in Nurture for 90 days (Leads, Pool: Nurture shows the day it comes back), not deleted; Undo puts it back on the list it came from, in its old place. |
| 11a | Open Triage; on a phone swipe the top card right, or tap the red check; on a desktop press K on the focused row | The Keep sheet opens with priority and best window; tap Hot, then Done. The card leaves with a "kept" undo toast and the lead is in Leads Open. Swipe left or X bins it (undo restores); the clock or L parks it 30 days; swipe down or D opens Decline. |
| 11b | On Triage tap the card (click the row on a computer) | The full record opens, everything editable, with Keep, Later, Decline and Bin pinned at the bottom and the source pill and the score in the header; a computer keeps the pile on the left and K L D B A still work. A decision closes the record and the next lead is up; Back returns to the pile with the row focused. The search and the chip row (Source, Industry, Has phone) narrow the pile and the heading reads "14 new, 6 match". |
| 11b | Tap the plus button, Capture a lead, type @thebakeryco, tap Capture | The toast reads "Captured. It is waiting in Triage." and the pile gains a card with only the Instagram filled. |
| 11c | Open Leads, open a lead's row menu and tap Decline, pick Out of area, tap Decline | Every row is two lines: the business and one pill (the call status; the priority on the kanban, where the column is the status), then the industry and area with the phone as a link. The sheet closes, the lead leaves the list with a six second undo toast, and the Leads badge is gone from the sidebar (badges sit on Next up, Triage, Lists, Deals and Projects only). |
| 11d | On Leads switch the Pool control to Declined; back on Open, tap Filters | The declined lead is in the table with its reason and the date; Bring back returns it to triage. Filters opens a sheet with Priority, Industry and Data; the Status chips and the saved views stay on the screen and the button carries a count of what is set. |
| 12 | Open Deals | A desktop shows the board, Booked to Invoice sent, each card two lines: the business with Today, N days or Stalled as its one pill, and the package. A phone shows the same as one grouped list with the action as a 44px icon button at the end of the row. The one you just booked sits under Booked. |
| 12a | Open Lists and open one | A card per open list with its count against the target; a list opens to its leads in order, each row the position number, a drag handle, the business with its call status pill, the industry and area, the phone, and the row menu with Remove from this list. |
| 13 | Open the booked lead | The record opens on Checkpoints (a computer shows the tabs under the facts; a phone shows the section rows): the header carries the checkpoint pill, the priority pill, the current checkpoint's button and Invoices, the next action strip sits under the header, and the outcome bar reads the same button plus Mark as lost. |
| 14 | Open Pricing and tap Add option twice | Two option cards appear with a package, a total, and the plan line. |
| 15 | On Checkpoints tap Met them, open Money, tap Add invoice (keep the prefilled package line), open the row's menu and tap Mark paid, then Mark paid in the confirm | Call done ticks and the record is a deal; the invoice row reads Sent; the confirm names the package, the total and the plan; the profile pulses red, the toast says they are a client and the project started (Undo for six seconds), and the Clients badge ticks up. Mark won without payment sits in the bar's menu for pro bono. |
| 16 | Open Clients and tap the client | Every row is the business and one pill (money past due, the next amount due, Retainer, Delivered, the project stage, or No project) over the package and the money; a desktop table reads business, status, package, paid, next date and a row menu, and Filters opens the money, retainer and delivery chips in a sheet. The client record opens on Project with Money, Files, Retainer, Notes and History beside it (rows on a phone, with Details last); the header reads the status and priority pills, the next unpaid line's button (Send invoice, Mark paid or Add invoice) and Log a round. |
| 16a | Open Projects (More on a phone) | Every project with its client, package, stage, next action (red when overdue) and next invoice with its status pill, overdue first, and a row menu; Last touch waits in the column chooser. The strip above reads "N open, $X due this week, N past due". Tapping one opens the client record on its Project tab. |
| 17b | On any record (lead, deal or client) open the menu and tap Set task; type a label, keep today, pick a time, pick 1 hour before, tap Save | The strip reads the label with "Today 2:30 PM" (another day reads "Thu Oct 2, 9:00 AM"); Next up shows the same row with Edit task in its menu; the Project tab of a client has Add task in its header; a project's row menu on Projects has Set task. Done marks it done today. Settings, Notifications has Task reminders on and a Reminder timing line. |
| 17 | Open the record menu and tap New project, on the phone or the computer | The New project page opens (title "New project for <business>"): What, the package rows with price and included lines, the start date, the Drive link and a live Summary with the invoice lines it will create; Cancel and Create sit in a sticky footer above the tab bar. Keep the package, tap Create: the toast reads "<name> created." and the record opens on Project with the new project's stage; its invoices are on Money. Change a field then tap back and it asks before leaving. |
| 18 | On Money tap Mark paid on the first due line, confirm | The row pulses and its pill reads Paid; the one figure above the table moves and the ledger disclosure gains the entry. |
| 19 | On Retainer tap Start a retainer, on the phone or the computer | The same page opens in Retainer mode: the plan rows with price and monthly deliverable, the bill day, the start date and a Summary with the first months. Keep the plan, tap Create: the record opens on Retainer and the card shows the plan and amount. |
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
| 30a | On the phone open a client's Showcase, Planner or Concepts editor, or Landing | The full editor, one scrolling column: cards stack, the save bar sits above the tab bar, an image field opens the phone's file picker, and reorder is Move up and Move down in the row menu. On a computer the same page opens with its columns. |
| 30b | On Lists open a list's menu and tap Fill from filters (or the empty list's Fill from filters) | A page with the console's chip groups in one column and the line "N match, M fit under the target"; Add sits in a sticky footer and appends the matches, then the list opens. |
| 31 | More (phone) or the avatar (desktop), Sign out | The login card returns. |
| 32 | Sign in again | Next up returns with the same data and the theme you left. |

Also once per release, by hand:

- Install to the Home Screen on the phone and open it: the boot frame shows, then the shell, without a browser bar.
- Turn on Airplane mode with the app open: the offline banner appears, every screen still reads, a write shows the refused toast, and the banner clears when the network is back.
- Send a test push from Settings, Notifications: it arrives on the phone and opens the right screen.
