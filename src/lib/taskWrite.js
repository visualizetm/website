import { nextActionFor } from './nextAction';
import { taskTimes, fmtTaskDue, dateKeyOf } from './tasks';
import { allTasks, taskAsAction, setTaskDone, setTaskPinned, normalizeChecklists } from '../shared/taskRules';

/* The task system's writes (planner dashboard and task system, milestone 5).
 *
 * Every write is the whole `checklists` array through the shell's patch
 * helper, which recomputes the next action for any write that touches
 * checklists (NEXT_ACTION_KEYS). The one thing the recompute cannot do on
 * its own is a pin, because a pinned task IS the manual next action (auto
 * false, taskId): so a write that makes a pin, or that finishes, deletes or
 * unpins the pinned task, carries the next action itself. */

/** The set a checklists write sends. `pin` names the task to pin on this write. */
export function checklistsPatch(record, lists, ctx = {}, { pin = null } = {}) {
  const next = normalizeChecklists(lists);
  const merged = { ...record, checklists: next };
  if (pin) {
    const t = allTasks(merged).find(x => x.id === pin && !x.done);
    if (t) return { checklists: next, nextAction: taskAsAction(t, false) };
  }
  const cur = record?.nextAction;
  if (cur && cur.auto === false && cur.taskId) {
    const t = allTasks(merged).find(x => x.id === cur.taskId);
    if (!t || t.done || !t.pinned) return { checklists: next, nextAction: nextActionFor(merged, ctx) };
  }
  return { checklists: next };
}
export const completePatch = (record, taskId, done, ctx, now = Date.now()) => checklistsPatch(record, setTaskDone(record?.checklists || [], taskId, done, now), ctx);
export const pinPatch = (record, taskId, ctx) => checklistsPatch(record, setTaskPinned(record?.checklists || [], taskId), ctx, { pin: taskId });
export const unpinPatch = (record, ctx) => checklistsPatch(record, setTaskPinned(record?.checklists || [], ''), ctx);

/* Quick add's day chips: today, tomorrow, this week (Friday, or next Friday
 * from a weekend), or a picked day. Every one lands at 9:00 local. */
export const QUICK_DAYS = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'This week' },
  { id: 'pick', label: 'Pick a date' },
];
export function quickDue(id, pickKey = '', now = new Date()) {
  const d = new Date(now);
  if (id === 'today') return taskTimes({ date: dateKeyOf(d), time: '09:00', remind: 'off' }).dueAt;
  if (id === 'tomorrow') { d.setDate(d.getDate() + 1); return taskTimes({ date: dateKeyOf(d), time: '09:00', remind: 'off' }).dueAt; }
  if (id === 'week') { const dow = d.getDay(); const toFri = dow <= 5 ? 5 - dow : 6; d.setDate(d.getDate() + (toFri === 0 ? 0 : toFri)); return taskTimes({ date: dateKeyOf(d), time: '09:00', remind: 'off' }).dueAt; }
  if (id === 'pick' && pickKey) return taskTimes({ date: pickKey, time: '09:00', remind: 'off' }).dueAt;
  return '';
}
/** The due instant a template task gets from its day key: 9:00 local on that day. */
export const dueAtFor = (dayKey) => taskTimes({ date: dayKey, time: '09:00', remind: 'off' }).dueAt;

/** "Today 9:00 AM", "Overdue, Thu Oct 2, 9:00 AM", or '' with no date. */
export function taskDueLabel(t, now = Date.now()) {
  if (!t?.due) return '';
  const at = new Date(t.due).getTime();
  const overdue = at && at < now && !t.done;
  return `${overdue ? 'Overdue, ' : ''}${fmtTaskDue(t.due, now)}`;
}
export const isOverdue = (t, now = Date.now()) => !!t?.due && !t.done && new Date(t.due).getTime() < now;
