/* Server mirror of src/shared/taskRules.js (the planner dashboard and task system): the same rules, self contained
 * because a serverless function cannot import src/. Keep everything below this header identical;
 * scripts/tasks-test.mjs asserts it. */
const uid = () => Math.random().toString(36).slice(2, 10);
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const ms = (v) => { const t = Date.parse(v || ''); return Number.isNaN(t) ? 0 : t; };

/** Every checklist, with ids on every list and item, order filled in, and nothing else changed. */
export function normalizeChecklists(lists) {
  if (!Array.isArray(lists)) return [];
  return lists.slice(0, 10).map((l) => ({
    id: str(l?.id, 24) || uid(), name: str(l?.name, 80), templateId: str(l?.templateId, 40),
    items: (Array.isArray(l?.items) ? l.items : []).slice(0, 50).map((it, ii) => ({
      id: str(it?.id, 24) || uid(), text: str(it?.text, 300), done: !!it?.done, doneAt: str(it?.doneAt, 40), due: str(it?.due, 40), note: str(it?.note, 300),
      order: Number.isFinite(Number(it?.order)) ? Number(it.order) : ii, pinned: !!it?.pinned, remindAt: str(it?.remindAt, 40), notifiedAt: str(it?.notifiedAt, 40),
      source: ['manual', 'template', 'suggestion'].includes(it?.source) ? it.source : 'manual', suggestionId: str(it?.suggestionId, 64),
    })),
  }));
}

/** Every task on a record, flat, each with its checklist's position and name. */
export function allTasks(record) {
  const out = [];
  (record?.checklists || []).forEach((l, li) => (l?.items || []).forEach((it, ii) => out.push({ ...it, listId: l.id, listName: l.name, listIndex: li, index: Number.isFinite(Number(it?.order)) ? Number(it.order) : ii })));
  return out;
}
export const openTasks = (record) => allTasks(record).filter(t => !t.done);
export const taskCounts = (record) => { const all = allTasks(record); const done = all.filter(t => t.done).length; return { done, total: all.length, open: all.length - done, pct: all.length ? Math.round((done / all.length) * 100) : 0 }; };
export const listCounts = (list) => { const all = list?.items || []; const done = all.filter(t => t.done).length; return { done, total: all.length, pct: all.length ? Math.round((done / all.length) * 100) : 0 }; };

/* The Next up rule, once: the pinned task wins; otherwise the earliest due open task, overdue first; ties break by checklist order then task order; tasks with no date only win when nothing has a date. */
export function taskNextUp(record, now = Date.now()) {
  const open = openTasks(record);
  if (!open.length) return null;
  const pinned = open.find(t => t.pinned);
  if (pinned) return pinned;
  const byOrder = (a, b) => a.listIndex - b.listIndex || a.index - b.index;
  const dated = open.filter(t => ms(t.due)).sort((a, b) => {
    const ao = ms(a.due) < now, bo = ms(b.due) < now;
    if (ao !== bo) return ao ? -1 : 1;
    return ms(a.due) - ms(b.due) || byOrder(a, b);
  });
  if (dated.length) return dated[0];
  return open.sort(byOrder)[0];
}

/** The next action a task becomes (auto true: the rule chose it; the pin writes auto false). */
export const taskAsAction = (t, auto = true) => (t ? { kind: 'custom', label: t.text, dueAt: t.due || '', auto, doneAt: '', remindAt: '', notifiedAt: '', taskId: t.id } : null);

/** One write that marks a task done (or not), stamping doneAt and clearing a pin. */
export function setTaskDone(lists, taskId, done, now = Date.now()) {
  return normalizeChecklists(lists).map(l => ({ ...l, items: l.items.map(it => (it.id === taskId ? { ...it, done, doneAt: done ? new Date(now).toISOString() : '', pinned: done ? false : it.pinned } : it)) }));
}
/** One write that pins one task (and unpins every other) or clears every pin. */
export function setTaskPinned(lists, taskId) {
  return normalizeChecklists(lists).map(l => ({ ...l, items: l.items.map(it => ({ ...it, pinned: !!taskId && it.id === taskId })) }));
}
export function patchTask(lists, taskId, set) {
  return normalizeChecklists(lists).map(l => ({ ...l, items: l.items.map(it => (it.id === taskId ? { ...it, ...set } : it)) }));
}
export function removeTask(lists, taskId) {
  return normalizeChecklists(lists).map(l => ({ ...l, items: l.items.filter(it => it.id !== taskId) }));
}
/** A new task appended to a list (by id), or to a list made for it. */
export function addTask(lists, listId, task) {
  const base = normalizeChecklists(lists);
  const item = normalizeChecklists([{ name: 'x', items: [task] }])[0].items[0];
  const i = base.findIndex(l => l.id === listId);
  if (i < 0) return [...base, { id: uid(), name: str(task.listName, 80) || 'Tasks', templateId: '', items: [{ ...item, order: 0 }] }];
  return base.map((l, j) => (j === i ? { ...l, items: [...l.items, { ...item, order: l.items.length }] } : l));
}

/* Checklist templates, seeded in code: each task's due day is an offset from the start date (working days are not
 * skipped; Rob picks the start). Applying one makes a list with templateId set and source 'template' on every task. */
export const CHECKLIST_TEMPLATES = [
  { id: 'onboarding', name: 'Onboarding', tasks: [['Intro email', 0], ['Client form', 2], ['Contract', 4], ['Deposit', 6], ['Client folder', 7]] },
  { id: 'brand', name: 'Brand project', tasks: [['Build concepts', 3], ['Present concepts', 5], ['Revision 1', 10], ['Revision 2', 15], ['Final payment', 18], ['Deliver files', 20], ['Retainer pitch', 23]] },
  { id: 'website', name: 'Website project', tasks: [['Collect content', 3], ['Design pages', 8], ['Build', 15], ['Revision 1', 19], ['Revision 2', 23], ['Launch', 27], ['Final payment', 28], ['Handover', 30]] },
  { id: 'content-month', name: 'Content month', tasks: [['Plan the month', 1], ['Make graphics', 7], ['Write captions', 9], ['Send for approval', 10], ['Chase approvals', 14], ['Report', 28]] },
  { id: 'ads-launch', name: 'Meta ads launch', tasks: [['Creative ready', 2], ['Copy and button', 3], ['Audience and budget', 4], ['Client approval', 6], ['Launch', 7], ['Day 3 check', 10], ['Week 1 report', 14], ['Wrap up', 28]] },
];
export const templateOf = (id) => CHECKLIST_TEMPLATES.find(t => t.id === id) || null;
/** The list a template makes, given a start date (YYYY-MM-DD) and a zone offset function (dueAtFor(dateKey) => ISO). */
export function applyTemplate(template, startKey, dueAtFor) {
  const [y, m, d] = String(startKey || '').split('-').map(Number);
  const dayKey = (n) => { const dt = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + n)); return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`; };
  const items = template.tasks.map(([text, offset], i) => ({ id: uid(), text, done: false, doneAt: '', due: y ? (dueAtFor ? dueAtFor(dayKey(offset)) : dayKey(offset)) : '', note: '', order: i, pinned: false, remindAt: '', notifiedAt: '', source: 'template', suggestionId: '' }));
  return { id: uid(), name: template.name, templateId: template.id, items };
}
