# THE SCENE ENGINE

One primitive, `Scene` (`src/marketing/motion/Scene.jsx`), replaces Pin,
Curtain, Tone and TrackScroll as page level tools on Home (Site Prompt 11).
Every section of Home is a Scene, and the page reads as a funnel: what
Visualize is, what it stands for, what it does for each kind of business,
how far you can take it, proof, process, action.

## Why the old page broke, and what prevents each failure now

**Sections overlapping the navbar.** The old pins reserved their scroll
with a wrapper height in one place and held their panel with a sticky
element sized in another (the hero's deck math, TrackScroll's measured
height set from JS, Pin's CSS height), and the navbar is sticky with its
own height that none of them subtracted; the moment the two numbers
disagreed, or an ancestor with a transform (a Curtain) turned sticky into
plain flow, a panel slid under the pill. A Scene's root and stage are
sized by the same two custom properties (`--scene-steps`, `--scene-d`),
the stage keeps `--nav-h` clear at its top, and no ancestor of a Scene
carries a transform or clips, so the spacer and the panel cannot disagree
and sticky cannot stop.

**A heading hidden behind the previous section.** A Curtain arrived over
its predecessor on a higher z-index, and on release the predecessor's
scale and dim were written back by the scroll frame, so a heading at the
top of the next section was painted under the panel that had just let
go. Scenes have no curtain: on release the next scene arrives under the
previous one in normal flow, nothing is stacked above anything, and the
only boundary ornament is a hairline on the stage's own top edge.

**Step content all visible at once.** Reveals were tied to viewport entry
(Reveal, Stagger, ScaleIn) or to a heading's own trigger, so whatever was
inside the viewport when the panel stuck appeared together, and a
pinned panel is inside the viewport for its whole hold. A Scene child's
reveal is a function of the scene's progress alone (`data-step="n"` reads
`--scene-p` into its own `--sr`), so step 3 cannot show before step 2
whatever the viewport is doing, and scrolling back reverses it exactly.

**Empty card shells.** Cards reached the screen before their data
(the hero deck before the CRM answered) or had their body clipped by the
sticky panel they lived in, so a visitor saw a frame with nothing in it.
CRM fed scenes render nothing until the data lands (the hero shows the
default cover, Recent clients and What clients say do not render at
all), and a stage clips nothing it holds: its fully revealed layout is
laid out at full size from the first frame, unrevealed children at
opacity 0 in their final place, so the panel is sized to what it will
show.

**Viewport sized gaps.** A pin held longer than its content (three short
lines held for three viewports), a panel centred one row in a full
viewport with the heading already scrolled away, and Curtains whose
negative margin let a section arrive only after the previous had fully
left, each put a screen of nothing in front of the reader. A Scene pins
for exactly `steps * stepDistance` and not a pixel more, its stage is
exactly one viewport with the whole layout centred as a unit, a
`steps=0` Scene is not pinned at all, and the next scene begins
directly under the previous one, so there is no scroll position where
the viewport holds nothing.

## The API

```jsx
<Scene steps={3} stepDistance={0.7} mobileStepDistance={0.5} tone="a" label="Hero" indicator indicatorLabels={[...]}>
  <h1 data-step="0">Revealed with the stage</h1>
  <p data-step="1">Fades and rises 16px as step 1 begins</p>
  <div data-step="2" data-reveal="custom">Reads its own --sr (0 to 1)</div>
</Scene>
```

| Prop | Default | Does |
|---|---|---|
| `steps` | `0` | Beats the stage is held for. 0 means not pinned: a normal section whose `data-step` children reveal on entering the viewport, in step order. |
| `stepDistance` | `0.7` | Viewports of scroll per step on a desktop. |
| `mobileStepDistance` | `0.5` | The same on a phone (under 768px). |
| `tone` | `'a'` | The stage's ground: `a` is the page ground, `b` the elevated surface. Consecutive scenes alternate. |
| `label` | - | The stage's region name. |
| `indicator` | `false` | The step indicator at the bottom of the stage: one 44px segment per step, filling as its step runs, each a named button that scrolls to its step. |
| `indicatorLabels` | - | Names for the segments ("Restaurants and cafes, 1 of 6"). |
| `onProgress` | - | `(p, root)` per frame for the rare child that has to change text (How it works' counters). |

What the engine writes: `--scene-p` (0 to steps) on the root every scroll
frame, `--step: n` on every `data-step` child once, `--sr` on every
`data-step` child through CSS. `--sr` is a registered property
(`@property`, a number, inherits), so a child's own elements can read it
and the audit can read its computed value.

The reveal window: a child at step n begins revealing when progress
reaches n minus 1 and is fully revealed at n minus 0.65, then holds.
The brief phrased the window as "n minus 0.35 to n"; with progress
starting at 0 that leaves the stage with nothing revealed for the first
0.65 of a step and releases the scene the instant the last step has
landed, so the window sits at the start of each beat instead and the
rest of the beat is reading time.

Three states, the content legible in all three: `m-scene--pinned` (engine
on or loading), `m-scene--flow` (`steps=0`, motion allowed), and
`m-scene--static` (reduced motion, the admin host, a failed import: no
pin, everything shown).

## The audit

`scripts/scene-audit.mjs` scrolls a page in 5 percent increments (390
touch, 1280, and every width Home is checked at) and captures, at every
increment, a screenshot, each stage's rect, whether any content overlaps
the navbar, the percentage of the viewport that is empty, and which steps
are revealed. It fails if a pinned stage is ever not exactly the viewport
height, any content overlaps the navbar, a step shows before its
progress, a revealed step later hides while pinned, the viewport is ever
more than 25 percent empty, two pinned stages are visible at once, the
footer is unreachable, or scrolling back does not reverse the reveal.
"Empty" is the share of the viewport's height with no content box in it,
where a `data-step` child counts by its final box whether or not it has
revealed yet, since that reserved space is the point of the layout;
outside a stage an element counts only when visible.
