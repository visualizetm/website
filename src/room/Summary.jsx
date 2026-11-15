import { useEffect } from 'react';
import { PageShell, ScrollArea, StickyFooterBar, Stack, Row, Grid, Card, Button, StatCard, EmptyState, Stagger, useDelayedLoading } from '../ui';
import { voicemailText } from '../shared/callScript';
import { smsHref } from '../lib/linkSend';
import { useRoom, useRoomBar } from './RoomApp';
import { roomApi } from './roomApi';
import { RowsSkeleton } from './parts';
import { sessionStats, sessionLine, stillToDo, sessionTexted, isMyList, listLeft, plural } from './roomLib';

/* The session summary (Billy's Call Room): "<List>, done.", "N calls in Xh Ym", the six numbers, what is still to do
 * (the voicemail texts not sent yet, the callbacks this session scheduled), then Start next list or Done for today.
 * The session record is written once, when the summary opens, stamped Billy on the server. */
export default function Summary() {
  const { session, setSession, leads, lists, go, write, startCalling, caller, loading } = useRoom();
  useRoomBar('Session');
  const stats = sessionStats(session);
  useEffect(() => {
    if (!session || session.recorded || !stats.calls) return;
    const endedAt = new Date().toISOString();
    setSession(s => (s ? { ...s, recorded: true, endedAt } : s));
    write(roomApi.sessionEnd, { list: session.list, startedAt: session.startedAt, endedAt, stats });
  }, [session?.recorded, stats.calls]); // eslint-disable-line react-hooks/exhaustive-deps
  const show = useDelayedLoading(loading);

  if (!session) {
    return <PageShell label="Session"><ScrollArea><EmptyState icon="PhoneCall01" title="No session running" description="Start calling from Today and the numbers land here when you finish." action={{ label: 'Back to Calls', onClick: () => go('/') }} /></ScrollArea></PageShell>;
  }
  const todo = stillToDo(session);
  const owed = todo.texts.map(id => leads.find(l => l.id === id)).filter(l => l && l.phone);
  const nextList = [...lists].filter(l => isMyList(l) && listLeft(l) > 0 && String(l.id) !== String(session.listId))[0] || null;
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  return (
    <PageShell label="Session summary">
      <ScrollArea>
        <Stagger className="rm-summary" cap={5}>
          <div className="rm-hello">
            <h2 className="rm-hello-title">{session.list || 'Session'}, done.</h2>
            <p className="rm-hello-date">{sessionLine(session, end)}</p>
          </div>
          <Grid minColumnWidth={140} gap={2} role="group" aria-label="This session">
            <StatCard icon="PhoneCall01" value={stats.calls} label="Calls" />
            <StatCard icon="MessageCircle01" value={stats.talked} label="Talked" />
            <StatCard icon="CalendarCheck01" tone="booked" value={stats.booked} label="Booked" />
            <StatCard icon="ClockRewind" value={stats.callbacks} label="Callbacks" />
            <StatCard icon="PhoneHangUp" value={stats.noAnswer} label="No answer" />
            <StatCard icon="SlashCircle01" value={stats.notInterested} label="Not interested" />
          </Grid>
          <section className="rm-block" aria-label="Still to do">
            <h3 className="rm-h">Still to do</h3>
            {loading && show ? <RowsSkeleton rows={2} /> : !owed.length && !todo.callbacks ? <p className="rm-row-sub">Nothing. Every text is sent and no callbacks are waiting from this session.</p> : (
              <Stack gap={2}>
                {owed.map(l => (
                  <Card key={l.id} padding={3} className="rm-row" data-row-id={l.id}>
                    <Row gap={3} align="center">
                      <Stack gap={1} style={{ flex: 1, minWidth: 0 }}><p className="rm-row-name lay-truncate">{l.business}</p><p className="rm-row-sub">Voicemail text not sent</p></Stack>
                      <Button variant="secondary" icon="MessageTextSquare01" href={smsHref(l.phone, voicemailText(l, caller))} onClick={() => setSession(s => sessionTexted(s, l.id))} aria-label={`Text ${l.business}`}>Text it</Button>
                    </Row>
                  </Card>
                ))}
                {todo.callbacks > 0 && <p className="rm-row-sub">{plural(todo.callbacks, 'callback')} scheduled. {todo.callbacks === 1 ? 'It waits' : 'They wait'} under Callbacks at {todo.callbacks === 1 ? 'its' : 'their'} time.</p>}
              </Stack>
            )}
          </section>
        </Stagger>
      </ScrollArea>
      <StickyFooterBar className="rm-foot">
        <Button variant="ghost" onClick={() => { setSession(null); go('/', { replace: true }); }} className="rm-done">Done for today</Button>
        <Button size="lg" icon="PhoneCall01" disabled={!nextList} onClick={() => startCalling(nextList)} className="rm-next-list">Start next list</Button>
      </StickyFooterBar>
    </PageShell>
  );
}
