# Component kit (`src/ui/`)

Every screen from Prompt 4 on is assembled from these. One component per
file, default export, CSS-in-JSX in the same file, every value read from the
`--v-` tokens (`docs/TOKENS.md`), every label and tone from
`src/shared/semantics.js`. Screens import from one path:

```js
import { Card, StatCard, Pill, Button, Sheet, useToast, Stagger, useDelayedLoading } from '../ui';
```

`uiStyles` (tokens + every component stylesheet) is injected once by each
app shell: `<style>{uiStyles}</style>` inside the `.lay-root` element.
Overlays (Sheet, Modal, Popover, Toast) portal into `.lay-root` so they
inherit the tokens. The toast host is one polite live region that stays
mounted; the shell's offline banner is the other.

Rules the kit keeps for you: every interactive element is at least
`--v-tap` (44px) on both axes, shows a `--v-border-focus` ring on
`:focus-visible`, works with keyboard, and animates with `--v-dur-*` and
`--v-ease-*` only (all durations are 0ms under `prefers-reduced-motion`).
No em dashes in copy.

`icon` props accept either an Untitled UI component or an icon name string
from semantics (`'Phone'`, `'Zap'`, `'CalendarCheck01'`); see
`src/ui/icons.jsx` for the map.

---

## Layout

### PageShell, ScrollArea, StickyFooterBar
Unchanged from LAYOUT.md (moved from `src/components/AdminLayout.jsx`).
`PageShell` wraps its children in an `ErrorBoundary` (`label` names the
region in the message). `ScrollArea` props: `wide`, `bare`, `contentClassName`;
a scroller whose only child is `aria-busy` stops scrolling until the data
lands. Per-page knobs: `--v-stack-gap`, `--v-scroll-extra`.
Use when: every page. Not when: never hand-roll a scroll container.

### Stack
`gap` (space step 1..12, default 4), `align` (`start|center|end|stretch`), `as`.
Use when: vertical rhythm between blocks. Not when: you need columns (Grid).

### Row
`gap` (default 3), `align` (`start|center|end|baseline|stretch`), `justify`
(`start|center|end|between`), `wrap`, `as`.
Use when: a toolbar, a meta line, side-by-side controls. Not when: the items
should reflow into a grid (use Grid).

### Grid
`minColumnWidth` (px, default 180), `columns` (fixed count), `gap`.
Auto-fits as many tracks as fit, each at least `minColumnWidth`. This is the
dashboard stat-card pattern.
Use when: cards or tiles of equal weight. Not when: a list (Stack of ListRow).

### Section
`title`, `description`, `action` (right slot), `gap`, `loading` (keeps the
description line as a skeleton so the header never shifts when the summary lands).
Renders the uppercase xs label, optional description, and an action slot.
Use when: grouping a block of a detail page. Not when: page titles (those are display type in the shell).

### Divider
`label`, `vertical`.

---

## Surfaces

### Card
`level` 1|2|3 (surface-1/2/3), `padding` (space step, 0 for none),
`interactive` (hover lift, press, focus ring; automatic when `onClick` is
given, renders a `<button>`), `glow` (status tone for the corner glow),
`header`, `footer`, `selected`, `as`.
`Card.Skeleton({ level, padding, lines, height })`.
Use when: any bounded surface. Not when: a list row (ListRow) or a stat (StatCard).

### StatCard
`icon`, `tone`, `value`, `label`, `trend {value, direction: up|down|flat, tone?}`, `onClick`.
`StatCard.Skeleton({ trend })` is the same box.
Use when: one number with a label. Not when: several numbers (Card with a Row).

### IconTile
`icon`, `tone`, `size` sm|md|lg (32/40/48), `glow`. `IconTile.Skeleton`.
Use when: a tinted icon square in lists and stats. Not when: a tappable control (IconButton).

### Pill
`id` (semantics id or tone name), `list` (which semantics list, when ids collide),
`label`, `tone`, `icon` (`false` to hide), `variant` soft|solid|outline,
`size` md|sm, `dot`. `Pill.Skeleton`.
Label, tone, and icon come from semantics automatically; explicit props win.
Use when: showing a status, priority, or stage. Not when: a selectable filter (Chip).

### Badge
`count`, `max` (default 99, renders `99+`), `dot`, `tone` (default won = brand red), `inline`.
Wrap a child to pin the badge on its corner: `<Badge count={3}><IconButton .../></Badge>`.
Hidden when count is 0.
Use when: unread and pending counts. Not when: a status (Pill).

### Avatar
`name` (initials, deterministic chart hue, alt text), `src`, `size`
xs|sm|md|lg|xl (24/32/40/56/72), `status` (tone for the corner dot).
`Avatar.Skeleton({ size })`; `initialsOf(name)` exported.
Use when: a lead, client, or person. Not when: a category icon (IconTile).

### EmptyState
`icon`, `title`, `description` (one line), `action {label, onClick|href, icon}`,
`secondary {label, onClick|href}`, `size` md|sm. `role="status"`.
Copy rule: say what will appear here and how to make it happen. Never "No data".

### ErrorState
`title`, `description`, `onRetry`, `retryLabel` (default Try again), `retrying`, `details` (behind a disclosure). `role="alert"`.

### ErrorBoundary
`label` (what broke, for the message), `reload` (the button reloads the page
instead of resetting the boundary), `fallback(error, reset)`, `onError`.
Catches a render error below it, logs it through `src/shared/log.js` to
/api/admin/log, and shows ErrorState with Reload. PageShell mounts one per
screen region; AdminApp keys one per section; `src/shell/ShellCrash.jsx` is
the top level one (the login card outline with the message).
`useRetry(refetch)` returns `[retry, retrying]` for the Try again button.
Copy for every empty and error state lives in `src/shared/copy.js`
(`COPY.empty['screen.state']`, `COPY.error.<resource>`); screens never type it inline.

### ListRow
`leading`, `title`, `subtitle`, `meta`, `trailing`, `onClick`, `selected`,
`chevron`, `aria-label`. `ListRow.Skeleton({ leading, trailing })`.
Titles truncate on one line (`.lay-truncate`). Min height `--v-tap-lg`.
A row with `onClick` keeps one real button stretched over the row
(`.v-stretch`, named by `aria-label` or the string title); `leading` and
`trailing` sit above it (`.v-above`), so a Menu or a Button in `trailing`
never nests inside the row's button. Rows given a `role` (the command bar's
options) stay one element. The same two classes are the pattern for any card
that opens something (LeadCard, the Reviews card): the parent is
`position: relative`, the open button is `.v-stretch`, other controls are `.v-above`.
Use when: any list. Not when: a table with many columns (Table).

---

## Controls

### Button
`variant` primary|secondary|ghost|danger|icon, `size` md|lg, `loading`
(spinner replaces the label, width stays), `disabled`, `icon`, `iconEnd`,
`full`, `href` (renders `<a>`), `type` (default button).
Primary rests on `--v-red-hover` (white label 5.11:1), hovers to `--v-red`,
presses to `--v-red-highlight`. Use `aria-label` with `variant="icon"`.
Use when: an action. Not when: navigation between sections (a link styled as ghost is fine).

### IconButton
`icon`, `label` (required: accessible name and tooltip), `variant`
ghost|secondary|primary|danger, `size` md|lg, `active`, `badge`, `tooltip` (default true).

### Chip and ChipGroup
`Chip`: `label`, `count`, `selected`, `icon`, `onClick`, `disabled` (`aria-pressed`).
`ChipGroup`: `options [{id,label,count,icon}]`, `value` (Set for multi, id for
single), `onChange`, `multi` (default true), `allWhenEmpty` (default true:
nothing selected means all, and an "All" hint renders), `label`.
Use when: filters and the session builder. Not when: a single choice with a
visible current state (SegmentedControl).

### FieldShell, Input, Textarea, Select
Shared shell: `label`, `hint`, `error` (replaces hint, danger border,
`aria-invalid`, `role=alert`), `leading`, `trailing`, `required`, `disabled`.
`Input` passes everything else to `<input>`: `type`, `inputMode` (`tel` for
phone fields), `placeholder`, `value/onChange`, `autoComplete`.
`Textarea`: `rows`. `Select`: `options [{id,label,disabled}]` or `<option>`
children, `placeholder`. Height `--v-control-h`; focus ring on the shell.
Use when: any form field. Not when: a single value edited in place (InlineEdit).

### InlineEdit
`value`, `onSave(next) => Promise<boolean>|boolean` or `patch {url, id, key}`
(uses `patchWithRollback`), `onChange` (after a successful save), `format`,
`placeholder`, `label`, `type`, `inputMode`, `multiline`, `errorMessage`.
Tap to edit, Enter or blur saves (Cmd/Ctrl+Enter when multiline), Escape
cancels, spinner while saving, rolls back and shows an error toast on failure.
Use when: row-by-row edits on a detail page. Not when: several fields save together (a form in a Sheet).

### Toggle
`checked`, `onChange(next)`, `label`, `description`, `disabled`, `size` md|sm. `role="switch"`.
Use when: a setting that applies immediately. Not when: part of a form that submits (Checkbox).

### Checkbox
`checked`, `onChange(next)`, `label`, `indeterminate`, `disabled`.
The whole 44px row is the target.

### SegmentedControl
`options [{id,label,icon}]`, `value`, `onChange`, `size` md|sm, `full`, `label`.
Radio semantics, arrow keys move. Every option is a 44px target in both
sizes; `sm` only shrinks the label and padding.
Use when: two to four views of the same data (Kanban / Table, Week / Day).

### Tabs
`tabs [{id,label,count,icon,pulse}]`, `value`, `onChange`, `label`. One
underline slides between tabs (`--v-dur-base`), scrolls sideways on narrow
screens, arrow keys move, the active tab scrolls into view; `pulse` plays one
booked tone pulse on that tab (a retainer just started).
Use when: sections of one record. Not when: switching views of a list (SegmentedControl).

### Table
`columns [{ id, label, render(row), sortable, defaultDir, width, align, always }]`,
`rows` (already sorted by the parent), `rowKey` (default `_id`), `selectable`,
`selected` (Set), `onSelect(nextSet)`, `sort {id, dir}` with `onSort`, `density`
md|sm, `onRowClick(row)`, `rowActions(row)` (a Menu in the trailing cell),
`storageKey` (persists hidden columns), `columnChooser` (default true),
`empty` slot, `rowClassName(row)`, `pageSize` (default 80: rows mount in
pages as the end scrolls into view, so 400 rows never mount at once; sort and
selection still cover every row). Sticky header, sticky first column on
horizontal scroll, header checkbox with indeterminate state, keyboard sort
(the header is a button), Enter opens a row. The first eight rows step in
`--v-stagger` apart on mount (`data-v-enter`); rows added later settle. `Table.Skeleton({ rows, cols,
density, selectable })` has the same header shape.
Use when: desktop data with many columns. Not when: mobile (render a Stack
of cards) or a short list (ListRow).

---

## Overlays and feedback

### Sheet
`open`, `onClose`, `title`, `description`, `footer`, `width` (desktop, default
420), `tall` (mobile: full height instead of fit-to-content), `label`.
Mobile: bottom sheet with drag handle, sized to content (max 100dvh minus
32px), swipe down on the handle or header to dismiss, bottom padding
`--v-inset-bottom`. Desktop (768px and up): right side panel. Focus trap,
scroll lock, Escape and backdrop close, `z: --v-z-sheet`, exit animation.
Use when: a detail, a form, a drawer (notifications, filters, More). Not when: a yes/no (ConfirmDialog).

### Modal
`open`, `onClose`, `title`, `description`, `footer`, `size` sm|md|lg
(420/560/720), `danger`, `closeButton`, `label`. Same a11y rules, `z: --v-z-modal`.
Give the first field `data-autofocus` to focus it on open.
Use when: confirmations and short forms. Not when: long content (Sheet).

### ConfirmDialog and useConfirm
`ConfirmDialog`: `open`, `onClose`, `onConfirm` (may return a promise; the
button shows loading until it settles), `title`, `body`, `confirmLabel`,
`cancelLabel`, `danger`, `icon`.
`useConfirm()` returns `[confirm, element]`:
```js
const [confirm, confirmDialog] = useConfirm();
if (!(await confirm({ title: 'Delete Garcia Landscaping?', body: '...', danger: true, confirmLabel: 'Delete' }))) return;
// render {confirmDialog} anywhere in the component's tree
```
This replaced `ConfirmModal`, `ConfirmDelete`, and every `window.confirm` in the admin.

### Toast
Mount `<ToastProvider>` once (done in `AdminApp`). Then:
```js
const toast = useToast();
toast.success('Saved.');
toast.error('Could not save.', { description: 'Your change was undone.' });
toast.info('Enrichment runs tonight.');
toast.undo('Lead deleted.', () => restore(id), { seconds: 6 });   // countdown bar
const id = toast.show({ title, description, variant, duration, action: { label, onClick } });
toast.dismiss(id);
```
Stacked (max 4), bottom center above the tab bar on mobile, bottom right on
desktop, `z: --v-z-toast`. Hover pauses the timer. Errors use `role=alert`.

### Tooltip
`label`, `side` top|bottom, one focusable child. Desktop only (hover and
focus on fine pointers); on touch the child renders alone, so keep its `aria-label`.

### Popover
`open`, `onClose`, `anchorRef`, `align` start|end|stretch (stretch = anchor
width), `side` bottom|top (flips when there is no room), `width`, `trap`
(focus trap for menus; off for typeahead results), `z` (default
`--v-z-command`), `label`. Closes on Escape, outside pointer, ancestor scroll.
Use when: command bar results, small menus, pickers. Not when: content taller than a few rows (Sheet).

### Menu
`items [{id,label,icon,danger,disabled,onSelect} | 'divider']`, `trigger`
(default: a dots IconButton), `label`, `align`. `role=menu`, arrow keys,
Home/End, Enter, Escape.
Use when: the three-dot actions on a card or row.

---

## Loading and motion

### SkeletonBlock, SkeletonText, SkeletonCircle
`SkeletonBlock({ width, height, radius })`, `SkeletonText({ lines, width, lineHeight })`,
`SkeletonCircle({ size })`. One shared `v-shimmer` keyframe: diagonal
`--v-surface-3` highlight over `--v-surface-2`, duration `--v-dur-slow` x 4,
static under reduced motion. Every data component above exports a matching
`.Skeleton` shaped exactly like its loaded state.

### useDelayedLoading(isLoading, delay = 150)
False for the first 150ms of a load, then true. Every screen gates its
skeletons on this so fast responses never flash.
```js
const showSkeleton = useDelayedLoading(loading);
if (showSkeleton) return <Grid>{[1,2,3,4].map(i => <StatCard.Skeleton key={i} />)}</Grid>;
```

Every `*.Skeleton` and RecordSkeleton carries `aria-busy` and `aria-hidden`
(Prompt 15): the region announces busy, the shimmer blocks never reach the
accessibility tree, and a scroller whose only child is busy waits.

### Stagger
`cap` (default 8), `offset` (stagger steps to wait, for reading order across
columns), `as`, `className`, `style`. Wraps each child in a `.v-stagger-item`
that fades in and rises 8px, `--v-stagger` apart for the first `cap` children;
everything after arrives with the last. Plays once per mount, never on re-render. Give it the Grid or Stack class to keep the layout:
`<Stagger className="v-grid" style={{ gridTemplateColumns: ..., gap: ... }}>`.

### Reveal
`delay`, `as`. Single-element entrance.

### ProgressRing
`value` 0..100, `size` (64), `thickness` (6), `tone`, `label`, `children`
(center slot; default is the percentage). Animates on mount and on change.

### ProgressBar
`value`, `tone`, `size` md|sm, `label` (adds a label row with percentage), `indeterminate`.

### Spinner
`size`. Inline only, for button loading. Never full page.

### RecordSkeleton
`cards` (default 3), `tabs`, `header` (default true). The shape of a record
detail while a deep link resolves: a header card (avatar, name, pills,
actions), an optional tab strip line, then content cards. Panels, Sheets, and
`LeadDetail.Skeleton` (which adds the profile column) use it.

### Motion helpers (`src/ui/motion.js`)
`durationMs('--v-dur-base')` reads a duration token from `.lay-root` (0 under
reduced motion), `motionReduced()` says whether motion is off. Every JS timer
that has to outlast a transition (Sheet and Modal close, Collapsible settle,
Toast leave, Stagger settle, the call room pulse) reads these. The page level
crossfade lives in PageShell (`.lay-view` on the shell's content region,
`.lay-tabbody` for tab bodies inside a screen).

### Success moments
`.v-pulse-won` (Card styles) is the one shot ring and lift in the won tone;
Badge ticks (scale bounce) when its count grows; Checkbox marks pop; the
Dashboard ring pulses red once when the target is hit.

### useOptimisticPatch
```js
const mutate = useOptimisticPatch();
await mutate({
  url: '/api/admin/call-leads', id: lead._id, set: { priority: 'hot' },
  apply: () => { const prev = lead.priority; setLead(l => ({ ...l, priority: 'hot' })); return () => setLead(l => ({ ...l, priority: prev })); },
  error: 'Could not update priority.', success: 'Marked hot.',
});
```
Wraps `patchWithRollback` from `src/shared/api.js`: apply locally, PATCH, roll
back with an error toast on failure. Resolves true or false.

### Other hooks
`useMediaQuery(query)` (+ `DESKTOP_QUERY`, `HOVER_QUERY`), `useFocusTrap(ref,
active, { onEscape })`, `useScrollLock(active)`, `useOnline()` (the shell's
offline banner; `apiFetch` refuses writes while offline and fires a toast).

---

## Proof

`/design` (Settings, Design system) renders every component in every variant,
state, and size, each skeleton beside its loaded state, a dashboard that
flips between skeleton and loaded to show the stagger entrance, toast
triggers, Sheet and Modal triggers, an InlineEdit wired to a save that fails
every third time, and the ProgressRing animating. `scripts/layout-audit.mjs`
walks it (with the Sheet and Modal open) at 320, 390, 430, 768, and 1280.

---

## The shell (`src/shell/`)

Built in Prompt 4 on top of the kit. Screens never import shell internals;
they use two things:

- `src/shell/nav.js`: the single list of destinations (id, label, icon, path,
  group, badge key, mobile tab, soon). Sidebar, tab bar, More sheet, command
  bar "Jump to", and the top bar title all render from it.
- `useTopBar({ title, back })` from `src/shell/ShellContext.jsx`: a screen with
  an open detail sets the top bar title and back button while mounted; pass
  `null` to restore the nav label. `useShell()` exposes `go(navId)`,
  `openRecord(lead)`, `openCommand()`, `openNotifications()`, `newLead(preset)`,
  `newClient()`.

`AppShell` receives `counts` for the badges (`leads`, `calls`, `booked`,
`orders`, `submissions`, `calendar`), the call_leads list for the command bar and the
notifications drawer, the `projects` list (Prompt 10, for retainer bills and
payment plan markers), and callbacks for navigation, opening a record, quick
add, and sign out. `useShell()` also exposes `events`, `calendly`, `projects`, `packs` (Prompt 11, the concept packs), `newOrder()`, and (Prompt 12) `health` (the task health document) and `profile` with `setProfile`.
`src/shell/shortcuts.js` holds every keyboard shortcut (rendered by Settings); `src/shell/install.js` captures the PWA install prompt.
`src/shell/appearance.js` (Prompt 14) owns the theme mode and the Reduce motion switch (`useAppearance`, `setThemeMode`, `setReduceMotion`, the `vz_theme`, `vz_motion`, and `vz_boot` keys); `useShell()` exposes `appearance` and `saveAppearance(patch)`, which also writes the profile document.
`src/shell/bootFrame.js` is the skeleton frame index.html paints before the bundle (injected by the Vite plugin in vite.config.js) and `BootFrame.jsx` renders the same markup while the session check runs. Screens receive `openId` (`{ id, n }`) and `createPreset`
(`{ preset, n }`) props from AdminApp when the shell asks them to open a
record or start a new one.

## Shared lead components (`src/components/`)

- `LeadCard` (Prompt 6): the compact card. Styles ship in `uiStyles` since Prompt 7.
- `Checklists` (kit build, Prompt 13): named task lists on Card, Checkbox, Input, IconButton. Props `lead`, `onPatch`.
- `LinkedSubmissions` (kit build, Prompt 13): linked and suggested site submissions on ListRow, Pill, Collapsible. Props `lead`, `submissions`, `onLinkSubmission`; exports `suggestFor`.
- `SocialLinks` (Prompt 13): only `SocialFields` remains (one kit Input per channel for LeadForm). The read view went with the old Clients screen.
- Login (AdminApp): a kit Card, Input, and Button; the wrong-password shake is a token timed animation on `.aa-login.is-shaking`, disabled under reduced motion.
- `LeadForm` (Prompt 7): the one create/edit form on kit fields, used by Leads and the Call Console. Props `lead`, `creating`, `onSave(values)`, `onCancel`, `onDelete(id)`.
- `LeadHistory` (Prompt 7): callLog and contactLog merged newest first with outcome pills. Props `lead`, `limit`. Export `leadHistoryStyles`.
- `LeadNotes` (Prompt 7): notes Textarea with InlineEdit semantics (save on blur or Cmd/Ctrl+Enter, rollback and toast on failure). Props `lead`, `onSave(id, notes)`, `rows`. Export `leadNotesStyles`.
- `LeadPlaybook` (Prompt 7): `ScriptSteps`, `Objections`, `CloseCards`, `IntelCards`, each taking `lead`. Export `playbookStyles`.
- `LeadDetail` (Prompt 8, client mode in Prompt 10): the one record detail. Pass `client={{ projects, onCreateProject, onPatchProject }}` to a client and it swaps Playbook and Meeting for Projects, Payments, Retainer, and Deliverables, and adds the Links and Brand blocks to the profile column.
- `ClientCard` (Prompt 10): `LeadCard` compact plus the client line (active package, project stage, paid over total, retainer, next date). Props `lead`, `projects`, `onOpen`, `selected`, `compact`. Export `clientLine(lead, projects)` for the desktop Table. Styles (`clc-`) ship in `uiStyles`.
- `LeadPicker` (Prompt 11): a Sheet with a search over the loaded leads. Props `leads`, `onPick(lead)`, `onClose`, `title`, `description`, `filter(lead)`, `sort`. Used by Print Orders (Link to client, New order), Concepts (Link a lead), Reviews (Link to client).
- `PackPicker` (Prompt 11, exported from `src/pages/AdminConcepts.jsx`): the From library picker LeadDetail opens on a concept item. Props `packs`, `industry`, `onPick(pack)`, `onClose`.
- `OrdersImport` (Prompt 12): the print orders CSV import Sheet (paste or file, column mapping, preview, dedupe by email, day, subtotal). Props `existing`, `onClose`, `onCreate(doc)`. Exports `parseCsv`.
- `ClientWorkspace` (Prompt 10): `ClientLinks`, `ClientBrand` (profile cards) and `ClientSections` (the four client sections with every Sheet and Modal). Rules live in `src/lib/projects.js`; this file only renders and writes. Styles (`cw-`) ship in `uiStyles`.
