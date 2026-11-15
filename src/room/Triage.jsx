import { useState } from 'react';
import { Stack, Row, Card, Button, EmptyState, useDelayedLoading, useToast } from '../ui';
import DeclineSheet from '../components/DeclineSheet';
import { COPY } from '../shared/copy';
import { formatPhone } from '../shared/phone';
import { useRoom } from './RoomApp';
import { roomApi } from './roomApi';
import { RoomError, CardSkeleton, LeadChips } from './parts';
import { PutOnListSheet } from './sheets';
import { triagePile, foundLine, ratingLine, websiteLine, plural } from './roomLib';

/* Triage (Billy's Call Room): one lead at a time, highest score first. The card says what the scraper found (the chips,
 * the name, when and where it was found, the Google rating, the website, the phone, Instagram) and three buttons decide:
 * Decline (the console's DeclineSheet), Accept (Put it on a list) and Not now (to the back of the pile, kept on the
 * lead as triageSnoozedAt so it stays at the back tomorrow). */
const handle = (v) => { const s = String(v || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, ''); return s ? `@${s}` : ''; };

export default function Triage() {
  const { leads, loading, error, write, applyLead, applyList } = useRoom();
  const toast = useToast();
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState('');
  const show = useDelayedLoading(loading);
  if (error) return <RoomError />;
  if (loading) return show ? <CardSkeleton lines={5} /> : <div className="rm-wait" />;
  const pile = triagePile(leads);
  const lead = pile[0];
  const c = COPY.room.empty.triage;
  if (!lead) return <EmptyState icon="Inbox01" title={c.title} description={c.description} />;

  const gone = (r) => { if (r.status === 404 || r.status === 409) { applyLead(lead.id, null); toast.info('That one was already sorted.'); return true; } return false; };
  const decide = async (body, done) => {
    setBusy(body.decision);
    const r = await write(roomApi.triage, { leadId: lead.id, ...body });
    setBusy('');
    if (!r.ok) { if (!gone(r)) toast.error(r.data?.error || COPY.room.saveFailed); return; }
    setSheet(null);
    done(r.data || {});
  };
  const accept = (pick) => decide({ decision: 'accept', ...(pick.listId ? { listId: pick.listId } : pick.newList ? { newList: pick.newList } : {}) }, (d) => {
    applyLead(lead.id, d.lead); applyList(d.list);
    toast.success(d.list ? `${lead.business} is on ${d.list.name}.` : `${lead.business} is in Leads.`);
  });
  const decline = (reason, note) => decide({ decision: 'decline', reason, note }, () => { applyLead(lead.id, null); toast.success(`${lead.business} declined.`); });
  const later = () => decide({ decision: 'snooze' }, (d) => { applyLead(lead.id, d.lead); if (pile.length === 1) toast.info('That is the only one waiting.'); });

  const rating = ratingLine(lead);
  const ig = handle(lead.instagram);
  return (
    <Stack gap={3} className="rm-triage">
      <p className="rm-count" role="status" aria-live="polite">{plural(pile.length, 'lead')} to sort</p>
      <Card key={lead.id} padding={4} className="rm-triage-card rm-line" data-triage-id={lead.id}>
        <Stack gap={3}>
          <Stack gap={2}>
            <LeadChips lead={lead} />
            <h2 className="rm-lead-name lay-title">{lead.business || 'Unnamed'}</h2>
            <p className="rm-row-sub">{foundLine(lead)}</p>
          </Stack>
          <dl className="rm-dl">
            <div><dt>Google</dt><dd>{rating || 'No rating yet'}</dd></div>
            <div><dt>Website</dt><dd>{websiteLine(lead)}</dd></div>
            <div><dt>Phone</dt><dd>{lead.phone ? formatPhone(lead.phone) : 'No number yet'}</dd></div>
            <div><dt>Instagram</dt><dd>{ig || 'None found'}</dd></div>
          </dl>
          <Row gap={2} className="rm-triage-acts">
            <Button variant="ghost" icon="SlashCircle01" disabled={!!busy} onClick={() => setSheet('decline')} className="rm-t-decline">Decline</Button>
            <Button variant="secondary" icon="ClockSnooze" loading={busy === 'snooze'} disabled={!!busy && busy !== 'snooze'} onClick={later} className="rm-t-later">Not now</Button>
            <Button icon="Check" disabled={!!busy} onClick={() => setSheet('accept')} className="rm-t-accept">Accept</Button>
          </Row>
        </Stack>
      </Card>
      {sheet === 'accept' && <PutOnListSheet description={lead.business} cta="Accept and add" allowNone busy={busy === 'accept'} onClose={() => setSheet(null)} onConfirm={accept} />}
      {sheet === 'decline' && <DeclineSheet lead={lead} busy={busy === 'decline'} onClose={() => setSheet(null)} onConfirm={decline} />}
    </Stack>
  );
}
