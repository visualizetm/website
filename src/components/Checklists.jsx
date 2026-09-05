import { useState } from 'react';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import { Card, Stack, Row, Input, Button, IconButton, Checkbox, Pill, useConfirm } from '../ui';

/* Named task lists for a lead, booked, or client record (kit build, Prompt 13).
 *
 * Optional by design: with no lists the whole UI is one Add checklist button.
 * Every mutation patches the additive `checklists` field through the caller's
 * optimistic onPatch. Props { lead, onPatch } are unchanged. */
export default function Checklists({ lead, onPatch }) {
  const [confirm, confirmDialog] = useConfirm();
  const lists = lead.checklists || [];
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const [drafts, setDrafts] = useState({}); // per-list new task text

  const save = (next) => onPatch(lead._id, { checklists: next });
  const addList = () => { const n = name.trim(); if (!n) return; save([...lists, { name: n, items: [] }]); setName(''); setNaming(false); };
  const removeList = async (li) => {
    const l = lists[li]; const count = l.items?.length || 0;
    if (count && !(await confirm({ title: `Delete "${l.name}"?`, body: `Its ${count} task${count === 1 ? '' : 's'} go with it.`, danger: true, confirmLabel: 'Delete' }))) return;
    save(lists.filter((_, j) => j !== li));
  };
  const addItem = (li) => { const text = (drafts[li] || '').trim(); if (!text) return; save(lists.map((l, j) => (j === li ? { ...l, items: [...(l.items || []), { text, done: false }] } : l))); setDrafts(d => ({ ...d, [li]: '' })); };
  const toggleItem = (li, ii, v) => save(lists.map((l, j) => (j === li ? { ...l, items: l.items.map((it, k) => (k === ii ? { ...it, done: v } : it)) } : l)));
  const removeItem = (li, ii) => save(lists.map((l, j) => (j === li ? { ...l, items: l.items.filter((_, k) => k !== ii) } : l)));

  return (
    <Stack gap={3} className="ck-wrap">
      {confirmDialog}
      {lists.map((l, li) => {
        const done = (l.items || []).filter(i => i.done).length;
        return (
          <Card key={li} level={2} padding={3} className="ck-list">
            <Row gap={2} align="center">
              <span className="ck-list-name">{l.name}</span>
              {l.items?.length > 0 && <Pill tone={done === l.items.length ? 'booked' : 'neutral'} label={`${done}/${l.items.length}`} size="sm" icon={false} variant="outline" />}
              <span style={{ flex: 1 }} />
              <IconButton icon={Trash01} label={`Delete ${l.name}`} variant="ghost" onClick={() => removeList(li)} className="ck-list-del" />
            </Row>
            <Stack gap={0}>
              {(l.items || []).map((it, ii) => (
                <Row key={ii} gap={1} align="center" className="ck-item">
                  <Checkbox checked={!!it.done} onChange={(v) => toggleItem(li, ii, v)} label={it.text} className={`ck-check${it.done ? ' is-done' : ''}`} />
                  <IconButton icon={XClose} label="Remove task" variant="ghost" onClick={() => removeItem(li, ii)} className="ck-item-del" />
                </Row>
              ))}
            </Stack>
            <form className="ck-add" onSubmit={(e) => { e.preventDefault(); addItem(li); }}>
              <Row gap={1} align="center">
                <Input value={drafts[li] || ''} onChange={(e) => setDrafts(d => ({ ...d, [li]: e.target.value }))} placeholder="Add a task" aria-label={`Add a task to ${l.name}`} className="ck-add-input" />
                <IconButton icon={Plus} label="Add task" variant="secondary" type="submit" disabled={!(drafts[li] || '').trim()} />
              </Row>
            </form>
          </Card>
        );
      })}
      {naming ? (
        <form className="ck-add" onSubmit={(e) => { e.preventDefault(); addList(); }}>
          <Row gap={1} align="center">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Checklist name, like Onboarding or Launch day" aria-label="Checklist name" autoFocus className="ck-add-input" />
            <IconButton icon={Check} label="Create checklist" variant="primary" type="submit" disabled={!name.trim()} />
            <IconButton icon={XClose} label="Cancel" variant="ghost" onClick={() => { setNaming(false); setName(''); }} />
          </Row>
        </form>
      ) : (
        <Row gap={2}><Button variant="secondary" size="md" icon={Plus} onClick={() => setNaming(true)} className="ck-new">Add checklist</Button></Row>
      )}
      <style>{ckStyles}</style>
    </Stack>
  );
}

const ckStyles = `
  .ck-wrap { min-width: 0; }
  .ck-list { gap: var(--v-space-2); }
  .ck-list-name { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text); min-width: 0; overflow-wrap: anywhere; }
  .ck-item { min-width: 0; }
  .ck-item .v-check { flex: 1; min-width: 0; }
  .ck-item .v-check-label { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
  .ck-check.is-done .v-check-label { color: var(--v-text-3); text-decoration: line-through; }
  .ck-check.is-done .v-check-box { animation: ck-pop var(--v-dur-base) var(--v-ease-spring) 1; }
  @keyframes ck-pop { 0% { transform: scale(1); } 45% { transform: scale(1.18); } 100% { transform: scale(1); } }
  .ck-item-del, .ck-list-del { opacity: 0.5; }
  .ck-item:hover .ck-item-del, .ck-item-del:focus-visible, .ck-list:hover .ck-list-del, .ck-list-del:focus-visible { opacity: 1; }
  .ck-add { min-width: 0; }
  .ck-add-input { flex: 1; min-width: 0; }
`;
