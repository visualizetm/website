# Notifications audit (read only)

| | |
|---|---|
| Date | 2026-10-30 |
| Code audited | Production `daa0c7f` (2026-10-29 21:31Z, "Next up on the home: Coming up above Overdue"), the deploy `dpl_BFphH61RfSKZXkNY2mkPra8tbyJc` named in the brief. GitHub's Vercel status on that commit reads "Deployment has completed". The code was read from a read-only extract of that commit, not from the working tree. |
| Question | Rob uses the CRM as an installed iPhone app and wants a lock screen notification at the exact minute a task, callback or meeting is due, and for anything else the CRM promises. Nothing arrives. |
| Scope | Audit only. No app code, config, env var, cron or database record was changed. Database reads were limited to `settings`, `push_subscriptions` and counts from `call_leads` and `projects`. No secret, key, token or subscription endpoint is printed here. |

Status words: **Working** (proven end to end in production), **Built, untested** (code complete, never run in production), **Partial** (links missing), **Broken** (code exists but fails), **Missing** (promised, not in code), **Unknown** (cannot be proven from code or from what this session could reach; the line says what would prove it). iPhone items use Met, Not met or Unknown, and Met means the code satisfies the requirement, not that the phone has it.

## 1. Verdict

**No, notifications do not work today.** Every push that depends on a timer (callbacks, meetings, tasks, the 8:30 digest, the email rules, queued sends, the client sweep) is dead at its first link: the cron URL is answered by the single page app, so the function never runs. Behind that, nothing has ever proven that a push reached any phone: every send is tested only against a stub, and the app hides delivery failures. The pushes that do not need the cron (Send test notification, /start submissions, client portal actions, reviews, concept answers, planner ideas) are built and could work today, but none has ever been shown to arrive.

## 2. What was and was not checked

| Check | Result |
|---|---|
| Every notification path in `api/`, `src/`, `public/`, `vercel.json`, `index.html` | Read in full on the production extract (four independent traces, each re-checked by a verifier; 39 citation or overstatement corrections were applied). |
| Tests that touch reminders, push, cron, notify, email rules, portal, planner | Run against the production extract, section 11. |
| `settings`, `push_subscriptions`, `call_leads`, `projects` | Read-only, section 12. |
| `GET https://admin.visualizeclients.com/api/cron/reminders`, `/api/cron/daily`, `/api/push-key`, `/sw.js`, `/manifest.webmanifest` | **Not run: Unknown.** This session's network policy does not resolve `admin.visualizeclients.com` (both curl and the built-in fetch failed with "tunnel failed 403" and "getaddrinfo ENOTFOUND"). The host would have to be added to the session's allowed domains. The brief's observation is quoted below as reported, not re-observed. Commands to run it are in Appendix B. |
| Real iPhone behaviour | Cannot be proven from code. Section 15. |

## 3. Cron routing: is the `[job].js` theory confirmed?

**Confirmed from the code, and consistent with the production response reported in the brief. Not re-observed in this session.**

Reported in the brief: `GET /api/cron/reminders` returned `200`, `content-type: text/html`, `x-vercel-cache: HIT`, with the SPA's `index.html`.

Why the code produces exactly that:

- `vercel.json:269-278` registers `/api/cron/reminders` (`* * * * *`) and `/api/cron/daily` (`0 6 * * *`).
- The rewrites list (`vercel.json:47-156`) has 22 `/api/admin/...` rules and 4 public ones (`/api/concepts`, `/api/review`, `/api/portal`, `/api/unsubscribe`), then the catch-all `"source": "/(.*)", "destination": "/index.html"` at `vercel.json:152-154`. Nothing matches `/api/cron/*`.
- The only handler for those URLs is the dynamic file `api/cron/[job].js` (`:10-19`, reads `req.query.job`). It is the only file under `api/` with a `[` in its name. There is no `functions`, `framework` or `routes` key in `vercel.json`.
- Every exit of the handlers is JSON: `[job].js:17` (404), `cron-reminders.js:261` (401 `{"error":"unauthorized"}`), `handler.js:23,25,30` (405, 413, 500). A `200 text/html` cannot be the function, so it is the static `index.html`. This content argument is the proof. The `HIT` header is only corroboration (the admin host sets `Cache-Control: no-store` on `/(.*)` at `vercel.json:184-200`, and the brief does not say which host was probed).
- Both crons share the file, so the daily cron is dead as well.
- The same failure class already happened in this repo: commit `8af27eb` (2026-09-07, side branch `origin/auth-rebuild`) says production answered 405 to every `POST /api/admin/login` after the admin routes were collapsed into a dynamic dispatcher, and fixed the admin half with plain file names plus explicit rewrites "listed before the SPA catch-all so the catch-all cannot swallow them". The cron half has the identical shape and was never revisited.
- No Vercel documentation page found settles the precedence of a user catch-all rewrite over a dynamic `[param]` function in a project with no framework preset. The docs do say the filesystem takes precedence over rewrites for real files, and the Gatsby page shows a dynamic API route needing an explicit rewrite. Treat both as supporting, not as proof.

What falling to `index.html` means: no invocation, no database access, no log line, no error anywhere, and Vercel's scheduler receives `200` so its own cron log looks healthy.

### Corrections to the brief

- **`6294443` (2026-10-16) is not the commit that merged the crons.** It changed two docs files (`docs/MOBILE-DECISIONS.md`, `docs/MOBILE-PROGRESS.md`). The dynamic file was created in `b516ac2` (2026-09-05, "collapse api routes for Hobby function limit"), which is on `origin/auth-rebuild`. This sandbox's clone of `main` is shallow (grafted at `d87a7c3`, 2026-09-21, whose tree already holds the file and whose parent is not present locally), so `main`'s visible history makes the file look like it appeared on Sep 21. Functionally the file is unchanged since `b516ac2`; only its comment differs. The cron has therefore been unreachable since the dynamic form first deployed, not since Oct 16. Before `b516ac2` the crons were plain files that exceeded the Hobby 12 function cap and a Hobby schedule limit (per the commit messages of `b516ac2` and `b93d2e3`), so no plain-file cron is known to have deployed.
- **Minute mode (`6284160`, 2026-10-28) changed only the schedule and the logic, not the routing.** It shipped on top of a route that was already unreachable. Until then the reminders cron was a once-a-day 13:00Z digest.
- **The catch-all predates every cron** (first present in `vercel.json` on 2026-02-09, commit `d648577`) and `vercel.json` has never had an `/api/cron` rewrite on any branch.
- **No gate noticed.** Tests call `scripts/email-lib.mjs:494-495` (`load('cron/[job].js')`) or `runReminders` directly with a hand-built request. Rewrites are asserted for other routes (`email-lib.mjs:185-186,407`, `analytics-test.mjs:126`) but nothing requests a cron path through `vercel.json`.
- **The product already showed the symptom** and nothing escalated it: Settings prints "Reminders ran never; the daily job ran never" (`src/pages/AdminSettings.jsx:353`) next to a green "Armed" pill (see section 7).

### Plan tier: Unknown, and it matters

A per-minute cron needs the Pro plan. The repo's own commit messages say the project was on Hobby on 2026-09-05 (`b93d2e3`: Hobby rejects the 15 minute schedule; `b516ac2`: Hobby 12 function cap). `6284160` and `docs/RUNBOOK.md:70` assert "Pro allows a per minute cron" with no proof of an upgrade. `CLAUDE.md` still holds the project to 10 of 12 functions, a Hobby limit. The deploy of `daa0c7f` succeeded with `* * * * *` in `vercel.json`, which is weak evidence the plan accepts it. Proof: the team's plan in the Vercel dashboard and the project's Cron Jobs tab listing both crons. If the plan is Hobby, exact-minute pushes are impossible even with routing fixed and a different scheduler is needed.

## 4. Status table, one row per path

All "Broken" rows below fail at the same first link (the trigger is unreachable) unless a different link is named. "Chain" is trigger > server > send > service worker > tap target.

| Path | Status | Evidence |
|---|---|---|
| Callback push at the minute `callbackAt` passes | **Broken** (trigger) | `cron-reminders.js:100-109`; first break `vercel.json:153-154`. Also only fires when `callStatus === 'callback'` (`:100`), see section 13 item 7. |
| Meeting push at the minute it starts | **Broken** (trigger); coverage **Partial** | `cron-reminders.js:110-119` reads raw `l.stage` in booked, won, client (not `normalizeStage`); Calendly events are never read by the cron. |
| Task push at `remindAt`, or at due time when Remind me is Off | **Broken** (trigger) | `cron-reminders.js:125-148`. |
| Morning digest, first run at or after 8:30 AM New York | **Broken** (trigger) | `cron-reminders.js:176-221`. |
| Retainer bill and review ask reminders | **Broken** (trigger); exist only inside the digest | `cron-reminders.js:182-195,214-215`. |
| Daily cron (06:00Z) | **Broken** (route); sends no notification by design | No `sendPush` in `cron-daily.js`. It feeds `nextBillAt`, Callbacks due, stage heals, and writes `health` at `cron-daily.js:255`. |
| Queued email send, email rules, client push sweep | **Broken** (trigger) | `cron-reminders.js:227-248`; the rules push `api/_lib/email/rules.js:94-95`; the sweep `clientPush.js`. |
| Subscribe and permission (Settings, Notifications, This device) | **Built, untested** | `src/pages/AdminSettings.jsx:47-61` (permission from the tap handler at `:53`, `userVisibleOnly: true` at `:58`, POST `:59`); `api/_routes/push-subscribe.js:9-13`. 3 Apple rows exist (section 12). Whether iOS accepts the key passed as a string (`:58`; the portal converts to bytes, `Portal.jsx:603,623`) and whether subscribe still counts as inside the tap after two awaits (`:55,57`) are Unknown until the phone test. |
| Service worker show and tap | **Built, untested** | `public/sw.js:51-62` always calls `showNotification` (never silent); `:64-75` focuses a window and calls `navigate(url)`, else `openWindow`. |
| Send test notification | **Built, untested**; reports success it cannot know | `AdminSettings.jsx:303,144`; `api/_routes/settings.js:172-174` returns `{ ok: true }` after `sendPush`, which swallows every error except 404 and 410 (`notify.js:33-37`) and returns silently without VAPID keys (`notify.js:7,20`). The toast "Test notification sent to every subscribed device." appears with zero devices. A 500 only comes from a malformed key or a database error. |
| In-app bell and notifications drawer | **Working** (in app only, no OS notification) | Production record `settings.notifications`: created 2026-09-30, `lastSeenAt` 2026-10-29T22:12:53Z, 94 `readIds`. Items are built on the client from `nextUpItems` and records (`src/shell/notifications.js`). It never depends on the cron, and it has no check that the reminders job is alive (`notifications.js:100-109` only checks enrichment and scraper). |
| Preferences | **Partial** | Section 8. |
| Client push (to a client's own devices) | **Built, untested** | `notify.js:16,24-27`; portal subscribe door `portal-public.js:250`; sweep `clientPush.js`. The portal lives on `visualizestudio.org` (`api/_lib/portalModules.js:10`, `clientPush.js:12`), a different origin from the admin. |
| `/start` submissions (brief, contact, review, shop) | **Built, untested**; does not need the cron | `submissions.js:173-178` (push gated by `prefs.pushEnabled`, plus a Web3Forms email that needs `WEB3FORMS_NOTIFY_KEY`, Unknown if set). Tap opens `/?submission=<id>`. |
| Client portal actions to Rob (approve, change request, print reorder, site change) | **Built, untested**; does not need the cron | `portal-public.js:148,192,228`. |
| New review | **Built, untested**; no cron | `review-public.js:106`. |
| Concept answers (Review each) | **Built, untested**; no cron | `concepts-public.js:120` (tap `/leads/<leadId>/concepts?set=<setId>`). |
| Client idea from the planner | **Built, untested**; no cron | `planner.js:216`. |
| Email failed push, email rule pushes | Failed send push **Built, untested** (inline); rule pushes **Broken** (cron) | `api/_lib/email/failed.js:33`; `api/_lib/email/rules.js:94-95`. |
| Calendly booking push | **Missing** | No Calendly webhook; `calendly-events.js` is a read-only client feed. |
| Stripe payment received push | **Missing** | `api/stripe/webhook.js:30-32` stores and stamps health only. |
| Invoice overdue or retainer bill due push to Rob | **Missing** (bills appear only in the digest, which is Broken) | No `sendPush` for invoices outside the digest. |
| New scraped lead, enrichment or scraper health push | **Missing** | Bell items only (`notifications.js:105-106,110-115`). |
| Planner approvals and change requests, concept picks | **Missing** as push | Bell items only; portal approvals do push (`portal-public.js:148`). |
| Email to Rob | **Partial** | Only the Web3Forms backup for form submissions (`notify.js:53-70`). |
| Quiet hours | **Missing**, never promised | No code. |

## 5. The reminder path, traced

1. **Trigger.** Vercel cron `GET /api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>`. Dead (section 3).
2. **Auth.** `cron-reminders.js:256-261`: no `CRON_SECRET` or a mismatch is 401 JSON. The env var exists for Production per the brief; it is not proven to be in the deploy that is live (a redeploy followed the last edit).
3. **Selection** (`runReminders`, `:84`). Indexes at `:59-70`. Callbacks: leads with `callStatus: 'callback'` and a `callbackAt` at or before now (`:94,100-102`). Meetings: stage booked, won or client with `meeting.date`, converted by `zoneMeetingMs` (`:110-112`). Tasks: checklist items and legacy next actions with `remindAt`, else the due time (`:125-148`). Per-type switches come from `settings.notifications.reminders` (`:88`).
4. **Dedupe.** Callbacks and meetings use `sentReminderKeys` (cap 2000, `:44,103,113,223-224`); tasks stamp `notifiedAt` inside the record's checklists (`:165-173`).
5. **Stale rule.** More than 6 hours late is stamped without a push (`:45,106,116,147`).
6. **Send.** Ten or more due at once become one combined push (`:154-156`); otherwise one `sendPush` each (`:158-161`).
7. **The failure mode that matters.** `sendPush` returns nothing. `sendTo` swallows every error except 404 and 410 (`notify.js:33-37`), `initVapid` returns silently when the keys are missing (`notify.js:7,20`), and the cron counts a send and stamps the item handled whatever happened (`cron-reminders.js:158-175,222-225`). **A send that reaches no device, or is refused by Apple, consumes the reminder permanently**, with no log and no retry. The first time this runs against an empty or mismatched subscription it will silently eat that minute's reminders.
8. **Health.** `cron-reminders.js:251` writes `settings.health` on every completed run. `cronGates` is written on the first full run (`:230-243`). `sentReminderKeys` only when something was handled (`:222-225`).

The production database has none of the three (section 12), which fits "never completed a run". `settings.health` has four writers (`cron-reminders.js:251`, `cron-daily.js:255`, `backup.js:17`, `stripe/webhook.js:31`), so no completed run of either cron has happened. Whether the cron was "never invoked" or "invoked and crashed" cannot be separated without Vercel runtime logs (Appendix B).

## 6. The push layer

- `api/_lib/notify.js:19-39`. Payload is `{ title, body, url }`. `web-push` 3.6.7 is called with no options (`:32`), so it uses its defaults: TTL 4 weeks, urgency normal, no topic, no request timeout (`node_modules/web-push/src/web-push-lib.js:13,112`). The cron refuses anything over 6 hours late, but Apple is told to hold each push for 4 weeks, so a push accepted while the phone is off can arrive days stale as if fresh. Whether Apple wants `high` urgency for an exact-minute alert is **Unknown** here (no Apple or RFC 8030 page could be read).
- A fresh VAPID JWT is built per send per device. Apple's guideline is to refresh at most hourly; no evidence of refusal, noted for bursts.
- **Owner devices** are rows without `role: 'client'` (`notify.js:15`). The admin subscribe door saves `{ subscription, updatedAt }` keyed on the endpoint and never sets or clears `role` (`push-subscribe.js:9-13`); the portal door upserts the same key and sets `role: 'client'` (`portal-public.js:250`). The theory that the portal overwrites Rob's row is **disproved for production**: the portal is on `visualizestudio.org` and the admin on `admin.visualizeclients.com`, so they never share a service worker registration or an endpoint. The latent role flip exists in code only.
- Subscriptions carry no device name or created date, so a dead or old row cannot be told from a live one.
- `pushsubscriptionchange` is not handled and nothing re-POSTs the subscription on app open. If a row is pruned on 404 or 410, Settings keeps showing "Push is on for this device" (`AdminSettings.jsx:49,307`) with no button to save it again, and there is no Turn off.
- Payload size is far below Apple's 4 KB limit.

## 7. Client side

- **Registration** `src/main.jsx:138-143`: `navigator.serviceWorker.register('/sw.js')` after first paint, failure swallowed (`:140`). Scope is `/`. `public/sw.js` is served with `Cache-Control: no-cache` (`vercel.json:260-266`). `worker-src 'self'` and `manifest-src 'self'` are in the admin CSP (`vercel.json:194`).
- **Manifest.** `index.html:9` links `/site.webmanifest` (`display: "browser"`). An inline script swaps it to `/manifest.webmanifest` (`display: "standalone"`, `scope: "/"`, `start_url: "/"`, 192, 512 and maskable icons) on the admin host (`index.html:36`). I recomputed the inline script's sha256: it equals the hash pinned in the CSP, so the swap runs. A Home Screen icon made from the public host, or before the swap, opens as a Safari shortcut and cannot receive push (`ADMIN_GUIDE.md:33-35` warns about this). There is no fallback `apple-mobile-web-app-capable` tag on the manifest path (`index.html:66-67`).
- **Settings screen** (Settings, Notifications). Reminder toggles at `AdminSettings.jsx:289-300`; "Send test notification" at `:303`; the "This device" card at `:305-309` (`Enable push on this device`, or "Push is on for this device", or "This browser cannot receive push. On iPhone, install the app to your Home Screen first."); the "Install the app" card at `:312-316`. The enable flow ends in a silent `error` state with no message (`:56,61`).
- **Honesty of the status UI.** The green "Armed" pill and the "Next run" cell depend only on `CRON_SECRET` being set (`api/_routes/settings.js:97`, `AdminSettings.jsx:198,352-353,375`). "Reminders ran never" appears beside it. There is no alarm when the reminders job is not running.
- **Service worker.** `push` (`sw.js:51-62`): parses JSON, falls back to the title "New submission" and body "Open the admin panel to view it.", icon `/icon-192.png`, badge `/badge-96.png`, `data.url`. No `tag`, no `renotify`. `notificationclick` (`sw.js:64-75`): closes the notification, then for the first open window calls `navigate(url)` without awaiting it and `focus()`, else `openWindow(url)`. All pushes carry absolute `https://admin.visualizeclients.com/...` URLs (`cron-reminders.js:92`, `submissions.js:176`). `clients.claim()` runs on activate (`sw.js:24`), so windows are normally controlled and `navigate` should work; behaviour on iOS is Unknown.
- **Deep links.** `/leads?open=<id>`, `/tasks?open=<id>`, `/booked?open=<id>` (redirects to `/deals?open=` in `AdminApp.jsx:444`; point the push at `/deals` and retire `/booked`), `/?submission=<id>`. The morning digest opens `/` (Analytics), not Next up, despite `docs/RUNBOOK.md:87-88`.
- **Session.** The installed app needs a valid `vz_admin` cookie both to Enable push and when a notification is tapped; sessions last 30 days with no renewal (`api/_lib/config.js:19`, `auth.js:7`), so a tap after expiry lands on the sign in screen. The deep link is opened by an effect that runs once signed in (`AdminApp.jsx:541-553`); whether the URL is still intact after the sign in screen is Unknown.

## 8. Preferences

- `settings.prefs` has `pushEnabled` and `emailEnabled` (both `true` in production). **`pushEnabled` is read only by `/start` submissions** (`submissions.js:173`); the reminders cron never reads it (`cron-reminders.js:84-93`), nor does `sendPush`.
- `settings.notifications.reminders` carries six switches saved by `api/_routes/settings.js:40-45`: meetings, callbacks, bills, reviews, tasks, ideas. The cron reads five (`:88`). All default to on; the production doc has no `reminders` field. There is no switch for concept answers (`concepts-public.js:117` reads `reminders.concepts`, which the whitelist drops), portal actions, reviews or email pushes.
- Drawer Read and Snooze do not affect pushes: a snooze stores `snoozedUntil`, which the cron never reads (only a callback snooze re-times the push).
- "Remind me: Off" still pushes at the due time (`cron-reminders.js:144`), and every quick-add and template task is created with Off (`src/lib/taskWrite.js:43-50`).
- A task created by an event push (review, portal approval, failed email, client idea) also pushes a second "Task: ..." at its due time once the cron works, so each of these events notifies twice.

## 9. Time zones and DST (DST ends Sunday 2026-11-01)

- **Sound.** All server date rules go through `api/_lib/zone.js` (Intl `America/New_York`; `zoneMs` iterates to the wall clock, `:24-35`): the 8:30 digest and 9:00 rules gates (`cron-reminders.js:48-49,56,179,237`), meeting instants (`:111`, `zone.js:41`), day keys and display times. They follow the change on their own.
- **Callbacks and tasks are ISO instants** written by the browser (`toISOString`), so nothing moves: a 6 PM task for Nov 2 is stored as 23:00Z and fires then.
- **One hard-coded offset: `api/planner.js:126,129`** returns `<day>T13:00:00.000Z` for the New idea task's due time. That is 9:00 AM EDT until Saturday night and 8:00 AM EST after. The cron pushes the task at that instant (`cron-reminders.js:144-146`). Fix: `zoneDateAt(key, 9, 0)`. This also makes `planner-endpoint-test` fail from the 19th of every month on (section 11).
- **No zone on one read.** `api/_lib/taskRules.js:162,198` (mirrored in `src/shared/taskRules.js:168`) parses `meeting.date` and `meeting.time` with no zone (UTC on Vercel), so the 24 hour "booked" window shifts by 4 hours in EDT and 5 in EST. It affects which email drafts the 9:00 rules write, not pushes.
- **Travel.** Meeting date and time are typed in the phone's zone but read by the cron as New York (`OutcomeSheet.jsx:23`, `AdminCalendar.jsx:122`). Right while the phone is in New York.
- The daily cron `0 6 * * *` is 2:00 AM EDT and 1:00 AM EST. Cron schedules are UTC. No impact.

## 10. iPhone checklist

| Requirement | Status | Evidence |
|---|---|---|
| App installed to the Home Screen, iOS 16.4 or later | **Unknown** | Only the phone can say. Install card reads "Installed. You are running the home screen app." when standalone (`AdminSettings.jsx:314`). An old install from `visualizestudio.org` may still exist (`ADMIN_GUIDE.md:33-35`). |
| In-app instructions to install | **Met** | `AdminSettings.jsx:308,316`. The guide names a button that no longer exists under that label (`ADMIN_GUIDE.md:31`). |
| Permission asked from a user tap | **Met** (prompt) / **Unknown** (subscribe) | `Notification.requestPermission` is the first await in the button handler (`AdminSettings.jsx:53,309`); `pushManager.subscribe` follows a network call and the worker wait (`:55,57,58`), which iOS may or may not count as inside the tap. |
| `userVisibleOnly: true` | **Met** | `AdminSettings.jsx:58`. |
| Every push shows a notification (no silent push) | **Met** in code | `sw.js:51-62`. |
| Manifest `display: standalone` with a matching scope | **Unknown** for the installed icon | `public/manifest.webmanifest:6-7` is standalone with scope `/`, but the icon only gets it via the runtime swap (`index.html:9,36`). |
| Service worker scope covers the admin routes | **Met** in code | `/sw.js` at root, `main.jsx:140`. Registration failure is swallowed, so a live worker on the phone is not proven. |
| HTTPS | **Met** | HSTS `vercel.json:178-179`. |
| VAPID subject valid | **Met** | `notify.js:8` `mailto:` address. Whether Apple accepts the JWT is **Unknown**. |
| VAPID pair matches the keys the 3 stored subscriptions were made with | **Unknown** | Env values were not read. A mismatch gives a silent 4xx that this code discards (section 5). |
| Small payload | **Met** | Title, body and one URL. |
| Icon sizes | **Met** | 192, 512, maskable, badge 96 (`manifest.webmanifest:11-13`, `sw.js:57-58`). |
| Content Security Policy does not block push, worker or manifest | **Met** | `worker-src 'self'`, `manifest-src 'self'` (`vercel.json:194`); the swap script's hash is pinned. |
| Tap opens the right screen inside the installed app | **Unknown** | `sw.js:64-75`; behaviour of `navigate` and `openWindow` on iOS, a killed app, and a signed-out session are only provable on the phone. |
| Delivery on the lock screen within the minute | **Unknown** | Depends on iOS Notifications settings for the app, Focus and Scheduled Summary, and on urgency and TTL (section 6). |
| App icon badge | **Not met** | No Badging API use anywhere. |
| Recoverable path after Don't Allow or a dead subscription | **Not met** | The button is disabled when blocked (`AdminSettings.jsx:309`); no Turn off, no re-subscribe. |

## 11. Tests run

Run against the production extract with `TZ=America/New_York`. They exercise the code with a fake database and a stubbed `sendPush`; **none sends a real push or goes through `vercel.json` routing**, so a green result says nothing about delivery.

| Test | Result |
|---|---|
| `minute-reminders-test` | pass, 18 of 18 |
| `task-reminder-test` | pass, 26 of 26 |
| `next-action-test`, `rules-test` | pass, identical in New York and UTC |
| `deals-test`, `lists-test`, `tasks-test` (65), `score-test`, `analytics-test` | pass |
| `portal-test` | pass, 249 checks |
| `portal-crm-test`, `review-link-test` (42), `concepts-review-test` (37), `showcase-endpoint-test`, `concepts-endpoint-test`, `stripe-pay-test` (16) | pass |
| `send-email-test` | pass, 51 checks |
| `security-test` | pass, 1155 checks |
| `email-test` | **352 of 353 before 9:00 AM New York, 353 of 353 after.** The one check ("the reminders cron runs the rules and answers the counts") needs the daily rules gate, which opens at 9:00 AM New York (`cron-reminders.js:49,237`). It was re-run at 09:03 New York and passed. Clock dependent, not a code fault. |
| `pipeline-test` | **fail, 127 passed and 1 failed** ("the health list keeps the earlier heal and adds today's two"). Daily cron health list, unrelated to push; the same failure exists on earlier commits. |
| `planner-endpoint-test` | **fail, 1 failing** ("the New idea task lands on the client's Ideas checklist, due the day before the preferred date"). The test prefers the 20th of the current month (due the 19th), so it fails from the 19th of every month on; it also shows the hard-coded `13:00Z` in `planner.js:126,129`. |

Not run: browser audits (not relevant to delivery) and anything needing the production host.

## 12. Production and database checks (read only)

Database `visualize` on the CRM cluster; only the collections named above.

- `settings` has 20 documents: `dashboard`, `client-log`, `profile`, `landing`, `notifications`, `prefs` and several `rate:*` limiter docs. **No `health` document and no `cronGates` document.**
- `settings.notifications`: fields are `_id`, `createdAt`, `lastSeenAt`, `readIds`, `updatedAt` only. **No `sentReminderKeys`, no `lastReminderAt`, no `reminders` field** (all per-type switches default on). Created 2026-09-30; `lastSeenAt` 2026-10-29T22:12:53Z; 94 read ids.
- `settings.prefs`: `pushEnabled: true`, `emailEnabled: true`.
- `push_subscriptions`: **3 documents**, all host `web.push.apple.com`, all with encryption keys present, **none with a `role` and none with a `leadId`**, so `ownerSubs` (`role != 'client'`) would return all three. Fields are `_id`, `subscription`, `updatedAt` only. `updatedAt`: 2026-08-05, 2026-10-21, 2026-10-28. Which of them is Rob's current phone, and whether any is still valid with Apple, is Unknown.
- `call_leads`: 746 records. 38 have a `callbackAt` field (all strings), 28 of them empty; of the 10 with a date, 4 are before Oct 16, none are between Oct 16 and now, and **6 fall in the next 7 days** (the count does not check `callStatus`, which the cron requires to be `callback`). 18 records have a `nextAction.dueAt`. `projects`: 9. Up to 6 callbacks could be the first real reminders once the route works.
- Production HTTP checks: see section 2 (Unknown from this session). The deploy status on `daa0c7f` is "Deployment has completed".

## 13. What is left, ranked by what blocks Rob first

"Blocks" means it stops the first push reaching the phone.

| # | Item | Size | Blocks |
|---|---|---|---|
| 1 | **Make the cron reachable**: rename `api/cron/[job].js` to `api/cron/index.js` (code unchanged, still reads `req.query.job`) and add `{ "source": "/api/cron/:job", "destination": "/api/cron/index?job=:job" }` above the catch-all in `vercel.json`. Keep the 10 function count. A change that does this, with a guard test, was prepared in the working tree of the session that wrote this audit and is **not committed or deployed**; production still has the fault. | S | **Yes** |
| 2 | **Confirm the plan** accepts a per-minute cron and that Settings > Cron Jobs in Vercel lists both crons. If it is Hobby, a different scheduler is needed for exact-minute reminders. | S | **Yes** |
| 3 | **Prove the device chain once, independent of the cron:** install from `admin.visualizeclients.com`, Enable push, Send test notification, see a lock screen banner (section 15). Then count the role-less rows and remove stale ones. | S | **Yes** (Rob's phone) |
| 4 | **Stop consuming a reminder that reached no device:** `sendPush` returns how many devices accepted; stamp `sentReminderKeys` and `notifiedAt` only when at least one did; log refusals; record `lastPushAt`, `lastPushError` and counts in `health`. | M | No, but the first failed send silently eats that minute's reminders |
| 5 | **TTL and urgency** on every push (for example a short TTL so a late push is dropped, and the urgency Apple recommends for alerts). Verify against RFC 8030 and Apple's page first. | S | No |
| 6 | **Make the app tell the truth:** Test button reports delivered, failed and zero-device counts; "Armed" and "Next run" come from `health.crons.reminders.lastRunAt`; show the enable error; a drawer System item when the reminders job is stale (extend `notifications.js:100-109`). | S to M | No |
| 7 | **Callbacks set from the record screen never push:** the record's callback picker writes `callbackAt` without `callStatus` (`src/components/LeadDetail.jsx:337`) and the cron requires `callStatus === 'callback'` (`cron-reminders.js:100`). Other writers set both (`AdminCalendar.jsx:116`, `LeadSwipe.jsx:19`, `callOutcome.js:15-18`). | S | Blocks callbacks set that way |
| 8 | **Re-sync subscriptions:** `pushsubscriptionchange` handler, re-POST the current subscription on app open, a Turn off and Refresh button. | S | No |
| 9 | **Before the first successful run:** queued emails have no staleness cutoff (`api/_lib/email/queue.js:16-23`), so every queued entry with a past `sendAt` goes out on the first minute (up to 200 rows); the daily job has never run, so its whole backlog runs once; event pushes also create a due task (double notification); stale reminders over 6 hours are stamped silently; if the first run is after 8:30 AM New York the digest fires that day. Decide and cap these first. | S | No (do before 1) |
| 10 | **DST:** `planner.js:126,129` to `zoneDateAt(key, 9, 0)`; `taskRules.js:162,198` zone-aware. | S | No (due before Sun Nov 1) |
| 11 | **Meeting coverage:** `normalizeStage` at `cron-reminders.js:110,203`; deal-stage records; meetings linked from Calendly (the cron never reads Calendly, `AdminCalendar.jsx:119-122`); an optional heads-up before the start (the 60 and 15 minute lookahead was removed by minute mode). | S to M | No |
| 12 | **Missing pushes:** payment received (S, `stripe/webhook.js:30-32`), invoice overdue (S), planner approvals and change requests and concept picks (S), Calendly booking (M, needs a webhook or polling), new scraped lead or enrichment health (M, scraper is outside the repo). | S to M each | No |
| 13 | **Preference gaps:** make the global Push toggle gate all pushes, honour drawer snooze, add switches for concept answers, portal actions and email pushes, relabel "Remind me: Off", decide on quiet hours. | S to M | No |
| 14 | **iPhone polish:** `apple-mobile-web-app-capable` fallback beside the manifest swap (`index.html:66-67`), await `navigate` with a catch in `notificationclick`, a `tag` so repeats replace each other, the Badging API for unread count, a session that survives a tap after 30 days. | S each | No |
| 15 | **Hardening of the minute job:** `notifiedAt` lives inside the client-owned `checklists` array, so a stale admin write can erase it and re-push the task (`call-leads.js:300-301`, `cron-reminders.js:167-169`); `sentReminderKeys` is read-modify-write (overlapping runs, double delivery); whole-collection scans every minute with no time budget; the portal's `pushDevices` count is never decremented after a prune. | M | No |
| 16 | **A test that requests `/api/cron/*` through `vercel.json`** (rewrite exists, sits above the catch-all, every cron path reaches a real function, no `[param]` file under `api/`). | S | No |
| 17 | **Docs** (section 14). | S | No |

## 14. Docs that overclaim

**(a) Claims the code does not implement.**

- `docs/RUNBOOK.md:116-117`: "Settings, Notifications shows the last twelve run times". The twelve stamps are stored (`cron-reminders.js:251`) but the page shows one label (`AdminSettings.jsx:152-153,301`).
- `docs/RUNBOOK.md:64` and `:29`: "Settings, Automation lists both jobs". There is no Automation tab (`AdminSettings.jsx:34-36,111`).
- `docs/RUNBOOK.md:94-95` (also `docs/MOBILE-DECISIONS.md:317`, `cron-reminders.js:21-22`): gate stamps "live on the notifications doc". They live in `cronGates` (`cron-reminders.js:230,242`).
- `docs/RUNBOOK.md:87-88`: the digest has "a deep link to Next up". It opens `/` (`cron-reminders.js:217`).
- `docs/ARCHITECTURE.md:292`: "/api/cron/reminders (once a day, morning digest)" contradicts `:21,:333` (every minute). `docs/PLANNER-TASKS-DESIGN.md:12` still says once a day on Hobby.
- `reports/PROMPT-09-REPORT.md:45` and the 709377f design: callbacks 15 minutes ahead and meetings 60 minutes ahead. Minute mode removed both; pushes fire only at the due time.
- `docs/CRM-REBUILD-BRIEF.md:1470`, `reports/PROMPT-12-REPORT.md:71,133`: per-event bill and review-ask pushes (`bill:<id>:<day>`). Bills and review asks appear only inside the 8:30 digest.
- `ADMIN_GUIDE.md:31`: tap "Enable notifications". The button reads "Enable push on this device" and lives under Settings, Notifications, This device. `ADMIN_GUIDE.md:41-42` sends desktop users to `/admin`, which redirects (`vercel.json:4-15`). The guide still describes only submission pushes.
- `docs/RUNBOOK.md:366` "Push never arrives" checklist (push is on, keys set, app installed) passes in exactly the reported situation and omits the cron and the owner row.
- App copy: "Test notification sent to every subscribed device." (`AdminSettings.jsx:144`) claims delivery it cannot know. "Armed" (`AdminSettings.jsx:352`) means only that `CRON_SECRET` is set.

**(b) Claims the code implements but that cannot hold in production today (the cron route).** Label these as overclaims against production until section 13 item 1 ships:

- `docs/RUNBOOK.md:70` and the header of `cron-reminders.js:9-43`: a push "the exact minute" a callback, meeting or task is due; minute precision on the Pro plan; Settings "Reminder timing" copy (`AdminSettings.jsx:152-153,301`).
- `docs/RUNBOOK.md:68,112-114`: "A job can be run by hand: curl ... /api/cron/daily and /api/cron/reminders". The first time that is tried it returns the SPA page.
- `docs/ARCHITECTURE.md:21,333`, `docs/RELEASE-NOTES-3.0.md:115-120`: both crons running, armed, with last and next run.
- The morning digest, the combined push for ten or more, the 6 hour stale rule, queued "Send tomorrow" emails within 15 minutes, the daily 9:00 email rules and their "N emails ready to send" push, the client push sweep, the daily job's retainer rolls and stage heals, and the drawer's 36 hour System item (which needs `health`).
- Every push in the docs is recorded as tested only against a stubbed `sendPush` (for example `reports/CONCEPTS-REVIEW-REPORT.md:52` "no device received one"). No doc or report records a production cron run or a push received on any phone.

## 15. Phone checks for Rob (only the iPhone can prove these)

1. **One push, no cron needed.** Open the Home Screen app (not Safari), Settings, Notifications. Confirm "This device" says "Push is on for this device" (or tap "Enable push on this device" and Allow) and the Install card says "Installed. You are running the home screen app." Lock the phone, then tap "Send test notification" from another device or before locking and wait. Expect a lock screen banner titled "Visualize test". If nothing arrives: iOS Settings, Notifications, Visualize., Allow Notifications on and Immediate Delivery, and check your Focus. A "sent" toast does not prove delivery.
2. **The tap.** Tap that banner from the locked phone, then again with the app fully closed. It should open the signed-in app. Note what screen it opens.
3. **After the route fix ships:** set a task due 3 minutes out with a reminder, lock the phone, and confirm "Task: ..." arrives on the minute. Any callbacks and meetings due in the coming days will also fire.

## Appendix A. First run once the route works

Expect, in the first minute: queued emails with a past `sendAt` go out (no cutoff, up to 200 rows, rate guard thirty an hour per `docs/EMAIL.md`); the daily job has never run, so its whole backlog runs at 06:00Z; reminders more than 6 hours late are stamped without a push; items due in that minute push (combined if ten or more); the digest fires on the first run at or after 8:30 AM New York; `health`, `cronGates` and `sentReminderKeys` appear. Each event push that also creates a due task will push again at the task's due time.

## Appendix B. Open unknowns and what would prove each

| Unknown | What would prove it |
|---|---|
| Production still returns the SPA for the cron paths | `curl -sS -D - -o /dev/null https://admin.visualizeclients.com/api/cron/reminders` and `/api/cron/daily`: today expect `200 text/html`; after the fix expect `401` with `{"error":"unauthorized"}`. Also Vercel runtime logs for `/api/cron/reminders`: no function invocation today. |
| The VAPID key is configured and served | `curl -s https://admin.visualizeclients.com/api/push-key` and check only that `key` is not `null` (do not paste it). |
| The deployed service worker and manifests match the repo | `curl -s https://admin.visualizeclients.com/sw.js \| shasum -a 256` should equal `6ffc437627363489a5951376dcdfa79f84f80fd0f67c19dd4b6e99afa2c66581`; `/manifest.webmanifest` `70a00977107e1b47e84bdee0ee76d90cc0f8ae4ad279bcc559dc5ef068c6b7d0`; `/site.webmanifest` `56b8b684ee4f3504e6f759289466f3e1f01a0ac7166f8a73390bbc75cc312531`. |
| Vercel plan, cron registration | Dashboard: team plan, project Settings, Cron Jobs tab listing `/api/cron/reminders` and `/api/cron/daily`. |
| `CRON_SECRET` existed when the live deploy was built | Redeploy after the last edit (the brief says one followed); after the fix, an authenticated GET returns `200` JSON `{ ok, checked, sent, digest, ... }` and a `health` document appears. |
| Which of the 3 Apple rows is Rob's phone and whether Apple accepts the VAPID JWT | Step 1 of section 15, then count the role-less `push_subscriptions` rows before and after; a row the send prunes (404 or 410) was dead. |
| That a push lands on the lock screen on the minute, and the tap target | Section 15 on the phone. |
| Whether `WEB3FORMS_NOTIFY_KEY` and `RESEND_API_KEY` are set | Vercel Production env list (names only). Without `RESEND_API_KEY` queued emails log as test sends but stamp the record as sent. |

## 16. Status after fix (the finish notifications job, 2026-10-30)

Written after the work, in the audit's own numbering (section 13). The job prompt swapped items 5 and 7 against this file: the audit's 5 is the TTL and urgency, 7 is callbacks set from the record screen. Words: **Built, verified by a test** means the code exists and a test in this repository fails when it is removed (scripts/notifications-guard-proof.mjs, scripts/routing-guard-proof.mjs and the proofs named below). It does **not** mean a phone received it. Nothing here is marked Working, because no production cron run and no push on a phone has been observed from this environment (it cannot reach admin.visualizeclients.com); section 15 and the report's phone checks are what turn these into Working.

| # | Item | Status now | Evidence |
|---|---|---|---|
| 1 | The cron route | Built, verified by a test. Deployed (fc94b3e, Ready). Production behavior unobserved. | `api/cron/index.js` plus the `/api/cron/:job` rewrite above the catch-all; `scripts/routing-test.mjs` (118 checks, in `npm run preship`) and `scripts/routing-guard-proof.mjs` (8 faults, including `[job].js` back, each fails). Check: GET `/api/cron/reminders` with no secret must answer 401 JSON, not HTML. |
| 2 | The plan accepts a per-minute cron | Unproven here; deploys are accepted | A sub-daily cron on a plan that does not allow it is rejected at deploy, and the deploys were Ready. Dashboard, Settings, Cron Jobs must list both jobs (phone check list, item 2). |
| 3 | The device chain, independent of the cron | Built, verified by a test; needs the phone | The Test button now says "Sent to N of M devices" or why not (`scripts/push-status-test.mjs`, `scripts/push-ui-test.mjs`); a lock screen banner is the proof. |
| 4 | Stop consuming a reminder that reached no device | Built, verified by a test | `sendPush` answers `{ attempted, delivered, removed, errors }` (`scripts/notify-test.mjs`); the cron stamps only on delivery, three tries then failed with the reason (`scripts/minute-reminders-test.mjs` sections 7 to 13); cutting the guard fails 13 checks. |
| 5 | TTL and urgency | Built, verified by a test | Due reminders `urgency: high`, 15 minutes; the digest normal, 6 hours; the rest normal, a day (`notify-test`). Whether Apple honours the header is unproven (the phone proves delivery). |
| 6 | The app tells the truth | Built, verified by a test | Armed needs a run in the last 3 minutes, keys and a subscribed device; last 5 runs; red alarm at 10 minutes on Settings and the home; the daily job pushes the same alarm (`push-status-test` 29, `push-ui-test`, `minute-reminders-test` 13). |
| 7 | Callbacks set from the record screen | Built, verified by a test | One rule, `callbackAtOf` / `callbackDue`, read by Next up and the cron, whatever callStatus says; manual callback rows count; closed, answered, declined and parked do not (`scripts/coverage-push-test.mjs` sections 1 and 2, including the same 13 records through `nextUpItems`; guard `callback-needs-callstatus`). The picker still writes `callbackAt` alone, so those callbacks are not on the Callbacks due list, the calendar or the tab count (docs/MOBILE-DECISIONS.md). |
| 8 | Re-sync subscriptions | Built, verified by a test; iOS behavior unknown | `pushsubscriptionchange` in `public/sw.js`, a save of the subscription on every app open when notifications are allowed, a flag when the last device is removed, "Turn push on again" (`sw-test`, `push-route-test`, `push-ui-test`). Whether iOS lets `subscribe()` run outside a tap is Unknown; a failure is silent and Settings shows Enable push. |
| 9 | Before the first successful run | Built, verified by a test | Ten minute freshness window, queued emails a day late stay queued, first-run flood test (`minute-reminders-test` 3b and 3c, `email-test`; guard `backlog-guard`). The due-time nudge for a task an event made is kept on purpose (logged). |
| 10 | DST | Built, verified by a test | `api/planner.js` uses 9:00 AM New York through the zone helpers; `scripts/dst-test.mjs` runs in three process zones; `planner-endpoint-test` no longer depends on the date. `taskRules.js` lines 162 and 198 left alone with the reason logged. |
| 11 | Meeting coverage | Built, verified by a test | `normalizeStage` (a deal and a record with no stage field count), the outcome sheet's `afterCall` text, a push 15 minutes before and at the start, Calendly bookings and cancellations by polling (`coverage-push-test` sections 3, 4 and 10). A Calendly event linked to a lead rides on `lead.meeting`; a reschedule not copied across is only seen as a new booking. Live Calendly is unproven. |
| 12 | Missing pushes | Built for four, two left | Payment received (the webhook, once per payment), invoice overdue (9:00 AM, once per invoice per day, three times), new leads (the scraper's `sourceId` rows every 15 minutes, a spreadsheet import as one push), Calendly booked or canceled (`coverage-push-test` 7 to 11). Planner approvals, change requests and concept answers already pushed and are now categorised. **Not done:** enrichment health as a push, and any lead path outside the repo other than the scraper. |
| 13 | Preference gaps | Partly built | Seven category switches and quiet hours, migrated so nothing goes silent (`scripts/push-prefs-test.mjs`, 84 checks, a scan that every push call names a category and a url). The global Push switch keeps its job (form alerts); drawer snooze does not suppress pushes and "Remind me: Off" is not relabelled. |
| 14 | iPhone polish | Partly built | The tap awaits `navigate` with a fallback to opening a window, a tag so a repeat replaces the banner, the Badging API count (Next up, overdue plus today), a recovery card with the iPhone steps when notifications are blocked (`sw-test`, `app-badge-test`, `push-ui-test`). **Not done:** the `apple-mobile-web-app-capable` fallback beside the manifest swap, a session that survives a tap after 30 days. |
| 15 | Hardening of the minute job | Not done | `notifiedAt` inside client-owned checklists, the read-modify-write of `sentReminderKeys`, whole-collection scans with no time budget and the portal's `pushDevices` count are as the audit found them. |
| 16 | A test that requests `/api/cron/*` through vercel.json | Built, verified by a test | `routing-test`, part of `npm run preship`. |
| 17 | Docs | Built | Every line in section 14 was corrected or labelled; see the list below. |

**Docs fixed (section 14):** RUNBOOK Check cron health (Settings, Integrations lists the jobs, the last five runs, the gates live on `cronGates`, the digest opens the home, a job run by hand returns JSON and 401 without the secret), RUNBOOK "Push never arrives" (a six step checklist that starts with the cron and ends with the outcomes log), RUNBOOK and ARCHITECTURE "Settings, Automation" (the page is Integrations), ARCHITECTURE `/api/cron/reminders` (every minute, not once a day) and the gate location, PLANNER-TASKS-DESIGN (every minute on Pro), RELEASE-NOTES-3.0 (Automation is Integrations), CRM-REBUILD-BRIEF and PROMPT-09/12 reports (corrections for the 15 and 60 minute lookahead, per-event bill and review pushes and FIFTEEN_MINUTE_MODE, which never existed in that form), ADMIN_GUIDE (the real button, the real path, the full list of pushes), the cron header in `api/_routes/cron-reminders.js`, and the app copy (the Test button reports counts; Armed means a run in the last three minutes, keys and a subscribed device).

**Still true of every push in the docs:** each is proven against a stubbed `web-push`, never against a phone. Section 15 is how that changes.

