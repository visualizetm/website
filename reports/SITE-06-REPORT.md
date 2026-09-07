# SITE REVAMP: ADVANCED SCROLL, BUSINESS TYPE SHOWCASE, SIMPLER NAV AND CONTACT

Site Prompt 6. Six parts, six commits, everything built and verified in
this session.

## 1. What changed, per page

**Home (`/`).** Rebuilt around one idea: what Rob does for each kind of
local business. Eight sections now, and not a single price anywhere on
the page.

The hero pins for an extra one and a half viewports. Its headline
reveals word by word, then fades up and out while the cover grows to fill
the screen. The logo strip and the business type track arrive together as
a curtain over it. Six cards, one per kind of business, each with what
that business usually needs and the one line on what Rob does about it;
on a desktop the row is held still and moves sideways as you scroll, on a
phone it is the same six cards stacked. Then the platform section (a
short paragraph and five text pills, no logos), recent clients arriving
as a second curtain with parallax covers, the testimonials, three steps
that each hold briefly while their number counts in, and the closing call
to action. The stats row and the numbered services sections are gone,
along with both component files.

**Clients (`/clients`), client detail (`/clients/:slug`).** Unchanged in
content. Covers now settle into place instead of appearing, and each page
has exactly one tone shift: the reviews on the list, the testimonials on
a detail page.

**Contact (`/contact`, `/book`).** Rebuilt as one calm screen. A heading,
one line, three card-sized targets: book a free call (opens Calendly, the
primary), email (address shown, with a Copy button), and DM on Instagram.
The contact form and the inline Calendly embed are both gone. The portal
notice for `?from=portal` stays.

**Services (`/services`).** Still reachable at its URL, no longer linked
from the header or the footer, so it gained a Back to home link at the
top. Its closing button is now the same free call every other page ends
on, and it carries the page's one tone shift.

**Start (`/start`).** Untouched, as instructed. It is the one page with no
tone shift, deliberately: it is one form step at a time with no scroll to
drive one.

**Prints (`/prints`).** Deleted.

**Header and footer.** Three links (Home, Clients, Contact) and one
button, Book a free call, going straight to Calendly. The mobile drawer
matches. The footer keeps one Navigation column with the same three links
and a Ready to start column with the call, the Instagram handle and the
email; the Products column went with the shop.

## 2. Files created, changed, deleted

**Created**

| File | What |
|---|---|
| `src/marketing/scroll.js` | The scroll engine loader: gsap, ScrollTrigger and Lenis behind three gates |
| `src/marketing/ScrollRoot.jsx` | Mounts the engine, refreshes it on route change, renders nothing |
| `src/marketing/links.js` | The Calendly URL, the email address and the Instagram handle, written once |
| `src/marketing/motion/useScroll.js` | `useScrollEngine`, `useScrollProgress`, `useScrollRefresh` |
| `src/marketing/motion/Pin.jsx` | Sticky hold with scrubbed progress |
| `src/marketing/motion/Curtain.jsx` | A section arriving over the one before it |
| `src/marketing/motion/ScaleIn.jsx` | A cover settling into place, once |
| `src/marketing/motion/WordReveal.jsx` | A headline revealing word by word |
| `src/marketing/motion/TrackScroll.jsx` | A row moving sideways while held |
| `src/marketing/motion/Tone.jsx` | A section's ground crossfading as it arrives |
| `src/components/BusinessTypes.jsx` | The six business type cards |
| `src/components/Platforms.jsx` | Built on whatever you will actually use |
| `src/components/InstagramGlyph.jsx` | Moved out of Footer.jsx now that two pages draw it |
| `reports/SITE-06-REPORT.md` | This file |

**Deleted**

| File | Why |
|---|---|
| `src/pages/Prints.jsx` | The print shop, removed |
| `src/components/StatsRow.jsx` | Off Home, nothing else imported it |
| `src/components/ServicesSections.jsx` | Off Home, nothing else imported it |

**Changed**

`src/pages/Home.jsx` (rebuilt), `src/components/Hero.jsx` (rebuilt),
`src/components/HowItWorks.jsx` (rebuilt), `src/components/CTA.jsx`,
`src/components/Trust.jsx`, `src/components/RecentClients.jsx`,
`src/components/HomeTestimonials.jsx`, `src/components/Navbar.jsx`,
`src/components/Footer.jsx`, `src/pages/Contact.jsx` (rebuilt),
`src/pages/Clients.jsx`, `src/pages/CaseStudy.jsx`,
`src/pages/Services.jsx`, `src/marketing/showcase.jsx`,
`src/marketing/motion/index.js`, `src/App.jsx`, `src/index.css`,
`vite.config.js`, `vercel.json`, `package.json` (gsap, lenis),
`scripts/site-regression.mjs`, `scripts/layout-audit.mjs`,
`scripts/lighthouse.mjs`, `scripts/audit-screens.mjs`,
`scripts/css-orphans.mjs`, `scripts/build-sitemap.mjs`,
`docs/MARKETING-MOTION.md`, `docs/ARCHITECTURE.md`, `docs/RUNBOOK.md`,
`docs/SITE-QA-CHECKLIST.md`, `CLAUDE.md`.

**The shop removal, in full.** `src/pages/Prints.jsx` deleted with all of
its own styles (they lived in the file). Its route, its standalone layout
branch in `src/App.jsx`, its sitemap entry, its Lighthouse target, its
audit screen, its CSS ownership entry, and the whole shop checkout walk
in the layout audit are all gone. `vercel.json` gained two permanent
redirects:

```json
{ "source": "/prints",        "destination": "/", "permanent": true },
{ "source": "/prints/:path*", "destination": "/", "permanent": true }
```

`src/App.jsx` keeps a client-side `Navigate` for the same two paths, for a
link followed inside an already-loaded session, where the server never
sees the request. `api/submissions.js`, `api/_lib/orders.js` and the
admin's Print Orders screen were not touched: orders entered by hand keep
working exactly as they did, and the shop-order submission parser stays
for the submissions already in the database.

## 3. The scroll engine

`src/marketing/scroll.js` is the only module that touches gsap or Lenis,
and it does so through `import()`, so both land in chunks of their own
(`gsap`, `lenis`, pinned by `manualChunks` in `vite.config.js`). Three
gates decide what is fetched at all:

| Condition | gsap + ScrollTrigger | Lenis |
|---|---|---|
| Admin host | no | no |
| `prefers-reduced-motion: reduce` | no | no |
| Touch / coarse pointer | yes | no |
| Marketing host, fine pointer, motion allowed | yes | yes |

Scroll-driven animation is fine on a phone; hijacking a phone's native
scrolling is not.

**API**

| Export | Does |
|---|---|
| `scrollEngineAllowed()` | Synchronous yes/no on the gates above, so a helper can decide its first frame |
| `loadScrollEngine()` | Resolves to `{ gsap, ScrollTrigger, lenis }` or `null`; loads once per session |
| `getScrollEngine()` | The engine if already loaded, else `null` |
| `refreshScrollTriggers()` | Re-measures every pinned and scrubbed trigger |
| `destroyScrollEngine()` | Kills every trigger, stops Lenis |
| `useScrollEngine()` | `'off' | 'loading' | 'on'` for a component |
| `useScrollProgress(ref, opts)` | Scrubs 0 to 1 into a CSS custom property; no React renders while scrolling |
| `useScrollRefresh(dep)` | Re-measures a frame after `dep` changes (Home passes its showcase payload) |
| `Pin` | Sticky hold for N extra viewports, scrubbing `--pin-p` |
| `Curtain` | Slides up over its previous sibling, which scales to 0.96 and dims |
| `ScaleIn` | One-shot settle from 1.08 and a 4px blur, on first viewport entry |
| `WordReveal` | Word by word, scrubbed below the fold, played once above it |
| `TrackScroll` | Sideways row while held, vertical stack everywhere else |
| `Tone` | Section ground crossfading between two theme variables |

Every helper treats "no engine" as a design state rather than an edge
case: the base CSS class is the final resting look, and the modifier the
helper adds once the engine is live is what turns the motion on. Nothing
is ever left hidden behind a script that did not arrive. Every animated
property is a transform or an opacity, with one deliberate exception
noted in the stylesheet: ScaleIn's 4px blur, which is compositor work and
never layout, and is what makes a cover read as coming into focus rather
than merely growing.

**Heavy set versus light set**

| Page | Set |
|---|---|
| Home | Heavy. Pinned hero, two Curtains, WordReveal headings, the business type TrackScroll, three short Pins on How it works, two Tone shifts |
| Clients | Light. Reveal, Stagger, ScaleIn covers, one Tone |
| Client detail | Light. Reveal, Stagger, Parallax and ScaleIn on the cover, one Tone |
| Contact | Light. Reveal, one WordReveal heading, one Tone |
| Start | Light. Reveal only, no Tone |
| Services | Light. Reveal, Stagger, SectionNumber, one Tone |
| Lead partner | Light. Unchanged from before this prompt |

Lenis stays on everywhere on the marketing host. It is the feel of the
scroll itself, not an effect.

## 4. The final Home copy, in one block

```
Branding and websites for local businesses.
Delaware based. Brand, website, print. The first call is free.
[Book a free call]  [See client work]

Trusted by local businesses

What I do for your kind of business
Every business needs something different. Here is what that usually looks like.

  Restaurants and cafes
    Menus that read on a phone
    Online ordering and pickup
    Hours and location front and center
    Menu design, ordering that fits your POS, a site people can use while hungry.
    Book a free call

  Shops and products
    A storefront that sells
    Product photos that look real
    Shipping and pickup that just work
    Shopify builds and theme customization, product pages, launch graphics.
    Book a free call

  Service businesses
    Plumbers, cleaners, movers, landscapers
    Quote requests and service areas
    Reviews where people look
    A site that turns a search into a call, Google Business set up right,
    a logo that fits the truck.
    Book a free call

  Beauty and barbers
    Booking that actually books
    Instagram that matches the chair
    A look clients recognize
    Booking site, social templates, cards and decals for the shop.
    Book a free call

  Auto and detailing
    Before and afters that sell the work
    Packages that are easy to compare
    Mobile friendly quotes
    Brand, gallery site, vehicle decals, quote forms.
    Book a free call

  Creators and apparel
    Drops people show up for
    Merch that ships
    A brand people want to wear
    Logo and identity, Shopify store, product mockups, launch content.
    Book a free call

Built on whatever you will actually use.
Some businesses live on Shopify. Restaurants lean on Wix or Squarespace. Some
need a custom coded site. I work in all of them, and I make sure it does not
look like a template.
  Shopify   Wix   Squarespace   Custom code   Google Business
Not sure which? That is what the first call is for.

Recent clients                                              [All clients]

What clients say

How it works
  01  A free call
      Twenty minutes to talk through what you need. No pitch, no pressure.
  02  A plan
      You get a clear scope and timeline before anything starts.
  03  Launch
      I design and build it, you review, we ship. You own everything.

Visualize.
Your vision, our creation.
[Book a free call]
contact@visualizeclients.com     @visualizetm
```

## 5. Lighthouse, before and after

Dark theme, against the fixture-backed mock server, fonts from Google
blocked so the sandbox's dead font requests cannot skew the timing.
"Before" is a build of commit `0daf350`, the last commit before this
prompt, in a worktree.

| Page | Preset | Performance before | after | Accessibility | Best practices | LCP before | after | Transfer before | after |
|---|---|---|---|---|---|---|---|---|---|
| Home | mobile | 93 | 92 | 100 | 96 | 3.0 s | 3.0 s | 174 KB | 221 KB |
| Home | desktop | 99 | 99 | 100 | 96 | 0.7 s | 0.7 s | 174 KB | 221 KB |
| Contact | mobile | 99 | 97 | 100 | 96 to 100 | 1.8 s | 2.1 s | 153 KB | 200 KB |
| Contact | desktop | 99 | 99 | 100 | 96 to 100 | 0.4 s | 0.5 s | 153 KB | 200 KB |

Home stays well above the 85 floor the prompt set, on the preset it set.
The 47 KB is gsap, ScrollTrigger and Lenis, and it is deferred: it is
fetched after first paint and never on the admin host. Contact's best
practices score went up because removing the Calendly embed removed a
third party script and its console noise.

## 6. Audits, reduced motion on and off

| Check | Result |
|---|---|
| `npm run build` | Clean. The one long-standing warning (Footer statically imported by Prints) is gone with the shop |
| gsap and lenis in any admin chunk | None. Both are separate chunks referenced only by `ScrollRoot`, which is a marketing-only lazy chunk; the shared entry carries neither the libraries nor the loader |
| `layout-audit.mjs`, marketing, 320 / 390 / 768 / 1280 | All routes clean at every width, zero offenders |
| Same, `AUDIT_MOTION=reduce` | Clean |
| Same, `AUDIT_THEME=light` | Clean |
| `a11y-audit.mjs`, marketing, dark, 390 and 1280 | 22 rows, 0 violations at every impact |
| Same, light theme | 22 rows, 0 violations |
| Same, reduced motion | 22 rows, 0 violations |
| `css-orphans.mjs` | 0 orphans across 966 classes in 161 files |
| `site-regression.mjs` | 9 steps, 0 failures |
| `regression.mjs` (admin, to prove the CRM is untouched) | 64 steps, 0 failures |
| `feel-audit.mjs` | Started, not completed here (see below) |
| `dates-test.mjs` (`TZ=America/New_York`) | All date cases pass |

**The one script that did not finish.** `feel-audit.mjs` walks the admin's
screens and deliberately skips every `marketing: true` row, so it covers
exactly the half of the app this prompt did not touch. Two runs were
started, one across both themes and both motion settings and one plain,
and neither got through its screen list inside this session's practical
run time; the rows it did reach were pass rows plus
"GAP fit" rows, every one of them the skeleton-fit category (a skeleton
whose row count does not match the loaded screen's), never an entrance,
empty or error gap. Those are the admin's own pre-existing gaps, tracked
separately since the prompt that introduced the check. The admin's own
64-step `regression.mjs` did run to completion on this exact build, 0
failures, which is the stronger check that nothing here reached the CRM.

**Reduced motion.** Nothing loads: with `prefers-reduced-motion: reduce`
the page fetches neither gsap nor Lenis, verified by watching the network
in a reduced-motion context. Every helper renders its final state, the
hero does not pin, the track is a plain stack, and what is left is the
plain Reveal fades, which the sitewide reduced-motion rule collapses to
0.01ms anyway. Home is 7197px tall under reduced motion against 10970px
with motion, which is the pinned sections' extra scroll and nothing else.

**Keyboard walk.**

| Area | Result |
|---|---|
| Navbar, desktop | logo, Home, Clients, Contact, theme toggle, Book a free call, in order |
| Drawer, 390 | Closed, its links are not in the Tab order (`inert`); open, Tab reaches close, the three links, the button, then the email |
| Business type track | All six cards reachable, and each one now brings itself into view (see below) |
| Testimonial carousel, 390 | Three dots, each labelled "Testimonial n of 3", `role="tab"` with `aria-selected`, Enter moves the slide |
| Contact | Book a free call, the Email card's address link, Copy, DM on Instagram, in that order; Copy does not follow the mailto and announces through a live region |

## 7. Hex and function counts

| Count | Before | After |
|---|---|---|
| Raw hex literals (`hex-count.js`) | 108 | **90** |
| Vercel functions | 9 | **9** |

The hex count fell by 18, all of it the deleted print shop's own
hardcoded palette. No new hex was introduced: the two tokens this prompt
added (`--m-curtain-shadow`, light and dark) are `rgba`, and every other
new rule reads an existing variable.

Nothing was added to or removed from `api/`, so the function count is
unchanged and still under the Hobby plan's cap of 12.

## 8. Five things worth knowing, and what was deferred

**Four bugs this prompt found by loading the built page rather than
reasoning about it.**

1. A `WordReveal` heading already on screen at load had no scroll between
   its start and end positions, so a scrubbed reveal sat at progress 0
   and the headline never appeared at all. Above-fold headings now play
   once on their own clock; below-fold ones still scrub.
2. The waiting state's CSS transform was being read into gsap's own
   transform state and left baked into every word after the reveal
   finished, so the headline settled 63px below where it belonged. The
   waiting state is opacity alone now.
3. `TrackScroll` first used ScrollTrigger's own `pin: true`, which is
   `position: fixed`, and Home puts the track inside a `Curtain`, which
   carries a transform. A transformed ancestor becomes the containing
   block for fixed positioning, so the pinned track drifted out of the
   viewport. It holds itself with `position: sticky` now.
4. And then sticky did not engage either, because the section around it
   had `overflow: hidden`: sticky stops working inside any ancestor that
   clips. Found by the keyboard walk, not by looking at the page, where
   the difference is easy to miss. The clipping now happens one level in,
   on the track's own viewport, which uses `overflow: clip` so the
   browser cannot scroll it out of step with the scrubbed transform.

**One accessibility fix in the same family.** Tab moves focus through the
six cards in DOM order, but their position on screen is a function of how
far the page has scrolled, so the browser's own "scroll the focused
element into view" cannot reach a card still off to the right.
`TrackScroll` now moves the page to the point where the focused card is
visible. Without it the row was keyboard reachable but not keyboard
visible, which is worse than either.

**Deferred, with reasons.**

| Deferred | Why |
|---|---|
| A logo row on the platform section | Text pills instead. Those are other companies' marks, and a row of them reads as a badge wall rather than as the plain statement the section is making. Not a technical limitation, a choice; say the word and it becomes logos. |
| A tone shift on `/start` | It is one form step at a time with no scroll to drive one, and its own step transitions already carry the page. The prompt says at most one per page, so none is within the rule. |
| Tightening the CSP now that Contact no longer embeds Calendly | `/lead-partner` still embeds it, so the policy cannot narrow yet. Worth revisiting if that page ever changes. |
| Fixture images in this sandbox | The audit fixtures point at `picsum.photos`, which the sandbox's egress proxy blocks, so every screenshot in this session shows broken-image boxes where a cover would be. Layout, spacing and motion are all measured from the reserved boxes, which are correct; the images themselves could not be seen here. |
| Prerender and sitemap against production | Both post-build steps take their fail-soft path in this sandbox, which cannot reach the production endpoint (HTTP 403). They run normally on Vercel. |

## 9. Commits

| Hash | Part |
|---|---|
| `a0dc1cb` | Part 1: the scroll engine |
| `3632c6a` | Part 2: the landing page, rebuilt around business types |
| `24913b7` | Part 3: simpler header and footer, the shop removed |
| `b3d9c08` | Part 4: Contact is three cards and nothing else |
| `02218f5` | Part 5: the light set on every other page |
| `67b4a24` | Part 6: verification, the four fixes above, and the docs |


This report sits in the commit on top of `67b4a24` (naming its own hash
inside itself is a loop, so it does not try). Everything is pushed to
`origin/main`.
