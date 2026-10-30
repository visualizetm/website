#!/usr/bin/env node
/* Push preferences (finish notifications, milestone 4): Settings > Notifications decides what is pushed.
 *   1. src/shared/pushCategories.js and its server mirror are the same code
 *   2. the pure rules: a missing value is on (nothing that pushes today goes silent), quiet hours cross midnight, the Test button and the
 *      stale job alarm always send, due reminders and meetings pass quiet hours unless Rob silences them too
 *   3. sendPush (against a stub of web-push): a category switched off or a quiet hour never reaches a device and answers skipped
 *   4. the minute cron: a silenced reminder, meeting or digest is stamped decided, never pushed, never tried again
 *   5. the settings route: older documents read as everything on, quiet hours off; saves are validated
 *   6. every sendPush call in api/ names a category
 *   node scripts/push-prefs-test.mjs */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
if (process.env.TZ !== 'America/New_York') {
  const r = spawnSync(process.execPath, [process.argv[1]], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' });
  process.stdout.write(r.stdout || ''); process.stderr.write(r.stderr || '');
  process.exit(r.status ?? 1);
}
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) { passes++; console.log(`  ok   ${m}`); } else { fails++; console.log(`  FAIL ${m}`); } };
const section = (t) => console.log(`\n${t}`);
const MIN = 60e3;

const Z = await import(pathToFileURL(path.join(repoRoot, 'api', '_lib', 'zone.js')).href);
const C = await import(pathToFileURL(path.join(repoRoot, 'src', 'shared', 'pushCategories.js')).href);

section('1. the mirror');
{
  const body = (f) => { const t = fs.readFileSync(path.join(repoRoot, f), 'utf8'); return t.slice(t.indexOf('export const PUSH_CATEGORIES')); };
  ok(body('src/shared/pushCategories.js') === body('api/_lib/pushCategories.js'), 'src/shared/pushCategories.js and api/_lib/pushCategories.js are identical below their headers');
  ok(C.PUSH_CATEGORY_IDS.join() === 'reminders,meetings,payments,leads,client,email,digest', `the seven categories, in order (${C.PUSH_CATEGORY_IDS.join()})`);
}

section('2. the rules');
{
  ok(Object.values(C.categoriesShape(undefined)).every(v => v === true) && Object.values(C.categoriesShape({})).every(v => v === true) && Object.values(C.categoriesShape('junk')).every(v => v === true), 'a missing, empty or junk value is every category on');
  const one = C.categoriesShape({ payments: false, leads: 0, client: null });
  ok(one.payments === false && one.leads === true && one.client === true && one.reminders === true, 'only an explicit false switches a category off');
  ok(JSON.stringify(C.quietShape(undefined)) === JSON.stringify({ on: false, from: '22:00', to: '07:00', reminders: false }), 'quiet hours are off by default, 22:00 to 07:00, reminders and meetings allowed');
  ok(C.quietShape({ on: 'yes', from: '25:00', to: '7pm', reminders: 1 }).on === false && C.quietShape({ from: '25:00', to: '7pm' }).from === '22:00' && C.quietShape({ from: '25:00', to: '7pm' }).to === '07:00', 'quiet hours: only true turns it on, a bad time falls back');
  const q = { on: true, from: '22:00', to: '07:00' };
  ok(C.inQuiet(q, 22, 0) && C.inQuiet(q, 23, 59) && C.inQuiet(q, 0, 0) && C.inQuiet(q, 6, 59), 'a window across midnight: 22:00, 23:59, 00:00 and 06:59 are inside');
  ok(!C.inQuiet(q, 7, 0) && !C.inQuiet(q, 12, 0) && !C.inQuiet(q, 21, 59), 'and 07:00, noon and 21:59 are outside');
  ok(C.inQuiet({ on: true, from: '13:00', to: '15:00' }, 14, 0) && !C.inQuiet({ on: true, from: '13:00', to: '15:00' }, 15, 0), 'a window inside one day');
  ok(!C.inQuiet({ on: true, from: '08:00', to: '08:00' }, 8, 0) && !C.inQuiet({ on: false, from: '00:00', to: '23:59' }, 12, 0), 'from equal to is empty, and off is off');
  const prefs = { categories: { payments: false }, quiet: { on: true, from: '22:00', to: '07:00' } };
  ok(C.pushVerdict(prefs, 'payments', 12, 0) === 'off' && C.pushVerdict(prefs, 'leads', 12, 0) === '' && C.pushVerdict(prefs, 'digest', 12, 0) === '', 'a category off is off, the others send');
  ok(C.pushVerdict(prefs, 'leads', 23, 0) === 'quiet' && C.pushVerdict(prefs, 'digest', 23, 0) === 'quiet' && C.pushVerdict(prefs, 'payments', 23, 0) === 'off', 'quiet hours hold back leads and the digest, and off still says off');
  ok(C.pushVerdict(prefs, 'reminders', 23, 0) === '' && C.pushVerdict(prefs, 'meetings', 23, 0) === '', 'due reminders and meetings pass quiet hours');
  ok(C.pushVerdict({ quiet: { on: true, from: '22:00', to: '07:00', reminders: true } }, 'reminders', 23, 0) === 'quiet' && C.pushVerdict({ quiet: { on: true, from: '22:00', to: '07:00', reminders: true } }, 'meetings', 2, 0) === 'quiet', 'unless Rob silences them too');
  ok(C.pushVerdict({ categories: { reminders: false, meetings: false }, quiet: { on: true, from: '00:00', to: '23:59', reminders: true } }, 'test', 12, 0) === '' && C.pushVerdict({ quiet: { on: true, from: '00:00', to: '23:59', reminders: true } }, 'system', 12, 0) === '', 'the Test button and the stale job alarm always send');
  ok(C.pushVerdict(undefined, 'payments', 3, 0) === '' && C.pushVerdict({}, 'client', 23, 0) === '', 'a document with no preferences changes nothing (the migration)');
}

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const tmp = fs.mkdtempSync(path.join(tmpBase, 'prefs-'));
const apiDst = path.join(tmp, 'api');
fs.cpSync(path.join(repoRoot, 'api'), apiDst, { recursive: true });
fs.writeFileSync(path.join(apiDst, '_lib', 'mongo.js'), fs.readFileSync(path.join(repoRoot, 'scripts', 'fake-mongo.js'), 'utf8'));
const stubDir = path.join(tmp, 'node_modules', 'web-push'); fs.mkdirSync(stubDir, { recursive: true });
fs.writeFileSync(path.join(stubDir, 'package.json'), JSON.stringify({ name: 'web-push', type: 'module', main: 'index.js', version: '0.0.0-test' }));
fs.writeFileSync(path.join(stubDir, 'index.js'), "export const calls = []; export default { setVapidDetails() {}, async sendNotification(sub, payload, opts) { calls.push({ payload, opts }); return { statusCode: 201 }; } };\n");
process.env.VAPID_PUBLIC_KEY = 'test-public'; process.env.VAPID_PRIVATE_KEY = 'test-private';
const load = async (rel) => import(pathToFileURL(path.join(apiDst, rel)).href);
const { _stores, _reset, getDb } = await load('_lib/mongo.js');
const stub = await import(pathToFileURL(path.join(stubDir, 'index.js')).href);
const N = await load('_lib/notify.js');
const db = await getDb();
const AT = (h, m = 0) => Z.zoneDateAt('2026-10-02', h, m);
const setPrefs = (p) => { _stores.settings = [{ _id: 'notifications', ...p }]; };
const msg = (category) => ({ title: 'T', body: 'B', url: '/', ...(category ? { category } : {}) });

section('3. sendPush');
{
  _reset(); stub.calls.length = 0;
  _stores.push_subscriptions = [{ _id: 'o1', subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } }, updatedAt: new Date() }];
  setPrefs({ categories: { payments: false } });
  let r = await N.sendPush(db, msg('payments'));
  ok(r.skipped === 'off' && r.delivered === 0 && r.attempted === 0 && stub.calls.length === 0, `a category switched off: skipped off, nothing sent (${JSON.stringify(r)})`);
  r = await N.sendPush(db, msg('leads'));
  ok(r.delivered === 1 && !r.skipped && stub.calls.length === 1, 'another category still sends');
  r = await N.sendPush(db, msg());
  ok(r.delivered === 1 && stub.calls.length === 2, 'a message with no category sends (the static scan below keeps every call site naming one)');
  setPrefs({ quiet: { on: true, from: '22:00', to: '07:00' } });
  r = await N.sendPush(db, msg('leads'), { now: AT(23, 30) });
  ok(r.skipped === 'quiet' && stub.calls.length === 2, 'quiet hours (11:30 PM New York): a new lead is held back');
  r = await N.sendPush(db, msg('reminders'), { now: AT(23, 30) });
  ok(r.delivered === 1 && stub.calls.length === 3, 'a due reminder passes quiet hours');
  r = await N.sendPush(db, msg('leads'), { now: AT(12, 0) });
  ok(r.delivered === 1 && stub.calls.length === 4, 'at noon the same push goes');
  setPrefs({ categories: { test: false, system: false, reminders: false } });
  r = await N.sendPush(db, msg('test'));
  ok(r.delivered === 1, 'the Test button always sends');
  _stores.settings = [];
  r = await N.sendPush(db, msg('digest'));
  ok(r.delivered === 1, 'no notifications document at all: everything sends');
}

/* 4. the minute cron, with the push door stubbed (it still asks pushPrefs, as the real door does; section 3 proves the real one): a second copy of api/ (a module is cached by its path) */
const apiB = path.join(tmp, 'apiB');
fs.cpSync(apiDst, apiB, { recursive: true });
fs.writeFileSync(path.join(apiB, '_lib', 'notify.js'), "import { pushSkipReason } from './pushPrefs.js';\nexport const _pushes = [];\nexport const _state = { result: { attempted: 1, delivered: 1, removed: 0, errors: [] } };\nexport async function sendPush(db, p, opts = {}) { const skipped = await pushSkipReason(db, p.category, opts.now); if (skipped) return { attempted: 0, delivered: 0, removed: 0, errors: [], skipped }; _pushes.push(p); return _state.result; }\nexport async function sendClientPush() { return { attempted: 0, delivered: 0, removed: 0, errors: ['no-devices'] }; }\n");
const loadB = async (rel) => import(pathToFileURL(path.join(apiB, rel)).href);
const B = await loadB('_lib/mongo.js');
const { _pushes } = await loadB('_lib/notify.js');
const { runReminders } = await loadB('_routes/cron-reminders.js');
const dbB = await B.getDb();
const iso = (t) => new Date(t).toISOString();
const T = AT(17, 0);
const seedCron = (prefs = {}, digestDone = true) => {
  B._reset(); _pushes.length = 0;
  B._stores.settings = [{ _id: 'notifications', reminders: { meetings: true, callbacks: true, bills: true, reviews: true, tasks: true }, sentReminderKeys: digestDone ? ['digest:2026-10-02'] : [], ...prefs }];
  B._stores.call_leads = [
    { _id: '507f1f77bcf86cd7994390e1', business: 'Callback Co', stage: 'lead', callStatus: 'callback', callbackAt: iso(T), socials: {} },
    { _id: '507f1f77bcf86cd7994390e2', business: 'Meeting Co', stage: 'booked', callStatus: 'booked', meeting: { date: '2026-10-02', time: '17:00' }, socials: {} },
  ];
  B._stores.projects = []; B._stores.push_subscriptions = [];
};
const titles = () => _pushes.map(p => p.title);
const gate = () => B._stores.settings.find(s => s._id === 'notifications');

section('4. the minute cron');
{
  seedCron();
  await runReminders(dbB, T);
  ok(titles().length === 2 && _pushes.every(p => ['reminders', 'meetings'].includes(p.category)) && _pushes.find(p => /Call back/.test(p.title)).category === 'reminders' && _pushes.find(p => /Meeting now/.test(p.title)).category === 'meetings', `both go, each named for its category (${_pushes.map(p => p.category).join()})`);

  seedCron({ categories: { reminders: false } });
  await runReminders(dbB, T);
  ok(titles().join('|') === 'Meeting now: Meeting Co, 5:00 PM', `Reminders off: the callback is not pushed, the meeting is (${titles().join('|')})`);
  ok(gate().sentReminderKeys.some(k => k.startsWith('cb:')) && (gate().reminderOutcomes || []).some(o => o.kind === 'callback' && o.status === 'skipped' && o.reason === 'off'), 'the silenced callback is stamped decided, the outcome says skipped, off');
  await runReminders(dbB, T + MIN);
  ok(titles().length === 1, 'and it is not tried again');
  B._stores.settings[0].categories = { reminders: true };
  await runReminders(dbB, T + 2 * MIN);
  ok(titles().length === 1, 'switching the category back on does not bring a decided reminder back');

  seedCron({ categories: { meetings: false } });
  await runReminders(dbB, AT(16, 45)); await runReminders(dbB, T);
  ok(titles().join('|') === 'Call back: Callback Co, 5:00 PM', `Meetings off: no heads-up and no start, the callback goes (${titles().join('|')})`);

  seedCron({ quiet: { on: true, from: '16:00', to: '18:00' } });
  await runReminders(dbB, T);
  ok(titles().length === 2, 'quiet hours pass due reminders and meetings by default');
  seedCron({ quiet: { on: true, from: '16:00', to: '18:00', reminders: true } });
  await runReminders(dbB, T);
  ok(titles().length === 0 && (gate().reminderOutcomes || []).filter(o => o.status === 'skipped' && o.reason === 'quiet').length === 2, 'quiet hours with reminders silenced: nothing pushes and both are recorded as skipped, quiet');

  seedCron({ categories: { digest: false } }, false);
  await runReminders(dbB, AT(8, 31));
  ok(titles().length === 0 && gate().sentReminderKeys.includes('digest:2026-10-02') && (gate().reminderOutcomes || []).some(o => o.kind === 'digest' && o.status === 'skipped' && o.reason === 'off'), 'the digest switched off: nothing pushes and today is decided');
  seedCron({}, false);
  await runReminders(dbB, AT(8, 31));
  ok(_pushes.some(p => p.category === 'digest' && /^Today:/.test(p.title)), 'the digest, on, is named digest');

  seedCron({ categories: { reminders: false } });
  B._stores.call_leads = Array.from({ length: 12 }, (_, i) => ({ _id: `507f1f77bcf86cd79943a${String(i).padStart(3, '0')}`, business: `Mix${i} Co`, ...(i < 6 ? { stage: 'lead', callStatus: 'callback', callbackAt: iso(T) } : { stage: 'booked', callStatus: 'booked', meeting: { date: '2026-10-02', time: '17:00' } }), socials: {} }));
  await runReminders(dbB, T);
  ok(_pushes.length === 6 && _pushes.every(p => p.category === 'meetings') && !_pushes.some(p => /Call back/.test(p.title)), `twelve things due, Reminders off: the six meetings go on their own (${_pushes.length}), the six callbacks are decided`);
}

section('5. the settings route');
{
  const settings = await load('_routes/settings.js');
  const fakeRes = () => ({ _status: 200, _json: null, status(c) { this._status = c; return this; }, json(p) { this._json = p; return this; }, setHeader() {} });
  _reset();
  _stores.settings = [{ _id: 'notifications', reminders: { meetings: true }, readIds: [] }, { _id: 'prefs', pushEnabled: false, emailEnabled: true }];
  let res = fakeRes();
  await settings.handler({ method: 'GET', query: {}, headers: {}, body: {} }, res);
  const n = res._json?.notifications;
  ok(n && Object.values(n.categories).every(v => v === true) && n.quiet.on === false && n.quiet.from === '22:00', 'an older document reads as every category on and quiet hours off');
  ok(res._json?.prefs?.pushEnabled === false, 'and the old Push notifications switch (new submissions) keeps its own value, untouched');
  res = fakeRes();
  await settings.handler({ method: 'PATCH', query: {}, headers: {}, body: { set: { notifications: { categories: { payments: false, bogus: false, leads: 'no' }, quiet: { on: true, from: '21:30', to: 'later', reminders: true } } } } }, res);
  const saved = _stores.settings.find(s => s._id === 'notifications');
  ok(res._status === 200 && saved.categories.payments === false && saved.categories.leads === true && !('bogus' in saved.categories), 'a save keeps only the seven categories, and only an explicit false is off');
  ok(saved.quiet.on === true && saved.quiet.from === '21:30' && saved.quiet.to === '07:00' && saved.quiet.reminders === true, 'quiet hours are validated: a bad time falls back');
  ok(saved.reminders?.meetings === true, 'saving categories leaves the reminder switches alone');
}

section('6. every push names a category');
{
  const files = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(path.join(repoRoot, 'api'));
  const calls = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const re of [/\bsendPush\(/g, /\bawait send\(db, /g, /\bawait push\(/g]) {
      let m; while ((m = re.exec(text))) {
        const before = text.slice(Math.max(0, m.index - 22), m.index);
        if (/function\s*$/.test(before) || /export async function\s*$/.test(before)) continue; // the definition
        let depth = 0; let i = m.index + m[0].length - (m[0].endsWith('(') ? 1 : 0); let j = i;
        if (!m[0].endsWith('(')) { depth = 0; j = m.index + m[0].length; let d2 = 1; for (; j < text.length && d2 > 0; j++) { if (text[j] === '(') d2++; else if (text[j] === ')') d2--; } }
        else { for (j = i; j < text.length; j++) { if (text[j] === '(') depth++; else if (text[j] === ')') { depth--; if (!depth) { j++; break; } } } }
        calls.push({ file: path.relative(repoRoot, f), line: text.slice(0, m.index).split('\n').length, body: text.slice(m.index, j), spread: /\.\.\.(message|msg)\b/.test(text.slice(m.index, j)), helper: /\bsend\(db, message\(/.test(text.slice(m.index, j)) ? text.slice(text.indexOf('const message = ('), text.indexOf('const message = (') + 700) : '' });
      }
    }
  }
  const direct = calls.filter(c => !c.spread);
  ok(direct.length >= 20, `${direct.length} push calls found in api/`);
  for (const c of direct) ok(/category\s*[:,]/.test(c.body) || (c.helper && /category\s*:/.test(c.helper)), `${c.file}:${c.line} names a category${c.helper ? ' (through its message helper)' : ''}`);
  ok(calls.filter(c => c.spread).length === 2, 'the two wrappers that spread a caller\'s message (the cron\'s push and the sweeps\' send) are the only calls without one; their callers are in the list above');
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
