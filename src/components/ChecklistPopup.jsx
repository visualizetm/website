import { useRef, useState } from 'react';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import ArrowUp from '@untitled-ui/icons-react/build/esm/ArrowUp';
import ArrowDown from '@untitled-ui/icons-react/build/esm/ArrowDown';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import { Modal, Sheet, Stack, Row, Input, Checkbox, Toggle, Pill, ProgressBar, IconButton, Menu, useConfirm, useMediaQuery, DESKTOP_QUERY } from '../ui';

const HIDE_KEY = 'vz-ck-hide-completed';
const readHide = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
const writeHide = (v) => { try { localStorage.setItem(HIDE_KEY, v ? '1' : '0'); } catch { /* device storage unavailable; the toggle still works for this session */ } };

/**
 * ChecklistPopup: one checklist, full screen. Desktop opens a full viewport
 * Modal (dimmed backdrop, centered surface, max 960px); mobile opens a full
 * screen Sheet from the bottom. Edits go through the same `actions` the
 * inline card uses (Checklists.jsx's useChecklistActions), so there is one
 * source of truth: nothing here keeps its own copy of the list.
 * @param {object} props
 * @param {object} props.lead
 * @param {number} props.listIndex
 * @param {{name: string, items: Array}} props.list
 * @param {ReturnType<typeof import('./Checklists').useChecklistActions>} props.actions
 * @param {string} [props.contextName] the lead or client name, shown under the title
 * @param {Function} props.onClose
 */
export default function ChecklistPopup({ listIndex: li, list, actions, contextName, onClose }) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [confirm, confirmDialog] = useConfirm();
  const [hideCompleted, setHideCompleted] = useState(readHide);
  const [draft, setDraft] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');
  const addRef = useRef(null);

  const items = list.items || [];
  const done = items.filter(it => it.done).length;
  const total = items.length;
  const allDone = total > 0 && done === total;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const visible = hideCompleted ? items.map((it, ii) => [it, ii]).filter(([it]) => !it.done) : items.map((it, ii) => [it, ii]);

  const toggleHide = (v) => { setHideCompleted(v); writeHide(v); };
  const addItem = () => { const t = draft.trim(); if (!t) return; actions.addItem(li, t); setDraft(''); addRef.current?.focus(); };
  const removeItem = async (ii, text) => {
    if (!(await confirm({ title: 'Delete this task?', body: text, danger: true, confirmLabel: 'Delete' }))) return;
    actions.removeItem(li, ii);
  };
  const startEdit = (ii, text) => { setEditingIndex(ii); setEditText(text); };
  const commitEdit = () => { if (editingIndex == null) return; actions.editItem(li, editingIndex, editText); setEditingIndex(null); };

  const onListKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const boxes = [...e.currentTarget.querySelectorAll('.ckp-row input[type="checkbox"]')];
    const i = boxes.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? Math.min(boxes.length - 1, i + 1) : Math.max(0, i - 1);
    boxes[next]?.focus();
  };
  const onAddKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addItem(); }
  };

  const header = (
    <div className="ckp-head">
      <div className="ckp-head-top">
        <div className="ckp-head-text">
          <h2 className="ckp-title">{list.name}</h2>
          {contextName && <p className="ckp-sub">{contextName}</p>}
        </div>
        <IconButton icon={XClose} label="Close" variant="ghost" onClick={onClose} className="ckp-close" />
      </div>
      {allDone && <Pill tone="booked" label="All done" icon={false} />}
      <ProgressBar value={pct} tone={allDone ? 'booked' : 'neutral'} label={total ? `${done} of ${total} done` : 'No tasks yet'} />
      {total > 0 && <Toggle checked={hideCompleted} onChange={toggleHide} label="Hide completed" size="sm" className="ckp-hide" />}
    </div>
  );

  const body = (
    <Stack gap={0} className="ckp-items" onKeyDown={onListKeyDown} role="list" aria-label={`${list.name} tasks`}>
      {total === 0 && <p className="ckp-empty">Nothing on this list yet. Add the first item.</p>}
      {visible.map(([it, ii]) => (
        <Row key={ii} gap={2} align="center" className={`ckp-row${it.done ? ' is-done' : ''}`} role="listitem">
          {editingIndex === ii ? (
            <form className="ckp-edit-form" onSubmit={(e) => { e.preventDefault(); commitEdit(); }}>
              <Input value={editText} onChange={(e) => setEditText(e.target.value)} onBlur={commitEdit} autoFocus aria-label="Edit task" className="ckp-edit-input" />
            </form>
          ) : (
            <Checkbox
              checked={!!it.done}
              onChange={(v) => actions.toggleItem(li, ii, v)}
              className="ckp-check"
              label={
                <span className="ckp-item-text" onClick={(e) => { e.preventDefault(); startEdit(ii, it.text); }}>
                  {it.text}
                  {it.note && <span className="ckp-item-note">{it.note}</span>}
                </span>
              }
            />
          )}
          <Menu
            label={`Actions for ${it.text}`}
            items={[
              { id: 'edit', label: 'Edit', icon: Edit02, onSelect: () => startEdit(ii, it.text) },
              { id: 'up', label: 'Move up', icon: ArrowUp, disabled: ii === 0, onSelect: () => actions.moveItem(li, ii, -1) },
              { id: 'down', label: 'Move down', icon: ArrowDown, disabled: ii === items.length - 1, onSelect: () => actions.moveItem(li, ii, 1) },
              'divider',
              { id: 'delete', label: 'Delete', icon: Trash01, danger: true, onSelect: () => removeItem(ii, it.text) },
            ]}
          />
        </Row>
      ))}
    </Stack>
  );

  const addBar = (
    <form className="ckp-add" onSubmit={(e) => { e.preventDefault(); addItem(); }}>
      <Row gap={2} align="center">
        <Input ref={addRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onAddKeyDown} placeholder="Add a task" aria-label={`Add a task to ${list.name}`} autoFocus={total === 0} className="ckp-add-input" />
        <IconButton icon={Plus} label="Add task" variant="primary" type="submit" disabled={!draft.trim()} />
      </Row>
    </form>
  );

  const label = `${list.name} checklist${contextName ? `, ${contextName}` : ''}`;
  const content = <>{header}{body}</>;

  return (
    <>
      {confirmDialog}
      {desktop ? (
        <Modal open onClose={onClose} closeButton={false} label={label} footer={addBar} className="ckp-modal">
          {content}
        </Modal>
      ) : (
        <Sheet open onClose={onClose} tall label={label} footer={addBar} className="ckp-sheet">
          {content}
        </Sheet>
      )}
      <style>{ckPopupStyles}</style>
    </>
  );
}

const ckPopupStyles = `
  .ckp-modal.v-modal { width: calc(100vw - 48px); max-width: 960px; height: calc(100dvh - 48px); max-height: calc(100dvh - 48px); }
  .ckp-modal .v-modal-body { padding-top: var(--v-space-2); }
  .ckp-sheet.v-sheet--bottom { height: calc(100dvh - var(--v-inset-top)); max-height: calc(100dvh - var(--v-inset-top)); border-radius: 0; }
  .ckp-head { position: sticky; top: calc(var(--v-space-2) * -1); z-index: 1; display: flex; flex-direction: column; gap: var(--v-space-3); background: inherit; padding-bottom: var(--v-space-3); margin: calc(var(--v-space-2) * -1) 0 0; padding-top: var(--v-space-2); border-bottom: 1px solid var(--v-border); }
  .ckp-head-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--v-space-3); }
  .ckp-head-text { min-width: 0; }
  .ckp-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); overflow-wrap: anywhere; }
  .ckp-sub { margin: var(--v-space-1) 0 0; font-size: var(--v-text-sm); color: var(--v-text-3); }
  .ckp-close { flex-shrink: 0; }
  .ckp-hide { align-self: flex-start; }
  .ckp-items { padding-top: var(--v-space-3); min-width: 0; }
  .ckp-empty { color: var(--v-text-3); font-size: var(--v-text-md); padding: var(--v-space-4) 0; }
  .ckp-row { min-height: 52px; padding: var(--v-space-2) 0; border-bottom: 1px solid var(--v-border); min-width: 0; }
  .ckp-row .v-check { flex: 1; min-width: 0; align-items: flex-start; }
  .ckp-row .v-check-label { min-width: 0; white-space: normal; overflow-wrap: anywhere; font-size: var(--v-text-md); }
  .ckp-row.is-done .ckp-item-text { color: var(--v-text-3); text-decoration: line-through; }
  .ckp-item-text { display: block; cursor: text; }
  .ckp-item-note { display: block; margin-top: var(--v-space-1); font-size: var(--v-text-sm); color: var(--v-text-3); text-decoration: none; }
  .ckp-edit-form { flex: 1; min-width: 0; }
  .ckp-edit-input { width: 100%; }
  .ckp-add { min-width: 0; }
  .ckp-add-input { flex: 1; min-width: 0; }
`;
