# MAINTENANCE PAGE: "VISUALIZE IS UPGRADING ITS WEBSITE"

Built, verified, committed, and pushed to `origin/main`.

## Files changed and deleted

**Changed**: `src/main.jsx` (the `Maintenance` component and `Root()`'s
gate rewritten), `src/index.css` (the old `.uc-*` starfield/rocket/
password block replaced with a new, much smaller one; three new tokens),
`scripts/audit-screens.mjs` (one `marketing: true` entry),
`docs/RUNBOOK.md`, `docs/ARCHITECTURE.md` (VITE_MAINTENANCE_PASSWORD
removed from both).

**Deleted**: nothing as separate files; the starfield SVG markup, the
rocket SVG markup, the password form JSX, the `onUnlock` prop, and every
`.uc-star`, `.uc-stars-svg`, `.uc-rocket-*`, `.uc-orbit-*`, `.uc-badge`,
`.uc-dot`, `.uc-headline`, `.uc-gold`, `.uc-sub*`, `.uc-divider`,
`.uc-contact`, `.uc-phone`, `.uc-form*`, `.uc-pw-*`, `.uc-footer-credit`
rule and their four keyframes were all removed from inside `src/main.jsx`
and `src/index.css`, along with the `maintenancePassword` constant.

No new files.

## Hex count

`node scripts/hex-count.js`: **108** (was 119 at the start of this task;
the space-themed screen's own hardcoded starfield/rocket colors accounted
for most of the drop. The three new tokens this rebuild added, `--uc-bg`,
`--uc-text`, `--uc-text-secondary`, reuse the dark theme's own existing
`--bg-deep`/`--text`/`--text-secondary` literal values rather than
introducing new ones).

## Audit results

| Check | Result |
|---|---|
| `npm run build` (maintenance mode off, the normal build) | Clean |
| `VITE_MAINTENANCE_MODE=true` build | Clean |
| Layout, 320/390/768/1280 + 844x390 landscape | Zero overflow at every width, on the maintenance screen and, unscoped, on every other marketing route |
| axe (`wcag2a/2aa/21a/21aa`) | 0 violations |
| `node scripts/css-orphans.mjs` | 0 across 947 classes in 150 files |
| `node scripts/regression.mjs` (admin, unrelated to this change) | 64/64 |
| Typing behavior | Confirmed progressing character by character over time; under `prefers-reduced-motion`, the sentence and its three dots render fully typed immediately, no animation |
| Background color, forced light theme and no stored preference | Both resolve to `rgb(8, 8, 8)` (`--uc-bg`), confirming the screen stays "the brand black ground" regardless of the site's own toggle |
| Screenshots at 390 and 1280 | Reviewed, both read cleanly |

`scripts/audit-screens.mjs` gained a `marketing: true` entry
(`mkt-maintenance`), noted there as the one entry that needs its own
`VITE_MAINTENANCE_MODE=true` build to render at all, since this screen is
a full app override at the React root, not a route the shared `dist/`
every other `marketing: true` entry uses can reach.

## Confirmation: the admin host is untouched

Two things had to be true, both verified directly rather than by
inspection alone:

1. **No api/ function reads `VITE_MAINTENANCE_MODE`.** Confirmed by grep,
   zero matches in `api/`. The variable is `VITE_`-prefixed, so it was
   never exposed to server code in the first place.
2. **The admin host does not show the maintenance screen even with the
   flag on.** This one needed a real fix: `Root()` returned
   `<Maintenance />` before `<App />` (and its own `IS_ADMIN_HOST` branch)
   ever mounted, so a shared deployment with `VITE_MAINTENANCE_MODE=true`
   set would have shown this screen on `admin.visualizeclients.com` too,
   not just the public host. Fixed with one added condition,
   `maintenanceMode && !IS_ADMIN_HOST`. Verified by building a
   maintenance-mode bundle, serving it from a plain static server (to get
   around `vite preview`'s own host allowlist), and loading it as both
   `admin.visualizeclients.com` (mapped to 127.0.0.1 in `/etc/hosts` for
   the test only, removed immediately after) and `localhost`: the admin
   host reached the real login card with zero `.uc-screen` elements in the
   DOM, `localhost` showed the maintenance screen as expected.

## Commits

| Hash | What |
|---|---|
| `c3a7681` | The rebuild: the mark, wordmark, typed line, breathing glow, reduced-motion handling, SEO tags, the password/starfield/rocket removal |
| `1da1616` | Fixed a crash (a leftover `useRef` reference threw on every load) and a theme leak (the screen followed the site's light/dark toggle instead of staying fixed dark), both found by actually loading the built screen in a browser before calling the first commit done |
| `9026854` | Fixed the admin-host gap described above |

All three pushed to `main`.
