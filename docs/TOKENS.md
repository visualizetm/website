# VISUALIZE DARK: design tokens

Declared once on `.lay-root` in `src/ui/tokens.js` (injected via `uiStyles` from `src/ui/index.js`), prefix `--v-`.
Every admin surface reads them with `var()` from its CSS-in-JSX string; nothing
is imported. Dark is the default theme; Light (Prompt 14) redefines every color
token under `.lay-root[data-v-theme='light'], [data-v-theme='light'] .lay-root`.
The picker (Settings Profile, or the account menu) saves the mode on the
profile document and mirrors it to the `vz_theme` key the marketing site
already reads; the pre-paint script in index.html stamps `data-v-theme` on
`<html>` before the bundle runs. The `/design` route renders both themes and
their contrast tables live.

Usage rules
- New code uses `--v-` tokens only. Raw hex belongs in this file and the token
  block, nowhere else (`node scripts/hex-count.js` tracks the count).
- Text on any layer: `--v-text` for primary, `--v-text-2` for secondary,
  `--v-text-3` for muted. All three pass 4.5:1 on all four layers.
- Red is for primary actions, wins, and focus. Red as *text* is
  `--v-red-highlight` (the base red fails 4.5:1 as small text on surfaces).
- Status colors come through `src/shared/semantics.js`, never typed inline.
- Cards use `--v-radius-lg`, sheets and modals `--v-radius-xl`, chips and
  buttons `--v-radius-md` or `--v-radius-pill`.
- Nothing smaller than `--v-text-xs` (12px). Nothing tappable smaller than
  `--v-tap` (44px).

## Color

| Token | Value | Purpose |
|---|---|---|
| `--v-ground` | `#080808` | Page background |
| `--v-surface-1` | `#121212` | Cards, panels |
| `--v-surface-2` | `#1a1a1a` | Card on card, inputs, raised rows |
| `--v-surface-3` | `#232323` | Third step (chips on raised rows) |
| `--v-overlay` | `rgba(0,0,0,0.65)` | Sheet and modal backdrop |
| `--v-bar` | `#0a0a0a` | Pinned bars, rail, tab bar |
| `--v-border` | `rgba(255,255,255,0.08)` | Default hairline |
| `--v-border-strong` | `rgba(255,255,255,0.16)` | Emphasized edge, hover |
| `--v-border-focus` | `#d44c43` | Focus ring |
| `--v-text` | `#fafafa` | Primary text |
| `--v-text-2` | `#cccccc` | Secondary text |
| `--v-text-3` | `#8f8f8f` | Muted text (replaces #8a8a8a, #6a6a6a, #636373) |
| `--v-text-inverse` | `#080808` | Text on solid status fills and light chips |
| `--v-text-on-red` | `#ffffff` | Text on red fills (see contrast note) |
| `--v-red` | `#d44c43` | Brand red, primary fills, focus |
| `--v-red-hover` | `#c2413a` | Hover/pressed red |
| `--v-red-highlight` | `#e66b63` | Red as text or icon on dark |
| `--v-red-soft` | `rgba(212,76,67,0.14)` | Red tint for badges and active chips |
| `--v-red-glow` | `0 8px 28px rgba(212,76,67,0.32)` | Glow under primary buttons and the red hero |

Status set (`-solid` fills carry `--v-text-inverse`; `-soft` tints carry `-text`):

| Tone | Pipeline meaning | solid | soft | text |
|---|---|---|---|---|
| new | New lead, No answer, Meeting soon | `#f59e0b` | `rgba(245,158,11,0.14)` | `#f59e0b` |
| progress | Contacted / In progress / Paid | `#60a5fa` | `rgba(96,165,250,0.14)` | `#60a5fa` |
| callback | Callback, Replied, In production | `#a78bfa` | `rgba(167,139,250,0.14)` | `#a78bfa` |
| booked | Booked, Landed, Client, Delivered | `#22c55e` | `rgba(34,197,94,0.14)` | `#22c55e` |
| won | Won, Hot priority | `#c2413a` (white label) | `rgba(212,76,67,0.16)` | `#e66b63` |
| danger | Denied, Said no, Lost | `#ef4444` | `rgba(239,68,68,0.14)` | `#f87171` |
| neutral | Not called, misc | `#8f8f8f` | `rgba(255,255,255,0.07)` | `#a3a3a3` |

Charts: `--v-chart-1..6` = `#d44c43 #60a5fa #22c55e #f59e0b #a78bfa #34d399`;
`--v-chart-text` (the label on a bar) is `--v-text-inverse`. Light redefines the six as
`#c2413a #1d4ed8 #15803d #b45309 #6d28d9 #047857` with a white `--v-chart-text`
(bars 3.65 to 6.43 against the cream layers, labels 5.02 to 7.10 on the bars). Every bar reads
3:1 or better against every layer and the label 4.5:1 on the bar (the design
page shows the numbers live).

Prompt 15 retunes (axe against rendered pixels): the won solid is the pressed
red `#c2413a` and carries the white label (5.11:1; the brand red under white
was 4.27), the danger solid is `#ef4444` so the dark label passes (4.9; the
old `#dc2626` was 4.35), neutral text is `#a3a3a3` so a neutral pill still
passes on a selected card (surface-2 plus the tint, 5.0; `#8f8f8f` was 4.43),
and the active tab bar label and sidebar item use `--v-red-highlight`
(5.93 on surface-1; the base red was 4.38). `.v-sr-only` is the visually
hidden text utility for assistive technology.

## Contrast table (WCAG 2.x, computed)

| Text | on ground #080808 | on surface-1 #121212 | on surface-2 #1a1a1a | on surface-3 #232323 |
|---|---|---|---|---|
| `--v-text` #fafafa | 19.19 | 17.95 | 16.67 | 15.06 |
| `--v-text-2` #cccccc | 12.47 | 11.67 | 10.84 | 9.79 |
| `--v-text-3` #8f8f8f | 6.19 | 5.79 | 5.38 | 4.86 |
| new text #f59e0b | 9.33 | 8.72 | 8.10 | 7.32 |
| progress text #60a5fa | 7.88 | 7.37 | 6.85 | 6.18 |
| callback text #a78bfa | 7.36 | 6.88 | 6.40 | 5.78 |
| booked text #22c55e | 8.79 | 8.22 | 7.64 | 6.90 |
| won text #e66b63 | 6.34 | 5.93 | 5.51 | 4.98 |
| neutral text #a3a3a3 | 7.87 | 7.36 | 6.84 | 6.18 |
| danger text #f87171 | 7.24 | 6.77 | 6.29 | 5.68 |
| neutral text #8f8f8f | 6.19 | 5.79 | 5.38 | 4.86 |
| retired #8a8a8a | 5.80 | 5.43 | 5.04 | 4.55 |
| retired #6a6a6a | 3.70 | 3.46 | 3.22 | 2.91 (fail) |
| retired #636373 | 3.40 | 3.18 | 2.95 | 2.67 (fail) |
| raw red #d44c43 as text | 4.69 | 4.38 (fail) | 4.07 (fail) | 3.68 (fail) |

Solid fills with `--v-text-inverse` #080808: new 9.33, progress 7.88, callback
7.36, booked 8.79, won (red) 4.69, danger #dc2626 with white 4.80, neutral 6.19.

Known exception, recorded not hidden: `--v-text-on-red` #ffffff on `--v-red`
#d44c43 is **4.27:1** (AA for large/bold text only). On `--v-red-hover`
#c2413a it is 5.11:1. Prompt 3 decides whether primary buttons use 15px+ bold
labels or the hover shade as the fill; the brand red itself is not changing.

## Light theme (Prompt 14)

Cream canvas, warm surfaces stepping darker, dark text ramps, the same brand
red, semantic hues retuned so every text-on-surface pairing passes 4.5:1. The
sidebar stays Visualize black in both themes through its own tokens
(`--v-sidebar-bg`, `-text`, `-text-2`, `-text-3`, `-border`, `-hover`,
`-active-bg`, `-active`), which alias the shell in dark and are pinned to the
dark values in light.

| Token | Light value |
|---|---|
| `--v-ground` | `#f7f3ee` |
| `--v-surface-1` / `-2` / `-3` | `#f1ece5` / `#eae4db` / `#e2dbd0` |
| `--v-bar` | `#f3efe8` |
| `--v-overlay` | `rgba(26,22,19,0.45)` |
| `--v-border` / `--v-border-strong` | `rgba(26,22,19,0.10)` / `rgba(26,22,19,0.20)` |
| `--v-text` / `-2` / `-3` | `#1a1613` / `#4a433c` / `#5f574e` |
| `--v-text-inverse` | `var(--v-text)` (solid fills keep their hue and carry the dark label) |
| `--v-red-highlight` | `var(--v-status-won-text)` = `#9e2f28` |
| `--v-red-soft` | `rgba(212,76,67,0.12)` |
| status text: new / progress / callback / booked / won / danger | `#8a3d0c` / `#1a44c2` / `#6d28d9` / `#166534` / `#9e2f28` / `#a91b1b` |
| status solid: danger / neutral | `#f87171` / `#a3a3a3` (the other solids keep their dark values) |
| `--v-shadow-2` / `-3` | `0 6px 20px rgba(26,22,19,0.12)` / `0 16px 48px rgba(26,22,19,0.18)`, each with the hairline ring |
| `--v-grid-texture` | the same grid at 0.03 alpha |

Light contrast table (WCAG 2.x, computed):

| Text | on ground #f7f3ee | on surface-1 #f1ece5 | on surface-2 #eae4db | on surface-3 #e2dbd0 |
|---|---|---|---|---|
| `--v-text` #1a1613 | 16.27 | 15.30 | 14.23 | 13.08 |
| `--v-text-2` #4a433c | 8.80 | 8.28 | 7.70 | 7.08 |
| `--v-text-3` #5f574e | 6.42 | 6.04 | 5.61 | 5.16 |
| new text #8a3d0c | 6.90 | 6.49 | 6.03 | 5.55 |
| progress text #1a44c2 | 7.17 | 6.74 | 6.27 | 5.77 |
| callback text #6d28d9 | 6.43 | 6.05 | 5.62 | 5.17 |
| booked text #166534 | 6.45 | 6.07 | 5.64 | 5.19 |
| won text #9e2f28 | 6.58 | 6.19 | 5.75 | 5.28 |
| danger text #a91b1b | 6.65 | 6.26 | 5.82 | 5.34 |
| raw red #d44c43 as text | 3.87 (fail) | 3.64 (fail) | 3.38 (fail) | 3.11 (fail) |

Solid fills with the dark label #1a1613: new 8.37, progress 7.07, callback
6.61, booked 7.89, won (red) 4.21 (Pill solid won uses the white label through
`--v-text-on-red`, 4.27 as in dark), danger #f87171 6.50, neutral #a3a3a3
7.13. Soft tints with their text on surface-3: new 5.16, progress 5.27,
callback 4.73, booked 4.76, won 4.62, danger 4.69.

## Typography

`--v-font-display` Barlow Condensed (fallback Inter), `--v-font-body` Inter.

| Step | size / line height / tracking |
|---|---|
| `--v-text-xs` | 12 / 16 / +0.08em (all-caps labels, the floor) |
| `--v-text-sm` | 13 / 18 / 0 |
| `--v-text-md` | 15 / 22 / 0 (body) |
| `--v-text-lg` | 17 / 24 / -0.005em |
| `--v-text-xl` | 20 / 26 / -0.01em |
| `--v-text-2xl` | 24 / 28 / -0.015em |
| `--v-text-3xl` | 30 / 34 / -0.02em |
| `--v-display-sm` | 32 / 32 / -0.01em |
| `--v-display-md` | 44 / 42 / -0.012em |
| `--v-display-lg` | 60 / 56 / -0.015em |

Weights: `--v-weight-regular` 400, `-medium` 500, `-semibold` 600, `-bold` 700.

## Spacing, radius, sizing

- `--v-space-1..12` = 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48px.
- `--v-gutter` `clamp(16px, 3vw, 24px)`; `--v-gutter-l/-r` = gutter floored by
  the side safe-area insets; `--v-inset-top/-bottom` = raw `env(safe-area-inset-*)`;
  `--v-tabbar-h` 58px; `--v-safe-bottom` = tab bar + `env(safe-area-inset-bottom)`.
- `--v-content-w` 760, `--v-content-w-wide` 900, `--v-panel-w` 324 (Prompt 3).
- `--v-radius-sm` 6, `-md` 10, `-lg` 16, `-xl` 22, `-pill` 999.
- `--v-tap` 44, `--v-tap-lg` 56, `--v-control-h` 44; `--v-icon-sm/md/lg`
  14/18/24; `--v-sidebar-w` 240, `--v-sidebar-rail-w` 68.

## Shadow, glow, motion, z, texture

- `--v-shadow-1/2/3`: hairline ring; ring + 16px spread; ring + 40px spread.
- `--v-glow-red`; `--v-glow-status` = 3px ring of `currentColor` at 22%.
- `--v-dur-fast/base/slow/enter` 120/200/320/400ms, `--v-stagger` 40ms,
  `--v-ease-out`, `--v-ease-in-out`, `--v-ease-spring`. Under
  `prefers-reduced-motion: reduce` and under `data-v-motion='reduce'` (the
  Settings Profile switch, mirrored to the `vz_motion` key) every duration is
  0ms. JS timers that follow a transition read the tokens through
  `durationMs()` in src/ui/motion.js, so nothing hardcodes a duration.
- `--v-z-base` 0, `-sticky` 10, `-tabbar` 50, `-sheet` 60, `-modal` 70,
  `-toast` 90, `-command` 100.
- `--v-grid-texture` (+ `--v-grid-texture-size` 44px): the faint red grid,
  applied only where intended (`background-image: var(--v-grid-texture)`).

## Aliases kept for existing screens (migrated screen by screen, Prompts 4-12)

| Old variable | Now |
|---|---|
| `--lay-gutter`, `--lay-tabbar-h`, `--lay-rail-w`, `--lay-bar-bg`, `--lay-border` | `var(--v-gutter)`, `var(--v-tabbar-h)`, `var(--v-sidebar-rail-w)`, `var(--v-bar)`, `var(--v-border)` |
| `--lay-content-w` 760, `--lay-content-w-wide` 900, `--lay-panel-w` 324 | `var(--v-content-w)`, `var(--v-content-w-wide)`, `var(--v-panel-w)` (Prompt 3) |
| `.aa-app`: `--a-border/-panel/-card/-raised/-muted/-sec/-brand` | gone (Prompt 12); every admin rule reads `--v-` directly |
| `.cc-page`: `--c-border/-card/-card2/-muted/-sec/-brand` | same mapping (`--c-border` was 0.09 alpha, now the shared 0.08) |
| PrintsAdmin `--bg/--glass-*/--text-*` | retired with the screen (Prompt 13) |
| index.css marketing tokens (`--brand`, `--bg`, `--space-*`) | untouched; the admin does not read them |
