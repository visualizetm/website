import { Stack, Row, Card, Button, Pill, ProgressBar, Menu } from '../ui';
import { listCount, isFull, windowLabel } from '../lib/lists';
import { fmtDate } from '../shared/dates';

/* One dial list as a card (CRM revamp, step 3): its count against the
 * target as a booked-tone bar, the window, a Start that goes primary when
 * the list is full, and the menu the caller supplies. Lists and the Call
 * tab both draw it. */
export default function ListCard({ list, onOpen, onStart, onMenu }) {
  const n = listCount(list); const full = isFull(list);
  const sysFull = list.system && n > 0;
  return (
    <Card as="div" padding={4} interactive className={`ls-card${full || sysFull ? ' is-full' : ''}`}>
      <button type="button" className="v-stretch" onClick={onOpen} aria-label={`Open ${list.name}, ${n} of ${list.target}`}>{`Open ${list.name}`}</button>
      <Stack gap={3}>
        <Row gap={2} align="center" justify="between" wrap={false}>
          <Row gap={2} align="center" wrap style={{ minWidth: 0 }}>
            <span className="ls-name lay-truncate">{list.name}</span>
            {list.system && <Pill tone="callback" label="Fills itself" size="sm" icon={false} variant="outline" />}
            {list.window && list.window !== 'any' && <Pill tone="neutral" label={windowLabel(list.window)} size="sm" icon={false} variant="outline" />}
            {list.scheduledFor && <Pill tone="progress" label={fmtDate(list.scheduledFor)} size="sm" icon="Calendar" variant="soft" />}
          </Row>
          <span className="v-above"><Menu label={`${list.name} actions`} items={onMenu(list)} /></span>
        </Row>
        <Stack gap={1}>
          <span className="ls-count">{list.system ? `${n} due` : `${n} of ${list.target}`}</span>
          <ProgressBar value={list.system ? (n ? 100 : 0) : list.target ? Math.min(100, (n / list.target) * 100) : 0} tone="booked" size="sm" label={list.system ? `${n} callbacks due` : `${n} of ${list.target} leads`} />
        </Stack>
        <span className="v-above"><Button size="md" full variant={full || sysFull ? 'primary' : 'secondary'} icon="Play" onClick={() => onStart(list)} disabled={!n}>Start</Button></span>
      </Stack>
    </Card>
  );
}

export const listCardStyles = `
  .ls-card { gap: 0; text-align: left; align-items: stretch; }
  .ls-card.is-full { border-color: var(--v-status-booked-text); }
  .ls-card:has(> .v-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .ls-name { font-size: var(--v-text-md); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .ls-count { font-size: var(--v-text-sm); color: var(--v-text-2); font-variant-numeric: tabular-nums; }
  .ls-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(260px, 100%), 1fr)); gap: var(--v-space-3); }
`;
