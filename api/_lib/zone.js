/* America/New_York, explicitly (closeout after the CRM revamp). Every date
 * rule on the server (the daily cron, api/_lib/rules.js, nextAction.js,
 * deal.js, invoices.js) reads the day, the month and the wall clock through
 * these, never through the process zone, so production behaves the same
 * with or without a TZ variable. Day keys are YYYY-MM-DD in the zone;
 * calendar arithmetic on a key needs no zone at all. */
export const ZONE = 'America/New_York';
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const pad = (n) => String(n).padStart(2, '0');
export const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const keyParts = (key) => String(key).slice(0, 10).split('-').map(Number);
const utcKey = (t) => `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;

/** The wall clock in the zone at an instant: { y, m, d, h, min, s }. */
export function zoneParts(ms = Date.now()) {
  const o = {};
  for (const p of fmt.formatToParts(new Date(ms))) if (p.type !== 'literal') o[p.type] = Number(p.value);
  return { y: o.year, m: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, min: o.minute, s: o.second };
}
export const zoneDayKey = (ms = Date.now()) => { const p = zoneParts(ms); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
export const zoneMonthKey = (ms = Date.now()) => zoneDayKey(ms).slice(0, 7);
export const zoneDayOfMonth = (ms = Date.now()) => zoneParts(ms).d;
/** The instant of a wall clock time in the zone (a time inside the spring gap lands an hour on). */
export function zoneMs(y, m, d, h = 0, min = 0, s = 0) {
  const want = Date.UTC(y, m - 1, d, h, min, s);
  let guess = want;
  for (let i = 0; i < 3; i++) {
    const p = zoneParts(guess);
    const wall = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    const diff = want - wall;
    if (!diff) break;
    guess += diff;
  }
  return guess;
}
/** Midnight in the zone for a day key (NaN for anything else). */
export const zoneDayMs = (key) => { if (!DAY_KEY.test(String(key || '').slice(0, 10))) return NaN; const [y, m, d] = keyParts(key); return zoneMs(y, m, d); };
export const zoneDateAt = (key, h = 0, min = 0) => { const [y, m, d] = keyParts(key); return zoneMs(y, m, d, h, min); };
export const zoneStartOfDay = (ms = Date.now()) => zoneDayMs(zoneDayKey(ms));
/** A meeting's instant from its date and HH:MM in the zone (NaN without a date). */
export const zoneMeetingMs = (date, time = '09:00') => { if (!DAY_KEY.test(String(date || ''))) return NaN; const [h, min] = String(time || '09:00').split(':').map(Number); return zoneDateAt(date, h || 0, min || 0); };
export const zoneTomorrowAt = (ms, h, min = 0) => zoneDateAt(keyAddDays(zoneDayKey(ms), 1), h, min);
/** Calendar arithmetic on a day key: no zone involved. */
export const keyAddDays = (key, n) => { const [y, m, d] = keyParts(key); return utcKey(new Date(Date.UTC(y, m - 1, d + n))); };
export function keyAddMonths(key, n, dayOfMonth) {
  const [y, m, d] = keyParts(key);
  const want = dayOfMonth || d;
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return utcKey(new Date(Date.UTC(y, m - 1 + n, Math.min(want, last))));
}
