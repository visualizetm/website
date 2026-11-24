# Planner v2, part 3: alerts and the loop back to Rob

The job is docs/PLANNER-V2-PROMPT.md; the calls made along the way are in docs/PLANNER-V2-DECISIONS.md.

## What shipped

- 3.1 The client's devices and switches. The portal's push toggle is a shared helper (`api/_lib/clientDevices.js`) that both doors call: the planner's `push_on` and `push_off` save the device with role client and the client's id, ten a day per token under the planner's own limiter key, and count the devices on `planner.pushDevices`; a device turned on in the portal is the same row. `alerts { review, today, ideas }` is written by a new action that takes booleans and nothing else, and read back on the client. An admin save of the planner carries every one of the client's fields forward.
- 3.2 The pushes (`api/_lib/plannerPush.js`). New posts to review: one per send, a key per post in `planner.pushSeen`, opening Review mode. Post today: the reminders cron from 9:00 AM New York, once a day per client, opening that post. Rob answered your idea: once, when an idea moves to planned or declined, opening Ideas. Each checks its switch, the client's quiet hours (9 PM to 8 AM New York) and the devices; none carries a caption, a budget or a note. Rob's: the client marked a post posted (category client), and the whole month approved (once per lead per month).
- 3.3 The bell and the Alerts sheet on the client's planner (Turn on alerts, or the Add to Home Screen hint on an iPhone that has not installed it; then the three switches), Rob's read only line on Setup ("Alerts on, 2 devices" or "Alerts off"), and the loop into Next up: marking a post posted ticks any open task that carries that post's id through the shared task rules (none carries one today, and with none nothing is written).

## Checks

| Check | Result |
| --- | --- |
| planner-alerts-test (new) | pass (67: the toggle, the alerts action, the carry, every push, 9:00 New York on both sides of the November and March changes, quiet hours, the switch, the devices, once a day, once a month, the Next up loop, no caption anywhere) |
| planner-alerts-guard-proof (new) | 6 of 6 proven: the switch check, one Post today a day, no caption in a push, alerts are booleans, quiet hours, the device list |
| portal-guard-proof | 123 of 123 (the four push cuts point at the shared helper) |
| notifications-guard-proof | all proven |
| coverage-push-test, push-prefs-test, notify-test, sw-test, portal-test, tasks-test, dst-test | pass |
| a11y-audit, the client planner with the Alerts sheet, both themes | 32 rows, 0 violations |
| preship, on the final tree | PASSED: the layout audit (637 views clean at 390 and 1280), scene (both profiles), lint, hex 78, routing 134, caller 108, gesture 19, chrome 173, empty 22, docs editor, docs flow |
| a11y-audit, every screen, both themes | 832 rows, 0 violations of any impact |
| layout-audit at 320, 430, 768 | clean after one fix: at 768 the board's four columns ran past the screen; they now show from 1024 up (the Deals rule) and 768 is clean (322 views) |
| feel-audit, every screen, both themes, both motions | 1416 rows. The planner's 4 gap rows (a layout shift on the Ideas view with reduced motion) are fixed and measure 0.003; the planner's states then pass in both themes and both motions with no gap. The other 214 gap rows are on screens this job does not touch and fail the same way on the base commit 50174e0, built and run on its own |
| regression | 117 of 118; 25a is the More list with Quotes, from before this job |

## What needs Rob's phone

Turning on alerts from the planner on a Home Screen app; each push landing on the right screen (Review mode, the post, Ideas).
