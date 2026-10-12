/* The client portal checks (client portal, prompt 1), as one function over an api/ tree so
 * scripts/portal-test.mjs runs them on the real source and scripts/portal-guard-proof.mjs
 * runs them on a copy with one guard cut out. Every check carries the guard it proves, or
 * null for a plain assertion. */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const here = path.dirname(new URL(import.meta.url).pathname);
export const repoRoot = path.resolve(here, '..');

const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[String(k).toLowerCase()] = v; }, end() { this.headersSent = true; } });
const LEAD = '507f1f77bcf86cd799439061';
const OTHER = '507f1f77bcf86cd799439062';
/* The prompt's forbidden keys: no card payload may carry any of them. */
export const FORBIDDEN_KEYS = ['_id', 'email', 'phone', 'purchases', 'invoices', 'notes', 'checklists', 'ledgerId', 'note', 'stripeEventId', 'schedule', 'link', 'deliverables', 'testimonials', 'asks', 'token'];
const PRIVATE = ['555-0199', 'owner@sharpless.example', 'internal only note', 'https://drive.example/private', LEAD, 'inv-9001', 'purchase-77', 'ledger-77'];
const keysDeep = (v, out = new Set()) => { if (Array.isArray(v)) v.forEach(x => keysDeep(x, out)); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.add(k); keysDeep(x, out); } return out; };

export async function runPortal(apiSrc = path.join(repoRoot, 'api')) {
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'portal-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(apiSrc, apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-not-real'; delete process.env.VERCEL; delete process.env.VAPID_PRIVATE_KEY; delete process.env.CALENDLY_MEETING_LINK;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const showcase = (await load('showcase.js')).default;
  const adminIndex = (await load('admin/index.js')).default;
  const { signSession } = await load('_lib/auth.js');
  const reg = await load('_lib/portalModules.js');
  const results = [];
  const ok = (c, m, guard = null) => { results.push({ ok: !!c, msg: m, guard }); };
  const cookie = `vz_admin=${signSession()}`;
  const admin = async (body, r = 'call-leads', method = 'PATCH') => { const req = { method, query: { r }, body, headers: { cookie, 'x-forwarded-for': '203.0.113.9' }, url: '/api/admin/index', socket: {} }; const res = fakeRes(); try { await adminIndex(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; } return res; };
  const pub = async (method, query = {}, body, headers = {}) => { const req = { method, query: { r: 'portal', ...query }, body, headers: { 'x-forwarded-for': '203.0.113.9', ...headers }, url: '/api/portal', socket: {} }; const res = fakeRes(); try { await showcase(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; } return res; };
  const lead = () => _stores.call_leads.find(l => String(l._id) === LEAD);
  const profile = () => _stores.settings.find(s => s._id === 'profile');
  const seed = () => {
    _reset();
    _stores.call_leads = [
      { _id: LEAD, business: 'Sharpless Detailing', stage: 'client', askFor: 'Dan the owner', phone: '555-0199', email: 'owner@sharpless.example', notes: 'internal only note', links: { drive: 'https://drive.example/private' }, purchases: [{ id: 'purchase-77' }], invoices: [{ id: 'inv-9001' }], brand: { primary: '#1d4ed8', colors: ['#fff'] }, showcase: { published: true, slug: 'sharpless-detailing', displayName: 'Sharpless Detailing', logoUrl: 'https://img.example/sharpless.png' }, checklists: [{ id: 'l1', name: 'Kickoff', tasks: [] }] },
      { _id: OTHER, business: 'SS Guns and Ammo', stage: 'client', showcase: { published: false, slug: '' }, checklists: [] },
    ];
    _stores.projects = [
      { _id: 'p1', leadId: LEAD, name: 'Website', kind: 'website', stage: 'design', createdAt: '2026-09-01T00:00:00.000Z', invoices: [
        { id: 'inv-9000', label: 'Deposit', amount: 350, dueAt: '2026-09-01', status: 'paid', sentAt: '2026-08-30T00:00:00.000Z', paidAt: '2026-09-01T12:00:00.000Z', note: 'internal only note', ledgerId: 'ledger-77' },
        { id: 'inv-9001', label: 'Balance', amount: 350, dueAt: '2026-10-20', status: 'sent', sentAt: '2026-10-01T00:00:00.000Z', paidAt: '', note: 'internal only note' },
      ] },
      { _id: 'p0', leadId: LEAD, name: 'Old logo', kind: 'brand', stage: 'delivered', deliveredAt: '2026-02-01T00:00:00.000Z', createdAt: '2026-01-01T00:00:00.000Z', invoices: [{ id: 'inv-8000', label: 'Logo', amount: 300, dueAt: '2026-01-05', status: 'paid', sentAt: '2026-01-01T00:00:00.000Z', paidAt: '2026-01-05T00:00:00.000Z' }] },
    ];
    _stores.settings = [{ _id: 'profile', name: 'Rob', phone: '555 0100', email: 'contact@visualizeclients.com', calendlyLink: 'https://calendly.com/visualize/call', hours: 'Weekdays 9 to 5',
      payMethods: { stripe: 'https://buy.stripe.com/test', cashapp: 'visualize', venmo: 'visualize', zelle: 'pay@visualizeclients.com', zelleKind: 'email' }, retainerLinks: { 'content-kit': 'https://buy.stripe.com/content-kit', 'site-care': '', growth: '', 'ad-creatives': '' } }];
  };
  const cardIds = (res) => (res._json?.cards || []).map(c => c.id).join(',');
  const card = (res, id) => (res._json?.cards || []).find(c => c.id === id);

  /* 1. the mirror and the registry contract */
  const body = (p) => fs.readFileSync(p, 'utf8').split('export const PORTAL_MODULE_IDS')[1];
  ok(body(path.join(repoRoot, 'src', 'shared', 'portalModules.js')) === body(path.join(apiSrc, '_lib', 'portalModules.js')), 'api/_lib/portalModules.js is src/shared/portalModules.js below PORTAL_MODULE_IDS');
  ok(reg.PORTAL_MODULES.every(m => typeof m.id === 'string' && typeof m.title === 'string' && Number.isFinite(m.order) && typeof m.sensitive === 'boolean' && reg.PORTAL_STATE_IDS.includes(m.defaultState) && typeof m.auto === 'string' && Array.isArray(m.fields) && typeof m.resolve === 'function'), 'every module carries id, title, order, sensitive, defaultState, auto, fields and resolve');
  ok(reg.PORTAL_MODULES.map(m => m.id).sort().join(',') === [...reg.PORTAL_MODULE_IDS].sort().join(','), 'PORTAL_MODULE_IDS names exactly the registered modules');
  ok(Object.keys(reg.PORTAL_TEMPLATES).sort().join(',') === [...reg.PORTAL_TEMPLATE_IDS].sort().join(',') && Object.values(reg.PORTAL_TEMPLATES).every(t => Object.entries(t).every(([k, v]) => reg.PORTAL_MODULE_IDS.includes(k) && k !== 'home' && reg.PORTAL_STATE_IDS.includes(v))), 'the three templates set only known modules to known states, never home');

  /* 2. the token: minted on the first ask, 24 characters, carried forward, regenerated on request, the old link dead */
  seed();
  let r = await admin({ id: LEAD, set: { portal: {} } });
  const t1 = lead().portal?.token;
  ok(r._status === 200 && typeof t1 === 'string' && t1.length === 24 && /^[A-Za-z0-9_-]+$/.test(t1), `Generate portal link mints a 24 character URL safe token (${r._status}, ${t1})`, 'mint');
  ok(lead().portal.views === 0 && lead().portal.createdAt && lead().portal.regeneratedAt === '' && lead().portal.pin === '' && Array.isArray(lead().portal.documents), 'views start at 0, createdAt is stamped, regeneratedAt and pin empty, documents an array');
  r = await admin({ id: LEAD, set: { portal: { token: 'attacker-chosen-token-123456', views: 99, lastViewedAt: '2020-01-01', createdAt: '1999-01-01' } } });
  ok(lead().portal.token === t1 && lead().portal.views === 0 && !lead().portal.lastViewedAt && lead().portal.createdAt !== '1999-01-01', 'a later portal write carries the token forward and never takes the token, views, lastViewedAt or createdAt from the request', 'carry-forward');
  r = await admin({ id: LEAD, set: { portal: { regenerate: true } } });
  const t2 = lead().portal.token;
  ok(t2 && t2 !== t1 && t2.length === 24 && lead().portal.regeneratedAt, 'Regenerate mints a new token and stamps regeneratedAt', 'regenerate');
  let dead = await pub('GET', { token: t1 });
  let live = await pub('GET', { token: t2 });
  ok(dead._status === 404 && live._status === 200, `the old token is dead (${dead._status}) and the new one resolves (${live._status})`, 'token-dead');
  const none = await pub('GET', {}); const mal = await pub('GET', { token: 'short' }); const unknown = await pub('GET', { token: 'unknown_token_abcdefghijklmnop' });
  ok([none, mal, unknown, dead].every(x => `${x._status} ${JSON.stringify(x._json)}` === '404 {"error":"not found"}'), 'no token, a malformed one, an unknown one and a dead one are the same 404 bytes', 'token-required');
  _stores.call_leads.find(l => String(l._id) === LEAD).deleted = true;
  const gone = await pub('GET', { token: t2 });
  ok(gone._status === 404, 'a deleted record is the same 404', 'deleted-404');
  delete _stores.call_leads.find(l => String(l._id) === LEAD).deleted;

  /* 3. GET resolves exactly the whitelist */
  const top = Object.keys(live._json || {}).sort().join(',');
  ok(top === 'cards,client,paid,pinned,unlocked', `GET answers exactly { client, cards, pinned, unlocked, paid } (${top})`, 'get-whitelist');
  const ck = Object.keys(live._json?.client || {}).sort().join(',');
  ok(ck === 'brandHex,business,firstName,logoUrl', `client is exactly { firstName, business, logoUrl, brandHex } (${ck})`, 'get-whitelist');
  ok(live._json?.client?.firstName === 'Dan' && live._json.client.business === 'Sharpless Detailing' && live._json.client.logoUrl === 'https://img.example/sharpless.png' && live._json.client.brandHex === '#1d4ed8', `the values are the first name, the business, the logo and the first brand colour (${JSON.stringify(live._json?.client)})`);
  const flat = JSON.stringify(live._json);
  ok(PRIVATE.every(v => !flat.includes(v)), 'no private value (phone, email, notes, drive link, invoice, purchase, the record id) leaks through GET', 'get-whitelist');
  const found = [...keysDeep(live._json?.cards || [])].filter(k => FORBIDDEN_KEYS.includes(k));
  ok(found.length === 0, `no card payload carries ${FORBIDDEN_KEYS.join(', ')} (${found.join(',') || 'none'})`, 'card-fields');
  for (const c of live._json?.cards || []) { const m = reg.portalModuleOf(c.id); const extra = Object.keys(c).filter(k => !['id', 'title', 'sensitive', 'locked', ...(m?.fields || [])].includes(k)); ok(m && extra.length === 0, `card ${c.id} carries only its module's fields (${extra.join(',') || 'none extra'})`, 'card-fields'); }
  ok(lead().portal.views === 1 && lead().portal.lastViewedAt, 'the first GET counts one view and stamps lastViewedAt', 'view-count');
  await pub('GET', { token: t2 }); await pub('GET', { token: t2 });
  ok(lead().portal.views === 1, 'two more reads in the same hour do not count again (rate:pview)', 'view-debounce');

  /* 4. the cards all Auto: every module with data renders, in order; the home line reads the newest active project */
  ok(cardIds(live) === 'home,pay,progress,brand_kit,showcase,retainer,book,contact', `all Auto with data, in the home order: home, pay, progress, brand kit, showcase, retainer, book, contact; documents (empty) and plan (no schedule) do not render (${cardIds(live)})`, 'auto-empty');
  ok(card(live, 'home')?.status === 'Website: Design', `home's status line is the newest active project and its stage label (${card(live, 'home')?.status})`, 'home-status');
  ok(card(live, 'contact')?.sms === 'sms:5550100' && card(live, 'contact')?.mailto === 'mailto:contact@visualizeclients.com' && card(live, 'contact')?.instagram === 'visualizetm' && card(live, 'contact')?.hours === 'Weekdays 9 to 5', `contact carries ready sms: and mailto: hrefs, the Instagram handle and my hours (${JSON.stringify(card(live, 'contact'))})`);
  ok(card(live, 'book')?.url === 'https://calendly.com/visualize/call', 'book carries the Calendly link from Settings, Profile');
  ok(card(live, 'showcase')?.url === 'https://visualizestudio.org/clients/sharpless-detailing' && /Share|made with Visualize/i.test(card(live, 'showcase')?.message || ''), 'showcase carries the public showcase link and a share line');
  _stores.projects = _stores.projects.filter(p => p._id !== 'p1');
  let r2 = await pub('GET', { token: t2 });
  ok(card(r2, 'home')?.status === 'All set', `no active project: the status line is All set (${card(r2, 'home')?.status})`, 'home-status');
  seed(); await admin({ id: LEAD, set: { portal: {} } }); let t3 = lead().portal.token;

  /* 4b. money (prompt 2): the pay card, its methods and links, the schedule, the plan card, the retainer card, the paid thanks */
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tM = lead().portal.token;
  let rm = await pub('GET', { token: tM });
  let pay = card(rm, 'pay');
  ok(pay && pay.label === 'Balance' && pay.amount === 350 && pay.amountText === '$350' && pay.due === '2026-10-20' && pay.plan === false, `the pay card is the open, sent invoice (${JSON.stringify({ label: pay?.label, amount: pay?.amount, due: pay?.due })})`);
  ok(pay && pay.methods.map(m => m.id).join(',') === 'card,cashapp,venmo,zelle', `the four ways to pay, in order (${pay?.methods?.map(m => m.id).join(',')})`, 'pay-methods');
  ok(pay && pay.methods[1].url === 'https://cash.app/$visualize/350' && pay.methods[2].url === 'https://venmo.com/u/visualize?txn=pay&amount=350&note=Balance', `Cash App and Venmo links carry the amount and the label (${pay?.methods?.[1]?.url}, ${pay?.methods?.[2]?.url})`, 'pay-links');
  ok(pay && pay.methods[3].copy === 'pay@visualizeclients.com' && pay.methods[3].kind === 'email' && !pay.methods[3].url && /confirm/.test(pay.methods[3].line), 'Zelle is an address to copy, no link, with the confirm line', 'pay-methods');
  ok(pay && /show as paid once I see it/.test(pay.hint), 'the quiet line under the manual rows');
  ok(pay && pay.methods[0].url === 'https://buy.stripe.com/test' && /enter \$350/.test(pay.methods[0].line), `no link on the invoice: the Settings link with the amount in the line (${pay?.methods?.[0]?.line})`, 'pay-link-invoice');
  _stores.projects.find(p => p._id === 'p1').invoices[1].payUrl = 'https://buy.stripe.com/inv-9001-own'; _stores.projects.find(p => p._id === 'p1').invoices[1].paymentLinkId = 'plink_9001';
  rm = await pub('GET', { token: tM }); pay = card(rm, 'pay');
  ok(pay && pay.methods[0].url === 'https://buy.stripe.com/inv-9001-own' && /amount filled in/.test(pay.methods[0].line) && !JSON.stringify(pay).includes('plink_9001'), `the invoice's own link wins and the link id never leaves (${pay?.methods?.[0]?.url})`, 'pay-link-invoice');
  delete _stores.projects.find(p => p._id === 'p1').invoices[1].payUrl;
  _stores.projects.push({ _id: 'p2', leadId: LEAD, name: 'Cards', kind: 'brand', stage: 'design', createdAt: '2026-09-15T00:00:00.000Z', invoices: [{ id: 'inv-9100', label: 'Cards deposit', amount: 120, dueAt: '2026-10-05', status: 'sent', sentAt: '2026-10-02T00:00:00.000Z' }] });
  rm = await pub('GET', { token: tM }); pay = card(rm, 'pay');
  ok(pay?.label === 'Cards deposit' && pay?.pastDue === true, `two open invoices: the oldest due wins and past due is a quiet flag (${pay?.label}, pastDue ${pay?.pastDue})`, 'pay-oldest');
  _stores.projects.find(p => p._id === 'p2').invoices[0].sentAt = '';
  rm = await pub('GET', { token: tM }); pay = card(rm, 'pay');
  ok(pay?.label === 'Balance', 'a line I have not sent yet is never shown', 'pay-sent-only');
  _stores.projects.push({ _id: 'pr', leadId: LEAD, name: 'Site Care', kind: 'retainer', stage: 'kickoff', createdAt: '2026-05-01T00:00:00.000Z', invoices: [{ id: 'inv-r1', label: 'September', amount: 100, dueAt: '2026-09-15', status: 'sent', sentAt: '2026-09-10T00:00:00.000Z' }] });
  rm = await pub('GET', { token: tM }); pay = card(rm, 'pay');
  ok(pay?.label === 'Balance', 'a retainer line never reaches the pay card (Stripe bills it)', 'pay-no-retainer');
  _stores.projects = _stores.projects.filter(p => p._id !== 'p2' && p._id !== 'pr');
  profile().payMethods = { stripe: '', cashapp: '', venmo: 'visualize', zelle: '', zelleKind: 'email' };
  rm = await pub('GET', { token: tM }); pay = card(rm, 'pay');
  ok(pay && pay.methods.map(m => m.id).join(',') === 'venmo', `a method with no identifier does not render (${pay?.methods?.map(m => m.id).join(',')})`, 'pay-methods');
  profile().payMethods = { stripe: 'https://buy.stripe.com/test', cashapp: '', venmo: '', zelle: '', zelleKind: 'email' };
  rm = await pub('GET', { token: tM }); pay = card(rm, 'pay');
  ok(pay && pay.methods.length === 1 && pay.hint === '', 'card only: no quiet line about manual payments');
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tP = lead().portal.token;
  _stores.projects.find(p => p._id === 'p1').invoices.forEach(l => { l.status = 'paid'; l.paidAt = '2026-09-01T00:00:00.000Z'; });
  rm = await pub('GET', { token: tP });
  ok(!card(rm, 'pay'), 'nothing open: no pay card', 'pay-hide');
  ok(!card(rm, 'plan'), 'no schedule: no plan card');
  _stores.projects.push({ _id: 'pp', leadId: LEAD, name: 'Launch', kind: 'combined', stage: 'build', createdAt: '2026-09-20T00:00:00.000Z', plan: { months: 6, monthly: 200 }, invoices: ['2026-08-10', '2026-09-10', '2026-10-10', '2026-11-10', '2026-12-10', '2027-01-10'].map((dueAt, k) => ({ id: `pl${k + 1}`, label: `Payment ${k + 1} of 6`, amount: 200, dueAt, status: k < 2 ? 'paid' : 'sent', sentAt: '2026-08-01T00:00:00.000Z', paidAt: k < 2 ? '2026-08-15T00:00:00.000Z' : '' })).concat([{ id: 'plx', label: 'Extra round', amount: 75, dueAt: '2026-09-01', status: 'sent', sentAt: '2026-08-20T00:00:00.000Z', extra: true }]) });
  rm = await pub('GET', { token: tP }); pay = card(rm, 'pay'); const plan = card(rm, 'plan');
  ok(pay?.plan === true && pay?.label === 'Payment 3 of 6' && pay?.amount === 200, `a payment plan: the pay card is the next installment, not the oldest line (${pay?.label})`, 'pay-schedule');
  ok(plan && plan.n === 3 && plan.of === 6 && plan.dots.join('') === 'paidpaidopenopenopenopen' && plan.nextAmountText === '$200' && /unlock after the last payment/.test(plan.line), `the plan card: payment 3 of 6, the dots, the unlock line (${JSON.stringify(plan)})`, 'plan-next');
  _stores.projects.find(p => p._id === 'pp').invoices.forEach(l => { if (!l.extra) { l.status = 'paid'; l.paidAt = '2026-09-01T00:00:00.000Z'; } });
  rm = await pub('GET', { token: tP });
  ok(!card(rm, 'plan'), 'every installment paid: no plan card', 'plan-next');
  /* the retainer card: the one offer after delivery, null without its link, the active plan, never two */
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tR = lead().portal.token;
  rm = await pub('GET', { token: tR }); let ret = card(rm, 'retainer');
  ok(ret?.mode === 'offer' && ret?.name === 'Content Kit' && ret?.url === 'https://buy.stripe.com/content-kit' && ret?.priceText === '$250 a month', `a delivered brand project and no retainer: the Content Kit offer with its link (${JSON.stringify(ret)})`, 'retainer-offer');
  ok((rm._json?.cards || []).filter(c => c.id === 'retainer').length === 1, 'never more than one retainer card');
  profile().retainerLinks['content-kit'] = '';
  rm = await pub('GET', { token: tR });
  ok(!card(rm, 'retainer'), 'the offer needs its link: empty map, no card', 'retainer-link-empty');
  _stores.projects.find(p => p._id === 'p1').deliveredAt = '2026-10-01T00:00:00.000Z'; profile().retainerLinks.growth = 'https://buy.stripe.com/growth';
  rm = await pub('GET', { token: tR }); ret = card(rm, 'retainer');
  ok(ret?.name === 'Growth', 'brand and website both delivered: Growth is the one offer', 'retainer-offer');
  lead().retainer = { planId: 'site-care', amount: 100, status: 'active', billDay: 15, nextBillAt: '2026-11-15', stripeSubscriptionId: 'sub_123' };
  rm = await pub('GET', { token: tR }); ret = card(rm, 'retainer');
  ok(ret?.mode === 'active' && ret?.name === 'Site Care' && ret?.priceText === '$100 a month' && ret?.renews === 'Renews 2026-11-15' && ret?.notice === '30 day cancel notice' && ret?.sms === 'sms:5550100' && !ret?.url, `an active retainer: plan, price, renewal, notice, Message Rob (${JSON.stringify(ret)})`, 'retainer-active');
  ok(!JSON.stringify(ret).includes('sub_123'), 'the Stripe subscription id never leaves', 'card-fields');
  lead().retainer.status = 'cancelled';
  rm = await pub('GET', { token: tR }); ret = card(rm, 'retainer');
  ok(ret?.mode === 'offer', 'a cancelled retainer is not active: the offer again', 'retainer-active');
  /* the paid thanks: once, server stamped */
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tT = lead().portal.token;
  rm = await pub('GET', { token: tT });
  ok(rm._json?.paid === false, 'payments before the link existed do not thank');
  _stores.projects.find(p => p._id === 'p1').invoices[1].status = 'paid'; _stores.projects.find(p => p._id === 'p1').invoices[1].paidAt = new Date(Date.now() + 1000).toISOString();
  rm = await pub('GET', { token: tT });
  ok(rm._json?.paid === true && !card(rm, 'pay') && lead().portal.lastPaidSeenAt, 'a new payment: paid once, the pay card gone, lastPaidSeenAt stamped', 'paid-once');
  rm = await pub('GET', { token: tT });
  ok(rm._json?.paid === false, 'the next read does not thank again', 'paid-once');
  /* sensitive: behind a PIN the money cards come locked, with nothing in them */
  await admin({ id: LEAD, set: { portal: { pin: '4321' } } });
  rm = await pub('GET', { token: tT });
  const lockedRet = card(rm, 'retainer');
  ok(lockedRet && lockedRet.locked === true && lockedRet.name === undefined && lockedRet.url === undefined, `with a PIN the retainer card is locked and empty (${JSON.stringify(lockedRet)})`, 'pin-gate');
  await admin({ id: LEAD, set: { portal: { pin: '' } } });
  seed(); await admin({ id: LEAD, set: { portal: {} } }); t3 = lead().portal.token;

  /* 4c. project (prompt 2): progress, revisions, needs you */
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tJ = lead().portal.token;
  let rj = await pub('GET', { token: tJ }); let prog = card(rj, 'progress');
  ok(prog && prog.name === 'Website' && prog.stage === 'design' && prog.stages.map(x => x.id).join(',') === 'kickoff,design,revisions,build,delivery,delivered' && prog.line === "I'm building your first concepts", `progress is the newest active project with its track and the design line (${JSON.stringify(prog)})`, 'progress-line');
  ok(!card(rj, 'revisions') && !card(rj, 'needs_you'), 'not in revisions and nothing marked for the client: no revisions card, no needs you card', 'revisions-stage');
  const p1 = () => _stores.projects.find(p => p._id === 'p1');
  p1().stage = 'revisions'; p1().revisions = { max: 2, used: 1, log: [{ at: '2026-10-01', note: '', extra: false }] };
  rj = await pub('GET', { token: tJ }); let rev = card(rj, 'revisions'); prog = card(rj, 'progress');
  ok(rev && rev.used === 1 && rev.max === 2 && rev.last === true && rev.line === 'This is your last included round. Extra rounds are $50 for design and $75 for web.', `the last included round says so with the prices from pricing.js (${JSON.stringify(rev)})`, 'revisions-last');
  ok(prog?.line === 'Round 1 of 2', `the progress line in revisions is the round (${prog?.line})`, 'progress-line');
  p1().revisions.used = 0; p1().revisions.log = [];
  rj = await pub('GET', { token: tJ }); rev = card(rj, 'revisions');
  ok(rev && rev.last === false && rev.line === 'Round 0 of 2 used.', `an earlier round is plain (${rev?.line})`, 'revisions-last');
  p1().stage = 'build';
  rj = await pub('GET', { token: tJ });
  ok(!card(rj, 'revisions') && card(rj, 'progress')?.line === "I'm building it out", 'out of revisions: no revisions card', 'revisions-stage');
  _stores.projects = [];
  rj = await pub('GET', { token: tJ });
  ok(!card(rj, 'progress'), 'no project at all: no progress card', 'auto-empty');
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tN = lead().portal.token;
  await admin({ id: LEAD, set: { checklists: [{ id: 'l1', name: 'Kickoff', items: [
    { id: 't1', text: 'Send me the photos', done: false, client: true, url: 'https://drive.google.com/drive/folders/x' },
    { id: 't2', text: 'Rob picks the fonts', done: false, client: false },
    { id: 't3', text: 'Sign the contract', done: true, client: true },
    { id: 't4', text: 'Bad link', done: false, client: true, url: 'javascript:alert(1)' },
  ] }] } });
  ok(lead().checklists[0].items[0].client === true && lead().checklists[0].items[0].url === 'https://drive.google.com/drive/folders/x' && lead().checklists[0].items[1].client === false && lead().checklists[0].items[3].url === '', 'the route stores client and an https url on an item, drops a javascript: one', 'client-field');
  _stores.projects.find(p => p._id === 'p1').checklists = [{ id: 'pl', name: 'Website', items: [{ id: 'pt1', text: 'Fill in the content sheet', done: false, client: true, url: 'https://docs.google.com/x' }] }];
  _stores.projects.find(p => p._id === 'p0').checklists = [{ id: 'dl', name: 'Logo', items: [{ id: 'dt1', text: 'Old delivered item', done: false, client: true }] }];
  rj = await pub('GET', { token: tN }); const needs = card(rj, 'needs_you');
  ok(needs && needs.items.map(i => i.id).join(',') === 't1,t4,pt1', `needs you lists the open client items on the client and the active project, not the delivered one (${needs?.items?.map(i => i.id).join(',')})`, 'needs-client');
  ok(needs && needs.items[0].url === 'https://drive.google.com/drive/folders/x' && needs.items[1].url === '' && needs.items[2].owner === 'Website', 'each row carries its link when it has one and the project it belongs to');
  ok(cardIds(rj).startsWith('home,needs_you,'), `needs you sits right after home (${cardIds(rj)})`, 'needs-order');
  const nk = Object.keys(needs?.items?.[0] || {}).sort().join(',');
  ok(nk === 'id,owner,text,url', `a needs you row is exactly { id, text, url, owner } (${nk})`, 'card-fields');
  lead().checklists[0].items[0].done = true; lead().checklists[0].items[3].client = false; _stores.projects.find(p => p._id === 'p1').checklists = [];
  rj = await pub('GET', { token: tN });
  ok(!card(rj, 'needs_you'), 'done or not for the client: nothing waits, no card', 'needs-open');
  seed(); await admin({ id: LEAD, set: { portal: {} } }); t3 = lead().portal.token;

  /* 4d. files (prompt 2): the gate on the server, both directions; the brand kit after a delivered brand project */
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tF = lead().portal.token;
  const pw = () => _stores.projects.find(p => p._id === 'p1');
  pw().deliverables = [{ id: 'd1', group: 'web', label: 'Site source', done: true, link: 'https://github.com/secret/site' }, { id: 'd2', group: 'logo', label: 'Logo files', done: true, link: 'https://drive.google.com/file/d/secret-logo' }, { id: 'd3', group: 'logo', label: 'Not yet', done: false, link: '' }];
  pw().links = { drive: 'https://drive.google.com/drive/folders/secret-drive' };
  let rf = await pub('GET', { token: tF }); let files = card(rf, 'files');
  ok(files && files.unlocked === false && /paid in full/.test(files.line) && files.drive === '' && files.groups.map(g => g.group).join(',') === 'web,logo' && files.groups[0].items[0].label === 'Site source', `an open invoice: the files card lists names only, locked (${JSON.stringify(files)})`, 'files-gate');
  ok(!JSON.stringify(files).includes('secret'), 'no link and no Drive folder leaves the server before full payment', 'files-gate');
  ok(files && files.groups.every(g => g.items.every(it => Object.keys(it).join(',') === 'label')), 'a locked row is exactly { label }', 'files-gate');
  pw().invoices.forEach(l => { l.status = 'paid'; l.paidAt = l.paidAt || '2026-10-02T00:00:00.000Z'; });
  rf = await pub('GET', { token: tF }); files = card(rf, 'files');
  ok(files && files.unlocked === true && files.drive === 'https://drive.google.com/drive/folders/secret-drive' && files.groups[0].items[0].url === 'https://github.com/secret/site' && files.groups[1].items[1].url === '', `every invoice paid: the links and the Drive folder (${JSON.stringify(files)})`, 'files-unlock');
  pw().invoices[1].status = 'sent'; pw().invoices[1].paidAt = ''; pw().deliveredAt = '2026-10-05T00:00:00.000Z'; pw().stage = 'delivered';
  rf = await pub('GET', { token: tF }); files = card(rf, 'files');
  ok(files && files.unlocked === false && !JSON.stringify(files).includes('secret'), 'delivered with an open invoice is still locked', 'files-gate');
  pw().invoices = []; pw().schedule = undefined;
  rf = await pub('GET', { token: tF }); files = card(rf, 'files');
  ok(files && files.unlocked === true, 'delivered with no invoice at all is unlocked (nothing is owed)', 'files-unlock');
  pw().deliveredAt = ''; pw().stage = 'design';
  rf = await pub('GET', { token: tF }); files = card(rf, 'files');
  ok(files && files.unlocked === false, 'no invoice yet and not delivered: unpaid, locked (unsure means unpaid)', 'files-gate');
  pw().deliverables = [];
  rf = await pub('GET', { token: tF });
  ok(!card(rf, 'files'), 'no deliverables: no files card', 'auto-empty');
  /* the brand kit */
  rf = await pub('GET', { token: tF }); let kit = card(rf, 'brand_kit');
  ok(kit && kit.colors.map(c => c.hex).join(',') === '#1d4ed8,#ffffff' && kit.logoUrl === 'https://img.example/sharpless.png', `a delivered brand project and colours: the kit with the mark and the colours (${JSON.stringify(kit)})`, 'kit-delivered');
  lead().brand.fontDisplay = 'Inter'; lead().brand.fontBody = 'Georgia';
  rf = await pub('GET', { token: tF }); kit = card(rf, 'brand_kit');
  ok(kit && kit.fonts.join(',') === 'Inter,Georgia', 'the fonts come from brand.fontDisplay and brand.fontBody');
  lead().brand = { primary: '', colors: [] };
  rf = await pub('GET', { token: tF });
  ok(!card(rf, 'brand_kit'), 'no colours: no brand kit', 'kit-colors');
  lead().brand = { primary: '#1d4ed8', colors: [] }; _stores.projects.find(p => p._id === 'p0').deliveredAt = ''; _stores.projects.find(p => p._id === 'p0').stage = 'design';
  rf = await pub('GET', { token: tF });
  ok(!card(rf, 'brand_kit'), 'the brand project not delivered: no brand kit', 'kit-delivered');
  seed(); await admin({ id: LEAD, set: { portal: {} } }); t3 = lead().portal.token;

  /* 4e. the token pages as cards (prompt 3): the planner, the concepts, and no other client's token ever */
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tK = lead().portal.token;
  const OTHER_PLANNER = 'otherPLANNERtoken0123456789abcdef'; const OTHER_SET = 'otherSETtoken0123456789abcdefgh';
  _stores.call_leads.find(l => String(l._id) === OTHER).planner = { enabled: true, token: OTHER_PLANNER };
  _stores.concept_sets = [
    { _id: 'cs-other', leadId: OTHER, title: 'Theirs', round: 1, status: 'sent', token: OTHER_SET, directions: [] },
    { _id: 'cs-draft', leadId: LEAD, title: 'Draft one', round: 3, status: 'draft', token: 'draftSETtoken0123456789abcdefgh', directions: [] },
    { _id: 'cs-old', leadId: LEAD, title: 'Round one', round: 1, status: 'approved', approvedDirectionId: 'd1', token: 'oldSETtoken0123456789abcdefghij', directions: [{ id: 'd1', order: 0, items: [{ image: 'https://img.example/old.png', order: 0 }] }] },
    { _id: 'cs-new', leadId: LEAD, title: 'Round two', round: 2, status: 'viewed', token: 'newSETtoken0123456789abcdefghij', directions: [{ id: 'a', order: 1, items: [{ image: 'https://img.example/a.png', order: 0 }] }, { id: 'b', order: 0, items: [{ image: 'javascript:alert(1)', order: 0 }, { image: 'https://img.example/b.png', order: 1 }] }] },
  ];
  const { zoneDayKey } = await load('_lib/zone.js');
  const todayKey = zoneDayKey(Date.now()); const [ty, tm, td] = todayKey.split('-').map(Number); const today = new Date(Date.UTC(ty, tm - 1, td)); const key = (d) => d.toISOString().slice(0, 10);
  const dow = (today.getUTCDay() + 6) % 7; const monday = new Date(today.getTime() - dow * 864e5); const inWeek = (n) => key(new Date(monday.getTime() + n * 864e5)); const lastWeek = key(new Date(monday.getTime() - 3 * 864e5));
  _stores.posts = [
    { _id: 'po1', leadId: LEAD, date: inWeek(0), kind: 'post', status: 'review' },
    { _id: 'po2', leadId: LEAD, date: inWeek(2), kind: 'post', status: 'approved' },
    { _id: 'po3', leadId: LEAD, date: inWeek(4), kind: 'post', status: 'making' },
    { _id: 'po4', leadId: LEAD, date: lastWeek, kind: 'post', status: 'review' },
    { _id: 'po5', leadId: LEAD, date: inWeek(1), kind: 'ad', status: 'live' },
    { _id: 'po6', leadId: LEAD, date: lastWeek, kind: 'ad', status: 'live' },
    { _id: 'po7', leadId: LEAD, date: inWeek(3), kind: 'post', status: 'review', deleted: true },
    { _id: 'po8', leadId: OTHER, date: inWeek(0), kind: 'post', status: 'review' },
  ];
  let rk = await pub('GET', { token: tK });
  ok(!card(rk, 'planner'), 'no planner on the client: no planner card', 'planner-gate');
  lead().planner = { enabled: false, token: 'myPLANNERtoken0123456789abcdefgh' };
  rk = await pub('GET', { token: tK });
  ok(!card(rk, 'planner'), 'the planner off keeps its token but shows no card', 'planner-gate');
  lead().planner.enabled = true;
  rk = await pub('GET', { token: tK }); let pl = card(rk, 'planner');
  ok(pl && pl.url === '/planner/myPLANNERtoken0123456789abcdefgh?from=portal' && pl.posts === 3 && pl.needYou === 1 && pl.adsLive === 2 && pl.line === 'This week: 3 posts, 1 needs you. 2 ads live', `the planner card: the page with the way back, this week's posts, the one that needs them, the ads live, a deleted post and last week ignored (${JSON.stringify(pl)})`, 'planner-counts');
  let cc = card(rk, 'concepts');
  ok(cc && cc.name === 'Round two' && cc.state === 'waiting' && cc.stateLabel === 'Waiting on you' && cc.url === '/concepts/newSETtoken0123456789abcdefghij?from=portal' && cc.cover === 'https://img.example/b.png', `the concepts card: the newest shared set, waiting, the first direction's first real image as the cover (${JSON.stringify(cc)})`, 'concepts-newest');
  ok(cardIds(rk).indexOf('concepts') < cardIds(rk).indexOf('contact') && cardIds(rk).indexOf('concepts') < cardIds(rk).indexOf('progress'), `a waiting set sits near the top, before the project (${cardIds(rk)})`, 'concepts-order');
  _stores.concept_sets.find(x => x._id === 'cs-new').status = 'changes';
  rk = await pub('GET', { token: tK }); cc = card(rk, 'concepts');
  ok(cc?.state === 'changes' && cc?.stateLabel === 'Changes requested', 'changes requested maps', 'concepts-state');
  _stores.concept_sets.find(x => x._id === 'cs-new').approvedDirectionId = 'a';
  await admin({ id: LEAD, set: { portal: { documents: [{ id: 'dk', label: 'Brand guide', url: 'https://drive.google.com/file/d/k', kind: 'pdf' }] } } });
  rk = await pub('GET', { token: tK }); cc = card(rk, 'concepts');
  ok(cc?.state === 'approved' && cc?.stateLabel === 'Approved', 'an approved direction maps to Approved', 'concepts-state');
  ok(cardIds(rk).indexOf('documents') > 0 && cardIds(rk).indexOf('concepts') > cardIds(rk).indexOf('documents'), `an approved set sinks below the documents (${cardIds(rk)})`, 'concepts-order');
  _stores.concept_sets.find(x => x._id === 'cs-new').archived = true;
  rk = await pub('GET', { token: tK }); cc = card(rk, 'concepts');
  ok(cc?.name === 'Round one' && cc?.state === 'approved', 'the newest archived: the older shared set shows', 'concepts-newest');
  _stores.concept_sets.forEach(x => { if (x.leadId === LEAD) x.archived = true; });
  rk = await pub('GET', { token: tK });
  ok(!card(rk, 'concepts'), 'every set archived or a draft: no concepts card', 'concepts-newest');
  const flatK = JSON.stringify(rk._json);
  ok(!flatK.includes(OTHER_PLANNER) && !flatK.includes(OTHER_SET) && !flatK.includes('draftSETtoken'), 'no other client\'s planner or concept token, and no draft token, ever leaves', 'token-isolation');
  /* the portal token never rides in another page's url: the planner, concepts and review cards carry ?from=portal only */
  lead().reviews = { visualize: { token: 'myREVIEWtoken0123456789abcdefgh' }, testimonials: [] }; _stores.projects.find(p => p._id === 'p1').deliveredAt = '2026-10-05T00:00:00.000Z';
  _stores.concept_sets.forEach(x => { if (x.leadId === LEAD && x._id === 'cs-new') x.archived = false; });
  rk = await pub('GET', { token: tK });
  const urls = (rk._json?.cards || []).filter(c => ['planner', 'concepts', 'review'].includes(c.id)).map(c => c.url);
  ok(urls.length === 3 && urls.every(u => u.endsWith('?from=portal') && !u.includes(tK)), `the three token page urls end in ?from=portal and carry no portal token (${urls.join(' ')})`, 'back-no-token');
  ok(!JSON.stringify(rk._json).includes(tK), 'the portal token appears nowhere in the payload', 'back-no-token');
  seed(); await admin({ id: LEAD, set: { portal: {} } }); t3 = lead().portal.token;

  /* 4f. the review ask and their reviews (prompt 3) */
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tV = lead().portal.token;
  const OTHER_REVIEW = 'otherREVIEWtoken0123456789abcde';
  _stores.call_leads.find(l => String(l._id) === OTHER).reviews = { visualize: { token: OTHER_REVIEW }, nfcCard: true, googleLink: 'https://g.page/r/other/review', testimonials: [] };
  let rv = await pub('GET', { token: tV });
  ok(!card(rv, 'review') && !card(rv, 'their_reviews'), 'no review link, no card, no Google link: neither review card', 'review-gate');
  lead().reviews = { visualize: { token: 'myREVIEWtoken0123456789abcdefgh' }, nfcCard: false, googleLink: '', testimonials: [], asks: [{ at: '2026-01-01', channel: 'text', result: 'left' }] };
  rv = await pub('GET', { token: tV });
  ok(!card(rv, 'review'), 'the newest project not delivered: no review ask yet', 'review-gate');
  _stores.projects.find(p => p._id === 'p1').deliveredAt = '2026-10-05T00:00:00.000Z';
  rv = await pub('GET', { token: tV }); let ask = card(rv, 'review');
  ok(ask && ask.url === '/r/myREVIEWtoken0123456789abcdefgh?from=portal' && /minute of your time/.test(ask.line), `delivered with the link and no review yet: How did I do? with the page and the way back (${JSON.stringify(ask)})`, 'review-gate');
  lead().reviews.testimonials = [{ id: 't1', status: 'pending', consent: true, text: 'Great', name: 'Dan' }];
  rv = await pub('GET', { token: tV });
  ok(!card(rv, 'review'), 'a pending review in: the ask is gone', 'review-submitted');
  lead().reviews.testimonials = [{ id: 't1', status: 'hidden', consent: true, text: 'Great', name: 'Dan' }];
  rv = await pub('GET', { token: tV });
  ok(card(rv, 'review'), 'a hidden one does not count as answered');
  lead().reviews.testimonials = [{ id: 't2', status: 'approved', consent: true, text: 'Great', name: 'Dan' }];
  rv = await pub('GET', { token: tV });
  ok(!card(rv, 'review'), 'an approved review: the ask stays gone', 'review-submitted');
  /* their reviews */
  lead().reviews = { visualize: { token: 'myREVIEWtoken0123456789abcdefgh' }, nfcCard: true, googleLink: '', baseline: { count: 12, rating: 4.3 }, latest: { count: 19, rating: 4.6 }, testimonials: [] };
  rv = await pub('GET', { token: tV }); let theirs = card(rv, 'their_reviews');
  ok(theirs && theirs.nfcCard === true && theirs.googleLink === '' && theirs.count === 19 && theirs.diff === 7 && theirs.line === '19 reviews, up 7 since we started', `a review card and counts: the diff line (${JSON.stringify(theirs)})`, 'reviews-diff');
  lead().reviews.latest = { count: 10, rating: 4.6 }; lead().reviews.googleLink = 'https://g.page/r/sharpless/review';
  rv = await pub('GET', { token: tV }); theirs = card(rv, 'their_reviews');
  ok(theirs && theirs.googleLink === 'https://g.page/r/sharpless/review' && theirs.diff === 0 && theirs.line === '10 reviews', `down since we started: the count alone, and the link (${theirs?.line})`, 'reviews-diff');
  lead().reviews.baseline = null;
  rv = await pub('GET', { token: tV }); theirs = card(rv, 'their_reviews');
  ok(theirs?.line === '10 reviews' && theirs?.diff === 0, 'no baseline: the count alone');
  lead().reviews.nfcCard = false; lead().reviews.googleLink = '';
  rv = await pub('GET', { token: tV });
  ok(!card(rv, 'their_reviews'), 'no card and no link: nothing to show', 'reviews-gate');
  const flatV = JSON.stringify(rv._json);
  ok(!flatV.includes(OTHER_REVIEW) && !flatV.includes('g.page/r/other') && flatV.split('myREVIEWtoken').length === 2 && String(card(rv, 'review')?.url || '').includes('myREVIEWtoken'), 'no other client\'s review token or link leaves, and the review token itself rides once, inside the review card\'s url', 'token-isolation');
  seed(); await admin({ id: LEAD, set: { portal: {} } }); t3 = lead().portal.token;

  /* 4g. the next call (prompt 3): Calendly behind a fifteen minute cache per client, matched by email, the soonest of two */
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tC = lead().portal.token;
  const realFetch = globalThis.fetch; let calCalls = 0; let invitees = {};
  const soon = new Date(Date.now() + 2 * 864e5).toISOString(); const later = new Date(Date.now() + 5 * 864e5).toISOString();
  const events = () => ({ collection: [
    { uri: 'https://api.calendly.com/scheduled_events/EVLATER', name: 'Studio meeting', start_time: later, end_time: new Date(Date.parse(later) + 1800e3).toISOString(), location: { join_url: 'https://zoom.us/j/later' } },
    { uri: 'https://api.calendly.com/scheduled_events/EVSOON', name: 'Studio meeting', start_time: soon, end_time: new Date(Date.parse(soon) + 1800e3).toISOString(), location: { join_url: 'https://zoom.us/j/soon' } },
  ] });
  globalThis.fetch = async (url) => { const u = String(url); const json = (o) => ({ ok: true, status: 200, json: async () => o }); if (!u.includes('api.calendly.com')) return realFetch(url); calCalls += 1; if (u.endsWith('/users/me')) return json({ resource: { uri: 'https://api.calendly.com/users/ME' } }); if (u.includes('/scheduled_events?')) return json(events()); const m = /scheduled_events\/(EV\w+)\/invitees/.exec(u); if (m) return json({ collection: invitees[m[1]] || [] }); return { ok: false, status: 404, json: async () => ({}) }; };
  try {
    delete process.env.CALENDLY_TOKEN; delete process.env.CALENDLY_PAT; calCalls = 0;
    let rc = await pub('GET', { token: tC });
    ok(!card(rc, 'meetings') && calCalls === 0, 'no Calendly token: no card and no call', 'cal-token');
    process.env.CALENDLY_TOKEN = 'cal_test_not_real';
    invitees = { EVLATER: [{ email: 'someone@else.example' }], EVSOON: [{ email: 'nobody@else.example' }] }; calCalls = 0;
    rc = await pub('GET', { token: tC });
    ok(!card(rc, 'meetings') && calCalls === 4, `no invitee matches: no card after one lookup (me, events, two invitee reads: ${calCalls} calls)`, 'cal-match');
    ok(_stores.settings.some(d => String(d._id).startsWith('rate:pcal:') && d.data === null), 'a miss is cached too', 'cal-cache');
    calCalls = 0; rc = await pub('GET', { token: tC });
    ok(calCalls === 0, 'a second read within fifteen minutes makes no call', 'cal-cache');
    _stores.settings.find(d => String(d._id).startsWith('rate:pcal:')).at = Date.now() - 16 * 60e3;
    invitees = { EVLATER: [{ email: 'OWNER@sharpless.example' }], EVSOON: [{ email: 'nobody@else.example' }] }; calCalls = 0;
    rc = await pub('GET', { token: tC }); let meet = card(rc, 'meetings');
    ok(calCalls > 0 && meet && meet.at === later && meet.join === 'https://zoom.us/j/later' && meet.name === 'Studio meeting' && meet.end, `after fifteen minutes Calendly is asked again; the email matches whatever its case (${JSON.stringify(meet)})`, 'cal-ttl');
    const mk = Object.keys(meet || {}).sort().join(',');
    ok(mk === 'at,end,id,join,name,sensitive,title', `the card is exactly { at, end, name, join } beside its title (${mk})`, 'card-fields');
    ok(!JSON.stringify(rc._json).includes('sharpless.example') && !JSON.stringify(rc._json).includes('scheduled_events'), 'no email and no Calendly uri leaves');
    _stores.settings = _stores.settings.filter(d => !String(d._id).startsWith('rate:pcal:'));
    invitees = { EVLATER: [{ email: 'owner@sharpless.example' }], EVSOON: [{ email: 'x@y.example' }, { email: 'owner@sharpless.example' }] };
    rc = await pub('GET', { token: tC }); meet = card(rc, 'meetings');
    ok(meet?.at === soon && meet?.join === 'https://zoom.us/j/soon', 'two events match: the soonest wins', 'cal-soonest');
    _stores.settings.find(d => String(d._id).startsWith('rate:pcal:')).data = { at: new Date(Date.now() - 3 * 3600e3).toISOString(), end: '', title: 'Old', join: '' };
    rc = await pub('GET', { token: tC });
    ok(!card(rc, 'meetings'), 'a call that already happened is not shown', 'cal-past');
  } finally { globalThis.fetch = realFetch; delete process.env.CALENDLY_TOKEN; }
  seed(); await admin({ id: LEAD, set: { portal: {} } }); t3 = lead().portal.token;

  /* 4h. approvals (prompt 3): the list Rob keeps, the client's answers through the door, the task and the guards */
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const tA = lead().portal.token;
  const otherLead = _stores.call_leads.find(l => String(l._id) === OTHER);
  otherLead.portal = { token: 'otherPORTALtoken0123456789abcd', approvals: [{ id: 'theirs-1', label: 'Their hero', url: '', status: 'pending', note: '', requestedAt: '2026-10-01T00:00:00.000Z', respondedAt: '' }] };
  let ra = await pub('GET', { token: tA });
  ok(!card(ra, 'approvals'), 'no approvals: no card', 'approvals-pending');
  r = await admin({ id: LEAD, set: { portal: { approvals: [{ id: 'ap-1', label: 'Homepage hero', url: 'https://drive.google.com/file/d/hero', status: 'pending', note: '' }, { id: 'ap-old', label: 'Old one', status: 'approved', respondedAt: '2026-01-01T00:00:00.000Z', requestedAt: '2025-12-30T00:00:00.000Z' }, { id: 'ap-bad', label: 'Bad link', url: 'javascript:alert(1)', status: 'weird' }] } } });
  ok(r._status === 200 && lead().portal.approvals.length === 3 && lead().portal.approvals[0].requestedAt && lead().portal.approvals[2].url === '' && lead().portal.approvals[2].status === 'pending', `the route stores the list: requestedAt stamped, a bad link dropped, an unknown status pending (${JSON.stringify(lead().portal.approvals[2])})`, 'approvals-shape');
  ra = await pub('GET', { token: tA }); let ap = card(ra, 'approvals');
  ok(ap && ap.items.map(a => a.id).join(',') === 'ap-1,ap-bad', `pending items show; an answer older than seven days does not (${ap?.items?.map(a => a.id).join(',')})`, 'approvals-days');
  const ak = Object.keys(ap?.items?.[0] || {}).sort().join(',');
  ok(ak === 'id,label,note,requestedAt,respondedAt,status,url', `an item is exactly { id, label, url, status, note, requestedAt, respondedAt } (${ak})`, 'card-fields');
  /* the door */
  let post = await pub('POST', { token: tA }, { action: 'approve', id: 'ap-1', decision: 'approved' });
  const one = () => lead().portal.approvals.find(a => a.id === 'ap-1');
  ok(post._status === 200 && post._json?.item?.status === 'approved' && one().status === 'approved' && one().respondedAt, `Approve: the item is approved with respondedAt (${post._status})`, 'approve-write');
  const portalList = () => (lead().checklists || []).find(l => l.name === 'Portal');
  ok(portalList() && portalList().items.some(t => t.text === 'Sharpless Detailing approved Homepage hero' && !t.done && t.due), `a Next up task on the client says who approved what (${JSON.stringify(portalList()?.items?.map(t => t.text))})`, 'approve-task');
  post = await pub('POST', { token: tA }, { action: 'approve', id: 'ap-1', decision: 'changes', note: 'again' });
  ok(post._status === 409 && one().status === 'approved', 'an answered item cannot be answered again', 'approve-pending');
  post = await pub('POST', { token: tA }, { action: 'approve', id: 'ap-bad', decision: 'changes', note: '' });
  ok(post._status === 400, 'changes without a note is refused', 'approve-note');
  post = await pub('POST', { token: tA }, { action: 'approve', id: 'ap-bad', decision: 'changes', note: '  Make the <b>red</b> less   bright, please  ' + 'x'.repeat(500) });
  const bad = () => lead().portal.approvals.find(a => a.id === 'ap-bad');
  ok(post._status === 200 && bad().status === 'changes' && bad().note.startsWith('Make the red less bright, please') && bad().note.length <= 400, `Request changes: the note stripped of tags, one spaced and capped (${bad().note.slice(0, 40)}...)`, 'approve-write');
  ok(portalList().items.some(t => t.text.startsWith('Sharpless Detailing wants changes on Bad link: Make the red')), 'the changes task carries the note', 'approve-task');
  ra = await pub('GET', { token: tA }); ap = card(ra, 'approvals');
  ok(!card(ra, 'approvals'), `nothing pending any more: the card is gone (${cardIds(ra)})`, 'approvals-pending');
  post = await pub('POST', { token: tA }, { action: 'approve', id: 'theirs-1', decision: 'approved' });
  ok(post._status === 404 && otherLead.portal.approvals[0].status === 'pending', 'an item from another client is not found and not touched', 'approve-own');
  post = await pub('POST', { token: tA }, { action: 'approve', id: 'nope', decision: 'approved' });
  ok(post._status === 404, 'an unknown id is 404');
  ok(!JSON.stringify(ra._json).includes('theirs-1') && !JSON.stringify(ra._json).includes('Their hero'), 'the other client\'s approvals never show', 'token-isolation');
  /* the limit: twenty an hour per token */
  const many = Array.from({ length: 25 }, (_, i) => ({ id: `m${i}`, label: `Item ${i}`, status: 'pending' }));
  await admin({ id: LEAD, set: { portal: { approvals: many } } });
  const lim = await load('_lib/limit.js'); await lim.rateClear(await (await load('_lib/mongo.js')).getDb(), lim.rateKey('papp', tA));
  let statuses = [];
  for (let i = 0; i < 21; i++) { const pr = await pub('POST', { token: tA }, { action: 'approve', id: `m${i}`, decision: 'approved' }); statuses.push(pr._status); }
  ok(statuses.slice(0, 20).every(x => x === 200) && statuses[20] === 429, `twenty answers an hour, the twenty first is 429 (${statuses.slice(18).join(',')})`, 'approve-limit');
  seed(); await admin({ id: LEAD, set: { portal: {} } }); t3 = lead().portal.token;

  /* 5. module states: off never renders even with data; on renders only with data; auto equals on */
  await admin({ id: LEAD, set: { portal: { modules: { contact: 'off', showcase: 'off' } } } });
  r2 = await pub('GET', { token: t3 });
  ok(!card(r2, 'contact') && !card(r2, 'showcase') && card(r2, 'book') && card(r2, 'pay'), `off never renders even with data (${cardIds(r2)})`, 'state-off');
  await admin({ id: LEAD, set: { portal: { modules: { contact: 'on', showcase: 'on', documents: 'on' } } } });
  r2 = await pub('GET', { token: t3 });
  ok(card(r2, 'contact') && card(r2, 'showcase') && !card(r2, 'documents'), `on renders only when resolve returns data: contact and showcase yes, documents (empty) no (${cardIds(r2)})`, 'state-on-empty');
  profile().phone = ''; profile().email = '';
  r2 = await pub('GET', { token: t3 });
  ok(!card(r2, 'contact'), 'on with nothing to show does not render (contact without my phone or email)', 'state-on-empty');
  profile().phone = '555 0100';
  await admin({ id: LEAD, set: { portal: { modules: { contact: 'auto' } } } });
  const rAuto = await pub('GET', { token: t3 });
  await admin({ id: LEAD, set: { portal: { modules: { contact: 'on' } } } });
  const rOn = await pub('GET', { token: t3 });
  ok(JSON.stringify(card(rAuto, 'contact')) === JSON.stringify(card(rOn, 'contact')) && card(rOn, 'contact'), 'auto equals on for the same data');
  ok(lead().portal.modules.showcase === 'on' && lead().portal.modules.contact === 'on', 'a modules write merges: the states not sent stay', 'modules-merge');
  r = await admin({ id: LEAD, set: { portal: { modules: { home: 'off', contact: 'maybe', bogus: 'on' } } } });
  ok(lead().portal.modules.home === undefined && lead().portal.modules.contact === 'on' && lead().portal.modules.bogus === undefined, 'home cannot be turned off, an unknown state or module is dropped', 'modules-whitelist');
  r2 = await pub('GET', { token: t3 });
  ok(card(r2, 'home'), 'home always renders');
  await admin({ id: LEAD, set: { portal: { template: 'website' } } });
  ok(lead().portal.template === 'website' && Object.entries(reg.PORTAL_TEMPLATES.website).every(([k, v]) => lead().portal.modules[k] === v), 'a template sets the modules to its defaults', 'template');
  await admin({ id: LEAD, set: { portal: { template: 'nope' } } });
  ok(lead().portal.template === '', 'an unknown template is stored as none');

  /* 6. documents: add, reorder, delete, bad links dropped, cap */
  const docs = [{ id: 'd1', label: 'Brand guide', url: 'https://drive.google.com/file/d/abc', kind: 'pdf' }, { id: 'd2', label: 'Content sheet', url: 'https://docs.google.com/spreadsheets/d/x', kind: 'sheet' }];
  r = await admin({ id: LEAD, set: { portal: { documents: docs } } });
  ok(r._status === 200 && lead().portal.documents.length === 2 && lead().portal.documents[0]?.id === 'd1' && lead().portal.documents[0]?.addedAt, 'two documents stored in order, addedAt stamped', 'documents');
  r2 = await pub('GET', { token: t3 });
  ok(card(r2, 'documents')?.items?.length === 2 && card(r2, 'documents').items[0].label === 'Brand guide' && card(r2, 'documents').items[0].kind === 'pdf', `the documents card renders them (${JSON.stringify(card(r2, 'documents'))})`, 'documents');
  const dk = Object.keys(card(r2, 'documents')?.items?.[0] || {}).sort().join(',');
  ok(dk === 'id,kind,label,url', `a document item is exactly { id, label, url, kind } (${dk})`, 'card-fields');
  await admin({ id: LEAD, set: { portal: { documents: [docs[1], docs[0]] } } });
  ok(lead().portal.documents[0]?.id === 'd2', 'a reorder is the new order', 'documents');
  await admin({ id: LEAD, set: { portal: { documents: [docs[0]] } } });
  ok(lead().portal.documents.length === 1 && lead().portal.documents[0]?.id === 'd1', 'a delete leaves the rest', 'documents');
  await admin({ id: LEAD, set: { portal: { documents: [{ id: 'x', label: 'Evil', url: 'javascript:alert(1)', kind: 'link' }, { id: 'y', label: '', url: 'https://ok.example' }, { id: 'z', label: 'Fine', url: 'https://ok.example', kind: 'weird' }] } } });
  ok(lead().portal.documents.length === 1 && lead().portal.documents[0]?.id === 'z' && lead().portal.documents[0]?.kind === 'link', 'a javascript: link and a blank label are dropped, an unknown kind becomes link', 'documents-safe');
  await admin({ id: LEAD, set: { portal: { documents: Array.from({ length: 60 }, (_, i) => ({ id: `n${i}`, label: `Doc ${i}`, url: 'https://ok.example/' + i })) } } });
  ok(lead().portal.documents.length === 50, 'documents cap at 50', 'documents-cap');
  await admin({ id: LEAD, set: { portal: { documents: [] } } });
  r2 = await pub('GET', { token: t3 });
  ok(!card(r2, 'documents'), 'an emptied list renders no documents card', 'auto-empty');

  /* 7. the PIN: hashed, never four digits in the record; a wrong one 401; five tries per fifteen minutes; the right one answers an unlock the GET honours */
  r = await admin({ id: LEAD, set: { portal: { pin: '1234' } } });
  const stored = lead().portal.pin;
  ok(r._status === 200 && stored && stored !== '1234' && !/^\d{4}$/.test(stored), `the PIN is stored hashed (${String(stored).slice(0, 8)}...)`, 'pin-hash');
  r = await admin({ id: LEAD, set: { portal: { pin: '12' } } });
  ok(lead().portal.pin === '' , 'a PIN that is not four digits clears it', 'pin-shape');
  await admin({ id: LEAD, set: { portal: { pin: '1234' } } });
  ok(lead().portal.pin === stored, 'the same PIN hashes the same');
  await admin({ id: LEAD, set: { portal: { modules: { contact: 'on' } } } });
  r2 = await pub('GET', { token: t3 });
  ok(r2._json?.pinned === true && r2._json?.unlocked === false, 'GET says the portal is pinned and not unlocked');
  let wrong = await pub('POST', { token: t3 }, { action: 'pin', pin: '0000' });
  ok(wrong._status === 401 && !wrong._json?.unlock, `a wrong PIN is 401 with no unlock (${wrong._status})`, 'pin-check');
  for (let i = 0; i < 4; i++) wrong = await pub('POST', { token: t3 }, { action: 'pin', pin: '0000' });
  const sixth = await pub('POST', { token: t3 }, { action: 'pin', pin: '1234' });
  ok(sixth._status === 429 && !sixth._json?.unlock && sixth._headers['retry-after'], `the sixth try in fifteen minutes is 429 even with the right PIN (${sixth._status})`, 'pin-limit');
  const { rateKey, rateClear } = await load('_lib/limit.js'); const { getDb } = await load('_lib/mongo.js');
  await rateClear(await getDb(), rateKey('ppin', t3));
  const right = await pub('POST', { token: t3 }, { action: 'pin', pin: '1234' });
  ok(right._status === 200 && typeof right._json?.unlock === 'string' && right._json.unlock.includes('.'), `the right PIN answers an unlock token (${right._status})`, 'pin-check');
  const bogus = await pub('POST', { token: t3 }, { action: 'nope' });
  ok(bogus._status === 400, 'an unknown action is 400');
  const other = await pub('POST', { token: t3 }, { action: 'pin', pin: 1234 });
  ok(other._status === 200 && other._json?.unlock, 'a numeric 1234 is the same PIN');

  /* 8. a sensitive card (test only) is locked until the device unlocked it; the unlock is bound to this token and expiry */
  const secret = { id: 'secret', title: 'Secret', order: 99, sensitive: true, defaultState: 'auto', auto: 'test', fields: ['amount'], resolve: () => ({ amount: 'owed 1,200', notes: 'internal', phone: '555-0199' }) };
  const withSecret = [...reg.PORTAL_MODULES, secret];
  const settings = { profile: profile(), meetingLink: '' };
  const lockedCards = reg.portalCards(lead(), _stores.projects, settings, { unlocked: false, modules: withSecret });
  const sc = lockedCards.find(c => c.id === 'secret');
  ok(sc && sc.locked === true && sc.amount === undefined && JSON.stringify(sc).includes('555-0199') === false, `locked: the sensitive card comes as { id, title, sensitive, locked } only (${JSON.stringify(sc)})`, 'pin-gate');
  const openCards = reg.portalCards(lead(), _stores.projects, settings, { unlocked: true, modules: withSecret });
  const so = openCards.find(c => c.id === 'secret');
  ok(so && so.amount === 'owed 1,200' && so.notes === undefined && so.phone === undefined && so.locked === undefined, `unlocked: the sensitive card carries only its fields (${JSON.stringify(so)})`, 'card-fields');
  ok(lockedCards.filter(c => !c.sensitive).length === openCards.filter(c => !c.sensitive).length, 'the lock touches only sensitive cards');
  r2 = await pub('GET', { token: t3, unlock: right._json.unlock });
  ok(r2._status === 200 && r2._json?.unlocked === true, 'GET with the unlock token says unlocked', 'unlock-verify');
  r2 = await pub('GET', { token: t3, unlock: right._json.unlock.replace(/.$/, c => (c === 'a' ? 'b' : 'a')) });
  ok(r2._json?.unlocked === false, 'a tampered unlock token is not unlocked', 'unlock-verify');
  const [exp] = right._json.unlock.split('.');
  ok(Number(exp) > Date.now() + 29 * 86400000 && Number(exp) < Date.now() + 31 * 86400000, 'the unlock lasts thirty days', 'unlock-days');
  await admin({ id: LEAD, set: { portal: { regenerate: true } } });
  r2 = await pub('GET', { token: lead().portal.token, unlock: right._json.unlock });
  ok(r2._status === 200 && r2._json?.unlocked === false, 'a regenerate kills the old unlock too', 'unlock-verify');
  await admin({ id: LEAD, set: { portal: { pin: '' } } });
  r2 = await pub('GET', { token: lead().portal.token });
  ok(lead().portal.pin === '' && r2._json?.pinned === false && r2._json?.unlocked === true, 'an empty PIN clears it; the portal is open again');
  const nopin = await pub('POST', { token: lead().portal.token }, { action: 'pin', pin: '1234' });
  ok(nopin._status === 200 && nopin._json?.unlock === '', 'POST pin on a portal without a PIN answers an empty unlock');

  /* 9. the settings profile: the four new fields are shaped */
  r = await admin({ set: { profile: { phone: '+1 (555) 010-0199 ext', email: 'not an email', calendlyLink: 'javascript:alert(1)', hours: '  Weekdays   9 to 5 ' } } }, 'settings');
  const pr = profile();
  ok(r._status === 200 && pr.phone === '+1 (555) 010-0199' && pr.email === '' && pr.calendlyLink === '' && pr.hours === 'Weekdays 9 to 5', `the profile shapes phone, email, calendlyLink and hours (${JSON.stringify({ phone: pr.phone, email: pr.email, calendlyLink: pr.calendlyLink, hours: pr.hours })})`, 'profile-shape');
  const { MEETING_LINK } = await load('_lib/config.js');
  r2 = await pub('GET', { token: lead().portal.token });
  ok(card(r2, 'book')?.url === MEETING_LINK, `no Calendly link in the profile: the book card falls back to the studio link in the config (${card(r2, 'book')?.url})`);
  process.env.CALENDLY_MEETING_LINK = 'https://calendly.com/visualize/studio';
  r2 = await pub('GET', { token: lead().portal.token });
  ok(card(r2, 'book')?.url === 'https://calendly.com/visualize/studio', 'CALENDLY_MEETING_LINK overrides the config link');
  delete process.env.CALENDLY_MEETING_LINK;
  await admin({ id: LEAD, set: { portal: { modules: { book: 'off' } } } });
  r2 = await pub('GET', { token: lead().portal.token });
  ok(!card(r2, 'book'), 'book off hides the card', 'state-off');

  /* 10. the public door: only GET and POST, the body cap, no admin */
  const del = await pub('DELETE', { token: lead().portal.token });
  ok(del._status === 405, `DELETE is 405 (${del._status})`);

  fs.rmSync(tmp, { recursive: true, force: true });
  return results;
}
