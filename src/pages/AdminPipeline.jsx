import { useMemo } from 'react';
import {
  PageShell, ScrollArea, Stack, Row, Card, Button, Pill, ProgressBar, EmptyState, ErrorState, Stagger, SkeletonBlock, FunnelBar, useDelayedLoading, useRetry, useToast, Icon,
} from '../ui';
import { COPY } from '../shared/copy';
import { useShell, useTopBar } from '../shell/ShellContext';
import { normalizeStage } from '../shared/semantics';
import { fmtDate, fmtWeekdayDateTime, relativeTime } from '../shared/dates';
import { pipelineFunnel } from '../lib/leads';
import { triageLeads, keepPatch, undoKeepPatch } from '../lib/triage';
import { callbacksDueIds, handLists, listCount } from '../lib/lists';
import { isTicked } from '../lib/deal';
import { useDecline } from '../components/DeclineSheet';
import { computeDashboard } from '../lib/dashboardStats';

/* The Pipeline dashboard (the nav revamp, milestone 5): the Pipeline
 * workspace's home for cold calling. The funnel as one bar (Triage, Leads,
 * Contacted, Booked, Deals, Clients with the step conversion), the newest
 * five in Triage with Accept and Deny, today's calls and the active list's
 * progress against its target and due date, follow ups due, the next seven
 * days of meetings, and the deals ready to hand off into Clients. Every
 * number is the same selector the screens use (pipelineFunnel,
 * triageLeads, callbacksDueIds, computeDashboard, the Calendar's events);
 * Accept is keepPatch and Deny the existing Decline sheet, so the pipeline
 * is presented here, never redefined. */

const DAY = 864e5;

export function Dash({ title, action, children, className = '', 'data-card': dc }) {
  return (
    <Card className={`dash-card ${className}`.trim()} data-card={dc}>
      <Row gap={2} align="center" justify="between" wrap className="dash-card-head">
        <p className="pb-card-h">{title}</p>
        {action}
      </Row>
      {children}
    </Card>
  );
}

/* The skeleton draws the loaded shape: the same cards with the same fixed heights (dash-card, dash-card--funnel, the stat row),
 * so every row sits where the loaded row sits and the feel audit's fit holds without an exemption. */
export function DashSkeleton({ cards = 6, stats = 0, funnel = false }) {
  return (
    <div className="dash-grid" aria-busy="true" aria-hidden="true">
      {stats > 0 && <div className="dash-stats dash-card--wide">{Array.from({ length: stats }, (_, i) => <Card key={i} className="v-stat"><SkeletonBlock width={40} height={40} radius="var(--v-radius-md)" /><SkeletonBlock width={72} height={28} /><SkeletonBlock width="80%" height={14} /></Card>)}</div>}
      {funnel && <Card className="dash-card dash-card--wide dash-card--funnel"><div className="dash-card-head"><SkeletonBlock width={80} height={14} /></div><SkeletonBlock width="100%" height={56} radius="var(--v-radius-md)" /><SkeletonBlock width="60%" height={44} radius="var(--v-radius-pill)" /></Card>}
      {Array.from({ length: cards }, (_, i) => <Card key={i} className="dash-card"><div className="dash-card-head"><SkeletonBlock width={120} height={14} /></div><SkeletonBlock width="100%" height={53} radius="var(--v-radius-md)" /><SkeletonBlock width="100%" height={53} radius="var(--v-radius-md)" /><SkeletonBlock width="100%" height={53} radius="var(--v-radius-md)" /></Card>)}
    </div>
  );
}

export default function AdminPipeline({ leads = [], lists = [], subs = [], orders = [], loading = false, error = false, onRetry, onPatch }) {
  const shell = useShell();
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const showSkel = useDelayedLoading(loading);
  const decline = useDecline({ onPatch });
  useTopBar(null);
  const now = Date.now();

  const stages = useMemo(() => { const c = { triage: 0, deal: 0 }; for (const l of leads) { const s = normalizeStage(l); if (s === 'triage') c.triage++; if (s === 'deal') c.deal++; } return c; }, [leads]);
  const funnel = useMemo(() => pipelineFunnel(leads), [leads]);
  const steps = [
    // Triage is the intake, not a step of the funnel, so Leads carries no conversion; every later step is cumulative (a client was once a deal).
    { id: 'triage', label: 'Triage', n: stages.triage, onClick: () => shell.go('triage') },
    { id: 'leads', label: 'Leads', n: funnel.leads, pct: false, onClick: () => shell.go('leads') },
    { id: 'contacted', label: 'Contacted', n: funnel.contacted },
    { id: 'booked', label: 'Booked', n: funnel.booked, onClick: () => shell.go('deals') },
    { id: 'deals', label: 'Deals', n: stages.deal + funnel.clients },
    { id: 'clients', label: 'Clients', n: funnel.clients, onClick: () => shell.go('clients') },
  ];
  const queue = useMemo(() => [...triageLeads(leads)].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 5), [leads]);
  const s = useMemo(() => computeDashboard(leads, subs, orders), [leads, subs, orders]);
  const active = useMemo(() => { const open = handLists(lists); return [...open].sort((a, b) => (a.scheduledFor ? 0 : 1) - (b.scheduledFor ? 0 : 1) || String(a.scheduledFor || '').localeCompare(String(b.scheduledFor || '')) || listCount(b) - listCount(a))[0] || null; }, [lists]);
  const followUps = useMemo(() => { const ids = new Set(callbacksDueIds(leads, now).map(String)); return leads.filter(l => ids.has(String(l._id))).sort((a, b) => String(a.callbackAt || '').localeCompare(String(b.callbackAt || ''))).slice(0, 5); }, [leads, now]);
  const meetings = useMemo(() => (shell?.events || []).filter(e => e.lead && (e.kind === 'meeting' || e.kind === 'calendly') && e.at >= now && e.at <= now + 7 * DAY).sort((a, b) => a.at - b.at).slice(0, 5), [shell?.events, now]);
  const handoff = useMemo(() => leads.filter(l => { const st = normalizeStage(l); return st === 'won' || ((st === 'booked' || st === 'deal') && isTicked(l.deal, 'paid')); }).slice(0, 5), [leads]);

  const accept = async (l) => {
    const ok = await onPatch(l._id, keepPatch(l));
    if (!ok) { toast.error(COPY.error.save); return; }
    toast.undo(`${l.business} accepted. It is in Leads.`, () => onPatch(l._id, undoKeepPatch(l)), { seconds: 6 });
  };
  const open = (l) => shell.openRecord(l);

  const body = showSkel ? <DashSkeleton cards={5} funnel /> : error && !leads.length ? (
    <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>
  ) : (
    <Stagger className="dash-grid" cap={6}>
      <Dash title="Funnel" className="dash-card--wide dash-card--funnel" data-card="funnel">
        <FunnelBar steps={steps} />
      </Dash>

      <Dash title={`Triage, ${stages.triage} waiting`} data-card="triage" action={<Button variant="ghost" size="md" icon="ArrowRight" onClick={() => shell.go('triage')} className="pd-open-triage">Open Triage</Button>}>
        {!queue.length ? <EmptyState size="sm" icon="Inbox01" title="Nothing waiting" description="New leads land here first." /> : (
          <Stack gap={1} className="dash-rows">
            {queue.map(l => (
              <div key={l._id} className="dash-row pd-triage-row" data-lead={l._id}>
                <button type="button" className="dash-row-main" onClick={() => open(l)}>
                  <span className="dash-row-title lay-truncate">{l.business}</span>
                  <span className="dash-row-sub lay-truncate">{[l.industry, l.area].filter(Boolean).join(', ') || 'No details yet'}{l.createdAt ? `, ${relativeTime(l.createdAt)}` : ''}</span>
                </button>
                <span className="dash-row-acts">
                  <Button size="md" variant="secondary" icon="Check" onClick={() => accept(l)} className="pd-accept" aria-label={`Accept ${l.business}`}>Accept</Button>
                  <Button size="md" variant="ghost" icon="SlashCircle01" onClick={() => decline.open(l)} className="pd-deny" aria-label={`Deny ${l.business}`}>Deny</Button>
                </span>
              </div>
            ))}
          </Stack>
        )}
      </Dash>

      <Dash title="Calling" data-card="calling" action={<Button variant="ghost" size="md" icon="PhoneCall01" onClick={() => shell.go('calls')} className="pd-open-calls">Call Console</Button>}>
        <Row gap={3} align="baseline"><span className="dash-big">{s.callsToday}</span><span className="dash-muted">{s.callsToday === 1 ? 'call' : 'calls'} today</span></Row>
        {active ? (
          <Stack gap={1} className="pd-list">
            <Row gap={2} align="center" justify="between" wrap><span className="dash-row-title lay-truncate">{active.name}</span>{active.scheduledFor && <span className="dash-muted">due {fmtDate(active.scheduledFor)}</span>}</Row>
            <ProgressBar value={active.target ? Math.min(100, (listCount(active) / active.target) * 100) : 0} size="sm" tone={listCount(active) >= (active.target || 0) ? 'booked' : 'progress'} label={`${listCount(active)} of ${active.target || 0} on the list`} />
          </Stack>
        ) : <p className="dash-muted">No dial list open. Build one under Lists.</p>}
      </Dash>

      <Dash title={`Follow ups due, ${followUps.length}`} data-card="followups">
        {!followUps.length ? <EmptyState size="sm" icon="PhoneIncoming01" title="No callbacks due" description="Callbacks due today or overdue show here." /> : (
          <Stack gap={1} className="dash-rows">
            {followUps.map(l => (
              <div key={l._id} className="dash-row">
                <button type="button" className="dash-row-main" onClick={() => open(l)}>
                  <span className="dash-row-title lay-truncate">{l.business}</span>
                  <span className="dash-row-sub">{l.callbackAt ? fmtWeekdayDateTime(l.callbackAt) : 'Callback'}</span>
                </button>
                <span className="dash-row-acts"><Button size="md" variant="secondary" icon="PhoneCall01" onClick={() => shell.go('calls', { ids: [l._id], autostart: true })} aria-label={`Call ${l.business}`}>Call</Button></span>
              </div>
            ))}
          </Stack>
        )}
      </Dash>

      <Dash title="Meetings, next 7 days" data-card="meetings" action={<Button variant="ghost" size="md" icon="Calendar" onClick={() => shell.go('calendar')}>Calendar</Button>}>
        {!meetings.length ? <EmptyState size="sm" icon="Calendar" title="Nothing booked this week" description="Booked meetings and Calendly events show here." /> : (
          <Stack gap={1} className="dash-rows">
            {meetings.map(e => (
              <div key={e.id} className="dash-row">
                <button type="button" className="dash-row-main" onClick={() => open(e.lead)}>
                  <span className="dash-row-title lay-truncate">{e.lead.business}</span>
                  <span className="dash-row-sub">{fmtWeekdayDateTime(e.at)}</span>
                </button>
              </div>
            ))}
          </Stack>
        )}
      </Dash>

      <Dash title={`Ready to hand off, ${handoff.length}`} data-card="handoff">
        {!handoff.length ? <EmptyState size="sm" icon="Trophy01" title="Nothing to hand off" description="A won deal or a paid one shows here, one tap into Clients." /> : (
          <Stack gap={1} className="dash-rows">
            {handoff.map(l => (
              <div key={l._id} className="dash-row">
                <button type="button" className="dash-row-main" onClick={() => open(l)}>
                  <span className="dash-row-title lay-truncate">{l.business}</span>
                  <span className="dash-row-sub">{normalizeStage(l) === 'won' ? 'Won' : 'Paid'}{l.deal?.packageId ? `, ${l.deal.packageId}` : ''}</span>
                </button>
                <span className="dash-row-acts"><Pill tone="booked" label={normalizeStage(l) === 'won' ? 'Won' : 'Paid'} size="sm" icon={false} /><Icon icon="ArrowRight" size={16} className="dash-muted" /></span>
              </div>
            ))}
          </Stack>
        )}
      </Dash>
    </Stagger>
  );

  return (
    <PageShell className="aa-main aa-main--wide dash-shell">
      <ScrollArea wide className="dash-page">
        {body}
      </ScrollArea>
      {decline.sheet}
      <style>{dashStyles}</style>
    </PageShell>
  );
}

export const dashStyles = `
  .dash-page { --v-stack-gap: var(--v-space-4); }
  .dash-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--v-space-3); min-width: 0; }
  @media (min-width: 768px) { .dash-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (min-width: 1200px) { .dash-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  /* One height per card (and one per stat, one for the funnel card): five rows, a chart or an empty state all fit, and the
   * skeleton draws the same boxes, so every row lands where the loaded one does. */
  .dash-card { gap: var(--v-space-3); min-width: 0; min-height: 400px; }
  .dash-card--funnel { min-height: 260px; }
  @media (min-width: 768px) { .dash-card--funnel { min-height: 200px; } }
  .dash-stats .v-stat { min-height: 208px; }
  .dash-grid > * { min-width: 0; }
  /* Stagger wraps each card, so the wide card's wrapper is the grid child that spans. */
  .dash-card--wide, .dash-grid > :has(> .dash-card--wide) { grid-column: 1 / -1; }
  .dash-card-head { min-height: var(--v-tap); }
  .dash-card-head .pb-card-h { margin: 0; }
  .dash-rows { min-width: 0; }
  .dash-row { display: flex; align-items: center; gap: var(--v-space-2); min-width: 0; border-bottom: 1px solid var(--v-border); padding: var(--v-space-1) 0; }
  .dash-row:last-child { border-bottom: 0; }
  .dash-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; min-height: var(--v-tap); padding: var(--v-space-1) var(--v-space-2); margin: 0 calc(-1 * var(--v-space-2)); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-text); text-align: left; cursor: pointer; font-family: var(--v-font-body); }
  .dash-row-main:hover { background: var(--v-surface-2); }
  .dash-row-main:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .dash-row-title { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .dash-row-sub { font-size: var(--v-text-xs); color: var(--v-text-3); }
  .dash-row-sub--danger { color: var(--v-status-danger-text); }
  .dash-row-acts { display: inline-flex; align-items: center; gap: var(--v-space-1); flex-shrink: 0; }
  .dash-big { font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: 1; font-weight: var(--v-weight-bold); color: var(--v-text); font-variant-numeric: tabular-nums; }
  .dash-muted { font-size: var(--v-text-sm); color: var(--v-text-3); margin: 0; }
  .dash-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--v-space-3); }
  @media (min-width: 768px) { .dash-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (min-width: 1200px) { .dash-stats { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
  .dash-activity { min-width: 0; }
`;
