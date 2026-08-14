# Admin layout system

One layout system for every admin surface (Dashboard, Submissions, Orders,
Call Console, Settings, detail views, modals, forms). It exists so three bug
classes are impossible by construction:

1. **Horizontal overflow** — nothing can be wider than the viewport.
2. **Pinned bars covering content** — pinned bars are in normal flow, so the
   last list item is always reachable.
3. **Edge/notch crowding** — safe-area insets are handled once, centrally.

## The rule for every new page

> Every page renders inside **PageShell + ScrollArea**; every pinned bottom
> bar is a **StickyFooterBar**; list rows/cards carry **`.lay-card`**.
> Never hand-roll width, gutter padding, safe-area insets, or "padding-bottom
> to clear the bar" — read the tokens instead.

## Primitives — `src/components/AdminLayout.jsx`

| Primitive | Class | What it owns |
|---|---|---|
| `<PageShell>` | `.lay-shell` | Full-height flex column, `min-width/height: 0`, hosts scroll + bars |
| `<ScrollArea>` | `.lay-scroll` | The only scroll container. Gutter padding (safe-area aware), `overflow-x: clip`, `overscroll-behavior: contain`. Children center via `.lay-content` / `.lay-content--wide` (pass `bare` to skip) |
| `<StickyFooterBar>` | `.lay-footbar` | Pinned bottom actions. **In flow** (a sibling below the ScrollArea — structurally cannot cover rows), solid opaque `--lay-bar-bg`, safe-area bottom padding |
| row/card contract | `.lay-card` | `width/max-width: 100%`, `min-width: 0` on itself and children; titles truncate one-line via `.lay-truncate` (the site-wide list treatment; long headings *wrap* instead — global `overflow-wrap: break-word` on `body`) |
| overlay contract | `.lay-overlay` + `.lay-modal-box` | Fixed inset overlay with safe-area padding; box never wider/taller than the viewport, scrolls internally |

## Tokens — defined once on `.lay-root`

```
--lay-gutter        clamp(16px, 3vw, 24px)   horizontal page padding
--lay-gutter-l/-r   gutter, floored by safe-area left/right (landscape notch)
--lay-safe-top/bottom  env(safe-area-inset-*)
--lay-content-w     760px    detail / list content width
--lay-content-w-wide 900px   dashboard-style pages
--lay-tabbar-h      58px     mobile bottom tab bar
--lay-panel-w       324px    desktop contextual panel
--lay-rail-w        68px     desktop icon rail
--lay-bar-bg        #0a0a0a  pinned-bar surface (solid — never transparent)
--lay-stack-gap     per-page vertical rhythm inside .lay-content
--lay-scroll-extra  extra bottom scroll padding if an overlay is unavoidable
```

Change a number here and every page follows. `.lay-root` sits on the app
shells (`.aa-app`, `.cc-page`).

## Global guards — `src/index.css`

- `html, body, #root { width: 100%; max-width: 100%; }`, `body { overflow-x:
  hidden; overflow-wrap: break-word; }` — a long unbroken business name can
  never force page width. These are the safety net, not the fix; the fix is
  the primitives above.
- `box-sizing: border-box` on everything; `img/svg/video/canvas/iframe { max-width: 100% }`.
- `viewport-fit=cover` is set in `index.html` so `env(safe-area-inset-*)` works.

## Known intentional exceptions

- `.li-tablewrap` (spreadsheet import preview) scrolls horizontally **inside
  its own container** — the container itself still fits the viewport.
- The session view's desktop rail/side columns (`248px` / `320px`) are local
  to `.cs-wrap`'s grid in `AdminCalls.jsx`.
- The legacy print dashboard (`PrintsAdmin.jsx`, linked from Settings →
  Legacy tools) predates this system and is not covered.

## Regression check — run after touching layout

```bash
npm run build
npx vite preview --port 4330 &
node scripts/layout-audit.mjs   # walks every admin route at 320/390/430/768/1280
```

It loads hostile fixtures (80-char slash-joined names, unbroken 88-char
strings, giant emails) through mocked APIs and fails if any element extends
past the viewport or any page can scroll sideways. Zero offenders is the bar.
Covered views: dashboard, submissions list + detail, orders, settings, call
console session builder + session, the reverse-lookup sheet, the Booked
workspace list + detail, the Leads page list + detail, the Clients page
list + detail, and the mobile More sheet.
