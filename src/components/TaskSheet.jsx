import { useEffect, useRef, useState } from 'react';
import { Sheet, Stack, Row, Button, Input, Textarea, Select, ChipGroup } from '../ui';
import { REMIND_CHOICES, buildTask, taskTimes, dateKeyOf, timeKeyOf, remindChoiceOf } from '../lib/tasks';

/* Set task: the one editor for a task with a due date. Label, Due date
 * (today), Due time (09:00), Remind me (at the time, an hour before, the
 * morning of at 9:00, off) and Save.
 *
 * Two callers, one sheet:
 *   nextAction   `task` is a custom next action (auto false). Save gives
 *                buildTask(): the next action to write. The older path, kept
 *                for a record with no checklist behind its task.
 *   checklist    `item` is a checklist task ({ text, due, remindAt, note })
 *                and `lists` the checklists it can sit in (milestone 5). Save
 *                gives { text, due, remindAt, note, listId }.
 * `focus` picks the field to land in: 'label' (default) or 'date' (a
 * Reschedule). */
export default function TaskSheet({ business = '', task = null, item = null, lists = [], focus = 'label', onSave, onClose, onDone = null }) {
  const isItem = !!item;
  const has = isItem || !!task;
  const dueIso = isItem ? item.due : task?.dueAt;
  const due = has && dueIso ? new Date(dueIso) : null;
  const dueOk = due && !Number.isNaN(due.getTime());
  const [label, setLabel] = useState(isItem ? item.text || '' : has ? task.label || '' : '');
  const [date, setDate] = useState(dueOk ? dateKeyOf(due) : isItem ? '' : dateKeyOf(new Date()));
  const [time, setTime] = useState(dueOk ? timeKeyOf(due) : '09:00');
  const [remind, setRemind] = useState(isItem ? (item.due ? remindChoiceOf({ dueAt: item.due, remindAt: item.remindAt }) : 'off') : has ? remindChoiceOf(task) : 'at');
  const [note, setNote] = useState(isItem ? item.note || '' : '');
  const [listId, setListId] = useState(isItem ? item.listId || lists[0]?.id || '' : '');
  const [busy, setBusy] = useState(false);
  const dateRef = useRef(null);
  useEffect(() => { if (focus === 'date') dateRef.current?.focus(); }, [focus]);
  const valid = !!label.trim() && (isItem || !!date);
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      let ok;
      if (isItem) {
        const { dueAt, remindAt } = date ? taskTimes({ date, time, remind }) : { dueAt: '', remindAt: '' };
        ok = await onSave({ text: label.trim().slice(0, 300), due: dueAt, remindAt, note: note.trim().slice(0, 300), listId });
      } else ok = await onSave(buildTask({ label, date, time, remind }));
      if (ok) onClose();
    } finally { setBusy(false); }
  };
  const title = has ? 'Edit task' : 'Set task';
  return (
    <Sheet open onClose={onClose} title={title} description={business} label={title} width={460} className="ts-sheet"
      footer={<Row gap={2} justify="between" align="center" wrap><span>{has && onDone && <Button variant="secondary" icon="Check" onClick={async () => { const ok = await onDone(); if (ok) onClose(); }} className="ts-done">Done</Button>}</span><Row gap={2}><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!valid} loading={busy} className="ts-save">Save</Button></Row></Row>}>
      <Stack gap={3}>
        <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value.slice(0, isItem ? 300 : 120))} placeholder="Drop off the proof" required data-autofocus={focus !== 'date' || undefined} onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <Row gap={2} wrap>
          <Input ref={dateRef} label="Due date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ts-date" required={!isItem} hint={isItem && !date ? 'No date: it waits its turn after every dated task.' : undefined} />
          <Input label="Due time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="ts-time" disabled={isItem && !date} />
        </Row>
        <Stack gap={1}>
          <span className="v-field-label">Remind me</span>
          <ChipGroup label="Remind me" multi={false} allWhenEmpty={false} value={isItem && !date ? 'off' : remind} onChange={(id) => { if (id) setRemind(id); }} options={REMIND_CHOICES} />
        </Stack>
        {isItem && (
          <>
            {lists.length > 1 && <Select label="Checklist" value={listId} onChange={(e) => setListId(e.target.value)} options={lists.map(l => ({ id: l.id, label: l.name }))} className="ts-list" />}
            <Textarea label="Note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Where, who, what to bring" hint={`${note.length} of 300.`} className="ts-note" />
          </>
        )}
      </Stack>
    </Sheet>
  );
}
