# PROMPT 08 REPORT: Lead detail and the Booked workspace

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`.
Commits: catalog, schema, kit (fb445c1); LeadDetail and Booked (ef098ac); audit (bfd0dd2); this report.

## 1. What was built

- `src/components/LeadDetail.jsx`: one stage-aware detail used by Leads and Booked (Clients keeps its own screen until Prompt 10; the component takes `readOnly` for it). Mobile: profile panel, sticky Tabs sub nav (Overview, Playbook, Meeting for booked and beyond, Notes, History) that scrolls to sections. Desktop from 1024px: profile pinned left at `--v-panel-w` plus 40px, sections on the right; the list stays in the left panel, narrowing to a 232px rail between 1024 and 1279px.
- Profile panel: Avatar, display-face business, descriptor InlineEdit, stage pill, priority Pill that opens a Menu, status pill, New pill, industry InlineEdit; action row (call, text, email, Instagram, Facebook, website, maps, copy phone) where missing links render muted and open an add dialog; quick facts on InlineEdit (phone, ask for, phone note, best window, email, address) plus read-only source, added, last scanned, and a callback due row that opens the shared CallbackPicker (clearing removes the value); Start call (Call Console autostart for this lead) and Edit all (LeadForm in a Sheet, delete in its footer).
- Overview: the angle as an InlineEdit paragraph, intel cards editable with add, edit, remove, reorder (drag on desktop, Menu up/down on mobile), before-you-dial as the same editable list.
- Playbook: ScriptSteps, Objections (add and remove), CloseCards, every line an InlineEdit writing script{}, objections[], close{} whole.
- Meeting workspace: When (countdown, date and time, type, where or link, Reschedule sheet, .ics download, legacy free-text meeting with a Set date action), Services game plan checklist with notes, Pricing options builder (up to three, package Select, add-on Checkboxes, retainer Select, recommended Toggle, computed included list, total, payment plan line, gifts line), Concepts (quick add, the usual five, status Menu, big link buttons, progress bar), Prep notes on LeadNotes. Call mode Toggle collapses every block to its one-line summary through the new measured-height Collapsible, persisted per lead.
- Outcome bar on booked leads: Mark as won (converts to client with an optional note), Mark as lost (undo toast), Reschedule.
- `src/shared/pricing.js`: the catalog and rules. `src/pages/AdminBooked.jsx` rebuilt: Section with count, six filter Chips, LeadCards with a meeting line and concepts progress, tap opens the detail.
- Every page-injected style string (history, notes, playbook, form, detail) now lives in uiStyles. Old detail and Booked markup and CSS are gone. Hex went from 520 to 472.

## 2. Files created, changed, deleted

Created: `src/components/LeadDetail.jsx`, `src/components/CallbackPicker.jsx`, `src/shared/pricing.js`, `src/lib/ics.js`, `src/ui/Collapsible.jsx`, `src/ui/lead.styles.js`, `reports/PROMPT-08-REPORT.md`.
Changed: `src/pages/AdminBooked.jsx` (rewritten, 1207 lines to 96), `src/pages/AdminLeads.jsx` (local Block, LeadDetail, and detail CSS removed; uses the shared detail), `src/pages/AdminCalls.jsx` (autostart preset; no page-injected styles), `src/pages/AdminApp.jsx` (forced loading for Booked), `src/components/LeadPlaybook.jsx` (editable mode), `src/components/LeadNotes.jsx` (`field` prop), `src/components/LeadHistory.jsx` (styles moved), `src/shared/semantics.js` (CONCEPT_STATUSES, CONCEPT_PRESETS), `api/_semantics.js`, `api/admin/call-leads.js`, `src/ui/index.js`, `src/ui/icons.jsx`, `docs/COMPONENTS.md`, `scripts/layout-audit.mjs`.
Deleted: nothing at file level.

## 3. Additive fields, sanitize entries, migrations

| Field | sanitize() | Notes |
|---|---|---|
| `email` | already present | now editable from the profile |
| `address` | `str(b.address, 300)` | new |
| `meeting.location` | `str(b.meeting.location, 300)` inside the meeting object | new |
| `concepts[]` | `{ id str 40, label str 120, status in CONCEPT_STATUS_IDS else planned, link str 400 }`, max 30 | new; the old `conceptsTracker` stays untouched and is no longer read by the detail |
| `gamePlan[]` | `{ serviceId str 60, checked bool, note str 300 }`, max 40 | new; the old `servicesPlanned` stays for the Clients screen |
| `pricingOptions[]` | builder keys `id, packageId, addonIds[] (max 12), retainerId, recommended, note` plus the old `label, price, plan, retainer, notes`, max 3 | one field, superset shape. Old options without `packageId` are migrated in memory into an option whose note holds the old label, price, retainer and notes; the builder writes the old keys alongside the new ones (label = package, price = total, plan = full/6mo/12mo, retainer = "Site Care $100/mo") so Clients keeps reading them |
| `prepNotes` | already present | bound through LeadNotes |
| `callbackAt` | Prompt 7 | editable and clearable from the detail |
| Concept status enum | `CONCEPT_STATUSES` in semantics; `CONCEPT_STATUS_IDS` in `api/_semantics.js` | planned, generating, ready, shown |

No data was rewritten on the server; migrations happen at read time and persist only when an option is next edited.

## 4. pricing.js exports

`SINGLE_CAP` 750, `EXTRA_ROUND { design: 50, web: 75 }`, `REVISION_ROUNDS` 2; `PACKAGES` (Social Refresh 150, Brand Starter 350, Web Essentials 500, Brand Complete 600, Web Complete 750, Launch Plan 1200 as 200 x 6, Build Plan 1800 as 300 x 6 or 150 x 12, each with `kind`, `included[]`, and the plan where one applies); `RETAINERS` (Site Care 100, Content Kit 250, Ad Creatives 350, Growth 500 with included lists); `ADDONS` (business card design 30 free with any package, printed cards 35 for 250 and 50 for 500, NFC card 25 free with Launch and Build, stickers 40, vinyl decals 60, rush 20); `packageOf`, `retainerOf`, `addonOf`, `defaultRetainer(packageId)` (Site Care for web, Content Kit otherwise), `gifts(packageId)`, `planFor(total, packageId)` (a package's own plan, else 6 months over the cap, 12 months from 1500), `priceOption(opt)` returning package, paid and free add-ons, total, plan, retainer, included list, `money`, `planLine(plan)` ("$1,200 as $200 a month for 6 months, first payment starts the project").

## 5. Write sequences

- Reschedule: Sheet collects date, time, type, location; one PATCH `meeting: { ...existing, date, time, type, location }`.
- Won: Modal with optional note; one PATCH `{ stage: 'client', clientSince: now, bookedOutcome: { result: 'won', reason: note, at: now } }`; success toast with an "Open in Clients" action; the detail closes.
- Lost: one PATCH `{ stage: 'lost', bookedOutcome: { result: 'lost', reason: note, at: now } }`; six-second undo PATCHes `{ stage: previous stage, bookedOutcome: { result: 'lost', reason: '', at: '' } }` (an empty `at` reads as no outcome; the Booked "Awaiting outcome" filter checks `bookedOutcome.at`).
- Convert to client is the Won write; nothing else changes on the record.
- Every other edit is one `$set` through AdminApp's optimistic `onPatch` with rollback and an error toast.

## 6. Confirmations

- `grep -rn "ld-detail|ld-top|ld-block|bk-detail|GrowInput|PriceCard" src` returns nothing.
- Style strings: `leadHistoryStyles`, `leadNotesStyles`, `playbookStyles`, `leadFormStyles`, `leadDetailStyles`, and `leadCardStyles` all live under `src/ui/` and ship in `uiStyles`; no page or component injects them. The Leads, Booked, and Call Console pages inject only their own page sheet.

## 7. Em dashes

Six fixed: four in the old Leads form and detail copy (removed with that markup), two in the old Booked copy. `grep -c "—"` on AdminLeads, AdminBooked, and LeadDetail returns 0.

## 8. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 8 (de9b2ef) | 520 | 102 |
| After Prompt 8 | 472 | 100 |

## 9. Layout audit

Pending Prompt 7 tally, now complete: 205 checks clean at every width (40, 40, 40, 43, 42), zero offenders, exit 0. Appended to the Prompt 7 report.

Prompt 8 checks added: Booked list with each filter, Booked skeleton, booked detail on Overview, Playbook, Meeting, Notes, History, with three pricing options, call mode on, the Reschedule sheet, the Won dialog, the Edit all sheet, and the lead detail on Playbook, Notes, History. The run on the final build is in progress at the time of this commit; its tally is appended below in a follow-up commit.

## 10. Decisions

- One `pricingOptions` field with a superset shape instead of a second field, so the Clients screen and older records keep working without a server migration.
- Services game plan lists the packages and retainers from pricing.js rather than the old free-form services list; `servicesPlanned` stays untouched for Clients.
- The old `conceptsTracker` is not migrated automatically; the new `concepts[]` starts empty with a one-tap "Add the usual five".
- Call mode collapses blocks through the new kit `Collapsible` (measured height) and remembers the choice per lead.
- Lost keeps a `bookedOutcome` record; undo blanks its `at` rather than deleting the field, since PATCH cannot unset.
- Missing social links use a small Modal to add the value rather than an in-row InlineEdit, so the icon row stays a row.
- Clients is unchanged and still lists stage won and client leads; the Won write moves a lead straight to client as the prompt specified.

## 11. Skipped or deferred

- Clients does not use LeadDetail yet (Prompt 10).
- Reordering intel lines by drag works on desktop only; mobile uses the Menu.
- The Calendar screen (Prompt 9) will replace the .ics download as the primary path.
- `conceptsTracker` and `servicesPlanned` remain on old records until a cleanup pass.

## 12. What Prompt 9 must know

- Meeting data: `meeting { date 'YYYY-MM-DD', time 'HH:MM', type call|video|in-person, location }` on stage booked, won, client leads; `meetingDate(lead)` in `src/lib/booked.js` returns the Date; `src/lib/ics.js` builds the calendar file.
- Callbacks: `callbackAt` ISO string; `src/shell/notifications.js` already computes due, overdue, and upcoming from it; `CallbackPicker` in `src/components/` is the shared editor.
- Concepts: `concepts[] { id, label, status, link }` with statuses from `CONCEPT_STATUSES`.
- Opening LeadDetail from outside Leads: `shell.openRecord(lead)` routes by stage (lead to Leads, booked to Booked, won and client to Clients) and hands the screen `openId = { id, n }`; both Leads and Booked render `LeadDetail` for it.
- Hex baseline for Prompt 9 is 472.
