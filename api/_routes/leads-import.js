import { getDb } from '../_lib/mongo.js';

/* ── Normalizers (self-contained; serverless can't import from src/) ── */

const SOCIAL_KEYS = ['website', 'instagram', 'facebook', 'tiktok', 'google', 'yelp', 'linkedin', 'x', 'youtube'];
const TLDS = ['com','net','org','co','io','us','de','biz','app','shop','site','store','me','tv','xyz','info'];
function normalizeSocial(key, raw) {
  let v = String(raw ?? '').trim().replace(/^[<"'\s]+|[>"'\s]+$/g, '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return 'https://' + v;
  const seg = v.split('/')[0]; const dot = seg.lastIndexOf('.');
  if (v.includes('/') || (dot >= 0 && TLDS.includes(seg.slice(dot + 1).toLowerCase()))) return 'https://' + v.replace(/^\/+/, '');
  const h = v.replace(/^@+/, '').replace(/^\/+/, '');
  const M = {
    website: 'https://' + h, instagram: `https://instagram.com/${h}`, facebook: `https://facebook.com/${h}`,
    tiktok: `https://tiktok.com/@${h}`, yelp: `https://yelp.com/biz/${h}`, linkedin: `https://linkedin.com/company/${h}`,
    x: `https://x.com/${h}`, youtube: `https://youtube.com/@${h}`,
    google: `https://www.google.com/maps/search/${encodeURIComponent(h)}`,
  };
  return M[key] || ('https://' + h);
}
const normPriority = (v) => (['hot', 'warm', 'cold'].includes(String(v ?? '').trim().toLowerCase()) ? String(v).trim().toLowerCase() : 'warm');
function normStatus(v) {
  const s = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const M = { not_called: 'not-called', notcalled: 'not-called', new: 'not-called', '': 'not-called',
    callback: 'callback', call_back: 'callback', booked: 'booked', meeting: 'booked',
    no: 'no', denied: 'no', dead: 'no', no_answer: 'no-answer', noanswer: 'no-answer', voicemail: 'no-answer' };
  return M[s] || 'not-called';
}
// Mirror of src/lib/phone.js last10(), serverless can't import from src/.
// Last 10 digits, dropping a leading US country code, so "+1 302 345 0738"
// matches "(302) 345-0738" regardless of stored format.
const digits = (v) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d.slice(-10);
};
const lower = (v) => String(v ?? '').trim().toLowerCase();
const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);

// Standard call-script skeleton for a freshly imported lead (mirrors the client
// defaultLead) so the notepad renders fully.
function buildSkeleton(f) {
  const who = f.askFor || 'the owner';
  return {
    beforeYouDial: [
      'Open their socials / site on your phone',
      'Know cold: what they do, where, and one specific detail to mention',
      'Listening for: what they care about growing, that becomes the pitch',
    ],
    script: {
      confirm: `Hey, is this ${who.replace(/^ask for /i, '')}?`,
      intro: "Hey, I'm Rob. I do branding and websites for local businesses here in Delaware. I know you're probably busy so I'll be quick.",
      homework: `I came across ${f.business} and did my homework before calling. That's actually why I'm reaching out.`,
      question: 'Quick question before I take up more of your time. Who’s handling your website and branding right now?',
      likelyAnswers: [
        { say: 'We just use social media', respond: 'Right, and it works for regulars. But when someone new hears about you and Googles you, a site is what catches them.' },
        { say: 'Somebody set it up a while ago', respond: 'Nice, it got you this far. I’d be bringing it up to where the business actually is now.' },
        { say: 'Nobody, word of mouth', respond: 'Word of mouth is your best asset. A site just catches the people who hear about you but need to see you before they call.' },
      ],
      hook: `So here's how I work. I build concepts before I ever talk numbers. I'd mock up what ${f.business} could look like, a logo, a simple site, and just show you. Free, no strings.`,
      ask: '15 minutes this week? Morning before 8, or evening after 5?',
    },
    objections: [
      { say: 'How much is this?', respond: 'Depends what you actually need. Let me show you the concepts first, then we talk about what makes sense.' },
      { say: 'How old are you?', respond: "20. Which means you're talking to the person actually doing the work, and you're not paying agency overhead." },
      { say: 'Not spending right now', respond: "Not asking you to. The call's free and the concepts are free. You'd just know what's possible when the timing is right." },
    ],
    close: {
      lockIt: "Cool, [day] at [time]. What's the best email to send the calendar invite to?, Confirm the day and time back before hanging up.",
      ifNo: "All good, appreciate you taking the call. Mind if I send the concepts over anyway?, Get the email even on a no. Follow up in 30 days.",
      noAnswer: 'No voicemail on attempt 1. Call back at a different time of day.',
    },
    afterCall: { meeting: '', email: f.email || '', whatTheySaid: '', nextAction: '' },
    intel: { accomplishments: [], gaps: [], dropLines: [] },
  };
}

// A mapped spreadsheet row → the lead fields we store (whitelisted).
function rowToFields(row) {
  const socials = {};
  for (const k of ['website', 'instagram', 'facebook', 'google']) {
    const u = normalizeSocial(k, row[k]);
    if (u) socials[k] = u;
  }
  const descriptorBits = [row.industry, row.area, row.service_interest].map(x => str(x)).filter(Boolean);
  return {
    sourceId: str(row.id, 120) || null,
    business: str(row.business, 200),
    askFor: str(row.owner, 200),
    phone: str(row.phone, 40),
    email: str(row.email, 200),
    area: str(row.area, 160),
    industry: str(row.industry, 80),
    serviceInterest: str(row.service_interest, 200),
    descriptor: descriptorBits.join(' · '),
    priority: normPriority(row.priority),
    callStatus: normStatus(row.status),
    angle: str(row.angle, 1200),
    notes: str(row.notes, 3000),
    socials,
  };
}

export async function handler(req, res) {

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) return res.status(400).json({ error: 'rows array required' });
  if (rows.length > 5000) return res.status(413).json({ error: 'too many rows (max 5000)' });

  const db = await getDb();
  const col = db.collection('call_leads');

  // Load existing (incl. soft-deleted) once for matching.
  const existing = await col.find({}, {
    projection: { business: 1, phone: 1, sourceId: 1, deleted: 1, socials: 1 },
  }).toArray();
  const byId = new Map();
  for (const l of existing) if (l.sourceId) byId.set(String(l.sourceId), l);

  const findMatch = (f) => {
    if (f.sourceId && byId.has(String(f.sourceId))) return byId.get(String(f.sourceId));
    const b = lower(f.business); const p = digits(f.phone);
    if (!b) return null;
    return existing.find(l => lower(l.business) === b && (!p || !digits(l.phone) || digits(l.phone) === p)) || null;
  };

  let created = 0, updated = 0;
  const skipped = [];
  const now = new Date();

  for (const row of rows) {
    const f = rowToFields(row || {});
    if (!f.business) { skipped.push({ business: '(blank)', reason: 'missing business name' }); continue; }

    const match = findMatch(f);

    if (match && match.deleted) {
      skipped.push({ business: f.business, reason: 'previously deleted, left alone' });
      continue;
    }

    if (match) {
      // Update: overwrite only fields the row actually provided; merge socials.
      const set = { updatedAt: now };
      for (const k of ['business', 'askFor', 'phone', 'email', 'area', 'industry', 'serviceInterest', 'angle', 'notes', 'descriptor']) {
        if (f[k]) set[k] = f[k];
      }
      set.priority = f.priority;
      set.callStatus = f.callStatus;
      if (f.sourceId) set.sourceId = f.sourceId;
      if (Object.keys(f.socials).length) set.socials = { ...(match.socials || {}), ...f.socials };
      await col.updateOne({ _id: match._id }, { $set: set });
      updated++;
    } else {
      const doc = { ...f, ...buildSkeleton(f), createdAt: now, updatedAt: now };
      const r = await col.insertOne(doc);
      // Track so two rows for the same new business in one file don't double-insert.
      existing.push({ _id: r.insertedId, business: doc.business, phone: doc.phone, sourceId: doc.sourceId, deleted: false, socials: doc.socials });
      if (doc.sourceId) byId.set(String(doc.sourceId), existing[existing.length - 1]);
      created++;
    }
  }

  return res.status(200).json({ ok: true, created, updated, skipped });
}