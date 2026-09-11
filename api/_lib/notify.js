import webpush from 'web-push';

let vapidReady = false;
function initVapid() {
  if (vapidReady) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails('mailto:contact@visualizeclients.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidReady = true;
  return true;
}

// Send a web push to every subscribed device; prune subscriptions that are gone.
export async function sendPush(db, { title, body, url }) {
  if (!initVapid()) return;
  const subs = await db.collection('push_subscriptions').find({}).toArray();
  const payload = JSON.stringify({ title, body, url });
  await Promise.allSettled(subs.map(async (s) => {
    try {
      await webpush.sendNotification(s.subscription, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await db.collection('push_subscriptions').deleteOne({ _id: s._id });
      }
    }
  }));
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
