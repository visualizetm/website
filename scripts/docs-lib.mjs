/* The client docs checks (docs/SECURITY-AUDIT.md, Client docs): one module, three users, the same shape as
 * scripts/concepts-review-lib.mjs.
 *   scripts/docs-test.mjs          runs every check against the real api/
 *   scripts/security-test.mjs      runs the guard checks as part of the security gate
 *   scripts/docs-guard-proof.mjs   runs the same checks against a copy of api/ with ONE guard cut out and
 *                                  expects exactly that guard's check to fail
 * runDocs(apiSrc) copies apiSrc into a temp tree with _lib/mongo.js swapped for the in-memory fake, loads the real
 * admin dispatcher (api/admin/index.js, as in production) and returns [{ id, guard, desc, pass }]. */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const here = path.dirname(new URL(import.meta.url).pathname);
export const repoRoot = path.resolve(here, '..');

export async function runDocs(apiSrc = path.join(repoRoot, 'api')) {
  const tmpBase = path.join(repoRoot, '.tmp-verify');
  fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'docs-'));
  const apiDst = path.join(tmp, 'api');
  fs.cpSync(apiSrc, apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-not-real';
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const adminIndex = (await load('admin/index.js')).default;
  const { signSession } = await load('_lib/auth.js');
  const BL = await load('_lib/docBlocks.js');

  const A = '507f1f77bcf86cd799439041'; const B = '507f1f77bcf86cd799439042';
  const PA = '507f1f77bcf86cd799439051'; const PB = '507f1f77bcf86cd799439052';
  const CA = '507f1f77bcf86cd799439061'; const CB = '507f1f77bcf86cd799439062';
  function seed() {
    _reset();
    _stores.call_leads = [
      { _id: A, business: 'Kims Cafe', checklists: [{ id: 'la', name: 'Tasks', items: [{ id: 'taskA', text: 'Send proof' }] }], deal: { invoices: [{ id: 'dealInvA', label: 'Deposit' }] } },
      { _id: B, business: 'Other Co', checklists: [{ id: 'lb', name: 'Tasks', items: [{ id: 'taskB', text: 'Theirs' }] }], deal: { invoices: [{ id: 'dealInvB' }] } },
    ];
    _stores.projects = [
      { _id: PA, leadId: A, name: 'Brand', checklists: [{ id: 'pl', items: [{ id: 'ptaskA', text: 'x' }] }], invoices: [{ id: 'invA' }], deliverables: [{ id: 'fileA', label: 'Logo' }] },
      { _id: PB, leadId: B, name: 'Their brand', checklists: [{ id: 'pl2', items: [{ id: 'ptaskB', text: 'y' }] }], invoices: [{ id: 'invB' }], deliverables: [{ id: 'fileB', label: 'Cards' }] },
    ];
    _stores.concept_sets = [{ _id: CA, leadId: A, title: 'Round 1' }, { _id: CB, leadId: B, title: 'Theirs' }];
    _stores.settings = [];
    _stores.docs = [];
  }
  const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; return this; }, getHeader(k) { return this._headers[k]; }, end() { this.headersSent = true; return this; } });
  const cookie = `vz_admin=${signSession()}`;
  const call = async (method, body, query = {}, withCookie = true) => {
    const req = { method, query: { r: 'docs', ...query }, body, headers: { ...(withCookie ? { cookie } : {}), 'x-forwarded-for': '198.51.100.7' }, url: '/api/admin/docs', socket: {} };
    const res = fakeRes();
    try { await adminIndex(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
    return res;
  };
  const para = (text, extra = {}) => ({ type: 'p', runs: [{ t: text }], ...extra });
  const mk = async (body) => (await call('POST', { leadId: A, type: 'brief', title: 'T', ...body }));
  const stored = (id) => _stores.docs.find(d => String(d._id) === String(id));
  const S = (id) => stored(id) || { blocks: [], title: '', text: '', runs: [] };

  const out = [];
  const check = (id, guard, desc, pass) => out.push({ id, guard, desc, pass: !!pass });

  /* ── Admin only ─────────────────────────────────────────────────────── */
  seed();
  let r = await call('GET', undefined, {}, false);
  const noCookie = [r._status];
  r = await call('POST', { leadId: A, title: 'x', blocks: [para('hi')] }, {}, false); noCookie.push(r._status, _stores.docs.length);
  r = await call('DELETE', { id: 'x' }, {}, false); noCookie.push(r._status);
  check('admin-only', 'admin-only', 'every docs method without the admin cookie is 401 and nothing is written', noCookie[0] === 401 && noCookie[1] === 401 && noCookie[2] === 0 && noCookie[3] === 401);

  /* ── Create, read, list ─────────────────────────────────────────────── */
  seed();
  r = await mk({ blocks: [{ type: 'h1', runs: [{ t: 'Brief', b: 1 }] }, para('We need a logo.')] });
  const id1 = r._json?.item?._id;
  check('create', null, 'a doc is created for a client with its type, title, blocks, search text and timestamps', r._status === 200 && S(id1).leadId === A && S(id1).type === 'brief' && S(id1).blocks.length === 2 && /logo/.test(S(id1).text) && S(id1).createdAt && S(id1).updatedAt && S(id1).pinned === false);
  check('history-created', null, 'creating a doc logs one Created doc line on the client', _stores.call_leads[0].docLog?.length === 1 && _stores.call_leads[0].docLog[0].action === 'created' && _stores.call_leads[0].docLog[0].title === 'T');
  r = await call('GET', undefined, { id: id1 });
  check('read-one', null, 'one doc reads with its blocks', r._status === 200 && r._json.item.blocks.length === 2);
  r = await call('GET', undefined, { leadId: A });
  check('list-meta', 'list-meta', 'the list answers titles and search text and never the blocks', r._status === 200 && r._json.items.length === 1 && !('blocks' in r._json.items[0]) && typeof r._json.items[0].text === 'string');
  await mk({ leadId: B, title: 'Theirs' });
  r = await call('GET', undefined, { leadId: A });
  check('list-per-client', null, 'a client\'s list holds that client\'s docs only', r._json.items.length === 1 && r._json.items[0].leadId === A);
  r = await call('GET');
  check('list-all', null, 'the list with no client holds every client\'s docs', r._json.items.length === 2);
  r = await call('POST', { leadId: '507f1f77bcf86cd7994390ff', title: 'x' });
  check('lead-exists', 'lead-exists', 'a doc for a client that does not exist is 400', r._status === 400 && _stores.docs.length === 2);

  /* ── The schema ─────────────────────────────────────────────────────── */
  seed();
  r = await mk({ type: 'nonsense', title: ` ${'T'.repeat(400)} `, blocks: [para('ok')] });
  check('type-whitelist', 'type-whitelist', 'an unknown type is General and a title is cut at 160', S(r._json.item._id).type === 'general' && S(r._json.item._id).title.length === 160);
  r = await mk({ blocks: [{ type: 'p', runs: [{ t: 'ok' }] }, { type: 'iframe', html: '<script>alert(1)</script>', runs: [{ t: 'x' }], ref: { kind: 'task', id: 'taskA' }, label: 'x' }, { type: 'script', runs: [{ t: 'x' }] }, 'p', null] });
  check('block-type', 'block-type', 'a block of a type the schema does not know is not written', r._status === 200 && S(r._json.item._id).blocks.length === 1 && S(r._json.item._id).blocks[0].type === 'p');
  r = await mk({ blocks: [{ type: 'p', runs: [{ t: 'x'.repeat(10000) }] }] });
  const total = S(r._json.item._id).blocks[0].runs.reduce((n, x) => n + x.t.length, 0);
  check('text-cap', 'text-cap', 'a paragraph is cut at 4,000 characters', total === 4000);
  r = await mk({ blocks: Array.from({ length: 600 }, (_, i) => para(`n${i}`)) });
  check('block-cap', 'block-cap', 'a doc holds at most 400 blocks', S(r._json.item._id).blocks.length === 400);
  r = await mk({ blocks: [{ type: 'link', url: 'javascript:alert(1)', text: 'x' }, { type: 'link', url: 'https://example.com/a b', text: 'x' }, { type: 'link', url: 'https://example.com/a', text: 'ok' }, { type: 'p', runs: [{ t: 'a', a: 'javascript:alert(1)' }, { t: 'b', a: 'data:text/html,<b>' }, { t: 'c', a: 'https://ok.example/x', b: 1, i: 1, color: 'red' }] }] });
  const bl = S(r._json.item._id).blocks;
  check('link-url', 'link-url', 'a link or a link mark that is not http or https is emptied, spaces included, and only bold, italic and link survive', bl[0].url === '' && bl[1].url === '' && bl[2].url === 'https://example.com/a' && bl[3].runs[0].a === undefined && bl[3].runs[1].a === undefined && bl[3].runs[2].a === 'https://ok.example/x' && bl[3].runs[2].color === undefined && bl[3].runs[2].b === 1);
  r = await mk({ blocks: [{ type: 'image', url: 'https://res.cloudinary.com/demo/image/upload/a.png', alt: 'ok' }, { type: 'image', url: 'https://evil.example/a.png' }, { type: 'image', url: 'http://res.cloudinary.com/demo/a.png' }, { type: 'image', url: 'https://res.cloudinary.com.evil.example/a.png' }, { type: 'image', url: 'javascript:alert(1)' }] });
  const im = S(r._json.item._id).blocks;
  check('image-host', 'image-host', 'an image keeps only an https URL on the Cloudinary host', im[0].url.includes('res.cloudinary.com') && im.slice(1).every(b => b.url === ''));
  r = await mk({ blocks: [para('<img src=x onerror=alert(1)> and <b>bold</b>')] });
  check('text-is-text', null, 'markup typed into a paragraph is stored as the text it is, never as a block or a tag the schema reads', S(r._json.item._id).blocks.length === 1 && S(r._json.item._id).blocks[0].type === 'p' && Object.keys(S(r._json.item._id).blocks[0]).sort().join() === 'id,runs,type');
  r = await mk({ blocks: [{ id: 'dup', type: 'p', runs: [{ t: 'a' }] }, { id: 'dup', type: 'p', runs: [{ t: 'b' }] }, { id: '<x>', type: 'divider' }] });
  const ids = S(r._json.item._id).blocks.map(b => b.id);
  check('unique-ids', null, 'block ids stay unique and plain', new Set(ids).size === 3 && ids.every(i => /^[A-Za-z0-9_-]+$/.test(i)));

  /* ── References stay on the client ──────────────────────────────────── */
  seed();
  const ref = (kind, id) => ({ type: 'ref', ref: { kind, id }, label: 'x' });
  r = await mk({ blocks: [ref('concept', CA), ref('project', PA), ref('task', 'taskA'), ref('task', 'ptaskA'), ref('invoice', 'invA'), ref('invoice', 'dealInvA'), ref('file', 'fileA'), ref('file', 'drive')] });
  check('ref-own', null, 'a doc may reference its own client\'s concept set, project, task (client or project), invoice (deal or project) and file', r._status === 200 && S(r._json.item._id).blocks.length === 8);
  const foreign = [['concept', CB], ['project', PB], ['task', 'taskB'], ['task', 'ptaskB'], ['invoice', 'invB'], ['invoice', 'dealInvB'], ['file', 'fileB'], ['project', 'nope']];
  const before = _stores.docs.length;
  const statuses = []; for (const [k, i] of foreign) { const x = await mk({ blocks: [ref(k, i)] }); statuses.push(x._status); }
  check('ref-same-client', 'ref-same-client', 'a reference to another client\'s concept set, project, task, invoice or file, or to nothing, is 400 and the doc is not written', statuses.every(s => s === 400) && _stores.docs.length === before);
  const own = await mk({ blocks: [para('hi')] });
  const own_id = own._json.item._id;
  r = await call('PATCH', { id: own_id, set: { blocks: [ref('task', 'taskB')] } });
  check('ref-patch', 'ref-same-client', 'a save that adds another client\'s reference is 400 and the stored blocks are unchanged', r._status === 400 && S(own_id).blocks.length === 1 && S(own_id).blocks[0].type === 'p');
  r = await call('PATCH', { id: own_id, set: { blocks: [ref('task', 'taskA')] } });
  _stores.call_leads[0].checklists[0].items = [];
  r = await call('PATCH', { id: own_id, set: { blocks: [ref('task', 'taskA'), para('after the task was deleted')] } });
  check('ref-stale-kept', null, 'a reference already in the doc stays savable after its record is gone', r._status === 200 && S(own_id).blocks.length === 2);
  r = await call('POST', { template: true, title: 'T', blocks: [ref('task', 'taskA')] });
  check('template-no-ref', null, 'a template cannot hold a reference', r._status === 400);

  /* ── Edits ──────────────────────────────────────────────────────────── */
  seed();
  r = await mk({ blocks: [para('one')] }); const e1 = r._json.item._id;
  r = await call('PATCH', { id: e1, set: { leadId: B, deleted: true, template: true, createdAt: '2000-01-01', text: 'forged', title: 'Renamed', pinned: true } });
  check('whitelist', 'whitelist', 'a PATCH writes only title, type, projectId, pinned and blocks: leadId, deleted, template and createdAt are ignored', r._status === 200 && S(e1).leadId === A && S(e1).deleted === false && S(e1).template === false && S(e1).title === 'Renamed' && S(e1).pinned === true && S(e1).text !== 'forged' && String(S(e1).createdAt).indexOf('2000') < 0);
  r = await call('PATCH', { id: e1, set: { leadId: B } });
  check('empty-patch', null, 'a PATCH with nothing the schema knows is 400', r._status === 400);
  const t0 = String(S(e1).updatedAt);
  r = await call('PATCH', { id: e1, set: { pinned: false } });
  check('pin-keeps-edit-time', null, 'pinning does not change the edit time', String(S(e1).updatedAt) === t0 && S(e1).pinned === false);
  r = await call('PATCH', { id: e1, set: { blocks: [para('two')] } });
  check('edit-blocks', null, 'saving blocks replaces them and refreshes the search text', r._status === 200 && S(e1).blocks[0].runs[0].t === 'two' && /two/.test(S(e1).text) && !/one/.test(S(e1).text));
  r = await call('PATCH', { id: e1, set: { projectId: PB } });
  check('project-same-client', 'project-same-client', 'a project of another client cannot be attached', r._status === 400 && !S(e1).projectId);
  r = await call('PATCH', { id: e1, set: { projectId: PA } });
  check('project-own', null, 'this client\'s project can be attached', r._status === 200 && S(e1).projectId === PA);
  r = await call('POST', { leadId: A, title: 'x', projectId: PB });
  check('project-create', 'project-same-client', 'a doc cannot be created on another client\'s project', r._status === 400);

  /* ── Delete, restore, purge ─────────────────────────────────────────── */
  r = await call('DELETE', { id: e1 });
  check('delete-soft', null, 'delete moves the doc to Recently Deleted (deleted, deletedAt) and logs Deleted doc', r._status === 200 && S(e1).deleted === true && !!S(e1).deletedAt && _stores.call_leads[0].docLog.some(x => x.action === 'deleted' && x.docId === String(e1)));
  r = await call('GET', undefined, { leadId: A });
  check('delete-hidden', null, 'a deleted doc leaves the client\'s list and the full list', !r._json.items.some(d => String(d._id) === String(e1)));
  r = await call('GET', undefined, { deleted: '1' });
  check('deleted-list', null, 'Recently Deleted lists it, without blocks', r._json.items.length === 1 && !('blocks' in r._json.items[0]));
  r = await call('PATCH', { id: e1, set: { title: 'Edited while deleted' } });
  check('deleted-readonly', 'deleted-readonly', 'a deleted doc cannot be edited', r._status === 404 && S(e1).title === 'Renamed');
  r = await call('DELETE', { id: e1, purge: true }); const purgedDeleted = r._status;
  const live = (await mk({ blocks: [para('live')] }))._json.item._id;
  r = await call('DELETE', { id: live, purge: true });
  check('purge-needs-deleted', 'purge-needs-deleted', 'purge removes a deleted doc and refuses one that is not deleted', purgedDeleted === 200 && !stored(e1) && r._status === 400 && !!stored(live));
  r = await call('DELETE', { id: live }); r = await call('PATCH', { id: live, restore: true });
  check('restore', null, 'restore brings a deleted doc back', r._status === 200 && S(live).deleted === false && !S(live).deletedAt);

  /* ── Caps ───────────────────────────────────────────────────────────── */
  seed();
  _stores.docs = Array.from({ length: 300 }, (_, i) => ({ _id: `d${i}`, leadId: A, deleted: false, template: false, blocks: [], title: String(i) }));
  r = await mk({ blocks: [para('one more')] });
  check('doc-cap', 'doc-cap', 'a client holds at most 300 docs', r._status === 400 && _stores.docs.length === 300);

  /* ── Templates ──────────────────────────────────────────────────────── */
  seed();
  r = await call('POST', { template: true, type: 'contract', title: 'My contract', blocks: [para('Hello [client name]')] });
  const tid = r._json?.item?._id;
  check('template-create', null, 'a template has no client, is a template and never appears in a client\'s list or Recently Deleted', r._status === 200 && S(tid).leadId === '' && S(tid).template === true && !(await call('GET'))._json.items.some(d => String(d._id) === String(tid)) && !(await call('GET', undefined, { deleted: '1' }))._json.items.some(d => String(d._id) === String(tid)));
  r = await call('GET', undefined, { templates: '1' });
  check('template-list', null, 'the template list holds it with its blocks, and the built in preferences', r._json.items.length === 1 && r._json.items[0].blocks.length === 1 && Array.isArray(r._json.prefs.hidden));
  r = await call('PATCH', { prefs: { hidden: ['contract', 'x'.repeat(200)], order: ['a', 'b'] } });
  const prefs = (await call('GET', undefined, { templates: '1' }))._json.prefs;
  check('template-prefs', null, 'the hidden and order of the built in templates save', r._status === 200 && prefs.hidden[0] === 'contract' && prefs.hidden[1].length === 64 && prefs.order.join() === 'a,b');
  r = await call('DELETE', { id: tid });
  check('template-delete', null, 'deleting a template removes it', r._status === 200 && !stored(tid));

  /* ── The mirror ─────────────────────────────────────────────────────── */
  const mirror = fs.readFileSync(path.join(repoRoot, 'src', 'shared', 'docBlocks.js'), 'utf8') === fs.readFileSync(path.join(apiDst, '_lib', 'docBlocks.js'), 'utf8');
  check('mirror', null, 'src/shared/docBlocks.js and api/_lib/docBlocks.js are identical', mirror);
  check('plain-text', null, 'the plain text export numbers lists, marks checks and quotes, and carries no markup', BL.docPlainText({ title: 'Doc', blocks: [{ type: 'ol', runs: [{ t: 'a' }] }, { type: 'ol', runs: [{ t: 'b', b: 1 }] }, { type: 'check', checked: true, runs: [{ t: 'c' }] }, { type: 'quote', runs: [{ t: 'q' }] }] }) === 'Doc\n\n1. a\n2. b\n[x] c\n> q');

  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}
