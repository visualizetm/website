/* The email log (the email system, milestone 1): one document per email the
 * app drafted, queued, sent, failed to send or kept in test mode, in the
 * email_log collection.
 *
 *   { recordId, projectId, invoiceId, templateId, class, to[], cc[], subject,
 *     text, html, status, sendAt, providerId, error, auto, createdAt, sentAt, updatedAt }
 *
 * status: draft (an automatic rule wrote it for Rob to send), queued (a
 * Send tomorrow, sent by the reminders cron once sendAt has passed), sent,
 * failed, test (test mode: nothing left the server). Indexed on recordId
 * with createdAt and on status with createdAt. Every string is capped so a
 * runaway template cannot grow a document past what the screens show. */
export const EMAIL_STATUS_IDS = ['draft', 'queued', 'sent', 'failed', 'test'];
export const EMAIL_CLASS_IDS = ['marketing', 'transactional'];
export const HTML_CAP = 120000; // the renderer keeps an email under 90 KB; the log refuses anything far past it
export const LOG_PAGE = 50;
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const str = (v, max) => String(v ?? '').slice(0, max);
const list = (v, max = 10) => (Array.isArray(v) ? v : v ? [v] : []).map(x => str(x, 200)).filter(Boolean).slice(0, max);
const idStr = (v) => (v == null ? '' : str(typeof v === 'object' && typeof v.toHexString === 'function' ? v.toHexString() : v, 64));

/** The stored shape from any input: what writeLog accepts and nothing else. */
export function logEntry(e = {}, now = new Date()) {
  return {
    recordId: idStr(e.recordId), projectId: idStr(e.projectId), invoiceId: str(e.invoiceId, 40), templateId: str(e.templateId, 40),
    class: EMAIL_CLASS_IDS.includes(e.class) ? e.class : 'transactional',
    to: list(e.to), cc: list(e.cc), subject: str(e.subject, 200), text: str(e.text, 20000), html: str(e.html, HTML_CAP),
    status: EMAIL_STATUS_IDS.includes(e.status) ? e.status : 'draft',
    sendAt: str(e.sendAt, 40), providerId: str(e.providerId, 80), error: str(e.error, 300), auto: !!e.auto,
    createdAt: e.createdAt instanceof Date ? e.createdAt : now, sentAt: str(e.sentAt, 40), updatedAt: now,
  };
}

const INDEXES = [[{ recordId: 1, createdAt: -1 }], [{ status: 1, createdAt: -1 }]];
/** The two indexes, created once per warm instance (createIndex is idempotent on the server). */
export async function ensureEmailIndexes(db) {
  if (globalThis._vzEmailIdx) return false;
  const col = db.collection('email_log');
  for (const [spec] of INDEXES) { try { await col.createIndex(spec); } catch { /* exists, or the database is down; the write below says so */ } }
  globalThis._vzEmailIdx = true;
  return true;
}

export async function writeLog(db, entry) {
  await ensureEmailIndexes(db);
  const doc = logEntry(entry);
  const r = await db.collection('email_log').insertOne(doc);
  return { ...doc, _id: r.insertedId };
}
export async function updateLog(db, _id, set) {
  await db.collection('email_log').updateOne({ _id }, { $set: { ...set, updatedAt: new Date() } });
}
/** One record's emails, newest first, without the html (the screen asks for one entry's html by id). */
export async function logFor(db, { recordId, projectId = '', limit = LOG_PAGE } = {}) {
  const q = projectId ? { projectId: String(projectId) } : { recordId: String(recordId) };
  return db.collection('email_log').find(q).sort({ createdAt: -1 }).limit(Math.max(1, Math.min(200, limit))).project({ html: 0 }).toArray();
}
export async function logById(db, _id) {
  return db.collection('email_log').findOne({ _id });
}
/** The newest entries across every record, failures first, for Settings. */
export async function recentLog(db, { limit = LOG_PAGE } = {}) {
  const rows = await db.collection('email_log').find({}).sort({ createdAt: -1 }).limit(Math.max(1, Math.min(200, limit)) * 2).project({ html: 0 }).toArray();
  return [...rows.filter(r => r.status === 'failed'), ...rows.filter(r => r.status !== 'failed')].slice(0, limit);
}
/** The newest email of this template sent (or kept in test mode) to this record inside the window: the duplicate guard. */
export async function sentWithin(db, { recordId, templateId, ms = DUPLICATE_WINDOW_MS, now = Date.now() } = {}) {
  const rows = await db.collection('email_log').find({ recordId: String(recordId), templateId: String(templateId), status: { $in: ['sent', 'test'] } }).sort({ createdAt: -1 }).limit(5).project({ html: 0, text: 0 }).toArray();
  return rows.find(r => now - new Date(r.createdAt).getTime() < ms) || null;
}
/** Emails that left (or would have left) in the last hour, from the log. */
export async function sentLastHour(db, now = Date.now()) {
  const rows = await db.collection('email_log').find({ status: { $in: ['sent', 'test'] } }).sort({ createdAt: -1 }).limit(200).project({ createdAt: 1, status: 1 }).toArray();
  return rows.filter(r => now - new Date(r.createdAt).getTime() < 60 * 60 * 1000).length;
}
/** The queued emails whose time has come. */
export async function dueQueued(db, now = new Date()) {
  const rows = await db.collection('email_log').find({ status: 'queued' }).sort({ createdAt: 1 }).limit(200).toArray();
  return rows.filter(r => r.sendAt && new Date(r.sendAt).getTime() <= now.getTime());
}
