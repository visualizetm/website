import { getDb } from './_lib/mongo.js';
import { sendPush, sendEmail } from './_lib/notify.js';
import { orderFromSubmission } from './_lib/orders.js';
import { route, clientIp } from './_lib/handler.js';
import { rateKey, rateState, rateHit } from './_lib/limit.js';

// Public endpoint: receives every form submission on the site
// (/start briefs, shop orders, and the review form at /review).

const HOUR = 60 * 60 * 1000;
const REVIEWS_PER_HOUR = 3;
const FORMS_PER_HOUR = 10; // start, contact, other: security audit, finding 4
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* Text from the public: trimmed, capped, and with control characters other
 * than newline and tab removed, so nothing that arrives here can carry a
 * CR, an escape sequence or a null into the database, the CSV or an email. */
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);

/* The form's own answers. They used to be stored as whatever object the
 * request sent (any depth, 256KB of it). Now: at most 40 keys, each key up
 * to 60 characters of letters, digits, space, underscore, dot and hyphen,
 * every value a string of up to 3000 characters (an array joins with a
 * comma, anything else is stringified), so the Submissions screen, the CSV
 * export and the email always see flat text. */
const FIELDS_MAX = 40;
const FIELD_KEY = /^[A-Za-z0-9 _.\-]{1,60}$/;
export function normalizeFields(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (Object.keys(out).length >= FIELDS_MAX) break;
    const key = String(k).trim();
    if (!FIELD_KEY.test(key)) continue;
    const text = Array.isArray(v) ? v.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x ?? ''))).join(', ')
      : v && typeof v === 'object' ? JSON.stringify(v)
      : String(v ?? '');
    out[key] = clean(text, 3000);
  }
  return out;
}

async function handler(req, res) {

  const b = (req.body && typeof req.body === 'object') ? req.body : {};
  const isReview = b.type === 'review';
  const name = clean(b.name, 200);
  const email = clean(b.email, 200);

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
    projectType: clean(b.projectType, 60),
    name,
    business: clean(b.business, 200),
    email,
    phone: clean(b.phone, 60),
    fields: normalizeFields(b.fields),
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
      text: clean(b.text ?? doc.fields.text, 3000),
      slug: clean(b.slug || doc.fields.slug, 100).replace(/[^a-z0-9-]/gi, ''),
    };
  }

  /* The honeypot: a field positioned off screen and out of the tab order,
   * so only something filling the form programmatically ever puts anything
   * in it. Answer exactly as a success answers, store nothing, and do not
   * even open a database connection over it. */
  if (String(b.company || '').trim()) return res.status(200).json({ ok: true });

  const db = await getDb();

  /* Every form is rate limited per sender now, not only reviews: ten an
   * hour for a brief or a contact, three for a review, the IP hashed into
   * the key, the window rolling. */
  const key = rateKey(doc.type === 'review' ? 'review' : 'form', clientIp(req));
  const limit = await rateState(db, key, { max: doc.type === 'review' ? REVIEWS_PER_HOUR : FORMS_PER_HOUR, windowMs: HOUR });
  if (limit.exceeded) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: doc.type === 'review' ? 'That is a few reviews in one hour. Give it a little while and try again.' : 'That is a lot of messages in one hour. Give it a little while and try again.' });
  }
  await rateHit(db, key, limit.hits);
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
export default route(handler, { methods: ['POST'], admin: false, maxBody: 128 * 1024 });
