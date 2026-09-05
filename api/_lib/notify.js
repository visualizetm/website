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
export async function sendEmail({ subject, fromName, replyTo, fields }) {
  const key = process.env.WEB3FORMS_NOTIFY_KEY;
  if (!key) return;
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: key,
        subject,
        from_name: fromName || 'Visualize Website',
        email: replyTo || 'contact@visualizeclients.com',
        ...fields,
      }),
    });
  } catch { /* email is best-effort; the submission is already stored */ }
}
