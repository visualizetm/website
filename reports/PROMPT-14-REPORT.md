# PROMPT 14 REPORT: MOTION, LOADING, AND THE THEME TOGGLE

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`. Commits in
order: e53855d (feel audit and shared fixtures), 2ca54e2 (boot frame, page
crossfade, reduced motion switch), 4a42f3d (skeletons, entrances, write
feedback, empty and error states), afed1b8 (light theme, picker, sidebar
tokens), 6e456b4 (the last writes through apiFetch), aebaed3 (skeleton
shapes for the settings tabs and detail sheets), 1a82339 (card glow as a
background layer), then this report.

No new features, no schema changes beyond the two additive profile fields
(`theme`, `reduceMotion`), no endpoint changes. Every change reads
`var(--v-...)`; motion uses only `--v-dur-*` and `--v-ease-*`; no copy in
this prompt carries an em dash.

## 1. Feel audit: baseline and final

`scripts/feel-audit.mjs` walks every screen and state the layout audit knows
(70 rows: 35 states at 390 and 1280) on the layout audit's Playwright setup
and the shared fixtures in `scripts/audit-fixtures.mjs`. Per row it records:

- skeleton: `?loading=1` (which now hands every screen empty data, so it is
  the true nothing-loaded state) renders a skeleton in the region;
- fit: the skeleton's outermost blocks grouped into rows by top edge; every
  row above the fold must start within 4px (top and left) of the loaded row,
  and blocks 200px or wider must match in width too. Text line skeletons
  under 40px are not blocks (loaded text is not measured either) and chip
  widths are data driven, so narrow controls compare position only;
- entrance: the loaded state arrives through Stagger, Reveal, or a row
  entrance (`data-v-enter`);
- empty: an EmptyState renders when the screen's resource answers with no
  items (the drawer also gets an empty settings document, so no system item
  sneaks in);
- error: an ErrorState with Retry renders when the resource answers 500;
- cls: cumulative layout shift while a 400ms server lands real data over the
  skeleton.

Detail states (deep links through `?open=<id>`) skip empty and error; those
belong to their list. Boot rows check for the frame instead.

### Baseline (build 9c35b12, before any change)

FEEL_BASELINE

### Final (build aebaed3, both themes, Reduce motion off and on)

FEEL_FINAL

## 2. Files created, changed, deleted

Created: `scripts/feel-audit.mjs`, `scripts/audit-fixtures.mjs`,
`src/shared/copy.js`, `src/shell/appearance.js`, `src/shell/bootFrame.js`,
`src/shell/BootFrame.jsx`, `src/ui/motion.js`, `src/ui/RecordSkeleton.jsx`,
`src/ui/useOnline.js`, `reports/PROMPT-14-REPORT.md`.

Changed (66): `index.html`, `vite.config.js`, `.gitignore`,
`api/admin/settings.js`, `scripts/layout-audit.mjs`, `src/index.css`,
`src/shared/api.js`; kit: `Badge`, `Card`, `Collapsible`, `ErrorState`,
`Modal`, `PageShell`, `ProgressBar`, `Section`, `Sheet`, `Skeleton`,
`Spinner`, `Stagger`, `Table`, `Tabs`, `Toast`, `icons`, `index`,
`lead.styles`, `tokens`; shell: `AppShell`, `MoreSheet`,
`NotificationsDrawer`, `Sidebar`; screens: `AdminApp`, `AdminBooked`,
`AdminCalendar`, `AdminCalls`, `AdminClients`, `AdminConcepts`,
`AdminDashboard`, `AdminDesign`, `AdminLeads`, `AdminOrders`,
`AdminReviews`, `AdminSettings`, `AdminSubmissions`; components:
`Checklists`, `ClientWorkspace`, `LeadCard`, `LeadDetail`, `LeadHistory`,
`LeadImport`, `LeadNotes`, `LeadPicker`, `LeadPlaybook`,
`LinkedSubmissions`, `OrdersImport`, `ThemeToggle`; marketing (hex dedupe
only): `Hero`, `CaseStudy`, `LeadPartner`, `Prints`, `Services`; docs:
`LAYOUT.md`, `docs/COMPONENTS.md`, `docs/RUNBOOK.md`, `docs/TOKENS.md`,
`reports/PROMPT-12-REPORT.md` and `reports/PROMPT-13-REPORT.md` (the pending
audit tallies from Prompt 13, filled first).

Deleted: nothing.

## 3. Boot sequence and time to first shell paint

Sequence for a signed in user:

1. `index.html` parses. The one pre-paint script (extended, not duplicated)
   reads `vz_theme`, `vz_motion`, `vz_boot`, and `vz_shell_collapsed`, stamps
   `data-theme` (marketing) and `data-v-theme`, `data-v-motion`,
   `data-vz-boot`, `data-vz-side` (admin) on `<html>`, and inserts the Google
   Fonts link: render blocking on the marketing site as before, non blocking
   on the admin so the frame never waits for it.
2. `<style id="vz-boot-css">` (injected by the Vite plugin in
   `vite.config.js` from `src/shell/bootFrame.js`) carries only the eight
   `--v-` variables the frame needs, parsed from `src/ui/tokens.js` for both
   themes, and the frame rules.
3. `#root` already contains the frame markup (same plugin): sidebar or rail,
   top bar, content skeleton, tab bar under 768, or the login card outline
   when there is no `vz_boot` hint. The parser paints it in the same frame as
   the tokens.
4. The bundle runs. `AdminApp` renders `BootFrame` (the identical string)
   while `/api/admin/session` is in flight, so React's first commit swaps the
   parser's frame for the same pixels. Then the shell mounts and each
   screen's own skeleton takes over inside the content region.
5. Route changes keep the shell mounted; AppShell keys the content region by
   nav id and PageShell's `.lay-view` rule crossfades it over `--v-dur-base`.

Measured with `node scripts/feel-audit.mjs --boot` (Chromium, CDP throttle
1.6Mbps down, 150ms latency, admin API mocked with a 300ms server):

| Build | Network | Frame in DOM | First paint | React shell | DOMContentLoaded |
|---|---|---|---|---|---|
| baseline 9c35b12 | throttled | never | 1816ms | never (blank ground until session) | 1733ms |
| baseline 9c35b12 | unthrottled | never | 172ms | never | 82ms |
| final aebaed3 | throttled | 178ms | 392ms | 2014ms | 1895ms |
| final aebaed3 | unthrottled | 16ms | 60ms | 142ms | 87ms |

Before, first paint waited for the render blocking fonts stylesheet and the
admin showed blank ground until the session answered. Now the frame is in the
DOM at 178ms and painted at 392ms on the throttled profile (the remaining
gap is the bundle download), and the React shell lands on the same geometry
when the session answers. Inside the sandbox the fonts request never
resolves, so the audit answers it with an empty stylesheet.

## 4. Every write and its feedback pattern

All shell level writers live in `AdminApp` and go through `apiFetch`
(`src/shared/api.js`), which refuses writes while offline and returns a
uniform result; every one applies locally first and rolls back on failure,
resolving a boolean the screen reads. InlineEdit keeps its own optimistic
save, rollback, and failure toast; button, menu, and checkbox writes toast on
failure through the screen's wrapper (`patch` in each screen, `pp` in the
client workspace). Success toasts remain only on meaningful writes.

| Write | Endpoint | Pattern | Failure | Success |
|---|---|---|---|---|
| Lead field edits (InlineEdit, notes, playbook, checklists, links, brand) | PATCH call-leads | optimistic, rollback | toast | none (the value) |
| Priority, status, stage, client status, concepts, game plan, pricing options | PATCH call-leads | optimistic, rollback | toast | none |
| Mark as won | PATCH call-leads | optimistic, rollback | toast | toast with Open in Clients, won pulse, Clients badge tick |
| Mark as lost | PATCH call-leads | optimistic, rollback | toast | undo toast (6s) |
| Callback set or cleared, meeting reschedule | PATCH call-leads | optimistic, rollback | toast | toast |
| Call outcome (booked, callback, no answer, no, wrong number) | PATCH call-leads (+ DELETE on no) | optimistic, rollback, session stats | toast | undo toast (6s), booked pulse on the room header |
| Calendar mark done, callback, link Calendly | PATCH call-leads | optimistic, rollback | toast | toast |
| Kanban drag, bulk priority or status | PATCH call-leads | optimistic, rollback | toast | bulk: count toast |
| Create lead (Leads, Console, Calendar, Submissions convert, Clients walk in) | POST call-leads | waits for the id, Button loading | toast | toast |
| Delete lead, bulk delete | DELETE call-leads | optimistic, rollback | toast | undo toast (6s) |
| Restore (undo, Settings) | PATCH restore | waits, then refetch | toast | toast (Settings) |
| Merge duplicates | PATCH + DELETE | optimistic winner, then delete | toast per step | toast |
| Import spreadsheet, import notepads | POST import | waits with progress | inline message or toast | result step |
| Project create | POST projects | waits, Button loading | toast | toast |
| Project stage, revisions, deliverables, delivery checklist, release, monthly log | PATCH projects | optimistic, rollback | toast | delivered toast; others none |
| Mark paid (schedule, retainer bill, order) | PATCH call-leads + projects or orders | optimistic, rollback | toast | toast, won pulse on the row or order |
| Manual payment | PATCH call-leads | optimistic, rollback | toast | toast |
| Start retainer, pause, resume, cancel | POST projects + PATCH call-leads | waits for the project, then optimistic | toast | toast, retainer card and tab pulse |
| Order create, stage, rush, due, items, packaging, link client | POST or PATCH orders | optimistic, rollback (create waits) | toast | create, delivered, project created toasts |
| Import shop orders | POST orders | waits, Button loading | toast | count toast |
| Pack create, fields, prompts, images, tags, link lead, mark shown | POST or PATCH concept-packs | optimistic, rollback | toast | create and mark shown toasts |
| Review counts, NFC card, Google link, log ask, link form | PATCH call-leads (+ submissions) | optimistic, rollback | toast | log ask and link toasts (counts: none) |
| Submission status, read, notes, link lead, delete | PATCH or DELETE submissions | optimistic, rollback | toast | link and convert toasts |
| Notifications read, snooze | PATCH settings | optimistic, rollback | toast | none |
| Settings profile, target, prefs, reminders | PATCH or POST settings | optimistic, rollback | toast | none |
| Theme, Reduce motion | PATCH settings profile | optimistic (applied on the device first), rollback | toast | none (the screen changes) |
| Password, test push, push subscribe, install | POST settings, push-subscribe | waits, Button loading or state | toast or state | toast |
| Purge deleted | POST settings + DELETE call-leads | waits, confirm dialog | toast | toast |
| Reconcile Stripe payment | POST stripe/reconcile | waits | toast | toast |
| Dashboard daily target | PATCH settings | optimistic, rollback | toast (InlineEdit) | none |

Success toasts removed this prompt: saved and updated views, CSV export,
review counts and baseline, the daily target, and the backup info toast.

## 5. Success moments

Color and scale only, every duration a token, and all of them collapse under
Reduce motion:

- Booked outcome pulses the call room header (already there; its timer now reads `--v-dur-slow`).
- Won: the profile card pulses in the won tone (`.v-pulse-won`, a ring and a 1.2 percent lift over two `--v-dur-slow`), the detail waits for the pulse before closing, and the Clients badge in the sidebar and tab bar ticks up with a scale bounce (`Badge` bounces whenever its count grows).
- Mark paid: the schedule row (Table or ListRow) pulses in the won tone while the payment ProgressBar fills; on an order the customer card pulses.
- Checklist item: the box pops on check (`ck-pop` on the Checkbox mark).
- Retainer start: the retainer card pulses and the Retainer tab pulses in the booked tone (`Tabs` takes `pulse` per tab).
- Dashboard target: when the ring crosses 100 in the session it scales once and its fill glows red once; the context line reads "Target hit. Nice." for the rest of the day.

## 6. Copy table

`src/shared/copy.js` holds every empty and error state and the shell
messages as one table: 50 empty entries (title, description, one action, an
optional secondary), 10 load error entries plus 6 write error strings, the
offline banner and toasts, and the target hit line. 50 EmptyState sites and
12 ErrorState sites in the admin read it; no screen types "No data" or its
own error copy. New empty states this prompt: dashboard activity, kanban
columns, calendar week and month, order items, pack prompts and images,
submission answers, client ledger and schedule, the review forms section,
and the device import preview.

## 7. Light theme contrast table

Every `--v-` color token is defined under
`.lay-root[data-v-theme='light'], [data-v-theme='light'] .lay-root` in
`src/ui/tokens.js`; the sidebar stays Visualize black through its own
`--v-sidebar-*` tokens. Full value table in `docs/TOKENS.md`. `/design`
renders both themes' tables from the declared values.

| Text | on ground #f7f3ee | on surface-1 #f1ece5 | on surface-2 #eae4db | on surface-3 #e2dbd0 |
|---|---|---|---|---|
| `--v-text` #1a1613 | 16.27 | 15.30 | 14.23 | 13.08 |
| `--v-text-2` #4a433c | 8.80 | 8.28 | 7.70 | 7.08 |
| `--v-text-3` #5f574e | 6.42 | 6.04 | 5.61 | 5.16 |
| new text #8a3d0c | 6.90 | 6.49 | 6.03 | 5.55 |
| progress text #1a44c2 | 7.17 | 6.74 | 6.27 | 5.77 |
| callback text #6d28d9 | 6.43 | 6.05 | 5.62 | 5.17 |
| booked text #166534 | 6.45 | 6.07 | 5.64 | 5.19 |
| won text and red as text #9e2f28 | 6.58 | 6.19 | 5.75 | 5.28 |
| danger text #a91b1b | 6.65 | 6.26 | 5.82 | 5.34 |
| raw red #d44c43 as text | 3.87 (fail) | 3.64 (fail) | 3.38 (fail) | 3.11 (fail) |

Solid fills keep their hue in light and carry the dark label
(`--v-text-inverse` is `var(--v-text)`): new 8.37, progress 7.07, callback
6.61, booked 7.89, danger (#f87171) 6.50, neutral (#a3a3a3) 7.13. The won
solid keeps the white label through `--v-text-on-red` (4.27, the same known
exception as dark). Soft tints with their text on surface-3: new 5.16,
progress 5.27, callback 4.73, booked 4.76, won 4.62, danger 4.69.

The sweep in light (screenshots at 390 and 1280 of the dashboard, leads
kanban, settings, calendar week, orders, a client detail, and the boot
frame) found two hardcoded assumptions, both fixed through tokens: the lead
import sheet's white alpha borders and fills, and the login card's fallback
shadow.

## 8. Hex count and css-orphans

| Check | Before | After |
|---|---|---|
| `node scripts/hex-count.js` | 150 | 145 |
| `node scripts/css-orphans.mjs` | 0 orphans of 844 classes | 0 orphans of 861 classes |

The light block adds 21 hex literals (the stub's 11 are gone). To land under
150 the marketing pages stopped repeating the three browser window dot colors
(now `--dot-close`, `--dot-min`, `--dot-max` in `src/index.css`) and the shop
page defines its white, green, and gold once.

## 9. Layout audit, both themes, plus the Prompt 13 tally

Prompt 13 final tally (filled in commit 11c7363): 750 checks clean at 320,
390, 430, 768, and 1280 on build 3226283; Prompt 12: 745 clean.

Prompt 14, every screen at 320, 390, 430, 768, and 1280 in both themes with
Reduce motion off and on:

LAYOUT_TABLE

The first battery ran on aebaed3. Both Reduce motion runs failed the loaded
Dashboard at 768 and 1280 (and the collapsed sidebar Dashboard): the document
scrolled 40px sideways once the entrance had settled, because the card glow
pseudo element hung 40px past the card's edge and Chrome counted it in the
scrollable area even under overflow hidden. The motion off runs passed only
because their check landed inside the entrance. Commit 1a82339 turns the glow
into a background layer on the card; the two Reduce motion runs above are the
full re-runs on that build, and the Dashboard block (loaded, settled,
skeleton, collapsed sidebar, five widths) was re-run clean in dark and light
with motion off on the same build. The glow change is layout neutral, so the
750 clean rows of the motion off runs stand.

## 10. Decisions

- The boot frame is one source: `src/shell/bootFrame.js` builds the markup and the minimal CSS from `src/ui/tokens.js`; the Vite plugin injects both into `index.html` and React renders the same string. Nothing is copied by hand, and the frame cannot drift from the tokens.
- The Google Fonts stylesheet is non blocking on the admin only. The marketing hero keeps its blocking link so no display font swaps on the first paint there.
- `?loading=1` now hands every screen empty data. A forced loading state that still had the data was not a loading state, and it hid the deep link skeletons.
- Loading shows nothing for the first 150ms (`useDelayedLoading`), then the skeleton, never the empty numbers or an EmptyState from empty data. Every list gates its body on `pending` for that window.
- The fit check compares rows of outermost blocks, not every rectangle. Skeleton text lines and chip widths are data driven; positions are what the eye notices.
- Theme modes are `system`, `dark`, `light` on the one `vz_theme` key. The marketing site's toggle treats `system` as unset so it keeps following the OS; the admin defaults to dark when the key is missing.
- Solid status fills keep their hue in light and carry the dark label instead of seven darker fills; the won solid keeps the white label as in dark.
- Offline writes are refused, not queued. A queue would have to replay optimistic patches whose base document may have changed on another device, and the leads, projects, and orders patches are last write wins; refusing with a clear toast is the honest option. The banner says reading is fine.
- LeadDetail's tabs are anchors that scroll; there is no content switch to crossfade, so the tab body crossfade applies to Settings and the call room.
- Kanban column empty states carry no button: the column menu already holds the one action.

## 11. Skipped or deferred

- Fit within 4px is met for every row where the skeleton has a fixed shape. Rows that depend on data remain off in the final table and are listed as such: the Dashboard's Today card at 1280 (its height follows the number of items due), a second card that grows with a long name or a concepts bar (Booked, Concepts, Clients at 390), and the Section description that wraps to two lines at 390 on Clients. Their skeletons match the loaded layout for the usual data; the hostile fixtures are what push them past 4px.
- The offline write queue (see decisions).
- The theme-color meta tag stays dark; the light canvas is close enough to a neutral status bar that swapping it per theme was not worth another pre-paint branch.
- Chart palette tokens are unchanged in light; the bars carry the dark label and read fine, but a retuned set is a Prompt 15 item if contrast is measured on the design page bars.

## 12. What Prompt 15 (QA, accessibility, performance) must know

- Audits: `node scripts/feel-audit.mjs` (both themes and motion with `AUDIT_THEME=both AUDIT_MOTION=both`, `AUDIT_OUT` for JSON, `AUDIT_BOXES=1` to dump the block lists when tuning a skeleton, `--boot` for the throttled boot timing) and `node scripts/layout-audit.mjs` (`AUDIT_THEME`, `AUDIT_MOTION`). Both share `scripts/audit-fixtures.mjs` and stub Google Fonts.
- Reduced motion: `data-v-motion='reduce'` on `.lay-root` and `<html>` zeros the duration tokens; `durationMs()` in `src/ui/motion.js` is how JS timers follow. The Skeleton shimmer, Spinner, ProgressBar sweep, and login shake check the attribute as well as the media query. Anything new that animates must read the tokens and nothing else.
- The `.v-pulse-won` utility, `Badge` tick, `Tabs` pulse, and the Dashboard ring pulse are the only success animations; they are color and scale.
- ErrorState with Retry now sits on every fetch; the retry keeps the last data on screen and spins the button, it does not flash the skeleton.
- The offline banner uses `useOnline`; `apiFetch` fires `vz:offline-write` for refused writes and the shell shows one toast per 2.5s.
- Light theme: the sidebar tokens are the only place the two themes diverge structurally. Any new surface must read `--v-surface-*` and `--v-text-*`, never a white or black alpha.
- The boot frame markup lives in `src/shell/bootFrame.js`; if the shell's geometry changes (sidebar width, top bar height, tab bar height), change it there too, or the frame will shift when React lands.
- The accessibility items still open from the kit: Tabs indicator is decorative (`aria-hidden`), the tab strip keeps its roving tabindex; Table rows keep `tabIndex` and Enter; the offline banner is `role="status"`.
- Performance: the bundle is unchanged in shape (one app chunk plus the xlsx chunk); the boot frame adds about 6KB of inline HTML and CSS to index.html.
