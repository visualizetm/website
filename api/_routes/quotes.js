import { ObjectId } from 'mongodb';
import { getDb } from '../_lib/mongo.js';
import { safeUrl } from '../_lib/url.js';
import { cleanLines, listEntry, QUOTE_STATUS_IDS, QUOTE_CAPS, VALID_DAYS } from '../_lib/quoteLines.js';

/* Quotes (the Quotes page): one document per quote, any number per lead.
 *
 *   GET    /api/admin/quotes            { items }: every quote that is not deleted, newest first
 *          ?id=                         { item }
 *          ?leadId=                     { items }: that lead's quotes
 *   POST   { leadId?, lines?, retainerPitch?, note?, privateNote?, validDays? }   { ok, item }: a new quote with the
 *          next number (Q-0001 and up, one atomic step of settings.quotes.quoteCounter)
 *          { from }                     a copy of that quote as a new draft
 *   PATCH  { id, set }                  $set only the keys sent, through sanitize(); a status stamps its own time
 *   DELETE ?id                          soft: deleted true
 *
 * A line from the price list is kept only when its id and its list price are pricing.js's (cleanLines, the rules
 * the editor shares: api/_lib/quoteLines.js mirrors src/shared/quoteLines.js); one line that is not refuses the
 * whole save, so a quote is never stored half. A custom line is held to its caps and its supplier link goes
 * through safeUrl. business and person are copied from the lead when one is attached, never typed here.
 *
 * `by` says who wrote it. Rob's app writes { who: 'rob' }; nothing in this route sends anything. A quote counts as
 * sent when the email drafted for it (emailLogId, written by the editor) has gone out through the send sheet: the
 * read sees the log row turn sent and stamps sentAt and status sent, the same stamp the draft itself gets. */

const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const oid = (v) => { try { return new ObjectId(String(v)); } catch { return null; } };
const hex = (v) => (/^[0-9a-f]{24}$/i.test(String(v || '')) ? String(v) : '');
export const QUOTE_SETTINGS_ID = 'quotes';
export const quoteNumberOf = (n) => `Q-${String(Math.max(1, Math.round(Number(n) || 1))).padStart(4, '0')}`;

/** One atomic step of the counter; the number it answers belongs to the caller alone. */
export async function allocateQuoteNumber(db) {
  const r = await db.collection('settings').findOneAndUpdate(
    { _id: QUOTE_SETTINGS_ID },
    { $inc: { quoteCounter: 1 }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, returnDocument: 'after', includeResultMetadata: true },
  );
  const doc = r && typeof r === 'object' && 'value' in r ? r.value : r;
  return quoteNumberOf(doc?.quoteCounter);
}

/* The schema: a key this does not name is not written. refused counts the lines that may not be kept. */
function sanitize(b) {
  const lines = b.lines !== undefined ? cleanLines(b.lines, safeUrl) : null;
  const days = Math.round(Number(b.validDays));
  return {
    set: {
      leadId: b.leadId !== undefined ? hex(b.leadId) : undefined,
      lines: lines ? lines.lines : undefined,
      retainerPitch: b.retainerPitch !== undefined ? b.retainerPitch !== false : undefined,
      note: b.note !== undefined ? str(b.note, QUOTE_CAPS.note) : undefined,
      privateNote: b.privateNote !== undefined ? str(b.privateNote, QUOTE_CAPS.note) : undefined,
      validDays: b.validDays !== undefined ? (Number.isFinite(days) && days >= 1 ? Math.min(QUOTE_CAPS.validDays, days) : VALID_DAYS) : undefined,
      status: b.status !== undefined ? (QUOTE_STATUS_IDS.includes(b.status) ? b.status : undefined) : undefined,
      emailLogId: b.emailLogId !== undefined ? hex(b.emailLogId) : undefined,
    },
    refused: lines ? lines.refused + (Array.isArray(b.lines) && b.lines.length > QUOTE_CAPS.lines ? 1 : 0) : 0,
  };
}
const compact = (o) => { for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]; return o; };
const REFUSED = 'A line is not on the price list at its list price. Nothing was saved.';

/* Who the quote is for: the lead's own name, read at the write. An id that names no lead is refused. */
async function whoFor(db, leadId) {
  if (!leadId) return { business: '', person: '' };
  const lead = await db.collection('call_leads').findOne({ _id: oid(leadId) });
  if (!lead || lead.deleted) return null;
  return { business: str(lead.business, 160), person: str(lead.askFor || lead.contactName, 120) };
}

/* A draft whose email has gone out is sent: the log row is the proof, and its sentAt is the quote's. */
async function syncSent(db, items) {
  const open = items.filter(q => q.status === 'draft' && q.emailLogId && oid(q.emailLogId));
  if (!open.length) return items;
  const rows = await db.collection('email_log').find({ _id: { $in: open.map(q => oid(q.emailLogId)) }, status: 'sent' }).project({ status: 1, sentAt: 1 }).toArray();
  const sentAt = new Map(rows.map(r => [String(r._id), r.sentAt ? new Date(r.sentAt).toISOString() : new Date().toISOString()]));
  for (const q of open) {
    const at = sentAt.get(String(q.emailLogId));
    if (!at) continue;
    const set = { status: 'sent', sentAt: at, updatedAt: new Date() };
    await db.collection('quotes').updateOne({ _id: q._id, status: 'draft' }, { $set: set });
    Object.assign(q, set);
  }
  return items;
}

/* A copy starts from today's price list: a line whose id has left the list is not carried. */
const relisted = (lines) => (Array.isArray(lines) ? lines : []).map(l => (l && l.kind !== 'custom' ? { ...l, listUnit: listEntry(l.kind, l.id)?.price } : l));

export async function handler(req, res) {
  const db = await getDb();
  const col = db.collection('quotes');

  if (req.method === 'GET') {
    if (req.query?.id !== undefined) {
      const _id = oid(req.query.id);
      const item = _id ? await col.findOne({ _id }) : null;
      if (!item || item.deleted) return res.status(404).json({ error: 'not found' });
      await syncSent(db, [item]);
      return res.status(200).json({ item });
    }
    const filter = { deleted: { $ne: true } };
    if (req.query?.leadId !== undefined) filter.leadId = hex(req.query.leadId) || 'none';
    const items = await col.find(filter).sort({ createdAt: -1 }).limit(500).toArray();
    return res.status(200).json({ items: await syncSent(db, items) });
  }

  if (req.method === 'POST') {
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    let src = b;
    if (b.from !== undefined) {
      const from = oid(b.from) ? await col.findOne({ _id: oid(b.from) }) : null;
      if (!from || from.deleted) return res.status(404).json({ error: 'not found' });
      src = { leadId: from.leadId || '', lines: cleanLines(relisted(from.lines), safeUrl).lines, retainerPitch: from.retainerPitch, note: from.note || '', privateNote: from.privateNote || '', validDays: from.validDays };
    }
    const { set, refused } = sanitize(src);
    if (refused) return res.status(400).json({ error: REFUSED });
    const who = await whoFor(db, set.leadId || '');
    if (!who) return res.status(400).json({ error: 'That lead is not here any more.' });
    const now = new Date();
    const number = await allocateQuoteNumber(db);
    const item = { leadId: '', lines: [], retainerPitch: true, note: '', privateNote: '', validDays: VALID_DAYS, ...compact(set), ...who, number, status: 'draft', emailLogId: '', by: { who: 'rob', at: now.toISOString() }, sentAt: '', decidedAt: '', deleted: false, createdAt: now, updatedAt: now };
    const r = await col.insertOne(item);
    return res.status(200).json({ ok: true, item: { ...item, _id: r.insertedId } });
  }

  if (req.method === 'PATCH') {
    const _id = oid(req.body?.id);
    const body = req.body?.set && typeof req.body.set === 'object' ? req.body.set : null;
    if (!_id || !body) return res.status(400).json({ error: 'id and set required' });
    const before = await col.findOne({ _id });
    if (!before || before.deleted) return res.status(404).json({ error: 'not found' });
    const { set, refused } = sanitize(body);
    if (refused) return res.status(400).json({ error: REFUSED });
    const allowed = {};
    for (const key of Object.keys(set)) if (key in body && set[key] !== undefined) allowed[key] = set[key];
    if (!Object.keys(allowed).length) return res.status(400).json({ error: 'nothing to update' });
    if (allowed.leadId !== undefined && allowed.leadId !== String(before.leadId || '')) {
      const who = await whoFor(db, allowed.leadId);
      if (!who) return res.status(400).json({ error: 'That lead is not here any more.' });
      Object.assign(allowed, who);
    }
    const now = new Date();
    if (allowed.status && allowed.status !== before.status) {
      if (allowed.status === 'sent' && !before.sentAt) allowed.sentAt = now.toISOString();
      if (allowed.status === 'accepted' || allowed.status === 'declined') allowed.decidedAt = now.toISOString();
      else allowed.decidedAt = '';
      if (allowed.status === 'draft') { allowed.sentAt = ''; if (allowed.emailLogId === undefined) allowed.emailLogId = ''; }
    }
    allowed.updatedAt = now;
    await col.updateOne({ _id }, { $set: allowed });
    return res.status(200).json({ ok: true, item: await col.findOne({ _id }) });
  }

  if (req.method === 'DELETE') {
    const _id = oid(req.query?.id);
    if (!_id) return res.status(400).json({ error: 'id required' });
    const before = await col.findOne({ _id });
    if (!before) return res.status(404).json({ error: 'not found' });
    await col.updateOne({ _id }, { $set: { deleted: true, updatedAt: new Date() } });
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
