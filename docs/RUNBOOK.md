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

## Take a backup

Settings, Data, Download backup saves visualize-backup-YYYY-MM-DD.json (every
collection except push subscriptions, no raw Stripe payloads). The last backup
time shows on the card. There is no in-app restore; a restore is a hand import
into Atlas from that file.

## Scripts

```
npm run build                                  # Vite build to dist/
npx vite preview --port 4330                   # serve dist/ for the audit
node scripts/layout-audit.mjs                  # every route at 5 widths, mocked APIs
AUDIT_ONLY=settings AUDIT_WIDTHS=390,1280 AUDIT_SHOTS=./shots node scripts/layout-audit.mjs   # also clients, studio, design, dashboard
AUDIT_THEME=light AUDIT_MOTION=reduce node scripts/layout-audit.mjs   # the other theme, motion off
node scripts/feel-audit.mjs                    # skeleton, fit, entrance, empty, error, layout shift per screen
AUDIT_THEME=both AUDIT_MOTION=both AUDIT_OUT=/tmp/feel.json node scripts/feel-audit.mjs
node scripts/feel-audit.mjs --boot             # time to first shell paint on a throttled network
node scripts/hex-count.js                      # raw hex literals in src and api
node scripts/css-orphans.mjs                   # class selectors nothing renders
TZ=America/New_York node scripts/dates-test.mjs
OLD_MONGODB_URI=... NEW_MONGODB_URI=... node scripts/migrate-mongo.mjs --dry
```

## If something is off

- Nothing loads after sign in: check MONGODB_URI and the Atlas network access list.
- Push never arrives: Settings, Notifications, This device must say push is on; VAPID keys must be set; iPhone needs the app installed to the Home Screen.
- Calendar has no Calendly events: CALENDLY_TOKEN missing or expired; the Calendly card says which.
- Payments do not appear on a client: Settings, Integrations, Stripe, Reconcile; unmatched events wait there. Matching is by email, then phone, then business name.
