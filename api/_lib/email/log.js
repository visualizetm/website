/* The email log (the email system, milestone 1): one document per email the
 * app drafted, queued, sent, failed to send or kept in test mode, in the
 * email_log collection.
 *
 *   { recordId, projectId, invoiceId, templateId, class, to[], cc[], subject,
 *     text, html, status, sendAt, providerId, error, auto, createdAt, sentAt, updatedAt,
 *     approvedAt, approvedBy, override, reason, channel, phone, gmailDraftId, gmailMessageId }
 *
 * status: draft (written for Rob to send: a rule, an event, or Compose's Send
 * before his tap), queued (approved for a later time, sent by the reminders
 * cron once sendAt has passed), sent, failed, test (test mode: nothing left
 * the server). The Drafts rule (email safety): approvedAt and approvedBy are
 * written by api/_lib/email/approve.js alone, after Rob saw the recipient, the
 * subject and the body and tapped Send; nothing is sent without them. override
 * keeps Compose's edits to this one email so the send renders them again;
 * reason says why the draft exists; channel is email, or text for a message
 * Rob sends from Messages (the Drafts screen's Text it); gmailDraftId is the
 * Gmail draft mirrored when Draft into Gmail is on. Indexed on recordId
 * with createdAt and on status with createdAt. Every string is capped so a
 * runaway template cannot grow a document past what the screens show. */
export const EMAIL_STATUS_IDS = ['draft', 'queued', 'sent', 'failed', 'test'];
export const EMAIL_CLASS_IDS = ['marketing', 'transactional'];
export const EMAIL_CHANNEL_IDS = ['email', 'text'];
export const HTML_CAP = 120000; // the renderer keeps an email under 90 KB; the log refuses anything far past it
export const LOG_PAGE = 50;
export const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

const str = (v, max) => String(v ?? '').slice(0, max);
const list = (v, max = 10) => (Array.isArray(v) ? v : v ? [v] : []).map(x => str(x, 200)).filter(Boolean).slice(0, max);
const idStr = (v) => (v == null ? '' : str(typeof v === 'object' && typeof v.toHexString === 'function' ? v.toHexString() : v, 64));

/** Compose's edits to one email, kept on its draft: subject, preheader and blocks (already sanitized by send.js), nothing else. */
const overrideOf = (o) => {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  if (typeof o.subject === 'string') out.subject = str(o.subject, 200);
  if (typeof o.preheader === 'string') out.preheader = str(o.preheader, 200);
  if (Array.isArray(o.blocks)) out.blocks = o.blocks.slice(0, 60);
  return Object.keys(out).length ? out : null;
};
/** The stored shape from any input: what writeLog accepts and nothing else. */
export function logEntry(e = {}, now = new Date()) {
  return {
    recordId: idStr(e.recordId), projectId: idStr(e.projectId), invoiceId: str(e.invoiceId, 40), templateId: str(e.templateId, 40),
    class: EMAIL_CLASS_IDS.includes(e.class) ? e.class : 'transactional',
    to: list(e.to), cc: list(e.cc), subject: str(e.subject, 200), text: str(e.text, 20000), html: str(e.html, HTML_CAP),
    status: EMAIL_STATUS_IDS.includes(e.status) ? e.status : 'draft',
    sendAt: str(e.sendAt, 40), providerId: str(e.providerId, 80), error: str(e.error, 300), auto: !!e.auto, toSelf: !!e.toSelf,
    createdAt: e.createdAt instanceof Date ? e.createdAt : now, sentAt: str(e.sentAt, 40), updatedAt: now,
    approvedAt: str(e.approvedAt, 40), approvedBy: str(e.approvedBy, 20),
    override: overrideOf(e.override), reason: str(e.reason, 200), channel: EMAIL_CHANNEL_IDS.includes(e.channel) ? e.channel : 'email', phone: str(e.phone, 40),
    gmailDraftId: str(e.gmailDraftId, 120), gmailMessageId: str(e.gmailMessageId, 120),
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
/** The Drafts screen's list: everything waiting on Rob (drafts and queued, newest due first), then what went (sent, test, failed) in the last thirty days, no html. */
export async function draftsList(db, { limit = 150, now = Date.now() } = {}) {
  const rows = await db.collection('email_log').find({ toSelf: { $ne: true } }).sort({ createdAt: -1 }).limit(400).project({ html: 0 }).toArray();
  const waiting = rows.filter(r => r.status === 'draft' || r.status === 'queued').sort((a, b) => dueOf(a) - dueOf(b));
  const done = rows.filter(r => ['sent', 'test', 'failed'].includes(r.status) && now - new Date(r.sentAt || r.createdAt).getTime() < 30 * 864e5);
  return [...waiting, ...done].slice(0, limit);
}
const dueOf = (r) => (r.status === 'queued' && r.sendAt ? new Date(r.sendAt).getTime() : new Date(r.createdAt).getTime());
/** The newest entries across every record, failures first, for Settings. */
export async function recentLog(db, { limit = LOG_PAGE } = {}) {
  const rows = await db.collection('email_log').find({}).sort({ createdAt: -1 }).limit(Math.max(1, Math.min(200, limit)) * 2).project({ html: 0 }).toArray();
  return [...rows.filter(r => r.status === 'failed'), ...rows.filter(r => r.status !== 'failed')].slice(0, limit);
}
/** The newest email of this template sent (or kept in test mode) to this record inside the window: the duplicate guard. */
export async function sentWithin(db, { recordId, templateId, ms = DUPLICATE_WINDOW_MS, now = Date.now() } = {}) {
  /* A test to Rob is not a send to the client, so it never makes the real send that follows a duplicate. */
  const rows = await db.collection('email_log').find({ recordId: String(recordId), templateId: String(templateId), status: { $in: ['sent', 'test'] }, toSelf: { $ne: true } }).sort({ createdAt: -1 }).limit(5).project({ html: 0, text: 0 }).toArray();
  return rows.find(r => now - new Date(r.createdAt).getTime() < ms) || null;
}
/** Emails that left (or would have left) in the last hour, from the log. */
export async function sentLastHour(db, now = Date.now()) {
  const rows = await db.collection('email_log').find({ status: { $in: ['sent', 'test'] } }).sort({ createdAt: -1 }).limit(200).project({ createdAt: 1, status: 1 }).toArray();
  return rows.filter(r => now - new Date(r.createdAt).getTime() < 60 * 60 * 1000).length;
}
