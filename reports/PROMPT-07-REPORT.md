# PROMPT 07 REPORT: Call Console 3.0

Branch `claude/enable-maintenance-page-oDW2r`, fast-forwarded to `main`.
Commits: outcomes and schema (9c17f92), Call Console rebuild (a6e747f), LeadCard wrap fix, this report.

## 1. What was built

- `src/pages/AdminCalls.jsx` rewritten on the kit (688 lines, down from 1858). Mobile first.
- Session builder: Priority, Call status, Industry (industryKey, top 8 plus More popover), Best window (Morning, Midday, Afternoon, Evening, Right now), options, Order select, Session size 10 / 25 / 50 / All persisted, counts that reflect the other groups, "Picked from Leads" chip, Start button with the count Badge.
- Queue view: Session section with ProgressBar and remaining count, pause/end Menu, Stack of compact LeadCards with the next lead highlighted, swipe right to open and left to send to the end, tap to jump into the room.
- Call room: header Card (avatar, display-face business, industry, priority, status, best-window pill lit when it matches now, descriptor, ask for, socials row, enrichment dot), tap-to-call primary Button spanning the width with a timer that runs until an outcome is logged (copy button on desktop), Before you dial checklist (session local), Tabs Script, Objections, Close, Intel, Notes, History (last tab remembered), StickyFooterBar with five outcome Buttons plus Skip and "7 of 25", keycaps from 768px, keyboard 1 to 5, N, S, ?, arrows, Escape.
- Outcomes from semantics: Booked, Callback, No answer, Said no, Wrong number. Each opens a Sheet; No answer, Said no, and Wrong number log immediately on a second tap within two seconds. Optimistic, rolled back with an error toast, success pulse, auto advance, six-second undo Toast.
- Session summary with stats, ProgressRing booked over connects, booked leads as ListRows, Copy win line, New session, Back to dashboard.
- Edit and new lead on a shared `LeadForm` inside a Sheet, delete through useConfirm.
- Desktop from 1024px: queue | room | Notes and History.
- Reusable components extracted: `LeadForm`, `LeadHistory`, `LeadNotes`, `LeadPlaybook` (ScriptSteps, Objections, CloseCards, IntelCards).

## 2. Files created, changed, deleted

Created: `src/lib/calls.js`, `src/components/LeadForm.jsx`, `src/components/LeadHistory.jsx`, `src/components/LeadNotes.jsx`, `src/components/LeadPlaybook.jsx`, `src/ui/leadCard.styles.js`, `reports/PROMPT-07-REPORT.md`.
Changed: `src/pages/AdminCalls.jsx` (rewritten), `src/pages/AdminLeads.jsx` (uses the shared LeadForm; local form and its CSS removed), `src/pages/AdminApp.jsx` (forced loading for the console), `src/shared/semantics.js` (wrong-number status, OUTCOMES order and keys, WINDOWS), `api/_semantics.js` (wrong-number id), `api/admin/call-leads.js` (callbackAt), `src/shell/notifications.js` (callbackAt-aware), `src/ui/icons.jsx` (console icons), `src/ui/index.js` (leadCardStyles in uiStyles), `src/ui/Tabs.jsx` (sideways scroll only), `src/components/LeadCard.jsx` (styles moved out), `scripts/layout-audit.mjs`, `docs/COMPONENTS.md`.
Deleted: nothing at file level. Removed from the console: LookupSheet remnants, peek state and every `isPeek` branch, OutcomeSheet, ShortcutsOverlay, the reject sheet, NewLeadForm, EditLead, Collapse, ScriptBody, QaTable, CallLogList, NotesPanel, PriorityPill, StatusChip, the `cc-`, `cq-`, `cb-`, `cs-`, `lk-` CSS.

## 3. Additive schema and enum changes

| Change | Where |
|---|---|
| `callStatus: 'wrong-number'` (label Wrong number, danger tone, icon PhoneX01 mapped to SlashCircle01) | `src/shared/semantics.js` CALL_STATUSES; `api/_semantics.js` CALL_STATUS_IDS; sanitize accepts it through the existing enum check for `callStatus` and `callLog[].outcome` |
| `callbackAt` (ISO string, when the callback is due) | sanitize: `callbackAt: str(b.callbackAt, 40)` when sent; written by the Callback sheet; read by `src/shell/notifications.js` |
| `phoneNote` stamp "Wrong number (date)" | existing field, set when logging wrong-number; nothing else changes |
| `WINDOWS` (morning, midday, afternoon, evening with hour ranges) | `src/shared/semantics.js`, client only, not persisted |
| `OUTCOMES` order and keys 1 to 5 | `src/shared/semantics.js` |

## 4. Best window first ordering

`windowsOf(bestWindow)` maps the free text to buckets: morning (morning, early, before N am, 5 to 10 am), midday (midday, noon, lunch, 11 am to 1 pm), afternoon (afternoon, 2 to 4 pm), evening (evening, after N pm, night, late, 5 to 9 pm); hour ranges like "2 to 4pm" fill every hour in the range; empty text matches every window; text that matches nothing defaults to midday. `currentWindow()` is the bucket for the current hour (5 to 11 morning, 11 to 14 midday, 14 to 17 afternoon, otherwise evening). Best window first sorts leads whose buckets include the current window ahead of the rest, then by priority hot first, then by status (not called, callback, no answer, wrong number, said no), then newest. It is the default order while Right now is on; the other orders are Priority, Oldest untouched (by last call or contact, never touched first), Newest.

## 5. Outcome logging and undo

1. Snapshot the lead's callStatus, callLog, stage, callbackAt, phoneNote, meeting, afterCall.
2. Build the log entry `{ at, outcome, note, meeting, email }` and the `$set`: callStatus and the appended callLog always; Booked adds `stage: 'booked'`, `meeting {date, time, type}`, and afterCall meeting/email; Callback adds `callbackAt`; Wrong number sets `phoneNote`.
3. Apply locally, bump the session stats and `logged`, close the sheet, stop the timer.
4. PATCH through the existing route. On failure restore the snapshot and the stats and toast "That outcome did not save. It was undone."
5. On success: pulse the header (booked pulses the whole card in booked tone), advance after 520ms. Said no also soft deletes the lead through the existing DELETE and removes it from the queue.
6. Undo Toast (6 seconds): for Said no, restore through the existing `action: 'restore'` first; then PATCH the snapshot fields back, reload, revert the stats, and reinsert the lead at the current position.

## 6. Confirmations

- `grep -rn "cc-sheet-back|cc-overlay|cc-panel|isPeek|setPeek|lk-" src` finds nothing (the only hits are unrelated `bulk-` class names).
- `leadCardStyles` now lives in `src/ui/leadCard.styles.js` and is part of `uiStyles`; the Leads page no longer injects it.

## 7. LeadForm

Shared. `src/components/LeadForm.jsx` is one form on kit fields (Input, Select, Textarea, SocialFields) with delete through useConfirm. The Leads page detail and new-lead flow use it, and the console's edit and new-lead Sheets use it. The Leads page's own LeadForm and `ld-form` CSS are gone. Prompt 8 inherits it.

## 8. Hex count

| Point | Total | Unique |
|---|---|---|
| Before Prompt 7 (559a049) | 578 | 107 |
| After Prompt 7 | 520 | 102 |

## 9. Layout audit

New console checks: builder, skeleton, session queue, room on Script, Objections, Close, Intel, Notes, History, each of the five outcome sheets, shortcuts modal (desktop), edit lead sheet, session summary, plus the collapsed-sidebar builder.

Status at the time of this report: the console audit is queued behind the Prompt 6 rerun on this container and has not produced its tally yet. Screenshots at 390 and 1280 of the builder, queue, room (two scroll positions), callback and booked sheets, the post-log undo toast, and the summary were reviewed; two issues they showed (the display title breaking mid-word in the room, and the desktop center column too narrow beside 324px and 320px side columns) were fixed before the audited build. The Prompt 6 rerun found one more 320px offender, the card's "Next: call back" line not wrapping, fixed in the LeadCard styles. The audit tally is appended to this file in a follow-up commit as soon as the run completes.

## 10. Decisions

- Said no keeps the existing behavior (log, then soft delete) from the earlier console directive; the undo path restores it.
- Callback quick chips write a concrete `callbackAt`; the default is one hour from now.
- The desktop column widths are 264 / flexible / 280 up to 1439px and `--v-panel-w` / flexible / 320 from 1440px, so the room keeps a usable width beside the sidebar.
- Under 480px the room title steps down to the 24px display size so long business names do not break mid-word.
- The timer shows in the top bar title (mobile) or the Call Console title (desktop) rather than adding a second top bar element.
- The notepad import stays on the empty builder as an action, since nothing else offers it.
- "Pause and come back later" in the session Menu simply leaves the session persisted and goes to the dashboard; the session resumes on return.

## 11. Skipped or deferred

- Objections are expandable rows but not editable here (Prompt 8).
- The Booked sheet writes `meeting {date, time, type}`; the free-text `afterCall.meeting` remains for older records.
- No haptics or sound on log; the pulse is the only feedback.
- Wrong number does not mark the phone as invalid beyond the phoneNote stamp.

## 12. What Prompt 8 must know

- Reusable pieces: `LeadHistory({ lead, limit })`, `LeadNotes({ lead, onSave(id, notes), rows })`, and `ScriptSteps`, `Objections`, `CloseCards`, `IntelCards` from `LeadPlaybook`, each with an exported styles string to inject (`leadHistoryStyles`, `leadNotesStyles`, `playbookStyles`) until they move into uiStyles. `LeadForm` is shared and ready.
- `callbackAt` exists now; show it on the detail and let it be edited.
- The Leads detail markup (`ld-detail`, `ld-top`, `ld-block`, etc.) is the last old-style surface in Leads; its copy still has em dashes.
- The `builderPreset` contract is unchanged: `{ status, prio, ids }`.
- Hex baseline for Prompt 8 is 520.
