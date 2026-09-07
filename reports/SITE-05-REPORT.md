# SITE PROMPT 5: SERVICES PAGE ALIGNMENT, SEO, QA, AND SHIP

Every part built and verified. Committed and pushed to `origin/main`.

## 1. What changed per page

- **Services** (`src/pages/Services.jsx`): full rewrite on Home's numbered
  section pattern. Four `SectionNumber` lines, Brand, Website, Print and
  Product, Retainers, each two sentences plus its packages as cards read
  live from `src/shared/pricing.js`, Launch Plan and Build Plan showing
  their monthly split via the existing `planLine()` helper, Print and
  Product's cards doubling as the add-ons table. One rules block, one Book
  a Meeting CTA. Removed the split hero mockup, the "What I Build" pillar
  grid, the old collapsible catalog (a separate, stale pricing model), the
  website add-ons section, and the process timeline.
- **Contact**: Reveal on the hero and the Calendly embed; fixed the 320px
  overflow (the embed's hard `minWidth:'320px'` past the viewport at that
  width); the portal notice unchanged; per-page head.
- **Start**: Reveal wraps each step's field group; the intro, progress,
  success screens, the step transition, and all validation/submit logic
  unchanged; per-page head.
- **Prints**: restyled to match (its `--ps-*` brand colors now read the
  site's real, theme-invariant tokens; its neutrals stay their own fixed
  dark values, since this shop has always rendered dark regardless of the
  site's own toggle and pointing them at the theme-aware tokens turned out
  to make it start switching with it); the site's own Footer added (it had
  none); three real accessibility findings fixed (button/badge contrast,
  the hero and checkout note sitting outside any landmark, a card name
  with no heading level before it); checkout confirmed unchanged.
- **Home, Clients, Prints**: gained per-page `useHead()` calls (Services,
  Contact, Start already had them from Parts 1-2). CaseStudy.jsx's own
  separate head-management hook was retired in favor of the same shared
  helper.
- **The maintenance screen** (src/main.jsx / its styles in index.css):
  confirmed no grid; its font stack now reads `var(--font-body)` instead
  of repeating the same values by hand.
- **Every marketing page**: gained title, description, and og:image
  (public/og-default.png, 1200x630, everywhere except a published client's
  own page, which uses its own cover); published clients are now
  prerendered at build time (see section 3); a sitemap and robots.txt now
  exist.
- **Navbar**: the mobile drawer no longer sits in the Tab order while
  closed (found by this prompt's own keyboard walk, see section 5).

## 2. Files created, changed, deleted

**Created**: `src/marketing/useHead.js`, `scripts/prerender-clients.mjs`,
`scripts/build-sitemap.mjs`, `scripts/site-regression.mjs`,
`public/og-default.png`, `public/robots.txt`, `docs/SITE-QA-CHECKLIST.md`,
`docs/RELEASE-NOTES-3.1.md`, `reports/SITE-05-REPORT.md`.

**Deleted**: nothing (LogoItem was retired from within
`src/marketing/showcase.jsx`, the file itself stays).

**Changed**: `src/pages/Services.jsx` (full rewrite), `src/pages/
Contact.jsx`, `src/pages/Start.jsx`, `src/pages/Prints.jsx`, `src/pages/
Home.jsx`, `src/pages/Clients.jsx`, `src/pages/CaseStudy.jsx`,
`src/components/Navbar.jsx`, `src/marketing/showcase.jsx`, `src/index.css`,
`index.html`, `vercel.json`, `package.json`, `scripts/lighthouse.mjs`,
`scripts/audit-screens.mjs`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`,
`CLAUDE.md`.

## 3. Prerender outcome: (a)

`scripts/prerender-clients.mjs` runs after `vite build` (chained into
`npm run build`), fetches the production `/api/showcase`, and writes one
`dist/clients/<slug>/index.html` per published client: `dist/index.html`'s
own template with that client's title, description, and og:image swapped
in, every script and stylesheet tag untouched, so the exact same app
bundle boots from it and `CaseStudy.jsx`'s `useHead()` call immediately
re-fetches and re-applies the live values client side. `scripts/
build-sitemap.mjs` runs the same fetch, same fail-soft rule, for
`dist/sitemap.xml`.

Verified two ways: this sandbox cannot reach `visualizestudio.org` at all
(the real `npm run build` run here always hits the fail-soft path,
confirming that path is safe), so the actual client-page and sitemap
generation was verified with `PRERENDER_SHOWCASE_URL` pointed at the mock
server instead, producing two real prerendered pages, each byte-identical
to `dist/index.html` except the swapped `<title>` and four `<meta>` tags
(diffed directly to confirm).

No new `vercel.json` rewrite routes `/clients/:slug` to its prerendered
file: Vercel's documented routing order checks the output directory for a
real file before it ever consults the rewrites array, so the file already
wins once it exists, the same way any static host resolves a directory
path to its `index.html`. Vercel rewrites have no declarative "if the file
exists" condition, so an explicit rewrite for `/clients/:slug` would have
risked 404ing a slug with no prerendered file instead of letting it fall
through to the existing catch-all -> the SPA fetching it live, which is
what should happen for one not yet built with a prerendered snapshot.
`vercel.json` diff (one addition, a cache header, not a rewrite):

```diff
+    {
+      "source": "/clients/(.*)",
+      "headers": [
+        {
+          "key": "Cache-Control",
+          "value": "public, max-age=0, must-revalidate"
+        }
+      ]
+    },
```

Full reasoning in `docs/RUNBOOK.md`, "Prerender."

## 4. Lighthouse

Mobile preset, dark theme (mocked fixtures, this sandbox's network policy
blocks the fixtures' external `picsum.photos` cover images, see the Best
Practices note below).

| Page | Performance | Accessibility | Best Practices | PWA |
|---|---|---|---|---|
| Home | 95 | 100 | 96 | 100 |
| Services | 98 | 100 | 100 | 100 |
| Clients (list) | 96 | 100 | 96 | 100 |
| Clients detail | 95 | 100 | 96 | 100 |
| Contact | 99 | 100 | 96 | 100 |
| Prints | 98 | 100 | 100 | 100 |

Accessibility 100 on every page. Best Practices sits at 96 (not 100) only
on the three pages whose fixtures reference an external cover image this
sandbox's network policy blocks (`ERR_TUNNEL_CONNECTION_FAILED`), which
Lighthouse's `errors-in-console` audit counts against the score; Services
and Prints, which reference no external image, score 100. This exact
pattern was already disclosed in `reports/SITE-04-REPORT.md`: production
serves real Cloudinary URLs, so this is the sandbox's outbound network
restriction, not a code issue.

## 5. Audit results

| Script | Result |
|---|---|
| `npm run build` | Clean |
| `hex-count.js` | 119 |
| `css-orphans.mjs` | 0 across 946 classes in 150 files |
| `regression.mjs` (admin, unrelated to this prompt) | 64/64 |
| `dates-test.mjs` | all cases pass |
| `layout-audit.mjs` (`AUDIT_ONLY=marketing`, 390+1280) | Clean, zero offenders, every marketing page and state |
| `layout-audit.mjs` (`AUDIT_ONLY=settings`, shop checkout, 390+1280) | Clean; Prints' restyle and new Footer did not break checkout |
| `a11y-audit.mjs` (`AUDIT_ONLY=mkt`, both themes, 390+1280) | 44/44 rows clean, 0 violations of any severity |
| Keyboard walk (scripted through Playwright, see `docs/SITE-QA-CHECKLIST.md`) | Navbar, drawer, logo strip, testimonial carousel, Contact, Start, and Prints checkout all operable by keyboard; one real bug found and fixed (the drawer's own links stayed in the Tab order while closed, off-screen but not `display:none`); one gap found and left alone (Prints' customize modal does not trap focus, out of this prompt's "restyle only" scope for that page) |
| Lighthouse | see section 4 |

## 6. Site regression result

`node scripts/site-regression.mjs`: **6/6 steps pass.**

1. Not published: absent from /clients. ok
2. Publish: appears on /clients. ok
3. Toggle logo strip + work flags: logo and card appear on Home. ok
4. Publish a testimonial: shows on Home and /clients. ok
5. Unpublish: disappears from /clients. ok
6. A price in `pricing.js` reads live on Services and Home. ok

## 7. Hex and function counts

- `node scripts/hex-count.js`: **119** (ceiling 125 stated in this
  prompt's RULES, was 125 at the start, went down).
- Vercel functions: **9** (unchanged; `api/showcase.js`, added in Site
  Prompt 2, was already the 9th, `docs/ARCHITECTURE.md` had simply never
  been updated to say so until this prompt).

## 8. Deferred, with reasons

- Prints' customize modal does not trap focus (Tab can move from it to
  page content behind the overlay). Found by this prompt's keyboard walk;
  not fixed, since Part 2's explicit instruction for Prints was "restyle
  only," and a proper focus trap means touching the modal's own
  interaction logic, not its colors.
- No new `vercel.json` rewrite for `/clients/:slug`, by design, see
  section 3, not a gap.
- The tag `v3.1.0` was created locally but **could not be pushed**:
  `git push origin v3.1.0` returned `HTTP 403` / "the remote end hung up
  unexpectedly," the same credential rejection this prompt anticipated
  ("if the tag push is rejected by credentials as before, say so; do not
  retry"). Not retried. The commit itself (`924747d`) is pushed to `main`;
  only the tag ref is missing from the remote.
- Nothing else surfaced by this prompt's own audit runs went unfixed;
  every finding on a page this prompt touched (three on Prints, one on
  Navbar) is listed as fixed in section 5, not deferred.

## 9. The release and first-use setup

`package.json` bumped to **3.1.0**, committed (`924747d`), pushed to
`main`. Tag `v3.1.0` created locally, not pushed (see section 8).
`docs/RELEASE-NOTES-3.1.md` has the full page-by-page changelog; the
first-use setup list, in order:

1. Publish the first clients from their Showcase tabs.
2. Add logos (light and dark where available).
3. On the Landing screen (Studio, /landing), choose which clients feature
   in the logo strip and Recent clients on Home, set their order, and
   choose which testimonials feature.
4. Optionally set VITE_CLOUDINARY_CLOUD_NAME and
   VITE_CLOUDINARY_UPLOAD_PRESET for an Upload button on every showcase
   image field.

Then the walk in `docs/SITE-QA-CHECKLIST.md` once, on a real client.
