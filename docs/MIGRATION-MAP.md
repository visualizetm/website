# MIGRATION COMPLETE

The CRM 3.0 rebuild (prompts 1 to 13, September 2026) replaced every legacy
surface. The old map that lived here is in git history (before Prompt 13).

Retired, with the prompt that removed it:

| What | Replaced by | Removed in |
|---|---|---|
| Old Leads, Booked, Clients, Dashboard, Call Console screens on aa- markup | Kit screens (Prompts 5 to 10) | Prompts 5 to 10 |
| ListSection and ItemDetail (Submissions and Orders) | AdminSubmissions, AdminOrders | Prompts 11 and 12 |
| SettingsSection | AdminSettings | Prompt 12 |
| PrintsAdmin (localStorage orders, clients, invoices, briefs, analytics, maintenance toggle) | Print Orders, Clients, Submissions, Settings Data import | Prompt 13 |
| ClientPortal and IntakeForm (localStorage accounts and briefs) | Nothing; /portal and /intake/* redirect to /contact with a notice | Prompt 13 |
| SplashScreen, api/calendly-meetings.js | Nothing (portal only) | Prompt 13 |
| The shop's localStorage order mirror (vz_print_orders) | /api/submissions, which now also writes an orders document | Prompt 13 |
| Checklists, SocialLinks, LinkedSubmissions, Login on old markup | Kit builds | Prompt 13 |
| aa- stylesheet (rows, groups, detail, settings, controls) | Kit styles; only the content row, list panel, embed, and login rules remain | Prompts 12 and 13 |
| PREP_STATUSES, ORDER_STATUSES label map, dead booked.js helpers | Kit semantics; ORDER_STATUS_IDS stays server side for old submissions | Prompt 13 |

Legacy localStorage keys are never cleared or renamed: vz_print_orders is
read once by Settings Data (Import print orders saved on this device); the
others (vz_clients, vz_invoices, vz_intake_forms, vz_analytics,
vz_maintenance_preview, vz_portal_session) are simply no longer read.
