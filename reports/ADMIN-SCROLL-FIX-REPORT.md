# FIX: CLIENT DETAIL AND SHOWCASE EDITOR DO NOT SCROLL ON MOBILE

Reproduced at 390 by 844 with a touch profile against the built admin:
open the Clients list, tap a fixture client, and the page will not move.
Same on the Showcase editor reached from there.

## 1. What the measurement said, before any change

Every candidate scrolling element on the client detail, at 390 by 844:

| Element | overflow-y | clientHeight | scrollHeight | Can scroll |
|---|---|---|---|---|
| `html` / `body` | visible | 844 | 844 | no |
| `div.sh-root.lay-root` | **hidden** | 844 | **7151** | no (it clips) |
| `div.lay-scroll.dt-scroll` | auto | **7090** | **7090** | **no** |

That is the whole bug in one row. The scroller's own height is 7090px
inside an 844px screen, and it holds exactly 7090px of content, so there
is nothing to scroll. Everything past the first screen is then clipped by
`.sh-root`, which is why the profile card, Start call, Edit all, Showcase,
Phone and Ask for are visible and nothing below them is reachable.

The Clients list, on the same screen, was fine: `div.lay-scroll.cl-page`,
clientHeight 725, scrollHeight 1736.

Walking the ancestor chain named the cause exactly. Every element between
the shell and the scroller reported `min-height: 0px` except one:

    main.aa-app.sh-content     flex=1 1 0%   minH=0px     h=725   sh=7090
    div.aa-main.cl-main        flex=1 1 0%   minH=auto    h=7090  sh=7090
    div.lay-shell.dt           flex=1 1 0%   minH=0px     h=7090  sh=7090
    div.lay-scroll.dt-scroll   flex=1 1 auto minH=0px     h=7090  sh=7090

`.cl-main` had `min-height: auto`, so it could not shrink below its
content, grew to the full height of the record, and everything below it
inherited that height.

The Showcase editor failed differently and for a second reason: its shell
`div.lay-shell.aa-main` computed to `display: block`, which takes its
ScrollArea out of the flex column entirely, so `flex: 1 1 auto` meant
nothing and the scroller sized itself to its content.

## 2. Was it a regression, and from what

**Not from `369b76d`.** That commit changed `body`'s `overflow-x` from
`hidden` to `clip`, and `src/index.css` is shared with the admin, so it
was the right thing to check. It is not the cause: the admin's scroll
container has never been the body. It is `.lay-scroll` inside
`.sh-root`, and `.sh-root` carries `overflow: hidden` on both builds. The
ancestor chain is identical either side of that commit, and the body
reports `overflow-y: visible` and `scrollHeight === clientHeight` in both.
If anything that commit helped: `clip` cannot become a scroll container,
`hidden` can.

**Not from Site Prompt 7 either, for the client detail.** Removing the
Showcase tab and adding the Showcase button changed what is inside the
detail, not how it is laid out; `.cl-main` has been missing `min-height:
0` since it was written. What Site Prompt 7 did do is give the second bug
a new victim: the editor moved to its own page and used `aa-main--wide`,
which the mobile media query turns into `display: block`.

**Both bugs were live and unreported on other screens.** The same
measurement across every admin screen found four broken on a phone, not
two: the client detail, the Showcase editor, **the booked detail**
(`.bk-main`, same missing `min-height`), and **the Landing screen**
(`aa-main--wide`, same `display: block`).

## 3. What changed

**`src/pages/AdminClients.jsx`, `src/pages/AdminBooked.jsx`** —
`.cl-main` and `.bk-main` gain `min-height: 0`. `.ld-main` on Leads
already had it, which is why Leads always scrolled and Clients did not.

**`src/pages/AdminApp.jsx`** — in the `max-width: 767px` block,
`.aa-main--wide` and `.aa-app.has-detail .aa-main` were
`display: block; flex: 1`. They are now
`display: flex; flex-direction: column; flex: 1; min-height: 0`, which is
what they are on a desktop. A screen's shell has to stay a flex column
that is allowed to shrink, or the layout contract in LAYOUT.md stops
holding at the one width where it matters most.

**`src/pages/AdminShowcase.jsx`** — two more, both found by measuring
rather than reading:

- The editor's bottom padding was written as `padding-bottom: 132px`,
  which lost to `.lay-scroll`'s own `padding` shorthand: the computed
  value was 16px, so the last card sat under the save bar and, on a phone,
  under the tab bar. It goes through the kit's own `--v-scroll-extra` hook
  now, which ScrollArea folds into both `padding-bottom` and
  `scroll-padding-bottom`. Computed bottom padding is 120px.
- The save bar was inside the ScrollArea. A fixed overlay is not scroll
  content; it is a sibling of the scroller now.

The rest of the checklist needed no change and is confirmed below.

## 4. Before and after, every admin screen at 390 by 844

Same fixtures, same server, same probe. `h` is the scroller's
clientHeight, `sh` its scrollHeight.

| Screen | Before | After | |
|---|---|---|---|
| Dashboard | h 725, sh 3632 | h 725, sh 3632 | unchanged |
| Leads list | h 725, sh 1864 | h 725, sh 1864 | unchanged |
| Lead detail | h 725, sh 4345 | h 725, sh 4345 | unchanged |
| Booked | h 725, sh 1012 | h 725, sh 1012 | unchanged |
| **Booked detail** | **h 6665, sh 6665** | **h 656, sh 6665** | **fixed** |
| Call room | h 644, sh 1165 | h 644, sh 1165 | unchanged |
| Clients list | h 725, sh 1736 | h 725, sh 1736 | unchanged |
| **Client detail** | **h 7090, sh 7090** | **h 725, sh 7090** | **fixed** |
| **Showcase editor** | **h 5184, sh 5184** | **h 725, sh 5184** | **fixed** |
| Calendar | h 725, sh 866 | h 725, sh 866 | unchanged |
| Orders | h 725, sh 984 | h 725, sh 984 | unchanged |
| Concepts | h 725, sh 725 | h 725, sh 725 | unchanged (fits) |
| Reviews | h 725, sh 1458 | h 725, sh 1458 | unchanged |
| Submissions | h 725, sh 2128 | h 725, sh 2128 | unchanged |
| Settings | h 725, sh 1070 | h 725, sh 1070 | unchanged |
| **Landing** | **h 1518, sh 1518** | **h 725, sh 1518** | **fixed** |

Every screen reaches its own bottom afterwards, and every screen's last
content clears the tab bar. The content itself is untouched: every
`scrollHeight` is identical either side.

## 5. The rest of the checklist

- **Section root pattern.** Both pages already render through it
  (`PageShell` then `ScrollArea`, the shell owning viewport height). The
  break was above them, in the wrapper the shell sits in.
- **No ancestor with overflow hidden or a collapsing height.** Confirmed
  by walking the chain: after the fix every element from `.sh-root` down
  reports `min-height: 0`, and the only `overflow: hidden` is `.sh-root`
  itself, which is the shell doing its job.
- **The two-column desktop layout at mobile widths.** This was exactly the
  problem, and is fixed: the mobile rules no longer flatten the shell to a
  block.
- **Sticky headers.** The editor's `.sc-topbar` is `position: sticky`
  inside the scroller, not fixed, and makes no parent a scroll container.
- **`--v-safe-bottom`.** The shell already reserves the tab bar (the
  scroller is 725px tall in an 844px viewport, tab bar top at 786). The
  editor additionally reserves the save bar through `--v-scroll-extra`.
  Measured with the bar open: last content ends at 666, bar top at 677,
  tab bar top at 786.
- **The save bar and touch.** Closed it is `pointer-events: none` and a
  hit test through its box returns the page beneath. Open, a hit test 40px
  above it returns page content and only its own box returns its buttons.
  It intercepts nothing outside itself.

## 6. Verification

| Check | Result |
|---|---|
| `npm run build` | Clean |
| New scroll check catches the bug | Verified against the pre-fix build: the client detail and the editor both FAIL there ("scroller grew to its content instead of the screen: clientHeight=7089 scrollHeight=7089"), and pass on this one |
| `layout-audit.mjs`, whole app, dark, 320 / 390 / 430 / 768 / 1280 | **All routes clean at every width, zero offenders** (825 rows), including all 14 client-detail states and all 5 Showcase editor states at every width |
| Same, light theme, the Clients block (both fixed pages plus every screen sharing their layout), five widths | **All routes clean at every width, zero offenders** (350 rows) |
| `a11y-audit.mjs`, client detail and Showcase editor, 390 and 1280, both themes | 16 rows, 0 violations at every impact |
| `regression.mjs` (admin, 64 steps) | 64 steps, 0 failures |
| `css-orphans.mjs` | 0 orphans across 982 classes in 161 files |
| Real touch drags, client detail | 5 swipes to the bottom, scrollTop 6365 of 6365, 13 section headings passed (Links, Brand, Overview, The angle, Accomplishments, Gaps, Payments, Retainer, Deliverables, Brand Files, History, submissions) |
| Real touch drags, Showcase editor | 4 swipes to the bottom, scrollTop 4563 of 4563, 9 headings passed (Showcase, Publish, Card fields, Brand identity, Website, Business cards, Landing page, Testimonials) |

## 7. What the audit gained

`scripts/layout-audit.mjs` now checks three things about every admin
screen's scroller, so this class of bug cannot come back silently:

1. the scroller fits the screen (it has not grown to its content),
2. it can reach its own bottom, and
3. its last content clears the tab bar and any floating bar.

`scripts/audit-screens.mjs`'s stale "showcase tab" row, which still tried
to click a tab that Site Prompt 7 removed, became two rows for the
editor's own route: the fully populated client and the one whose uploads
are a portrait and a panorama.

## Commit

`86b20f8` — Fix: the client detail and Showcase editor could not scroll on
a phone.
