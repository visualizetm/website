# PROMPT 11 REPORT: Studio, print orders, concepts library, reviews

Branch claude/enable-maintenance-page-oDW2r, fast-forwarded to main.

## 1. What was built

- Print Orders rebuilt on a new orders collection: count line, chips for every status plus Rush and Due this week, search, a New order Button, OrderCards on mobile and the kit Table on desktop (Customer, Source, Status, Items, Subtotal, Rush, Due, Paid). Tap opens the detail in a right panel on desktop (the list narrows to compact cards) and a Sheet on mobile: customer block with tap to call and email, Link to client (LeadPicker; optionally creates a print kind project through buildProject), a stage stepper New, Designed, Cut, Packed, Delivered with Advance and a Set stage Menu (Cancelled behind a confirm), items with qty, options, artwork link and price InlineEdits plus Add item, the Rush Toggle (adds the 20 rush line and moves a rule-derived due date to 3 days), the due date, notes, Mark paid (writes the client's purchases[] ledger exactly like ClientWorkspace savePay when a client is linked, otherwise paid on the order only), and the packaging checklist on Delivered for sticker or vinyl items (poly bag, header card, usage guide card).
- New order Sheet: pick a client or type a customer, the product picker from pricing.js PRINT_PRODUCTS (stickers 2 pack, stickers 50 pack, custom vinyl with a size Select at 15, 25, 40, business cards 250 and 500, business card design, NFC card) plus a custom line with a blank price meaning quote, qty, Rush, due date (7 days, 3 with rush, editable), notes, and a live subtotal.
- Shop orders: api/submissions now also inserts an orders document for every shop-order submission (source shop, status new, submissionId set, items parsed from the Items string). The Orders screen shows an import banner for older shop-order submissions with no matching order and creates them in one click. The Print Orders nav badge is the count of orders in status new.
- One time import from this device: Settings, Data (the old Export sub, renamed) has "Import print orders saved on this device". It reads vz_print_orders, shows a preview Table (customer, date, items, subtotal, status, Create or Skip) with duplicates skipped by email plus day plus subtotal, creates the rest with source import, and reports imported and skipped counts. Nothing is removed from localStorage.
- Concepts library: a new concept_packs collection and screen at /concepts with a count line, search over title, tags and prompt text, chips by kind and by industry (displayIndustry labels), a Grid of PackCards (title, kind pill, industry pill, prompt and image counts, last used, up to three image thumbnails), New pack. Pack detail (right panel or Sheet): title InlineEdit, kind and industry Selects, linked lead through LeadPicker, tags as Chips with an add field, prompts as expandable rows each with a Copy prompt IconButton, Add prompt, image links with open and remove, notes, and Mark shown to the lead (appends usedFor, stamps lastUsedAt, and flips a matching concepts[] item on the lead to shown). The first read of an empty collection seeds "Universal logo directions" (kind logo, three prompt stubs).
- From the lead: every concept item on LeadDetail's Concepts tracker gained a From library action (a Button when the item has no link, and a Menu entry always) that opens PackPicker filtered to the lead's industryKey (with an All industries chip), writes packId on the concepts[] item, fills the item's link from the pack's first image when it has none, and shows the pack as a pill with an Open library button.
- Reviews: additive reviews field on the lead and a screen at /reviews: count line, chips (Has NFC card, No Google link, Never asked, Asked this month, Delivered not asked), cards per client (Avatar, business, NFC pill, Ask due pill, baseline to latest count and rating with a delta pill in booked or danger tone, last ask line, Google link as a big button). The review Sheet: Google link InlineEdit, NFC card Toggle with the given date, counts (the first save also writes the baseline), Log an ask (channel, result, note) with the last five asks, and two ask texts in Rob's voice with Copy buttons and the link appended. A Form submissions section lists type review submissions with Link to client, which links the submission and logs an ask with result left.
- Notifications: a System item "Ask <business> for a review" three days after a release with zero asks. The Reviews nav badge is that count.
- Nav and shell: Concepts and Reviews enabled (no more Soon), Print Orders keeps /orders, the More sheet lists all three under Studio, Quick Add gained New order, the command bar jumps to them.
- Dashboard: the Recent activity feed reads print orders from the orders collection.
- Old Orders screen removed from AdminApp; Checklists and LinkedSubmissions moved off raw hex. Hex 430 to 406.

## 2. Files created, changed, deleted

Created: src/pages/AdminOrders.jsx, src/pages/AdminConcepts.jsx (exports PackPicker), src/pages/AdminReviews.jsx, src/lib/orders.js, src/lib/reviews.js, src/components/LeadPicker.jsx, api/admin/orders.js, api/admin/concept-packs.js, api/_lib/orders.js (server parser and order builder), reports/PROMPT-11-REPORT.md.

Changed: src/pages/AdminApp.jsx (orders and packs state, create and patch, import of shop-order submissions, three new sections, badges, quick add New order, deep link for shop orders, Settings Data sub with the device import, old Orders mount and state removed), src/shell/AppShell.jsx (packs and newOrder in the context, New order quick add), src/shell/nav.js (Concepts and Reviews enabled), src/shell/notifications.js (review ask System item), src/pages/AdminDashboard.jsx (orders feed from the collection, onOpenOrder), src/components/LeadDetail.jsx (From library on concept items), src/shared/semantics.js and api/_semantics.js (PRINT_ORDER_STATUSES, ORDER_SOURCES, CONCEPT_KINDS, REVIEW_CHANNELS, REVIEW_RESULTS), src/shared/pricing.js (PRINT_PRODUCTS, RUSH_FEE, TURNAROUND_DAYS), api/submissions.js (orders document for shop orders, type review), api/admin/call-leads.js (reviews field, concepts[].packId), src/ui/icons.jsx (Scissors01, Download01, Upload01), src/components/Checklists.jsx and src/components/LinkedSubmissions.jsx (hex to tokens), scripts/layout-audit.mjs (Studio fixtures, mocks, steps, AUDIT_ONLY=studio), docs/COMPONENTS.md, docs/ARCHITECTURE.md, reports/PROMPT-10-REPORT.md (audit tally).

Deleted: the Orders mount of ListSection, selOrder state, the shop-order split of submissions, the shop-order deep link branch, and the Order label branches inside ItemDetail and the empty state. ListSection itself stays for Submissions. No files were removed. PrintsAdmin, Prints, ClientPortal, and IntakeForm are untouched.

## 3. Schemas and endpoints

orders:
```
{ _id, source: shop|client|walk-in|import, status: new|designed|cut|packed|delivered|cancelled,
  leadId, projectId, submissionId,
  customer: { name, email, phone },
  items: [{ id, productId, name, label, qty, options: {}, artworkLink, priceTotal: number|null, quote: bool }],
  subtotal, rush: bool, dueAt: 'YYYY-MM-DD', notes,
  paid: { at, ledgerId, amount } | null,
  packaging: { polyBag, headerCard, usageGuide },
  importKey, archived, createdAt, updatedAt }
```
GET /api/admin/orders?status=<id> returns { items, unimported } (unimported = live shop-order submissions with no order by submissionId). POST creates one order (customer name or leadId required) and returns { ok, item }; POST { action: 'import-submissions' } backfills and returns { ok, created }. PATCH { id, set } sets only the keys sent through sanitize(), never submissionId.

concept_packs:
```
{ _id, title, leadId, industryKey, kind: logo|brand-board|social|website|signage|apparel|vehicle|packaging|ads|other,
  prompts: [{ id, label, text }], images: [{ id, label, link }], tags: string[], notes,
  usedFor: string[] (leadIds), lastUsedAt, archived, createdAt, updatedAt }
```
GET /api/admin/concept-packs?leadId&industryKey&kind returns { items } and seeds the universal logo pack once when the collection is empty. POST returns { ok, item }. PATCH { id, set } $set only.

call_leads additive:
```
reviews: { nfcCard: bool, nfcGivenAt, googleLink,
  baseline: { count, rating, at } | null, latest: { count, rating, at } | null,
  asks: [{ at, channel: nfc|text|email|in-person, result: asked|left|declined, note }] }
concepts[].packId (string)
```
Both in sanitize() with the enum ids mirrored in api/_semantics.js.

submissions additive: type 'review' is accepted by the public endpoint with fields { rating (0 to 5), text }.

## 4. Shop-order submissions become orders

- On POST /api/submissions with type shop-order, after the submission is inserted, api/_lib/orders.js orderFromSubmission builds { source shop, status new, submissionId, customer from name, email, phone, items from fields.Items, subtotal, dueAt = created plus 7 days } and inserts it. It is best effort: if the insert fails the submission still exists and the Orders screen backfills it.
- The Items string the shop writes joins items with a vertical bar and separates name, label, and price with a spaced dash. parseItemsString splits on the bar, then on the spaced dash (long dash, short dash, or hyphen), takes the first part as the name, the middle parts as the label, and the last part as the price. A dollar amount becomes priceTotal; "Quote" or no amount marks quote with a null price. qty is read from "Qty 100" or a leading number in the label, else 1. Options stay empty; productId stays empty. The same function lives in src/lib/orders.js for the client.
- Backfill: GET counts shop-order submissions without an order; the banner's button posts action import-submissions, which creates them server side with the same builder.

## 5. Device import rules

- Reads localStorage vz_print_orders (an array written by src/pages/Prints.jsx checkout). Each entry becomes an order with source import: customer from name, email, phone; items from cartItems (productName, label, qty from vals.qty, every other vals key as options, priceMode quote or a null priceTotal as quote); subtotal from the priced lines; status pending maps to new (completed or done to delivered, a known status keeps its value); dueAt from the entry date plus 7; notes "Imported from this device." plus the entry's summary.
- Dedupe key: lowercased email, the day of the entry date, and the rounded subtotal. A key that already exists in Orders (importKey on imported orders, or the same key computed from any order) or that repeats inside the file is skipped with the reason shown in the preview.
- The preview Table lists every entry with Create or Skip; Create posts the rest one at a time and reports imported, skipped, and failed counts. The localStorage keys are never touched.
- Against real data: this browser is the only place those orders exist, so a run creates one order per distinct checkout that was placed from this device, and skips anything that is already in Orders because its shop-order submission was backfilled (same email, same day, same subtotal). Orders placed from other devices are not on this device and cannot be imported from here; their submissions are backfilled instead.

## 6. Review ask notification rule

src/lib/reviews.js reviewAskDue(lead, projects, now): the lead has stage client, at least one project with releasedAt, and zero entries in reviews.asks; the item is due when releasedAt plus 3 days is in the past. src/shell/notifications.js emits one System item per such client ("Ask <business> for a review", detail names the project and its release date), honoring snoozes by id review:<leadId>. reviewAsksDue(leads, projects) counts them for the Reviews nav badge and the Reviews list sorts those clients first with an Ask due pill.

## 7. Review form

The website has no review form today: the Testimonials block on the home page is static copy, and neither Contact nor Start post a review. The public endpoint now accepts type review anyway (name, email, business, rating, text), and the Reviews screen already renders those submissions with Link to client. Deferred: when a review form is added to the site, it needs one POST to /api/submissions with { type: 'review', name, email, business, rating, text }, the same call Start makes with type start.

## 8. Old Orders code is gone

AdminApp no longer mounts ListSection for orders; selOrder, the shop-order split, unreadOrders, the shop-order deep link branch, and the "Order" label branches in ItemDetail and the empty state are deleted. grep for selOrder and ORDER_STATUSES in src/pages returns nothing. ORDER_STATUSES stays in semantics only because api/admin/submissions.js still accepts those legacy status ids on old shop-order submissions (nothing is renamed or dropped). Submissions keeps ListSection and its aa- CSS, which is why that stylesheet is not deleted.

## 9. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 11 (e21d955) | 430 | 100 |
| After Prompt 11 | 406 | 97 |

Checklists and LinkedSubmissions moved to tokens (24 literals); the three new screens, libraries, and endpoints carry none.

## 10. Layout audit

Prompt 10 tally (full run on the final Prompt 10 build, written into reports/PROMPT-10-REPORT.md): 88 checks at 320, 88 at 390, 88 at 430, 93 at 768, 93 at 1280, all clean, exit 0 (450 checks).

New checks this prompt: orders list with the import banner and each of the eight chips, orders skeleton, order detail for the rush shop order with long names, link to client Sheet, mark paid Modal, the delivered client order with the packaging checklist, new order Sheet (empty, with an item added, and the pick a client Sheet), the Settings import preview, concepts grid with the social and industry filters, concepts skeleton, pack detail with all three prompts expanded, link a lead Sheet, new pack Sheet, the From library picker on a booked lead, reviews list with each of the five chips, reviews skeleton, the review Sheet, the link form submission Sheet, and the collapsed sidebar on all three screens. Fixtures: two shop orders (one rush with a quote line and a long name, one paid and cut), one delivered client order linked to L11 and its project, two packs (the seed logo pack and an auto detailing social pack with three image links, one of them a Drive folder), one client with reviews (NFC card, link, baseline 12 at 4.3 to latest 19 at 4.6, two asks), one delivered client with a release six days ago and no asks, and one review submission.

AUDIT_TABLE

## 11. Decisions

- Order statuses are a new enum (PRINT_ORDER_STATUSES) rather than a change to ORDER_STATUSES, which old shop-order submissions still carry.
- The sticker packs and vinyl tiers had no price in pricing.js; PRINT_PRODUCTS sets 10 for the 2 pack, 40 for the 50 pack (the existing stickers add-on), and 15, 25, 40 for small, medium, large vinyl. Edit them there.
- Subtotal is the sum of priced lines plus the rush line; quote lines add nothing and the list shows "plus quote". The stored subtotal is recomputed on every item or rush change.
- Toggling Rush moves the due date only when it still equals the rule-derived date for the old setting, so a hand-set date is never overwritten.
- A shop order's customer stays on the order even after Link to client; the client's business name is shown from the lead and the email and phone fall back to the lead's.
- Mark paid on an order with no linked client records paid on the order only (paid.ledgerId empty), which is why the Dashboard's money stays ledger-based and walk-in cash never inflates a client.
- The right panel on desktop keeps the list visible as compact cards (the Table hides while a detail is open) so the next order is one tap away; mobile uses a tall Sheet.
- Concept packs load at the shell level (like projects) so LeadDetail's From library works from Leads, Booked, and Clients without a fetch; the seed pack is created on the server on the first empty read, not shipped in the bundle.
- Mark shown flips a lead concept to shown when its label matches the pack title or it already carries the packId; other concepts are untouched.
- Linking a website review submission logs the ask with channel email and result left, note "Website review form, N stars", because the form is not one of the four ask channels.
- Review counts: the first save writes both baseline and latest; later saves move latest only. Deltas render in booked tone unless either number went down.
- Settings keeps its aa- markup for the import button (the rest of Settings is Prompt 12), but the preview itself is the kit Table inside a kit Sheet.

## 12. Skipped or deferred

- The website review form (see section 7).
- Export of orders as CSV: the Settings Orders CSV buttons still export shop-order submissions through /api/admin/export; an orders collection export is a Prompt 12 data item.
- Sticker and vinyl per size pricing from the shop's per unit table (the shop prices by size and quantity; the picker uses flat pack prices).
- Retiring PrintsAdmin, Prints checkout's localStorage write, the portal, and the intake form (Prompt 13).
- Image thumbnails only render for links that look like images; Drive folder links show an icon.

## 13. What Prompt 12 (data, integrations, settings) must know

- Collections now: call_leads, submissions, projects, orders, concept_packs, settings, push_subscriptions. Every admin endpoint follows the same GET, POST, PATCH { id, set } with sanitize() shape; enums live in src/shared/semantics.js with id lists mirrored in api/_semantics.js.
- Ledger writes: ClientWorkspace savePay and AdminOrders savePay both append { id, label, amount, at, notes, projectId } to purchases[]; a Stripe reconciliation should match on that id (schedule items and orders store it as ledgerId).
- Settings Data sub already hosts the device import; the export buttons there still hit /api/admin/export (submissions only).
- Exact localStorage keys on this browser, all written by the legacy screens and read only by them (and by the import above): vz_print_orders (Prints.jsx checkout and PrintsAdmin), vz_clients (PrintsAdmin client accounts, plaintext passwords, and ClientPortal login), vz_invoices (PrintsAdmin), vz_intake_forms (IntakeForm and PrintsAdmin briefs), vz_analytics (PrintsAdmin views and sessions), vz_maintenance_preview (PrintsAdmin maintenance toggle), vz_cart (Prints.jsx cart), vz_sid in sessionStorage. Admin keys that stay: vz_theme, vz_call_session, vz_builder_preset, vz_leads_view, vz_cal_view, vz_shell_collapsed, vz_notif_read, vz_callmode_<id>, vz_clients_cols, vz_orders_cols.
- Routes Prompt 13 retires (src/App.jsx): /prints and /admin/prints on the admin host (PrintsAdmin), /portal (ClientPortal), /intake/* (IntakeForm), and the public /prints shop's localStorage write in its checkout (the POST to /api/submissions stays, and is what feeds Print Orders). The Settings Legacy tools sub links to /prints and should go with it.
- The public endpoint now accepts type review; the Reviews screen is ready for a form.
- Hex baseline for Prompt 12 is 406.
