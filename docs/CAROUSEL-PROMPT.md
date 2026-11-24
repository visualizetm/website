# Carousel posts in the content planner

One job, one run. No questions and no hard stops. Decide by the decision rules, log each call in `docs/CAROUSEL-DECISIONS.md`, and keep going. If you hit a limit or a new session starts, the resume line is: **"Continue the carousel job from docs/CAROUSEL-PROMPT.md."**

## STEP 0 (every session)
1. If `docs/CAROUSEL-PROMPT.md` does not exist, save this prompt there and commit it.
2. Read `docs/CAROUSEL-PROGRESS.md` and `docs/CAROUSEL-BLOCKERS.md` if they exist. Start from the next milestone not marked done. Never redo a done milestone.
3. After every milestone: update PROGRESS (milestone, commit hash, what is left, the next action in one line), commit, push to main.

## READ FIRST
CLAUDE.md (every standing rule holds), docs/ARCHITECTURE.md (Planner and Client app sections), docs/PLANNER-V2-PROMPT.md, docs/MOBILE-UI-GUIDE.md, then only what this touches: api/_routes/posts.js, api/planner.js, src/shared/semantics.js (POST_KINDS, POST_STATUSES), src/pages/AdminPlanner.jsx, src/components/PlannerBoard.jsx, src/lib/plannerBoard.js, src/components/planner/ (PostPage, Plan, Home, Review), src/lib/plannerView.js, src/lib/share.js, scripts/planner-endpoint-test.mjs, scripts/planner-board-test.mjs, scripts/share-test.mjs, scripts/audit-screens.mjs. Do not create docs/SITE-REPORT.md, docs/DESIGN-SYSTEM.md or docs/DECISIONS.md; this repo's docs are the ones above.

## WHERE WE ARE (verified November 24, 2026, main at 3b0e32b)
- A post (`posts`, api/_routes/posts.js) has one picture, `imageUrl`, sanitized by `safeUrl(v, 600)`. `kind` is post or ad; video is a `format` (portrait, story, video), never a kind. Statuses are POST_STATUS_IDS (making, review, approved, posted, and live and finished for ads only).
- `versions` (max 5, `sanitizeVersion`) keeps the old image and caption when either changes after a client note. A carousel change must be kept there too.
- Send for approval (`send-review`, posts.js about line 170) moves a post of kind post when it has a picture or a video and a caption. That is the rule; do not add a hashtags requirement.
- The client reads posts only through /api/planner, whose field list in api/planner.js (about line 141) is asserted key by key by planner-endpoint-test. A new field reaches the client only if it is added there and to that test.
- The client planner lives in the client app (app.visualizeclients.com, behind the `vz_client` cookie). Tests that read it sign in through scripts/client-signin.mjs. Rob's read only preview is /preview/planner/:id on the admin host.
- Save to photos is src/lib/share.js (`saveMedia`, `canShareFiles`, `filenameFor`, `attachmentUrl`, `MAX_SHARE_BYTES` of 50 MB), held by share-test. It saves one file today.
- The post editor's file input takes one picture and uploads to Cloudinary, saving the URL to `imageUrl`.
- Real data waiting: 5 Handy Bros (`6ab2da9e41f676d494b1db9c`) has 5 December carousels (7, 4, 7, 5 and 5 slides), each holding only its cover for now.

## THE JOB
A post of kind post can hold an ordered set of pictures, a carousel. Rob builds it in the editor. The client sees one swipeable post that they approve, or ask to change, as a whole, and that they can save in one go. Ads, stories and videos are unchanged in this job.

### 1. Data (additive, no migration)
- `slides: [{ url, alt }]`, 1 to 20 items in display order (Instagram's carousel limit). Every `url` goes through `safeUrl(v, 600)`, the same rule as `imageUrl`. `alt` is trimmed to 200 characters. Empty entries are dropped. More than 20 is a 400 with a plain message, never a silent cut. Allowed only on kind post with format portrait; on anything else `slides` is not written.
- `imageUrl` always equals `slides[0].url` when slides exist, set by the server on every write. Thumbnails, pushes, emails and older code keep working untouched.
- One shared helper, `slidesOf(post)`, in src/shared (mirrored byte for byte in api/_lib if the server needs it, with a mirror check): `post.slides?.length ? post.slides : post.imageUrl ? [{ url: post.imageUrl, alt: '' }] : []`. Every display read goes through it; list each file you change in the report.
- The send-review rule's "has a picture" becomes `slidesOf(post).length >= 1` (or a video).
- `versions`: a change to `slides` counts as a picture change, and the version keeps the old `slides` (capped at 20), so the history shows what the client saw.
- /api/planner sends `slides` (through `slidesOf`, so a legacy post comes back as one slide) and planner-endpoint-test asserts the new key.

### 2. Rob's editor (AdminPlanner.jsx)
- The file input takes several files. They upload in the order picked and are added to the end. Pasting a URL adds one slide.
- **Slide strip** under Image: 4:5 thumbnails in order, each numbered, with slide 1 carrying a "Cover" chip.
  - **Reorder** with Move left and Move right buttons on each thumbnail. These are the primary control, at 44 px. The strip is a sideways scroller, and CLAUDE.md keeps gestures off sideways scrollers, so add drag only for a mouse (`pointer: fine`) and never for touch.
  - **Remove** with an X. It's undoable from the toast with no confirm; the toast's life reads `durationMs()`.
- **Counter:** "7 slides. Slide 1 is the cover." or "1 slide".
- **Limit:** at 20 the upload is disabled and the counter says "20 of 20, Instagram's limit."
- **Ratio warning:** soft, never blocking. "Slide 3 is 1:1. Instagram crops a carousel to the first slide's shape."
- On a phone the editor stays an overview of rows with a step per row (docs/MOBILE-UI-GUIDE.md). The slide strip lives in the Image step.
- **Board card (PlannerBoard.jsx):** the cover plus a stack icon and the count when there is more than one slide. Use an Untitled UI icon; no emoji.
- A single picture post looks and behaves exactly as today.

### 3. The client planner and Rob's preview
- **Post page:** the picture becomes a horizontal carousel.
  - Native CSS scroll snap, no library, no autoplay.
  - Swipe on a phone; 44 px Previous and Next buttons on wider screens.
  - A "3 / 7" counter and dots, with the counter in a live region.
  - Each slide's alt is `alt` or "Slide 3 of 7". The arrow keys move between slides when the carousel has focus.
  - Slides after the first load lazily, with their size reserved so nothing shifts.
  - The client app's edge Back gesture must not fire inside the carousel.
- **Feed and Calendar:** the cover with the stack icon and the count.
- **List:** "Carousel, 7 slides" under the caption.
- **Save (when `allowDownload` is on):** the button reads "Save 7 to photos".
  - Extend src/lib/share.js with a `saveMany` beside `saveMedia`; don't write a second share path. It shares all slides as files in one `navigator.share({ files })` call when `canShareFiles` allows it and the total is under `MAX_SHARE_BYTES`.
  - Otherwise it saves them one after another, named `<business>-<date>-01.jpg` and onward through `filenameFor`.
  - Progress reads "Saving 3 of 7", then "Saved 7 to photos". If one fails, name the slide and offer to retry just that one.
  - share-test grows to cover all of this.
- **Approve and Ask for a change** act on the whole post. A change note on a carousel is prefixed with the slide the client was viewing ("Slide 4: ..."). That prefix goes into the same request-change write; no new field.
- **Rob's preview** (/preview/planner/:id) shows the same carousel with no write control.
- **Pushes and emails are unchanged.** They use `imageUrl`, the cover. No push carries a caption.

### 4. Copy
All copy goes in src/shared/copy.js, in sentence case, with no em dashes. The client planner speaks as Rob, "I", never "we".

## HOW TO WORK
- Tokens only (`var(--v-...)`) and the kit from `'../ui'` (Button, Chip, Sheet, toast). The hex count must not rise.
- No new dependency, no new serverless function, no new env var, no new cron.
- `$set` only. Additive schema. sanitize() is the schema.
- Every new state ships with its skeleton, empty, and error with Retry states. Every new client screen state gets a `marketing: true, app: true` entry in scripts/audit-screens.mjs, and every admin state gets its entry too.
- Build and check at 390 first, then 768 and 1280. Long audits run detached; grep and tail their logs, never print whole files.

## RULES THAT HOLD
These all pass today and must still pass:
- lint and build;
- hex-count;
- security-test;
- planner-endpoint-test, planner-view-test, planner-board-test, planner-board-ui-test, planner-alerts-test and its guard proof;
- share-test;
- client-app-test and client-app-ui-test;
- portal-test;
- back-test;
- regression;
- a11y-audit, with no serious or critical issues;
- layout-audit and feel-audit at 320, 390, 430, 768 and 1280;
- gesture-test, chrome-audit and empty-audit;
- `npm run preship`.

A test may grow; it may never lose a check, skip, or loosen one. Report each touched test's check count before and after.

## DECISION RULES
- Two ways: less code that is easier to verify.
- Not covered here: the plainer option, logged.
- An effect that costs speed or clarity: drop it.
- Existing patterns win for shared parts; this brief wins for the new carousel UI.
- A standing rule in CLAUDE.md beats this brief.

## MILESTONES (one commit each, push after each)
1. **Data.** `slides`, `slidesOf` and its mirror, sanitize, the `imageUrl` mirror, send-review, `versions`, the /api/planner key.
   - Tests cover: a legacy post; 7 slides in order; a reorder moving `imageUrl`; 21 rejected; a `javascript:` URL dropped; an empty array; slides on an ad or a story not written; send-review with 0 and with 1 or more slides.
   - Add `scripts/carousel-guard-proof.mjs`, which puts each fault back in a copy and proves a check fails: 21 accepted, the `imageUrl` mirror cut, `slides` missing from the planner read, an unsafe URL kept, send-review passing with no slide.
2. **Rob's editor and the board card.**
3. **The client planner, Save N to photos and Rob's preview**, with share-test grown.
4. **Gate and report.** Every rule above, with docs/ARCHITECTURE.md and CLAUDE.md updated in one line each (the carousel rule). Write `reports/CAROUSEL-REPORT.md`.

## ROADBLOCK RULE
If something stops you:
1. Write it in `docs/CAROUSEL-BLOCKERS.md`: the milestone, what you tried, the exact error in a few lines, the likely cause, and what is needed.
2. Revert to the last green commit for that work.
3. Skip to the next milestone that doesn't depend on it.
4. Stop only when everything left is blocked.

Never loosen an audit to get a green. If that is the only way through, it is a blocker.

## REPORT (25 lines or fewer, in the file and the session's last message)
- Commits with dates, and each milestone marked done, partial or blocked.
- Any blockers, listed first.
- Every file that now reads `slidesOf` instead of `imageUrl` for display.
- Check counts before and after for every test touched, and the guard proof cuts.
- Each rule with pass or fail.
- Deviations from this brief, and why.
- What needs Rob's phone:
  - Save 7 to photos opening the iPhone share sheet with 7 images;
  - swiping on a real iPhone, with the edge Back gesture not firing inside the carousel;
  - an Android save.
- The single next step.
