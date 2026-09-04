# PROMPT 06 REPORT: Leads. Kanban, table, cards, filters, bulk actions

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`.
Commits: Table kit component (6524ac4), Leads rebuild (dc6ecf8), Section fix (add340c), this report.

## 1. What was built

- The Leads list screen rebuilt on the kit: a Section header with the count line, Kanban / List switch persisted per device, search, Import, Add lead; saved views (three defaults on first run) with rename, update, delete; four filter groups (Status, Priority, Industry with a More popover, Data) whose counts reflect the other active filters; an active-filter summary with Clear all.
- Kanban by call status (Not called, Callback, No answer, Said no) with collapsible columns, a column menu that starts a session with those leads, drag and drop on desktop, long press to lift on touch, windowing at 60 cards with Show more, Stagger on the first batch, snap scrolling on mobile.
- Table view on desktop (new `Table` kit component) with ten columns, sorting, selection, column chooser, sticky header and first column. Mobile List view is a Stack of LeadCards with a sort Select and Show more.
- `src/components/LeadCard.jsx`: the shared card with avatar, New pill, priority, normalized industry pill, descriptor, tap-to-call phone, socials row, status pill, last touched, next action, enrichment dot with Tooltip, and a Menu (call, priority, status, socials, delete with the safety reason). `LeadCard.Skeleton`.
- Bulk bar: priority, status, Add to session (ids preset), Export CSV, Delete with the protected-lead count and a six-second undo Toast that restores through the existing restore path.
- Possible duplicates: client-side pairs by phone or normalized name within an industry, grouped with a Merge action. Merge Modal with per-field radios; winner receives chosen fields plus unioned arrays and stamped notes, loser is soft deleted with `deletedReason: 'merged'` and `mergedInto`.
- LeadImport now renders inside the kit Sheet. The local ld-toast is gone in favor of useToast. The detail view opens unchanged behind the new list.

## 2. Files created, changed, deleted

Created: `src/ui/Table.jsx`, `src/components/LeadCard.jsx`, `src/lib/leads.js`, `reports/PROMPT-06-REPORT.md`.
Changed: `src/pages/AdminLeads.jsx` (list rewritten; LeadForm, Block, LeadDetail and their CSS kept), `src/components/LeadImport.jsx` (Sheet container, overlay CSS removed), `src/pages/AdminCalls.jsx` (`ids` in builderPreset), `src/pages/AdminApp.jsx` (`onRestore`, forced loading for Leads), `api/admin/call-leads.js` (additive `mergedInto`, `?reason=merged` on DELETE), `src/ui/index.js` (Table), `src/ui/Section.jsx` (header wraps, action slot shrinks), `docs/COMPONENTS.md` (Table), `scripts/layout-audit.mjs`.
Deleted: nothing at file level. Old list JSX, the priority `Pill` local, the `ld-toast`, `ld-chip`, `ld-card`, `ld-item`, `ld-checkbtn`, `ld-list`, `ld-count`, `ld-prio`, `ld-empty`, `aa-bulkbar` rules for Leads, and the `li-overlay`, `li-head`, `li-x` rules are gone.

## 3. Table API

`<Table columns rows rowKey selectable selected onSelect sort onSort density onRowClick rowActions storageKey columnChooser empty rowClassName aria-label />`
- `columns`: `{ id, label, render(row), sortable, defaultDir, width, align: 'start'|'end', always }`. `always` columns cannot be hidden. The first column is sticky on horizontal scroll.
- `rows` are already sorted by the parent; `sort {id, dir}` is controlled through `onSort`.
- `selected` is a Set of keys; the header checkbox selects or clears all visible rows and shows indeterminate.
- `storageKey` persists hidden columns in localStorage; `columnChooser` renders the Columns popover in the header.
- `rowActions(row)` renders in a trailing cell (a Menu); `empty` renders below an empty body.
- `Table.Skeleton({ rows, cols, density, selectable })` matches the header shape.
Documented in `docs/COMPONENTS.md`.

## 4. Filter, count, search, sort, and duplicate rules

- Pool: leads whose `normalizeStage` is `lead`.
- Status: `callStatus` (missing reads as not-called) in the selected set. Priority: `priority` (missing reads as warm). Industry: `industryKey(industry)` in the selected keys; the facet list groups by that key, labels with `displayIndustry`, sorts by count then label, shows the top 8 with the rest in a More popover. Data: Has phone (`last10(phone)` non-empty), Has socials (`hasAnySocial`), Never scanned (no `enrichment.lastScanAt`), Possible duplicates (id in a duplicate pair); Data chips combine with AND.
- Nothing selected in a group means all. Chip counts are computed against every other active filter plus the search, so they always add up to the visible total; the duplicates chip shows the pair count in the pool.
- Search: a digit-only query matches when `last10(phone)` contains the typed digits (trailing fragments work); otherwise a case-insensitive substring over business, contact name, industry, descriptor.
- Sort options: Added newest first (default), Business A to Z, Priority hot first, Status, Last call newest, Most calls, Scanned newest. Ties fall back to business name.
- Duplicates: two leads are a pair when `last10(phone)` matches, or when `normName(business)` matches within the same `industryKey`. `normName` lowercases, strips punctuation, and removes the words the, llc, inc. Pairs are unioned into groups.
- Saved views store `{ filters, q, sort }` in `localStorage.vz_leads_views`; defaults To call, Callbacks, Hot leads are written once. The view switch lives in `vz_leads_view`; table columns in `vz_leads_cols`.

## 5. Merge implementation

No new endpoint. Merge is a client sequence over the existing routes:
1. PATCH the winner with `mergePayload`: chosen conflicting fields (phone, contact, descriptor, priority, socials) plus the union of `callLog`, `contactLog`, `purchases` (deduplicated, sorted by time) and `notes` appended with "[Merged from <business> on <date>]". Arrays are sent whole through the existing `$set`, which sanitize() already accepts.
2. PATCH the loser with `mergedInto: winnerId` (new additive key in sanitize).
3. DELETE the loser with `?reason=merged`, which sets `deletedReason: 'merged'` next to the existing soft-delete fields.
If step 1 fails nothing changes; if step 3 fails a toast says the loser must be deleted by hand.

## 6. builderPreset contract

`shell.go('calls', preset)` with `preset = { status?: string[], prio?: string[], ids?: string[] }`. When `ids` is present the Call Console builds the queue from exactly those leads in that order and shows a "Picked from Leads" chip (tap to clear). Status and priority chips still apply when `ids` is absent. The Dashboard sends `{ status: ['callback'] }`; the Leads bulk bar sends `{ ids }`; kanban column menus send `{ status: [column], prio: activePriorityFilter }`.

## 7. Old Leads code removed

The old list JSX (panel head, search wrap, chip row, count line, card list, checkbox buttons, bulk bar, `ld-toast`), its CSS, the `Users01Empty` helper, the local priority `Pill`, and the LeadImport overlay container. Confirmed by grep: no `ld-toast`, `ld-chip`, `li-overlay`, `setToast`, or `aa-bulkbar` in Leads or LeadImport. The old form and detail keep their markup for Prompt 8; they still contain four em dashes in existing copy, listed as deferred.

## 8. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 6 (4d1087b) | 593 | 107 |
| After Prompt 6 | 578 | 107 |

## 9. Layout audit

New checks: leads kanban, leads list, filtered by status chip, bulk bar, import sheet, duplicates, merge modal, skeleton, then the detail; `.ld-board`, `.ld-frow-chips`, and `.v-table-scroll` registered as intended horizontal scrollers; the fixtures gained a duplicate pair and enrichment data.

First full run on commit dc6ecf8:

| Width | Result |
|---|---|
| 320 | 17 clean, 10 failed: every Leads state plus the notifications and More sheets opened from Leads |
| 390 | 27 clean |
| 430 | 27 clean |
| 768 | 30 clean |
| 1280 | 30 clean |

Every 320px failure had the same single offender: the Section header's action slot (view switch, Import, Add lead) could not shrink, so it ran 57px past the viewport. Fixed in add340c by letting the action slot shrink and wrap. The rerun on that build is in progress at the time of this report; its result is appended in the follow-up commit to this file.

## 10. Decisions

- Card and row writes use AdminApp's `onPatch`, which is already the optimistic apply-and-rollback pattern, plus an error toast here; `useOptimisticPatch` was not duplicated on top of it.
- Kit Menu has no submenus, so priority and status changes are flat groups of items separated by dividers, with the current value disabled.
- The kanban keeps the four open statuses; leads with a booked status never reach the pool because `normalizeStage` moves them to Booked.
- Between 768 and 1279px the board keeps 320px columns with snap scrolling; all four columns fit only from 1280px.
- Desktop List view is the Table; the mobile List is LeadCards. The detail split keeps the left panel as a compact card stack (80 rows) rather than the board.
- Brand social icons do not exist in Untitled UI; website, Instagram, Facebook, and Maps use globe, camera, thumbs up, and pin.
- Export CSV covers the selected leads, or everything currently filtered when nothing is selected.
- View rename uses a browser prompt for now; a kit form field would need a Modal per view.

## 11. Skipped or deferred

- Existing form and detail copy still contain em dashes (Prompt 8 migrates both).
- Call Console pieces still on the old overlay markup: the outcome sheet, the keyboard sheet, the reject sheet (`cc-sheet-back`), and the edit and new-lead panels (`cc-overlay`, `cc-panel`).
- Touch drag uses a 450ms long press with a fixed ghost; no auto-scroll while dragging.
- Chip counts recompute on every render; fine at 500 leads, memoize per group if the list grows.

## 12. What Prompt 7 (Call Console) must know

- `import LeadCard, { leadMenuItems } from '../components/LeadCard'`. Props: `lead`, `onOpen`, `selected`, `selectable`, `checked`, `onCheck`, `actions { onPriority, onStatus, onDelete, onOpenSocials }`, `compact`, `dragging`; extra props spread onto the root. `LeadCard.Skeleton({ compact })`. Styles come from `leadCardStyles` (injected by the Leads page; the console must inject them too until they move into `uiStyles`).
- `builderPreset` contract: section 6. `ids` is the key the bulk bar uses.
- Old overlay markup left in the console: section 11. Replace with Sheet and Modal.
- Filter preset contract from Prompt 5 is unchanged and now also accepts a raw industry string, normalized with `industryKey`.
- Hex baseline for Prompt 7 is 578.
