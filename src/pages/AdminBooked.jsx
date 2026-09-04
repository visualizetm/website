import { useEffect, useMemo, useState } from 'react';
import PhoneOutgoing01 from '@untitled-ui/icons-react/build/esm/PhoneOutgoing01';
import {
  PageShell, ScrollArea, Section, Stack, Row, Card, Chip, Pill, ProgressBar, EmptyState, Stagger, SkeletonBlock, useDelayedLoading, useMediaQuery,
} from '../ui';
import { useTopBar, useShell } from '../shell/ShellContext';
import LeadCard from '../components/LeadCard';
import LeadDetail from '../components/LeadDetail';
import { effectiveStage, meetingDate } from '../lib/booked';
import { MEETING_TYPES } from '../shared/semantics';
import { countdownLabel, fmtDateTime } from '../shared/dates';

/* Booked workspace (Prompt 8): the list of booked leads and the shared
 * LeadDetail in booked mode. */

const FILTERS = [
  ['all', 'All'], ['week', 'This week'], ['upcoming', 'Upcoming'], ['nodate', 'No date set'], ['concepts', 'Needs concepts'], ['outcome', 'Awaiting outcome'],
];
const DAY = 864e5;
function passes(l, f, now) {
  const d = meetingDate(l);
  const t = d?.getTime();
  switch (f) {
    case 'week': return !!t && t >= now - DAY && t <= now + 7 * DAY;
    case 'upcoming': return !!t && t > now;
    case 'nodate': return !t;
    case 'concepts': return !(l.concepts || []).length || (l.concepts || []).some(c => c.status !== 'ready' && c.status !== 'shown');
    case 'outcome': return !!t && t < now && !(l.bookedOutcome?.at);
    default: return true;
  }
}

function MeetingLine({ lead }) {
  const d = meetingDate(lead);
  const concepts = lead.concepts || [];
  const ready = concepts.filter(c => c.status === 'ready' || c.status === 'shown').length;
  return (
    <div className="bk-line">
      <Row gap={2} wrap>
        {d ? <><Pill tone={countdownLabel(d) === 'today' ? 'booked' : 'neutral'} label={countdownLabel(d)} size="sm" icon="CalendarCheck01" /><span className="bk-when">{fmtDateTime(d)}</span></> : <Pill tone="new" label="No date set" size="sm" icon={false} variant="outline" />}
        {lead.meeting?.type && <Pill tone="progress" label={MEETING_TYPES.find(t => t.id === lead.meeting.type)?.label || lead.meeting.type} size="sm" variant="outline" icon={false} />}
      </Row>
      {concepts.length > 0 && <Row gap={2}><ProgressBar value={Math.round((ready / concepts.length) * 100)} tone="booked" size="sm" /><span className="bk-cn">{ready}/{concepts.length}</span></Row>}
    </div>
  );
}

export default function AdminBooked({ leads, submissions = [], loading, onPatch, onRefresh, onLinkSubmission, onMobileOpen, onMobileClose, onGo, openId }) {
  const shell = useShell();
  const desktop = useMediaQuery('(min-width: 1280px)');
  const [selId, setSelId] = useState(null);
  const [filter, setFilter] = useState('all');
  const showSkel = useDelayedLoading(loading && !leads.length);
  const now = Date.now();
  const booked = useMemo(() => leads.filter(l => effectiveStage(l) === 'booked').sort((a, b) => { const da = meetingDate(a); const db = meetingDate(b); if (da && db) return da - db; if (da) return -1; if (db) return 1; return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0); }), [leads]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([id]) => [id, booked.filter(l => passes(l, id, now)).length])), [booked, now]);
  const list = useMemo(() => booked.filter(l => passes(l, filter, now)), [booked, filter, now]);
  const sel = selId ? leads.find(l => l._id === selId) : null;
  const pick = (id) => { setSelId(id); onMobileOpen?.(); };
  const back = () => { setSelId(null); onMobileClose?.(); };
  useEffect(() => { if (openId?.id) { setSelId(openId.id); onMobileOpen?.(); } }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  useTopBar(sel ? null : null);

  const cards = (compact) => (
    <Stagger className="bk-stack">{list.map(l => <div key={l._id} className="bk-item"><LeadCard lead={l} compact onOpen={() => pick(l._id)} selected={sel?._id === l._id} />{!compact && <MeetingLine lead={l} />}</div>)}</Stagger>
  );

  if (sel) {
    return (
      <>
        <aside className={`aa-panel bk-panel${desktop ? '' : ' bk-panel--rail'}`}>
          <ScrollArea bare className="bk-panel-scroll"><Stack gap={2}><p className="bk-muted">{list.length} booked</p>{cards(true)}</Stack></ScrollArea>
        </aside>
        <main className="aa-main bk-main">
          <LeadDetail lead={sel} submissions={submissions} onPatch={onPatch} onLinkSubmission={onLinkSubmission} onClose={back} />
        </main>
        <style>{bkStyles}</style>
      </>
    );
  }

  return (
    <PageShell className="aa-main aa-main--wide bk-shell">
      <ScrollArea wide className="bk-page">
        <Section title="Booked" description={showSkel ? undefined : `${booked.length} booked, ${counts.week} this week`}>
          <Row gap={2} wrap className="bk-chips">{FILTERS.map(([id, label]) => <Chip key={id} label={label} count={counts[id]} selected={filter === id} onClick={() => setFilter(id)} />)}</Row>
        </Section>
        {showSkel ? (
          <Stack gap={2} aria-busy="true">{[1, 2, 3, 4].map(i => <Card key={i} padding={0}><LeadCard.Skeleton compact /><div className="bk-line"><SkeletonBlock width={160} height={14} /></div></Card>)}</Stack>
        ) : !booked.length ? (
          <Card><EmptyState icon="CalendarCheck01" title="No booked leads yet" description="Book one from the Call Console. A booked outcome lands it here for meeting prep." action={{ label: 'Open Call Console', icon: PhoneOutgoing01, onClick: () => (shell ? shell.go('calls') : onGo?.('calls')) }} /></Card>
        ) : !list.length ? (
          <Card><EmptyState size="sm" icon="SearchMd" title="Nothing in this filter" action={{ label: 'Show all', onClick: () => setFilter('all') }} /></Card>
        ) : cards(false)}
      </ScrollArea>
      <style>{bkStyles}</style>
    </PageShell>
  );
}

const bkStyles = `
  .bk-shell.aa-main { display: flex; flex-direction: column; }
  .bk-page { --v-stack-gap: var(--v-space-4); }
  .bk-stack { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .bk-stack > .v-stagger-item { display: contents; }
  .bk-item { display: flex; flex-direction: column; min-width: 0; }
  .bk-item .lc { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
  .bk-line { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-2) var(--v-space-3); background: var(--v-surface-2); border: 1px solid var(--v-border); border-top: 0; border-radius: 0 0 var(--v-radius-md) var(--v-radius-md); }
  .bk-when { font-size: var(--v-text-sm); color: var(--v-text-2); font-weight: var(--v-weight-semibold); }
  .bk-cn { font-size: var(--v-text-xs); color: var(--v-text-3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .bk-muted { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .bk-panel { padding: var(--v-space-3); }
  .bk-panel-scroll { padding: 0; }
  @media (min-width: 1024px) and (max-width: 1279px) { .bk-panel--rail { width: 232px; } }
  .bk-main { display: flex; flex-direction: column; min-width: 0; }
  @media (max-width: 767px) { .aa-app.has-detail .aa-main.bk-main { display: flex; } }
`;
