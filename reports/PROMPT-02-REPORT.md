# PROMPT 02 REPORT: Design tokens, theme, semantic map, and cleanup

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`.
Commits: `471d077` (tokens), `9e5a5f6` (semantics, shared utilities, aliases, /design), `99645f0` (dead code), plus this report commit.

## 1. What was built

- A complete `--v-` token set declared once on `.lay-root` in `src/components/AdminLayout.jsx`: colors, status tones, charts, type scale, spacing, radii, shadows, glows, motion, sizing, z scale, grid texture, and an unwired light-theme stub.
- `src/shared/semantics.js` as the single source of truth for every status, outcome, priority, stage, contact type, meeting type, plan, and prep status, with `api/_semantics.js` mirroring the id lists for the two admin endpoints that validate them.
- Shared utilities under `src/shared/`: phone, dates, currency and number formatting, fetch wrapper, and WCAG color math.
- Old page-scoped variables (`--lay-*`, `--a-*`, `--c-*`) aliased to the `--v-` tokens so no screen changed appearance.
- Admin-guarded `/design` page (`src/pages/AdminDesign.jsx`) that reads every token live from the stylesheet and renders the whole system with computed contrast ratios.
- `docs/TOKENS.md`, a LAYOUT.md update, and `scripts/hex-count.js`.
- Nine dead-code items removed in one commit, plus the unused `sharp` package.

## 2. Files created, changed, deleted

Created:
- `src/shared/semantics.js`, `src/shared/dates.js`, `src/shared/format.js`, `src/shared/api.js`, `src/shared/color.js`
- `src/shared/phone.js` (moved from `src/lib/phone.js`, gained `telHref`)
- `api/_semantics.js`
- `src/pages/AdminDesign.jsx`
- `docs/TOKENS.md`, `scripts/hex-count.js`, `reports/PROMPT-02-REPORT.md`

Changed:
- `src/components/AdminLayout.jsx` (token block + aliases + reduced-motion + light stub)
- `src/pages/AdminApp.jsx` (semantics import, aliases, `/design` section, Settings link, `.aa-callprog` CSS removed)
- `src/pages/AdminCalls.jsx` (semantics + shared imports, aliases, dead code removed)
- `src/pages/AdminLeads.jsx`, `src/pages/AdminBooked.jsx`, `src/pages/AdminClients.jsx` (local status maps replaced)
- `src/lib/booked.js` (enums re-exported from semantics, `effectiveStage = normalizeStage`)
- `src/lib/spreadsheet.js`, `src/components/LinkedSubmissions.jsx` (phone import path)
- `api/admin/call-leads.js`, `api/admin/submissions.js` (id lists from `api/_semantics.js`, validation behavior unchanged)
- `LAYOUT.md`, `package.json`, `package-lock.json`

Deleted:
- `src/lib/phone.js` (moved, not dropped)
- `sharp` devDependency

## 3. Token list by group

Colors (layers): `--v-ground #080808`, `--v-surface-1 #121212`, `--v-surface-2 #1a1a1a`, `--v-surface-3 #232323`, `--v-overlay rgba(0,0,0,0.65)`, `--v-bar #0a0a0a`.
Borders: `--v-border rgba(255,255,255,0.08)`, `--v-border-strong rgba(255,255,255,0.16)`, `--v-border-focus #d44c43`.
Text: `--v-text #fafafa`, `--v-text-2 #cccccc`, `--v-text-3 #8f8f8f`, `--v-text-inverse #080808`, `--v-text-on-red #ffffff`.
Brand: `--v-red #d44c43`, `--v-red-hover #c2413a`, `--v-red-highlight #e66b63`, `--v-red-soft rgba(212,76,67,0.14)`, `--v-red-glow`.
Status (solid / soft / text): new `#f59e0b`, progress `#60a5fa`, callback `#a78bfa`, booked `#22c55e`, won `#d44c43` / `rgba(212,76,67,0.16)` / `#e66b63`, danger `#dc2626` / `rgba(239,68,68,0.14)` / `#f87171`, neutral `#8f8f8f` / `rgba(255,255,255,0.07)` / `#8f8f8f`. Softs are the solid at 0.14 alpha unless listed.
Charts: `--v-chart-1..6` = `#d44c43 #60a5fa #22c55e #f59e0b #a78bfa #34d399`.
Type: `--v-font-body`, `--v-font-display`; sizes xs 12, sm 13, md 15, lg 17, xl 20, 2xl 24, 3xl 30, display 32/44/60 with paired line heights and letter spacing; weights 400/600/700/800/900.
Spacing: `--v-space-1..12` on a 4px base; `--v-gutter clamp(16px,3vw,24px)`.
Radii: `--v-radius-sm 6`, `-md 10`, `-lg 16`, `-xl 22`, `-pill 999`.
Shadows and glows: `--v-shadow-1..3`, `--v-glow-red`, `--v-glow-status`.
Motion: `--v-dur-fast 120ms`, `-base 200ms`, `-slow 320ms`, `-enter 400ms`, `--v-stagger 40ms`, eases `--v-ease-out`, `--v-ease-in-out`, `--v-ease-spring`. All durations go to 0ms under `prefers-reduced-motion: reduce`.
Sizing: `--v-tap 44px`, `--v-tap-lg 56px`, `--v-control-h 44px`, icons 14/18/24, `--v-sidebar-w 240px`, `--v-sidebar-rail-w 68px`, `--v-tabbar-h 58px`, `--v-safe-bottom`.
Z scale: base 0, sticky 10, tabbar 50, sheet 60, modal 70, toast 90, command 100.
Texture: `--v-grid-texture`, `--v-grid-size 44px`.
Theme: `.lay-root[data-v-theme='light']` stub declared, nothing sets the attribute.

## 4. Contrast table (WCAG 2.x, computed with `src/shared/color.js`)

| Pair | Ratio | Result |
|---|---|---|
| text on ground | 19.19 | AAA |
| text-2 on ground | 12.47 | AAA |
| text-3 on ground | 6.19 | AA |
| text on surface-1 | 17.95 | AAA |
| text-2 on surface-1 | 11.67 | AAA |
| text-3 on surface-1 | 5.79 | AA |
| text on surface-2 | 16.67 | AAA |
| text-2 on surface-2 | 10.84 | AAA |
| text-3 on surface-2 | 5.38 | AA |
| text on surface-3 | 15.06 | AAA |
| text-2 on surface-3 | 9.79 | AAA |
| text-3 on surface-3 | 4.86 | AA |
| white on red #d44c43 | 4.27 | AA large only (known exception, see 10) |
| white on red-hover #c2413a | 5.11 | AA |
| white on danger #dc2626 | 4.80 | AA |
| red-highlight #e66b63 on ground | 6.02 | AA |
| status text tones on surface-1 | all above 5.0 | AA |

Full table with every layer pairing is in `docs/TOKENS.md`.

## 5. Aliases and what has no mapping

Aliased to `--v-`:
- `.lay-root`: `--lay-gutter`, `--lay-tabbar-h`, `--lay-rail-w`, `--lay-bar-bg`, `--lay-border`.
- `.aa-app`: `--a-border`, `--a-panel`, `--a-card`, `--a-raised`, `--a-muted`, `--a-sec`, `--a-brand`.
- `.cc-page`: `--c-border`, `--c-card`, `--c-card2`, `--c-muted`, `--c-sec`, `--c-brand`.

Kept as plain values with no `--v-` counterpart (layout widths, not design decisions): `--lay-content-w 760px`, `--lay-content-w-wide 900px`, `--lay-panel-w 324px`, `--lay-stack-gap`, `--lay-scroll-extra`, the safe-area helpers.
Untouched by design: PrintsAdmin variables, ClientPortal, and the marketing tokens in `src/index.css`.

## 6. Status maps removed and semantics import sites

Five duplicated maps collapsed into `src/shared/semantics.js`:
- AdminCalls `OUTCOMES` and `statusOf`
- AdminLeads `OUTCOME_META` and status colors
- AdminBooked `OUTCOME_COLORS` and `OUTCOME_LABELS`
- AdminClients `OUTCOME_LABELS` and `CONTACT_TYPES`
- AdminApp `LEAD_STATUSES` and `ORDER_STATUSES`

Import sites now: `src/pages/AdminApp.jsx`, `AdminCalls.jsx`, `AdminLeads.jsx`, `AdminBooked.jsx`, `AdminClients.jsx`, `AdminDesign.jsx`, `src/lib/booked.js`, `api/admin/call-leads.js`, `api/admin/submissions.js` (the last two through `api/_semantics.js`). Icons stay page-local: semantics carries icon names as strings and each page maps them to Untitled UI components.

## 7. Duplicates consolidated

- Phone formatting: one module, `src/shared/phone.js` (`formatPhone`, `last10`, `telHref`). `telOf` helpers in three pages now call `telHref`.
- Dates: `fmtDate`, `fmtDateTime`, `fmtWeekdayDateTime`, `todayInput`, `daysSince`, `relativeTime`, `countdownLabel`, `fmtMins` in `src/shared/dates.js`. Three separate `fmtLogTime`/`fmtMins` copies removed.
- Currency: `money`, `money2`, `num`, `plural` in `src/shared/format.js`.
- Fetch and optimistic patch: `apiFetch`, `patchWithRollback` in `src/shared/api.js`.
- Stage normalization: `effectiveStage` in `src/lib/booked.js` is now the shared `normalizeStage`.

## 8. Dead code removed, with evidence

All in commit `99645f0`, "chore: remove dead code (prompt 2)":
1. `AdminCalls.jsx` unused imports `Phone`, `Plus`, `Wordmark`: zero references after import line (grep).
2. `AdminCalls.jsx` standalone `cc-topbar` header branch (`!embedded`): the console is only ever rendered embedded from AdminApp, `embedded` is always true.
3. `AdminCalls.jsx` `vz_builder_preset` localStorage effect: nothing in `src/` writes that key.
4. `AdminCalls.jsx` `cs-card--flash` class emission: no CSS rule matched it.
5. `AdminCalls.jsx` 29 orphan CSS rules (`cc-topbar*`, `cq-controls`, `cc-search*`, `cq-pills`, `cc-pill`, and others): class names absent from all JSX.
6. `AdminCalls.jsx` mobile filter media block: targeted only the removed rules.
7. `AdminApp.jsx` `.aa-callprog*` CSS: the progress card it styled was replaced in the stats rebuild.
8. `sharp` devDependency: no import in `src/`, `api/`, or `scripts/`; the grep hits were the word in product copy.
9. `src/lib/phone.js`: replaced by the moved shared module, no importer left.

Left in place after checking: `useReveal.js` is used by `src/components/Hero.jsx`, and `SplashScreen.jsx` is used by `ClientPortal.jsx`. Both were on the candidate list and are not dead.

## 9. Hex count

Measured with `node scripts/hex-count.js` on identical trees.

| Point | Total | Unique |
|---|---|---|
| Before Prompt 2 (ad87b86) | 629 | 102 |
| After tokens + semantics | 624 | 105 |
| After dead code (99645f0) | 621 | 108 |

Unique count rose because the token block itself declares 43 literals in one place. Those are the values every screen will read from in Prompts 4 to 12, so the raw total is the number to watch. ClientPortal alone holds 91 and is out of scope.

## 10. Decisions made

- White on brand red measures 4.27, which passes AA only for large text. Prompt 3 decides whether primary buttons use `--v-red-hover` (5.11) as the resting fill or keep the brand shade and bump label size. Nothing was changed visually in this prompt.
- Danger solid became `#dc2626` instead of `#ef4444` so white text passes (4.80). Danger text tone stays `#f87171`.
- Won tone reuses brand red, with `#e66b63` as its text tone, so "won" and "hot" read as the brand moment.
- Commits went in four groups instead of three: tokens, then semantics plus shared utilities plus aliases plus the design page (the aliases live in the same `.aa-app` and `.cc-page` blocks the semantics edits touched), then dead code, then this report.
- The UTC-midnight date bug in `parseDate` was preserved on purpose and documented in `src/shared/dates.js`; changing it would shift meeting dates for existing records.

## 11. Deferred

- The date-only UTC bug above (fix belongs with a data pass, not a token pass).
- `parseDate` is imported but unused in `src/lib/booked.js`.
- `industryKey` casing normalization exists in semantics but no page adopts it yet.
- The `settings` collection is referenced by code and still not created; Prompt 2 made no DB changes.
- Submissions purge is lazy on GET while call-leads is not; asymmetry noted, not changed.
- Screens still read the alias variables, not `--v-` directly. That migration is Prompts 4 to 12.

## 12. What Prompt 3 must know

- Read tokens through `var(--v-…)` only; the alias names are transitional.
- The design page at `/design` (or `/admin/design` on the marketing host) is the reference for every value and its measured contrast. It reads the live stylesheet, so a token change shows there immediately.
- `src/shared/semantics.js` owns every label, tone, and id. Add a status there first, then mirror the id in `api/_semantics.js`.
- The layout audit (`scripts/layout-audit.mjs`) passed with zero offenders at 320, 390, 430, 768, and 1280 on the final build. Mobile Dashboard and Call Console screenshots at 390px are pixel-identical before and after, apart from the randomized greeting.
- Hex baseline for the next prompt is 621.
