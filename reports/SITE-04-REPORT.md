# SITE PROMPT 4: THE LANDING PAGE, SIMPLIFIED AND FED BY THE CRM

Every part built and verified. Committed to `origin/main`.

## 1. What was built, section by section

`src/pages/Home.jsx` makes one `fetchShowcase()` call on mount and hands
slices of the result down. Every client-fed section hides itself when its
slice is empty (see section 4); the hero and how-it-works carry no CRM data
and always render.

1. **Hero** (`src/components/Hero.jsx`): the headline and subline in place,
   Book a Meeting (`/book`) and See client work (`/clients`). Below, one
   overlapping image, `landing.work[0].cover`, full width on mobile,
   pulled up over the section boundary on desktop via a negative margin,
   wrapped in `Parallax`. It is the LCP element: `width`/`height` plus an
   `aspect-ratio` wrapper reserve its box immediately, `public/hero-default.svg`
   (a small hand-authored studio graphic, matching the existing brand
   visual language) shows until a real cover is known, and a
   `<link rel="preload" as="image">` is added the moment one is.
2. **Logo strip** (`src/components/Trust.jsx`, formerly the placeholder
   "Client" boxes): "Trusted by local businesses" above a `Marquee` of every
   client with `featured.logoStrip`, ordered by `featured.order`, each
   linking to `/clients/:slug`. Reads the full `clients` array (not
   `landing.logoStrip`, which only carries one pre-resolved logo) so each
   entry keeps its `brand.logo.light`/`.dark` pair for a theme-correct pick
   via the new shared `useTheme()` hook. Grayscale at rest, full color on
   hover. Hidden when no client has that flag set.
3. **Services, numbered** (`src/components/ServicesSections.jsx`): three
   sections, `SectionNumber` 01/02/03, alternating image side on desktop.
   Prices read live from `src/shared/pricing.js` (`brand-starter` $350,
   `web-essentials` $500, `stickers-2` $10), never retyped. 01's image is
   `landing.work[0].cover`; 02 is the first `website.screenshots[0].link`
   found scanning the full `clients` list; 03 is the first
   `print.items[].image` found the same way. No image available means text
   only, no placeholder box.
4. **Recent clients** (`src/components/RecentClients.jsx`): up to three
   `ClientCard` from `landing.work`, "Recent clients" / "All clients" to
   `/clients`. Hidden when empty.
5. **Stats** (`src/components/StatsRow.jsx`): a `Counter` per key actually
   present in `landing.stats` (the endpoint omits a toggled-off key
   entirely, this section never invents a zero). Average rating carries a
   star. Hidden when the object has no keys.
6. **What clients say** (`src/components/HomeTestimonials.jsx`):
   `TestimonialCard` for each of `landing.testimonials`. A three-up grid on
   desktop; under 860px the same cards become a horizontally scroll-snapped
   single-card row with dot indicators (an `IntersectionObserver` per card
   tracks which is centered, no autoplay). Hidden when empty.
7. **How it works** (`src/components/HowItWorks.jsx`): Book a call, Pick a
   package, Launch, one sentence each, then the payment-plan line. The only
   process content on the page; always renders.
8. **Final CTA** (`src/components/CTA.jsx`): the wordmark, "Your vision, our
   creation.", Book a Meeting, the contact email. `Footer.jsx` follows,
   rendered by `App.jsx`, not part of this component.

## 2. Files created, changed, deleted

**Created**: `public/hero-default.svg`, `src/components/HomeTestimonials.jsx`,
`src/components/HowItWorks.jsx`, `src/components/RecentClients.jsx`,
`src/components/ServicesSections.jsx`, `src/components/StatsRow.jsx`,
`src/marketing/useTheme.js`.

**Deleted**: `src/components/Process.jsx`, `src/components/Services.jsx`
(the old four-pillar grid; `src/pages/Services.jsx`, the actual `/services`
page, is untouched and never imported it), `src/components/ShowcasePreview.jsx`,
`src/components/Testimonials.jsx`, `src/hooks/useReveal.js`.

**Changed**: `src/pages/Home.jsx` (full rewrite), `src/components/Hero.jsx`
(full rewrite), `src/components/Trust.jsx` (full rewrite), `src/components/CTA.jsx`
(full rewrite), `src/App.jsx` (the old global reveal observer removed),
`src/components/Navbar.jsx` (hamburger 44px, Part 3), `src/components/Footer.jsx`
(nav landmark labels, Part 3), `src/index.css` (`--text-muted` and the new
`--brand-text` variable, Part 3 and Part 5), `src/marketing/showcase.jsx`
(`capImageWidth()`, `.tc-business` reads `--brand-text`, `ClientCard`'s image
sized), `src/marketing/motion/Marquee.jsx` (the aria-hidden-focus fix, Part 5),
`src/pages/CaseStudy.jsx` (now imports the shared `useTheme()` instead of its
own copy), `src/pages/Clients.jsx` (`.wk-eyebrow` reads `--brand-text`),
`scripts/audit-screens.mjs`, `scripts/layout-audit.mjs`, `scripts/lighthouse.mjs`,
`scripts/mock-server.mjs` (Part 5 audit infrastructure).

Grep proof, every removed component and the old reveal system:

```
$ grep -rn "components/Process\|components/Testimonials\|components/ShowcasePreview\|hooks/useReveal" src --include=*.jsx --include=*.js
(no output, exit 1)

$ grep -rnE "(^|[\s\"'\`{])(reveal|reveal-left|reveal-right|reveal-scale|stagger)([\"'\s}]|$)" src --include=*.jsx
src/pages/AdminDesign.jsx:281: ... stagger {v('stagger')} ...    # the design tokens page's own label text, unrelated
```

`src/components/Services.jsx` (the old grid) has no importers left either;
`src/pages/Services.jsx` (the `/services` page) never imported it.

## 3. The final copy, in one block

> **Hero**
> Branding and websites for local businesses that deserve better than a logo from a template.
> Solo studio in Delaware. Brand, website, print, all in one place.
> [Book a Meeting] [See client work]
>
> **Logo strip**
> Trusted by local businesses
>
> **01 Brand**
> Logo, colors, fonts, the whole identity. Something that actually looks like your business, not a template with your name swapped in.
> You get files that work everywhere, print, web, signage, and a short guide so it stays consistent.
> from $350 · See services
>
> **02 Website**
> A site that loads fast, works on phones, and makes it obvious how to book or buy.
> Built by hand, not from a drag-and-drop kit, so it looks like nobody else's.
> from $500 · See services
>
> **03 Print and Product**
> Stickers, business cards, signage, whatever gets your brand into the real world.
> Same files, same colors, no surprises when it comes back from the print shop.
> from $10 · See services
>
> **Recent clients** / All clients
>
> **Stats**
> [Clients served] [Projects delivered] [★ Average rating] [Years in business]
>
> **What clients say**
>
> **How it works**
> 01 Book a call: A quick call to talk through what you need and whether it is a fit.
> 02 Pick a package: You choose a package that matches the work, I lock the scope and timeline.
> 03 Launch: I design and build it, you review, we ship. You walk away owning everything.
> Bigger projects split into monthly payments. First payment starts the work.
>
> **Final CTA**
> Visualize.
> Your vision, our creation.
> [Book a Meeting]
> contact@visualizeclients.com

## 4. Which sections hide when empty

| Section | Hides when | Stays regardless |
|---|---|---|
| Hero | never (falls back to `public/hero-default.svg`) | always renders |
| Logo strip | no client has `featured.logoStrip` | |
| Services, numbered | never (falls back to text only per section, no image) | always renders |
| Recent clients | `landing.work` is empty | |
| Stats | `landing.stats` has no keys | |
| What clients say | `landing.testimonials` is empty | |
| How it works | never, carries no CRM data | always renders |
| Final CTA / Footer | never | always renders |

A fetch failure is treated identically to a genuinely empty response (one
`EMPTY` fallback object in `Home.jsx`), so there is no separate error UI to
build, every section's own hidden-when-empty state already covers it.
Verified directly (empty `/api/showcase` response): hero shows the default
image, logo strip/recent clients/stats/testimonials are all absent, services
render text-only, how-it-works/CTA/footer render normally. Screenshot
reviewed, reads cleanly, no awkward gaps.

## 5. Lighthouse, before and after

"Before" is the actual pre-Prompt-4 Home (commit `1c7f156`), built and
served fresh in a git worktree for a genuine baseline, Lighthouse had never
been run against Home before this prompt.

| | Mobile (390) dark | Mobile (390) light | Desktop (1280) dark | Desktop (1280) light |
|---|---|---|---|---|
| **Before** perf / a11y / best-practices / pwa | 98 / 95 / 100 / 100 | 98 / 95 / 100 / 100 | 99 / 95 / 100 / 100 | 100 / 95 / 100 / 100 |
| **After**, full fixture | 96 / 100 / 96 / 100 | 96 / 100 / 96 / 100 | 99 / 100 / 96 / 100 | 100 / 100 / 96 / 100 |
| **After**, empty landing | 97 / 100 / 100 / 100 | 97 / 100 / 100 / 100 | 99 / 100 / 100 / 100 | 99 / 100 / 100 / 100 |

Accessibility went from a pre-existing 95 (a color-contrast failure that
predates this prompt) to 100 in every case. Performance stayed at or above
target (90+) throughout; the JS payload for Home itself dropped from 42.3 KB
to 19.1 KB gzipped in the production build. Best Practices sits at 96 (not
100) only in the full-fixture case, both mobile and desktop: the "before"
number's fixtures had no external image URLs to fail against, this
sandbox's network policy blocks the CRM fixtures' `picsum.photos` cover
images (`ERR_TUNNEL_CONNECTION_FAILED`), which Lighthouse's
`errors-in-console` audit counts as a console error. The empty-landing run,
which has no external image to request, scores 100 across all four
categories at both widths, confirming the code itself is clean and the 96
is this environment's outbound network restriction, not reachable in
production, which serves real Cloudinary URLs.

## 6. Touch target and contrast results

- Navbar hamburger: 44x44 (was 36x36).
- `--text-muted` (light theme): #6b6b6b (was #8a8a8a, 3.2-3.5:1 on this
  theme's backgrounds). Clears `.navbar-drawer-contact` and `.footer-copy`.
- New `--brand-text` variable (resolves to `--brand-light` on the dark
  theme, `--brand-dark` on the light theme, both already-declared colors,
  no new hex): clears `.navbar-drawer-contact a`, `.wk-eyebrow`,
  `.tc-business`, `.svc-link`, `.footer-cta-btn`. The first two were Part
  3's named scope; the last three surfaced only once Home's own axe/Lighthouse
  scan reached them (a card-background context Part 3's page-background fix
  did not cover, `.svc-link`/`.footer-cta-btn` were simply never on an
  audited page's path before Home existed).
- Footer's two column `<nav>` elements: `aria-label="Navigation"` and
  `aria-label="Products"`.
- Marquee's aria-hidden duplicate group: its items are cloned with
  `tabIndex={-1}` so a Link inside it (the logo strip) is not keyboard
  reachable while also being screen-reader hidden.
- Checked Home, Clients, and a client detail page in the light theme after
  the contrast change: reads cleanly (screenshots reviewed at 1280).

## 7. Hex count

`node scripts/hex-count.js`: **125** (ceiling 130 stated in this prompt's
RULES, was 130 at the start, went down: two Home rebuild passes removed far
more hardcoded decorative color literals from the deleted sections than the
handful of new components added, and `--brand-text` reuses existing hex
rather than declaring new).

## 8. Audit results

| Script | Result |
|---|---|
| `npm run build` | Clean |
| `hex-count.js` | 125 |
| `css-orphans.mjs` | 0 across 949 classes in 149 files |
| `regression.mjs` (admin, unrelated to this prompt) | 64/64 |
| `dates-test.mjs` | all cases pass |
| `layout-audit.mjs` (`AUDIT_ONLY=marketing`, 5 widths) | Home clean at every width, full and empty landing; one unrelated pre-existing failure at 320px only (`/contact`'s Calendly embed, 17px narrower than viewport, untouched by this prompt) |
| `a11y-audit.mjs` (`AUDIT_ONLY=mkt`, both themes, 390+1280) | 28/28 rows clean, 0 violations of any severity, across every marketing page and state, this is the "marketing coverage now sitewide clean" this part called for |
| `a11y-audit.mjs` (full sitewide, both themes) | Every admin screen clean except one unrelated pre-existing finding (a `meta-viewport`/landmark issue on the Submissions detail sheet, an admin screen this prompt never touches) |
| Lighthouse, Home | see section 5 |

## 9. Decisions

- Reused `Trust.jsx` and `CTA.jsx` (rewritten in place) for the logo strip
  and final CTA, since their existing job already matched Part 1's spec
  closely; `Hero.jsx` similarly rewritten in place rather than replaced,
  since Home still needs exactly one Hero component. `Process.jsx`,
  `Testimonials.jsx`, `Services.jsx`, and `ShowcasePreview.jsx` had no such
  overlap with the new structure and were deleted outright per Part 2's
  instruction.
- The logo strip reads the full `clients` array rather than
  `landing.logoStrip`, since the endpoint's convenience field only carries
  one pre-resolved logo URL per client, not the `light`/`dark` pair a
  theme-correct pick needs; `landing.logoStrip`'s own filtering
  (`featured.logoStrip`, ordered) is duplicated client-side instead, still
  from the one fetch.
- `useTheme()` extracted to `src/marketing/useTheme.js` rather than kept
  duplicated in `CaseStudy.jsx`, since Home's logo strip needed the exact
  same read.
- The Marquee and `--brand-text` fixes (Part 5) went into the shared
  primitive and a shared variable rather than a per-usage patch, since both
  bugs were in code other pages already use (Marquee will be reused,
  `--brand`-colored text exists in several files this prompt did not
  touch); patching only Home's own usage would have left the same bug
  reachable the next time either is used with real content.
- No new "empty" or "error" UI was built for Home: every section already
  hides on empty data, and a fetch failure is folded into that same empty
  shape, so there is nothing else to design for that state.
- Chose `/hero-default.svg`, a small hand-authored SVG, over reusing a real
  client screenshot as the hero's empty-CRM fallback, since a stand-in
  client image would misrepresent an actual customer's work as the default,
  and over a plain solid color, since the prompt asked for "a designed
  default image."

## 10. Deferred

- `unused-javascript` (~40 KiB potential savings) on every Lighthouse run,
  a pre-existing shared-chunk characteristic of the whole SPA bundle, not
  something a Home-only prompt should restructure.
- The Calendly embed's 320px-only width quirk on `/contact`, pre-existing,
  untouched by this prompt.
- The `meta-viewport`/landmark finding on the admin Submissions detail
  sheet, pre-existing, an admin screen this prompt never touches.
- `LogoItem` (exported from `src/marketing/showcase.jsx`, built in Site
  Prompt 3 for exactly this use) ended up unused: Trust.jsx needed
  theme-aware light/dark logo selection, which `LogoItem` does not do, so
  it builds its own markup instead. `LogoItem` is left in place since
  Site Prompt 3's report already named it as a Home-reuse export and
  removing it now would be a second breaking change to that contract in as
  many prompts; whether to update it to accept a theme-aware logo or
  retire it is a call for whoever next needs a plain (non-strip) logo
  link.

## 11. What Site Prompt 5 must know

- Home is now 8 sections, ~8 phone screens tall, one `fetchShowcase()` call
  feeding six of them; the other two (how-it-works, final CTA) are static.
- `--brand-text` (in `src/index.css`) is the variable for any new
  brand-colored TEXT (not backgrounds, borders, or icons already proven
  legible): resolves to `--brand-light` on the dark theme, `--brand-dark`
  on the light theme. `--brand` itself is 4.27-4.38:1 in every context
  measured so far, under the 4.5:1 text minimum, so new brand-colored text
  should read `--brand-text`, not `--brand`, from the start.
- `src/marketing/useTheme.js` is the shared light/dark read; anything
  needing a theme-correct asset (a logo, an image variant) should import it
  rather than writing a third copy.
- The Marquee primitive (`src/marketing/motion/Marquee.jsx`) now clones its
  duplicate group's items with `tabIndex={-1}`; this is transparent to any
  existing or new caller, no API change.
- `scripts/mock-server.mjs` accepts `MOCK_SHOWCASE_EMPTY=1` to serve an
  empty `/api/showcase` for an empty-CRM Lighthouse or manual check.
  `scripts/lighthouse.mjs` accepts `LH_FORM=desktop` for the 1280-equivalent
  preset (default remains mobile/390-equivalent).
- Marketing a11y coverage is sitewide-clean as of this prompt (28/28 rows,
  both mkt-clients and mkt-home entries in `scripts/audit-screens.mjs`);
  any new public page should get its own `marketing: true` entries there so
  it stays covered.
