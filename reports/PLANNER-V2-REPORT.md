# Planner v2: the final report

- Commits, 2026-11-24: 1.1 1bd28eb, 1.2 3e6ed19, 1.3 8316b6f, 1.4 86e5fdb, 1.5 4b953e6, 1.6 ea97ad5; 2.1 d9b520d, 2.2 to 2.4 7387276 (one commit: they share AdminPlanner.jsx), 2.5 bbcac65; 3.1 094df6f, 3.2 5598114, 3.3 28f3190, 3.4 2f62aa0 with fixes 6522139 and c108e62. All done; none blocked.
- The planner read, new fields only. client: logoUrl (the showcase logo through safeUrl), firstName (the first word of askFor), alerts { review, today, ideas }. Each post: postedAt, postedBy (client or rob), changeReason (photo, words, date, other), previous ({ imageUrl, caption, note } of the newest version, or null). Each idea: seen, made. Nothing else new leaves the server (planner-endpoint-test asserts every key).
- Unit and route tests: planner-endpoint, planner-view (69), planner-board (59), planner-alerts (67), security, portal (249), pipeline, tasks, push-prefs, notify, sw, dst, coverage-push (133), share, links: pass.
- Browser: preship PASSED on the final tree; a11y 832 rows, 0 violations; layout clean at 320, 390, 430, 768, 1280; site-regression 18 of 18; planner-board-ui 47; back-test 238; gesture 19; autosave, chrome 173, empty 22: pass.
- feel-audit (1416 rows): the planner's only gap (a layout shift on Ideas with reduced motion) is fixed; the 214 other gap rows also fail on the base commit 50174e0.
- regression: 117 of 118. 25a (More now lists Quotes, from the Quotes job) predates this job and is left alone.
- Guard proofs: planner-alerts 6 of 6 (switch check, one Post today a day, no caption in a push, booleans only, quiet hours, device list), portal 123 of 123, notifications all proven. Exemptions added: none.
- Deviations (each in docs/PLANNER-V2-DECISIONS.md): firstName reads askFor; pushes name the day or say "your post", never a caption; Feed, "usually approves within" and the timeline read only what is loaded; no task carries a postId yet, so the Next up loop writes nothing; client quiet hours are 9 PM to 8 AM New York; the board's columns start at 1024, as the Deals board's do.
- Roadblocks: none (docs/PLANNER-V2-BLOCKERS.md).
- Needs Rob's phone: Save the picture and Open Instagram on a real iPhone; the glass bar over real photos; drag and long press on the board; turning on alerts from a Home Screen planner; each push landing on Review, the post and Ideas.
- Next step: open a client's planner link on your iPhone, add it to the Home Screen, turn on alerts, then press Send for approval on the board.
