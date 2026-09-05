# RUNBOOK

How to run, deploy, and look after the Visualize admin. Nothing in this file
is secret; every value lives in Vercel environment variables.

## Deploy

Vercel builds `npm run build` (Vite) and serves dist/ with the SPA rewrite in
vercel.json. api/ functions deploy with it. Pushing to main deploys production.
The admin is served on admin.visualizeclients.com; the marketing site on
visualizestudio.org; /admin/* on the public host redirects home except on
localhost.

Local: `npm install`, `npm run dev` (marketing and admin at /admin/*), or
`npm run build && npx vite preview`. api/ functions do not run under vite; use
`vercel dev` or a deployment.

## Environment variables

| Variable | Unlocks | Without it |
|---|---|---|
| MONGODB_URI | Every api/ route | Every endpoint throws; nothing loads |
| SESSION_SECRET | Signed admin cookie | Nobody can sign in (tokens never verify) |
| ADMIN_PASSWORD | Sign in until a password is set from Settings Profile | Sign in fails until settings.auth holds a hash |
| VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY | Web push (device enable, reminders, test push) | Push is off; Settings shows push unsupported |
| WEB3FORMS_NOTIFY_KEY | Email backup of new submissions | No emails; submissions still store |
| CALENDLY_TOKEN (or CALENDLY_PAT) | Calendly events on the Calendar and in the drawer | Calendar Calendly chip disabled; Integrations shows Not connected |
| CRON_SECRET | Both cron jobs (reminders, daily) and the health document | Jobs answer 401; Integrations and Automation show Not armed |
| STRIPE_SECRET_KEY | Stripe read endpoints (events, reconcile listing) | Integrations shows Not connected |
| STRIPE_WEBHOOK_SECRET | The signed webhook that writes payments to the ledger | Webhook answers 503 so Stripe retries; Integrations shows Webhook secret missing |
| ADMIN_URL | Deep links in push notifications (default https://admin.visualizeclients.com) | Links use the default host |
| VITE_MAINTENANCE_MODE, VITE_MAINTENANCE_PASSWORD | The public maintenance screen and its unlock | Site serves normally |
| VITE_WEB3FORMS_KEY | Web3Forms fallback on the public forms (public by design) | Forms still post to /api/submissions |

## Rotate SESSION_SECRET (sign everyone out)

1. Vercel, Settings, Environment Variables: set a new random SESSION_SECRET (32 or more characters).
2. Redeploy. Every existing cookie stops verifying; every device signs in again with the same password.

## Change the admin password

Settings, Profile, Password. The hash lands in settings.auth and takes
precedence over ADMIN_PASSWORD. If it is lost, delete the settings.auth
document in Atlas and ADMIN_PASSWORD works again.

## Register the Stripe webhook

1. Stripe Dashboard, Developers, Webhooks, Add endpoint: https://admin.visualizeclients.com/api/stripe/webhook.
2. Events: charge.succeeded, invoice.paid, checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted.
3. Copy the signing secret into STRIPE_WEBHOOK_SECRET and the restricted read key into STRIPE_SECRET_KEY; redeploy.
4. Send a test event from Stripe. Settings, Integrations, Stripe shows the last webhook time and any unmatched payments (Reconcile links them to a client).
5. Put the Stripe subscription id (sub_...) on a client's retainer or payment plan block so cancellations reconcile.

## Check cron health

Settings, Automation lists both jobs with last run, next run, and last result.
Settings, Integrations shows Scheduled tasks (armed or not), Stripe, and the
nightly enrichment and scraper health. The notifications drawer raises a
System item when the enrichment scan or the scraper is quiet for 36 hours.
A job can be run by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://admin.visualizeclients.com/api/cron/daily`.

Both crons run once a day because the Hobby plan only allows daily cron
schedules (a schedule that fires more than once a day fails the Vercel
deploy). `/api/cron/reminders` runs at 13:00 UTC (9am Eastern) and sends one
morning digest push instead of a push per event: every callback due today or
overdue, every meeting today, retainer bills due today, and review asks due,
as one notification with a deep link to the Dashboard. `sentReminderKeys`
dedupes on one key per day, so a manual rerun the same day sends nothing.
`/api/cron/daily` is unchanged, at 06:00 UTC.

If the account moves to the Pro plan, near-real-time reminders (a push the
moment a callback or meeting is due) can come back with two changes: set
`FIFTEEN_MINUTE_MODE = true` at the top of api/_routes/cron-reminders.js, and
change the reminders schedule in vercel.json back to every 15 minutes. The
file keeps the old per-event logic behind that flag for exactly this.

## Take a backup

Settings, Data, Download backup saves visualize-backup-YYYY-MM-DD.json (every
collection except push subscriptions, no raw Stripe payloads). The last backup
time shows on the card. There is no in-app restore; a restore is a hand import
into Atlas from that file.

## Security

What the API enforces (Prompt 15 review; every route goes through
`route()` in api/_lib/handler.js). The Hobby plan's 12 serverless function
cap means the 17 `/api/admin/*` endpoints and the 2 crons are no longer one
file each: they dispatch out of api/admin/[...route].js and
api/cron/[job].js, with each endpoint's actual logic (and its own
`route()` call, so nothing about its guard, method list, or body cap
changed) in api/_routes/<name>.js. `/api/submissions`, `/api/push-key`, and
`/api/stripe/webhook` keep their own files since the webhook needs the raw
body and its own config:

- Every non public route sits behind the admin cookie. Public: /api/submissions (POST), /api/push-key, /api/admin/session, /api/admin/login, /api/admin/logout. The Stripe webhook and both crons verify their own secret instead.
- Method allow lists per route (405 with Allow), a body size cap per route (413; 512KB default, 1MB call-leads and the webhook, 2MB the spreadsheet import, small caps on login, settings, push, reconcile).
- CSRF: every POST, PATCH, and DELETE on an admin route (login and logout included) needs `X-Requested-With: visualize`. apiFetch in src/shared/api.js sends it on every request; a cross site form or a plain script cannot. The webhook, the crons, and the public submissions route are exempt.
- Session cookie: HttpOnly, Secure, SameSite=Lax, 30 days, HMAC signed with SESSION_SECRET, compared in constant time. Sliding renewal: any authed request on a cookie older than a day reissues it for 30 days, so a device in daily use never expires and one left alone does 30 days after its last visit.
- Login: 10 failed attempts per IP per 15 minutes, counted on the settings `login-limit` document so every serverless instance shares one count (an in memory map is only the fallback while the database is unreachable; it resets per instance and per cold start, which is why it is not the primary store). Success clears the IP. The password compare is constant time on both the scrypt path and the ADMIN_PASSWORD path.
- Input: every write goes through the route's sanitize() whitelist and `$set` only; ids are cast with ObjectId (a bad id is a 400, never a query operator); search strings are escaped before they become a regular expression; nothing from the request reaches a Mongo operator name.
- Output: no route returns a secret, a stack, or an env var. Errors answer `{ error: 'message' }`; a thrown error answers 500 `server error` with the stack in the Vercel function log only.
- Stripe webhook: raw body, signature verified with 300 seconds of replay tolerance, and the event row is inserted under the unique `id` index before any ledger write, so a retry that lands mid processing is a duplicate with no side effects (applyPayment also refuses a second ledger entry for the same event id).
- Headers (vercel.json): X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera, microphone, geolocation, payment, usb off) on every host. The admin host also gets a Content-Security-Policy: self only for scripts (plus the sha256 of the one inline pre-paint script, which the build pins into vercel.json), styles self and inline (the kit's CSS-in-JSX and the boot frame need it), fonts self (self hosted latin subsets in /fonts), images self plus data and https (concept pack thumbnails), connect self, frame-ancestors none. The marketing host has no CSP header and is unaffected.
- The client error log (/api/admin/log) is admin guarded, capped at 500 entries, and stores messages, not payloads.

Findings from the review that were fixed: no rate limit on login; no CSRF header (SameSite=Lax alone let a same site navigation POST through); cookies never renewed (a daily user was signed out every 30 days); the webhook stored the event after the ledger write; four handlers had no method check; api/submissions and push-subscribe had no body cap; no CSP; two handlers could throw an unhandled error into Vercel's default 500 page.

## Scripts

```
npm run build                                  # Vite build to dist/ (also pins the CSP hash in vercel.json)
npx vite preview --port 4330                   # serve dist/ for the audits
node scripts/layout-audit.mjs                  # every route at 5 widths, mocked APIs, 44px targets
AUDIT_ONLY=settings AUDIT_WIDTHS=390,1280 AUDIT_SHOTS=./shots node scripts/layout-audit.mjs   # also clients, studio, design, dashboard
AUDIT_THEME=light AUDIT_MOTION=reduce node scripts/layout-audit.mjs   # the other theme, motion off
AUDIT_ONLY=a11y AUDIT_WIDTHS=390,1280 node scripts/layout-audit.mjs   # 200 percent zoom and text spacing on Dashboard, Leads, call room
node scripts/feel-audit.mjs                    # skeleton, fit, entrance, empty, error, layout shift per screen
AUDIT_THEME=both AUDIT_MOTION=both AUDIT_OUT=/tmp/feel.json node scripts/feel-audit.mjs
node scripts/feel-audit.mjs --boot             # time to first shell paint on a throttled network
AUDIT_THEME=both node scripts/a11y-audit.mjs   # axe-core on every screen, both themes, 390 and 1280
node scripts/regression.mjs                    # docs/QA-CHECKLIST.md as a Playwright walk, 390 and 1280
node scripts/render-profile.mjs                # kanban with 400 leads, month with 60 events
DIST=dist PORT=4350 node scripts/mock-server.mjs &   # fixture backed server for Lighthouse (MOCK_HOST=admin adds the CSP)
LH_BASE=http://127.0.0.1:4350 node scripts/lighthouse.mjs   # mobile preset, Dashboard, Leads, call room, both themes
node scripts/fetch-fonts.mjs                   # refresh the self hosted latin font subsets
node scripts/hex-count.js                      # raw hex literals in src and api (145 or lower)
node scripts/css-orphans.mjs                   # class selectors nothing renders (0)
TZ=America/New_York node scripts/dates-test.mjs
OLD_MONGODB_URI=... NEW_MONGODB_URI=... node scripts/migrate-mongo.mjs --dry
```

Every audit context blocks the service worker (Playwright `serviceWorkers: 'block'`); otherwise the worker answers the mocked requests itself. Lighthouse runs against the mock server over real HTTP, so the worker is live there. Restart the mock server after every build: it reads vercel.json (the CSP hash) once at start, and a stale hash blocks the pre-paint script.

## Errors

The admin logs its own errors: a screen that throws shows the kit ErrorState
with Reload inside its region (the shell stays up), the shell itself failing
shows the login card outline with the message, and every such error, every
unhandled promise rejection, every write refused offline, and every API call
that answered 500 posts to /api/admin/log. Settings, Automation, Errors on
this app shows the last 20 with a Clear button; the settings `client-log`
document keeps 500. Server side errors go to the Vercel function log with the
stack; the client only ever sees `{ error: 'server error' }`.

## If something is off

- Nothing loads after sign in: check MONGODB_URI and the Atlas network access list.
- Push never arrives: Settings, Notifications, This device must say push is on; VAPID keys must be set; iPhone needs the app installed to the Home Screen.
- Calendar has no Calendly events: CALENDLY_TOKEN missing or expired; the Calendly card says which.
- Payments do not appear on a client: Settings, Integrations, Stripe, Reconcile; unmatched events wait there. Matching is by email, then phone, then business name.
- Signed out after a deploy or every write answers 403: the cookie is fine, the request is missing the X-Requested-With header. Hard reload the admin so the current bundle's apiFetch is in use.
- Too many attempts on sign in: 10 wrong passwords from one IP in 15 minutes; wait 15 minutes, or delete the settings `login-limit` document in Atlas.
- The admin is blank after a change to index.html's pre-paint script: the CSP hash moved. `npm run build` rewrites it in vercel.json; commit that file with the change.
- A screen shows Something broke: reload it; the message is under Settings, Automation, Errors on this app, and in the browser console.
