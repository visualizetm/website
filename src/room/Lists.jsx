import { useState } from 'react';
import { Stack, Row, Card, Button, Pill, ProgressBar, EmptyState, Stagger, useDelayedLoading } from '../ui';
import { COPY } from '../shared/copy';
import { useRoom } from './RoomApp';
import { RoomError, RowsSkeleton } from './parts';
import { NewListSheet, RenameListSheet } from './sheets';
import { listsInOrder, isMyList, isRobList, listLeft, listProgress, leftLine, callerPill, plural } from './roomLib';

/* Lists (Billy's Call Room): New list, then a card per open list: the name, who calls it, how far through it is and
 * "N left of M". A list Billy made says so and can be renamed; a list he calls starts from its card. Callbacks due
 * fills itself and is never his to change. */
export default function Lists({ setDraft }) {
  const { lists, loading, error, go, startCalling } = useRoom();
  const [newOpen, setNewOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const show = useDelayedLoading(loading);
  if (error) return <RoomError />;
  if (loading) return show ? <RowsSkeleton rows={4} /> : <div className="rm-wait" />;
  const ordered = listsInOrder(lists);
  const hand = ordered.filter(l => !l.system);
  const c = COPY.room.empty.lists;
  return (
    <Stack gap={3} className="rm-lists">
      <Row gap={3} align="center" justify="between" wrap>
        <p className="rm-count">{plural(hand.length, 'list')}</p>
        <Button icon="Plus" onClick={() => setNewOpen(true)} className="rm-new-list">New list</Button>
      </Row>
      {!hand.length && <Card padding={2}><EmptyState size="sm" icon="List" title={c.title} description={c.description} action={{ label: c.action, onClick: () => setNewOpen(true) }} /></Card>}
      <Stagger as="ul" className="rm-ul" cap={6} aria-label="Lists">
        {ordered.map(l => (
          <li key={l.id}>
            <Card padding={4} className="rm-listcard" data-list-id={l.id}>
              <Stack gap={3}>
                <Row gap={2} align="start" justify="between">
                  <h3 className="rm-list-name lay-title">{l.name}</h3>
                  <Pill label={callerPill(l)} tone={l.system ? 'neutral' : isRobList(l) ? 'neutral' : 'progress'} icon={false} size="sm" className="rm-caller-pill" />
                </Row>
                {!l.system && <ProgressBar value={listProgress(l)} size="sm" />}
                <Row gap={2} align="center" justify="between" wrap>
                  <p className="rm-row-sub">{l.system ? `${plural(listLeft(l), 'callback')} due now` : leftLine(l)}{!l.system && l.madeBy === 'billy' ? ' · Made by Billy' : ''}</p>
                  {isMyList(l) && (
                    <Row gap={2} align="center">
                      {l.madeBy === 'billy' && <Button variant="ghost" onClick={() => setRenaming(l)} aria-label={`Rename ${l.name}`} className="rm-list-rename">Rename</Button>}
                      <Button variant="secondary" icon="PhoneCall01" disabled={!listLeft(l)} onClick={() => startCalling(l)} aria-label={`Start calling ${l.name}`} className="rm-list-start">Start</Button>
                    </Row>
                  )}
                </Row>
              </Stack>
            </Card>
          </li>
        ))}
      </Stagger>
      {newOpen && <NewListSheet onClose={() => setNewOpen(false)} onMade={() => setNewOpen(false)} onByHand={(d) => { setNewOpen(false); setDraft(d); go('/?section=leads', { replace: true }); }} />}
      {renaming && <RenameListSheet list={renaming} onClose={() => setRenaming(null)} />}
    </Stack>
  );
}
