/* What the screens say about push, as pure functions over what the settings GET answers (health.crons.reminders, push, reminders)
 * and what this device knows. One place for the numbers: the Settings card, the stale cron alarm on Settings and the home, and
 * the Test button's message all read here, so they cannot disagree.
 *
 *   ARMED_MS     the reminders cron has run this recently for the app to say Armed
 *   STALE_MS     past this with no run the red alarm shows (the cron runs every minute)
 *   reminderHealth(health, now)   -> { lastRunAt, ageMs, ranRecently, stale, runs, lastPushAt, lastPushError, failed, retrying, devices }
 *   armedState({ health, keysSet, subscribed, now })   -> { armed, label, missing: [..], why }
 *   testMessage(result)           -> { tone: 'success' | 'warning' | 'error', text } for the Test button
 *   nextRunText(health, now)      -> what the Next run cell says
 *   alarmText(health, now)        -> the stale alarm's one line, or '' when the cron is keeping its pace
 *   planPushSync({ supported, permission, hasSubscription, force }) -> what the app does about push when it opens */
export const ARMED_MS = 3 * 60e3;
export const STALE_MS = 10 * 60e3;
export const RUNS_SHOWN = 5;

const ms = (iso) => { const t = Date.parse(iso || ''); return Number.isFinite(t) ? t : 0; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function reminderHealth(health, now = Date.now()) {
  const r = health?.crons?.reminders || {};
  const lastRunAt = typeof r.lastRunAt === 'string' ? r.lastRunAt : '';
  const t = ms(lastRunAt);
  const ageMs = t ? Math.max(0, now - t) : Infinity;
  const runs = (Array.isArray(r.runs) ? r.runs : []).map(ms).filter(Boolean).sort((a, b) => b - a).slice(0, RUNS_SHOWN);
  return {
    lastRunAt, ageMs, ranRecently: ageMs <= ARMED_MS, stale: ageMs > STALE_MS, runs,
    lastPushAt: typeof r.lastPushAt === 'string' ? r.lastPushAt : '', lastPushError: typeof r.lastPushError === 'string' ? r.lastPushError : '',
    failed: Number(r.failed) || 0, retrying: Number(r.retrying) || 0, devices: Number.isFinite(Number(r.devices)) ? Number(r.devices) : null,
  };
}

/** Armed means all three: the cron ran in the last three minutes, the server has push keys, and this device is subscribed. */
export function armedState({ health, keysSet, subscribed, now = Date.now() }) {
  const h = reminderHealth(health, now);
  const missing = [];
  if (!h.ranRecently) missing.push('cron');
  if (!keysSet) missing.push('keys');
  if (!subscribed) missing.push('device');
  const armed = missing.length === 0;
  const why = armed ? 'The reminders job ran in the last three minutes, the server has push keys and this device is subscribed.'
    : missing.map(m => (m === 'cron' ? (h.lastRunAt ? `the reminders job last ran ${ago(h.ageMs)}` : 'the reminders job has never run') : m === 'keys' ? 'the server has no push keys' : 'this device is not subscribed')).join('; ').replace(/^./, c => c.toUpperCase()) + '.';
  return { armed, label: armed ? 'Armed' : 'Not armed', missing, why };
}

export function ago(ageMs) {
  if (!Number.isFinite(ageMs)) return 'never';
  const m = Math.floor(ageMs / 60e3);
  if (m < 1) return 'less than a minute ago';
  if (m < 60) return `${plural(m, 'minute', 'minutes')} ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${plural(h, 'hour', 'hours')} ago`;
  return `${plural(Math.floor(h / 24), 'day', 'days')} ago`;
}

export function nextRunText(health, now = Date.now()) {
  const h = reminderHealth(health, now);
  return h.ranRecently ? 'Within a minute' : h.lastRunAt ? 'Not running' : 'Not running yet';
}

/** The red alarm's line: empty while the cron keeps its pace (a run in the last ten minutes). */
export function alarmText(health, now = Date.now(), clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) {
  const h = reminderHealth(health, now);
  if (!h.stale) return '';
  return h.lastRunAt ? `Reminders have not run since ${clock(h.lastRunAt)}. Pushes will not arrive until they do.` : 'Reminders have never run. Pushes will not arrive until they do.';
}

const CODE_TEXT = {
  'no-vapid': 'The server has no push keys (VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY).',
  'bad-vapid': 'The server\'s push keys were refused. Check VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.',
  'no-devices': 'No device is subscribed yet. Tap Enable push on this device.',
  network: 'The push service did not answer. Try again in a minute.',
  'push-error': 'The server could not send it.',
};

/** The Test button's message from what the route answered: { attempted, delivered, removed, errors }. */
export function testMessage(r) {
  if (!r || typeof r !== 'object') return { tone: 'error', text: 'Could not send the test.' };
  const attempted = Number(r.attempted) || 0; const delivered = Number(r.delivered) || 0; const removed = Number(r.removed) || 0;
  const errors = Array.isArray(r.errors) ? r.errors : [];
  const gone = removed ? ` ${plural(removed, 'device was', 'devices were')} no longer valid and removed.` : '';
  if (delivered > 0) return { tone: delivered === attempted ? 'success' : 'warning', text: `Sent to ${delivered} of ${plural(attempted, 'device', 'devices')}.${gone}` };
  const first = errors[0] || '';
  if (CODE_TEXT[first]) return { tone: 'error', text: CODE_TEXT[first] };
  if (removed) return { tone: 'error', text: `Nothing was delivered.${gone} Tap Enable push on this device to subscribe again.` };
  if (/^http-/.test(first)) return { tone: 'error', text: `Nothing was delivered: the push service refused it (${first.replace('http-', '')}).` };
  return { tone: 'error', text: 'Nothing was delivered.' };
}

/** What the app does about push on open. Never prompts (a prompt needs a tap): a device that has not allowed notifications is left
 * to the Settings button. Allowed, it makes sure a subscription exists and saves it again (the server upserts on the endpoint, so
 * a row the server pruned comes back); when the server says it removed the last device (force) the old subscription is dropped
 * and a fresh one made, because a gone endpoint would only be pruned again. */
export function planPushSync({ supported, permission, hasSubscription, force }) {
  if (!supported) return 'skip';
  if (permission !== 'granted') return 'skip';
  if (!hasSubscription) return 'subscribe';
  return force ? 'resubscribe' : 'resave';
}
