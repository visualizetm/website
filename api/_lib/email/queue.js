/* Queued sends (the email system, milestone 4). Send tomorrow at 9am queues a
 * log entry with sendAt; the reminders cron runs this every 15 minutes (its
 * own gate, minute mode) by the instant rule (byDay: false), so a queued
 * send goes out within a quarter hour of its sendAt. The byDay option stays
 * here for anything that wants the day rule instead (sendAt falls on or
 * before the run's New York day, not the instant: useful when the instant
 * itself is not minute precise). A failure writes the task and the push
 * (failed.js); the hour's rate guard stops the run and leaves the rest
 * queued for the next one. */
import { zoneDayKey } from '../zone.js';
import { sendLogged } from './send.js';

export const QUEUE_PAGE = 200;
export const QUEUE_MAX_AGE_MS = 24 * 3600e3; // the cron's cutoff for a queued send that is already a day late

/** The queued entries due: by New York day (the default) or by the instant. maxAgeMs (the cron passes QUEUE_MAX_AGE_MS) leaves an
 * entry whose sendAt is older than that where it is: still queued, never sent on its own, so a cron that was down for days does not
 * send a pile of old emails the moment it comes back. Rob sends or cancels those from the Emails section. */
export async function queuedDue(db, now = Date.now(), { byDay = true, maxAgeMs = 0 } = {}) {
  const today = zoneDayKey(now);
  const rows = await db.collection('email_log').find({ status: 'queued' }).sort({ createdAt: 1 }).limit(QUEUE_PAGE).toArray();
  return rows.filter(r => {
    const at = new Date(r.sendAt || '').getTime();
    if (!Number.isFinite(at)) return false;
    if (maxAgeMs > 0 && now - at > maxAgeMs) return false;
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
