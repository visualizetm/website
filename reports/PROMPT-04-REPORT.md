# PROMPT 04 REPORT: App shell, navigation, and command bar

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`.
Commits: shell (`src/shell`), adoption in AdminApp and screens, reverse lookup removal and audit coverage, this report.

## 1. What was built

- `src/shell/`: a new admin shell rendered around every existing screen. Desktop sidebar (collapsible to a rail, persisted), sticky top bar with title and back button, mobile tab bar with badges, More sheet, command bar (desktop Popover, mobile full-height Sheet), notifications drawer, quick add menu, account menu.
- One navigation model in `src/shell/nav.js`. Sidebar, tab bar, More sheet, command bar "Jump to", and the top bar title all render from it. Active state comes from the path.
- Command bar absorbs the reverse phone lookup: digit queries use `last10` and `matchRank` from `src/shared/phone.js`, text queries match business, contact name, descriptor, and industry, plus nav entries. Recent (last 8) in localStorage. "Add as new lead" on a digit miss with the number pre-filled.
- Notifications from three sources that need no endpoints: callbacks due, meetings in the next 24 hours, new leads in the last 48 hours. Bell badge counts unread Today items; read ids live in localStorage until Prompt 9.
- Every screen renders inside the shell unchanged. The old rail, tab bar, More menu, their CSS, and the console's lookup sheet are gone.
- Hex count went from 621 to 606.

## 2. Files created, changed, deleted

Created: `src/shell/nav.js`, `src/shell/storage.js`, `src/shell/search.js`, `src/shell/notifications.js`, `src/shell/ShellContext.jsx`, `src/shell/AppShell.jsx`, `src/shell/Sidebar.jsx`, `src/shell/TopBar.jsx`, `src/shell/TabBar.jsx`, `src/shell/MoreSheet.jsx`, `src/shell/CommandBar.jsx`, `src/shell/NotificationsDrawer.jsx`, `src/shell/QuickAdd.jsx`, `reports/PROMPT-04-REPORT.md`.

Changed:
- `src/pages/AdminApp.jsx`: renders `AppShell`; old rail, tab bar, More sheet JSX and CSS removed; `.aa-app` is now the content row inside the shell with the token aliases; login styles on tokens; `goNav`, `openLead`, `newLead`, `newClient`, `callbacksDue`; `openId` and `createPreset` props to screens; `initialSub` for Settings so `/settings/deleted` opens Recently deleted; ListSection sets the top bar for an open item.
- `src/pages/AdminLeads.jsx`, `AdminClients.jsx`, `AdminBooked.jsx`: accept `openId` (and `createPreset` for Leads and Clients), set the top bar title and back button through `useTopBar` when a detail or form is open; the Leads form takes a pre-filled phone.
- `src/pages/AdminCalls.jsx`: LookupSheet, its state, recent-lookups storage, the `/` key handler, the three lookup buttons, and the `lk-` CSS removed; unused phone imports dropped.
- `src/ui/icons.jsx`: nav and shell icon names added to the map. `src/ui/Input.jsx`, `src/ui/Textarea.jsx`: forward refs (the command bar needs the input ref).
- `scripts/layout-audit.mjs`: new shell states (section 8). `docs/COMPONENTS.md`: shell section.

Deleted: nothing at file level; the removed code is listed in section 6.

## 3. nav.js entries

| Group | Entry | Path | Badge | Mobile tab | Soon |
|---|---|---|---|---|---|
| Pipeline | Dashboard | `/` | none | yes | |
| Pipeline | Leads | `/leads` | leads not yet called | yes | |
| Pipeline | Call Console (tab label "Call") | `/calls` | callbacks due | yes | |
| Pipeline | Booked | `/booked` | booked count | yes | |
| Clients | Clients | `/clients` | none | | |
| Studio | Print Orders | `/orders` | unread orders | | |
| Studio | Concepts | none | | | soon |
| Studio | Reviews | none | | | soon |
| System | Submissions | `/submissions` | unread submissions | | |
| System | Recently Deleted | `/settings/deleted` | | | |
| System | Design | `/design` | | | |
| System | Settings | `/settings` | | | |

Print Orders is enabled, not "soon", because the Orders screen already exists at `/orders`; the prompt allows paths only for screens that exist and this one does. Concepts and Reviews render disabled with a Soon tag. The mobile More sheet lists Clients, Print Orders, Concepts, Reviews, Submissions, Recently Deleted, Design, Settings.

## 4. Command bar matching and endpoints

- Digit query (`/^[\s()+\-.\d]+$/` with at least one digit): `matchRank(lead.phone, digitsOf(q))` from `src/shared/phone.js`; rank 0 exact, 1 starts with, 2 ends with (the caller-ID fragment), 3 contains. Same rules as the old lookup. The mobile input switches to `inputmode="tel"` when the first typed character is a digit; a small Abc / 123 toggle overrides it.
- Text query: lowercase match on business (prefix first, then contains), then contact name (`askFor`), industry, descriptor. Nav labels match for "Jump to" (soon entries excluded).
- Groups: Leads (stage lead or booked: business, industry pill, formatted phone, call status pill), Clients (stage won or client: business, first two planned services), Jump to. Six per group.
- Empty query shows the last 8 opened results from `localStorage.vz_cmd_recent`.
- Data: the call_leads list already loaded by AdminApp (the endpoint returns up to 500 leads with no search parameter). When a query has no in-memory hit, a 350ms debounced refetch of `GET /api/admin/call-leads` runs so results stay fresh after the nightly jobs. No other endpoint is called and none were added.
- Keys: `/` or Cmd/Ctrl+K opens (unless focus is in a field), arrows move, Enter opens, Escape closes. A lead opens in Leads, Booked, or Clients by stage; a jump navigates; "Add as new lead" opens the Leads form with the number filled in.

## 5. Notification sources

All computed in `src/shell/notifications.js` from the call_leads list, no endpoint calls.

| Source | Query | Group |
|---|---|---|
| Callbacks due | `callStatus === 'callback'` and stage not lost. Due date: the console stores no date for a callback, only the log entry, so every open callback is due. Overdue when the last callback entry is from a previous day. | Today |
| Meetings | stage booked, `meetingDate(lead)` (from `meeting.date` and `meeting.time`) between now minus 1h and now plus 24h | Today if the same calendar day, else Upcoming |
| New leads | stage lead, `createdAt` within the last 48 hours | New leads |

Items: IconTile with tone (callback, danger when overdue, booked, new), title, one detail line, relative time; tap marks read and opens the record. Empty state: "All caught up. Start a call session." with a button to the Call Console. The Call tab badge is the same callbacks-due count.

## 6. Old shell code removed

- AdminApp: the `RAIL` array, the icon rail nav, the mobile tab bar rules, the More sheet and `moreOpen` state, and their CSS (`.aa-rail*`, `.aa-more*`, the mobile rail media rules). `.aa-app` no longer owns height, background, font, or safe areas.
- AdminCalls: `LookupSheet`, `lookupOpen`, `recentLookups` and `pushRecentLookup` (`vz_lookup_recent`), the `/` shortcut, the lookup buttons in the queue bar and both session headers, all `.lk-*` CSS, unused `digitsOf` and `matchRank` imports.
- Confirmed by grep: no `aa-rail`, `aa-more`, `LookupSheet`, `lookupOpen`, or `lk-` left in `src`.

## 7. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 4 (f71517c) | 621 | 108 |
| After Prompt 4 | 606 | 107 |

The shell added zero literals. The 15 removed came from the old rail, More sheet, login block, and the lookup sheet.

## 8. Layout audit

`scripts/layout-audit.mjs` now also covers: the command bar with a digit query (mobile sheet and desktop popover), the notifications sheet, the mobile More sheet, and on desktop the collapsed sidebar on the leads list, dashboard, and call console.

| Width | Checks | Result |
|---|---|---|
| 320 | 19 | all clean |
| 390 | 19 | all clean |
| 430 | 19 | all clean |
| 768 | 21 | all clean |
| 1280 | 21 | all clean |

Exit 0, zero offenders. The first run failed four detail views at 768px: a 240px sidebar beside the 324px list panel left the detail column too narrow. Fix in section 9.

## 9. Decisions

- Between 768 and 1023px the sidebar is the rail only and the collapse toggle is hidden. The stored preference applies from 1024px up.
- Callback due dates do not exist in the data, so every open callback is treated as due (today or overdue by day). An additive `callbackAt` field is a Prompt 9 candidate.
- Print Orders maps to the existing Orders screen rather than being marked soon.
- The desktop breakpoint is 768px (matching the kit). Existing screen CSS still switches its own mobile rules at 760px; the eight-pixel band is covered by the shell's top bar back button.
- The top bar title changes to the record name on both mobile and desktop when a detail is open. The screens' own headers were left as they are (no screen internals redesigned), so the list panels still show their own titles beneath the top bar.
- Overlays keep using the kit's Sheet, Popover, and Menu; nothing new was built for the shell.
- The avatar shows the initials "RO" from the name Rob; there is no account image in the data.

## 10. Skipped or deferred

- The console's "peek" branches (a lead viewed as a session card outside a session) no longer have an opener. They stay until the Call Console rebuild retires them.
- No callback date field; see section 9.
- The command bar does not search submissions; those have their own list search.
- Old `vz_lookup_recent` entries are not migrated into the new recents.
- The "Rob'neH?" greeting strings on the dashboard are unchanged (Prompt 5).
- Sidebar grid texture is on; a preference toggle can come with Settings later.

## 11. What Prompt 5 (Dashboard) must know

- Render inside the shell as today: AdminApp mounts `ToastProvider` once, injects `uiStyles + shellStyles + aaStyles` once through `AppShell`, and the Dashboard is the `dashboard` section's child of `.aa-app`. Use `<main className="aa-main aa-main--wide lay-scroll">` (or ScrollArea) as the section root so the mobile shell shows it.
- Title and back: `import { useTopBar } from '../shell/ShellContext'` and call `useTopBar({ title, back })` while a detail is open, `useTopBar(null)` otherwise. The default title is the nav label from `src/shell/nav.js`.
- Navigation from a screen: `const shell = useShell()` then `shell.go('calls')`, `shell.openRecord(lead)`, `shell.openCommand()`, `shell.openNotifications()`, `shell.newLead({ phone })`, `shell.newClient()`. The Dashboard's stat tiles should call `shell.go` instead of the `onGo` prop.
- Tab and sidebar badges come from the `counts` object AdminApp passes to `AppShell`: `leads` (not yet called), `calls` (callbacks due), `booked`, `orders`, `submissions`. Add a key in AdminApp and reference it as `badge` in nav.js to light a new badge. Skeleton badges show while `countsLoading` is true.
- Notifications already compute callbacks, meetings, and new leads; the Dashboard can reuse `buildNotifications(leads)` from `src/shell/notifications.js` for its "today" panel instead of recomputing.
- Hex baseline for Prompt 5 is 606.
