# Showcase inventory (marketing site, before the CRM swap)

What a client looks like on the public site today: where the data lives, what
Work.jsx and CaseStudy.jsx render, what animates, and which of those fields
already exist on the CRM client record. Written for the prompt that swaps the
data source to the CRM without changing a pixel. Nothing here describes a new
motion system, a new schema, or an intended future state, it is a record of
what runs right now, on this build.

Files read in full: src/pages/Work.jsx, src/pages/CaseStudy.jsx,
src/components/ShowcasePreview.jsx, src/data/clients/index.js,
src/data/clients/example-client.js, src/data/clients/README.md, src/App.jsx
(the route-level fade and the scroll-reveal observer), src/index.css (every
animation and transition rule the marketing site defines), src/shared/
semantics.js, src/components/ClientWorkspace.jsx, src/pages/AdminClients.jsx,
src/lib/reviews.js, src/lib/socials.js, src/lib/projects.js, and
docs/ARCHITECTURE.md's call_leads field list.

## 1. Data source today

Hardcoded JS modules, one file per client, no fetch, no JSON, no build step.

- `src/data/clients/index.js` imports each client file and exports one array:
  `export const clients = [exampleClient]` plus `getClient(slug)` (an
  `Array.find` on `slug`). Work.jsx and ShowcasePreview.jsx import `clients`
  directly; CaseStudy.jsx imports `getClient`.
- Each client is a default export from its own file (e.g.
  `src/data/clients/example-client.js`), added by hand per
  `src/data/clients/README.md`: duplicate `example-client.js`, edit it, add
  one import and one array entry to `index.js`. No code changes needed to add
  a client, no admin UI writes these files.
- **Sample entries today: exactly 1** (`example-client`). It is explicitly a
  placeholder ("EXAMPLE CLIENT, duplicate this file to add a real client");
  no real client has been added yet.

Exact shape (every field `example-client.js` sets or comments out as
optional; the README's "Section reference" table confirms the same fields):

```
{
  slug: string,                     // required, used in the URL and as the React key
  name: string,                     // required
  type: string,                     // required, short tag e.g. "Coffee Cart"
  blurb: string,                    // required, one line
  year: string,                     // optional, e.g. "2026"
  cover: string,                    // optional, image path; card falls back to a monogram

  sections: {                       // each top-level key is optional; the section
                                    // only renders if the key is present at all
    brand: {
      logo: string,                 // optional image path
      palette: [ { name: string, hex: string } ],   // optional array
      typography: [ { family: string, role: string } ], // optional array
      images: [ string ],           // optional array of image paths
      notes: string,                // optional
    },
    website: {
      url: string,                  // optional, the live site link
      screenshots: [ string ],      // optional array of image paths
      notes: string,                // optional
    },
    cards: {
      front: string,                // optional image path
      back: string,                 // optional image path
      notes: string,                // optional
    },
    print: {
      items: [ { label: string, image: string } ], // image optional per item
      notes: string,                // optional
    },
  },
}
```

Every image path is a string under `public/clients/<slug>/...`; there is no
image upload, no CDN, no asset record anywhere, files are dropped into
`public/` by hand. Any image path left out (or an entire section object left
out) renders as a labeled placeholder or does not render at all (see
sections 2 and 3).

## 2. List card (Work.jsx, `ClientCard`)

`ClientCard` (exported from Work.jsx, line 6) is the only card component; it
is reused as-is by `ShowcasePreview.jsx` for the homepage's first 3 clients
(`clients.slice(0, 3)`), so the list card and the homepage preview card are
pixel-identical, same component, same class names, same `workStyles` string
injected in both files.

Rendered per client, top to bottom, inside `<Link to={/work/${slug}}
className="wk-card">`:

- **`.wk-card-media`** (aspect-ratio 16/10, background `var(--surface)`):
  - if `client.cover` is set: `<img src={cover} alt="{name} brand"
    loading="lazy">`, `object-fit: cover`.
  - else: `.wk-card-mono`, a centered monogram, `<span className="display">`
    holding just `client.name.charAt(0)` (the first letter, uppercase via the
    `.display` utility), `font-size: 5rem`, `color: var(--brand)`, `opacity:
    0.9`, on `var(--bg-elevated)`.
- **`.wk-card-body`** (padding `var(--space-5)`, flex column, gap
  `var(--space-2)`):
  - **`.wk-card-top`**: `<h3 className="wk-card-name">` = `client.name`, and
    `.wk-card-arrow` holding an `ArrowUpRight` icon (16x16, Untitled UI).
  - **`.wk-card-tag`**: `client.type`, a small uppercase pill
    (`background: var(--glass-bg)`, `border: 1px solid var(--border)`,
    `border-radius: 999px`).
  - **`.wk-card-blurb`**: `client.blurb`, `0.9rem`, `var(--text-secondary)`.

Fields shown on the card: `name`, `type` (as a single tag, there is no
separate services/tags list), `blurb`, and `cover` (or the monogram
fallback). `year` and every `sections.*` field are not shown on the card,
they only appear on the detail page. There is no rating, no testimonial
snippet, and no industry field distinct from `type` on the card.

Hover/entrance on the card itself (defined in `workStyles`, the same block
for both Work.jsx and ShowcasePreview.jsx):

- `.wk-card` hover: `transform: translateY(-4px)`, `border-color:
  rgba(212,76,67,0.5)`, and a two-layer `box-shadow`
  (`0 12px 40px rgba(0,0,0,.35), 0 0 0 1px rgba(212,76,67,.2)`), all
  transitioning over `0.25s var(--ease)` (border-color and box-shadow at
  `0.25s` flat).
- `.wk-card-arrow` hover: color goes from `var(--text-muted)` to
  `var(--brand)` (`0.2s`) and the icon translates `(2px, -2px)` (`0.25s
  var(--ease)`).
- `@media (prefers-reduced-motion: reduce)`: the transform is removed on both
  the card and its hover state; only the border-color transition survives.
- The Work.jsx grid itself (`.wk-grid`) carries no scroll-reveal class, no
  stagger, no entrance animation beyond the route-level page fade (section 4).

## 3. Detail layout (CaseStudy.jsx)

Top to bottom:

1. **Header (`.cs-hero`)**, always rendered:
   - "All work" back link (`ArrowLeft` icon, 15x15) to `/work`.
   - `.cs-hero-meta`: the same `.wk-card-tag` pill for `client.type`, plus
     **`{client.year && <span className="cs-year">…}`, optional**, only
     shown when `year` is set.
   - `<h1 className="cs-title display">` = `client.name`.
   - `<p className="section-subtitle">` = `client.blurb`.
2. **Body (`.cs-body`)**, a flex column with `gap: var(--space-20)` between
   sections (`Section` here means the wrapper `<section className="cs-section">`;
   that class carries no CSS rule of its own, spacing between sections comes
   entirely from the parent's `gap`):

   The four content sections are destructured as `const { brand, website,
   cards, print } = client.sections || {}` and **each one only renders at all
   if that key exists on `client.sections`** (an empty `{}` value still
   counts as present):

   a. **Brand Identity**, only if `sections.brand` exists. Icon: `Palette`.
      - `.cs-brand-grid` (1.1fr/1fr, collapses to one column at
        `max-width: 760px`):
        - Logo: a `Media` (Slot-backed) showing `brand.logo` at ratio 4/3,
          alt `"{name} logo"`; if `logo` is falsy it renders the placeholder
          Slot labeled "Logo" instead (dashed border, uppercase label,
          `var(--text-faint)`).
        - `.cs-brand-side`:
          - Palette swatches, **only if `brand.palette?.length > 0`**: one
            `.cs-swatch` card per entry, a color chip
            (`background: c.hex`), the color's `name`, and the `hex` string
            in monospace, uppercase.
          - Typography rows, **only if `brand.typography?.length > 0`**: one
            `.cs-type-row` per entry, `family` (bold) and `role` (muted),
            laid out on a baseline row.
      - Brand image gallery, **only if `brand.images?.length > 0`**:
        `.cs-media-grid` of `Media` components (default ratio 16/10), each
        labeled "Brand" as its placeholder fallback.
      - `{brand.notes && <p className="cs-notes">}`, optional.
   b. **Website**, only if `sections.website` exists. Icon: `Globe01`.
      - `.cs-browser`: a fake browser chrome bar (three colored dots,
        `var(--dot-close)` / `var(--dot-min)` / `var(--dot-max)`, defined in
        `src/index.css` root), then:
        - **if `website.screenshots?.length > 0`**: each screenshot rendered
          as a plain `<img className="cs-browser-shot">` (no Slot wrapper,
          full width).
        - **else**: one placeholder Slot labeled "Website screenshot" at
          ratio 16/9.
      - `.cs-sec-foot`: `{website.notes && <p className="cs-notes">}`
        (optional) and, **only if `website.url` is set**, a "Visit live
        site" `<a target="_blank" rel="noopener noreferrer">` button
        (`.btn.btn-secondary`) with an `ArrowUpRight` icon.
      - No other external link (social, map, etc.) is rendered anywhere on
        the case study page today, only the live site URL. The client data
        shape has no field for a second link either.
   c. **Business Cards**, only if `sections.cards` exists (as an object; its
      own fields are not further gated). Icon: `CreditCard02`.
      - `.cs-cards-grid` (2 columns, 1 column at `max-width: 640px`): a
        `Media` for `cards.front` (ratio 7/4, placeholder label "Card
        front") and one for `cards.back` (ratio 7/4, placeholder label "Card
        back"). Both always attempt to render, whichever of `front`/`back`
        is missing shows its own placeholder Slot rather than being omitted.
      - `{cards.notes && <p className="cs-notes">}`, optional.
   d. **Print & Product**, only if `sections.print` exists. Icon: `Package`.
      - `.cs-media-grid` of `<figure className="cs-print-item">`, one per
        entry in `print.items` (defaults to `[]` if `items` is absent): a
        `Media` for `item.image` (placeholder label is `item.label` itself
        when no image), plus a `<figcaption className="cs-print-caption">`
        = `item.label`. An empty or missing `items` array renders zero
        figures, there is no "nothing here" fallback state for this grid.
      - `{print.notes && <p className="cs-notes">}`, optional.
   e. **"Start your own" CTA (`.cs-cta`)**, always rendered, not driven by
      client data at all: heading "Start your own", one line of copy, and a
      "Start a Project" link (`.btn.btn-primary`, `ArrowRight` icon) to
      `/start`.

Testimonial/review quote and attribution: **not rendered anywhere on the
case study page today.** There is no quote block, no reviewer name, no star
rating, in either the client data shape or the component. Before/after
comparisons: **do not exist**, there is no such component; the closest
visual convention is the dashed-border placeholder Slot (`.cs-slot`, solid
border once `:has(img)`) standing in for any missing image.

Always shown regardless of the data file: `name`, `blurb`, `type` (as the
header pill), and the final CTA section. Everything else, `year`, and all
four `sections.*` blocks and their inner fields, is conditionally rendered
only when present.

## 4. Animations (as they exist now, independent of any new motion system)

- **Route-level fade**, every marketing page including Work and CaseStudy:
  `App.jsx` wraps `<main className="page-shell page-fade" key={pathname}>`;
  `.page-fade` (`src/index.css`) starts at `opacity: 0` and runs
  `@keyframes pageFade` (`opacity 0→1`, `translateY(8px)→0`) over `0.5s
  var(--ease)`, once, on every route change (the `key` on `<main>` forces a
  remount).
- **Card hover** (Work.jsx list and the homepage preview, same `.wk-card`
  rules): rise `translateY(-4px)`, brand-tinted border and box-shadow, arrow
  icon shifts color and translates `(2px, -2px)`, all `0.25s`. Fully
  disabled (transform removed) under `prefers-reduced-motion: reduce`,
  border-color still transitions.
- **Scroll-reveal classes exist in markup but currently do nothing
  visually.** `App.jsx` runs a global `IntersectionObserver` (selector
  `.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger`) that adds
  an `is-visible` class the first time each matched element scrolls into
  view. `ShowcasePreview.jsx` puts `reveal` on its heading block and
  `stagger` on the grid of 3 featured client cards. **`src/index.css` defines
  no CSS rule at all for `.reveal`, any of its variants, `.stagger`, or a
  general `.is-visible`** (confirmed by grep across `src/index.css` and the
  built `dist*/assets/*.css`, zero matches beyond an unrelated
  `.navbar-overlay.is-visible` rule in Navbar.jsx). In the current build this
  means: the featured-clients heading and grid on the homepage are visible
  at full opacity from first paint, the class toggle is a no-op, there is no
  actual fade-in or stagger happening today despite the markup and the
  observer being wired up. Work.jsx's own grid carries neither class at all.
- **"Visit live site" and "Start a Project" buttons**: inherit the sitewide
  `.btn` / `.btn-secondary` / `.btn-primary` hover rules from
  `src/index.css` (background, border-color, box-shadow transitions at
  `var(--duration)` = `0.3s`; `.btn-primary` additionally lifts
  `translateY(-1px)` on hover). Not specific to the showcase, shared with
  every button on the site.
- **Homepage "View All Work" link** (`ShowcasePreview.jsx`): arrow icon
  translates `translateX(3px)` on hover, `0.2s`, no other motion.
- **Case study back link** (`.cs-back`): color transition only (`0.2s`),
  from `var(--text-muted)` to `var(--text)` on hover, no transform.
- No parallax, no autoplay carousel, no image crossfade, and no
  scroll-linked (as opposed to hover- or route-triggered) motion exists
  anywhere in Work.jsx, CaseStudy.jsx, or ShowcasePreview.jsx today.

## 5. CRM field gap analysis

Every field the showcase renders (sections 2 and 3), checked against the
`call_leads` document shape in `docs/ARCHITECTURE.md` and the field-level
detail in `src/shared/semantics.js`, `src/components/ClientWorkspace.jsx`,
and `src/lib/projects.js`.

| Showcase field | Where it's used | CRM status | Detail |
|---|---|---|---|
| `slug` | card link, case study URL | Does not exist | No slug field anywhere on `call_leads`; nothing derives a URL-safe slug from `business` today. |
| `name` | card, hero title | Exists | `call_leads.business`. |
| `type` | card tag, hero pill | Exists, partial | `call_leads.industry`. Free text, not curated per-showcase copy; casing is inconsistent by source (Title Case from spreadsheet imports vs lowercase from the nightly enricher, per `semantics.js`'s `industryKey`/`displayIndustry` comment). |
| `blurb` | card, hero subtitle | Does not exist | No public-facing one-line summary field on `call_leads`. `brand.notes` and the lead's own `notes`/`prepNotes` are internal, not written as public copy. |
| `cover` | card media | Does not exist | No image/asset URL field of any kind on `call_leads`. |
| `year` | hero meta | Exists, partial | `call_leads.clientSince` is a full ISO timestamp, not a bare year string; would need to be derived. |
| `brand.logo` | Brand Identity section | Exists, partial | `call_leads.brand.logoLink`. Typically a Drive folder/file link (see `ClientBrand`'s placeholder text "Drive link to the logo files"), not guaranteed to be a direct hosted image URL an `<img>` tag can use. |
| `brand.palette[{name,hex}]` | Brand Identity swatches | Exists, partial | `call_leads.brand.primary` (one hex) plus `call_leads.brand.colors[]` (up to 4 hex strings, edited as a fixed 4-slot UI in `ClientBrand`). No per-color `name` field exists. |
| `brand.typography[{family,role}]` | Brand Identity type list | Exists, partial | `call_leads.brand.fontDisplay` and `call_leads.brand.fontBody`, exactly two fixed named slots, not an arbitrary array with custom role labels. |
| `brand.images[]` | Brand Identity gallery | Does not exist | No image gallery/array field on the client record. |
| `brand.notes` | Brand Identity notes | Exists | `call_leads.brand.notes`. |
| `website.url` | Website section, live link | Exists | `call_leads.links.website` (also mirrored, in effect, by `call_leads.socials.website`, see `ClientLinks`'s fallback lookup). |
| `website.screenshots[]` | Website section | Does not exist | No screenshot/image array field. |
| `website.notes` | Website section | Does not exist | No field scoped to the website specifically; only the whole-lead `call_leads.notes`, which is generic and not written as public copy. |
| `cards.front` / `cards.back` | Business Cards section | Does not exist | No image fields for business-card artwork. |
| `cards.notes` | Business Cards section | Does not exist | Same generic-notes caveat as `website.notes`. |
| `print.items[{label,image}]` | Print & Product section | Exists, partial, different collection | `projects.deliverables[]` (on the separate `projects` collection, one document per project, not on `call_leads` itself) has `{id, group, label, done, link}`. `label` matches; there is no dedicated `image` field, and `link` is a generic URL, not typed as an image. Requires a linked project document to exist at all. |
| `print.notes` | Print & Product section | Does not exist | No scoped field, same generic-notes caveat. |

Not in the table because the showcase does not currently render them, but
worth flagging for the same later prompt: a testimonial quote and its
attribution are not rendered anywhere in the showcase today (section 3), and
they also do not exist on the CRM record. `call_leads.reviews` only holds
`{nfcCard, nfcGivenAt, googleLink, baseline{count,rating},
latest{count,rating}, asks[]}`, tracking whether a review was asked for and
Google's aggregate rating, never the text of a review or a reviewer's name.
Conversely, `call_leads.socials` already carries `instagram`, `facebook`,
`tiktok`, `google`, `yelp`, `linkedin`, `x`, and `youtube` links that the
showcase does not surface at all today, those exist on the CRM ahead of any
UI that would show them.
