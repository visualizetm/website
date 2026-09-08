# Site QA checklist: the CRM-to-site walk

The manual regression walk for one question: does what Rob does in the
CRM actually show up on the public site, and how fast. `node scripts/
site-regression.mjs` runs the same walk against a mocked /api/showcase in
Playwright (the numbers match the steps below); there is no live database
in that run, so each step flips the mocked client's fields in place and
reloads the page, exactly what a real publish looks like from the site's
side, since the marketing site always fetches fresh on a real page load.

Before the walk: a fresh build deployed, a test lead in the CRM not yet
published to the showcase.

| # | Do | Expect |
|---|---|---|
| 1 | In the CRM, open the test lead's Showcase tab, leave Published off | The lead does not appear on /clients. |
| 2 | Toggle Published on, save | Reload /clients: the client's card appears within 60 seconds (fetchShowcase()'s cache TTL for a tab that was already open; a fresh visit sees it at once). |
| 3 | Toggle the Logo strip and Work feature flags on, save | Reload Home: the client's logo appears in the logo strip and its card appears under Recent clients. |
| 4 | Log a testimonial for the client, mark it published and featured | Reload Home and /clients: the testimonial appears in both places, quote, author, and the business name linking back to the client. |
| 5 | Toggle Published off | Reload /clients: the client's card is gone. |
| 6 | In src/shared/pricing.js, change a package's price | Reload /services and Home: the new price shows on both, read live, never retyped. |
| 7 | Open the site header and footer at a phone width and a desktop width | Three links and one Book a free call, nothing else: no Services entry and no Shop. |
| 8 | Visit /prints | It lands on Home. The shop is gone from the public site; hand-entered print orders in the CRM are untouched. |
| 9 | Open /contact | Three cards (book, email, Instagram), no form and no embedded Calendly. |
| 10 | Open the client's Showcase editor (/clients/:id/showcase), change a field, use Discard, change it again, Save, then Publish | Nothing writes until Save (one PATCH per save), Discard restores the saved state, and the published cover then shows on /clients and in Home's hero deck. |
| 11 | In the Showcase editor, use Upload on an image field and pick a file | The button goes busy, the returned Cloudinary URL lands in the field, and the preview appears in the box the public page will use. Needs the VITE_CLOUDINARY_* pair in the build; without it there is no Upload button and the paste path is the only path. |

| 12 | Open /review/<slug> for that client, fill it in, pick five stars, send | The line reads "Thanks for working with me on <name>", the business field is filled and read only, and after sending the form is replaced by "Thanks. That means a lot." with a Leave one on Google too button (four or five stars and a Google link on file). The review lands in the admin's Reviews screen under Form submissions, carrying the slug, so Link to client is one tap. |

`scripts/site-regression.mjs` result (last run): 12/12 steps pass. Step 11
reports "skipped" against a build with no VITE_CLOUDINARY_* configuration,
since no Upload button renders there.

## Keyboard walk

A separate, narrower check: every interactive region on the marketing site
is operable by keyboard alone, no mouse.

| Area | Expect |
|---|---|
| Navbar, desktop | Tab reaches the logo, the three nav links (Home, Clients, Contact), the theme toggle, and Book a free call, in order; focus is always visible. |
| Navbar, mobile drawer | The hamburger is reachable and opens the drawer with Enter; while closed, the drawer's own links are not in the Tab order (they used to be, off-screen but still focusable, fixed in Site Prompt 5, Part 4); once open, Tab reaches the close button and every drawer link, and Escape or the close button closes it. |
| Home, logo strip | Each logo is a real link, reachable and activatable by keyboard, same as any other link on the page. |
| Home, testimonial carousel | On mobile widths the dot row is reachable by Tab, each dot activatable with Enter or Space, scrolling the matching card into view. |
| Home, business type track | Tab reaches all six cards' Book a free call links in order, and each one brings its card into view: on a desktop the row is held still and moved sideways by scroll position, so focus has to move the page to the point where that card is on screen (Site Prompt 6). |
| Contact, three cards | Tab reaches Book a free call, the Email card's address link, the Copy button, and DM on Instagram, in that order; Copy announces itself through a live region and does not follow the mailto. |
| Start form | Begin Form is reachable and activatable with Enter; every step's fields are reachable in visual order; Continue and Back both work from the keyboard. |

Result (last run, scripted through Playwright's keyboard API rather than a
human pass): every row above passes. The print shop row was removed with
the shop itself in Site Prompt 6, and with it the one open gap this
checklist carried (its customize modal never trapped focus).
