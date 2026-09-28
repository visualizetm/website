# Visualize CRM: the complete rebuild brief

A full scan of the admin CRM at admin.visualizeclients.com as it stands on
main today: what every screen shows, how it is laid out on a desktop and
on a phone, what every control does, what it reads and writes, and the
rules the system runs on. It is written so the whole thing can be rebuilt
from this document alone. Nothing in it is aspirational; every label,
number and rule was read from the code.

How to read it:

- Part 0 (this section) is the overview: what the CRM is for, how it is
  presented, the UX rules that hold everywhere, and a rebuild checklist
  with the things worth changing.
- Part 1 is the shell: boot, login, layout, navigation, search,
  notifications, design tokens, the UI kit, the shared enums and copy.
- Part 2 is the pipeline: Dashboard, Leads, the lead record, Call
  Console, Booked, Calendar, import.
- Part 3 is clients and studio: Clients, the client workspace (projects,
  payments, retainers, deliverables), the Showcase editor, the Planner
  editor, Concepts, Print Orders, Reviews, Landing, Design, Submissions,
  Settings, and pricing.
- Part 4 is the backend: hosting, auth, every endpoint and its whitelist,
  every collection and document shape, pipeline semantics, integrations,
  crons, operations, and the gaps to carry into a rebuild.
- docs/crm-screens/ holds a screenshot of every screen at 1280 and 390
  wide against the audit fixtures (name-1280.png, name-390.png).

## 0.1 What the CRM is

One person's operating system for a one-person design studio (Rob,
Visualize Studio). It runs the whole path from a scraped local business
to a paying client and the work after: find leads, call them in sessions,
book meetings, show concepts, win the job, run the project and its
payments, publish the client to the public site, plan their social posts,
print their stickers and cards, and ask for the review. The public
marketing site is driven from this CRM (published showcases, the landing
page's featured work, testimonials, stats), and three client facing pages
hang off it by token links: the concepts presentation, the content
planner, and the review form.

It is a single React SPA (Vite 6, React 18) served from the same build as
the marketing site, split by host, talking to ten Vercel serverless
functions over MongoDB Atlas. There is one user, one password, one signed
cookie. Everything is optimised for speed of use by that one person on a
phone between calls and on a desktop at the desk.

## 0.2 How it is presented

The look is a dark studio tool: near black ground (#080808), four surface
steps, white text in three tiers, one brand red (#d44c43) used sparingly
for the primary action, the active nav item and the badges, and six
status tones (new amber, progress blue, callback violet, booked green,
won red, danger red, plus neutral grey) that carry the same meaning on
every screen. Headings are Barlow Condensed in uppercase (the screen
title in the top bar, the dashboard greeting, empty state titles, the
lead's business name on its record); everything else is Inter. Corners
are 10px on controls and 16px on cards; hairline borders at 8 percent
white; cards lift on hover with a soft shadow. Motion is short (120 to
400ms), staggered entrances on lists, a one page fade between screens,
and every animation collapses to zero under Reduce motion. A light theme
exists (cream ground, same system) but the sidebar stays black.

Desktop (1024 and up): a 240px black sidebar on the left with the
wordmark, a four cell pipeline strip (Leads, Contacted, Booked, Clients
with conversion percentages between them), four collapsible groups of
nav items (Pipeline, Clients, Studio, System) with count badges, and the
account row at the bottom with a Collapse control that turns it into a
68px icon rail. A 60px top bar carries the screen title, a centered
command bar (search leads, clients, or jump to a screen, opened with
slash), a Quick add plus button, the bell with its unread badge, and the
avatar menu. Content sits in a 760px column (900 on wide screens) or in a
324px list panel beside a detail column on the three record screens
(Leads, Booked, Clients).

Phone (under 768): the sidebar is gone, the top bar shrinks to the title
and three icon buttons (search, add, bell), and a 58px tab bar holds
Dashboard, Leads, Call, Booked and More (a sheet of tiles for every other
screen). A record opens full screen over the list with a Back arrow in
the top bar; secondary panels become bottom sheets; sticky action bars
(the call outcomes, the save bar, the bulk bar) sit above the tab bar and
never cover content. Every target is 44px. Between 768 and 1023 the
sidebar is forced into the rail so a list and a detail still fit.

Screen by screen, what you see (the screenshots in docs/crm-screens show
each one):

- Dashboard: a display size greeting ("Good morning, Rob." with the date
  and callbacks due), two big buttons (Start call session in red, Add
  lead), four stat cards with glowing icon tiles (Calls today, Callbacks
  pending, Booked, New leads 48h), a four cell pipeline strip with
  percentages, a collapsed More stats card, Recent activity, and on the
  right a Today card with the daily call target ring (1 of 25, 24 to go)
  and today's agenda rows (overdue callbacks in red, callbacks, meetings,
  new leads).
- Leads: a Kanban or List toggle, Import and Add lead; a search field;
  three saved views (To call, Callbacks, Hot leads, each with a menu) plus
  Save view; four filter rows of chips with counts (Status, Priority,
  Industry, Data); the kanban columns by call status or the table
  (checkbox, business with New pill, industry, priority pill, status pill,
  phone, socials links, last call, actions). On a phone the same chips
  scroll horizontally, a Select button enters bulk mode, a Sort select
  appears, and the list is cards.
- The lead record: the profile card (initials avatar, the business name
  in display uppercase, the descriptor, pills for New, stage, priority and
  call status, the industry, a row of round icon buttons for phone, text,
  email, Instagram, Facebook, website, maps and copy, then Start call,
  Edit all and the Concepts button with its status pill, then the fact
  rows: phone, contact, phone note, best window, email, area). Beside it
  on desktop (below on a phone) a tab strip (Overview, Playbook, Notes,
  History, Checklists) over a stack of folds that open and close, each
  with a one line summary while closed; The angle sits at the top of
  Overview in a quote card. A booked lead gets a Meeting fold and a
  sticky outcome bar (Mark as won, Mark as lost).
- Call Console: the builder ("Build your session" kicker, "Who are we
  dialing?") with chip groups for Priority, Call status, Industry, Best
  window (Right now, Morning, Midday, Afternoon, Evening), an option to
  include leads without a phone, an Order select and a Session size
  segmented control (10, 25, 50, All), and a full width red Start call
  session button carrying the count. Then the queue, the room for one
  lead (script, objections, close, the call timer) with a five button
  outcome bar (Booked, Callback, No answer, Said no, Wrong number) and
  number keys, and a session summary.
- Booked: filter chips (All, This week, Upcoming, No date set, Needs
  concepts, Awaiting outcome) over lead cards with a meeting line (a
  today pill, the date and time, the meeting type, the concepts status).
- Calendar: month title, prev/Today/next, Day/Week/Month segmented
  control, a red Callback button, source chips with counts (Meetings,
  Callbacks, Calendly, New leads, Bills, Posts), and the week grid with
  colored blocks (violet callbacks, green meetings, amber bills).
- Clients: chips (All, Active project, Posts to approve, On retainer,
  Delivered, Paused, Owes a payment, Ready to deliver), client cards
  with project pills, a payment progress bar and the next payment line;
  the record adds Showcase (Published pill), Planner (n in review) and
  Concepts buttons, and a Projects tab with the project card (kind and
  status pills, stage chips, revision rounds with Log extra round ($75)).
- Print Orders: a summary line (3 orders, 2 open, 1 rush, $170 in
  progress), a search, status chips (All, New, Designed, Cut, Packed,
  Delivered, Cancelled, Rush, Due this week), an import banner for shop
  orders from submissions, and the orders table.
- Reviews: chips (All, Has NFC card, No Google link, Never asked, Asked
  this month, Delivered not asked), client cards with counts and rating
  deltas and Open Google reviews, and Form submissions with Link to
  client.
- Landing: the logo strip list, Featured work list, Testimonials, and
  stats toggles and overrides, each row with a menu, controlling what the
  public Home shows.
- Submissions: chips by type and unread, a table of website form
  submissions with a status pill (New, Contacted, Replied, Landed,
  Denied), opened in a detail with Link to lead and Create lead.
- Settings: tabs Profile (name, daily call target, theme, reduce motion,
  business hours), Notifications, Integrations, Data (backup, export,
  Recently deleted), Danger zone.
- Design: the live design system page reading every token, both themes
  and their contrast tables, and every kit component.

## 0.3 The UX rules that hold everywhere

1. One control per card or row. A card that opens something has exactly
   one real button stretched over it; secondary controls are raised above
   it. Tap anywhere opens; nothing else steals the tap.
2. 44px targets, labels on every icon button, live regions for status,
   named landmarks. The audits fail the build otherwise.
3. Every screen ships four states: a skeleton shaped like the loaded
   screen (so nothing shifts), an empty state that says what will appear
   here and how to make it happen, an error state with Try again, and an
   entrance (staggered reveal).
4. Optimistic writes with rollback and a toast on failure; destructive
   actions get a confirm dialog or an undo toast (six seconds).
5. Editors (Showcase, Planner, Concepts) hold a draft, save explicitly
   with a sticky save bar (Save changes, Discard), Cmd or Ctrl+S, and a
   leave guard; nothing writes until Save. Record fields on the lead and
   client screens write immediately through inline edits.
6. Status has one meaning: the same six tones, labels and icons on every
   pill, tile, badge and calendar block, defined once in the semantics
   file. The pipeline stage is one field; a client only leaves the client
   stage through an explicit action, never an import or a job.
7. The phone is a first class layout, not a squeeze: tab bar, sheets,
   full screen records, horizontal chip rows, sticky bars that clear the
   tab bar and the home indicator.
8. Speed for one person: the command bar answers a phone number typed
   from the caller ID, the Quick add menu, keyboard shortcuts in the call
   room and the calendar, warm fetches before React mounts, a boot frame
   that paints before the bundle.
9. Copy addresses Rob by name, in plain sentences, and tells him what to
   do next (empty states always end in an action).
10. Nothing raw: colors are tokens, links and images pass a URL guard on
    write and on render, every request value in a database filter is
    cast, the public doors are rate limited.

## 0.4 Rebuild checklist and what is worth changing

Keep, because it is the product:

- The pipeline model (lead, booked, won or client, lost) with call
  statuses, priorities, best windows, callbacks and the call session.
- The one person shell: sidebar with pipeline strip and badges, tab bar
  with More, command bar with phone lookup, notifications with snooze.
- The three editors with drafts and the save bar, and the token links
  (planner, concepts, review) that let a client act without an account.
- The client workspace's money model: packages, payment plans, ledger
  from Stripe, retainers, revision rounds and the extra round fee.
- The token system, the six status tones, the four states rule, the
  audits (layout, a11y, feel, scene, regression, security) as the gate.

Change, because the scan found friction (details in Part 4, section 7,
and in the per screen notes):

- The lead record is long: a profile card, six or more folds and a tab
  strip that only scrolls. A rebuild should decide a primary view per
  stage (calling, meeting prep, client) and demote the rest.
- Leads has two saved view mechanisms (saved views and filter presets
  from the sidebar) and two list shapes (kanban, table, phone cards)
  that each carry their own row markup. One row component, one filter
  model.
- Clients is the lead record in client mode plus a workspace; the
  Projects and Planner sidebar entries are filters on Clients, not
  screens. A rebuild can make Projects a real screen with the money view
  first.
- Settings mixes profile, integrations, data and danger. Recently
  deleted is a nav entry that opens a Settings tab.
- Concept packs and the leads' concepts[] tracker were retired but their
  fields and route remain for old data; the rebuild can drop them after
  the migration script has run on live data.
- The admin and the marketing site share one bundle and one host split;
  a rebuild can separate them cleanly (two apps, one API).
- Auth is one shared password in a config constant with an env override,
  a signed cookie and no user table. Fine for one person; add a user
  document and passkeys or magic links if a second person ever joins.
- Ten of twelve serverless functions are used, with a dispatcher on
  ?r=name; a rebuild on a platform without the cap can give each route
  its own function.
- The scraper and enrichment jobs write leads and fields nightly; the
  heal cron repairs stages. Keep the guard rails (normalizeStage, the
  explicit flag) whatever replaces them.

Order of work for a rebuild that stays usable throughout:

1. Tokens, kit and shell (Part 1) with the login and the boot frame.
2. The data layer and the endpoints with their whitelists (Part 4),
   tests first (the endpoint tests and the security test are portable).
3. Leads, the record and the Call Console (Part 2), since calling is the
   daily loop.
4. Booked, Calendar, Dashboard.
5. Clients and the workspace, then the Showcase, Planner and Concepts
   editors and their public pages.
6. Orders, Reviews, Landing, Submissions, Settings.
7. The audits, the regressions and the docs as the gate.


# Part 1: the shell, navigation, tokens, kit, semantics and copy


Sources read in full: `src/main.jsx`, `src/pages/AdminApp.jsx`, every file in `src/shell/`, `src/ui/index.js`, `src/ui/tokens.js`, every component and hook in `src/ui/`, `src/shared/{copy,semantics,api,dates,log}.js`, `LAYOUT.md`, `docs/COMPONENTS.md`, `docs/TOKENS.md`, plus `index.html`, `src/lib/adminPaths.js`, `api/admin/{login,session,logout}.js`, `api/_lib/auth.js`, and the badge helpers in `src/lib/`. Nothing was modified.

---

## 1. Host and boot

### Host detection (`src/lib/adminPaths.js`)
- `IS_ADMIN_HOST` = `hostname === 'admin.visualizeclients.com' || hostname.startsWith('admin.')`.
- `IS_DEV_HOST` = `localhost` or `127.0.0.1`.
- `ADMIN_HOME` is `/` on the admin host, `/admin` elsewhere. In AdminApp, `BASE = IS_ADMIN_HOST ? '' : '/admin'`; every route is relative to BASE.
- `src/App.jsx`: on the admin host, only AdminApp is served (root paths), with `/prints` redirecting to `/orders`. On the public domain `/admin/*` redirects to `/` unless `IS_DEV_HOST` (vercel.json also blocks it at the edge). The admin is a lazy chunk; `<Suspense fallback={<BootFrame />}>` keeps the boot frame up while it downloads. The build writes the admin chunk's filename into `<meta name="vz-admin-chunk">` and the pre-paint script adds a `modulepreload` for it.

### Pre-paint script (`index.html`)
Runs inline before the bundle, hash pinned in the CSP. Reads `vz_theme`, `vz_motion`, `vz_boot`, `vz_shell_collapsed` from localStorage (guarded). Decides `admin = /^admin\./.test(hostname) || /^\/admin(\/|$)/.test(pathname)`. Theme: admin gets `light`/`dark` if stored, `system` resolves against `prefers-color-scheme`, default `dark`; the public site is always dark. Stamps on `<html>`: `data-theme`, and for admin also `data-v-theme`, `data-v-motion='reduce'` when stored, `data-vz-boot='shell'|'login'` (shell when `vz_boot === '1'`), `data-vz-side='rail'` when `vz_shell_collapsed === 'true'`. Preloads `barlow-condensed-700.woff2` (admin) or 700 and 800 (marketing). Sets `viewport-fit=cover`.

### Boot frame (`src/shell/bootFrame.js`, `BootFrame.jsx`)
`BOOT_FRAME_HTML` is a string of skeleton markup: `.vz-boot--shell` (a 240px sidebar with brand row, 4+3+3 nav rows and a user row; a column with a 60px top bar holding a 132x22 title block and three 44x44 squares; main content of a 58% title line, 42% line, a row of four 92px cards, a grid of four 132px cards, a tall card with three 56px rows; a 58px tab bar with six tabs) and `.vz-boot--login` (a 360px card of five skeleton blocks). `BOOT_CSS` parses `tokenStyles` with a regex to pull `--v-ground, --v-bar, --v-surface-1/2/3, --v-border, --v-sidebar-bg, --v-sidebar-border` for both dark and light blocks so the frame cannot drift from the tokens; shimmer duration is `--v-dur-slow * 4`. `html[data-vz-side='rail']` narrows the aside to 68px and hides label skeletons. Reduced motion (OS or `data-v-motion`) kills the shimmer. Injected into `index.html` at `<!-- vz-boot -->` / `<!-- vz-boot-css -->` by a Vite plugin. `BootFrame.jsx` renders the identical string via `dangerouslySetInnerHTML` inside `.vz-boot-host` so React's first commit swaps parser frame for React frame with no shift.

### Warm fetches (`src/main.jsx`, `src/shared/api.js`)
Before React mounts, if on the admin host (or dev + `/admin`), `warm(['/api/admin/session', ...])` starts GETs; if `vz_boot === '1'` it also warms `/api/admin/call-leads`, `/submissions`, `/projects`, `/orders`, `/concept-sets`, `/settings`. `warm()` stores promises in a Map; the first `apiFetch` GET for the same URL takes the stored promise instead of refetching.

### Auth and session check
AdminApp state `authed` starts `null`. On mount: `applyAppearance()`, `wireClientLog()`, then `apiFetch('/api/admin/session', { silent: true })`; `authed = !!(r.ok && r.data?.authed)` and `setBootHint(on)` writes or clears `vz_boot`. While `authed === null` it renders `<BootFrame />`; `false` renders `<Login />`; `true` renders the shell. A later 401 from `/api/admin/submissions` sets `authed=false` and clears the hint. After auth, lazy loaders for Leads and Calls prefetch on idle.

Server side (`api/_lib/auth.js`): the only auth is the `vz_admin` cookie, value `${expiresAt}.${hmac}` where hmac is SHA-256 over the expiry with `SESSION_SECRET`; `HttpOnly; Secure; SameSite=Lax; Max-Age=30 days`. No DB lookup, no CSRF header, no renewal. `session.js` GET returns `200 { ok: true, authed: true }` or `401 { ok:false, authed:false, error:'unauthorized' }`; a missing SESSION_SECRET returns 500 with `error: 'SESSION_SECRET is not set'`.

### Login screen (`Login` in AdminApp.jsx)
`<main class="lay-root aa-loginpage" aria-label="Sign in">` centered on `--v-ground`. A `Reveal` wrapping a `<form>` (`.aa-login`, `width: min(360px, 100%)`), containing a `Card` (`.aa-login-card`, padding 24/20, `--v-shadow-3`) with: `Wordmark size={22}`, `<h1>Admin</h1>` (display font, 2xl, uppercase), `<p>Owner access only</p>` (text-sm, text-3), a password `Input` (placeholder "Password", `autoFocus`, `autoComplete="current-password"`, `aria-label="Password"`, centered text, `error` prop shows the message), and `<Button type="submit" size="lg" full loading={busy} disabled={!pw}>Sign in</Button>`.
Submit: plain `fetch('/api/admin/login', POST JSON { password })`. 200 reloads the page (the boot session check then sees the cookie). 401 shows "Wrong password". 429 (ten wrong passwords from one IP in fifteen minutes; count kept in the settings collection under `rate:login:<sha256(ip)>`, cleared by a correct password) shows the server's message "Too many wrong passwords. Try again in a few minutes." 500 with a message shows it ("SESSION_SECRET is not set"). Anything else: `Server error <status>` or `Server error (network)`. On error the form gets `.is-shaking` (7px horizontal shake over `--v-dur-slow`, disabled under reduced motion). Typing clears the error. Login body is capped at 4KB.

### Logout
`logout()`: `apiFetch('/api/admin/logout', POST)` (server sets the cookie with Max-Age 0), then `setBootHint(false)` and `setAuthed(false)`, which renders Login in place. Available from the account menu ("Sign out", danger item), the More sheet's account row, and Settings.

### Maintenance mode
`VITE_MAINTENANCE_MODE === 'true'` at build time renders `<Maintenance />` instead of the app, but only when `!IS_ADMIN_HOST` (both hosts share one bundle). The screen: `.uc-screen` with a glow, the mark `/logo.svg` 64x51, wordmark "Visualize." with a red dot, and one line "Visualize is upgrading its website" typed at 45ms per character after a 750ms wait, then a "..." loop (dot every 400ms, dwell 700ms full, 500ms empty). Under reduced motion the finished sentence shows at once. Title becomes "Visualize is upgrading"; a `robots noindex` meta is appended. No password, no links. No API function reads the flag.

### Crash boundary and logging
`ShellCrash` (`src/shell/ShellCrash.jsx`) wraps BrowserRouter. On a render error it shows a login-card-sized `.sh-crash-card` with `role="alert"`: title "Visualize could not start", text "The shell hit an error before it could draw. Reload the page; if it keeps happening, the message below is what to send along.", the error in a `<pre>`, and a primary full-width "Reload" button. Logs via `logClient({ kind: 'boundary' })`. `src/shared/log.js`: `logClient` POSTs `{ kind, message (500 chars), stack (2000), url (300), at }` to `/api/admin/log` silently; dedupes one entry per message per minute; stops after 40 per page load. `wireClientLog()` hooks `window error`, `unhandledrejection`, `vz:offline-write` (kind `refused`), `vz:api-failed` (kind `api`).

### PWA
Service worker `/sw.js` registers after `load`, on idle plus 2.5s (or 4s fallback). `src/shell/install.js` captures `beforeinstallprompt` so Settings can call `promptInstall()`; exposes `canPrompt`, `isStandalone`, `isIOS`, `onInstallChange`.

---

## 2. Global layout

### Root and regions
`AppShell` renders `<div class="sh-root lay-root[ is-collapsed]" data-v-theme=... data-v-motion=...>`: `height: 100dvh; display:flex; overflow:hidden; background --v-ground`. Children: `<Sidebar>` (nav, desktop only), then `.sh-col` (flex column): `<TopBar>`, the offline banner `.sh-offline` (`role="status" aria-live="polite"`, always in the tree, visually hidden when online), `<main key={activeNavId} class="aa-app sh-content lay-view[ has-detail]" aria-label={title}>` with the screen, then `<TabBar>` (mobile only). Overlays `MoreSheet`, `ShortcutsSheet`, `NotificationsDrawer` follow, then `<style>{styles}</style>` (uiStyles + shellStyles + aaStyles, injected once).

`.sh-content` is `flex:1; min-height:0; display:flex`. `.aa-app` is the content row; screens with a list-and-detail split render `.aa-panel` (width `--lay-panel-w` = 324px, `--v-bar` background, right border, padding 16/12/12) beside `.aa-main`. `.aa-embed` hosts the Call Console.

### Breakpoints
- Under 768px: phone. Sidebar hidden, tab bar shown, top bar compact (title + right cluster), command bar becomes a Sheet, Sheet becomes bottom sheet, toasts bottom center above the tab bar.
- 768 to 1023px: narrow desktop. `useMediaQuery('(min-width: 768px) and (max-width: 1023px)')` forces the sidebar into the 68px rail; the collapse toggle is hidden (`canToggle=false`) because 240 + 324 leaves no room for a detail column.
- 1024px and up: the stored collapse preference (`vz_shell_collapsed`) applies; sidebar 240px or rail 68px.
- `DESKTOP_QUERY` = `(min-width: 768px)`; `HOVER_QUERY` = `(hover: hover) and (pointer: fine)`.
- Dashboard greeting drops from display-md to display-sm under 1280.

### Desktop sidebar (`Sidebar.jsx`)
`<nav class="sh-side" aria-label="Admin sections">`, `width: --v-sidebar-w` (240px), rail `--v-sidebar-rail-w` (68px), `--v-sidebar-bg` (`--v-bar`, stays Visualize black in the light theme), right hairline, `transition: width --v-dur-base`. Top to bottom:
1. Brand button (`aria-label="Dashboard"`): 28px `/logo.svg` and the wordmark "Visualize." (text-lg bold, red dot) when expanded.
2. **Pipeline strip** (expanded only): `role="group" aria-label="Pipeline: leads, contacted, booked, clients"`, a 4-column grid on `--v-sidebar-hover` with a hairline border. Cells: Leads, Contacted, Booked, Clients, each a 44px button showing the count in display font and a 9px uppercase label; between cells a floating pill with the conversion percentage from the previous stage (`aria-label="NN% from the previous stage"`). Data is `pipelineFunnel(leads)` from `src/lib/leads.js`: skips `lost`; `leads` = all; `contacted` = has callLog or callStatus not `not-called`; `booked` = stage booked/won/client; `clients` = won/client. Taps: Leads goes to `leads`; Contacted goes to `leads` with preset `{ status: ['callback','no-answer','no'] }` (CONTACTED_STATUSES); Booked to `booked`; Clients to `clients`.
3. **Groups** (`.sh-side-groups`, scrollable, hidden scrollbar): four disclosures in order Pipeline, Clients, Studio, System. Each header is a button with `aria-expanded` and `aria-controls="sh-group-<name>"`, showing the uppercase group label, when closed the blurb (`NAV_GROUP_META`: Pipeline "the work of landing someone", Clients "the work after they say yes", Studio "what gets made", System "the app itself") and the sum of its item badges as a neutral inline Badge, and a chevron that rotates 180deg when open. Open state is persisted per device in `vz_side_groups`; first visit opens only the active screen's group; the active group opens itself if closed. Body is a `Collapsible` with `role="group" aria-label="<Group> sections"`. Items: `.sh-nav` buttons (44px, icon `--v-icon-md`, label, `aria-current="page"` when active, a 3px red bar on the left when active, `--v-sidebar-active-bg` background, `--v-sidebar-active` text). Badges: while `countsLoading` a 22x18 pill skeleton; otherwise `Badge count inline tone={active ? 'won' : 'neutral'}` only when count > 0; in the sidebar inline badges are `rgba(255,255,255,0.10)` with text-2, and on an active item `--v-red-hover` with white. A `soon` entry renders disabled at 50% opacity with a "Soon" pill.
   Rail mode: one `.sh-nav--group` icon button per group (the group's meta icon: PhoneCall01, Briefcase01, Palette, Settings01) wrapped in a `Tooltip` on the right ("Pipeline: Dashboard, Leads, Call Console, Booked, Calendar") and a `Menu` (`label="<Group> sections"`, align start) listing the items; a Badge with the group total sits on the icon.
4. Bottom (`.sh-side-bottom`, hairline top): the account `Menu` (label "Account", align start) triggered by `.sh-side-user` (`aria-label="Account menu"`): `Avatar name="Rob" size="sm"` plus "Rob" / "Visualize Studio". Then, when `canToggle`, the collapse button with Tooltip ("Collapse sidebar" / "Expand sidebar"), `aria-expanded={!collapsed}`, chevron left/right and the word "Collapse".

### Top bar (`TopBar.jsx`)
`<header class="sh-top">`, sticky, `z: --v-z-sticky`, `min-height: --v-control-h + --v-space-4` (60px), padding-top adds `--v-inset-top`, `--v-surface-1` with a bottom hairline. Grid: phone `minmax(0,1fr) auto`; desktop `minmax(180px,1fr) minmax(0,2fr) auto`. Left: an optional Back `IconButton` (ArrowLeft, label "Back", set by `useTopBar({ back })`) and `<h1 class="sh-top-title lay-truncate">` in display 2xl uppercase (the nav label or the screen's `useTopBar` title). Center (desktop only): the CommandBar input, max 560px. Right: a Search `IconButton` (mobile only, opens the command sheet), `QuickAdd` (a Plus `IconButton variant="secondary"` with a Menu "Quick add"), the bell (`IconButton Bell01 label="Notifications"` with a `Badge` of today's unread, or a 16px skeleton while counts load), and on desktop an avatar button (`aria-label="Account menu"`) opening the account Menu aligned end.

### Phone tab bar (`TabBar.jsx`)
`<nav class="sh-tabs" aria-label="Sections">`, height `--v-tabbar-h (58px) + --v-inset-bottom`, `--v-surface-1`, top hairline, `z: --v-z-tabbar`. Tabs from `TAB_NAV` in order: **Dashboard**, **Leads**, **Call** (tabLabel for Call Console), **Booked**, then **More** (DotsGrid icon, `aria-haspopup="dialog"`, `aria-expanded`). Each tab: icon in a 44x26 pill (active gets `--v-red-soft` background and `--v-red-highlight` color), 10px bold label, `aria-current="page"`. Badges sit at top -4px right 2px with a 2px surface ring; a 14px skeleton while loading. The More tab shows the sum of every non-tab entry's badge and is active when the More sheet is open or the current screen is not a tab.

### More sheet (`MoreSheet.jsx`)
A `Sheet` titled "More" (`label="More sections"`). A `Stagger cap={4}` of groups (Pipeline, Clients, Studio, System, only those with non-tab items), each an uppercase `.sh-side-label` and a 3-column grid of `.sh-more-btn` tiles (min 84px tall, `--v-surface-2`, icon `--v-icon-lg` with a Badge, xs bold label; active tile is red text on `--v-red-soft` with a red border; `soon` disabled with a "Soon" pill). Tapping closes the sheet and navigates. Bottom row: `Avatar "Rob" md`, "Rob / Visualize Studio", and a ghost "Sign out" button (LogOut01).

### Detail panels vs sheets
Screens with a list and a detail (Leads, Booked, Clients) render `.aa-panel` (324px list) beside `.aa-main` (detail) on desktop. On a phone (`max-width: 767px`) `.aa-app` becomes a column, `.aa-panel` is full width and `.aa-main` is hidden; when the screen calls `onMobileOpen()` AdminApp sets `hasDetail` and `.aa-app.has-detail` hides the panel and shows `.aa-main` full screen (as a flex column with `min-height:0`, so its ScrollArea still scrolls). `.aa-main--wide` is the single-column variant. Screens use `useMediaQuery(DESKTOP_QUERY)` to choose between an inline panel and a Sheet for secondary content; the kit's `Sheet` itself is a bottom sheet under 768 and a right side panel at 768 and up.

### Scroll model (`LAYOUT.md`, `PageShell`, `ScrollArea`, `StickyFooterBar`)
Rule: every page renders inside `PageShell` + `ScrollArea`; every pinned bottom bar is a `StickyFooterBar`; rows and cards carry `.lay-card`.
- `PageShell` (`.lay-shell`): `flex: 1 1 auto; flex-direction: column; min-width/height: 0; position: relative`; wraps children in an `ErrorBoundary` (`label` names the region).
- `ScrollArea` (`.lay-scroll`): the only scroll container. `overflow-y: auto; overflow-x: clip; overscroll-behavior: contain; scroll-behavior: smooth` (auto under reduced motion); padding `--v-gutter` top, `--v-gutter-r`/`-l` sides (gutter floored by safe-area insets), bottom `--v-gutter + --v-scroll-extra`. Children center in `.lay-content` (`max-width: --v-content-w` 760px; `wide` gives 900px; `bare` skips the wrapper), a flex column with gap `--v-stack-gap` (default `--v-space-5`). A scroller whose only child is `aria-busy` stops scrolling until data lands.
- `StickyFooterBar` (`.lay-footbar`): rendered in flow as a sibling below the ScrollArea (so it structurally cannot cover the last row), `--v-bar` opaque background, top hairline, padding bottom `--v-space-3 + --v-inset-bottom`. There is no "padding-bottom to clear the bar" anywhere; that is the save bar clearance model.
- `.lay-card`: `width/max-width 100%; min-width 0` on itself and children; `.lay-truncate` for one-line titles.
- `.lay-overlay`: fixed inset with safe-area padding (Modal uses it).
- Page transition: AppShell keys `<main>` by nav id and `.lay-view` fades in over `--v-dur-base`; `.lay-tabbody` does the same for tab bodies inside a screen. This is the only page-level transition.
- Global guards in `src/index.css`: `html, body, #root { width/max-width 100% }`, `body { overflow-x: hidden; overflow-wrap: break-word }`, border-box everywhere, media `max-width: 100%`.

### Z-index layers (tokens)
`--v-z-base` 0, `--v-z-sticky` 10 (top bar), `--v-z-tabbar` 50, `--v-z-sheet` 60, `--v-z-modal` 70, `--v-z-toast` 90 (also tooltips), `--v-z-command` 100 (Popover default, so menus and command results sit above sheets).

---

## 3. Navigation

### `NAV` (`src/shell/nav.js`), the single source
Fields: `id, label, icon, path, group, badge, tab, tabLabel, href, search, soon`.

| id | label | icon | path | group | badge key | phone tab |
|---|---|---|---|---|---|---|
| dashboard | Dashboard | LayoutAlt01 | `` | Pipeline | none | yes |
| leads | Leads | Users01 | /leads | Pipeline | leads | yes |
| calls | Call Console | PhoneCall01 | /calls | Pipeline | calls | yes (label "Call") |
| booked | Booked | CalendarCheck01 | /booked | Pipeline | booked | yes |
| calendar | Calendar | Calendar | /calendar | Pipeline | calendar | no |
| clients | Clients | Briefcase01 | /clients | Clients | clients | no |
| projects | Projects | Folder | /clients (href `/clients?filter=active`, search `filter=active`) | Clients | projects | no |
| planner | Planner | Send01 | /clients (href `/clients?filter=planner`) | Clients | planner | no |
| orders | Print Orders | Package | /orders | Studio | orders | no |
| concepts | Concepts | Image01 | /concepts | Studio | concepts | no |
| reviews | Reviews | Star01 | /reviews | Studio | reviews | no |
| landing | Landing | Browser | /landing | Studio | none | no |
| submissions | Submissions | Inbox01 | /submissions | System | submissions | no |
| deleted | Recently Deleted | Trash01 | /settings/deleted | System | none | no |
| design | Design | Palette | /design | System | none | no |
| settings | Settings | Settings01 | /settings | System | none | no |

Helpers: `navGroups()`, `TAB_NAV` (tab: true), `MORE_NAV` (the rest), `navForPath(rel, search)` (longest path wins; an entry with `search` matches only when the query carries it, so `/clients?filter=active` is Projects and `/settings/deleted` is Recently Deleted; `/` is Dashboard), `sectionOf(entry)` (deleted goes to settings, projects and planner go to clients), `navById(id)`.

### Badge sources (AdminApp `counts`)
- `leads`: leads in stage `lead` with `callStatus === 'not-called'` (to call).
- `booked`: stage booked count.
- `calls`: open callbacks (`callStatus === 'callback'`, not lost).
- `orders`: orders with `status === 'new'` and not archived.
- `submissions`: items not read and not deleted.
- `calendar`: today's items (callbacks due today or earlier or undated, plus booked/won/client meetings today).
- `reviews`: `reviewAsksDue(leads, projects)` (delivered, released 3+ days, never asked).
- `clients`: stage client + stage won.
- `projects`: projects not archived, not delivered, not retainers.
- `planner`: `postsInReview(posts)` (live posts with status `review`).
- `concepts`: `conceptsBadge(sets)` (live sets with status `changes` or viewed and unanswered).
`countsLoading` is true while call leads load (or `?loading=1` forces it), and every badge shows a skeleton pill.

### Routing inside AdminApp
`section` is derived from the relative path: `/submissions`, `/orders`, `/calls`, `/leads/:id/concepts` (conceptsEditor), `/leads`, `/booked`, `/calendar`, `/clients/:id/showcase` (showcase), `/clients/:id/planner` (planner), `/clients`, `/concepts`, `/reviews`, `/landing`, `/settings` (with `/settings/deleted` opening the Data tab), `/design`, else dashboard. Each section is a lazy chunk (the entry chunk is shell + Dashboard) inside `<ErrorBoundary key={section} label="the <Label> screen" reload>` and `<Suspense fallback={null}>`.

`goNav(navId, preset)`: `deleted` navigates to `/settings/deleted`; an entry with `href` navigates there; otherwise `go(sectionOf(entry))` and sets `presetReq { section, preset, n }` (Leads accepts `{ status:[...], prio:[...], industry }`, Call Console `{ status, prio }`). `openLead(lead)` picks the screen by `effectiveStage` (= `normalizeStage`): booked goes to Booked, won/client to Clients, else Leads, then sets `openReq { section, id, n }`. `newLead(preset)`, `newClient()`, `newOrder(preset)` set `createReq { section, preset, n }`. `openShowcase(lead)` navigates to `/clients/:id/showcase`; `openPlanner(lead, month)` to `/clients/:id/planner?month=`; `openConcepts(lead, setId)` to `/leads/:id/concepts?set=`. Screens receive `openId`, `createPreset`, `filterPreset` props and react to the `n` timestamp.

### Deep links
- `?open=<id>`: after auth, sets `openReq` for the current section (push links and the feel audit use it).
- `?submission=<id>` (push notification): fetches the submission; `shop-order` type navigates to `/orders` and opens by `submissionId`; `review` type goes to `/reviews`; otherwise `/submissions` with the record open. Guarded to run once.
- `?set=<id>` on `/leads/:id/concepts` picks the round; `?month=YYYY-MM` on the planner picks the month; `?filter=active|planner` on `/clients` selects the Projects or Planner view and the matching nav entry.
- `?loading=1` forces every list empty and loading (audit hook).
- Document title: `(N) Visualize Admin` with the unread submission count, else `Visualize Admin`.

### Command bar (`CommandBar.jsx`, `search.js`)
Shortcut: `/` or Cmd/Ctrl+K anywhere unless focus is in an input, textarea, select or contenteditable. Desktop: the top bar `Input` (placeholder "Search leads, clients, or jump to a screen", `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, leading SearchMd icon, trailing `<kbd>/</kbd>` or a Clear button) with a `Popover align="stretch" trap={false} label="Search results"` of results. Mobile: a `Sheet tall label="Search"` with the input pinned (placeholder "Search or paste a number") and a `SegmentedControl` "Keyboard" with options "Abc" / "123" switching `inputMode` (a query starting with a digit switches to tel automatically).
Search (`searchAll(q, leads, { limit: 6 })`): digit queries (`/^[\s()+\-.\d]+$/`) rank by `matchRank(lead.phone, digits)` (reverse phone lookup, trailing partial allowed); text queries score business startsWith 0, includes 1, askFor 2, industry 3, descriptor 4. Results split into `leads` (not won/client) and `clients` (won/client), 6 each; `jumps` are NAV entries whose label or id contains the text (max 4, not for digits); `showcases` are the first 3 client matches. The flat list order: Leads, Clients, Showcase rows ("Showcase: <business>" / "Edit the public page"), Planner rows ("Planner: <business>" / "Their scheduled posts"), Jump rows (label / "Jump to"). A digit query with no match and no skeleton adds "Add as new lead" / "Start a lead with <formatted number>" under the group "No match", which calls `onNewLead({ phone })`. Group labels: Leads, Clients, Jump to, No match; with an empty query the list is the last 8 picks under "Recent" (stored in `vz_cmd_recent` as `{ type, id }`). Hints: "Type a business, a name, an industry, or the number that is calling. Recent results land here." and `Nothing matches "<q>". Try a shorter word or the phone number.` Rows are `ListRow` with `role="option"`: lead rows show an Avatar, an outline industry Pill, the formatted phone or "No phone", and the call status Pill; client rows show a booked-status Avatar, up to two planned services (`+N`) or "No package yet", and a "Client" pill. Keyboard: Up/Down move, Enter picks, Escape closes. When memory has no match, a 350ms debounced `onRefetch` reloads leads (keeps results fresh after nightly jobs) and shows three `ListRow.Skeleton` via `useDelayedLoading`.

### Quick add menu
Items: "New lead" (Users01) opens a new lead form; "Log a call" (PhoneCall01) goes to Call Console; "New client" (Briefcase01); "New order" (Package).

### Account menu
"Settings" (Settings01), "Design system" (Palette), "Keyboard shortcuts" (Keyboard01, opens `ShortcutsSheet`), "Theme: <Mode>, switch to <next>" (icon Sun when light, Monitor01 when system, else Moon01; steps dark to light to system to dark), a divider, "Sign out" (LogOut01, danger).

### Shortcuts sheet (`ShortcutsSheet.jsx`, `shortcuts.js`)
Sheet "Keyboard shortcuts", description "Everywhere, the command bar, the Call Console, the Calendar, and lists.", width 520. Groups as level-2 Cards: Everywhere (`/` and `Cmd or Ctrl + K` open the command bar, `Esc` closes the sheet, modal or menu); Command bar (Up and Down, Enter, Digits search by phone); Call Console (1 Booked, 2 Callback, 3 No answer, 4 Said no, 5 Wrong number, N Next lead, S Skip, Right or Space Next, Left Previous, Esc Back to the queue, ? Shortcut list); Calendar (Left and Right, T Today, D Day, W Week, M Month); Tables and lists (Enter opens the focused row, Tab moves).

### Notifications drawer (`notifications.js`, `NotificationsDrawer.jsx`)
A `Sheet title="Notifications" tall` with description `"<n> unread"` and a footer ghost button "Mark all read" (CheckDone01, disabled at zero). Groups in order with labels: `overdue` "Overdue", `today` "Today", `upcoming` "Upcoming" (next 7 days), `new` "New leads" (created in the last 48h), `system` "System". Items sort by group, then ascending time (new and system descending).
Item shape: `{ id, kind, group, tone, icon, title, detail, at, lead?, event?, openPlanner?, openConcepts?, setId? }`. Sources:
- From `buildEvents` (meetings, callbacks, Calendly, retainer bills, plan finals; scraper events skipped): overdue callbacks go to Overdue; same day to Today; within 7 days to Upcoming; past meetings and past bills are dropped; other past items Overdue. `planfinal` becomes a System danger item "Final payment month: <business>" for 31 days before it. Unlinked Calendly bookings only show if created after `lastSeenAt`. Detail for callback/meeting/calendly is the weekday and time plus subtitle. Icons: meeting CalendarCheck01, callback PhoneIncoming01, calendly Calendar, bill CurrencyDollar, planfinal/payment CreditCard01, else Bell01.
- `payment` (Overdue, danger): "Payment past due: <business>" with amount, project, line label, due date.
- `review` (System, won tone, Star01): "Ask <business> for a review".
- `post-approved` (System, booked, Check, openPlanner) "<who> approved the <post label>"; `post-change` (System, danger, Edit02, openPlanner) "<who> asked for a change on the <date> post" with the client's note.
- `concepts-opened` (neutral, Eye), `concepts-picked` (booked, Check), `concepts-change` (danger, Edit02), all System with `openConcepts` and `setId`.
- `health` (System, danger, AlertTriangle): "The enrichment scan has not run in 36 hours" / "The scraper has not added a lead in 36 hours" with "Last ran ..." or "No run recorded yet."
- `heal` (System, booked RefreshCw01 or danger AlertTriangle after more than two heals): "<business> was restored to Clients".
- `new` (New leads, new tone, Users01): "New lead: <business>" with industry and area, or "From the nightly scraper" / "Added by hand".
- `system` scan summary (progress tone, RefreshCw01): "Scan filled N fields on M leads".
Each row is a `ListRow` with an `IconTile tone size="sm" glow={!read}`, title, detail, `relativeTime(at)` meta, and a `Menu label="Notification actions"`: Open (ArrowRight); for callback, meeting and calendly kinds a divider and Snooze: "In 1 hour", "Tomorrow 9am", "Next week" (Clock icons); a divider; Done (Check). Read items render at 62% opacity.
State: `notifDoc { readIds (capped 500), lastSeenAt, snoozedUntil, reminders }` loaded from `/api/admin/settings` (`notifications`), mirrored to `vz_notif_read`; `saveNotif` PATCHes `{ set: { notifications: patch } }` optimistically and rolls back with `toast.error(COPY.error.save)`. Snoozing a callback writes `callbackAt` on the lead via `onPatchLead`; anything else writes `snoozedUntil[id]`. Opening an item marks it read, then: concepts items open the concepts editor; planner items open the planner; items with a lead open the record; a Calendly event with a link opens it in a new tab; else goes to Calendar. Empty state: `COPY.empty['notifications.none']` ("All caught up" / "Nothing due, nothing new. Start a call session." / action "Open Call Console"). Error: `COPY.error.notifications`. Skeleton: two groups of 3 and 2 `ListRow.Skeleton`. The bell badge counts unread items in `today` and `overdue` only.

### Greeting and profile
Dashboard greeting: "Good morning, <first name>." before 12, "Good afternoon" before 17, else "Good evening", in display-md (display-sm under 1280). The name comes from the profile document (`/api/admin/settings` `profile.name`, default "Rob"; the Settings Profile tab edits it with an InlineEdit "Your name", hint "The greeting and the initials avatar use this."). Profile shape: `{ name, businessHours { start '09:00', end '17:00' }, theme, reduceMotion }`.

### Appearance (`appearance.js`)
Keys: `vz_theme` ('dark' | 'light' | 'system'; admin default dark), `vz_motion` ('reduce'), `vz_boot` ('1'). `THEME_MODES` = System, Dark, Light. `resolveTheme()` maps system to the OS. `applyAppearance()` stamps `data-v-theme`, `data-theme` and `data-v-motion` on `<html>`; AppShell repeats them on `.lay-root`. `useAppearance()` returns `{ mode, theme, reduce, reduceOS }` and listens to both media queries. The profile document is the source of truth: on load, if `profile.theme` or `profile.reduceMotion` differ from local, the document wins. `saveAppearance(patch)` applies locally, PATCHes `{ set: { profile: patch } }`, and reverts with `toast.error(COPY.error.save)` on failure. Settings Profile shows a `SegmentedControl` "Theme" (System Monitor01, Dark Moon01, Light Sun) and a `Toggle` "Reduce motion" (description changes when the OS already asks for less motion).

### Shell context (`ShellContext.jsx`)
`useShell()` exposes `go, openRecord, openShowcase, openPlanner, openConcepts, openCommand, openNotifications, newLead, newClient, newOrder, setTopBar, events, calendly, projects, posts, sets, health, profile, setProfile, appearance, saveAppearance`. `useTopBar({ title, back })` sets the top bar title and Back button while mounted; null restores the nav label. localStorage keys the shell owns (`storage.js`): `vz_shell_collapsed`, `vz_side_groups`, `vz_cmd_recent`, `vz_notif_read`; `readJSON`/`writeJSON` are try/catch guarded.

---

## 4. Design tokens (`src/ui/tokens.js`, declared on `.lay-root`, prefix `--v-`)

### Dark (default)
- Layers: `--v-ground #080808`, `--v-surface-1 #121212`, `--v-surface-2 #1a1a1a`, `--v-surface-3 #232323`, `--v-overlay rgba(0,0,0,0.65)`, `--v-bar #0a0a0a` (pinned bars, rail, tab bar).
- Lines: `--v-border rgba(255,255,255,0.08)`, `--v-border-strong rgba(255,255,255,0.16)`, `--v-border-focus var(--v-red)`.
- Text: `--v-text #fafafa`, `--v-text-2 #cccccc`, `--v-text-3 #8f8f8f` (muted floor, passes 4.5:1 on every layer), `--v-text-inverse #080808`, `--v-text-on-red #ffffff`.
- Brand: `--v-red #d44c43`, `--v-red-hover #c2413a`, `--v-red-highlight #e66b63` (red as text), `--v-red-soft rgba(212,76,67,0.14)`, `--v-red-glow 0 8px 28px rgba(212,76,67,0.32)`.
- Status tones, each with `-solid`, `-soft`, `-text`: **new** `#f59e0b` / `rgba(245,158,11,0.14)` / same; **progress** `#60a5fa` / 0.14 / same; **callback** `#a78bfa` / 0.14 / same; **booked** `#22c55e` / 0.14 / same; **won** solid `var(--v-red-hover)` (white label) / `rgba(212,76,67,0.16)` / `var(--v-red-highlight)`; **danger** `#ef4444` / 0.14 / `#f87171`; **neutral** `var(--v-text-3)` / `rgba(255,255,255,0.07)` / `#a3a3a3`.
- Charts `--v-chart-1..6`: `#d44c43 #60a5fa #22c55e #f59e0b #a78bfa #34d399`; `--v-chart-text` = text-inverse.
- Type: `--v-font-display 'Barlow Condensed'`, `--v-font-body 'Inter'`. Scale (size/line/tracking): xs 12/16/+0.08em (all caps labels, the floor), sm 13/18/0, md 15/22/0, lg 17/24/-0.005em, xl 20/26/-0.01em, 2xl 24/28/-0.015em, 3xl 30/34/-0.02em, display-sm 32/32/-0.01em, display-md 44/42/-0.012em, display-lg 60/56/-0.015em. Weights 400/500/600/700.
- Spacing: `--v-space-1..12` = 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48px. `--v-gutter clamp(16px, 3vw, 24px)`; `--v-gutter-l/-r` floored by safe-area; `--v-inset-top/-bottom`; `--v-tabbar-h 58px`; `--v-safe-bottom` = tab bar + inset.
- Radius: sm 6, md 10, lg 16, xl 22, pill 999. Cards lg, sheets and modals xl, chips and buttons md or pill.
- Shadow: `--v-shadow-1` hairline ring; `-2` `0 4px 16px rgba(0,0,0,0.40)` + ring; `-3` `0 12px 40px rgba(0,0,0,0.55)` + strong ring; `--v-glow-red`; `--v-glow-status` 3px ring of currentColor at 22%.
- Motion: `--v-dur-fast 120ms`, `-base 200ms`, `-slow 320ms`, `-enter 400ms`, `--v-stagger 40ms`; `--v-ease-out cubic-bezier(0.25,0.1,0.25,1)`, `--v-ease-in-out cubic-bezier(0.4,0,0.2,1)`, `--v-ease-spring cubic-bezier(0.34,1.3,0.64,1)`. Under `prefers-reduced-motion: reduce` and under `[data-v-motion='reduce']` every duration and the stagger become 0ms.
- Sizing: `--v-tap 44px`, `--v-tap-lg 56px`, `--v-control-h 44px`, icons sm/md/lg 14/18/24, `--v-sidebar-w 240px`, `--v-sidebar-rail-w 68px`, `--v-content-w 760px`, `--v-content-w-wide 900px`, `--v-panel-w 324px`.
- Sidebar: `--v-sidebar-bg/-text/-text-2/-text-3/-border/-hover/-active-bg/-active` alias the shell in dark.
- Z: base 0, sticky 10, tabbar 50, sheet 60, modal 70, toast 90, command 100.
- `--lay-*` aliases remain for older screens. `.v-sr-only` is the visually hidden utility.

### Light theme (`.lay-root[data-v-theme='light']`)
Ground `#f7f3ee`, surfaces `#f1ece5 / #eae4db / #e2dbd0`, overlay `rgba(26,22,19,0.45)`, bar `#f3efe8`, borders `rgba(26,22,19,0.10/0.20)`, text `#1a1613 / #4a433c / #5f574e`, text-inverse = text (solids keep hue, carry dark label). `--v-red-highlight` becomes the won text `#9e2f28`; red-soft 0.12. Status text: new `#8a3d0c`, progress `#1a44c2`, callback `#6d28d9`, booked `#166534`, won `#9e2f28`, danger `#a91b1b` (danger solid `#f87171`), neutral solid `#a3a3a3` with text = text-3. Charts `#c2413a #1d4ed8 #15803d #b45309 #6d28d9 #047857` with white chart text. Shadows warmer and wider. The sidebar tokens are pinned to the dark values so the rail stays Visualize black.

### How contrast is guaranteed
`docs/TOKENS.md` carries computed WCAG tables for both themes: all three text tiers pass 4.5:1 on all four layers (dark text-3 worst case 4.86 on surface-3; light text-3 5.16). Every status `-text` passes on every surface. Rules: red as text is always `--v-red-highlight` (raw `#d44c43` fails on surfaces at 4.38 and below); won solid uses the pressed red so white passes 5.11:1; danger solid `#ef4444` so the dark label passes 4.9; neutral text `#a3a3a3` so a neutral pill passes on a selected card; the active tab label and sidebar item use red-highlight (5.93 on surface-1). Known exception recorded: white on `--v-red` is 4.27:1 (AA large only), so primary buttons rest on `--v-red-hover`. `node scripts/hex-count.js` keeps raw hex at 90 or lower and only in the token block; `/design` renders both themes and their contrast tables live; `a11y-audit.mjs` runs axe.

---

## 5. The kit (`src/ui/index.js` exports)

`uiStyles` is one string (tokens plus every component stylesheet) injected once per shell inside `.lay-root`. Screens import from `'../ui'` only. Every `icon` prop accepts an Untitled UI component or a name string resolved by `icons.jsx` (`ICONS` map, `iconFor`, `<Icon icon size />`; token sizes go on style with a numeric attribute fallback). Portal rule (`portal.js`): overlays portal into `.lay-root` (fallback body) so they inherit tokens.

**Layout**
- `PageShell({ className, label })`: `.lay-shell` flex column with an ErrorBoundary.
- `ScrollArea({ wide, bare, contentClassName })`: `.lay-scroll` plus `.lay-content[--wide]`.
- `StickyFooterBar`: `.lay-footbar` in flow.
- `Stack({ gap=4, align 'start|center|end|stretch', as })`: vertical flex, children `min-width:0`.
- `Row({ gap=3, align 'start|center|end|baseline|stretch', justify 'start|center|end|between', wrap, as })`.
- `Grid({ minColumnWidth=180, columns, gap=3 })`: `repeat(auto-fit, minmax(min(Npx,100%),1fr))` or a fixed count.
- `Section({ title, description, action, gap=3, loading })`: `<section>` with an xs uppercase `<h2>`, description (a 180x14 skeleton while `loading` so the header never shifts), and a right action slot.
- `Divider({ label, vertical })`: `<hr>`, or a labeled separator, or a vertical rule.

**Surfaces**
- `Card({ level 1|2|3, padding=4 (space step, 0 none), interactive, glow (tone), header, footer, selected, as, onClick })`: `.v-card.lay-card.v-card--lN`, radius lg, hairline, `overflow:hidden; isolation:isolate`. With `onClick` it renders a `<button>` and is interactive (hover lifts 1px with shadow-2, active scales 0.995, focus ring; `.is-selected` gets a red border and ring). `glow` paints a radial gradient of the tone's solid in the top right corner as a background (no overflow box). `.v-pulse-won` is a one-shot ring and lift in the won tone. `.v-stretch` / `.v-above`: the pattern for a card or row that opens something (one real button absolutely stretched over the surface, other controls raised). `Card.Skeleton({ level, padding, lines=3, height })`.
- `StatCard({ icon, tone='neutral', value, label, trend {value, direction up|down|flat, tone?}, onClick })`: a glowing Card with an IconTile, display-sm value, sm label, trend line colored booked/danger/neutral by direction. `min-height:132px`. `StatCard.Skeleton({ trend, trendLines })`.
- `IconTile({ icon, tone='neutral', size sm|md|lg = 32/40/48, glow=true })`: tinted square (`-soft` background, `-text` color, 28% border, 18px glow). `IconTile.Skeleton({ size })`.
- `Pill({ id, list, label, tone, icon|false, variant soft|solid|outline, size md|sm, dot })`: resolves label, tone and icon from semantics via `resolveSemantic` (explicit props win; `id` may also be a tone name). Height 26 (sm 22), xs bold, pill radius. `soft`: tone soft background, tone text, 30% tone border. `solid`: tone solid background with `--v-text-inverse` (won uses `--v-text-on-red`). `outline`: transparent with strong border. `dot` shows a 7px dot with a 22% ring instead of the icon. `Pill.Skeleton({ width=72 })`.
- `Badge({ count, max=99, dot, tone='won', inline, children })`: hidden at 0 unless `dot`; renders `99+` above max; `role="img"` with `aria-label "N new"` or "Has updates". Pinned to the top right of a wrapped child (`.v-badge-anchor`), or static with `inline`. Ticks (scale 1.3 bounce, spring) when the count grows. 18px tall, 11px bold, 2px `--v-bar` ring.
- `Avatar({ name, src, size xs|sm|md|lg|xl = 24/32/40/56/72, status })`: initials (`initialsOf`: first and last word initials, or two letters, `?` when empty), a deterministic chart hue (`hueIndex` over the name mod 6) at 18% over surface-2 with a 40% border, optional image, optional status dot (26% size, tone solid). `Avatar.Skeleton({ size })`, `Avatar.sizes`.
- `EmptyState({ icon, title, description, action {label, onClick|href, icon}, secondary {label, onClick|href}, size md|sm })`: `role="status"`, a 56px red-soft icon tile, display 2xl uppercase title (xl in sm), md description max 420px, a primary Button and a ghost Button. Copy rule: say what will appear here and how to make it happen, never "No data".
- `ErrorState({ title='Could not load this', description='Check the connection and try again.', onRetry, retryLabel='Try again', retrying, details })`: `role="alert"`, danger-soft panel with an AlertCircle, secondary "Try again" button (RefreshCw01, spinner while `retrying`), optional "Show details" / "Hide details" disclosure with a `<pre>`. `useRetry(refetch)` returns `[retry, retrying]`.
- `ErrorBoundary({ label, reload, fallback(error, reset), onError })`: class component; logs `{ kind: 'boundary' }`; default fallback is an ErrorState titled "Something broke on <label>" with description "The rest of the app is fine. Reload this screen; the error is saved under Settings, Automation.", button "Reload" (reloads the page when `reload`, else resets), details = message and stack.
- `ListRow({ leading, title, subtitle, meta, trailing, onClick, selected, chevron=true, aria-label, role })`: `.v-lrow.lay-card`, min height `--v-tap-lg`, surface-1, radius md. With `onClick` and no `role`, it is a `<div>` with one `.v-stretch.v-lrow-open` button named by `aria-label` or the string title; `leading` and the meta/trailing side are `.v-above`, so a Menu in `trailing` never nests in a button. With a `role` (command bar options) it is a single `<button>`. Title md semibold truncated, subtitle sm text-3 truncated, meta xs tabular, a chevron when clickable. `.is-selected` red border and surface-2; `aria-current` when selected. `ListRow.Skeleton({ leading=true, trailing=true })`.

**Controls**
- `Button({ variant primary|secondary|ghost|danger|icon, size md|lg, loading, disabled, icon, iconEnd, full, href, type='button' })`: renders `<a>` with `href`. `min-height --v-control-h` (lg `--v-tap-lg`, md text, radius lg), `min-width --v-tap`, radius md, sm bold label, `active` scales 0.97, `disabled` 50% opacity, `loading` hides the inner span (keeping width) and centers a Spinner (`aria-busy`). Primary rests on `--v-red-hover` with white and the red glow, hovers to `--v-red`, presses to `--v-red-highlight`. Secondary: surface-3, strong border. Ghost: transparent, text-2, hover surface-2. Danger: danger-soft with danger text, hover fills danger solid with inverse text. Icon: a 44px square, transparent, hairline.
- `IconButton({ icon, label (required), variant ghost|secondary|primary|danger, size md|lg, active, badge, tooltip=true })`: 44px (lg 56px) square with `aria-label`, `aria-pressed` when active (red-highlight on red-soft), a Badge on the corner, wrapped in a Tooltip by default.
- `Chip({ label, count, selected, icon, onClick, disabled })`: 44px tall, surface-2, `aria-pressed`; selected shows a Check, red-soft background, red border; count bubble (red-hover when selected). `ChipGroup({ options [{id,label,count,icon}], value (Set or id), onChange, multi=true, allWhenEmpty=true, label })`: `role="group"`; multi toggles a Set; single toggles to null when re-clicked and `allWhenEmpty`; an "All" xs label renders when the selection is empty.
- `FieldShell({ id, label, hint, error, leading, trailing, required, disabled, multiline, children(attrs) })`: xs uppercase label (`*` in red-highlight when required), `.v-field-shell` (surface-2, hairline, radius md, `min-height --v-control-h`, focus-within red border and 3px red-soft ring; error uses danger border and ring), leading/trailing slots, and a message line (`role="alert"` for errors, replaces the hint). `Input` (forwardRef, `type='text'`, passes `inputMode`, `placeholder`, etc.), `Textarea` (`rows=3`, multiline shell), `Select` (native select, `options [{id,label,disabled}]` or children, `placeholder` as a disabled first option, ChevronDown trailing).
- `InlineEdit({ value, onSave(next) => boolean|Promise, patch {url,id,key}, onChange, format, placeholder='Add', label='Edit', type, inputMode, multiline, errorMessage='Could not save. Your change was undone.' })`: a 44px button (`aria-label "<label>: <display>"`, italic placeholder when empty, pencil on hover) that becomes an input or textarea; Enter (Cmd/Ctrl+Enter when multiline) or blur commits, Escape cancels; the display updates optimistically, a Spinner shows while saving, and on failure it reverts and calls `toast.error(errorMessage)`; `patch` uses `patchWithRollback`.
- `Toggle({ checked, onChange(next), label, description, disabled, size md|sm })`: a `<label>` row (44px) with a 46x26 track (sm 38x22), `role="switch"` input, thumb slides 20px with the spring ease; checked is red-hover with a red border.
- `Checkbox({ checked, onChange, label, indeterminate, disabled })`: 22px box with a Check or Minus mark that pops in; the hidden input is inset -11px so the 44px row is the target; checked and indeterminate fill red-hover.
- `SegmentedControl({ options [{id,label,icon}], value, onChange, size md|sm, full, label })`: `role="radiogroup"` with `role="radio"` buttons, arrow keys move, roving tabIndex; every option is at least 44x44 in both sizes; `sm` only shrinks font and padding; the active option gets surface-3 and shadow-1.
- `Tabs({ tabs [{id,label,count,icon,pulse}], value, onChange, label })`: `role="tablist"` with `role="tab"` buttons, Left/Right wrap, one 2px red underline (`.v-tabs-ind`) slides between tabs over `--v-dur-base`, the strip scrolls sideways (hidden scrollbar) and the active tab scrolls into view; a count renders as an inline Badge (red-hover on the active tab); `pulse` plays one booked-tone scale pulse.
- `Table({ columns [{id,label,render,sortable,defaultDir,width,align,always}], rows, rowKey=_id, selectable, selected (Set), onSelect, sort {id,dir}, onSort, density md|sm, onRowClick, rowActions(row), storageKey, columnChooser=true, empty, rowClassName, pageSize=80, aria-label })`: wrapper with radius lg and a scroller; sticky header (surface-2, xs uppercase), sticky first column (or checkbox column), header checkbox with indeterminate, sortable headers are buttons with `aria-sort` and arrow hints, rows `tabIndex=0` with Enter opening, selected rows red-soft, hover surface-2. Column chooser: a Columns03 IconButton opening a `Popover trap width=240 label="Columns"` of Checkboxes (`always` columns disabled); hidden set persisted under `storageKey`. Windowing: only `pageSize` rows mount; an IntersectionObserver sentinel (400px margin) or a "Show more (N of M to go)" button extends the window; sort and selection still cover every row. First 8 rows stagger in on mount. Cells cap at 280px and truncate; md rows are 56px, sm 44px. `Table.Skeleton({ rows=8, cols=6, density, selectable=true })`.
- `Collapsible({ open, children })`: measured-height open/close over `--v-dur-slow`, content stays mounted, `aria-hidden` and `visibility:hidden` when closed.

**Overlays and feedback**
- `Sheet({ open, onClose, title, description, footer, width=420, tall, label, className })`: portals to `.lay-root`; stays mounted through a closing animation (`durationMs('--v-dur-base') + 60`); `useScrollLock`; `useFocusTrap` with Escape; backdrop `--v-overlay` with 3px blur and a fade, `z: --v-z-sheet`. `role="dialog" aria-modal`, labelled by the string title (`#v-sheet-title`) or `label` (default "Details"). Mobile (`< 768`): bottom sheet, radius xl top corners, `max-height: 100dvh - 32px - inset-top` (`tall` makes it that height), drag handle and header accept pointer drags (dismiss when dragged more than 110px or faster than 0.6px/ms, else snap back), slide-up over `--v-dur-slow`, bottom padding `--v-inset-bottom`. Desktop: right side panel at `width`, full height, slides in from the right; the header gets a bottom hairline. Body scrolls (`overscroll-behavior: contain`, padding 8/20/20, gap 16); footer pinned with a top hairline (buttons stretch on mobile). Close X button `aria-label="Close"`. Use for details, forms, drawers; not for yes/no.
- `Modal({ open, onClose, title, description, footer, size sm|md|lg = 420/560/720, danger, closeButton=true, label })`: same lifecycle, `.lay-overlay` backdrop, `z: --v-z-modal`, surface-2 box with radius xl and shadow-3, springs in (12px rise, 0.97 scale), fades out; danger colors the title in danger text; first `[data-autofocus]` gets focus; footer buttons take 45% each under 480px. Use for confirmations and short forms.
- `ConfirmDialog({ open, onClose, onConfirm (may return a promise; the button shows loading until it settles), title, body, confirmLabel='Confirm', cancelLabel='Cancel', danger, icon (Trash01 by default when danger) })`: a Modal without the X, footer of a ghost cancel and a primary or danger confirm with `data-autofocus`. `useConfirm()` returns `[confirm, element]`; `await confirm({ title, body, danger, confirmLabel })` resolves true or false (false on cancel, Escape, backdrop); default title "Are you sure?". Replaced every `window.confirm`.
- `Toast`: mount `<ToastProvider max=4>` once (AdminApp). `useToast()` returns `{ show({ title, description, variant, duration, action {label,onClick}, countdown }), success(title, o), error(title, o) (6000ms), info(title, o), undo(title, onUndo, { seconds=5, label='Undo' }) (countdown bar), dismiss(id) }`; without a provider it warns and no-ops. Host is a permanent `role="status" aria-live="polite" aria-relevant="additions"` region portaled to `.lay-root`, `z: --v-z-toast`; bottom center above the tab bar (`--v-safe-bottom + 12px`) on mobile, bottom right at 768+. Each toast: surface-3, 3px left border in the tone text (success booked, error danger, info progress, undo neutral), icon (CheckCircle, AlertCircle, InfoCircle, FlipBackward), title and description, optional action button (dismisses after running), X "Dismiss", springs in and fades out; hover pauses the timer and the countdown bar (`scaleX` over the duration). Newest replaces the oldest beyond `max`.
- `Tooltip({ label, side top|bottom, children })`: only on `HOVER_QUERY` devices; clones the child with hover, focus and Escape handlers and `aria-describedby`; renders `role="tooltip"` in surface-3, xs semibold, `z: --v-z-toast`. On touch the child renders alone (keep its aria-label).
- `Popover({ open, onClose, anchorRef, align start|end|stretch, side bottom|top, width, trap=false, z='var(--v-z-command)', label })`: fixed-position panel measured from the anchor (default width `min(280, vw-16)`, stretch = anchor width, clamped 8px from edges; flips above when under 200px remain below and more room above; `maxHeight` from the free space); re-places on resize and any scroll; closes on Escape (when not trapping; the trap handles it otherwise) and outside pointerdown; `role="dialog"` when trapping; surface-2, strong border, radius md, shadow-3, 4px drop-in.
- `Menu({ items [{id,label,icon,danger,disabled,onSelect} | 'divider'], trigger, label='Actions', align='end' })`: default trigger a DotsVertical IconButton with `aria-haspopup="menu"`; a trapping Popover with `role="menu"`, `role="menuitem"` buttons (44px, md medium; danger in danger text; disabled 45%), first item focused on open, Arrow/Home/End navigation, Enter selects (closes then calls `onSelect`), Escape closes and restores focus.

**Loading and motion**
- `SkeletonBlock({ width='100%', height=16, radius=sm })`, `SkeletonText({ lines=3, width, lineHeight=14, gap=2 })` (last line 62%), `SkeletonCircle({ size=40 })`: `.v-skel` surface-2 with a diagonal surface-3 sweep over `--v-dur-slow * 4`, static under reduced motion, all `aria-hidden`. Every data component ships a matching `.Skeleton` carrying `aria-busy` and `aria-hidden`.
- `RecordSkeleton({ cards=3, tabs, header=true, headerHeight, heights[] })`: the record detail shape (header card with a 56px circle, name, two pills, three 104x44 action blocks; optional tab strip; content cards).
- `useDelayedLoading(isLoading, delay=150)`: false for the first 150ms, then true until loading ends; every screen gates skeletons on it.
- `Stagger({ cap=8, offset=0, as='div', className, style })`: wraps each child in `.v-stagger-item` animating `v-enter` (fade and 8px rise over `--v-dur-enter`) with `animationDelay = min(i, cap) + offset` staggers; plays once per mount (a ref), never on re-render; settles after `enter + (cap+offset) * stagger + 50ms`.
- `Reveal({ delay, as })`: single element `v-enter`.
- `ProgressBar({ value, tone='booked', size md|sm = 8/4px, label, indeterminate })`: label row with percentage, `role="progressbar"` track, fill animates width over `--v-dur-slow` with a soft glow; indeterminate sweeps a gradient on the track itself (solid tint under reduced motion).
- `ProgressRing({ value, size=64, thickness=6, tone='booked', label='Progress', children })`: SVG ring rotated -90deg, dash offset animates, center slot defaults to the percentage in display font (xs under 56px, md under 88px, else 2xl); `role="progressbar"`.
- `Spinner({ size=16 })`: `role="status" aria-label="Loading"`, 2px ring rotating over `--v-dur-slow * 2.5`; inline only (buttons), never full page; a static two-tone ring under reduced motion.
- `durationMs(name, fallback)` reads a duration token from `.lay-root` (0 under reduced motion; fallbacks 120/200/320/400/40); `motionReduced()` is `durationMs('--v-dur-base') === 0`.

**Hooks**
- `useOptimisticPatch()` returns `mutate({ url, id, set, apply, error='Could not save. Your change was undone.', success })`: `apply()` runs immediately and returns the undo; wraps `patchWithRollback`; `toast.error(error)` on failure, `toast.success(success)` when given; resolves true or false.
- `useMediaQuery(query)` plus `DESKTOP_QUERY`, `HOVER_QUERY`.
- `useFocusTrap(ref, active, { onEscape, initialFocus })`: focuses `[data-autofocus]` or the first focusable, wraps Tab and Shift+Tab, stops Escape propagation and calls `onEscape` (read through a ref), restores focus to the opener on close.
- `useScrollLock(active)`: reference-counted `body { overflow: hidden }`.
- `useOnline()`: `navigator.onLine` with online/offline listeners.
- `useRetry(refetch)`: `[retry, retrying]`.
- `useConfirm()`, `useToast()` as above.
- `entryOf(id, list)`, `toneOf(entry)`, `resolveSemantic({ id, list, label, tone, icon })`, `TONES` = `['new','progress','callback','booked','won','danger','neutral']`. `entryOf` searches CALL_STATUSES, PRIORITIES, STAGES, LEAD_STATUSES, CONTACT_TYPES in that order; pass `list` when ids collide (`new`, `booked`).

Note: `ImageField` is not part of `src/ui`; it lives in `src/components` alongside LeadCard, LeadDetail, ClientCard and the rest (their styles `leadCard.styles.js`, `lead.styles.js` ship in `uiStyles`). The `/design` route renders every component in every state as proof.

---

## 6. Shared semantics (`src/shared/semantics.js`)

Every entry is `{ id, label, icon, order, solid, soft, text, color }` where the four color fields are `var(--v-status-<tone>-...)` strings (`color` = the text tone). `api/_semantics.js` mirrors the id lists for the serverless sanitizers.

- **CALL_STATUSES** (`callStatus`): `not-called` "Not called" Phone neutral; `callback` "Callback" PhoneIncoming01 callback; `no-answer` "No answer" Voicemail new; `booked` "Booked" Check booked; `no` "Said no" PhoneHangUp danger; `wrong-number` "Wrong number" PhoneX01 (maps to SlashCircle01) danger. `callStatusOf(id)` defaults to not-called. **OUTCOMES** (console bar with keys): booked 1, callback 2, no-answer 3, no 4, wrong-number 5. **WINDOWS**: morning "Morning" Sunrise 5 to 11; midday "Midday" Sun 11 to 14; afternoon "Afternoon" Sun 14 to 17; evening "Evening" Sunset 17 to 24.
- **PRIORITIES**: `hot` "Hot" Zap won; `warm` "Warm" Sun new; `cold` "Cold" Snowflake01 progress. Default warm.
- **STAGES** (`stage`): `lead` "Lead" Users01 neutral; `booked` "Booked" CalendarCheck01 booked; `won` "Won" Trophy01 won; `client` "Client" Briefcase01 booked; `lost` "Lost" XClose danger. `normalizeStage(lead)`: a known stage wins; missing or empty reads `booked` if `callStatus === 'booked'`, else `lead`.
- **LEAD_STATUSES** (submissions.status): `new` "New" Bell01 new; `contacted` "Contacted" Mail01 progress; `replied` "Replied" MessageCircle01 callback; `landed` "Landed" Check booked; `denied` "Denied" XClose danger.
- **CONTACT_TYPES** (contactLog type): call "Call" Phone; meeting "Meeting" Calendar; email "Email" Mail01; text "Text" MessageCircle01; other "Contact" User01 (no tones).
- **MEETING_TYPES**: call "Call", video "Video", in-person "In person". **PLANS**: full "Paid in full", 6mo "6-month plan" (6 months), 12mo "12-month plan" (12).
- **CONCEPT_STATUSES** (legacy booked workspace): planned neutral, generating progress, ready booked, shown won. **CONCEPT_PRESETS**: Logo directions, Brand board, Social grid, Website demo, Drive folder.
- **PROJECT_KINDS**: brand "Brand" Palette callback; web "Web" Globe01 progress; combined "Combined" Zap won; print "Print" Package new; retainer "Retainer" RefreshCw01 booked. **PROJECT_STAGES**: kickoff Play neutral; design Palette progress; revisions Edit02 callback; build Columns03 progress; delivery Package new; delivered Check booked. **SCHEDULE_STATUSES**: paid Check booked; due Clock new; past-due "Past due" ClockRewind danger; upcoming Calendar neutral. **RETAINER_STATUSES**: active RefreshCw01 booked; paused Clock new; ending ClockRewind callback; cancelled XClose neutral. **CLIENT_STATUSES**: active Zap progress; paused Clock new; delivered Check booked.
- **PRINT_ORDER_STATUSES**: new Bell01 new; designed Palette progress; cut Scissors01 callback; packed Package booked; delivered Check booked; cancelled XClose neutral. **ORDER_SOURCES**: shop Package progress; client Briefcase01 booked; walk-in "Walk in" User01 neutral; import Download01 neutral.
- **CONCEPT_KINDS** (retired packs): logo Palette won; brand-board Colors callback; social Camera01 progress; website Globe01 progress; signage MarkerPin01 new; apparel User01 new; vehicle Package neutral; packaging Package neutral; ads Zap booked; other Image01 neutral.
- **CONCEPT_SET_STATUSES** (the client presentation): draft "Draft" Edit02 neutral; sent "Sent" Send01 progress; viewed "Viewed" Eye callback; changes "Changes requested" Edit02 danger; approved "Approved" Check booked; archived "Archived" Archive neutral. **CONCEPT_ITEM_KINDS**: logo "Logo" Palette; board "Brand board" Colors; mockup "Mockup" Image01; social "Social" Camera01; web "Website" Globe01; print "Print" Package; other "Other" Image01. **CONCEPT_FEEDBACK_ACTIONS**: approve "Approved" Check booked; change "Changes requested" Edit02 danger; note "Note" MessageCircle01 neutral.
- **REVIEW_CHANNELS**: nfc "NFC card" CreditCard01; text "Text" MessageCircle01; email "Email" Mail01; in-person "In person" User01. **REVIEW_RESULTS**: asked Send01 progress; left Star01 booked; declined XClose neutral. **TESTIMONIAL_SOURCES**: the four channels plus website "Website" Globe01 and google "Google" Star01.
- **SUBMISSION_TYPES**: start "Brief" Inbox01 progress; contact "Contact" Mail01 callback; review "Review" Star01 won; shop-order "Shop order" Package booked; other "Other" File06 neutral.
- **PLATFORMS**: instagram Camera01 won; facebook Globe01 progress; tiktok Play callback; other File06 neutral. **POST_STATUSES**: making "Making" Edit02 neutral; review "In review" Clock new; approved "Approved" Check booked; posted "Posted" Send01 neutral. **POST_FORMATS**: portrait "Portrait post" Image01, aspect `img-fit--4x5`, ratio 4:5, "The standard feed post.", progress; story "Story" Zap, `img-fit--9x16`, 9:16, "Disappears in 24 hours.", callback.
- **Industry**: `industryKey(v)` lowercases and collapses whitespace; `displayIndustry(v)` title-cases it. No enum list; industries are free text normalized on that key.
- Id lists exported for sanitizers: `CALL_STATUS_IDS`, `PRIORITY_IDS`, `STAGE_IDS`, `CONTACT_TYPE_IDS`, `MEETING_TYPE_IDS`, `PLAN_IDS`, `PROJECT_KIND_IDS`, `PROJECT_STAGE_IDS`, `SCHEDULE_STATUS_IDS`, `RETAINER_STATUS_IDS`, `CLIENT_STATUS_IDS`, `PRINT_ORDER_STATUS_IDS`, `ORDER_SOURCE_IDS`, `CONCEPT_KIND_IDS`, `CONCEPT_SET_STATUS_IDS`, `CONCEPT_ITEM_KIND_IDS`, `CONCEPT_FEEDBACK_ACTION_IDS`, `REVIEW_CHANNEL_IDS`, `REVIEW_RESULT_IDS`, `TESTIMONIAL_SOURCE_IDS`, `SUBMISSION_TYPE_IDS`, `PLATFORM_IDS`, `POST_STATUS_IDS`, `POST_FORMAT_IDS`, `CONCEPT_STATUS_IDS`.

---

## 7. Copy conventions (`src/shared/copy.js`)

`COPY` has five blocks: `empty`, `error`, `offline`, `success`, and two client-facing blocks `planner` and `concepts`. Helpers `emptyCopy(key)` (fallback "Nothing here yet") and `errorCopy(key)` (fallback `COPY.error.generic`).

- `COPY.empty['screen.state']` entries are `{ title, description, action?, secondary? }`. Keys: `dashboard.today`, `dashboard.activity`, `planner.month`, `planner.off`, `leads.none`, `leads.filter`, `leads.dupes`, `leads.column`, `leads.detail.pricing`, `leads.detail.script`, `leads.detail.objections`, `leads.detail.close`, `leads.detail.intel`, `leads.detail.history`, `leads.detail.submissions`, `leads.picker`, `calls.builder`, `calls.room`, `booked.none`, `booked.filter`, `calendar.day`, `calendar.range`, `clients.none`, `clients.filter`, `clients.projects`, `clients.payments`, `clients.schedule`, `clients.ledger`, `clients.retainer`, `clients.retainer.cancelled`, `clients.deliverables`, `clients.deliverables.noproject`, `orders.none`, `orders.filter`, `orders.items`, `orders.import.device`, `orders.import.csv`, `concepts.none`, `concepts.filter`, `concepts.lead`, `reviews.none`, `reviews.filter`, `reviews.forms`, `landing.logostrip`, `landing.work`, `landing.testimonials`, `submissions.none`, `submissions.filter`, `submissions.fields`, `settings.deleted`, `settings.reconcile`, `notifications.none`. Examples: `leads.none` = "No open leads" / "Add one, import a spreadsheet, or check Booked and Clients. Everyone might just be further down the pipeline." / "Add lead" / secondary "Import spreadsheet"; `dashboard.today` = "All caught up" / "No callbacks, meetings, or new leads waiting. Start a call session." / "Start call session"; filter states share "Every X is under All." / "Show all".
- `COPY.error.<resource>`: `posts`, `generic`, `leads` ("Could not load your leads" / "The call_leads list did not come back. Try again; nothing was changed."), `submissions`, `orders`, `sets`, `projects`, `settings`, `calendar`, `notifications` ("They come from your leads, and those did not load. Try again."), `calls`. Write strings: `save` "Could not save. Your change was undone.", `saveOffline`, `del` "Delete failed. Nothing was removed.", `create` "Could not create that. Nothing was saved.", `restore`, `copy`.
- `COPY.offline`: `banner` "You are offline. Reading is fine; changes wait until you are back.", `toast` "You are offline. That change was not saved.", `back` "Back online."
- `COPY.success.targetHit` "Target hit. Nice."
- Tone of voice: short declarative sentences addressed to Rob (the single owner; the greeting says his name, the drawer says "Rob takes it from here"), each empty state says what will appear and how to make it happen with exactly one primary action, errors say what did not happen ("nothing was changed"). No em dashes anywhere. Screens never type "No data" or inline copy. The `planner` and `concepts` blocks are the only ones written to a business owner: plain words, no CRM jargon (e.g. "Rob is working on it. Nothing for you to do."), with function-valued strings for counts and names.

---

## 8. Data access conventions (`src/shared/api.js` and AdminApp)

- `apiFetch(url, { method='GET', body, headers, silent })` returns `{ ok, status, data }` always (never throws). Same origin, cookie auth only, JSON body when `body !== undefined`. A GET first checks the warm store. A non-GET while `navigator.onLine === false` is refused up front: emits `vz:offline-write` and returns `{ ok:false, status:0, data:null, offline:true }` (writes are blocked, not queued). Any 5xx or network failure emits `vz:api-failed` (unless `silent`), which `wireClientLog` posts to `/api/admin/log`.
- `patchWithRollback({ url, id, set, apply, onError })`: `apply()` runs first and returns an undo; PATCH `{ id, set }`; on failure it runs the undo and `onError(r)`; returns true or false. `useOptimisticPatch` and `InlineEdit`'s `patch` prop wrap it.
- Shell-level data (AdminApp) holds one array each for call leads, submissions, projects, posts, concept sets and orders, loaded after auth, with `errors[key]` per resource so each screen renders an `ErrorState` with Retry. Every write follows the same optimistic pattern: map the local array to the new value while capturing `prev`, send `PATCH { id, set }`, and put `prev` back on failure (creates POST then refetch or prepend `r.data.item`; deletes filter locally, `DELETE ?id=` or `?ids=a,b`, restore on failure; concept set PATCH takes the server's returned document since sends and regenerations stamp fields). Every write is a `$set` of whitelisted fields server side.
- Error toasts: screens call `toast.error(COPY.error.save)` (or the specific write string) on rollback; `useOptimisticPatch` does it automatically. Offline: the shell shows the banner under the top bar while `useOnline()` is false, fires `toast.error(COPY.offline.toast)` at most every 2.5s on refused writes, and `toast.info(COPY.offline.back)` when the connection returns.
- Dates (`src/shared/dates.js`): `parseDate` accepts Date, ISO, `YYYY-MM-DD` (parsed as local midnight), or epoch; `dayKey`, `isDateOnly`, `toMs`, `fmtDate` "Aug 6, 2026", `fmtDateTime` "Aug 6, 2:22 PM", `fmtWeekdayDateTime` "Tue, Aug 11, 6:00 PM", `todayInput`, `daysSince`, `relativeTime` ("just now", "5m ago", "3h ago", "2d ago"), `countdownLabel` ("today", "tomorrow", "in 2 days", "yesterday", "3 days ago"), `fmtMins` ("12m", "1h 5m").

Key files (absolute): `/home/user/website/src/main.jsx`, `/home/user/website/src/pages/AdminApp.jsx`, `/home/user/website/src/shell/AppShell.jsx`, `/home/user/website/src/shell/Sidebar.jsx`, `/home/user/website/src/shell/nav.js`, `/home/user/website/src/shell/CommandBar.jsx`, `/home/user/website/src/shell/search.js`, `/home/user/website/src/shell/notifications.js`, `/home/user/website/src/shell/NotificationsDrawer.jsx`, `/home/user/website/src/shell/bootFrame.js`, `/home/user/website/src/shell/appearance.js`, `/home/user/website/src/shell/storage.js`, `/home/user/website/src/ui/index.js`, `/home/user/website/src/ui/tokens.js`, `/home/user/website/src/ui/semantic.js`, `/home/user/website/src/ui/icons.jsx`, `/home/user/website/src/shared/copy.js`, `/home/user/website/src/shared/semantics.js`, `/home/user/website/src/shared/api.js`, `/home/user/website/src/shared/dates.js`, `/home/user/website/LAYOUT.md`, `/home/user/website/docs/COMPONENTS.md`, `/home/user/website/docs/TOKENS.md`, `/home/user/website/index.html`, `/home/user/website/api/_lib/auth.js`, `/home/user/website/api/admin/login.js`.
# Part 2: the pipeline screens


Source files read (all under /home/user/website): src/pages/AdminDashboard.jsx, AdminLeads.jsx, AdminCalls.jsx, AdminBooked.jsx, AdminCalendar.jsx, AdminApp.jsx (routing and data loading); src/components/LeadCard.jsx, LeadDetail.jsx, DetailFold.jsx, LeadForm.jsx, LeadImport.jsx, LeadPlaybook.jsx, LeadNotes.jsx, LeadHistory.jsx, Checklists.jsx, CallbackPicker.jsx, LeadPicker.jsx, LinkedSubmissions.jsx, RecentClients.jsx, SocialLinks.jsx; src/lib/leads.js, leadShape.js, events.js, calls.js, heals.js, booked.js, defaultLead.js, socials.js, spreadsheet.js, ics.js, adminPaths.js; src/shared/semantics.js, copy.js, pricing.js, dates.js, phone.js; src/shell/notifications.js, shortcuts.js, nav.js, AppShell.jsx (context); api/_routes/call-leads.js, leads-import.js, calendly-events.js; docs/QA-CHECKLIST.md, docs/ARCHITECTURE.md (routes table).

Note: RecentClients.jsx is not an admin piece. It is the marketing Home scene "Recent clients" (three ClientCards from the CRM showcase feed, hidden when there is no work). It is documented at the end for completeness.

---

## 0. Shared foundations

### 0.1 Routing and hosts
- The admin is served at admin.visualizeclients.com on root paths; on localhost the same screens live under /admin/*. `BASE` is '' on the admin host and '/admin' elsewhere (src/lib/adminPaths.js: ADMIN_HOME, ADMIN_CALLS).
- Section is derived from the path in AdminApp: `/` Dashboard, `/leads` Leads (also `/leads/:id/concepts` is the concepts editor, not in this slice), `/calls` Call Console, `/booked` Booked, `/calendar` Calendar.
- URL params that matter here: `?open=<leadId>` deep links a record on the current screen (push links and the audits use it); `?loading=1` forces the loading state for audits; `?submission=<id>` is a push deep link for submissions.
- Nav (src/shell/nav.js): Pipeline group is Dashboard, Leads (badge = leads with stage lead and callStatus not-called), Call Console (tab label "Call", badge = open callbacks: callStatus callback and stage not lost), Booked (badge = booked count), Calendar (badge = items today: callbacks with no callbackAt, callbackAt today or past, plus meetings today). Phone: a bottom TabBar shows the `tab: true` entries (Dashboard, Leads, Call, Booked) plus More.
- Screen to screen jumps go through the shell context (`useShell()`): `go(navId, preset)`, `openRecord(lead)` (opens the lead on the screen that owns its stage: booked goes to /booked, won or client to /clients, else /leads), `newLead(preset)`, `openShowcase(lead)`, `openPlanner(lead, month)`, `openConcepts(lead, setId)`, plus `profile`, `sets`, `posts`, `projects`, `calendly`, `events`. Presets: Leads takes `{ status: [...], prio: [...], industry }` as a filter preset; Calls takes `{ status, prio, ids, autostart }`.

### 0.2 Data loading and writes
- AdminApp loads `GET /api/admin/call-leads` once (all non-deleted leads, newest first, limit 500), runs every record through `normalizeLeads()` (the shape guard) and passes the array to Dashboard, Leads, Booked, Calendar. The Call Console keeps its OWN copy of the list (its own GET) and calls `onDataChanged` to make the shell refetch.
- Every write is `PATCH /api/admin/call-leads` with `{ id, set }` (optionally `explicit: true`); the server runs `sanitize()` as the whitelist and does `$set` of only the keys the caller sent. Objects like `meeting`, `script`, `close`, `intel`, `socials`, `afterCall` are full replacement (the client always spreads the current value forward). Arrays like `callLog`, `contactLog`, `checklists`, `pricingOptions`, `gamePlan` are sent whole.
- The stage guard: if the stored stage is `client` or `won` and the PATCH tries to change it, the server answers 409 unless the body carries `explicit: true`. Moving to client or won without `clientSince` stamps `clientSince` server side.
- `onPatch(id, set)` (AdminApp `patchCallLead`) is optimistic with rollback and resolves true or false. Screens toast `COPY.error.save` = "Could not save. Your change was undone." on false.
- Create: `POST /api/admin/call-leads` with the lead body (idempotent on business name: a duplicate name is skipped and only backfills empty socials). Delete: `DELETE /api/admin/call-leads?id=` or `?ids=a,b,c` (soft delete: `deleted: true, deletedAt`, optional `&reason=merged`); restore: PATCH `{ action: 'restore', ids }`. Deleted leads purge after 30 days.
- Offline: writes are refused with the toast "You are offline. That change was not saved." and a banner "You are offline. Reading is fine; changes wait until you are back."

### 0.3 The lead document (call_leads) fields these screens use
Core: `_id, business, industry, descriptor, phone, phoneNote, email, area, askFor, bestWindow, priority (hot|warm|cold, default warm), callStatus (not-called|callback|no-answer|booked|no|wrong-number), stage (lead|booked|won|client|lost, may be missing or ""), angle, notes, prepNotes, sourceId (set by the scraper or spreadsheet ID column), createdAt, updatedAt, deleted, deletedAt, deletedReason, mergedInto`.
Playbook: `beforeYouDial[]` (strings), `script{confirm, intro, homework, question, likelyAnswers[{say, respond}], hook, ask}`, `objections[{say, respond}]`, `close{lockIt, ifNo, noAnswer}`, `intel{accomplishments[], gaps[], dropLines[]}`, `afterCall{meeting, email, whatTheySaid, nextAction}`.
Activity: `callLog[{at ISO, outcome, note, meeting "YYYY-MM-DD HH:MM" string, email}]` (capped 200), `contactLog[{type call|meeting|email|text|other, at, note}]`, `callbackAt` (ISO string or ''), `enrichment{lastScanAt, scanCount}` (written by the nightly job).
Booked: `meeting{date "YYYY-MM-DD", time "HH:MM", type call|video|in-person, location}`, `gamePlan[{serviceId, checked, note}]`, `pricingOptions[]` (max 3; `{id, packageId, addonIds[], retainerId, recommended, note}` plus derived legacy fields `label, price, plan full|6mo|12mo, retainer, notes`), `bookedOutcome{result won|lost, reason, at}`, `calendlyEventUri`, `checklists[{name, items[{text, done}]}]` (max 10 lists x 50 items).
Client-side only reads here: `clientSince, clientStatus, purchases[], retainer{status, amount}, showcase{published,...}, planner{enabled}`.
Socials: `socials{website, instagram, facebook, tiktok, google, yelp, linkedin, x, youtube}`, every value normalized to a full https URL (`normalizeSocial`: "@handle" becomes https://instagram.com/handle, a bare domain gets https://, google becomes a Maps search URL).

### 0.4 Stage and status semantics
- `normalizeStage(lead)`: the stored stage if valid, else `booked` when `callStatus === 'booked'`, else `lead`. `effectiveStage` is an alias.
- `callStatus` is the call board position (kanban columns); `stage` is the pipeline position. Booking sets both (`callStatus: 'booked', stage: 'booked'`).
- Enums with labels, icons and tones (src/shared/semantics.js): CALL_STATUSES Not called (Phone, neutral), Callback (PhoneIncoming01, callback), No answer (Voicemail, new), Booked (Check, booked), Said no (PhoneHangUp, danger), Wrong number (PhoneX01, danger). PRIORITIES Hot (Zap, won tone), Warm (Sun, new), Cold (Snowflake01, progress). STAGES Lead, Booked, Won, Client, Lost. WINDOWS Morning 5 to 11, Midday 11 to 14, Afternoon 14 to 17, Evening 17 to 24. MEETING_TYPES Call, Video, In person. CONTACT_TYPES Call, Meeting, Email, Text, Contact.
- OUTCOMES (console bar order with keys): Booked 1, Callback 2, No answer 3, Said no 4, Wrong number 5.
- Delete safety (`deleteBlockReason`): "Has call history, cannot delete", "Booked, cannot delete", "Won or client, cannot delete", else deletable.
- `isNewLead`: createdAt within 48 hours. `lastTouchAt`: latest of callLog and contactLog `at`. `scanAgeDays`: days since enrichment.lastScanAt (fresh at 7 days or less).

### 0.5 Loading, empty, error contract (every screen)
- `useDelayedLoading(loading)`: nothing but the frame for the first 150ms, then the skeleton, never empty numbers.
- Every empty state reads from `COPY.empty[key]` (title, description, action, optional secondary). Error states read `COPY.error.<screen>` and render `ErrorState` with a Retry button (`useRetry`).
- Copy addresses Rob. Untitled UI icons only. Reduced motion collapses every pulse and stagger.

---

## 1. Dashboard (`/`, src/pages/AdminDashboard.jsx)

Purpose: "what to do right now, then how the business is going". Everything is computed client side from the leads list, the submissions list and the orders list; the only fetch is `GET /api/admin/settings` for `dashboard.dailyCallTarget` (default 25).

### Layout
- Desktop (1024px and up): two column grid, left `minmax(0,1fr)`, right the panel width (360px at 1280+). Left column order: header, key stats grid, pipeline strip, More stats card, Recent activity card. Right column: the Today card. Content max width 1160px.
- Phone: one column: header, Today card, key stats, pipeline strip, More stats, Recent activity. Header buttons flex to 45% each.
- No top bar title (`useTopBar(null)`).

### Header
- Greeting `h2.db-greet`, display font, uppercase: "Good morning, Rob." before 12:00, "Good afternoon, Rob." before 17:00, else "Good evening, Rob." The first name comes from `shell.profile.name` (default Rob).
- Context line: `"{Weekday, Month day}. {context}"` where context is, in priority order: `COPY.success.targetHit` "Target hit. Nice." when the ring is at 100%; "{n} callback(s) due" when callbacks > 0; "{n} meeting(s) today"; "{n} new lead(s) since yesterday"; "Outside business hours. Plan tomorrow or prep concepts." when outside `profile.businessHours` (start/end "HH:MM"); else "Queue is clear. Good day to dial."
- Buttons: primary "Start call session" (PhoneCall01) goes to calls; secondary "Add lead" (Plus) calls `shell.newLead({})`.

### Today card (Section "Today", description "{callsToday} of {target} calls", action ghost button "Open calendar")
- ProgressRing (88px, thickness 8) value = min(100, round(callsToday / target * 100)), tone booked when 100 else won, label "Calls today against target", center shows callsToday. When the ring crosses 100 during the session it pulses once (`is-hit`, keyframes db-ring-pop and db-ring-glow) for 2x `--v-dur-slow`.
- "DAILY TARGET" label with an InlineEdit (type number, formatted "{n} calls", aria label "Daily call target"). Saving PATCHes `/api/admin/settings` with `{ set: { dailyCallTarget: n } }`, clamped 1 to 500, optimistic with rollback.
- Sub line: "Target hit. Keep the streak." or "{target - callsToday} to go".
- Rows (ListRow with IconTile, title, detail, relative time meta, tap opens the record): built from `buildNotifications(leads, { projects })`: all callback items (danger tone first, then by time), then meetings grouped today, then the first 5 new leads. Empty: "All caught up" / "No callbacks, meetings, or new leads waiting. Start a call session." action "Start call session". The row count is remembered in localStorage `vz_dash_today` so the skeleton draws that many rows (capped 12, default 3).

### Key stats (four StatCards, `Grid minColumnWidth 120`)
1. "Calls today" (PhoneCall01, progress) opens calls.
2. "Callbacks pending" (PhoneIncoming01, callback) opens calls with preset `{ status: ['callback'] }`.
3. "Booked" (CalendarCheck01, booked) opens Booked.
4. "New leads 48h" (Zap, new) opens Leads with an empty filter preset.

### Pipeline strip (role group "Pipeline", four interactive cards, horizontally scrollable on phones with the first card sticky)
Leads (neutral) to /leads; Contacted (progress) to /leads with status preset ['callback','no-answer','no']; Booked (booked) to /booked; Clients (won) to /clients. Cards 2 to 4 carry a pct pill "Conversion from the previous step" = round(step / previous step * 100) + "%". Formula (`pipelineFunnel`): for every non-lost record: leads++; contacted++ when callLog non-empty or callStatus not not-called; booked++ when stage booked, won or client; clients++ when stage won or client.

### More stats (Card with a 44px toggle button "More stats", summary "Calls this week and month, connect rate, not yet called, revenue" or "Hide", Collapsible body)
- StatCards: "Calls this week" with trend "+N vs last week" (direction up/down/flat), "Calls this month" with "vs last month", "Not yet called" (Users01, new; opens Leads with status ['not-called']), "Connect rate this month" ("n/a" when no calls; trend "+N pts vs last month").
- Section "Revenue" (description "{retainerClients} of {clients} client(s) on retainer" when any): "Money made all time", "This month", "Monthly recurring", "Clients on retainer" ("{r} of {c}"), all open Clients.

### Computation (`computeDashboard(leads, subs, orders)`)
- Periods: day start, week start Monday, last week, month start, last month.
- For each lead: every `callLog` entry bumps callsToday/Week/LastWeek/Month/LastMonth; month entries count toward connect rate (connected = outcome not no-answer); contactLog entries of type call or meeting also bump the call counters. notCalled = stage lead and callStatus not-called. booked = stage booked. callbacks = callStatus callback and stage not lost. newLeads48h = created within 2 days. revenue = sum of purchases.amount; revenueMonth = purchases whose `at` (date-only strings parse as local days) is in this month. clients = stage client; retainerClients and mrr from `retainer.status` in active or ending.
- connectRate = round(connected / logMonth * 100) or null.

### Recent activity (Section "Recent activity", action ghost "Open submissions" with ArrowUpRight)
- Feed of up to 20 events newest first: call ("Called {business}", detail note, trailing outcome Pill), purchase ("{business} paid $X", detail label or "Purchase recorded"), won ("{business} said yes" / "Lead won"), client ("{business} became a client" / "First invoice paid"), lead ("New lead: {business}" / "{industry}, {area}" or "Added by hand"), scraper (consecutive scraper inserts within 12h collapse to "{n} new leads added overnight" / "From the nightly scraper"), submission ("Brief from {business|name|the site}" / "Submission received"; shop-order and review submissions are excluded), order ("Order from {customer|a walk in}" / "{n} item(s), from the shop"). Tap opens the record, the submission, or the order.
- Empty: "Nothing yet" / "Calls, briefs, wins, and orders show up here the moment they land." action "Start call session".

### States
- Skeleton: greeting text lines (3 lines at 1280+, 1 below), two button blocks 164x44 and 112x44, four StatCard skeletons, four funnel card skeletons (92px), a More stats stub, the Today card with ring circle 88 and N rows, an activity card with 5 rows.
- Error (leads failed and none loaded): "Could not load your leads" / "The call_leads list did not come back. Try again; nothing was changed." with Retry.

---

## 2. Leads (`/leads`, src/pages/AdminLeads.jsx)

Purpose: the open-lead pool (stage lead only, `openLeads()`), as a kanban by call status or a table/list, with filters, saved views, bulk actions, duplicate merging, import, CSV export, and the lead record.

### Layout
- List screen: PageShell > ScrollArea (max width 1400px). Section "Leads" with description "{n} lead(s), {toCall} to call"; actions: SegmentedControl "View" with Kanban (Columns03) and List (Rows01), secondary "Import" (Upload01), primary "Add lead" (Plus). Below: search Input (placeholder "Search business, contact, phone, industry", clear X button) and on phones a "Select"/"Done" toggle button.
- Default mode: kanban on desktop (`DESKTOP_QUERY`), list on phone; the choice persists in localStorage `vz_leads_view`.
- Detail open: desktop split. Left `aside.aa-panel` "Leads" holds a compact search ("Search leads"), "{sorted} of {pool}" and up to 80 compact LeadCards (selected one highlighted); right `.aa-main` holds LeadDetail (or the New lead form in a Card, Section "New lead"). On a phone the detail is full screen (`has-detail` hides the panel); the top bar shows the business name (or "New lead") with a back arrow.
- Deep link while loading (`openId` and still loading): panel shows 4 compact card skeletons, main shows `LeadDetail.Skeleton`.

### Saved views (row of Chips above the filters)
- Defaults written to localStorage `vz_leads_views` on first run: "To call" (status not-called, sort priority asc), "Callbacks" (status callback, sort lastCall desc), "Hot leads" (prio hot, sort added desc). A view is active when its filters and search match the current ones exactly.
- Each view chip has a Menu "{name} view": Rename (window.prompt "View name"), "Update with current filters", divider, "Delete view" (danger).
- "Save view" ghost button opens Modal "Save view" / "Current filters, search, and sort under a name." with Input "Name" (placeholder "Warm bakeries"), Enter saves.

### Filter rows (label 72px uppercase, chips with counts; chips scroll horizontally on phones, wrap at 768+)
- Status: Not called, Callback, No answer, Said no (booked leaves the board). Priority: Hot, Warm, Cold. Industry: top 8 facets by count, plus "More (n)" chip opening a Popover of Checkboxes "{label} ({count})". Data: "Has phone", "Has socials", "Never scanned", "Possible duplicates".
- Counts are cross counts: a chip's number is the leads passing every OTHER group (and the search) that also match that value (`countFor`). Multiple values within a group are OR; Data values are AND.
- Search (`matchesSearch`): digits-only input matches the last 10 digits of the phone; otherwise a lowercase substring over business, askFor, industry, descriptor.
- Summary line when any filter is on: "{n} of {pool} match {k} filter(s) and "{q}". Clear all".

### Kanban (desktop default; also available on phones as horizontally snapping 88vw columns)
- One column per BOARD_STATUS. Header: status Pill, count, Menu "{status} column" with "Start session with these" (goes to calls with `{ status: [id], prio: filters.prio }`) and "Collapse column" (collapsed column is a 56px vertical strip button "Expand {status}").
- 30 cards per column (PAGE), then a ghost button "Show more ({n} left)". Empty column: "Nothing waiting here" / "Leads land in this column as their status changes."
- Drag: HTML5 drag on desktop; on touch a 450ms long press lifts the card into a fixed ghost (`.ld-ghost`, rotated 1 degree) and drop is resolved with `elementFromPoint` on `[data-col]`. Drop PATCHes `{ callStatus }`; failure toasts "Could not move the lead. It went back."
- Keyboard: Shift+ArrowLeft / Shift+ArrowRight on a focused card's open button moves it one column with an info toast "{business} moved to {label}."
- Card actions (menu): priority, status, delete (opens the bulk confirm with that one lead checked).

### Table (desktop list mode) and mobile list
- Table columns: Business (always visible, sortable, width 260, avatar + name + "New" pill), Industry, Priority (sortable), Status (sortable), Phone (tel link), Socials (text links "website / instagram / facebook / maps"), Last call (date + outcome pill, sortable desc default), Calls (count, right aligned), Scanned (relative, or "never"), Added (relative). Column chooser persists hidden columns in `vz_leads_cols`. Row click opens; row actions Menu = `leadMenuItems`. Selectable rows feed the bulk bar. Density md, pageSize 80.
- Mobile list: Select "Sort" with SORTS ("Added, newest first", "Business A to Z", "Priority, hot first", "Status", "Last call, newest first", "Most calls", "Scanned, newest first"), then a Stagger of LeadCards, 30 per page with "Show more ({n} left)".

### Duplicates
- `findDuplicates`: union-find over same last-10 phone, or same normalized name (lowercase, punctuation stripped, stop words the/llc/inc removed) within the same industry key. Choosing the "Possible duplicates" Data chip switches the body to one Card per group, header "SAME PHONE" or "SAME NAME AND INDUSTRY" plus a "Merge" button (GitMerge).
- MergeModal "Merge duplicates": description "Same phone number." or "Same business name and industry." followed by "The winner keeps its record; calls, contacts, purchases, and notes from both are combined." Radio pick of the winner (each shows avatar, name, "{phone or no phone}, {n} call(s), added {date}", the winner has a "Keeps its id" pill). Conflicting fields (Phone, Contact, Descriptor, Priority, Socials) each get a two-way radio; otherwise "No conflicting fields. Everything from {loser} folds into {winner}." Footer: Cancel, "Merge into {winner}".
- `doMerge`: PATCH winner with `mergePayload` (chosen fields, callLog and contactLog unioned and deduped and sorted, purchases deduped, notes joined with "[Merged from {loser} on {date}]", socials merged); PATCH loser `{ mergedInto }`; `DELETE ?ids={loser}&reason=merged`; toast "Merged {loser} into {winner}." then refetch. Failure copy: "Merge failed before anything changed." or "{winner} was updated, but {loser} could not be removed. Delete it by hand."
- Empty dupes: "No duplicates found" / "No two leads share a phone number or a business name in the same industry." action "Back to all leads".

### Bulk bar (StickyFooterBar when any card is checked)
"{n} selected, {b} protected"; Menu "Priority" (bulk PATCH priority, toast "{n} lead(s) set to hot." or "{bad} of {n} could not be set to hot. Those were undone."); Menu "Status" ("marked callback"); "Add to session" (goes to calls with `{ ids }`); "Export CSV" (columns Business, Industry, Priority, Status, Phone, Contact, Area, Website, Last call, Calls, Added; file `leads-YYYY-MM-DD.csv`; exports the checked leads or the whole sorted list); "Delete {n}" (danger, disabled when none deletable); "Clear".
- ConfirmDialog "Delete {n} lead(s)?" body "They move to Recently deleted in Settings and can be restored for 30 days. {b} protected lead(s) with call history will be skipped." Confirm "Delete". Success: undo toast for 6 seconds "Deleted {n} lead(s), skipped {b} protected." whose undo calls restore; failure "Delete failed. Nothing was removed."

### Create
"Add lead" opens the New lead form (LeadForm creating). Save calls `onCreate(defaultLead(values))` (POST). Failure toast "Could not create that. Nothing was saved." A `createPreset.preset.phone` (from the command bar's "new lead from a number") prefills the phone.

### States
- Skeleton: the chrome is real and disabled (view chips, static Status and Priority chips, three 120x44 pill blocks for Industry, Data chips), then board columns with 3 card skeletons each (2 columns on phones), or `Table.Skeleton rows 10 cols 7`, or 5 card skeletons under a sort skeleton.
- Empty pool: "No open leads" / "Add one, import a spreadsheet, or check Booked and Clients. Everyone might just be further down the pipeline." action "Add lead", secondary "Import spreadsheet". Filter empty: "Nothing matches" / "Loosen a filter or clear the search." action "Clear all". Error: COPY.error.leads with Retry.

---

## 3. The lead record (src/components/LeadDetail.jsx, DetailFold.jsx)

One component for Leads, Booked and Clients. Props: lead, submissions, onPatch, onDelete, onLinkSubmission, onClose, readOnly, client (client mode object). `normalizeLead` runs on entry. Top bar: title = business, back = onClose. `stage = normalizeStage(lead)`; `booked = stage in booked, won, client` (and not client mode); the default open section is `projects` in client mode, `meeting` when booked, else `overview`.

### Layout
- Desktop (1024+): `.dt-cols` grid: left column (panel width + 40px, sticky) = profile card; right column = sticky subnav Tabs then the sections in a Stagger.
- Phone: profile card, then subnav, then sections, one scroll.
- Booked stage and not readOnly: a StickyFooterBar outcome bar at the bottom.

### Profile card (`.dt-profile`; pulses `v-pulse-won` on a won conversion)
1. Avatar (lg; status dot "booked" for a client), `h2` business name, InlineEdit descriptor (placeholder "Add a one-line descriptor").
2. Pill row: "New" (solid, when created under 48h), stage Pill (outline), priority Pill as a Menu trigger ("Change priority": Hot/Warm/Cold, PATCH `{ priority }`), call status Pill (or in client mode a clientStatus Menu: Active/Paused/Delivered, PATCH `{ clientStatus }`), industry InlineEdit shown as a pill (placeholder "Add industry", display Title Case).
3. Action icon row (7 IconButtons, 44px, aria label "Actions"): Phone ("Call (302) 555-1212" or "Add a phone to call" which opens the Add modal), MessageCircle01 Text (`sms:`), Mail01 Email (`mailto:`), Instagram (Camera01), Facebook (ThumbsUp), Website (Globe01), Maps (MarkerPin01) each opening the URL or "Add {label}", Copy01 "Copy phone" (toast "Number copied."). The "Add {label}" Modal has one Input (placeholder "Handle or URL" for socials) and Save writes `{ [key]: v }` or `{ socials: {...socials, [key]: v} }`.
4. Button row: primary "Start call" (PhoneCall01; disabled without a phone; `shell.go('calls', { ids: [lead._id], autostart: true })`), secondary "Edit all" (Edit02; opens the Edit lead Sheet with LeadForm, width 640, tall), ghost "Open client record" (a client opened outside Clients), and in client mode "Showcase" (Image01; pill "Published" solid booked or "Draft" soft neutral, no pill when no showcase record) and "Planner" (Calendar; pill "Off", "{n} in review" (new tone) or "On" (solid booked)). "Concepts" (LayersThree01) shows on EVERY record with a pill for the newest concept set's status (Draft, Sent, Viewed, Changes requested, Approved, Archived; "None" when there is no set); it opens `/leads/:id/concepts`.
5. Suggestion banner (role status) when booked, a concept set is approved and no outcome recorded: "They approved Direction A. Mark as won?" with a "Mark as won" button opening the won confirm.
6. Facts list (`.dt-fact`, 96px label column, 44px rows, InlineEdit values): Phone (inputMode tel, "Add phone"), Contact ("Who to ask for", field askFor), Phone note ("Front desk, extension"), Best window ("Before 8am or after 5pm"), Email, [client mode: Since (clientSince or bookedOutcome.at), Lifetime ($ lifetimeValue)], Source ("Nightly scraper" when sourceId else "Added by hand", read only), Added (date, read only), Last scanned ("{relative}, {n} scan(s)" or "Never", read only), Callback due (a button: fmtDateTime(callbackAt) or "Set a time"; opens CallbackPicker; save PATCHes `{ callbackAt }` with toast "Callback set for {datetime}." or "Callback cleared.").

### Subnav tabs
Lead: Overview, Playbook, [Meeting when booked], Notes, History (count = callLog + contactLog). Client mode: Overview, Projects (count of open non-retainer projects), Payments, Retainer, Deliverables, Notes, History. Tapping a tab opens that fold and smooth scrolls to it. A tab can pulse (retainer after a retainer starts).

### Folds (FoldSection: kit Section with a chevron IconButton "Collapse {title}" / "Expand {title}", the one-line summary shown as the description while closed). Order:
1. **Overview**: summary = first line of the angle or "The angle". Card "The angle" with a multiline InlineEdit (placeholder "Why this lead, in your words.", writes `{ angle }`).
2. **Playbook** (not in client mode): summary "Intel, before you dial, script, objections, and the close"; description "Every line edits in place. Return to the ask after every objection." Contents: IntelCards (three Card level 2 with glow: Accomplishments (booked), Gaps (danger), "Drop these on the call" (callback), each a ListEditor writing `{ intel }`); Card "Before you dial" ListEditor writing `{ beforeYouDial }` (placeholder "Add a pre-dial check"); Card "Script" ScriptSteps writing `{ script }`; Card "Objections" writing `{ objections }`; Card "Close" writing `{ close }`. ListEditor = InlineEdit rows with a Menu (Move up, Move down, Remove) and drag reorder on pointer devices, plus an Input + Plus button.
   - ScriptSteps: an ordered list of six steps with number, title, hint: 1 Opener "Confirm you have the right person" (script.confirm), 2 Intro "Who you are, buy ten seconds" (intro), 3 Homework "Show you looked" (homework), 4 The question "Then stop talking" (question, plus the likelyAnswers table: "They say" / "You respond" rows, remove button, "Add a likely answer"), 5 Value "The hook" (hook), 6 Ask "Two options, always" (ask). Read-only mode hides empty steps; empty copy "No script yet" / "Add the opener, value, and ask on the lead."
   - Objections: rows of say/respond; read only they are disclosure buttons with ChevronDown; edit mode shows both InlineEdits and a remove button plus "Add an objection". Empty: "No objections listed" / "Return to the ask after every one."
   - CloseCards: "Lock it" (booked glow, close.lockIt), "If it is a no" (danger, ifNo), "No answer" (new, noAnswer). Empty: "No close lines yet".
   - Intel empty: "No intel yet" / "The nightly scan fills this in when it finds something."
3. **Meeting** (booked only): summary "{today|tomorrow|in 3 days|2 days ago}, {Mon d, h:mm}, {type}" or "{afterCall.meeting} (no date set)" for legacy records or "No date set". Header action: **Call mode** Toggle (sm, persisted per lead in localStorage `vz_callmode_{id}`); when on, the description reads "Call mode: every block shows its one line." and every Block collapses to its summary. Blocks (Card with a toggle button, summary while closed):
   - **When**: summary as above; actions "Reschedule" or "Set date" (Calendar icon) opening RescheduleSheet, and an IconButton Download01 "Add to calendar (.ics)" when dated (client-side VCALENDAR: "Meeting: {business}", 30 minutes, description with Ask for, Phone, Where, descriptor; file `{business-slug}.ics`; error toast "Set a date first."). Body: countdown Pill (booked tone when today) + datetime + type Pill, or "No date yet." / "Logged as "{afterCall.meeting}". Set the date to get a countdown and a calendar file."; Fact "Where or link" (placeholder "Zoom link, cafe, their shop", writes `meeting.location`). Every meeting write spreads `{ date: '', time: '', type: 'call', location: '', ...lead.meeting, ...m }`.
   - RescheduleSheet: title "Reschedule" or "Set the meeting"; Date, Time (default 09:00), Select Type (Call/Video/In person), "Where or link"; Save disabled without a date; toast "Meeting updated."
   - **Services game plan**: summary "{n} planned". One Checkbox per MEETING_SERVICE: the seven PACKAGES ("Social Refresh ($150)", "Brand Starter ($350)", "Web Essentials ($500)", "Brand Complete ($600)", "Web Complete ($750)", "Launch Plan ($1,200)", "Build Plan ($1,800)") and the four retainers ("Site Care retainer ($100)", "Content Kit retainer ($250)", "Ad Creatives retainer ($350)", "Growth retainer ($500)"); a checked row reveals an InlineEdit "Note for the meeting". Writes `{ gamePlan: [{serviceId, checked, note}] }`.
   - **Pricing options**: summary "{n} option(s), one recommended" or "None yet"; action ghost "Add option" (Plus) while under 3 options (a new option defaults to PACKAGES[2] Web Essentials with its default retainer and is recommended if first). Each option is a Card level 2 ("Option {i}", "Recommended" pill with Star01 and won glow): Select Package "{label} (${price})", the package's included lines, Add-ons checkboxes ("Business card design (free)" when gifted, else "(${price})"; ADDONS: card-design $30 free with any, cards-250 $35, cards-500 $50, nfc-card $25 free with Launch and Build plans, stickers $40, vinyl $60, rush $20), Select Retainer "{label} (${price} a month)" (default Site Care for web packages, Content Kit otherwise), total block: "$X", plan line "$1,200 as $200 a month for 6 months, first payment starts the project (or $150 a month for 12)" (packages carry their own plan; otherwise totals over $750 split into 6 months, 12 when 1500 or more), "Free: {gifts}", "Retainer: {label}, ${price} a month"; multiline InlineEdit "Add a note"; Toggle "Recommended" (only one can be on) and a danger IconButton "Remove option". Write: `{ pricingOptions }` capped to 3 with derived legacy fields. Empty: "No pricing options yet" / "Build up to three from the packages. Anything over $750 shows its payment plan." action "Add option". Old free-text options migrate on read into a note.
   - **Prep notes**: summary first line or "Empty"; LeadNotes bound to `prepNotes` (placeholder "What to show, what to ask, what to avoid.").
4. **Client sections** (client mode only, ClientWorkspace: Projects, Payments, Retainer, Deliverables; out of this slice).
5. **Notes**: summary first line of notes or "Notes and checklists". Card with LeadNotes (`notes`) and Card "Checklists" (Checklists component).
6. **History**: summary "{n} entries". Card LeadHistory; Card "Their site submissions" LinkedSubmissions.

### Outcome bar and flow (stage booked, not readOnly; StickyFooterBar with three buttons that flex to 140px)
- "Mark as won" (Trophy01, primary), "Mark as lost" (XClose, danger), "Reschedule" (Calendar, secondary).
- Modal: "Mark {business} as won?" / "They become a client now, with everything here kept." or "Mark {business} as lost?" (danger) / "They leave Booked. Undo is available for six seconds." Textarea "Note (optional)" with placeholders "Went with Web Complete plus Site Care." / "Chose their nephew." Buttons Cancel and "Won, convert to client" / "Mark lost".
- Won: PATCH `{ stage: 'client', clientSince: now, bookedOutcome: { result: 'won', reason, at } }`; the profile pulses won for 2x slow duration, toast "{business} is a client." with action "Open in Clients", then the detail closes.
- Lost: PATCH `{ stage: 'lost', bookedOutcome: { result: 'lost', reason, at } }`; undo toast "{business} marked lost." for 6 seconds; undo PATCHes `{ stage: prevStage || 'booked', bookedOutcome: { result: 'lost', reason: '', at: '' } }`; detail closes.
- Note the guard: a client or won record leaving its stage needs `explicit: true`; these dialogs are the only path that sends it.

### Edit and delete
"Edit all" Sheet "Edit lead" / business; LeadForm save PATCHes the form values; Delete (in the form) confirms "Delete {business}?" / "It moves to Recently deleted in Settings and can be restored for 30 days." then `onDelete(id)`; Leads toasts "Delete failed. Nothing was removed." on failure.

### LeadDetail.Skeleton
Profile: 56px circle, 70% x 34 name, 50% x 44 descriptor, four pill blocks (64, 56, 72, 88 x 22), seven 44x44 squares, 128x44 and 96x44 buttons, ten fact rows. Section column: tabs strip (four 72x16), a 120x16 label, five cards of heights 292, 106, 106, 110, 162.

---

## 4. LeadCard (src/components/LeadCard.jsx; styles src/ui/leadCard.styles.js)

Used by the kanban, the mobile list, the Booked list, the Console queue, the panel lists and the drag ghost. Memoized on lead identity and flags.
- One real control: a stretched button `.v-stretch.lc-open` "Open {business}" over the whole surface; the checkbox, phone link and menu sit above it (`.v-above`) so nothing nests in a button. Shift+ArrowLeft/Right on that button steps status when `actions.onStatusStep` exists.
- Optional Checkbox "Select {business}" top left (visible in select mode, on hover on desktop; row 1 gets 30px left padding).
- Row 1: Avatar sm, business name (truncated), "New" solid pill when under 48h, priority Pill.
- Row 2: industry Pill (outline, Title Case) and the descriptor, or the area when no descriptor.
- Row 3: phone as a `tel:` link "(302) 555-1212" (aria "Call ...") or "No phone"; a socials indicator group (role img, aria "Socials: Website, Instagram" or "Socials: none") with four 13px glyphs Globe01, Camera01, ThumbsUp, MarkerPin01, dimmed to 35% when missing; spacer; call status Pill.
- Row 4 (hidden when `compact`): "Touched {3d ago}" when any call or contact; "Next: call back, {last callback note}" when callStatus callback; scan dot 8px green (fresh, 7 days or less) or amber (stale) with tooltip "Scanned Aug 6, 2026, 3 scans".
- Menu (top right, "Actions for {business}", built by `leadMenuItems`): "Call (302) 555-1212"; divider; "Priority: Hot/Warm/Cold" (current disabled and suffixed "(current)"); divider; "Status: Not called/Callback/No answer/Said no/Wrong number"; divider; "Open socials" (first available URL); divider; "Delete" or disabled "Delete: has call history" (first clause of the block reason, lowercased).
- Skeleton: circle 32 + 55% bar + 44x22 pill; 70x22 pill + 50% bar; 110x44 block + 74x22 pill; optional 90x18 row.
- Drag states: `is-dragging` lift, `draggable` cursor grab.

---

## 5. LeadForm (src/components/LeadForm.jsx) and SocialFields

Grid (min 200px columns): Business (required, autofocus), Contact name (placeholder "Damian"; field askFor), Phone (tel), Phone note ("Front desk, ask for the owner"), Email, Industry ("Landscaping"), Area ("Wilmington DE"), Best window ("Before 8am or after 5pm"; a new lead defaults to "Before 8am or after 5pm."), Select Priority. Then Descriptor (placeholder "Dead site, great reviews.", hint "One line that tells the story at a glance."), Textarea "The angle" (3 rows, "Why this lead, in your words."), "Social links and website" = SocialFields: one Input per channel (Website, Instagram, Facebook, TikTok, Google, Yelp, LinkedIn, X, YouTube) with a leading glyph and placeholder "{Label}, {hint}" (their-site.com, @handle, page name or URL, Maps / Business URL, biz URL, company URL or name). Buttons: "Add lead" or "Save changes" (Check, disabled without a business), "Cancel", and when editing a right-aligned danger "Delete" with the confirm above. Socials are normalized on submit.

`defaultLead(f)` (src/lib/defaultLead.js) fills a new lead: callStatus not-called, three beforeYouDial checks ("Open their socials / site on your phone", "Know cold: what they do, where, and one specific detail to mention", "Listening for: what they care about growing. That becomes the pitch"), the default script (confirm "Hey, is this {who}?", intro "Hey, I'm Rob. I do branding and websites for local businesses here in Delaware...", homework "I came across {business} and did my homework before calling...", question "Quick question before I take up more of your time. Who's handling your website and branding right now?" with three likely answers, hook "So here's how I work. I build concepts before I ever talk numbers...", ask "15 minutes this week? Morning before 8, or evening after 5?"), four default objections ("How much is this?", "We're doing fine", "How old are you?", "Not spending right now"), the close lines, empty afterCall and intel.

---

## 6. Import (src/components/LeadImport.jsx, src/lib/spreadsheet.js, api/_routes/leads-import.js)

Sheet "Upload spreadsheet" (720 wide, tall), three steps.
1. **pick**: dashed drop label "Choose a .csv or .xlsx file" / "Exported from Google Sheets or Excel" (accept .csv, .xlsx, .xls); "OR PASTE CSV" divider; monospace textarea with placeholder `business,phone,instagram\nJoe Plumbing,(302) 555-1212,@joeplumb`; button "Read pasted CSV" ("Reading…" while busy). Parsing uses SheetJS (dynamic import of xlsx), first sheet, header row = row 1 (BOM stripped). Errors: "No header row found in the file.", "The file has no sheets.", "Couldn't read that file: {message}", "Paste some CSV first."
2. **map**: "{fileName} · {n} data row(s)"; count pills "{total} total", "{create} new", "{update} update existing", "{deleted} skip (deleted)", "{invalid} skip (no name)". "COLUMN MAPPING": one select per canonical field (16 fields: ID (task id), Business name*, Owner, Phone, Email, Instagram, Facebook, Website, Google, Area, Industry, Priority, Status, Service interest, Angle, Notes) with "none" plus every header. Auto mapping matches normalized header names and aliases (company/name to business, contact/owner name to owner, tel/mobile to phone, ig/insta, fb, site/url/web, maps/gmb, city/location/region to area, category/trade/niche to industry, note/comments to notes); a remembered mapping by header name (localStorage `vz_import_mapping`) is applied on top. "PREVIEW (FIRST 10)" table: Business ("missing" in red), Phone ("none"), Priority (default warm), Status (default "not called"), Socials (count of instagram/facebook/website/google or "none"). Buttons "Back" and "Import {n} leads" (disabled until Business is mapped; hint "Map the Business name column to continue.").
3. **result**: check badge, "{created} created", "{updated} updated", "{skipped} skipped", the first 50 skipped as "{business}: {reason}", buttons "Import another" and "Done".

Client preview matching (`matchExisting`): by sourceId when the row has an ID, else same lowercase business where phones are absent or equal on last 10 digits. Server (`POST /api/admin/leads/import`, max 5000 rows): same match rule against all records including soft-deleted; a deleted match is skipped "previously deleted, left alone"; a blank business is skipped "missing business name"; a match is updated for only the provided fields (business, askFor, phone, email, area, industry, serviceInterest, angle, notes, descriptor), priority and callStatus are set only when the record is not client or won (the pipeline guard; stage is never touched), socials are merged; a new row is inserted with `rowToFields` (descriptor = industry · area · service interest, priority normalized hot/warm/cold, status text mapped: not called/new to not-called, callback/call back, booked/meeting, no/denied/dead, no answer/voicemail) plus the default script skeleton. A second flow, "Import the notepads", posts the bundled src/data/call-leads-import.json (10 leads) to `POST /api/admin/call-leads` as `{ leads }` from the Console's empty state.

---

## 7. Call Console (`/calls`, src/pages/AdminCalls.jsx, src/lib/calls.js)

Four modes: builder, queue, room, summary. Mobile first; desktop (1024+) shows queue | room | notes and history in three columns (264px / 1fr / 280px; 1440+: panel width / 1fr / 320px). Embedded in the shell (`embedded`), it fetches `GET /api/admin/call-leads` itself and calls `onDataChanged` after every write. The session persists in localStorage `vz_call_session` (`{ ids, idx, stats, logged, startedAt, size, mode }`) so a phone call or reload resumes it; the room tab persists in `vz_call_tab`; session size in `vz_call_size`.

### Builder ("Build your session" kicker, h2 "Who are we dialing?", sub "Pick the kind of leads for this block of calls. Nothing selected in a group means all of them.")
- Pool: stage lead only. Optional "Picked from Leads" section when arriving with ids: chip "{n} selected lead(s)" (tap clears) and hint "Tap to clear and build from filters instead."
- Sections with ChipGroups and cross counts: Priority (Hot, Warm, Cold), Call status (Not called, Callback, No answer, Said no, Wrong number), Industry (top 8 + "More (n)" popover; "All" label when none selected), Best window ("From each lead's best window. Right now picks the window for this hour.": chip "Right now" (Clock) plus Morning (Sunrise), Midday (Sun), Afternoon (Sun), Evening (Sunset); `windowsOf(bestWindow)` parses free text like "Before 8am or after 5pm" into morning and evening, hour ranges like "2 to 4pm", empty text means any window, unknown text means midday).
- Options: chip "Include leads without a phone" (count of phoneless); Select Order ("Best window first", "Priority", "Oldest untouched", "Newest"; "Right now" forces window order); SegmentedControl "Session size" 10 / 25 / 50 / All.
- Preview Card (role status): big number "{n}" then "lead(s) in this session of {callable} matching, {k} skipped for no phone".
- StickyFooterBar: "Start call session" (Play, lg, full) with a Badge count. Starting builds `ids`, stats zero, `startedAt`; desktop goes to the room, phone to the queue. Preset `autostart` (from a record's "Start call") starts a one-lead session straight in the room once leads load.
- Empty pool: "No leads to dial" / "Add leads on the Leads page or import the notepads." action "Import the notepads (10)" and secondary "Add a lead" (opens the New lead Sheet). Error: "Could not load the console" / "The leads for this session did not come back. Try again."
- Skeleton: real section titles, pill-shaped chip blocks sized like the usual set, two 68px option blocks, a 91px preview card.

### Queue (phone: its own screen titled "Session" with back to the builder; desktop: the left column)
- Section "Session" with description "{left} left of {total}", a booked-tone ProgressBar, and a Menu "Session": "Pause and come back later" (ClockRewind, goes to the dashboard; the session stays in localStorage), "End session" (Check, goes to the summary), divider, "Discard and start over" (Trash01, danger).
- One compact LeadCard per id; the current is selected; the next unlogged one has a red border and a "NEXT" tag; logged ones fade to 55% with a solid outcome pill in the corner. Tap opens the room at that index. Swipe right opens it; swipe left skips it to the end.
- Phone footer: "Open the first lead" or "Next lead" (PhoneCall01, lg).

### Room (one lead; phone top bar shows the business and a running clock "Name  3:12" while a call runs, back to the queue; desktop title "Call Console")
- RoomHeader Card (won glow for hot leads; pulses in the outcome's tone after a log, booked adds a green ring): optional alert "Check the notes before dialing." when notes or phoneNote match /DO NOT|DISQUALIF|WARNING|never dial/i; Avatar lg, h2 business; pills: industry, priority, call status, best window (booked tone with a Check when the current hour is inside it); IconButton Edit02 "Edit lead" (Sheet with LeadForm; save PATCHes, delete soft deletes and removes from the session); descriptor line; "Ask for **{askFor}**"; social ghost buttons Website (Globe01), Instagram (Image01), Facebook (Users01), Maps (MarkerPin01) plus the scan dot with tooltip; the big phone button "(302) 555-1212" (`tel:` link, lg, full; tapping starts the call timer which ticks every second and shows inline "0:42") and on desktop a Copy01 "Copy number" IconButton (toast "Number copied."); or a danger box "No phone on file. Find the number first."; the phoneNote centered under it.
- "Before you dial" Card: one Checkbox per `beforeYouDial` line, checked state is per-lead session memory only (not written).
- RoomBody Tabs "Playbook": Script, Objections (count), Close, Intel; on phones also Notes and History (count). Read-only playbook pieces (empty steps hidden). Desktop right column: Section "Notes" (LeadNotes writing `{ notes }`) and Section "History" (LeadHistory).
- Swipe left/right on the room advances or goes back.

### Outcome bar (StickyFooterBar, five equal buttons max 760px wide, then a second row)
Booked (primary), Callback, No answer, Said no, Wrong number (secondary, colored by the status text tone; desktop shows the key hint 1 to 5); row 2: ghost "Skip" (SkipForward, S), "{position} of {total}", desktop IconButton Keyboard01 "Keyboard shortcuts". Disabled while a sheet is open.
- Double tap within 2 seconds on No answer, Said no or Wrong number logs immediately without the sheet.

### Outcome sheet (one component, titles: "Booked a meeting", "Call them back", "No answer", "Said no", "Wrong number"; description = business)
- Booked: Meeting date, Time, Select Type (Call/Video/In person), "Their email" (placeholder owner@business.com, prefilled from email or afterCall.email), "What they said". Button "Book it" (primary).
- Callback: quick chips "In 1 hour", "Tomorrow 10am", "Tomorrow 2pm", "Next Monday" (10am), Date and Time (default now + 1 hour), Note (placeholder "Ask for the owner after 5"). Button "Set callback".
- Others: Note ("Optional, one line"). Hints: wrong number "The phone note gets stamped "Wrong number (Aug 6, 2026)". Nothing else changes."; said no "A no removes them from the console and the Leads list. Undo for six seconds, then 30 days in Recently deleted." Button "Log".

### Logging (`applyLog`, optimistic with rollback and undo)
- Entry `{ at, outcome, note, meeting: "YYYY-MM-DD HH:MM" (booked), email (booked) }` appended to `callLog`; `set = { callStatus: outcome, callLog }`.
- Booked also sets `stage: 'booked'`, `meeting: { date, time, type }` and `afterCall: { ...afterCall, meeting, email }`.
- Callback sets `callbackAt` (ISO or ''). Wrong number sets `phoneNote: "Wrong number ({date})"`.
- Session stats increment `calls` and the outcome key (booked, callbacks, no, noAnswer, wrongNumber); `logged[id] = outcome`.
- PATCH; on failure everything rolls back and toasts COPY.error.save. On success: header pulse, and for Said no the lead is removed from the list and soft deleted (`DELETE ?id=`). An undo toast "{Label}: {business}" (6 seconds) restores the deleted record (PATCH restore) and PATCHes back callStatus, callLog, stage, callbackAt, phoneNote, meeting, afterCall, then reloads and reinserts the id at the current index ("Undid said no for {business}."). After a beat (slow duration + 200ms) the room advances; past the last lead it goes to the summary.

### Keyboard (room only, ignored inside fields): 1 to 5 outcomes, N / Right / Space next, S skip to end, Left previous, Esc back to the queue (phone), ? opens the Modal "Keyboard" listing those plus "Right or Space Next", "Left Previous", "Esc Back to the queue", "? This list".

### Summary (title "Session summary")
Card Section "Session complete" / "{12m|1h 5m} on the phones": ProgressRing "Booked of connects" (booked / connects, center "{booked} of {connects}"), six stat tiles Calls, Connects, Booked, Callbacks, Said no, Wrong number (connects = calls minus no answer minus wrong number), the win line Card "Made 25 calls today, 9 picked up, 2 booked." with "Copy win line" (toast "Copied the win line."). Card "Booked this session" lists booked leads (avatar with booked dot, "{date} {time}" or "Meeting set", tap opens the record). Buttons "New session" (Play) and "Back to dashboard".
- Room empty (all logged): "Nothing left in this session" / "Every lead in this block has an outcome." action "See the summary".
- Skeletons exist for the queue (progress bar + 5 compact cards), the room (header at its real minimum, predial card, tabs and two text cards) and the summary.

---

## 8. Booked (`/booked`, src/pages/AdminBooked.jsx)

Purpose: every lead at stage booked, sorted by meeting date ascending (dated first, undated by updatedAt desc), with the shared LeadDetail in booked mode.
- Section "Booked" with description "{n} booked, {w} this week". Filter chips with counts: All, This week (meeting within the last day to +7 days), Upcoming (future), No date set, Needs concepts (no concept set or newest set still draft), Awaiting outcome (meeting in the past and no bookedOutcome.at).
- List: each item is a compact LeadCard with a joined MeetingLine strip under it: countdown Pill (CalendarCheck01, booked tone when "today") plus "{Mon d, h:mm}", or a "No date set" outline pill (new tone); meeting type pill; concepts pill "Concepts {sent|viewed|changes requested|approved|draft}" (solid for changes and approved).
- Detail: desktop (1280+) split with the list in the left panel (header "{n} BOOKED", compact cards); between 1024 and 1279 the panel narrows to a 232px rail; phones go full screen. LeadDetail opens on the Meeting fold with the outcome bar.
- Skeleton: four compact card skeletons each with a strip (64x22 pill, 120x14 text). Empty: "No booked leads yet" / "Book one from the Call Console. A booked outcome lands it here for meeting prep." action "Open Call Console" (PhoneOutgoing01). Filter empty: "Nothing booked in this filter" / "Every booked lead is under All." action "Show all". Error: COPY.error.leads.
- Writes: only through LeadDetail (`onPatch`), plus `onLinkSubmission`.

---

## 9. Calendar (`/calendar`, src/pages/AdminCalendar.jsx, src/lib/events.js)

One event source, `buildEvents(leads, calendlyEvents, now, projects, posts)`, returning `{ id, kind, at, end, title, subtitle, tone, leadId, lead, link, source, overdue, allDay }`:
- meeting: for stage booked/won/client with `meeting.date`: "Meeting: {business}", 45 minutes, subtitle "{Call|Video|In person}, {location}, ask for {askFor}", tone booked.
- callback: for callStatus callback: at = callbackAt, else the last callback log's `at`, else updatedAt; 15 minutes; overdue when callbackAt is past (or, undated, not today); title "Callback: {business}" or "Overdue callback: {business}", subtitle the last callback note or "Best window {bestWindow}" or "They asked you to call back."; tone callback or danger.
- scraper: all-day "{n} new lead(s) from the scraper" / "Overnight batch" per creation day of sourceId leads (tone new).
- bill: retainer bill dates (next three) "Bill {business} $X", all day, tone won. planfinal: a payment plan's final month, all day. post: Content Planner posts "{business}: {post label}", 30 minutes.
- calendly: from `GET /api/admin/calendly/events` (`{ configured, events[{ uri, at, end, name, email, phone, eventType, join }] }`, cached 5 minutes, `configured: false` without CALENDLY_TOKEN); matched to a lead by calendlyEventUri, then phone, then email, then normalized name against business or askFor; title "Meeting: {business}" when matched else "Calendly: {name|booking}"; subtitle "{eventType}, {email}, {phone}"; tone booked when matched else neutral; `link` = join URL.

### Layout and controls
- Section title = "Wednesday, September 30" (day) or "September 2026" (week and month); description "{n} event(s)" in day view. Actions: ChevronLeft "Previous", "Today", ChevronRight "Next"; SegmentedControl "View" Day / Week / Month (default day on phones, week on desktop; persisted `vz_cal_view`); primary "Callback" (Plus) opens the add flow at 9am on the cursor day.
- Kind filter chips with counts: Meetings, Callbacks, Calendly (disabled with hint "Calendly is not connected (Settings)." when unconfigured), New leads, Bills, Posts (Final payments ride with Bills). Multiple chips OR together; none selected shows all.
- Keyboard: Left/Right previous and next period, T today, D/W/M views (ignored in fields and while a popover or sheet is open). The clock refreshes every minute.

### Day view
A 7-day strip (Mon to Sun buttons with weekday, day number and up to three tone dots; swipe changes the week), an "Overdue callbacks" danger Card listing up to 5 overdue callbacks from other days, then the day's EventRows (overdue first). EventRow: IconTile by kind (PhoneIncoming01 callback, Users01 scraper, CurrencyDollar bill, CreditCard01 planfinal, else CalendarCheck01; glow when overdue), title, subtitle, meta "All day" or "9:00 AM", a Menu "Event actions": "Open lead" or "Link to lead", "Reschedule" (meeting or callback), "Mark done (log no answer)" (callback), "Join link". Tap opens the lead (a post opens the planner month). Empty: "Nothing scheduled" / "A clear day. Book something or set a callback." action "Start call session", secondary "Add a callback".

### Week view
Grid role, header row with a 40px time gutter and seven day buttons ("Mon **30**"; tapping switches to that day) with all-day Pills beneath; a scrollable grid from 7am to 9pm at 88px per hour (a 30 minute block is 44px), hour lines, a red "now" line on today, event blocks positioned by time (min height 44px) showing the time and the title without its "Meeting: " / "Callback: " / "Calendly: " prefix, toned by border and background. Clicking empty column space opens the add-callback flow at that hour. Clicking a block opens a Popover: title, "9:00 AM to 9:45 AM, {subtitle}", buttons "Open lead" or "Link to lead", "Reschedule", "Done" (callback).

### Month view
Grid with weekday headers and 6 rows of 7 day buttons (other-month days at 45% opacity, today marked, aria "{date}, {n} events"), each showing up to three pills ("9:00 AM Title" or all-day title) and "+N"; on phones pills become 7px dots. Tapping a day opens it in day view. Week and month show a small "Nothing on the calendar" / "Meetings, callbacks, and Calendly bookings all land here." card when there are no events at all.

### Actions and writes
- Reschedule a callback: CallbackPicker prefilled with the event time; save PATCHes `{ callbackAt, callStatus: 'callback' }` (or `{ callbackAt: '' }` on Clear); toasts "Callback set for {business}." / "Callback cleared." Reschedule a meeting opens the lead record.
- Mark done: PATCH `{ callStatus: 'no-answer', callLog: [...callLog, { at, outcome: 'no-answer', note: 'Marked done from the calendar', meeting: '', email: '' }], callbackAt: '' }`; toast "Logged no answer for {business}."
- Add a callback (no lead chosen): Sheet "Add a callback" / "{Wed, Sep 30, 9:00 AM}" with a lead search (non-lost leads, 12 results, "{phone}" or "No phone"); picking a lead opens CallbackPicker for that slot.
- Link a Calendly event: Sheet "Link to lead" / "{name}, {email}" with search; PATCH `{ calendlyEventUri: ev.uri }` plus, when the lead has no meeting date, `meeting: { date, time, type: 'call', location: join }`; toast "Linked to {business}.". Footer "Create lead" opens Sheet "New lead from Calendly" with LeadForm prefilled (business and askFor = invitee name, email, phone); create POSTs `defaultLead(values)` and toasts "Added {business}."
- Skeletons shaped like each view (strip + 3 rows; the week grid with two 44px blocks per column; the month grid). Error: "Could not load the calendar" / "Meetings and callbacks come from your leads, and those did not load. Try again."

The notifications drawer (bell) uses the same events: groups Overdue, Today, Upcoming (7 days), New leads, System; snoozing a callback item PATCHes `callbackAt` to the snooze time (1h, tomorrow 9am, next Monday 9am); Done marks it read.

---

## 10. Shared record pieces

- **Checklists** (`checklists` field): with none, the whole UI is a secondary "Add checklist" button; naming form has an Input (placeholder "Checklist name, like Onboarding or Launch day") with Check (Create checklist) and X (Cancel). Each list is a Card level 2: name, a "{done}/{total}" outline pill (booked when complete), Trash01 "Delete {name}" (confirm "Delete "{name}"?" / "Its {n} task(s) go with it." when it has tasks), Checkbox rows (done rows strike through, box pops) with an X "Remove task", and an add form (Input "Add a task", Plus "Add task"). Every change PATCHes the whole `checklists` array.
- **CallbackPicker**: Sheet "Callback due" / business; quick chips (In 1 hour, Tomorrow 10am, Tomorrow 2pm, Next Monday), Date and Time inputs (default now + 1 hour; time falls back to 09:00); footer Clear (danger, when a value exists), Cancel, Save; `onSave(isoOrNull)`.
- **LeadPicker**: Sheet "Pick a lead" (480 wide) with search "Search by business, contact, phone" over non-lost leads, clients first then A to Z, 40 rows (avatar, business, "{askFor}, {phone}, {industry}", stage pill). Empty: "No match" / "Try the business name or a phone number."
- **LinkedSubmissions**: submissions with `linkedLeadId === lead._id` newest first, plus suggestions (unlinked submissions with the same email, last-10 phone, or business name) under "LOOKS LIKE THEIRS. LINK IT?" with dashed borders. Rows: type Pill (Brief, Contact, Review, Shop order, Other), business or name, date, a Link or Unlink button (PATCH the submission's `linkedLeadId`), and a disclosure showing Email, Phone (ignoring the legacy dash placeholder), every `fields` entry, and "Your notes". Empty: "No site submissions from them yet" / "When one matches their email, phone, or business name it shows up here to link."
- **LeadNotes**: Textarea (5 rows, placeholder "Notes on this lead.") bound to `notes` or `prepNotes`; saves on blur or Cmd/Ctrl+Enter; live status "Saves when you tap away" / "Saving" / "Saved" (1.5s); rollback and toast on failure.
- **LeadHistory**: callLog and contactLog merged newest first; call rows show the outcome Pill as the title with a note built from "Meeting: {meeting}. Email: {email}. {note}"; contact rows "{Call|Meeting|Email|Text|Contact} logged"; meta "Aug 6, 2:22 PM". Empty: "No calls yet" / "The first outcome you log lands here."
- **SocialLinks**: only `SocialFields` (the edit grid) remains; hand-drawn brand glyphs on the Untitled UI 24 grid.
- **heals.js**: `healItems(records, leads, snoozed)` turns the daily cron's `health.crons.daily.healedRecords` into System drawer items for 7 days: "{business} was restored to Clients" / "The daily check found the stage wiped and put it back." or, past two heals, danger tone "The daily check found the stage wiped for the 3rd time and put it back. Something upstream is still wiping it: check the nightly enricher."
- **RecentClients.jsx** (marketing): Home Scene "Recent clients" with heading, "All clients" link and three ClientCards from the showcase feed; hidden with no work; cards snap horizontally on phones.

---

## 11. Data shape per screen (reads and writes)

| Screen | Reads | Writes (PATCH `set` unless noted) |
|---|---|---|
| Dashboard | stage, callStatus, callLog[].at/.outcome/.note, contactLog[].type/.at, createdAt, sourceId, industry, area, purchases[].amount/.at/.label, retainer.status/.amount, bookedOutcome, clientSince, callbackAt, meeting; submissions and orders lists | settings `dailyCallTarget` (PATCH /api/admin/settings) |
| Leads | everything on the card and table plus enrichment.lastScanAt/scanCount, socials, deleted | `callStatus`, `priority` (single and bulk); merge payload (phone, askFor, descriptor, priority, socials, callLog, contactLog, purchases, notes, mergedInto); POST create; DELETE ids and reason; restore |
| LeadDetail | all core, playbook, meeting, gamePlan, pricingOptions, checklists, callbackAt, notes, prepNotes, showcase.published, planner.enabled, concept sets, submissions | `descriptor, industry, priority, clientStatus, phone, askFor, phoneNote, bestWindow, email, socials, angle, intel, beforeYouDial, script, objections, close, meeting, gamePlan, pricingOptions, prepNotes, notes, checklists, callbackAt, stage + clientSince + bookedOutcome` (explicit), LeadForm fields; submission `linkedLeadId` |
| Call Console | stage lead pool, priority, callStatus, industry, bestWindow, phone, notes, phoneNote, socials, descriptor, askFor, beforeYouDial, script, objections, close, intel, callLog, contactLog, enrichment | `callStatus, callLog, stage, meeting, afterCall, callbackAt, phoneNote, notes`; LeadForm fields; POST create and notepad import; DELETE (said no, form delete); restore on undo |
| Booked | stage, meeting, updatedAt, bookedOutcome.at, concept sets | via LeadDetail |
| Calendar | stage, meeting, callStatus, callbackAt, callLog, bestWindow, askFor, updatedAt, sourceId, createdAt, retainer, calendlyEventUri, projects, posts, Calendly events | `callbackAt, callStatus, callLog` (done), `calendlyEventUri, meeting` (link); POST create from Calendly |

---

## 12. QA walk steps that cover this slice (docs/QA-CHECKLIST.md)
Steps 2 to 15 and 27 to 28: the Dashboard greets by name with the date and context line; funnel, stats and Today are filled with no lingering skeleton; "Start call session" opens the builder with chips and a count on Start; the queue (phone) or room (desktop) opens with the first card; No answer then Log advances to "2 of N"; Callback with a quick time lands on the Calendar and the drawer; Wrong number stamps the phone note with today's date; Booked with a date pulses the header green and moves the lead to Booked; Said no on the last lead leaves with a six second undo toast and the summary appears; Booked lists the meeting date; the booked detail opens on Overview (now Meeting per the code) with the meeting and Pricing options blocks; "Add option" twice shows two option cards with package, total and plan line; "Mark as won" then "Won, convert to client" pulses red, closes the detail and ticks the Clients badge; the Calendar day view shows today's meetings and callbacks; the bell lists today's items. Also `node scripts/regression.mjs` runs this walk at 390 and 1280.
# Part 3: the client and studio screens


Source files read (all under /home/user/website): src/pages/AdminClients.jsx, src/components/ClientCard.jsx, src/components/ClientWorkspace.jsx, src/components/LeadDetail.jsx (client mode), src/components/DetailFold.jsx, src/pages/AdminShowcase.jsx, src/pages/AdminPlanner.jsx, src/components/PostSheet.jsx, src/components/SaveBar.jsx, src/components/ImageField.jsx, src/pages/AdminConcepts.jsx, src/pages/AdminConceptsEditor.jsx, src/pages/AdminOrders.jsx, src/components/OrdersImport.jsx, src/pages/AdminReviews.jsx, src/pages/AdminLanding.jsx, src/pages/AdminDesign.jsx, src/pages/AdminSubmissions.jsx, src/pages/AdminSettings.jsx, src/lib/projects.js, posts.js, concepts.js, reviews.js, orders.js, cloudinary.js, exports.js, src/shared/pricing.js, semantics.js, copy.js, src/shell/nav.js, src/pages/AdminApp.jsx (routing and data layer).

## 0. Shared plumbing every screen relies on

Routing (AdminApp.jsx): BASE is '' on the admin host, '/admin' otherwise. Section is derived from the path: /clients, /clients/:id/showcase, /clients/:id/planner, /leads/:id/concepts (?set=<id>), /concepts, /orders, /reviews, /landing, /submissions, /settings, /settings/deleted, /design. `?open=<id>` deep links a record on the current screen; `?loading=1` forces the loading state for audits.

Nav (src/shell/nav.js), group Clients: Clients (/clients, badge = clients at stage client or won), Projects (href /clients?filter=active, badge = open non retainer non delivered projects), Planner (href /clients?filter=planner, badge = posts in status review). Group Studio: Print Orders (badge = orders with status new), Concepts (badge = conceptsBadge: sets in status changes plus viewed and unanswered 48h), Reviews (badge = review asks due), Landing. Group System: Submissions (badge = unread), Recently Deleted (/settings/deleted, opens Settings Data tab), Design, Settings.

Data loaded at the shell level and passed down: call_leads (GET /api/admin/call-leads), projects (GET /api/admin/projects), posts (GET /api/admin/posts, this month and next), concept sets (GET /api/admin/concept-sets), orders (GET /api/admin/orders, also returns `unimported`), submissions (GET /api/admin/submissions, returns `unread`). Every write is optimistic with rollback: PATCH `{ id, set }` to the same route; POST the doc; DELETE by `?id=`/`?ids=` (leads and submissions) or body `{ id }` (posts). patchSet for concept sets takes the server's returned item (send stamps sentAt, regenerate mints the token).

Write paths inside screens: `patch` toasts `COPY.error.save` ("Could not save. Your change was undone.") on failure; `patchRaw` is for InlineEdit, which toasts itself. InlineEdit saves on blur. Other error strings: create "Could not create that. Nothing was saved.", del "Delete failed. Nothing was removed.", restore "Could not restore that.", copy "Could not copy.".

SaveBar (SaveBar.jsx): fixed bar, `role="status"`, message "You have unsaved changes", buttons Discard (ghost) and "Save changes" (primary, loading while saving). 72px tall on desktop, 104px under 900px, sits above the mobile tab bar. Pages that use it (Showcase, Planner, Concepts editor) also: guard Back with a confirm ("Leave without saving?" / body "Your changes to this showcase|planner|these concepts have not been saved yet." / confirm "Leave"), guard the browser with beforeunload, and save on Cmd+S / Ctrl+S. Discard confirm: "Discard changes?" / "Everything you changed since the last save goes back to what is live." (Showcase) or "...back to what is stored." (Planner, Concepts) / "Discard".

ImageField (ImageField.jsx): a row with an InlineEdit for the URL (placeholder per field) plus an "Upload" secondary button (Upload01 icon) only when Cloudinary is configured; hidden `<input type=file accept="image/jpeg,image/png,image/webp,image/svg+xml">` with no capture attribute. Below, a drop zone: shows the thumbnail in an `.img-fit` box at the public ratio (`whole` variant letterboxes), "Image not reachable." if the image errors, "Drop an image here, or paste a link above." when empty, "Drop to upload" overlay while dragging. Under a filled field: "Clearing this field removes the link from the record. The file stays in Cloudinary." Upload success toast "Image uploaded."

Cloudinary (cloudinary.js): unsigned browser POST to `https://api.cloudinary.com/v1_1/<VITE_CLOUDINARY_CLOUD_NAME>/image/upload` with `file` and `upload_preset=<VITE_CLOUDINARY_UPLOAD_PRESET>`. Enabled only when both VITE vars exist. Accepted types jpeg, png, webp, svg+xml; max 10 MB. Errors: "Image uploads are not configured for this deployment.", "<name> is a <type>. Use a JPEG, PNG, WebP or SVG.", "<name> is 12.3MB. The limit is 10MB.", "Upload blocked by the browser or the network. Nothing reached api.cloudinary.com, so there is no status to report: check the connection, and check that api.cloudinary.com is in the admin CSP connect-src.", "Cloudinary refused the upload (<status>): <message>", "Cloudinary accepted the file (<status>) but returned no URL." Returns `{ url: secure_url }` or `{ error }`.

## 1. Pricing (src/shared/pricing.js), the one source of truth

Constants: SINGLE_CAP = 750 (above this a payment plan is offered). REVISION_ROUNDS = 2. EXTRA_ROUND = { design: 50, web: 75 }. RUSH_FEE = 20. TURNAROUND_DAYS = { standard: 7, rush: 3 }.

PACKAGES (id, label, price, kind, included):
- social-refresh, "Social Refresh", $150, design: Profile and cover graphics; Highlight covers; Three post templates; 2 revision rounds
- brand-starter, "Brand Starter", $350, design: Logo (primary and mark); Color palette and type pair; Mini brand sheet; 2 revision rounds
- web-essentials, "Web Essentials", $500, web: One-page website; Mobile first build; Contact form and map; Google Business link-up; 2 revision rounds
- brand-complete, "Brand Complete", $600, design: Everything in Brand Starter; Full brand guide; Social media kit; Business card design; 2 revision rounds
- web-complete, "Web Complete", $750, web: Up to five pages; Booking or quote form; Basic SEO setup; Google Business link-up; 2 revision rounds
- launch-plan, "Launch Plan", $1,200, web, plan { months 6, monthly 200 }: Brand Starter; Web Essentials; Launch social graphics; NFC card; 2 revision rounds per piece
- build-plan, "Build Plan", $1,800, web, plan { months 6, monthly 300 }, altPlan { months 12, monthly 150 }: Brand Complete; Web Complete; Online shop or booking; Launch social graphics; NFC card; 2 revision rounds per piece

RETAINERS (id, label, price/mo, included, monthly deliverable):
- site-care, "Site Care", $100: Hosting and updates; Monthly content edits; Uptime and backups. monthly { count 2, unit 'hours', label 'Up to 2 hours of site care' }
- content-kit, "Content Kit", $250: Eight posts a month; Story templates; Monthly content plan. monthly { count 8, unit 'graphics', label '8 graphics a month' }
- ad-creatives, "Ad Creatives", $350: Four ad sets a month; Landing page tweaks; Performance check-in. monthly { count 10, unit 'creatives', label '10 ad creatives a month' }
- growth, "Growth", $500: Everything in Content Kit and Site Care; Ad creatives; Quarterly strategy call. monthly { count 10, unit 'creatives', label '10 creatives a month plus Site Care and Google Business', extras ['Site Care', 'Google Business'] }

ADDONS: card-design "Business card design" $30 (freeWith any package); cards-250 "Printed cards, 250" $35; cards-500 "Printed cards, 500" $50; nfc-card "NFC card" $25 (freeWith launch-plan, build-plan); stickers "Stickers" $40; vinyl "Vinyl decals" $60; rush "Rush delivery" $20.

PRINT_PRODUCTS (the Orders product picker): stickers-2 "Stickers, 2 pack" $10 (sticker); stickers-50 "Stickers, 50 pack" $40 (sticker); vinyl "Custom vinyl" with sizes small "Small, up to 8 in" $15, medium "Medium, up to 16 in" $25, large "Large, up to 32 in" $40 (sticker); cards-250 "Business cards, 250" $35; cards-500 "Business cards, 500" $50; card-design "Business card design" $30; nfc-card "NFC card" $25.

Rules: defaultRetainer(pkg) = site-care for web kind else content-kit. planFor(total, packageId): a package with its own plan uses it (with alt); otherwise total <= 750 returns null (one payment); above 750 splits into 6 months (12 when total >= 1500), monthly = ceil(total/months). extraRoundFee(kind) = 75 for web or combined, 50 otherwise. planLine renders "$1,200 as $200 a month for 6 months, first payment starts the project (or $150 a month for 12)". money(n) = "$1,200".

## 2. Clients list (AdminClients.jsx)

Route: /clients. URL params: `?filter=<id>` where id is one of CLIENT_FILTERS; the sidebar's Projects entry is `/clients?filter=active` and Planner is `/clients?filter=planner`. An unknown filter falls back to All; removing the param resets to All. `?open=<leadId>` opens a record.

Purpose: the paid side. A client IS a call_leads document with stage 'client' (or 'won'), sorted newest first by clientSince, then bookedOutcome.at, then updatedAt.

Header: Section "Clients" with description "<n> clients, <m> on retainer, $X collected" (collected = sum of every purchases[].amount across clients) and action button "Add client" (Plus icon). Under it an Input placeholder "Search clients" (SearchMd leading icon, XClose "Clear search" trailing), then a wrapping chip row with counts: All, Active project, Posts to approve, On retainer, Delivered, Paused, Owes a payment, Ready to deliver. Filter rules (projects.js clientPasses): planner = any live post for the lead in status review; active = any non archived, non retainer project not delivered; retainer = retainer.status active or ending; delivered = clientStatus (stored or derived) is delivered; paused = clientStatus paused or retainer paused; owes = any project with a past due schedule item; ready = any project at stage delivery and fully paid.

Desktop (>= 1024px) layout: a Table (storageKey vz_clients_cols, density md, row click opens) with columns Business (Avatar with retainer dot, name), Package (active project name or "None"), Stage (project stage Pill, else clientStatus outline pill), Paid / Total (72px ProgressBar plus "$paid / $total", or "$X lifetime" when no project), Retainer ("Content Kit $250/mo" pill with RefreshCw01, or "None"), Planner ("<n> in review" solid new pill, "On" soft, or "Off"), Next date ("Bill Sep 30" or "Payment Sep 30" or "None"), Since (clientSince date or "Unknown"). Below the list a right aligned ghost "Refresh" button (reloads leads and projects).

Phone / under 1024: a Stagger of ClientCard: LeadCard compact plus a client line: package outline pill and stage pill or "No active project"; retainer pill; planner pill ("<n> in review" or "Planner"); a progress row "$paid of $total"; "Next bill|Next payment Sep 30, $250".

With a record open: desktop shows a left aside (`aria-label="Clients"`, 232px rail between 1024 and 1279, full panel at 1280+) listing "<n> shown" and compact ClientCards with the selected one highlighted, and LeadDetail in the main column. On a phone the list hides and the detail fills the screen (onMobileOpen/onMobileClose flip the shell's has-detail).

States: skeleton (delayed) = Table.Skeleton 5x7 on desktop, four ClientCard.Skeleton on phone; a deep link while loading shows three compact skeleton cards and LeadDetail.Skeleton. Error = ErrorState "Could not load your leads" / "The call_leads list did not come back. Try again; nothing was changed." with Retry. Empty = "No clients yet" / "Win a booked meeting, or add a walk in with the button above." action "Open Booked". Filter empty = "No clients in this filter" / "Every client is under All." action "Show all" (clears filter and search).

Add client: Sheet "Add client" description "For walk ins that never went through the pipeline." (640 wide, tall) hosting LeadForm. Save POSTs /api/admin/call-leads with `defaultLead(form)` plus `stage: 'client', clientSince: now ISO, clientStatus: 'active'`. Toast "<business> added as a client."

## 3. Client record (LeadDetail in client mode + ClientWorkspace)

Layout: desktop two columns; left column = profile card, Links card, Brand card; right column = sticky Tabs sub nav then the sections. Phone: profile, Links, Brand, tabs, sections stacked. A client opens on the Projects section; every other section is folded to one line (FoldSection: title, summary in the description slot, chevron IconButton "Expand <title>"/"Collapse <title>"). Tabs: Overview, Projects (count of live non retainer projects), Payments, Retainer, Deliverables, Notes, History (count of callLog + contactLog). Tapping a tab opens and scrolls to that section.

Profile card: Avatar (booked status dot for stage client), business name, descriptor InlineEdit ("Add a one-line descriptor"), pills: New (if new), stage outline pill, priority pill with menu (Hot/Warm/Cold), client status pill with menu (Active / Paused / Delivered, writes `clientStatus`), industry InlineEdit. Icon actions: Phone, Text (sms:), Mail, Instagram, Facebook, Website, Maps, Copy phone. Buttons: "Start call" (opens Call Console with this lead), "Edit all" (LeadForm sheet), "Showcase" (with a Published/Draft pill when a showcase record exists), "Planner" (pill Off / On / "<n> in review"), "Concepts" (pill = newest set's status or "None"). Facts: Phone, Contact, Phone note, Best window, Email, Since (clientSince), Lifetime ($ sum of purchases), Source ("Nightly scraper" or "Added by hand"), Added, Last scanned, Callback due (opens CallbackPicker).

### Links card (ClientLinks)
Rows Website (Globe01), Google Drive (Folder), Instagram (Camera01). Website and Instagram are derived from lead.socials and read only here ("Not set in Overview" when empty) with an "Edit <label> in Overview" icon button that opens Edit all. Drive are InlineEdits ("Paste a link") writing `links: { website:'', drive:'':'', instagram:'', ...links, [k]: v }`. Each filled row is an anchor "Open <label>" plus a "Copy <label>" icon button. safeHref sanitizes every link.

### Brand card (ClientBrand)
Header "Brand" with ghost "Copy brand" (copies brandText: "Brand: X / Primary color: #.. / Secondary colors: .. / Display font / Body font / Logo: url / Notes"). Rows: Primary (Swatch chip + InlineEdit "Primary hex", validation "Use a six digit hex color."), Secondary (four swatches "Color 1..4"), Display font (placeholder "Barlow Condensed"), Body font ("Inter"), Logo (read only thumbnail from showcase.logoUrl or legacy brand.logo.dark/light or brand.logoLink; "Add it in Showcase" and an "Edit in Showcase" button), Notes ("One line: tone, do and do not"). Writes `brand: { primary, colors[], fontDisplay, fontBody, logoLink, notes }`.

### Projects section
FoldSection "Projects", description "<active> active of <total>", action "New project" (Plus). Empty: "No projects yet" / "Start one from a package, an add-on set, or a custom total. The payment schedule fills itself in." action "New project".

Project kinds (PROJECT_KINDS): brand, web, combined, print, retainer. Stages (stagesFor): retainer = kickoff, delivered; web and combined = kickoff, design, revisions, build, delivery, delivered; brand and print = kickoff, design, revisions, delivery, delivered. Stage labels/icons: Kickoff (Play), Design (Palette), Revisions (Edit02), Build (Columns03), Delivery (Package), Delivered (Check). kindOfPackage: web packages are 'web' except launch-plan and build-plan which are 'combined'; everything else 'brand'.

Project card: name, kind outline pill, stage pill; "Started <date>, $total[, $monthly a month for N]"; a Menu "Actions for <name>": "Advance to <next>" (or "Delivered" disabled), divider, "Set stage: <each stage>", divider, "Archive" (danger; confirm "Archive <name>?" / "It leaves the list. The ledger entries it paid stay on the client." writes `archived: true`). A Stepper ol (`aria-label="Stages"`) with numbered dots, checks for done. Revision block: "Revision rounds: <used> of <max>[, <n> extra]", button "Log a round" or, once exhausted, "Log extra round ($50|$75)"; ProgressBar; when exhausted: "Both included rounds are used. A third round is $X and lands on the schedule as an unpaid line. Never discount by cutting price."; last four log entries (date, "Extra, $X" pill, note or "Round logged"). Meta row: "Paid $x of $y", ghost "Payments", ghost "Deliverables", secondary "<next stage label>" with ArrowRight. When stage is delivered, a level 2 card "Send delivery" with checkboxes (DELIVERY_STEPS): "Drive folder shared as Viewer" (driveShared), "Delivery email sent" (emailSent), "Retainer pitch sent" (pitchSent), "Review link sent" (reviewLinkSent), "Follow up scheduled in 3 days" (followUp; ticking sets lead callStatus 'callback', callbackAt = 3 days out at 10:00, appends callLog { outcome 'callback', note 'Retainer follow up' }, writes delivery.followUpLeadCallbackAt, toast "Follow up set for <datetime>. It is on the Calendar."). Footer line "Files release only at full payment. Every delivery ends with a retainer pitch."

Stage rules: setting Delivered first checks deliverBlockReason: if owed > 0, a confirm "Not ready to deliver" with body "$X is still owed across N schedule items. Files release only at full payment, so Delivered waits until the last payment lands." and button "Open payments" (jumps to Payments). Otherwise the Deliver modal "Mark <name> delivered?" description "Every delivery ends with a retainer pitch. The Send delivery checklist opens on the card." containing a "Review link" card: `https://visualizestudio.org/review/<showcase.slug>` with a Copy button (copying flips reviewLinkSent on confirm), hint "Text it to them with the files. Copying ticks "Review link sent" on the checklist; untick it on the card if you change your mind." or "Publish their showcase to get a review link; the checklist item stays on the card." Confirm "Mark delivered" writes `stage: 'delivered', delivery: {...}`; if no other active project, patches lead `clientStatus: 'delivered'`. Any other stage write re-activates clientStatus when it was delivered or unset.

Log a round modal: title "Log round <n> of 2" / description "What changed in this round." textarea "What changed" (placeholder "Tightened the wordmark spacing, swapped the secondary color."), button "Log round"; writes `revisions: { max, used, log: [...{ at, note, extra:false }] }`. Extra round: title "Log an extra round", description "$75 for a web round, added to the schedule as an unpaid line." textarea "Reason" (placeholder "They want the mark reworked after approving it."), button "Log extra round"; also appends schedule `{ id, amount: fee, dueAt: today, status:'upcoming', ledgerId:'', label:'Extra round N', extra:true }` and bumps `total`. Toasts "Round 1 of 2 logged." / "Extra round logged, $75 added to the schedule."

New project sheet ("New project", description = business, 560 wide): Select "What": "A package" / "An add-on set (print)" / "Custom". Package: Select "Package" listing "<label> ($price)" (default Web Essentials). Add-ons: checkboxes of ADDONS "<label> ($price)". Custom: Name, Total, Kind (brand, web, combined, print). Input "Start date" hint "The first payment starts the project." Preview card: name, kind pill, $total, plan line or "One payment, due at the start.", the schedule rows "<label> $amount, Sep 30". Inputs "Drive folder (optional)" and. Create POSTs buildProject: `{ leadId, name, kind, packageId, custom, stage:'kickoff', stages, total, schedule, revisions:{max:2,used:0,log:[]}, plan, links:{drive}, deliverables: deliverablesFor(kind), delivery:{all false}, monthly:[], archived:false }`. Schedule (scheduleFor): under the cap one item "Full payment" due on start; a plan yields items "Month i of N" with monthly amounts, last one takes the remainder, dueAt = start plus i months (day clamped). Toast "<name> created."; sets clientStatus active; copies Drive/onto lead.links if empty.

### Payments section
FoldSection "Payments", description "<project>: $paid paid of $total" or "No project selected"; action = a "Project" Select when there is more than one project. ProgressBar labelled "Paid in full" or "$X still owed". Schedule as a Table at >= 1440px (columns Item, Amount, Due, Status; row action) or ListRows below that ("$amount, due Sep 30, 2026"). Status (scheduleStatus): paid (status paid or a ledgerId), past-due (before today), due (within 7 days), upcoming. Row action: "Mark paid" (Check) or, when paid, ghost "Ledger" which scrolls to `#ledger-<ledgerId>`. Empty schedule: "No schedule" / "This project has no payment lines." No project: "No project to bill" / "Create a project and its schedule shows up here." action "New project".

Mark paid modal ("Mark paid", description "<project>: <item label>"): Amount (prefilled), "Paid on" (date, today), "Ledger label" (prefilled "<project>: <item label>"). "Record payment" appends to the lead's `purchases[]` `{ id, label, amount, at, notes:'', projectId }`, then patches the project schedule item `{ status:'paid', ledgerId, paidAt, amount }`. For a retainer project, when fewer than six unpaid items remain it appends six more months on the bill day and updates `retainer.nextBillAt` on the lead. Toast "$X recorded." and the row pulses.

Payment plan card (when project.plan): "Payment plan" with pill "Month <m> of <N>" (planMonth = max(paid+1, started) clamped); Monthly, Next due (or "Paid in full"), Remaining; InlineEdit "Stripe subscription id" placeholder "sub_... (so a cancellation reconciles)" writing `plan.stripeSubscriptionId`. From month N-1 (5 of 6, 11 of 12) a danger glow card: "Cancel the Stripe subscription after the final payment. Stripe does not stop it for you." with checkbox "Stripe subscription cancelled" (plan.stripeCancelled). If plan.stripeCancelledAt is set (webhook): "Stripe reports this subscription cancelled (<date>)."

Lifetime ledger card: "Lifetime ledger, $sum" with "Add manual payment" button; rows (IconTile CurrencyDollar) title label, subtitle "date, project, notes", meta $amount; empty "Nothing paid yet" / "The first payment you record lands here, with the Stripe ones that match on their own." action "Add manual payment". Manual sheet ("Add manual payment", 460): "What for" (placeholder "Sticker rerun"), Amount, Date, "Project (optional)" Select placeholder "Not tied to a project"; "Add payment" appends purchases entry. Toast "Payment added."

### Retainer section
FoldSection "Retainer", description "<plan>, $X a month" or "Every delivery ends with a retainer pitch."; action "Start a retainer" (RefreshCw01) when none or cancelled. Retainer statuses: active, paused, ending, cancelled. Card: status pill, plan label, "$250/mo"; grid Started, Next bill ("Paused" when paused, "Not set"), "Bill day: Day N", Ends (cancelAt); InlineEdit "Stripe subscription id" on `retainer.stripeSubscriptionId`; "Stripe reported this subscription cancelled on <date>." when webhook says so. Next bill card: "$amount, Sep 30" with status pill and "Mark paid" (same payment modal against the retainer project). Buttons: Pause (active), Resume (paused), Cancel (active or paused; confirm "Cancel the retainer?" body "30 days notice: it keeps billing until <date>, then it is cancelled by the monthly job or by hand." confirm "Give notice"; writes `status:'ending', cancelAt: now+30d`; toast "Notice given. The retainer ends in 30 days."), "Mark cancelled now" (ending; confirm "Mark the retainer cancelled now?" / "Use this once the notice period is over."; writes status cancelled, nextBillAt ''). Ending note: "Notice given. It bills until <date>, then the monthly job (or you) marks it cancelled."

Monthly deliverables: "Monthly deliverables: <plan monthly label>", one level 2 card per month (current month first, pill "This month"), ProgressBar "<delivered> of <included> <unit>", button "Log delivery" (modal "Log delivery" / month; "How many", "Note (optional)" placeholder "Three story graphics and the monthly plan"; writes project.monthly[] `{ month, included, delivered, log:[{at,count,note}] }`, toast "3 logged for September 2026."). When the client's planner is on, delivered = count of the client's posts that month in status approved or posted and the card says "Counted from their planner: posts approved or posted this month." (no Log delivery button).

Start a retainer sheet (460): Select "Plan" "<label> ($price a month)" (default Content Kit), bullet list of included plus the monthly label, "Start date", "Bill day of month" (1 to 28, default today's day clamped to 28). Create POSTs buildRetainerProject `{ leadId, name:'<Plan> retainer', kind:'retainer', packageId: planId, stage:'kickoff', stages:['kickoff','delivered'], total:0, schedule: 12 months of $price on the bill day (first not before start), ..., retainer:{planId,billDay,startedAt} }`, then patches the lead `retainer: { projectId, planId, amount, status:'active', startedAt, billDay, nextBillAt, cancelAt:'' }` and clientStatus active. Toast "Content Kit retainer started, $250 a month." Empty: "No retainer yet" / "Site Care for web work, Content Kit for everything else. Pitch it with the delivery." action "Start a retainer"; cancelled: "Retainer cancelled" / "<plan> ended <date>. Start a new one when they are ready."

### Deliverables section
FoldSection "Deliverables", description "<done> of <total> ready"; project picker action. Release card: Toggle "Released to client" with description "Released <datetime>." or the block reason "Files release only at full payment. $X is still owed." or "Paid in full. Flip this once the Drive folder is shared."; disabled until fully paid; writes `releasedAt`. When released: a full width "Open the Drive folder" button (project links.drive or lead links.drive) or "Add the Drive folder link on the project or in Links to show it here." Groups (DELIVERABLE_GROUPS, mirroring the Drive folder): "01 Brand Files" (brand, combined): Logo PNG, Logo SVG, Logo JPG, Colors and fonts, Guidelines; "02 Web Files" (web, combined): Access and credentials, Walkthrough video; "03 Print Files" (print, brand, combined): Business cards, Stickers and vinyl; "04 Source Files" (all): Source files. Each item: Checkbox (done), InlineEdit link "Add a link" (shown without protocol), "Open <label>" icon button. Empty: "No deliverables listed" / "Prefill the Drive structure for this kind of project." action "Add the usual set" (writes deliverablesFor(kind)). No project: "Nothing to deliver yet" / "Deliverables follow the project. Create one first." action "New project".

## 4. Showcase editor (AdminShowcase.jsx)

Route /clients/:id/showcase (opened from the record's Showcase button). Draft model: the whole `showcase` object plus `reviews.testimonials` are held as a draft; nothing writes until Save, which does one PATCH `{ showcase: draft.showcase, reviews: { ...DEFAULT_REVIEWS, ...lead.reviews, testimonials } }`. Toast "Showcase saved and published." or "Showcase saved." Re-seeds from the record only when the draft still equals what it was seeded from.

Layout: sticky top bar (ghost "Back", h1 name = displayName or business, Published/Draft pill, secondary "Preview" opening `https://visualizestudio.org/clients/<slug>`), then Section "Showcase" description "What shows on the public work page. Nothing here is live until you save." Cards in order: Completeness, Publish, Card fields, Brand identity, Website, Instagram, Business cards, Print and product, Testimonials. Same stack on a phone; the save bar is two rows.

Completeness card "What the page will have", "<done> of <total> filled", ProgressBar, chips for what is missing (Cover image, Blurb, Type, Logo, Brand images, Website URL, Website screenshots, Instagram posts, Card front, Print items, A testimonial); tapping a chip opens and scrolls to the block. Disabled blocks do not count. Full: "Everything the page shows is filled in."

Publish card: pill Published/Draft; Toggle "Published" description "Live on the public showcase once a slug is set." (first publish with no slug mints one client side from displayName or business, slugified a-z0-9 and hyphens, max 80; server is the source of truth and auto suffixes collisions); "Public URL slug" InlineEdit placeholder "Auto-generated on publish" with the URL and "Copy showcase URL"; "Review link" `https://visualizestudio.org/review/<slug>` with "Copy review link" and note "Text this to them once the work is delivered. Their name and business are filled in for them." (or "Set a slug and the review link appears here."); "On the landing page": toggles "Feature on landing page" (featured.landing), "Show logo in the logo strip" (featured.logoStrip), "Feature in the work row" (featured.work), all disabled until published with note "Publish first; the landing page only shows published clients."; "Display order" number (featured.order, commits on blur, hint "Lower numbers show first."); "Preview" button.

Card fields: "Public name" derived from the business name with "Use a different name" (reveals an override InlineEdit and "Use the business name" to clear, displayName max 200); "Type" (max 80, placeholder = lead industry); "Blurb" multiline max 200 with counter "n/200"; "Cover image" ImageField at 16x9.

Showcase blocks (ShowcaseBlock: collapsed to a one line summary such as "3 images, notes" / "Not set up yet" / "Off", with an "Enabled" toggle in the header):
- Brand identity (brand.enabled default true): Logo ImageField (saving writes `logoUrl` and blanks the legacy `brand.logo.light/dark`); "Gallery images (n of 12)" with UploadMany ("Upload gallery images", "Uploading 2 of 5", "Limit of 12 reached.") and an object list editor (drag to reorder on desktop; menu Move up / Move down / Remove; "Add image") where each row is an ImageField plus "Caption (optional)"; Notes (max 600, "Notes for the showcase page"); a read only "Palette and type (from Overview)" card with color chips and fonts and "Edit in Overview".
- Website (default enabled): URL derived from socials.website ("Add the website in Overview", override shown with "Clear override"); "Screenshots (n of 8)" list of ImageField + caption; Notes.
- Instagram (default off): Handle and Profile URL derived from socials.instagram (overrides clearable); Profile image (1x1 circle); "Posts (n of 9)" each with "Post URL" (max 400), image (1x1), caption (max 200); "Highlights (n of 10)" each with cover (88px circle preview), "Label (up to 40 characters)", "Highlight URL (optional)"; Notes.
- Business cards (default enabled): Front and Back ImageFields at 7x4; Notes.
- Print and product (default enabled): "Items (n of 12)" each with "Label, e.g. Sticker sheet", image (1x1), caption; Notes.

Testimonials card: buttons "Add by hand", "Add from asks" (sheet listing review asks with result left; empty "No asks marked left" / "Log an ask and mark it Left on the Reviews screen first."), "Add from website reviews" (sheet of review type submissions sorted by business match; prefills quote, author, rating, source website). Rows: quote, "Author, Role", stars, source pill, "#order", toggles Published and Featured, tap to edit. Testimonial sheet: Quote (max 400 with counter), Author (120), Role (placeholder "Owner"), Rating stars (tap again to clear), Source Select (NFC card, Text, Email, In person, Website, Google), toggles Published and Featured, Order, Date, Remove. Testimonial shape `{ id, quote, author, role, rating, source, published, featured, order, at }`.

States: not found while loading = skeleton cards under Section "Showcase"; loaded but no lead = EmptyState "Client not found" / "That client is not in the list any more." with "Back to clients".

## 5. Planner editor (AdminPlanner.jsx, PostSheet.jsx)

Route /clients/:id/planner, optional `?month=YYYY-MM`. Reads posts from the shell; `lead.planner` is a full replacement object with writable fields `enabled`, `postsPerMonth`, `welcome`; `token`, `tokenCreatedAt`, `lastViewedAt` are server owned and stripped from every save; revoking sends `{ ...planner, regenerate: true }`.

Top bar: Back, name, pill Off / On / "<n> in review"; secondary "Preview" opening `/api/planner?token=<token>&month=<month>`.

Setup card: Toggle "Planner on for this client" (description "When this is on, the client can open their planner with the link below. Turning it off makes the link stop working without deleting anything."); "Posts a month": when the client is on a retainer it is read only "8 a month, from Content Kit" with "Edit in Retainer" and note "Their retainer plan sets this; the planner link shows the same number." (saved as postsPerMonth from the plan), otherwise an InlineEdit (0 to 60, default 8) with note "What they are owed each month. The Content Kit is 8."; Textarea "Welcome message" max 300 with hint "Appears at the top of their planner. n of 300."

Invite card "Their link" (only when enabled and a token exists): `https://visualizestudio.org/planner/<token>` with "Copy planner link", note "Text this to them. It opens their planner, no password and no account.", "Last opened <relative>" or "Not opened yet", button "Make a new link" (confirm "Make a new link?" / "The link they have stops working immediately. Anyone still holding the old one gets a not found page, and you will need to send them the new one." / toast "New link made. The old one stopped working.").

Month card: "Previous month" / "Next month" icon buttons around the month name; Menu "Month actions" ("Copy <previous month> across", "Add post"); primary "Add post"; ProgressBar "<n> of <cap> posts" (cap = plan count or postsPerMonth). Add post is immediate: POST `{ leadId, month, date: '<month>-01', platforms:['instagram'], platform:'instagram', format:'portrait', status:'making', order }` and opens the sheet with the image field focused; toast "Post added." Copy last month creates copies dated one month later, all set to making; toast "3 posts copied from August 2026, all set back to Making." or "Nothing in August 2026 to copy."

Post rows (sorted date, order, time): 72px thumbnail at the format's aspect, "Sep 24, 10:00", up to two platform icons then "+1", format pill (Portrait post / Story), status pill (Making, In review, Approved, Posted), "Not ready" danger pill when in review but missing pieces, label (first words of caption plus "post", or "Sep 24 post"), "Needs an image, a caption and hashtags.", an aspect note like "This image is 1:1 but the post is set to Portrait post.", and the client note block "<client> asked for a change" (danger when the post is back in making, "handled" once re sent). Menu: Move up, Move down, Edit post. Drag to reorder on desktop. Empty month: "No posts for this month yet" / "Add the first one, or copy last month across and edit from there." action "Add post". Error: "The planner did not load" / "The posts for this client could not be fetched. Try again."

PostSheet (title = post label, description "<client>, in review", 520 wide, footer "Delete post" danger ghost and "Done"): client note card if any; Image (ImageField, whole letterbox); Caption textarea max 2200 with "n of 2200"; Format radio rows: "Portrait post" ("The standard feed post. Previews at 4:5.") and "Story" ("Disappears in 24 hours. Previews at 9:16."); Platforms ChipGroup multi (Instagram, Facebook, TikTok, Other; at least one, hint "One post, every place it goes. At least one."); Date and Time; Hashtags (portrait only, max 500, hint "These get copied with the caption. n tags, m of 500.", "Use last set" button showing the client's most recent tag set); "Note to the client" (max 500, "They read this under the caption."); Status radio rows: "Being made" ("They see it as in progress. Nothing for them to do."), "Send for approval" ("They can approve it or ask for a change."; blocked with "Add an image, a caption and hashtags before sending this for approval." when incomplete), "Approved" ("They see it as scheduled and are waiting for it to go up."), "Posted" ("They see it as done."). Every field is drafted; Save writes each changed post via PATCH /api/admin/posts with only POST_FIELDS (date, time, platform, platforms, format, imageUrl, caption, hashtags, status, note, order), toast "Saved. 2 posts updated." Delete confirm "Delete this post?" / "It disappears from their planner. You can still get it back from Recently deleted."

Review flow: Rob sets "Send for approval" (status review). The client's public page approves (status approved, approvedAt) or asks for a change (status back to making, clientNote, clientNoteAt). Those stamps feed the notifications feed (recentClientActions, 48 hour window) and the retainer month's delivered count (approved or posted).

## 6. Concepts

### Studio > Concepts list (AdminConcepts.jsx), route /concepts
Section "Concepts" description "<n> out with clients". Chips: All plus each status (Draft, Sent, Viewed, Changes requested, Approved, Archived) with counts; All hides archived. Rows sorted by need: changes, viewed, sent, draft, approved, archived, then updatedAt. Each row: 56px first image, client name, status pill, "Unanswered 2 days" pill when viewed and silent for 48h, "<title or Concepts>, round N", "<n> directions. Last opened <relative>." or "Not sent yet." or "Not opened yet."; a stretched button "Open <client>, <title> round N" opens the editor at /leads/:id/concepts?set=<id>. Empty: "No concepts out right now" / "Build one from a lead: open the record and tap Concepts." Filter empty: "Nothing in this status" / "Every set is under All." Error: "The concepts did not load" / "The concept sets could not be fetched. Try again."

### Concepts editor (AdminConceptsEditor.jsx), route /leads/:id/concepts?set=<id>
Works for a lead at any stage. Drafted: title, intro, projectId, directions (with items). Immediate: New set, Start next round, Send, Make a new link, Archive, Log extra round (a dirty draft saves first). Limits MAX_DIRECTIONS 6, MAX_ITEMS 12 per direction.

Top bar: Back, name, status pill; "Preview" and "Present" (opens `<url>?present=1`, hides approve and feedback controls) both disabled for a draft with title "Send it first. A draft never opens on the public site."

Sets card: Tabs "Round 1", "Round 2, archived"...; buttons "New set" (POST `{ leadId, title:'', round:1, intro:'', directions:[blank] }`, toast "New set started.") and "Start next round" (POST nextRoundOf: same directions with new ids, round+1; toast "Round 2 started from round 1. It is a draft until you send it."). Switching sets with a dirty draft confirms "Switch sets without saving?".

Setup card: Title (max 120, placeholder "Concepts for <name>", hint "The page heading. Leave it empty for the default."), Intro (max 600, placeholder "Here are three directions for the new look. Each one comes from what you told me on the call.", hint "This is the first thing they read. n of 600."), "Linked project" Select (None or the lead's projects; hint "Optional. Revision rounds count against it.").

Direction card "Direction A, <name>" with a letter badge; menu Move up, Move down, Duplicate (name gets " copy"), Delete direction (confirm "Delete Direction A?" / "Its 3 images go with it. This is part of your draft until you save."). Fields: Name (max 80, placeholder "Warm and hand drawn", hint "What they will call it when they text you back."), "Why this one" (max 600, hint "They read this before the images. n of 600."). "Images (n of 12)": "Add images" multi upload (button shows "2 of 5" while uploading) and a "Paste a link" InlineEdit; grid of item cards (square thumb, "A1" index, menu Move up/down/Delete image, Kind Select: Logo, Brand board, Mockup, Social, Website, Print, Other; Caption max 200 "One line under it"; image link InlineEdit max 600). Empty: "No images yet. Add a few, or paste a link." Below the directions: "Add direction" (disabled at 6 with "Six is the most a client can weigh at once.").

Send card: for a draft, "Send to client" (Send01; disabled with reason "Add a direction first." or "Add at least one image to a direction first.") and note "Sending makes their link work and stamps the time. Until then nothing is visible to them."; PATCH `{ status: 'sent' }`, toast "Sent. Their link works now; text it to them." Once sent: "Their link" `https://visualizestudio.org/concepts/<token>` with copy, "Text this to them. It opens their concepts, no password and no account.", "Sent <relative>. Last opened <relative>.", buttons "Make a new link" (PATCH `{ regenerate: true }`) and "Archive this set" (confirm "Archive this set?" / "Their link stops working and the set leaves the list. Nothing is deleted; the feedback stays on the record."; PATCH `{ archived: true }`).

Feedback card: "<name> picked Direction B, Warm serif, 2 hours ago." banner when approvedDirectionId is set; timeline of feedback entries (pill Approved / Changes requested / Note, direction label, "<name>, <datetime>", note body), else "Nothing yet. Feedback arrives here once they open the link." (draft) or "Nothing yet. They have not answered." Revision rounds box: "Revision rounds on <project>: <used> of <max> used" with "Log extra round on the project" (confirm "Log an extra round?" body "$75 lands on <project>'s schedule as an unpaid line, and the round is written to its log."; patches the project with roundLogPatch note "Concepts round N, from the editor", extra true). Copy: "Each change request the client sends is usually one round. Log it on the project so the count stays honest." or the exhausted message.

Empty: "No concepts for this record yet" / "Start a set, add a direction or three with images, and send them the link." action "Start a set". Not found: "Record not found" / "That record is not in the list any more."

## 7. Print Orders (AdminOrders.jsx, OrdersImport.jsx, orders.js)

Route /orders (`?open=<id>`). Section "Print Orders" description "<n> orders, <m> open, <r> rush, $X in progress"; action "New order". Search "Search customer, item, note"; chips All, New, Designed, Cut, Packed, Delivered, Cancelled, Rush, Due this week. Sort: status new first, then dueAt. Sources (ORDER_SOURCES): Shop, Client, Walk in, Import. Statuses: new, designed, cut, packed, delivered, cancelled; STEPPER order new > designed > cut > packed > delivered.

Import banner when `unimported > 0`: "<n> shop orders from submissions are not in this list yet." with "Import <n> shop orders" (POST /api/admin/orders `{ action: 'import-submissions' }`, toast "<n> shop orders imported.").

Desktop (>= 1024): Table (storageKey vz_orders_cols) columns Customer, Source, Status, Items ("2 x Custom stickers, 1 x NFC card, +1 more"), Subtotal ("$X +" when quote items), Rush, Due ("Sep 30, in 3 days"), Paid. Selecting opens a right panel (`aria-label="Order"`) and the list turns into compact cards. Phone: OrderCard stack (name, source and status pills, items line, subtotal "plus quote", Rush pill, "Due Sep 30, in 3 days" pill with tone danger when a day past, Paid/Unpaid) and the detail in a tall Sheet. Skeleton: Table.Skeleton 5x8 or three OrderCard.Skeleton; deep link shows RecordSkeleton. Error: "Could not load print orders" / "The orders list did not come back. Try again." Empty: "No print orders yet" / "Shop orders land here on their own. Walk ins and client jobs start with New order." action "New order". Filter empty: "No orders in this filter" / "Every order is under All." action "Show all".

New order sheet (600, "New order", description "Pick a client or type a customer"): Customer card with "Pick a client" (LeadPicker) / "Change client" / "Clear", or Name, Email, Phone inputs; ItemPicker "Add an item": Product Select ("Stickers, 50 pack ($40)", "Custom vinyl (from $15)", ..., "Custom line"), Size Select for vinyl, Qty or for custom Name (placeholder "Window decal") and "Price (blank for quote)"; "Add item". Items list with remove. Toggle "Rush" description "Adds the $20 rush line and moves the due date to 3 days."; Due date (hint "3 day turnaround"/"7 day turnaround", auto set from today until touched); Subtotal (items plus $20 rush; "Plus quote items"); Notes ("Artwork on the way, wants matte."). "Create order" POSTs `{ source: 'client'|'walk-in', leadId, customer:{name,email,phone}, items, subtotal, rush, dueAt, notes, paid: null }`. Line shape: `{ id, productId, name, label, qty, options:{size}, artworkLink, priceTotal, quote }`.

Order detail: customer card (Avatar, name, source/status/Rush/Paid pills, "Created <datetime>, from the shop" when submissionId), Phone and Email buttons, "Link to client" / "Change client" (LeadPicker; linking writes leadId, source client, customer from the lead, then confirm "Create a print project for <business>?" / "A project of kind print keeps this order on their Clients record with its own schedule and deliverables." which builds a custom print project "Print: <item summary>" for the subtotal and writes `projectId`), "Project: <name>". Stage card: "<next stage>" advance button, Menu "Set stage: ..." (Cancelled is danger with confirm "Cancel this order?" / "It stays in the list under Cancelled."), Stepper; delivered toast "Delivered. Run the packaging checklist before it goes out." Packaging card (delivered and sticker items): checkboxes "Poly bag", "Header card", "Usage guide card" (packaging.polyBag/headerCard/usageGuide) and "Sticker orders go out in a poly bag with the header card and the usage guide card." Items card "Items, $X plus quote" with "Add item" toggle to the picker; each line: "qty x name", price InlineEdit (blank = Quote), remove, options line, Artwork link InlineEdit with "Open artwork". Rush toggle "$20 rush line, 3 day turnaround." (re computes dueAt only when it still equals the rule date), Due date with countdown hint, Notes InlineEdit, "Mark paid" (modal "Mark paid" description "Goes on <business>'s ledger." or "No client linked: recorded on the order only."; Amount, "Paid on"; writes a purchases entry "Print order: <items>" on the linked lead and `paid: { at, ledgerId, amount }` on the order) or "Paid $X on Sep 30, on the client ledger|on the order only."

CSV import (OrdersImport, opened from Settings > Data): Sheet "Import orders from CSV" / "Paste rows or drop a file, map the columns, and preview before anything is created." File input, "Or paste CSV" textarea (placeholder "Name,Email,Phone,Items,Subtotal,Date,Status"), a Select per header column (Skip, Customer name, Email, Phone, Items, Subtotal, Date, Status, Notes; guessed from header words), preview Table (Customer, Date, Items, Subtotal, Status, Result "Create" or "Already in Orders" / "No customer name"), footer "Create <n>", result "3 imported, 1 skipped, 0 failed." Items string parses "Name - label - $12 | Next item" (quote when no price). Dedupe key = email | day | rounded subtotal (importKey). Device import (localStorage vz_print_orders from the old print dashboard) uses the same plan/preview with "Skip"/"Create".

## 8. Reviews (AdminReviews.jsx, reviews.js)

Route /reviews. Clients only (stage client), sorted ask due first then name. Section "Reviews" description "<n> clients, <m> with the NFC card, <k> reviews logged as left". Search "Search clients"; chips All, Has NFC card, No Google link, Never asked, Asked this month, Delivered not asked. Grid of ReviewCard (260px min): name, "NFC" pill, "Ask due" pill (3 days after a released project with zero asks), "<count> reviews, 4.8" plus delta pill "+3, +0.2 since <baseline date>" or "Baseline 12 at 4.5" or "No counts yet", "Last ask <relative> by text, left" or "Never asked", "Open Google reviews" button or "No Google link". Empty: "No clients yet" / "Reviews track per client. Win a booked meeting or add a client first." action "Open Clients". Filter empty: "No clients in this filter" / "Every client is under All."

ReviewSheet (520, title = business, description "<project> released <date>"): "Google link" InlineEdit ("Paste the review link") and "Open Google reviews"; Toggle "NFC card" ("Given <date>." or "Tap to record that they have the card."; sets nfcCard and nfcGivenAt) with "Given on" date; Counts card ("Baseline 12 at 4.5, <date>. Latest 15 at 4.7, <date>."; inputs Reviews and Rating 0 to 5 step 0.1; button "Set baseline" first time then "Update counts"; writes `latest {count, rating, at}` and baseline if missing); "Log an ask" (Channel: NFC card, Text, Email, In person; Result: Asked, Left, Declined; Note placeholder "Handed the card at pickup"; "Log ask" appends `asks[] {at, channel, result, note}`, toast "Ask logged."; last five shown); "Ask text" with two copyable texts: Quick ask "Hey! If you have a minute, a quick Google review would mean a lot. Here's the link: <link>" and After delivery "Loved working on this with you. If you're happy with how it turned out, a Google review helps more than you know. Here's the link: <link>" ("Add the Google link above and it is appended to both texts."). Everything writes `reviews: { nfcCard, nfcGivenAt, googleLink, baseline, latest, asks, testimonials }`.

Form submissions section: "Form submissions" description "<n> from the website review form"; rows "<business>, 5 stars" with the text, date, and either the linked client pill, a one tap "Link to <business>" when `fields.slug` matches a published showcase slug, or "Link to client" (LeadPicker filtered to clients). Linking PATCHes the submission `linkedLeadId` and appends an ask `{ channel:'email', result:'left', note:'Website review form, 5 stars' }`; toast "Linked to <business> and logged as left." Empty: "Nothing from the website review form yet" / "When the site posts a review submission, it lands here to link."

## 9. Landing (AdminLanding.jsx)

Route /landing. Controls what public /api/showcase computes as featured. Section "Landing" description "<a> in the logo strip, <b> featured work, <c> featured testimonials". Four sections (drag to reorder on desktop; menu Move up / Move down / "Open <name>"):
- "Logo strip": clients with showcase.featured.logoStrip, sorted by featured.order; rows show the logo thumb and name, "Unpublished" pill; reorder writes each lead's `showcase.featured.order = index`. Warning card "No logo uploaded, will not show correctly" listing names. Empty: "No logos on the strip" / "Turn on "Show in logo strip" on a client's Showcase tab and it lands here to order."
- "Featured work" (description "... up to 6 show on the site", note "When nothing is featured, the site shows the newest published clients instead."): clients with featured.work, cover thumb, type; rows past six get "Won't show". Note: featured.order is one field shared by both lists.
- "Testimonials": every testimonial with published and featured, sorted by testimonial.order, rows "quote excerpt" / "Author, Role, Client"; reorder writes `reviews.testimonials[].order` per lead.
- "Stats" ("Each number is live from your data unless you turn it off or set a fixed value."): rows Clients served, Projects delivered, Average rating, Years; each a Toggle (description "Live value: 12" or "Hidden on the site.") and "Fixed value (optional)" InlineEdit (placeholder "Live: 12", error "Enter a number, or clear it to use the live value."). Live values mirror api/showcase.js computeStats: clients at stage client, projects at stage delivered, mean of published testimonial ratings, years since the earliest published client's clientSince. Reads and writes the settings document `_id: 'landing'` via GET/PATCH /api/admin/settings `{ set: { landing: { stats: { toggles: {key: bool}, overrides: {key: number|null} } } } }`. Error: "Could not load stat settings" / "The landing settings did not come back. Try again."

## 10. Design (AdminDesign.jsx)

Route /design (System group, also "Open design system" from Settings > Danger zone). A read only sign off page for the Visualize Dark token system, every value read live with getComputedStyle from `.lay-root` and the declared light theme block. Sections: hero ("Visualize Dark" / "Design system" / "Every value on this page is read live from the tokens on .lay-root..." with "Jump to components" and "Back to settings"); "Layers and text" (ground, surface-1..3 with text, text-2, text-3 samples and contrast ratio grades AA / AA large / fail; swatches overlay, bar, border, border-strong, border-focus, text-inverse, text-on-red); "Both themes" contrast tables (dark and light) for every text token on every layer; "Brand red" (red, red-hover, red-highlight, red-soft, primary button samples); "Status set" (seven tones new, progress, callback, booked, won, danger, neutral in solid, soft, text variants, plus the real Call status, Priority, Stage, Submission status pills); "Chart palette" (chart-1..6 bars); "Type scale" (display-sm/md/lg in the display face uppercase, text-xs..3xl); "Spacing" (space-1..12, gutter, safe bottom) and "Radius" (sm, md, lg, xl, pill); "Shadow and glow" and "Motion" (enter demo with Replay, press demo, durations fast/base/slow/enter/stagger); "Sizing" (tap, tap-lg, control-h, icons, tab bar, sidebar, rail) and "Z index" (base, sticky, tabbar, sheet, modal, toast, command); then the components gallery (AdminDesignComponents). Skeleton when forced loading.

## 11. Submissions (AdminSubmissions.jsx)

Route /submissions (`?open=<id>`; push deep link `?submission=<id>` routes shop orders to Orders and reviews to Reviews). Types (SUBMISSION_TYPES): start "Brief", contact "Contact", review "Review", shop-order "Shop order", other "Other". Statuses (LEAD_STATUSES): New, Contacted, Replied, Landed, Denied. Section "Submissions" description "<n> submissions, <u> unread"; search "Search name, business, email, answers"; chips All, Unread (toggle), then one per type with counts. Sorted newest first.

Desktop table (vz_subs_cols): From (avatar, name, red unread dot), Name, Type, Status, Detail (first answer "key: value"), Received; unread rows bold. Phone: SubmissionCard (name, "Unread" solid pill, type pill, first line, name, relative time, status pill). Detail in a right panel (`aria-label="Submission"`) or a Sheet. Skeleton Table 6x6 or four cards; RecordSkeleton for a deep link. Error "Could not load submissions" / "The website submissions did not come back. Try again." Empty "No submissions yet" / "Briefs and contact forms from the website land here the moment they are sent." action "Open the site form" (https://visualizestudio.org/start). Filter empty "No submissions in this filter" / "Every submission is under All."

Detail: head card (Avatar, name, type pill, status pill with a change menu writing `status`, Unread pill, "<name>, <projectType>, <datetime>"), buttons Email, Phone, "Mark read" / "Mark unread" (writes `read`), "Link to lead" (LeadPicker "The lead gets this email if it has none." writes `linkedLeadId` on the submission and the email onto the lead if empty; toast "Linked to <business>.") or "Open <business>" plus "Change link", "Convert to lead" (Sheet "Convert to lead" / "Prefilled from the submission. The lead is linked back when it is created." with LeadForm prefilled business, askFor, phone, email, descriptor "<projectType> brief from the site", angle from the first three answers; on create links back, toast "<business> created and linked."), "Open brief" (start type only; Sheet "Brief: <business>" listing every answer with "Copy brief" producing plain text "Brief: X / Name / Email / Phone / Project type / Received / then each question and answer"), Delete (confirm "Delete this submission from <name>?" / "It moves to Recently deleted in Settings and can be restored for 30 days."). Answers card titled "Order" (shop-order), "Review" (review) or "Answers": one ListRow per field; empty "No answers on this one" / "This submission carries only the contact details above." "Private notes" InlineEdit ("Only you can see these.") writes `notes`.

## 12. Settings (AdminSettings.jsx)

Route /settings; /settings/deleted opens the Data tab. Section "Settings" description "<name>, <n> leads loaded"; sticky Tabs: Profile, Notifications, Integrations (count = unmatched Stripe payments), Data, Danger zone (old automation and shortcuts tabs redirect to Integrations). Data from GET /api/admin/settings; writes PATCH `{ set }` or POST `{ action }`, optimistic with rollback. Skeletons are per tab and shaped to the cards. Error: "Could not load settings" / "The settings document did not come back. Try again."

Profile: Name InlineEdit ("The greeting and the initials avatar use this.", default Rob, PATCH `profile.name`); "Daily call target" InlineEdit shown as "25 calls" ("The same number the Dashboard ring counts against.", 1 to 500, PATCH `dailyCallTarget`); Appearance: Theme SegmentedControl System / Dark / Light (icons Monitor01, Moon01, Sun; "Saved on your profile, so every device follows. Dark is the studio look; Light is the same system on cream."), Toggle "Reduce motion" ("Skips entrances, slides, and the skeleton shimmer. Everything still happens, just without the movement." or "Your device already asks for less motion. This keeps it off here too."), both through shell.saveAppearance (localStorage vz_theme, vz_motion plus the profile); Business hours Start and End time inputs ("The Dashboard says when you are outside them and the best window reads against them.", PATCH `profile.businessHours`); Password card: "One password for the whole admin. It lives in api/_lib/config.js (an ADMIN_PASSWORD variable in Vercel overrides it); change it there and redeploy. Sessions are a signed cookie that lasts 30 days."

Notifications: Alerts toggles "Push notifications" ("New submissions and orders, to every device you enabled.") and "Email backup" ("contact@visualizeclients.com on every submission.") via POST `{ action:'prefs', pushEnabled, emailEnabled }`; "Reminders (one push, every morning)" with explanation of the 9am Eastern digest and the Hobby plan cron limit, toggles Meeting reminders, Callback reminders, Bill reminders, Review ask reminders (PATCH `notifications.reminders`), warning "Cron is not armed yet: add CRON_SECRET in Vercel so the reminders job can run.", "Send test notification" (POST `{ action:'test-push' }`, toast "Test notification sent to every subscribed device."); "This device": "Push is on for this device" pill, or "Enable push on this device" (Notification permission, GET /api/push-key, pushManager.subscribe, POST /api/admin/push-subscribe), or "Notifications blocked in browser settings", or "This browser cannot receive push. On iPhone, install the app to your Home Screen first."; "Install the app" card (Installed / Install button / iOS Share instructions / browser menu instructions).

Integrations: Calendly (Connected / Not connected; "Add CALENDLY_TOKEN ... and redeploy."); Stripe (Connected, "Webhook armed" / "Webhook secret missing", "<n> unmatched" pill; read only description with last webhook time; "Reconcile" opens a Sheet "Reconcile Stripe" listing stored unmatched events "$X for <description>" with "Link to client" (LeadPicker "Link this payment" then POST /api/admin/stripe/reconcile `{ eventId, leadId }`, toast "$X added to <business>.")); "Scheduled tasks" (Armed / CRON_SECRET missing, last run of both crons); "Nightly enrichment and scraper" health (Running / Quiet for 36 hours; Last scan, Scanned 24h, Last scraper insert, Inserted counts); cron cards Reminders ("Once a day, 13:00 UTC (9am Eastern)", digest description, last/next run, "<n> sent last run") and Daily ("Once a day, 06:00 UTC", "Rolls retainer bill dates forward, extends retainer schedules, cancels retainers past their notice, and writes task health.", "<n> rolled, <m> cancelled"); "Nightly jobs outside this app" note; "Errors on this app" client log card (last 20 of up to 500 from GET /api/admin/log?limit=20, kinds error/boundary/rejection/refused/api, "Clear" DELETE, "No errors saved. That is the goal.").

Data: "Recently deleted, <n>" (GET submissions?deleted=1 and call-leads?deleted=1; Table Record, Type, Deleted with "Restore" row action doing PATCH `{ action:'restore', ids }` on the right route; "Deleted records sit here for 30 days, then purge on their own. Restore puts them right back."; "Purge all" confirm "Permanently purge <n> deleted records?" / "This empties Recently deleted immediately. There is no undo after a purge." then POST `{ action:'purge' }` and DELETE call-leads?purgeDeleted=1; empty "Nothing in the bin" / "Deleted leads and submissions wait here for 30 days, then purge on their own."); Import rows "Leads from a spreadsheet" (LeadImport), "Print orders from CSV" (OrdersImport), "Print orders saved on this device" (Preview of vz_print_orders); Export cards Leads, Clients, Projects, Print orders, Purchases ledger (client built CSVs, files "visualize-<type>-<YYYY-MM-DD>.csv") plus Submissions CSV / JSON from /api/admin/export; Backup: "Download backup" (GET /api/admin/backup, "One JSON file of every collection (leads, submissions, projects, orders, concept sets, settings, Stripe events without raw payloads). Last backup <datetime>. Restore is out of scope...").

Danger zone: "Purge deleted now" (danger glow; "Purge all now"), "Sign out" ("Sign out this device", POST /api/admin/logout; note that sign out everywhere requires rotating SESSION_SECRET), "Design system" ("Open design system").

## 13. Data shapes to rebuild (summary)

Lead (call_leads) client fields: stage 'client', clientSince, clientStatus (active|paused|delivered), purchases[] {id,label,amount,at,notes,projectId,source,stripeEventId}, retainer {projectId,planId,amount,status,startedAt,billDay,nextBillAt,cancelAt,stripeSubscriptionId,stripeCancelledAt}, links {website,drive,instagram}, brand {primary,colors[],fontDisplay,fontBody,logoLink,notes}, reviews {nfcCard,nfcGivenAt,googleLink,baseline,latest,asks[],testimonials[]}, showcase (section 4 shape with published, slug, displayName, type, blurb, cover, year, logoUrl, brand, website, instagram, cards, print, featured), planner {enabled,postsPerMonth,welcome,token,tokenCreatedAt,lastViewedAt}.

Project: leadId, name, kind, packageId, custom, stage, stages[], total, schedule[] {id,amount,dueAt,status,ledgerId,label,extra,paidAt}, revisions {max,used,log[] {at,note,extra}}, plan {months,monthly,stripeCancelled,stripeSubscriptionId,stripeCancelledAt}, links {drive}, deliverables[] {id,group,label,done,link}, delivery {driveShared,emailSent,pitchSent,reviewLinkSent,followUpLeadCallbackAt}, monthly[] {month,included,delivered,log[]}, releasedAt, archived, retainer {planId,billDay,startedAt}, createdAt.

Post: leadId, month, date, time, platform, platforms[], format, imageUrl, caption, hashtags, status, note, order, clientNote, clientNoteAt, approvedAt, postedAt, deleted, archived.

Concept set: leadId, title, round, intro, projectId, directions[] {id,name,rationale,order,items[] {id,kind,image,caption,order}}, status, token, sentAt, lastViewedAt, approvedDirectionId, approvedAt, feedback[] {action,directionId,name,note,at}, archived, deleted.

Order: source, leadId, customer {name,email,phone}, items[], subtotal, rush, dueAt, notes, paid {at,ledgerId,amount}, packaging {polyBag,headerCard,usageGuide}, status, projectId, submissionId, importKey, createdAt, archived.

Submission: type, name, business, email, phone, projectType, fields{}, status, read, linkedLeadId, notes, deleted, deletedAt, createdAt.

# Part 4: the backend, data model, integrations and operations


Source of truth for this report: docs/ARCHITECTURE.md, docs/RUNBOOK.md, docs/SECURITY-AUDIT.md, every file under /home/user/website/api, vercel.json, package.json, scripts/mock-server.mjs, the header comments of every script in scripts/, plus src/lib/leadShape.js, src/lib/leads.js (duplicates and merge), src/lib/events.js (Calendly matching), src/lib/cloudinary.js and src/shared/semantics.js (normalizeStage). Nothing was modified.

## 1. Runtime

### Hosting and shape

- Vercel Hobby plan, Node 22 (`engines.node: 22.x`), ESM throughout (`"type": "module"`). One Vite 6 build serves two hosts: admin.visualizeclients.com (the CRM) and visualizestudio.org (the marketing site). Output dir `dist`, build command `npm run build` = `vite build && node scripts/prerender-clients.mjs && node scripts/build-sitemap.mjs`.
- Runtime dependencies that matter to the backend: `mongodb` ^7.5, `web-push` ^3.6.7. Everything else (react, gsap, lenis, xlsx) is frontend.
- Database: MongoDB Atlas. `api/_lib/mongo.js` caches one `MongoClient` promise on `globalThis._vzMongo` per warm instance (`maxPoolSize: 5`, `serverSelectionTimeoutMS: 8000`), db name from the URI path, fallback `visualize`. Throws `MONGODB_URI is not set` when the var is missing.

### Function count and the dispatcher

The Hobby plan caps a deployment at 12 functions. The repo deploys 10:

1. `api/admin/login.js` (standalone, POST)
2. `api/admin/logout.js` (standalone, POST)
3. `api/admin/session.js` (standalone, GET)
4. `api/admin/index.js`: every other admin endpoint. The route name arrives as `?r=<name>`, placed there by one vercel.json rewrite per URL (`/api/admin/call-leads` -> `/api/admin/index?r=call-leads`). A `ROUTES` map wraps each `api/_routes/<name>.js` `handler` in `route()` with its own method list and body cap; unknown `r` is 404 `{ error: 'not found' }`. Underscore-prefixed dirs (`_lib`, `_routes`) are not deployed as functions.
5. `api/cron/[job].js`: `req.query.job` is `reminders` or `daily`; each wrapped in `route(..., { methods: ['GET','POST'], admin: false })`.
6. `api/showcase.js`: public marketing read; also hands `?r=concepts` to `api/_routes/concepts-public.js` (vercel.json rewrites `/api/concepts` -> `/api/showcase?r=concepts`).
7. `api/planner.js`: public client planner.
8. `api/submissions.js`: public form intake.
9. `api/push-key.js`: public VAPID public key.
10. `api/stripe/webhook.js`: signed Stripe webhook (own file because it needs the raw body: `export const config = { api: { bodyParser: false } }`).

Adding an admin endpoint = new file in `api/_routes/`, one line in `index.js`'s ROUTES, one rewrite in vercel.json.

### vercel.json

- Redirects: `/admin/:path*` -> `/` (302) when host is NOT admin.visualizeclients.com; `/work` -> `/clients` and `/work/:slug` -> `/clients/:slug` (308); `/prints` and `/prints/:path*` -> `/` (308).
- Rewrites: 17 admin URL -> `index?r=` rewrites (call-leads, leads/import -> leads-import, submissions, posts, projects, orders, concept-packs, concept-sets, settings, calendly/events -> calendly-events, stripe/events -> stripe-events, stripe/reconcile -> stripe-reconcile, backup, export, push-subscribe, log), `/api/concepts` -> `/api/showcase?r=concepts`, then the SPA catch-all `/(.*)` -> `/index.html`.
- Headers on every host: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()`, `Strict-Transport-Security: max-age=63072000; includeSubDomains`.
- CSP per host (admin, visualizestudio.org, www.visualizestudio.org): `default-src 'self'; script-src 'self' 'sha256-<hash>'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https:; connect-src 'self' [https://api.cloudinary.com on the admin host only]; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`. The admin host also gets `Cache-Control: no-store`. The sha256 is the hash of the one inline pre-paint script in index.html; the `vzCspHash` Vite plugin (vite.config.js) recomputes it on every build and rewrites every `'sha256-...'` in vercel.json, so vercel.json must be committed after a build that changed it.
- Cache-Control: `/assets/(.*)` and `/fonts/(.*)` immutable one year; `/clients/(.*)` `public, max-age=0, must-revalidate` (the prerendered pages); `/sw.js` `no-cache`.
- Crons: `/api/cron/reminders` at `0 13 * * *` (13:00 UTC, 9am Eastern), `/api/cron/daily` at `0 6 * * *`. Hobby allows daily schedules only.

### Environment variables (names only)

`MONGODB_URI` (everything), `SESSION_SECRET` (signs the cookie; required when `VERCEL` is set, otherwise a dev-only constant `visualize-admin-local-dev-only` is used), `ADMIN_PASSWORD` (overrides the constant), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (web push), `WEB3FORMS_NOTIFY_KEY` (email), `CALENDLY_TOKEN` or `CALENDLY_PAT`, `CRON_SECRET`, `STRIPE_SECRET_KEY` (read), `STRIPE_WEBHOOK_SECRET`, `ADMIN_URL` (deep link base for push, default `https://admin.visualizeclients.com`), `VERCEL` (platform set). Build time, public by design: `VITE_MAINTENANCE_MODE`, `VITE_WEB3FORMS_KEY`, `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`. Scripts: `PRERENDER_SHOWCASE_URL`, `OLD_MONGODB_URI`, `NEW_MONGODB_URI`.

### Auth model

- Single admin password. `api/_lib/config.js`: `export const ADMIN_PASSWORD = 'VISLIVE'`; `adminPassword()` returns `process.env.ADMIN_PASSWORD || ADMIN_PASSWORD`. Nothing in the database holds a password. (Security audit finding 15 leaves the 7-letter constant open by design, recommending the env override.)
- Login (`api/admin/login.js`): POST `{ password }`, body cap 4KB (checked via Content-Length and again while streaming). Compare is `timingSafeEqual(sha256(given), sha256(expected))`. Rate limit: key `rate:login:<sha256(ip)>`, 10 failures per 15 minutes, checked BEFORE the body is read; 429 with `Retry-After` seconds; a correct password calls `rateClear`. Success sets the cookie and answers `{ ok: true }`; mismatch 401 `{ error: 'wrong password' }`. A thrown `SESSION_SECRET` error answers 500 `{ error: 'SESSION_SECRET is not set' }`.
- Cookie (`api/_lib/auth.js`): name `vz_admin`, value `${expiresAt}.${hmac}` where `expiresAt` is `Date.now() + 30 days` in ms and hmac is HMAC-SHA256(expiresAt, SESSION_SECRET) base64url. Attributes `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`. `verifySession` parses the cookie (decodeURIComponent wrapped in try; a cookie that fails to decode is no cookie), requires expiry in the future, and compares the hmac with a length check plus `timingSafeEqual`. No database lookup, no renewal, no session generation number: the only way to sign everyone out is rotating `SESSION_SECRET`. `SESSION_DAYS = 30`.
- Logout: sets the cookie with `Max-Age=0`. Session: GET answers `{ ok: true, authed: true }` or 401 `{ ok: false, authed: false, error: 'unauthorized' }`.
- No CSRF token: SameSite=Lax is the cross-site guard; every admin write is POST/PATCH/DELETE; the audit confirmed no admin GET changes anything attackable (settings lazily creating defaults, backup stamping `lastBackupAt`, lazy tombstone purges).
- Client IP: `clientIp(req)` = first `x-forwarded-for` entry, else `x-real-ip`, else socket address, else `'unknown'`.

### route() wrapper (api/_lib/handler.js)

`route(handler, { methods = ['GET'], admin = true, maxBody = 512KB })`. Order: method allow list (405 with `Allow` header, `{ error: 'method not allowed' }`), Content-Length over `maxBody` (413 `{ error: 'request too large' }`; Vercel itself refuses >4.5MB), admin guard (401 `{ error: 'unauthorized' }`), then the handler in one try/catch. A throw logs `[api] METHOD url` plus stack to the Vercel function log and answers 500 `{ error: 'server error' }` if headers were not sent. Public routes pass `admin: false`. (Some callers pass a stale `csrf: false` option that the wrapper ignores.)

Body caps per route: call-leads 1MB, leads-import 2MB, concept-sets 512KB, posts 256KB, settings 64KB, log 16KB, push-subscribe 8KB, stripe-reconcile 4KB, everything else 512KB default; public submissions 128KB, planner 16KB, concepts 16KB, webhook 1MB, login 4KB.

### Rate limiter (api/_lib/limit.js)

One rolling-window limiter stored in the `settings` collection. `rateKey(scope, value)` = `rate:<scope>:<first 32 hex of sha256(value)>`. `rateState(db, key, { max, windowMs })` reads the doc, drops stamps older than the window, returns `{ hits, exceeded, retryAfter }`. `rateHit` upserts `{ $set: { hits: [...hits, now], updatedAt }, $setOnInsert: { createdAt } }` (so the array never exceeds `max` live stamps). `rateClear` deletes the doc. Any read or write failure lets the request through (a Mongo outage must not lock the door). Scopes: `login` (10/15min), `form` (10/hour), `review` (3/hour), `planner` (30 actions/hour per token), `concepts` (30 actions/hour per token).

### Error conventions

Every error is `{ error: 'message' }`. 400 for a bad id or missing required field (ids cast with an `oid()` helper that returns null instead of throwing), 404 for the public doors (byte-identical for every refusal case), 405 with Allow, 409 for a refused state transition, 413 for size, 429 with Retry-After, 500 `server error` with the stack only in the Vercel log, 502 for an upstream (Calendly, Stripe) failure, 503 from the webhook when its secret is unset (so Stripe retries). No route ever returns a secret, a stack, or an env var value.

## 2. Endpoints

Convention for every admin collection route: GET list, POST create, PATCH `{ id, set }` where `set` runs through `sanitize()` and only keys the caller actually sent AND that sanitize did not return `undefined` are written, always as `$set` with `updatedAt: new Date()`. sanitize() is the schema: an unknown key is never written. Nothing is renamed or dropped. Helpers used everywhere: `str(v, max)` = `String(v ?? '').slice(0, max)` (some routes also trim), `num(v, max)` clamps 0..max and returns 0 for non-numbers, enums fall back to a default, `safeUrl(v, max)` (api/_lib/url.js) keeps `http://`, `https://` or a root-relative `/x` (never `//x`), rejects whitespace and control characters anywhere, else `''`.

### Auth

- `POST /api/admin/login` `{ password }` -> Set-Cookie + `{ ok: true }`. Callers: AdminApp login card, AdminCalls.
- `POST /api/admin/logout` -> clears cookie.
- `GET /api/admin/session` -> `{ ok, authed }`.

### call-leads (`api/_routes/call-leads.js`, GET/POST/PATCH/DELETE, 1MB)

- GET: `?deleted=1` first hard-deletes tombstones older than 30 days (`deleteMany({ deleted: true, deletedAt: { $lt: cutoff } })`), then returns `{ items }` of `deleted: true` sorted `deletedAt` desc, limit 200. Otherwise `{ items }` of `deleted: { $ne: true }` sorted `createdAt` desc, limit 500.
- POST: body is one lead or `{ leads: [...] }`. Each runs sanitize(), rows without `business` dropped, undefined keys removed, `createdAt`/`updatedAt` set; a record created with stage `client` or `won` and no `clientSince` gets `clientSince = now ISO` (the Add client flow). Idempotent on `business` name: existing business names are skipped; if an existing lead has no `socials` (missing or `{}`) and the incoming row has some, they are backfilled. Answers `{ ok, inserted, backfilled, skipped }`. 400 `business name required` when nothing survives.
- PATCH `{ action: 'restore', ids: [] }`: `$set: { deleted: false }, $unset: { deletedAt }` on the ids (bad ids dropped). Answers `{ ok, restored }`.
- PATCH `{ id, set, explicit? }`: the stage guard: if `set` carries `stage` and the stored stage is `client` or `won`, and the new stage differs and is not `client`, and `req.body.explicit !== true`, answer 409 `{ error: 'Client|Won records only leave that stage through an explicit action.', stage }` and touch nothing. Then: `allowed` = sent keys with defined sanitized values; empty -> 400 `nothing to update`. If `allowed.stage` is `client` or `won` and no non-empty `clientSince` was sent and the record has none, stamp `clientSince = now ISO`. Planner: the `planner` object is full replacement, so the handler carries `token`, `tokenCreatedAt`, `lastViewedAt` forward from the stored record; mints a new token (`randomBytes(24).toString('base64url')`, 32 chars) only when the record has none or `set.planner.regenerate === true` (the revoke). Showcase: when `allowed.showcase` is present, resolve the slug: use the sent slug; if empty and `published`, `slugify(displayName || business)`; if still empty keep the old slug (never wipe); then ensure uniqueness among OTHER published clients (`_id: { $ne }`, `showcase.published: true`, `showcase.slug`), appending `-2`, `-3`... unless the caller chose that exact slug, in which case 409 `That URL is already in use by another published client.`; stamps `showcase.updatedAt`; answers `{ ok, slug }`. Otherwise `updateOne({ _id }, { $set: allowed })` -> `{ ok: true }`.
  Note: a grep of src/ finds no caller sending `explicit: true`. LeadDetail's Won dialog patches `{ stage: 'client', clientSince, bookedOutcome: { result: 'won', ... } }` (allowed since the target is `client`) and the Lost dialog patches `{ stage: 'lost', bookedOutcome: {...} }` without the flag, so as written today a record already at client/won cannot be moved to lost from the UI (409). A rebuild should decide whether the outcome dialogs send `explicit: true`.
- DELETE: `?purgeDeleted=1` hard deletes every tombstone -> `{ ok, purged }`. Otherwise `?id=` or `?ids=a,b,c` soft delete: `$set: { deleted: true, deletedAt: now, deletedReason: 'merged' }` (reason only when `?reason=merged`, sent by the duplicates merge) -> `{ ok, deleted }`.

sanitize() whitelist (full replacement for nested objects; a key absent from the request stays `undefined` and is not written):
- `business` str 200, `industry` 80, `descriptor` 400, `phone` 40, `phoneNote` 200, `email` 200, `area` 160, `serviceInterest` 200, `sourceId` 120 (only when truthy), `notes` 3000, `askFor` 200, `bestWindow` 300, `callbackAt` 40 (ISO), `angle` 1200, `address` 300, `prepNotes` 3000, `clientSince` 40, `mergedInto` 64, `calendlyEventUri` 200.
- `priority` in `['hot','warm','cold']` default `warm`; `callStatus` in `['not-called','callback','no-answer','booked','no','wrong-number']` default `not-called`; `stage` in `['lead','booked','won','client','lost']` else undefined (never written); `clientStatus` in `['active','paused','delivered']` else `''`.
- `beforeYouDial` string array (30 x 600). `script { confirm 400, intro 600, homework 600, question 400, likelyAnswers [{say 300, respond 800}] x12, hook 800, ask 400 }`. `objections` [{say, respond}] x12. `close { lockIt 600, ifNo 600, noAnswer 400 }`. `afterCall { meeting 300, email 200, whatTheySaid 3000, nextAction 600 }`. `intel { accomplishments[], gaps[], dropLines[] }` each 30 x 600.
- `socials`: normalized map over keys `website, instagram, facebook, tiktok, google, yelp, linkedin, x, youtube`; `normalizeSocial` turns a handle or bare domain into a full https URL per platform (e.g. `@foo` -> `https://instagram.com/foo`, google -> a maps search URL); empty values omitted.
- `callLog` last 200 of `{ at 40, outcome (call status enum, default no-answer), note 1000, meeting 300, email 200 }`. `contactLog` last 200 of `{ type in ['call','meeting','email','text','other'], at 40, note 600 }`.
- `meeting { date 10, time 5, type in ['call','video','in-person'] default call, location 300 }`.
- `concepts` up to 30 `{ id 40, label 120, status in ['planned','generating','ready','shown'], link safeUrl, packId 64 (optional) }`. `gamePlan` up to 40 `{ serviceId 60, checked bool, note 300 }`. `servicesPlanned` up to 30 strings 60. `pricingOptions` up to 3 `{ id 40, packageId 40, addonIds[12] 40, retainerId 40, recommended bool, note 600, label 80, price 0..100000, plan in ['full','6mo','12mo'], retainer 200, notes 600 }`. `conceptsTracker { items[20]{label 120, done}, demoUrl safeUrl, driveUrl safeUrl }`.
- `checklists` up to 10 `{ name 80, items[50]{ text 300, done } }`.
- `purchases` up to 200 `{ label 160, amount 0..1000000, at 40, notes 400, id 40?, projectId 64?, source 20?, stripeEventId 80? }` (the ledger).
- `links { website, drive, instagram }` all safeUrl 400.
- `brand { primary 20, colors[4] 20, fontDisplay 120, fontBody 120, logoLink safeUrl, notes 600 }`.
- `showcase` via sanitizeShowcase: `published` bool, `slug` slugified (a-z0-9 and single hyphens, 80), `displayName` 200, `type` 80, `blurb` 200, `cover` img, `year` 10, `logoUrl` img, `brand { enabled (default true), logo { light, dark } img, images[12]{ link img, caption 200 }, notes 600 }`, `website { enabled, url safeUrl, screenshots[8]{link,caption}, notes }`, `cards { enabled, front, back, notes }`, `print { enabled, items[12]{ label 120, image, caption 200 }, notes }`, `instagram { enabled (default false), handle 60 without @, url, profileImage, posts[9]{ link, image, caption }, highlights[10]{ id 40, label 40, image, link }, notes }`, `featured { landing, logoStrip, work bools, order int }`.
- `planner { enabled bool, postsPerMonth 0..60 default 8, welcome 300 }` and nothing else from the request.
- `retainer { projectId 64, planId 40, amount 0..100000, status in ['active','paused','ending','cancelled'] default active, startedAt 40, billDay 1..28, nextBillAt 40, cancelAt 40, stripeSubscriptionId 80, stripeCancelledAt 40 }`; `retainer: null` clears it.
- `reviews { nfcCard bool, nfcGivenAt 40, googleLink safeUrl, baseline { count, rating 0..5, at } | null, latest same | null, asks last 200 { at, channel in ['nfc','text','email','in-person'], result in ['asked','left','declined'], note 400 }, testimonials[100]{ id 40 (random if missing), quote 400, author 120, role 120, rating 1..5 | null, source in ['nfc','text','email','in-person','website','google'] default text, published, featured, order int, at 40 } }`.
- `bookedOutcome { result in ['won','lost'] default lost, reason 600, at 40 }`.

### leads-import (`POST /api/admin/leads/import`, 2MB)

Body `{ rows: [] }` from the spreadsheet mapper (LeadImport component, xlsx parsed in the browser). Max 5000 rows (413). Loads every existing lead (including tombstones) once. `rowToFields`: `sourceId` (row.id), `business`, `askFor` (row.owner), `phone`, `email`, `area`, `industry`, `serviceInterest`, `descriptor` = industry, area, service_interest joined with " · ", `priority` normalized, `callStatus` from a synonym map (new/notcalled -> not-called, meeting -> booked, denied/dead -> no, voicemail -> no-answer), `angle`, `notes`, `socials` (website, instagram, facebook, google). Matching: by `sourceId` first, else lowercased business name where the phone last-10 digits agree or one side has no phone. A match that is soft-deleted is skipped ("previously deleted, left alone"). A match is updated with only non-empty row fields; `priority` and `callStatus` are written only when the record is NOT stage client/won; `stage` is never touched; socials merge. A new row gets `buildSkeleton()` (the default call script: beforeYouDial, script, objections, close, afterCall, intel) plus timestamps. Answers `{ ok, created, updated, skipped: [{ business, reason }] }`.

### submissions admin (`api/_routes/submissions.js`, GET/PATCH/DELETE)

- GET: lazy purge of tombstones older than 30 days. `?id=` -> `{ submission }` (400 bad id). `?deleted=1` -> tombstones. Filters `status`, `type`, `days`, `q` (escaped regex on name/business/email). Answers `{ items (limit 300), unread, total, deletedCount, counts by status, typeCounts, series }` where series is 8 weekly buckets `{ total, landed }`.
- PATCH `{ action: 'restore', ids }` or `{ id, set }` where allowed keys are `status` (in the union of LEAD_STATUS_IDS `new, contacted, replied, landed, denied` and legacy ORDER_STATUS_IDS `new, paid, in-production, packaged, delivered`), `read` bool, `notes` string 5000, `socials` normalized, `linkedLeadId` string 64 (`''` unlinks).
- DELETE `?ids=` or `{ ids }` soft delete.

### posts (`api/_routes/posts.js`, GET/POST/PATCH/DELETE, 256KB)

- GET: `deleted != true`; `?archived=1` or not archived; `?leadId`; `?month=YYYY-MM`; with neither leadId nor month, `month: { $in: [this month, next month] }` (UTC). Sort date, order, time; limit 1000.
- POST requires `leadId` and `month`; defaults `date '', time '', platform 'instagram', platforms ['instagram'], format 'portrait', imageUrl '', caption '', hashtags '', status 'making', note '', clientNote '', clientNoteAt '', approvedAt '', postedAt '', order 0, archived false`.
- PATCH: `leadId` deleted from allowed (a post never moves). DELETE `{ id }` or `?id=` soft.
- sanitize: `leadId` 64, `month` must match `^\d{4}-\d{2}$` else `''`, `date` `^\d{4}-\d{2}-\d{2}$`, `time` `^([01]\d|2[0-3]):[0-5]\d$`, `platforms` deduped subset of `['instagram','facebook','tiktok','other']` max 4, default `['instagram']`; `platform` single (legacy), `format` in `['portrait','story']` default portrait, `hashtags` normalized (split on whitespace, one leading `#`, deduped case-insensitively, joined by single spaces, 500), `imageUrl` safeUrl 600, `caption` 2200 (not trimmed), `status` in `['making','review','approved','posted']`, `note` 500, `clientNote` 500, `clientNoteAt` 40, `approvedAt` 40, `postedAt` 40, `order` 0..1000 int, `archived` bool.

### projects (`api/_routes/projects.js`, GET/POST/PATCH)

- GET `?leadId`, `?archived=1`; sorted createdAt desc, limit 1000. POST requires `leadId` and `name`; defaults `stage 'kickoff', schedule [], deliverables [], monthly [], archived false`. PATCH deletes `leadId`.
- sanitize: `name` 160, `kind` in `['brand','web','combined','print','retainer']` default brand, `packageId` 40, `custom { name 160, total num } | null`, `stage` in `['kickoff','design','revisions','build','delivery','delivered']`, `stages` filtered enum max 8, `total` num, `schedule[120]{ id 40, amount, dueAt 10, status in ['paid','due','past-due','upcoming'] default upcoming, ledgerId 40, label 120, paidAt 40, extra bool }`, `revisions { max 0..20, used 0..50, log last 50 { at, note 600, extra } }`, `plan { months 0..60, monthly, stripeCancelled bool, stripeSubscriptionId 80, stripeCancelledAt 40 } | null`, `links { drive }` safeUrl, `deliverables[60]{ id 40, group 8, label 120, done, link safeUrl }`, `delivery { driveShared, emailSent, pitchSent, reviewLinkSent bools, followUpLeadCallbackAt 40 }`, `releasedAt` 40, `monthly` last 60 `{ month 7, included 0..1000, delivered 0..10000, log last 100 { at, count, note 400 } }`, `retainer { planId 40, billDay 1..28, startedAt 40 }`, `archived`.

### orders (`api/_routes/orders.js`, GET/POST/PATCH)

- GET `?status=<print status>`; `{ items (not archived, limit 1000), unimported }` where unimported counts live `shop-order` submissions with no order carrying their `submissionId`. POST `{ action: 'import-submissions' }` creates orders for those via `orderFromSubmission` -> `{ ok, created }`. POST an order requires `customer.name` or `leadId`; defaults `source 'walk-in', status 'new', items [], subtotal 0, rush false, notes '', paid null`. PATCH deletes `submissionId`.
- sanitize: `source` in `['shop','client','walk-in','import']`, `status` in `['new','designed','cut','packed','delivered','cancelled']`, `leadId` 64, `projectId` 64, `submissionId` 64, `customer { name 200, email 200, phone 60 }`, `items[60]{ id 40, productId 40, name 160, label 200, qty 1..100000, options (max 20 entries, key 40, value 200), artworkLink safeUrl, priceTotal num | null, quote bool }`, `subtotal`, `rush`, `dueAt` 10, `notes` 3000, `paid { at 40, ledgerId 40, amount } | null`, `packaging { polyBag, headerCard, usageGuide }`, `importKey` 200, `archived`.
- `api/_lib/orders.js`: `parseItemsString` splits the shop's `Items` field on `|`, then each part on a spaced dash into name, label, price (`$` amount, else a quote), qty from `qty:`/`x`/leading number, default 1; `orderFromSubmission` builds `{ source 'shop', status 'new', submissionId, leadId: linkedLeadId, customer, items, subtotal, rush false, dueAt = created + 7 days, paid null }`.

### concept-packs (`api/_routes/concept-packs.js`, GET/POST/PATCH; retired UI, kept readable)

GET `?leadId`, `?industryKey`, `?kind`; POST requires `title`. sanitize: `title` 160, `leadId` 64, `industryKey` 80 lowercased, `kind` in the 10 CONCEPT_KIND_IDS default other, `prompts[40]{ id, label 120, text 6000 }`, `images[60]{ id, label 120, link safeUrl 600 }`, `tags` deduped lowercase 30 x 40, `notes` 3000, `usedFor` last 200 deduped, `lastUsedAt` 40, `archived`.

### concept-sets (`api/_routes/concept-sets.js`, GET/POST/PATCH/DELETE, 512KB)

- GET `?leadId` or every live set (`deleted != true`), sorted updatedAt desc, limit 500. POST requires `leadId`; the server forces `status 'draft', feedback [], approvedDirectionId '', approvedAt ''`, mints `token` (24 random bytes base64url), `tokenCreatedAt`, `lastViewedAt ''`, `sentAt ''`; default `title 'Brand directions', round 1, intro '', directions [], projectId '', archived false`. PATCH `{ id, set, regenerate? }`: `regenerate: true` mints a new token and `tokenCreatedAt` (the revoke); moving to `sent` from any other status stamps `sentAt`; 404 when the set is gone. DELETE soft with `deletedAt` and `updatedAt`.
- sanitize: `leadId` 64, `title` 120, `round` 1..99, `intro` 600, `status` in `['draft','sent','viewed','approved','changes','archived']`, `directions` max 6 `{ id 40 (random if missing), name 80, rationale 600, items max 12 { id, kind in ['logo','board','mockup','social','web','print','other'], image safeUrl 600, caption 200, order }, order }`, `feedback` last 200 `{ id, at, directionId | null, action in ['approve','change','note'], note 1000, name 80 }` (accepted from admin only for migrations), `approvedDirectionId` 40, `approvedAt` 40, `projectId` 64, `archived`. Token fields are never writable.

### settings (`api/_routes/settings.js`, GET/POST/PATCH, 64KB)

- GET lazily upserts `dashboard` and `landing` docs with defaults, reads `prefs`, `notifications`, `profile`, `health`, computes `stripeHealth`, and answers `{ notifications, profile, health | null, stripe { configured, webhookConfigured, lastWebhookAt, unmatched }, cron { configured }, calendly { configured }, reminders { configured, push }, prefs { pushEnabled, emailEnabled }, dashboard { dailyCallTarget 1..500 default 25, dashboardLayout object | null }, landing }`.
- PATCH `{ set }` (or a bare body): `dailyCallTarget`, `dashboardLayout` -> `dashboard` doc; `profile { name 80 default 'Rob', businessHours { start, end } HH:MM default 09:00/17:00, theme in system|dark|light default dark, reduceMotion }` merged into `profile`; `notifications { readIds (last 500 strings), lastSeenAt string|null, snoozedUntil (map of string values, last 200), reminders { meetings, callbacks, bills, reviews } }`; `landing { stats { toggles { clientsServed, projectsDelivered, averageRating, years }, overrides (finite numbers only; null/'' clears) } }` merged.
- POST `{ action }`: `prefs` `{ pushEnabled, emailEnabled }` upsert; `test-push` sends "Visualize test / Push reminders reach this device." to every subscription; `purge` hard deletes soft-deleted submissions. (The old `password` action no longer exists.)

### stripe-events (`GET /api/admin/stripe/events`)

`?stored=1` (`?unmatched=1` narrows to payment types with `matchedLeadId: ''`) returns stripe_events rows without `raw`, sorted `at` desc, limit 200. Otherwise, with `STRIPE_SECRET_KEY`, `?days` 1..90 (default 30) fetches `/v1/events` filtered to the six handled types (5 minute in-memory cache keyed on URL), normalizes each, and annotates `stored`, `matchedLeadId`, `ledgerId`. Unconfigured -> 200 `{ configured: false, events: [] }`; Stripe error -> 502.

### stripe-reconcile (`POST /api/admin/stripe/reconcile`, 4KB)

`{ eventId, leadId }`: finds the stored event and the lead, runs `applyPayment` (same as the webhook), stamps `matchedLeadId`, `ledgerId`, `reconciledAt` on the event. `{ ok, ledgerId, already }`.

### backup (`GET /api/admin/backup`)

Dumps `call_leads, submissions, projects, orders, concept_packs, settings, stripe_events` (limit 20000 each) as `{ app: 'visualize-admin', version: 1, createdAt, collections }`, filename `visualize-backup-YYYY-MM-DD.json`. Leaves out `push_subscriptions`, `stripe_events.raw`, settings docs matching `^rate:` and `client-log`. Note: `concept_sets` and `posts` are NOT in the COLLECTIONS list, a gap to close in a rebuild. Stamps `health.lastBackupAt`. No in-app restore: restore is a hand import into Atlas.

### export (`GET /api/admin/export`)

`?type=submissions|orders` (orders = `type: 'shop-order'`, submissions = everything else), `?format=csv|json`, `?status`, `?q`, `?days`; limit 5000. CSV: BOM, RFC 4180 quoting, fixed columns (Date, Type, Project Type, Name, Business, Email, Phone, Status, Read, Notes, nine social columns) then the union of every `fields` key.

### log (`/api/admin/log`, GET/POST/DELETE, 16KB)

Settings doc `client-log`. GET `?limit` (1..500, default 20) newest first. POST `{ kind in ['error','boundary','rejection','refused','api'] default error, message 500 (required), stack 2000, url 300, at ISO }` plus server-side `ua` 200 and `receivedAt`; `$push` with `$slice: -500`. DELETE empties `items`.

### push-subscribe (`POST /api/admin/push-subscribe`, 8KB)

`{ subscription }` with an `endpoint`; upsert on `subscription.endpoint` into `push_subscriptions` `{ subscription, updatedAt }`.

### calendly-events (`GET /api/admin/calendly/events?from&to`)

Token from `CALENDLY_TOKEN` or `CALENDLY_PAT`; none -> `{ configured: false, events: [] }`. Default range now-7d to now+30d; bad dates 400. 5 minute in-memory cache keyed on the hour-truncated range. Calls `GET /users/me`, then `GET /scheduled_events?user=&status=active&sort=start_time:asc&min_start_time&max_start_time&count=100`, then for each event `GET /scheduled_events/{id}/invitees?count=1`. Each event becomes `{ uri, at, end, name, email, phone (from a Q&A whose question matches phone|number|cell, else text_reminder_number), eventType, join (location.join_url or location.location) }`. Upstream failure 502.

### showcase (public, `GET /api/showcase`, `?slug=`)

No auth, no CORS header (same-origin only), `Cache-Control: public, max-age=60, stale-while-revalidate=300`. Reads `call_leads` with `showcase.published: true`. Without a slug: `{ clients: [publicClient...] sorted by featured.order then updatedAt desc, landing }`. With a string slug: one `publicClient` or 404. `publicClient` is the exact whitelist: `slug, displayName (showcase.displayName || business), type (|| industry), blurb, cover, year, brand { enabled, logo (brand.logo.dark || .light || logoUrl), palette (computed from lead.brand.primary and colors), typography (from lead.brand.fontDisplay/fontBody), images, notes }, website { enabled, url (showcase || socials.website || links.website), screenshots, notes }, instagram { enabled, handle (typed or parsed from URL), url (showcase || socials.instagram), profileImage, posts[9], highlights[10], notes }, cards { enabled, front, back, notes }, print { enabled, items, notes }, featured { landing, logoStrip, work, order }, testimonials (published only, sorted, { quote, author, role, rating, source }), socials { instagram, facebook, website }, googleReview`. `landing` = `logoStrip` (featured.logoStrip, sorted), `work` (featured.work, max 6, falls back to the newest 6 published), `testimonials` (published AND featured across clients, max 6), `stats` = `computeStats`: `clientsServed` = count of stage client, `projectsDelivered` = projects with stage delivered, `averageRating` = mean of published testimonial ratings (1 decimal) or null, `years` = current year minus earliest published `clientSince` year (min 1); each overridable or hidden through the `landing` settings doc.

### planner (public, `api/planner.js`, GET/POST, 16KB)

`Cache-Control: no-store`. Token must match `^[A-Za-z0-9_-]{16,64}$`. `clientFor` finds `call_leads` by `planner.token` with `deleted != true` and `planner.enabled === true` under a projection of only `business, showcase.displayName, planner.enabled/welcome/postsPerMonth/lastViewedAt`. Any failure = 404 `{ error: 'not found' }`. GET `?month` (default current UTC month) -> `{ client { displayName, welcome, postsPerMonth }, month, posts[] }` where each post is `{ id, date, time, platforms[], format, hashtags, imageUrl, caption, status, note, clientNote }`, every live post in the month including `making`; stamps `planner.lastViewedAt` at most hourly. POST `{ postId, action, note }` after the 30/hour limiter: post looked up with `leadId` inside the filter; `approve` requires status `review` -> `approved`, `approvedAt`; `request-change` requires `review` and a note (500) -> `making`, `clientNote`, `clientNoteAt`; wrong status 409, unknown action 400.

### concepts public (`/api/concepts`, GET/POST, 16KB, via showcase.js)

Same token rule. `LIVE` filter: `deleted != true, archived != true, status in [sent, viewed, approved, changes]` (a draft never resolves). GET: if status is `sent` set `viewed`; stamp `lastViewedAt` at most hourly; answer `{ client { displayName }, set { title, round, intro, status, approvedDirectionId }, directions[{ id, name, rationale, items[{ id, kind, image, caption }] }] sorted by order, feedback[{ at, directionId, action, name }] }` (feedback notes never returned). POST after the 30/hour limiter: `note` appends `{ at, directionId, action, name, note }` (`$push` with `$slice: -200`; a directionId must exist in the set or 404; a general note requires text); `approve`/`change` require a directionId (404 without), `change` requires a note, set must be in `sent|viewed|changes` (else 409 `This set is already decided.`); the update filter includes `directions.id` and the open statuses so a foreign direction or a race matches nothing; approve sets `status approved, approvedDirectionId, approvedAt`, change sets `status changes`.

### submissions public (`POST /api/submissions`, 128KB)

Body `{ type, projectType, name, business, email, phone, fields, rating, text, slug, company }`. `clean()` strips control chars except newline/tab. `name` required; `email` required and valid unless `type === 'review'` (optional there but validated when present). Reviews require `rating` 1..5 and `text`. `type` in `['start','shop-order','contact','review']` else `other`. `fields` normalized: max 40 keys, key `^[A-Za-z0-9 _.\-]{1,60}$`, values strings 3000 (arrays joined ", ", objects JSON). Reviews add `fields.rating`, `fields.text` (3000), `fields.slug` (a-z0-9-). Honeypot: a non-empty `company` answers 200 `{ ok: true }` and stores nothing. Limiter: `review` 3/hour, `form` 10/hour per hashed IP. Inserts `{ type, projectType 60, name, business 200, email, phone 60, fields, status 'new', read false, notes '', createdAt }`. A `shop-order` also inserts an `orders` doc (best effort). Then, unless `settings.prefs` disables them, push and email in parallel (see Integrations). Answers `{ ok, id }`.

### push-key (`GET /api/push-key`)

`{ key: VAPID_PUBLIC_KEY || null }`.

### Stripe webhook (`POST /api/stripe/webhook`, 1MB, raw body)

503 when `STRIPE_WEBHOOK_SECRET` is unset. `verifyStripeSignature(raw, 'Stripe-Signature' header, secret, 300s)`: parses `t=` and `v1=`, rejects a timestamp outside 300 seconds, HMAC-SHA256 of `${t}.${raw}` compared with timingSafeEqual; failure 400 `bad signature`. Bad JSON or no `id`/`type` 400. Types outside the six handled answer 200 `{ ok, ignored }`. Otherwise `ingestEvent`, then `$set health.stripe.lastWebhookAt`, answer `{ ok, duplicate, matched }`.

### Crons

`GET|POST /api/cron/reminders` and `/api/cron/daily`. Auth: `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret` header, compared as sha256 + timingSafeEqual; missing secret or mismatch 401. Details in section 6.

## 3. Collections and document shapes

All `_id`s are Mongo ObjectIds except `settings` (string ids) and `stripe_events` (ObjectId `_id` plus a unique string `id`). Cross-references (`leadId`, `projectId`, `submissionId`, `linkedLeadId`) are stored as strings. `createdAt`/`updatedAt` are Date objects; most business timestamps (`clientSince`, `callbackAt`, `at` fields, `sentAt`, `lastViewedAt`) are ISO strings; `dueAt`, `date`, `meeting.date` are `YYYY-MM-DD` strings; `month` is `YYYY-MM`. Soft delete convention: `deleted: true, deletedAt: Date` (call_leads may add `deletedReason: 'merged'`); "Recently deleted" = `?deleted=1`; restore `$set deleted:false, $unset deletedAt`; lazy hard purge after 30 days on the call-leads and submissions GET; manual purge via call-leads DELETE `?purgeDeleted=1` and settings POST `purge`. `archived: true` is a separate, non-destructive hide used by projects, orders, posts, concept_packs, concept_sets.

### call_leads

The lead, booked, and client record. Fields (type, meaning):
- Identity and contact: `business` string (the key used for POST dedupe), `industry`, `descriptor`, `phone`, `phoneNote`, `email`, `area`, `address`, `askFor` (contact name), `bestWindow`, `serviceInterest`, `sourceId` (scraper id), `socials {website, instagram, facebook, tiktok, google, yelp, linkedin, x, youtube}` full URLs.
- Pipeline: `stage` one of lead|booked|won|client|lost (may be missing on old records; a background job has been seen to write `''`), `priority` hot|warm|cold, `callStatus` not-called|callback|no-answer|booked|no|wrong-number, `callbackAt` ISO, `clientSince` ISO, `clientStatus` active|paused|delivered|'' , `bookedOutcome {result won|lost, reason, at}`, `stageHeals {count, lastAt, lastRules[]}` (written by the daily heal), `mergedInto` (losing duplicate points at the winner), `calendlyEventUri`.
- Call prep: `angle`, `beforeYouDial[]`, `script {confirm, intro, homework, question, likelyAnswers[{say,respond}], hook, ask}`, `objections[{say,respond}]`, `close {lockIt, ifNo, noAnswer}`, `afterCall {meeting, email, whatTheySaid, nextAction}`, `intel {accomplishments[], gaps[], dropLines[]}`, `notes`, `prepNotes`, `checklists[{name, items[{text, done}]}]`.
- History: `callLog[{at, outcome, note, meeting, email}]` (last 200), `contactLog[{type, at, note}]` (last 200).
- Meeting: `meeting {date YYYY-MM-DD, time HH:MM, type call|video|in-person, location}`.
- Sales: `concepts[{id,label,status,link,packId}]` (legacy), `conceptsTracker {items[{label,done}], demoUrl, driveUrl}`, `gamePlan[{serviceId, checked, note}]`, `servicesPlanned[]`, `pricingOptions[]` (max 3).
- Money: `purchases[{id, label, amount, at YYYY-MM-DD or ISO, notes, projectId, source ('stripe' when from the webhook), stripeEventId}]` the ledger; `retainer {projectId, planId, amount, status active|paused|ending|cancelled, startedAt, billDay 1..28, nextBillAt, cancelAt, stripeSubscriptionId, stripeCancelledAt}`.
- Client: `links {website, drive, instagram}`, `brand {primary, colors[], fontDisplay, fontBody, logoLink, notes}`, `reviews {nfcCard, nfcGivenAt, googleLink, baseline {count, rating, at}, latest {...}, asks[{at, channel, result, note}], testimonials[{id, quote, author, role, rating, source, published, featured, order, at}]}`.
- Public site: `showcase {published, slug, displayName, type, blurb, cover, year, logoUrl, brand {enabled, logo {light, dark}, images[], notes}, website {enabled, url, screenshots[], notes}, cards {enabled, front, back, notes}, print {enabled, items[], notes}, instagram {enabled, handle, url, profileImage, posts[], highlights[], notes}, featured {landing, logoStrip, work, order}, updatedAt}`.
- Planner: `planner {enabled, token (32 char base64url, server only), tokenCreatedAt, lastViewedAt, postsPerMonth, welcome}`. Absent planner = disabled.
- External writers: `enrichment {lastScanAt, scanCount, ...}` written by the nightly enricher outside this repo; `sourceId` by the scraper.
- Housekeeping: `deleted`, `deletedAt`, `deletedReason`, `createdAt`, `updatedAt`.
Derived fields (docs/UX-AUDIT.md): `showcase.displayName` overrides `business`; `showcase.website.url` and `links.website` derive from `socials.website`; `showcase.instagram.url/handle` and `links.instagram` from `socials.instagram`; `brand.logoLink` superseded by `showcase.logoUrl`; `planner.postsPerMonth` written from the retainer plan when on a retainer.

### submissions

`type` start|contact|review|shop-order|other, `projectType`, `name`, `business`, `email`, `phone`, `fields {}` flat string map (reviews: rating, text, slug), `status` new|contacted|replied|landed|denied (legacy order statuses accepted), `read` bool, `notes`, `socials {}`, `linkedLeadId` string, `deleted`, `deletedAt`, `createdAt`.

### projects

`leadId` string, `name`, `kind` brand|web|combined|print|retainer, `packageId`, `custom {name, total} | null`, `stage` kickoff|design|revisions|build|delivery|delivered, `stages[]`, `total`, `schedule[{id, amount, dueAt, status paid|due|past-due|upcoming, ledgerId, label, paidAt, extra}]`, `revisions {max, used, log[{at, note, extra}]}`, `plan {months, monthly, stripeCancelled, stripeSubscriptionId, stripeCancelledAt} | null` (payment plans), `links {drive}`, `deliverables[{id, group, label, done, link}]`, `delivery {driveShared, emailSent, pitchSent, reviewLinkSent, followUpLeadCallbackAt}`, `releasedAt` ISO (drives the review-ask reminder), `monthly[{month, included, delivered, log[{at,count,note}]}]` (retainer output), `retainer {planId, billDay, startedAt}`, `archived`, `createdAt`, `updatedAt`.

### posts

`leadId`, `month`, `date`, `time`, `platforms[]`, `platform` (legacy single), `format` portrait|story, `imageUrl`, `caption`, `hashtags` (normalized string), `status` making|review|approved|posted, `note` (Rob), `clientNote`, `clientNoteAt`, `approvedAt`, `postedAt`, `order`, `archived`, `deleted`, `deletedAt`, `createdAt`, `updatedAt`.

### orders

`source` shop|client|walk-in|import, `status` new|designed|cut|packed|delivered|cancelled, `leadId`, `projectId`, `submissionId`, `customer {name, email, phone}`, `items[{id, productId, name, label, qty, options {}, artworkLink, priceTotal | null, quote}]`, `subtotal`, `rush`, `dueAt`, `notes`, `paid {at, ledgerId, amount} | null`, `packaging {polyBag, headerCard, usageGuide}`, `importKey`, `archived`, `createdAt`, `updatedAt`.

### concept_packs (retired UI)

`title, leadId, industryKey, kind, prompts[{id,label,text}], images[{id,label,link}], tags[], notes, usedFor[], lastUsedAt, archived, createdAt, updatedAt`.

### concept_sets

`leadId, title, round, intro, status draft|sent|viewed|approved|changes|archived, token, tokenCreatedAt, lastViewedAt, sentAt, directions[{id, name, rationale, items[{id, kind, image, caption, order}], order}], feedback[{id?, at, directionId | null | '', action, note, name}], approvedDirectionId, approvedAt, projectId, archived, deleted, deletedAt, createdAt, updatedAt`.

### stripe_events

Unique index on `id`. `id, type, amount (dollars), currency, customerEmail, customerName, customerPhone, description, subscriptionId, paymentLinkId, at ISO, raw (JSON string trimmed to 4000), matchedLeadId '', ledgerId '', receivedAt Date, processedAt Date | null, reconciledAt`.

### push_subscriptions

`{ subscription: <PushSubscription JSON with endpoint, keys>, updatedAt }`, one per browser endpoint; pruned on 404/410 from the push service.

### settings (string `_id`)

- `prefs {pushEnabled, emailEnabled}` (missing = true).
- `dashboard {dailyCallTarget 25, dashboardLayout null, createdAt, updatedAt}`.
- `notifications {readIds[] (500), lastSeenAt, snoozedUntil {}, sentReminderKeys[] (500), lastReminderAt, reminders {meetings, callbacks, bills, reviews}}`.
- `profile {name 'Rob', businessHours {start '09:00', end '17:00'}, theme 'dark', reduceMotion false}`.
- `landing {stats {toggles {clientsServed, projectsDelivered, averageRating, years}, overrides {}}}`.
- `health {enrichment {lastScanAt, leadsScannedLast24h, fieldsFilledLast24h}, scraper {lastInsertAt, insertedLast24h, insertedLast7d}, crons {reminders {lastRunAt, checked, sent}, daily {lastRunAt, rolled, cancelled, extended, healed, stamped, healedRecords[{id, business, at, count, rules}] (last 50, 30 days)}}, stripe {lastWebhookAt, unmatched}, lastBackupAt, updatedAt}`.
- `client-log {items[{kind, message, stack, url, at, ua, receivedAt}] (500)}`.
- `rate:login:<hash>`, `rate:form:<hash>`, `rate:review:<hash>`, `rate:planner:<hash>`, `rate:concepts:<hash>`: `{hits[], createdAt, updatedAt}`.

## 4. Pipeline semantics

- `normalizeStage(lead)` (src/shared/semantics.js): returns `lead.stage` when it is one of the five ids; otherwise `booked` if `callStatus === 'booked'` (legacy fallback), else `lead`. Nothing else derives position. Screens count Clients as stage client plus won.
- The stage guard (call-leads PATCH): a record at `client` or `won` refuses any PATCH that lowers the stage unless `explicit: true` is on the body (409, untouched). Moving to `client` is always allowed. Imports never write stage and, on a settled record, never write priority or callStatus.
- `clientSince` is stamped by the PATCH (move to client/won without one), the POST (created as client/won), the Won dialog (sends its own `at`), the daily heal, and the daily backfill (`earliestClientSince` = earliest of first purchase `at`, first project `createdAt`, or `updatedAt`). `scripts/backfill-client-since.mjs` applies the same rule on demand (report first, `--apply`).
- The daily heal (`api/_lib/pipeline.js` + cron-daily 1b): any live record whose `stage` is not one of the five and that satisfies any `CLIENT_EVIDENCE` rule (clientSince set, `bookedOutcome.result === 'won'`, `showcase.published === true`, has a project, has a purchase, `planner.enabled === true`, has a testimonial) is set back to `stage: 'client'`, `stageHeals` incremented with the rules, `clientSince` stamped if missing, and the heal listed in `health.crons.daily.healedRecords` (the drawer shows "X was restored to Clients"; more than two heals on one record flags an upstream writer).
- Lead shape normalizer (`src/lib/leadShape.js` `normalizeLead`): coerces STRING_FIELDS to strings (`asString`: arrays joined, objects read name/label/value/text), ARRAY_FIELDS to arrays (parses a JSON string starting with `[`), OBJECT_FIELDS to objects (parses `{`), fixes `intel`, `script.likelyAnswers`, `reviews.asks/testimonials`, sets an unknown `stage` to `''`, unknown `priority` to `warm`, unknown `callStatus` to `not-called`. Applied on every list load and again in LeadCard/LeadDetail; `scripts/repair-leads.mjs` applies the same to stored records.
- Imports: two paths. `POST /api/admin/call-leads` with `leads[]` (a bundled JSON import) dedupes by exact business name and backfills socials. `POST /api/admin/leads/import` (spreadsheet) matches by sourceId then business name plus phone, updates provided fields, leaves tombstoned matches alone, creates new records with the call-script skeleton.
- Duplicates and merge (client side, src/lib/leads.js): `findDuplicates` groups by last-10 phone digits and by `industryKey|normalized business name` with union-find. `mergePayload(winner, loser, choices)` picks contested fields (phone, askFor, descriptor, priority, socials) per choice, unions and dedupes `callLog`, `contactLog`, `purchases`, concatenates notes with a `[Merged from X on date]` stamp, merges socials. The UI PATCHes the winner with that payload and soft deletes the loser with `?reason=merged` (the loser can carry `mergedInto`).

## 5. Integrations

- Calendly (read only): `/api/admin/calendly/events` as above. Mapping to leads happens client side in `src/lib/events.js` `matchCalendly(ev, leads)`: by `calendlyEventUri` first, then last-10 phone digits, then email (lead email or `afterCall.email`), then normalized name against `business` or `askFor`. A matched event renders as "Meeting: <business>", unmatched as "Calendly: <name>". Linking a lead stores `calendlyEventUri` via the call-leads PATCH.
- Stripe: webhook registered at `/api/stripe/webhook` for `charge.succeeded, invoice.paid, checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted`. `ingestEvent`: `createIndex({ id: 1 }, { unique: true })`, insert the normalized row first as a claim (duplicate key 11000 -> `{ duplicate: true }` with no side effects). For payment types, `matchClient` (email exact-insensitive on `email` or `afterCall.email`, preferring stage client; then last-10 phone across up to 2000 live leads; then normalized business/contact name among client/won) and `applyPayment`: refuses a second ledger entry for the same `stripeEventId`; ledgerId = 5 random bytes hex; entry `{ id, label (description or "Stripe charge|invoice|checkout"), amount, at (day), notes '', source 'stripe', stripeEventId }`; the first unpaid, unlinked schedule item with the same amount and `dueAt <= today` across the lead's live projects becomes `paid` with `ledgerId`, `paidAt`; on a retainer project `retainer.nextBillAt` advances to the next unpaid item; then `$push purchases`. `customer.subscription.deleted`: a lead with `retainer.stripeSubscriptionId` gets `retainer.status 'cancelled'`, `nextBillAt ''`, `stripeCancelledAt`; a project with `plan.stripeSubscriptionId` gets `plan.stripeCancelled true`, `plan.stripeCancelledAt`. Unmatched payments wait in Settings > Integrations > Stripe for manual `reconcile`. `stripeHealth` reports configured flags, last webhook time, unmatched count. Read side: `stripeGet` with Bearer `STRIPE_SECRET_KEY`, 5 minute cache.
- Email (Web3Forms, `api/_lib/notify.js` `sendEmail`): POST `https://api.web3forms.com/submit` with `{ ...fields (reserved keys dropped: access_key, subject, from_name, email, replyto, reply_to, redirect, ccemail, cc, bcc, botcheck, name, message, anything starting with _), access_key, subject, from_name (default 'Visualize Website'), email (reply-to, default contact@visualizeclients.com) }`. Best effort, no throw. Triggered only by a public submission: subject `New <kind>: <business or name>` where kind is `Shop order`, `Review`, or `<projectType || 'Project'> inquiry`; fields Name, Business, Email, Phone, Type, the form's fields, and `Open in Admin: https://admin.visualizeclients.com/?submission=<id>`. Disabled by `prefs.emailEnabled === false`.
- Web push (`sendPush`): `webpush.setVapidDetails('mailto:contact@visualizeclients.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)`; payload `{ title, body, url }` to every `push_subscriptions` row; 404/410 deletes the subscription. Triggers and texts: a new submission (title `New <kind>: <who>`, body `<name> · <email>`, url `.../?submission=<id>`), the settings `test-push` (`Visualize test` / `Push reminders reach this device.`), and the reminders cron digest (title `Today: N callbacks, M meetings`, body joins `N callbacks: A, B (overdue), +K more`, `M meetings: A at 9:00 AM`, `bills due: X $500`, `review asks due: X`, url `${ADMIN_URL}/`). In FIFTEEN_MINUTE_MODE (off): per-event pushes `Call back X` / `Due 3:15 PM, phone` to `/leads?open=<id>`, `Meeting with X` / `Starts ..., location` to `/booked?open=`, `Bill X today` to `/clients?open=`, `Ask X for a review` / `<project> was released three days ago and nobody has asked yet.` to `/reviews?open=`. Subscriptions are created by the admin browser via `/api/push-key` then `/api/admin/push-subscribe`; `public/sw.js` handles the push event and deep links.
- Cloudinary: browser-only unsigned upload (`src/lib/cloudinary.js`) to `https://api.cloudinary.com/v1_1/<VITE_CLOUDINARY_CLOUD_NAME>/image/upload` with preset `VITE_CLOUDINARY_UPLOAD_PRESET` (`visualize`, unsigned, folder `showcase`, docs/IMAGES.md). Accepts jpeg/png/webp/svg up to 10MB; the returned `secure_url` is pasted into the showcase image field and stored through `safeUrl`. No server function, no API secret; the preset can create but not delete, so clearing a field orphans the asset. The admin CSP's `connect-src` includes api.cloudinary.com for this.
- Shopify: none. The only hit for "shopify" is a business-type label in src/components/BusinessTypes.jsx. The print shop was removed in Site Prompt 6; `shop-order` submissions and the `orders` parser remain for hand-entered and legacy orders.
- Scraper and enrichment: both live outside this repo and write directly into `call_leads` (`sourceId` and `createdAt` for scraped inserts; `enrichment.lastScanAt`, `scanCount` and refreshed descriptor/industry/phone/email/socials/intel for the enricher). The daily cron summarizes their activity into `health`; the drawer raises a System item when either is quiet for 36 hours. The enricher is the known source of wiped `stage` values, hence the heal.

## 6. Crons

Both in `api/cron/[job].js`, both `CRON_SECRET` guarded, both writable to `health.crons`.

- reminders, `0 13 * * *` (`api/_routes/cron-reminders.js`): reads `settings.notifications` for per-kind toggles and `sentReminderKeys`. Gathers leads with `callStatus: 'callback'` and a `callbackAt`, or a `meeting.date`; clients (stage client) with retainer bills whose `nextBillAt` day equals today and status active|ending; review asks due = clients with zero `reviews.asks` whose latest released project (`releasedAt`) is at least 3 days old. Digest mode (default): callbacks due today or overdue, meetings today (stage booked|won|client), bills, review asks; if any and `digest:<today>` not in `sentReminderKeys`, send one push and append the key (array kept to 500) plus `lastReminderAt`. Writes `health.crons.reminders {lastRunAt, checked, sent}`. Answers `{ ok, checked, sent }`. `FIFTEEN_MINUTE_MODE = true` restores per-event pushes with keys `cb:<id>:<callbackAt>`, `mt:<id>:<date>:<time>`, `bill:<id>:<day>`, `review:<id>:<releaseDay>` (requires a Pro plan schedule).
- daily, `0 6 * * *` (`api/_routes/cron-daily.js`): (1) retainers: for every live lead with `retainer.status` in active|ending|paused: an `ending` retainer past `cancelAt` becomes `cancelled` with `nextBillAt ''`; paused is skipped; with a linked project, extend its schedule so 6 unpaid future items exist (`Month N` labels, `addMonths` on `billDay`, amount from `retainer.amount` or the last item) and set `nextBillAt` to the next unpaid item when the current one is empty or in the past; without a project, roll `nextBillAt` one month when past. (1b) the stage heal described in section 4. (1c) `clientSince` backfill for client/won records missing it. (2) health: enrichment stats (latest `enrichment.lastScanAt`, leads scanned in 24h, fields filled), scraper stats (latest `sourceId` insert, inserts in 24h and 7d), `crons.daily {lastRunAt, rolled, cancelled, extended, healed, stamped, healedRecords}`, `stripe {lastWebhookAt, unmatched}`; upserts `settings.health`. Answers `{ ok, rolled, cancelled, extended, healed[], stamped, health }`.
- Manual run: `curl -H "Authorization: Bearer $CRON_SECRET" https://admin.visualizeclients.com/api/cron/daily`.

## 7. Operations

### Build and deploy

Push to main deploys production on Vercel. `npm run build`: `vite build` (plugins: react, `vzBootFrame` injects the boot frame, `vzAdminPreload` fills `<meta name="vz-admin-chunk">`, `vzCspHash` hashes the single inline script and rewrites every `'sha256-...'` in vercel.json; `__BUILD_SHA__` from `VERCEL_GIT_COMMIT_SHA`), then `scripts/prerender-clients.mjs` fetches production `/api/showcase` (override `PRERENDER_SHOWCASE_URL`) and writes `dist/clients/<slug>/index.html` per published client with that client's title, description and og:image swapped into the template (Vercel serves a real file before consulting rewrites, so no rewrite rule is needed), then `scripts/build-sitemap.mjs` writes `dist/sitemap.xml` from the static routes plus every published slug. Both fail soft on network error, non-200 or bad JSON. Local: `npm run dev` (marketing and admin at /admin/*), `npm run build && npx vite preview`; api/ functions need `vercel dev` or a deployment. If the admin goes blank after an index.html change, the CSP hash moved: rebuild and commit vercel.json.

### Audits and tests (run before every commit, per CLAUDE.md)

Against `npx vite preview --port 4330` with Playwright route mocks from `scripts/audit-fixtures.mjs` (hostile long names, 16 leads, projects, posts, sets, Calendly events, Stripe events, health, showcase payload) and the screen table `scripts/audit-screens.mjs` (every admin screen and state plus `marketing: true` entries):
- `layout-audit.mjs`: every route at 5 widths, fails on horizontal overflow, sub-44px targets, stuck overlays; `AUDIT_ONLY=a11y` adds 200 percent zoom and text spacing.
- `feel-audit.mjs` (`AUDIT_THEME=both AUDIT_MOTION=both`): per screen: skeleton present, skeleton fit within 4px of loaded blocks, entrance animation, empty state, error state with Retry, CLS; `--boot` measures time to first shell paint throttled.
- `a11y-audit.mjs` (`AUDIT_THEME=both`): axe-core WCAG 2.0/2.1 A and AA plus best practices at 390 and 1280; exits 1 on serious or critical.
- `regression.mjs`: docs/QA-CHECKLIST.md as a Playwright walk at 390 and 1280. `site-regression.mjs`: docs/SITE-QA-CHECKLIST.md's CRM-to-site walk with a mutable mocked showcase (publish, feature, testimonial, unpublish, Cloudinary upload flow).
- `scene-audit.mjs` (`SCENE_PATH=/` and `/concepts/<token>`, widths 320,390,430,768,1280, `SCENE_MOTION=reduce`): scrolls in 5 percent steps, checks pinned stage height, content fit, navbar and indicator clearance, text overlap, reveal reversal. `mobile-trace.mjs`: Home with real CDP touch drags at 390/320/430 and reduce motion against the mock server on 4350.
- Static: `hex-count.js` (raw hex literals in src and api, ceiling 90, only goes down), `css-orphans.mjs` (0 unrendered class selectors), `TZ=America/New_York node scripts/dates-test.mjs`.
- Handler tests (copy `api/` to a temp dir with `_lib/mongo.js` swapped for `scripts/fake-mongo.js`, an in-memory Mongo fake that records every filter and update and throws on unknown operators): `security-test.mjs` (operator injection on every query and the login password, safeUrl on every link/image field, script tags stored verbatim and never re-emitted as HTML, the planner's identical 404s and revoke, the login limiter 10/15min, the submission limiter and field normalizer, reserved Web3Forms keys), `pipeline-test.mjs` (normalizeStage, the 409 guard, imports never touching stage, the daily heal with every evidence rule, clientSince on every path, normalizeLead), `planner-endpoint-test.mjs`, `showcase-endpoint-test.mjs` (whitelist by key, drafts hidden, slug generation and 409 on collision), `concepts-endpoint-test.mjs` (identical 404 bytes, whitelist, 409s, 429 at the 31st action).
- Optional: `render-profile.mjs` (kanban with 400 leads, month with 60 events), `lighthouse.mjs` against `mock-server.mjs` (`LH_FORM=desktop`, `MOCK_SHOWCASE_EMPTY=1`), `keyboard-audit.mjs`, `cloudinary-test.mjs`.

### Mock server (`scripts/mock-server.mjs`)

`DIST=dist PORT=4350 node scripts/mock-server.mjs` serves dist/ with SPA fallback, gzip, immutable /assets, the common headers from vercel.json (and the admin CSP with `MOCK_HOST=admin`; restart after every build because it reads the hash once). Answers every admin API from the fixtures as signed in: session `{ authed: true }`, login/logout ok, log ok, push-key null, submissions, settings, stripe, calendly, call-leads, orders, concept-packs, concept-sets, projects (GET from PAYLOADS with `MOCK_DELAY`, writes `{ ok, item }`), `/api/concepts?token=` from the fixture sets (404 for draft/archived/unknown), `/api/showcase` and `?slug=` (empty with `MOCK_SHOWCASE_EMPTY`), `/api/planner?token=` from fixture leads and posts, `/api/submissions` `{ ok, id: 'subMock' }`. Never touches a database.

### Backups, restore, migrations

Backup: Settings > Data > Download backup (`/api/admin/backup`), all collections except push_subscriptions, Stripe `raw`, `rate:*` and `client-log` (and, as noted, currently missing `posts` and `concept_sets`). No in-app restore; restore is a hand import into Atlas. `scripts/migrate-mongo.mjs --dry` copies a database between accounts preserving `_id`s (idempotent). `scripts/migrate-concepts.mjs` turns old concept_packs and lead `concepts[]` into draft concept_sets (report first, `--apply`). `scripts/repair-leads.mjs` and `scripts/backfill-client-since.mjs` fix stored shapes and clientSince (report first, `--apply`, or against a JSON dump). Secret rotation: change `SESSION_SECRET` in Vercel and redeploy to sign every device out; change the password via `ADMIN_PASSWORD` env or the constant and redeploy (does not sign anyone out).

### Health and troubleshooting

Settings > Integrations shows Calendly, Stripe (last webhook, unmatched, Reconcile), scheduled tasks armed (CRON_SECRET), enrichment and scraper freshness; Settings > Automation lists both crons with last run and result and the last 20 client errors (settings `client-log`, 500 kept). The RUNBOOK's checklist: nothing loads -> MONGODB_URI or Atlas network list; no push -> VAPID keys, device permission, iPhone needs Home Screen install; no Calendly -> token; payments missing -> Reconcile (matching is email, phone, name); Wrong password -> env var override wins; 401 after sign in -> SESSION_SECRET rotated or a Secure cookie on plain http; blank admin -> CSP hash.

### Notable gaps and discrepancies worth carrying into a rebuild

1. No client code sends `explicit: true`, so the Lost dialog on a client/won record hits the 409 guard.
2. `backup.js` omits `posts` and `concept_sets`.
3. docs/ARCHITECTURE.md's "Crons" section still says reminders run every 15 minutes; the code and RUNBOOK say once daily at 13:00 UTC with a digest.
4. `route()` ignores the `csrf` option that several callers still pass.
5. The two hourly view stamps (`planner.lastViewedAt`, `concept_sets.lastViewedAt`) and the lazy tombstone purges are database writes performed by GETs; the audit accepted them as harmless.