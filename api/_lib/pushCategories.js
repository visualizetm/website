/* Server mirror of src/shared/pushCategories.js. Which pushes Rob wants, as data. Every push the server sends names one category (api/_lib/notify.js sendPush reads it), and Settings >
 * Notifications switches each on or off and sets quiet hours. Mirrored byte for byte in api/_lib/pushCategories.js (a serverless function
 * cannot import src/); scripts/push-prefs-test.mjs asserts the two match. No imports, no clock: the caller says what time it is.
 *
 *   PUSH_CATEGORIES        the seven switches Settings shows, in order
 *   categoriesShape(d)     { reminders: true, ... }: a missing or non-false value is on, so nothing that pushes today goes silent
 *   quietShape(d)          { on, from, to, reminders }: quiet hours, off by default
 *   pushVerdict(prefs, category, hour, min)   '' (send it), 'off' (that category is switched off) or 'quiet' (inside quiet hours)
 *
 * The Test button ('test') and the stale reminders job alarm ('system') are not preferences and always send. Inside quiet hours only the
 * due reminders and meetings (and the two above) pass, unless Rob also silences those ("reminders" in the quiet settings); the rest
 * (payments, new leads, client activity, email, the digest) are not sent, not queued. */
export const PUSH_CATEGORIES = [
  { id: 'reminders', label: 'Reminders', hint: 'A callback, a task or an invoice past due, at its time.' },
  { id: 'meetings', label: 'Meetings', hint: 'A meeting 15 minutes before it starts and when it starts, and Calendly bookings and cancellations.' },
  { id: 'payments', label: 'Payments', hint: 'A payment received, and invoices past due.' },
  { id: 'leads', label: 'New leads', hint: 'The website form, new leads from the scraper and spreadsheet imports.' },
  { id: 'client', label: 'Client activity', hint: 'A client approving, asking for changes, reviewing, answering concepts or sending an idea.' },
  { id: 'email', label: 'Email failures', hint: 'An email that did not send, and emails written for you to send.' },
  { id: 'digest', label: 'Daily digest', hint: 'The summary of the day at 8:30 AM.' },
];
export const PUSH_CATEGORY_IDS = PUSH_CATEGORIES.map(c => c.id);
export const ALWAYS_SENT = ['system', 'test'];
export const QUIET_PASSES = ['reminders', 'meetings'];
export const DEFAULT_QUIET = { on: false, from: '22:00', to: '07:00', reminders: false };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const categoriesShape = (d) => Object.fromEntries(PUSH_CATEGORY_IDS.map(id => [id, !(d && typeof d === 'object') || d[id] !== false]));
export const quietShape = (d) => ({
  on: !!d && d.on === true,
  from: d && HHMM.test(String(d.from)) ? String(d.from) : DEFAULT_QUIET.from,
  to: d && HHMM.test(String(d.to)) ? String(d.to) : DEFAULT_QUIET.to,
  reminders: !!d && d.reminders === true,
});
const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Is the wall clock (hour, min) inside the quiet window? The window may cross midnight (22:00 to 07:00); from equal to is an empty window. */
export function inQuiet(quiet, hour, min) {
  const q = quietShape(quiet);
  if (!q.on) return false;
  const a = minutes(q.from); const b = minutes(q.to); const now = hour * 60 + min;
  if (a === b) return false;
  return a < b ? now >= a && now < b : now >= a || now < b;
}

export function pushVerdict(prefs, category, hour, min) {
  if (ALWAYS_SENT.includes(category)) return '';
  const cats = categoriesShape(prefs && prefs.categories);
  if (PUSH_CATEGORY_IDS.includes(category) && cats[category] === false) return 'off';
  const q = quietShape(prefs && prefs.quiet);
  if (inQuiet(q, hour, min) && !(QUIET_PASSES.includes(category) && !q.reminders)) return 'quiet';
  return '';
}
