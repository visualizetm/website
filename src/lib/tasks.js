/* Tasks with a due date (a custom next action set by hand through the Set
 * task sheet). The shape rides on nextAction: { kind: 'custom', label, dueAt,
 * auto: false, doneAt, remindAt, notifiedAt }. dueAt comes from the date and
 * the time Rob picks in his own zone (the browser's); remindAt from the
 * Remind me choice; notifiedAt is stamped by the reminders cron once the push
 * for it has gone out, so a rerun never sends it twice. */
export const REMIND_CHOICES = [
  { id: 'at', label: 'At the time' },
  { id: 'hour', label: '1 hour before' },
  { id: 'morning', label: 'The morning of at 9:00' },
  { id: 'off', label: 'Off' },
];
export const REMIND_CHOICE_IDS = REMIND_CHOICES.map(c => c.id);
const HOUR = 3600e3;
const pad = (n) => String(n).padStart(2, '0');
export const dateKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const timeKeyOf = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** The due and the reminder instants for a date (YYYY-MM-DD), a time (HH:MM) and a Remind me choice, in the local zone. */
export function taskTimes({ date, time = '09:00', remind = 'at' }) {
  const [y, m, d] = String(date || '').split('-').map(Number);
  const [h, min] = String(time || '09:00').split(':').map(Number);
  if (!y || !m || !d) return { dueAt: '', remindAt: '' };
  const due = new Date(y, m - 1, d, Number.isFinite(h) ? h : 9, Number.isFinite(min) ? min : 0, 0, 0);
  if (Number.isNaN(due.getTime())) return { dueAt: '', remindAt: '' };
  const dueAt = due.toISOString();
  const remindAt = remind === 'at' ? dueAt
    : remind === 'hour' ? new Date(due.getTime() - HOUR).toISOString()
    : remind === 'morning' ? new Date(y, m - 1, d, 9, 0, 0, 0).toISOString()
    : '';
  return { dueAt, remindAt };
}
/** The nextAction a saved task writes. */
export function buildTask({ label, date, time, remind }) {
  const { dueAt, remindAt } = taskTimes({ date, time, remind });
  return { kind: 'custom', label: String(label || '').trim().slice(0, 120), dueAt, auto: false, doneAt: '', remindAt, notifiedAt: '' };
}
/** A task set through the sheet: a manual custom action that carries the reminder field. */
export const isTask = (a) => !!a && typeof a === 'object' && a.kind === 'custom' && a.auto === false && 'remindAt' in a;
/** The Remind me choice a stored task was saved with, for the prefilled sheet. */
export function remindChoiceOf(a) {
  if (!a?.dueAt) return 'at';
  if (!a.remindAt) return 'off';
  const due = new Date(a.dueAt).getTime(); const at = new Date(a.remindAt).getTime();
  if (Math.abs(at - due) < 60e3) return 'at';
  if (Math.abs(due - at - HOUR) < 60e3) return 'hour';
  return 'morning';
}
/** "Today 2:30 PM" or "Thu Oct 2, 9:00 AM". */
export function fmtTaskDue(iso, now = Date.now()) {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (dateKeyOf(d) === dateKeyOf(new Date(now))) return `Today ${time}`;
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}
