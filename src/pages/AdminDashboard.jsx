import { useMemo, useRef, useState } from 'react';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import {
  PageShell, ScrollArea, Stack, Row, Card, StatCard, IconTile, IconButton, Pill, EmptyState, ErrorState, Button, Menu, Sheet, Input, Stagger, SkeletonBlock, useDelayedLoading, useMediaQuery, useRetry, useToast, Icon,
} from '../ui';
import { COPY } from '../shared/copy';
import { useShell, useTopBar } from '../shell/ShellContext';
import { useSelection, useScreenOrigin, useRestore } from '../shell/nav-history';
import { normalizeStage } from '../shared/semantics';
import { fmtDateTime, fmtWeekdayDateTime, toMs, dayKey } from '../shared/dates';
import { money } from '../shared/format';
import { telHref } from '../shared/phone';
import { nextUpItems } from '../lib/nextAction';
import { buildEvents } from '../lib/events';
import { isStalled } from '../lib/deal';
import { invoicesOf, invoiceStatus } from '../lib/invoices';
import { openLists, isFull, listCount } from '../lib/lists';
import LeadDetail from '../components/LeadDetail';
import { RescheduleSheet } from '../components/record/MeetingSection';
import TaskSheet from '../components/TaskSheet';
import { isTask, fmtTaskDue } from '../lib/tasks';

/* Next up (CRM revamp, step 2; flat since the no folds pass): the one list
 * of what to do, first. Every lead and project carries its next action
 * (src/lib/nextAction.js); this screen lays them out as six open sections
 * with no fold anywhere: Overdue, Today, This week (grouped by day), Later
 * (dated, then undated custom actions), Meetings (the Calendar's own event
 * source, src/lib/events.js) and Lists ready (open dial lists at target).
 * Each action row keeps its one control, its menu and the phone's swipes:
 * right is done, left snoozes a day, a long press picks the snooze. On a
 * desktop the queue is the left panel and the tapped record opens beside
 * it. Four stat tiles sit under the greeting, always visible. */

const DAY = 864e5;

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
const timeOf = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
/* UI simplification, part B: the due time shows, never a relative time beside it; an overdue row from another day names the day. */
const dueLabel = (item, now = Date.now()) => (item.bucket === 'today' || (item.bucket === 'overdue' && dayKey(item.due) === dayKey(now)) ? timeOf(item.due) : item.bucket === 'overdue' ? new Date(item.due).toLocaleDateString([], { month: 'short', day: 'numeric' }) : new Date(item.due).toLocaleDateString([], { weekday: 'short' }) + ' ' + timeOf(item.due));
const at9 = (d) => { const x = new Date(d); x.setHours(9, 0, 0, 0); return x; };
const SNOOZES = [
  { id: 'tomorrow', label: 'Tomorrow 9am', at: (now) => at9(now + DAY) },
  { id: 'three', label: 'In 3 days', at: (now) => at9(now + 3 * DAY) },
  { id: 'week', label: 'Next week', at: (now) => at9(now + 7 * DAY) },
];

/* The row count follows the data, so the skeleton reads the last known
   count from localStorage (written on every loaded render). */

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

function NextRow({ item, phone, now, onOpen, onAct, onDone, onSnooze, onPick, onEditTask }) {
  const { action, lead } = item;
  const swipe = useSwipe({ enabled: phone, onRight: onDone, onLeft: onSnooze, onHold: onPick });
  const kind = action.kind;
  const primary = kind === 'call' || kind === 'callback'
    ? (lead.phone ? { icon: 'Phone', label: `Call ${lead.business}`, href: telHref(lead.phone) } : { icon: 'Phone', label: `Open ${lead.business}, no phone on file` })
    : kind === 'log-outcome' ? { icon: 'CheckCircle', label: `Log the outcome for ${lead.business}` }
    : kind === 'build-concepts' ? { icon: 'LayersThree01', label: `Build concepts for ${lead.business}` }
    : kind === 'chase-invoice' ? { icon: 'CurrencyDollar', label: `Open payments for ${lead.business}` }
    : kind === 'custom' && action.label === 'Move to nurture?' ? { icon: 'Clock', label: `Move ${lead.business} to nurture` }
    : { icon: 'ArrowRight', label: `Open ${lead.business}` };
  const menu = [
    { id: 'done', label: 'Done', icon: 'Check', onSelect: onDone },
    { id: 'snooze', label: 'Snooze a day', icon: 'Clock', onSelect: onSnooze },
    { id: 'pick', label: 'Snooze until', icon: 'Calendar', onSelect: onPick },
    ...(isTask(action) && onEditTask ? [{ id: 'edit', label: 'Edit task', icon: 'Edit02', onSelect: onEditTask }] : []),
    'divider',
    { id: 'open', label: 'Open the record', icon: 'ArrowRight', onSelect: onOpen },
  ];
  return (
    <div className={`nu-swipe${swipe.dx ? ' is-moving' : ''}`}>
      <span className={`nu-hint nu-hint--done${swipe.dx > 72 ? ' is-armed' : ''}`} aria-hidden="true"><Icon icon="Check" size={16} /> Done</span>
      <span className={`nu-hint nu-hint--snooze${swipe.dx < -72 ? ' is-armed' : ''}`} aria-hidden="true"><Icon icon="Clock" size={16} /> Snooze</span>
      <Card as="div" padding={3} interactive data-row-id={item.lead?._id} className={`nu-row lay-card${item.bucket === 'overdue' ? ' is-overdue' : ''}`} style={swipe.dx ? { transform: `translate3d(${swipe.dx}px, 0, 0)`, transition: 'none' } : undefined} {...swipe.handlers}>
        <button type="button" className="v-stretch" onClick={onOpen} aria-label={`Open ${lead.business}, ${action.label}`}>{`Open ${lead.business}`}</button>
        <Row gap={3} align="center" wrap={false} style={{ minWidth: 0 }}>
          <IconTile icon={item.icon} tone={item.tone} size="sm" />
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <span className="nu-biz lay-truncate">{lead.business}</span>
            <span className="nu-what lay-truncate">{action.label}{item.project ? `, ${item.project.name}` : ''}</span>
            <Row gap={2} align="center" wrap>
              {item.bucket === 'overdue' && <Pill tone="danger" label="Overdue" size="sm" icon={false} variant="solid" />}
              <span className="nu-due">{isTask(action) && action.dueAt ? fmtTaskDue(action.dueAt, now) : dueLabel(item, now)}</span>
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

const DAY_LABEL = (t) => { const d = new Date(t); return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}`; };
const MEETING_TYPE = { call: 'call', video: 'video', 'in-person': 'in person' };

/* A meeting row: the business, the day and time and the type, Reschedule in the menu. The same events the Calendar reads. */
function MeetingRow({ e, onOpen, onReschedule }) {
  const items = [
    ...(e.kind === 'meeting' ? [{ id: 're', label: 'Reschedule', icon: 'Calendar', onSelect: onReschedule }] : []),
    ...(e.link ? [{ id: 'join', label: 'Join link', icon: 'ArrowRight', onSelect: () => window.open(e.link, '_blank', 'noopener') }] : []),
    { id: 'open', label: 'Open the record', icon: 'ArrowRight', onSelect: onOpen },
  ];
  const type = e.kind === 'calendly' ? 'calendly' : MEETING_TYPE[e.lead?.meeting?.type] || 'call';
  return (
    <Card as="div" padding={3} interactive className="nu-row nu-row--meet lay-card">
      <button type="button" className="v-stretch" onClick={onOpen} aria-label={`Open ${e.lead.business}, meeting ${fmtWeekdayDateTime(e.at)}`}>{`Open ${e.lead.business}`}</button>
      <Row gap={3} align="center" wrap={false} style={{ minWidth: 0 }}>
        <IconTile icon="CalendarCheck01" tone="booked" size="sm" />
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <span className="nu-biz lay-truncate">{e.lead.business}</span>
          <span className="nu-what lay-truncate">{fmtWeekdayDateTime(e.at)} · {type}</span>
        </Stack>
        <span className="v-above nu-ctl"><Menu label={`${e.lead.business} meeting actions`} items={items} /></span>
      </Row>
    </Card>
  );
}

/* A full dial list: its count against the target and Start. */
function ListReadyRow({ list, onStart, onOpen }) {
  return (
    <Card as="div" padding={3} className="nu-row nu-row--list lay-card">
      <Row gap={3} align="center" wrap={false} style={{ minWidth: 0 }}>
        <IconTile icon="Rows01" tone="booked" size="sm" />
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          <span className="nu-biz lay-truncate">{list.name}</span>
          <span className="nu-what lay-truncate">{listCount(list)} of {list.target}, ready to start</span>
        </Stack>
        <span className="nu-ctl">
          <Button size="md" icon="Play" onClick={onStart} className="nu-start">Start</Button>
          <Menu label={`${list.name} actions`} items={[{ id: 'open', label: 'Open the list', icon: 'ArrowRight', onSelect: onOpen }]} />
        </span>
      </Row>
    </Card>
  );
}

/* The six sections, every one open, an empty one a single line. */
function NextUpList({ q, meetings, lists, phone, now, act, onReschedule, onStartList, onOpenLists }) {
  const rows = (items) => items.map(it => <NextRow key={it.id} item={it} phone={phone} now={now} onOpen={() => act('open', it)} onAct={() => act('act', it)} onDone={() => act('done', it)} onSnooze={() => act('snooze', it)} onPick={() => act('pick', it)} onEditTask={() => act('edittask', it)} />);
  const line = (text) => <p className="nu-clear" role="status">{text}</p>;
  const section = (id, label, tone, count, body) => (
    <section key={id} className="nu-sec" aria-label={label}>
      <Row gap={2} align="center" className="nu-sec-head"><span className={`nu-group nu-group--${tone}`}>{label}</span>{count > 0 && <span className="nu-count">{count}</span>}</Row>
      {body}
    </section>
  );
  const days = [];
  for (const it of q.later) { const k = dayKey(new Date(it.due)); let d = days.find(x => x.key === k); if (!d) { d = { key: k, label: DAY_LABEL(it.due), items: [] }; days.push(d); } d.items.push(it); }
  const later = [...q.beyond, ...q.undated];
  /* Nothing to do and nothing booked: one empty state instead of five clear lines; a full list still shows under it. */
  const nothing = !q.all.length && !later.length && !meetings.length;
  const listsSec = section('lists', 'Lists ready', 'neutral', lists.length, lists.length ? <Stack gap={2}>{lists.map(l => <ListReadyRow key={l._id} list={l} onStart={() => onStartList(l)} onOpen={onOpenLists} />)}</Stack> : line('No list is full yet.'));
  if (nothing) return <Stack gap={5} className="nu-list"><Card className="nu-empty"><EmptyState size="sm" icon="CheckCircle" title={COPY.empty['dashboard.next'].title} description={COPY.empty['dashboard.next'].description} action={{ label: COPY.empty['dashboard.next'].action, icon: 'PhoneCall01', onClick: () => act('calls') }} /></Card>{lists.length > 0 && listsSec}</Stack>;
  return (
    <Stack gap={5} className="nu-list">
      {section('overdue', 'Overdue', 'danger', q.overdue.length, q.overdue.length ? <Stack gap={2}>{rows(q.overdue)}</Stack> : line('Nothing overdue.'))}
      {section('today', 'Today', 'today', q.today.length, q.today.length ? <Stack gap={2}>{rows(q.today)}</Stack> : line('Nothing due today.'))}
      {section('week', 'This week', 'neutral', q.later.length, days.length ? <Stack gap={3}>{days.map(d => <Stack key={d.key} gap={2}><span className="nu-day">{d.label}</span>{rows(d.items)}</Stack>)}</Stack> : line('Nothing else this week.'))}
      {section('later', 'Later', 'neutral', later.length, later.length ? <Stack gap={2}>{rows(later)}</Stack> : line('Nothing later.'))}
      {section('meetings', 'Meetings', 'neutral', meetings.length, meetings.length ? <Stack gap={2}>{meetings.map(e => <MeetingRow key={e.id} e={e} onOpen={() => act('meeting', e)} onReschedule={() => onReschedule(e)} />)}</Stack> : line('No meetings booked.'))}
      {listsSec}
    </Stack>
  );
}

/* The six sections at fixed counts (3, 3, 4, 2, 2, 1): an action row at its real lines (the name 22, the action 21, then a pill 22 when overdue or the time 19), a meeting row and a list row at theirs. */
const SKEL_SECTIONS = [['Overdue', 4, 'act'], ['Today', 3, 'act'], ['This week', 4, 'act'], ['Later', 2, 'act'], ['Meetings', 2, 'meet'], ['Lists ready', 1, 'list']];
function NextUpSkeleton() {
  const actRow = (i, overdue) => <Card key={i} as="div" padding={3}><Row gap={3} align="center"><SkeletonBlock width={32} height={32} radius="var(--v-radius-md)" /><Stack gap={0} style={{ flex: 1 }}><SkeletonBlock width="55%" height={22} /><SkeletonBlock width="40%" height={20} /><SkeletonBlock width="30%" height={overdue ? 22 : 19} /></Stack><Row gap={1}><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row></Row></Card>;
  const twoLine = (i, wide) => <Card key={i} as="div" padding={3}><Row gap={3} align="center"><SkeletonBlock width={32} height={32} radius="var(--v-radius-md)" /><Stack gap={0} style={{ flex: 1 }}><SkeletonBlock width="55%" height={22} /><SkeletonBlock width="45%" height={19} /></Stack><Row gap={1}>{wide ? <SkeletonBlock width={76} height={44} radius="var(--v-radius-md)" /> : <SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" />}<SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row></Row></Card>;
  return (
    <Stack gap={5} aria-busy="true" aria-hidden="true">
      {SKEL_SECTIONS.map(([label, n, kind], si) => (
        <Stack gap={2} key={label}>
          <Row gap={2} align="center" className="nu-sec-head"><SkeletonBlock width={label.length * 8} height={14} /><SkeletonBlock width={24} height={21} radius="var(--v-radius-pill)" /></Row>
          {kind === 'act' && label === 'This week' && <SkeletonBlock width={80} height={16} />}
          {Array.from({ length: n }, (_, i) => (kind === 'act' ? actRow(i, si === 0) : twoLine(i, kind === 'list')))}
        </Stack>
      ))}
    </Stack>
  );
}

export default function AdminDashboard({ leads, projects = [], sets = [], loading, error, onRetry, subs, orders, onPatchLead, onPatchProject, onCreateProject, onOpenLead, submissions = [], onLinkSubmission }) {
  const shell = useShell();
  const toast = useToast();
  const [retry, retrying] = useRetry(onRetry);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const phone = useMediaQuery('(max-width: 767px)');
  const showSkel = useDelayedLoading(loading);
  /* Back (done once): the record beside the queue rides on the history entry. */
  const { selId, entry: openEntry, open: openSel, close } = useSelection('dashboard');
  const intent = openEntry?.intent || null;
  const [resched, setResched] = useState(null); // the meeting event a reschedule sheet is open for
  const [pick, setPick] = useState(null); // the item a snooze picker is open for
  const [taskEdit, setTaskEdit] = useState(null); // the item an Edit task sheet is open for
  const [pickDate, setPickDate] = useState('');
  const now = Date.now();
  const sel = selId ? (leads || []).find(l => String(l._id) === String(selId)) || null : null;
  useTopBar(null);
  useScreenOrigin(() => ({ selectedId: selId }));
  useRestore(() => {});

  const s = useMemo(() => computeDashboard(leads || [], subs, orders), [leads, subs, orders]);
  const q = useMemo(() => nextUpItems(leads || [], projects, sets, now), [leads, projects, sets]); // eslint-disable-line react-hooks/exhaustive-deps
  const calendlyEvents = shell?.calendly?.events; const shellPosts = shell?.posts; const shellLists = shell?.lists;
  const meetings = useMemo(() => { const start = new Date(now); start.setHours(0, 0, 0, 0); return buildEvents(leads || [], calendlyEvents || [], now, projects, shellPosts || []).filter(e => e.lead && (e.kind === 'meeting' || e.kind === 'calendly') && e.at >= start.getTime()); }, [leads, projects, calendlyEvents, shellPosts, now]);
  const listsReady = useMemo(() => openLists(shellLists || []).filter(isFull), [shellLists]);

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
    if (desktop) openSel(item.lead._id, { intent: why ? { kind: why, n: Date.now() } : null });
    else onOpenLead(item.lead, why);
  };
  const act = async (what, item) => {
    if (what === 'calls') { shell.go('calls'); return; }
    if (what === 'open') { openRecord(item); return; }
    if (what === 'meeting') { openRecord({ lead: item.lead }, 'meeting'); return; }
    if (what === 'act') {
      const k = item.action.kind;
      if (k === 'build-concepts' && shell?.openConcepts) shell.openConcepts(item.lead);
      else if (k === 'log-outcome') openRecord(item, 'outcome');
      else if (k === 'chase-invoice') openRecord(item, 'payments');
      /* The stalled deal rule (CRM revamp, step 7) asks; the answer parks the deal for ninety days. */
      else if (k === 'custom' && item.action.label === 'Move to nurture?' && !item.project) { const ok = await onPatchLead(item.lead._id, { stage: 'nurture', nurture: { until: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), reason: 'Stalled deal' }, nextAction: null, listId: '' }); if (ok) toast.success(`${item.lead.business} is in nurture for 90 days.`); else toast.error(COPY.error.save); }
      else if ((k === 'call' || k === 'callback') && item.lead.phone) window.location.href = telHref(item.lead.phone);
      else openRecord(item);
      return;
    }
    if (what === 'edittask') { setTaskEdit(item); return; }
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
    const body = (
      <Stack gap={5}>
        <div className="db-head"><Stack gap={1}><h2 className="db-greet">{greetingFor(hour, name)}</h2><SkeletonBlock width={260} height={22} /></Stack><Row gap={2} wrap className="db-head-actions"><SkeletonBlock width={desktop ? 164 : 175} height={44} radius="var(--v-radius-md)" /><SkeletonBlock width={desktop ? 112 : 175} height={44} radius="var(--v-radius-md)" /></Row></div>
        <div className="db-tiles" aria-busy="true" aria-hidden="true">{[0, 1, 2, 3].map(i => <Card key={i} className="v-stat db-tile db-tile--skel" as="div"><span className="v-tile db-tile-skel"><SkeletonBlock width={40} height={40} radius="var(--v-radius-md)" /></span><div className="v-stat-body"><SkeletonBlock width={48} height={26} style={{ marginBottom: 2 }} /><SkeletonBlock width="80%" height={16} /></div></Card>)}</div>
        {!desktop && <div className="db-next"><NextUpSkeleton /></div>}
      </Stack>
    );
    return desktop ? (
      <>
        <aside className="aa-panel db-panel" aria-label="Next up"><div className="db-panel-head">{showSkel && <><SkeletonBlock width={60} height={14} /><SkeletonBlock width={24} height={21} radius="var(--v-radius-pill)" /></>}</div><ScrollArea bare className="db-panel-scroll">{showSkel && <NextUpSkeleton />}</ScrollArea></aside>
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

  /* The four tiles (no folds pass): calls today, callbacks pending, deals stalled, the money due this week. */
  const weekEnd = now + 7 * DAY;
  const stalled = (leads || []).filter(l => { const st = normalizeStage(l); return (st === 'booked' || st === 'deal') && isStalled(l); }).length;
  const dueWeek = (projects || []).filter(p => !p.archived).reduce((sum, p) => sum + invoicesOf(p).reduce((n, inv) => { const st = invoiceStatus(inv, now); if (st === 'paid' || st === 'draft' || !inv.dueAt) return n; const t = new Date(`${inv.dueAt}T12:00:00`).getTime(); return t <= weekEnd ? n + (Number(inv.amount) || 0) : n; }, 0), 0);
  const tiles = [
    { icon: 'PhoneCall01', tone: 'progress', value: s.callsToday, label: 'Calls today', go: () => shell.go('calls') },
    { icon: 'PhoneIncoming01', tone: 'callback', value: s.callbacks, label: 'Callbacks pending', go: () => shell.go('calls', { status: ['callback'] }) },
    { icon: 'Zap', tone: stalled ? 'danger' : 'neutral', value: stalled, label: 'Deals stalled', go: () => shell.go('deals') },
    { icon: 'CurrencyDollar', tone: 'won', value: money(dueWeek), label: 'Due this week', go: () => shell.go('projects') },
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
  const statsBlock = <div className="db-tiles" role="group" aria-label="Today in numbers">{tiles.map(c => <StatCard key={c.label} icon={c.icon} tone={c.tone} value={c.value} label={c.label} onClick={c.go} className="db-tile" />)}</div>;
  const list = <NextUpList q={q} meetings={meetings} lists={listsReady} phone={phone} now={now} act={act} onReschedule={setResched} onStartList={(l) => shell.go('calls', { listId: String(l._id) })} onOpenLists={() => shell.go('lists')} />;
  const taskSheet = taskEdit && <TaskSheet business={taskEdit.lead.business} task={taskEdit.action} onClose={() => setTaskEdit(null)} onSave={(na) => writeAction(taskEdit, na)} onDone={() => writeAction(taskEdit, { ...taskEdit.action, doneAt: new Date().toISOString() })} />;
  const reschedSheet = resched && <RescheduleSheet lead={resched.lead} onClose={() => setResched(null)} onSave={async (m) => { const l = resched.lead; const ok = await onPatchLead(l._id, { meeting: { date: '', time: '', type: 'call', location: '', ...(l.meeting || {}), ...m } }); if (ok) { setResched(null); toast.success('Meeting updated.'); } else toast.error(COPY.error.save); }} />;
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
            <LeadDetail key={sel._id} lead={sel} submissions={submissions} onPatch={onPatchLead} onLinkSubmission={onLinkSubmission} onClose={close} client={clientProps} intent={intent} />
          </PageShell>
        ) : (
          <div className="aa-main aa-main--wide lay-scroll db-page">
            <div className="lay-content lay-content--wide">
              <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>{header}{statsBlock}</Stagger>
            </div>
          </div>
        )}
        {picker}
        {reschedSheet}{taskSheet}
        <style>{dbStyles}</style>
      </>
    );
  }
  return (
    <div className="aa-main aa-main--wide lay-scroll db-page">
      <div className="lay-content lay-content--wide">
        <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>
          {header}
          {statsBlock}
          <div className="db-next">{list}</div>
        </Stagger>
      </div>
      {picker}
      {reschedSheet}{taskSheet}
      <style>{dbStyles}</style>
    </div>
  );
}

const dbStyles = `
  /* The skeleton tile is the height of a loaded one on a phone (icon, number, label, and the room for a two line label). */
  @media (max-width: 767px) { .db-tile--skel { min-height: 94px; } }
  .db-page { --v-stack-gap: var(--v-space-5); --v-content-w-wide: 1160px; }
  .db-page .lay-content--wide { max-width: var(--v-content-w-wide); }
  /* The queue keeps its own width: the shared panel token narrowed to 280 for the record's list panels (UI simplification, part A), and a queue row needs the room for its two controls. */
  .db-panel { gap: var(--v-space-3); }
  @media (min-width: 768px) { .aa-panel.db-panel { width: 380px; } }
  .db-panel-head { display: flex; align-items: center; gap: var(--v-space-2); padding: 0 var(--v-space-1); }
  .db-panel-scroll { padding: 2px; }
  .db-head { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; }
  /* The greeting keeps a whole line: the actions sit beside it only when there is room for both (1440 up), under it otherwise. */
  @media (min-width: 1440px) { .db-head { flex-direction: row; align-items: flex-start; justify-content: space-between; } }
  .db-greet { margin: 0; font-family: var(--v-font-display); font-size: var(--v-display-md); line-height: var(--v-lh-display-md); letter-spacing: var(--v-ls-display-md); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); }
  @media (max-width: 1279px) { .db-greet { font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); letter-spacing: var(--v-ls-display-sm); } }
  .db-context { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .db-head-actions { flex-shrink: 0; }
  @media (max-width: 767px) { .db-head-actions > .v-btn { flex: 1 1 45%; } }
  /* Four small tiles in one row, always visible. */
  .db-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--v-space-2); min-width: 0; }
  .db-tiles .v-stat { min-height: 0; padding: var(--v-space-3); gap: var(--v-space-2); }
  .db-tiles .v-stat-value { font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); }
  .db-tiles .v-stat-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); }
  .db-tiles .v-stat-label { overflow-wrap: normal; word-break: normal; }
  @media (max-width: 479px) { .db-tiles .v-tile { display: none; } .db-tiles .v-stat { padding: var(--v-space-2); } .db-tiles .v-stat-value { font-size: var(--v-text-lg); line-height: var(--v-lh-lg); letter-spacing: var(--v-ls-lg); white-space: nowrap; } }
  /* Next up rows */
  .nu-group { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .nu-group--danger { color: var(--v-status-danger-text); }
  .nu-count { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-3); background: var(--v-surface-3); border-radius: var(--v-radius-pill); padding: 1px 8px; }
  .nu-clear { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-2); }
  .db-tile-skel { display: inline-flex; background: none; border: 0; box-shadow: none; }
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
  .nu-due { font-size: var(--v-text-xs); color: var(--v-text-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nu-ctl { display: inline-flex; align-items: center; gap: var(--v-space-1); flex-shrink: 0; }
  /* The six sections: every one open, a day label inside This week, one line when empty. */
  .nu-sec { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .nu-sec-head { min-height: 21px; }
  .nu-day { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-2); }
  .nu-row--list { gap: 0; }
  .nu-start { flex-shrink: 0; }
`;
