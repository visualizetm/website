# Concepts: rebuilt as a client presentation with approval and feedback

Commits (main): bddf9c2 audit, b4ed904 Part 1 data model, bba383c Part 2
deletions and migration, 213f5f0 Part 3 editor and list, 969d665 Part 4 the
presentation, e40826f Part 5 endpoint and tests, 29dc9ae Part 6
notifications, plus Part 7 (this commit: the audit hooks, docs, the strip).

Audit results (Part 7): scene audit on /concepts/:token clean at 320x500,
390x720, 430x800, 768x1024, 1280x800 and 390 reduced motion (strip:
reports/concepts-strip-390.png); a11y 0 serious or critical on the editor,
the list and the public page at 390 and 1280; Lighthouse (public page, 390,
dark): performance 94, accessibility 100, best practices 100; admin
regression 64/64; site regression 14/14 (step 14 is the concepts walk);
css-orphans 0; hex count 80 (unchanged); dates, pipeline, planner,
showcase, concepts endpoint and security tests all pass; 10 functions
(the public endpoint rides on api/showcase.js by rewrite). The layout
audit reports two pre-existing items outside this prompt: Home's business
type link measured 43px while its card arrives at scale 0.97 (raised to 46px
here) and the planner editor's scroller at 320.

Live migration: MONGODB_URI=... node scripts/migrate-concepts.mjs (report),
then --apply. Expected on the live data: 0 sets from packs (both packs hold
no images), 0 from lead concepts[] (no item carries a link); nothing deleted.
