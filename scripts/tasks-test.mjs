#!/usr/bin/env node
/* The task system (the planner dashboard and task system): the one Next up rule in src/shared/taskRules.js and its
 * server mirror, ties, undated tasks, the pinned override, completing a task moving Next up, template due date math,
 * the checklist sanitizer on both routes, the next action a client's task becomes, and the retainer delivered count.
 *   node scripts/tasks-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);
const body = (p) => fs.readFileSync(path.join(repoRoot, p), 'utf8').split('const uid = ()')[1];

section('0. the mirror');
ok(body('src/shared/taskRules.js') === body('api/_lib/taskRules.js'), 'api/_lib/taskRules.js is src/shared/taskRules.js byte for byte below the header');

const T = await import(pathToFileURL(path.join(repoRoot, 'src', 'shared', 'taskRules.js')).href);
const A = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'taskRules.js')).href);
const NOW = Date.UTC(2026, 9, 5, 14, 0); // Mon Oct 5 2026, 10:00 New York
const DAY = 864e5;
const iso = (t) => new Date(t).toISOString();

section('1. the Next up rule');
{
  const rec = { checklists: [
    { id: 'a', name: 'Onboarding', items: [{ id: 'a1', text: 'Intro email', done: true, due: iso(NOW - 3 * DAY) }, { id: 'a2', text: 'Client form', done: false, due: iso(NOW + 2 * DAY) }, { id: 'a3', text: 'Contract', done: false, due: '' }] },
    { id: 'b', name: 'Brand', items: [{ id: 'b1', text: 'Build concepts', done: false, due: iso(NOW - DAY) }, { id: 'b2', text: 'Present', done: false, due: iso(NOW + DAY) }] },
  ] };
  for (const [name, M] of [['client', T], ['server', A]]) {
    ok(M.taskNextUp(rec, NOW)?.id === 'b1', `${name}: the overdue task wins over the sooner future one`);
    const noOverdue = { checklists: rec.checklists.map(l => ({ ...l, items: l.items.map(it => (it.id === 'b1' ? { ...it, done: true } : it)) })) };
    ok(M.taskNextUp(noOverdue, NOW)?.id === 'b2', `${name}: the earliest due open task wins (b2 before a2)`);
    const tie = { checklists: [{ id: 'x', name: 'X', items: [{ id: 'x1', text: 'one', done: false, due: iso(NOW + DAY) }, { id: 'x2', text: 'two', done: false, due: iso(NOW + DAY) }] }, { id: 'y', name: 'Y', items: [{ id: 'y1', text: 'three', done: false, due: iso(NOW + DAY) }] }] };
    ok(M.taskNextUp(tie, NOW)?.id === 'x1', `${name}: a tie breaks by checklist order then task order`);
    const tie2 = { checklists: [{ id: 'x', name: 'X', items: [{ id: 'x1', text: 'one', done: false, due: iso(NOW + DAY), order: 5 }, { id: 'x2', text: 'two', done: false, due: iso(NOW + DAY), order: 1 }] }] };
    ok(M.taskNextUp(tie2, NOW)?.id === 'x2', `${name}: within a list the task order field breaks the tie`);
    const undated = { checklists: [{ id: 'x', name: 'X', items: [{ id: 'u1', text: 'no date', done: false, due: '' }, { id: 'u2', text: 'later', done: false, due: '' }] }] };
    ok(M.taskNextUp(undated, NOW)?.id === 'u1', `${name}: with nothing dated the first undated task wins`);
    ok(M.taskNextUp(rec, NOW)?.id !== 'a3', `${name}: an undated task never wins while a dated one is open`);
    const pinned = { checklists: rec.checklists.map(l => ({ ...l, items: l.items.map(it => (it.id === 'a3' ? { ...it, pinned: true } : it)) })) };
    ok(M.taskNextUp(pinned, NOW)?.id === 'a3', `${name}: the pinned task wins over every date`);
    const pinnedDone = { checklists: rec.checklists.map(l => ({ ...l, items: l.items.map(it => (it.id === 'a3' ? { ...it, pinned: true, done: true } : it)) })) };
    ok(M.taskNextUp(pinnedDone, NOW)?.id === 'b1', `${name}: a done task never counts, pinned or not`);
    ok(M.taskNextUp({ checklists: [] }, NOW) === null && M.taskNextUp({}, NOW) === null, `${name}: no tasks, no Next up`);
    const after = M.setTaskDone(rec.checklists, 'b1', true, NOW);
    ok(after[1].items[0].done && !!after[1].items[0].doneAt && M.taskNextUp({ checklists: after }, NOW)?.id === 'b2', `${name}: completing a task moves Next up to the next one and stamps doneAt`);
    const pinThenDone = M.setTaskDone(M.setTaskPinned(rec.checklists, 'a2'), 'a2', true, NOW);
    ok(!pinThenDone[0].items[1].pinned && M.taskNextUp({ checklists: pinThenDone }, NOW)?.id === 'b1', `${name}: completing the pinned task clears the pin and Next up falls back to the rule`);
    const repinned = M.setTaskPinned(M.setTaskPinned(rec.checklists, 'a2'), 'b2');
    ok(!repinned[0].items[1].pinned && repinned[1].items[1].pinned, `${name}: pinning another task unpins the first`);
    ok(M.setTaskPinned(repinned, '').every(l => l.items.every(it => !it.pinned)), `${name}: Auto clears every pin`);
    const act = M.taskAsAction(M.taskNextUp(rec, NOW), true);
    ok(act.kind === 'custom' && act.label === 'Build concepts' && act.auto === true && act.taskId === 'b1' && act.remindAt === '' && act.dueAt === iso(NOW - DAY), `${name}: the task becomes a custom action carrying its id and no reminder of its own`);
    ok(M.taskCounts(rec).done === 1 && M.taskCounts(rec).total === 5 && M.taskCounts(rec).pct === 20, `${name}: the counts (1 of 5, 20 percent)`);
  }
}

section('2. normalize, add, remove, templates');
{
  const legacy = [{ name: 'Old', items: [{ text: 'first', done: true }, { text: 'second', done: false }] }];
  const n = T.normalizeChecklists(legacy);
  ok(n[0].id === 'list0' && n[0].items[0].id === 'list0item0' && n[0].items[1].id === 'list0item1' && n[0].items[1].order === 1 && n[0].items[0].done === true && n[0].items[0].text === 'first', 'a legacy list gains ids and order and keeps what it had');
  ok(JSON.stringify(T.normalizeChecklists(legacy)) === JSON.stringify(n), 'the ids a legacy list gets are the same on every read (a tick lands on the row that was ticked)');
  ok(T.normalizeChecklists(n)[0].items[0].id === n[0].items[0].id, 'a normalized list keeps its ids on the next pass');
  const added = T.addTask(n, n[0].id, { text: 'third', due: iso(NOW + DAY), source: 'suggestion', suggestionId: 's1' });
  ok(added[0].items.length === 3 && added[0].items[2].text === 'third' && added[0].items[2].source === 'suggestion' && added[0].items[2].order === 2, 'addTask appends to the list by id with its source');
  const addedNew = T.addTask(n, '', { text: 'loose', listName: 'Ideas' });
  ok(addedNew.length === 2 && addedNew[1].name === 'Ideas' && addedNew[1].items[0].text === 'loose', 'addTask with no list makes one');
  ok(T.removeTask(added, added[0].items[2].id)[0].items.length === 2, 'removeTask drops it');
  ok(T.patchTask(n, n[0].items[1].id, { note: 'hi', due: iso(NOW) })[0].items[1].note === 'hi', 'patchTask sets fields');
  const big = T.normalizeChecklists(Array.from({ length: 14 }, (_, i) => ({ name: `L${i}`, items: Array.from({ length: 60 }, (_, j) => ({ text: `t${j}` })) })));
  ok(big.length === 10 && big[0].items.length === 50, 'the caps hold: 10 lists of 50');
  const tpl = T.templateOf('brand');
  const list = T.applyTemplate(tpl, '2026-10-05');
  ok(list.templateId === 'brand' && list.items.length === 7 && list.items.every(it => it.source === 'template'), 'a template makes a list with its id and source on every task');
  ok(list.items[0].due === '2026-10-08' && list.items[6].due === '2026-10-28', `template due dates are the start plus each offset (got ${list.items[0].due}, ${list.items[6].due})`);
  const zoned = T.applyTemplate(tpl, '2026-10-30', (k) => `${k}T13:00:00.000Z`);
  ok(zoned.items[0].due === '2026-11-02T13:00:00.000Z', 'a dueAtFor callback turns each day key into an instant and crosses the month end');
  ok(T.applyTemplate(T.templateOf('onboarding'), '').items.every(it => it.due === ''), 'no start date, no due dates');
  ok(T.CHECKLIST_TEMPLATES.map(t => t.id).join(',') === 'onboarding,brand,website,content-month,delivery,ads-launch', 'the six templates are seeded');
}

section('3. the next action a client or a project carries');
{
  const client = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'nextAction.js')).href);
  const server = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'nextAction.js')).href);
  const lead = { _id: 'c1', business: 'C', stage: 'client', callStatus: 'booked', reviews: { asks: [] }, checklists: [{ id: 'l', name: 'L', items: [{ id: 't1', text: 'Send the proof', done: false, due: iso(NOW + DAY) }] }] };
  const released = [{ _id: 'p1', leadId: 'c1', releasedAt: iso(NOW - 10 * DAY) }];
  for (const [name, M] of [['client', client], ['server', server]]) {
    const got = M.nextActionFor(lead, { projects: released }, NOW);
    ok(got?.kind === 'custom' && got.taskId === 't1' && got.auto === true, `${name}: a client's open task is its Next up even when a pipeline rule would fire`);
    const noTasks = M.nextActionFor({ ...lead, checklists: [] }, { projects: released }, NOW);
    ok(noTasks?.kind === 'review-ask', `${name}: with no open task the pipeline rule speaks`);
    const asLead = M.nextActionFor({ ...lead, stage: 'lead', callStatus: 'callback', callbackAt: iso(NOW + DAY) }, {}, NOW);
    ok(asLead?.kind === 'callback', `${name}: a lead keeps the pipeline rules even with tasks`);
    const project = { _id: 'p2', leadId: 'c1', stage: 'design', invoices: [], checklists: [{ id: 'l', name: 'L', items: [{ id: 'pt', text: 'Design pages', done: false, due: iso(NOW + 2 * DAY) }] }] };
    ok(M.nextActionFor(project, {}, NOW)?.taskId === 'pt', `${name}: a project's open task is its Next up`);
    const pinned = { ...lead, nextAction: { kind: 'custom', label: 'Call about the sign', dueAt: iso(NOW + 5 * DAY), auto: false, doneAt: '', remindAt: '', notifiedAt: '', taskId: 't9' } };
    const resolved = M.resolveNextAction(pinned, M.nextActionFor(pinned, {}, NOW));
    ok(resolved.taskId === 't9' && resolved.auto === false, `${name}: a pinned (auto false) action still wins over the computed one`);
    ok(!M.sameAction({ kind: 'custom', label: 'x', dueAt: '', auto: true, doneAt: '', taskId: 'a' }, { kind: 'custom', label: 'x', dueAt: '', auto: true, doneAt: '', taskId: 'b' }), `${name}: two tasks with the same words are different actions`);
  }
}

section('4. the checklist sanitizer on both routes, and the retainer delivered count');
{
  const server = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'nextAction.js')).href);
  const clean = server.sanitizeNextAction({ kind: 'custom', label: 'x', taskId: 'abcdefgh', junk: 1 }, (v, max) => String(v ?? '').slice(0, max));
  ok(clean.taskId === 'abcdefgh' && !('junk' in clean), 'sanitizeNextAction keeps taskId and nothing unknown');
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'tasks-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-secret-not-real'; delete process.env.VERCEL;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const leadsH = (await load('_routes/call-leads.js')).handler;
  const projectsH = (await load('_routes/projects.js')).handler;
  const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader() {} });
  const call = async (fn, method, body) => { const res = fakeRes(); await fn({ method, query: {}, body, headers: {}, url: '/api/x', socket: {} }, res); return res; };
  const L = '507f1f77bcf86cd7994390e1', P = '507f1f77bcf86cd7994390e2';
  _reset();
  _stores.call_leads = [{ _id: L, business: 'Task Co', stage: 'client', callStatus: 'booked', socials: {}, callLog: [], checklists: [] }];
  _stores.projects = [{ _id: P, leadId: L, name: 'Sign', kind: 'print', stage: 'design', invoices: [] }];
  _stores.settings = []; _stores.lists = []; _stores.concept_sets = []; _stores.submissions = []; _stores.posts = [];
  const lists = [{ name: 'Onboarding', items: [{ text: 'Intro email', due: iso(NOW + DAY), note: 'x'.repeat(400), remindAt: iso(NOW), pinned: true, source: 'template', extra: 'dropped' }] }];
  let r = await call(leadsH, 'PATCH', { id: L, set: { checklists: lists } });
  const stored = _stores.call_leads[0].checklists;
  ok(r._status === 200 && stored[0].id && stored[0].items[0].id && stored[0].items[0].note.length === 300 && stored[0].items[0].pinned === true && stored[0].items[0].source === 'template' && !('extra' in stored[0].items[0]), 'call-leads stores the task shape, stamps ids, caps the note and drops unknown keys');
  r = await call(projectsH, 'PATCH', { id: P, set: { checklists: lists } });
  const storedP = _stores.projects[0].checklists;
  ok(r._status === 200 && storedP && storedP[0].items[0].text === 'Intro email' && storedP[0].items[0].id, 'projects stores checklists the same way');
  r = await call(leadsH, 'PATCH', { id: L, set: { checklists: [{ name: 'X', items: [{ text: 'a', source: 'bogus', due: { $gt: '' } }] }] } });
  ok(_stores.call_leads[0].checklists[0].items[0].source === 'manual' && typeof _stores.call_leads[0].checklists[0].items[0].due === 'string', 'an unknown source reads as manual and a non string due is a string');
  fs.rmSync(tmp, { recursive: true, force: true });

  const Po = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'posts.js')).href);
  const posts = [
    { _id: 1, leadId: 'c', month: '2026-10', kind: 'post', status: 'approved' }, { _id: 2, leadId: 'c', month: '2026-10', status: 'posted' }, { _id: 3, leadId: 'c', month: '2026-10', kind: 'ad', status: 'live' },
    { _id: 4, leadId: 'c', month: '2026-10', kind: 'ad', status: 'finished' }, { _id: 5, leadId: 'c', month: '2026-10', kind: 'ad', status: 'review' }, { _id: 6, leadId: 'c', month: '2026-09', status: 'posted' }, { _id: 7, leadId: 'd', month: '2026-10', status: 'posted' },
  ];
  const ck = Po.deliveredFor(posts, 'c', '2026-10', 'content-kit'); const ad = Po.deliveredFor(posts, 'c', '2026-10', 'ad-creatives'); const gr = Po.deliveredFor(posts, 'c', '2026-10', 'growth');
  ok(ck.counted === 2 && ck.posts === 2 && ck.ads === 2, `Content Kit counts the posts (got ${ck.counted})`);
  ok(ad.counted === 2, `Ad Creatives counts the ads, live and finished, not one in review (got ${ad.counted})`);
  ok(gr.counted === 4, `Growth counts both (got ${gr.counted})`);
  ok(Po.kindOf({}) === 'post' && Po.isAd({ kind: 'ad' }) && Po.formatOf({ format: 'video' }) === 'video' && Po.formatOf({}) === 'portrait', 'kindOf and formatOf read old rows as a portrait post');
  ok(Po.missingForReview({ format: 'video', kind: 'ad' }).join(',') === 'a concept or the video,an ad name' && Po.missingForReview({ format: 'video', concept: 'A quick tour' }).length === 0, 'a planned video with a concept is ready; an ad needs a name');
}

console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
