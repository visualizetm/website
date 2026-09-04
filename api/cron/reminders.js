import { getDb } from '../_lib/mongo.js';
import { sendPush } from '../_lib/notify.js';

// Vercel cron, every 15 minutes (vercel.json). Protected by CRON_SECRET:
// Vercel sends Authorization: Bearer <CRON_SECRET>; a manual call may send
// x-cron-secret. Pushes callbacks due in the next 15 minutes and meetings
// starting in the next 60 minutes, once each (sentReminderKeys on the
// settings 'notifications' document).
const localDate = (l) => { if (!l.meeting?.date) return null; const d = new Date(`${l.meeting.date}T${l.meeting.time || '09:00'}`); return Number.isNaN(d.getTime()) ? null : d; };

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  const given = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-cron-secret'] || '');
  if (!secret || given !== secret) return res.status(401).json({ error: 'unauthorized' });
  const db = await getDb();
  const settings = db.collection('settings');
  const doc = (await settings.findOne({ _id: 'notifications' })) || {};
  const prefs = { meetings: doc.reminders?.meetings !== false, callbacks: doc.reminders?.callbacks !== false, bills: doc.reminders?.bills !== false, reviews: doc.reminders?.reviews !== false };
  const sent = new Set(doc.sentReminderKeys || []);
  const now = Date.now();
  const leads = await db.collection('call_leads').find({ deleted: { $ne: true }, $or: [{ callStatus: 'callback', callbackAt: { $exists: true, $ne: '' } }, { 'meeting.date': { $exists: true, $ne: '' } }] }).project({ business: 1, callbackAt: 1, callStatus: 1, meeting: 1, stage: 1, phone: 1 }).toArray();
  const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';
  const due = [];
  for (const l of leads) {
    if (prefs.callbacks && l.callStatus === 'callback' && l.callbackAt) {
      const t = new Date(l.callbackAt).getTime();
      if (t >= now - 60e3 && t <= now + 15 * 60e3) due.push({ key: `cb:${l._id}:${l.callbackAt}`, title: `Call back ${l.business}`, body: `Due ${new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${l.phone ? `, ${l.phone}` : ''}`, url: `${base}/leads?open=${l._id}` });
    }
    if (prefs.meetings && ['booked', 'won', 'client'].includes(l.stage)) {
      const d = localDate(l);
      if (d && d.getTime() >= now - 60e3 && d.getTime() <= now + 60 * 60e3) due.push({ key: `mt:${l._id}:${l.meeting.date}:${l.meeting.time || ''}`, title: `Meeting with ${l.business}`, body: `Starts ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${l.meeting.location ? `, ${l.meeting.location}` : ''}`, url: `${base}/booked?open=${l._id}` });
    }
  }
  // Prompt 12: retainer bills due today (once per bill date) and review asks (3 days after a release, zero asks), once each.
  const pad = (n) => String(n).padStart(2, '0');
  const todayKey = (() => { const x = new Date(); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; })();
  if (prefs.bills || prefs.reviews) {
    const clients = await db.collection('call_leads').find({ deleted: { $ne: true }, stage: 'client' }).project({ business: 1, retainer: 1, reviews: 1 }).toArray();
    const released = prefs.reviews ? await db.collection('projects').find({ archived: { $ne: true }, releasedAt: { $exists: true, $ne: '' } }).project({ leadId: 1, name: 1, releasedAt: 1 }).toArray() : [];
    for (const l of clients) {
      const r = l.retainer;
      if (prefs.bills && r && ['active', 'ending'].includes(r.status) && String(r.nextBillAt || '').slice(0, 10) === todayKey) due.push({ key: `bill:${l._id}:${todayKey}`, title: `Bill ${l.business} today`, body: `$${Number(r.amount || 0).toLocaleString()} retainer bill is due today.`, url: `${base}/clients?open=${l._id}` });
      if (prefs.reviews && !(l.reviews?.asks || []).length) {
        const rel = released.filter(p => String(p.leadId) === String(l._id)).sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt))[0];
        if (rel && new Date(rel.releasedAt).getTime() + 3 * 864e5 <= now) due.push({ key: `review:${l._id}:${String(rel.releasedAt).slice(0, 10)}`, title: `Ask ${l.business} for a review`, body: `${rel.name} was released three days ago and nobody has asked yet.`, url: `${base}/reviews?open=${l._id}` });
      }
    }
  }
  const fresh = due.filter(d => !sent.has(d.key));
  for (const d of fresh) { try { await sendPush(db, { title: d.title, body: d.body, url: d.url }); } catch { /* one bad subscription must not stop the rest */ } }
  if (fresh.length) {
    const keys = [...sent, ...fresh.map(d => d.key)].slice(-500);
    await settings.updateOne({ _id: 'notifications' }, { $set: { sentReminderKeys: keys, lastReminderAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  }
  // Task health stamp (Prompt 12).
  await settings.updateOne({ _id: 'health' }, { $set: { 'crons.reminders': { lastRunAt: new Date().toISOString(), checked: due.length, sent: fresh.length }, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  return res.status(200).json({ ok: true, checked: due.length, sent: fresh.length });
}
