import { useState } from 'react';
import { Sheet, Stack, Button, Card, useToast } from '../ui';
import OutcomeSheet from '../components/OutcomeSheet';
import CallbackPicker from '../components/CallbackPicker';
import DeclineSheet from '../components/DeclineSheet';
import { voicemailText } from '../shared/callScript';
import { smsHref } from '../lib/linkSend';
import { useRoom } from './RoomApp';
import { roomApi, roomStore } from './roomApi';
import { newSession, sessionLogged, sessionNext, sessionTexted, tomorrowNine } from './roomLib';

/* The outcome of a call (Billy's Call Room). The same choices the console logs and the same write (the server builds it
 * like src/lib/callOutcome.js and stamps Billy), through the console's own pieces:
 *   No answer            asks whether he left a voicemail; a yes offers the follow up text as an sms: link he sends himself
 *   Call back            CallbackPicker, tomorrow at 9:00 AM New York unless he picks, never in the past
 *   Booked               the booking screen
 *   Not interested       DeclineSheet: the lead is declined with his reason and note, never deleted
 *   Wrong number or do not call   the console's Log outcome sheet for a wrong number
 * After the write the room moves to the next lead in the session, or to the summary when the queue is done. */
export default function OutcomeFlow({ lead, said, onClose }) {
  const room = useRoom();
  const toast = useToast();
  const [mode, setMode] = useState('pick');
  const [busy, setBusy] = useState(false);
  const [after, setAfter] = useState(null); // the session once the no answer is logged, while the text is offered

  const advance = (s) => { const next = sessionNext(s, lead.id); if (next && next !== lead.id) room.go(`/lead/${encodeURIComponent(next)}`, { replace: true }); else room.go('/summary', { replace: true }); };
  const log = async (outcome, extra = {}) => {
    setBusy(true);
    const r = await room.write(roomApi.outcome, { leadId: lead.id, outcome, note: extra.note !== undefined ? extra.note : said || '', ...(extra.callbackAt ? { callbackAt: extra.callbackAt } : {}), ...(extra.voicemail ? { voicemail: true } : {}), ...(extra.reason ? { reason: extra.reason } : {}) });
    setBusy(false);
    if (!r.ok) { toast.error(r.status === 404 ? 'That lead is not yours to log any more.' : r.data?.error || 'That did not save. Try again in a moment.'); return null; }
    roomStore.set(`said_${lead.id}`, null);
    const s = sessionLogged(room.session || newSession({ ids: [lead.id] }), lead.id, outcome, extra);
    room.setSession(s);
    if (outcome !== 'no-answer' || !extra.voicemail || !lead.phone) room.applyLead(lead.id, r.data.lead);
    return s;
  };

  if (mode === 'callback') {
    return <CallbackPicker open clearable={false} value={tomorrowNine()} business={lead.business} onClose={() => setMode('pick')}
      onSave={async (iso) => { if (!iso || new Date(iso).getTime() <= Date.now()) { toast.error('Pick a time that has not passed.'); return; } const s = await log('callback', { callbackAt: iso }); if (s) advance(s); }} />;
  }
  if (mode === 'no') return <DeclineSheet lead={lead} busy={busy} onClose={() => setMode('pick')} onConfirm={async (reason, note) => { const s = await log('no', { reason, note: (note || '').trim() || said || '' }); if (s) advance(s); }} />;
  if (mode === 'wrong') return <OutcomeSheet outcome="wrong-number" lead={lead} onClose={() => setMode('pick')} onLog={async (o, extra) => { const s = await log('wrong-number', { note: (extra?.note || '').trim() || said || '' }); if (s) advance(s); }} />;

  if (mode === 'voicemail') {
    return (
      <Sheet open onClose={() => setMode('pick')} title="Did you leave a voicemail?" description={lead.business} label="Did you leave a voicemail?" className="rm-outcome"
        footer={<Button variant="ghost" onClick={() => setMode('pick')} disabled={busy}>Back</Button>}>
        <Stack gap={2}>
          <Button size="lg" full icon="Voicemail" loading={busy} onClick={async () => { const s = await log('no-answer', { voicemail: true }); if (s) { if (lead.phone) { setAfter(s); setMode('text'); } else advance(s); } }} className="rm-vm-yes">Yes, I left one</Button>
          <Button size="lg" full variant="secondary" disabled={busy} onClick={async () => { const s = await log('no-answer', {}); if (s) advance(s); }} className="rm-vm-no">No voicemail</Button>
        </Stack>
      </Sheet>
    );
  }
  if (mode === 'text') {
    const text = voicemailText(lead, room.caller);
    const done = () => { room.applyLead(lead.id, room.leads.find(l => l.id === lead.id) || lead); advance(room.session || after); };
    return (
      <Sheet open onClose={done} title="Text the follow up" description={lead.business} label="Text the follow up" className="rm-outcome"
        footer={<><Button variant="ghost" onClick={done} className="rm-text-skip">Next lead</Button><Button icon="MessageTextSquare01" href={smsHref(lead.phone, text)} onClick={() => room.setSession(s => sessionTexted(s || after, lead.id))} className="rm-text-it">Text it</Button></>}>
        <Stack gap={3}>
          <p className="cs-hint">No answer is logged. This opens Messages with the line filled in. You tap send.</p>
          <Card level={2} padding={3}><p className="rm-text-body">{text}</p></Card>
        </Stack>
      </Sheet>
    );
  }
  return (
    <Sheet open onClose={onClose} title="How did it go?" description={lead.business} label="How did it go?" className="rm-outcome">
      <Stack gap={2} role="group" aria-label="Outcome">
        <Button size="lg" full variant="secondary" icon="PhoneHangUp" onClick={() => setMode('voicemail')} className="rm-o-noanswer">No answer</Button>
        <Button size="lg" full variant="secondary" icon="ClockRewind" onClick={() => setMode('callback')} className="rm-o-callback">Call back</Button>
        <Button size="lg" full icon="CalendarCheck01" onClick={() => room.go(`/book/${encodeURIComponent(lead.id)}`)} className="rm-o-booked">Booked</Button>
        <Button size="lg" full variant="secondary" icon="SlashCircle01" onClick={() => setMode('no')} className="rm-o-no">Not interested</Button>
        <Button size="lg" full variant="secondary" icon="UserX01" onClick={() => setMode('wrong')} className="rm-o-wrong">Wrong number or do not call</Button>
      </Stack>
    </Sheet>
  );
}
