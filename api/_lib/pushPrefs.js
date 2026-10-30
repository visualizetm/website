import { pushVerdict } from './pushCategories.js';
import { zoneParts } from './zone.js';

/** Why Settings says this category should not push at this instant: '' (send it), 'off' (the category is switched off) or 'quiet' (quiet hours).
 * Reads the notifications document (categories, quiet) and judges quiet hours on the New York wall clock at nowMs. A read that fails sends:
 * a preference store that is down must never swallow a reminder. notify.js sendPush calls this; the minute cron calls it too, up front, so a
 * silenced reminder is stamped handled instead of being tried again. */
export async function pushSkipReason(db, category, nowMs = Date.now()) {
  if (!category) return '';
  try {
    const doc = await db.collection('settings').findOne({ _id: 'notifications' });
    const p = zoneParts(nowMs);
    return pushVerdict(doc || {}, category, p.h, p.min);
  } catch { return ''; }
}
