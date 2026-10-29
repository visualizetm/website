/* The Next up block on the home page: the pure half (the lists the three cards show and the writes a row makes), so the card is
 * drawing and wiring only and the rules can be tested without a browser. Every write goes through src/lib/taskWrite.js or the
 * same field the record's own control writes; nothing here knows about React or the network.
 *
 *   homeLists   the Today and Overdue rows, with the rows finished or moved this session kept in place until the page reloads
 *   checkWrite  what the check on a row writes: a task completes, a manual action stamps its doneAt, a call or a callback writes nothing
 *   tomorrowWrite  what Tomorrow writes (9:00 AM New York tomorrow) and the write that undoes it
 */
import { homeRowAction, tomorrowNineNY } from './nextAction.js';
import { completePatch, checklistsPatch } from './taskWrite.js';
import { patchTask, allTasks, setTaskDone, setTaskPinned } from '../shared/taskRules.js';

/** Overdue shows this many rows before "Show N more". Today is never capped. */
export const OVERDUE_CAP = 5;

/** One row's identity: the record, what it asks and when. A finished row keeps its key, so it stays where it was. */
export const rowKey = (it) => `${it.id}|${it.action?.taskId || it.action?.kind || ''}|${it.action?.dueAt || ''}`;

const byDue = (a, b) => a.item.due - b.item.due;

/**
 * The rows of the Today and Overdue cards.
 * q is nextUpItems(); ghosts is { [key]: { key, item, card: 'today' | 'overdue', mode: 'done' | 'leaving' } }, the rows finished or
 * moved this session. A done ghost stays in its card, struck through; a leaving ghost is the row fading out after Tomorrow.
 */
export function homeLists(q, ghosts = {}, { expanded = false, cap = OVERDUE_CAP } = {}) {
  const live = (list) => (list || []).map(item => ({ key: rowKey(item), item, done: false, leaving: false }));
  const kept = (card, rows) => {
    const have = new Set(rows.map(r => r.key));
    const extra = Object.values(ghosts || {}).filter(g => g.card === card && !have.has(g.key)).map(g => ({ key: g.key, item: g.item, done: g.mode === 'done', leaving: g.mode === 'leaving' }));
    return [...rows, ...extra].sort(byDue);
  };
  const today = kept('today', live(q?.today));
  const overdueAll = kept('overdue', live(q?.overdue));
  const overdue = expanded ? overdueAll : overdueAll.slice(0, cap);
  return {
    today, overdue,
    hidden: overdueAll.length - overdue.length,
    doneToday: today.filter(r => r.done).length,
    overdueCount: (q?.overdue || []).length,
    overdueTotal: overdueAll.length, // the rows Overdue holds, the ones kept in place included: what decides Show more
    later: q?.later || [],
  };
}

/** The write the check makes, or null when it makes none (a call, a callback, a rule action: those open something instead). */
export function checkWrite(item, ctx = {}, now = Date.now()) {
  const plan = homeRowAction(item, now);
  const a = item.action;
  if (plan.check === 'task') {
    /* Completing clears a pin, so the undo puts the pin back when the task had one. */
    const wasPinned = !!allTasks(item.record).find(t => t.id === a.taskId)?.pinned;
    return {
      set: completePatch(item.record, a.taskId, true, ctx, now),
      undo: (rec = item.record) => { let lists = setTaskDone(rec.checklists || [], a.taskId, false, now); if (wasPinned) lists = setTaskPinned(lists, a.taskId); return checklistsPatch(rec, lists, ctx, { pin: wasPinned ? a.taskId : null }); },
    };
  }
  if (plan.check === 'manual') return { set: { nextAction: { ...a, doneAt: new Date(now).toISOString() } }, undo: () => ({ nextAction: { ...a, doneAt: '' } }) };
  return null;
}

/** The write Tomorrow makes (the due, or the callback, at 9:00 AM New York tomorrow) and the write that puts it back; null for a row with no Tomorrow. */
export function tomorrowWrite(item, ctx = {}, now = Date.now()) {
  const plan = homeRowAction(item, now);
  const a = item.action;
  const at = new Date(tomorrowNineNY(now)).toISOString();
  if (plan.tomorrow === 'task') {
    const t = allTasks(item.record).find(x => x.id === a.taskId);
    const before = { due: t?.due || '', remindAt: t?.remindAt || '', notifiedAt: t?.notifiedAt || '' };
    /* The reminder moves with the due, keeping its distance from it: the reminders cron pushes on remindAt (or the due when it is empty),
       so a reminder left on the old time would fire at once or be stamped as stale and never push for the new one. */
    const oldDue = Date.parse(before.due) || 0;
    const shifted = before.remindAt ? (oldDue ? Date.parse(before.remindAt) + (Date.parse(at) - oldDue) : Date.parse(at)) : 0;
    const remindAt = before.remindAt ? (shifted >= now ? new Date(shifted).toISOString() : at) : '';
    const move = (rec, fields) => {
      const set = checklistsPatch(rec, patchTask(rec.checklists || [], a.taskId, fields), ctx);
      /* A pinned task IS the stored next action (auto false, taskId, a copy of its due): the copy moves with the task or the row never leaves Overdue. */
      const cur = rec.nextAction;
      if (!('nextAction' in set) && cur && cur.auto === false && cur.taskId === a.taskId && !cur.doneAt) set.nextAction = { ...cur, dueAt: fields.due };
      return set;
    };
    return { set: move(item.record, { due: at, remindAt, notifiedAt: '' }), undo: (rec = item.record) => move(rec, before), dueAt: at };
  }
  if (plan.tomorrow === 'callback') {
    const before = item.lead?.callbackAt || '';
    return { set: { callbackAt: at }, undo: () => ({ callbackAt: before }), dueAt: at };
  }
  if (plan.tomorrow === 'manual') return { set: { nextAction: { ...a, dueAt: at, auto: false } }, undo: () => ({ nextAction: a }), dueAt: at };
  return null;
}
