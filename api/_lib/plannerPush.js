/* The planner's pushes (Planner v2, part 3). What a client gets on the devices they turned on from the planner or the portal, and
 * the one push Rob gets when a month is all approved. Every client push checks its switch (planner.alerts), the client's quiet hours
 * and the device list, never carries a caption, a budget or anything internal, and is best effort: a push that fails never fails the
 * write that caused it. A push that could be wrong in an edge case is skipped, not sent.
 *
 *   reviewPushTick   posts of a lead moved to review: one push per send, "Rob sent you 3 posts to review", opening Review mode.
 *                    A key per post (rev:<id>) in planner.pushSeen, so a resend of the same post never pushes twice.
 *   todayPushTick    the reminders cron, at 9:00 AM New York (api/_lib/zone.js): an approved post dated today and not posted, one
 *                    push per client per day even with two posts, stamped planner.todayPushedOn with the New York day.
 *   ideaAnsweredPush a suggestion moved to planned or declined: "Rob answered your idea: <subject>", opening Ideas, once (idea:<id>).
 *   monthApprovedPush Rob's: "<Business> approved the whole month", once per lead per month (planner.approvedMonths).
 *
 * Client quiet hours: the client has no setting, so 9 PM to 8 AM New York is quiet. A push that falls there is not sent and not
 * queued, the same rule as Rob's own quiet hours; its keys stay unseen, so the next send carries them. */
import { ObjectId } from 'mongodb';
import { sendClientPush, sendPush } from './notify.js';
import { zoneParts, zoneDayKey } from './zone.js';
import { inQuiet } from './pushCategories.js';

export const SITE = 'https://visualizestudio.org';
export const CLIENT_QUIET = { on: true, from: '21:00', to: '08:00' };
export const TODAY_HOUR = 9;
export const TODAY_UNTIL = 12; // a cron that missed the morning does not send at teatime: past noon the day is stamped and skipped
export const SEEN_KEPT = 200;
/* The senders, swappable so a test can watch them; nothing else writes here. */
export const senders = { client: sendClientPush, rob: sendPush };
/* The clock the route hooks read, swappable for the same reason (a test pins the hour; quiet hours depend on it). */
export const clock = { now: () => Date.now() };

const alertOn = (lead, key) => lead?.planner?.alerts?.[key] !== false;
export const clientQuiet = (now = clock.now()) => { const p = zoneParts(now); return inQuiet(CLIENT_QUIET, p.h, p.min); };
const plannerUrl = (lead, q = '') => `${SITE}/planner/${lead.planner.token}${q}`;
const devicesOf = async (db, leadId) => (await db.collection('push_subscriptions').find({ role: 'client', leadId: String(leadId) }).project({ _id: 1 }).limit(50).toArray()).length;
const PROJECTION = { projection: { business: 1, 'showcase.displayName': 1, planner: 1 } };
const asId = (v) => { if (v && typeof v === 'object') return v; try { return new ObjectId(String(v)); } catch { return null; } };
async function plannerLead(db, leadId) {
  const _id = asId(leadId);
  if (!_id) return null;
  const lead = await db.collection('call_leads').findOne({ _id, deleted: { $ne: true } }, PROJECTION);
  return lead && lead.planner?.enabled && lead.planner?.token ? lead : null;
}
/** Why a client push for this lead and switch would not go: '' (send it), else the reason. */
async function blockedFor(db, lead, key, now) {
  if (!lead) return 'no planner';
  if (!alertOn(lead, key)) return 'switched off';
  if (clientQuiet(now)) return 'quiet';
  if (!(await devicesOf(db, lead._id))) return 'no devices';
  return '';
}

/** Posts of this lead waiting for the client: one push for every one not pushed before. */
export async function reviewPushTick(db, leadId, { now = clock.now() } = {}) {
  const lead = await plannerLead(db, leadId);
  const why = await blockedFor(db, lead, 'review', now);
  if (why) return { sent: false, reason: why };
  const waiting = await db.collection('posts').find({ leadId: String(lead._id), status: 'review', deleted: { $ne: true }, archived: { $ne: true } }).project({ _id: 1 }).limit(200).toArray();
  const seen = new Set(Array.isArray(lead.planner.pushSeen) ? lead.planner.pushSeen : []);
  const fresh = waiting.map(p => `rev:${String(p._id)}`).filter(k => !seen.has(k));
  if (!fresh.length) return { sent: false, reason: 'nothing new' };
  const n = fresh.length;
  const msg = { title: `Rob sent you ${n} ${n === 1 ? 'post' : 'posts'} to review`, body: 'Tap to look at them and say yes or ask for a change.', url: plannerUrl(lead, '?review=1'), tag: `planner-review-${String(lead._id)}` };
  await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { 'planner.pushSeen': [...seen, ...fresh].slice(-SEEN_KEPT) } });
  try { await senders.client(db, String(lead._id), msg); } catch { /* best effort: the keys are stamped so a dead device never earns a repeat */ }
  return { sent: true, fresh: n, message: msg };
}

/** The 9:00 AM New York push for one client: an approved post dated today, not posted. Once a day per client. */
export async function todayPushFor(db, lead, now = Date.now()) {
  const p = zoneParts(now);
  const day = zoneDayKey(now);
  if (!lead?.planner?.enabled || !lead.planner.token) return { sent: false, reason: 'no planner' };
  if (lead.planner.todayPushedOn === day) return { sent: false, reason: 'already today' };
  if (p.h < TODAY_HOUR) return { sent: false, reason: 'before nine' };
  const stamp = () => db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { 'planner.todayPushedOn': day } });
  if (p.h >= TODAY_UNTIL) { await stamp(); return { sent: false, reason: 'past noon' }; }
  const why = await blockedFor(db, lead, 'today', now);
  if (why) { await stamp(); return { sent: false, reason: why }; }
  const due = await db.collection('posts').find({ leadId: String(lead._id), status: 'approved', date: day, deleted: { $ne: true }, archived: { $ne: true } }).project({ _id: 1, kind: 1 }).limit(20).toArray();
  const posts = due.filter(x => (x.kind || 'post') === 'post');
  await stamp();
  if (!posts.length) return { sent: false, reason: 'nothing today' };
  const one = posts.length === 1;
  const msg = { title: one ? 'Your post goes up today' : `${posts.length} posts go up today`, body: one ? 'Open it to post it in 4 taps.' : 'Open your planner to post them in 4 taps.', url: plannerUrl(lead, one ? `?post=${String(posts[0]._id)}` : ''), tag: `planner-today-${String(lead._id)}`, kind: 'reminder' };
  try { await senders.client(db, String(lead._id), msg); } catch { /* best effort */ }
  return { sent: true, count: posts.length, message: msg };
}
/** The cron's sweep: every client with a planner on and a device, one check each. */
export async function todayPushSweep(db, now = Date.now()) {
  const p = zoneParts(now);
  if (p.h < TODAY_HOUR) return { checked: 0, sent: 0 };
  const day = zoneDayKey(now);
  const leads = await db.collection('call_leads').find({ deleted: { $ne: true }, 'planner.enabled': true, 'planner.todayPushedOn': { $ne: day } }).project({ business: 1, 'showcase.displayName': 1, planner: 1 }).limit(500).toArray();
  let sent = 0;
  for (const l of leads) { try { const r = await todayPushFor(db, l, now); if (r.sent) sent += 1; } catch { /* one client's failure never stops the sweep */ } }
  return { checked: leads.length, sent };
}

/** An idea Rob answered (planned or declined): one push, once, with the client's own subject. */
export async function ideaAnsweredPush(db, suggestion, { now = clock.now() } = {}) {
  if (!suggestion || !['planned', 'declined'].includes(suggestion.status)) return { sent: false, reason: 'not answered' };
  const lead = await plannerLead(db, suggestion.leadId);
  const why = await blockedFor(db, lead, 'ideas', now);
  if (why) return { sent: false, reason: why };
  const key = `idea:${String(suggestion._id)}`;
  const seen = Array.isArray(lead.planner.pushSeen) ? lead.planner.pushSeen : [];
  if (seen.includes(key)) return { sent: false, reason: 'already pushed' };
  const subject = String(suggestion.subject || '').trim().slice(0, 60) || 'your idea';
  const msg = { title: `Rob answered your idea: ${subject}`, body: 'Open Ideas to see what he said.', url: plannerUrl(lead, '?tab=ideas'), tag: `planner-idea-${String(suggestion._id)}` };
  await db.collection('call_leads').updateOne({ _id: lead._id }, { $set: { 'planner.pushSeen': [...seen, key].slice(-SEEN_KEPT) } });
  try { await senders.client(db, String(lead._id), msg); } catch { /* best effort */ }
  return { sent: true, message: msg };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DONE = ['approved', 'posted', 'live', 'finished'];
/** Rob's push when the client has approved everything in a month: every live item of the month past review, once per lead per month. */
export async function monthApprovedPush(db, lead, month) {
  if (!lead || !/^\d{4}-\d{2}$/.test(String(month || ''))) return { sent: false, reason: 'no month' };
  const had = Array.isArray(lead.planner?.approvedMonths) ? lead.planner.approvedMonths : [];
  if (had.includes(month)) return { sent: false, reason: 'already said' };
  const items = await db.collection('posts').find({ leadId: String(lead._id), month, deleted: { $ne: true }, archived: { $ne: true } }).project({ status: 1 }).limit(200).toArray();
  if (!items.length || !items.every(x => DONE.includes(x.status))) return { sent: false, reason: 'not all approved' };
  await db.collection('call_leads').updateOne({ _id: lead._id }, { $push: { 'planner.approvedMonths': { $each: [month], $slice: -24 } } });
  const name = lead.showcase?.displayName || lead.business || 'A client';
  const base = process.env.ADMIN_URL || 'https://admin.visualizeclients.com';
  const msg = { title: `${name} approved the whole month`, body: `Everything for ${MONTHS[Number(month.slice(5)) - 1]} is approved.`, url: `${base}/clients/${String(lead._id)}/planner`, category: 'client', tag: `planner-month-${String(lead._id)}-${month}` };
  try { await senders.rob(db, msg); } catch { /* best effort */ }
  return { sent: true, message: msg };
}
