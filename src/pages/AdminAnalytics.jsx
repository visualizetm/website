import { useEffect, useMemo, useState } from 'react';
import {
  PageShell, ScrollArea, Stack, Row, Card, Button, StatCard, SegmentedControl, EmptyState, ErrorState, Stagger, SkeletonBlock, BarChart, LineChart, DonutChart, FunnelBar, useDelayedLoading, useMediaQuery,
} from '../ui';
import { COPY } from '../shared/copy';
import { apiFetch } from '../shared/api';
import { money } from '../shared/format';
import { fmtDate, fmtWeekdayDateTime } from '../shared/dates';
import { packageOf, RETAINERS } from '../shared/pricing';
import { useShell, useTopBar } from '../shell/ShellContext';
import { nextUpItems } from '../lib/nextAction';
import { Dash, DashSkeleton, dashStyles } from './AdminPipeline';

/* Analytics (the nav revamp, milestone 6): the home. The greeting, then the
 * range (Month, 90 days, Year), the KPIs with their change against the
 * period before (Income, Clients gained, Tasks completed, Leads added, MRR,
 * outstanding beside income), the charts (income by week or month, clients
 * gained, tasks completed, the funnel, income by package), the meetings
 * card and the top open tasks. Every number comes from /api/admin/analytics
 * (api/_routes/analytics.js over api/_lib/analytics.js, mirrored in
 * src/lib/analytics.js): real records, honest empty states, no sample
 * data. The payload is small and cached here for a minute per range. The
 * open tasks are the task rules over the leads already in the shell. */

const RANGES = [{ id: 'month', label: 'Month' }, { id: '90', label: '90 days' }, { id: 'year', label: 'Year' }];
const CACHE_MS = 60e3;
const cache = new Map(); // range -> { at, data }
const greetingFor = (h, name = 'Rob') => (h < 12 ? `Good morning, ${name}.` : h < 17 ? `Good afternoon, ${name}.` : `Good evening, ${name}.`);
const PERIOD_WORD = { month: 'the last 30 days', '90': 'the last 90 days', year: 'the last 12 months' };
const PREV_WORD = { month: 'vs the 30 before', '90': 'vs the 90 before', year: 'vs the year before' };
const packageLabel = (id) => (id === 'retainer' ? 'Retainers' : id === 'custom' ? 'Custom' : id === 'unlinked' ? 'No project' : packageOf(id)?.label || RETAINERS.find(r => r.id === id)?.label || id);

function useAnalytics(range) {
  const [state, setState] = useState(() => { const c = cache.get(range); return c && Date.now() - c.at < CACHE_MS ? { data: c.data, loading: false, error: false } : { data: c?.data || null, loading: true, error: false }; });
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    const c = cache.get(range);
    if (c && Date.now() - c.at < CACHE_MS && n === 0) { setState({ data: c.data, loading: false, error: false }); return undefined; }
    setState(s => ({ ...s, loading: true, error: false }));
    apiFetch(`/api/admin/analytics?range=${range}`, { fresh: n > 0 }).then(r => {
      if (!live) return;
      if (r.ok && r.data?.kpis) { cache.set(range, { at: Date.now(), data: r.data }); setState({ data: r.data, loading: false, error: false }); } else setState(s => ({ ...s, loading: false, error: true }));
    });
    return () => { live = false; };
  }, [range, n]);
  return { ...state, retry: () => setN(x => x + 1) };
}

const trendOf = (k, better = 'up') => (k && k.delta !== null && k.delta !== undefined ? { value: `${k.delta > 0 ? '+' : ''}${k.delta}%`, direction: k.delta > 0 ? 'up' : k.delta < 0 ? 'down' : 'flat', tone: k.delta === 0 ? 'neutral' : (k.delta > 0) === (better === 'up') ? 'booked' : 'danger' } : null);

export default function AdminAnalytics({ leads = [], projects = [], sets = [], leadsLoading = false, forceLoading = false }) {
  const shell = useShell();
  const phone = useMediaQuery('(max-width: 767px)');
  const [range, setRange] = useState(() => { try { return RANGES.some(r => r.id === localStorage.getItem('vz_analytics_range')) ? localStorage.getItem('vz_analytics_range') : 'month'; } catch { return 'month'; } });
  const pick = (id) => { setRange(id); try { localStorage.setItem('vz_analytics_range', id); } catch { /* storage may be off */ } };
  const { data, loading, error, retry } = useAnalytics(range);
  const showSkel = useDelayedLoading((loading && !data) || forceLoading); // forceLoading: the audits' ?loading=1, nothing has loaded yet
  useTopBar(null);
  const now = Date.now();
  const name = (shell?.profile?.name || 'Rob').split(' ')[0];
  const dateLine = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const q = useMemo(() => nextUpItems(leads, projects, sets, now), [leads, projects, sets]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = useMemo(() => [...q.overdue, ...q.today, ...q.later, ...q.undated].slice(0, 5), [q]);
  const upcoming = useMemo(() => (shell?.events || []).filter(e => e.lead && (e.kind === 'meeting' || e.kind === 'calendly') && e.at >= now && e.at <= now + 7 * 864e5).sort((a, b) => a.at - b.at), [shell?.events, now]);
  const k = data?.kpis;
  const series = (key) => (data ? data.series.labels.map((label, i) => ({ label, value: data.series[key][i] || 0 })) : []);
  const anyIncome = !!data && data.series.income.some(v => v > 0);
  const anyClients = !!data && data.series.clients.some(v => v > 0);
  const anyTasks = !!data && data.series.tasks.some(v => v > 0);
  const funnelSteps = data ? [
    { id: 'triage', label: 'Triage', n: data.funnel.triage, onClick: () => shell.go('triage') },
    { id: 'leads', label: 'Leads', n: data.funnel.leads, pct: false, onClick: () => shell.go('leads') },
    { id: 'contacted', label: 'Contacted', n: data.funnel.contacted },
    { id: 'booked', label: 'Booked', n: data.funnel.booked, onClick: () => shell.go('deals') },
    { id: 'deals', label: 'Deals', n: data.funnel.deals },
    { id: 'clients', label: 'Clients', n: data.funnel.clients, onClick: () => shell.go('clients') },
  ] : [];

  const header = (
    <div className="an-head">
      <Stack gap={1}>
        <h2 className="an-greet">{greetingFor(new Date().getHours(), name)}</h2>
        {/* Two lines of room in every state, so the skeleton's header sits where the loaded one sits (the feel audit's fit). */}
        <p className="an-context">{dateLine}. {k ? `${money(k.income.value)} in, ${money(k.outstanding.value)} owed, ${PERIOD_WORD[range]}.` : 'Your numbers, from the records.'}</p>
      </Stack>
      <Row gap={2} wrap className="an-head-actions">
        <Button icon="PhoneCall01" onClick={() => shell.go('calls')}>Start call session</Button>
        <Button variant="secondary" icon="Plus" onClick={() => shell.newLead({})}>Add lead</Button>
        <SegmentedControl options={RANGES} value={range} onChange={pick} label="Range" className="an-range" />
      </Row>
    </div>
  );

  const body = showSkel ? <DashSkeleton cards={7} stats={6} /> : error && !data ? (
    <Card><ErrorState title="The numbers did not load" description={COPY.error.leads.description} onRetry={retry} /></Card>
  ) : data ? (
    <Stagger className="dash-grid" cap={6}>
      <div className="dash-stats dash-card--wide" data-card="kpis" aria-busy={loading || undefined}>
        <StatCard icon="CurrencyDollar" tone="won" value={money(k.income.value)} label={`income, ${PREV_WORD[range]}`} trend={trendOf(k.income)} onClick={() => shell.go('projects')} data-kpi="income" />
        <StatCard icon="CurrencyDollarCircle" tone={k.outstanding.value ? 'callback' : 'neutral'} value={money(k.outstanding.value)} label="outstanding, sent and unpaid" onClick={() => shell.go('overview')} data-kpi="outstanding" />
        <StatCard icon="Briefcase01" tone="booked" value={k.clientsGained.value} label={`${k.clientsGained.value === 1 ? 'client' : 'clients'} gained`} trend={trendOf(k.clientsGained)} onClick={() => shell.go('clients')} data-kpi="clients" />
        <StatCard icon="CheckDone01" tone="progress" value={k.tasksCompleted.value} label={`${k.tasksCompleted.value === 1 ? 'task' : 'tasks'} completed${data.trackingSince ? `, tracking since ${fmtDate(data.trackingSince)}` : ''}`} trend={trendOf(k.tasksCompleted)} onClick={() => shell.go('tasks')} data-kpi="tasks" />
        <StatCard icon="Users01" tone="new" value={k.leadsAdded.value} label={`${k.leadsAdded.value === 1 ? 'lead' : 'leads'} added`} trend={trendOf(k.leadsAdded)} onClick={() => shell.go('leads')} data-kpi="leads" />
        <StatCard icon="RefreshCw01" tone="neutral" value={money(k.mrr.value)} label="a month on retainers, today" onClick={() => shell.go('overview')} data-kpi="mrr" />
      </div>

      <Dash title={`Income by ${data.unit}`} data-card="income">
        {anyIncome ? <BarChart data={series('income')} format={money} height={180} label={`Income by ${data.unit}, ${PERIOD_WORD[range]}`} /> : <EmptyState size="sm" icon="CurrencyDollar" title="No payments in this period" description="Mark an invoice paid or log a payment and it lands here." />}
      </Dash>
      <Dash title="Clients gained" data-card="clients">
        {anyClients ? <LineChart data={series('clients')} height={180} label={`Clients gained by ${data.unit}, ${PERIOD_WORD[range]}`} tone="--v-chart-3" /> : <EmptyState size="sm" icon="Briefcase01" title="No new clients in this period" description="The first paid invoice on a deal makes a client." />}
      </Dash>
      <Dash title="Tasks completed" data-card="tasks">
        {anyTasks ? <BarChart data={series('tasks')} height={180} label={`Tasks completed by ${data.unit}, ${PERIOD_WORD[range]}`} tone="--v-chart-2" /> : <EmptyState size="sm" icon="CheckDone01" title={data.trackingSince ? 'None in this period' : 'Nothing tracked yet'} description={data.trackingSince ? `Tracking since ${fmtDate(data.trackingSince)}.` : 'Tick a task done and the count starts.'} />}
      </Dash>
      <Dash title="Funnel today" data-card="funnel">
        <FunnelBar steps={funnelSteps} />
      </Dash>
      <Dash title="Income by package" data-card="packages">
        {data.byPackage.length ? <DonutChart data={data.byPackage.map(b => ({ label: packageLabel(b.id), value: b.amount }))} format={money} label={`Income by package, ${PERIOD_WORD[range]}`} totalLabel="received" /> : <EmptyState size="sm" icon="Package" title="No payments to split" description="Payments on a project show by its package." />}
      </Dash>
      <Dash title="Meetings" data-card="meetings" action={<Button variant="ghost" size="md" icon="Calendar" onClick={() => shell.go('calendar')}>Calendar</Button>}>
        <Row gap={4} wrap>
          <span><span className="dash-big">{data.meetings.held}</span> <span className="dash-muted">held in {PERIOD_WORD[range]}{data.meetings.heldPrev ? `, ${data.meetings.heldPrev} before` : ''}</span></span>
          <span><span className="dash-big">{upcoming.length}</span> <span className="dash-muted">in the next 7 days</span></span>
        </Row>
        {upcoming.length ? (
          <Stack gap={1} className="dash-rows">{upcoming.slice(0, 3).map(e => <div key={e.id} className="dash-row"><button type="button" className="dash-row-main" onClick={() => shell.openRecord(e.lead)}><span className="dash-row-title lay-truncate">{e.lead.business}</span><span className="dash-row-sub">{fmtWeekdayDateTime(e.at)}</span></button></div>)}</Stack>
        ) : <p className="dash-muted">Nothing booked this week.</p>}
      </Dash>
      <Dash title={`Open tasks, ${q.overdue.length + q.today.length} due`} data-card="open-tasks" className="dash-card--wide" action={<Button variant="ghost" size="md" icon="ArrowRight" onClick={() => shell.go('tasks')} className="an-open-tasks">All tasks</Button>}>
        {leadsLoading && !leads.length ? <SkeletonBlock width="100%" height={44} /> : !open.length ? <EmptyState size="sm" icon="CheckDone01" title="Nothing waiting" description="Every next action is done or dated past this week." /> : (
          <Stack gap={1} className="dash-rows">
            {open.slice(0, 5).map(it => (
              <div key={it.id} className="dash-row">
                <button type="button" className="dash-row-main" onClick={() => shell.openRecord(it.lead)}>
                  <span className="dash-row-title lay-truncate">{it.action.label}{it.project ? `, ${it.project.name}` : ''}</span>
                  <span className={`dash-row-sub${it.bucket === 'overdue' ? ' dash-row-sub--danger' : ''}`}>{it.lead.business}{it.action.dueAt ? `, ${it.bucket === 'overdue' ? 'overdue ' : ''}${fmtDate(it.action.dueAt)}` : ', no date'}</span>
                </button>
              </div>
            ))}
          </Stack>
        )}
      </Dash>
    </Stagger>
  ) : null;

  return (
    <PageShell className="aa-main aa-main--wide dash-shell an-shell">
      <ScrollArea wide className="dash-page an-page">
        {phone && shell?.overviewStrip ? <div className="an-overview">{shell.overviewStrip(true)}</div> : null}
        {header}
        {body}
      </ScrollArea>
      <style>{dashStyles}{anStyles}</style>
    </PageShell>
  );
}

const anStyles = `
  .an-overview { display: flex; min-width: 0; overflow-x: auto; scrollbar-width: none; margin: 0 calc(-1 * var(--v-space-1)); padding: 0 var(--v-space-1); }
  .an-overview::-webkit-scrollbar { display: none; }
  .an-head { display: flex; flex-direction: column; gap: var(--v-space-3); min-width: 0; }
  @media (min-width: 1024px) { .an-head { flex-direction: row; align-items: flex-start; justify-content: space-between; } }
  .an-greet { margin: 0; font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); letter-spacing: var(--v-ls-display-sm); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); overflow-wrap: anywhere; }
  @media (min-width: 1280px) { .an-greet { font-size: var(--v-display-md); line-height: var(--v-lh-display-md); letter-spacing: var(--v-ls-display-md); } }
  .an-context { margin: 0; min-height: calc(2 * var(--v-lh-md)); font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .an-head-actions { flex-shrink: 0; align-items: center; }
  .an-range { flex-shrink: 0; }
  @media (max-width: 767px) { .an-head-actions > .v-btn { flex: 1 1 45%; } .an-head-actions > .v-seg { flex: 1 1 100%; } }
  .dash-stats .v-stat-label { overflow-wrap: anywhere; }
`;
