import { useMemo, useState } from 'react';
import { Sheet, Button, Chip, Row, Grid, Input } from '../ui';
import { quickCallbacks, toLocalInput } from '../lib/calls';
/**
 * CallbackPicker: date and time with quick chips, shared by the lead detail
 * (and the console's callback sheet in spirit). onSave(isoOrNull).
 */
export default function CallbackPicker({ open, onClose, value, onSave, business }) {
  const init = value ? toLocalInput(new Date(value)) : toLocalInput(new Date(Date.now() + 3600e3));
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [busy, setBusy] = useState(false);
  const quick = useMemo(() => quickCallbacks(), []);
  const save = async (v) => { setBusy(true); try { await onSave(v); } finally { setBusy(false); } };
  return (
    <Sheet open={open} onClose={onClose} title="Callback due" description={business}
      footer={<>{value && <Button variant="danger" onClick={() => save(null)} disabled={busy}>Clear</Button>}<Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} onClick={() => save(date ? new Date(`${date}T${time || '09:00'}`).toISOString() : null)}>Save</Button></>}>
      <Row gap={2} wrap>{quick.map(q => { const v = toLocalInput(q.at); const on = v.date === date && v.time === time; return <Chip key={q.id} label={q.label} selected={on} onClick={() => { setDate(v.date); setTime(v.time); }} />; })}</Row>
      <Grid minColumnWidth={140} gap={2}>
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-autofocus />
        <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </Grid>
    </Sheet>
  );
}
