import { useState } from 'react';
import { PageShell, ScrollArea, Stack, Grid, Card, Button, StatCard, ProgressBar, SegmentedControl, EmptyState, Stagger, SkeletonBlock, Icon, useDelayedLoading } from '../ui';
import { COPY } from '../shared/copy';
import { useRoom, useRoomBar } from './RoomApp';
import { RoomError, RowsSkeleton, LeadRow, callbackDetail } from './parts';
import Triage from './Triage';
import Leads from './Leads';
import Lists from './Lists';
import { greeting, dateLine, callbacksDueNow, yourList, listProgress, leftLine, triagePile, plural } from './roomLib';

/* The Calls hub (Billy's Call Room): a strip of four segments at the top (Today, Triage N, Leads, Lists), the segment's
 * body under it. The segment is ?section= so Back and a reload land on it. The hub holds two things its segments share:
 * the foot (where Leads puts its selection bar, under the scroll area) and a list in the making (New list, By hand). */
export const SEGMENTS = [{ id: 'today', label: 'Today' }, { id: 'triage', label: 'Triage' }, { id: 'leads', label: 'Leads' }, { id: 'lists', label: 'Lists' }];
const BODIES = { today: Today, triage: Triage, leads: Leads, lists: Lists };

export default function Hub({ section }) {
  const { go, leads } = useRoom();
  const [footEl, setFootEl] = useState(null);
  const [draft, setDraft] = useState(null);
  useRoomBar('Calls');
  const active = BODIES[section] ? section : 'today';
  const Body = BODIES[active];
  const pile = triagePile(leads).length;
  const options = SEGMENTS.map(s => (s.id === 'triage' ? { ...s, label: pile ? `Triage ${pile}` : 'Triage' } : s));
  return (
    <PageShell label="Calls">
      <ScrollArea>
        <Stack gap={4}>
          {options.length > 1 && <SegmentedControl full size="sm" label="Calls sections" options={options} value={active} onChange={(id) => go(id === 'today' ? '/' : `/?section=${id}`, { replace: true })} className="rm-strip" />}
          <div className="lay-tabbody" key={active}><Body footEl={footEl} draft={draft} setDraft={setDraft} /></div>
        </Stack>
      </ScrollArea>
      <div ref={setFootEl} className="rm-hub-foot" />
    </PageShell>
  );
}

function TodaySkeleton() {
  return (
    <Stack gap={4} className="rm-skel" aria-hidden="true">
      <Stack gap={2}><SkeletonBlock width="60%" height={28} /><SkeletonBlock width="40%" height={14} /></Stack>
      <Grid minColumnWidth={140} gap={2}>{[0, 1, 2, 3].map(i => <StatCard.Skeleton key={i} />)}</Grid>
      <Card padding={4}><Stack gap={3}><SkeletonBlock width="30%" height={12} /><SkeletonBlock width="60%" height={22} /><SkeletonBlock height={6} /><SkeletonBlock height={52} radius="var(--v-radius-md)" /></Stack></Card>
      <RowsSkeleton rows={2} />
    </Stack>
  );
}

/* Today: the greeting and the date, the day's four numbers, the list to call with Start calling, then the callbacks due now.
 * Start calling takes the callbacks due now first, then the list. */
function Today() {
  const { me, leads, lists, today, loading, error, go, startCalling } = useRoom();
  const show = useDelayedLoading(loading);
  if (error) return <RoomError />;
  if (loading) return show ? <TodaySkeleton /> : <div className="rm-wait" />;
  const now = Date.now();
  const due = callbacksDueNow(leads, now);
  const list = yourList(lists);
  const c = COPY.room.empty.list;
  return (
    <Stagger className="rm-today" cap={5}>
      <div className="rm-hello">
        <h2 className="rm-hello-title">{greeting(me.name, now)}</h2>
        <p className="rm-hello-date">{dateLine(now)}</p>
      </div>
      <Grid minColumnWidth={140} gap={2} className="rm-stats" role="group" aria-label="Today so far">
        <StatCard icon="PhoneCall01" value={today.calls} label="Calls" />
        <StatCard icon="MessageCircle01" value={today.talked} label="Talked" />
        <StatCard icon="CalendarCheck01" tone="booked" value={today.booked} label="Booked" />
        <StatCard icon="ClockRewind" tone={due.length ? 'new' : 'neutral'} value={due.length} label="Callbacks due" />
      </Grid>
      {list ? (
        <Card padding={4} className="rm-list-card" data-card="your-list">
          <Stack gap={3}>
            <Stack gap={1}><p className="rm-k">Your list</p><h3 className="rm-list-name lay-title">{list.name}</h3></Stack>
            <ProgressBar value={listProgress(list)} size="sm" />
            <p className="rm-row-sub">{leftLine(list)}{due.length ? `, after ${plural(due.length, 'callback')} due now` : ''}</p>
            <Button size="lg" full icon="PhoneCall01" onClick={() => startCalling(list)} className="rm-start">Start calling</Button>
          </Stack>
        </Card>
      ) : due.length ? (
        <Card padding={4} className="rm-list-card" data-card="your-list">
          <Stack gap={3}>
            <Stack gap={1}><p className="rm-k">Your list</p><h3 className="rm-list-name lay-title">Callbacks first</h3></Stack>
            <p className="rm-row-sub">{plural(due.length, 'callback')} due now. No list after them yet.</p>
            <Button size="lg" full icon="PhoneCall01" onClick={() => startCalling(null)} className="rm-start">Start calling</Button>
          </Stack>
        </Card>
      ) : (
        <Card padding={2} data-card="your-list"><EmptyState size="sm" icon="List" title={c.title} description={c.description} action={SEGMENTS.some(s => s.id === 'lists') ? { label: c.action, onClick: () => go('/?section=lists', { replace: true }) } : undefined} /></Card>
      )}
      {due.length > 0 && (
        <section className="rm-block" aria-label="Callbacks due now">
          <h3 className="rm-h">Callbacks due now</h3>
          <Stack gap={2}>
            {due.map(l => <LeadRow key={l.id} lead={l} detail={callbackDetail(l, now)} label={`Call back ${l.business}`} onOpen={() => go(`/lead/${encodeURIComponent(l.id)}?from=today`)} trailing={<span className="rm-row-call" aria-hidden="true"><Icon icon="PhoneCall01" size="var(--v-icon-md)" /></span>} />)}
          </Stack>
        </section>
      )}
    </Stagger>
  );
}
