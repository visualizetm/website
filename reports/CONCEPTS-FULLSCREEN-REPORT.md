# Concepts full screen: report

The "Enter full screen" cue on every concept image and a full screen stage to answer in, on `/concepts/:token`. No API change, no new function (10 of 12 stay), no env var, cron or collection.

## Commits

All on 2026-11-06. The three build milestones landed together because the cue, the stage and the decisions share one component and one test, so they could not be run apart.

| Milestone | Commit | What |
| --- | --- | --- |
| 1 cue, 2 stage, 3 decisions | 985b774 | The cue inside the one `.cp-main` button, the compact chip after first entry, the intro buttons, the stage (wide, phone, rail), Next and Previous, every answer through the page's `decide`, Pick one through the existing panels, locked and present sets |
| 4 proof and docs | 38b6cd4 | Review fixes (pinned footer, dock cap, note drafts per direction, async save guard), `concepts-fullscreen-test`, `concepts-fullscreen-guard-proof`, five audit entries, docs |
| 4 | 250c355 | The phone dock shows the state chip when no decision button does (reference, decided Pick one) |
| 4 | 7b5800a | The About text keeps its height and scrolls inside its 40 percent cap |
| 4 | 35cdb34 | Lint clean test, decisions and progress docs match the final stage |

## Gates

| Gate | Result |
| --- | --- |
| `npm run lint` | pass |
| `node scripts/hex-count.js` | 78 (53 tokens, 20 index.css, 5 LeadPartner), not up |
| `node scripts/css-orphans.mjs` | 0 orphans across 2380 classes |
| `concepts-fullscreen-test` (390 and 1280) | 440 checks, 0 failures |
| `concepts-fullscreen-guard-proof` | 6 of 6 cuts caught |
| `concepts-review-test` | 37 checks pass |
| `concepts-endpoint-test` | pass |
| `concepts-lib-test` | pass |
| `security-test` | 1155 checks, 0 failed |
| `layout-audit`, five widths | clean, zero offenders (3028 s) |
| `a11y-audit`, both themes | 690 rows, 0 critical, 0 serious, 0 moderate, 0 minor |
| `feel-audit`, dark, both motion modes | clean at 390 and 1280, no gaps logged |
| `feel-audit`, light, both motion modes | see the final line of this report |
| concepts `scene-audit`, 320 390 430 768 1280 | clean |
| concepts `scene-audit`, reduced motion | clean |
| `regression` | 118 steps, 0 failures |
| `site-regression` | 18 steps, 0 failures |
| `npm run preship` | see the final line of this report |
| review token `scene-audit` (extra, not in the gate) | 2 profiles fail, see below |

## Audit expectations changed

Zero. No existing check was loosened, skipped or rewritten. Five marketing entries were added to `scripts/audit-screens.mjs` (cue, stage computer, stage phone, Needs changes editor, stage in present mode). The old `mkt-concepts-viewer` entry keeps working untouched because the stage keeps the class `cp-viewer`.

## Guards

Each fault put into a copy of the repository and built; the test had to fail.

| Cut | Fault | Result |
| --- | --- | --- |
| F1 | a decision control in present mode | caught |
| F2 | a decision control on a locked set | caught |
| F3 | the note requirement removed | caught |
| F4 | the scrim's first stop at 0.4 | caught |
| F5 | the Fullscreen request on the overlay instead of the document element | caught |
| F6 | page scroll not restored on close | caught |

## Found on the way

- The cue's contrast is proved by arithmetic (axe cannot judge text over a gradient) plus measured pixels over a pure white picture: 10.5 to 1.
- `useDialog` re-ran on every parent render and pulled focus off inputs in the existing panels; it now keeps `onClose` in a ref and answers Escape only on the top dialog (an approve panel over the stage closed both before).
- A note draft leaked between directions and a slow save could close the editor of the direction the client had moved to; both fixed with a per direction draft and a direction guard.
- The Review each page fails the scene audit's text overlap check at 390 and 1280 (the fixed "Send my answers" bar over the scrolling directions). The same two profiles fail on the milestone 1 build, so this is not from the stage. The gate in CLAUDE.md runs the Pick one token only, which passes. Left as is.

## Needs Rob's phone

Built to spec and tested only in Playwright emulation:

- the real Fullscreen API behaviour on Android and desktop Safari (the test records which element was asked);
- the keyboard over the dock (the visualViewport lift, `--st-kb`);
- the notch and home indicator in landscape (the rail's safe area padding).

An iPhone has no page Fullscreen API, so there the stage fills the viewport in page.

## Not done

Nothing in the brief was dropped. Known limit: when the window crosses 900 px or the phone turns, the layout flips and focus can drop to the stage itself (state and a typed note are kept).

## Stale docs

No stale function count: `api/` holds 10 function files, as `CLAUDE.md` and `docs/RUNBOOK.md` say. `docs/MOBILE-PROGRESS.md` and `docs/MOBILE-DECISIONS.md` gained a Concepts full screen section.
