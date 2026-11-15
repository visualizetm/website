import { PageShell, ScrollArea, Stack, EmptyState, Stagger, Icon, useDelayedLoading } from '../ui';
import { COPY } from '../shared/copy';
import { formatPhone } from '../shared/phone';
import { useRoom, useRoomBar } from './RoomApp';
import { RoomError, RowsSkeleton, LeadRow, callbackDetail } from './parts';
import { callbackSections } from './roomLib';

/* Callbacks (Billy's Call Room): only the callbacks Billy set and the retries on leads he called, in the order he will
 * get to them: Due now, Later today, Tomorrow, then anything further out, then "No answer, try again". */
const SECTIONS = [['dueNow', 'Due now'], ['laterToday', 'Later today'], ['tomorrow', 'Tomorrow'], ['later', 'Later'], ['retry', 'No answer, try again']];

export default function Callbacks() {
  const { leads, loading, error, go } = useRoom();
  useRoomBar('Callbacks');
  const show = useDelayedLoading(loading);
  const now = Date.now();
  const s = callbackSections(leads, now);
  const total = SECTIONS.reduce((n, [k]) => n + s[k].length, 0);
  const c = COPY.room.empty.callbacks;
  return (
    <PageShell label="Callbacks">
      <ScrollArea>
        {error ? <RoomError /> : loading ? (show ? <RowsSkeleton rows={5} /> : <div className="rm-wait" />) : !total ? (
          <EmptyState icon="ClockRewind" title={c.title} description={c.description} />
        ) : (
          <Stagger className="rm-sections" cap={5}>
            {SECTIONS.filter(([k]) => s[k].length).map(([k, title]) => (
              <section key={k} className="rm-block" aria-label={title} data-section={k}>
                <h2 className="rm-h">{title} <span className="rm-h-n">{s[k].length}</span></h2>
                <Stack gap={2}>
                  {s[k].map(l => <LeadRow key={l.id} lead={l} detail={k === 'retry' ? [formatPhone(l.phone), 'rang out'].filter(Boolean).join(' · ') : callbackDetail(l, now)} label={`${k === 'retry' ? 'Try' : 'Call back'} ${l.business}`} onOpen={() => go(`/lead/${encodeURIComponent(l.id)}?from=callbacks`)} trailing={<span className="rm-row-call" aria-hidden="true"><Icon icon="PhoneCall01" size="var(--v-icon-md)" /></span>} />)}
                </Stack>
              </section>
            ))}
          </Stagger>
        )}
      </ScrollArea>
    </PageShell>
  );
}
