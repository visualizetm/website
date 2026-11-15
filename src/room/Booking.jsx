import { useCallback, useEffect, useState } from 'react';
import { PageShell, ScrollArea, StickyFooterBar, Stack, Row, Card, Button, Chip, Textarea, EmptyState, ErrorState, Stagger, Icon, useDelayedLoading, useRetry, useToast } from '../ui';
import { COPY } from '../shared/copy';
import { smsHref } from '../lib/linkSend';
import { useRoom, useRoomBar } from './RoomApp';
import { roomApi, roomStore } from './roomApi';
import { RoomError, BookingSkeleton, SlotsSkeleton, FootSkeleton, Missing } from './parts';
import { slotDays, slotLine, bookedText, newSession, sessionLogged, sessionNext } from './roomLib';

/* Booking (Billy's Call Room): Rob's open times for the next 14 days (a day strip and a grid of times, New York), then
 * "What should Rob know?", prefilled with what Billy typed on the call. The button reads Book <day time>. The server
 * checks the slot again at the write: a time taken since the screen loaded answers 409, the screen says so and reads the
 * open times again. A booked lead is Rob's, so the room keeps only what the Booked screen needs and lets the lead go. */
export default function Booking({ id }) {
  const room = useRoom();
  const { leads, loading, error, go, write, applyLead } = room;
  const toast = useToast();
  const lead = leads.find(l => l.id === id) || null;
  const [open, setOpen] = useState({ state: 'loading', slots: [] });
  const [dayKey, setDayKey] = useState('');
  const [pick, setPick] = useState('');
  const [notes, setNotes] = useState(() => roomStore.get(`said_${id}`, '') || '');
  const [busy, setBusy] = useState(false);
  useRoomBar(lead ? `Book ${lead.business}` : 'Book');

  const loadSlots = useCallback(async () => {
    setOpen(o => ({ ...o, state: 'loading' }));
    const r = await roomApi.openTimes();
    if (!r.ok) { setOpen({ state: 'error', slots: [] }); return false; }
    setOpen({ state: 'ready', slots: Array.isArray(r.data?.slots) ? r.data.slots : [] });
    return true;
  }, []);
  useEffect(() => { loadSlots(); }, [loadSlots]);
  const [retry, retrying] = useRetry(loadSlots);
  const showLead = useDelayedLoading(loading);
  const showSlots = useDelayedLoading(open.state === 'loading');

  if (error) return <PageShell label="Book"><ScrollArea><RoomError /></ScrollArea></PageShell>;
  if (loading) return <PageShell label="Book"><ScrollArea>{showLead ? <BookingSkeleton /> : <div className="rm-wait" />}</ScrollArea>{showLead && <FootSkeleton />}</PageShell>;
  if (!lead) return <PageShell label="Book"><ScrollArea><Missing /></ScrollArea></PageShell>;

  const now = Date.now();
  const days = slotDays(open.slots, now);
  const day = days.find(d => d.key === dayKey) || days[0] || null;
  const c = COPY.room.empty.slots;

  const book = async () => {
    setBusy(true);
    const r = await write(roomApi.book, { leadId: id, at: pick, notes: notes.trim() });
    setBusy(false);
    if (r.status === 409) { toast.error('That time was just taken. Pick another.'); setPick(''); loadSlots(); return; }
    if (r.status === 404) { toast.error('That lead is not yours to book any more.'); go('/', { replace: true }); return; }
    if (!r.ok) { toast.error(r.data?.error || COPY.room.saveFailed); return; }
    roomStore.set(`said_${id}`, null);
    roomStore.set('booked', { leadId: id, business: lead.business, owner: lead.owner || '', phone: lead.phone || '', at: r.data?.booked?.at || pick, rob: r.data?.rob || {} });
    room.setSession(sessionLogged(room.session || newSession({ ids: [id] }), id, 'booked'));
    applyLead(id, null);
    go('/booked', { replace: true });
  };

  return (
    <PageShell label={`Book ${lead.business}`}>
      <ScrollArea>
        <Stagger className="rm-lead rm-booking" cap={4}>
          <Stack gap={1}>
            <h2 className="rm-list-name lay-title">Rob's open times</h2>
            <p className="rm-row-sub">The next 14 days, Eastern time.</p>
          </Stack>
          {open.state === 'error' ? <ErrorState title="The open times did not load" description="Nothing was booked. Try again." onRetry={retry} retrying={retrying} />
            : open.state === 'loading' ? (showSlots ? <SlotsSkeleton /> : <div className="rm-wait" />)
              : !days.length ? <Card padding={2}><EmptyState size="sm" icon="Calendar" title={c.title} description={c.description} /></Card> : (
                <Stack gap={3}>
                  <div className="rm-days" role="group" aria-label="Day">
                    {days.map(d => <Chip key={d.key} label={d.label} selected={day.key === d.key} onClick={() => { setDayKey(d.key); if (!d.slots.some(s => s.iso === pick)) setPick(''); }} data-day={d.key} />)}
                  </div>
                  <div className="rm-slots" role="group" aria-label={`Times on ${day.label}`} key={day.key}>
                    {day.slots.map(s => <Chip key={s.iso} label={s.label} selected={pick === s.iso} onClick={() => setPick(pick === s.iso ? '' : s.iso)} data-slot={s.iso} className="rm-slot" />)}
                  </div>
                </Stack>
              )}
          <Textarea label="What should Rob know?" rows={4} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 1000))} placeholder="What they want, who decides, anything they said about money or timing." className="rm-book-notes" />
        </Stagger>
      </ScrollArea>
      <StickyFooterBar className="rm-foot">
        <Button size="lg" full icon="CalendarCheck01" disabled={!pick} loading={busy} onClick={book} className="rm-book rm-call">{pick ? `Book ${slotLine(pick, now)}` : 'Pick a time'}</Button>
      </StickyFooterBar>
      <p className="v-sr-only" role="status" aria-live="polite">{pick ? `${slotLine(pick, now)} picked.` : ''}</p>
    </PageShell>
  );
}

/* Booked: "Booked." and the time card; Text it opens Messages with the line filled in (Billy taps send himself); the
 * Rob has it card ticks what the server did (the push, the notes, the confirmation draft); then the next lead. */
export function Booked() {
  const { go, session, caller } = useRoom();
  useRoomBar('Booked');
  const [b] = useState(() => roomStore.get('booked'));
  const [texted, setTexted] = useState(false);
  if (!b) return <PageShell label="Booked"><ScrollArea><EmptyState icon="CalendarCheck01" title="Nothing just booked" description="Book a lead from a call and it lands here." action={{ label: 'Back to Calls', onClick: () => go('/') }} /></ScrollArea></PageShell>;
  const lead = { owner: b.owner, phone: b.phone, business: b.business };
  const text = bookedText(lead, b.at, caller.name);
  const rob = b.rob || {};
  const ticks = [
    [rob.push, 'Push sent to Rob', 'No push went (Rob has it off, or no device is on)'],
    [rob.notes, 'Your notes are on the lead', 'No notes added'],
    [rob.draft, 'Confirmation email drafted for Rob', 'No email draft was made'],
  ];
  const next = () => {
    roomStore.set('booked', null);
    const id = session ? sessionNext(session, b.leadId) : '';
    go(id && id !== b.leadId ? `/lead/${encodeURIComponent(id)}` : session ? '/summary' : '/', { replace: true });
  };
  return (
    <PageShell label="Booked">
      <ScrollArea>
        <Stagger className="rm-lead rm-bookedscreen" cap={4}>
          <div className="rm-hello">
            <h2 className="rm-hello-title">Booked.</h2>
            <p className="rm-hello-date">{b.business} is Rob's from here.</p>
          </div>
          <Card padding={4} className="rm-timecard" data-card="time">
            <Stack gap={1}>
              <p className="rm-k">Call with Rob</p>
              <p className="rm-list-name">{slotLine(b.at)}</p>
              <p className="rm-row-sub">{b.business}{b.owner ? ` · ${b.owner}` : ''} · Eastern time</p>
            </Stack>
          </Card>
          {b.phone && (
            <Card padding={4} data-card="text">
              <Stack gap={3}>
                <p className="rm-k">Text the time</p>
                <p className="rm-text-body">{text}</p>
                <Row gap={2} align="center" wrap>
                  <Button variant="secondary" icon="MessageTextSquare01" href={smsHref(b.phone, text)} onClick={() => setTexted(true)} className="rm-booked-text">Text it</Button>
                  <p className="rm-row-sub" role="status" aria-live="polite">{texted ? 'Messages opened. You tap send.' : 'Opens Messages with this filled in. You tap send.'}</p>
                </Row>
              </Stack>
            </Card>
          )}
          <Card padding={4} data-card="rob-has-it">
            <Stack gap={3}>
              <p className="rm-k">Rob has it</p>
              <ul className="rm-ticks">
                {ticks.map(([on, yes, no], i) => (
                  <li key={i} className={`rm-tick${on ? ' is-on' : ''}`} data-on={on ? '1' : '0'}>
                    <span className="rm-tick-mark" aria-hidden="true"><Icon icon={on ? 'Check' : 'Minus'} size="var(--v-icon-sm)" /></span>
                    <span>{on ? yes : no}</span>
                  </li>
                ))}
              </ul>
            </Stack>
          </Card>
        </Stagger>
      </ScrollArea>
      <StickyFooterBar className="rm-foot">
        <Button size="lg" full iconEnd="ArrowRight" onClick={next} className="rm-booked-next rm-call">Next lead</Button>
      </StickyFooterBar>
    </PageShell>
  );
}
