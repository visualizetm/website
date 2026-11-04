import { useMemo, useState } from 'react';
import {
  PageShell, ScrollArea, Stack, Row, Card, IconTile, TaskRow, Chip, NoResults, SkeletonCircle, EmptyState, ErrorState, Button, Menu, Sheet, Input, Stagger, SkeletonBlock, ProgressBar, useDelayedLoading, useMediaQuery, useRetry, useToast, useConfirm, Icon, CollapsiblePane,
} from '../ui';
import { COPY } from '../shared/copy';
import { emailTaskOf } from '../lib/compose';
import { useShell, useTopBar } from '../shell/ShellContext';
import { useSelection, useScreenOrigin, useRestore } from '../shell/nav-history';
import { fmtDateTime, fmtWeekdayDateTime, dayKey } from '../shared/dates';
import { telHref } from '../shared/phone';
import { nextUpItems } from '../lib/nextAction';
import { taskCounts } from '../shared/taskRules';
import { completePatch, pinPatch, unpinPatch, checklistsPatch } from '../lib/taskWrite';
import { patchTask } from '../shared/taskRules';
import { buildEvents } from '../lib/events';
import { openLists, isFull, listCount } from '../lib/lists';
import LeadDetail from '../components/LeadDetail';
import { RescheduleSheet } from '../components/record/MeetingSection';
import TaskSheet from '../components/TaskSheet';
import ListSearch from '../components/ListSearch';
import { rowView, filterItems, TASK_CHIPS } from '../lib/taskRows';
import { isTask, fmtTaskDue } from '../lib/tasks';

/* Tasks (the nav revamp, milestone 6: the Next up list moved here from the
 * home, which is Analytics now; CRM revamp, step 2; flat since the no folds
 * pass): the one list of what to do. Every lead and project carries its next action
 * (src/lib/nextAction.js); this screen lays them out as six open sections
 * with no fold anywhere: Overdue, Today, This week (grouped by day), Later
 * (dated, then undated custom actions), Meetings (the Calendar's own event
 * source, src/lib/events.js) and Lists ready (open dial lists at target).
 * Each action row keeps its one control, its menu and the phone's swipes:
 * right is done, left snoozes a day, a long press picks the snooze. On a
 * desktop the queue is the left panel and the tapped record opens beside
 * it; the greeting and the stat tiles went to Analytics and the Pipeline
 * dashboard. */

const DAY = 864e5;

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

function NextRow({ item, phone, now, onOpen, onAct, onDone, onSnooze, onPick, onEditTask, onPin, onAuto, onTasks, onSendEmail, onEditEmail }) {
  const { action, lead } = item;
  /* The task system: a client or a project with checklists shows how far it is; a task action gets Pin or Auto and the way into its Tasks screen. */
  const counts = item.record?.checklists?.length ? taskCounts(item.record) : null;
  const isTaskItem = !!action.taskId;
  const v = rowView(item, now);
  /* The email system (milestone 8), under the Drafts rule: a task written for a drafted or failed email previews it. Its one control opens the send sheet, where
     Rob reads it and taps Send now; nothing on this row sends. */
  const emailTask = v.email;
  const kind = action.kind;
  const primary = emailTask ? { icon: 'Mail01', label: v.primary.label, text: undefined, onClick: onSendEmail, className: 'nu-send' }
    : kind === 'call' || kind === 'callback'
    ? (lead.phone ? { icon: 'Phone', label: `Call ${lead.business}`, onClick: () => { window.location.href = telHref(lead.phone); } } : { icon: 'Phone', label: `Open ${lead.business}, no phone on file`, onClick: onAct })
    : kind === 'log-outcome' ? { icon: 'CheckCircle', label: `Log the outcome for ${lead.business}`, onClick: onAct }
    : kind === 'build-concepts' ? { icon: 'LayersThree01', label: `Build concepts for ${lead.business}`, onClick: onAct }
    : kind === 'chase-invoice' ? { icon: 'CurrencyDollar', label: `Open payments for ${lead.business}`, onClick: onAct }
    : kind === 'custom' && action.label === 'Move to nurture?' ? { icon: 'Clock', label: `Move ${lead.business} to nurture`, onClick: onAct }
    : { icon: 'ArrowRight', label: `Open ${lead.business}`, onClick: onAct };
  const menu = [
    ...(emailTask ? [{ id: 'send-email', label: 'Preview the email', icon: 'Mail01', onSelect: onSendEmail }, { id: 'edit-email', label: 'Edit email', icon: 'Edit02', onSelect: onEditEmail }] : []),
    { id: 'done', label: 'Done', icon: 'Check', onSelect: onDone },
    { id: 'snooze', label: 'Snooze a day', icon: 'Clock', onSelect: onSnooze },
    { id: 'pick', label: 'Snooze until', icon: 'Calendar', onSelect: onPick },
    ...(isTask(action) && !isTaskItem && onEditTask ? [{ id: 'edit', label: 'Edit task', icon: 'Edit02', onSelect: onEditTask }] : []),
    ...(isTaskItem ? [action.auto === false ? { id: 'auto', label: 'Auto (unpin)', icon: 'Zap', onSelect: onAuto } : { id: 'pin', label: 'Pin as Next up', icon: 'Pin01', onSelect: onPin }] : []),
    ...((counts || isTaskItem) && onTasks ? [{ id: 'tasks', label: 'Open tasks', icon: 'CheckDone01', onSelect: onTasks }] : []),
    'divider',
    { id: 'open', label: 'Open the record', icon: 'ArrowRight', onSelect: onOpen },
  ];
  /* One rule per row (homeRowAction): a call or a callback never writes done, it opens the record at its outcome; a rule action opens its record. */
  const check = v.check === 'outcome' ? () => onOpen('outcome') : v.check === 'open' ? onAct : onDone;
  return (
    <TaskRow as="div" variant="card" data-row-id={item.lead?._id} className="nu-row" title={v.title} biz={lead.business}
      when={isTask(action) && action.dueAt ? fmtTaskDue(action.dueAt, now) : dueLabel(item, now)} whenTone={v.overdue ? 'late' : ''} overdue={v.overdue}
      kind={v.kind} openLabel={`Open ${lead.business}, ${action.label}`} onOpen={() => onOpen()}
      check={{ label: v.checkLabel, onClick: check }} actions={[primary]} menu={menu}
      swipe={{ done: check, snooze: onSnooze, hold: onPick }} swipeEnabled={phone}
      extra={counts ? <ProgressBar value={counts.pct} size="sm" tone={counts.done === counts.total ? 'booked' : 'progress'} className="nu-bar" aria-label={`${counts.done} of ${counts.total} tasks done`} /> : (isTaskItem && v.pinned ? <span className="nu-pin" title="Pinned as Next up"><Icon icon="Pin01" size={12} /><span className="v-sr-only">Pinned.</span></span> : null)} />
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

/* The sections (prompt 3 of 3): Overdue, Today and Coming up with the same rows as Home, then the Meetings and the full lists. The chips (Calls, Emails, Money,
   Tasks) and the client search narrow the rows; a section with nothing is one line. */
function NextUpList({ q, chip, query, meetings, lists, phone, now, act, onReschedule, onStartList, onOpenLists }) {
  const rows = (items) => items.map(it => <NextRow key={it.id} item={it} phone={phone} now={now} onOpen={(why) => act('open', it, why)} onAct={() => act('act', it)} onDone={() => act('done', it)} onSnooze={() => act('snooze', it)} onPick={() => act('pick', it)} onEditTask={() => act('edittask', it)} onPin={() => act('pin', it)} onAuto={() => act('auto', it)} onTasks={() => act('tasks', it)} onSendEmail={() => act('sendemail', it)} onEditEmail={() => act('editemail', it)} />);
  const line = (text) => <p className="nu-clear" role="status">{text}</p>;
  const section = (id, label, tone, count, body) => (
    <section key={id} className="nu-sec" aria-label={label}>
      <Row gap={2} align="center" className="nu-sec-head"><span className={`nu-group nu-group--${tone}`}>{label}</span>{count > 0 && <span className="nu-count">{count}</span>}</Row>
      {body}
    </section>
  );
  const f = (items) => filterItems(items, chip, query);
  const overdue = f(q.overdue); const today = f(q.today); const dated = f(q.later); const rest = f([...q.beyond, ...q.undated]);
  const days = [];
  for (const it of dated) { const k = dayKey(new Date(it.due)); let d = days.find(x => x.key === k); if (!d) { d = { key: k, label: DAY_LABEL(it.due), items: [] }; days.push(d); } d.items.push(it); }
  const comingN = dated.length + rest.length;
  const filtered = chip !== 'all' || !!query.trim();
  const total = q.all.length + q.beyond.length + q.undated.length;
  /* Nothing to do and nothing booked: one empty state instead of five clear lines; a full list still shows under it. */
  const nothing = !total && !meetings.length;
  const listsSec = section('lists', 'Lists ready', 'neutral', lists.length, lists.length ? <Stack gap={2}>{lists.map(l => <ListReadyRow key={l._id} list={l} onStart={() => onStartList(l)} onOpen={onOpenLists} />)}</Stack> : line('No list is full yet.'));
  if (nothing) return <Stack gap={5} className="nu-list"><Card className="nu-empty"><EmptyState size="sm" icon="CheckCircle" title={COPY.empty['dashboard.next'].title} description={COPY.empty['dashboard.next'].description} action={{ label: COPY.empty['dashboard.next'].action, onClick: () => act('calls') }} /></Card>{listsSec}</Stack>;
  if (filtered && !overdue.length && !today.length && !comingN) return <Stack gap={5} className="nu-list"><Card><NoResults noun="tasks" query={query} filters={chip !== 'all' ? [TASK_CHIPS.find(c => c.id === chip)?.label] : []} onClear={() => act('clear')} /></Card></Stack>;
  return (
    <Stack gap={5} className="nu-list">
      {section('overdue', 'Overdue', 'danger', overdue.length, overdue.length ? <Stack gap={2}>{rows(overdue)}</Stack> : line('Nothing overdue.'))}
      {section('today', 'Today', 'today', today.length, today.length ? <Stack gap={2}>{rows(today)}</Stack> : line('Nothing due today.'))}
      {section('coming', 'Coming up', 'neutral', comingN, comingN ? <Stack gap={3}>{days.map(d => <Stack key={d.key} gap={2}><span className="nu-day">{d.label}</span>{rows(d.items)}</Stack>)}{rest.length > 0 && <Stack gap={2}><span className="nu-day">Later or no date</span>{rows(rest)}</Stack>}</Stack> : line('Nothing coming up.'))}
      {!filtered && section('meetings', 'Meetings', 'neutral', meetings.length, meetings.length ? <Stack gap={2}>{meetings.map(e => <MeetingRow key={e.id} e={e} onOpen={() => act('meeting', e)} onReschedule={() => onReschedule(e)} />)}</Stack> : line('No meetings coming up.'))}
      {!filtered && listsSec}
    </Stack>
  );
}

/* The six sections at fixed counts (5, 3, 1, 0, 2, 1): an action row at its real lines (the name 22, the action 21, then a pill 22 when overdue or the time 19,
   and the 8px progress bar on a client's or a project's row, here the fourth overdue row, the first of today and the week's one), an empty section's one line,
   a meeting row and a list row at theirs. */
const SKEL_SECTIONS = [['Overdue', 5, 'act', [3]], ['Today', 3, 'act', [0]], ['Coming up', 1, 'act', [0]], ['Meetings', 2, 'meet'], ['Lists ready', 1, 'list']];
function NextUpSkeleton() {
  const actRow = (i, overdue, bar) => <div key={i} className="tr-row tr-row--card"><div className="tr-inner"><SkeletonCircle size={26} /><div className="tr-body"><SkeletonBlock width="55%" height={24} /><SkeletonBlock width="40%" height={20} /><SkeletonBlock width="30%" height={overdue ? 22 : 19} />{bar && <SkeletonBlock width={220} height={4} radius="var(--v-radius-pill)" className="nu-bar" />}</div><SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></div></div>;
  const twoLine = (i, wide) => <Card key={i} as="div" padding={3}><Row gap={3} align="center"><SkeletonBlock width={32} height={32} radius="var(--v-radius-md)" /><Stack gap={0} style={{ flex: 1 }}><SkeletonBlock width="55%" height={22} /><SkeletonBlock width="45%" height={19} /></Stack><Row gap={1}>{wide ? <SkeletonBlock width={76} height={44} radius="var(--v-radius-md)" /> : <SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" />}<SkeletonBlock width={44} height={44} radius="var(--v-radius-md)" /></Row></Row></Card>;
  return (
    <Stack gap={5} aria-busy="true" aria-hidden="true">
      {/* The search and the chips the loaded page opens with (prompt 3 of 3): same wrappers, same heights. */}
      <Stack gap={2} className="nu-filters"><SkeletonBlock height={44} radius="var(--v-radius-md)" /><Row gap={2} wrap>{TASK_CHIPS.map(c => <SkeletonBlock key={c.id} width={c.label.length * 8 + 40} height={44} radius="var(--v-radius-pill)" />)}</Row></Stack>
      {SKEL_SECTIONS.map(([label, n, kind, bars = []], si) => (
        <Stack gap={2} key={label}>
          <Row gap={2} align="center" className="nu-sec-head"><SkeletonBlock width={label.length * 8} height={14} />{n > 0 && <SkeletonBlock width={24} height={21} radius="var(--v-radius-pill)" />}</Row>
          {kind === 'act' && label === 'Coming up' && <SkeletonBlock width={80} height={16} />}
          {n === 0 && <p className="nu-clear"><SkeletonBlock width={96} height={14} style={{ margin: '3px 0' }} /></p>}
          {Array.from({ length: n }, (_, i) => (kind === 'act' ? actRow(i, si === 0, bars.includes(i)) : twoLine(i, kind === 'list')))}
        </Stack>
      ))}
    </Stack>
  );
}

export default function AdminTasksHome({ leads, projects = [], sets = [], loading, error, onRetry, onPatchLead, onPatchProject, onCreateProject, onOpenLead, submissions = [], onLinkSubmission }) {
  const shell = useShell();
  const toast = useToast();
  const [, confirmEl] = useConfirm();
  const [retry, retrying] = useRetry(onRetry);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const phone = useMediaQuery('(max-width: 767px)');
  const showSkel = useDelayedLoading(loading);
  /* Back (done once): the record beside the queue rides on the history entry. */
  const { selId, entry: openEntry, open: openSel, close } = useSelection('tasksAll');
  const intent = openEntry?.intent || null;
  const [resched, setResched] = useState(null); // the meeting event a reschedule sheet is open for
  const [pick, setPick] = useState(null); // the item a snooze picker is open for
  const [taskEdit, setTaskEdit] = useState(null); // the item an Edit task sheet is open for
  const [pickDate, setPickDate] = useState('');
  const [chip, setChip] = useState('all'); // Calls, Emails, Money, Tasks (src/lib/taskRows.js)
  const [query, setQuery] = useState(''); // a client's name
  const now = Date.now();
  const sel = selId ? (leads || []).find(l => String(l._id) === String(selId)) || null : null;
  useTopBar(null);
  useScreenOrigin(() => ({ selectedId: selId }));
  useRestore(() => {});

  const q = useMemo(() => nextUpItems(leads || [], projects, sets, now), [leads, projects, sets]); // eslint-disable-line react-hooks/exhaustive-deps
  const calendlyEvents = shell?.calendly?.events; const shellPosts = shell?.posts; const shellLists = shell?.lists;
  const meetings = useMemo(() => { const start = new Date(now); start.setHours(0, 0, 0, 0); return buildEvents(leads || [], calendlyEvents || [], now, projects, shellPosts || []).filter(e => e.lead && (e.kind === 'meeting' || e.kind === 'calendly') && e.at >= start.getTime()); }, [leads, projects, calendlyEvents, shellPosts, now]);
  const listsReady = useMemo(() => openLists(shellLists || []).filter(isFull), [shellLists]);

  /* The collapsed queue (CollapsiblePane): one avatar per record in the queue, in queue order, each once. */
  const railItems = useMemo(() => { const seen = new Set(); const out = []; for (const it of [...q.overdue, ...q.today, ...q.later, ...q.beyond, ...q.undated]) { const id = String(it.lead._id); if (seen.has(id)) continue; seen.add(id); out.push({ id, name: it.lead.business, selected: String(selId) === id, onOpen: () => openRecord(it) }); } return out; }, [q, selId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The writes: done stamps doneAt, a snooze moves dueAt and makes the
     action manual so the recompute leaves it be. Both optimistic through
     the shell's helpers, with a toast on failure. */
  const writeAction = async (item, next) => {
    const ok = item.project ? await onPatchProject(item.project._id, { nextAction: next }) : await onPatchLead(item.lead._id, { nextAction: next });
    if (!ok) toast.error(COPY.error.save);
    return ok;
  };
  /* The task system: a task action writes the task (the checklist), never the next action by hand; the rule recomputes from it. */
  const taskCtx = { projects, sets };
  const writeRecord = async (item, set) => {
    const ok = item.project ? await onPatchProject(item.project._id, set) : await onPatchLead(item.lead._id, set);
    if (!ok) toast.error(COPY.error.save);
    return ok;
  };
  const moveTask = (item, iso) => writeRecord(item, checklistsPatch(item.record, patchTask(item.record.checklists || [], item.action.taskId, { due: iso, notifiedAt: '' }), taskCtx));
  const taskDue = (item) => (item.record.checklists || []).flatMap(l => l.items || []).find(t => t.id === item.action.taskId)?.due || '';
  const openRecord = (item, why) => {
    if (desktop) openSel(item.lead._id, { intent: why ? { kind: why, n: Date.now() } : null });
    else onOpenLead(item.lead, why);
  };
  const act = async (what, item, why) => {
    if (what === 'calls') { shell.go('calls'); return; }
    if (what === 'clear') { setChip('all'); setQuery(''); return; }
    if (what === 'open') { openRecord(item, why); return; }
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
    if (what === 'tasks') { shell?.openTasks?.(item.lead, item.project || undefined); return; }
    /* The email system (milestone 8), under the Drafts rule (email safety): Send opens the send sheet on the draft, where Rob reads it and
       taps Send now (the only door out); Edit opens the same sheet editing. Nothing here posts a send. */
    if (what === 'sendemail' || what === 'editemail') {
      const t = emailTaskOf(item.record, item.action.taskId);
      if (!t) { openRecord(item); return; }
      shell?.openSendSheet?.({ _id: t.emailId }, { startEdit: what === 'editemail', onChanged: () => onRetry?.() });
      return;
    }
    if (what === 'pin' && item.action.taskId) { const ok = await writeRecord(item, pinPatch(item.record, item.action.taskId, taskCtx)); if (ok) toast.success(`${item.action.label} pinned as Next up.`); return; }
    if (what === 'auto' && item.action.taskId) { const ok = await writeRecord(item, unpinPatch(item.record, taskCtx)); if (ok) toast.success('Back to auto: the task due soonest is the Next up.'); return; }
    if (what === 'done' && item.action.taskId) {
      const ok = await writeRecord(item, completePatch(item.record, item.action.taskId, true, taskCtx, now));
      if (ok) toast.undo(`${item.action.label} done for ${item.lead.business}.`, () => writeRecord(item, completePatch(item.record, item.action.taskId, false, taskCtx, now)), { seconds: 6 });
      return;
    }
    if (what === 'snooze' && item.action.taskId) {
      const before = taskDue(item);
      const ok = await moveTask(item, new Date(Math.max(item.due, now) + DAY).toISOString());
      if (ok) toast.undo(`${item.lead.business} snoozed a day.`, () => moveTask(item, before), { seconds: 6 });
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
    if (item.action.taskId) {
      const before = taskDue(item);
      const ok = await moveTask(item, new Date(when).toISOString());
      if (ok) toast.undo(`${item.lead.business} snoozed until ${fmtDateTime(when)}.`, () => moveTask(item, before), { seconds: 6 });
      return;
    }
    const ok = await writeAction(item, { ...item.action, dueAt: new Date(when).toISOString(), auto: false });
    if (ok) toast.undo(`${item.lead.business} snoozed until ${fmtDateTime(when)}.`, () => writeAction(item, item.action), { seconds: 6 });
  };

  if (loading) {
    const body = <Stack gap={5}>{!desktop && <div className="db-next"><NextUpSkeleton /></div>}</Stack>;
    /* The same pane and shell the loaded screen uses, so the skeleton's rows and the hint sit where the loaded ones land. */
    return desktop ? (
      <>
        <CollapsiblePane id="tasks" label="Tasks" className="db-panel" rail={[]} head={<div className="db-panel-head">{showSkel && <><SkeletonBlock width={60} height={14} /><SkeletonBlock width={24} height={21} radius="var(--v-radius-pill)" /></>}</div>}>
          <ScrollArea bare className="db-panel-scroll">{showSkel && <NextUpSkeleton />}</ScrollArea>
        </CollapsiblePane>
        <PageShell className="aa-main aa-main--wide db-page" label="the record"><div className="db-hint" aria-busy="true">{showSkel && <SkeletonBlock width={452} height={240} radius="var(--v-radius-lg)" className="db-hint-box" />}</div><style>{dbStyles}</style></PageShell>
      </>
    ) : (
      <div className="aa-main aa-main--wide lay-scroll db-page" aria-busy="true"><div className="lay-content lay-content--wide">{showSkel && body}</div><style>{dbStyles}</style></div>
    );
  }
  if (error && !(leads || []).length) {
    const err = <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={retry} retrying={retrying} /></Card>;
    return desktop ? (
      <>
        <aside className="aa-panel db-panel" aria-label="Tasks"><ScrollArea bare className="db-panel-scroll">{err}</ScrollArea></aside>
        <div className="aa-main aa-main--wide lay-scroll db-page"><div className="lay-content lay-content--wide" /><style>{dbStyles}</style></div>
      </>
    ) : <div className="aa-main aa-main--wide lay-scroll db-page"><div className="lay-content lay-content--wide">{err}</div><style>{dbStyles}</style></div>;
  }

  const filters = (
    <Stack gap={2} className="nu-filters">
      <ListSearch value={query} onChange={setQuery} placeholder="Search clients" label="Search clients" />
      <Row gap={2} wrap role="group" aria-label="Show">{TASK_CHIPS.map(c => <Chip key={c.id} label={c.label} selected={chip === c.id} onClick={() => setChip(c.id)} className={`nu-chip nu-chip--${c.id}`} />)}</Row>
    </Stack>
  );
  const list = <NextUpList chip={chip} query={query} q={q} meetings={meetings} lists={listsReady} phone={phone} now={now} act={act} onReschedule={setResched} onStartList={(l) => shell.go('calls', { listId: String(l._id) })} onOpenLists={() => shell.go('lists')} />;
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
        <CollapsiblePane id="tasks" label="Tasks" className="db-panel" rail={railItems}
          head={<div className="db-panel-head"><span className="pb-card-h" style={{ margin: 0 }}>Tasks</span><span className="nu-count">{q.overdue.length + q.today.length}</span></div>}>
          <ScrollArea bare className="db-panel-scroll">{filters}{list}</ScrollArea>
        </CollapsiblePane>
        {sel ? (
          <PageShell className="aa-main db-main" label="the record">
            <LeadDetail key={sel._id} lead={sel} submissions={submissions} onPatch={onPatchLead} onLinkSubmission={onLinkSubmission} onClose={close} client={clientProps} intent={intent} />
          </PageShell>
        ) : (
          <PageShell className="aa-main aa-main--wide db-page" label="the record">
            <Stagger className="db-hint"><EmptyState icon="CheckDone01" title="Pick a task" description="The record opens here beside the list. Done, Snooze and the menu sit on every row." className="db-hint-box" /></Stagger>
          </PageShell>
        )}
        {picker}{confirmEl}
        {reschedSheet}{taskSheet}
        <style>{dbStyles}</style>
      </>
    );
  }
  return (
    <div className="aa-main aa-main--wide lay-scroll db-page">
      <div className="lay-content lay-content--wide">
        <Stagger className="v-stack" style={{ gap: 'var(--v-space-5)' }}>
          <div className="db-next">{filters}{list}</div>
        </Stagger>
      </div>
      {picker}{confirmEl}
      {reschedSheet}{taskSheet}
      <style>{dbStyles}</style>
    </div>
  );
}

const dbStyles = `
  .db-page { --v-stack-gap: var(--v-space-5); --v-content-w-wide: 1160px; }
  .db-page .lay-content--wide { max-width: var(--v-content-w-wide); }
  /* The queue keeps its own width: the shared panel token narrowed to 280 for the record's list panels (UI simplification, part A), and a queue row needs the room for its two controls. */
  .db-panel { gap: var(--v-space-3); }
  @media (min-width: 768px) { .aa-panel.db-panel { width: 380px; } }
  .db-panel-head { display: flex; align-items: center; gap: var(--v-space-2); padding: 0 var(--v-space-1); }
  .db-panel-scroll { padding: 2px; }
  .db-hint { display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: var(--v-space-5); }
  .db-hint-box { min-height: 240px; height: 240px; box-sizing: border-box; }
  /* Next up rows */
  .nu-group { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .nu-group--danger { color: var(--v-status-danger-text); }
  .nu-count { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); color: var(--v-text-3); background: var(--v-surface-3); border-radius: var(--v-radius-pill); padding: 1px 8px; }
  .nu-clear { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-2); }
  .db-tile-skel { display: inline-flex; background: none; border: 0; box-shadow: none; }
  .nu-bar { margin-top: var(--v-space-1); max-width: 220px; }
  .nu-pin { display: inline-flex; color: var(--v-status-progress-text); }
  .nu-row { text-align: left; }
  .nu-row.is-overdue { border-color: var(--v-status-danger-text); }
  .nu-filters { margin-bottom: var(--v-space-3); }
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
