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
| SESSION_SECRET | Signs the admin cookie. Required on Vercel (security audit, finding 1) | Every sign in and session check answers 500 `SESSION_SECRET is not set`; the admin cannot be entered until it is set. Local development and the node tests use a dev-only fallback that never signs anything on the internet |
| ADMIN_PASSWORD | Overrides the admin password | The ADMIN_PASSWORD constant in api/_lib/config.js is the password |
| VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY | Web push (device enable, reminders, test push) | Push is off; Settings shows push unsupported |
| WEB3FORMS_NOTIFY_KEY | Email backup of new submissions | No emails; submissions still store |
| RESEND_API_KEY | The CRM's own emails through Resend (the email system; the one new variable it added). Setup: in Resend add the domain visualizeclients.com and put its DNS records (SPF, DKIM) where the domain is hosted, wait for Verified, make an API key with sending permission, add it here as RESEND_API_KEY and redeploy; Settings, Emails then reads Connected, sending as Rob at Visualize, and Send test to me is the proof | Test mode: every send answers ok with test: true, nothing leaves the server, the log keeps the email with status test, every stamp and rule still runs; Settings, Emails says Not connected yet |
| CALENDLY_TOKEN (or CALENDLY_PAT) | Calendly events on the Calendar and in the drawer | Calendar Calendly chip disabled; Integrations shows Not connected |
| CRON_SECRET | Both cron jobs (reminders, daily) and the health document | Jobs answer 401; Integrations and Automation show Not armed |
| STRIPE_SECRET_KEY | Stripe read endpoints (events, reconcile listing) | Integrations shows Not connected |
| STRIPE_WEBHOOK_SECRET | The signed webhook that writes payments to the ledger | Webhook answers 503 so Stripe retries; Integrations shows Webhook secret missing |
| ADMIN_URL | Deep links in push notifications (default https://admin.visualizeclients.com) | Links use the default host |
| VITE_MAINTENANCE_MODE | The public maintenance screen (a full app override on the public host only, the admin host and every api/ route are unaffected). No password or unlock exists any more; preview the real site through a Vercel preview deployment, or turn this flag off | Site serves normally |
| VITE_WEB3FORMS_KEY | Web3Forms fallback on the public forms (public by design) | Forms still post to /api/submissions |
| VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET | Upload buttons on every image field in the Showcase editor, single and multi-file, browser to Cloudinary direct, no server and no API secret involved. The preset is `visualize`, unsigned, folder `showcase` (docs/IMAGES.md) | Every image field is a plain pasted link only; the buttons do not render |

## Rotate SESSION_SECRET (sign everyone out)

Rotating SESSION_SECRET is the only way to sign every device out: sessions are a signed cookie with no database record, so there is no list to revoke from and no single session to end.

1. Vercel, Settings, Environment Variables: set a new random SESSION_SECRET (32 or more characters, `openssl rand -base64 32`). There is no fallback on Vercel: with the variable unset, sign in answers 500 until it is set.
2. Redeploy. Every existing cookie stops verifying; every device signs in again with the same password.

Rotating the password does not sign anyone out (the cookie does not carry it); rotate the secret for that.

## Change the admin password

The password is the ADMIN_PASSWORD constant in api/_lib/config.js (the repo
is private; that file is the single source of truth). An ADMIN_PASSWORD
environment variable in Vercel overrides it when set. Change one of the two
and redeploy; nothing in the database holds a password, and the Settings
screen no longer changes it.

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

`/api/cron/reminders` runs every minute (the Pro plan allows a per minute
schedule; `/api/cron/daily` stays at 06:00 UTC, unchanged). A thing is due
when its time is at or before now and it has not pushed yet: a callback
pushes "Call back: <business>, <time>" the minute `callbackAt` passes, a
meeting pushes "Meeting now: <business>, <time>" the minute it starts (a
meeting with no time keeps the 09:00 default), each on a dedupe key that
carries its time (`sentReminderKeys`, cap 2,000), so editing the time to a
new instant pushes again. Ten or more things due in one run become one
combined push ("N reminders due now") instead of a flood; a run that is
late (a deploy, an outage) still sends anything still due, but anything
more than six hours late is stamped as handled without a push, so a gap in
the schedule never fires a pile of stale ones at once.

The morning digest still sends once, now on the first run at or after
8:30am America/New_York (the old 9am Eastern run always qualified; minute
mode can reach that time well before the old daily run would have): every
callback due today or overdue, every meeting today, retainer bills due
today, review asks due and every task due today under Tasks, as one
notification with a deep link to Next up. Its own queries (bills, review
asks, today's tasks) only run on the one run a day that could actually
send it, so the other 1,439 runs stay a fast, indexed check of what is due
this minute.

Running every minute means 1,440 runs a day, so the heavier work inside the
same endpoint is time gated, each gate keeping its own last-run stamp on
the `notifications` settings document: queued emails (Send tomorrow) go out
by the instant rule at most every 15 minutes; the email rules run once a
day, on the first run at or after 9:00am America/New_York; the client push
sweep keeps its own six hour spacing per client and is cheap to call every
minute. Every date and gate reads api/_lib/zone.js, never server local time.

Tasks with a due date (a custom next action set through the Set task sheet
on a lead, a deal, a client or a project, or a checklist item) push
"Task: <label>, <business>" to /tasks?open=<leadId> the minute `remindAt`
passes, or, when the Remind me choice was Off and there is no `remindAt`,
the minute the due time itself passes: a task is never silently due with no
push. `notifiedAt` is stamped on the item once pushed (or once stamped
stale past six hours late), so a rerun never sends it twice, and the 8:30
digest still lists every task due today under Tasks, after the callbacks
and the meetings. A pinned task is the record's next action but carries no
reminder of its own, so nothing is pushed twice.

A job can still be run by hand: GET
https://admin.visualizeclients.com/api/cron/reminders with the header
`Authorization: Bearer CRON_SECRET` runs one minute's worth of work on
demand (useful right after a deploy, or to confirm the production schedule
before trusting it). Settings, Notifications shows the last twelve run
times, now a minute apart once the Vercel cron is armed.

A client's idea (the Ideas tab on their planner) is pushed the moment it is
written, by api/planner.js, not by a cron: "New idea from <client>" with a
deep link to the planner editor's inbox. Settings, Notifications, "Client
ideas" turns that push off; the New idea task on the client's Ideas
checklist is written either way, so Next up still shows it.

## Emails

The CRM sends its own emails through Resend (docs/EMAIL.md): Compose on
every record, twenty four templates, the log, and the rules that draft or
send on their own from the reminders cron. One variable, RESEND_API_KEY
(the table above says how to get it); without it every send is a test
(status test in the log, nothing leaves the server, every stamp and rule
still runs), so the whole system can be walked before the key exists.

- Settings, Emails: the connection and the sender (name, address, reply to), Send test to me, the invoice terms by kind, every template with Edit (Compose in template mode), Reset to default, an Automation control (Off, Draft for me, Send for me) on the templates a rule drives, and Recent sends (fifty, failures first).
- Compose (/email/compose): the template row and its picker (the suggestion pinned, an unavailable template greyed with what it needs), To and Cc, the blocks, Insert field, the sandboxed preview at phone and desktop width, Send, Send test to me, Send tomorrow at 9am. A draft of an edit lives on the device per record and template.
- The record's Emails section (lead, deal and client): every entry with its status pill, Automatic and To me marks; a row opens the sent email sheet (the exact HTML, Send again, Cancel send on a queued one, Send now and Edit on a draft).
- Next up: a drafted or failed email is a task on the record's Emails checklist carrying the entry; the row's one control is Send, the menu has Send email and Edit email. On a lead it is the next step until it is sent or ticked.
- The reminders cron sends what is queued by the instant rule, at most every 15 minutes, and runs the rules once a day at or after 9am Eastern; Rob gets "N emails ready to send" (to Tasks) and "N emails went out for you" (to Settings, Emails) when there is anything. The digest push lists the tasks due today as before.
- The invoice email gives the line its number (INV-0001 and up, once, on the first real send) and makes its Stripe payment link when Stripe is set up, both written on the line; the pay block offers the card link, the portal for the other ways (Cash App, Venmo, Zelle from Settings, Pay methods), or one button per method.
- The delivery email refuses unless the project is paid in full, the Drive folder is linked and the box "The Drive folder is shared as Viewer" is ticked in Compose; a send ticks the delivery steps, sets deliveredAt and writes the retainer follow up and review tasks three days out.
- A marketing email (the lead templates) carries an opt out link (/u/<token>) and the List-Unsubscribe headers; an opt out is never sent one again, by hand or by a rule.

Retire Zapier once Resend is connected (Settings, Emails reads Connected and Send test to me arrives):

1. Settings, Integrations, "Zapier emails" reads Retired: the old send route answers 410 and every Send button already opens Compose.
2. Turn off the four Google Form Zaps (intro, onboarding, invoice, delivery) in Zapier.
3. Delete ZAPIER_HOOK_INTRO, ZAPIER_HOOK_ONBOARDING, ZAPIER_HOOK_INVOICE and ZAPIER_HOOK_DELIVERY from the Vercel project and redeploy.

The old route and its payloads (CRM revamp, step 6) stay in api/_routes/send-email.js and api/_lib/email.js until the hooks are gone; `node scripts/send-email-test.mjs` still covers them.

Previews: `npm run email:preview` writes every template on a fixture record to docs/email-previews (one HTML each, overview.html and overview.png at 600 and 375 wide) and fails on anything unfilled, "undefined", "null", the word AI or an em dash. Tests: `node scripts/email-test.mjs` (the engine, Compose, the queue, the templates, the invoice, the delivery, the rules, the draft door) and `node scripts/email-guard-proof.mjs` (every guard cut out in turn).

## Take a backup

Settings, Data, Download backup saves visualize-backup-YYYY-MM-DD.json (every
collection except push subscriptions, no raw Stripe payloads). The last backup
time shows on the card. There is no in-app restore; a restore is a hand import
into Atlas from that file.

## Security

What the API enforces after the auth rebuild. Auth is three standalone
functions with their own method check and no shared wrapper:
api/admin/login.js, api/admin/logout.js, api/admin/session.js. Every other
`/api/admin/*` endpoint is one function, api/admin/index.js, reached through
one vercel.json rewrite per URL (`/api/admin/call-leads` becomes
`/api/admin/index?r=call-leads`, so no client URL changed); index.js wraps
each endpoint's logic from api/_routes/<name>.js in `route()`
(api/_lib/handler.js: method allow list, admin guard, body cap, one
try/catch). Both crons dispatch out of api/cron/[job].js.
`/api/submissions`, `/api/push-key`, and `/api/stripe/webhook` keep their
own files since the webhook needs the raw body and its own config. That is 8
of the 10 functions the deployment uses (api/showcase.js and api/planner.js,
the other two public endpoints, are the rest).

- Every non public route sits behind the admin cookie. Public: /api/submissions (POST), /api/push-key, /api/admin/session, /api/admin/login, /api/admin/logout. The Stripe webhook and both crons verify their own secret instead.
- Method allow lists per route (405 with Allow), a body size cap per route (413; 512KB default, 1MB call-leads and the webhook, 2MB the spreadsheet import, small caps on settings, push, reconcile).
- Password: the ADMIN_PASSWORD constant in api/_lib/config.js, or the ADMIN_PASSWORD environment variable when set. Nothing else reads a password; the compare is constant time (sha256 of both sides, timingSafeEqual). Ten wrong passwords from one IP inside fifteen minutes lock that IP out with 429 and a Retry-After (settings document `rate:login:<sha256(ip)>`, cleared by a correct password); the body is capped at 4KB.
- Session cookie: `vz_admin`, HttpOnly, Secure, SameSite=Lax, Path=/, 30 days, `${expiresAt}.${hmac}` signed with SESSION_SECRET (required on Vercel, no fallback), compared in constant time. No database lookup and no renewal: a session ends 30 days after sign in, or when SESSION_SECRET is rotated. A cookie that does not decode is treated as no cookie.
- No CSRF header. SameSite=Lax on the cookie is the cross site guard: the browser does not send it on a cross site POST, PATCH or DELETE, every admin write is one of those, and no admin GET changes anything worth changing (the audit checked each one). apiFetch sends plain JSON with no custom header.
- Input: every write goes through the route's sanitize() whitelist and `$set` only; ids are cast with ObjectId (a bad id is a 400, never a query operator); search strings are escaped before they become a regular expression; nothing from the request reaches a Mongo operator name. Every stored link and image field goes through api/_lib/url.js safeUrl(): http, https or a root relative path, anything else (javascript:, data:, //host, whitespace) stores as empty, and the public pages and the admin link buttons apply the same rule again at the render (src/lib/safeUrl.js). scripts/security-test.mjs proves all of this against the real handlers on every run.
- Output: no route returns a secret, a stack, or an env var. Errors answer `{ error: 'message' }`; a thrown error answers 500 `server error` with the stack in the Vercel function log only. /api/planner answers with `Cache-Control: no-store`. The backup leaves out push subscriptions, raw Stripe payloads, the rate limiter documents and the client error log.
- Public forms: /api/submissions takes at most 128KB, normalises `fields` to a flat map (40 keys, plain names, string values of 3000 characters, control characters stripped), limits every sender to ten forms an hour and three reviews (settings documents `rate:form:<sha256(ip)>` and `rate:review:<sha256(ip)>`), and the notification email writes its own Web3Forms controls after the fields and drops any field named like one, so a form cannot redirect, re-address or re-key Rob's own notification. The honeypot (`company`) answers like a success and stores nothing.
- Stripe webhook: raw body, signature verified with 300 seconds of replay tolerance, and the event row is inserted under the unique `id` index before any ledger write, so a retry that lands mid processing is a duplicate with no side effects (applyPayment also refuses a second ledger entry for the same event id).
- Headers (vercel.json): X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera, microphone, geolocation, payment, usb off) and Strict-Transport-Security (two years, includeSubDomains) on every host. Both hosts get a Content-Security-Policy: self only for scripts (plus the sha256 of the one inline pre-paint script, which the build pins into every policy in vercel.json), styles self and inline (the CSS-in-JSX and the boot frame need it), fonts self (self hosted latin subsets in /fonts), images self plus data, blob and https (every showcase image is a res.cloudinary.com URL), frame-ancestors none, base-uri self, form-action self, object-src none. connect-src is `'self'` on the marketing host and `'self' https://api.cloudinary.com` on the admin host. Nothing on the marketing host loads from a third party origin; the planner and review pages set no cookie and run no third party script.
- Why api.cloudinary.com is in connect-src: the Showcase editor uploads straight from the browser to Cloudinary's unsigned endpoint, so the POST leaves the admin host for api.cloudinary.com. Under the original `connect-src 'self'` the browser refused it before it left, which reads as a network failure with no HTTP status (the toast says so and names this directive). It is the one added origin, it is the API host only, and nothing else in the policy loosened: res.cloudinary.com is a source of images, never of connections, and it is already covered by img-src's https.
- The client error log (/api/admin/log) is admin guarded, capped at 500 entries, and stores messages, not payloads.

The full review, with every finding and its fix, is docs/SECURITY-AUDIT.md. Findings from the Prompt 15 review that still hold: the webhook stores the event before the ledger write; every handler has a method check; every public route has a body cap; no handler throws an unhandled error into Vercel's default 500 page. The CSRF header and the sliding cookie renewal from that review stay removed (SameSite=Lax covers the first, the second was never needed); the login rate limit, removed in the auth rebuild, is back.

## Landing speed

`DIST=dist PORT=4350 node scripts/mock-server.mjs &` then `node
scripts/perf-landing.mjs` measures the landing page in a phone profile
(390 x 844, the CPU 4x slower, Chrome's Slow 4G preset, no cache, three
loads, the median) and writes docs/PERF.md with the targets checked
against docs/perf/baseline.json; `--baseline` resets the baseline. The
fonts: Inter is one variable file (public/fonts/inter.woff2, weights 400
to 800, preloaded on both hosts) and Barlow Condensed is the admin's
display face; `node scripts/fetch-fonts.mjs` (needs the network) rewrites
public/fonts and src/fonts.css from Google Fonts. A client says an old
/clients link does not work: it is a 301 to /projects at the edge, so the
link itself is fine; check the slug is published.

## Prerender

The marketing host serves the same static dist/index.html for every route
(vercel.json's catch-all rewrite), so a crawler or a link preview fetch on
/projects/:slug only ever saw the site-wide default title, description, and
og:image, never that client's own, since src/marketing/useHead.js only
applies those after the SPA's JS runs. `npm run build` now chains two more
steps after `vite build`:

- `node scripts/prerender-clients.mjs`: fetches the production
  `/api/showcase` (override with `PRERENDER_SHOWCASE_URL` for a local run,
  the mock server or `vercel dev`), and writes one
  `dist/projects/<slug>/index.html` per published client, dist/index.html's
  own template with that client's title, description, and og:image swapped
  in, every script and stylesheet tag untouched so the exact same app
  bundle boots from it. Once client-side JS takes over, CaseStudy.jsx's own
  `useHead()` call immediately re-fetches and re-applies the live values,
  so a stale prerendered snapshot self-corrects for anyone who lands and
  stays on the page.
- `node scripts/build-sitemap.mjs`: dist/sitemap.xml, the same fetch (and
  the same fail-soft rule) plus the static routes (/, /services, /projects,
  /contact, /start). public/robots.txt (a plain static file, it
  never changes) points at it.

Both fail soft: a network error, a non-200, or bad JSON leaves zero
prerendered client pages and a sitemap with just the static routes, rather
than failing the build (this sandbox cannot reach production at all,
confirmed by running the real `npm run build` here, so its own build
always takes this path; PRERENDER_SHOWCASE_URL pointed at the mock server
was how the client-page and sitemap generation were verified instead).

No new vercel.json rewrite routes `/projects/:slug` to its prerendered file:
Vercel's documented routing order checks the output directory for a real
file matching the request path before it ever consults the rewrites array,
so `/projects/full-showcase-co` already resolves to
`dist/projects/full-showcase-co/index.html` once that file exists, the same
way any static host resolves a directory path to its index.html. A slug
with no prerendered file (not yet published, or fetched with an older
snapshot before it was) falls through the same catch-all every other route
already does, and the SPA fetches it live from there. vercel.json does gain
one header rule: `/projects/(.*)` gets `Cache-Control: public, max-age=0,
must-revalidate`, since these prerendered files are only ever as fresh as
the last build and should never be cached as if immutable, unlike /assets
and /fonts.

## Review links

A client's review link is minted on the Reviews screen (open the client,
Review Visualize, Generate review link); Copy, the QR's Download PNG and
Share do the sending, Mark as sent stamps it and ticks the project's step.
Regenerate kills the old link and the old QR the moment it runs, so print a
new card after it. What comes back is pending until you Approve it (only
with consent) and Feature puts it on the landing. Set your own Google
review link under Settings, Profile: the thank you page offers it after a
review. The public door is /api/review on the showcase function (no new
function, no new variable); its limits are one submission per link every
ten minutes and five a day, and one counted view an hour.
`node scripts/review-link-test.mjs` runs the rules and the route,
`node scripts/review-guard-proof.mjs` cuts each guard out in turn,
`node scripts/qr-test.mjs` decodes the QR with an independent reader.

## Client portal

A client says the link does not work: open their record, the Portal
card, and read the status line first (Not sent yet, Sent, not opened yet,
or the views). If the link was never sent, Send it. If it was sent and
never opened, Regenerate (the old link dies, the QR and every device's
unlock with it) and Send it again; the new link is the one in the message.
If they open it and a card says Locked, that is the PIN: Reset PIN in the
sheet gives them new digits, and the sixth wrong try in fifteen minutes
locks the door for that long. A link that answers "This link expired" is a
dead or regenerated token: the record's Portal sheet always holds the live
one. The prompt 4 extras (an order, a site change, a push subscription)
each write to the record through the same door, so the record's Tasks and
the bell on the Portal card are the proof they went through.


A client's portal link is made on the client record (the Portal card in
the workspace, Generate link, then the Portal sheet): Copy, the QR's
Download PNG, Open as the client (the real page in a new tab), Send it
(the message in my voice, Copy or Share, Mark as sent) and Regenerate,
which kills the old link, the old QR and every device's unlock. The
template sets every card's state; each card has Off, On or Auto with its
Auto rule written under it; the PIN toggle asks for four digits (stored as
a hash, Reset PIN sets new ones); the documents list takes a label, a link
and a kind. My phone, email, Calendly link and hours live once under
Settings, Profile, Client portal, and feed every client's Message Rob and
Book a call cards. A dead token shows the expired page with my Instagram
and email. Checks: `node scripts/portal-test.mjs` (the route and the
registry against the real handlers), `node scripts/portal-guard-proof.mjs`
(each guard cut in turn) and `node scripts/portal-crm-test.mjs` (the CRM
helpers); the audits walk /c/<token> in every state (mkt-portal*) and the
Portal sheet (clients-portal*). Money and project cards (prompt 2): the
ways to pay and the retainer links live under Settings, Profile (Ways to
pay, Retainer links); an invoice shows on the Pay card once it is sent and
leaves once it is paid (the Stripe webhook or Mark paid); sending the invoice
email also makes the invoice's own Stripe link (STRIPE_SECRET_KEY must allow
writes; without it the card falls back to the Settings link and the client
types the amount shown); a payment that matched no amount lands on the oldest
open invoice with a Stripe mismatch note on the line; the planner,
concepts and review cards (prompt 3) only link to those pages, so nothing
changes in how they are made or sent; the next call needs CALENDLY_TOKEN
and the client's email on the invitee (looked up at most every fifteen
minutes); an approval is asked from the Portal sheet (Ask, Resend, Delete)
and the client's answer lands as a Next up task and a push; a task shows on
the client's Needs you card once Needs the client is on (the task row's
menu or the task sheet, a link optional); files unlock on their own when
every invoice is paid, or when the project is delivered with nothing open.

## Scripts

```
npm run build                                  # Vite build to dist/ (also pins the CSP hash in vercel.json, prerenders published clients, writes the sitemap)
npx vite preview --port 4330                   # serve dist/ for the audits
node scripts/layout-audit.mjs                  # every route at 5 widths, mocked APIs, 44px targets, stuck overlays
AUDIT_ONLY=settings AUDIT_WIDTHS=390,1280 AUDIT_SHOTS=./shots node scripts/layout-audit.mjs   # also clients, studio, design, dashboard
AUDIT_THEME=light AUDIT_MOTION=reduce node scripts/layout-audit.mjs   # the other theme, motion off
AUDIT_ONLY=a11y AUDIT_WIDTHS=390,1280 node scripts/layout-audit.mjs   # 200 percent zoom and text spacing on Next up, Leads, call room
node scripts/feel-audit.mjs                    # skeleton, fit, entrance, empty, error, layout shift per screen
AUDIT_THEME=both AUDIT_MOTION=both AUDIT_OUT=/tmp/feel.json node scripts/feel-audit.mjs
node scripts/feel-audit.mjs --boot             # time to first shell paint on a throttled network
AUDIT_THEME=both node scripts/a11y-audit.mjs   # axe-core on every screen, both themes, 390 and 1280
node scripts/regression.mjs                    # docs/QA-CHECKLIST.md as a Playwright walk, 390 and 1280
node scripts/site-regression.mjs               # docs/SITE-QA-CHECKLIST.md as a Playwright walk against the marketing site
node scripts/render-profile.mjs                # kanban with 400 leads, month with 60 events
DIST=dist PORT=4350 node scripts/mock-server.mjs &   # fixture backed server for Lighthouse (MOCK_HOST=admin adds the CSP, MOCK_SHOWCASE_EMPTY=1 serves an empty showcase)
LH_BASE=http://127.0.0.1:4350 node scripts/lighthouse.mjs   # mobile preset, Next up, Leads, call room, Clients, Home, Contact, Services, both themes
LH_BASE=http://127.0.0.1:4350 LH_FORM=desktop node scripts/lighthouse.mjs   # the 1280-equivalent desktop preset
node scripts/fetch-fonts.mjs                   # refresh the self hosted latin font subsets
node scripts/hex-count.js                      # raw hex literals in src and api (the ceiling only ever goes down, see CLAUDE.md for the current one)
node scripts/css-orphans.mjs                   # class selectors nothing renders (0)
TZ=America/New_York node scripts/dates-test.mjs
node scripts/tasks-test.mjs; node scripts/share-test.mjs; node scripts/task-reminder-test.mjs; node scripts/planner-endpoint-test.mjs   # the task rule and its mirror, Save to photos with navigator.share mocked, the reminders cron over checklist tasks, the planner door (posts, ads, suggest, the limiters)
MONGODB_URI=... node scripts/migrate-checklists.mjs [--apply]   # stamp ids on every checklist and task written before the task system (report first)
node scripts/pipeline-test.mjs; node scripts/lists-test.mjs; node scripts/score-test.mjs; node scripts/analytics-test.mjs; node scripts/deals-test.mjs; node scripts/send-email-test.mjs; node scripts/rules-test.mjs   # the pipeline guard and triage, the dial lists, the lead score, the deal and its invoices, the four emails, the follow up rules and project actions, against the real handlers
node scripts/email-test.mjs; node scripts/email-guard-proof.mjs   # the email system against the real handlers (fetch stubbed, no key), then every guard cut out of a copy in turn
npm run email:preview                           # every template on the fixture record to docs/email-previews, the montage, the lint (node scripts/email-preview.mjs --no-shot skips the montage)
npm run lint                                   # ESLint: no-undef and no-unused-vars as errors, the hooks rules; regression.mjs runs it as step 0
MONGODB_URI=... node scripts/migrate-invoices.mjs [--apply]   # CRM revamp, step 5: every project's schedule[] becomes invoices[] (paid stays paid, the rest sent; report first)
MONGODB_URI=... node scripts/backfill-triage.mjs [--apply]   # CRM revamp, step 4: move untouched stage lead records into triage and write the first score (report first)
OLD_MONGODB_URI=... NEW_MONGODB_URI=... node scripts/migrate-mongo.mjs --dry
PRERENDER_SHOWCASE_URL=http://127.0.0.1:4350/api/showcase node scripts/prerender-clients.mjs   # test against the mock server instead of production
PRERENDER_SHOWCASE_URL=http://127.0.0.1:4350/api/showcase node scripts/build-sitemap.mjs
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
- Sign in says Wrong password: the password is the ADMIN_PASSWORD constant in api/_lib/config.js unless an ADMIN_PASSWORD environment variable is set in Vercel, in which case the variable wins (check it for stray whitespace).
- Sign in says Server error 404 or 405: the deployment is not serving api/admin/login.js as its own function; check the Functions tab of the deployment lists admin/login, admin/logout, admin/session, and admin/index.
- Every list answers 401 right after sign in: the cookie did not verify. SESSION_SECRET changed between the sign in and the request (a deploy that rotated it), or the browser dropped a Secure cookie on a plain http origin.
- The admin is blank after a change to index.html's pre-paint script: the CSP hash moved. `npm run build` rewrites it in vercel.json; commit that file with the change.
- A screen shows Something broke: reload it; the message is under Settings, Automation, Errors on this app, and in the browser console.
