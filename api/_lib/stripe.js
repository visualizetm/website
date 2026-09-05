import crypto from 'crypto';

/* Stripe, read only (Prompt 12). The secret key and the webhook secret come
 * from the environment and nowhere else. Every helper degrades to
 * { configured: false } when a key is missing; nothing throws for that. */

const API = 'https://api.stripe.com/v1';
export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;
export const webhookConfigured = () => !!process.env.STRIPE_WEBHOOK_SECRET;

const CACHE_MS = 5 * 60e3;
const cache = globalThis._vzStripeCache || (globalThis._vzStripeCache = new Map());

/** GET a Stripe list endpoint with a 5 minute cache keyed on the path and params. */
export async function stripeGet(path, params = {}) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { configured: false, data: [] };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) { if (Array.isArray(v)) v.forEach(x => qs.append(`${k}[]`, x)); else if (v !== undefined && v !== null) qs.append(k, String(v)); }
  const url = `${API}${path}?${qs}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return { configured: true, cached: true, ...hit.body };
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { configured: true, error: body?.error?.message || `Stripe ${res.status}`, data: [] };
  cache.set(url, { at: Date.now(), body });
  return { configured: true, cached: false, ...body };
}

/** Stripe-Signature: t=<ts>,v1=<hex>. Signed payload is `${t}.${rawBody}`. */
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(String(header).split(',').map(p => p.split('=').map(x => x.trim())).filter(p => p.length === 2));
  const t = Number(parts.t); const v1 = parts.v1;
  if (!t || !v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ── Matching (mirrors src/lib/events.js matchCalendly order, minus the uri) ── */
const STOP = new Set(['the', 'and', 'of', 'llc', 'inc', 'co', 'company', 'a']);
export const normName = (v) => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).join(' ');
export const last10 = (v) => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };

/** Email, then phone, then normalized business or contact name. Clients first, then any live lead. */
export async function matchClient(db, { email, phone, name }) {
  const col = db.collection('call_leads');
  const live = { deleted: { $ne: true } };
  const e = String(email || '').trim().toLowerCase();
  if (e) {
    const rows = await col.find({ ...live, $or: [{ email: new RegExp(`^${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, { 'afterCall.email': new RegExp(`^${e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }] }).limit(5).toArray();
    const hit = rows.find(r => r.stage === 'client') || rows[0];
    if (hit) return hit;
  }
  const p = last10(phone);
  if (p) {
    const rows = await col.find({ ...live, phone: { $exists: true, $ne: '' } }).project({ phone: 1, stage: 1, business: 1 }).limit(2000).toArray();
    const hit = rows.filter(r => last10(r.phone) === p).sort((a, b) => (a.stage === 'client' ? 0 : 1) - (b.stage === 'client' ? 0 : 1))[0];
    if (hit) return col.findOne({ _id: hit._id });
  }
  const n = normName(name);
  if (n) {
    const rows = await col.find({ ...live, stage: { $in: ['client', 'won'] } }).project({ business: 1, askFor: 1, stage: 1 }).limit(2000).toArray();
    const hit = rows.find(r => normName(r.business) === n || normName(r.askFor) === n);
    if (hit) return col.findOne({ _id: hit._id });
  }
  return null;
}

/* ── Normalizing Stripe objects into stripe_events rows ─────────── */
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const trim = (o) => { try { const s = JSON.stringify(o); return s.length > 4000 ? s.slice(0, 4000) : s; } catch { return ''; } };

/** { id, type, amount, currency, customerEmail, customerName, description, subscriptionId, paymentLinkId, at, raw } from a Stripe event. */
export function normalizeEvent(ev) {
  const o = ev.data?.object || {};
  const details = o.billing_details || o.customer_details || {};
  const amountCents = o.amount_paid ?? o.amount_total ?? o.amount ?? o.amount_captured ?? 0;
  const lineName = o.lines?.data?.[0]?.description || o.lines?.data?.[0]?.price?.nickname || o.line_items?.data?.[0]?.description || '';
  return {
    id: ev.id, type: ev.type,
    amount: Math.round(Number(amountCents) || 0) / 100, currency: String(o.currency || 'usd').toLowerCase(),
    customerEmail: String(o.customer_email || details.email || o.receipt_email || '').toLowerCase().slice(0, 200),
    customerName: String(o.customer_name || details.name || o.shipping?.name || '').slice(0, 200),
    customerPhone: String(details.phone || o.customer_phone || '').slice(0, 60),
    description: String(o.description || lineName || o.statement_descriptor || '').slice(0, 200),
    subscriptionId: String(o.subscription || (o.object === 'subscription' ? o.id : '') || '').slice(0, 80),
    paymentLinkId: String(o.payment_link || '').slice(0, 80),
    at: new Date((ev.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    raw: trim(o),
  };
}

export const PAYMENT_TYPES = ['charge.succeeded', 'invoice.paid', 'checkout.session.completed'];
export const ALL_TYPES = [...PAYMENT_TYPES, 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'];

/** Append the payment to the client's ledger and mark a matching schedule item paid. Idempotent per event id. */
export async function applyPayment(db, row, lead) {
  const leads = db.collection('call_leads');
  const fresh = await leads.findOne({ _id: lead._id });
  if ((fresh.purchases || []).some(p => p.stripeEventId === row.id)) return { ledgerId: (fresh.purchases || []).find(p => p.stripeEventId === row.id).id, already: true };
  const ledgerId = crypto.randomBytes(5).toString('hex');
  const entry = { id: ledgerId, label: row.description || `Stripe ${row.type.split('.')[0]}`, amount: row.amount, at: dayKey(row.at), notes: '', source: 'stripe', stripeEventId: row.id };
  // A schedule item with the same amount, due or past due, becomes paid with this ledger id.
  const projects = db.collection('projects');
  const mine = await projects.find({ leadId: String(lead._id), archived: { $ne: true } }).toArray();
  const today = dayKey(new Date());
  let marked = null;
  for (const p of mine) {
    const item = (p.schedule || []).find(s => s.status !== 'paid' && !s.ledgerId && Math.abs(Number(s.amount) - row.amount) < 0.01 && String(s.dueAt) <= today);
    if (item) {
      entry.projectId = String(p._id);
      await projects.updateOne({ _id: p._id }, { $set: { schedule: p.schedule.map(s => (s.id === item.id ? { ...s, status: 'paid', ledgerId, paidAt: row.at } : s)), updatedAt: new Date() } });
      marked = { projectId: String(p._id), itemId: item.id };
      if (p.kind === 'retainer' && fresh.retainer) {
        const next = p.schedule.filter(s => s.id !== item.id && s.status !== 'paid' && !s.ledgerId).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0];
        await leads.updateOne({ _id: lead._id }, { $set: { 'retainer.nextBillAt': next?.dueAt || '' } });
      }
      break;
    }
  }
  await leads.updateOne({ _id: lead._id }, { $push: { purchases: entry }, $set: { updatedAt: new Date() } });
  return { ledgerId, marked };
}

/** Store (once) and try to match one event. Returns the stored row.
 * Idempotency (Prompt 15): the row is inserted first as a claim under the
 * unique index on id, before any ledger write. A retry that lands while the
 * first delivery is still running hits the duplicate key and returns
 * duplicate: true with no side effects; applyPayment also refuses a second
 * ledger entry for the same event id. */
export async function ingestEvent(db, ev) {
  const col = db.collection('stripe_events');
  try { await col.createIndex({ id: 1 }, { unique: true }); } catch { /* exists */ }
  const row = { ...normalizeEvent(ev), matchedLeadId: '', ledgerId: '', receivedAt: new Date(), processedAt: null };
  try { await col.insertOne(row); } catch (e) { if (e?.code === 11000) return { row: await col.findOne({ id: row.id }), duplicate: true }; throw e; }
  const set = {};
  if (PAYMENT_TYPES.includes(row.type)) {
    const lead = await matchClient(db, { email: row.customerEmail, phone: row.customerPhone, name: row.customerName });
    if (lead) { const r = await applyPayment(db, row, lead); row.matchedLeadId = set.matchedLeadId = String(lead._id); row.ledgerId = set.ledgerId = r.ledgerId; }
  }
  if (row.type === 'customer.subscription.deleted' && row.subscriptionId) {
    const leads = db.collection('call_leads');
    const lead = await leads.findOne({ 'retainer.stripeSubscriptionId': row.subscriptionId });
    if (lead) { await leads.updateOne({ _id: lead._id }, { $set: { 'retainer.status': 'cancelled', 'retainer.nextBillAt': '', 'retainer.stripeCancelledAt': row.at, updatedAt: new Date() } }); row.matchedLeadId = set.matchedLeadId = String(lead._id); }
    const projects = db.collection('projects');
    const p = await projects.findOne({ 'plan.stripeSubscriptionId': row.subscriptionId });
    if (p) { await projects.updateOne({ _id: p._id }, { $set: { 'plan.stripeCancelled': true, 'plan.stripeCancelledAt': row.at, updatedAt: new Date() } }); if (!row.matchedLeadId) row.matchedLeadId = set.matchedLeadId = String(p.leadId); }
  }
  row.processedAt = set.processedAt = new Date();
  await col.updateOne({ id: row.id }, { $set: set });
  return { row, duplicate: false };
}

/** Health counters for the settings 'health' document and the Integrations card. */
export async function stripeHealth(db) {
  const col = db.collection('stripe_events');
  const [last, unmatched] = await Promise.all([
    col.find({}).sort({ receivedAt: -1 }).limit(1).toArray(),
    col.countDocuments({ type: { $in: PAYMENT_TYPES }, matchedLeadId: '' }),
  ]);
  return { configured: stripeConfigured(), webhookConfigured: webhookConfigured(), lastWebhookAt: last[0]?.receivedAt ? new Date(last[0].receivedAt).toISOString() : null, unmatched };
}
