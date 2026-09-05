import { getDb } from './_lib/mongo.js';
import { sendPush, sendEmail } from './_lib/notify.js';
import { orderFromSubmission } from './_lib/orders.js';
import { route } from './_lib/handler.js';

// Public endpoint: receives every form submission on the site
// (/start briefs, shop orders, and any future inquiry forms).
async function handler(req, res) {

  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().slice(0, 200);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'name and valid email required' });
  }

  const doc = {
    // Prompt 11: 'review' is the website review form (name, rating, text, business), additive.
    type: ['start', 'shop-order', 'contact', 'review'].includes(b.type) ? b.type : 'other',
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

  if (doc.type === 'review') {
    doc.fields = { rating: Math.max(0, Math.min(5, Number(b.rating ?? doc.fields.rating) || 0)), text: String(b.text ?? doc.fields.text ?? '').slice(0, 3000), ...doc.fields };
  }

  const db = await getDb();
  const { insertedId } = await db.collection('submissions').insertOne(doc);
  const id = insertedId.toString();

  // Prompt 11: a shop order is also a print order (orders collection), so the
  // Print Orders screen fills itself in. Best effort; the submission is the record.
  if (doc.type === 'shop-order') {
    try { await db.collection('orders').insertOne(orderFromSubmission({ ...doc, _id: insertedId })); } catch { /* backfilled from the Orders screen */ }
  }

  const kind = doc.type === 'shop-order' ? 'Shop order' : doc.type === 'review' ? 'Review' : `${doc.projectType || 'Project'} inquiry`;
  const who = doc.business || doc.name;

  // Notifications are best-effort, never fail the client's submit over them.
  // Owner preferences (Settings → Notifications) can switch either channel off.
  let prefs = {};
  try { prefs = await db.collection('settings').findOne({ _id: 'prefs' }) || {}; } catch { /* default on */ }
  try {
    await Promise.allSettled([
      prefs.pushEnabled === false ? Promise.resolve() : sendPush(await getDb(), {
        title: `New ${kind}: ${who}`,
        body: `${doc.name} · ${doc.email}`,
        url: `https://admin.visualizeclients.com/?submission=${id}`,
      }),
      prefs.emailEnabled === false ? Promise.resolve() : sendEmail({
        subject: `New ${kind}: ${who}`,
        fromName: doc.name,
        replyTo: doc.email,
        fields: {
          Name: doc.name,
          Business: doc.business || 'n/a',
          Email: doc.email,
          Phone: doc.phone || 'n/a',
          Type: doc.type,
          ...doc.fields,
          'Open in Admin': `https://admin.visualizeclients.com/?submission=${id}`,
        },
      }),
    ]);
  } catch { /* stored, that's what matters */ }

  return res.status(200).json({ ok: true, id });
}
export default route(handler, { methods: ['POST'], admin: false, csrf: false, maxBody: 256 * 1024 });
