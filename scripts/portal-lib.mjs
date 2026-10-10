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
export const FORBIDDEN_KEYS = ['_id', 'email', 'phone', 'purchases', 'invoices', 'notes', 'checklists'];
const PRIVATE = ['555-0199', 'owner@sharpless.example', 'internal only note', 'https://drive.example/private', LEAD, 'inv-9001', 'purchase-77'];
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
      { _id: 'p1', leadId: LEAD, name: 'Website', kind: 'website', stage: 'design', createdAt: '2026-09-01T00:00:00.000Z', invoices: [{ id: 'inv-9001' }] },
      { _id: 'p0', leadId: LEAD, name: 'Old logo', kind: 'brand', stage: 'delivered', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    _stores.settings = [{ _id: 'profile', name: 'Rob', phone: '555 0100', email: 'contact@visualizeclients.com', calendlyLink: 'https://calendly.com/visualize/call', hours: 'Weekdays 9 to 5' }];
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
  ok(top === 'cards,client,pinned,unlocked', `GET answers exactly { client, cards, pinned, unlocked } (${top})`, 'get-whitelist');
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
  ok(cardIds(live) === 'home,contact,book,documents,showcase'.replace(',documents', ''), `all Auto with data: home, contact, book, showcase render in order, documents (empty) does not (${cardIds(live)})`, 'auto-empty');
  ok(card(live, 'home')?.status === 'Website: Design', `home's status line is the newest active project and its stage label (${card(live, 'home')?.status})`, 'home-status');
  ok(card(live, 'contact')?.sms === 'sms:5550100' && card(live, 'contact')?.mailto === 'mailto:contact@visualizeclients.com' && card(live, 'contact')?.instagram === 'visualizetm' && card(live, 'contact')?.hours === 'Weekdays 9 to 5', `contact carries ready sms: and mailto: hrefs, the Instagram handle and my hours (${JSON.stringify(card(live, 'contact'))})`);
  ok(card(live, 'book')?.url === 'https://calendly.com/visualize/call', 'book carries the Calendly link from Settings, Profile');
  ok(card(live, 'showcase')?.url === 'https://visualizestudio.org/clients/sharpless-detailing' && /Share|made with Visualize/i.test(card(live, 'showcase')?.message || ''), 'showcase carries the public showcase link and a share line');
  _stores.projects = _stores.projects.filter(p => p._id !== 'p1');
  let r2 = await pub('GET', { token: t2 });
  ok(card(r2, 'home')?.status === 'All set', `no active project: the status line is All set (${card(r2, 'home')?.status})`, 'home-status');
  seed(); await admin({ id: LEAD, set: { portal: {} } }); const t3 = lead().portal.token;

  /* 5. module states: off never renders even with data; on renders only with data; auto equals on */
  await admin({ id: LEAD, set: { portal: { modules: { contact: 'off', showcase: 'off' } } } });
  r2 = await pub('GET', { token: t3 });
  ok(!card(r2, 'contact') && !card(r2, 'showcase') && card(r2, 'book'), `off never renders even with data (${cardIds(r2)})`, 'state-off');
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
