# PROMPT 15 REPORT: QA, ACCESSIBILITY, PERFORMANCE, AND RELEASE

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`, tagged
`v3.0.0`. Commits in order: e31a18d (API hardening, code split, error
boundaries, self hosted fonts, a11y kit fixes, the new audits), 8f76e63 (44px
targets, calendar grid roles, memoized lists, docs and release notes),
8340316 (skeleton fit, fewer hex literals), b845dd0 (no em dashes in
scripts), then the release commit with this report.

No new features. No schema changes; the only new documents are the settings
`login-limit` and `client-log` entries and the additive `processedAt` on
stripe_events. Endpoint changes are the Part 4 hardening plus the one new
admin route, /api/admin/log. Every change reads `var(--v-...)`; hex count
145 to 139; css orphans 0; no em dash anywhere in src, api, scripts, docs,
or public.

## 1. Accessibility audit: baseline and final

`scripts/a11y-audit.mjs` runs axe-core 4.10 (WCAG 2.0 and 2.1 A and AA plus
best practices) against every screen and state the layout audit knows
(`scripts/audit-screens.mjs`, shared with the feel audit and the regression
walk), loaded and in the forced loading state, both themes, at 390 and 1280.
Every audit context blocks the service worker so the route mocks answer.

### Baseline (build 0134191, 266 rows)

| Rule | Impact | Nodes | Rows | Where |
|---|---|---|---|---|
| aria-required-children | critical | 2 | 2 | the kanban board was `role="list"` with `section` children |
| color-contrast | serious | 283 | 136 | white on the brand red badge (4.27), the active tab bar label (4.38 dark, 3.63 light), dark text on the won solid pill in light (4.2), neutral pill text on a selected card (4.43), the More sheet's user line in light (2.75) |
| nested-interactive | serious | 228 | 42 | LeadCard was a `role="button"` div with a menu, a checkbox, a phone link, and four social links inside; ListRow rendered a `button` with a Menu or a Button in `trailing`; the Reviews card likewise |
| scrollable-region-focusable | serious | 26 | 22 | chip rows and scroll areas holding only skeletons, the client stepper, the design page contrast table |
| aria-prohibited-attr | serious | 20 | 6 | `aria-label` on plain spans (badge dots, the unread dot) |
| aria-dialog-name | serious | 10 | 10 | a Sheet whose title was a skeleton block had an empty `aria-labelledby` target |
| region | moderate | 1104 | 214 | the shell's content area was a div, so nothing on most screens sat in a landmark |
| landmark-one-main | moderate | 188 | 188 | no main landmark (or two, on screens that rendered their own) |
| landmark-unique | moderate | 38 | 38 | the top bar and the Sheet header were both `header` (two banners); unlabeled asides |
| landmark-no-duplicate-banner | moderate | 30 | 30 | the Sheet and Modal headers were `header` elements outside any sectioning root |
| empty-table-header | minor | 78 | 14 | the actions column header and the skeleton table headers |
| empty-heading | minor | 10 | 10 | the skeleton Sheet title inside an `h2` |

Baseline totals by impact (nodes): critical 2, serious 567, moderate 1360,
minor 88.

### Fixes

- Kanban board: `role="group"`; columns stay `section` with their label.
- Contrast, through tokens (`src/ui/tokens.js`, both tables in docs/TOKENS.md): the won solid is the pressed red `#c2413a` and carries the white label (5.11), the danger solid is `#ef4444` so the dark label passes (4.9), neutral text is `#a3a3a3` (5.0 on a selected card), the active tab bar label and the active sidebar item use `--v-red-highlight` (5.93 dark, 6.19 light), the Badge for the won tone sits on the pressed red, the More sheet's user line reads `--v-text-3`, and the danger button's hover label is `--v-text-inverse`.
- One real control per card or row (`.v-stretch`, the stretched open button, with `.v-above` for the controls that sit over it): LeadCard, ListRow, and the Reviews card. LeadCard's four 22px social links became presence indicators (the menu opens them, the detail has full buttons); the enrichment dot is a `role="img"`. The focus ring draws on the card through `:has()`.
- Badge and the unread dot are `role="img"` with their label.
- Sheet and Modal: a skeleton title renders outside the `h2` and the dialog falls back to `aria-label`; their header and footer are plain divs, so a dialog never adds a banner landmark.
- The shell's content area is the one `main`, screens render `div`s, the login page is a `main`, every aside is labeled (Leads, Booked leads, Clients, Order, Concept pack, Submission, Queue, Notes and history), the two contrast table regions are named per theme.
- The actions column header carries visually hidden text (`.v-sr-only`); every skeleton (Card, ListRow, StatCard, LeadCard, Table, RecordSkeleton, the detail and room skeletons) is `aria-busy` and `aria-hidden`; a scroller whose only child is busy stops scrolling; the client stepper and the contrast tables are focusable regions.
- ListRow forwards `aria-expanded`, `aria-haspopup`, and `aria-controls` to its open button (axe: aria-allowed-attr).

### Final (build TBD_BUILD, TBD_A11Y_ROWS rows, both themes, 390 and 1280, loaded and loading)

TBD_A11Y_TABLE

## 2. Keyboard, screen reader, touch, zoom, and text spacing

**Keyboard.** `scripts/keyboard-audit.mjs` tabs through every loaded state
(up to 40 stops) and checks that each stop draws a visible ring (the kit's
`--v-border-focus` outline, on the element or on a card through `:has()`),
has an accessible name, and sits in the viewport or in the open dialog, then
exercises the patterns by key. Final run: TBD_KB. Findings fixed on the way:
the kanban had no keyboard path to change a status (now Shift+ArrowLeft and
Shift+ArrowRight on a focused card step it one column, and the card menu
still lists every status); the stretched open button pattern gave every card
one focus stop instead of six; the calendar week day buttons had no ring.
Verified by the script: Tabs and SegmentedControl move with arrow keys, a
Sheet traps Tab and Escape closes it and returns focus to the opener, the
Menu opens on Enter and Escape returns focus, a Table row opens on Enter, the
command bar opens on slash, arrows move the active row, Escape closes it.

**Screen reader.** Every IconButton already required a label. Pills carry
their label as text; Badges are `role="img"` with "N new"; the enrichment
dot and the unread dot are images with a label; the socials row on a lead
card is one image ("Socials: Instagram, Website"). Status changes announce
through one polite region for toasts (the host stays mounted, empty or not,
and the toasts inside it no longer carry their own role) and one for the
connection state (the offline banner is always in the tree, visually hidden
when online, so going offline is announced). Skeletons are `aria-busy` on
the region and hidden from the tree. Stagger only animates opacity and
transform on wrapper divs, so nothing is ever hidden from assistive
technology. The Calendar month is a grid (weekday column headers, one row
per week, a gridcell per day with `aria-current="date"` on today); the week
is a grid with the hour gutter as the row header and a gridcell per day.
ProgressRing already exposed value, min, max, and label; the Dashboard's
ring is labeled "Calls today against target".

**Touch.** The layout audit now measures every interactive element (inputs
by their field shell, checkboxes and toggles by their row, stretched buttons
by their card) and fails anything under 44 by 44; text links inside prose
are the one exemption. Found and fixed: SegmentedControl options (36 and 30
tall, now 44 in both sizes), the priority and status pill buttons on the
detail (26), toast controls (32 and 36), the search clear buttons (28 and
32), the command bar clear (28), the call room header links (36), the lead
card phone link (28), the calendar week day buttons (24 wide), the calendar
strip and month cells on narrow phones (38 wide, now 44 with the strip,
week, and month scrolling sideways on the narrowest widths), calendar event
blocks (28 tall, the hour is now 88px so a 30 minute block is 44), the
import buttons and the CSV file input, the client stepper, the collapsed
block header button, the saved view icon buttons (32 wide), the design
page's demo Clear button. Final layout audit: TBD_LAYOUT_SUMMARY.

**Zoom and text spacing.** `AUDIT_ONLY=a11y` in the layout audit reproduces
200 percent browser zoom (a viewport of half the CSS pixels at twice the
device scale) on the Dashboard, Leads, and the call room at 390 and 1280,
and applies the WCAG 1.4.12 overrides (line height 1.5, letter spacing
0.12em, word spacing 0.16em, paragraph spacing 2em) at the normal zoom. Below
320 CSS pixels (a 390 phone at 200 percent is 195) WCAG allows a wide
document, so there only clipped or overlapping text fails. Result:
TBD_ZOOM. Reduce motion is covered by the layout and feel audits in both
motion states (section 9).

## 3. Lighthouse

Mobile preset, simulated throttling, Lighthouse 11.7 (the last major with a
PWA category), against `scripts/mock-server.mjs` serving the built site with
the fixture APIs over real HTTP, gzip, and immutable caching for /assets and
/fonts as Vercel does. The first baseline pass served the bundle
uncompressed, which is not what production does (Vercel compresses), so the
table below uses the compressed baseline; the uncompressed numbers were
Performance 57 to 60 with an 8 second LCP.

### Before (build 0134191)

| Screen | Theme | Performance | Accessibility | Best Practices | PWA | FCP | LCP | TBT | CLS | Transfer |
|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | dark | 85 | 94 | 100 | 100 | 2.4 s | 3.8 s | 70 ms | 0.001 | 319 KB |
| Leads | dark | 84 | 96 | 100 | 100 | 2.4 s | 3.8 s | 140 ms | 0.001 | 318 KB |
| Call room | dark | 77 | 96 | 100 | 100 | 2.4 s | 3.9 s | 340 ms | 0.002 | 321 KB |
| Dashboard | light | 85 | 94 | 100 | 100 | 2.4 s | 3.8 s | 90 ms | 0.001 | 319 KB |
| Leads | light | 85 | 96 | 100 | 100 | 2.4 s | 3.8 s | 90 ms | 0.001 | 318 KB |
| Call room | light | 83 | 96 | 100 | 100 | 2.4 s | 3.9 s | 160 ms | 0.002 | 321 KB |

Accessibility below 100 on every screen: color-contrast (the badge and the
tab bar) and label-content-name-mismatch (the old lead card's aria-label).

### After (build TBD_BUILD, the admin host headers including the CSP applied)

TBD_LH_AFTER

## 4. Bundle and chunks

| | Before (0134191) | After (TBD_BUILD) |
|---|---|---|
| Entry JS on the admin | index 1,120.9 KB (302.3 KB gzip): every admin screen and every marketing page in one chunk | index 363.7 KB (101.2 KB gzip: React, the router, the kit, shared logic) plus AdminApp 120.3 KB (36.5 KB gzip: the shell and the Dashboard) |
| Screen chunks | none | AdminLeads 32.8 KB, AdminCalls 81.1 KB, AdminBooked 7.8 KB, AdminClients 9.9 KB, AdminCalendar 23.2 KB, AdminOrders 22.9 KB, AdminConcepts 17.2 KB, AdminReviews 12.6 KB, AdminSubmissions 14.1 KB, AdminSettings 46.7 KB, AdminDesign 46.4 KB; LeadDetail 70.1 KB shared by Leads, Booked, Clients; LeadImport 14.3 KB; the marketing pages are chunks too (Home 42.3 KB, Navbar 12.7 KB, ...) and never load on the admin host |
| xlsx | 429.5 KB, lazy on import | 419.5 KB, unchanged, lazy on import |
| CSS | 10.4 KB | 13.7 KB (the self hosted font faces) |
| Fonts | Google Fonts, two origins, every subset the CSS listed | ten latin woff2 files in /fonts (Inter 400 to 900 at 83 KB each, Barlow Condensed 500 to 800 at 14 KB each); the admin preloads Barlow Condensed 700 and Inter 700, the marketing site Barlow Condensed 700 and 800 |
| Cold Dashboard transfer (Lighthouse total byte weight, mobile) | 319 KB | TBD_TRANSFER |

Leads and the Call Console are prefetched on idle after the first paint; the
boot frame is byte for byte the same markup (`src/shell/bootFrame.js`), and
App.jsx renders it as the Suspense fallback while the admin chunk loads, so
the first paint is unchanged (section 3 of the Prompt 14 report).

## 5. Service worker

`public/sw.js`, cache names `shell-v3.0.0` and `api-v3.0.0`; activate
deletes every cache whose name is not one of the two, and `skipWaiting` plus
`clients.claim` put a new worker in charge on the next load.

- shell: the navigation document (`/`, refreshed on every successful navigation and served when the network fails), the hashed /assets, /fonts, the icons, the logo, and the manifest, cache first and filled as they load; the precache list is the shell plus the three fonts the first paint needs.
- api: the last successful GET of /api/admin/call-leads, projects, orders, concept-packs, and settings, network first; when the network fails the cached copy answers, and with no copy a 503 `{ error: 'offline', items: [] }` so the screens show their error state instead of hanging. The recently deleted queries are never cached.
- Nothing but GET is touched; writes stay refused offline by apiFetch (Prompt 14 decision).
- Push and notification deep links unchanged.
- Playwright audits block the worker (a registered worker answers the mocked requests itself); Lighthouse runs against the mock server with the worker live, which is where the PWA score comes from.

## 6. Skeleton fit

Measured with `AUDIT_BOXES=1` on the feel audit. Rows are the outermost
blocks grouped by top edge; a row fits when it starts within 4px of the
loaded row (blocks 200px and wider match in width too).

| State | Before (Prompt 14 final) | After |
|---|---|---|
| Dashboard at 1280 | off 632px at row 4 of 6 (the Today card drew 3 rows, the fixture has 7) | TBD_FIT_DASH |
| Lead detail header at 1280 | off 140px at row 3 of 4, 4 vs 7 rows | TBD_FIT_LEAD |
| Call room header at 1280 | off 761px at row 4 of 11, 13 vs 11 rows | TBD_FIT_ROOM |

What changed: the Today card's row count follows the last known count, which
the loaded render writes to `vz_dash_today` and the skeleton reads (a zero
draws the small empty state's height); the greeting skeleton is three 39px
lines at 1280 and two 32px lines on the phone, the stat card skeletons carry
two trend lines where the trend wraps, list row skeletons match the 60px
row. The lead detail header skeleton is the real header's minimum: the name
capped to one 3xl line over the 44px descriptor field, the pill row at its
44px height, the seven action buttons wrapping like the real row, two
buttons, ten facts; the section column is the sticky subnav, the first
section label, and the Overview card plus four section cards at their usual
heights. The call room header skeleton is the real header's minimum: one
line of name, four pills sized like the real ones so they wrap the same way,
the descriptor and the ask-for lines, two social buttons, the phone button;
the Before you dial rows are 44px like the checkboxes. A long name still
makes a real header taller than its skeleton (the fixture's first lead has
an 80 character name); that is the data, not the shape.

## 7. Security review

Every route under api/ was read against the list in the prompt. Findings and
what changed (details in docs/RUNBOOK.md, Security):

| Area | Found | Fixed |
|---|---|---|
| Admin guard | Present on every non public handler, by hand at the top of each | One wrapper, `route()` in api/_lib/handler.js, on every function: guard, method allow list, body cap, CSRF, try/catch; a route cannot forget one |
| Methods | Four handlers had no method check (backup, export, push-subscribe, calendly) beyond a single `!== 'GET'`; the crons accepted any method | Allow lists per route, 405 with Allow |
| Body size | No cap anywhere; Vercel's 4.5MB was the only limit | 512KB default, 1MB call-leads and the webhook, 2MB the import, 4KB to 64KB on login, settings, reconcile, push |
| Validation | sanitize() whitelists and `$set` only on every write; ids cast with ObjectId; search strings escaped before the regex | Confirmed; the new log route follows the same shape |
| Mongo operators | No request value reaches an operator name; `$in` lists are built from cast ObjectIds | Confirmed |
| Secrets in responses | None; settings answers `configured` booleans only | Confirmed |
| Stack traces | Two handlers could throw into Vercel's default 500 page (the driver's error text) | The wrapper answers `{ error: 'server error' }` and logs the stack server side |
| Login | No rate limit; scrypt path compared with `timingSafeEqual`, env path compared two sha256 digests in constant time | 10 failures per IP per 15 minutes on the settings `login-limit` document (memory only while the database is unreachable, noted in the runbook because serverless memory is per instance and per cold start); 429 with Retry-After; success clears the count |
| Cookie | HttpOnly, Secure, SameSite=Lax, 30 days, never renewed | Sliding renewal: any authed request on a cookie older than a day reissues it for 30 days (`renewSession` in auth.js, also on the session check) |
| CSRF | SameSite=Lax only | `X-Requested-With: visualize` required on every POST, PATCH, DELETE of an admin route, login and logout included; apiFetch sends it on every call; the two raw `fetch` calls (login, the Call Console's session check, the push key) now go through apiFetch; the webhook, the crons, and public submissions are exempt |
| Webhook | Raw body verified with a 300 second replay tolerance; the unique index on `id` plus a `findOne` before processing, so a retry landing mid processing could double process | The row is inserted as a claim under the unique index before any ledger write; a duplicate key returns `duplicate: true` with no side effects; `processedAt` is set after; applyPayment still refuses a second ledger entry for the same event id |
| Headers | nosniff, DENY framing, the legacy X-XSS-Protection | Referrer-Policy strict-origin-when-cross-origin and a Permissions-Policy on every host; on admin.visualizeclients.com a Content-Security-Policy (self for scripts plus the sha256 of the one inline pre-paint script, styles self and inline for the CSS-in-JSX, fonts self, images self plus data and https for pack thumbnails, connect self, frame-ancestors none, base-uri self, form-action self, object-src none) and `Cache-Control: no-store`; /assets and /fonts immutable for a year; the marketing host gets no CSP and is unaffected. The build (`vzCspHash` in vite.config.js) computes the inline script's hash and writes it into vercel.json, so an edit to the pre-paint script cannot ship with a stale hash; the font link's inline `onload` handler was replaced by a link element created in the script so the policy needs no `unsafe-inline` for scripts. The mock server applies the same headers with `MOCK_HOST=admin`, which is how Lighthouse ran |

## 8. Error handling and logging

- `ErrorBoundary` (src/ui): catches a render error below it, logs it, shows the kit ErrorState with a Reload button and the message behind Show details. PageShell wraps its children in one (every screen region), AdminApp keys one per section so a new screen starts clean, and `ShellCrash` (src/shell) around the whole admin shows the login card outline with the message and a Reload button if the shell itself fails.
- `src/shared/log.js`: `logClient()` posts `{ kind, message, stack, url, at }` to /api/admin/log; `wireClientLog()` hooks `window.error`, `unhandledrejection`, the Prompt 14 `vz:offline-write` event (refused writes), and a new `vz:api-failed` event apiFetch emits for a 500 or a network failure. One entry per message per minute, 40 per page load, and never for the log call itself.
- /api/admin/log (admin guarded, 16KB cap): POST appends to the settings `client-log` document with `$push` and `$slice: -500`; GET answers the newest `limit`; DELETE clears. Settings, Automation shows the last 20 with kind, time, and path and a Clear button.
- Every handler runs inside the wrapper's try/catch: `{ error: 'server error' }` with the stack in the Vercel function log only.

## 9. Regression walk and the script results

docs/QA-CHECKLIST.md is the daily walk, 32 steps from opening the app to
signing back in, each with its expected result. `scripts/regression.mjs`
runs it against the fixtures at 390 and 1280.

TBD_REGRESSION

Every script on the final build (TBD_BUILD):

TBD_SCRIPTS

## 10. Hex count and css orphans

| Check | Prompt 14 | 3.0.0 |
|---|---|---|
| `node scripts/hex-count.js` | 145 | 139 |
| `node scripts/css-orphans.mjs` | 0 orphans of 861 classes | 0 orphans of TBD_CLASSES classes |

The light chart palette added six literals and the chart label one; they
were paid for by folding duplicates into references (`--v-border-focus`,
the status text tokens, the won solid, the neutral solid, the light
chart-1, chart-5, and chart-text) and by the maintenance rocket reading the
marketing brand variables.

## 11. Deferred, with reasons

TBD_DEFERRED

## 12. Release

- package.json 3.0.0; tag `v3.0.0` on the release commit; main at the same commit.
- docs/RELEASE-NOTES-3.0.md: what changed screen by screen in plain language and the setup list.
- docs/RUNBOOK.md and docs/ARCHITECTURE.md finalized for 3.0.0; CLAUDE.md at the repo root points to them, states the standing rules, and lists the scripts.

## 13. Setup, in order

1. Atlas: delete `sample_mflix`, allow Vercel's addresses in Network Access, copy the connection string with `/visualize`.
2. Vercel environment variables (Production), then redeploy: `MONGODB_URI`, `SESSION_SECRET` (32 or more random characters), `ADMIN_PASSWORD` (first sign in; Settings, Profile replaces it with a hash).
3. Push: `npx web-push generate-vapid-keys`, set `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`; on the phone install to the Home Screen, then Settings, Notifications, This device.
4. Crons: set `CRON_SECRET`; after the deploy confirm both in Vercel, Project, Settings, Cron Jobs: `/api/cron/reminders` every 15 minutes and `/api/cron/daily` at 06:00 UTC; Settings, Automation shows their last run.
5. Calendly: `CALENDLY_TOKEN` from Integrations, API and webhooks, Personal access token.
6. Stripe: webhook endpoint `https://admin.visualizeclients.com/api/stripe/webhook` with `charge.succeeded`, `invoice.paid`, `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`; the signing secret in `STRIPE_WEBHOOK_SECRET`; a restricted key with read access to Events in `STRIPE_SECRET_KEY`; redeploy, send a test event, check Settings, Integrations.
7. Optional: `WEB3FORMS_NOTIFY_KEY` for the email copy of submissions; `ADMIN_URL` only if the admin host changes.
8. Device print order import: on each device that ran the old print dashboard, Settings, Data, Print orders saved on this device, review, import (it reads `vz_print_orders` there and nowhere else).
9. First backup: Settings, Data, Download backup; keep the file.
10. Walk docs/QA-CHECKLIST.md once on the phone.
