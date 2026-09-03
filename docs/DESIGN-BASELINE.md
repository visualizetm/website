# DESIGN BASELINE — honest assessment before CRM 3.0

## What is working (keep it)

- **The identity is real:** #080808 ground, #121212/#1a1a1a surfaces, one red
  (#d44c43) reserved for primary actions and wins, Barlow Condensed display
  headings over Inter, faint red grid texture, Untitled UI icons, zero emoji.
  The CRM already *feels* like one product on its newest screens.
- **The layout system holds:** PageShell/ScrollArea/StickyFooterBar + tokens
  mean no horizontal scroll and no covered content anywhere in the CRM at
  320–1440 (regression-checked by scripts/layout-audit.mjs, 73+ checks green).
- **The call loop is genuinely fast:** builder → fullscreen card → pinned
  outcomes → auto-advance, keyboard (1–4, arrows, "/", N), swipe, session
  persistence across taking the actual phone call. This is the product's core
  and it is good.
- **Optimistic writes with loud failure** on every mutation path in the CRM.
- Designed empty states exist nearly everywhere (copy needs the em-dash pass).

## What is inconsistent

- Two dark palettes (CRM vs PrintsAdmin), three-plus grey ramps, 629 hardcoded
  hex occurrences / 102 unique colors, status color maps duplicated in 5 files.
- Light theme exists for marketing but the admin ignores it; `vz_theme` has no
  effect inside the CRM.
- Typography rhythm drifts by page: section labels are 0.60–0.78rem uppercase
  with five different letter-spacings; body copy 0.78–0.95rem ad hoc.
- Icon sizing ad hoc per callsite (13–28px, at least 9 distinct sizes).
- Radii: 6–20px with at least 9 distinct values (7, 8, 9, 10, 11, 12, 13, 14,
  15, 18…) rather than a scale.
- Two modal systems (aa-modal vs cc-sheet/bk-sheet) plus a third confirm
  pattern (window.confirm in the console editor).

## Top 10 UX friction points (ranked by daily-use frequency)

1. **Muted text is too small too often.** Labels at 0.6–0.68rem (9.6–11px)
   with #8a8a8a on #121212 (≈4.6:1) are readable but tiring at phone arm's
   length; placeholders at #6a6a6a (≈2.9:1) fail AA outright. Daily, every
   screen.
2. **34px icon buttons** (edit, delete, refresh, lookup, close) across every
   header row, 20px search-clear, 24px checklist checkboxes, ~26px ledger
   delete targets. Below the 44px floor on the highest-frequency taps.
3. **Date-only dates render a day early** (US timezones) on Clients and
   Booked cards and in ledgers; trust-eroding for meeting prep. (Bug i.3.)
4. **No in-app feedback when reads fail:** a dead network shows yesterday's
   queue with no banner; only writes announce failure.
5. **Industry facet split by casing** (enricher lowercase vs Title Case)
   doubles chips in the session builder and Leads filters — wrong counts on
   the thing Rob filters by most.
6. **Cross-page duplication of the same lead** (console session card, Leads
   detail, Booked detail) with slightly different affordances — e.g. notes
   save UX differs, checklists exist on Leads/Booked/Clients but not in the
   call room where commitments happen.
7. **Loading is a text string** ("Loading…") on Leads/Clients/Booked and
   nothing on Dashboard stats — numbers pop from 0 after fetch. Skeletons
   exist only on Submissions/Settings.
8. **No callbacks surface.** Callbacks are a count + a builder chip; there is
   no list showing *who* to call back *when* — the most action-oriented data
   in the pipeline is invisible. (Calendar/Callbacks in 3.0.)
9. **More-sheet and bottom-sheet dialogs lack Escape/back-button dismissal
   and focus management** on mobile; muscle-memory taps land behind sheets.
10. **Legacy split-brain:** shop orders appear in two places with different
    statuses (Mongo Orders vs localStorage Shop tab), invoices/portal exist
    only per-device — anything Rob does there silently fails to roam.

## Measurements (from the CSS, for the token work in Prompt 2)

- Tap targets: icon buttons 34×34; chips/pills 40–44 min-height (good);
  section headers 52–58 (good); outcome bar 60+ (good); search-clear ~20;
  checklist toggle 24; row delete ~26.
- Type: display clamps 1.9–3.8rem (good); body 0.78–0.95rem; labels
  0.58–0.78rem uppercase (too many stops, floor too low).
- Contrast on #121212: #fafafa 17.9:1, #cccccc 11.5:1, #8a8a8a ≈4.6:1
  (AA-normal pass, AA-small-bold-only at the sizes used), #6a6a6a ≈2.9:1
  (fail), PrintsAdmin #636373 on #0f0f11 ≈3.9:1 (fail for normal text).
- Spacing: admin surfaces use raw px (6/7/8/9/10/11/12/14/15/16/18/20) while
  index.css defines an unused-by-admin 8px `--space-*` scale.
