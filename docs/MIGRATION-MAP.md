# CRM 3.0 MIGRATION MAP

Verdicts: **REUSE** (keep, reskin via tokens), **REBUILD** (same job, new build),
**EXTEND** (reuse + grow), **RETIRE** (goes away or absorbed), **NEW** (does not
exist yet). Data stays additive throughout; nothing here implies a schema break.

## Screens and major components → 3.0 destination

| Today | 3.0 destination | Verdict | Notes |
|---|---|---|---|
| AdminApp shell (icon rail / 5 thumb tabs + More sheet) | **App shell**: desktop sidebar, mobile bottom tabs, top bar, command bar, notifications | EXTEND | Rail→sidebar with labels; More sheet stays the mobile overflow. Command bar is NEW (the reverse-lookup sheet + "/" shortcut is its seed — generalize to leads/clients/actions). Notifications NEW (push exists; no in-app inbox) |
| `AdminLayout.jsx` primitives (PageShell/ScrollArea/StickyFooterBar/.lay-card + tokens) | Layout foundation for every 3.0 screen | REUSE | The one part of the codebase already built as a system. Extend tokens rather than replace (LAYOUT.md rules stay) |
| Dashboard (greeting, funnel, activity/money stat cards, recent activity) | **Dashboard** | REBUILD | Keep greeting concept (fix the Rob name strings), funnel, calls/money/retainer stats; rebuild on shared token/stat-card primitives; add scheduled-task health (enrichment.lastScanAt exists to power it) |
| Leads page (panel list + detail, bulk delete, import, LeadForm) | **Leads: kanban + table + cards + filters** | EXTEND→REBUILD | Detail view largely reusable; the list view is rebuilt three-way (kanban by stage/priority, table, cards). Filters/facets exist; normalize industry casing at read time |
| Call Console session builder | **Call Console: session builder** | REUSE | Recently rebuilt to exactly this job. Fold in saved presets (revive `vz_builder_preset` properly) |
| Call Console session view + outcome bar + lookup + summary | **Call room, queue, outcomes, callbacks** | EXTEND | Keep keyboard/swipe/persistence/lookup wholesale. Add a first-class Callbacks view (today callbacks are only a builder chip + dashboard count) |
| Booked workspace (sections, call mode, pricing cards, concepts) | **Lead detail and Booked workspace** | REUSE | Newest, most designed surface; align its Section/GrowInput/PriceCard patterns into shared components |
| Clients page (purchases ledger, contact log, checklists, add/edit) | **Clients: list, detail, projects, payments, retainers** | EXTEND | Purchases→payments exists; retainers are label-derived today — consider an explicit additive `retainer{}` field in 3.0. "Projects" = checklists + deliverables (deliverables NEW) |
| — | **Calendar** | NEW | Data already exists: `meeting{date,time,type}` on booked leads + `calendarUrl()` helper + Calendly PAT endpoint. A month/week view over meetings + callbacks |
| Submissions/Orders ListSection + linking | System→Data or Leads-adjacent inbox | EXTEND | Linking (linkedLeadId) carries over; Orders likely joins **Studio** |
| Prints shop (`/prints` public) | **Studio: print orders** | EXTEND | Public shop stays; its orders must become Mongo-only (already POST /api/submissions) and drop the localStorage mirror |
| PrintsAdmin (localStorage orders/clients/invoices/briefs/analytics/maintenance) | **Studio (orders) + Clients (invoices) + System (maintenance)** | RETIRE | Absorb: shop orders→Studio on Mongo; invoices→Clients payments; briefs→Submissions; localStorage analytics→retire; maintenance toggle→System. Plaintext portal passwords must not survive the migration |
| ClientPortal + IntakeForm (localStorage accounts/briefs) | Out of CRM scope; future client-facing rework | RETIRE (later) | Not part of the 15-prompt admin rebuild; keep running untouched until a portal project replaces it |
| Booked concepts tracker | **Studio: concepts library, review tracker** | EXTEND | Per-lead tracker exists; Studio adds the cross-client library view |
| Settings (security, notifications, export, recently deleted, legacy tools) | **System: settings, data, integrations, scheduled task health** | EXTEND | Recently-deleted + restore + purge carry over; add task health from `enrichment` fields; integrations = Calendly/Web3Forms/push status |
| Checklists / LinkedSubmissions / SocialLinks / LeadImport / GrowInput / Section / lookup sheet | 3.0 shared component library | REUSE | Promote the page-local ones (Section, GrowInput, PriceCard, Block, ConfirmModal) into `src/components/` |
| Maintenance screen, marketing site, layout-audit + migrate scripts | Unchanged | REUSE | The audit script must grow with every new 3.0 screen |

## Endpoints

| Endpoint | Verdict |
|---|---|
| `/api/admin/call-leads` (GET/POST/PATCH/DELETE + restore/purge) | **Keep as is**, extend sanitize additively per prompt (it already carries the whole pipeline) |
| `/api/admin/leads/import` | Keep as is |
| `/api/admin/submissions` (+linking) | Keep as is |
| `/api/admin/export` | Extend (add call_leads/clients export) |
| `/api/admin/login` / `logout` / `session` | Keep as is |
| `/api/admin/settings` | Extend (task-health read; consider absorbing the leads purge so one action purges everything) |
| `/api/admin/push-subscribe` | Keep; add endpoint-dedupe when touched |
| `/api/push-key` | Keep as is |
| `/api/submissions` (public) | Keep as is |
| `/api/calendly-meetings` | Keep for portal; Calendar screen may reuse it server-side. Retire only if the portal retires |

Nothing is retired immediately; PrintsAdmin's localStorage "endpoints" (it has none) disappear with the screen.
