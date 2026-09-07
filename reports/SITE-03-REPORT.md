# SITE PROMPT 3: THE CLIENTS PAGE (WORK, RENAMED) DRIVEN BY THE CRM

Every part built and verified. Committed to `origin/main`.

## 1. Prompt 2 Part 6 results (the close-out, done as this prompt's Part 0)

| Script | Result |
|---|---|
| `npm run build` | Clean |
| `hex-count.js` | 134, unchanged |
| `css-orphans.mjs` | 0 across 912 classes in 144 files |
| `showcase-endpoint-test.mjs` | 35/35 |
| `regression.mjs` | 64/64, both widths, sign out/in included |
| `layout-audit.mjs` (`AUDIT_ONLY=clients`, 390+1280) | 0 failing, was 39 (one shared cause: `.sc-url` under 44px, fixed) |
| `layout-audit.mjs` (`AUDIT_ONLY=landing`, 390+1280) | 0 failing |
| `a11y-audit.mjs` (`AUDIT_ONLY=clients`, both themes, 390+1280) | 0 violations of any severity, 12 rows |
| `a11y-audit.mjs` (`AUDIT_ONLY=landing`, both themes, 390+1280) | 0 violations of any severity, 4 rows |
| `feel-audit.mjs` (`AUDIT_ONLY=clients`, both themes/motion) | 4 remaining gaps, all pre-existing `Clients: list` (31px, unrelated, not touched); Showcase tab `n/a (scrolled state)` via new `noFit` flag |
| `feel-audit.mjs` (`AUDIT_ONLY=landing`, both themes/motion) | 8 gaps, residual Stats-row fit mismatch (38-54px), queued as `task_330c9d42` |

Full detail in `reports/SITE-02-REPORT.md`.

## 2. What was built

- **Part 1 (routes and nav)**: `/clients` and `/clients/:slug` replace
  `/work` and `/work/:slug`. `vercel.json` 301s both old paths server side;
  `src/App.jsx` also carries a client-side `<Navigate replace>` fallback
  for the SPA case a server redirect never sees. Navbar, Footer, Hero, and
  CaseStudy's own internal links now say and point to Clients. The admin
  Publish card's public URL and Preview button now open
  `https://visualizestudio.org/clients/:slug` instead of `/work/:slug` or
  the raw endpoint JSON.
- **Part 2 (data)**: `src/marketing/showcase.jsx`: `fetchShowcase()` and
  `fetchClient(slug)` against `/api/showcase`, each with a 60 second
  in-memory cache; a skeleton shaped like the card grid; an error state
  with Retry; an empty state ("New work is being added. Check back
  soon."). Also exports `ClientCard`, `TestimonialCard`, `LogoItem`, and
  their style strings, all reusable outside this prompt.
- **Part 3 (the detail page)**: `CaseStudy.jsx` rewritten to read the
  endpoint's flat shape (`client.brand`/`website`/`cards`/`print`) instead
  of the old `client.sections.*` wrapper, with the exact same four-section
  layout, conditional on `enabled && has content` exactly as before. Added
  a socials row (generic external-link icon per platform, since Untitled
  UI ships no brand marks), a Parallax cover image, client-side SEO
  (`document.title`, description, og:image) via a small effect, and
  previous/next links in list order.
- **Part 4 (reviews on Clients)**: "What clients say" below the grid,
  every published testimonial across all clients from the list response,
  two-column on desktop and stacked on mobile, linking each testimonial's
  business name to that client. Hidden when there are none.
- **Part 5 (touch targets and the old reveal system)**: 44px fixes across
  Navbar, ThemeToggle, Footer, and the shared `.btn` base (which also
  fixed the Retry button on both error states). `.prints-card-glow`'s
  layout-audit false positive (a decorative glow already clipped by its
  parent's `overflow: hidden`) fixed with a `CLIP_OK` allowlist rather
  than touching Home.jsx. The `.reveal`/`.stagger` observer wiring in
  `App.jsx` was left in place: Services.jsx, Process.jsx, and
  Testimonials.jsx still read it and are untouched by this prompt, so
  Hero.jsx is not its last user.
- **Part 6 (motion)**: confirmed already satisfied by Parts 2-4: cards
  Reveal inside a Stagger, the cover uses Parallax, each of the four
  sections is its own Reveal, and the testimonial block Reveals (with an
  inner Stagger when there's more than one).
- **Part 7 (audit)**: extended `layout-audit.mjs`'s marketing walk from
  `/work` to `/clients` with both fixtures, the empty state, the error
  state, and a redirect check; extended `a11y-audit.mjs` to cover the same
  five states (new, since it never audited marketing pages before this
  prompt); ran the full layout/feel/a11y suite and Lighthouse.

## 3. Files created, changed, deleted

**Created**: `src/marketing/showcase.jsx`, `src/pages/Clients.jsx` (via
`git mv` from `Work.jsx`, then rewritten), `reports/SITE-02-REPORT.md`,
`reports/SITE-03-REPORT.md`.

**Deleted**: `src/pages/Work.jsx`, `src/data/clients/index.js`,
`src/data/clients/example-client.js`, `src/data/clients/README.md`.

**Changed**: `src/App.jsx` (routes, redirects), `vercel.json` (301s),
`src/pages/CaseStudy.jsx` (full rewrite to the live endpoint shape),
`src/components/ClientWorkspace.jsx` (Publish card URLs),
`src/components/Navbar.jsx`, `src/components/Footer.jsx`,
`src/components/Hero.jsx` (link text/paths),
`src/components/ShowcasePreview.jsx` (forced off `src/data/clients`, now
reads `fetchShowcase()`), `src/index.css` (`.theme-toggle`, `.btn` min-height),
`scripts/audit-fixtures.mjs`, `scripts/audit-screens.mjs`,
`scripts/layout-audit.mjs`, `scripts/feel-audit.mjs`,
`scripts/a11y-audit.mjs`, `scripts/mock-server.mjs`,
`scripts/lighthouse.mjs`, `src/ui/lead.styles.js` (`.sc-url` 44px, Part
0), `src/pages/AdminLanding.jsx` (Part 0 skeleton-fit fixes).

## 4. Grep proof: no hardcoded client data remains

```
$ grep -rln "data/clients" src --include=*.jsx --include=*.js
(no output, exit 1)
```

Only `reports/SITE-01-REPORT.md` and `docs/SHOWCASE-INVENTORY.md` still
mention it, correctly, as historical record.

## 5. Redirect table

| From | To | Mechanism |
|---|---|---|
| `/work` | `/clients` | `vercel.json` 301 (server) + `<Navigate replace>` (client fallback) |
| `/work/:slug` | `/clients/:slug` | `vercel.json` 301 (server) + `<Navigate replace>` (client fallback) |
| `/showcase` | `/clients` | `<Navigate replace>` only (pre-existing alias, no server redirect needed) |

Both `/work` paths were verified end to end against the built app
(`layout-audit.mjs`'s marketing walk now asserts the client-side landing
URL after each redirect).

## 6. SEO approach and prerender status

`useClientHead()` in `CaseStudy.jsx` sets `document.title`,
`meta[name="description"]`, `og:image`, and `og:title` on mount, restoring
the previous title and removing any tag it created on cleanup. **No
prerender step exists in this build**: these tags land after the SPA's
JS runs, not in the HTML a crawler or a link-preview fetch first sees.
Adding `react-snap` or a Vite prerender plugin was evaluated but not
attempted here: this build already splits by host (marketing vs. admin)
at the Vercel rewrite layer, and a prerender step needs to know which
routes are public before it can render them to static HTML without
touching the admin bundle. That's a build-pipeline decision, not a
one-file change, so it's left as a named gap for Site Prompt 5 rather than
bolted on here.

## 7. Touch target results per page

| Page | Result |
|---|---|
| Clients (list) | Clean at 1280; only the pre-existing, out-of-scope mobile `navbar-burger` (36x36) fails below 1280, unchanged by this prompt |
| Clients (detail, both fixtures) | Same as above |
| Clients (empty state) | Same as above |
| Clients (error state) | Same as above; the Retry button itself is now fixed (was 43px via the shared `.btn` base, now 44px everywhere `.btn` renders) |
| CaseStudy | Back link, socials, and neighbor links fixed inline during Part 3; the shared `.btn` fix also covers its live-site secondary button |
| Navbar (all pages) | Logo, CTA, and mobile drawer close now 44px; the hamburger button itself (36x36) is pre-existing debt not named in Part 5's list, left as is |
| Footer (all pages) | Logo, contact line, column links, CTA, and social icons now 44px |
| ThemeToggle (all pages) | 44x44, was 34x34 |

## 8. Hex count

`node scripts/hex-count.js`: **130** (ceiling 145, was 134 before this
prompt, went down, not up).

## 9. Audit and Lighthouse results

| Script | Result |
|---|---|
| `npm run build` | Clean |
| `hex-count.js` | 130 |
| `css-orphans.mjs` | 0 across 922 classes in 144 files |
| `regression.mjs` (admin, unrelated to this prompt) | 64/64 |
| `dates-test.mjs` | all cases pass |
| `layout-audit.mjs` (`AUDIT_ONLY=marketing`, 5 widths) | 0 failing at 1280 for every Clients state; only the pre-existing mobile hamburger fails below 1280 (not in Part 5's named scope) |
| `a11y-audit.mjs` (`AUDIT_ONLY=mkt-clients`, both themes, 390+1280) | 0 critical, 0 new serious beyond 3 pre-existing sitewide light-theme colors (`.navbar-drawer-contact`, `.wk-eyebrow`, `.footer-copy`) and 1 pre-existing Footer landmark issue, all newly *discovered* by this prompt's audit extension but predating it, see Decisions/Deferred |
| `a11y-audit.mjs` (full, both themes, unscoped) | 168 rows; every admin screen clean; all violations trace to the same 3 pre-existing marketing colors + 1 landmark issue above |
| `feel-audit.mjs` (full, both themes/motion) | 296 rows, 170 gaps, all pre-existing admin debt already disclosed in `SITE-02-REPORT.md` (Landing's `task_330c9d42`, Clients-list 31px, similar scrolled-state drawer/sheet gaps); zero from this prompt's own changes, and feel-audit skips the new marketing entries entirely (its skeleton/fit machinery assumes the admin shell, documented in `audit-screens.mjs`) |
| Lighthouse, `/clients` | dark: perf 97 / a11y 100 / best-practices 96 / PWA 100; light: perf 97 / a11y 95 / best-practices 96 / PWA 100 (the a11y gap is the same pre-existing light-theme contrast issue) |
| Lighthouse, `/clients/:slug` | dark: perf 95 / a11y 100 / best-practices 96 / PWA 100; light: perf 95 / a11y 95 / best-practices 96 / PWA 100; flags `unsized-images` (50, no measured CLS impact) and ~39 KiB unused JS, both deferred |

## 10. Decisions

- Kept `CaseStudy.jsx`'s dead-but-harmless `<Navigate>` fallback for a
  falsy client on the 'ready' branch: `fetchClient` always throws on a
  404 rather than resolving falsy, so that branch is unreachable, but a
  real 404 correctly lands on the error state (Retry, same URL) rather
  than silently redirecting, which is the better UX anyway.
- `a11y-audit.mjs` now covers marketing pages for the first time (5 new
  `mkt-clients-*` entries in `audit-screens.mjs`), marked `marketing:
  true` so `feel-audit.mjs` explicitly skips them: its skeleton/fit/CLS
  machinery is built around the admin shell's `.sh-content` region and
  `.v-skel` convention, not this site's own `.wk-skel`/`.cs-skel`, and
  retrofitting that is a larger, separate effort. `layout-audit.mjs`'s own
  long-standing marketing walk already covers overflow and touch targets
  for these pages.
- Fixed the shared `.btn` base's height (43px, 1px short) rather than a
  page-local override, since the Retry button is not the only place it's
  used and the shortfall was identical everywhere.
- Bumped the client card's name from `<h3>` to `<h2>` (found by the new
  a11y coverage: an orphaned `<h3>` with no `<h2>` before it), purely
  semantic, the styling is class-based, so this had zero visual effect.
- Did not touch `--brand` or the marketing muted-text color to fix the
  newly-discovered light-theme contrast failures: `Client Showcase`'s
  color is the same shared eyebrow convention likely used elsewhere on
  the site (Services, etc.), so a piecemeal fix here would leave the rest
  failing; queued as one follow-up task instead (`task_5b81c584`).
- Left the `navbar-burger` mobile menu button (36x36) alone: Part 5's own
  instructions name specific elements (logo, theme toggle, CTA, drawer
  close, footer links, back link) and the burger isn't one of them.

## 11. Deferred

- `task_5b81c584`: fix sitewide light-theme contrast (`.navbar-drawer-
  contact`, `.wk-eyebrow` and its shared `--brand`/muted-color usage
  elsewhere, `.footer-copy`) and the Footer's duplicate unlabeled `<nav>`
  landmarks. Newly discovered by this prompt's a11y coverage extension,
  predates this prompt, out of its scope.
- Prerender/SEO for crawlers and link previews (see section 6): Site
  Prompt 5's to close.
- `unsized-images` (50) and ~39 KiB unused JS on the Lighthouse detail
  page run, no measured CLS impact today, but worth a pass when Site
  Prompt 5 touches build/perf.
- Carried over from Site Prompt 2: `task_330c9d42` (Landing screen's
  remaining 38-54px feel-audit gap) and the pre-existing `Clients: list`
  31px fit gap, both untouched by this prompt.
- The `navbar-burger` 36x36 touch target: real, pre-existing, not named
  in Part 5's scope.

## 12. What Site Prompt 4 must know

Reusable exports, all already built and used by this prompt:

- **`src/marketing/showcase.jsx`**: `fetchShowcase({force})` and
  `fetchClient(slug, {force})` (60s in-memory cache, `clearShowcaseCache()`
  to bust it), `ClientCard({client})`, `TestimonialCard({testimonial})`,
  `LogoItem({client})` (built for Home, not yet used anywhere), plus their
  style strings `testimonialCardStyles` and `logoItemStyles` to concatenate
  into a page's own `<style>` block.
- **`src/pages/Clients.jsx`** exports `workStyles` (the list card's CSS,
  already imported by `ShowcasePreview.jsx` on Home) and re-exports
  `ClientCard` for that same compatibility path.
- **`src/marketing/motion`**: `Reveal`, `Stagger`, `Parallax`, already the
  house convention for every new marketing region.
- The showcase list response's `landing` object already carries
  `logoStrip`, `work`, `testimonials` (capped at 6), and `stats`
  (`clientsServed`, `projectsDelivered`, `averageRating`, `years`),
  exactly what Home's logo strip, featured work, testimonials, and stats
  sections need, with zero new endpoint work required.
- `ShowcasePreview.jsx` on Home already fetches and renders 3 cards via
  this same path; Site Prompt 4 can extend it or replace it, but the data
  layer underneath needs no changes.
