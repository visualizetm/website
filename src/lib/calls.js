/* Pure helpers for the Call Console: best-window buckets, queue ordering,
 * session size, stats, and the win line. Rules in reports/PROMPT-07-REPORT.md. */
import { WINDOWS } from '../shared/semantics';
import { lastTouchAt } from './leads';

const PRIO_RANK = { hot: 0, warm: 1, cold: 2 };
const STATUS_RANK = { 'not-called': 0, callback: 1, 'no-answer': 2, 'wrong-number': 3, no: 4, booked: 5 };

/** Hour of day to window id. */
export function windowForHour(h) {
  return (WINDOWS.find(w => h >= w.hours[0] && h < w.hours[1]) || WINDOWS[0]).id;
}
export const currentWindow = (d = new Date()) => windowForHour(d.getHours());

/** Windows a free-text bestWindow mentions. "Before 8am or after 5pm" hits morning and evening.
 *  Empty text means any window. */
export function windowsOf(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return new Set(WINDOWS.map(w => w.id));
  const out = new Set();
  if (/morning|before (\d+)\s*am|early|breakfast|\b[5-9]\s*am|\b10\s*am/.test(t)) out.add('morning');
  if (/midday|noon|lunch|\b11\s*am|\b12\s*pm|\b1\s*pm/.test(t)) out.add('midday');
  if (/afternoon|\b[2-4]\s*pm/.test(t)) out.add('afternoon');
  if (/evening|after (\d+)\s*pm|night|late|\b[5-9]\s*pm/.test(t)) out.add('evening');
  // Hour ranges like "9-11", "2 to 4pm".
  const m = t.match(/(\d{1,2})\s*(?:am|pm)?\s*(?:-|to)\s*(\d{1,2})\s*(am|pm)?/);
  if (m) {
    let a = +m[1]; let b = +m[2]; const pm = m[3] === 'pm';
    if (pm && b < 12) b += 12; if (pm && a < 12 && a <= b - 12) a += 12;
    for (let h = a; h < b; h++) out.add(windowForHour(h));
  }
  if (!out.size) out.add('midday');
  return out;
}
export const matchesWindow = (lead, id) => windowsOf(lead.bestWindow).has(id);

export const ORDERS = [
  { id: 'window', label: 'Best window first' },
  { id: 'priority', label: 'Priority' },
  { id: 'oldest', label: 'Oldest untouched' },
  { id: 'newest', label: 'Newest' },
];
/** Order a queue. Best window first: leads whose window matches now come first, then priority, then status. */
export function orderQueue(list, order, now = new Date()) {
  const win = currentWindow(now);
  const byPrio = (a, b) => (PRIO_RANK[a.priority] ?? 1) - (PRIO_RANK[b.priority] ?? 1) || (STATUS_RANK[a.callStatus] ?? 0) - (STATUS_RANK[b.callStatus] ?? 0) || new Date(b.createdAt) - new Date(a.createdAt);
  const arr = [...list];
  if (order === 'window') return arr.sort((a, b) => (matchesWindow(b, win) ? 1 : 0) - (matchesWindow(a, win) ? 1 : 0) || byPrio(a, b));
  if (order === 'oldest') return arr.sort((a, b) => lastTouchAt(a) - lastTouchAt(b) || new Date(a.createdAt) - new Date(b.createdAt));
  if (order === 'newest') return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return arr.sort(byPrio);
}

export const SIZES = [10, 25, 50, 0]; // 0 = all
export const sizeLabel = (n) => (n ? String(n) : 'All');

export const EMPTY_STATS = { calls: 0, booked: 0, callbacks: 0, no: 0, noAnswer: 0, wrongNumber: 0 };
export const STAT_KEY = { booked: 'booked', callback: 'callbacks', no: 'no', 'no-answer': 'noAnswer', 'wrong-number': 'wrongNumber' };
export const connectsOf = (s) => Math.max(0, (s.calls || 0) - (s.noAnswer || 0) - (s.wrongNumber || 0));

/** "Made 25 calls today, 9 picked up, 2 booked." */
export function winLine(s) {
  const c = s.calls || 0; const p = connectsOf(s); const b = s.booked || 0;
  return `Made ${c} call${c === 1 ? '' : 's'} today, ${p} picked up, ${b} booked.`;
}

/** Quick callback times. */
export function quickCallbacks(now = new Date()) {
  const at = (d, h, m = 0) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const monday = new Date(now); monday.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  return [
    { id: '1h', label: 'In 1 hour', at: new Date(now.getTime() + 3600e3) },
    { id: 'tm10', label: 'Tomorrow 10am', at: at(tomorrow, 10) },
    { id: 'tm14', label: 'Tomorrow 2pm', at: at(tomorrow, 14) },
    { id: 'mon', label: 'Next Monday', at: at(monday, 10) },
  ];
}
export const toLocalInput = (d) => { const p = (n) => String(n).padStart(2, '0'); return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` }; };
