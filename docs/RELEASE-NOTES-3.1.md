# Visualize 3.1.0: release notes

What changed on the public site and in the CRM, in plain language, and the
setup to do once before it's ready to show real clients. 3.1 is the five
site prompt arc that rebuilt the marketing site to be driven end to end by
the CRM: nothing about a client is typed into the website's code any more.

## What is new, page by page

**Clients** (was Work, `/work` and `/work/:slug` redirect permanently to
`/clients` and `/clients/:slug`). The list and every client's detail page
now read live from the CRM through the public `/api/showcase` endpoint:
brand identity, website, business cards, print and product, socials, and
testimonials, all pulled from what's filled in on that client's Showcase
tab. Publishing a client there is what puts them on the site; unpublishing
takes them off. A "What clients say" section under the list shows every
published testimonial across all clients. Empty and error states (no
clients yet, an unknown slug) both read cleanly instead of looking broken.

**Home.** Rebuilt from scratch: one idea per screen, a hero, a logo strip
of trusted clients (drawn from whichever clients have the logo-strip flag
on, in the order set on the Landing screen), three numbered services
sections with real client images where available, up to three recent
clients, a stats row (clients served, projects delivered, average rating,
years, each shown only when its toggle is on), client testimonials, how it
works, and a final call to book a meeting. Every one of those sections
hides itself cleanly when there's nothing to show yet, the hero never looks
broken even with zero published clients.

**Services.** Rebuilt to match Home's pattern: four numbered sections
(Brand, Website, Print and Product, Retainers), each with its real
packages, prices, and what's included, read live from the same pricing
file the CRM's own pricing builder uses, so a price only ever needs
changing in one place. The pricing rules (revision rounds, extra-round
fees, the payment-plan threshold, when files release) are stated plainly
in one block, and one Book a Meeting button closes the page.

**The Landing screen** (admin, Studio, new since Site Prompt 2, refined
here): choose which clients feature in the logo strip and the Recent
clients section on Home, set their order, choose which testimonials
feature, and toggle each of the four stats with an optional fixed override
if you'd rather not show the live number.

**Contact, Start, Prints.** Restyled to match the rest of the site (the
same motion, the same colors); Contact's booking widget no longer
overflows on the narrowest phones. Prints (the sticker and print shop) now
carries the site's own footer and checkout still works exactly as before,
nothing about placing an order changed.

**Search and sharing.** Every page now sets its own title, description, and
share-preview image; a link to a published client's page shows that
client's own name, blurb, and cover photo when shared, not the site's
default. Client pages are also prerendered at build time so a search
engine or a link preview sees the real content immediately, not just after
the page's JavaScript runs. A sitemap and robots.txt now exist for search
engines to find every page and every published client.

## First use setup, in order

1. **Publish your first clients.** Open a lead's client record, the
   Showcase tab, fill in whichever sections apply (Brand Identity,
   Website, Business Cards, Print and Product), and toggle Published on.
   The client appears on /clients right away.
2. **Add logos.** On the same tab, add the client's logo (a light and dark
   version if you have both); it's what shows in Home's logo strip and,
   picked by whichever theme the visitor is using, on the client's own
   page.
3. **Choose what's featured, on the Landing screen** (Studio, Landing):
   turn on the logo-strip flag for clients you want in Home's trusted-by
   row, the work flag for the ones you want as Home's Recent clients, set
   their order by dragging, and feature the testimonials you want to show
   there.
4. **Cloudinary (optional):** set VITE_CLOUDINARY_CLOUD_NAME and
   VITE_CLOUDINARY_UPLOAD_PRESET (see docs/RUNBOOK.md) to get an Upload
   button next to every showcase image field instead of pasting a link by
   hand.

Then the walk in docs/SITE-QA-CHECKLIST.md once, on a real client.

## Behind the scenes (for the next prompt)

Every marketing page is now covered by the same audit set the admin
already had: layout (44px targets, no page-level overflow), axe
accessibility in both themes, and Lighthouse, plus its own
`scripts/site-regression.mjs` walk (mock the showcase endpoint, flip
flags between steps, confirm the site reflects each change) alongside the
admin's own `scripts/regression.mjs`. `src/marketing/motion` is the shared
reveal-on-scroll, parallax, counter, and marquee primitive set every
marketing page now builds on; `src/marketing/useHead.js` is the one
per-page title/description/og:image helper; `src/marketing/useTheme.js` is
the one light/dark read. `--brand-text` (src/index.css) is the variable
any new brand-colored text should read, `--brand` itself falls short of
WCAG's 4.5:1 in every context measured so far. The release gate for the
site specifically is docs/RUNBOOK.md's Prerender section plus the scripts
above; the admin's own gate (docs/RUNBOOK.md's main Scripts list) is
unchanged.
