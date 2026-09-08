# FIX: MOBILE SCROLLING ON THE PUBLIC SITE

Reproduced on an iPhone-shaped profile (390 by 844, touch, mobile UA,
device pixel ratio 3) with the CPU throttled 4x, scrolled with real CDP
touch drags rather than programmatic jumps. Six commits, one per fix.

**The short version.** Two things were wrong at once. `body` carried
`overflow-x: hidden`, which makes the body a scroll container, and a
scroll container is the box every `position: sticky` descendant sticks
inside, so every pinned section on the site was sticking to something that
never scrolls instead of to the viewport. And the page asked for far too
much scrolling on a phone: 14.9 screens, with one stretch of 4.4 screens
for three short sentences. Home is 10.1 screens now and no section takes
more than 2.4.

## Check by check

### 1. 100vh on iOS

**Found.** Every viewport-sized height was in `vh`, which on iOS is the
LARGE viewport: it does not change while the address bar hides and shows,
so a section sized at `100vh` hangs off the bottom of the screen with the
bar visible and appears to jump when it returns. `.m-pin-inner` and
`.m-track-inner` had an `svh` line but the pin *wrapper* height, the
static hero and `.page-shell` did not, so the panel and the space reserved
for it disagreed.

**Changed.** One `--svh` token, defined as `1vh` and upgraded to `1svh`
behind `@supports`, and every viewport height reads
`calc(100 * var(--svh))`. `ScrollRoot` overwrites `--svh` with a pixel
value from `innerHeight` only on browsers too old to know `svh`, and only
on a real resize: it ignores anything under 120px, which is the address
bar moving. `ScrollTrigger.config({ ignoreMobileResize: true })` so that
same address bar movement no longer counts as a resize; without it every
hide and show refreshed every trigger and re-measured a pinned section
mid-scroll, under the reader's finger.

### 2. Pinning on touch

**Found, and this is the root cause.** `body { overflow-x: hidden }`.
`hidden` on one axis makes the element a scroll container in both, and
that container becomes the scrollport for every sticky descendant. Nothing
pinned was sticking to the viewport. The sticky panels themselves also
used `overflow: hidden`, making each one a scroll container of its own
that touch scrolling can get caught inside.

**Changed.** `overflow-x: clip` on body (with `hidden` left in front as
the fallback for older engines), which stops sideways overflow without
creating the box, and `overflow: clip` on the sticky panels' own inner
viewport. Confirmed `pin: true` appears nowhere: `Pin`, the hero deck and
`TrackScroll` all hold themselves with sticky. Every scrub now goes
through one `scrubValue()`: exact on a wheel, half a second of catch-up on
touch, where tying the animation frame-for-frame to scroll reads as lag.

### 3. The hero deck length

**Found.** The deck held for count times 0.8 viewports; eight covers is
over six screens before the page moves on. Worse and not in the brief:
`How it works` pinned three steps at 0.4 viewports each, which came to
**4.4 screens of scrolling for three short sentences**, the single longest
stuck stretch on the page.

**Changed.** Under 768px the deck is four covers at 0.5 viewports each,
and the covers that no longer fit are still shown, in the horizontal row
underneath (which sits after the pinned section, not inside it, since
anything inside a `Pin` lives in the sticky panel and would be clipped; a
wrapper keeps the two together so the following Curtain still has one
element to scale and dim). `How it works` does not pin on a phone at all.
The six business type cards, the longest run of real content left at 2.6
screens, were tightened under 768px to 2.2 without dropping a card or a
line.

### 4. Scroll snap and the TrackScroll stack

**Found.** `TrackScroll` put `scroll-snap-type: y proximity` on `<html>`
while its mobile stack was mounted, so the whole document snapped. Even at
proximity that fights a flick: the page decides where the reader meant to
stop, which is part of why scrolling felt taken away.

**Changed.** Gone. What is left snaps only inside a scroller that owns its
own axis: the testimonial carousel's horizontal track and the hero's
overflow row. Confirmed nothing sets `overscroll-behavior` or
`touch-action` on `body` or `html`; every use of either is an admin kit
component scoped to its own scroller or control.

### 5. Lenis

**Found.** Gated on the pointer query alone. A phone or tablet with a
mouse paired, and some Android browsers unprompted, answer that query as a
desktop, so smooth scrolling could start on top of a real finger, which is
the lag it exists to avoid.

**Changed.** The gate is the pointer query AND `('ontouchstart' in window
|| navigator.maxTouchPoints > 0)`, and if a touch arrives after Lenis
started anyway it removes its ticker and destroys itself on that first
`touchstart`. Verified on both profiles: the touch profile fetches the
gsap chunk and never the lenis one, and no `lenis` class lands on `<html>`;
the desktop profile fetches both and gets the class.

### 6. Passive listeners and layout thrash

**Mostly already right.** Every scroll-driven write already ran inside
ScrollTrigger's own tick, which is gsap's `requestAnimationFrame`, never a
scroll event, and read no layout. `Parallax` was already rAF-batched,
passive, and disabled outright on coarse pointers. Two things were
wasteful: the progress value was written every frame even when unchanged,
and formatted to four decimals.

**Changed.** Three decimals (finer than a pixel on any of these) and the
write is skipped when the rounded value has not moved, so a frame where
nothing changed no longer invalidates style. Same for the Curtain's two
writes. The one non-passive scroll listener left anywhere in the codebase
(the admin popover's) is passive now.

### 7. The Curtain on touch

**Found.** `Curtain` set `will-change: transform, opacity` on the section
it covers and never removed it, holding a compositor layer per curtained
section for the life of the page.

**Changed.** The hint goes on when the curtain enters its active range and
comes off when it leaves. The deck's covers are already promoted by each
card's own `translate3d`, one layer per card; a second `translateZ(0)` on
the image inside would add a redundant layer per card and save no
repaints, so instead the hint is scoped to the pinned deck, and the static
fallback and overflow row hold no layer at all.

### 8. Body height during pin

**No change needed; verified.** After the fetch resolves and
`useScrollRefresh` re-measures, the document height is stable for the
whole scroll (zero height changes across a full top-to-bottom run), the
scroll position is kept, and the footer is reachable. The one height
change is the CRM's own content arriving: 5836px to 8939px, once, in the
first second.

### 9. Reduced motion on iOS

**No change needed; verified** on the touch profile with Reduce Motion on:
neither engine chunk is fetched, zero pinned sections, zero sticky panels,
no dots, every cover shown (one in place and the rest in the row), every
Reveal already visible and every WordReveal static. 9.1 screens tall.

## Scroll trace, before and after

Real CDP touch drags, 390 by 844, CPU throttled 4x, top to bottom.

| Page | | Doc height | Longest section | Backwards frames | Footer reachable |
|---|---|---|---|---|---|
| Home | before | 14.9 screens | 4.4 (How it works) | 6 (worst -5px) | yes |
| Home | after | **10.1** | **2.4** (the hero) | **0** | yes |
| Clients | before | 3.8 | 2.0 | 0 | yes |
| Clients | after | 3.8 | 2.0 | 0 | yes |
| Client detail | before | 4.9 | 0.6 | 0 | yes |
| Client detail | after | 4.9 | 0.6 | 0 | yes |

Home's sections after, largest first: hero 2.4, business types 2.2, recent
clients 1.7, how it works 1.0, platforms 0.6, testimonials 0.4. Nothing
over the two-and-a-half-screen bar.

Sections are measured as the innermost `section` elements, not the
wrappers around them: a Curtain holding two sections, or the detail page's
single `<article>`, is not a stretch the reader sits through.

## Long tasks during the scroll

| | 4x CPU | 6x CPU |
|---|---|---|
| Before | 0 tasks, 0ms | 0 tasks, 0ms |
| After | 0 tasks, 0ms | 0 tasks, 0ms |

Nothing over 50ms in either build, on any of the three pages. The
scroll-driven work is all transform and opacity on the compositor with one
rAF-batched write per frame, which is why the counts are zero rather than
merely low; the fixes in checks 6 and 7 reduce work that was never
blocking the main thread long enough to register.

## Lighthouse, Home, mobile preset

Three runs each, dark, against the fixture-backed mock server. This
sandbox is noisy enough that single numbers mislead, so the ranges:

| | Performance | LCP | TBT | CLS |
|---|---|---|---|---|
| Before | 91 to 93 | 3.0 to 3.1 s | 0 to 130 ms | 0 to 0.045 |
| After | 92 to 93 | 3.0 s | 20 to 50 ms | 0 to 0.045 |

No change beyond run-to-run noise, which is the honest read: none of these
fixes removes main-thread work that Lighthouse was measuring. What they
fix is the feel of the scroll and how much of it there is, and the numbers
that moved are in the trace table above.

## Other audits

| Check | Result |
|---|---|
| `npm run build` | Clean |
| `layout-audit.mjs` with the image overlap check, 320 and 390 | All routes clean at every width, zero offenders |
| `a11y-audit.mjs`, marketing, 390 | 11 rows, 0 violations at every impact |
| Same, reduced motion | 11 rows, 0 violations |
| `css-orphans.mjs` | 0 orphans across 982 classes in 161 files |
| `site-regression.mjs` | 10 steps, 0 failures |
| Hex count / function count | 80 / 9, both unchanged |

## One thing worth saying plainly

You mentioned the CRM. Nothing here touches it: the scroll engine has
never loaded on the admin host, and the two fixes that could reach it (the
popover's passive listener, and `body { overflow-x: clip }`, which the
admin shares) were both verified against the admin's own 64-step
regression in the previous prompt and its screens here. If the scrolling
you hit was inside the admin rather than the public site, say so and I
will go at that separately: the admin scrolls inside its own `ScrollArea`
components, which is a different mechanism entirely.

## Commits

| Hash | Fix |
|---|---|
| `41a1c41` | Check 1: pin heights off vh, onto the small viewport |
| `369b76d` | Check 2: stop the body being a scroll container |
| `704d00d` | Check 3: a phone gets a shorter deck and no pinned steps |
| `13c038e` | Check 4: snapping only inside scrollers that own an axis |
| `7d15ded` | Check 5: Lenis asks the device, not just the pointer |
| `63fc0f8` | Checks 6 and 7: fewer writes per frame, fewer held layers |
| `1926728` | Checks 8 and 9 verified, and the last long section tightened |
