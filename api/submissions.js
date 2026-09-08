import { getDb } from './_lib/mongo.js';
import { sendPush, sendEmail } from './_lib/notify.js';
import { orderFromSubmission } from './_lib/orders.js';
import { route, clientIp } from './_lib/handler.js';
import { createHash } from 'node:crypto';

// Public endpoint: receives every form submission on the site
// (/start briefs, shop orders, and the review form at /review).

const HOUR = 60 * 60 * 1000;
const REVIEWS_PER_HOUR = 3;
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* One settings document per sender, keyed by a hash of the IP rather than
 * the address itself: enough to count three posts in an hour, not a log of
 * who visited. The window is rolling and the stamps outside it are dropped
 * on every read, so the document never grows. */
async function reviewRateExceeded(db, ip) {
  const _id = `rate:review:${createHash('sha256').update(String(ip)).digest('hex').slice(0, 32)}`;
  const now = Date.now();
  const settings = db.collection('settings');
  let doc = null;
  try { doc = await settings.findOne({ _id }); } catch { return false; } // a read failure never blocks a real review
  const hits = (Array.isArray(doc?.hits) ? doc.hits : []).filter(t => now - Number(t) < HOUR);
  if (hits.length >= REVIEWS_PER_HOUR) return true;
  try {
    await settings.updateOne({ _id }, { $set: { hits: [...hits, now], updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
  } catch { /* counted best effort */ }
  return false;
}

async function handler(req, res) {

  const b = req.body || {};
  const isReview = b.type === 'review';
  const name = String(b.name || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().slice(0, 200);

  /* The review form asks for an email only if they want a reply, so it is
   * optional there and validated only when it is filled in. Every other
   * form still requires a real address; that is how Rob answers them. */
  if (!name) return res.status(400).json({ error: 'name required' });
  if (isReview ? (email && !isEmail(email)) : !isEmail(email)) {
    return res.status(400).json({ error: isReview ? 'that email address is not valid' : 'name and valid email required' });
  }

  if (isReview) {
    const rating = Math.round(Number(b.rating ?? 0));
    if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'a rating of 1 to 5 is required' });
    if (!String(b.text || '').trim()) return res.status(400).json({ error: 'the review itself is required' });
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
    /* The review form's own fields. slug is the published client's showcase
     * slug from /review/<slug>, which is what lets the Reviews screen offer
     * the matching client in one tap. Additive: an older review simply has
     * no slug. */
    doc.fields = {
      ...doc.fields,
      rating: Math.max(1, Math.min(5, Math.round(Number(b.rating ?? doc.fields.rating) || 0))),
      text: String(b.text ?? doc.fields.text ?? '').trim().slice(0, 3000),
      slug: String(b.slug || doc.fields.slug || '').trim().slice(0, 100),
    };
  }

  /* The honeypot: a field positioned off screen and out of the tab order,
   * so only something filling the form programmatically ever puts anything
   * in it. Answer exactly as a success answers, store nothing, and do not
   * even open a database connection over it. */
  if (String(b.company || '').trim()) return res.status(200).json({ ok: true });

  const db = await getDb();

  if (doc.type === 'review' && await reviewRateExceeded(db, clientIp(req))) {
    return res.status(429).json({ error: 'That is a few reviews in one hour. Give it a little while and try again.' });
  }
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
