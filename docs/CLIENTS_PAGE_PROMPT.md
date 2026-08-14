# CLIENTS PAGE 2.0 — client management prompt

Working prompt for upgrading the CRM's Clients page from a pipeline endpoint
into a real client-management workspace. Follows the same skill guidance as
docs/CRM_UPGRADE_PROMPT.md (frontend-design + ui-ux-pro-max): briefing-sheet
hierarchy, resilient text, 44px+ touch targets, no emoji, red reserved for
primary actions, tested 320→1440.

═══════════════════════════════════════════════════════════════════
WHAT THE PAGE MUST DO
═══════════════════════════════════════════════════════════════════
Manage every current client in one place: what they paid for, task lists,
manual contact tracking, direct add/edit — without touching the pipeline
behavior that already feeds this page (won → first-invoice-paid → client).

1. **WHAT THEY PAID FOR** — a purchases ledger per client (additive
   `purchases: [{ label, amount, at, notes }]`):
   - "Add purchase" inline form: what it was, $ amount, date (defaults
     today), optional note. Rows list newest-first with a running TOTAL
     PAID figure, big and prominent. Rows removable (with confirm).
   - The client list card shows total paid at a glance.

2. **ADD CLIENTS DIRECTLY** — an "Add client" button on the list header
   opens a form (business*, contact name, phone, email, area, industry,
   socials, notes). Creates a record with stage 'client' + clientSince now,
   through the existing guarded POST — no new endpoint. Skips the pipeline
   entirely for clients Rob already has.

3. **EDIT ANYTHING** — pencil on the detail header opens the same form
   pre-filled (business, contact, phone, email, area, industry, socials).
   Delete lives behind the edit form with a confirm (soft delete).

4. **MANUAL CONTACT TRACKING** — a contact log per client (additive
   `contactLog: [{ type, at, note }]`, type ∈ call / meeting / email /
   text / other):
   - "Log contact" quick form: type chips, date (defaults today), short
     note. One tap to record "called them today."
   - CONTACT HISTORY timeline merges manual entries with the read-only
     Call Console history (labeled so they're distinguishable).
   - "Last contacted" is computed from the most recent of either log and
     shown on every client card — with an amber nudge when it's been more
     than 14 days, because meaning must not rely on color alone the chip
     also says the number of days.

5. **KEEP** — checklists, linked submissions, services sold, pricing
   presented, notes, tap-to-call, "First invoice paid" for won leads,
   "Move back to Booked". The won → client flow is unchanged.

═══════════════════════════════════════════════════════════════════
LAYOUT / HIERARCHY
═══════════════════════════════════════════════════════════════════
- Detail resting order: header + tap-to-call → TOTAL PAID + purchases →
  contact history (log form on top) → checklists → services/pricing →
  submissions → notes. Money and recency are what Rob checks first.
- Desktop: two-column briefing sheet (money + contact left, tasks +
  submissions + reference right), full width beside the rail, capped on
  ultrawide. Mobile: single column, same order, thumb-reachable forms,
  bottom-sheet feel for the add/edit form.
- List cards: business, CLIENT/AWAITING INVOICE tag, total paid, last
  contacted chip ("3d ago" / "18d — reach out" in amber), services glance.

═══════════════════════════════════════════════════════════════════
DATA / BACKEND — additive only, existing endpoints
═══════════════════════════════════════════════════════════════════
- sanitize() gains `purchases` (≤50, amounts clamped ≥0) and `contactLog`
  (≤200, type whitelisted, strings capped). Nothing renamed or dropped.
- All writes ride the existing guarded PATCH/POST with optimistic UI and
  rollback. Layout audit extended with purchase/contact hostile fixtures.
