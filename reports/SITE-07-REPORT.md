# SITE PROMPT 7: HERO COVER STACK, INSTAGRAM SHOWCASE, SHOWCASE EDITOR PAGE, IMAGE FIT, DARK ONLY

Five changes, six commits, all built and verified in this session.

## 1. What changed, per part

**Part 1, the hero cover stack.** Scrolling the hero flips through every
published client's cover, up to eight, each a full width banner linking to
that client with its name and type in the corner. The source is
`landing.work` when the CRM has featured work, otherwise the newest
published clients.

The whole animation is one number. `Pin` scrubs `--pin-p` across the hold,
and each card derives two values from it in CSS off its own index:

    --u = --pin-p * count - index     where the card is in its turn
    --t = clamp(0, --u, 1)            how far it has left
    --r = clamp(0, --u + 1, 1)        how far it has risen into place

A card sits in place while `--r` is 1 and `--t` is 0, rises as the card
before it leaves (its `--r` is the previous card's `--t`), and leaves by
sliding up while scaling to 0.96 and fading out. No React render happens
while any of that runs. `z-index` descends with the index and never
changes, so the card leaving is always painted above the one arriving and
the two cannot cross wrongly. The last card never leaves: it is what the
next section's Curtain arrives over.

The section pins for count times 0.8 viewports. A dot row underneath marks
position; each dot is a 44px tab that scrolls to the point where its card
is exactly in place. Without the engine, under reduced motion, or with one
cover, it is the first cover shown plainly with the rest as a horizontal
row beneath it. With no published clients it is the designed default
graphic and no dots.

**Part 2, the Instagram showcase.** A client can show the account their
customers actually look at: a profile image, the handle, and up to nine
posts. The public detail page grew an Instagram section after Website,
hidden unless the client turned it on and there is something to show.

**Part 3, the Showcase editor page.** `/clients/:id/showcase`, reached
from a Showcase button in the client record's header (carrying the Draft
or Published pill) and from the command bar as "Showcase: <client>". It
holds a draft; one Save writes the whole showcase and testimonials in a
single PATCH; publish is part of the draft, so toggling it changes nothing
public until Save. A save bar rises when the draft differs from what is
live, Discard restores behind a confirm, leaving with unsaved work asks
first, `beforeunload` covers closing the tab, and Cmd+S or Ctrl+S saves.

**Part 4, image fit.** `.img-fit` is now the only way an image renders,
on the public site and in the admin's previews, and `layout-audit.mjs`
checks it rather than trusting it.

**Part 5, dark only.** The theme toggle, the light palette, the pre-paint
theme decision for the public host, and the light/dark logo pair are all
gone from the marketing side. The admin keeps its own picker untouched.

## 2. Files created, changed, deleted

**Created**

| File | What |
|---|---|
| `src/pages/AdminShowcase.jsx` | The Showcase editor page, its draft and its save bar |
| `public/showcase/fixtures/{wide,portrait,pano,square,logo}.svg` | Local fixture images in four shapes, so cover cropping is actually exercised |
| `reports/SITE-07-REPORT.md` | This file |

**Deleted**

| File | Why |
|---|---|
| `src/components/ThemeToggle.jsx` | The public site is dark only |
| `src/marketing/useTheme.js` | Nothing picks a theme-correct asset any more |
| `ShowcaseSection` and nine helpers in `src/components/ClientWorkspace.jsx` | Moved to the new page; grep for it is clean |

**Changed**

`src/components/Hero.jsx` (rebuilt), `src/pages/Home.jsx`,
`src/components/Trust.jsx`, `src/pages/CaseStudy.jsx`,
`src/pages/Clients.jsx`, `src/marketing/showcase.jsx`,
`src/components/Navbar.jsx`, `src/components/LeadDetail.jsx`,
`src/components/ClientWorkspace.jsx`, `src/pages/AdminApp.jsx`,
`src/pages/AdminLanding.jsx`, `src/shell/AppShell.jsx`,
`src/shell/CommandBar.jsx`, `src/shell/search.js`,
`src/shell/appearance.js`, `src/ui/Avatar.jsx`, `src/ui/lead.styles.js`,
`src/index.css`, `index.html`, `vercel.json` (the pinned CSP hash),
`api/showcase.js`, `api/_routes/call-leads.js`,
`scripts/audit-fixtures.mjs`, `scripts/layout-audit.mjs`,
`scripts/a11y-audit.mjs`, `scripts/css-orphans.mjs`,
`scripts/site-regression.mjs`, `scripts/showcase-endpoint-test.mjs`.

## 3. Schema additions and the endpoint diff

**Stored (`call_leads.showcase`, additive, sanitized in
`api/_routes/call-leads.js`)**

    showcase.logoUrl                      one logo, replacing the pair
    showcase.instagram.enabled            bool
    showcase.instagram.handle             stored without the @
    showcase.instagram.url                defaults from socials.instagram
    showcase.instagram.profileImage       image link
    showcase.instagram.posts[]            { link, image, caption }, max 9
    showcase.instagram.notes              max 600

`showcase.brand.logo` still accepts the old `{ light, dark }` shape on
write for one release, so nothing already stored has to be migrated.

**Served (`api/showcase.js`)**

| Field | Before | After |
|---|---|---|
| `brand.logo` | `{ light, dark }` | one string: `logo.dark`, then `logo.light`, then `showcase.logoUrl` |
| `instagram` | absent | `{ enabled, handle, url, profileImage, posts, notes }` |
| `landing.logoStrip[].logo` | dark, then light | dark, then light, then `logoUrl` |

The migration works without a migration: existing records serve their
stored dark (or light) logo, and the first save from the new editor writes
`logoUrl` and blanks the pair, which is what lets the new value win. The
whitelist test asserts the new key list, that `brand.logo` is a string,
that the `@` is stripped from the handle, and that a tenth post is
dropped.

## 4. The image overlap audit

The rule is checked in three parts: every `<img>` sits inside an
`.img-fit` box (which clips, so it can never visually spill), the image
stays inside that box's rectangle unless something between the two is
transformed (the parallax drift and the settle from 1.08, both doing their
job inside a box that clips them), and no two boxes overlap. Deliberate
stacks are exempt from the last: the hero deck's cards and the marquee's
duplicated loop overlap by design.

The fixtures now include a portrait (900x1600) and a panoramic (2400x600)
image, and two extra published clients that use them as covers, so every
run crops a tall and a wide image in boxes built for neither.

| Page | 320 | 390 | 768 | 1280 |
|---|---|---|---|---|
| Home (full CRM) | clean | clean | clean | clean |
| Home (empty landing) | clean | clean | clean | clean |
| Clients (list) | clean | clean | clean | clean |
| Client detail, full showcase | clean | clean | clean | clean |
| Client detail, brand only | clean | clean | clean | clean |
| Contact, Start, Services | clean | clean | clean | clean |
| Showcase editor, every section populated | clean | clean | clean | clean |
| Showcase editor, portrait and panoramic uploads | clean | clean | clean | clean |
| Showcase editor, draft and brand only | clean | clean | clean | clean |
| Landing screen (admin) | clean | clean | clean | clean |

**What it caught.** Three real findings, all fixed:

1. The parallax and scale-in layers read as spills, because their
   rectangles legitimately exceed the frame that clips them. That is what
   sent the rule from "the image must fit" to "the box must clip, and
   boxes must not overlap", which is the honest statement of it.
2. The admin's Landing screen drew its showcase thumbnails as bare
   40px images with `object-fit` on the `<img>` itself. An admin preview
   of a showcase image is still a showcase image; it sits in a box now.
3. The kit's `Avatar` did the same, so every avatar in the admin was an
   exception to a rule with no exceptions. Also boxed.

## 5. Lighthouse, Home, before and after

Dark theme, against the fixture-backed mock server, Google fonts blocked.
"Before" is a build of commit `8661504`, the last commit before this
prompt, in a worktree.

| Preset | Performance | Accessibility | Best practices | FCP | LCP | CLS | Transfer |
|---|---|---|---|---|---|---|---|
| Mobile, before | 97 | 100 | 100 | 1.8 s | 2.1 s | 0 | 248 KB |
| Mobile, after | 93 | 100 | 100 | 1.7 s | 3.0 s | 0 | 221 KB |
| Desktop, before | 99 | 100 | 100 | 0.4 s | 0.8 s | 0 | 248 KB |
| Desktop, after | 99 | 100 | 100 | 0.4 s | 0.7 s | 0 | 220 KB |

Home stays well above the 85 floor. The mobile drop is LCP: the hero's
largest element is now a client's cover in a full width banner rather than
a smaller inset image, so there is simply more pixel to paint. Transfer
went down, not up, because the deck's later covers are lazy.

**The CLS this prompt introduced, and removed.** The first measurement
after the deck landed was 0.089 on mobile, from three separate causes,
each fixed:

1. The hero swapped from its loading layout to the pinned deck when the
   CRM answered. Both now hold the same viewport-tall frame, so the swap
   moves nothing.
2. The fallback row of extra covers appeared and then vanished when the
   deck took over. Home now passes `null` while the fetch is in flight, so
   that row never renders before the answer.
3. `Curtain` applied its `margin-top: -16vh` only once the engine loaded,
   which moved everything below it. The margin and the transform that
   cancels it now both live on the base class, so the engine's arrival is
   a transform change and nothing else. This one predates this prompt; the
   deck's height just moved the curtain into the window where it counted.

## 6. Audit results

| Check | Result |
|---|---|
| `npm run build` | Clean, no warnings |
| gsap and lenis in any admin chunk | None. Both stay in their own chunks, referenced only by the marketing-only `ScrollRoot` chunk |
| `layout-audit.mjs`, marketing, 320 / 390 / 430 / 768 / 1280 | All routes clean at every width, zero offenders |
| `layout-audit.mjs`, every block including the admin | One finding, 51 times: the sidebar's brand mark was the last unboxed image on the site. Boxed, and the dashboard and studio blocks re-run clean at 768 and 1280 |
| `a11y-audit.mjs`, marketing (dark only now), 390 and 1280 | 22 rows, 0 violations at every impact |
| Same, reduced motion | 22 rows, 0 violations |
| `a11y-audit.mjs`, admin, dark | 96 rows, 0 violations at every impact |
| `a11y-audit.mjs`, admin, light | 74 rows, one rule: `color-contrast` on `.wordmark`, 2 nodes. Fixed and re-verified directly with axe (0 violations) |
| `css-orphans.mjs` | 0 orphans across 981 classes in 161 files |
| `showcase-endpoint-test.mjs` | All pass, including the new instagram and single-logo assertions |
| `site-regression.mjs` | 10 steps, 0 failures, including the new Showcase editor walk |
| `regression.mjs` (admin) | 64 steps, 0 failures, re-run after the shell and kit changes |

**The Showcase editor walk**, added to `site-regression.mjs` as step 10:
open the editor for the fixture client, turn Publish on, see the save bar
appear and confirm nothing has been written to the server yet, Discard and
see the bar clear, edit again, Save and confirm exactly one PATCH carrying
both the showcase and the testimonials, then follow the same client to
`/clients` (it is in the list) and to Home (its cover is in the hero
deck).

**The one regression the audits caught, and what it was.** Deleting the
marketing light theme left `.wordmark` with `color: var(--text)`, which no
longer flips. That component is also used inside the admin, whose light
theme is still real, so the admin's login card went from a dark wordmark
to a near-white one on cream: 1.12:1, and axe called it serious. The
wordmark inherits its colour now, which is what it should always have
done, since it is a shape that belongs to whatever is behind it.

**Keyboard walk.**

| Area | Result |
|---|---|
| Hero deck dots | Three 44x44 tabs, each labelled "<client>, n of 3", `aria-selected` on the one in place; Enter scrolls to that card's position and the active dot follows |
| Save bar | Discard then Save changes, both reachable by Tab, Enter on Save saves and the bar sinks; the bar is `aria-hidden` while there is nothing to save |

## 7. Hex and function counts

| Count | Before | After |
|---|---|---|
| Raw hex literals (`hex-count.js`) | 90 | **80** |
| Vercel functions | 9 | **9** |

The ten that went are the light theme's palette. No new hex was added: the
fixture SVGs live in `public/`, which the counter does not scan, and every
new rule reads an existing variable.

## 8. Deferred, with reasons

| Deferred | Why |
|---|---|
| Migrating stored `brand.logo` pairs to `logoUrl` | The endpoint reads through both, and the editor writes the new field and blanks the pair on its first save, so records migrate themselves as they are touched. A migration script would be a one-off write against production for no behaviour change. |
| Instagram posts pulled from the Instagram API | The block stores links and images the same way every other showcase section does. Pulling live posts means an API app review, a long-lived token and a refresh job, which is a prompt of its own, not a field on this one. |
| `--brand-text` collapsing into `--brand-light` | The site is dark only, so they now have the same value, but the variable says why the value was chosen. Deleting it would leave call sites reading `--brand-light` and no record that the reason was contrast. |
| A light-theme pass on the marketing audits | Removed, not deferred: it would audit a theme the public host can no longer render. `AUDIT_THEME=light` still runs, and still means something, for the admin. |
| Fixture images in this sandbox | The audits used to point at `picsum.photos`, which this sandbox's egress proxy blocks, so every screenshot showed broken-image boxes. They are local SVGs now, which is why the image work in this prompt could be seen rather than inferred. |

## 9. Commits

| Hash | Part |
|---|---|
| `7e8c5c0` | Part 1: the hero is a deck of every showcased cover |
| `9b1e0f0` | Part 2: a client can showcase their Instagram |
| `0f61959` | Part 3: the Showcase editor is its own page, with a Save |
| `25671b6` | Part 4: every image in a box, and an audit that proves it |
| `ff316ab` | Part 5: the public site is dark only |
| `60ebf89` | Part 6: the verification pass and what it found |

The report sits in the commit on top of `60ebf89`. Everything is pushed to
`origin/main`.

