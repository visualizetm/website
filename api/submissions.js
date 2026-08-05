import { getDb } from './_lib/mongo.js';
import { sendPush, sendEmail } from './_lib/notify.js';

// Public endpoint: receives every form submission on the site
// (/start briefs, shop orders, and any future inquiry forms).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().slice(0, 200);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'name and valid email required' });
  }

  const doc = {
    type: ['start', 'shop-order', 'contact'].includes(b.type) ? b.type : 'other',
    projectType: String(b.projectType || '').slice(0, 60),
    name,
    business: String(b.business || '').trim().slice(0, 200),
    email,
    phone: String(b.phone || '').trim().slice(0, 60),
    fields: (b.fields && typeof b.fields === 'object') ? b.fields : {},
    status: 'new',
    read: false,
    notes: '',
    createdAt: new Date(),
  };

  const db = await getDb();
  const { insertedId } = await db.collection('submissions').insertOne(doc);
  const id = insertedId.toString();

  const kind = doc.type === 'shop-order' ? 'Shop order' : `${doc.projectType || 'Project'} inquiry`;
  const who = doc.business || doc.name;

  // Notifications are best-effort — never fail the client's submit over them.
  // Owner preferences (Settings → Notifications) can switch either channel off.
  let prefs = {};
  try { prefs = await db.collection('settings').findOne({ _id: 'prefs' }) || {}; } catch { /* default on */ }
  try {
    await Promise.allSettled([
      prefs.pushEnabled === false ? Promise.resolve() : sendPush(await getDb(), {
        title: `New ${kind} — ${who}`,
        body: `${doc.name} · ${doc.email}`,
        url: `https://admin.visualizeclients.com/?submission=${id}`,
      }),
      prefs.emailEnabled === false ? Promise.resolve() : sendEmail({
        subject: `New ${kind} — ${who}`,
        fromName: doc.name,
        replyTo: doc.email,
        fields: {
          Name: doc.name,
          Business: doc.business || '—',
          Email: doc.email,
          Phone: doc.phone || '—',
          Type: doc.type,
          ...doc.fields,
          'Open in Admin': `https://admin.visualizeclients.com/?submission=${id}`,
        },
      }),
    ]);
  } catch { /* stored — that's what matters */ }

  return res.status(200).json({ ok: true, id });
}
