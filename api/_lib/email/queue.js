/* Queued sends (the email system, milestone 4). Send tomorrow at 9am queues a
 * log entry with sendAt; the reminders cron, the one thing that runs on its
 * own (13:00 UTC, once a day on the Hobby plan), sends every queued entry
 * whose sendAt falls on or before the run's New York day. The day, not the
 * instant: 9am Eastern is 13:00 UTC in summer and 14:00 in winter, and a
 * morning email must not wait a day for the clocks. With the cron on a
 * fifteen minute schedule (FIFTEEN_MINUTE_MODE in cron-reminders.js) the
 * instant rule applies instead. A failure writes the task and the push
 * (failed.js); the hour's rate guard stops the run and leaves the rest
 * queued for the next one. */
import { zoneDayKey } from '../zone.js';
import { sendLogged } from './send.js';

export const QUEUE_PAGE = 200;

/** The queued entries due: by New York day (the default) or by the instant. */
export async function queuedDue(db, now = Date.now(), { byDay = true } = {}) {
  const today = zoneDayKey(now);
  const rows = await db.collection('email_log').find({ status: 'queued' }).sort({ createdAt: 1 }).limit(QUEUE_PAGE).toArray();
  return rows.filter(r => {
    const at = new Date(r.sendAt || '').getTime();
    if (!Number.isFinite(at)) return false;
    return byDay ? zoneDayKey(at) <= today : at <= now;
  });
}

/** runQueuedSends(db, now, { byDay }) -> { checked, sent, failed, limited }: each due entry through sendLogged, in the order queued. */
export async function runQueuedSends(db, now = Date.now(), opts = {}) {
  const due = await queuedDue(db, now, opts);
  const out = { checked: due.length, sent: 0, failed: 0, limited: false };
  for (const log of due) {
    const r = await sendLogged(db, log);
    if (r.limited) { out.limited = true; break; }
    if (r.ok) out.sent++; else out.failed++;
  }
  return out;
}
