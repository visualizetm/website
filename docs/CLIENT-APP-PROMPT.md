Client app on app.visualizeclients.com, with a 4 digit code login
One job, one run. No questions and no hard stops. Decide by the decision rules, log each call in `docs/CLIENT-APP-DECISIONS.md`, and keep going. If you hit a limit or a new session starts, the resume line is: "Continue the client app job from docs/CLIENT-APP-PROMPT.md."
STEP 0 (do this first, every session)

1. If `docs/CLIENT-APP-PROMPT.md` does not exist, save this whole prompt there and commit it ("Client app: the prompt").
2. Read `docs/CLIENT-APP-PROGRESS.md` if it exists. It says which milestone is done and what is next. Start from there. Never redo a milestone marked done.
3. Read `docs/CLIENT-APP-BLOCKERS.md` if it exists, so you do not walk into the same wall twice.
4. After every milestone: update PROGRESS (milestone, commit hash, what is left, the next action in one line), commit, push to main.

READ FIRST
CLAUDE.md (all standing rules hold), docs/ARCHITECTURE.md, docs/SECURITY-AUDIT.md, docs/MOBILE-UI-GUIDE.md, docs/PLANNER-V2-PROMPT.md and reports/PLANNER-V2-REPORT.md (what the planner is now), then only the files the job touches: src/App.jsx, src/main.jsx, src/lib/adminPaths.js, index.html, vercel.json, public/sw.js, public/site.webmanifest, public/manifest.webmanifest, api/showcase.js, api/planner.js, api/_routes/portal-public.js, api/_lib/auth.js, api/_lib/team.js (the scrypt passcode pattern), api/_lib/limit.js, api/_lib/clientDevices.js, api/_lib/plannerPush.js, api/_lib/clientPush.js, api/_lib/portalModules.js and src/shared/portalModules.js, src/pages/Planner.jsx, src/pages/Portal.jsx, src/pages/AdminPlanner.jsx, src/components/LinkSend.jsx, scripts/routing-test.mjs, scripts/audit-screens.mjs.
WHERE WE ARE (verified November 24, 2026)

* main is at `acc4af3` (Planner v2, 3.4). Planner v2 is done: screens in src/components/planner/, the board in src/components/PlannerBoard.jsx, pushes in api/_lib/plannerPush.js, the shared push toggle in api/_lib/clientDevices.js.
* Vercel project `website` now has three verified domains: visualizestudio.org, admin.visualizeclients.com, and app.visualizeclients.com (DNS valid, added today). It shows "No Deployment" only because no production deploy has run since it was added; your first push to main fixes that. Check it serves after milestone 1.
* 10 of 12 Vercel functions are used: api/admin/index.js, login.js, logout.js, session.js, api/cron/index.js, api/planner.js, api/push-key.js, api/showcase.js, api/stripe/webhook.js, api/submissions.js. No new function. api/showcase.js already hosts the portal (`/api/portal` rewrites to `/api/showcase?r=portal`) and the concepts page; the new auth door rides there the same way.
* One bundle serves every host. `IS_ADMIN_HOST` lives in src/lib/adminPaths.js. src/App.jsx sends /planner/:token, /c/:token (portal), /r/:token, /u/:token, /review and /concepts/:token to standalone pages on the public host.
* The planner is found by `planner.token` on the lead (call_leads), the portal by `portal.token`. They are two different tokens on the same lead.
* The portal already has an optional 4 digit PIN that Rob sets (`portal.pin`, a sha256 of SESSION_SECRET plus the PIN, `pinPatch` in src/lib/portal.js); it unlocks the sensitive cards for 30 days with a signed unlock token. It is weaker than what this job builds.
* Billy's passcode (api/_lib/team.js) is scrypt with a salt and a version; his session is the signed `vz_caller` cookie (api/_lib/auth.js). Copy that pattern; do not invent a new one.
* index.html swaps the manifest link per host in an inline script whose hash the build pins into the CSP in vercel.json. public/site.webmanifest has start_url "/" and display "browser", which is why a client's Home Screen icon opens the homepage in a browser today and why iOS web push cannot work for clients. This job exists to fix that.
* Client URLs are built in: `PORTAL_URL_BASE` and `plannerLink` (src/shared/portalModules.js and its mirror api/_lib/portalModules.js), `previewUrl` in src/pages/AdminPlanner.jsx, the push deep links in api/_lib/plannerPush.js and api/_lib/clientPush.js, and possibly email templates and LinkSend. Grep for `/planner/`, `/c/` and `visualizestudio.org` to find every one before you change any.

THE JOB
Every client gets one app at app.visualizeclients.com: the same address for everyone, one manifest, one Home Screen app. A client sets their own 4 digit code the first time, and from then on the app knows who they are. "Panel" means the portal and the content planner together behind one login.
The client's flow

1. First open. Rob texts the link as today. The link is now `https://app.visualizeclients.com/c/<portal token>` (or `/planner/<planner token>` for a planner only client). The app looks the token up. If the lead has no code yet, it shows Set your code: four digits, then the same four again. Weak codes are refused with one plain line ("Pick something harder to guess"). On success the device is signed in and lands on the panel.
2. Add to Home Screen. After the code is set, show one card once: how to add the app to the Home Screen (iPhone: Share, then Add to Home Screen; Android: the browser's install prompt where it exists). It can be dismissed and never shows again on that device.
3. The Home Screen icon opens `/` standalone. On iPhone a Home Screen app has its own cookie jar, separate from Safari, so the first open from the icon is NOT signed in. That is expected: the client signs in once with phone number or email plus their code, then stays signed in for a year. Remember the phone or email on the device (localStorage, the identifier only, never the code) so a later sign in only asks for the four digits.
4. A token link when a code already exists opens the sign in screen with the client already known (only the four digits asked). A token alone never shows any client data.
5. Forgot the code. The sign in screen says "Forgot it? Text me and I'll reset it." with an sms: link to Rob's number if Settings holds one, otherwise the plain line. Nothing sends by itself.
6. Sign out is a text link at the bottom of the panel's settings.

Security (4 digits is short, so these carry it)

* Store the code as scrypt hash plus salt, the team.js way, under `portal.code` on the lead: `{ hash, salt, setAt, version, fails, lockedUntil, locked }`. Never return any of it to a client; add the keys to the server's never-send list and to security-test.
* Refuse weak codes on the server (the client check is only a hint): four of one digit, straight runs up or down (0123 to 6789, 3210 to 9876), and this list: 1212, 1004, 2000, 2001, 1010, 1122, 1313, 6969, 2580, 0852. Keep the list in one shared module mirrored byte for byte in api/_lib, with a test.
* Lockout per lead: 5 wrong in a row locks 15 minutes; 10 wrong in a row locks until Rob resets it, and sends Rob one push (pick the closest existing push category, log the choice). A right code clears `fails`.
* Per caller limit through api/_lib/limit.js on the sign in door: 20 tries an hour per IP, so nobody can spray codes across many phone numbers. Same for the set code door.
* Identifier lookup: phone compared on its last 10 digits, email lowercased and trimmed, only among leads that have a portal or planner token and a code set. No match, more than one match, and a wrong code all answer the same `401 { error: 'did not match' }` after the same work (run scrypt on a dummy when there is no lead), so the door never says which phones are clients.
* Session: a cookie `vz_client`, HttpOnly, Secure, SameSite=Lax, host only on app.visualizeclients.com, 365 days, HMAC signed with SESSION_SECRET over `leadId.codeVersion.expiry`. No database lookup to verify the signature; the data doors then load the lead and reject the cookie if `portal.code.version` changed. Reset code bumps the version, which signs every device out.
* The token's new job: on the app host the token only opens the code door (set when none, sign in when one exists). Every data read and write (`/api/portal`, `/api/planner`, every client push and alert door) takes the lead from the `vz_client` cookie. A request with a token and no valid cookie gets `401 { error: 'sign in' }`. Every existing whitelist, field cap, per lead limiter and 404 rule stays exactly as it is; only where the lead comes from changes.
* The old sensitive PIN: a signed in session counts as unlocked for the sensitive cards (the code is stronger than the old PIN). Keep the `portal.pin` field (additive schema), stop asking for it on the app host, and replace Rob's Set PIN control in the CRM with the code status below.

Rob's side (the CRM)
On the client record's portal section: one line, Code: set Nov 24 / Code: not set yet / Locked, 10 wrong tries (red), plus Reset code (clears the code, bumps the version, unlocks; a confirm sheet says the client will set a new one from the link). The link buttons (Text it, Share, Draft an email) send the new app URL. Nothing in this sends a text or email by itself.
Rob's planner preview (`previewUrl` in AdminPlanner) and any portal preview stop working once tokens stop reading data. Give them a read only preview on the admin host: an admin route behind `route()` that returns the exact payload the client door returns for that lead, rendered by the same screens with no write control. No client cookie is ever minted for Rob.
Host, routing and the app shell

* `IS_APP_HOST` in src/lib/adminPaths.js beside `IS_ADMIN_HOST` (`app.visualizeclients.com` or a host starting `app.`; localhost gets a dev switch the same way the admin does).
* src/App.jsx: on the app host serve only the client app (its own lazy chunk, `src/clientapp/` or the nearest existing pattern, like `src/room/`): `/` (panel if signed in, else sign in), `/c/:token`, `/planner/:token`, `/planner` (the planner for the signed in client), and the portal's own sub paths if it has any. Anything else on the app host goes to `/`. The marketing site, the admin and the Call Room never mount there.
* The panel's home is the portal's cards; the planner opens from its card and from the planner's own glass tab bar as it is now. If a lead has the planner but no portal token, the panel's home is the planner. Do not redesign either screen; only the chrome that joins them, built from the kit and the CRM tokens the planner already uses.
* Old links keep working: in vercel.json, on the public host only, `/c/:token` and `/planner/:token` redirect (308, permanent false for now so it can be undone) to the same path on https://app.visualizeclients.com. /r/, /u/, /review and /concepts/ stay on visualizestudio.org untouched.
* Manifest: a new `public/app.webmanifest` with name and short_name "Visualize.", start_url "/", scope "/", display "standalone", background and theme color #080808, and the logo pack's icons (the same files the site manifest points at; never draw an icon). index.html's per host swap adds the app host. Let the build re-pin the inline script hash; never hand edit it.
* CSP and headers: a host block for app.visualizeclients.com in vercel.json, built from the strictest existing block the planner and portal need today (check which images, media and connect hosts they use and allow only those), `frame-ancestors 'none'`, Cache-Control no-store on the HTML. Every /api/ rewrite the app calls must reach its function on this host too; routing-test must know the third host.
* Push: the service worker is per origin, so a client's push devices must be registered from the app host. Push deep links from plannerPush and clientPush open app host paths (`/planner` and `/`, never a token). Existing client devices registered on visualizestudio.org keep receiving pushes; a tap on one opens the app host. In the panel, show the existing notifications switch only in the Home Screen app on iPhone (standalone) and in any browser that supports push elsewhere, with one line on iPhone in Safari: "Add me to your Home Screen to get pings."
* Every client URL builder listed in WHERE WE ARE now builds app host URLs from one constant (`CLIENT_APP_BASE`, mirrored), with no token in a push or an email except the one setup link Rob sends.

HOW TO WORK

* Build with `src/ui` and `var(--v-...)` tokens only. Hex count must not rise. No em dashes anywhere, comments included. "I", never "we", in anything a client reads. No mention of AI.
* `$set` only, additive schema, sanitize() whitelists, `route()` on every dispatched route, safeUrl and safeHref as today. Every new public door goes through the shared limiter.
* No new serverless function, no new env var, no new cron. SESSION_SECRET is the only secret this job reads.
* Copy for every new screen lives in src/shared/copy.js. Every new screen ships with its skeleton, its empty, error with Retry, and entrance states, 44px targets, labels on icon buttons, a live region for the code errors, and the numeric keypad (`inputmode="numeric"`, `autocomplete="one-time-code"` off for the set step, `current-password` style handling so a password manager can save it).
* Every new client screen gets a `marketing: true` style entry in scripts/audit-screens.mjs (add an `app: true` flavor if the audit needs a host switch) so layout, a11y, feel, chrome and empty audits cover it.
* Long audits run detached; poll their logs. Never print whole files or logs into the session; grep and tail.

RULES THAT HOLD (every audit that passes today still passes)
lint, build, hex-count, routing-test and routing-guard-proof, security-test, portal-test and portal-guard-proof, planner-endpoint-test, planner-view-test, planner-board-test, planner-alerts-test and its guard proof, back-test, regression (25a was already failing before Planner v2 from Quotes; leave it unless the one line fix is obvious, and say which), a11y-audit (no serious or critical), layout-audit and scene-audit at 320, 390, 430, 768 and 1280, gesture, chrome, empty, docs-editor and docs-flow audits, and `npm run preship`.
Tests that read the planner or portal with a bare token must now sign in first through a test helper and then run every check they ran before. Count the checks before and after and report both numbers. A check may be rewritten to use the cookie; it may never be deleted, skipped or loosened. Add new checks that a token alone now gets 401 on every data door.
DECISION RULES

* Two ways to do it: pick the one with less code that is easier to verify.
* A choice between safer and smoother for the client: safer, unless it adds a step the client takes more than once a year.
* Something not covered here: pick the plainer option and log it.
* An existing test conflicts with the new auth: the new auth wins, and the test is migrated (never weakened) with its old check count kept.
* iOS behavior you cannot test in Playwright (standalone cookie jar, Add to Home Screen, push): build it to the spec, test what a browser can, and list it under "Needs Rob's phone".

MILESTONES (one commit each, push after each)

1. Host and shell. `IS_APP_HOST`, the app chunk with a placeholder sign in screen, the manifest swap, the app.webmanifest, the vercel.json host block (CSP, headers, rewrites), routing-test learns the third host. After the push, curl https://app.visualizeclients.com and https://app.visualizeclients.com/app.webmanifest and record the status codes in PROGRESS.
2. The code door. The shared weak code module and its mirror, `portal.code` storage, set and sign in and sign out through api/showcase.js by rewrite (`/api/app/...`), the `vz_client` cookie, lockouts, the IP limiter, the identical 401, Rob's push on the hard lock. A new `scripts/client-app-test.mjs` against the real handlers, and `scripts/client-app-guard-proof.mjs` that puts back each fault in a copy and proves a check fails: a weak code accepted, the code readable in a response, no lockout at 5, no hard lock at 10, a reset that does not sign devices out, a different answer for an unknown phone, a cookie signed without the version, a token reading data. At least 8 cuts.
3. The data doors move to the cookie. /api/portal and /api/planner read the lead from the cookie, the token only opens the code door, the sensitive gate follows the session, the migrated tests with their before and after counts, security-test grows the new never-send keys and the token-alone 401s.
4. The client screens. Set your code, sign in (remembered identifier, four digit entry, the forgot line, the lock messages with the minutes left), the Add to Home Screen card, the panel joining portal and planner, sign out, and the notifications line for Safari on iPhone. Audits at every width, both themes where the screen has them (the planner is dark only).
5. Links, pushes and Rob's side. `CLIENT_APP_BASE` everywhere a client URL is built, the old link redirects, push deep links to app paths, the CRM code status and Reset code, Rob's read only previews on the admin host. links-test, planner-alerts-test and portal-test updated the same no-loosening way.
6. The gate and the report. Run every script in RULES THAT HOLD and every guard proof, fix what fails, update docs/ARCHITECTURE.md (a "Client app" section), docs/SECURITY-AUDIT.md (the code, the lockouts, the cookie), CLAUDE.md (one standing rule for the client app, written like the others), and write `reports/CLIENT-APP-REPORT.md`.

ROADBLOCK RULE
If something stops you (a test you cannot make pass without loosening it, a platform limit, a missing permission, an audit that will not go green, a host that will not serve):

1. Write it in `docs/CLIENT-APP-BLOCKERS.md`: the milestone, what you tried, the exact error (a few lines, never a whole log), what you think the cause is, and what Rob or a new session would need to do.
2. Revert to the last green commit for that piece of work. Never leave main red.
3. Skip to the next milestone that does not depend on it and keep going.
4. Stop only when every milestone left is blocked. Then make the report say so at the top.

Never loosen an audit, add a skip or an exemption, or rewrite a test step to get a green. If that is the only way through, it is a blocker.
REPORT (reports/CLIENT-APP-REPORT.md, 30 lines or fewer, and paste the same in the session's final message)

* Commit hashes with dates, one line per milestone, and whether each is done, partial or blocked.
* Blockers, if any, first, each with what is needed to clear it.
* The status codes from milestone 1's curl checks.
* Every test's check count before and after (migrated tests must match or grow), and the guard proof cut counts.
* Every audit in RULES THAT HOLD with pass or fail, and why for any fail.
* Decisions logged (count, plus the three that matter most).
* What needs Rob's phone: set a code from the texted link in Safari, add to Home Screen, open the icon and sign in, confirm it stays signed in after closing it, turn on pings from the Home Screen app and get one, a wrong code five times, Reset code from the CRM signing the phone out, an old visualizestudio.org link landing right.
* The single next step.
