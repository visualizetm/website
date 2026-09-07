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

`scripts/site-regression.mjs` result (last run): 6/6 steps pass.

## Keyboard walk

A separate, narrower check: every interactive region on the marketing site
is operable by keyboard alone, no mouse.

| Area | Expect |
|---|---|
| Navbar, desktop | Tab reaches the logo, every nav link, the theme toggle, and Book a Consultation, in order; focus is always visible. |
| Navbar, mobile drawer | The hamburger is reachable and opens the drawer with Enter; while closed, the drawer's own links are not in the Tab order (they used to be, off-screen but still focusable, fixed in Site Prompt 5, Part 4); once open, Tab reaches the close button and every drawer link, and Escape or the close button closes it. |
| Home, logo strip | Each logo is a real link, reachable and activatable by keyboard, same as any other link on the page. |
| Home, testimonial carousel | On mobile widths the dot row is reachable by Tab, each dot activatable with Enter or Space, scrolling the matching card into view. |
| Contact form | Tab order reaches every link and the Calendly embed in document order; the embed itself is a third-party iframe and keeps its own internal tab behavior. |
| Start form | Begin Form is reachable and activatable with Enter; every step's fields are reachable in visual order; Continue and Back both work from the keyboard. |
| Prints checkout | Every product's Customize button is reachable and opens its modal with Enter; the modal's own fields are reachable; the close button dismisses it with Enter. |

Result (last run, scripted through Playwright's keyboard API rather than a
human pass): every row above passes. One gap noted, not fixed: the Prints
customize modal does not trap focus, Tab can move from the modal back to
page content behind the overlay instead of cycling within it. This
predates Site Prompt 5 (that prompt only restyled Prints, per its own
explicit instruction to keep the shop and checkout working exactly as is)
and a proper focus trap is more than a restyle; left for a prompt that
touches Prints' own interaction logic.
