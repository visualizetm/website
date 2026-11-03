import { useEffect, useMemo, useRef, useState } from 'react';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import { Sheet, Stack, Row, Grid, Button, Chip, Input, Textarea, Card } from '../../ui';
import { useToast } from '../../ui';
import { apiFetch } from '../../shared/api';
import { COPY } from '../../shared/copy';
import { formatPhone, telHref } from '../../shared/phone';
import { fmtDate } from '../../shared/dates';
import { CALL_STEPS as STEPS, stepSet, startStepFor, objectionPatch, scriptLine, sayItBack, slotsFor, slotToMeeting, laterToday, conceptTaskDue, voicemailText, nightBeforeText, inviteOverride, fmtTime12 } from '../../shared/callScript';
import { callOutcomeSet } from '../../lib/callOutcome';
import { checklistsPatch } from '../../lib/taskWrite';
import { addTask } from '../../shared/taskRules';
import { ObjectionCards, objectionStyles } from './ObjectionSheet';

/* The call stepper (prompt 2 of 3, milestone 1): a bottom sheet over the lead, one step per screen, the lead's own script
 * lines (src/shared/callScript.js falls back to the shared v2 line, never blank). Opened from the Room ("Open the stepper"),
 * the lead record ("Run the script") and the Queue ("Dial and open the script"). A lead with no phone starts at step 2.
 *
 * Every Next saves what the step collected through the caller's lead patch ($set on afterCall.*, askFor; the shell's
 * helper keeps a manual next action). Leaving keeps what was saved. The two outcomes go through onLog(outcome, extra,
 * lead) (the Room's applyLog, so the session's stats and the list rule move; the record's default builds the same write
 * with src/lib/callOutcome.js):
 *   No answer   callLog no-answer, a callback later today (callbackAt, the write minute-reminders pushes), the voicemail
 *               text drafted into Drafts (never sent).
 *   Lock it in  the meeting (the record's own booking write), callStatus booked, the invite email and the night before
 *               text drafted into Drafts (never sent; Rob taps Send now in the send sheet), and "Build the concept" due
 *               the night before at 8 PM New York through src/lib/taskWrite.js. */
export default function CallStepper({ open, lead, onClose, onPatch, onLog = null, startStep = null }) {
  const toast = useToast();
  const [step, setStep] = useState(() => startStep || startStepFor(lead));
  const ac = lead?.afterCall || {};
  const [d, setD] = useState(() => ({
    answered: ac.answered || '', askFor: lead?.askFor || '', homework: ac.homework || '', whatTheySaid: ac.whatTheySaid || '', goal: ac.goal || '',
    objection: ac.objection || '', partner: ac.partner || '', cell: ac.cell || lead?.phone || '', email: lead?.email || ac.email || '',
    slot: '', pickDate: '', pickTime: '',
  }));
  const [busy, setBusy] = useState(false);
  const [slots, setSlots] = useState(null); // { slots: [{iso,label}], source }
  const set = (k, v) => setD(x => ({ ...x, [k]: v }));
  const line = (k) => scriptLine(lead, k);
  const cur = STEPS[step - 1];

  /* Calendly's next two open starts, asked for once the sheet opens so the Two times step has them; four seconds, then the defaults. */
  const asked = useRef(false);
  useEffect(() => {
    if (!open || asked.current) return;
    asked.current = true;
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; setSlots(slotsFor(null)); } }, 4000);
    apiFetch('/api/admin/calendly/events?slots=1', { silent: true, fresh: true }).then(r => { if (done) return; done = true; clearTimeout(timer); setSlots(slotsFor(r.ok ? r.data?.slots : null)); }).catch(() => { if (!done) { done = true; setSlots(slotsFor(null)); } });
    return () => clearTimeout(timer);
  }, [open]);

  const save = async (fields) => { setBusy(true); try { return await onPatch(stepSet(lead, fields, step)); } finally { setBusy(false); } };
  const next = async (fields = {}) => { const ok = await save(fields); if (ok !== false) setStep(s => Math.min(STEPS.length, s + 1)); };
  const back = () => setStep(s => Math.max(startStepFor(lead), s - 1));
  const log = async (outcome, extra, merged) => (onLog ? onLog(outcome, extra, merged) : onPatch(callOutcomeSet(merged, outcome, extra).set));

  /* Step 1, no answer: the outcome, the callback later today, the voicemail text into Drafts. */
  const noAnswer = async () => {
    setBusy(true);
    try {
      const merged = { ...lead, ...stepSet(lead, { answered: 'none' }, 1) };
      await onPatch(stepSet(lead, { answered: 'none' }, 1));
      const ok = await log('no-answer', { note: 'No answer, voicemail text drafted', callbackAt: laterToday() }, merged);
      if (ok === false) return;
      const r = await apiFetch('/api/admin/email/drafts', { method: 'POST', body: { channel: 'text', recordId: String(lead._id), subject: 'Voicemail follow up', body: voicemailText(lead), reason: 'No answer on the script' } });
      if (!r.ok) toast.error(r.data?.error || COPY.error.save);
      else toast.success('No answer logged. The voicemail text is in Drafts and a callback is set for later today.');
      window.dispatchEvent(new CustomEvent('vz:drafts-changed'));
      onClose?.();
    } finally { setBusy(false); }
  };

  /* Step 8, lock it in: one write for the booking (the afterCall answers ride on it), then the two drafts and the task. */
  const meeting = useMemo(() => (d.slot ? slotToMeeting(d.slot) : d.pickDate ? { date: d.pickDate, time: d.pickTime || '09:00', type: 'call' } : null), [d.slot, d.pickDate, d.pickTime]);
  const book = async () => {
    if (!meeting) return;
    setBusy(true);
    try {
      const fields = { answered: d.answered || 'owner', homework: d.homework, whatTheySaid: d.whatTheySaid, goal: d.goal, partner: d.partner, cell: d.cell.trim(), email: d.email.trim(), asks: Math.max(1, Number(ac.asks) || 0) };
      const merged = { ...lead, ...stepSet(lead, fields, 8), askFor: d.askFor.trim() || lead.askFor };
      const ok = await log('booked', { note: 'Booked on the script', email: d.email.trim(), meeting }, merged);
      if (ok === false) return;
      const after = { ...merged, callStatus: 'booked', stage: 'booked', meeting };
      const [inv, txt] = await Promise.all([
        apiFetch('/api/admin/email/send', { method: 'POST', body: { templateId: 'custom', recordId: String(lead._id), ...(d.email.trim() ? { to: [d.email.trim()] } : {}), override: inviteOverride(after, meeting), reason: 'Booked on the script' } }),
        apiFetch('/api/admin/email/drafts', { method: 'POST', body: { channel: 'text', recordId: String(lead._id), subject: 'Night before reminder', body: nightBeforeText(after, meeting), reason: 'Booked on the script' } }),
      ]);
      const due = conceptTaskDue(meeting);
      const lists = addTask(after.checklists || [], '', { text: 'Build the concept', due, note: `For the ${fmtDate(meeting.date)} call`, source: 'manual', listName: 'Before the call' });
      await onPatch(checklistsPatch(after, lists, {}));
      window.dispatchEvent(new CustomEvent('vz:drafts-changed'));
      if (!inv.ok || !txt.ok) toast.error('Booked, but a draft did not save. Check Drafts.');
      else toast.success(`Booked ${fmtDate(meeting.date)} ${fmtTime12(meeting.time)}. The invite and the night before text are in Drafts; Build the concept is due the night before.`);
      onClose?.();
    } finally { setBusy(false); }
  };

  const pickObjection = async (id) => { set('objection', id); await onPatch(objectionPatch({ ...lead, afterCall: { ...ac, ...stepSet(lead, {}, step).afterCall } }, id)); };

  const body = () => {
    switch (cur.id) {
      case 'answer': return (
        <Stack gap={3}>
          {lead.phone && <Button size="lg" full icon={PhoneCall01} href={telHref(lead.phone)} className="cs-dial">{formatPhone(lead.phone)}</Button>}
          <p className="cs-line">{line('confirm')}</p>
          <Stack gap={2} className="cs-choices">
            <Button size="lg" full variant={d.answered === 'owner' ? 'primary' : 'secondary'} onClick={() => { set('answered', 'owner'); next({ answered: 'owner' }); }} disabled={busy}>Yes, the owner</Button>
            <Button size="lg" full variant={d.answered === 'other' ? 'primary' : 'secondary'} onClick={() => { set('answered', 'other'); next({ answered: 'other' }); }} disabled={busy}>Yes, someone else</Button>
            <Button size="lg" full variant="secondary" onClick={() => set('answered', 'none')} disabled={busy}>No answer</Button>
          </Stack>
          {d.answered === 'none' && (
            <Card level={2} padding={3} className="cs-vm">
              <p className="pb-card-h">Leave the voicemail</p>
              <p className="cs-line">{line('noAnswer')}</p>
              <Button full icon="Voicemail" loading={busy} onClick={noAnswer} className="cs-noanswer">Log no answer and draft the text</Button>
            </Card>
          )}
        </Stack>
      );
      case 'who': return (
        <Stack gap={3}>
          <p className="cs-hint">{d.answered === 'other' ? 'Get the name, then ask for the owner.' : 'Their name goes on the record and in every text.'}</p>
          <Input label="Ask for" value={d.askFor} onChange={(e) => set('askFor', e.target.value)} placeholder="First name" data-autofocus />
          {lead.askFor && lead.askFor !== d.askFor && <p className="cs-hint">On the record: {lead.askFor}</p>}
        </Stack>
      );
      case 'line': return (
        <Stack gap={3}>
          <p className="cs-line">{line('intro')}</p>
          <p className="cs-line">{line('homework')}</p>
          <p className="cs-hint">Did the homework land?</p>
          <Row gap={2}>
            <Chip label="Landed" selected={d.homework === 'landed'} onClick={() => set('homework', 'landed')} />
            <Chip label="Flat" selected={d.homework === 'flat'} onClick={() => set('homework', 'flat')} />
          </Row>
        </Stack>
      );
      case 'said': return (
        <Stack gap={3}>
          <p className="cs-line">{line('question')}</p>
          <p className="cs-hint">Then stop talking. Write what they said, their words.</p>
          <Textarea label="What they said" value={d.whatTheySaid} onChange={(e) => set('whatTheySaid', e.target.value)} rows={3} data-autofocus />
          <Card level={2} padding={3}><p className="pb-card-h">Say it back</p><p className="cs-line">{sayItBack(d.whatTheySaid)}</p></Card>
        </Stack>
      );
      case 'goal': return (
        <Stack gap={3}>
          <p className="cs-line">{line('goalQuestion')}</p>
          <Textarea label="Their goal" value={d.goal} onChange={(e) => set('goal', e.target.value)} rows={3} data-autofocus />
        </Stack>
      );
      case 'value': return (
        <Stack gap={3}>
          <p className="cs-line">{line('hook')}</p>
          <p className="cs-hint">If they push back, tap what they said.</p>
          <ObjectionCards lead={{ ...lead, afterCall: { ...ac, objection: d.objection } }} picked={d.objection} onPick={pickObjection} ids={['money', 'time', 'fit', 'partner', 'stall']} />
        </Stack>
      );
      case 'times': return (
        <Stack gap={3}>
          <p className="cs-line">{line('ask')}</p>
          {!slots ? <p className="cs-hint" aria-live="polite">Checking the calendar.</p> : (
            <Row gap={2} wrap>
              {slots.slots.map(s => <Chip key={s.iso} label={s.label} selected={d.slot === s.iso} onClick={() => setD(x => ({ ...x, slot: s.iso, pickDate: '', pickTime: '' }))} />)}
              <Chip label="Pick a time" selected={!d.slot && !!d.pickDate} onClick={() => setD(x => ({ ...x, slot: '', pickDate: x.pickDate || slotToMeeting(slots.slots[0].iso).date, pickTime: x.pickTime || '10:00' }))} />
            </Row>
          )}
          {slots && <p className="cs-hint">{slots.source === 'calendly' ? 'From Calendly.' : 'Default times (Calendly did not answer in time).'}</p>}
          {!d.slot && d.pickDate && (
            <Grid minColumnWidth={140} gap={2}>
              <Input label="Date" type="date" value={d.pickDate} onChange={(e) => set('pickDate', e.target.value)} />
              <Input label="Time" type="time" value={d.pickTime} onChange={(e) => set('pickTime', e.target.value)} />
            </Grid>
          )}
          <p className="cs-hint">Is anyone else part of this decision?</p>
          <Row gap={2}>
            <Chip label="Yes, bring them" selected={d.partner === 'yes'} onClick={() => set('partner', 'yes')} />
            <Chip label="No, just them" selected={d.partner === 'no'} onClick={() => set('partner', 'no')} />
          </Row>
        </Stack>
      );
      case 'lock': return (
        <Stack gap={3}>
          <p className="cs-line">{line('lockIt')}</p>
          {meeting ? <p className="cs-hint">On for {fmtDate(meeting.date)} at {fmtTime12(meeting.time)}.</p> : <p className="cs-hint cs-warn">Pick a time on the last step first.</p>}
          <Grid minColumnWidth={160} gap={2}>
            <Input label="Cell for the reminder" type="tel" value={d.cell} onChange={(e) => set('cell', e.target.value)} />
            <Input label="Email for the invite" type="email" value={d.email} onChange={(e) => set('email', e.target.value)} />
          </Grid>
          <p className="cs-hint">Next drafts the invite email and the night before text into Drafts and adds Build the concept. Nothing sends until you tap Send now.</p>
        </Stack>
      );
      default: return null;
    }
  };

  const fieldsOf = () => ({ who: { askFor: d.askFor.trim() }, line: { homework: d.homework }, said: { whatTheySaid: d.whatTheySaid.trim() }, goal: { goal: d.goal.trim() }, value: { objection: d.objection }, times: { partner: d.partner } }[cur.id] || {});
  const last = cur.id === 'lock';
  const footer = (
    <>
      <Button variant="ghost" onClick={back} disabled={busy || step <= startStepFor(lead)}>Back</Button>
      <span className="cs-pos">{step} of {STEPS.length}</span>
      {cur.id === 'answer' ? null : last
        ? <Button icon="Check" loading={busy} disabled={!meeting} onClick={book} className="cs-book">Book it</Button>
        : <Button loading={busy} onClick={() => next(fieldsOf())} className="cs-next">Next</Button>}
    </>
  );
  return (
    <Sheet open={open} onClose={onClose} title={cur.title} description={lead.business} tall className="cs-sheet" footer={footer}>
      <div className="cs-prog" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step} aria-label="Script progress">
        {STEPS.map((s, i) => <span key={s.id} className={`cs-seg${i + 1 < step ? ' is-done' : i + 1 === step ? ' is-cur' : ''}`} />)}
      </div>
      <div className="cs-body" key={cur.id}>{body()}</div>
      <style>{callStepperStyles + objectionStyles}</style>
    </Sheet>
  );
}

export const callStepperStyles = `
  .cs-prog { display: grid; grid-template-columns: repeat(8, 1fr); gap: var(--v-space-1); margin-bottom: var(--v-space-4); }
  .cs-seg { height: 4px; border-radius: var(--v-radius-pill); background: var(--v-surface-3); }
  .cs-seg.is-done { background: var(--v-text-2); }
  .cs-seg.is-cur { background: var(--v-border-focus); }
  .cs-line { font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: var(--v-lh-lg); }
  .cs-hint { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .cs-warn { color: var(--v-text-2); }
  .cs-pos { flex: 1; text-align: center; font-size: var(--v-text-sm); color: var(--v-text-3); }
  .cs-dial { font-family: var(--v-font-display); font-size: var(--v-text-xl); }
  .cs-vm { display: grid; gap: var(--v-space-2); }
`;
