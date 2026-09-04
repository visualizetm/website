/* One date toolkit for the mixed formats the data carries:
 *   - ISO timestamps    "2026-08-22T17:10:34.820Z"  (callLog.at, clientSince, bookedOutcome.at)
 *   - date-only strings "2026-08-06"                (purchases.at, contactLog.at, meeting.date, dueAt)
 *   - Date objects      (createdAt / updatedAt from the driver)
 *
 * Prompt 12: a date-only string is a calendar day the user typed, so it
 * parses as LOCAL midnight (the spec's default is UTC midnight, which showed
 * "Aug 5" for "2026-08-06" in US time zones). Nothing stored changes; only
 * parsing does. scripts/dates-test.mjs covers both formats and DST edges.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Date | null. Accepts Date, ISO string, YYYY-MM-DD (local midnight), or epoch number. */
export function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'string' && DATE_ONLY.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    const local = new Date(y, m - 1, d);
    return Number.isNaN(local.getTime()) ? null : local;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** The local calendar day of any date value as YYYY-MM-DD. */
export function dayKey(v = new Date()) {
  const d = parseDate(v); if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const isDateOnly = (v) => typeof v === 'string' && DATE_ONLY.test(v);
export const toMs = (v) => parseDate(v)?.getTime() || 0;

/** "Aug 6, 2026" */
export function fmtDate(v) {
  const d = parseDate(v);
  return d ? d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}
/** "Aug 6, 2:22 PM" (the call-log style) */
export function fmtDateTime(v) {
  const d = parseDate(v);
  return d ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}
/** "Tue, Aug 11, 6:00 PM" */
export function fmtWeekdayDateTime(v) {
  const d = parseDate(v);
  return d ? d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
}
/** Local calendar date for <input type="date"> defaults (was UTC before Prompt 12). */
export const todayInput = () => dayKey(new Date());

/** Whole days between v and now (floored, never negative). */
export function daysSince(v, now = Date.now()) {
  const t = toMs(v);
  return t ? Math.max(0, Math.floor((now - t) / 864e5)) : null;
}
/** "today" / "3d ago" / "2h ago" / "just now" — compact relative time. */
export function relativeTime(v, now = Date.now()) {
  const t = toMs(v);
  if (!t) return '';
  const diff = now - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
/** "today" / "tomorrow" / "in 2 days" / "3 days ago" — calendar-day countdown. */
export function countdownLabel(v, now = Date.now()) {
  const d = parseDate(v);
  if (!d) return null;
  const a = new Date(d).setHours(0, 0, 0, 0);
  const b = new Date(now).setHours(0, 0, 0, 0);
  const days = Math.round((a - b) / 864e5);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return 'yesterday';
  return `${-days} days ago`;
}
/** Minutes as "12m" / "1h 5m" (session clock). */
export function fmtMins(ms) {
  const m = Math.floor(ms / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
