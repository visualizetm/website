import { useEffect, useMemo, useRef, useState } from 'react';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import {
  PageShell, ScrollArea, Stack, Row, Grid, Section, Card, StatCard, IconTile, IconButton, Pill, EmptyState, ErrorState, Button, Menu, Sheet, Input,
  Stagger, SkeletonBlock, SkeletonText, ListRow, useDelayedLoading, useMediaQuery, useRetry, useToast,
  Icon, Collapsible,
} from '../ui';
import { COPY } from '../shared/copy';
import { CONTACTED_STATUSES } from '../lib/leads';
import { useShell, useTopBar } from '../shell/ShellContext';
import { normalizeStage } from '../shared/semantics';
import { fmtDateTime, relativeTime, toMs, dayKey } from '../shared/dates';
import { money } from '../shared/format';
import { telHref } from '../shared/phone';
import { nextUpItems } from '../lib/nextAction';
import LeadDetail from '../components/LeadDetail';

/* Next up (CRM revamp, step 2): the one list of what to do, first. Every
 * lead and project carries its next action (src/lib/nextAction.js); this
 * screen lays them out overdue first, then today, then the next seven days
 * folded under Later this week, each row with the one control that does
 * the thing. Swipe right on a phone marks it done, swipe left snoozes it a
 * day, a long press picks the snooze. On a desktop the queue is the left
 * panel and the tapped record opens beside it. The greeting and the
 * numbers stay, the numbers folded under Stats. */

const DAY = 864e5;
const CONTACTED = new Set(CONTACTED_STATUSES);

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
    }
    for (const e of (l.contactLog || [])) if (e.type === 'call' || e.type === 'meeting') bump(new Date(e.at).getTime());
    if (stage !== 'lost' && stage !== 'declined' && stage !== 'triage') {
      s.funnel.leads++;
      if ((l.callLog || []).length > 0 || (l.callStatus && l.callStatus !== 'not-called')) s.funnel.contacted++;
      if (stage === 'booked' || stage === 'deal' || stage === 'won' || stage === 'client') s.funnel.booked++;
      if (stage === 'won' || stage === 'client') s.funnel.clients++;
    }
    if (stage === 'lead' && (l.callStatus || 'not-called') === 'not-called') s.notCalled++;
    if (stage === 'booked') s.booked++;
    if (l.callStatus === 'callback' && stage !== 'lost' && stage !== 'declined') s.callbacks++;
    if (created >= P.now - 2 * DAY) s.newLeads48h++;
    for (const p of (l.purchases || [])) {
      const amt = Number(p.amount) || 0;
      s.revenue += amt;
      const t = toMs(p.at);
      if (t && t >= P.monthStart) s.revenueMonth += amt;
    }
    const onRetainer = stage === 'client' && ['active', 'ending'].includes(l.retainer?.status);
    if (stage === 'client') { s.clients++; if (onRetainer) { s.retainerClients++; s.mrr += Number(l.retainer.amount) || 0; } }
  }
  s.connectRate = s.logMonth ? Math.round((s.logMonthConnected / s.logMonth) * 100) : null;
  s.connectRateLast = s.logLastMonth ? Math.round((s.logLastMonthConnected / s.logLastMonth) * 100) : null;
  return s;
}

const greetingFor = (h, name = 'Rob') => (h < 12 ? `Good morning, ${name}.` : h < 17 ? `Good afternoon, ${name}.` : `Good evening, ${name}.`);
const inHours = (bh, d = new Date()) => { if (!bh?.start || !bh?.end) return true; const m = d.getHours() * 60 + d.getMinutes(); const [a, b] = [bh.start, bh.end].map(t => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm; }); return m >= a && m < b; };
const trendOf = (cur, prev, label) => (prev == null ? undefined : { value: `${cur - prev >= 0 ? '+' : ''}${cur - prev} vs ${label}`, direction: cur > prev ? 'up' : cur < prev ? 'down' : 'flat' });
const timeOf = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dueLabel = (item, now = Date.now()) => (item.bucket === 'overdue' ? relativeTime(item.due, now) : item.bucket === 'today' ? timeOf(item.due) : new Date(item.due).toLocaleDateString([], { weekday: 'short' }) + ' ' + timeOf(item.due));
const at9 = (d) => { const x = new Date(d); x.setHours(9, 0, 0, 0); return x; };
const SNOOZES = [
  { id: 'tomorrow', label: 'Tomorrow 9am', at: (now) => at9(now + DAY) },
  { id: 'three', label: 'In 3 days', at: (now) => at9(now + 3 * DAY) },
  { id: 'week', label: 'Next week', at: (now) => at9(now + 7 * DAY) },
];

/* The row count follows the data, so the skeleton reads the last known
   count from localStorage (written on every loaded render). */
const NEXT_KEY = 'vz_dash_next';
const readNextCounts = () => { try { const [o, t] = String(localStorage.getItem(NEXT_KEY) || '').split(',').map(Number); return { overdue: Number.isFinite(o) && o >= 0 ? Math.min(o, 8) : 0, today: Number.isFinite(t) && t >= 0 ? Math.min(t, 8) : 3 }; } catch { return { overdue: 0, today: 3 }; } };

/* ── Swipe: right is done, left is snooze, a long press picks the snooze ── */
function useSwipe({ onRight, onLeft, onHold, enabled }) {
  const st = useRef(null);
  const [dx, setDx] = useState(0);
  const end = () => { const s = st.current; st.current = null; if (!s) return; clearTimeout(s.timer); };
  if (!enabled) return { dx: 0, handlers: {} };
  return {
    dx,
    handlers: {
      onTouchStart: (e) => { const t = e.touches[0]; st.current = { x: t.clientX, y: t.clientY, moved: false, timer: setTimeout(() => { if (st.current && !st.current.moved) { st.current = null; setDx(0); onHold?.(); } }, 550) }; },
      onTouchMove: (e) => { const s = st.current; if (!s) return; const t = e.touches[0]; const ddx = t.clientX - s.x; const ddy = t.clientY - s.y; if (!s.moved && Math.abs(ddy) > Math.abs(ddx)) { end(); setDx(0); return; } if (Math.abs(ddx) > 8) { s.moved = true; clearTimeout(s.timer); } setDx(Math.max(-120, Math.min(120, ddx))); },
      onTouchEnd: () => { const moved = st.current?.moved; end(); const d = dx; setDx(0); if (!moved) return; if (d > 72) onRight?.(); else if (d < -72) onLeft?.(); },
      onTouchCancel: () => { end(); setDx(0); },
    },
  };
}

function NextRow({ item, phone, now, onOpen, onAct, onDone, onSnooze, onPick }) {
  const { action, lead } = item;
  const swipe = useSwipe({ enabled: phone, onRight: onDone, onLeft: onSnooze, onHold: onPick });
  const kind = action.kind;
  const primary = kind === 'call' || kind === 'callback'
    ? (lead.phone ? { icon: 'Phone', label: `Call ${lead.business}`, href: telHref(lead.phone) } : { icon: 'Phone', label: `Open ${lead.business}, no phone on file` })
    : kind === 'log-outcome' ? { icon: 'CheckCircle', label: `Log the outcome for ${lead.business}` }
    : kind === 'build-concepts' ? { icon: 'LayersThree01', label: `Build concepts for ${lead.business}` }
    : kind === 'chase-invoice' ? { icon: 'CurrencyDollar', label: `Open payments for ${lead.business}` }
    : { icon: 'ArrowRight', label: `Open ${lead.business}` };
  const menu = [
    { id: 'done', label: 'Done', icon: 'Check', onSelect: onDone },
    { id: 'snooze', label: 'Snooze a day', icon: 'Clock', onSelect: onSnooze },
    { id: 'pick', label: 'Snooze until', icon: 'Calendar', onSelect: onPick },
    'divider',
    { id: 'open', label: 'Open the record', icon: 'ArrowRight', onSelect: onOpen },
  ];
  return (
    <div className={`nu-swipe${swipe.dx ? ' is-moving' : ''}`}>
      <span className={`nu-hint nu-hint--done${swipe.dx > 72 ? ' is-armed' : ''}`} aria-hidden="true"><Icon icon="Check" size={16} /> Done</span>
      <span className={`nu-hint nu-hint--snooze${swipe.dx < -72 ? ' is-armed' : ''}`} aria-hidden="true"><Icon icon="Clock" size={16} /> Snooze</span>
      <Card as="div" padding={3} interactive className={`nu-row lay-card${item.bucket === 'overdue' ? ' is-overdue' : ''}`} style={swipe.dx ? { transform: `translate3d(${swipe.dx}px, 0, 0)`, transition: 'none' } : undefined} {...swipe.handlers}>
        <button type="button" className="v-stretch" onClick={onOpen} aria-label={`Open ${lead.business}, ${action.label}`}>{`Open ${lead.business}`}</button>
        <Row gap={3} align="center" wrap={false} style={{ minWidth: 0 }}>
          <IconTile icon={item.icon} tone={item.tone} size="sm" />
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <span className="nu-biz lay-truncate">{lead.business}</span>
            <span className="nu-what lay-truncate">{action.label}{item.project ? `, ${item.project.name}` : ''}</span>
            <Row gap={2} align="center" wrap>
              {item.bucket === 'overdue' && <Pill tone="danger" label="Overdue" size="sm" icon={false} variant="solid" />}
              <span className="nu-due">{dueLabel(item, now)}</span>
            </Row>
          </Stack>
          <span className="v-above nu-ctl">
            <IconButton icon={primary.icon} label={primary.label} variant="secondary" onClick={primary.href ? () => { window.location.href = primary.href; } : onAct} />
            <Menu label={`${lead.business} actions`} items={menu} />
          </span>
        </Row>
      </Card>
    </div>
  );
}

function NextUpList({ q, phone, now, laterOpen, onLater, act, empty }) {
  const group = (label, items, tone) => (
    <Stack gap={2} key={label}>
      <Row gap={2} align="center"><span className={`nu-group nu-group--${tone}`}>{label}</span><span className="nu-count">{items.length}</span></Row>
      <Stack gap={2}>{items.map(it => <NextRow key={it.id} item={it} phone={phone} now={now} onOpen={() => act('open', it)} onAct={() => act('act', it)} onDone={() => act('done', it)} onSnooze={() => act('snooze', it)} onPick={() => act('pick', it)} />)}</Stack>
    </Stack>
  );
  if (!q.all.length) return <Card><EmptyState size="sm" icon="CheckCircle" title={empty.title} description={empty.description} action={{ label: empty.action, icon: PhoneCall01, onClick: () => act('calls') }} /></Card>;
  return (
    <Stack gap={4} className="nu-list">
      {q.overdue.length > 0 && group('Overdue', q.overdue, 'danger')}
      {q.today.length > 0 && group('Today', q.today, 'today')}
      {!q.overdue.length && !q.today.length && <p className="nu-clear" role="status">Nothing due today. {q.later.length} coming up this week.</p>}
      {q.later.length > 0 && (
        <Card padding={0} className="nu-later">
          <button type="button" className="nu-later-btn" onClick={onLater} aria-expanded={laterOpen} aria-controls="nu-later-body">
            <span className="nu-group">Later this week</span><span className="nu-count">{q.later.length}</span>
            <span style={{ flex: 1 }} /><span className={`db-chev${laterOpen ? ' is-open' : ''}`}><Icon icon="ChevronDown" size={16} /></span>
          </button>
          <Collapsible open={laterOpen}><div id="nu-later-body" className="nu-later-body"><Stack gap={2}>{q.later.map(it => <NextRow key={it.id} item={it} phone={phone} now={now} onOpen={() => act('open', it)} onAct={() => act('act', it)} onDone={() => act('done', it)} onSnooze={() => act('snooze', it)} onPick={() => act('pick', it)} />)}</Stack></div></Collapsible>
        </Card>
      )}
    </Stack>
  );
}

function NextUpSkeleton({ counts }) {
  const rowSkel = (i) => <Card key={i} as="div" padding={3}><Row gap={3} align="center"><SkeletonBlock width={32} height={32} radius="var(--v-radius-md)" /><Stack gap={0} style={{ flex: 1 }}><SkeletonBlock width="55%" height={18} /><SkeletonBlock width="40%" height={18} /><SkeletonBlock width="30%" height={22} /></Stack><Row gap={1}><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row></Row></Card>;
  const group = (n, key) => (n ? <Stack gap={2} key={key}><Row gap={2}><SkeletonBlock width={70} height={16} /><SkeletonBlock width={20} height={16} /></Row>{Array.from({ length: n }, (_, i) => rowSkel(i))}</Stack> : null);
  return <Stack gap={4} aria-busy="true">{group(counts.overdue, 'o')}{group(counts.today, 't')}</Stack>;
}

export default function AdminDashboard({ leads, projects = [], sets = [], loading, error, onRetry, subs, orders, onPatchLead, onPatchProject, onCreateProject, onOpenLead, submissions = [], onLinkSubmission }) {
  const shell = useShell();
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const phone = useMediaQuery('(max-width: 767px)');
  const wide = useMediaQuery('(min-width: 1280px)');
  const showSkel = useDelayedLoading(loading);
  const [selId, setSelId] = useState(null);
  const [intent, setIntent] = useState(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [pick, setPick] = useState(null); // the item a snooze picker is open for
  const [pickDate, setPickDate] = useState('');
  const now = Date.now();
  const sel = selId ? (leads || []).find(l => String(l._id) === String(selId)) || null : null;
  useTopBar(sel && !desktop ? { title: sel.business, back: () => setSelId(null) } : null);

  const s = useMemo(() => computeDashboard(leads || [], subs, orders), [leads, subs, orders]);
  const q = useMemo(() => nextUpItems(leads || [], projects, sets, now), [leads, projects, sets]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loading) { try { localStorage.setItem(NEXT_KEY, `${q.overdue.length},${q.today.length}`); } catch { /* private mode */ } } }, [loading, q.overdue.length, q.today.length]);

  const hour = new Date().getHours();
  const name = (shell?.profile?.name || 'Rob').split(' ')[0];
  const outside = !inHours(shell?.profile?.businessHours);
  const dateLine = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const context = q.overdue.length ? `${q.overdue.length} overdue, ${q.today.length} due today.`
    : q.today.length ? `${q.today.length} due today.`
    : s.newLeads48h > 0 ? `${s.newLeads48h} new lead${s.newLeads48h === 1 ? '' : 's'} since yesterday.`
    : outside ? 'Outside business hours. Plan tomorrow or prep concepts.' : 'Queue is clear. Good day to dial.';

  /* The writes: done stamps doneAt, a snooze moves dueAt and makes the
     action manual so the recompute leaves it be. Both optimistic through
     the shell's helpers, with a toast on failure. */
  const writeAction = async (item, next) => {
    const ok = item.project ? await onPatchProject(item.project._id, { nextAction: next }) : await onPatchLead(item.lead._id, { nextAction: next });
    if (!ok) toast.error(COPY.error.save);
    return ok;
  };
  const openRecord = (item, why) => {
    if (desktop) { setSelId(item.lead._id); setIntent(why ? { kind: why, n: Date.now() } : null); }
    else onOpenLead(item.lead, why);
  };
  const act = async (what, item) => {
    if (what === 'calls') { shell.go('calls'); return; }
    if (what === 'open') { openRecord(item); return; }
    if (what === 'act') {
      const k = item.action.kind;
      if (k === 'build-concepts' && shell?.openConcepts) shell.openConcepts(item.lead);
      else if (k === 'log-outcome') openRecord(item, 'outcome');
      else if (k === 'chase-invoice') openRecord(item, 'payments');
      else if ((k === 'call' || k === 'callback') && item.lead.phone) window.location.href = telHref(item.lead.phone);
      else openRecord(item);
      return;
    }
    if (what === 'done') {
      const ok = await writeAction(item, { ...item.action, doneAt: new Date().toISOString() });
      if (ok) toast.undo(`${item.action.label} done for ${item.lead.business}.`, () => writeAction(item, { ...item.action, doneAt: '' }), { seconds: 6 });
      return;
    }
    if (what === 'snooze') {
      const ok = await writeAction(item, { ...item.action, dueAt: new Date(Math.max(item.due, now) + DAY).toISOString(), auto: false });
      if (ok) toast.undo(`${item.lead.business} snoozed a day.`, () => writeAction(item, item.action), { seconds: 6 });
      return;
    }
    if (what === 'pick') { setPick(item); setPickDate(''); }
  };
  const snoozeUntil = async (when) => {
    if (!pick || !when) return;
    const item = pick; setPick(null);
    const ok = await writeAction(item, { ...item.action, dueAt: new Date(when).toISOString(), auto: false });
    if (ok) toast.undo(`${item.lead.business} snoozed until ${fmtDateTime(when)}.`, () => writeAction(item, item.action), { seconds: 6 });
  };

  if (loading) {
    const counts = readNextCounts(); const rows = counts.overdue + counts.today;
    const body = (
      <Stack gap={5}>
        <div className="db-head"><Stack gap={1}><SkeletonText lines={wide ? 2 : 1} lineHeight={phone ? 32 : 39} gap={1} width={phone ? '80%' : 300} /><SkeletonBlock width={260} height={22} /></Stack><Row gap={2} wrap className="db-head-actions"><SkeletonBlock width={164} height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={112} height={44} radius="var(--v-radius-md)" /></Row></div>
        {!desktop && <Card className="db-next"><Stack gap={3}><Stack gap={1}><SkeletonBlock width={60} height={14} /><SkeletonBlock width={180} height={18} /></Stack>{rows ? <NextUpSkeleton counts={counts} /> : <SkeletonBlock height={150} radius="var(--v-radius-md)" />}</Stack></Card>}
        <Card><Row gap={2} align="center" style={{ minHeight: 44 }}><SkeletonBlock width={50} height={14} /><SkeletonBlock width={200} height={14} /></Row></Card>
      </Stack>
    );
    return desktop ? (
      <>
        <aside className="aa-panel db-panel" aria-label="Next up"><div className="db-panel-head">{showSkel && <><SkeletonBlock width={60} height={14} /><SkeletonBlock width={24} height={16} radius="var(--v-radius-pill)" /></>}</div><ScrollArea bare className="db-panel-scroll">{showSkel && <NextUpSkeleton counts={rows ? counts : { overdue: 0, today: 3 }} />}</ScrollArea></aside>
        <div className="aa-main aa-main--wide lay-scroll db-page" aria-busy="true"><div className="lay-content lay-content--wide">{showSkel && body}</div><style>{dbStyles}</style></div>
      </>
    ) : (
      <div className="aa-main aa-main--wide lay-scroll db-page" aria-busy="true"><div className="lay-content lay-content--wide">{showSkel && body}</div><style>{dbStyles}</style></div>
    );
  }
  if (error && !(leads || []).length) {
    const err = <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>;
    return desktop ? (
      <>
        <aside className="aa-panel db-panel" aria-label="Next up"><ScrollArea bare className="db-panel-scroll">{err}</ScrollArea></aside>
        <div className="aa-main aa-main--wide lay-scroll db-page"><div className="lay-content lay-content--wide" /><style>{dbStyles}</style></div>
      </>
    ) : <div className="aa-main aa-main--wide lay-scroll db-page"><div className="lay-content lay-content--wide">{err}</div><style>{dbStyles}</style></div>;
  }

  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : null);
  const funnel = [
    { id: 'leads', label: 'Leads', n: s.funnel.leads, tone: 'neutral', go: () => shell.go('leads', {}) },
    { id: 'contacted', label: 'Contacted', n: s.funnel.contacted, tone: 'progress', pct: pct(s.funnel.contacted, s.funnel.leads), go: () => shell.go('leads', { status: [...CONTACTED] }) },
    { id: 'booked', label: 'Booked', n: s.funnel.booked, tone: 'booked', pct: pct(s.funnel.booked, s.funnel.contacted), go: () => shell.go('booked') },
    { id: 'clients', label: 'Clients', n: s.funnel.clients, tone: 'won', pct: pct(s.funnel.clients, s.funnel.booked), go: () => shell.go('clients') },
  ];
  const keyStats = [
    { icon: 'PhoneCall01', tone: 'progress', value: s.callsToday, label: 'Calls today', go: () => shell.go('calls') },
    { icon: 'PhoneIncoming01', tone: 'callback', value: s.callbacks, label: 'Callbacks pending', go: () => shell.go('calls', { status: ['callback'] }) },
    { icon: 'CalendarCheck01', tone: 'booked', value: s.booked, label: 'Booked', go: () => shell.go('booked') },
    { icon: 'Zap', tone: 'new', value: s.newLeads48h, label: 'New leads 48h', go: () => shell.go('leads', {}) },
  ];
  const moreStats = [
    { icon: 'PhoneCall01', tone: 'progress', value: s.callsWeek, label: 'Calls this week', trend: trendOf(s.callsWeek, s.callsLastWeek, 'last week'), go: () => shell.go('calls') },
    { icon: 'PhoneCall01', tone: 'progress', value: s.callsMonth, label: 'Calls this month', trend: trendOf(s.callsMonth, s.callsLastMonth, 'last month'), go: () => shell.go('calls') },
    { icon: 'Users01', tone: 'new', value: s.notCalled, label: 'Not yet called', go: () => shell.go('leads', { status: ['not-called'] }) },
    { icon: 'Check', tone: 'booked', value: s.connectRate == null ? 'n/a' : `${s.connectRate}%`, label: 'Connect rate this month',
      trend: s.connectRate != null && s.connectRateLast != null ? { value: `${s.connectRate - s.connectRateLast >= 0 ? '+' : ''}${s.connectRate - s.connectRateLast} pts vs last month`, direction: s.connectRate > s.connectRateLast ? 'up' : s.connectRate < s.connectRateLast ? 'down' : 'flat' } : undefined,
      go: () => shell.go('calls') },
  ];

  const header = (
    <div className="db-head">
      <Stack gap={1}>
        <h2 className="db-greet">{greetingFor(hour, name)}</h2>
        <p className="db-context">{dateLine}. {context}</p>
      </Stack>
      <Row gap={2} wrap className="db-head-actions">
        <Button icon={PhoneCall01} onClick={() => shell.go('calls')}>Start call session</Button>
        <Button variant="secondary" icon={Plus} onClick={() => shell.newLead({})}>Add lead</Button>
      </Row>
    </div>
  );
  const statsBlock = (
    <Card className="db-more db-stats">
      <button type="button" className="db-more-btn" onClick={() => setStatsOpen(m => !m)} aria-expanded={statsOpen} aria-controls="db-stats-body">
        <span className="pb-card-h" style={{ margin: 0 }}>Stats</span>
        <span className="db-more-sum">{statsOpen ? 'Hide' : `${s.callsToday} call${s.callsToday === 1 ? '' : 's'} today, ${s.funnel.leads} leads, ${s.funnel.clients} clients`}</span>
        <span className={`db-chev${statsOpen ? ' is-open' : ''}`}><Icon icon="ChevronDown" size={16} /></span>
      </button>
      <Collapsible open={statsOpen}>
        <div id="db-stats-body">
          <Stack gap={4}>
            <Grid minColumnWidth={120} className="db-key">
              {keyStats.map(c => <StatCard key={c.label} icon={c.icon} tone={c.tone} value={c.value} label={c.label} onClick={c.go} />)}
            </Grid>
            <div className="db-funnel" role="group" aria-label="Pipeline">
              {funnel.map((f, i) => (
                <Card key={f.id} level={1} padding={3} interactive glow={f.tone} onClick={f.go} className="db-step">
                  {i > 0 && f.pct && <span className="db-step-pct" title="Conversion from the previous step">{f.pct}</span>}
                  <span className="db-step-n">{f.n}</span>
                  <span className="db-step-label">{f.label}</span>
                </Card>
              ))}
            </div>
            <button type="button" className="db-more-btn" onClick={() => setMore(m => !m)} aria-expanded={more} aria-controls="db-more-body">
              <span className="pb-card-h" style={{ margin: 0 }}>More stats</span>
              <span className="db-more-sum">{more ? 'Hide' : 'Calls this week and month, connect rate, not yet called, revenue'}</span>
              <span className={`db-chev${more ? ' is-open' : ''}`}><Icon icon="ChevronDown" size={16} /></span>
            </button>
            <Collapsible open={more}>
              <div id="db-more-body">
                <Stack gap={4}>
                  <Grid minColumnWidth={120}>{moreStats.map(c => <StatCard key={c.label} icon={c.icon} tone={c.tone} value={c.value} label={c.label} trend={c.trend} onClick={c.go} />)}</Grid>
                  <Section title="Revenue" description={s.retainerClients || s.clients ? `${s.retainerClients} of ${s.clients} client${s.clients === 1 ? '' : 's'} on retainer` : undefined}>
                    <Grid minColumnWidth={150}>
                      <StatCard icon="CurrencyDollar" tone="won" value={money(s.revenue)} label="Money made all time" onClick={() => shell.go('clients')} />
                      <StatCard icon="CurrencyDollar" tone="won" value={money(s.revenueMonth)} label="This month" onClick={() => shell.go('clients')} />
                      <StatCard icon="RefreshCw01" tone="booked" value={money(s.mrr)} label="Monthly recurring" onClick={() => shell.go('clients')} />
                      <StatCard icon="Briefcase01" tone="booked" value={`${s.retainerClients} of ${s.clients}`} label="Clients on retainer" onClick={() => shell.go('clients')} />
                    </Grid>
                  </Section>
                </Stack>
              </div>
            </Collapsible>
          </Stack>
        </div>
      </Collapsible>
    </Card>
  );
  const E = COPY.empty['dashboard.next'];
  const list = <NextUpList q={q} phone={phone} now={now} laterOpen={laterOpen} onLater={() => setLaterOpen(v => !v)} act={act} empty={E} />;
  const picker = pick && (
    <Sheet open onClose={() => setPick(null)} title="Snooze until" description={`${pick.action.label}, ${pick.lead.business}`} label="Snooze until"
      footer={<Row gap={2} justify="end" wrap><Button variant="ghost" onClick={() => setPick(null)}>Cancel</Button><Button onClick={() => snoozeUntil(pickDate ? new Date(`${pickDate}T09:00`).getTime() : null)} disabled={!pickDate}>Snooze</Button></Row>}>
      <Stack gap={3}>
        <Stack gap={2}>{SNOOZES.map(o => <Button key={o.id} variant="secondary" full onClick={() => snoozeUntil(o.at(now).getTime())}>{o.label}</Button>)}</Stack>
        <Input label="Or pick a day (9am)" type="date" value={pickDate} min={dayKey(new Date())} onChange={(e) => setPickDate(e.target.value)} />
      </Stack>
    </Sheet>
  );

  if (desktop) {
    const clientProps = onCreateProject ? { projects, onCreateProject, onPatchProject } : null;
    return (
      <>
        <aside className="aa-panel db-panel" aria-label="Next up">
          <div className="db-panel-head"><span className="pb-card-h" style={{ margin: 0 }}>Next up</span><span className="nu-count">{q.overdue.length + q.today.length}</span></div>
          <ScrollArea bare className="db-panel-scroll">{list}</ScrollArea>
        </aside>
        {sel ? (
          <PageShell className="aa-main db-main" label="the record">
            <LeadDetail key={sel._id} lead={sel} submissions={submissions} onPatch={onPatchLead} onLinkSubmission={onLinkSubmission} onClose={() => setSelId(null)} client={clientProps} intent={intent} />
          </PageShell>
        ) : (
          <div className="aa-main aa-main--wide lay-scroll db-page">
            <div className="lay-content lay-content--wide">
              <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>{header}{statsBlock}</Stagger>
            </div>
          </div>
        )}
        {picker}
        <style>{dbStyles}</style>
      </>
    );
  }
  return (
    <div className="aa-main aa-main--wide lay-scroll db-page">
      <div className="lay-content lay-content--wide">
        <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>
          {header}
          <Card className="db-next"><Section title="Next up" description={q.all.length ? `${q.overdue.length} overdue, ${q.today.length} today, ${q.later.length} this week` : undefined}>{list}</Section></Card>
          {statsBlock}
        </Stagger>
      </div>
      {picker}
      <style>{dbStyles}</style>
    </div>
  );
}

const dbStyles = `
  .db-page { --v-stack-gap: var(--v-space-5); --v-content-w-wide: 1160px; }
  .db-page .lay-content--wide { max-width: var(--v-content-w-wide); }
  .db-panel { gap: var(--v-space-3); }
  .db-panel-head { display: flex; align-items: center; gap: var(--v-space-2); padding: 0 var(--v-space-1); }
  .db-panel-scroll { padding: 2px; }
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
  .db-more-btn { display: flex; align-items: center; gap: var(--v-space-2); width: 100%; min-height: 44px; padding: 0; background: none; border: 0; color: var(--v-text); cursor: pointer; text-align: left; font: inherit; }
  .db-more-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-sm); }
  .db-chev { display: inline-flex; transition: transform var(--v-dur-base) var(--v-ease-out); }
  .db-chev.is-open { transform: rotate(180deg); }
  .db-more-sum { flex: 1; min-width: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  /* Next up rows */
  .nu-group { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .nu-group--danger { color: var(--v-status-danger-text); }
  .nu-count { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-3); background: var(--v-surface-3); border-radius: var(--v-radius-pill); padding: 1px 8px; }
  .nu-clear { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-2); }
  .nu-swipe { position: relative; }
  .nu-hint { position: absolute; top: 0; bottom: 0; display: flex; align-items: center; gap: var(--v-space-1); padding: 0 var(--v-space-4); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); border-radius: var(--v-radius-lg); opacity: 0; transition: opacity var(--v-dur-fast) var(--v-ease-out); }
  .nu-swipe.is-moving .nu-hint { opacity: 0.6; }
  .nu-hint.is-armed { opacity: 1; }
  .nu-hint--done { left: 0; right: 40%; justify-content: flex-start; background: var(--v-status-booked-soft); color: var(--v-status-booked-text); }
  .nu-hint--snooze { right: 0; left: 40%; justify-content: flex-end; background: var(--v-status-callback-soft); color: var(--v-status-callback-text); }
  .nu-row { gap: 0; text-align: left; align-items: stretch; transition: transform var(--v-dur-base) var(--v-ease-out); touch-action: pan-y; }
  .nu-row.is-overdue { border-color: var(--v-status-danger-text); }
  .nu-row:has(> .v-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .nu-biz { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .nu-what { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .nu-due { font-size: var(--v-text-xs); color: var(--v-text-3); font-variant-numeric: tabular-nums; }
  .nu-ctl { display: inline-flex; align-items: center; gap: var(--v-space-1); flex-shrink: 0; }
  .nu-later { overflow: hidden; }
  .nu-later-btn { display: flex; align-items: center; gap: var(--v-space-2); width: 100%; min-height: 44px; padding: 0 var(--v-space-4); background: none; border: 0; color: var(--v-text); cursor: pointer; text-align: left; font: inherit; }
  .nu-later-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .nu-later-body { padding: 0 var(--v-space-3) var(--v-space-3); }
`;
