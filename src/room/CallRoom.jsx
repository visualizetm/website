import { useEffect, useState } from 'react';
import { PageShell, ScrollArea, StickyFooterBar, Stack, Row, Card, Button, Chip, Input, Textarea, useDelayedLoading } from '../ui';
import { ROOM_STEPS, scriptLine } from '../shared/callScript';
import ObjectionSheet from '../components/calls/ObjectionSheet';
import { formatPhone } from '../shared/phone';
import { useRoom, useRoomBar } from './RoomApp';
import { roomApi, roomStore } from './roomApi';
import { RoomError, CardSkeleton, Missing } from './parts';
import OutcomeFlow from './OutcomeFlow';

/* The call room (Billy's Call Room): one step at a time, "Step N of 8" (answer, owner's name, open, homework, question,
 * hook, ask, close). Each step's line is the lead's own script line or the shared one, read through scriptLine with the
 * caller's name, so Billy's lines say Billy. If they say chips are the lead's likely answers; What they said saves on the
 * device as he types and travels with the outcome; Objections is the console's own sheet; End call and log it opens the
 * outcome. The tab bar is hidden (a focused screen). Nothing here writes until the outcome, except the owner's name. */
export default function CallRoom({ id }) {
  const { leads, loading, error, caller, write, applyLead } = useRoom();
  const lead = leads.find(l => l.id === id) || null;
  const [step, setStep] = useState(1);
  const [said, setSaid] = useState(() => roomStore.get(`said_${id}`, '') || '');
  const [owner, setOwner] = useState('');
  const [answer, setAnswer] = useState(-1);
  const [counts, setCounts] = useState({});
  const [objOpen, setObjOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [busy, setBusy] = useState(false);
  useRoomBar(lead?.business || 'Call');
  useEffect(() => { roomStore.set(`said_${id}`, said ? said : null); }, [said, id]);
  useEffect(() => { if (lead) setOwner(o => o || lead.owner || ''); }, [lead?.owner]); // eslint-disable-line react-hooks/exhaustive-deps
  const show = useDelayedLoading(loading);
  if (error) return <PageShell label="Call"><ScrollArea><RoomError /></ScrollArea></PageShell>;
  if (loading) return <PageShell label="Call"><ScrollArea>{show ? <CardSkeleton lines={5} /> : <div className="rm-wait" />}</ScrollArea></PageShell>;
  if (!lead) return <PageShell label="Call"><ScrollArea><Missing /></ScrollArea></PageShell>;

  const cur = ROOM_STEPS[step - 1];
  const answers = lead.script?.likelyAnswers || [];
  const last = step === ROOM_STEPS.length;
  const next = async () => {
    if (cur.id === 'owner' && owner.trim() && owner.trim() !== (lead.owner || '')) {
      setBusy(true);
      const r = await write(roomApi.contact, { leadId: id, owner: owner.trim() });
      setBusy(false);
      if (r.ok && r.data?.lead) applyLead(id, r.data.lead);
    }
    setAnswer(-1); setStep(s => Math.min(ROOM_STEPS.length, s + 1));
  };

  return (
    <PageShell label={`Call with ${lead.business}`}>
      <ScrollArea>
        <Stack gap={4} className="rm-call-body">
          <Stack gap={2}>
            <p className="rm-step" aria-live="polite">Step {step} of {ROOM_STEPS.length}: {cur.label}</p>
            <div className="cs-prog" role="progressbar" aria-valuemin={1} aria-valuemax={ROOM_STEPS.length} aria-valuenow={step} aria-label="Script progress">
              {ROOM_STEPS.map((s, i) => <span key={s.id} className={`cs-seg${i + 1 < step ? ' is-done' : i + 1 === step ? ' is-cur' : ''}`} />)}
            </div>
          </Stack>
          <Card padding={4} className="rm-line" key={cur.id} data-step={cur.id}>
            {cur.id === 'owner' ? (
              <Stack gap={3}>
                <p className="cs-hint">Get the owner's name. It goes on the lead and in every text.</p>
                <Input label="Owner's name" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="First name" autoComplete="off" />
              </Stack>
            ) : <p className="cs-line">{scriptLine(lead, cur.key, caller)}</p>}
          </Card>
          {answers.length > 0 && (
            <section className="rm-block" aria-label="If they say">
              <h2 className="rm-h">If they say</h2>
              <Row gap={2} wrap>{answers.map((a, i) => <Chip key={i} label={a.say || 'Something else'} selected={answer === i} onClick={() => setAnswer(answer === i ? -1 : i)} />)}</Row>
              {answer >= 0 && answers[answer]?.respond && <p className="cs-line rm-respond" aria-live="polite">{answers[answer].respond}</p>}
            </section>
          )}
          <Textarea label="What they said" value={said} onChange={(e) => setSaid(e.target.value.slice(0, 1000))} rows={3} placeholder="Their words, as they say them" className="rm-said" hint="Saved on this phone as you type. It goes on the lead when you log the call." />
          <p className="rm-row-sub">{formatPhone(lead.phone)}{lead.owner ? ` · ${lead.owner}` : ''}</p>
        </Stack>
      </ScrollArea>
      <StickyFooterBar className="rm-foot rm-foot--call">
        <Row gap={2} className="rm-foot-row">
          <Button variant="secondary" icon="MessageCircle01" onClick={() => setObjOpen(true)} className="rm-objections">Objections</Button>
          <Button onClick={next} loading={busy} disabled={last} iconEnd="ChevronRight" className="rm-next">Next</Button>
        </Row>
        <Button variant={last ? 'primary' : 'secondary'} size="lg" full icon="PhoneHangUp" onClick={() => setEnding(true)} className="rm-end">End call and log it</Button>
      </StickyFooterBar>
      {objOpen && <ObjectionSheet open lead={{ ...lead, afterCall: counts }} onClose={() => setObjOpen(false)} onPatch={(set) => setCounts(set.afterCall || {})} />}
      {ending && <OutcomeFlow lead={lead} said={said} onClose={() => setEnding(false)} />}
    </PageShell>
  );
}
