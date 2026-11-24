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
