# PROMPT: Create the `client-website` skill

> Paste everything below the line into Claude Code (in whichever project you want
> the skill to live). It will generate a complete, reusable skill for building
> client websites at a production standard.

---

You are going to create a Claude Code **skill** named `client-website`.

The skill's job: whenever I say I'm building a website for a client, it takes over
and walks me from a blank repo to a deployable, production-grade site — one that
looks like it was designed *for that specific business*, not assembled from a
template.

This document contains the complete specification: the architecture to reproduce,
the intake process, the quality bar, and the file layout. Everything here was
extracted from a real, shipped site. Treat the technical details as verified
facts, not suggestions.

## THE PRIME DIRECTIVE

**Reuse the architecture. Never reuse the brand.**

The reference site is a dark, high-contrast, editorial studio site with a red
accent and condensed display type. That look belongs to *that* client. What
transfers to every new project is:

- the token architecture and theming mechanism
- the section/page archetypes and layout grammar
- the content-as-data extensibility pattern
- the accessibility, motion, and performance discipline
- the module patterns (forms, backend, admin)

What must be **derived fresh for every client**: every color, both typefaces, the
radius scale's feel, motion intensity, imagery, copy, section order, and overall
mood. A bakery site and a law-firm site built with this skill should share zero
visual DNA while sharing 100% of their engineering quality.

If you ever find yourself producing `#d44c43` on a red-accent dark site for a
client who didn't ask for one, you have failed the directive.

---

# PART 1 — THE STAGED INTAKE

This is the most important behavior in the skill. **Do not dump every question at
once, and do not start building until Round 3 is complete.**

Use the `AskUserQuestion` tool. Ask **3–5 questions per round**, in five rounds.
Each round's questions must adapt to the previous round's answers — if they said
"restaurant" in Round 1, Round 2 asks about menus and photography, not about
SaaS onboarding.

Between rounds, briefly reflect what you heard ("So: a family-run bakery, walk-in
heavy, wants online preorders") so I can correct you cheaply before you build.

### Round 1 — The Business
- Business name, and what they actually sell (in their words)
- Who buys from them — describe a typical customer
- Local, regional, or online-only? Any physical location(s)?
- What do they want a visitor to *do* on the site? (call, book, buy, visit, inquire)
- Who are their competitors, and what do they do better?

### Round 2 — Brand & Visual Direction
- Existing brand assets? (logo, colors, fonts — ask for files/hex codes if yes)
- If no brand: what feeling should it give? Offer these five axes and let me
  place the business on each:
  - dark ↔ light
  - minimal ↔ rich/detailed
  - classic/timeless ↔ modern/technical
  - corporate/serious ↔ playful/human
  - calm/quiet ↔ bold/loud
- Any colors that are off-limits (competitor colors, cultural issues, owner hates)?
- Two or three websites they admire — and specifically what about them
- Photography situation: pro photos, phone photos, stock, or none yet?

### Round 3 — Scope & Content
- Which pages? (offer: Home, About, Services/Menu, Work/Gallery, Contact, plus
  industry-specific ones)
- The single most important conversion action
- What content exists today vs needs writing?
- What's the one thing customers always ask before buying? (this usually becomes
  a homepage section)

### Round 4 — Modules
Ask which of these to include — describe each in plain terms, not jargon:
- **Multi-step intake form** — a guided, animated questionnaire for qualifying leads
- **Leads backend + admin dashboard** — submissions stored in a database with a
  password-protected dashboard (pipeline, notes, search)
- **Booking integration** — embedded scheduler (Calendly or similar)
- **PWA + push notifications** — installable to phone home screen, push alerts on
  new leads *(note: push requires the PWA layer and the leads backend)*

### Round 5 — Deployment
- Domain (registered already? where's DNS?)
- Hosting target (default: Vercel)
- Who owns the accounts — me or the client?
- Any credentials/env vars they'll need to provide

### Brand-translation table

Use this to turn Round 2 answers into concrete design decisions. These are
starting points to adapt, not fixed recipes.

| Business type | Palette direction | Type pairing feel | Radius | Motion |
|---|---|---|---|---|
| Bakery / café / florist | Warm cream, terracotta, sage; light-first | Friendly serif display + humanist sans | Generous (12–20px) | Soft, slow fades |
| Law / finance / consulting | Deep navy/charcoal, restrained gold or slate | Classic serif or grotesk + neutral sans | Tight (4–8px) | Minimal, no bounce |
| Auto / trades / industrial | Near-black, safety orange or steel blue | Heavy condensed + sturdy sans | Sharp (0–6px) | Snappy, mechanical |
| Beauty / wellness / spa | Muted blush, bone, sage; light, airy | Elegant high-contrast serif + light sans | Soft (12–999px pills) | Slow, floaty |
| Fitness / sports | High-contrast dark, electric accent | Ultra-bold condensed caps + tight sans | Sharp | Fast, aggressive |
| Kids / education / family | Bright multi-accent on white | Rounded sans + playful display | Very round | Bouncy (respecting reduced-motion) |
| Tech / SaaS / agency | Dark or light, single saturated accent | Geometric sans + mono details | Medium (8–12px) | Precise, subtle |
| Restaurant / bar | Deep moody or warm neutral; food photos lead | Display serif + clean sans | Medium | Cinematic, image-led |

**Rules for applying it:**
- Dark themes are *not* the default. Choose based on the business, and note that
  food, wellness, kids, and most retail read better light.
- Pick exactly **two** typefaces: one display, one body. Never script or italic
  for a display face. Body face must be highly legible at 16px.
- The accent color should survive a contrast check against both backgrounds
  (aim WCAG AA, 4.5:1 for text).

---

# PART 2 — DESIGN SYSTEM ARCHITECTURE

Reproduce this *structure* with values derived for the client. All tokens live in
one global stylesheet (`src/index.css`); components reference `var(--…)` only and
never hardcode theme values.

### Token families

```css
:root {
  /* Brand — 4 shades derived from the client's accent */
  --brand: <client accent>;
  --brand-deep: <darker, for graphic accents>;
  --brand-dark: <hover/pressed>;
  --brand-light: <highlights>;

  /* Neutrals — 5 surface levels, deepest to raised */
  --bg: …; --bg-deep: …; --bg-elevated: …; --bg-card: …; --surface: …;
  --border: rgba(…, 0.08);
  --border-light: rgba(…, 0.14);

  /* Text ramp — 4 levels */
  --text: …;            /* headings */
  --text-secondary: …;  /* body */
  --text-muted: …;      /* labels, meta */
  --text-faint: …;      /* disabled, stamps */

  /* Type */
  --font-body: '<body face>', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: '<display face>', '<body face>', sans-serif;

  /* Spacing — 8px base, rem-denominated */
  --space-1: .25rem;  --space-2: .5rem;   --space-3: .75rem;  --space-4: 1rem;
  --space-5: 1.25rem; --space-6: 1.5rem;  --space-8: 2rem;    --space-10: 2.5rem;
  --space-12: 3rem;   --space-16: 4rem;   --space-20: 5rem;   --space-24: 6rem;
  --space-32: 8rem;

  /* Layout */
  --max-width: 1200px;
  --radius: <per brand>;
  --radius-lg: <per brand>;

  /* Glass / translucent surfaces */
  --glass-bg: …; --glass-bg-strong: …; --glass-bg-brand: …;
  --glass-border: …; --glass-border-brand: …;
  --glass-blur: 14px; --glass-blur-strong: 24px;

  /* Chrome — navbar/drawer surfaces + hovers + shadows */
  --chrome: …; --chrome-solid: …;
  --hover-soft: …; --hover-strong: …;
  --shadow-chrome: …; --shadow-chrome-strong: …;

  /* Motion */
  --ease: cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --duration: 0.3s;

  color-scheme: dark; /* or light — match the default theme */
}
```

### Theming

Support both themes with a **single `data-theme` attribute** on `<html>`:

- `:root` holds the default theme; `:root[data-theme='<other>']` overrides only
  the **neutrals, text ramp, glass, chrome, hovers, shadows, and `color-scheme`**.
- Brand colors, spacing, radii, fonts, and blur values are **shared** — they never
  swap. This is what keeps both themes recognizably the same brand.

**Pre-paint script** — inline in `<head>` of `index.html`, before any render, to
prevent a flash of the wrong theme:

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem('<prefix>_theme');
      if (t !== 'light' && t !== 'dark') {
        t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      document.documentElement.dataset.theme = t;
    } catch (e) { document.documentElement.dataset.theme = '<default>'; }
  })();
</script>
```

**ThemeToggle component** — a round icon button that flips the attribute, persists
the choice to localStorage, and attaches a `matchMedia('change')` listener that
follows the OS **only while the user hasn't chosen explicitly**. Once they click,
their choice wins forever. Wrap all localStorage access in try/catch (private mode).

### ⚠️ The reskin footgun

Tokens are not the whole story. In real code, the brand color also gets hardcoded
as `rgba()` literals inside gradients, glow shadows, focus rings, and texture
overlays — places where an alpha ramp of the brand is needed and `var()` is
awkward. **When reskinning, grep for the old brand's rgb triplet and sweep those
too.** Missing this leaves ghost-colored glows from the previous brand.

Prefer `color-mix(in srgb, var(--brand) 12%, transparent)` over hardcoded rgba
where browser support allows — it makes future reskins single-token.

### Utility classes to define

- `.wrap` — page container: `max-width: var(--max-width)`, centered, horizontal
  padding `--space-6` → `--space-4` under 768px
- `.section` — vertical rhythm: `--space-24` top/bottom → `--space-16` under 768px
- `.section-dark` / `.section-elevated` — background variants for alternating bands
- `.btn` / `.btn-primary` / `.btn-secondary` — inline-flex, centered, tokenized
  padding, `--radius`, transitions on background/transform/border/shadow
- `.glass-panel` — the reusable card primitive: glass bg + blur + 1px border
- `.display` — display face, uppercase, tight line-height (~0.95) for big headers
- `.section-title` / `.section-subtitle` — `clamp()`-sized heading + muted sub
- Optional signature texture (a faint grid, noise, or gradient wash) as a
  `::before` overlay class — **design one per client, don't reuse**

---

# PART 3 — PAGE ARCHETYPES

Each section is a self-contained component: a data array at the top of the file,
a `.map()` into markup, and a **co-located `<style>{`…`}</style>` block** scoped by
a class prefix unique to that component (`hero-`, `svc-`, `wk-`, `cs-`…).

This CSS-in-JSX convention is deliberate: no build step, no CSS modules, no
Tailwind, and every component is portable in one file. The prefix is the only
isolation mechanism — **enforce prefix uniqueness rigorously.**

### The archetypes

- **Navbar** — sticky floating pill (constrained max-width, large border-radius,
  translucent chrome bg, backdrop-filter). Adds a `--scrolled` state past ~24px
  that solidifies the background and deepens the shadow. Links come from a
  `links[]` array of `{to, label, icon, newTab}` — `newTab: true` renders a real
  `<a target="_blank" rel="noopener noreferrer">`. Includes the theme toggle at
  all widths. Mobile: burger → overlay + right-side drawer that slides in, with
  per-link icons and a CTA; auto-closes on route change.

- **Hero** — two columns. Left: eyebrow (small pill with a pulsing dot) → h1 →
  sub → **dual CTA** (primary conversion + secondary explore) → optional stat row
  from a `[{num, label}]` array. Right: a visual — client photography if they have
  it, otherwise a pure-CSS/SVG abstract mock (floating cards, browser frame,
  orbit ring). Collapses to one centered column ~900px with the visual reordered.

- **Services / Offerings** — data-driven pillar cards from an array of
  `{title, items[], icon, color}`. Cards expand on hover/click. **Per-card accent
  injection**: set `style={{ '--sc': item.color }}` on the card and have one CSS
  block read `var(--sc, var(--brand))` — this themes every card from data with
  zero extra CSS. 4 → 2 → 1 column.

- **How It Works / Process** — 4 numbered steps from `{num, title, desc, icon}`,
  with a connector line drawn between cards on wide screens only. Write the steps
  as the *client's* customer journey, not a generic process.

- **Social proof** — testimonials as quote cards from `{text, author, company}`,
  with monogram avatars when no photo exists; and/or a logo strip. If the client
  has neither yet, build the component with labeled placeholders rather than
  fabricating testimonials. **Never invent reviews or client names.**

- **CTA band** — full-width centered band, subtle radial brand glow, one headline,
  one button. Place before the footer.

- **Footer** — grid: brand + tagline + contact column, nav columns, CTA/social
  column. Bottom row: copyright with a live `new Date().getFullYear()` and a
  build stamp (see Part 6).

**Default home composition:** Hero → Trust/Proof → Services → [feature section] →
Work/Gallery preview → How It Works → Testimonials → CTA. **Re-order this per
client** — a restaurant leads with photos and menu; a consultancy leads with
credibility and process.

### Responsive

Dominant breakpoints: **900px** (stack to single column / center), **768px**
(mobile chrome, tighter spacing), **600px** (grids to one column). Prefer
`repeat(auto-fill, minmax(280px, 1fr))` for card grids so they need no
breakpoints at all.

---

# PART 4 — CONTENT AS DATA (the extensibility rule)

**Every repeating content type must live as plain JS data files, so the client's
content can grow with zero code changes.** This is the single highest-value
pattern in the whole system.

Structure:

```
src/data/<thing>/
  index.js          # registry: imports + export const items = [...]
  example-item.js   # the template to duplicate
  README.md         # how to add one, in plain language
```

- `index.js` exports the array (array order = display order) plus a
  `getItem = (slug) => items.find(i => i.slug === slug)` lookup.
- Each item is a default-exported plain object with a `slug`, display fields, and
  a `sections` object of **optional** sub-sections.
- The detail page destructures `const { a, b, c } = item.sections || {}` and
  renders each **only if present** (`{a && (…)}`), with nested guards on arrays
  (`palette?.length`).
- **Labeled placeholder fallback**: any missing image renders a dashed-border box
  with an uppercase label ("Logo", "Hero photo", "Menu image"). Use
  `.slot:has(img)` to swap the dashed border to solid when a real image arrives.
  This lets pages **ship before the photography exists** — critical for real
  client timelines.
- `README.md` documents: duplicate the example file, drop images in
  `public/<thing>/<slug>/`, edit the object, delete sections that don't apply, add
  one import + one array line. Say explicitly: *no code changes needed.*

Apply this to whatever repeats for the client: menu items, properties, treatments,
staff, case studies, products, locations, FAQs.

Reuse card components and their exported style strings between the index grid and
any homepage preview, so they can never drift apart.

---

# PART 5 — OPTIONAL MODULES

Build these **only if selected in Round 4.**

### A. Multi-step intake form

A single self-contained page component implementing a wizard.

- **Stage machine**: one `stage` state that is `'intro'` | a numeric step index |
  `'done'`. Intro screen with a headline and a "Begin" button → one step at a time
  → success screen.
- **Direction-aware animation**: a `dir` state (`'fwd'` / `'back'`) selects between
  two slide-in keyframes, with a `prefers-reduced-motion` fallback that swaps to a
  near-instant fade.
- **Data-driven steps**: `STEPS[]` of `{id, title, sub}`; one flat form-state
  object holds all fields; shared field primitives — `Field` (label/desc/error
  wrapper), `Radio`, `IconCards` (single or multi-select with an optional `max`),
  `Checks` (stack/grid/pill layouts). Options are declared as data arrays.
- **Per-step validation**: a pure `validateStep(stepId, form)` returning an errors
  object. Block advancing on errors, scroll the first error into view (give fields
  `id={'f-' + key}`), clear a field's error on edit.
- **Accessibility**: move focus to the new step's heading on change; sticky
  progress bar with `role="status"` announcing "Step N of M"; errors as
  `role="alert"`; full keyboard operation.
- **Dual-path submit so a lead is never lost**: POST to the site's own
  `/api/submissions` first; on *any* failure, fall back to a direct email-service
  POST (e.g. Web3Forms) with the same payload; if both fail, show an inline error
  with a mailto address.

### B. Leads backend + admin dashboard

Vercel serverless functions (`export default function handler(req, res)`) with
MongoDB and cookie sessions.

**Shared libs (`api/_lib/`):**
- `mongo.js` — cache the `MongoClient` promise on `globalThis` so warm
  invocations reuse the connection (`maxPoolSize: 5`, sensible
  `serverSelectionTimeoutMS`). Read `MONGODB_URI`; take the db name from the URI.
- `auth.js` — stateless signed-cookie sessions. Token = `"<expiryMs>.<HMAC-SHA256
  of expiry, keyed by SESSION_SECRET>"`, base64url. Provide `makeToken`,
  `checkToken` (expiry check + `crypto.timingSafeEqual`), `sessionCookie`
  (`HttpOnly; Secure; SameSite=Lax; Max-Age`), `isAuthed(req)`, and a
  `requireAdmin(req, res)` guard that 401s.
- `notify.js` — `sendEmail()` (always on) and optionally `sendPush()` via VAPID
  web-push, fanning out to stored subscriptions and pruning dead ones on 404/410.
  Both must swallow their own errors.

**Endpoints:**
- `POST /api/submissions` (public) — validate name + email, insert a doc
  (`{type, name, business, email, phone, fields, status: 'new', read: false,
  notes: '', createdAt}`) with a whitelisted `type`, then fire notifications via
  `Promise.allSettled` so **a notification failure never fails the submission**.
- `GET/PATCH /api/admin/submissions` (guarded) — GET supports search (regex-escape
  the query), status/type/date filters, and returns items plus aggregate counts,
  unread count, and a weekly series for the chart. PATCH updates only whitelisted
  fields with a status enum and a length cap on notes.
- `POST /api/admin/login` — timing-safe hash compare against `ADMIN_PASSWORD`,
  sets the session cookie. Plus `logout` and `session` endpoints.

**Admin UI** (rendered outside the marketing chrome):
- Login → **Overview** (stat cards, a simple bar chart of recent weeks, a pipeline
  breakdown) → **Leads** (search, filters, list, detail with status pipeline,
  private notes, read/unread). Status set: new → contacted → replied → landed /
  denied. Show an unread badge and reflect it in `document.title`.

**Env vars:** `MONGODB_URI`, `SESSION_SECRET`, `ADMIN_PASSWORD`,
`WEB3FORMS_NOTIFY_KEY` (+ `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` if push).

> **🔒 Security rule, no exceptions:** never put a password or secret in a
> `VITE_`-prefixed variable. Vite inlines those into the public client bundle
> where anyone can read them. Passwords are checked **server-side only**. If you
> inherit a `VITE_ADMIN_PASSWORD` from an older build, replace it and tell me to
> delete it.

**One login across all admin surfaces.** If a project ends up with more than one
dashboard, they share a single session — never a second password.

### C. PWA + push (add-on)

Manifest (`name`, `short_name`, `display: "standalone"`, `start_url`, `scope`,
`background_color`, `theme_color`, icons at 192/512/maskable-512), `<link
rel="manifest">` + `apple-touch-icon` + `theme-color` meta, and a service worker
registered on load. The SW needs a `fetch` handler to be installable (a no-op
passthrough is fine if you don't want offline caching), plus `push` and
`notificationclick` handlers that deep-link into the admin.

**Document the iOS constraint:** web push only works on iOS 16.4+ **after** the
site is added to the Home Screen and notifications are allowed from the installed
app. Write the client a short "how to turn on notifications" note.

---

# PART 6 — NON-NEGOTIABLE QUALITY BAR

Apply to every site, every time.

### Icons
- **One source only.** Default to `@untitled-ui/icons-react` with per-icon deep
  ESM imports for tree-shaking:
  `import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';`
- Size with explicit `width`/`height` props; color via `currentColor` on the parent.
- **Zero emoji anywhere** — not in UI, not in copy, not in data files. If a concept
  needs a glyph, use an icon.
- If the set lacks something (e.g. social brand marks), hand-draw one SVG matching
  the set's grid and stroke weight rather than importing a second library.

### ⚠️ Dependency footgun
`@untitled-ui/icons-react` depends on Babel runtime helpers at
`@babel/runtime/helpers/esm/extends`. **`@babel/runtime` v8 removed that path** —
installing v8 breaks the build with a cryptic "Missing ./helpers/esm/extends
specifier" error. **Pin `@babel/runtime` at `^7`** as a direct dependency.

### Accessibility
- Global `:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px }`
- Global reduced-motion block clamping animation/transition durations to `0.01ms`
  and disabling smooth scroll
- Inputs/textareas/selects forced to 16px under 768px (stops iOS zoom-on-focus)
- Semantic HTML, real `<button>`/`<a>` elements, alt text on every image,
  `aria-label` on icon-only controls, logical heading order, full keyboard nav

### Motion
- One global `IntersectionObserver` in the app root watching `.reveal`,
  `.reveal-left`, `.reveal-right`, `.stagger`; adds `is-visible` once then
  unobserves (`threshold: 0.1`, `rootMargin: '0px 0px -40px 0px'`). Re-attach
  after route changes with a small timeout so newly mounted nodes get observed.
- Consistent hover grammar: cards lift 2–4px with a brand-tinted border and
  layered shadow; arrows slide ~3px; accent bars scale in via `::before`.

### Deploy verification
Inject the commit SHA at build time so a live page can be matched to a commit:

```js
// vite.config.js
define: {
  __BUILD_SHA__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)),
}
```

Render it small and muted in the footer. This turns "did my change deploy?" from
a guess into a glance — genuinely valuable when DNS or project wiring is uncertain.

### Hosting config
`vercel.json` with `buildCommand`, `outputDirectory: dist`, an SPA rewrite
(`/(.*) → /index.html`), and security headers (`X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `X-XSS-Protection`). Note that `api/` functions are
handled by Vercel's convention and are **not** shadowed by the rewrite.

### Performance
Lazy-load below-the-fold images, size images correctly before shipping, preconnect
to font origins with `display=swap`, and keep the initial bundle lean (deep icon
imports, no unused dependencies).

---

# PART 7 — BUILD SEQUENCE

The skill must follow this order, **building and smoke-testing after each stage**,
keeping the site deployable throughout:

1. **Scaffold** — Vite + React + Router, `vercel.json`, folder structure
2. **Design system** — tokens, both themes, pre-paint script, fonts, utilities
3. **Chrome** — Navbar, Footer, theme toggle, wordmark/logo treatment, app shell
4. **Pages** — home sections first, then interior pages
5. **Content data** — data directories, example items, READMEs
6. **Modules** — form / backend / admin, if selected
7. **Polish** — a11y sweep, responsive check at 375/768/1440, performance,
   metadata + favicons

After each stage, report: what changed, what I should look at, and anything I
must configure myself (env vars, DNS, accounts). Never assume a step succeeded —
run the build.

---

# PART 8 — THE SKILL FILES TO CREATE

```
.claude/skills/client-website/
  SKILL.md                     # workflow, intake, checklists
  reference/design-system.md   # Part 2 in full
  reference/archetypes.md      # Parts 3 + 4 in full
  reference/modules.md         # Part 5 in full
  scripts/smoke.sh             # curl-based route check
```

`SKILL.md` frontmatter — exactly this shape, with only `name` and `description`,
and a trigger-verb-heavy description so it fires reliably:

```markdown
---
name: client-website
description: Build, design, or scaffold a website for a client from scratch — brand-tailored marketing site with optional intake form, leads backend, and admin dashboard. Use whenever starting a new client website project, redesigning an existing one, or adding pages/sections to a client site.
---
```

Body sections: a one-paragraph intro naming the stack, then `## The intake
(do this first)`, `## Build sequence`, `## Quality bar`, `## Gotchas`,
`## Troubleshooting`. Keep `SKILL.md` scannable and push the long specs into
`reference/` files it can read on demand.

`scripts/smoke.sh`: `#!/usr/bin/env bash`, `set -e`, resolve the repo root from
the script path, take a mode arg (`build` | `dev` | `preview`, default `preview`),
run the build, start the server in the background with a `trap cleanup EXIT` that
kills it, poll until it responds, then `curl` each route asserting HTTP 200. Exit
non-zero on any failure. Entirely curl-based — no browser needed.

**Derive the route list from `App.jsx` at run time rather than hardcoding it.** A
hardcoded route table in a skill file goes stale the moment routes change — this
has already happened once in a real project, leaving a skill that referenced
redirected and moved routes.

---

# PART 9 — WORKED EXAMPLE

To prove the architecture is brand-independent, here's the same system producing a
site with zero visual overlap with the dark studio reference.

**Client:** family bakery, walk-in heavy, wants online preorders.
**Round 2 answers:** light, rich, classic, human, calm. No existing brand. Loves
warm neutrals; hates "corporate blue." Has good phone photos of product.

**Derived system:**
- Default theme **light** (`color-scheme: light`), dark mode as the secondary
- `--bg: #fdfaf5`, `--bg-elevated: #f6efe4`, `--bg-card: #ffffff`,
  `--surface: #efe5d6`, `--text: #2a211a`, `--text-secondary: #5c4f45`
- `--brand: #c2683f` (terracotta), `--brand-deep: #9c4f2c`,
  `--brand-dark: #a5552f`, `--brand-light: #d98a63` — contrast-checked against
  `#fdfaf5` (body text uses `--brand-deep`, which clears 4.5:1; the lighter
  shades are for fills and borders only)
- `--font-display: 'Fraunces'` (warm serif), `--font-body: 'Inter'`
- `--radius: 14px`, `--radius-lg: 22px` — generous and soft
- `--duration: 0.45s` with a gentle ease; hover lifts 2px, no aggressive scaling
- Signature texture: a soft paper grain wash instead of a grid overlay
- Home order: **Hero (full-bleed product photo) → Today's Bakes → Story → Order
  → Visit Us (map + hours) → Testimonials → CTA**
- Content-as-data: `src/data/bakes/` — each item `{slug, name, price, tags[],
  description, image}`, missing photos render labeled placeholder slots
- Modules: preorder form (multi-step), no admin dashboard

**Identical to the reference:** token architecture, theming mechanism, pre-paint
script, CSS-in-JSX with prefixes, content-as-data with placeholders, one icon
source, global reveal observer, focus-visible, reduced-motion, build stamp,
smoke-tested build sequence.

**Shared with the reference visually:** nothing.

That's the bar. Now create the skill.
