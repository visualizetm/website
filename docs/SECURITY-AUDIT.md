# Security audit

A full review of the site and the admin, written before anything was
changed, then updated with what was fixed. The attacker assumed throughout
has read the public JavaScript bundle, can call every endpoint directly, and
has no admin cookie. Where a finding needs the admin cookie or a compromised
admin machine to exploit, it says so.

Scope: docs/ARCHITECTURE.md, docs/RUNBOOK.md, CLAUDE.md, vercel.json, every
file under api/, src/shared/api.js, src/pages/Planner.jsx, Review.jsx,
Clients.jsx, CaseStudy.jsx, plus a grep of all of src/ for rendering sinks,
a grep of dist/ for secrets, git history for committed secrets, and
`npm audit`.

Severity: critical (remote, unauthenticated, full compromise), high
(unauthenticated abuse of a real capability, or a path to the admin
session), medium (needs the admin cookie or a second fault, or is a defense
the site should have and does not), low (hardening, timing, hygiene).

Status is one of: fixed <hash>, open (with why).

## Summary

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | high | Session signing secret falls back to a constant in the repo | fixed |
| 2 | high | No rate limit on POST /api/admin/login | fixed |
| 3 | high | Public form fields override the notification email's own parameters (Web3Forms key, reply address, subject) | fixed |
| 4 | medium | /api/submissions: contact and start forms have no rate limit and store an unbounded, untyped `fields` object | fixed |
| 5 | medium | No URL scheme validation on any stored image or link field; `javascript:` reaches `href` on public and admin pages | fixed |
| 6 | medium | `.env` is tracked in git despite `.gitignore` | fixed |
| 7 | medium | The marketing host has no Content-Security-Policy | fixed |
| 8 | medium | `npm audit`: 10 high, 4 moderate, 3 low | mostly fixed, xlsx open |
| 9 | low | /api/planner responses carry no `Cache-Control: no-store`; the per token limiter stores the raw token as a settings `_id` | fixed |
| 10 | low | A malformed `vz_admin` cookie throws inside `decodeURIComponent` and answers 500 from /api/admin/session | fixed |
| 11 | low | A malformed ObjectId in several admin routes throws and answers 500 instead of 400 | fixed |
| 12 | low | Crons compare CRON_SECRET with `!==` | fixed |
| 13 | low | The backup carries the rate limiter documents (planner token keys) and the client error log | fixed |
| 14 | low | ARCHITECTURE.md and RUNBOOK.md describe auth features that no longer exist | fixed |
| 15 | low | The admin password constant is seven uppercase letters | open, by design, see below |
| 16 | info | HSTS is not declared in vercel.json | fixed (declared explicitly) |
| 17 | info | Marketing index.html carries the admin chunk's URL in a meta tag | open, harmless |

What was confirmed sound, with the evidence, is in "Confirmed" at the end.

## Findings

### 1. Session secret falls back to a constant in the repo (high)

api/_lib/config.js:12 and :15

```js
export const SESSION_SECRET_FALLBACK = 'visualize-admin-session-fallback-2026';
export const sessionSecret = () => process.env.SESSION_SECRET || SESSION_SECRET_FALLBACK;
```

api/_lib/auth.js:16 signs `${expiresAt}.${hmac}` with `sessionSecret()`.

Exploit: if SESSION_SECRET is unset in Vercel (the RUNBOOK's own env table
says "sign in still works" without it), anyone who has read this repo can
mint a valid `vz_admin` cookie for any expiry with one line of Node and is
the admin on every endpoint, with no password, forever, and rotating the
password does nothing. The repo is private, but "private repo" is not a
secret store: a laptop, a fork, a CI log, or a future public push all leak
it. The fallback exists so "sign in can never fail on a missing secret",
which is exactly backwards for a signing key.

Fix: the fallback is gone from production. `sessionSecret()` throws when
SESSION_SECRET is unset and the code is running on Vercel (`VERCEL=1`,
which covers production and preview deployments, both of which are on the
internet). Local development and the node tests keep a fallback so nothing
needs an env file to run. api/admin/login.js and session.js catch the throw
and answer 500 `{ error: 'SESSION_SECRET is not set' }`, so a deployment
without the variable refuses every sign in instead of silently signing with
a public string. RUNBOOK's env table and rotation section say so.

### 2. No rate limit on POST /api/admin/login (high)

api/admin/login.js:23 to :40. The compare is constant time (sha256 of both
sides, `timingSafeEqual`), the password is not in any client bundle
(confirmed by grepping dist/, see "Confirmed"), but nothing counts
failures. RUNBOOK line 104: "There is no login rate limit."

Exploit: the password is a single constant. An online guess costs one POST
and the endpoint answers at full speed, so a dictionary of a few hundred
thousand words runs in minutes from one machine.

Fix: 10 failures per IP per 15 minutes, in the settings collection under
`rate:login:<sha256(ip) truncated>`, the same rolling window shape the
review and planner limiters use (stamps trimmed on every read, the document
never grows). The 11th attempt inside the window answers 429 with
Retry-After before the password is even read; a successful sign in clears
the counter. The body is also capped at 4KB. A limiter read failure lets
the attempt through (a Mongo outage should not lock Rob out on top of
everything else), the same choice the other two limiters make.

### 3. Public form fields override the notification email (high)

api/submissions.js:61 stores `b.fields` as whatever object the request
sent. api/submissions.js:115 to :128 forwards it to `sendEmail` as
`{ Name, Business, Email, Phone, Type, ...doc.fields, 'Open in Admin' }`,
and api/_lib/notify.js:38 to :44 builds the Web3Forms request as

```js
{ access_key: key, subject, from_name: fromName, email: replyTo, ...fields }
```

with `...fields` last.

Exploit: a POST to /api/submissions with
`fields: { access_key: 'x', email: 'attacker@example', subject: '...', ccemail: 'victim@example' }`
overrides every parameter of Rob's own notification: the reply-to becomes
the attacker's address (Rob replies to the wrong person), the subject is
theirs, a `ccemail` (a Web3Forms feature) makes Rob's account send mail to
third parties on the attacker's behalf, and a wrong `access_key` makes
every real submission's email silently fail. No cookie needed, no rate
limit (finding 4), and the honeypot only catches bots that fill `company`.

Fix: `sendEmail` puts its own keys after the spread and drops every field
whose name is a Web3Forms control (`access_key`, `email`, `subject`,
`from_name`, `redirect`, `ccemail`, `botcheck`, `replyto`, anything
starting with `_`), so a form field can only ever be a form field.
Combined with finding 4, `fields` is a flat map of strings before it gets
anywhere near the email.

### 4. Contact and start forms: no rate limit, unbounded fields (medium)

api/submissions.js:61 `fields: (b.fields && typeof b.fields === 'object') ? b.fields : {}`
and :89, where only `type === 'review'` is rate limited.

Exploit: unlimited POSTs of up to 256KB each (the route's body cap), every
one stored, every one a push notification to Rob's phone and an email.
Field names and values can be any JSON shape at any depth, so the
Submissions screen renders `[object Object]` and the CSV export gets
JSON blobs.

Fix: `fields` is normalised to a flat object of at most 40 keys, key names
limited to 60 characters of `[A-Za-z0-9 _.-]`, values cast to strings
(arrays joined with ", "), control characters stripped, each value capped
at 3000 characters. Every submission type is now rate limited per IP: 10
an hour for start, contact and other; reviews keep their 3 an hour. Same
settings collection limiter, IP hashed, window rolling.

### 5. No URL scheme validation on stored links and images (medium)

Every link and image field is stored as a plain capped string:

- api/_routes/call-leads.js:55 `imgLink = (v) => str(v, 500)` (cover, logoUrl, brand.logo, brand.images[].link, website.screenshots[].link, cards.front/back, print.items[].image, instagram.profileImage, instagram.posts[].image, instagram.highlights[].image); :90 website.url; :112 instagram.url; :115 posts[].link; :123 highlights[].link; :230 concepts[].link; :259 to :260 conceptsTracker.demoUrl/driveUrl; :295 links.*; :301 brand.logoLink; :330 reviews.googleLink
- api/_routes/posts.js:86 imageUrl
- api/_routes/concept-packs.js:24 images[].link
- api/_routes/projects.js:43 links.*; :45 deliverables[].link
- api/_routes/orders.js:31 items[].artworkLink

and rendered as `href` on the public site (src/pages/CaseStudy.jsx:212
website.url, :232 instagram.url, :257 highlight link, :272 post link;
src/pages/Review.jsx:207 googleReview) and in the admin
(src/components/LeadDetail.jsx:315, ClientWorkspace.jsx:50, :480, :488).

Exploit: a `javascript:alert(document.cookie)` saved as a client's website
URL is a live script link on that client's public page and in the admin.
Writing it needs the admin cookie, so this is a stored XSS from a phished
or borrowed admin session, not from the public, and the admin cookie is
HttpOnly so the classic payload gets nothing; but a script on
visualizestudio.org can still deface, redirect, or phish visitors, and one
in the admin runs with the admin's session. Images are lower risk
(`javascript:` in `img src` is inert in every current browser), but the
same helper covers them so the rule is one rule.

Fix: api/_lib/url.js `safeUrl(v, max)` accepts `http://`, `https://`, or a
root-relative path (`/x`, never `//x`), rejects whitespace and control
characters, and returns '' for anything else. Every field listed above
goes through it in its route's sanitize(). The public pages and the admin
link buttons also pass the value through src/lib/safeUrl.js on the way to
`href`, so a record written before this change cannot render a
`javascript:` link either. Every external anchor already carried
`rel="noopener noreferrer"` or `rel="noreferrer"` (which implies noopener);
confirmed by grep, nothing to add.

### 6. `.env` is tracked in git (medium)

`git ls-files` lists `.env`; `.gitignore` lists it too, which only stops
new additions. It was committed in 538cd0a (2026-05-11) for the retired
Python client portal and carries SECRET_KEY, DATABASE_URL (sqlite),
SIGNUP_TOKEN, an empty CALENDLY_PAT, and VITE_STRIPE_IG_LINK (a public
payment link URL).

Exploit: none today. Nothing in api/, src/ or scripts/ reads any of those
names (grepped), the portal they belonged to is gone, and CALENDLY_PAT is
blank. But a tracked env file is where the next real secret gets pasted by
habit, and the file's presence in a clone tells anyone what the deployment
expects.

Fix: `git rm --cached .env`; the file stays on disk and ignored. The values
in history are treated as burned: SECRET_KEY and SIGNUP_TOKEN belonged to
an application that no longer exists, and the Stripe link is public by
nature. No rewrite of history (it would break every clone for a secret that
guards nothing).

### 7. The marketing host has no Content-Security-Policy (medium)

vercel.json:129 to :141 sets a CSP only for host admin.visualizeclients.com.
RUNBOOK line 110: "The marketing host has no CSP header and is unaffected."

Exploit: the marketing site renders admin supplied strings from
/api/showcase on every page, and the client planner and review form are on
this host. React escapes text, so today there is no injection, but a CSP
is the layer that turns a future one (a dependency, a `dangerouslySetInnerHTML`
added in a hurry, finding 5 before its fix) from a script into a console
error. There is nothing on the marketing host that needs a third party
origin: fonts are self hosted, gsap and lenis are bundled, images come from
res.cloudinary.com over https, Calendly and Instagram are plain links.

Fix: a second vercel.json header rule for host visualizestudio.org with
`default-src 'self'; script-src 'self' 'sha256-<pre-paint script>'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`.
The build plugin that pins the inline script's hash into vercel.json now
replaces every `'sha256-...'` in the file, not the first, so both policies
follow the same script. Verified by serving dist/ with the header from a
local static server and walking Home, Services, Clients, a client page, the
review form and the planner in Chromium with a `securitypolicyviolation`
listener: zero violations, every audit green.

### 8. npm audit (medium)

Before: 17 (3 low, 4 moderate, 10 high). What matters at runtime:

- react-router-dom 6.28 (moderate, open redirect via `//` and `\` in
  `<Link>`/`useNavigate`): the site only navigates to its own literal
  paths, so nothing user supplied reaches a redirect, but it is one
  `npm audit fix` away.
- xlsx 0.18.5 (high, prototype pollution and ReDoS): only reachable through
  the admin's own spreadsheet import (the admin picks a file on their own
  machine and the parse runs in their browser), so the attacker has to hand
  Rob a crafted file and Rob has to upload it into his own CRM. No fix is
  published on npm for 0.18.x (SheetJS moved releases off npm).
- vite 6 (high): the dev server only; never runs in production.
- postcss, nanoid, picomatch, browserslist, @babel/core, baseline-browser-mapping:
  build time only.
- lighthouse 11 and puppeteer-core 24 (high via extract-zip, @sentry/node,
  cookie): the audit scripts, never shipped; the fix is a major upgrade of
  each.

Fix: `npm audit fix` (non breaking) for everything it covers, then the full
audit battery re-run to prove the build and every script still pass. After:
see the report. Open: xlsx (no non breaking fix; the mitigation is that the
only input is Rob's own file), lighthouse and puppeteer-core (dev only,
major upgrades, left for a tooling prompt).

### 9. Planner responses cacheable; the token limiter keys on the raw token (low)

api/planner.js sets no Cache-Control, so a client's month can sit in a
shared cache or the browser's back-forward cache with the token in the URL.
api/planner.js:49 `_id: \`rate:planner:${token}\`` writes the token a
second time into the settings collection, which the backup exports.

Fix: `Cache-Control: no-store` on every planner response; the limiter key
is `rate:planner:<sha256(token) truncated>`, so the settings collection and
the backup never carry a token outside the lead it belongs to.

### 10. A malformed cookie answers 500 from /api/admin/session (low)

api/_lib/auth.js:32 `decodeURIComponent(v.join('='))` throws on `%E0%A4%A`
and similar. api/admin/session.js has no try/catch, so a garbage cookie is
a 500 with a stack in the log instead of a 401.

Fix: the decode is wrapped; a cookie that does not decode is no cookie.

### 11. A malformed ObjectId answers 500 instead of 400 (low)

api/_routes/call-leads.js:434, :454, :474 (`new ObjectId(String(id))` in
PATCH), api/_routes/submissions.js:39 (`toIds`) and :53 (`?id=`). The route
wrapper catches the throw, so nothing leaks, but the RUNBOOK's promise that
"a bad id is a 400, never a query operator" is only half true: never an
operator, yes; a 400, no.

Fix: cast with the same `oid()` helper the other routes use and answer 400.

### 12. Crons compare CRON_SECRET with `!==` (low)

api/_routes/cron-reminders.js:38 and cron-daily.js:21. A string compare
that stops at the first wrong byte is a timing oracle in theory; over the
internet, through Vercel, against a random secret, it is not a practical
one. Fixed anyway because it is one line: sha256 both sides,
`timingSafeEqual`.

### 13. The backup exports the limiter documents and the error log (low)

api/_routes/backup.js:13 masks `settings._id === 'auth'` (which no longer
exists) and nothing else. The `rate:*` documents carried planner tokens
(finding 9) and the `client-log` document carries stack traces. Admin only,
and the lead records in the same file carry the tokens anyway, so this is
tidiness: the backup should be the data, not the plumbing.

Fix: `rate:*` and `client-log` documents are skipped.

### 14. Documentation describes auth that does not exist (low)

docs/ARCHITECTURE.md:58 "api (apiFetch with the CSRF header)", :113
"POST (rate limited)", "GET (renews the cookie)", :133 settings documents
`auth {salt, hash, changedAt}` and `login-limit`. None of these survived
the auth rebuild; a reader trusting the doc would believe in a limiter that
was not there. RUNBOOK lines 23, 104, 105 describe the fallback secret and
the missing rate limit as accepted.

Fix: both documents rewritten to match the code after this audit.

### 15. The admin password is seven uppercase letters (low, open)

api/_lib/config.js:10 `export const ADMIN_PASSWORD = 'VISLIVE'`.

This is the house rule (CLAUDE.md: "The admin password is the constant in
api/_lib/config.js") and it is not changed here. With the rate limit in
place a 7 character all-caps word costs an attacker 10 guesses per 15
minutes per IP, which puts a dictionary out of reach, and the constant is
not in the client bundle. The recommendation stands: set ADMIN_PASSWORD in
Vercel to a long random value (it overrides the constant), so the repo
holds nothing that opens the admin.

### 16. HSTS not declared (info)

vercel.json declares no Strict-Transport-Security. Vercel adds
`max-age=63072000` itself on every deployment, so the header is present in
production; this sandbox cannot reach the live hosts to show it. Declared
explicitly in vercel.json anyway (`max-age=63072000; includeSubDomains`),
so the policy is in the repo and not a platform default.

### 17. The admin chunk's URL is in the marketing HTML (info)

index.html:5 `<meta name="vz-admin-chunk">` is filled by the build and
served on both hosts; only the admin host preloads it. The chunk is static
JavaScript with no secret (confirmed, finding "Confirmed" below) and the
route it serves is cookie guarded, so knowing its URL gains nothing. Left
as is.

## Confirmed

Things the audit set out to break and could not, with what was checked.

- Cookie: `vz_admin`, HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30
  days (api/_lib/auth.js:25). HMAC-SHA256 over the expiry, base64url,
  compared with `timingSafeEqual` after a length check (:43 to :45). The
  expiry is inside the signed value, so it cannot be extended.
- Password compare: sha256 of both sides then `timingSafeEqual`
  (api/admin/login.js:21, :31), so the compare is constant time whatever
  the lengths.
- Nothing secret in the bundle: `npm run build`, then grep of dist/ for
  every env var name the code reads, for the password constant, the old
  fallback secret, `api_secret`, `sk_live`, `whsec_`, `mongodb://`, PEM
  headers and JWT shapes. The only hits are the env var NAMES inside
  AdminSettings' help copy ("Add STRIPE_SECRET_KEY for read access"). No
  value, no key.
- Git history: no `.env` other than finding 6; config.js has only ever
  held the two constants above; a grep of every commit for Stripe, Mongo,
  VAPID, Web3Forms, AWS and private key shapes finds only a redacted
  `mongodb+srv://…` in a migration script's comment.
- CSRF: with SameSite=Lax the cookie is not sent on a cross site POST,
  PATCH or DELETE, and the marketing site is a different site from the
  admin host. Every admin write is POST, PATCH or DELETE. The GETs that
  touch the database (settings creating its default documents, backup
  stamping lastBackupAt, call-leads and submissions purging tombstones
  past 30 days) change nothing an attacker would want changed and return
  JSON a cross site page cannot read. The X-Requested-With check is not
  restored; nothing needs it.
- /api/showcase: `slug` is used only when `typeof === 'string'`
  (api/showcase.js:195), so `?slug[]=x` and `?slug[$gt]=` cannot become an
  operator; the find is on two literal keys. Every response goes through
  `publicClient()`, the whitelist scripts/showcase-endpoint-test.mjs
  asserts by key against a lead stuffed with private fields, and that test
  passes. No path returns a raw document.
- /api/planner: the token must match `^[A-Za-z0-9_-]{16,64}$` before any
  query (api/planner.js:38); it is minted server side as 24 random bytes
  (192 bits, api/_routes/call-leads.js:441) so enumeration is not a
  threat at any request rate. Missing, malformed, unknown and disabled
  tokens, a malformed postId, and another client's postId all go through
  the one `notFound()` and are byte identical (asserted by
  scripts/planner-endpoint-test.mjs and now scripts/security-test.mjs).
  The ownership check is `leadId` inside the `findOne` filter (:144), not
  a comparison afterwards. postId is cast with `new ObjectId()` (:139).
  The action limiter is per valid token; omitting the token is a 404
  before any counting and any database write, so there is nothing to
  bypass. The lastViewedAt stamp only runs for a valid token, so it
  cannot distinguish two invalid ones. The POST re-runs `clientFor()`
  every time, so a revoked or disabled token cannot act from a cached
  page.
- The planner and review pages set no cookie (`document.cookie` appears
  nowhere in src/), send none (the admin cookie is scoped to the admin
  host, a different site), and load no third party script (index.html and
  the bundle reference no external origin; the only cross origin requests
  are Cloudinary images). Referrer-Policy strict-origin-when-cross-origin
  sends only the origin on the outbound Calendly, Instagram and Google
  links, never the path with the token.
- Rendering: one `dangerouslySetInnerHTML` in src/ (src/shell/BootFrame.jsx:9,
  a build time constant). No `innerHTML`, no markdown or HTML library. Every
  admin and public string (captions, notes, welcome, blurbs, testimonials,
  hashtags, review text, change request notes, form fields) is rendered as
  a React text child; the Submissions screen wraps values in `String()`.
- Every MongoDB filter that takes request input casts it: ids through
  `ObjectId`, strings through `String()`, enums through `includes()`,
  search text through a regex escape, dates through `Number()`/`new Date()`.
  No request value is spread into a filter. Every write is `$set` of a
  sanitize() result; `_id`, `createdAt`, `deleted` and `leadId` are not
  keys any sanitize() emits (posts and projects delete `leadId` on PATCH;
  call-leads has no `leadId`).
- Stripe webhook: raw body, `t=` within 300 seconds, HMAC compared with
  `timingSafeEqual` after a length check (api/_lib/stripe.js:31 to :40),
  event row inserted under a unique index before any ledger write, second
  delivery is a no-op (api/_lib/stripe.js:134 to :138).
- Backup: admin guarded (api/admin/index.js:30), push_subscriptions not
  exported, stripe_events exported without `raw`.
- Headers (both hosts): X-Content-Type-Options nosniff, X-Frame-Options
  DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy
  camera/microphone/geolocation/payment/usb/interest-cohort off. Admin CSP:
  script-src is `'self'` plus one sha256, no unsafe-inline, no unsafe-eval;
  connect-src `'self' https://api.cloudinary.com`; frame-ancestors none.
- /admin/* on the marketing host: vercel.json redirects it to / at the edge
  and src/App.jsx does the same client side; every /api/admin/* call is
  cookie guarded whichever host it arrives on.
- The service worker never caches /api/planner, /api/showcase or
  /api/submissions (public/sw.js:18, five admin list GETs only), so a
  revoked token cannot be served from a cache.
- Vercel functions: 10 of 12 before and after (api/_lib/url.js is a
  library under `_lib`, not a function).

## The guard that stays

scripts/security-test.mjs (wired into CLAUDE.md's script list) runs the
real handlers against an in memory MongoDB fake, the same way the showcase
and planner endpoint tests do, and asserts:

- operator injection: `{ "$gt": "" }` as slug, token, month, postId, id,
  ids, leadId, status, type, q, days, and the login password, on every
  public and admin query, is refused or cast, never matched
- a `javascript:` URL, a `data:` URL, a protocol relative `//` URL and a
  URL with a newline, in every image and link field of call-leads
  (showcase and otherwise), posts, concept-packs, projects and orders,
  stores as an empty string, while `https://` and a root relative path
  store unchanged
- a `<script>` tag in every text field that reaches a public page
  (showcase blurb, notes, captions, testimonials, planner welcome, post
  caption, hashtags, note, review text, change request note) is stored
  verbatim (React escapes it) and never re-emitted as HTML by any endpoint
- the planner: a malformed token, a token for a disabled planner, an
  unknown token and no token answer the same bytes; a cross client postId
  is that same 404; a revoked token stops on the next call
- the login limiter: 10 wrong passwords lock the 11th out with 429 and a
  right one after the window succeeds
- the submission limiter and the field normaliser: an 11th contact form in
  an hour is 429, nested `fields` flatten to strings, and reserved
  Web3Forms keys never reach the email
