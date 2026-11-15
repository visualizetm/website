import { Card, Stack } from '../../ui';
import { fmtWeekdayDateTime, fmtDate } from '../../shared/dates';
import { bookedByBilly } from '../../lib/team';

/* Booked by Billy (Billy's Call Room, part 1): on a record he booked, when he booked it, what he wrote for Rob and his
 * calls on that lead. It sits inside a section (Meeting on a deal, History everywhere else) and keeps the record's six
 * laws: text only, no pill, no control, and nothing renders for a line that is empty. */
export default function BookedByCard({ lead }) {
  const b = bookedByBilly(lead);
  if (!b) return null;
  return (
    <Card level={2} padding={3} className="rc-bookedby" data-card="booked-by" role="group" aria-label={`Booked by ${b.name}`}>
      <Stack gap={2}>
        <p className="rc-label">Booked by {b.name}</p>
        {b.at && <p className="rc-line">{fmtWeekdayDateTime(new Date(b.at))}</p>}
        {b.notes && <p className="rc-bookedby-notes">{b.notes}</p>}
        {b.calls.length > 0 && (
          <ul className="rc-bookedby-calls" aria-label={`${b.name}'s calls on this lead`}>
            {b.calls.map((c, i) => <li key={i}><span className="rc-muted">{fmtDate(c.at)}</span> {c.label}{c.note && c.outcome !== 'booked' ? `: ${c.note}` : ''}</li>)}
          </ul>
        )}
      </Stack>
    </Card>
  );
}
