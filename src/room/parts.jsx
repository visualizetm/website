import { Card, Stack, Row, SkeletonBlock, SkeletonText, ErrorState, EmptyState, Pill, useRetry } from '../ui';
import { COPY } from '../shared/copy';
import { formatPhone } from '../shared/phone';
import { useRoom } from './RoomApp';
import { subLine, whenLine } from './roomLib';

/* Small pieces the Call Room's screens share: the load error with Retry, the skeletons, the lead chips, a lead row. */
export function RoomError() {
  const { reload } = useRoom();
  const [retry, retrying] = useRetry(reload);
  return <ErrorState title={COPY.room.error.title} description={COPY.room.error.description} onRetry={retry} retrying={retrying} className="rm-error" />;
}
export function RowsSkeleton({ rows = 4, className = '' }) {
  return (
    <Stack gap={2} className={`rm-skel ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <Card key={i} padding={3}><Row gap={3} align="center"><Stack gap={2} style={{ flex: 1, minWidth: 0 }}><SkeletonBlock width="55%" height={16} /><SkeletonBlock width="38%" height={12} /></Stack><SkeletonBlock width={56} height={22} radius="var(--v-radius-pill)" /></Row></Card>)}
    </Stack>
  );
}
export function CardSkeleton({ lines = 4 }) {
  return <Card padding={4} className="rm-skel" aria-hidden="true"><Stack gap={3}><SkeletonBlock width="40%" height={14} /><SkeletonBlock width="70%" height={26} /><SkeletonText lines={lines} /></Stack></Card>;
}
export const Missing = () => { const { go } = useRoom(); const c = COPY.room.empty.lead; return <EmptyState icon="UserX01" title={c.title} description={c.description} action={{ label: c.action, onClick: () => go('/') }} />; };

/** The chips a lead wears: type, city, Score N. Text only, never a control. */
export function LeadChips({ lead }) {
  return (
    <Row gap={2} wrap className="rm-chips" role="list" aria-label="About this lead">
      {lead.type && <span role="listitem"><Pill label={lead.type} tone="neutral" icon={false} size="sm" /></span>}
      {lead.city && <span role="listitem"><Pill label={lead.city} tone="neutral" icon={false} size="sm" /></span>}
      <span role="listitem"><Pill label={`Score ${lead.score || 0}`} tone={lead.score >= 70 ? 'booked' : lead.score >= 40 ? 'new' : 'neutral'} icon={false} size="sm" /></span>
    </Row>
  );
}
/** One lead as a row: the whole row is the one control. `detail` overrides the "type, city, score" line; `trailing` sits at the right. */
export function LeadRow({ lead, detail, trailing = null, label, onOpen }) {
  return (
    <Card padding={3} className="rm-row" data-row-id={lead.id}>
      <button type="button" className="v-stretch" onClick={onOpen} aria-label={label || `Open ${lead.business || 'this lead'}`}>{label || `Open ${lead.business || 'this lead'}`}</button>
      <Row gap={3} align="center">
        <Stack gap={1} style={{ flex: 1, minWidth: 0 }}>
          <p className="rm-row-name lay-truncate">{lead.business || 'Unnamed'}</p>
          <p className="rm-row-sub lay-truncate">{detail || subLine(lead)}</p>
        </Stack>
        {trailing}
      </Row>
    </Card>
  );
}
export const callbackDetail = (lead, now) => [whenLine(lead.callbackAt, now), formatPhone(lead.phone)].filter(Boolean).join(' · ');
