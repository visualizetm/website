# PROMPT 13 REPORT: Cleanup and retirement

Branch claude/enable-maintenance-page-oDW2r, fast-forwarded to main after every part.
One commit per part: 7fe33b5 (last components onto the kit), c8b13af (retire the legacy screens), c5f9f1e (dead code and enums), 7074561 (styles), 3226283 (docs). Each was built, put through scripts/dates-test.mjs, and audited before the next part; the tallies are in section 9. No feature changed; every live screen behaves as before.

## 1. What was removed, per part, with the evidence

Part 1, last components onto the kit
- Checklists, LinkedSubmissions, and SocialFields rebuilt on Card, Checkbox, Input, Button, IconButton, ListRow, Pill, Collapsible, and Grid; props and LeadDetail usage unchanged. SocialButtons deleted (only importer was the old Clients screen, removed in Prompt 10): grep SocialButtons in src returns the one comment in SocialLinks.jsx that says it went.
- Login rebuilt on Card, Input, Button; the wrong-password shake is `.aa-login.is-shaking` on `--v-dur-slow` and `--v-ease-out`, off under prefers-reduced-motion.
- Removed CSS: .aa-input, .aa-btn, .aa-btn--primary, .aa-iconbtn, .aa-login-input and the old login block, .aa-shake. grep for each in src returns 0 (the new login rules are .aa-login-card, .aa-login-title, .aa-login-sub, .aa-login-input on the kit Input, .aa-loginpage).
- The two direct date reads: computeDashboard's purchases month bucket uses toMs(p.at); LeadHistory's sort uses toMs. grep `new Date(p.at)` and `new Date(b.at) - new Date(a.at)` in src returns 0.
- Em dashes in admin copy and comments removed from booked.js (delete reasons now "Has call history, cannot delete", and LeadCard splits its menu label on the comma), LeadImport (option and cell placeholders read "none"), and comments in phone.js, api.js, dates.js, socials.js, main.jsx, ThemeToggle.jsx, AdminApp.jsx. Repo-wide grep for the em dash in src, excluding marketing pages and index.css, leaves the shop's Items parser regex in lib/orders.js (it must match the dash the site writes) and the escaped placeholder constants in LinkedSubmissions and AdminSubmissions (data the old form stored), none of them copy.

Part 2, retire the legacy screens
- Deleted src/pages/PrintsAdmin.jsx, src/pages/ClientPortal.jsx, src/pages/IntakeForm.jsx, src/components/SplashScreen.jsx, api/calendly-meetings.js. Before deleting: PrintsAdmin was mounted only from App.jsx (two host branches) and linked from Settings; ClientPortal and IntakeForm only from App.jsx; SplashScreen imported only by ClientPortal; calendly-meetings fetched only by ClientPortal. After: grep for each name in src, api, scripts, docs returns 0 (TOKENS.md keeps one row saying it was retired).
- src/lib/adminPaths.js lost ADMIN_PRINTS (no importer); the Settings Danger zone lost the print dashboard link and keeps the design system link.
- Prints.jsx (kept, it is the shop): the checkout's localStorage mirror (vz_print_orders) and the unused orderData object are gone; the cart moved to sessionStorage under the same vz_cart key (survives a refresh, not a device); the POST to /api/submissions is unchanged. The audit's new shop checkout step drives the real shop, captures the POST, builds the order with the server's own orderFromSubmission, and fails unless Print Orders shows it.
- main.jsx no longer reads vz_maintenance_preview (the flag was written only by PrintsAdmin); VITE_MAINTENANCE_MODE is the only switch.
- Retired keys: grep vz_clients, vz_invoices, vz_intake_forms, vz_analytics, vz_maintenance_preview, vz_portal_session, vz_sid in src, api, scripts returns 0 in code (docs list them as unread). vz_print_orders is read by exactly one place, the Settings Data device import (src/lib/orders.js readLocalOrders). Nothing clears or renames any key.

Part 3, dead code and enums
- src/lib/booked.js: planLabel, monthlyOf, calendarUrl, PROJECT_CAP, prepStatus, PREP_META, meetingCountdown, lastContact, totalPaid deleted (grep 0 importers each, before and after). Kept: effectiveStage, deleteBlockReason, checklistProgress (AdminLeads), meetingDate (LeadDetail, events, ics, AdminBooked), SERVICES and serviceLabel (CommandBar still labels servicesPlanned on older leads).
- PREP_STATUSES and prepStatusOf removed from semantics (PREP_META was the only consumer); api/_semantics.js never mirrored them. ORDER_STATUSES label map removed from semantics, src/ui/semantic.js LISTS, and the Design page; ORDER_STATUS_IDS stays in api/_semantics.js for the submissions status whitelist (old shop-order submissions still carry those ids).
- Endpoints: api/admin/stripe/subscriptions.js deleted (no caller anywhere). Every other route has a caller (section 4).
- Dependencies: every package in package.json is imported (xlsx by LeadImport, web-push by notify, mongodb by the api, react-router-dom by the marketing site and App, @untitled-ui/icons-react everywhere, @babel/runtime pinned because the icon package needs the v7 helpers, playwright-core by the audit, vite and the React plugin by the build). Nothing to remove; the lockfile is unchanged.
- Components and hooks with no importer: src/components/CaseStudies.jsx deleted (grep 0). useReveal.js is imported by Hero.jsx and stays.
- Docs that described removed things: docs/DESIGN-BASELINE.md, docs/CLIENTS_PAGE_PROMPT.md, docs/CRM_UPGRADE_PROMPT.md deleted. scripts/migrate-mongo.mjs stays (it copies a database between clusters, which is still true). reports/ is untouched.

Part 4, styles
- scripts/css-orphans.mjs extracts every class selector from CSS-in-JSX style strings and index.css and reports the ones no JSX renders (literal class names, template prefixes, is- and has- states); marketing files and the maintenance screen are excluded, `--all` includes them.
- It found one orphan, `.lay-modal-box` in ScrollArea.jsx (the kit Sheet and Modal size their own box); removed. LAYOUT.md updated.
- Consolidation: the list page rules (.cl-shell, .cl-page, .cl-search, .cl-clear, .cl-stack, .cl-muted, .cl-muted-cell, .cl-cell-biz) were defined in AdminClients but used by Orders, Concepts, Reviews, Submissions, and Settings; they now live once in the kit stylesheet (src/ui/lead.styles.js clientStyles) next to the split panel rules (.po-*) that moved there from AdminOrders in Prompt 12. AdminClients keeps only its table and panel rules.
- index.css: only marketing and maintenance (.uc-) rules; the admin reads nothing from it except the font loads in index.html and the shared reset. The grid texture the login page uses is the token `--v-grid-texture`.

Part 5, docs
- docs/ARCHITECTURE.md rewritten (stack, directory map, screens, components, endpoints with callers, collections and sanitize shapes, env vars, crons, browser storage, scripts, known issues). docs/MIGRATION-MAP.md replaced by the "Migration complete" note (what was retired and when). docs/RUNBOOK.md added. LAYOUT.md, docs/COMPONENTS.md, docs/TOKENS.md updated for Prompts 12 and 13.

## 2. Files created, changed, deleted

Created: scripts/css-orphans.mjs, docs/RUNBOOK.md, reports/PROMPT-13-REPORT.md.

Changed: src/components/Checklists.jsx, src/components/SocialLinks.jsx, src/components/LinkedSubmissions.jsx, src/pages/AdminApp.jsx (Login, aa- stylesheet), src/pages/AdminDashboard.jsx, src/components/LeadHistory.jsx, src/components/LeadCard.jsx, src/components/LeadImport.jsx, src/components/ThemeToggle.jsx, src/lib/booked.js, src/lib/socials.js, src/lib/adminPaths.js, src/shared/phone.js, src/shared/api.js, src/shared/dates.js, src/shared/semantics.js, src/ui/semantic.js, src/ui/ScrollArea.jsx, src/ui/lead.styles.js, src/main.jsx, src/App.jsx, src/pages/Prints.jsx, src/pages/Contact.jsx, src/pages/AdminSettings.jsx, src/pages/AdminClients.jsx, src/pages/AdminDesign.jsx, scripts/layout-audit.mjs, .gitignore, LAYOUT.md, docs/ARCHITECTURE.md, docs/COMPONENTS.md, docs/TOKENS.md, docs/MIGRATION-MAP.md.

Deleted: src/pages/PrintsAdmin.jsx, src/pages/ClientPortal.jsx, src/pages/IntakeForm.jsx, src/components/SplashScreen.jsx, src/components/CaseStudies.jsx, api/calendly-meetings.js, api/admin/stripe/subscriptions.js, docs/DESIGN-BASELINE.md, docs/CLIENTS_PAGE_PROMPT.md, docs/CRM_UPGRADE_PROMPT.md.

## 3. Redirects added (src/App.jsx)

| From | To | Where |
|---|---|---|
| /prints and /admin/prints on the admin host | /orders | Navigate replace, before AdminApp mounts |
| /admin/prints on localhost | /admin/orders | same |
| /portal and /intake/* on the public host | /contact?from=portal | Navigate replace; Contact renders the notice "The client portal has moved. Email contact@visualizeclients.com and we will send your files." when from=portal |

/prints on the public host still renders the shop.

## 4. Endpoint inventory after cleanup

| Route | Callers |
|---|---|
| /api/admin/call-leads | AdminApp, AdminCalls, AdminLeads, AdminSettings, ui/useOptimisticPatch, AdminDesignComponents, the audit |
| /api/admin/leads/import | LeadImport |
| /api/admin/submissions | AdminApp, AdminSettings, the audit |
| /api/admin/projects | AdminApp, the audit |
| /api/admin/orders | AdminApp, the audit (App.jsx mentions the path only as a redirect target) |
| /api/admin/concept-packs | AdminApp, the audit |
| /api/admin/settings | AppShell, AdminDashboard, AdminSettings, the audit |
| /api/admin/calendly/events | AppShell, the audit |
| /api/admin/stripe/events | AdminSettings |
| /api/admin/stripe/reconcile | AdminSettings |
| /api/admin/backup | AdminSettings |
| /api/admin/export | AdminSettings |
| /api/admin/push-subscribe | AdminSettings |
| /api/admin/login, /api/admin/logout | AdminApp |
| /api/admin/session | AdminApp, AdminCalls, the audit |
| /api/push-key | AdminSettings, the audit |
| /api/submissions | Start.jsx, Prints.jsx, the audit (AdminApp and nav.js mention the path as a screen name) |
| /api/stripe/webhook | Stripe (AdminSettings shows the URL) |
| /api/cron/reminders, /api/cron/daily | vercel.json |

Removed this prompt: /api/calendly-meetings (portal only), /api/admin/stripe/subscriptions (no caller).

## 5. Dependency changes

None. package.json and package-lock.json are unchanged; every dependency has an importer (section 1, Part 3). The build, the PWA manifest, and public/sw.js are untouched and the audit's service worker registration path still works.

## 6. css-orphans results

| Run | Result |
|---|---|
| Before Part 4 (after Parts 1 to 3) | 1 orphan of 845 classes: .lay-modal-box (ui/ScrollArea.jsx) |
| After Part 4 | No orphan class selectors across 844 classes in 123 files |

## 7. Bundle size (vite build)

| Asset | Before Prompt 13 (501fe73) | After Prompt 13 (3226283) |
|---|---|---|
| assets/index.js | 1,254.49 kB (gzip 326.92 kB) | 1,066.69 kB (gzip 287.51 kB) |
| assets/xlsx.js (lazy chunk) | 429.53 kB (gzip 143.08 kB) | 429.53 kB (gzip 143.08 kB) |
| assets/index.css | 10.32 kB (gzip 2.97 kB) | 10.32 kB (gzip 2.97 kB) |

The main bundle dropped 187.8 kB (39.4 kB gzipped), almost all of it the three retired screens.

## 8. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 13 (501fe73) | 364 | 93 |
| After Part 1 | 351 | 88 |
| After Part 2 | 150 | 62 |
| After Prompt 13 | 150 | 62 |

What remains is the marketing site (Home, Services, Work, CaseStudy, Contact, Start, LeadPartner, Prints and their components), index.css, the token definitions themselves in src/ui/tokens.js, and main.jsx's maintenance screen.

## 9. Layout audit

Prompt 12 tally: 745 checks clean, 0 failures (320, 390, 430 at 145 each; 768 and 1280 at 155 each), exit 0. The full table is in reports/PROMPT-12-REPORT.md section 9.

Per part (build, dates-test, layout audit after each commit):
| Part | Build | Widths | Checks | Failures | Exit |
|---|---|---|---|---|---|
| 1 (kit rebuilds) | 7fe33b5 | 390 (Clients block) and 1280 (everything) | 287 | 0 | 0 |
| 2 (retire screens) | c8b13af | 390 | 146 | 0 | 0 |
| 3 (dead code) | c5f9f1e | 390 | 146 | 0 | 0 |
| 4 (styles) | 7074561 | 390 | 146 | 0 | 0 |
| 5 (docs) | 3226283 | covered by the final run below | | | |

Part 1's first 390 pass found two overflows (checklist labels, linked submission row side) that were fixed before its commit; the 287 checks above are the re-run on the fixed build. Parts 2 and 4 include the shop checkout end-to-end step (Audit Shopper appeared in Print Orders).

Final full run on the final build (3226283), every screen at 320, 390, 430, 768, 1280, including the shop checkout step that must produce a Print Order:
| Width | Checks | Failures |
|---|---|---|
| 320px | 146 | 0 |
| 390px | 146 | 0 |
| 430px | 146 | 0 |
| 768px | 156 | 0 |
| 1280px | 156 | 0 |
| Total | 750 | 0 |

Exit 0. dates-test: 16 of 16 (TZ=America/New_York).

## 10. Left in place and why

- SERVICES and serviceLabel in src/lib/booked.js: the command bar labels servicesPlanned on older leads.
- ORDER_STATUS_IDS in api/_semantics.js: old shop-order submissions still carry those status ids and the submissions PATCH whitelist must keep accepting them.
- scripts/migrate-mongo.mjs: still an accurate one off database copy tool.
- src/hooks/useReveal.js: marketing (Hero.jsx).
- The aa- rules that remain: .aa-app (content row), .aa-main and .aa-main--wide (list and detail split), .aa-panel, .aa-embed, and the login block; all on tokens, all rendered.
- vz_print_orders in localStorage: read once by Settings Data; never cleared.
- The marketing pages' raw hex and index.css: out of the admin's scope.
- @babel/runtime: pinned for the icon package.

## 11. Environment variables

| Variable | Unlocks |
|---|---|
| MONGODB_URI | Every api/ route (nothing loads without it) |
| SESSION_SECRET | The signed admin cookie; rotate it to sign every device out |
| ADMIN_PASSWORD | Sign in until a password is set from Settings Profile (then settings.auth wins) |
| VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY | Web push: device enable, reminders, test push |
| WEB3FORMS_NOTIFY_KEY | Email backup of new submissions |
| CALENDLY_TOKEN (or CALENDLY_PAT) | Calendly events on the Calendar and in the drawer |
| CRON_SECRET | The reminders and daily jobs, and the health document they write |
| STRIPE_SECRET_KEY | Stripe read endpoints (recent events, reconcile listing) |
| STRIPE_WEBHOOK_SECRET | The signed webhook that writes payments to the ledger (503 until set) |
| ADMIN_URL | Deep links in push notifications (defaults to the admin host) |
| VITE_MAINTENANCE_MODE, VITE_MAINTENANCE_PASSWORD | The public maintenance screen and its unlock (the per device preview flag is gone) |
| VITE_WEB3FORMS_KEY | The public forms' Web3Forms fallback (a public key by design) |

## 12. What Prompt 14 (motion, loading, and the light theme toggle) must know

- Theme stub: `.lay-root[data-v-theme='light']` in src/ui/tokens.js holds placeholder values and is wired to nothing. The marketing site has its own `[data-theme='light']` in index.css and the pre-paint script in index.html reading vz_theme; the admin ignores both. A toggle belongs in Settings Profile and the TopBar menu, writing the same vz_theme key so both halves agree.
- Motion primitives already in the kit: Stagger (list entrance), Reveal (scroll entrance), Collapsible (height), Sheet and Modal (open and close), Toast, ProgressBar and ProgressRing; durations and easings are tokens (`--v-dur-fast`, `--v-dur-base`, `--v-dur-slow`, `--v-ease-out`, `--v-ease-spring`, `--v-ease-in-out`). The login shake and the Prompt 13 components use them; nothing hardcodes a duration outside the marketing site.
- Weakest skeleton coverage: Calendar (one block skeleton for all three views), LeadDetail (none of its own, it relies on the list skeleton and mounts sections with Stagger), Design page (none), Login (none), the Call Console room (the builder and queue have skeletons, the room does not), the Concepts pack detail and the Reviews sheet (no skeleton while a pack or client resolves).
- Weakest entrance coverage: Table rows (no Stagger on any Table), the Calendar week grid and month cells (no Reveal), Settings tab switches (the Stagger runs once per tab but the Tabs bar itself has no indicator motion), the right panel on Orders, Concepts, and Submissions (appears without a slide), the notifications drawer groups (no stagger).
- Every screen mounts through PageShell and ScrollArea, so a page level transition can live in one place (src/ui/PageShell.jsx).
- Reduced motion: src/ui/tokens.js carries a global prefers-reduced-motion block, and Skeleton, Spinner, ProgressBar, and the login shake check it individually; Stagger and Reveal rely on the global block only.
- Hex baseline for Prompt 14 is 150; css-orphans baseline is 0; the audit fixtures already include the shop checkout step.
