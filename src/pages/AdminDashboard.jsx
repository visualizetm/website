import { useEffect, useMemo, useState } from 'react';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import {
  Stack, Row, Grid, Section, Card, StatCard, IconTile, Pill, ListRow, EmptyState, Button, InlineEdit, ProgressRing,
  Stagger, SkeletonBlock, SkeletonCircle, SkeletonText, useDelayedLoading, useMediaQuery, useToast,
} from '../ui';
import { useShell, useTopBar } from '../shell/ShellContext';
import { buildNotifications } from '../shell/notifications';
import { normalizeStage, CALL_STATUSES } from '../shared/semantics';
import { relativeTime, fmtDate } from '../shared/dates';
import { money } from '../shared/format';
import { apiFetch } from '../shared/api';

/* Dashboard: what to do right now, then how the business is going.
 * Everything is computed from the call_leads list AdminApp already loads
 * plus the submissions list; the only fetch is the daily call target. */

const DAY = 864e5;
const CONTACTED = new Set(['callback', 'no-answer', 'no']);

function periods(now = new Date()) {
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(dayStart); weekStart.setDate(dayStart.getDate() - ((dayStart.getDay() + 6) % 7)); // Monday
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { now: now.getTime(), dayStart: +dayStart, weekStart: +weekStart, lastWeekStart: +lastWeekStart, monthStart: +monthStart, lastMonthStart: +lastMonthStart };
}

/** Every number on the page, from the leads list. Formulas in reports/PROMPT-05-REPORT.md section 3. */
export function computeDashboard(leads, subs, orders, P = periods()) {
  const s = {
    callsToday: 0, callsWeek: 0, callsLastWeek: 0, callsMonth: 0, callsLastMonth: 0,
    logMonth: 0, logMonthConnected: 0, logLastMonth: 0, logLastMonthConnected: 0,
    notCalled: 0, booked: 0, callbacks: 0, newLeads48h: 0,
    funnel: { leads: 0, contacted: 0, booked: 0, clients: 0 },
    revenue: 0, revenueMonth: 0, retainerClients: 0, clients: 0, mrr: 0,
  };
  const events = [];
  const bump = (t) => {
    if (!t) return;
    if (t >= P.dayStart) s.callsToday++;
    if (t >= P.weekStart) s.callsWeek++; else if (t >= P.lastWeekStart) s.callsLastWeek++;
    if (t >= P.monthStart) s.callsMonth++; else if (t >= P.lastMonthStart) s.callsLastMonth++;
  };
  for (const l of leads) {
    const stage = normalizeStage(l);
    const created = new Date(l.createdAt || 0).getTime();
    for (const e of (l.callLog || [])) {
      const t = new Date(e.at).getTime();
      bump(t);
      if (t >= P.monthStart) { s.logMonth++; if (e.outcome !== 'no-answer') s.logMonthConnected++; }
      else if (t >= P.lastMonthStart) { s.logLastMonth++; if (e.outcome !== 'no-answer') s.logLastMonthConnected++; }
      if (t) events.push({ id: `call:${l._id}:${e.at}`, kind: 'call', at: t, lead: l, outcome: e.outcome, title: `Called ${l.business}`, detail: e.note || '' });
    }
    for (const e of (l.contactLog || [])) if (e.type === 'call' || e.type === 'meeting') bump(new Date(e.at).getTime());
    if (stage !== 'lost') {
      s.funnel.leads++;
      if ((l.callLog || []).length > 0 || (l.callStatus && l.callStatus !== 'not-called')) s.funnel.contacted++;
      if (stage === 'booked' || stage === 'won' || stage === 'client') s.funnel.booked++;
      if (stage === 'won' || stage === 'client') s.funnel.clients++;
    }
    if (stage === 'lead' && (l.callStatus || 'not-called') === 'not-called') s.notCalled++;
    if (stage === 'booked') s.booked++;
    if (l.callStatus === 'callback' && stage !== 'lost') s.callbacks++;
    if (created >= P.now - 2 * DAY) s.newLeads48h++;
    for (const p of (l.purchases || [])) {
      const amt = Number(p.amount) || 0;
      s.revenue += amt;
      const t = new Date(p.at).getTime();
      if (t && t >= P.monthStart) s.revenueMonth += amt;
      if (t) events.push({ id: `buy:${l._id}:${p.at}:${p.label}`, kind: 'purchase', at: t, lead: l, title: `${l.business} paid ${money(amt)}`, detail: p.label || 'Purchase recorded' });
    }
    // Prompt 10: the retainer field replaces the label regex. Active and ending retainers count; paused and cancelled do not.
    const onRetainer = stage === 'client' && ['active', 'ending'].includes(l.retainer?.status);
    if (stage === 'client') { s.clients++; if (onRetainer) { s.retainerClients++; s.mrr += Number(l.retainer.amount) || 0; } }
    if (l.bookedOutcome?.result === 'won' && l.bookedOutcome.at) events.push({ id: `won:${l._id}`, kind: 'won', at: new Date(l.bookedOutcome.at).getTime(), lead: l, title: `${l.business} said yes`, detail: 'Lead won' });
    if (l.clientSince) events.push({ id: `client:${l._id}`, kind: 'client', at: new Date(l.clientSince).getTime(), lead: l, title: `${l.business} became a client`, detail: 'First invoice paid' });
    if (created) events.push({ id: `new:${l._id}`, kind: l.sourceId ? 'scraper' : 'lead', at: created, lead: l, title: `New lead: ${l.business}`, detail: [l.industry, l.area].filter(Boolean).join(', ') || 'Added by hand' });
  }
  for (const it of [...(subs || []), ...(orders || [])]) {
    const t = new Date(it.createdAt).getTime();
    if (t) events.push({ id: `sub:${it._id}`, kind: it.type === 'shop-order' ? 'order' : 'submission', at: t, item: it, title: `${it.type === 'shop-order' ? 'Order' : 'Brief'} from ${it.business || it.name || 'the site'}`, detail: it.type === 'shop-order' ? 'Shop order received' : 'Submission received' });
  }
  events.sort((a, b) => b.at - a.at);
  // Consecutive scraper inserts collapse into one row.
  const feed = [];
  for (const e of events) {
    const last = feed[feed.length - 1];
    if (e.kind === 'scraper' && last?.kind === 'scraper' && last.at - e.at < 12 * 3600e3) { last.count++; last.at = Math.max(last.at, e.at); last.title = `${last.count} new leads added overnight`; last.detail = 'From the nightly scraper'; continue; }
    feed.push(e.kind === 'scraper' ? { ...e, count: 1, title: `New lead: ${e.lead.business}`, detail: 'From the nightly scraper' } : { ...e });
    if (feed.length >= 20) break;
  }
  s.connectRate = s.logMonth ? Math.round((s.logMonthConnected / s.logMonth) * 100) : null;
  s.connectRateLast = s.logLastMonth ? Math.round((s.logLastMonthConnected / s.logLastMonth) * 100) : null;
  s.feed = feed;
  return s;
}

const greetingFor = (h) => (h < 12 ? 'Good morning, Rob.' : h < 17 ? 'Good afternoon, Rob.' : 'Good evening, Rob.');
const trendOf = (cur, prev, label) => (prev == null ? undefined : { value: `${cur - prev >= 0 ? '+' : ''}${cur - prev} vs ${label}`, direction: cur > prev ? 'up' : cur < prev ? 'down' : 'flat' });
const EVENT_TONE = { call: 'progress', purchase: 'won', won: 'won', client: 'booked', lead: 'new', scraper: 'new', submission: 'callback', order: 'callback' };
const EVENT_ICON = { call: 'PhoneCall01', purchase: 'CurrencyDollar', won: 'Trophy01', client: 'Briefcase01', lead: 'Users01', scraper: 'Users01', submission: 'Inbox01', order: 'Package' };

function DashboardSkeleton({ desktop }) {
  const left = (
    <Stack gap={5}>
      <Stack gap={2}><SkeletonBlock width="60%" height={44} /><SkeletonBlock width="45%" height={16} /><Row gap={2}><SkeletonBlock width={180} height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={120} height={44} radius="var(--v-radius-md)" /></Row></Stack>
      <div className="db-funnel">{[1, 2, 3, 4].map(i => <Card.Skeleton key={i} lines={2} height={92} className="db-step" />)}</div>
      <Grid minColumnWidth={120}>{Array.from({ length: 8 }, (_, i) => <StatCard.Skeleton key={i} trend={i < 3 || i === 7} />)}</Grid>
      <Card><SkeletonBlock width={90} height={14} /><Grid minColumnWidth={150}>{[1, 2, 3, 4].map(i => <StatCard.Skeleton key={i} />)}</Grid></Card>
    </Stack>
  );
  const right = (
    <Stack gap={5}>
      <Card><Row gap={4}><SkeletonCircle size={88} /><Stack gap={2} style={{ flex: 1 }}><SkeletonBlock width="70%" height={14} /><SkeletonBlock width="50%" height={12} /></Stack></Row><Stack gap={2}>{[1, 2, 3].map(i => <ListRow.Skeleton key={i} trailing={false} />)}</Stack></Card>
      <Card><SkeletonBlock width={120} height={14} /><Stack gap={2}>{[1, 2, 3, 4, 5].map(i => <ListRow.Skeleton key={i} trailing={false} />)}</Stack></Card>
    </Stack>
  );
  if (desktop) return <div className="db-layout">{left}{right}</div>;
  return (
    <Stack gap={5}>
      <Stack gap={2}><SkeletonBlock width="80%" height={40} /><SkeletonBlock width="60%" height={16} /><SkeletonBlock height={44} radius="var(--v-radius-md)" /></Stack>
      <div className="db-funnel">{[1, 2, 3, 4].map(i => <Card.Skeleton key={i} lines={2} height={92} className="db-step" />)}</div>
      {right}
      <Grid minColumnWidth={120}>{Array.from({ length: 8 }, (_, i) => <StatCard.Skeleton key={i} trend={i < 3} />)}</Grid>
      <Card><SkeletonText lines={1} width={90} /><Grid minColumnWidth={150}>{[1, 2, 3, 4].map(i => <StatCard.Skeleton key={i} />)}</Grid></Card>
    </Stack>
  );
}

export default function AdminDashboard({ leads, projects = [], loading, subs, orders, onOpenSubmission }) {
  const shell = useShell();
  const toast = useToast();
  const desktop = useMediaQuery('(min-width: 1024px)');
  useTopBar(null);
  const showSkel = useDelayedLoading(loading);
  const [target, setTarget] = useState(25);
  useEffect(() => { apiFetch('/api/admin/settings').then(r => { if (r.ok && r.data?.dashboard?.dailyCallTarget) setTarget(r.data.dashboard.dailyCallTarget); }); }, []);
  const saveTarget = async (v) => {
    const n = Math.max(1, Math.min(500, Math.round(Number(v)) || 0));
    if (!n) return false;
    const r = await apiFetch('/api/admin/settings', { method: 'PATCH', body: { set: { dailyCallTarget: n } } });
    if (r.ok) { setTarget(n); toast.success(`Daily target is now ${n} calls.`); }
    return r.ok;
  };

  const s = useMemo(() => computeDashboard(leads || [], subs, orders), [leads, subs, orders]);
  const notes = useMemo(() => buildNotifications(leads || [], { projects }), [leads, projects]);
  const today = useMemo(() => {
    const cbs = notes.filter(n => n.kind === 'callback').sort((a, b) => (a.tone === 'danger' ? -1 : 1) - (b.tone === 'danger' ? -1 : 1) || a.at - b.at);
    const mts = notes.filter(n => n.kind === 'meeting' && n.group === 'today');
    const nw = notes.filter(n => n.kind === 'new').slice(0, 5);
    return [...cbs, ...mts, ...nw];
  }, [notes]);

  const hour = new Date().getHours();
  const dateLine = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const mtToday = notes.filter(n => n.kind === 'meeting' && n.group === 'today').length;
  const context = s.callbacks > 0 ? `${s.callbacks} callback${s.callbacks === 1 ? '' : 's'} due`
    : mtToday > 0 ? `${mtToday} meeting${mtToday === 1 ? '' : 's'} today`
    : s.newLeads48h > 0 ? `${s.newLeads48h} new lead${s.newLeads48h === 1 ? '' : 's'} since yesterday`
    : 'Queue is clear. Good day to dial.';

  if (showSkel || (loading && !(leads || []).length)) {
    return (
      <main className="aa-main aa-main--wide lay-scroll db-page" aria-busy="true">
        <div className="lay-content lay-content--wide"><DashboardSkeleton desktop={desktop} /></div>
        <style>{dbStyles}</style>
      </main>
    );
  }

  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : null);
  const funnel = [
    { id: 'leads', label: 'Leads', n: s.funnel.leads, tone: 'neutral', go: () => shell.go('leads', {}) },
    { id: 'contacted', label: 'Contacted', n: s.funnel.contacted, tone: 'progress', pct: pct(s.funnel.contacted, s.funnel.leads), go: () => shell.go('leads', { status: [...CONTACTED] }) },
    { id: 'booked', label: 'Booked', n: s.funnel.booked, tone: 'booked', pct: pct(s.funnel.booked, s.funnel.contacted), go: () => shell.go('booked') },
    { id: 'clients', label: 'Clients', n: s.funnel.clients, tone: 'won', pct: pct(s.funnel.clients, s.funnel.booked), go: () => shell.go('clients') },
  ];
  const stats = [
    { icon: 'PhoneCall01', tone: 'progress', value: s.callsToday, label: 'Calls today', go: () => shell.go('calls') },
    { icon: 'PhoneCall01', tone: 'progress', value: s.callsWeek, label: 'Calls this week', trend: trendOf(s.callsWeek, s.callsLastWeek, 'last week'), go: () => shell.go('calls') },
    { icon: 'PhoneCall01', tone: 'progress', value: s.callsMonth, label: 'Calls this month', trend: trendOf(s.callsMonth, s.callsLastMonth, 'last month'), go: () => shell.go('calls') },
    { icon: 'Users01', tone: 'new', value: s.notCalled, label: 'Not yet called', go: () => shell.go('leads', { status: ['not-called'] }) },
    { icon: 'CalendarCheck01', tone: 'booked', value: s.booked, label: 'Booked', go: () => shell.go('booked') },
    { icon: 'PhoneIncoming01', tone: 'callback', value: s.callbacks, label: 'Callbacks pending', go: () => shell.go('calls', { status: ['callback'] }) },
    { icon: 'Zap', tone: 'new', value: s.newLeads48h, label: 'New leads 48h', go: () => shell.go('leads', {}) },
    { icon: 'Check', tone: 'booked', value: s.connectRate == null ? 'n/a' : `${s.connectRate}%`, label: 'Connect rate this month',
      trend: s.connectRate != null && s.connectRateLast != null ? { value: `${s.connectRate - s.connectRateLast >= 0 ? '+' : ''}${s.connectRate - s.connectRateLast} pts vs last month`, direction: s.connectRate > s.connectRateLast ? 'up' : s.connectRate < s.connectRateLast ? 'down' : 'flat' } : undefined,
      go: () => shell.go('calls') },
  ];
  const ringPct = target ? Math.min(100, Math.round((s.callsToday / target) * 100)) : 0;

  const header = (
    <div className="db-head">
      <Stack gap={1}>
        <h2 className="db-greet">{greetingFor(hour)}</h2>
        <p className="db-context">{dateLine}. {context}</p>
      </Stack>
      <Row gap={2} wrap className="db-head-actions">
        <Button icon={PhoneCall01} onClick={() => shell.go('calls')}>Start call session</Button>
        <Button variant="secondary" icon={Plus} onClick={() => shell.newLead({})}>Add lead</Button>
      </Row>
    </div>
  );
  const strip = (
    <div className="db-funnel" role="group" aria-label="Pipeline">
      {funnel.map((f, i) => (
        <Card key={f.id} level={1} padding={3} interactive glow={f.tone} onClick={f.go} className="db-step" aria-label={`${f.label}: ${f.n}`}>
          {i > 0 && f.pct && <span className="db-step-pct" title="Conversion from the previous step">{f.pct}</span>}
          <span className="db-step-n">{f.n}</span>
          <span className="db-step-label">{f.label}</span>
        </Card>
      ))}
    </div>
  );
  const statGrid = (
    <Grid minColumnWidth={120}>
      {stats.map(c => <StatCard key={c.label} icon={c.icon} tone={c.tone} value={c.value} label={c.label} trend={c.trend} onClick={c.go} />)}
    </Grid>
  );
  const todayPanel = (
    <Card className="db-today">
      <Section title="Today" description={`${s.callsToday} of ${target} calls`} action={<Button variant="ghost" icon="Calendar" onClick={() => shell.go('calendar')}>Open calendar</Button>}>
        <Row gap={4} align="center">
          <ProgressRing value={ringPct} size={88} thickness={8} tone={ringPct >= 100 ? 'booked' : 'won'} label="Calls today against target">
            <span style={{ fontSize: 'var(--v-text-2xl)' }}>{s.callsToday}</span>
          </ProgressRing>
          <Stack gap={0}>
            <Row gap={1} align="baseline"><span className="db-target-label">Daily target</span><InlineEdit value={String(target)} onSave={saveTarget} type="number" inputMode="numeric" label="Daily call target" format={(v) => `${v} calls`} /></Row>
            <span className="db-target-sub">{ringPct >= 100 ? 'Target hit. Keep the streak.' : `${Math.max(0, target - s.callsToday)} to go`}</span>
          </Stack>
        </Row>
        {today.length ? (
          <Stack gap={2}>
            {today.map(item => (
              <ListRow key={item.id} leading={<IconTile icon={item.icon} tone={item.tone} size="sm" />} title={item.title} subtitle={item.detail} meta={relativeTime(item.at)} onClick={() => shell.openRecord(item.lead)} chevron={false} />
            ))}
          </Stack>
        ) : (
          <EmptyState size="sm" icon={PhoneCall01} title="All caught up" description="Start a call session." action={{ label: 'Start call session', icon: PhoneCall01, onClick: () => shell.go('calls') }} />
        )}
      </Section>
    </Card>
  );
  const revenue = (
    <Card>
      <Section title="Revenue" description={s.retainerClients || s.clients ? `${s.retainerClients} of ${s.clients} client${s.clients === 1 ? '' : 's'} on retainer` : undefined}>
        <Grid minColumnWidth={150}>
          <StatCard icon="CurrencyDollar" tone="won" value={money(s.revenue)} label="Money made all time" onClick={() => shell.go('clients')} />
          <StatCard icon="CurrencyDollar" tone="won" value={money(s.revenueMonth)} label="This month" onClick={() => shell.go('clients')} />
          <StatCard icon="RefreshCw01" tone="booked" value={money(s.mrr)} label="Monthly recurring" onClick={() => shell.go('clients')} />
          <StatCard icon="Briefcase01" tone="booked" value={`${s.retainerClients} of ${s.clients}`} label="Clients on retainer" onClick={() => shell.go('clients')} />
        </Grid>
      </Section>
    </Card>
  );
  const activity = (
    <Card>
      <Section title="Recent activity" action={<Button variant="ghost" iconEnd={ArrowUpRight} onClick={() => shell.go('submissions')}>Open submissions</Button>}>
        {s.feed.length ? (
          <Stack gap={2}>
            {s.feed.map(e => (
              <ListRow key={e.id} leading={<IconTile icon={EVENT_ICON[e.kind]} tone={EVENT_TONE[e.kind]} size="sm" glow={false} />} title={e.title} subtitle={e.detail || undefined} meta={relativeTime(e.at)} chevron={false}
                trailing={e.kind === 'call' && e.outcome ? <Pill id={e.outcome} list={CALL_STATUSES} size="sm" /> : undefined}
                onClick={e.lead ? () => shell.openRecord(e.lead) : e.item ? () => onOpenSubmission?.(e.item) : undefined} />
            ))}
          </Stack>
        ) : (
          <p className="db-empty">Nothing yet. New calls, briefs, and orders show up here the moment they land.</p>
        )}
      </Section>
    </Card>
  );

  return (
    <main className="aa-main aa-main--wide lay-scroll db-page">
      <div className="lay-content lay-content--wide">
        {desktop ? (
          <div className="db-layout">
            <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>{header}{strip}{statGrid}{revenue}</Stagger>
            <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>{todayPanel}{activity}</Stagger>
          </div>
        ) : (
          <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>{header}{strip}{todayPanel}{statGrid}{revenue}{activity}</Stagger>
        )}
      </div>
      <style>{dbStyles}</style>
    </main>
  );
}

const dbStyles = `
  .db-page { --v-stack-gap: var(--v-space-5); --v-content-w-wide: 1160px; }
  .db-page .lay-content--wide { max-width: var(--v-content-w-wide); }
  .db-layout { display: grid; grid-template-columns: minmax(0, 1fr) var(--v-panel-w); gap: var(--v-space-5); align-items: start; min-width: 0; }
  @media (min-width: 1280px) { .db-layout { grid-template-columns: minmax(0, 1fr) 360px; } }
  .db-layout > * { min-width: 0; }
  .db-head { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; }
  @media (min-width: 1280px) { .db-head { flex-direction: row; align-items: flex-start; justify-content: space-between; } }
  .db-greet { margin: 0; font-family: var(--v-font-display); font-size: var(--v-display-md); line-height: var(--v-lh-display-md); letter-spacing: var(--v-ls-display-md); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); }
  @media (max-width: 1279px) { .db-greet { font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); letter-spacing: var(--v-ls-display-sm); } }
  .db-context { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .db-head-actions { flex-shrink: 0; }
  @media (max-width: 767px) { .db-head-actions > .v-btn { flex: 1 1 45%; } }
  .db-funnel { display: flex; gap: var(--v-space-2); overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; min-width: 0; padding: 2px; margin: -2px; }
  .db-funnel::-webkit-scrollbar { display: none; }
  .db-step { flex: 1 0 150px; min-height: 92px; gap: var(--v-space-1); justify-content: flex-end; }
  .db-step:first-child { position: sticky; left: 0; z-index: 1; box-shadow: 0 0 0 1px var(--v-border), 12px 0 16px -12px var(--v-ground); }
  @media (min-width: 768px) { .db-step { flex-basis: 0; } .db-step:first-child { position: static; box-shadow: none; } }
  .db-step-n { font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); letter-spacing: var(--v-ls-display-sm); font-weight: var(--v-weight-bold); color: var(--v-text); font-variant-numeric: tabular-nums; }
  .db-step-label { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-3); }
  .db-step-pct { position: absolute; top: var(--v-space-3); right: var(--v-space-3); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); font-weight: var(--v-weight-bold); color: var(--v-text-3); background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-pill); padding: 2px 8px; font-variant-numeric: tabular-nums; }
  .db-target-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .db-target-sub { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .db-today .v-inline { font-size: var(--v-text-md); font-weight: var(--v-weight-bold); }
  .db-empty { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
`;
