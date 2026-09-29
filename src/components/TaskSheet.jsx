import { useState } from 'react';
import { Sheet, Stack, Row, Button, Input, ChipGroup } from '../ui';
import { REMIND_CHOICES, buildTask, dateKeyOf, timeKeyOf, remindChoiceOf } from '../lib/tasks';

/* Set task: the one sheet that writes a task with a due date on a lead, a
 * deal, a client or a project. Label, Due date (today), Due time (09:00),
 * Remind me (at the time, an hour before, the morning of at 9:00, off) and
 * Save. It writes a custom nextAction with auto false (src/lib/tasks.js).
 * An existing task opens it prefilled. */
export default function TaskSheet({ business = '', task = null, onSave, onClose, onDone = null }) {
  const has = !!task;
  const due = has && task.dueAt ? new Date(task.dueAt) : null;
  const [label, setLabel] = useState(has ? task.label || '' : '');
  const [date, setDate] = useState(due && !Number.isNaN(due.getTime()) ? dateKeyOf(due) : dateKeyOf(new Date()));
  const [time, setTime] = useState(due && !Number.isNaN(due.getTime()) ? timeKeyOf(due) : '09:00');
  const [remind, setRemind] = useState(has ? remindChoiceOf(task) : 'at');
  const [busy, setBusy] = useState(false);
  const valid = !!label.trim() && !!date;
  const save = async () => { if (!valid || busy) return; setBusy(true); try { const ok = await onSave(buildTask({ label, date, time, remind })); if (ok) onClose(); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={onClose} title={has ? 'Edit task' : 'Set task'} description={business} label={has ? 'Edit task' : 'Set task'} width={460} className="ts-sheet"
      footer={<Row gap={2} justify="between" align="center" wrap><span>{has && onDone && <Button variant="secondary" icon="Check" onClick={async () => { const ok = await onDone(); if (ok) onClose(); }} className="ts-done">Done</Button>}</span><Row gap={2}><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button icon="Check" loading={busy} disabled={!valid} onClick={save} className="ts-save">Save</Button></Row></Row>}>
      <Stack gap={3}>
        <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value.slice(0, 120))} placeholder="Drop off the proof" required data-autofocus onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <Row gap={2} wrap>
          <Input label="Due date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ts-date" required />
          <Input label="Due time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="ts-time" />
        </Row>
        <Stack gap={1}>
          <span className="v-field-label">Remind me</span>
          <ChipGroup label="Remind me" multi={false} allWhenEmpty={false} value={remind} onChange={(id) => { if (id) setRemind(id); }} options={REMIND_CHOICES} />
        </Stack>
      </Stack>
    </Sheet>
  );
}
