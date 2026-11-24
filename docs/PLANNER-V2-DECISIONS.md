# Planner v2: decisions

One line each: the milestone, the choice, why.

- 1.1: firstName reads `askFor` through the portal's own `portalFirstName`, and logoUrl reads `portalLogo` through safeUrl. The CRM has no `name` field; `askFor` is the one it shows as Contact, and the portal already reads it this way.
- 1.1: Rob's "posted" push names the post's day ("Kims Cafe posted the Dec 16 post"), not its title. A post's title is its caption's first line, and a push never carries a caption.
- 1.1: a caption or image change pushes one version per change request (only when the newest version is older than `clientNoteAt`). The editor autosaves every keystroke burst, and without this one request would fill all five slots with half-typed copies.
- 1.1: `reviewAt` is stamped when a post moves into review (its stored status was not review), not on every save of a post already there. The same reason: autosave resends the status.
- 1.1: `decidedAt` is stamped on posted too, as written. Part 2's "usually approves within" reads `approvedAt` first, then `decidedAt`, so a later Posted does not stretch the measure.
