import { getDb } from '../_lib/mongo.js';
import { sendPush } from '../_lib/notify.js';
import { route } from '../_lib/handler.js';

/* Vercel cron (vercel.json). Hobby plan cron jobs must run once daily, so by
 * default this runs at 13:00 UTC / 9am Eastern and sends one morning digest
 * push: every callback due today or overdue, every meeting today, retainer
 * bills due today, and review asks due, as one notification with a deep
 * link to the Dashboard. sentReminderKeys (settings 'notifications'
 * document) dedupes on a single per-day key, so a manual rerun the same day
 * sends nothing.
 *
 * FIFTEEN_MINUTE_MODE is the only thing to flip if the account moves to the
 * Pro plan and near-real-time reminders are wanted back: set it to true
 * here and change vercel.json's reminders schedule back to every 15 minutes
 * (the cron expression this file used before the Hobby plan limit: minute
 * star-slash-15, then a star for every hour, day, month, and weekday).
 * With it true the cron instead pushes one notification per callback within
 * 15 minutes of due and per meeting within 60 minutes of start, each with
 * its own dedupe key, the way this file worked before that limit.
 */
const FIFTEEN_MINUTE_MODE = false;

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const localDate = (l) => { if (!l.meeting?.date) return null; const d = new Date(`${l.meeting.date}T${l.meeting.time || '09:00'}`); return Number.isNaN(d.getTime()) ? null : d; };
const list = (items, more = 5) => items.slice(0, more).join(', ') + (items.length > more ? `, +${items.length - more} more` : '');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-cron-secret'] || '');
  if (!secret || given !== secret) return res.status(401).json({ error: 'unauthorized' });
  const db = await getDb();
  const settings = db.collection('settings');
  const doc = (await settings.findOne({ _id: 'notifications' })) || {};
  const prefs = { meetings: doc.reminders?.meetings !== false, callbacks: doc.reminders?.callbacks !== false, bills: doc.reminders?.bills !== false, reviews: doc.reminders?.reviews !== false };
  const sent = new Set(doc.sentReminderKeys || []);
  const now = new Date();
  const today = dayKey(now);
  const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';

  const leads = await db.collection('call_leads').find({ deleted: { $ne: true }, $or: [{ callStatus: 'callback', callbackAt: { $exists: true, $ne: '' } }, { 'meeting.date': { $exists: true, $ne: '' } }] }).project({ business: 1, callbackAt: 1, callStatus: 1, meeting: 1, stage: 1, phone: 1 }).toArray();

  // Bills and review asks are gathered the same way in both modes.
  const bills = []; // due today
  const reviews = []; // due, until asked
  if (prefs.bills || prefs.reviews) {
    const clients = await db.collection('call_leads').find({ deleted: { $ne: true }, stage: 'client' }).project({ business: 1, retainer: 1, reviews: 1 }).toArray();
    const released = prefs.reviews ? await db.collection('projects').find({ archived: { $ne: true }, releasedAt: { $exists: true, $ne: '' } }).project({ leadId: 1, name: 1, releasedAt: 1 }).toArray() : [];
    for (const l of clients) {
      const r = l.retainer;
      if (prefs.bills && r && ['active', 'ending'].includes(r.status) && String(r.nextBillAt || '').slice(0, 10) === today) bills.push({ _id: l._id, business: l.business, amount: r.amount });
      if (prefs.reviews && !(l.reviews?.asks || []).length) {
        const rel = released.filter(p => String(p.leadId) === String(l._id)).sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt))[0];
        if (rel && now.getTime() - new Date(rel.releasedAt).getTime() >= 3 * 864e5) reviews.push({ _id: l._id, business: l.business, releasedAt: rel.releasedAt, project: rel.name });
      }
    }
  }

  if (FIFTEEN_MINUTE_MODE) {
    // Pro plan: near-real-time, one push per event, each with its own dedupe key.
    const nowMs = now.getTime();
    const due = [];
    for (const l of leads) {
      if (prefs.callbacks && l.callStatus === 'callback' && l.callbackAt) {
        const t = new Date(l.callbackAt).getTime();
        if (t >= nowMs - 60e3 && t <= nowMs + 15 * 60e3) due.push({ key: `cb:${l._id}:${l.callbackAt}`, title: `Call back ${l.business}`, body: `Due ${new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${l.phone ? `, ${l.phone}` : ''}`, url: `${base}/leads?open=${l._id}` });
      }
      if (prefs.meetings && ['booked', 'won', 'client'].includes(l.stage)) {
        const d = localDate(l);
        if (d && d.getTime() >= nowMs - 60e3 && d.getTime() <= nowMs + 60 * 60e3) due.push({ key: `mt:${l._id}:${l.meeting.date}:${l.meeting.time || ''}`, title: `Meeting with ${l.business}`, body: `Starts ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${l.meeting.location ? `, ${l.meeting.location}` : ''}`, url: `${base}/booked?open=${l._id}` });
      }
    }
    for (const b of bills) due.push({ key: `bill:${b._id}:${today}`, title: `Bill ${b.business} today`, body: `$${Number(b.amount || 0).toLocaleString()} retainer bill is due today.`, url: `${base}/clients?open=${b._id}` });
    for (const r of reviews) due.push({ key: `review:${r._id}:${String(r.releasedAt).slice(0, 10)}`, title: `Ask ${r.business} for a review`, body: `${r.project} was released three days ago and nobody has asked yet.`, url: `${base}/reviews?open=${r._id}` });

    const fresh = due.filter(d => !sent.has(d.key));
    for (const d of fresh) { try { await sendPush(db, { title: d.title, body: d.body, url: d.url }); } catch { /* one bad subscription must not stop the rest */ } }
    if (fresh.length) {
      const keys = [...sent, ...fresh.map(d => d.key)].slice(-500);
      await settings.updateOne({ _id: 'notifications' }, { $set: { sentReminderKeys: keys, lastReminderAt: now.toISOString() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    }
    await settings.updateOne({ _id: 'health' }, { $set: { 'crons.reminders': { lastRunAt: now.toISOString(), checked: due.length, sent: fresh.length }, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return res.status(200).json({ ok: true, checked: due.length, sent: fresh.length });
  }

  // Hobby plan: one digest, once a day.
  const callbacks = []; // due today or overdue
  const meetings = []; // today only
  for (const l of leads) {
    if (prefs.callbacks && l.callStatus === 'callback' && l.callbackAt) {
      const t = new Date(l.callbackAt);
      if (!Number.isNaN(t.getTime()) && dayKey(t) <= today) callbacks.push({ business: l.business, overdue: dayKey(t) < today });
    }
    if (prefs.meetings && ['booked', 'won', 'client'].includes(l.stage) && l.meeting?.date === today) {
      const d = localDate(l);
      if (d) meetings.push({ business: l.business, at: d });
    }
  }

  const total = callbacks.length + meetings.length + bills.length + reviews.length;
  const digestKey = `digest:${today}`;
  const alreadySent = sent.has(digestKey);

  if (total && !alreadySent) {
    const title = `Today: ${plural(callbacks.length, 'callback')}, ${plural(meetings.length, 'meeting')}`;
    const parts = [];
    if (callbacks.length) parts.push(`${plural(callbacks.length, 'callback')}: ${list(callbacks.map(c => `${c.business}${c.overdue ? ' (overdue)' : ''}`))}`);
    if (meetings.length) parts.push(`${plural(meetings.length, 'meeting')}: ${list(meetings.map(m => `${m.business} at ${fmtTime(m.at)}`))}`);
    if (bills.length) parts.push(`${plural(bills.length, 'bill')} due: ${list(bills.map(b => `${b.business} $${Number(b.amount || 0).toLocaleString()}`))}`);
    if (reviews.length) parts.push(`${plural(reviews.length, 'review ask')} due: ${list(reviews.map(r => r.business))}`);
    try { await sendPush(db, { title, body: parts.join('. '), url: `${base}/` }); } catch { /* one bad subscription must not stop the digest from being marked sent */ }
    const keys = [...sent, digestKey].slice(-500);
    await settings.updateOne({ _id: 'notifications' }, { $set: { sentReminderKeys: keys, lastReminderAt: now.toISOString() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  }

  const didSend = total > 0 && !alreadySent;
  await settings.updateOne({ _id: 'health' }, { $set: { 'crons.reminders': { lastRunAt: now.toISOString(), checked: total, sent: didSend ? 1 : 0 }, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return res.status(200).json({ ok: true, checked: total, sent: didSend ? 1 : 0 });
}
export default route(handler, { methods: ['GET', 'POST'], admin: false, csrf: false });
