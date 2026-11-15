import { useState } from 'react';
import { PageShell, ScrollArea, StickyFooterBar, Stack, Row, Card, Button, Sheet, Input, Stagger, Icon, useDelayedLoading, useToast } from '../ui';
import { formatPhone, telHref } from '../shared/phone';
import { scriptLine } from '../shared/callScript';
import { useRoom, useRoomBar } from './RoomApp';
import { roomApi } from './roomApi';
import { RoomError, CardSkeleton, Missing, LeadChips } from './parts';
import { PutOnListSheet, useListMove } from './sheets';
import { onRobList, intelBullets, websiteLine, ratingLine, newSession, sessionNext, sessionSkipped } from './roomLib';

/* The lead card (Billy's Call Room): who it is and what to know before dialing: the chips, the name, the owner, the phone,
 * the hours, the website note, Before you dial, Your opener. Call is a tel: link and opens the call room; Skip for now
 * sends the lead to the end of today's list. A lead on a list Rob calls is not dialed from here: Move it to my list asks
 * first (the confirm), and when Rob switched the moves off the button is locked. The top bar's one action
 * is the contact fix (the phone and the owner's name, the only two fields Billy can change). */
export default function LeadCard({ id }) {
  const { me, leads, lists, loading, error, go, session, setSession, write, applyLead, applyList, caller } = useRoom();
  const toast = useToast();
  const move = useListMove();
  const [fixOpen, setFixOpen] = useState(false);
  const [putOpen, setPutOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const lead = leads.find(l => l.id === id) || null;
  useRoomBar(lead?.business || 'Lead', lead ? [{ id: 'fix', label: 'Fix the number or the name', icon: 'Edit02', onClick: () => setFixOpen(true) }] : null);
  const show = useDelayedLoading(loading);
  if (error) return <PageShell label="Lead"><ScrollArea><RoomError /></ScrollArea></PageShell>;
  if (loading) return <PageShell label="Lead"><ScrollArea>{show ? <CardSkeleton lines={6} /> : <div className="rm-wait" />}</ScrollArea></PageShell>;
  if (!lead) return <PageShell label="Lead"><ScrollArea><Missing /></ScrollArea></PageShell>;

  const rob = onRobList(lead, lists);
  const tel = telHref(lead.phone);
  const bullets = intelBullets(lead);
  const opener = lead.script?.opener || scriptLine(lead, 'intro', caller);
  const inQueue = !!session && session.ids.includes(id) && !session.logged?.[id] && session.ids.filter(x => !session.logged?.[x]).length > 1;
  const rating = ratingLine(lead);
  const lockedOnRob = !!rob && me.moveOffRobLists === false;
  const moveTo = async (pick) => {
    setPutOpen(false); setMoving(true);
    const r = await move.run({ leads: [lead], targetId: pick.listId || '', targetName: pick.list?.name || pick.newList, fn: roomApi.batch, build: (ids, confirm) => ({ op: 'list', leadIds: ids, ...(pick.listId ? { listId: pick.listId } : { newList: pick.newList }), ...(confirm ? { confirm: true } : {}) }) });
    setMoving(false);
    if (r.left) return;
    if (!r.ok) { toast.error(r.status === 404 ? 'That lead is not yours to move any more.' : r.data?.error || 'That did not save. Try again in a moment.'); return; }
    applyList(r.data?.list);
    if (r.data?.list) applyLead(id, { ...lead, listId: r.data.list.id });
    toast.success(`${lead.business} is on ${r.data?.list?.name || 'your list'}.`);
  };

  const call = () => { if (!session) setSession(newSession({ ids: [id] })); go(`/call/${encodeURIComponent(id)}`); };
  const skip = async () => {
    const s2 = sessionSkipped(session, id); setSession(s2);
    if (session.listId) { const r = await write(roomApi.list, { op: 'skip', listId: session.listId, leadId: id }); if (r.ok && r.data?.list) applyList(r.data.list); }
    const next = sessionNext(s2);
    if (!next || next === id) { toast.info('That is the last one on the list.'); return; }
    go(`/lead/${encodeURIComponent(next)}`, { replace: true });
  };

  return (
    <PageShell label={lead.business}>
      <ScrollArea>
        <Stagger className="rm-lead" cap={5}>
          <Stack gap={2}>
            <LeadChips lead={lead} />
            <h2 className="rm-lead-name lay-title">{lead.business || 'Unnamed'}</h2>
            <p className="rm-lead-owner">Owner: {lead.owner || 'not known yet'}</p>
          </Stack>
          <Card padding={3} className="rm-facts">
            <dl className="rm-dl">
              <div><dt>Phone</dt><dd>{lead.phone ? formatPhone(lead.phone) : 'No number yet'}</dd></div>
              {lead.hours && <div><dt>Open</dt><dd>{lead.hours}</dd></div>}
              <div><dt>Website</dt><dd>{websiteLine(lead)}</dd></div>
              {rating && <div><dt>Google</dt><dd>{rating}</dd></div>}
            </dl>
          </Card>
          {rob && (
            <Card padding={3} className="rm-note" role="note">
              <Row gap={2} align="start"><Icon icon="AlertTriangle" size="var(--v-icon-md)" /><p className="rm-note-text">On Rob's list: {rob.name}. {lockedOnRob ? 'Rob has locked his lists, so this one is his to call.' : 'Move it to one of yours before you call it.'}</p></Row>
            </Card>
          )}
          {bullets.length > 0 && (
            <section className="rm-block" aria-label="Before you dial">
              <h3 className="rm-h">Before you dial</h3>
              <ul className="rm-bullets">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </section>
          )}
          <Card padding={4} className="rm-opener" data-card="opener">
            <p className="rm-k">Your opener</p>
            <p className="cs-line">{opener}</p>
          </Card>
        </Stagger>
      </ScrollArea>
      <StickyFooterBar className="rm-foot">
        {inQueue && <Button variant="ghost" icon="SkipForward" onClick={skip} className="rm-skip">Skip for now</Button>}
        {rob
          ? (lockedOnRob
            ? <Button size="lg" icon="Lock01" disabled className="rm-call">Locked on Rob's list</Button>
            : <Button size="lg" icon="ArrowRight" loading={moving} onClick={() => setPutOpen(true)} className="rm-call rm-move-mine">Move it to my list</Button>)
          : tel
            ? <Button size="lg" icon="PhoneCall01" href={tel} onClick={call} className="rm-call">Call</Button>
            : <Button size="lg" icon="PhoneCall01" disabled className="rm-call">No number yet</Button>}
      </StickyFooterBar>
      {putOpen && <PutOnListSheet title="Move it to a list" description={lead.business} cta="Move it" exceptId={rob?.id} onClose={() => setPutOpen(false)} onConfirm={moveTo} />}
      {move.sheet}
      {fixOpen && <ContactFix lead={lead} onClose={() => setFixOpen(false)} onSave={async (body) => { const r = await write(roomApi.contact, { leadId: id, ...body }); if (r.ok && r.data?.lead) { applyLead(id, r.data.lead); setFixOpen(false); toast.success('Saved.'); } else if (r.status === 404) toast.error('That lead is not yours to change any more.'); return r.ok; }} />}
    </PageShell>
  );
}

function ContactFix({ lead, onClose, onSave }) {
  const [phone, setPhone] = useState(lead.phone || '');
  const [owner, setOwner] = useState(lead.owner || '');
  const [busy, setBusy] = useState(false);
  const changed = phone.trim() !== (lead.phone || '') || owner.trim() !== (lead.owner || '');
  const save = async () => { setBusy(true); try { await onSave({ ...(phone.trim() !== (lead.phone || '') ? { phone: phone.trim() } : {}), ...(owner.trim() !== (lead.owner || '') ? { owner: owner.trim() } : {}) }); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={onClose} title="Fix the number or the name" description={lead.business}
      footer={<><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button loading={busy} disabled={!changed} onClick={save}>Save</Button></>}>
      <Stack gap={3}>
        <Input label="Phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} data-autofocus />
        <Input label="Owner's name" value={owner} onChange={(e) => setOwner(e.target.value)} autoComplete="off" />
      </Stack>
    </Sheet>
  );
}
