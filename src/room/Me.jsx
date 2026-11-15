import { PageShell, ScrollArea, Stack, Row, Card, Pill, SegmentedControl, EmptyState, useDelayedLoading } from '../ui';
import { COPY } from '../shared/copy';
import { useRoom, useRoomBar } from './RoomApp';
import { RoomError, RowsSkeleton } from './parts';
import { whenLine } from './roomLib';

/* Me (Billy's Call Room): one segment in part 1, Booked: the leads Billy booked as a status word and nothing else about
 * them (they are Rob's from the moment they are booked). Part 2 adds Earned beside it (ME_SEGMENTS). Sign out is the text
 * link at the bottom. */
export const ME_SEGMENTS = [{ id: 'booked', label: 'Booked' }];
const TONE = { Booked: 'booked', Met: 'progress', Quoted: 'new', Client: 'booked', Closed: 'neutral' };

export default function Me() {
  const { me, booked, loading, error, go, signOut } = useRoom();
  useRoomBar('Me');
  const show = useDelayedLoading(loading);
  const c = COPY.room.empty.booked;
  const rows = [...booked].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return (
    <PageShell label="Me">
      <ScrollArea>
        <Stack gap={4}>
          <SegmentedControl full size="sm" label="Me sections" options={ME_SEGMENTS} value="booked" onChange={() => {}} className="rm-strip" />
          {error ? <RoomError /> : loading ? (show ? <RowsSkeleton rows={4} /> : <div className="rm-wait" />) : !rows.length ? (
            <EmptyState icon="CalendarCheck01" title={c.title} description={c.description} action={{ label: c.action, onClick: () => go('/') }} />
          ) : (
            <ul className="rm-booked rm-enter" data-v-enter="" aria-label="Leads you booked">
              {rows.map((b, i) => (
                <li key={`${b.business}-${b.at}-${i}`} className="rm-booked-row">
                  <Card padding={3}>
                    <Row gap={3} align="center">
                      <Stack gap={1} style={{ flex: 1, minWidth: 0 }}><p className="rm-row-name lay-truncate">{b.business}</p><p className="rm-row-sub">{b.at ? `Booked ${whenLine(b.at)}` : 'Booked'}</p></Stack>
                      <Pill label={b.word} tone={TONE[b.word] || 'neutral'} icon={false} size="sm" />
                    </Row>
                  </Card>
                </li>
              ))}
            </ul>
          )}
          <div className="rm-signout">
            <p className="rm-row-sub">Signed in as {me.name}.</p>
            <button type="button" className="rm-link" onClick={signOut}>Sign out</button>
          </div>
        </Stack>
      </ScrollArea>
    </PageShell>
  );
}
