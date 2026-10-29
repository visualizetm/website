import { useMemo, useState } from 'react';
import { Sheet, Stack, Row, Grid, Button, Chip, Input, Select } from '../ui';
import { OUTCOMES, MEETING_TYPES } from '../shared/semantics';
import { quickCallbacks, toLocalInput } from '../lib/calls';
import { fmtDate } from '../shared/dates';

/* The Log outcome sheet: one component, five outcomes (booked, callback, no answer, said no, wrong number). The Call Console logs
 * through it and so does the home's Next up block when the check on a call or a callback is tapped, so both read one sheet. It
 * only collects the answer; the caller's onLog(outcome, extra) does the write (src/lib/callOutcome.js builds it). */
export default function OutcomeSheet({ outcome, lead, onLog, onClose }) {
  const o = OUTCOMES.find(x => x.id === outcome);
  const [note, setNote] = useState('');
  const [email, setEmail] = useState(lead.email || lead.afterCall?.email || '');
  const [date, setDate] = useState(() => (outcome === 'callback' ? toLocalInput(new Date(Date.now() + 3600e3)).date : ''));
  const [time, setTime] = useState(() => (outcome === 'callback' ? toLocalInput(new Date(Date.now() + 3600e3)).time : ''));
  const [type, setType] = useState('call');
  const [busy, setBusy] = useState(false);
  const quick = useMemo(() => quickCallbacks(), []);
  const submit = async (e) => {
    e?.preventDefault?.();
    setBusy(true);
    try {
      if (outcome === 'booked') await onLog('booked', { note, email, meeting: date ? { date, time: time || '09:00', type } : null });
      else if (outcome === 'callback') await onLog('callback', { note, callbackAt: date ? new Date(`${date}T${time || '09:00'}`).toISOString() : null });
      else await onLog(outcome, { note });
    } finally { setBusy(false); }
  };
  const title = { booked: 'Booked a meeting', callback: 'Call them back', 'no-answer': 'No answer', no: 'Said no', 'wrong-number': 'Wrong number' }[outcome];
  return (
    <Sheet open onClose={onClose} title={title} description={lead.business} className={`cc-osheet cc-osheet--${outcome}`}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button variant={outcome === 'booked' ? 'primary' : outcome === 'callback' ? 'secondary' : 'secondary'} icon={o?.icon} loading={busy} onClick={submit} data-autofocus={outcome !== 'booked' && outcome !== 'callback'}>{outcome === 'booked' ? 'Book it' : outcome === 'callback' ? 'Set callback' : 'Log'}</Button></>}>
      <style>{outcomeSheetStyles}</style>
      <form onSubmit={submit} className="cc-osheet-form">
        {outcome === 'booked' && (
          <Stack gap={3}>
            <Grid minColumnWidth={140} gap={2}>
              <Input label="Meeting date" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-autofocus />
              <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Grid>
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} options={MEETING_TYPES.map(t => ({ id: t.id, label: t.label }))} />
            <Input label="Their email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@business.com" />
          </Stack>
        )}
        {outcome === 'callback' && (
          <Stack gap={3}>
            <Row gap={2} wrap>{quick.map(q => { const v = toLocalInput(q.at); const on = v.date === date && v.time === time; return <Chip key={q.id} label={q.label} selected={on} onClick={() => { setDate(v.date); setTime(v.time); }} />; })}</Row>
            <Grid minColumnWidth={140} gap={2}>
              <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Grid>
          </Stack>
        )}
        <Input label={outcome === 'booked' ? 'What they said' : 'Note'} value={note} onChange={(e) => setNote(e.target.value)} placeholder={outcome === 'callback' ? 'Ask for the owner after 5' : 'Optional, one line'} autoComplete="off" data-autofocus={outcome !== 'booked' && outcome !== 'callback'} />
        {outcome === 'wrong-number' && <p className="cc-hint">The phone note gets stamped "Wrong number ({fmtDate(new Date().toISOString())})". Nothing else changes.</p>}
        {outcome === 'no' && <p className="cc-hint">A no parks them in Nurture for 90 days, then they come back through Triage. Undo for six seconds.</p>}
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Sheet>
  );
}

export const outcomeSheetStyles = `
  .cc-osheet-form { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .cc-osheet .cc-hint { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
`;
