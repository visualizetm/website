# Planner v2, part 1: the client's planner, rebuilt

The job is docs/PLANNER-V2-PROMPT.md; the calls made along the way are in docs/PLANNER-V2-DECISIONS.md.

## What shipped

- 1.1 The door (`api/planner.js`, `api/_routes/posts.js`). The read adds, per post, `postedAt`, `postedBy`, `changeReason` and `previous` (the newest version only, `{ imageUrl, caption, note }`, or null); per idea `seen` and `made`; on the client `logoUrl` (the showcase logo through safeUrl) and `firstName` (the first word of the contact, `askFor`). New action `posted` on an approved post of kind post only (the same 404 for anything else), with a push to Rob in category client that names the day, never the caption. `request-change` keeps a reason (photo, words, date, other; anything else dropped). Every decision stamps `decidedAt`. The posts route whitelists `postedBy`, `changeReason`, `decidedAt`, `reviewAt` and `versions` (five at most, a capped `$push`), stamps `reviewAt` on the move into review, and keeps the first draft (with the client's note) on the first new picture or words after a change request.
- 1.2 The shell. The page reads the CRM's `--v-*` tokens under its own `.lay-root`, dark only, with no raw hex. A top bar with the client's mark and "Your planner from Rob · Month", the floating glass tab bar (Home, Plan, Ads, Ideas, icons only, a red dot on Home while anything waits), focused screens pushed as real history entries, a skeleton per screen, an error with Retry, one polite live region for toasts. `src/pages/Planner.jsx` keeps routing, data and writes; the screens are in `src/components/planner/`; their logic is `src/lib/plannerView.js`.
- 1.3 Home and Review mode. Home: the greeting by first name, one line in Rob's voice, Needs you with three thumbnails and Review them now (or all caught up), Post today, This week with a dot per item, the month so far, Your ad, From Rob. Review: one post at a time drawn as on Instagram, the progress line and "2 of 3" in the top bar, Approve, Ask for a change with four reasons and an optional note, a failed call kept on screen with Retry, the done screen.
- 1.4 Plan and the post page. Calendar, Feed and List at every width (seven 44px days even at 320), the post page with First draft and New version, Copy, the two decisions, Post it in 4 taps (Save the picture through `saveMedia` honouring `allowDownload`, Copy the caption, Open Instagram, I posted it) and the timeline.
- 1.5 Ads and Ideas. The live ad first with up to three result tiles and one plain sentence, the budget and spend bar only when Rob shows it, then Coming up and Finished. Ideas: the composer as a card at the top and each idea with Sent, Seen, In the plan, Made.

## Checks

| Check | Result |
| --- | --- |
| planner-endpoint-test | pass (the read whitelist key by key) |
| planner-view-test (new) | pass (69) |
| security-test | pass (1264) |
| lint, build, hex-count | pass; hex 78, unchanged |
| share-test, links-test | pass (39, 24) |
| site-regression | pass, 18 steps (step 13 rewritten for the new Home, Review, Plan and Ideas) |
| a11y-audit, planner states, both themes | 30 rows, 0 violations of any impact |
| layout-audit | the whole app at 320 and 390 and most of 430: no failure (842 rows); the marketing pages, the planner's 23 states among them, at 320, 390, 430, 768 and 1280: all clean (252 views at the last four) |
| empty-audit, chrome-audit | pass (22 screens, 171 states) |
| regression | 117 of 118; 25a fails on the More rows, which now include Quotes (added by the Quotes job in 854bc74, after the test's list was written); not touched here |
| feel-audit | partial run, then stopped: see the decisions file. GAP rows only on admin screens this part does not touch |
| preship | run at the end of part 2, since it builds the working tree |

## Deviations

- The contact's first name reads `askFor`: the CRM has no `name` field.
- Rob's "posted" push names the day, not the title: a post's title is its caption's first line.
- The Feed shows the loaded month only; the timeline's "You approved it" has no date; "In the plan for Dec 16" is "In the plan." (no field for any of these is in the read, and the prompt names none).
- The portal's Back to your portal stays, as an icon in the top bar.

## What needs Rob's phone

Save the picture and Open Instagram on a real iPhone; the glass bar over real photos.
