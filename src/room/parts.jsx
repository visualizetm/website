import { Card, Stack, Row, StickyFooterBar, SkeletonBlock, SkeletonText, ErrorState, EmptyState, Pill, useRetry } from '../ui';
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
/* Skeletons (the feel audit's fit): each one is drawn to the loaded screen's own rows, so nothing moves when the data lands. A lead row is
 * 70px (two lines in a 12px card); a section heading is 26px. Small blocks carry the spacing; the tall ones are what the screen lines up to. */
const RowSkel = () => <Card padding={3} className="rm-skel-row"><Row gap={3} align="center"><Stack gap={1} style={{ flex: 1, minWidth: 0 }}><SkeletonBlock width="55%" height={22} /><SkeletonBlock width="38%" height={18} /></Stack><SkeletonBlock width={56} height={22} radius="var(--v-radius-pill)" /></Row></Card>;
const HeadSkel = ({ width = 140 }) => <span className="rm-skel-h"><SkeletonBlock width={width} height={18} /></span>;
export function RowsSkeleton({ rows = 4, className = '' }) {
  return <Stack gap={2} className={`rm-skel ${className}`.trim()} aria-hidden="true">{Array.from({ length: rows }, (_, i) => <RowSkel key={i} />)}</Stack>;
}
export function CardSkeleton({ lines = 4 }) {
  return <Card padding={4} className="rm-skel" aria-hidden="true"><Stack gap={3}><SkeletonBlock width="40%" height={14} /><SkeletonBlock width="70%" height={26} /><SkeletonText lines={lines} /></Stack></Card>;
}
/** A footer's place: one tall button, or the call room's two and one. */
export const FootSkeleton = ({ call = false }) => (
  <StickyFooterBar className={`rm-foot${call ? ' rm-foot--call' : ''}`} aria-hidden="true">
    {call && <Row gap={2} className="rm-foot-row"><SkeletonBlock height={44} radius="var(--v-radius-md)" /><SkeletonBlock height={44} radius="var(--v-radius-md)" /></Row>}
    <SkeletonBlock height={56} radius="var(--v-radius-lg)" className="rm-skel-grow" />
  </StickyFooterBar>
);
export const TriageSkeleton = () => (
  <Stack gap={3} className="rm-skel" aria-hidden="true">
    <SkeletonBlock width={96} height={18} />
    <Card padding={4} className="rm-skel-triage"><Stack gap={3}><Row gap={2}><SkeletonBlock width={56} height={22} radius="var(--v-radius-pill)" /><SkeletonBlock width={64} height={22} radius="var(--v-radius-pill)" /></Row><SkeletonBlock width="60%" height={30} /><SkeletonText lines={4} /></Stack></Card>
  </Stack>
);
export const LeadsSkeleton = () => (
  <Stack gap={3} className="rm-skel" aria-hidden="true">
    <SkeletonBlock height={44} radius="var(--v-radius-md)" />
    <Row gap={2}><SkeletonBlock width={109} height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={104} height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={123} height={44} radius="var(--v-radius-md)" /></Row>
    <Stack gap={2}>{Array.from({ length: 6 }, (_, i) => <RowSkel key={i} />)}</Stack>
  </Stack>
);
export const ListsSkeleton = () => (
  <Stack gap={3} className="rm-skel" aria-hidden="true">
    <Row gap={3} align="center" justify="between"><SkeletonBlock width={56} height={18} /><SkeletonBlock width={108} height={44} radius="var(--v-radius-md)" /></Row>
    <Stack gap={2}>
      {['a', 'b', 'c'].map(k => <Card key={k} padding={4} className={`rm-skel-list rm-skel-list--${k}`}><Stack gap={3}><Row gap={2} justify="between"><SkeletonBlock width="45%" height={24} /><SkeletonBlock width={88} height={22} radius="var(--v-radius-pill)" /></Row><SkeletonBlock height={6} /></Stack></Card>)}
    </Stack>
  </Stack>
);
export const CallbacksSkeleton = () => (
  <Stack gap={4} className="rm-skel" aria-hidden="true">{[0, 1, 2].map(i => <div key={i}><HeadSkel width={i ? 96 : 72} /><RowSkel /></div>)}</Stack>
);
export const LeadCardSkeleton = () => (
  <div className="rm-lead rm-skel" aria-hidden="true">
    <Stack gap={2}><SkeletonBlock width={160} height={22} radius="var(--v-radius-pill)" /><SkeletonBlock width="70%" height={34} /><SkeletonBlock width="40%" height={20} /></Stack>
    <Card padding={3} className="rm-skel-facts"><SkeletonText lines={4} /></Card>
    <div className="rm-skel-bullets"><SkeletonBlock width={120} height={18} /><SkeletonText lines={3} /></div>
    <Card padding={4} className="rm-skel-opener"><Stack gap={2}><SkeletonBlock width={96} height={12} /><SkeletonText lines={2} /></Stack></Card>
  </div>
);
export const CallRoomSkeleton = () => (
  <Stack gap={4} className="rm-skel" aria-hidden="true">
    <Stack gap={2}><SkeletonBlock width={150} height={18} /><SkeletonBlock height={4} /></Stack>
    <Card padding={4} className="rm-skel-line"><SkeletonBlock width="80%" height={14} /></Card>
    <div><HeadSkel width={88} /><Row gap={2}><SkeletonBlock width={158} height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={86} height={44} radius="var(--v-radius-md)" /></Row></div>
    <SkeletonBlock radius="var(--v-radius-md)" className="rm-skel-said" />
  </Stack>
);
/** The open times: a heading, the day strip (the same chips, so it wraps the same way), one row of times, the notes. `head` off when the heading is already on screen. */
export const SlotsSkeleton = () => (
  <Stack gap={3} className="rm-skel" aria-hidden="true">
    <div className="rm-days">{[122, 110, 116, 112].map(w => <SkeletonBlock key={w} width={w} height={44} radius="var(--v-radius-md)" />)}</div>
    <div className="rm-slots">{[0, 1, 2].map(i => <SkeletonBlock key={i} height={44} radius="var(--v-radius-md)" />)}</div>
  </Stack>
);
export const BookingSkeleton = () => (
  <div className="rm-lead rm-skel" aria-hidden="true">
    <Stack gap={1}><SkeletonBlock width={190} height={26} /><SkeletonBlock width={170} height={18} /></Stack>
    <SlotsSkeleton />
    <SkeletonBlock height={138} radius="var(--v-radius-md)" />
  </div>
);
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
