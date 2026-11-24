# Planner v2, part 2: Rob's side, the month board

The job is docs/PLANNER-V2-PROMPT.md; the calls made along the way are in docs/PLANNER-V2-DECISIONS.md.

## What shipped

- 2.1 The routes. `POST /api/admin/posts { action: 'send-review', leadId, ids }` is the batch send: every post of that lead among the ids that is being made and has a picture or a video file and a caption moves to review in one write (status, reviewAt, updatedAt), and the answer is the ids it moved. `planner.hashtagSets` (ten at most, `{ id, name (40), tags (500, normalised) }`) is sanitized in the call-leads planner branch and carried forward by a save that does not name it. Opening an idea stamps `seenAt` on the server (`seenAt: true`).
- 2.2 to 2.4 The board, one commit (they share AdminPlanner.jsx). Under the client's name, when they last opened the planner and "usually approves within a day" (the median of approved, else decided, minus sent over the last 20 decided posts the screen holds; hidden under three). The activity strip of StatCards. Board, Calendar and Ideas in a SegmentedControl. The board copies the Deals pattern: Making, Waiting on the client, Approved, Posted or live; a card is one control, with a red line for Change asked, Seen, not answered or Goes up today; a drag only moves a post between Making and Waiting, every other move is the card's menu (a long press on a phone, with the menu beside it); a phone shows one column behind a chip row. The calendar draws chips coloured by status (a phone gets the days that have something). Ideas is the inbox; opening it stamps each unseen idea seen. PostSheet is still the one editor: Post, Reel or Ad, `n / 2200`, hashtag set chips (edited in Setup), the client's change request as an amber card, Preview as the client. It is a side sheet on a computer and its own path on a phone, `/clients/:id/planner/:postId`, in the back tree. Send n for approval is one request, with Undo; on a phone the top bar carries the one declared action.

## Checks

| Check | Result |
| --- | --- |
| planner-board-test (new) | pass (59: the three routes against the real handlers, the board's pure logic) |
| planner-board-ui-test (new) | pass (47, at 390 and 1280: the strip, the columns and chips, the batch send and Undo, a drag, the menu, the calendar, Ideas seen, the editor both ways, a hashtag chip, Preview as) |
| back-test | pass (238, the pure tree and the browser walk, with the editor's own path) |
| gesture-test | pass (19, with a long press on a board card) |
| autosave-ui-test | pass |
| a11y-audit, the planner's admin states, both themes | 48 rows, 0 violations |
| feel-audit, the planner's admin states | 24 rows, 0 gaps (the full run is at 3.4) |
| chrome-audit | pass on every planner state after the top bar went to one declared action |
| empty-audit | pass (22 screens) |
| security, endpoint, pipeline, hex | pass; hex 78 |
| preship (at the part 2 commit, from its own worktree) | one failure, fixed in the 2.5 commit: on a phone the editor's Preview as <client> button ran past the screen with a long name (six views at 390). Everything else passed: the layout audit's other views at 390 and 1280, scene-audit (both profiles), lint, hex 78, routing (134), caller (108), gesture (19), chrome (173 states), empty (22), docs editor and docs flow. The final preship at 3.4 runs on the fixed tree |
| regression | 117 of 118; 25a is the More list with Quotes, from before this job |

## Deviations

- 2.2 to 2.4 are one commit.
- "Usually approves within" reads the months the screen holds (this month and next).
- A phone's calendar is the days with something on them.
- The Ideas rows of the audit screens use the page as their region: Ideas is a view of the page now.

## What needs Rob

Drag and long press on the board with a real mouse and a real finger; the editor opened from a card on his phone.
