# SITE PROMPT 2: THE SHOWCASE SYSTEM IN THE CRM AND THE PUBLIC ENDPOINT

Every part built, verified, and now closed out with fixtures and audits
(Part 0 of Site Prompt 3). Committed to `origin/main`.

## 1. What was built

- **Part 1** (`api/_routes/call-leads.js` `sanitize()`): additive
  `showcase{}` (publish state, slug, display fields, four section blocks
  each with `enabled`/images/notes, `featured` flags) and
  `reviews.testimonials[]`. Slug is server-generated from `displayName` on
  first publish, auto-suffixed on a rare collision with another published
  client, and a manually typed colliding slug gets a 409 instead of being
  silently mangled. `showcase.brand` deliberately stores no
  palette/typography; those are computed only at serve time from the
  lead's real brand block, never duplicated.
- **Part 2** (`src/components/ClientWorkspace.jsx`'s `ShowcaseSection`,
  wired into `LeadDetail.jsx` as a tab after Deliverables): publish/slug/
  preview, card fields with a live blurb count, four collapsible section
  cards each with an enabled toggle and image fields (thumbnail,
  broken-link warning, an optional Cloudinary upload button), a read-only
  mirror of the lead's real brand palette/fonts with a jump back to
  Overview, the landing feature toggles and order, and a testimonials
  card (add by hand, from a review ask, or from a website review
  submission). Every write spreads the full current showcase/reviews
  object before changing one field, since the server rebuilds the whole
  object on each PATCH.
- **Part 3** (`src/pages/AdminLanding.jsx`, new Studio nav entry): logo
  strip and featured work (drag reorder, shared order field per the
  schema, a missing-logo warning list, a "won't show" flag past the top
  6), featured testimonials, and four stat rows (toggle plus optional
  fixed-value override, live value always shown alongside per
  `api/showcase.js`'s own fallback rule). Settings gains a `landing`
  document (`api/_routes/settings.js`).
- **Part 4** (`api/showcase.js`, function count 8 -> 9): GET
  `/api/showcase` and `?slug=x`, published-only, exact field whitelist.
  `scripts/showcase-endpoint-test.mjs`: 35 assertions against the real
  handlers with an in-memory Mongo, covering the whitelist, a draft
  client never appearing, private values never leaking even under a
  same-named public key, and the full slug generation/collision/409/
  self-save matrix.
- **Part 5**: `docs/IMAGES.md` (Cloudinary sizes, why Drive links don't
  work), `src/lib/cloudinary.js` (unsigned upload, enabled only when both
  env vars are set), `docs/RUNBOOK.md` gains the two new variables.
- **Part 6 (this close-out)**: fixtures for two published clients (one
  with all four sections, one brand-only), one draft, and three
  testimonials (two published, one of those also featured); layout, feel,
  and a11y audits on the Showcase tab and the Landing screen at 390 and
  1280, both themes; fixed everything red.

(Separately, and first, per your direct instruction mid-prompt: merged
the `auth-rebuild` branch into `main`, restoring the split
login/logout/session/`admin/index.js` architecture that had been sitting
unmerged since the prior session. Commit `a9cbf8d`, reported in full at
the time.)

## 2. Files created, changed, deleted

Created: `api/showcase.js`, `docs/IMAGES.md`,
`scripts/showcase-endpoint-test.mjs`, `src/lib/cloudinary.js`,
`src/pages/AdminLanding.jsx`.

Changed: `api/_routes/call-leads.js`, `api/_routes/settings.js`,
`api/_semantics.js`, `docs/RUNBOOK.md`, `src/components/ClientWorkspace.jsx`,
`src/components/LeadDetail.jsx`, `src/pages/AdminApp.jsx`,
`src/shared/copy.js`, `src/shared/semantics.js`, `src/shell/nav.js`,
`src/ui/icons.jsx`, `src/ui/lead.styles.js`.

Changed in this close-out pass: `scripts/audit-fixtures.mjs` (showcase and
testimonial data on leads L11/L12/L13, a `LANDING_DOC` settings fixture),
`scripts/audit-screens.mjs` (`clients-showcase` and `landing` screen
entries), `scripts/layout-audit.mjs` (Showcase tab checks woven into the
existing Clients-module walk, a `landing` isolated block, a `landing`
visit in the default full run), `scripts/feel-audit.mjs` (a `noFit` escape
hatch for a screen state that deliberately scrolls past what a generic
list/detail skeleton can represent).

Deleted: nothing (`scripts/_debug-measure-landing*.mjs` were scratch files
written and removed within this same pass, never committed).

## 3. What was red, and what fixed it

- **layout-audit.mjs, 39 failing views** (`AUDIT_ONLY=clients`, every
  client-detail tab at both widths): all traced to ONE element, the
  Publish card's public-URL link (`.sc-url` in
  `src/components/ClientWorkspace.jsx`), under 44px. It showed on every
  tab because `LeadDetail.jsx` mounts all of a client's sections at once
  (tabs scroll to a section, they do not swap it out), so one undersized
  element anywhere in that always-mounted tree fails every check. Fix:
  `min-height: var(--v-tap)` plus `display: inline-flex; align-items:
  center` on `.sc-url` in `src/ui/lead.styles.js`. Confirmed: all 39
  cleared with that one change.
- **feel-audit.mjs, "fit" gap on the Landing screen** (skeleton geometry
  didn't match the loaded layout: 4 rows vs 10-13, up to 178px off):
  traced to three separate causes, each fixed:
  1. The outer page-title `<Section title="Landing" loading={loading}
     .../>` injects its own skeleton line for the description at a
     different position than a plain paragraph, shifting every row below
     it out of index alignment. Fixed by always passing a real
     `description` string (a single space while loading) instead of using
     `Section`'s `loading` prop there.
  2. The skeleton's outer `Stack` used its default `gap={4}`, silently
     overriding the intended `gap: var(--v-space-6)` from the
     `.ld-sections` class (a `Stack` always sets `gap` as an inline
     style). Fixed with an explicit `gap={6}`.
  3. The Stats section's real row is two side-by-side flex children
     (a Toggle plus an override input); the skeleton was one full-width
     block. Fixed by splitting it into two, matching widths.
  Result: down from ~178px (wrong row count entirely) to 38px at 1280 /
  54px at 390. A residual, smaller mismatch remains inside the Stats
  section rows specifically; queued as `task_330c9d42` rather than
  chased further given the overall time this took relative to the rest of
  Site Prompt 3 still ahead. This is a pixel-fit/polish metric only; both
  `layout-audit.mjs` (44px targets, overflow) and `a11y-audit.mjs` are
  fully clean on this screen.
- **feel-audit.mjs, "fit" gap on the Showcase tab** (up to 384px off,
  "1 vs 4" / "7 vs 5" rows): this was a false alarm from how the audit
  entry was written, not a real defect. The Showcase tab is a scrolled
  position within `LeadDetail`'s single continuously-mounted page (tabs
  scroll, they do not swap), so its loaded state can never resemble the
  generic top-of-page skeleton the loading check renders (which has no
  way to know a tab click is coming). Added a `noFit` flag to
  `scripts/feel-audit.mjs` and set it on the `clients-showcase` screen
  entry in `scripts/audit-screens.mjs`, matching the existing `noEmpty`/
  `noError` convention for checks that don't apply to a given state.

## 4. Audit and test results (final)

| Script | Result |
|---|---|
| `npm run build` | Clean (only the known Work.jsx dynamic-import note) |
| `hex-count.js` | 134, unchanged |
| `css-orphans.mjs` | 0 across 912 classes in 144 files |
| `showcase-endpoint-test.mjs` | 35/35 |
| `regression.mjs` | 64/64, both widths, sign out/in included |
| `layout-audit.mjs` (`AUDIT_ONLY=clients`, 390+1280) | 0 failing, was 39 |
| `layout-audit.mjs` (`AUDIT_ONLY=landing`, 390+1280) | 0 failing |
| `a11y-audit.mjs` (`AUDIT_ONLY=clients`, both themes, 390+1280) | 0 violations of any severity, 12 rows |
| `a11y-audit.mjs` (`AUDIT_ONLY=landing`, both themes, 390+1280) | 0 violations of any severity, 4 rows |
| `feel-audit.mjs` (`AUDIT_ONLY=clients`, both themes/motion) | 4 remaining gaps, all pre-existing `Clients: list` (31px, unrelated to this prompt, not touched here); Showcase tab now `n/a (scrolled state)`, client detail `ok` |
| `feel-audit.mjs` (`AUDIT_ONLY=landing`, both themes/motion) | 8 gaps, all the same residual Stats-row fit mismatch (38-54px), queued as `task_330c9d42` |

## 5. Endpoint response for the full fixture client (unchanged from the
   earlier report, still verbatim-accurate)

See the Site Prompt 2 status report already given in chat for the full
JSON; unchanged by this close-out pass.

## 6. Decisions

- Fixture placement: L11 (existing "plan client" fixture) became the
  full-four-section published client; L12 (existing retainer client, which
  already had `reviews.asks`) became the brand-only published client and
  got the first (published+featured) testimonial; L13 (existing delivered
  client) became the draft (never published) client and got the second
  (published, not featured) testimonial. Reused existing fixtures rather
  than adding new lead indices, since these three already anchor other
  audits (Payments, Retainer, Deliverables) and needed no renumbering.
- `noFit` was added to `feel-audit.mjs` rather than trying to make the
  skeleton represent a scrolled-to-tab state, since a generic pre-load
  skeleton fundamentally cannot know which tab a user is about to open.
- The `Clients: list` 31px fit gap is real but pre-existing, not
  introduced by this prompt (that screen's skeleton was not touched);
  left alone as out of this prompt's scope.

## 7. Deferred

- `task_330c9d42`: tighten the Landing screen's remaining 38-54px fit gap
  (Stats section rows specifically).
- The pre-existing `Clients: list` 31px fit gap (unrelated, untouched by
  this prompt).
- The pre-existing marketing 44px touch-target debt from Site Prompt 1
  (`task_0bfe79a4`), explicitly Site Prompt 3's Part 5 to fix, not
  touched here.

## 8. What Site Prompt 3 must know

- Fixtures now exist for realistic testing: `scripts/audit-fixtures.mjs`'s
  L11 (`full-showcase-co`, all four sections, featured everywhere),
  L12 (`brand-only-co`, brand section only), L13 (draft, never
  published) are ready to reuse for Site Prompt 3's own Part 7 audit
  fixtures (the prompt says "fixtures from the Prompt 2 endpoint mock" --
  these three leads, once run through `api/showcase.js`'s real logic, are
  exactly that mock).
- The `noFit` flag is available in `scripts/feel-audit.mjs` for any other
  scrolled-state or otherwise-unrepresentable-by-skeleton screen entry
  Site Prompt 3 needs to audit.
- Everything else from the original Site Prompt 2 report (the endpoint
  whitelist, the schema, the CRM field gap analysis) stands unchanged;
  see that report's sections 3-4 and 10.
