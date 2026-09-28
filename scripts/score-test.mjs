#!/usr/bin/env node
/* The lead score (CRM revamp, step 4): every rule, the cap, the client and
 * server mirrors byte for byte, the patch helper, the cron and the backfill.
 *   node scripts/score-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
process.env.TZ = 'America/New_York';
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const section = (t) => console.log(`\n${t}`);

section('0. the mirror');
{
  const a = fs.readFileSync(path.join(repoRoot, 'src/lib/score.js'), 'utf8').split('\n').filter(l => !l.startsWith(' *') && !l.startsWith('/*')).join('\n');
  const b = fs.readFileSync(path.join(repoRoot, 'api/_lib/score.js'), 'utf8').split('\n').filter(l => !l.startsWith(' *') && !l.startsWith('/*')).join('\n');
  ok(a === b, 'api/_lib/score.js is src/lib/score.js byte for byte (outside the header comment)');
}
const S = await import(pathToFileURL(path.join(repoRoot, 'src/lib/score.js')).href);
const { scoreFor, scoreRulesMet, withScore, topClientIndustries, briefedLeadIds, websiteDead } = S;

section('1. every rule');
const bare = { _id: 'a', business: 'Bare' };
ok(scoreFor(bare) === 25, `a bare record scores 25 for having no website (${scoreFor(bare)})`);
ok(scoreFor({ ...bare, socials: { website: 'https://x.com' } }) === 0, 'a website and nothing else is 0');
ok(scoreFor({ ...bare, socials: { website: 'https://x.com' }, phone: '302-555-0100' }) === 25, 'a phone is 25');
ok(scoreFor({ ...bare, socials: { website: 'https://x.com' }, phone: '555' }) === 0, 'a phone under seven digits does not count');
ok(scoreFor({ ...bare, socials: { website: 'https://x.com', instagram: 'https://instagram.com/x' } }) === 15, 'an instagram is 15');
ok(scoreFor({ ...bare, socials: { website: 'https://x.com' }, intel: { gaps: ['Website is dead'] } }) === 40, 'a website flagged dead in the gaps is 25, plus 15 for the gap itself');
ok(websiteDead({ intel: { gaps: ['The site returns a 404'] } }) && websiteDead({ intel: { gaps: ['Domain expired'] } }) && !websiteDead({ intel: { gaps: ['No menu online'] } }), 'dead, 404 and expired read as a dead site; a missing menu does not');
ok(scoreFor({ ...bare, socials: { website: 'https://x.com' }, intel: { gaps: ['No hours listed'] } }) === 15, 'any gap is 15');
ok(scoreFor({ ...bare, socials: { website: 'https://x.com' }, intel: { gaps: [{ text: 'No hours listed' }] } }) === 15, 'a gap as an object with text counts too');
ok(scoreFor({ ...bare, socials: { website: 'https://x.com' }, industry: 'Bakery' }, { topIndustries: new Set(['bakery']) }) === 10, 'a top industry is 10');
ok(scoreFor({ ...bare, socials: { website: 'https://x.com' }, industry: 'Bakery' }, { topIndustries: new Set(['salon']) }) === 0, 'another industry is 0');
ok(scoreFor({ ...bare, socials: { website: 'https://x.com' } }, { briefed: new Set(['a']) }) === 10, 'a linked start or contact submission is 10');
const full = { _id: 'a', phone: '302-555-0100', socials: { instagram: 'https://instagram.com/x' }, intel: { gaps: ['No hours'] }, industry: 'Bakery' };
ok(scoreFor(full, { topIndustries: new Set(['bakery']), briefed: new Set(['a']) }) === 100, 'everything is 100');
ok(scoreRulesMet(full, { topIndustries: new Set(['bakery']), briefed: new Set(['a']) }).join(',') === 'phone,instagram,no-site,gaps,industry,brief', 'the rules met come back in rule order');
ok(scoreFor(null) === 0 && scoreFor('x') === 0, 'nothing scores 0');

section('2. the cap and the helpers');
ok(S.SCORE_RULES.reduce((n, r) => n + r.points, 0) === 100, 'the rules sum to 100');
{
  const leads = [
    { _id: '1', stage: 'client', industry: 'Bakery' }, { _id: '2', stage: 'client', industry: 'bakery ' }, { _id: '3', stage: 'won', industry: 'Salon' },
    { _id: '4', stage: 'client', industry: 'Gym' }, { _id: '5', stage: 'client', industry: 'Cafe' }, { _id: '6', stage: 'client', industry: 'Bar' }, { _id: '7', stage: 'client', industry: 'Florist' },
    { _id: '8', stage: 'client', industry: 'Florist' }, { _id: '9', stage: 'lead', industry: 'Tattoo' }, { _id: '10', stage: 'client', industry: 'Tattoo', deleted: true },
  ];
  const top = topClientIndustries(leads);
  ok(top.size === 5 && top.has('bakery') && top.has('florist') && !top.has('tattoo'), `the top five client industries, case and space folded, leads and deleted records ignored (${[...top].join(', ')})`);
  ok([...top][0] === 'bakery' && [...top][1] === 'florist', 'ordered by count, then by name');
  const briefed = briefedLeadIds([{ type: 'start', linkedLeadId: 'a' }, { type: 'contact', linkedLeadId: 'b' }, { type: 'review', linkedLeadId: 'c' }, { type: 'start', linkedLeadId: 'd', deleted: true }, { type: 'start' }]);
  ok(briefed.size === 2 && briefed.has('a') && briefed.has('b'), 'only live start and contact submissions with a lead count as briefs');
}
{
  const rec = { _id: 'a', phone: '', socials: { website: 'https://x.com' }, score: 0 };
  ok(withScore(rec, { phone: '302-555-0100' }).score === 25, 'a phone write carries the new score');
  ok(!('score' in withScore(rec, { notes: 'hi' })), 'a write that touches nothing scored carries none');
  ok(!('score' in withScore(rec, { socials: { website: 'https://x.com' } })), 'an unchanged score is not rewritten');
  ok(withScore(rec, { phone: '302-555-0100', score: 3 }).score === 3, 'a caller that sets the score is left alone');
  ok(withScore({ ...rec, score: undefined }, { intel: { gaps: ['x'] } }).score === 15, 'a record with no score gets one on its first scored write');
}

section('3. the cron and the backfill against the real handlers');
{
  const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(tmpBase, 'score-')); const apiDst = path.join(tmp, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
  fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
  process.env.SESSION_SECRET = 'test-secret-not-real'; process.env.CRON_SECRET = 'cron-test-secret'; delete process.env.VERCEL;
  const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
  const { _stores, _reset } = await load('_lib/mongo.js');
  const cronDaily = (await load('_routes/cron-daily.js')).handler;
  const fakeRes = () => ({ _status: 200, _json: null, _headers: {}, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader(k, v) { this._headers[k] = v; } });
  _reset();
  _stores.call_leads = [
    { _id: '507f1f77bcf86cd799439051', business: 'Bakery One', stage: 'client', industry: 'Bakery', socials: { website: 'https://x.com' }, score: 0 },
    { _id: '507f1f77bcf86cd799439052', business: 'Bakery Two', stage: 'client', industry: 'Bakery', socials: { website: 'https://x.com' }, score: 0 },
    { _id: '507f1f77bcf86cd799439053', business: 'New Bakery', stage: 'triage', industry: 'Bakery', phone: '302-555-0100', socials: {}, intel: { gaps: ['No menu'] }, callStatus: 'not-called', callLog: [] },
    { _id: '507f1f77bcf86cd799439054', business: 'Briefed', stage: 'triage', socials: { website: 'https://x.com' }, score: 5, callStatus: 'not-called', callLog: [] },
    { _id: '507f1f77bcf86cd799439055', business: 'Gone', stage: 'triage', deleted: true, socials: {} },
  ];
  _stores.submissions = [{ _id: 's1', type: 'start', linkedLeadId: '507f1f77bcf86cd799439054' }];
  _stores.projects = []; _stores.settings = []; _stores.stripe_events = []; _stores.concept_sets = []; _stores.lists = [];
  const res = fakeRes();
  await cronDaily({ method: 'GET', query: {}, headers: { authorization: 'Bearer cron-test-secret' }, url: '/api/x', socket: {} }, res);
  const L = (id) => _stores.call_leads.find(l => l._id === id);
  ok(res._status === 200 && res._json.scored === 4, `the cron scores every live lead whose score changed (${res._status}, ${res._json?.scored})`);
  ok(L('507f1f77bcf86cd799439053').score === 75, `phone 25 + no site 25 + gaps 15 + top industry 10 = 75 (${L('507f1f77bcf86cd799439053').score})`);
  ok(L('507f1f77bcf86cd799439054').score === 10, `a briefed lead with a website scores 10 (${L('507f1f77bcf86cd799439054').score})`);
  ok(L('507f1f77bcf86cd799439051').score === 10 && L('507f1f77bcf86cd799439052').score === 10, 'a client in a top industry with a website scores 10 (its own industry counts)');
  const again = fakeRes(); await cronDaily({ method: 'GET', query: {}, headers: { authorization: 'Bearer cron-test-secret' }, url: '/api/x', socket: {} }, again);
  ok(again._json.scored === 0, `a second run rewrites nothing (${again._json?.scored})`);
  ok(L('507f1f77bcf86cd799439055').score === undefined, 'a deleted record is not scored');
  fs.rmSync(tmp, { recursive: true, force: true });
}
{
  const { plan } = await import(pathToFileURL(path.join(repoRoot, 'scripts/backfill-triage.mjs')).href);
  const leads = [
    { _id: '1', business: 'Untouched lead', stage: 'lead', callStatus: 'not-called', callLog: [], socials: {} },
    { _id: '2', business: 'No stage at all', callStatus: 'not-called', socials: {} },
    { _id: '3', business: 'Dialed', stage: 'lead', callStatus: 'no-answer', callLog: [{ outcome: 'no-answer' }], socials: {} },
    { _id: '4', business: 'Logged but reset', stage: 'lead', callStatus: 'not-called', callLog: [{ outcome: 'no-answer' }], socials: {} },
    { _id: '5', business: 'Client', stage: 'client', callStatus: 'not-called', callLog: [], socials: {}, industry: 'Bakery', score: 35 },
    { _id: '6', business: 'Parked', stage: 'nurture', callStatus: 'not-called', callLog: [], socials: {} },
    { _id: '7', business: 'Deleted', stage: 'lead', callStatus: 'not-called', callLog: [], deleted: true, socials: {} },
    { _id: '8', business: 'Already scored', stage: 'lead', callStatus: 'no-answer', callLog: [{ outcome: 'no-answer' }], socials: {}, score: 25 },
  ];
  const p = plan(leads, []);
  ok(p.moves.map(m => m.id).join(',') === '1,2', `only untouched lead records (or with no stage) move (${p.moves.map(m => m.id).join(',')})`);
  ok(p.moves[1].from === '(none)', 'a record with no stage is reported as such');
  ok(p.scores.some(s => s.id === '5' && s.score === 35) === false && p.scores.some(s => s.id === '5' && s.score === 35 + 0) === false, 'a client whose score already matches is not rewritten');
  ok(!p.scores.some(s => s.id === '8') && !p.scores.some(s => s.id === '7'), 'a matching score and a deleted record are skipped');
  ok(p.scores.find(s => s.id === '1')?.score === 25, 'the untouched lead gets its first score');
  ok(p.topIndustries.join(',') === 'bakery', 'the top industries come from the client records');
}

console.log(`\n${passes} checks passed, ${fails} failed.`);
console.log(fails ? 'Score tests FAILED.' : 'All score tests pass.');
process.exit(fails ? 1 : 0);
