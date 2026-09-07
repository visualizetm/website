# MARKETING MOTION

Reusable motion primitives for the public marketing site, under
`src/marketing/motion/`. Built for a "one idea per screen" feel: a hero, one
overlapping image, numbered sections, calm reveals on scroll, nothing
decorative or gimmicky. Wired into `src/components/Footer.jsx` first, as the
proof it works; later prompts use it on the rest of the site.

These are marketing-only. They read the marketing token block on `:root` in
`src/index.css` (`--brand`, `--text`, `--space-*`, and so on), never the
admin's `--v-` tokens on `.lay-root` (see `src/ui/motion.js` for that
separate system) - two different hosts, two different token sets.

## The four tokens

Declared on `:root` in `src/index.css`, next to the existing `--ease` /
`--duration` pair:

| Token | Value | What it is | Rationale |
|---|---|---|---|
| `--m-dur` | `600ms` | The Reveal transition duration | Slow enough to read as a deliberate, calm entrance (roughly 2x the admin's `--v-dur-enter` of 400ms), fast enough not to make a viewer wait to read the next section. Kept at the suggested starting value; no deviation. |
| `--m-ease` | `cubic-bezier(0.16, 1, 0.3, 1)` | The Reveal easing curve | A standard "ease-out expo"-family curve: fast start, long soft settle, no bounce. Reads as calm rather than springy, matching the reference feel. Kept at the suggested starting value. |
| `--m-rise` | `16px` | The Reveal translateY distance | Small enough to read as a settle-into-place, not a slide-in; matches the admin kit's own restraint (its cards do not fly in from off screen either). Kept at the suggested starting value. |
| `--m-stagger` | `60ms` | The per-child delay step for Stagger | Fast enough that a row of items reads as one wave, not a slow roll call; six steps (the cap, see below) tops out at 300ms of spread, still well inside the reveal's own 600ms so nothing feels laggy. Kept at the suggested starting value. |

None of the four are colors, so nothing here touches the hex-count budget.
Where a primitive's own CSS (in `src/index.css`, see below) needs a color it
reuses an existing token: `--text-muted`, `--border-light`, `--font-display`.

## Reduced motion and touch detection

One shared module, `src/marketing/motion/shared.js`, is the only place that
touches `matchMedia`. Every primitive below is built on it, so the detection
logic exists exactly once:

- **Reduced motion**: `window.matchMedia('(prefers-reduced-motion: reduce)')`.
  Exposed as `prefersReducedMotion()` (one-shot read) and `useMotionPreference()`
  (a hook, live-updated via the media query's `change` event, initialized
  synchronously from `prefersReducedMotion()` so the very first render
  already reflects it - no flash of "assuming motion" before an effect runs).
- **Touch / coarse pointer**: `window.matchMedia('(hover: none), (pointer: coarse)')`
  - a media query *list*; the comma is OR, so either "no hover capability" or
  "coarse (touch) pointer" is enough to disable Parallax. No user-agent
  sniffing anywhere. Exposed as `isCoarsePointer()` and `useCoarsePointer()`,
  the same one-shot-plus-live-hook shape as the motion pair.

**The hard rule every primitive follows**: under reduced motion, the final,
fully-visible end state renders immediately - nothing is left hidden waiting
on a scroll trigger, and nothing merely animates faster. This is enforced in
JS, not left to the global CSS reduced-motion rule in `src/index.css` alone
(that rule still applies, as a second layer, to any transition/animation
duration that leaks through): `useRevealOnce` accepts `disabled` and, when
true, reports "already in view" from its very first render (via a lazy
`useState` initializer, so there is no first frame where it reports "not yet
visible"), Counter's counting `useEffect` never starts when `reduced` is
true, and Parallax's scroll listener is never attached when `reduced` (or
touch) is true.

Shared exports from `src/marketing/motion/shared.js` (also re-exported from
the barrel, `src/marketing/motion/index.js`):

- `prefersReducedMotion()`, `isCoarsePointer()` - one-shot boolean reads.
- `useMotionPreference()`, `useCoarsePointer()` - live-updated hooks.
- `useRevealOnce({ threshold, rootMargin, disabled })` - returns `[ref, inView]`;
  the IntersectionObserver-once pattern Reveal and Counter both build on.
  Observing stops the moment it fires once; it never re-fires on scrolling
  away, and `disabled: true` skips the observer entirely.
- `cssMs(name, fallback)` - reads a duration custom property off `:root` in
  milliseconds (mirrors the admin's `durationMs()` in `src/ui/motion.js`, but
  reads `:root` rather than `.lay-root`, because marketing's tokens live
  there). Stagger uses this to read `--m-stagger` so its step math stays in
  sync with the token instead of a second hardcoded number.
- `cx(...parts)` - joins truthy class name strings.

## Class names and `scripts/css-orphans.mjs`

`scripts/css-orphans.mjs`'s `EXCLUDE_PREFIX` list already whitelists classes
starting with `reveal` and `stagger`, anticipating this build. This module
does **not** use those bare prefixes - it uses `m-reveal`, `m-stagger`,
`m-parallax`, `m-counter`, `m-section-number`, and `m-marquee` instead, on
purpose: the codebase already has an older, separate `.reveal` /
`.reveal-left` / `.reveal-right` / `.reveal-scale` / `.stagger` class
convention (`src/hooks/useReveal.js`, wired up by a global
`IntersectionObserver` in `src/App.jsx`, currently used by `Hero.jsx`). That
system predates this one and is out of scope here (Part A/B do not touch
`Hero.jsx`); reusing its exact class names would have made two independent
reveal systems both react to the same DOM elements. The `m-` prefix keeps
them from colliding.

This means the `EXCLUDE_PREFIX` allowance does not actually apply to any
class this module defines - and it does not need to. Every `.m-*` class
defined in `src/index.css` is also written as a literal string in a
`src/marketing/motion/*.jsx` file (e.g. `m-reveal--visible` appears literally
in `Reveal.jsx`'s `cx(...)` call), which is exactly what
`scripts/css-orphans.mjs`'s static scan looks for, so no false-positive
orphan report is expected. Flagging this here anyway, per the prompt's
instruction, so it is easy to triage if `node scripts/css-orphans.mjs` ever
disagrees.

## API

### `Reveal`

Fades a section in and rises it `--m-rise` as it enters the viewport,
animating once (it stops observing after the first trigger - it never
re-hides on scrolling away).

| Prop | Default | Does |
|---|---|---|
| `as` | `'div'` | Element/component rendered. |
| `delay` | `0` | Extra delay in ms before the transition starts (applied as `transition-delay`; skipped entirely under reduced motion, since nothing is animating to delay). |
| `threshold` | `0.2` | IntersectionObserver threshold. |
| `rootMargin` | `'0px'` | IntersectionObserver rootMargin. |
| `className` | `''` | Extra class names, appended after `m-reveal`/`m-reveal--visible`. |
| `style` | - | Merged with the internal `transitionDelay`. |
| `children` | - | Content. |

Any other prop (e.g. `id`, `aria-*`) passes through to the rendered element.

```jsx
import { Reveal } from '../marketing/motion';

<Reveal as="section" delay={100}>
  <h2>One idea per screen</h2>
</Reveal>
```

### `Stagger`

Renders its children (any number of React elements) each through the same
reveal-on-scroll behavior as `Reveal`, with each child's delay stepped by
`--m-stagger` times its index - capped at index 5 (the 6th item): a 7th+
child keeps the 6th item's delay rather than growing further, so a long list
never makes the last on-screen item wait an ever-longer beat to appear.

Chosen shape: **children, not an `items` render prop** - `Stagger` wraps
whatever elements you pass it (via `React.Children.toArray`), each becoming
its own `Reveal`. This keeps ordinary JSX lists (`.map(...)`) working
unchanged; wrap the `.map(...)` output in `<Stagger>` instead of a plain
`<div>`.

| Prop | Default | Does |
|---|---|---|
| `as` | `'div'` | Outer wrapper element/component. |
| `itemAs` | `'div'` | Element/component each child is wrapped in. |
| `threshold` | `0.2` | Passed to each child's `Reveal`. |
| `rootMargin` | `'0px'` | Passed to each child's `Reveal`. |
| `className` | `''` | Extra class on the outer wrapper. |
| `itemClassName` | `''` | Extra class on each item's `Reveal`. |
| `style` | - | Style on the outer wrapper. |
| `children` | - | The items to stagger in. |

```jsx
import { Stagger } from '../marketing/motion';

<Stagger as="ul" itemAs="li" className="feature-list">
  {features.map(f => <span key={f.id}>{f.label}</span>)}
</Stagger>
```

### `Parallax`

Wraps an image (or any element) and applies a subtle `translateY` as the
user scrolls, capped at 24px of travel either direction. Off entirely under
reduced motion or on a touch / no-hover / coarse-pointer device - on those,
it renders as a plain static wrapper with no scroll listener attached at
all (not just a CSS override).

| Prop | Default | Does |
|---|---|---|
| `as` | `'div'` | Element/component rendered. |
| `factor` | `0.15` | How much of the element-to-viewport-center distance becomes travel; higher is more drift. |
| `max` | `24` | Cap on travel in px either direction; never exceeds the hard 24px ceiling even if a caller passes a larger number. |
| `className` | `''` | Extra class names. |
| `style` | - | Merged with the internal `transform`/`willChange`. |
| `children` | - | Content (typically one image). |

```jsx
import { Parallax } from '../marketing/motion';

<Parallax className="hero-overlap-image">
  <img src={photo} alt="" />
</Parallax>
```

### `Counter`

Counts up from 0 to `value` once the element is revealed in the viewport
(reuses the same IntersectionObserver-once pattern as `Reveal`, via
`useRevealOnce`). Under reduced motion it shows `value` on the first frame -
it never counts, not even quickly.

| Prop | Default | Does |
|---|---|---|
| `as` | `'span'` | Element/component rendered. |
| `value` | - | The target number (required). |
| `duration` | `1200` | Count-up duration in ms (ease-out cubic). |
| `decimals` | `0` | Decimal places shown. |
| `prefix` / `suffix` | `''` / `''` | Strings wrapped around the number, e.g. `suffix="+"`. |
| `format` | - | `(n) => string` override; when given, `prefix`/`suffix`/`decimals` are ignored. |
| `threshold` | `0.2` | IntersectionObserver threshold. |
| `rootMargin` | `'0px'` | IntersectionObserver rootMargin. |
| `className` | `''` | Extra class names. |

```jsx
import { Counter } from '../marketing/motion';

<Counter value={50} suffix="+" /> {/* -> "50+" once revealed */}
```

### `SectionNumber`

A small presentational "01"-style zero-padded numeral next to a thin
hairline rule, for numbering sections on a page. No motion of its own -
wrap it in `<Reveal>` where a caller wants it to enter with the section.

| Prop | Default | Does |
|---|---|---|
| `value` | - | The number (required), e.g. `1`. |
| `label` | - | Optional text shown after the rule, e.g. `"Services"`. |
| `padTo` | `2` | Zero-pad width (`1` -> `"01"`). |
| `className` | `''` | Extra class on the outer wrapper. |

```jsx
import { Reveal } from '../marketing/motion';
import { SectionNumber } from '../marketing/motion';

<Reveal>
  <SectionNumber value={1} label="Services" />
</Reveal>
```

### `Marquee`

A horizontal, slow, seamless infinite-loop scroller (for a future logo
strip). Pausable on hover via `animation-play-state` (default on; set
`pauseOnHover={false}` to opt out). Static under reduced motion: content
renders once, in a manually horizontally-scrollable row, no animation.

| Prop | Default | Does |
|---|---|---|
| `duration` | `30` | Seconds for one full loop. |
| `gap` | `48` | Gap in px between items (and, internally, the boundary gap between the loop's two duplicated groups, so the seam matches the internal spacing). |
| `pauseOnHover` | `true` | Whether hovering pauses the scroll. |
| `className` | `''` | Extra class on the outer wrapper. |
| `trackClassName` | `''` | Extra class on the moving track. |
| `children` | - | The items to loop (e.g. logo images); internally duplicated once for the seamless wrap, with the second copy marked `aria-hidden`. |

```jsx
import { Marquee } from '../marketing/motion';

<Marquee duration={40}>
  {logos.map(l => <img key={l.id} src={l.src} alt={l.name} height={24} />)}
</Marquee>
```

---

# THE SCROLL ENGINE (Site Prompt 6)

Everything above is CSS transitions driven by `IntersectionObserver`, with
no library behind it. Everything below is scrubbed: the animation's
position is a function of the scroll offset, so scrolling back up plays it
backwards. That needs a real scroll engine, and this is where it lives.

## What loads, and when

`src/marketing/scroll.js` is the only module that touches gsap or Lenis,
and it does so through `import()` so both land in chunks of their own
(`gsap`, `lenis`, pinned by `manualChunks` in `vite.config.js`). Three
gates decide what is fetched at all:

| Condition | gsap + ScrollTrigger | Lenis |
|---|---|---|
| Admin host (`IS_ADMIN_HOST`) | no | no |
| `prefers-reduced-motion: reduce` | no | no |
| Touch / coarse pointer | yes | **no** |
| Marketing host, fine pointer, motion allowed | yes | yes |

Scroll-driven animation is fine on a phone; hijacking a phone's native
scrolling is not, so Lenis is desktop-only. The admin never fetches either
chunk: `scrollEngineAllowed()` returns false before any `import()` runs.
Only the loader itself, about a kilobyte, is in the shared entry.

| Export | Does |
|---|---|
| `scrollEngineAllowed()` | Synchronous yes/no on the three gates above. Helpers call it during their first render so they never paint a hidden frame they will not animate out of. |
| `loadScrollEngine()` | Resolves to `{ gsap, ScrollTrigger, lenis }`, or `null` when not allowed or the import failed. Loads once per session; every caller shares one promise. |
| `getScrollEngine()` | The engine if already loaded, else `null`. Never starts a load. |
| `refreshScrollTriggers()` | Re-measures every pinned and scrubbed trigger. |
| `destroyScrollEngine()` | Kills every trigger and stops Lenis. |

`src/marketing/ScrollRoot.jsx` mounts the engine. It renders nothing, sits
in the marketing branch of `src/App.jsx` only, and on every route change
sends the page back to the top (Lenis owns the scroll position once it is
running, so `window.scrollTo` alone is not enough) and then refreshes every
trigger against the page that just mounted.

## Failure is a design state, not an edge case

Every helper below has three states, and its text is legible in all three:

- **off** - reduced motion, the admin host, or a failed `import()`. The
  helper's base CSS class *is* this state: the final, resting look. Nothing
  is hidden behind a script that may never arrive.
- **loading** - the few frames between mount and gsap resolving. The
  helper holds its starting pose.
- **on** - handed to a scrubbed ScrollTrigger.

Reduced motion is decided synchronously on the first render, so a
reduced-motion viewer never sees a motion frame at all. What they get is
the composed final state plus the plain `Reveal` fades from the light set.

## Heavy set versus light set

**Heavy set: `Pin`, `Curtain`, `WordReveal`, `TrackScroll`. Home only.**
These take over the scroll: they hold a section still, slide one section
over another, or move a row sideways while the page goes down. That is
right for a landing page a visitor is browsing and wrong for a page they
came to read, where taking the scroll away from them is an obstacle.

**Light set: `Reveal`, `Stagger`, `Parallax`, `Counter`, `SectionNumber`,
`Marquee`, `ScaleIn`, plus at most one `Tone` shift per page.** Nothing
pinned, nothing that changes how far a scroll travels. Safe on every page.

| Page | Set |
|---|---|
| Home (`/`) | Heavy. Pinned hero, Curtain entrances, WordReveal headings, the business-type TrackScroll, two Tone shifts. |
| Clients (`/clients`) | Light. `Reveal`, `Stagger`, `ScaleIn` on covers, one `Tone`. |
| Client detail (`/clients/:slug`) | Light. |
| Contact (`/contact`, `/book`) | Light. One `WordReveal` heading is the single exception, it does not touch the scroll. |
| Start (`/start`) | Light. |
| Services (`/services`) | Light. |
| Lead partner (`/lead-partner`) | Light. |

Lenis stays on everywhere on the marketing host. It is the feel of the
scroll itself, not an effect, and turning it off between pages would be
more noticeable than leaving it on.

## API

### `useScrollEngine()`

Returns `'off' | 'loading' | 'on'`. Use it to pick the class that decides
which of the three states above a helper renders.

### `useScrollProgress(ref, options)`

Scrubs 0 to 1 while `ref`'s element crosses the viewport, writing the value
to a CSS custom property every scroll frame. CSS reads that property inside
`transform` and `opacity`, so scrubbing costs no React renders at all.

| Option | Default | Does |
|---|---|---|
| `start` | `'top bottom'` | ScrollTrigger start position. |
| `end` | `'bottom top'` | ScrollTrigger end position. |
| `cssVar` | `'--sp'` | The property written each frame. |
| `varTarget` | the trigger | A different ref to write the property on. |
| `onUpdate` | - | `(progress, element)` for the rare case JS has to react. |

Returns a ref whose `.current` is the latest progress, for reads outside
render. With no engine the property is never written, so whatever fallback
the stylesheet gives it is what the viewer sees.

```jsx
const ref = useRef(null);
useScrollProgress(ref, { cssVar: '--fade-p', end: 'center center' });
<section ref={ref} style={{ opacity: 'var(--fade-p, 1)' }} />
```

### `useScrollRefresh(dep)`

Re-measures every trigger one frame after `dep` changes. Home passes its
showcase payload: a pin that measured the page before the CRM sections had
any content in them would hold for the wrong distance once they did.

### `Pin`

Holds a section still for `height` extra viewport heights while its
children animate against `--pin-p` (0 to 1 across the hold), which is set
on the inner panel. The hold is `position: sticky`, not a JS transform, so
it never jitters and never fights the browser's own scrolling.

| Prop | Default | Does |
|---|---|---|
| `height` | `1.5` | Extra viewport heights to hold for. |
| `innerClassName` | `''` | Extra class on the sticky panel. |
| `onProgress` | - | `(p)` each frame, if JS needs it. |

Without the engine the wrapper keeps its natural height and nothing sticks,
so write the children so that `--pin-p: 0` is a state a viewer can be left
in. Heavy set, Home only.

```jsx
<Pin height={1.5}>
  <h1 style={{ opacity: 'calc(1 - var(--pin-p, 0) * 2)' }}>Headline</h1>
</Pin>
```

### `Curtain`

The section arrives over the one before it, rounded at the top, while the
section it covers scales back a little and dims. Finds its predecessor at
runtime (`previousElementSibling`) and writes `transform` and `opacity` to
it directly from the scroll frame, both composited, no layout property
touched. Takes no props beyond `as`, `className` and `style`. Heavy set.

### `ScaleIn`

An image or card settles from slightly oversized and transparent into place,
once, on first viewport entry. The one new helper that is not scrubbed: it
is a CSS transition on the same `IntersectionObserver` `Reveal` uses, which
is why it is safe on every page. Props match `Reveal` (`delay`,
`threshold`, `rootMargin`, `as`, `className`). Light set.

### `WordReveal`

A headline whose words rise into place one after another as it crosses the
viewport, scrubbed. Pass a plain string as the only child.

| Prop | Default | Does |
|---|---|---|
| `as` | `'h2'` | The heading tag. |
| `start` | `'top 85%'` | Where the reveal begins. |
| `end` | `'top 45%'` | Where it finishes. |

Each word gets one clipping span so it rises out from behind its own line,
with descenders protected by a static padding/margin pair. The spaces
between words stay real text nodes, so the heading still reads, copies and
is announced as one sentence. Heavy set, with Contact's heading the one
documented exception (it does not take over the scroll).

### `TrackScroll`

A row of cards that moves sideways while the page scrolls down, the section
pinned until the row runs out. Desktop and a fine pointer only, above
860px: ScrollTrigger pins the section and translates the row by exactly the
distance it overflows, recomputed on every refresh
(`invalidateOnRefresh`) so a resize, a font swap or a late fetch never
leaves the last card unreachable.

Everywhere else, and with no engine, it is a plain vertical stack of the
same cards in the same order. On touch the page snaps gently to them
(`scroll-snap-type: y proximity`, never `mandatory`, added to `<html>` only
while a track is mounted), so a card tends to settle centred without ever
trapping the scroll. Heavy set.

### `Tone`

A section changes ground colour as it comes up the page, so a long page
does not read as one flat surface. Implemented as the opacity of one filled
layer over the section's own background: crossfading two layers is
compositor work, animating `background-color` is not.

| Prop | Default | Does |
|---|---|---|
| `from` | `'var(--bg)'` | The section's own ground. |
| `to` | `'var(--bg-elevated)'` | What it settles to. |

Without the engine the layer sits at full opacity, so the section still
shows its settled tone. Light set, at most one per page.
