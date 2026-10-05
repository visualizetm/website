import { useState } from 'react';
import { Sheet, Input, Button, Row, Stack, ChipGroup, Select } from '../../ui';
import { QUICK_DAYS, quickDue } from '../../lib/taskWrite';
import { dateKeyOf } from '../../lib/tasks';
import { normalizeChecklists } from '../../shared/taskRules';

/* Make a task (docs job, milestone 4): the explicit action that turns a line of a doc into a task on the client, through the existing task
 * system (the caller writes addTask + checklistsPatch, so a pinned task and the next action stay right). A doc's own checklist items never
 * become tasks by themselves; this is the only way. Title, a day, and which checklist when there is more than one. */
export default function MakeTaskSheet({ lead, initial, onMake, onClose }) {
  const lists = normalizeChecklists(lead?.checklists || []);
  const [text, setText] = useState(String(initial || '').slice(0, 300));
  const [day, setDay] = useState('tomorrow');
  const [pick, setPick] = useState('');
  const [listId, setListId] = useState(lists[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const valid = !!text.trim() && (day !== 'pick' || !!pick);
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try { if (await onMake({ text: text.trim(), due: quickDue(day, pick), listId })) onClose(); } finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="Make a task" description={lead?.business} label="Make a task" width={460} className="mt-sheet"
      footer={<Row gap={2} justify="end" wrap><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="Plus" onClick={save} disabled={!valid} loading={busy} className="mt-save">Make task</Button></Row>}>
      <Stack gap={3}>
        <Input label="Task" value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} data-autofocus required onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <Stack gap={1}>
          <span className="v-field-label">When</span>
          <ChipGroup label="When" multi={false} allWhenEmpty={false} value={day} onChange={(id) => { if (id) setDay(id); }} options={QUICK_DAYS} />
          {day === 'pick' && <Input label="Day" type="date" value={pick} min={dateKeyOf(new Date())} onChange={(e) => setPick(e.target.value)} />}
        </Stack>
        {lists.length > 1 && <Select label="Checklist" value={listId} onChange={(e) => setListId(e.target.value)} options={lists.map(l => ({ id: l.id, label: l.name || 'Tasks' }))} />}
      </Stack>
    </Sheet>
  );
}
