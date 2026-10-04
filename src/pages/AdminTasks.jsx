import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PageShell, ScrollArea, Stack, Row, Card, Button, Pill, Checkbox, Menu, Sheet, Input, Select, ChipGroup, ProgressBar,
  EmptyState, NoResults, ErrorState, Stagger, SkeletonBlock, SwipeRow, useConfirm, useDelayedLoading, useToast, useMediaQuery, Icon, ListRow,
} from '../ui';
import { COPY } from '../shared/copy';
import { useTopBar } from '../shell/ShellContext';
import { useSelection } from '../shell/nav-history';
import { taskCounts, listCounts, taskNextUp, addTask, removeTask, patchTask, normalizeChecklists, CHECKLIST_TEMPLATES, applyTemplate } from '../shared/taskRules';
import { completePatch, pinPatch, unpinPatch, checklistsPatch, QUICK_DAYS, quickDue, dueAtFor, taskDueLabel, isOverdue } from '../lib/taskWrite';
import { dateKeyOf } from '../lib/tasks';
import RowSheet from '../components/RowSheet';
import ListSearch from '../components/ListSearch';
import TaskSheet from '../components/TaskSheet';

/* Tasks (planner dashboard and task system, milestone 5), at
 * /clients/:id/tasks: every checklist on the client and on each of their
 * projects, one screen. Tick things off, pin the Next up, add and
 * reschedule. A focused screen: Back, the title, Quick add.
 *
 * On a computer every checklist is a section with its rows. On a phone the
 * overview is the progress and one row per checklist; a checklist is a step
 * (useSelection) with its rows, so the tab bar stays hidden and Back walks
 * out. Every task write goes through src/lib/taskWrite.js, the one place
 * that knows a pinned task is the next action.
 *
 * The rule the rows show (the pin, the one Next up) is taskNextUp, the same
 * function the shell's recompute and the Next up screen read. */

const TEMPLATE_BLURB = {
  onboarding: 'Intro email to the client folder, a week.',
  brand: 'Concepts to the retainer pitch, about three weeks.',
  website: 'Content to handover, a month.',
  'content-month': 'Plan to report, one month.',
  'ads-launch': 'Creative to wrap up, four weeks.',
};

/* One task row: the checkbox is the whole 44px row's control, the text opens
 * the editor, the due label turns accent when overdue, the pin shows which
 * one is Next up. Swipe right completes; swipe left or a long press opens
 * the task's sheet with Pin, Reschedule and Delete; the menu has the same. */
function TaskRow({ t, isNext, phone, readOnly, now, onToggle, onEdit, onPin, onUnpin, onReschedule, onDelete }) {
  const [sheet, setSheet] = useState(false);
  const due = taskDueLabel(t, now);
  const overdue = isOverdue(t, now);
  const items = [
    ...(t.done ? [] : [t.pinned
      ? { id: 'auto', label: 'Auto (unpin)', icon: 'Zap', onSelect: onUnpin }
      : { id: 'pin', label: 'Pin as Next up', icon: 'Pin01', onSelect: onPin }]),
    { id: 'when', label: 'Reschedule', icon: 'Calendar', onSelect: onReschedule },
    { id: 'edit', label: 'Edit task', icon: 'Edit02', onSelect: onEdit },
    'divider',
    { id: 'del', label: 'Delete task', icon: 'Trash01', danger: true, onSelect: onDelete },
  ];
  const openSheet = () => { if (!readOnly) setSheet(true); };
  return (
    <>
      <SwipeRow enabled={phone && !readOnly}
        right={t.done ? undefined : { label: 'Done', icon: 'Check', tone: 'booked', onCommit: () => onToggle(true) }}
        left={{ label: 'More', icon: 'DotsHorizontal', tone: 'neutral', onCommit: openSheet }}
        onHold={openSheet}>
        <div className={`tk-row${t.done ? ' is-done' : ''}${isNext ? ' is-next' : ''}${overdue ? ' is-overdue' : ''}`} data-task-id={t.id}>
          <Checkbox checked={!!t.done} onChange={(v) => onToggle(v)} disabled={readOnly} className="tk-check"
            label={<span className="tk-text"><span className="tk-title">{t.text}</span>{(due || t.note || t.pinned) && <span className="tk-meta">{t.pinned && <span className="tk-pin" title="Pinned as Next up"><Icon icon="Pin01" size={12} /><span className="v-sr-only">Pinned as Next up.</span></span>}{due && <span className={`tk-due${overdue ? ' is-overdue' : ''}`}>{due}</span>}{t.note && <span className="tk-note-dot" title="Has a note"><Icon icon="File02" size={12} /><span className="v-sr-only">Has a note.</span></span>}</span>}</span>} />
          {!readOnly && <span className="tk-ctl"><Menu label={`${t.text} actions`} items={items} /></span>}
        </div>
      </SwipeRow>
      {sheet && <RowSheet title={t.text} subtitle={due || 'No date'} facts={[{ label: 'Checklist', value: t.listName }, { label: 'Note', value: t.note }]} items={items} onClose={() => setSheet(false)} />}
    </>
  );
}

/* Quick add: a title and a day, nothing else; the editor has the rest. */
function QuickAdd({ lists, defaultListId, onAdd, onClose }) {
  const [text, setText] = useState('');
  const [day, setDay] = useState('today');
  const [pick, setPick] = useState('');
  const [listId, setListId] = useState(defaultListId || lists[0]?.id || '');
  const [busy, setBusy] = useState(false);
  const valid = !!text.trim() && (day !== 'pick' || !!pick);
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try { const ok = await onAdd({ text: text.trim(), due: quickDue(day, pick), listId }); if (ok) onClose(); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="Add task" label="Add task" width={460} className="tk-quick"
      footer={<Row gap={2} justify="end" wrap><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="Plus" onClick={save} disabled={!valid} loading={busy} className="tk-quick-save">Add</Button></Row>}>
      <Stack gap={3}>
        <Input label="Task" value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} placeholder="Send the proof" required data-autofocus onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
        <Stack gap={1}>
          <span className="v-field-label">When</span>
          <ChipGroup label="When" multi={false} allWhenEmpty={false} value={day} onChange={(id) => { if (id) setDay(id); }} options={QUICK_DAYS} />
          {day === 'pick' && <Input label="Day" type="date" value={pick} min={dateKeyOf(new Date())} onChange={(e) => setPick(e.target.value)} className="tk-pick" />}
        </Stack>
        {lists.length > 1 && <Select label="Checklist" value={listId} onChange={(e) => setListId(e.target.value)} options={lists.map(l => ({ id: l.id, label: l.name || 'Tasks' }))} />}
      </Stack>
    </Sheet>
  );
}

/* Start from a template: pick one, pick the start day, the due dates follow. */
function TemplateSheet({ onStart, onClose }) {
  const [id, setId] = useState(CHECKLIST_TEMPLATES[0].id);
  const [start, setStart] = useState(dateKeyOf(new Date()));
  const [busy, setBusy] = useState(false);
  const save = async () => { if (busy || !start) return; setBusy(true); try { const ok = await onStart(id, start); if (ok) onClose(); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={onClose} title="Start from a template" label="Start from a template" width={480} className="tk-templates"
      footer={<Row gap={2} justify="end" wrap><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="Check" onClick={save} disabled={!start} loading={busy} className="tk-template-start">Start</Button></Row>}>
      <Stack gap={3}>
        <div className="v-field">
          <span className="v-field-label" id="tk-template-label">Template</span>
          <div className="tk-tpls" role="radiogroup" aria-labelledby="tk-template-label">
            {CHECKLIST_TEMPLATES.map(t => (
              <button key={t.id} type="button" role="radio" aria-checked={id === t.id} className={`tk-tpl${id === t.id ? ' is-on' : ''}`} onClick={() => setId(t.id)}>
                <span className="tk-tpl-name">{t.name}</span>
                <span className="tk-tpl-sub">{t.tasks.length} tasks. {TEMPLATE_BLURB[t.id] || ''}</span>
                {id === t.id && <span className="tk-tpl-tick" aria-hidden="true"><Icon icon="Check" size={16} /></span>}
              </button>
            ))}
          </div>
        </div>
        <Input label="Start date" type="date" value={start} onChange={(e) => setStart(e.target.value)} hint="Every task's due date counts from here, at 9:00." required />
      </Stack>
    </Sheet>
  );
}

function NewListSheet({ onCreate, onClose }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => { if (!name.trim() || busy) return; setBusy(true); try { const ok = await onCreate(name.trim()); if (ok) onClose(); } finally { setBusy(false); } };
  return (
    <Sheet open onClose={onClose} title="New checklist" label="New checklist" width={420}
      footer={<Row gap={2} justify="end" wrap><Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="Plus" onClick={save} disabled={!name.trim()} loading={busy} className="tk-list-create">Create</Button></Row>}>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="Launch day" required data-autofocus onKeyDown={(e) => { if (e.key === 'Enter') save(); }} />
    </Sheet>
  );
}

export default function AdminTasks({
  lead, projects = [], sets = [], loading = false, leadsError = false, onRetryLeads, onPatchLead, onPatchProject, onBack, projectId = '', readOnly = false,
}) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const showSkel = useDelayedLoading(loading);
  const phone = useMediaQuery('(max-width: 767px)');
  const now = Date.now();
  const ctx = useMemo(() => ({ projects, sets }), [projects, sets]);
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState(null);      // { listKey } the Quick add sheet, with the list it defaults to
  const [tpl, setTpl] = useState(null);          // { ownerKey } the template sheet
  const [newList, setNewList] = useState(null);  // { ownerKey }
  const [edit, setEdit] = useState(null);        // { ownerKey, task, mode: 'edit' | 'when' }

  /* The owners: the client first, then each live project. Every list is
     keyed by its owner so a write lands on the right record. */
  const mine = useMemo(() => (projects || []).filter(p => String(p.leadId) === String(lead?._id) && !p.archived), [projects, lead]);
  const owners = useMemo(() => (!lead ? [] : [
    { key: 'lead', record: lead, name: lead.business, isProject: false },
    ...mine.map(p => ({ key: `p:${p._id}`, record: p, name: p.name || 'Project', isProject: true })),
  ]), [lead, mine]);
  const ownerOf = (key) => owners.find(o => o.key === key) || owners[0];
  /* ('p:' + id) rather than a template literal: scripts/css-orphans.mjs reads an equals sign before a backtick as the start of a style string. */
  const focusOwner = projectId ? owners.find(o => o.key === 'p:' + projectId) : null;

  const write = useCallback(async (owner, set) => {
    const ok = owner.isProject ? await onPatchProject(owner.record._id, set) : await onPatchLead(owner.record._id, set);
    if (!ok) toast.error(COPY.error.save);
    return ok;
  }, [onPatchLead, onPatchProject, toast]);

  /* The counts across every owner, and which task is the Next up on each. */
  const total = useMemo(() => owners.reduce((a, o) => { const c = taskCounts(o.record); return { done: a.done + c.done, total: a.total + c.total }; }, { done: 0, total: 0 }), [owners]);
  const nextIds = useMemo(() => new Set(owners.map(o => taskNextUp(o.record, now)?.id).filter(Boolean)), [owners, now]);
  const lists = useMemo(() => owners.flatMap(o => normalizeChecklists(o.record.checklists || []).map(l => ({ ...l, ownerKey: o.key, ownerName: o.name, isProject: o.isProject, key: `${o.key}:${l.id}` }))), [owners]);
  const query = q.trim().toLowerCase();
  const matches = (t) => !query || String(t.text || '').toLowerCase().includes(query) || String(t.note || '').toLowerCase().includes(query);
  const shownLists = useMemo(() => lists.map(l => ({ ...l, shown: l.items.filter(matches).sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order) })).filter(l => !query || l.shown.length), [lists, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const anyMatch = shownLists.some(l => l.shown.length);

  /* A phone: a checklist is a step. */
  const { selId: stepKey, open: openStep, close: closeStep } = useSelection('task-list');
  const stepList = phone && stepKey ? lists.find(l => l.key === stepKey) : null;
  const inStep = phone && !!stepList;
  const quickFor = (listKey) => setQuick({ listKey });
  useTopBar({
    title: inStep ? stepList.name : 'Tasks',
    back: inStep ? closeStep : onBack,
    actions: readOnly ? [] : [{ id: 'add', label: 'Add task', icon: 'Plus', onClick: () => quickFor(inStep ? stepList.key : '') }],
  });
  const openedProject = useRef(false);
  useEffect(() => {
    if (!phone || !focusOwner || openedProject.current) return;
    const first = lists.find(l => l.ownerKey === focusOwner.key);
    if (first) { openedProject.current = true; openStep(first.key); }
  }, [phone, focusOwner, lists, openStep]);

  /* The writes. Every one is the owner's whole checklists array plus, when
     a pin is involved, the next action (src/lib/taskWrite.js). */
  const toggle = async (l, t, done) => {
    const o = ownerOf(l.ownerKey);
    const ok = await write(o, completePatch(o.record, t.id, done, ctx, now));
    if (ok && done) toast.undo(`${t.text} done.`, () => write(o, completePatch(o.record, t.id, false, ctx, now)), { seconds: 6 });
  };
  const pin = async (l, t) => { const o = ownerOf(l.ownerKey); const ok = await write(o, pinPatch(o.record, t.id, ctx)); if (ok) toast.success(`${t.text} is the Next up for ${o.name}.`); };
  const unpin = async (l) => { const o = ownerOf(l.ownerKey); const ok = await write(o, unpinPatch(o.record, ctx)); if (ok) toast.success('Back to auto: the task due soonest is the Next up.'); };
  const del = async (l, t) => {
    const o = ownerOf(l.ownerKey);
    if (!(await confirm({ title: 'Delete this task?', body: t.text, danger: true, confirmLabel: 'Delete' }))) return;
    await write(o, checklistsPatch(o.record, removeTask(o.record.checklists || [], t.id), ctx));
  };
  const delList = async (l) => {
    const o = ownerOf(l.ownerKey);
    const n = l.items.length;
    if (n && !(await confirm({ title: `Delete "${l.name}"?`, body: `Its ${n} task${n === 1 ? '' : 's'} go with it.`, danger: true, confirmLabel: 'Delete' }))) return;
    const ok = await write(o, checklistsPatch(o.record, normalizeChecklists(o.record.checklists || []).filter(x => x.id !== l.id), ctx));
    if (ok && inStep) closeStep();
  };
  const add = async ({ text, due, listId }) => {
    const l = lists.find(x => x.id === listId) || lists[0];
    const o = l ? ownerOf(l.ownerKey) : owners[0];
    if (!o) return false;
    const ok = await write(o, checklistsPatch(o.record, addTask(o.record.checklists || [], l?.id || '', { text, due, source: 'manual', listName: 'Tasks' }), ctx));
    if (ok) toast.success('Task added.');
    return ok;
  };
  const start = async (templateId, startKey, ownerKey) => {
    const o = ownerOf(ownerKey);
    const t = CHECKLIST_TEMPLATES.find(x => x.id === templateId);
    if (!o || !t) return false;
    const next = [...normalizeChecklists(o.record.checklists || []), applyTemplate(t, startKey, dueAtFor)];
    const ok = await write(o, checklistsPatch(o.record, next, ctx));
    if (ok) toast.success(`${t.name} started. ${t.tasks.length} tasks, from ${startKey}.`);
    return ok;
  };
  const create = async (name, ownerKey) => {
    const o = ownerOf(ownerKey);
    if (!o) return false;
    const next = [...normalizeChecklists(o.record.checklists || []), { id: '', name, templateId: '', items: [] }];
    return write(o, checklistsPatch(o.record, next, ctx));
  };
  /** The editor's save: text, due, reminder, note, and the checklist it sits in (moving it when that changed). */
  const saveEdit = async (l, t, fields) => {
    const o = ownerOf(l.ownerKey);
    const target = lists.find(x => x.id === fields.listId) || l;
    const set = { text: fields.text, due: fields.due, remindAt: fields.remindAt, note: fields.note, notifiedAt: fields.due !== t.due ? '' : t.notifiedAt };
    if (target.key === l.key) return write(o, checklistsPatch(o.record, patchTask(o.record.checklists || [], t.id, set), ctx));
    /* Moved: out of one list (maybe another owner), into the other. */
    const removed = removeTask(o.record.checklists || [], t.id);
    const ok = await write(o, checklistsPatch(o.record, removed, ctx));
    if (!ok) return false;
    const to = ownerOf(target.ownerKey);
    const base = to.key === o.key ? removed : (to.record.checklists || []);
    return write(to, checklistsPatch({ ...to.record, checklists: base }, addTask(base, target.id, { ...t, ...set, listName: target.name }), ctx));
  };

  if (!lead) {
    return (
      <PageShell className="aa-main aa-main--wide">
        <ScrollArea wide>
          {leadsError && !loading
            ? <Card><ErrorState title={COPY.error.leads.title} description={COPY.error.leads.description} onRetry={onRetryLeads} /></Card>
            : loading
              ? <Stack gap={3} aria-busy="true">{[1, 2, 3].map(i => <Card key={i}><SkeletonBlock height={64} radius="var(--v-radius-md)" /></Card>)}</Stack>
              : <EmptyState icon="CheckDone01" title="Client not found" description="That client is not in the list any more." action={<Button onClick={onBack}>Back to clients</Button>} />}
        </ScrollArea>
      </PageShell>
    );
  }

  const E = COPY.empty['tasks.first'];
  const rowsOf = (l) => (
    <Stack gap={1} className="tk-rows">
      {l.shown.map(t => (
        <TaskRow key={t.id} t={{ ...t, listName: l.name }} isNext={nextIds.has(t.id)} phone={phone} readOnly={readOnly} now={now}
          onToggle={(v) => toggle(l, t, v)} onEdit={() => setEdit({ l, t, mode: 'edit' })} onReschedule={() => setEdit({ l, t, mode: 'when' })}
          onPin={() => pin(l, t)} onUnpin={() => unpin(l)} onDelete={() => del(l, t)} />
      ))}
    </Stack>
  );
  const listHead = (l, { withName = true } = {}) => {
    const c = listCounts(l);
    return (
      <Row gap={2} align="center" justify="between" wrap>
        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
          {withName && <span className="tk-list-name lay-truncate">{l.name || 'Tasks'}{l.isProject ? <span className="tk-list-owner">, {l.ownerName}</span> : null}</span>}
          <ProgressBar value={c.pct} tone={c.total && c.done === c.total ? 'booked' : 'progress'} size="sm" label={`${c.done} of ${c.total} done`} className="tk-list-bar" />
        </Stack>
        {!readOnly && (
          <span className="v-above">
            <Menu label={`${l.name || 'Tasks'} actions`} items={[
              { id: 'add', label: 'Add task', icon: 'Plus', onSelect: () => quickFor(l.key) },
              'divider',
              { id: 'del', label: 'Delete checklist', icon: 'Trash01', danger: true, onSelect: () => delList(l) },
            ]} />
          </span>
        )}
      </Row>
    );
  };
  const addBar = (ownerKey) => !readOnly && (
    <Row gap={2} wrap className="tk-addbar">
      <Button size="md" icon="Plus" onClick={() => quickFor('')} className="tk-add">Add task</Button>
      <Button size="md" variant="secondary" icon="File02" onClick={() => setTpl({ ownerKey })} className="tk-template">Start from a template</Button>
      <Button size="md" variant="ghost" icon="Plus" onClick={() => setNewList({ ownerKey })} className="tk-newlist">Blank checklist</Button>
    </Row>
  );

  /* The skeleton is the overview's shape: the search, the total bar, three checklist rows and the add bar on a phone; three list cards with their rows on a computer. */
  const body = showSkel ? (
    <Stack gap={3} aria-busy="true" aria-hidden="true">
      <SkeletonBlock height={44} radius="var(--v-radius-md)" className="lsr-skel" />
      {phone ? (
        <>
          <Card className="tk-total"><SkeletonBlock height={28} radius="var(--v-radius-md)" /></Card>
          <Stack gap={2}>{[1, 2, 3].map(i => <SkeletonBlock key={i} height={68} radius="var(--v-radius-md)" />)}</Stack>
          <SkeletonBlock height={44} width={220} radius="var(--v-radius-md)" />
        </>
      ) : (
        [1, 2, 3].map(i => <Card key={i}><SkeletonBlock height={120} radius="var(--v-radius-md)" /></Card>)
      )}
    </Stack>
  ) : !lists.length ? (
    <Card><EmptyState icon="CheckDone01" title={E.title} description={E.description}
      action={readOnly ? undefined : { label: E.action, icon: 'File02', onClick: () => setTpl({ ownerKey: 'lead' }) }}
      secondary={readOnly ? undefined : { label: 'Blank checklist', onClick: () => setNewList({ ownerKey: 'lead' }) }} /></Card>
  ) : inStep ? (
    <Stack gap={3}>
      <Card className="tk-list">{listHead({ ...stepList, shown: stepList.items.filter(matches) }, { withName: false })}</Card>
      {(() => { const l = { ...stepList, shown: stepList.items.filter(matches).sort((a, b) => Number(a.done) - Number(b.done) || a.order - b.order) }; return l.shown.length ? rowsOf(l) : query ? <NoResults noun="tasks" query={q} onClear={() => setQ('')} /> : <Card><EmptyState size="sm" icon="CheckDone01" title="Nothing on this checklist yet" description="Add the first task and it shows here." action={readOnly ? undefined : { label: 'Add task', icon: 'Plus', onClick: () => quickFor(l.key) }} /></Card>; })()}
      {!readOnly && <Row gap={2} wrap className="tk-addbar"><Button size="md" icon="Plus" onClick={() => quickFor(stepList.key)} className="tk-add">Add task</Button></Row>}
    </Stack>
  ) : phone ? (
    <Stack gap={3}>
      <Card className="tk-total">
        <ProgressBar value={total.total ? Math.round((total.done / total.total) * 100) : 0} tone={total.total && total.done === total.total ? 'booked' : 'progress'} label={`${total.done} of ${total.total} done`} className="tk-total-bar" />
      </Card>
      {query && !anyMatch ? <NoResults noun="tasks" query={q} onClear={() => setQ('')} /> : (
        <Stack gap={2}>
          {shownLists.map(l => { const c = listCounts(l); return (
            <ListRow key={l.key} title={l.name || 'Tasks'} subtitle={`${c.done} of ${c.total} done${l.isProject ? `, ${l.ownerName}` : ''}${query ? `, ${l.shown.length} match` : ''}`} onClick={() => openStep(l.key)}
              trailing={<span className="tk-row-bar"><ProgressBar value={c.pct} tone={c.total && c.done === c.total ? 'booked' : 'progress'} size="sm" /></span>} />
          ); })}
        </Stack>
      )}
      {addBar('lead')}
    </Stack>
  ) : (
    <Stack gap={3}>
      {query && !anyMatch ? <NoResults noun="tasks" query={q} onClear={() => setQ('')} /> : shownLists.map(l => (
        <Card key={l.key} className={`tk-list${focusOwner && l.ownerKey === focusOwner.key ? ' is-focus' : ''}`}>
          {listHead(l)}
          {l.shown.length ? rowsOf(l) : <p className="tk-empty-line">Nothing on this checklist yet.</p>}
        </Card>
      ))}
      {addBar(focusOwner?.key || 'lead')}
    </Stack>
  );

  return (
    <PageShell className="aa-main aa-main--wide tk-page">
      <ScrollArea wide className="tk-scroll">
        {!phone && (
          <div className="tk-topbar">
            <Row gap={2} align="center" justify="between" wrap>
              <Row gap={2} align="center" wrap style={{ minWidth: 0 }}>
                <Button variant="ghost" icon="ArrowLeft" onClick={onBack} className="tk-back">Back</Button>
                <h1 className="tk-title lay-title">{lead.business}, tasks</h1>
                {total.total > 0 && <Pill tone={total.done === total.total ? 'booked' : 'neutral'} size="sm" icon={false} variant="soft" label={`${total.done} of ${total.total} done`} />}
              </Row>
              {!readOnly && <Button icon="Plus" onClick={() => quickFor('')} className="tk-add-top">Add task</Button>}
            </Row>
            {!showSkel && total.total > 0 && <ProgressBar value={Math.round((total.done / total.total) * 100)} tone={total.done === total.total ? 'booked' : 'progress'} size="sm" className="tk-total-bar" />}
          </div>
        )}
        <div className="tk-body">
          {!inStep && lists.length > 0 && !showSkel && <ListSearch value={q} onChange={setQ} placeholder="Search tasks" label="Search tasks" className="tk-search" />}
          <Stagger className="v-stack" style={{ gap: 'var(--v-space-3)' }}>{body}</Stagger>
        </div>
      </ScrollArea>

      {quick && <QuickAdd lists={lists} defaultListId={(lists.find(l => l.key === quick.listKey) || lists[0])?.id || ''} onAdd={add} onClose={() => setQuick(null)} />}
      {tpl && <TemplateSheet onStart={(id, startKey) => start(id, startKey, tpl.ownerKey)} onClose={() => setTpl(null)} />}
      {newList && <NewListSheet onCreate={(name) => create(name, newList.ownerKey)} onClose={() => setNewList(null)} />}
      {edit && (
        <TaskSheet business={`${ownerOf(edit.l.ownerKey)?.name || lead.business}, ${edit.l.name || 'Tasks'}`}
          item={edit.t} lists={lists.map(l => ({ id: l.id, name: `${l.name || 'Tasks'}${l.isProject ? `, ${l.ownerName}` : ''}` }))} focus={edit.mode === 'when' ? 'date' : 'label'}
          onClose={() => setEdit(null)}
          onSave={(fields) => saveEdit(edit.l, edit.t, fields)}
          onDone={edit.t.done ? null : async () => { await toggle(edit.l, edit.t, true); return true; }} />
      )}
      {confirmDialog}
      <style>{tkStyles}</style>
    </PageShell>
  );
}

const tkStyles = `
  .tk-topbar { position: sticky; top: 0; z-index: 5; padding: var(--v-space-3) 0; background: var(--v-surface-1); border-bottom: 1px solid var(--v-border-1); display: flex; flex-direction: column; gap: var(--v-space-2); }
  .tk-title { font-size: var(--v-text-lg); font-weight: 700; color: var(--v-text-1); margin: 0; min-width: 0; }
  .tk-body { padding-top: var(--v-space-4); display: flex; flex-direction: column; gap: var(--v-space-3); }
  .tk-search { margin-bottom: var(--v-space-1); }
  .tk-total { gap: 0; }
  .tk-list { gap: var(--v-space-3); }
  .tk-list.is-focus { border-color: var(--v-border-2); }
  .tk-list-name { font-size: var(--v-text-md); font-weight: var(--v-weight-bold); color: var(--v-text-1); }
  .tk-list-owner { font-weight: var(--v-weight-regular); color: var(--v-text-3); }
  .tk-list-bar { margin-top: var(--v-space-1); }
  .tk-row-bar { display: inline-flex; width: 56px; }
  .tk-rows { min-width: 0; }
  /* One task: a 44px row whose checkbox is the control, text that opens the editor, the pin and the due label. */
  .tk-row { display: flex; align-items: center; gap: var(--v-space-1); min-height: var(--v-tap); padding: 0 var(--v-space-1); border-radius: var(--v-radius-md); background: var(--v-surface-2); border: 1px solid var(--v-border-1); min-width: 0; }
  .tk-row.is-next { border-color: var(--v-status-progress-text); }
  .tk-row.is-overdue { border-color: var(--v-status-danger-text); }
  .tk-row .tk-check { flex: 1; min-width: 0; }
  .tk-row .v-check-label { min-width: 0; white-space: normal; }
  .tk-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .tk-title { font-size: var(--v-text-sm); color: var(--v-text-1); overflow-wrap: anywhere; }
  .tk-row.is-done .tk-title { color: var(--v-text-3); text-decoration: line-through; }
  .tk-meta { display: flex; align-items: center; gap: var(--v-space-2); flex-wrap: wrap; font-size: var(--v-text-xs); color: var(--v-text-3); }
  .tk-due.is-overdue { color: var(--v-status-danger-text); font-weight: var(--v-weight-bold); }
  .tk-pin { display: inline-flex; color: var(--v-status-progress-text); }
  .tk-note-dot { display: inline-flex; color: var(--v-text-3); }
  .tk-ctl { display: inline-flex; flex: 0 0 auto; }
  .tk-empty-line { margin: 0; font-size: var(--v-text-sm); color: var(--v-text-3); }
  .tk-addbar { padding-bottom: var(--v-space-4); }
  /* The template picker: one row per template, radio semantics. */
  .tk-tpls { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .tk-tpl { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: var(--v-tap); padding: var(--v-space-3); text-align: left; cursor: pointer; background: var(--v-surface-2); color: var(--v-text-2); border: 1px solid var(--v-border-1); border-radius: var(--v-radius-md); font-family: var(--v-font-body); }
  .tk-tpl.is-on { border-color: var(--v-status-progress-text); background: var(--v-surface-3); }
  .tk-tpl:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .tk-tpl-name { font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); color: var(--v-text-1); flex: 0 0 auto; }
  .tk-tpl-sub { font-size: var(--v-text-xs); color: var(--v-text-3); flex: 1; min-width: 0; }
  .tk-tpl-tick { display: inline-flex; color: var(--v-status-progress-text); }
`;
