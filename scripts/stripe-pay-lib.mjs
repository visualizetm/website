/* The per invoice Stripe link and the webhook's match (client portal, prompt 2 fix), as one function over an api/ tree so
 * scripts/stripe-pay-test.mjs runs it on the real source and scripts/stripe-pay-guard-proof.mjs on a copy with one guard
 * cut out. fetch is stubbed: Stripe's prices and payment_links endpoints answer in shape, the email hook answers ok. */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const here = path.dirname(new URL(import.meta.url).pathname);
export const repoRoot = path.resolve(here, '..');
const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[String(k).toLowerCase()] = v; }, end() { this.headersSent = true; } });
const LEAD = '507f1f77bcf86cd799439071';

export async function runStripePay(apiSrc = path.join(repoRoot, 'api')) {
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'stripe-pay-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(apiSrc, apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-not-real'; process.env.STRIPE_SECRET_KEY = 'sk_test_not_real'; process.env.ZAPIER_HOOK_INVOICE = 'https://hooks.example/catch/1/abc'; delete process.env.VERCEL;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const S = await load('_lib/stripe.js');
  const adminIndex = (await load('admin/index.js')).default;
  const { signSession } = await load('_lib/auth.js');
  const results = []; const ok = (c, m, guard = null) => { results.push({ ok: !!c, msg: m, guard }); };
  /* the fetch stub: every call is recorded; Stripe answers a price then a link; the hook answers ok; `fail` makes Stripe refuse */
  const calls = []; let fail = false; let n = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url); const body = String(init.body || ''); calls.push({ url: u, body });
    const json = (o, status = 200) => ({ ok: status < 300, status, json: async () => o });
    if (u.includes('api.stripe.com')) { if (fail) return json({ error: { message: 'refused' } }, 400); n += 1; if (u.endsWith('/prices')) return json({ id: `price_${n}` }); if (u.endsWith('/payment_links')) return json({ id: `plink_${n}`, url: `https://buy.stripe.com/test_${n}` }); return json({}, 404); }
    return json({ ok: true });
  };
  const stripeCalls = () => calls.filter(c => c.url.includes('api.stripe.com'));
  try {
    /* 1. the link: a price for the amount, then a payment link with the ids in its metadata */
    calls.length = 0;
    const made = await S.createPaymentLink({ amount: 350, label: 'Balance', invoiceId: 'inv-1', leadId: LEAD, projectId: 'p1' });
    ok(made && /^https:\/\/buy\.stripe\.com\//.test(made.url) && made.id.startsWith('plink_'), `a link is made: { url, id } (${JSON.stringify(made)})`, 'link-made');
    ok(stripeCalls().length === 2 && stripeCalls()[0].url.endsWith('/prices') && /unit_amount=35000/.test(stripeCalls()[0].body) && /currency=usd/.test(stripeCalls()[0].body), `the price carries the amount in cents (${stripeCalls()[0]?.body})`, 'link-made');
    ok(stripeCalls()[1]?.url.endsWith('/payment_links') && /metadata%5BinvoiceId%5D=inv-1/.test(stripeCalls()[1].body) && new RegExp(`metadata%5BleadId%5D=${LEAD}`).test(stripeCalls()[1].body) && /line_items%5B0%5D%5Bprice%5D=price_1/.test(stripeCalls()[1].body), `the link carries the invoice and lead ids in its metadata (${stripeCalls()[1]?.body})`, 'link-metadata');
    fail = true; calls.length = 0;
    ok((await S.createPaymentLink({ amount: 350, label: 'Balance', invoiceId: 'inv-1', leadId: LEAD })) === null, 'Stripe refusing: null, the caller falls back', 'link-made');
    fail = false;
    delete process.env.STRIPE_SECRET_KEY;
    ok((await S.createPaymentLink({ amount: 350, label: 'Balance', invoiceId: 'inv-1', leadId: LEAD })) === null && (await S.attachPaymentLink({ id: 'inv-1', amount: 350, label: 'Balance' }, { leadId: LEAD })).payUrl === undefined, 'no key: null, and attach leaves the invoice as it was');
    process.env.STRIPE_SECRET_KEY = 'sk_test_not_real';
    ok((await S.createPaymentLink({ amount: 0, label: 'Zero', invoiceId: 'inv-z', leadId: LEAD })) === null, 'a zero amount makes no link');
    calls.length = 0;
    const kept = await S.attachPaymentLink({ id: 'inv-2', amount: 100, label: 'Has one', payUrl: 'https://buy.stripe.com/already', paymentLinkId: 'plink_old' }, { leadId: LEAD });
    ok(kept.payUrl === 'https://buy.stripe.com/already' && stripeCalls().length === 0, 'an invoice that has a link keeps it, no Stripe call', 'link-keep');

    /* 2. the invoice email makes the link, sends it and stores it on the line */
    _reset();
    _stores.call_leads = [{ _id: LEAD, business: 'Sharpless Detailing', askFor: 'Dan', email: 'dan@sharpless.example', stage: 'client', contactLog: [] }];
    _stores.projects = [{ _id: '507f1f77bcf86cd799439081', leadId: LEAD, name: 'Website', kind: 'website', stage: 'design', invoices: [{ id: 'inv-1', label: 'Balance', amount: 350, dueAt: '2026-10-20', status: 'draft', sentAt: '', paidAt: '', note: '' }] }];
    _stores.settings = [{ _id: 'profile', name: 'Rob' }];
    calls.length = 0;
    const cookie = `vz_admin=${signSession()}`;
    const req = { method: 'POST', query: { r: 'send-email' }, body: { kind: 'invoice', leadId: LEAD, projectId: '507f1f77bcf86cd799439081', invoiceId: 'inv-1' }, headers: { cookie, 'x-forwarded-for': '203.0.113.9' }, url: '/api/admin/index', socket: {} };
    const res = fakeRes(); try { await adminIndex(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
    const line = () => _stores.projects[0].invoices.find(i => i.id === 'inv-1');
    const hookCall = calls.find(c => c.url.startsWith('https://hooks.example'));
    ok(res._status === 200 && line().status === 'sent' && /^https:\/\/buy\.stripe\.com\/test_\d+$/.test(line().payUrl || '') && /^plink_\d+$/.test(line().paymentLinkId || ''), `the invoice email makes the link and stores it on the sent line (${res._status}, ${JSON.stringify({ status: line().status, payUrl: line().payUrl })})`, 'link-stored');
    ok(hookCall && line().payUrl && hookCall.body.includes(`"payUrl":"${line().payUrl}"`), 'the email payload carries the same link', 'link-stored');

    /* 3. the webhook's match: the link id first, then the amount, then the oldest open line with the mismatch written on it */
    const seedPay = () => {
      _reset();
      _stores.call_leads = [{ _id: LEAD, business: 'Sharpless Detailing', email: 'dan@sharpless.example', stage: 'client', purchases: [] }];
      _stores.projects = [{ _id: 'p1', leadId: LEAD, name: 'Website', kind: 'website', stage: 'design', invoices: [
        { id: 'a', label: 'Deposit', amount: 350, dueAt: '2026-09-01', status: 'sent', sentAt: '2026-08-30T00:00:00.000Z', paidAt: '', note: '', payUrl: 'https://buy.stripe.com/a', paymentLinkId: 'plink_a' },
        { id: 'b', label: 'Balance', amount: 350, dueAt: '2026-09-15', status: 'sent', sentAt: '2026-09-10T00:00:00.000Z', paidAt: '', note: '', payUrl: 'https://buy.stripe.com/b', paymentLinkId: 'plink_b' },
        { id: 'c', label: 'Extra', amount: 75, dueAt: '2026-09-20', status: 'sent', sentAt: '2026-09-18T00:00:00.000Z', paidAt: '', note: '', extra: true },
        { id: 'd', label: 'Draft', amount: 500, dueAt: '2026-09-01', status: 'draft', sentAt: '', paidAt: '', note: '' },
      ] }];
      _stores.settings = [];
    };
    const { getDb } = await load('_lib/mongo.js'); const db = await getDb();
    const lead = () => _stores.call_leads[0]; const inv = (id) => _stores.projects[0].invoices.find(i => i.id === id);
    const row = (over) => ({ id: `evt_${Math.random().toString(36).slice(2, 8)}`, type: 'checkout.session.completed', amount: 350, description: 'Payment', at: '2026-09-12T10:00:00.000Z', paymentLinkId: '', ...over });
    seedPay();
    let r = await S.applyPayment(db, row({ paymentLinkId: 'plink_b' }), lead());
    ok(r.marked?.itemId === 'b' && inv('b').status === 'paid' && inv('b').ledgerId === r.ledgerId && inv('a').status === 'sent' && !inv('b').stripeMismatch, `the line whose own link was used is paid, even though an older line has the same amount (${r.marked?.itemId})`, 'link-match');
    seedPay();
    r = await S.applyPayment(db, row({ amount: 350 }), lead());
    ok(r.marked?.itemId === 'a' && inv('a').status === 'paid' && !inv('a').stripeMismatch, `no link id: the first open line with the same amount, due or past due (${r.marked?.itemId})`, 'amount-match');
    seedPay();
    r = await S.applyPayment(db, row({ amount: 300 }), lead());
    ok(r.marked?.itemId === 'a' && inv('a').status === 'paid' && /Paid \$300 against \$350/.test(inv('a').stripeMismatch || ''), `no amount matches: the oldest open sent line is paid with the mismatch written on it (${r.marked?.itemId}, ${inv('a').stripeMismatch})`, 'fallback-oldest');
    ok(inv('d').status === 'draft', 'a draft never takes a payment');
    ok(lead().purchases.length === 1 && lead().purchases[0].amount === 300 && lead().purchases[0].id === r.ledgerId, 'the ledger entry carries the real amount paid');
    seedPay();
    r = await S.applyPayment(db, row({ amount: 300 }), lead());
    ok(!!inv('a').stripeMismatch && r.marked?.mismatch === inv('a').stripeMismatch, 'the mismatch note is returned with the mark', 'mismatch-note');
    seedPay(); _stores.projects[0].invoices.forEach(i => { if (i.status === 'sent') { i.status = 'paid'; i.ledgerId = 'old'; } });
    r = await S.applyPayment(db, row({ amount: 300 }), lead());
    ok(!r.marked && lead().purchases.length === 1, 'nothing open: the ledger entry alone, no line touched');
  } finally {
    globalThis.fetch = realFetch;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return results;
}
