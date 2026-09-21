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
reaches n minus 1.35 and is fully revealed at n minus 1, then holds. So
step 1 is on screen at progress 0 (the first frame of a scene, and of
the page, is never a bare stage), each later step arrives over the last
0.35 of the beat before its own, and the last step holds for one full
beat before the scene lets go. The brief phrased the window as "n minus
0.35 to n"; with progress starting at 0 that leaves the stage with
nothing revealed for the first 0.65 of a step and releases the scene the
instant the last step has landed. `stepReveal(p, n)` is the same number
in JS, for the one child that changes text (How it works' counters).

Three states, the content legible in all three: `m-scene--pinned` (engine
on or loading), `m-scene--flow` (`steps=0`, motion allowed), and
`m-scene--static` (reduced motion, the admin host, a failed import: no
pin, everything shown).

## Where the block sits (Site Prompt 12)

The stage centres the fully revealed stack by auto margins (never
`justify-content: safe center`: Safari does not know `safe` in a flex
container, drops the declaration and top-aligns the stage). On top of
that the engine shifts the body by a scrubbed transform so the VISIBLE
block is what a person sees placed: centred when it is tall enough,
otherwise no lower than 15 percent under the navbar, building downward
as steps land. The heights come from layout offsets once per refresh
(`H[k]` is the stack's height with steps 0 to k in); per frame it is one
sum and one style write. The drift leads each reveal by a third of its
window so an arriving item is never inside the step indicator's box
while it can be seen. While a stage is still entering from below, its
block rides at the stage's top edge (the stage's top padding is taken
off), blended back over the last tenth of the entry. The step indicator
is pinned to the stage's bottom above the home indicator inset, with a
24px gap under the block.

Cards that stack in one slot arrive opaque (a scale-in from 0.97 over the
card below, settled at 0.96), never as a fade: a fading card shows the
card beneath it through itself for a third of a step. The hero's cover
names swap hard: name n goes out over the first half of a 0.15 step
window as cover n+1 arrives, name n+1 comes in over the second half, so
two names are never above zero at once.

## The audit

`scripts/scene-audit.mjs` scrolls a page in 5 percent increments and
captures, at every increment, a screenshot, each stage's rect, which
steps are revealed, and what a person would see. The phone profiles are
the viewport a phone actually shows with Safari's bars on screen
(390x720, 320x500, 430x800; `SCENE_HEIGHTS=390:844` overrides one), not
the full screen: the old 390x844 was 124px taller than any phone ever
shows Home at, which is where the button under the indicator lived.

It fails if: a pinned stage is not exactly the viewport height; a
stage's content does not fit its box; visible content inside a held
stage is above the navbar's bottom edge; visible content intersects the
step indicator's box or comes within 16px of it; two visible text
elements overlap by more than 4px with no effectively opaque element
between them; a single word breaks across lines; more than one hero
cover name is visible at any of 20 positions through the hero; a step
shows before its progress or hides while pinned; two pinned stages fill
the viewport at once; the footer is unreachable; or scrolling back does
not reverse the reveal.

Dead space is measured from painted pixels: the screenshot is decoded in
the page and a row is empty when it is within 8 units of a surface
colour across more than 90 percent of its width. Inside a held stage no
band between the block's first and last painted row may exceed 15
percent of the viewport; the block is centred (its bands above and below
within 32px of each other) or, when too short to centre without more
than 15 percent above it, sits at that cap; once the scene is fully
revealed no band above or below the block may exceed 15 percent; and a
stage entering from below has its first content within 15 percent of its
own top edge. A cover photo paints its own rows, so a backdrop stage is
judged by its block's placement, not by rows. The whole-viewport empty
share is reported, not judged: by the row rule a paragraph is mostly
empty rows (line gaps, ascender space) and a four letter link is an empty
row, so a screen full of text reads 60 percent empty; the bands are what
a person sees.

What the old audit missed, and why: it counted a `data-step` child's
final box as content whether or not it had revealed, so a stage with one
card slot and half a viewport of black read as full; it had no text
overlap check; it had no navbar clearance check for content inside a
held stage; and it ran the phone at 844px tall.
