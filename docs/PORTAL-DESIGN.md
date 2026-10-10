# Client portal: the product rules, the module registry, the security model

Read this before touching the portal. Prompt 1 built the shell; prompts 2 to
4 add cards by adding registry entries and nothing else.

## The product

One link per client, `https://visualizestudio.org/c/<token>`. It opens a
home screen of cards. Each card is a module. A module has three states on
the CRM side: Off, On, Auto. Auto is the default and means render only when
there is something to show. A new client sees two or three cards; a Growth
retainer client sees many. An empty card never renders; the home never shows
a placeholder, a coming soon or a fake item. The client never logs in: the
token is the key. An optional four digit PIN per client (off by default)
gates only the cards flagged sensitive; the device remembers it for 30 days.

## The data

`portal` on the client record (call_leads), additive:

    { token, createdAt, regeneratedAt, sentAt, views, lastViewedAt,
      pin (a hash or ''), modules: { [moduleId]: 'off' | 'on' | 'auto' },
      template: 'brand' | 'website' | 'retainer' | '', documents: [], hours: '' }

The token is minted on the server only (api/_routes/call-leads.js, the same
rule as the planner and the review link: 24 characters, base64url, minted
when `portal` is first sent and on `{ regenerate: true }`, which kills the
old link; views and the stamps are never taken from a request). The PIN is
stored as a salted sha256 (never the digits) when the CRM sends
`{ pin: '1234' }`; `{ pin: '' }` clears it. `documents[]` is
`{ id, label, url, kind: doc | sheet | pdf | drive | link, addedAt }`, every
url through safeUrl.

## The module registry contract

`src/shared/portalModules.js`, mirrored byte for byte in
`api/_lib/portalModules.js` below `export const PORTAL_MODULE_IDS`
(scripts/portal-test.mjs asserts it). Each entry:

    { id, title, order, sensitive, defaultState, auto, fields, resolve(client, projects, settings) }

- `resolve` returns null (do not render) or the card's data. It reads the
  raw records and returns only what the page may see; the server runs it,
  then `cardOf` whitelists the result against the module's `fields` list, so
  a resolve that leaks a stray key still sends nothing extra.
- `auto` is one sentence saying when the card shows on Auto (the CRM shows it
  under the control).
- `sensitive: true` means the card's data is held back until the device has
  unlocked the PIN; the page gets `{ id, title, sensitive, locked: true }`
  instead. No prompt 1 module is sensitive; portal-test proves the gate with
  a test only module.
- `defaultState` is 'auto' for every module in prompt 1; `home` is always on
  and has no control.
- State logic (`portalCards`, reading `portalStateOf`: the stored state,
  else the module's defaultState; home is fixed on): off never renders, even
  with data; on renders only if resolve returns data; auto equals on. There
  is no way to render an empty card.
- A card never carries a raw phone or email: the contact card sends ready
  `sms:` and `mailto:` hrefs under `sms` and `mailto`, so the forbidden key
  check (below) holds for every module.

## Auto rules (prompt 1)

| Module | Shows when |
|---|---|
| home | always: the logo on the first brand colour (the Aperture on Visualize red without one), Hey first name, the newest active project's stage or All set, Made by Rob |
| contact | my phone or email is set in Settings, Profile (the Client portal card); the hours line from portal.hours, then settings.profile.hours |
| book | settings.profile.calendlyLink is set, else the CALENDLY_MEETING_LINK fallback through api/_lib/config.js meetingLink() |
| documents | at least one document on portal.documents |
| showcase | showcase.published is true |

## Templates

Brand, Website, Retainer. Choosing one sets `portal.modules` to that
template's map (`PORTAL_TEMPLATES`); in prompt 1 every map is all Auto, and
later prompts put their modules into the maps where they belong.

## The security model

- The token is the whole credential: no token, a malformed one, an unknown
  one, a regenerated one and a deleted record are the same 404 body.
- The public door rides on api/showcase.js (vercel.json rewrites /api/portal
  to /api/showcase?r=portal; api/_routes/portal-public.js), like the planner,
  the concepts and the review link: no new function. GET resolves the token
  to `{ client: { firstName, business, logoUrl, brandHex }, cards: [...],
  pinned, unlocked }` and counts a view at most once an hour per token
  (rate:pview). POST
  `{ action: 'pin', pin }` checks the PIN, five tries per fifteen minutes per
  token (rate:ppin), and answers a signed unlock token (an HMAC over the
  token and an expiry, SESSION_SECRET, 30 days) the page keeps on the device
  and sends as `?unlock=`; a sensitive card's data goes out only when it
  verifies. The unlock is bound to the token, so a regenerate kills it too.
  The PIN hash is sha256 over the session secret and the digits, the same
  function in call-leads.js and portal-public.js.
- Nothing leaves the server that the registry did not whitelist; the page
  never receives a raw client or project record. scripts/portal-test.mjs
  fails if any card payload carries _id, email, phone, purchases, invoices,
  notes or checklists, and that every card carries only its module's fields.
  scripts/portal-guard-proof.mjs cuts each guard out in turn (28 guards) and
  requires its check to fail.
- Every string the CRM stores is capped and every url goes through safeUrl.

## How to add a module (prompts 2 to 4)

1. Add one entry to `src/shared/portalModules.js` with id, title, order,
   sensitive, defaultState, auto, fields and resolve; copy the file's body
   into `api/_lib/portalModules.js` below PORTAL_MODULE_IDS (the test checks).
2. Put the id into the template maps where it belongs.
3. Add the card's component to `src/pages/Portal.jsx`'s CARD map, built from
   src/ui and the --v tokens, phone first, 44px targets.
4. Give scripts/portal-test.mjs one fixture that renders it and one that
   does not, and a line in the whitelist check.
5. Add its audit screen entries (scripts/audit-screens.mjs, marketing: true).
Nothing else changes: the route, the CRM card's controls and the page's
shell read the registry.
