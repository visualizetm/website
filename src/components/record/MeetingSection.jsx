import { useState } from 'react';
import Calendar from '@untitled-ui/icons-react/build/esm/Calendar';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import { Row, Grid, Button, IconButton, InlineEdit, Checkbox, Sheet, Input, Select } from '../../ui';
import LeadNotes from '../LeadNotes';
import { MEETING_TYPES } from '../../shared/semantics';
import { PACKAGES, RETAINERS, money } from '../../shared/pricing';
import { fmtWeekdayDateTime, countdownLabel } from '../../shared/dates';
import { meetingDate } from '../../lib/booked';
import { downloadIcs } from '../../lib/ics';

/* Meeting: When (with Reschedule and the .ics button), Where, the game
 * plan checklist and the prep notes. No sub cards, no call mode. */
const MEETING_SERVICES = [...PACKAGES.map(p => ({ id: p.id, label: p.label, price: p.price })), ...RETAINERS.map(r => ({ id: r.id, label: `${r.label} retainer`, price: r.price }))];
const typeLabel = (lead) => (lead.meeting?.type ? (MEETING_TYPES.find(t => t.id === lead.meeting.type)?.label || lead.meeting.type) : '');

export const meetingSummary = (rec) => {
  const { lead } = rec;
  const d = meetingDate(lead);
  if (d) return `${fmtWeekdayDateTime(d)}${typeLabel(lead) ? `, ${typeLabel(lead).toLowerCase()}` : ''}`;
  return lead.afterCall?.meeting ? `${lead.afterCall.meeting} (no date set)` : 'No date set';
};

export default function MeetingSection({ rec }) {
  const { lead, readOnly, patch, onPatch, toast } = rec;
  const mDate = meetingDate(lead);
  const legacy = !lead.meeting?.date && lead.afterCall?.meeting;
  const [resched, setResched] = useState(false);
  const saveMeeting = (m) => patch({ meeting: { date: '', time: '', type: 'call', location: '', ...(lead.meeting || {}), ...m } });
  const gamePlan = lead.gamePlan || [];
  const gp = (id) => gamePlan.find(g => g.serviceId === id) || { serviceId: id, checked: false, note: '' };
  const setGp = (id, next) => patch({ gamePlan: gamePlan.some(g => g.serviceId === id) ? gamePlan.map(g => (g.serviceId === id ? { ...g, ...next } : g)) : [...gamePlan, { ...gp(id), ...next }] });
  return (
    <div className="rc-meeting">
      <div className="rc-fact rc-fact--wide rc-fact--stack">
        <span className="rc-fact-label">When</span>
        <span className="rc-fact-val">{mDate ? <><span className="dt-when">{fmtWeekdayDateTime(mDate)}</span><span className="rc-muted"> · {countdownLabel(mDate)}{typeLabel(lead) ? ` · ${typeLabel(lead).toLowerCase()}` : ''}</span></> : <span className="rc-fact-ro">{legacy ? `Logged as "${lead.afterCall.meeting}". Set the date to get a countdown and a calendar file.` : 'No date yet'}</span>}</span>
        {!readOnly && <Row gap={1} className="rc-fact-act"><Button variant="secondary" size="md" icon={Calendar} onClick={() => setResched(true)} className="dt-resched">{mDate ? 'Reschedule' : 'Set date'}</Button>{mDate && <IconButton icon={Download01} label="Add to calendar (.ics)" variant="secondary" onClick={() => { if (!downloadIcs(lead)) toast.error('Set a date first.'); }} />}</Row>}
      </div>
      <div className="rc-fact"><span className="rc-fact-label">Where</span>{readOnly ? <span className="rc-fact-ro lay-truncate">{lead.meeting?.location || 'None'}</span> : <InlineEdit value={lead.meeting?.location || ''} onSave={(v) => saveMeeting({ location: v })} placeholder="Zoom link, cafe, their shop" label="Where or link" className="rc-fact-edit" />}</div>
      <div className="rc-group">
        <p className="rc-label">Game plan</p>
        {MEETING_SERVICES.map(s => { const g = gp(s.id); return (
          <div key={s.id} className="dt-gp">
            <Checkbox checked={g.checked} onChange={(v) => setGp(s.id, { checked: v })} label={`${s.label} (${money(s.price)})`} disabled={readOnly} />
            {g.checked && <InlineEdit value={g.note || ''} onSave={(v) => setGp(s.id, { note: v })} placeholder="Note for the meeting" label={`${s.label} note`} className="dt-gp-note" />}
          </div>
        ); })}
      </div>
      <div className="rc-group">
        <p className="rc-label">Prep notes</p>
        <LeadNotes lead={lead} field="prepNotes" onSave={(id, v) => onPatch(id, { prepNotes: v })} placeholder="What to show, what to ask, what to avoid." />
      </div>
      {resched && <RescheduleSheet lead={lead} onClose={() => setResched(false)} onSave={async (m) => { const ok = await saveMeeting(m); if (ok) { setResched(false); toast.success('Meeting updated.'); } }} />}
    </div>
  );
}

export function RescheduleSheet({ lead, onClose, onSave }) {
  const m = lead.meeting || {};
  const [date, setDate] = useState(m.date || '');
  const [time, setTime] = useState(m.time || '09:00');
  const [type, setType] = useState(m.type || 'call');
  const [location, setLocation] = useState(m.location || '');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onClose={onClose} title={m.date ? 'Reschedule' : 'Set the meeting'} description={lead.business} className="dt-resched-sheet"
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} onClick={async () => { setBusy(true); try { await onSave({ date, time, type, location }); } finally { setBusy(false); } }} disabled={!date}>Save</Button></>}>
      <Grid minColumnWidth={140} gap={2}><Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-autofocus /><Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Grid>
      <Select label="Type" value={type} onChange={(e) => setType(e.target.value)} options={MEETING_TYPES.map(t => ({ id: t.id, label: t.label }))} />
      <Input label="Where or link" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Zoom link, cafe, their shop" />
    </Sheet>
  );
}
