/* One date toolkit for the mixed formats the data carries:
 *   - ISO timestamps    "2026-08-22T17:10:34.820Z"  (callLog.at, clientSince, bookedOutcome.at)
 *   - date-only strings "2026-08-06"                (purchases.at, contactLog.at, meeting.date)
 *   - Date objects      (createdAt / updatedAt from the driver)
 *
 * KNOWN BUG, DELIBERATELY PRESERVED (Prompt 2 rule: identical output):
 * parseDate() still hands date-only strings to `new Date(s)`, which the
 * spec parses as UTC midnight, so fmtDate('2026-08-06') renders "Aug 5" in
 * US timezones. A later prompt fixes it here, in one place, by parsing
 * YYYY-MM-DD as local midnight. Do not fix it piecemeal in screens.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Date | null. Accepts Date, ISO string, YYYY-MM-DD, or epoch number. */
export function parseDate(v) {
  if (v == null || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
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
/** Local ISO date for <input type="date"> defaults. */
export const todayInput = () => new Date().toISOString().slice(0, 10);

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
