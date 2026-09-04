# PROMPT 03 REPORT: Component primitives and the loading system

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`.
Commits: kit (`src/ui`), confirm migration + ToastProvider, /design Components section + audit coverage, this report.

## 1. What was built

- `src/ui/`: 52 files, one component per file, default export, JSDoc props, CSS-in-JSX in the same file, every value read from `var(--v-...)`. Zero raw hex, zero alias variables, zero em dashes (verified by grep).
- `src/ui/index.js` re-exports everything and builds `uiStyles` (tokens plus every component sheet), injected once by each app shell.
- Layout primitives moved from `src/components/AdminLayout.jsx` into `src/ui` with behavior and LAYOUT.md rules intact, CSS converted to `--v-` tokens, plus Stack, Row, Grid, Section, Divider.
- Surfaces: Card, StatCard, IconTile, Pill, Badge, Avatar, EmptyState, ErrorState, ListRow, each data one with a `.Skeleton`.
- Controls: Button, IconButton, Chip and ChipGroup, FieldShell with Input, Textarea, Select, InlineEdit, Toggle, Checkbox, SegmentedControl, Tabs.
- Overlays and feedback: Sheet (bottom sheet on mobile, side panel on desktop), Modal, ConfirmDialog with useConfirm, Toast with ToastProvider and useToast, Tooltip, Popover, Menu.
- Loading system: SkeletonBlock, SkeletonText, SkeletonCircle with one shared shimmer, useDelayedLoading, Stagger, Reveal, ProgressRing, ProgressBar, Spinner, useOptimisticPatch.
- Both old modal systems removed and every delete confirmation migrated (section 4).
- `/design` Components section proving every primitive.
- `docs/COMPONENTS.md`, LAYOUT.md and TOKENS.md updates.

## 2. Files created, changed, deleted

Created (`src/ui/`): tokens.js, index.js, icons.jsx, semantic.js, portal.js, PageShell.jsx, ScrollArea.jsx, StickyFooterBar.jsx, Stack.jsx, Row.jsx, Grid.jsx, Section.jsx, Divider.jsx, Skeleton.jsx, Card.jsx, StatCard.jsx, IconTile.jsx, Pill.jsx, Badge.jsx, Avatar.jsx, EmptyState.jsx, ErrorState.jsx, ListRow.jsx, Spinner.jsx, Button.jsx, IconButton.jsx, Chip.jsx, FieldShell.jsx, Input.jsx, Textarea.jsx, Select.jsx, InlineEdit.jsx, Toggle.jsx, Checkbox.jsx, SegmentedControl.jsx, Tabs.jsx, Sheet.jsx, Modal.jsx, ConfirmDialog.jsx, Toast.jsx, Tooltip.jsx, Popover.jsx, Menu.jsx, Reveal.jsx, Stagger.jsx, ProgressRing.jsx, ProgressBar.jsx, useDelayedLoading.js, useOptimisticPatch.js, useMediaQuery.js, useFocusTrap.js, useScrollLock.js.
Created elsewhere: `src/pages/AdminDesignComponents.jsx`, `docs/COMPONENTS.md`, `reports/PROMPT-03-REPORT.md`.

Changed: `src/pages/AdminApp.jsx` (imports from `../ui`, ToastProvider wraps the shell, ConfirmModal and `.aa-modal*` CSS removed, two callers on ConfirmDialog), `src/pages/AdminLeads.jsx` (ConfirmDelete removed, two callers on ConfirmDialog), `src/pages/AdminCalls.jsx` (useConfirm for the edit-form delete), `src/pages/AdminClients.jsx` (useConfirm at three sites), `src/components/Checklists.jsx` (useConfirm), `src/pages/AdminBooked.jsx` and `src/pages/AdminDesign.jsx` (import path; the design page gained the Components section and now renders on mobile), `scripts/layout-audit.mjs`, `LAYOUT.md`, `docs/TOKENS.md`. Page knobs `--lay-stack-gap` renamed to `--v-stack-gap` at their eight setters.

Deleted: `src/components/AdminLayout.jsx` (moved), ConfirmModal, ConfirmDelete, `.aa-modal-overlay/.aa-modal/.aa-modal-title/.aa-modal-body/.aa-modal-actions` CSS.

## 3. Component list with variants

| Component | Variants, states, sizes |
|---|---|
| PageShell, ScrollArea (`wide`, `bare`), StickyFooterBar | unchanged behavior |
| Stack, Row, Grid, Section, Divider | gap from the space scale; Grid auto-fit by `minColumnWidth` or fixed `columns`; Divider label and vertical |
| Card | level 1/2/3, padding, interactive, glow (tone), header, footer, selected; `Card.Skeleton` |
| StatCard | icon, tone, value, label, trend up/down/flat, onClick; `StatCard.Skeleton` |
| IconTile | sizes sm/md/lg, every tone, glow on/off; `IconTile.Skeleton` |
| Pill | soft/solid/outline, sizes md/sm, dot, icon off, semantics id or manual override; `Pill.Skeleton` |
| Badge | count, 99+, dot, tone, inline, corner-pinned on a child |
| Avatar | xs/sm/md/lg/xl, image or initials, status dot; `Avatar.Skeleton` |
| EmptyState | md/sm, icon, action, secondary |
| ErrorState | retry, retrying, details disclosure |
| ListRow | leading, subtitle, meta, trailing, tappable, selected, chevron; `ListRow.Skeleton` |
| Button | primary/secondary/ghost/danger/icon, md/lg, loading, disabled, icon start/end, full, link |
| IconButton | ghost/secondary/primary/danger, md/lg, active, badge, tooltip |
| Chip, ChipGroup | selected, count, icon, disabled; multi or single; nothing selected means all |
| Input, Textarea, Select (FieldShell) | label, hint, error, leading, trailing, required, disabled, inputmode passthrough |
| InlineEdit | text or multiline, onSave or patch, saving state, rollback with error toast |
| Toggle | md/sm, description, disabled |
| Checkbox | checked, indeterminate, disabled |
| SegmentedControl | md/sm, full, icons, arrow keys |
| Tabs | counts, icons, scrolls sideways, arrow keys |
| Sheet | mobile bottom (drag, swipe to dismiss, fit or tall), desktop side panel, footer |
| Modal | sm/md/lg, danger, close button, footer |
| ConfirmDialog, useConfirm | danger, custom labels, async confirm with loading |
| Toast | success/error/info/undo (countdown), action, description, dismiss, pause on hover |
| Tooltip | top/bottom, desktop only |
| Popover | align start/end/stretch, side flips, width, trap |
| Menu | items, dividers, danger, disabled, custom trigger |
| Skeletons | block, text, circle |
| Stagger, Reveal | cap, delay |
| ProgressRing, ProgressBar | tone, size, thickness, center slot; bar sm/md, label, indeterminate |
| Spinner | size |

## 4. Modal migration

Old system one: `ConfirmModal` in AdminApp (two callers: bulk delete of submissions or orders, purge of Recently deleted). Old system two: `ConfirmDelete` in AdminLeads (two callers: single lead delete, bulk lead delete). Both replaced by `ConfirmDialog` with the same titles, bodies, and labels.

The five browser `window.confirm` delete confirmations also moved to `useConfirm`: Call Console edit-form delete, Clients form delete, purchase ledger remove, move client back to Booked, checklist delete.

Confirmation the old code is gone: `grep -rn "ConfirmModal\|ConfirmDelete\|aa-modal\|window.confirm" src` returns nothing outside PrintsAdmin and ClientPortal, which Prompt 2 and 3 were told not to touch. The `.lay-overlay` and `.lay-modal-box` contract classes remain because LeadImport and the Call Console edit panels still use them; those panels migrate to Sheet with the Call Console screen.

## 5. Loading system API (copy from here)

```js
import { useDelayedLoading, StatCard, ListRow, Grid, Stack, Stagger, useOptimisticPatch, useToast } from '../ui';

const showSkeleton = useDelayedLoading(loading);          // false for the first 150ms
if (showSkeleton) return (
  <Grid minColumnWidth={170}>{[1, 2, 3, 4].map(i => <StatCard.Skeleton key={i} trend />)}</Grid>
);
return (
  <Stagger className="v-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))', gap: 'var(--v-space-3)' }}>
    {stats.map(s => <StatCard key={s.label} {...s} />)}
  </Stagger>
);
```
- Skeleton pattern: every data component exports `X.Skeleton` shaped like its loaded state. Use the same wrapper (Grid or Stack) for both states so nothing jumps.
- `Stagger` plays once per mount; first 8 children step 40ms apart, the rest arrive together. Give it the layout class of the wrapper it replaces.
- `Reveal` for one element; `ProgressRing`/`ProgressBar` animate on mount and on value change.
- `Spinner` only inside buttons (`<Button loading>`).
- Optimistic writes:
```js
const mutate = useOptimisticPatch();
await mutate({ url: '/api/admin/call-leads', id, set: { priority: 'hot' },
  apply: () => { const prev = lead.priority; setLead(l => ({ ...l, priority: 'hot' })); return () => setLead(l => ({ ...l, priority: prev })); },
  error: 'Could not update priority.' });
```
- Inline edits: `<InlineEdit value={lead.askFor} patch={{ url: '/api/admin/call-leads', id: lead._id, key: 'askFor' }} onChange={...} />`.
- Toasts: `const toast = useToast(); toast.undo('Lead deleted.', restore, { seconds: 6 });`

## 6. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 3 (03322e2) | 621 | 108 |
| After Prompt 3 | 621 | 108 |

The kit added zero literals; the removed modal CSS held none.

## 7. Layout audit

`scripts/layout-audit.mjs` against the final build, now including the design page with the Sheet open and the Modal open.

| Width | Checks | Result |
|---|---|---|
| 320 | 18 | all clean |
| 390 | 18 | all clean |
| 430 | 18 | all clean |
| 768 | 17 | all clean |
| 1280 | 17 | all clean |

Exit 0, zero offenders. Tabs and SegmentedControl are registered as intended horizontal scrollers (the tab strip scrolls inside its own box, the box fits the viewport).

Three defects the first audit run and the screenshots caught, all fixed before the final run: token-sized icons broke the SVG width attribute and rendered huge (the icon helper now sets tokens on style with a numeric attribute fallback); the design page was blank on mobile because its root lacked the class the mobile shell shows (this also affected Prompt 2); the indeterminate ProgressBar sweep was a box moving past its track (now a track background animation).

## 8. Decisions

- Primary buttons rest on `--v-red-hover` (white label 5.11:1), hover to the brand red, press to the highlight. This closes the Prompt 2 contrast exception for buttons.
- Overlays portal into `.lay-root`, not `document.body`, so they inherit the tokens.
- The desktop breakpoint for Sheet and toast placement is 768px, matching the admin shell.
- `useConfirm` returns a promise so the migrated call sites stayed one-line changes.
- `useOptimisticPatch` is the name (not `useOptimistic`) to avoid colliding with React 19's hook when the app upgrades.
- Icon props take a semantics name string or a component; the map lives in `src/ui/icons.jsx`.
- Skeleton shimmer duration is `--v-dur-slow` x 4 as specified and stops under reduced motion.

## 9. Skipped or deferred

- Call Console edit and new-lead panels (`.cc-overlay/.cc-panel`) and LeadImport still use their own overlay markup on the `.lay-overlay` contract. They were not confirmation modals and migrate to Sheet with their screens.
- Existing screens keep their local styles and alias variables; adoption is Prompts 4 to 12.
- The AdminLeads local `ld-toast` stays until that screen is rebuilt on useToast.
- No table component yet; Prompt 5 adds it with the leads table view.
- The light theme stub stays unwired.

## 10. What Prompt 4 must know

- Import path: `import { ... } from '../ui'` (from `src/pages` or `src/components`). Never import from `src/ui/<file>` directly, and never from the deleted `src/components/AdminLayout`.
- Inject styles once per shell: `<style>{uiStyles}</style>` inside the `.lay-root` element. AdminApp already does this and already mounts `ToastProvider`.
- Sheet for the notifications drawer and the mobile More sheet:
  `<Sheet open onClose title="Notifications" footer={...} width={420} tall>` renders a bottom sheet under 768px and a right panel above. Escape, backdrop, swipe, focus trap, and scroll lock are built in. Use `label` when there is no title.
- Popover for command bar results:
  `<Popover open onClose anchorRef={inputRef} align="stretch" trap={false} label="Results">` keeps focus in the input, matches the input width, flips upward when there is no room, and closes on outside pointer, Escape, or ancestor scroll. Default z is `--v-z-command`.
- Badge for the tab bar and rail counts:
  `<Badge count={n}><IconButton icon={Bell01} label="Notifications" /></Badge>` pins the bubble on the corner, hides at 0, shows `99+` above the max. `<Badge dot>` for unread without a number, `inline` for text flow. IconButton also takes `badge={n}` directly.
- Tabs and SegmentedControl scroll sideways by design; the audit treats `.v-tabs` and `.v-seg` as intended scrollers.
- Layout tokens now exist for the shell: `--v-sidebar-w`, `--v-sidebar-rail-w`, `--v-tabbar-h`, `--v-content-w`, `--v-content-w-wide`, `--v-panel-w`, `--v-gutter-l/-r`, `--v-inset-top/-bottom`.
- Hex baseline for Prompt 4 is 621.
