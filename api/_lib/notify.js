import webpush from 'web-push';

/* Web push, one door. Every send answers what actually happened: { attempted, delivered, removed, errors } (counts and short codes
 * only, never an endpoint or a key). A caller that must not lose a reminder (the minute cron) stamps it handled only when
 * delivered is above zero; the Test button prints the counts. errors holds codes: 'no-vapid', 'bad-vapid', 'no-devices',
 * 'http-<status>' for a refusal by the push service, 'network' for no answer. A 404 or 410 means the device is gone: its row is
 * deleted (removed), and when that was the last owner device the notifications document is flagged pushNeedsResubscribe so the
 * app can subscribe again on its next open. */
let vapidReady = false;
let vapidProblem = '';
function initVapid() {
  if (vapidReady) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) { vapidProblem = 'no-vapid'; return false; }
  try { webpush.setVapidDetails('mailto:contact@visualizeclients.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY); } catch { vapidProblem = 'bad-vapid'; return false; }
  vapidReady = true; vapidProblem = '';
  return true;
}

/* How long the push service may hold a message, and how urgent it is. A due reminder is worthless a quarter of an hour late, so
 * it is told to give up after fifteen minutes and to wake the phone (high); the digest and every other feed item are normal
 * urgency and may wait a while (the digest six hours, the rest a day). The library's own default would hold a push for four weeks. */
export const PUSH_DELIVERY = {
  reminder: { TTL: 15 * 60, urgency: 'high' },
  digest: { TTL: 6 * 3600, urgency: 'normal' },
  event: { TTL: 24 * 3600, urgency: 'normal' },
};
const SEND_TIMEOUT_MS = 10 * 1000; // a push service that does not answer must not hold the minute cron

/* Two kinds of device (client portal, prompt 4): Rob's, saved from the admin with no role, and a client's, saved from their
 * portal with role 'client' and the client's leadId. Rob's pushes go to his devices only; a client's go to that client's only. */
export const ownerSubs = (db) => db.collection('push_subscriptions').find({ role: { $ne: 'client' } }).toArray();
export const clientSubs = (db, leadId) => db.collection('push_subscriptions').find({ role: 'client', leadId: String(leadId) }).toArray();

const nothing = (code) => ({ attempted: 0, delivered: 0, removed: 0, errors: [code] });

// Send a web push to every one of Rob's devices; prune subscriptions that are gone. Answers the counts.
// message: { title, body, url, kind: 'reminder' | 'digest' | 'event' (default), category }.
export async function sendPush(db, message) {
  if (!initVapid()) return nothing(vapidProblem || 'no-vapid');
  const res = await sendTo(db, await ownerSubs(db), message);
  if (res.removed) await flagIfNoDevices(db);
  return res;
}
// Send a web push to one client's devices (the portal's Notifications toggle).
export async function sendClientPush(db, leadId, message) {
  if (!initVapid()) return nothing(vapidProblem || 'no-vapid');
  return sendTo(db, await clientSubs(db, leadId), message);
}
async function flagIfNoDevices(db) {
  try {
    if ((await ownerSubs(db)).length === 0) await db.collection('settings').updateOne({ _id: 'notifications' }, { $set: { pushNeedsResubscribe: true, pushLostAt: new Date().toISOString() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  } catch { /* the flag is a convenience; the prune already happened */ }
}
async function sendTo(db, subs, { title, body, url, kind = 'event' }) {
  const out = { attempted: subs.length, delivered: 0, removed: 0, errors: [] };
  if (!subs.length) { out.errors.push('no-devices'); return out; }
  const payload = JSON.stringify({ title, body, url });
  const opts = { ...(PUSH_DELIVERY[kind] || PUSH_DELIVERY.event), timeout: SEND_TIMEOUT_MS };
  await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s.subscription, payload, opts);
      out.delivered++;
    } catch (err) {
      const code = Number(err?.statusCode) || 0;
      if (code === 404 || code === 410) {
        try { await db.collection('push_subscriptions').deleteOne({ _id: s._id }); } catch { /* the next send prunes it */ }
        out.removed++;
      } else out.errors.push(code ? `http-${code}` : 'network');
    }
  }));
  return out;
}

// Email backup, always on, delivered to contact@visualizeclients.com
// via the Web3Forms key registered to that address.
//
// Security audit, finding 3: `fields` comes from the public form, and
// Web3Forms reads its own controls (the access key, the reply address, the
// subject, a cc list, a redirect) out of the same flat JSON body. A form
// field named access_key or ccemail used to win because it was spread
// last. Now the controls are written after the fields and every field whose
// name is a control, or starts with an underscore, is dropped, so a form
// field can only ever be a form field.
const RESERVED = new Set(['access_key', 'subject', 'from_name', 'email', 'replyto', 'reply_to', 'redirect', 'ccemail', 'cc', 'bcc', 'botcheck', 'name', 'message']);
const reserved = (k) => RESERVED.has(String(k).toLowerCase()) || String(k).startsWith('_');
export async function sendEmail({ subject, fromName, replyTo, fields }) {
  const key = process.env.WEB3FORMS_NOTIFY_KEY;
  if (!key) return;
  const safe = {};
  for (const [k, v] of Object.entries(fields || {})) if (!reserved(k)) safe[k] = v;
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ...safe,
        access_key: key,
        subject,
        from_name: fromName || 'Visualize Website',
        email: replyTo || 'contact@visualizeclients.com',
      }),
    });
  } catch { /* email is best-effort; the submission is already stored */ }
}
