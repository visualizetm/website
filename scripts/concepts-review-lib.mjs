/* The Review each checks (docs/CONCEPTS-AUDIT.md, Concepts review): one module, three users.
 *   scripts/concepts-review-test.mjs   runs every check against the real api/
 *   scripts/security-test.mjs          runs the guard checks as part of the security gate
 *   scripts/concepts-guard-proof.mjs   runs the same checks against a copy of api/ with ONE guard cut out and
 *                                      expects exactly that guard's check to fail
 *
 * runReview(apiSrc) copies apiSrc into a temp tree with _lib/mongo.js swapped for the in-memory fake, loads the
 * real handlers and returns [{ id, guard, desc, pass }]. A check with a guard id is one the proof cuts out; the
 * rest are behaviour checks. Nothing here is a mock of the handler: the public door is api/showcase.js?r=concepts
 * and the admin door is api/admin/index.js, as in production. */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const here = path.dirname(new URL(import.meta.url).pathname);
export const repoRoot = path.resolve(here, '..');

export async function runReview(apiSrc = path.join(repoRoot, 'api')) {
  const tmpBase = path.join(repoRoot, '.tmp-verify');
  fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'review-'));
  const apiDst = path.join(tmp, 'api');
  fs.cpSync(apiSrc, apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-not-real';
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _log, _reset } = await load('_lib/mongo.js');
  const showcase = (await load('showcase.js')).default;
  const adminIndex = (await load('admin/index.js')).default;
  const { signSession } = await load('_lib/auth.js');
  /* A real VAPID pair so sendPush gets as far as reading the subscriptions: that read is how a push is seen. */
  const wp = (await import('web-push')).default;
  const keys = wp.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey; process.env.VAPID_PRIVATE_KEY = keys.privateKey;

  const LEAD = '507f1f77bcf86cd799439031';
  const T = { REV: 'rvw_review_token_abcdefghijkl', PASS: 'rvw_pass_token_abcdefghijklmn', PICK: 'rvw_pick_token_abcdefghijklmn', OLD: 'rvw_old_token_abcdefghijklmnop', DRAFT: 'rvw_draft_token_abcdefghijklm', ZERO: 'rvw_zero_token_abcdefghijklmn' };
  const dir = (id, name, over = {}) => ({ id, name, rationale: `${name} says hello.`, order: 0, needsDecision: true, items: [{ id: `${id}i1`, kind: 'logo', image: 'https://img.example/a.png', caption: 'Mark', order: 0 }], ...over });
  const dirs = () => [dir('d1', 'Logo'), dir('d2', 'Card'), dir('d3', 'Homepage'), dir('d4', 'Mood board', { needsDecision: false })].map((d, i) => ({ ...d, order: i }));
  const base = (over) => ({ leadId: LEAD, title: 'Brand', round: 1, intro: 'Hi.', directions: dirs(), feedback: [], approvedDirectionId: '', approvedAt: '', lastViewedAt: '', submissions: [], submittedAt: '', ...over });
  function seed() {
    _reset();
    _stores.call_leads = [{ _id: LEAD, business: 'Kims Cafe', checklists: [] }];
    _stores.settings = [];
    _stores.push_subscriptions = [];
    _stores.concept_sets = [
      { _id: 'c07f1f77bcf86cd799439101', token: T.REV, status: 'sent', approvalMode: 'review', allowPass: false, ...base({}) },
      { _id: 'c07f1f77bcf86cd799439102', token: T.PASS, status: 'sent', approvalMode: 'review', allowPass: true, ...base({}) },
      { _id: 'c07f1f77bcf86cd799439103', token: T.PICK, status: 'sent', approvalMode: 'pick', ...base({ directions: dirs().map(d => ({ ...d, needsDecision: true })) }) },
      /* An older document: no approvalMode, allowPass, needsDecision, submittedAt or submissions at all. */
      { _id: 'c07f1f77bcf86cd799439104', token: T.OLD, status: 'sent', leadId: LEAD, title: 'Old', round: 1, intro: '', directions: [{ id: 'o1', name: 'Old A', rationale: '', order: 0, items: [] }, { id: 'o2', name: 'Old B', rationale: '', order: 1, items: [] }], feedback: [] },
      { _id: 'c07f1f77bcf86cd799439105', token: T.DRAFT, status: 'draft', approvalMode: 'review', ...base({}) },
      { _id: 'c07f1f77bcf86cd799439106', token: T.ZERO, status: 'draft', approvalMode: 'review', ...base({ directions: dirs().map(d => ({ ...d, needsDecision: false })) }) },
    ];
  }
  const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, headersSent: false, status(c) { this._status = c; return this; }, json(p) { this._json = p; this.headersSent = true; return this; }, setHeader(k, v) { this._headers[k] = v; return this; }, getHeader(k) { return this._headers[k]; }, end() { this.headersSent = true; return this; } });
  let ip = 10;
  const pub = async (method, token, body) => {
    const req = { method, query: { r: 'concepts', token }, body, headers: { 'x-forwarded-for': `203.0.113.${ip++ % 250}` }, url: '/api/concepts', socket: {} };
    const res = fakeRes();
    try { await showcase(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
    return res;
  };
  const cookie = `vz_admin=${signSession()}`;
  const admin = async (method, r, body, query = {}) => {
    const req = { method, query: { r, ...query }, body, headers: { cookie, 'x-forwarded-for': '198.51.100.7' }, url: `/api/admin/${r}`, socket: {} };
    const res = fakeRes();
    try { await adminIndex(req, res); } catch (e) { res._status = 599; res._json = { thrown: String(e?.message || e) }; }
    return res;
  };
  const set = (token) => _stores.concept_sets.find(s => s.token === token);
  const decide = (token, directionId, status, note = '') => pub('POST', token, { action: 'decide', directionId, status, note });
  const answerAll = async (token, status = 'approved') => { for (const id of ['d1', 'd2', 'd3']) await decide(token, id, status, status === 'changes' ? 'tweak it' : ''); };

  const out = [];
  const check = (id, guard, desc, pass) => out.push({ id, guard, desc, pass: !!pass });

  /* ── The read: exact shape, mode and answers ───────────────────────── */
  seed();
  let r = await pub('GET', T.REV);
  check('get-shape', null, 'a review set reads approvalMode, allowPass, submittedAt, and each direction its needsDecision and decision', r._status === 200
    && r._json.set.approvalMode === 'review' && r._json.set.allowPass === false && r._json.set.submittedAt === ''
    && r._json.directions.map(d => d.needsDecision).join() === 'true,true,true,false' && r._json.directions.every(d => d.decision === null)
    && Object.keys(r._json.set).sort().join() === 'allowPass,approvalMode,approvedDirectionId,intro,round,status,submittedAt,title');
  r = await pub('GET', T.OLD);
  check('old-doc', null, 'an older document reads as Pick one with every direction needing nothing special and no decisions', r._status === 200
    && r._json.set.approvalMode === 'pick' && r._json.set.allowPass === false && r._json.directions.every(d => d.needsDecision === true && d.decision === null));

  /* ── decide ─────────────────────────────────────────────────────────── */
  seed();
  r = await decide(T.REV, 'd1', 'approved');
  check('decide-saves', null, 'decide saves an answer on one direction and the set stays open', r._status === 200 && set(T.REV).directions[0].decision?.status === 'approved' && !set(T.REV).submittedAt);
  r = await decide(T.REV, 'd1', 'changes', 'Make it bolder');
  check('decide-overwrites', null, 'a changed answer overwrites the draft', r._status === 200 && set(T.REV).directions[0].decision.status === 'changes' && set(T.REV).directions[0].decision.note === 'Make it bolder');
  r = await pub('GET', T.REV);
  check('decide-returns', null, 'the saved answer comes back on the next read, to the one holding the link', r._json.directions[0].decision?.status === 'changes' && r._json.directions[0].decision.note === 'Make it bolder' && r._json.directions[1].decision === null);
  r = await decide(T.REV, 'd2', 'changes', '');
  check('changes-needs-note', 'changes-note', 'Needs changes without a note is 400 and nothing is written', r._status === 400 && !set(T.REV).directions[1].decision);

  /* the guards, one set each */
  seed();
  const other = { ...base({ directions: [dir('dZ', 'Theirs')] }), _id: 'c07f1f77bcf86cd799439199', token: 'rvw_other_token_abcdefghijklm', status: 'sent', approvalMode: 'review' };
  _stores.concept_sets.push(other);
  r = await decide(T.REV, 'dZ', 'approved');
  check('guard-belongs', 'belongs', 'a direction id from another set is the same 404 and writes nothing, here or there', r._status === 404 && JSON.stringify(set(T.REV).directions).indexOf('decision') < 0 && !other.directions[0].decision);

  seed();
  const huge = 'x'.repeat(5000);
  r = await decide(T.REV, 'd1', 'changes', huge);
  check('guard-cap', 'note-cap', 'a note is cut at 1,000 characters', r._status === 200 && set(T.REV).directions[0].decision.note.length === 1000);
  r = await decide(T.REV, 'd2', 'changes', 'Nice <img src=x onerror=alert(1)> and <script>alert(1)</script>bold <b>text</b>');
  const stored = set(T.REV).directions[1].decision?.note || '';
  check('guard-html', 'strip-html', 'HTML tags are stripped from a note before it is stored', r._status === 200 && !/<[a-z/!]/i.test(stored) && stored.includes('Nice') && stored.includes('bold'));

  seed();
  r = await decide(T.REV, 'd4', 'approved');
  check('guard-reference', 'reference', 'an answer on a For reference direction is refused and nothing is stored', r._status === 400 && !set(T.REV).directions[3].decision);

  seed();
  r = await decide(T.REV, 'd1', 'pass');
  check('guard-pass-off', 'pass-off', 'Not this one is refused when the set does not allow it', r._status === 400 && !set(T.REV).directions[0].decision);
  r = await decide(T.PASS, 'd1', 'pass');
  check('pass-on', null, 'Not this one is saved when the set allows it', r._status === 200 && set(T.PASS).directions[0].decision.status === 'pass');

  seed();
  r = await decide(T.REV, 'd1', 'maybe');
  check('bad-status', null, 'an answer that is not approved, changes or pass is 400', r._status === 400 && !set(T.REV).directions[0].decision);

  seed();
  r = await decide(T.PICK, 'd1', 'approved');
  const r2 = await pub('POST', T.REV, { action: 'approve', directionId: 'd1' });
  const r3 = await pub('POST', T.REV, { action: 'change', directionId: 'd1', note: 'x' });
  check('guard-mode', 'mode', 'a review answer on a Pick one set, and approve or change on a Review each set, are 409 and write nothing', r._status === 409 && r2._status === 409 && r3._status === 409 && !set(T.PICK).directions[0].decision && set(T.REV).status === 'sent' && !set(T.REV).approvedDirectionId);

  /* submit */
  seed();
  await decide(T.REV, 'd1', 'approved'); await decide(T.REV, 'd2', 'approved');
  r = await pub('POST', T.REV, { action: 'submit', name: 'Kim' });
  check('guard-complete', 'complete', 'Send my answers with one still unanswered is 400, names it, and does not lock', r._status === 400 && JSON.stringify(r._json.remaining) === '["d3"]' && !set(T.REV).submittedAt && set(T.REV).status === 'sent');

  seed();
  await answerAll(T.REV, 'approved');
  _log.length = 0;
  r = await pub('POST', T.REV, { action: 'submit', name: 'Kim' });
  const s1 = set(T.REV);
  check('submit-ok', null, 'submit with every answer in locks the set, status approved, one submission copied, one feedback entry', r._status === 200 && s1.status === 'approved' && !!s1.submittedAt && s1.submissions.length === 1
    && s1.submissions[0].answers.length === 3 && s1.submissions[0].answers.every(a => a.status === 'approved') && s1.feedback.filter(f => f.action === 'submit').length === 1 && s1.approvedDirectionId === '');
  check('submit-task', null, 'one task "Review concept answers" is added to the client', (_stores.call_leads[0].checklists || []).flatMap(l => l.items).filter(t => t.text === 'Review concept answers' && !t.done).length === 1);
  check('submit-push', null, 'one push attempt for the whole submission', _log.filter(e => e.collection === 'push_subscriptions' && e.op === 'find').length === 1);
  r = await pub('GET', T.REV);
  check('submitted-read', null, 'the submitted set reads back with its answers and submittedAt', r._json.set.submittedAt && r._json.directions[0].decision.status === 'approved');
  /* The lock is tested on a set that came out as changes: its status is still open, so only the lock itself can stop a second answer. */
  seed();
  await answerAll(T.REV, 'changes');
  await pub('POST', T.REV, { action: 'submit', name: 'Kim' });
  _log.length = 0;
  r = await pub('POST', T.REV, { action: 'submit', name: 'Kim' });
  check('guard-resubmit', 'locked', 'a second submit is 409 and adds no task, push or submission', r._status === 409 && set(T.REV).submissions.length === 1 && _stores.call_leads[0].checklists.flatMap(l => l.items).length === 1 && _log.filter(e => e.collection === 'push_subscriptions').length === 0);
  r = await decide(T.REV, 'd1', 'approved');
  check('guard-locked', 'locked-decide', 'an answer after submit is 409 and the saved one stands', r._status === 409 && set(T.REV).directions[0].decision.status === 'changes');

  seed();
  await decide(T.REV, 'd1', 'approved'); await decide(T.REV, 'd2', 'changes', 'Bolder'); await decide(T.REV, 'd3', 'approved');
  await pub('POST', T.REV, { action: 'submit' });
  check('submit-changes', null, 'any Needs changes makes the set status changes', set(T.REV).status === 'changes' && set(T.REV).submissions[0].answers.find(a => a.directionId === 'd2').note === 'Bolder');
  seed();
  _stores.call_leads[0].checklists = [{ id: 'cl1', name: 'Concepts', items: [{ id: 't1', text: 'Review concept answers', done: false }] }];
  await answerAll(T.REV, 'approved'); await pub('POST', T.REV, { action: 'submit' });
  check('task-once', null, 'an open "Review concept answers" task already there is not added twice', _stores.call_leads[0].checklists.flatMap(l => l.items).filter(t => t.text === 'Review concept answers').length === 1);
  seed();
  await answerAll(T.PASS, 'pass'); r = await pub('POST', T.PASS, { action: 'submit' });
  check('all-pass', null, 'a set answered all Not this one is submitted as changes, not approved', r._status === 200 && set(T.PASS).status === 'changes');

  /* ── admin side ─────────────────────────────────────────────────────── */
  seed();
  let a = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439106', set: { status: 'sent' } });
  check('guard-send-zero', 'send-zero', 'a Review each set with nothing that needs a decision cannot be sent', a._status === 400 && set(T.ZERO).status === 'draft');
  a = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439105', set: { status: 'sent' } });
  check('send-ok', null, 'a Review each set with items to decide sends', a._status === 200 && set(T.DRAFT).status === 'sent' && !!set(T.DRAFT).sentAt);

  seed();
  await decide(T.REV, 'd1', 'approved');
  a = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439101', set: { title: 'Brand v2', directions: dirs().map(d => ({ id: d.id, name: d.name + '!', rationale: d.rationale, order: d.order, needsDecision: d.needsDecision, items: d.items })) } });
  check('guard-keep-decision', 'keep-decision', 'rewriting directions[] from the editor keeps the client\'s saved answer', a._status === 200 && set(T.REV).directions[0].decision?.status === 'approved' && set(T.REV).directions[0].name === 'Logo!');
  a = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439101', set: { directions: dirs().map(d => ({ ...d, decision: { status: 'approved', note: 'forged', decidedAt: 'x' } })) } });
  check('forge-decision', null, 'a decision sent from the admin is not written (the client owns it)', set(T.REV).directions[1].decision === undefined);

  seed();
  await answerAll(T.REV, 'approved'); await pub('POST', T.REV, { action: 'submit' });
  a = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439101', set: { approvalMode: 'pick' } });
  const a2 = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439101', set: { allowPass: true } });
  const a3 = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439101', set: { directions: dirs().map(d => ({ ...d, needsDecision: !d.needsDecision })) } });
  check('guard-admin-lock', 'admin-lock', 'after a submission the mode, Not this one and which items need an answer are locked (409)', a._status === 409 && a2._status === 409 && a3._status === 409 && set(T.REV).approvalMode === 'review' && set(T.REV).allowPass === false);
  a = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439101', set: { title: 'Brand v2' } });
  check('edit-text-locked', null, 'a title edit is still allowed on a locked set', a._status === 200 && set(T.REV).title === 'Brand v2');
  a = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439101', set: { reopen: true } });
  const s2 = set(T.REV);
  check('reopen', null, 'Reopen for review unlocks it, clears the answers, status sent, and keeps the submission in history', a._status === 200 && !s2.submittedAt && s2.status === 'sent' && s2.directions.every(d => d.decision === undefined) && s2.submissions.length === 1 && !!s2.reopenedAt);
  a = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439101', set: { allowPass: true } });
  r = await decide(T.REV, 'd1', 'pass');
  check('after-reopen', null, 'after a reopen the mode can change and the client can answer again', a._status === 200 && r._status === 200);
  a = await admin('PATCH', 'concept-sets', { id: 'c07f1f77bcf86cd799439102', set: { reopen: true } });
  check('reopen-unsubmitted', null, 'Reopen on a set nobody has submitted is 409', a._status === 409);

  /* pick one stays as it was */
  seed();
  r = await pub('POST', T.PICK, { action: 'approve', directionId: 'd2' });
  check('pick-unchanged', null, 'Pick one still approves one direction and sets approvedDirectionId', r._status === 200 && set(T.PICK).status === 'approved' && set(T.PICK).approvedDirectionId === 'd2');
  r = await pub('POST', T.OLD, { action: 'approve', directionId: 'o1' });
  check('old-approve', null, 'an older document with none of the new fields still approves as before', r._status === 200 && set(T.OLD).approvedDirectionId === 'o1');
  r = await pub('POST', T.OLD, { action: 'submit' });
  check('old-no-submit', null, 'submit on an older document is 409', r._status === 409);
  seed();
  r = await admin('POST', 'concept-sets', { leadId: LEAD, title: 'New' });
  check('create-default', null, 'a new set is Pick one, Not this one off, with no submissions', r._status === 200 && r._json.item.approvalMode === 'pick' && r._json.item.allowPass === false && Array.isArray(r._json.item.submissions) && r._json.item.submittedAt === '');

  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}
