# PROMPT 10 REPORT: Clients module

Branch claude/enable-maintenance-page-oDW2r, fast-forwarded to main.

## 1. What was built

- The Clients tab is now the module that runs the paid side: projects, revisions, payments, deliverables, and retainers. A client is still the call_leads document with stage 'client' (legacy stage 'won' records are listed too so nothing is orphaned). Projects live in a new projects collection. Money stays on purchases[]; schedule items point at ledger entries by id, so nothing is counted twice.
- Clients list: count line ("4 clients, 1 on retainer, $1,690 collected"), search, Chips (All, Active project, On retainer, Delivered, Paused, Owes a payment, Ready to deliver). ClientCards on mobile (LeadCard compact plus the client line: active package pill, project stage pill, a paid-over-total ProgressBar, retainer pill with the monthly amount, next bill or next payment date). Desktop gets the kit Table (Business, Package, Stage, Paid / Total, Retainer, Next date, Since) with the column chooser persisted. Add client opens LeadForm in a Sheet and creates the lead with stage client, clientSince now, clientStatus active.
- Client detail is LeadDetail in client mode (no fork): the Prompt 8 profile plus a Links block (website, Google Drive, ClickUp, Instagram, each InlineEdit with an open target and a Copy action), Since and Lifetime value facts, a client status pill with a Menu (active, paused, delivered), and a Brand block (primary swatch, up to four secondary swatches with hex InlineEdit and a live chip, display and body fonts, logo link, one line of notes, Copy brand as one text block). Sub nav Tabs: Overview, Projects, Payments, Retainer, Deliverables, Notes, History.
- Projects: Cards newest first with package name, kind pill, stage pill, started line, the stage stepper (web kinds include Build, brand kinds skip it), the revision counter and log, and a Menu (Advance stage, Set stage, Archive). New project Sheet: a package, an add-on set, or custom name and total; total and schedule prefilled by planFor (one payment under 750, the package plan or six or twelve monthly payments over it, the first payment on the start date); optional Drive and ClickUp links; a live preview of the schedule. Log a round records date and note; once both rounds are used the button becomes Log extra round, which adds an unpaid schedule line of 50 (design kinds) or 75 (web kinds) and shows the reason. Delivered is gated on full payment; the Delivered card shows the Send delivery checklist whose last item creates the retainer follow up callback three days out.
- Payments: the project's schedule as a Table on desktop or a Stack of ListRows on mobile with amount, due date, status Pill (paid, due, past due, upcoming), Mark paid (appends to purchases[] with the project id and writes the ledger id back onto the schedule item) and a Ledger link on paid rows. Plan projects get the payment plan block (Month m of n, next due, remaining) and, from month 5 of 6 or 11 of 12, the danger-soft Stripe card with the persisted "Stripe subscription cancelled" Checkbox. The final month also emits a System notification and an all day Calendar marker. The lifetime ledger sits at the bottom with Add manual payment (amount, label, date, optional project).
- Retainer: Start a retainer Sheet (RETAINERS Select with the included list and the monthly count, start date, bill day 1 to 28) creates a project of kind retainer with a twelve month schedule and writes the client's retainer summary. Active view: plan and price, status pill, started, next bill, bill day, Pause / Resume / Cancel (30 days notice, status ending, cancelAt), Mark cancelled now while ending. Monthly deliverables: one card per month with the current month pinned, a ProgressBar of delivered over included (8 graphics, 10 creatives, 10 creatives plus Site Care plus Google Business, up to 2 hours), and Log delivery (count and note).
- Deliverables: the Drive structure (01 Brand Files, 02 Web Files, 03 Print Files, 04 Source Files) prefilled by kind, each item a Checkbox with an optional link. The Released to client Toggle is disabled with the reason until every schedule item is paid; on, it stamps releasedAt and shows the Drive folder as a big button.
- Events: retainer bill dates (next three, tone won, "Bill Abyssinia $250") and payment plan final months are event sources, so the Calendar (new Bills chip) and the drawer show them. Past due schedule items are Overdue notifications.
- Dashboard: Monthly recurring is a new stat that sums active retainer amounts; Clients on retainer reads the retainer field.
- Old Clients screen JSX and CSS deleted. Hex count 449 to 430.

## 2. Files created, changed, deleted

Created: src/lib/projects.js (every rule, pure), src/components/ClientWorkspace.jsx (Links, Brand, the four sections and their Sheets and Modals), src/components/ClientCard.jsx, api/admin/projects.js, reports/PROMPT-10-REPORT.md.

Changed: src/pages/AdminClients.jsx (rewritten, 683 lines to 139), src/components/LeadDetail.jsx (client mode), src/pages/AdminApp.jsx (projects state, create and patch, props to the shell, Clients and Dashboard), src/shell/AppShell.jsx (projects into events, notifications, and the shell context), src/shell/notifications.js (bills, final month, past due payments), src/lib/events.js (bill and planfinal kinds), src/pages/AdminCalendar.jsx (Bills chip, icons), src/pages/AdminDashboard.jsx (retainer formula, Monthly recurring), src/shared/semantics.js and api/_semantics.js (five new enums), src/shared/pricing.js (monthly counts on RETAINERS, extraRoundFee), api/admin/call-leads.js (client fields in sanitize), src/ui/icons.jsx (eight icons), src/ui/lead.styles.js (clientStyles) and src/ui/index.js, scripts/layout-audit.mjs (fixtures, projects mock, client steps, AUDIT_ONLY, AUDIT_WIDTHS, AUDIT_SHOTS), docs/COMPONENTS.md, docs/ARCHITECTURE.md, reports/PROMPT-09-REPORT.md (audit tally filled in).

Deleted: the whole old Clients screen (ClientForm, Purchases, ContactHistory, ClientDetail, ContactChip, Block, and the cl- stylesheet). No files removed; src/lib/booked.js keeps totalPaid, lastContact, checklistProgress for other callers.

## 3. Projects schema and endpoints

Collection projects, one document per project:

```
{ _id, leadId: string (call_leads _id), name: string, kind: brand|web|combined|print|retainer,
  packageId: string ('' for custom and add-on sets), custom: { name, total } | null,
  stage: kickoff|design|revisions|build|delivery|delivered, stages: string[] (the stepper for this kind),
  total: number,
  schedule: [{ id, amount, dueAt: 'YYYY-MM-DD', status: paid|due|past-due|upcoming, ledgerId, label, paidAt, extra: bool }],
  revisions: { max: 2, used, log: [{ at: ISO, note, extra: bool }] },
  plan: { months, monthly, stripeCancelled: bool } | null,
  links: { drive, clickup },
  deliverables: [{ id, group: '01'|'02'|'03'|'04', label, done, link }],
  delivery: { driveShared, emailSent, pitchSent, followUpLeadCallbackAt: ISO },
  releasedAt: ISO | '',
  monthly: [{ month: 'YYYY-MM', included, delivered, log: [{ at, count, note }] }],
  retainer: { planId, billDay, startedAt } (retainer kind only),
  createdAt, updatedAt, archived: bool }
```

Stored schedule status is paid or upcoming; due and past due are derived at read time from dueAt (scheduleStatus in src/lib/projects.js), so a row never goes stale.

Endpoints (all behind requireAdmin, all writes through sanitize(), $set only):
- GET /api/admin/projects?leadId=<id> returns { items } for one client; without leadId every live project (limit 1000); ?archived=1 the archived ones.
- POST /api/admin/projects with the document above (leadId and name required) returns { ok, item }.
- PATCH /api/admin/projects { id, set } sets only the keys sent, never leadId, and stamps updatedAt. Returns { ok }.

Shell loading: AdminApp loads every project once at sign in (like call leads), exposes it through the shell context (shell.projects) and passes it to Clients, Calendar, the drawer, and the Dashboard; createProject and patchProject are optimistic with rollback.

## 4. Client fields added to sanitize()

On call_leads, all additive:
- links { website 400, drive 400, clickup 400, instagram 400 }
- brand { primary 20, colors[] up to 4 of 20, fontDisplay 120, fontBody 120, logoLink 400, notes 600 }
- retainer { projectId 64, planId 40, amount number, status in RETAINER_STATUS_IDS, startedAt 40, billDay 1 to 28, nextBillAt 40, cancelAt 40 } (null allowed to clear)
- clientStatus in CLIENT_STATUS_IDS (active, paused, delivered)
- purchases[] entries gained optional id (40) and projectId (64); the cap moved from 50 to 200 entries so a long retainer never truncates the ledger.

## 5. Every rule enforced and where it lives

| Rule | Where |
|---|---|
| Two revision rounds per package | REVISION_ROUNDS in pricing.js; revisionsExhausted() in src/lib/projects.js; the Projects card swaps Log a round for Log extra round once both are used, so the counter never silently exceeds two (ClientWorkspace saveRound) |
| Extra rounds cost $50 design, $75 web | EXTRA_ROUND and extraRoundFee(kind) in pricing.js (web and combined kinds pay 75); saveRound appends an unpaid schedule line and raises the project total; the reason shows under the counter |
| Files release only at full payment | releaseBlockReason() in projects.js; the Released to client Toggle is disabled with the reason until isFullyPaid() |
| Delivered waits for full payment | deliverBlockReason() in projects.js; ClientSections.setStage shows it in the ConfirmDialog with an Open payments action for both Advance and Set stage |
| Payment plan reminder from month 5 of 6 or 11 of 12 | planReminderDue() in projects.js (month >= months - 1); the danger-soft card with the persisted plan.stripeCancelled Checkbox in the Payments section; the final month event and System notification in events.js and notifications.js |
| 30 days notice on cancel | CANCEL_NOTICE_DAYS and cancelAtFor() in projects.js; cancelRetainer writes status ending and cancelAt; the Prompt 12 cron (or Mark cancelled now) finishes it |
| Never discount by cutting price | No control anywhere lowers a package price; extra work only adds schedule lines; the copy says so on the revision block |
| Every delivery ends with a retainer pitch | The Send delivery checklist carries Retainer pitch sent; the last item creates the "Retainer follow up" callback (callStatus callback, callbackAt three days out at 10am, a callLog entry), which lands on the Calendar and in notifications |
| One payment under 750, plans over it | scheduleFor() in projects.js on top of planFor() in pricing.js; the first payment is dated on the start date |

## 6. New event sources (src/lib/events.js)

- bill: for every client whose retainer status is active or ending, the next bill (retainer.nextBillAt) and the two monthly bills after it on the bill day, all day, tone won, title "Bill <business> $<amount>", subtitle "<plan> month starts" (plus "retainer ending" during notice). Bills stop at cancelAt. Id bill:<leadId>:<date>.
- planfinal: for every live project with a plan, an all day marker on the last scheduled payment, tone danger until plan.stripeCancelled is true (then booked), title "Final payment: <business>", subtitle "<project>, month n of n. Cancel the Stripe subscription after it clears." Id planfinal:<projectId>.
- buildEvents(leads, extras, now, projects) gained the fourth argument; every caller passes shell projects. KIND_LABEL gained Bills and Final payments; the Calendar's Bills chip shows both.
- Notifications: bills fall into Today and Upcoming like meetings (past bills are ledger history and never nag); the final month is a System item for the 31 days before it until the Checkbox is ticked; past due schedule items are Overdue items ("Payment past due: <business>, $75 for Launch Plan, Extra round 1, was due Sep 1").

## 7. Dashboard formula changes

| Number | Before | After |
|---|---|---|
| Clients on retainer | clients with any purchase whose label or notes matched /retainer/i | clients with retainer.status active or ending |
| Monthly recurring (new) | none | sum of retainer.amount over those clients |
| Money made all time, This month | unchanged, purchases ledger | unchanged; Mark paid writes into that ledger so project payments count the moment they are recorded |
| Today panel | buildNotifications(leads) | buildNotifications(leads, { projects }) so bills and past due payments reach the panel's source (the panel still lists callbacks, meetings, and new leads) |

The Revenue card now holds four StatCards: all time, this month, Monthly recurring, Clients on retainer; the skeleton matches.

## 8. Old Clients code is gone

src/pages/AdminClients.jsx is a full rewrite on the kit (139 lines). ClientForm, Purchases, ContactHistory, ClientDetail, ContactChip, the local Block, the aa-btn and aa-input markup, and every cl- CSS rule from the old screen are deleted; the new cl- rules are the list page only. grep for cl-pay, cl-contact, cl-tl, cl-invoice, cl-demote, and cl-tag returns nothing in src/. The contact log is still written and read through LeadHistory (Prompt 7), so nothing was lost.

## 9. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 10 (2013ba7) | 449 | 100 |
| After Prompt 10 | 430 | 100 |

The 19 hex literals in the old Clients screen went with it; no new file carries one.

## 10. Layout audit

Prompt 9 combined tally (Prompts 8 and 9, finished on this container, also written into reports/PROMPT-09-REPORT.md section 9): 61 checks at 320, 61 at 390, 61 at 430, 64 at 768, 64 at 1280, all clean, exit 0.

New checks this prompt: clients list with each of the six chips, clients skeleton (table skeleton on desktop, card skeletons on mobile), client detail on every tab for the payment plan client, new project Sheet, log extra round Modal, payment plan block at month 5 of 6, mark paid Modal, add manual payment Sheet, start retainer Sheet, deliverables with the toggle disabled (plan client) and enabled (delivered client), the delivered project's Send delivery checklist, the retainer client's monthly cards and log delivery Modal, the hostile long name single project client on Overview and Payments (owes a payment), add client Sheet, and sidebar collapsed on the list and the detail. Fixtures: L10 single project client (Web Essentials, unpaid, one round used), L11 payment plan client at month 5 of 6 with both rounds used and an extra round on the schedule, L12 Content Kit retainer client billing in three days with two logged months, L13 delivered and released client. The projects endpoint is mocked for GET and answers POST and PATCH with ok.

Full run on the final build (every screen, every width), exit 0:

| Width | Checks | Result |
|---|---|---|
| 320 | 88 | all clean |
| 390 | 88 | all clean |
| 430 | 88 | all clean |
| 768 | 93 | all clean |
| 1280 | 93 | all clean |

450 checks, zero offenders, no horizontal scroll at any width.

## 11. Decisions

- Legacy stage 'won' records are listed as clients (the Won action has written stage 'client' directly since Prompt 8, so these are only old rows). They open in client mode and behave like any client.
- Retainer projects carry kind retainer and stay out of the Projects list; they render on the Retainer tab. Their stages array is kickoff and delivered so the enum holds, and the stepper never shows for them.
- Schedule display statuses are derived from the due date rather than stored, so a row cannot be left reading "upcoming" after its date passes.
- Mark paid extends a retainer schedule so at least six future months always exist, and rewrites retainer.nextBillAt to the next unpaid month; the twelve month initial schedule keeps the projects document small.
- planMonth counts the payment in progress: paid items plus one, or the number of items whose date has arrived, whichever is larger, clamped to the plan length.
- Unchecking the follow up item clears the project's followUpLeadCallbackAt only; the callback on the lead stays until it is handled from the Calendar or the drawer, which is where callbacks are handled everywhere else.
- Client status is auto maintained (a new project sets active; Delivered sets delivered when no other project is active) and can be overridden from the profile pill Menu, which is also where Paused is set.
- The 30 day cancel period is dated from the moment notice is given, not from the next bill, which matches the notice wording on the pricing page.
- The Brand block validates hex on save (a bad value is rejected with the InlineEdit rollback toast) and renders a struck chip for anything that is not a hex color.

## 12. Skipped or deferred

- Stripe: every amount is entered by hand or picked from pricing.js; read only Stripe arrives in Prompt 12, along with the cron that turns ending retainers into cancelled and could reconcile Mark paid against real charges.
- Drag to reorder schedule items and editing a schedule item's date or amount inline (Mark paid accepts a different amount, which covers partial payments for now).
- Per month deliverable history beyond the last three log lines per card.
- A ledger entry cannot be deleted from the new screen (the old one allowed it). Mark paid and manual payments only append; a wrong entry is corrected by a negative manual payment until Prompt 12's Stripe reconciliation decides how corrections should look.

## 13. What Prompt 11 (Studio: print orders, concepts library, reviews) must know

- Linking a print order to a client or project: a client is a call_leads _id; a project is a projects _id with leadId. A print order should carry { leadId, projectId? } and, when it is paid, append to the client's purchases[] with { id, label, amount, at, projectId } exactly as Mark paid does (ClientWorkspace savePay), so the Dashboard and the lifetime ledger count it. A print-only job for a client is a project of kind print (buildProject with an add-on set) whose deliverables prefill 03 Print Files and 04 Source Files.
- Concepts live on the lead as concepts[] { id, label, status, link } (Prompt 8) and the brand block on the lead (brand { primary, colors, fontDisplay, fontBody, logoLink, notes }, copyable through brandText(lead) in src/lib/projects.js) is what the image prompt skills read.
- Reviews: a client's status (clientStatus, retainer.status) and delivered projects (stage delivered, releasedAt) are the natural triggers for a review ask; the follow up callback already exists three days after delivery.
- PrintsAdmin localStorage data (src/pages/PrintsAdmin.jsx and src/pages/Prints.jsx), all per device, nothing in Mongo: vz_print_orders is an array of { id: Date.now(), date: ISO, source: 'shop', status: 'pending' (PrintsAdmin moves it through its own statuses), name, email, phone, cartItems: [{ productId, productName, label, priceMode, priceTotal, vals: { ...options, artworkFile: name|null } }], summary, estimatedSubtotal, hasQuoteItems }; vz_clients (portal accounts, with plaintext passwords), vz_invoices, vz_intake_forms (briefs), vz_analytics ({ views[], sessions[] }), vz_maintenance_preview. The shop checkout also POSTs a type 'shop-order' submission to /api/submissions with the same name, email, phone and an Items string, so the Mongo submissions collection already holds every order placed since that was wired; the localStorage copy is the only one with structured cart items. Prompt 11 should read orders from submissions (type shop-order) and treat vz_print_orders as a one time import source at best.
- Enums for Prompt 11 belong in src/shared/semantics.js with mirrored id lists in api/_semantics.js, following PROJECT_KINDS and friends.
- Hex baseline for Prompt 11 is 430.
