# Planner v2: decisions

One line each: the milestone, the choice, why.

- 1.1: firstName reads `askFor` through the portal's own `portalFirstName`, and logoUrl reads `portalLogo` through safeUrl. The CRM has no `name` field; `askFor` is the one it shows as Contact, and the portal already reads it this way.
- 1.1: Rob's "posted" push names the post's day ("Kims Cafe posted the Dec 16 post"), not its title. A post's title is its caption's first line, and a push never carries a caption.
- 1.1: a caption or image change pushes one version per change request (only when the newest version is older than `clientNoteAt`). The editor autosaves every keystroke burst, and without this one request would fill all five slots with half-typed copies.
- 1.1: `reviewAt` is stamped when a post moves into review (its stored status was not review), not on every save of a post already there. The same reason: autosave resends the status.
- 1.1: `decidedAt` is stamped on posted too, as written. Part 2's "usually approves within" reads `approvedAt` first, then `decidedAt`, so a later Posted does not stretch the measure.
- 1.2: the planner borrows only `tokenStyles` (a string) from the admin kit and builds its own copies of Card, Pill, Button, SegmentedControl, Sheet and the glass TabBar in `src/components/planner/parts.jsx`. A public page should not pull the whole admin kit, and the prompt asks for a TabBar copy rather than an import.
- 1.2: the tab bar shows at every width (a centred pill, 360px at most on a computer). The planner has no sidebar to fall back on, unlike the CRM.
- 1.2: the portal's Back to your portal stays, as an icon button at the left of the top bar on the tab roots when the page was opened from the portal (an existing feature; the CRM pattern for Back is an icon at the left).
- 1.2: the marketing ClientFoot is dropped from the planner; the tab bar is the page's foot, as in the CRM. The dead link page keeps the email in its line.
- 1.2: focused screens are search params (`?review=1`, `?post=<id>`) pushed as real history entries with `state.pl`, so the phone's Back and the top bar's Back are one step; a cold open backs to its tab root. An old `?tab=posts` link opens Plan.
- 1.2: layers that mean the screen (tab bar, sheets, toast) portal to the body inside their own `.lay-root`, because `main.page-fade` animates a transform and fixed layers inside it would be fixed to it.
- 1.3: Ask for a change sends the reason's own words as the note when the client picks a reason and writes nothing (the door still requires a note, which is what Rob reads); Send needs a reason or a line.
- 1.3: Review takes its queue once when it opens, so an approval does not reshuffle the rest; a post that turned stale (not waiting any more) is passed over, since there is nothing left to answer, and only a failed call stays on screen with Retry.
- 1.3: Home's This week reads the loaded month only, so a week that runs into the next month shows no dots on those days. The read is per month and no new field is added.
- 1.3: the audits' Home without needs uses a second mock token (plnrCLEAR) that reads L11's month with review shown as approved, rather than a second planner client in the fixtures, which would change the admin screens' data.
- 1.4: the Feed shows the loaded month only: its posts still to go up, newest first, then up to six of its posted ones. Earlier months' posted posts are not in the read (one month per GET), and no second request was added.
- 1.4: below 400px the calendar lets its grid use the page gutter (4px from each edge) so seven columns stay 44px wide at 320.
- 1.4: the timeline's "You approved it" carries no date: the read has no decidedAt or approvedAt, and the prompt names no such field for it, so it renders without one. Posted uses postedAt, which the read does carry.
- 1.4: an ad's page shows the ad card (the Ads screen's, shared) instead of the Instagram preview, with no Copy card and no settled line; the client does not post ads.
- 1.4: Post it in 4 taps stays on screen, every step ticked, after I posted it, instead of vanishing the moment the post turns Posted.
- 1.5: the Ideas composer's one box is split for the door: its first line (120 characters) is the subject Rob reads as the title, the whole text is the details when it is longer. The old Add a link field is dropped; the prompt's composer has none, and a link can go in the text.
- 1.5: Add photos shows only when uploads are configured (the Cloudinary variables), as the old sheet did with its photos.
- 1.5: "In the plan for Dec 16" renders as "In the plan." The read carries no date for an idea's post and the prompt names no such field.
- 1.5: the Ads screen keeps the month arrows, like Plan, because the read is one month.
