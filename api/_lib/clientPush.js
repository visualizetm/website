/* Client pushes (portal prompt 4). One push per client at most every six hours, batched: whatever is new since the last push
 * goes out as one message (things to do, things to approve, files ready, invoices sent). The keys of what has been pushed
 * live on the record as portal.pushSeen; a new key is a reason to push, a seen one never is. clientPushTick runs after the
 * writes that can add a key (a client task, an approval, an invoice sent, a payment, a project's deliverables) and the
 * reminders cron sweeps every client with a device, so a push held back by the six hour rule goes out on the next sweep. */
import { clientItems, approvalsOf, filesProject, paidInFull, portalPath, clientProjects } from './portalModules.js';
import { invoicesOf } from './invoices.js';
import { sendClientPush } from './notify.js';

export const CLIENT_PUSH_GAP_MS = 6 * 60 * 60 * 1000;
export const PUSH_SEEN_KEPT = 200;
export const SITE = 'https://visualizestudio.org';
/* The sender, swappable so a test can watch it; nothing else writes here. */
export const senders = { client: sendClientPush };

const isPaidLine = (l) => l?.status === 'paid' || !!l?.ledgerId;

/** Every key that could earn a push right now, from what the portal shows. */
export function clientPushKeys(lead, projects, now = Date.now()) {
  const keys = [];
  for (const it of clientItems(lead, projects)) keys.push(`needs:${it.id}`);
  for (const a of approvalsOf(lead, now)) if (a.status === 'pending') keys.push(`appr:${a.id}:${a.requestedAt || ''}`);
  const fp = filesProject(lead, projects);
  if (fp && paidInFull(fp, now)) keys.push(`files:${String(fp._id)}`);
  for (const p of clientProjects(lead, projects)) for (const l of invoicesOf(p)) if (l.sentAt && l.status !== 'draft' && !isPaidLine(l)) keys.push(`inv:${l.id}:${l.sentAt}`);
  return keys;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
/** The one message for a set of fresh keys. */
export function clientPushMessage(lead, fresh) {
  const n = (prefix) => fresh.filter(k => k.startsWith(prefix)).length;
  const needs = n('needs:'); const appr = n('appr:'); const files = n('files:'); const inv = n('inv:');
  const parts = [];
  if (needs) parts.push(plural(needs, 'thing to do', 'things to do'));
  if (appr) parts.push(plural(appr, 'thing to approve', 'things to approve'));
  if (files) parts.push('your files are ready');
  if (inv) parts.push(plural(inv, 'invoice to pay', 'invoices to pay'));
  const onlyFiles = files && !needs && !appr && !inv;
  const body = parts.length ? parts.join(', ').replace(/^./, c => c.toUpperCase()) + '.' : 'Open your portal.';
  return { title: onlyFiles ? 'Your files are ready' : 'Rob needs something from you', body, url: `${SITE}${portalPath(lead)}` };
}

/** Push this client once if something is new and six hours have passed since the last push. */
export async function clientPushTick(db, leadId, { now = Date.now() } = {}) {
  const leads = db.collection('call_leads');
  const lead = await leads.findOne({ _id: leadId, deleted: { $ne: true } }, { projection: { business: 1, portal: 1, checklists: 1 } });
  if (!lead || !(Number(lead.portal?.pushDevices) > 0) || !portalPath(lead)) return { sent: false, reason: 'no devices' };
  const projects = await db.collection('projects').find({ leadId: String(lead._id) }).project({ leadId: 1, name: 1, kind: 1, stage: 1, archived: 1, createdAt: 1, invoices: 1, deliveredAt: 1, deliverables: 1, checklists: 1 }).limit(50).toArray();
  const keys = clientPushKeys(lead, projects, now);
  const seen = new Set(Array.isArray(lead.portal.pushSeen) ? lead.portal.pushSeen : []);
  const fresh = keys.filter(k => !seen.has(k));
  if (!fresh.length) return { sent: false, reason: 'nothing new' };
  const last = Date.parse(lead.portal.lastClientPushAt || '') || 0;
  if (now - last < CLIENT_PUSH_GAP_MS) return { sent: false, reason: 'within six hours', pending: fresh.length };
  const msg = clientPushMessage(lead, fresh);
  try { await senders.client(db, String(lead._id), msg); } catch { /* a dead device must not stop the stamp; the next sweep tries again for new keys only */ }
  await leads.updateOne({ _id: lead._id }, { $set: { 'portal.pushSeen': [...seen, ...fresh].slice(-PUSH_SEEN_KEPT), 'portal.lastClientPushAt': new Date(now).toISOString() } });
  return { sent: true, fresh: fresh.length, message: msg };
}

/** The cron's sweep: every client with a device, one tick each. */
export async function clientPushSweep(db, now = Date.now()) {
  const leads = await db.collection('call_leads').find({ deleted: { $ne: true }, 'portal.pushDevices': { $gt: 0 } }).project({ _id: 1 }).limit(500).toArray();
  let sent = 0;
  for (const l of leads) { try { const r = await clientPushTick(db, l._id, { now }); if (r.sent) sent += 1; } catch { /* one client's failure never stops the sweep */ } }
  return { checked: leads.length, sent };
}
