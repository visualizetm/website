Planner v2: the whole upgrade in one job
This is one long job built to run without Rob watching. It has to survive a usage limit, a closed laptop and a fresh session, and it never waits for an answer.
STEP 0, EVERY SESSION (do this before anything else)

1. If `docs/PLANNER-V2-PROMPT.md` does not exist, save this whole prompt there word for word and commit it ("Planner v2: the job"). That file is the job from now on; a later session reads it instead of this chat.
2. If `docs/PLANNER-V2-PROGRESS.md` exists, read it and `docs/PLANNER-V2-BLOCKERS.md`, then resume at the first milestone not marked done. Do not redo a done milestone. If a milestone is marked in progress, check `git status` and the last commit, finish it or reset its uncommitted work, then carry on.
3. If it does not exist, create it with the milestone checklist from the bottom of this prompt, every box empty.

Rob resumes a stopped run by pasting only this line: Continue the Planner v2 job from docs/PLANNER-V2-PROMPT.md. Make sure that line is enough.
HOW THIS RUN KEEPS GOING

* No questions, no hard stops. Decide by the decision rules and log every call in `docs/PLANNER-V2-DECISIONS.md` (one line each: the milestone, the choice, why).
* After every milestone: commit it, push to main, tick it in `docs/PLANNER-V2-PROGRESS.md` with the commit hash, the time, and one line on what is next. Never leave a milestone half committed at the end of a session.
* Long audits run detached with their output in a file, so a cut session never loses a result.

ROADBLOCK RULE (this replaces "stop when stuck")
A roadblock is: the same check failing three times in a row after real fixes, a milestone taking more than about 60 minutes, a missing file or tool the job needs, or anything that would need Rob (a real phone, a password, a decision with money or the client attached).
When you hit one:

1. Write it in `docs/PLANNER-V2-BLOCKERS.md` straight away, in this shape:
   * Milestone: number and name
   * What stopped it: the exact failing check or error, with the last 10 lines of output
   * What I tried: each attempt in one line
   * Why I think it fails: your best read
   * What Rob needs to do, if anything: one plain sentence, or "nothing, the next session can retry"
   * What I did instead: parked it, skipped to milestone N, reverted the uncommitted part
2. Put the work back to the last green commit so main is never broken.
3. Mark the milestone blocked in the progress file and move on to the next milestone that does not depend on it (the checklist shows what depends on what). Part 2 needs part 1's milestones 1 and 2; part 3 needs part 1's milestone 1 and part 2's milestone 1.
4. Stop the whole run only when every milestone left is blocked or depends on a blocked one. Then write the final report.

Never loosen an audit, add a skip or an exemption to get green. If an audit is truly wrong, that is a roadblock: log it, do not change it.
READ FIRST (once per session, only what the next milestone needs)
`CLAUDE.md`; `docs/ARCHITECTURE.md` rows for `/api/planner`, `/api/admin/posts`, `/api/admin/suggestions`, `call_leads.planner` and `suggestions`; `docs/MOBILE-UI-GUIDE.md`; `docs/TOKENS.md` and `src/ui/tokens.js`; `docs/COMPONENTS.md`; `src/shell/TabBar.jsx`. Then per part: part 1 `src/pages/Planner.jsx`, `src/shared/copy.js` (planner block), `api/planner.js`, `api/_routes/posts.js`, `src/lib/share.js`, `scripts/planner-endpoint-test.mjs`, `scripts/audit-screens.mjs`; part 2 `src/pages/AdminPlanner.jsx`, `src/components/PostSheet.jsx`, `src/pages/AdminDeals.jsx`, `api/_routes/suggestions.js`, `api/_routes/call-leads.js` (planner branch), `src/lib/useAutoSave.js`, `src/shell/backTree.js`; part 3 `api/_routes/portal-public.js` (`pushToggle`), `api/_lib/clientPush.js`, `api/_lib/notify.js`, `api/_routes/cron-reminders.js`, `public/sw.js`, `scripts/push-prefs-test.mjs`, `scripts/portal-test.mjs`, `scripts/sw-test.mjs`.
WHERE WE ARE (verified on main at 50174e0)

* The client planner is `src/pages/Planner.jsx` (1458 lines) at `/planner/:token`, fed only by `/api/planner` (`api/planner.js`, a standalone public function). It uses the marketing tokens, its own tab bar with labels, and tabs Home, Posts, Ads, Ideas. The calendar view only shows on wide screens (`canGrid`); a phone gets the list only.
* `/api/planner` POST actions today: `approve` (review to approved), `request-change` (review to making, writes `clientNote`, `clientNoteAt`), `suggest`. 30 actions per token per hour. Same 404 for every unknown case. `Cache-Control: no-store`.
* Posts already store `approvedAt` and `postedAt`. Save to photos is `saveMedia` in `src/lib/share.js`.
* The CRM's look: ground `--v-ground`, cards on `--v-surface-1/2/3` with `--v-border`, status pills from the `--v-status-*` set, red as the one accent, and the floating glass tab bar (icons only, `aria-label` on each, active icon in `--v-red-highlight` on `--v-red-soft`).
* Rob approved a mockup of this redesign (Design canvas "Content Planner v2"). This prompt describes it in full below, so you do not need the canvas.
* `/clients/:id/planner` is `AdminPlanner.jsx` (747 lines): Setup, the client link, the month's posts and ads as a list, PostSheet as the one editor, the ideas inbox, Copy last month in a menu. It autosaves through useAutoSave. On a phone it is an overview of rows with steps.
* After part 1, posts carry `reviewAt`, `decidedAt`, `postedBy`, `changeReason` and `versions`, and the client can mark a post posted.
* Client push already exists for the portal: devices in `push_subscriptions` with `role: 'client'` and `leadId`, `sendClientPush`, and `clientPushTick` which pushes only for keys the client has not seen (`portal.pushSeen`), so a batch of changes is one push.
* The planner has no client push yet and no alerts sheet.

PART 1: THE CLIENT'S PLANNER, REBUILT
Rebuild the client's planner so it looks and works exactly like Rob's CRM, tailored to content: same tokens, cards, pills, glass tab bar and type. Copy stays in Rob's first person ("I make your posts"), never "we". Dark only, the CRM's dark set.
A. Data and the door (additive only)

1. `api/planner.js`, new action `posted`: `{ postId, action: 'posted' }` on a post whose kind is `post` and status is `approved` sets `status: 'posted'`, `postedAt` now, `postedBy: 'client'`. Anything else answers the same 404 shape. Counts toward the same limiter. A push to Rob, best effort, category `client`: "<Business> posted <title>", deep link to `/clients/:id/planner`.
2. `request-change` gains an optional `reason`, one of `photo`, `words`, `date`, `other`. Store it as `changeReason` on the post next to `clientNote`. An unknown reason is dropped, not an error.
3. Every client decision (`approve`, `request-change`, `posted`) stamps `decidedAt` on the post. part 2 reads it for "usually approves within".
4. `api/_routes/posts.js`: whitelist `postedBy` (`client` or `rob`), `changeReason`, `decidedAt`, `reviewAt` and `versions`. `versions` is a capped list of at most 5 `{ imageUrl (safeUrl), caption (2200), note (300), at }`, written with `$push` and `$slice: -5`. When a PATCH changes `imageUrl` or `caption` on a post whose `clientNote` is set, push the old pair onto `versions` with `note` = the old `clientNote`, in the same write. When a PATCH sets `status: 'review'`, stamp `reviewAt`.
5. The planner read (`GET /api/planner`) adds exactly these fields per post: `postedAt`, `postedBy`, `changeReason`, and `previous`, which is the newest version only (`{ imageUrl, caption, note }`) or null. Per suggestion it adds `seen` (boolean from `seenAt`) and `made` (true when its `postId` post is approved, posted, live or finished). Nothing else new leaves the server. The client header adds `logoUrl` (the showcase logo, through safeUrl) and `firstName`: the first word of the record's contact `name` (the field the CRM already shows as the person, never `business`), empty when there is none.
6. Extend `scripts/planner-endpoint-test.mjs`: `posted` on an approved post, on a review post (404), on an ad (404), on another client's post (404); the reason kept and an unknown reason dropped; `decidedAt` and `reviewAt` stamps; `versions` capped at 5 and pushed on a caption change after a change request; the exact new read whitelist (a test fails if any other field appears). `security-test` must still pass.

B. The shell

* `.pl-*` styles move to the `--v-*` tokens. Scope the planner root with the same token block the admin uses (`.lay-root` or the existing helper that applies it) so every value reads `var(--v-...)`. No raw hex in Planner.jsx. `node scripts/hex-count.js` must not rise.
* Top bar on the four tab roots: the client's logo (`logoUrl`, else a circle with the business's first character in `--v-red`), the business name, and a quiet line "Your planner from Rob · <Month>". Focused screens (Review mode, the post page) hide the tab bar and show Back, the title and nothing else, like the CRM's focused chrome mode.
* Tab bar: the CRM's floating glass pill, a copy of the TabBar look built inside Planner.jsx (do not import the admin shell). Four icon-only tabs with `aria-label`: Home, Plan, Ads, Ideas. A red dot on Home while anything needs them. Untitled UI icons only. Content scrolls behind the pill and every scroller reserves the pill's height at its bottom.
* Every screen ships its skeleton, its empty state (copy in `src/shared/copy.js`), its error with Retry, and its entrance (motion tokens, nothing under Reduce motion).

C. Home
In this order: a greeting h1 ("Hey, <firstName>." when there is a first name, else "Hey."), one lead line in Rob's voice about the month. A Needs you card on `--v-surface-2` with a pill "<n> to review", up to three small thumbnails, and a primary button Review them now. With nothing waiting, one line "You are all caught up." with a check. Then Post today (an approved post dated today: thumbnail, title, time and platforms, a pill "Post it" that opens its post page), This week (seven day buttons Mon to Sun, a dot per item: red needs you, white post, blue ad, green posted; a tap opens Plan on that day), <Month> so far (n of postsPerMonth ready with a red progress fill, n posted), Your ad (the live ad's name, a Live pill and one plain sentence from its results, opens Ads), and From Rob (the planner's `welcome` text when set). Any block with no data does not render.
D. Review mode (new, focused)
Opened by Review them now. One post at a time in the order of its date. A thin progress line (done white, current red, rest surface-3) and "2 of 3" in the top bar. The post drawn as an Instagram post (avatar, handle, date, kind pill, the image or video at its format, caption, hashtags). Bottom bar: Ask for a change (secondary) and Approve (primary). Approve calls `approve` and moves on. Ask for a change opens a sheet: four reason chips (Different photo, Change the words, Wrong date, Something else), an optional note, Cancel and Send to Rob, which calls `request-change` with the reason and moves on. After the last one: a done screen "All set." with a summary of approvals and changes and Back to home. A failed call keeps the post on screen with the error and a Retry, never skips it.
E. Plan (was Posts)
A segmented control Calendar, Feed, List, at every width (the phone gets the calendar too now; keep the 44px targets). Calendar: the month grid, Monday first, dots per day as on Home, the selected day in red soft, below it the day's items as rows. Feed (new): a three column 4:5 grid of how their profile will look: the month's posts newest first with a small date chip, then up to six already posted ones. Ads never show in Feed. List: grouped by week. Month arrows stay. A row is one real control (the stretched button) opening the post page.
F. The post page (focused)
Status pill and the date line. When `previous` exists, a segmented control First draft / New version and a card "What changed: <note>". The post drawn as on Instagram. Caption and hashtags on a card with Copy. For a review post: Ask for a change and Approve, as in Review mode. For an approved post dated today or earlier, Post it in 4 taps, four numbered rows that tick when done: Save the picture (`saveMedia`, honouring `allowDownload`), Copy the caption (clipboard, caption plus hashtags), Open Instagram (a link to `https://www.instagram.com/`; the app picks it up on a phone), I posted it (calls `posted`; the pill turns Posted). A Timeline card: Rob made it, Waiting for your yes or You approved it (with `decidedAt`), Posted or Goes up <date>.
G. Ads
The live ad first on `--v-surface-2`: name, Live pill, the creative, where it is shown and the button text in one line, three stat tiles (people saw it, tapped, messaged or asked for a quote, from `ad.results`; a tile with no number does not render), the budget line and spend bar only when `showBudget`. Then Coming up and Finished as rows with one plain sentence each. Copy stays plain: "3,280 people saw it and 24 asked for a quote."
H. Ideas
The composer as a card at the top (no sheet on a phone): chips What do you want (A post, An ad, A video) and What is it for (the existing goals), a labelled textarea, Add photos and Pick a date as secondary buttons, Send to Rob. Below, Your ideas, each with a four step line (Sent, Seen, In the plan, Made) from `status`, `seen` and `made`, and one status sentence ("In the plan for Dec 16", "Rob saw it. He will reply soon.", or Rob's decline note).
Design rules for every screen (checks, not wishes)

* Tokens only. No raw hex. Status colours from `--v-status-*`: needs you = won (red), approved = progress (blue), posted and live = booked (green), making and planned = neutral, changes sent = new (amber).
* 44px targets. One real control per row or card. `aria-label` on every icon button. Live region for toasts and the Review progress. Landmarks named (the tab bar is a `nav` named Planner).
* Text 4.5:1 on its own layer, checked against the TOKENS.md table.
* Motion reads `--v-dur-*` and `--v-ease-*`; Reduce motion shows everything at once.
* No em dashes anywhere. No "we". No word AI.

How to build part 1

* Split Planner.jsx while you rebuild it: `src/pages/Planner.jsx` keeps routing, data and the shell; screens go in `src/components/planner/` (Home, Review, Plan, PostPage, Ads, Ideas, parts). Pure logic (week dots, feed order, review queue, idea steps, the Post it steps) goes in `src/lib/plannerView.js` with a pure test `scripts/planner-view-test.mjs`.
* Reuse `saveMedia`, the existing suggest sheet's upload code and the existing month helpers. No new dependencies.
* No new serverless function, no new env var, no new cron. Function count stays 10.
* Add every new state to `scripts/audit-screens.mjs` (Home with and without needs, Review, Review done, Plan in all three views, a post page with and without `previous`, Ads, Ideas) so layout, feel and a11y audits cover it.

PART 2: ROB'S SIDE, THE MONTH BOARD
Turn the planner editor into a board Rob runs the whole month from, built from the kit and `--v-*` tokens only.

1. Activity strip at the top (StatCard from the kit, wraps on a phone): posts ready this month (approved plus posted out of `postsPerMonth`), waiting on the client (status review), changes asked (making with a `clientNote` newer than the post's last edit), new ideas (suggestions with status new), and the live ad's best result (messages or quote asks) when there is one. Under the client name one quiet line: "Opened the planner <relative time>" from `planner.lastViewedAt`, and "usually approves within <a day | n days>" from the median of `decidedAt - reviewAt` over the last 20 decided posts (hide it under 3).
2. Views, a segmented control: Board, Calendar, Ideas · n.
   * Board (default): four columns, copied from the Deals board pattern: Making, Waiting on <Business>, Approved, Posted or live. A card is one real control: thumbnail, title, date and kind, and a red line under it when it carries "Change asked" or "Seen, not answered" (status review for more than 48 hours since `reviewAt` with `planner.lastViewedAt` after `reviewAt`), or "Goes up today". Drag to move between Making and Waiting (that is the send for approval); every other move uses the card's menu, so a drag never posts or approves anything for the client. Long press and a menu are the visible equivalents on a phone. On a phone the board is a list grouped by column with a chip row to pick the column, never four squeezed columns.
   * Calendar: the month grid with each item as a chip coloured by status (waiting red, ad blue, others neutral). A click opens the item.
   * Ideas: the existing inbox as cards (title, kind and goal pill, details, photos), with Make a post / an ad / a video (the existing prefill), Reply and Not now (the existing decline with a note). Opening an idea stamps `seenAt` (the client's tracker reads it).
3. The composer: selecting a card opens PostSheet in a side panel on a computer (a pushed screen on a phone, its own path under the client's planner path, added to `src/shell/backTree.js` with a check in back-test). Keep PostSheet as the one editor and add: a Post / Reel / Ad segmented control at the top (Reel maps to format video on kind post, as today), the caption counter "<n> / 2200", hashtag sets as chips that append a set to the hashtags, the client's change request as an amber card at the top ("<Business> asked: Different photo. '<note>'") when there is one, and Preview as <Business>, which opens `/planner/:token` in a new tab. Saving a new image or caption after a change request writes `versions` through the route (part 1 already does it server side; just make sure the editor sends one PATCH).
4. Batch send: a primary button in the toolbar, Send <n> for approval, that moves every Making post with an image or video and a caption to review in one request. Add one route action for it in `api/_routes/posts.js` (a POST `{ action: 'send-review', leadId, ids }` that sets review and `reviewAt` only on posts of that lead that qualify, and answers the ids it moved), so the client gets one change, not n. Undo through a toast puts them back to making. The per card Send for approval stays.
5. Hashtag sets: `planner.hashtagSets` on the client record, at most 10 of `{ id, name (40), tags (500) }`, sanitized in the call-leads PATCH planner branch, edited in the planner's Setup step (add, rename, edit, delete).
6. Toolbar: Copy <last month> across (surface the existing action as a button), New post, the batch button. On a phone the toolbar collapses into the top bar's declared actions and a menu, per the chrome rules.

PART 3: ALERTS AND THE LOOP BACK TO ROB

1. Client devices from the planner. Add `push_on` and `push_off` actions to `/api/planner` that reuse the portal's `pushToggle` logic (move it to a shared helper in `api/_lib/` rather than copying it), the same collection, `role: 'client'`, the same per token daily limit under a planner key. A client who turned push on in the portal is already on; the planner shows that.
2. The Alerts sheet on the client planner, opened by a bell icon button in the top bar (`aria-label` "Alerts"): a Turn on alerts button when this device is not subscribed (with the Add to Home Screen hint on iPhone Safari, as the portal does), then three switches stored on the client record as `planner.alerts { review, today, ideas }`, all on by default, written by a new `alerts` action on `/api/planner` (booleans only, nothing else accepted).
3. What the client gets (each one checks its switch, quiet hours and the device list; best effort, never fails the write that caused it):
   * New posts to review: when posts of a lead move to review (the batch send or a single send), one push per send: "Rob sent you <n> posts to review", opening the planner on Review mode. Use the pushSeen key pattern with a key per post so a resend of the same post never pushes twice.
   * Post today: the reminders cron, once a day at 9:00 AM America/New_York through `api/_lib/zone.js`, for each client with an approved post of kind post dated today and not posted: "Your post goes up today: <title>", opening that post's page. One push per client per day even with two posts ("2 posts go up today").
   * Rob answered my idea: when a suggestion moves to planned or declined: "Rob answered your idea: <subject>", opening Ideas.
4. What Rob gets (through `sendPush`, category `client`, his own switches in Settings): the client marked a post posted (part 1 already sends it; make sure it carries the category and respects his switch), everything this month approved ("<Business> approved the whole month"), once per lead per month, keyed in `cronRules` or the planner record so it never repeats.
5. The loop into Next up. When the client taps I posted it, any open task on the client's checklists that was written for that post (match on a `postId` the task already carries, or none) completes through the shared task write; the retainer delivered count already reads posted. If no such task exists, write nothing.
6. Settings: the planner's client alerts appear on Rob's side as one read-only line on the planner's Setup step ("Alerts on, 2 devices" or "Alerts off").

RULES THAT HOLD (all parts)

* Tokens only; `node scripts/hex-count.js` must not rise (90 or lower). Admin screens build from `'../ui'` (Card, StatCard, SegmentedControl, Chip, Sheet, Menu, EmptyState, NoResults, Skeleton; there is no Board kit piece, the board copies the Deals screen).
* No new serverless function, env var or cron entry; function count stays 10. Dates on the server through `api/_lib/zone.js` only.
* Additive schema, `$set` only (plus capped `$push`). Every stored link through safeUrl. Every public door behind the shared limiter.
* One back stack; a new admin path gets a `backTree.js` entry and a back-test check.
* Every new screen or state ships its skeleton, empty state (copy.js), error with Retry and entrance, and an entry in `scripts/audit-screens.mjs`.
* Nothing sends an email or a text. A push never carries a caption, a budget or anything internal. Nothing posts or approves for the client.
* No em dashes anywhere. No "we" in client copy. No word AI.

DECISION RULES

* Less code that is easier to verify wins.
* Not covered here: copy the CRM's existing pattern for the same kind of thing (Deals for boards, PostSheet for editors, the portal for client push).
* The design description and an existing CRM pattern disagree on a small visual detail: the CRM pattern wins.
* A field the server would need that is not named here: do not add it; render without it and log it.
* A metric with too little data to be honest is hidden, never estimated.
* A push that could be wrong in any edge case is skipped and logged, never sent.

CHECKS
Before every commit: `npm run lint`, `npm run build`, `node scripts/security-test.mjs`, `node scripts/hex-count.js`, plus the tests of what the milestone touched (`planner-endpoint-test`, `planner-view-test`, the posts and suggestions tests, `back-test`, `portal-test`, `push-prefs-test`, `notify-test`, `sw-test`, `tasks-test`). At the end of each part: `npm run preship`, `AUDIT_THEME=both node scripts/a11y-audit.mjs`, `node scripts/layout-audit.mjs` at 320, 390, 430, 768 and 1280, `AUDIT_THEME=both AUDIT_MOTION=both node scripts/feel-audit.mjs`, `node scripts/chrome-audit.mjs`, `node scripts/empty-audit.mjs`, `node scripts/regression.mjs`; part 1 adds `share-test` and `links-test`; part 2 adds `gesture-test` and `autosave-ui-test`; part 3 adds `coverage-push-test`, `notifications-guard-proof`, `portal-guard-proof`, and each new guard put back as its fault in a copy (a push without its switch check, a second Post today push the same day, a push carrying the caption, the alerts action accepting a non boolean), the test failing each time.
MILESTONES (the checklist for docs/PLANNER-V2-PROGRESS.md; one commit each)
Part 1, client

* [ ] 1.1 The door: data and `/api/planner` changes, endpoint test (needs nothing)
* [ ] 1.2 The shell: tokens, top bar, glass tab bar, skeletons, errors (needs 1.1)
* [ ] 1.3 Home and Review mode with the change sheet (needs 1.2)
* [ ] 1.4 Plan in three views and the post page with Post it in 4 taps (needs 1.2)
* [ ] 1.5 Ads and Ideas (needs 1.2)
* [ ] 1.6 Part 1 audits, docs, `reports/PLANNER-V2-1-REPORT.md` (needs 1.3 to 1.5)

Part 2, Rob

* [ ] 2.1 Route work: `send-review`, `hashtagSets`, `seenAt` on open, tests (needs 1.1)
* [ ] 2.2 Activity strip and the three views at every width (needs 2.1)
* [ ] 2.3 The composer panel and pushed screen, hashtag chips, change card, Preview as, back tree (needs 2.1)
* [ ] 2.4 Batch send with Undo, toolbar and phone chrome (needs 2.1)
* [ ] 2.5 Part 2 audits, docs, `reports/PLANNER-V2-2-REPORT.md` (needs 2.2 to 2.4)

Part 3, alerts

* [ ] 3.1 Shared push toggle helper, the planner's `push_on`, `push_off` and `alerts` actions, tests (needs 1.1)
* [ ] 3.2 The three client pushes and Rob's two, with stubbed tests including the 9:00 New York run across a time change (needs 3.1 and 2.1)
* [ ] 3.3 The Alerts sheet and bell, Rob's Setup line, the Next up loop (needs 3.1 and 1.2)
* [ ] 3.4 Part 3 audits, guard proofs, docs (`docs/ARCHITECTURE.md` rows, the CLAUDE.md planner rule), `reports/PLANNER-V2-3-REPORT.md` (needs 3.2 and 3.3)

FINAL REPORT (when everything is done or everything left is blocked)
Write `reports/PLANNER-V2-REPORT.md` and print it in the chat, 30 lines or fewer:

* Commit hashes with dates, one line per milestone: done, or blocked with a pointer to its entry in the blockers file.
* The new planner read whitelist, field by field.
* Every audit and guard proof: pass or fail. Exemptions added (should be none).
* Deviations from this prompt and why.
* Every roadblock in one line each, and what Rob needs to do about it.
* What needs Rob's phone: Save the picture and Open Instagram on a real iPhone, the glass bar over real photos, drag and long press on the board, turning on alerts from the planner on a home screen app, each push landing on the right screen.
* The single next step.
