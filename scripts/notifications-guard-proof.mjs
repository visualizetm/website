#!/usr/bin/env node
/* The guards of the finish notifications job, each cut out of a copy of the repository in turn: with the cut in place the test that
 * carries that guard must fail. A guard whose test still passes without it is reported as not proven and the run exits 1. The
 * repository itself is never touched (the copy shares node_modules by a link).
 *   node scripts/notifications-guard-proof.mjs            all of them
 *   GUARD_ONLY=callback-needs-callstatus node scripts/notifications-guard-proof.mjs
 * The route guard ([job].js back under api/cron) is scripts/routing-guard-proof.mjs. */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });

const NA = 'api/_lib/nextAction.js';
const NA_SRC = 'src/lib/nextAction.js';
const CRON = 'api/_routes/cron-reminders.js';
const COV = 'api/_lib/coveragePush.js';

const GUARDS = [
  { name: 'callback-needs-callstatus', what: 'a callback counts only when callStatus says callback (the record picker writes callbackAt alone)', test: 'coverage-push-test.mjs',
    edits: [[NA, "  if (lead.callStatus === 'callback') return at;\n", "  if (lead.callStatus !== 'callback') return 0;\n"], [NA_SRC, "  if (lead.callStatus === 'callback') return at;\n", "  if (lead.callStatus !== 'callback') return 0;\n"]] },
  { name: 'backlog-guard', what: 'a reminder is pushed however late it is (the first live run after a dead cron floods)', test: 'minute-reminders-test.mjs',
    edits: [[CRON, 'const PUSH_WINDOW_MS = 10 * 60e3;', 'const PUSH_WINDOW_MS = 1e15;']] },
  { name: 'stamp-on-zero-delivered', what: 'a reminder no device took is stamped as sent', test: 'minute-reminders-test.mjs',
    edits: [[CRON, 'const took = !!res && Number(res.delivered) > 0;', 'const took = true;']] },
  { name: 'meeting-heads-up', what: 'no push 15 minutes before a meeting', test: 'coverage-push-test.mjs',
    edits: [[CRON, 'if (headsUpAt <= nowMs && !sent.has(hkey)) {', 'if (false) {']] },
  { name: 'meeting-raw-stage', what: 'a meeting is read from the raw stage field again (misses a deal, a record with no stage, the afterCall text)', test: 'coverage-push-test.mjs',
    edits: [[CRON, "  if (!l || !MEETING_STAGES.includes(normalizeStage(l))) return null;", "  if (!l || !['booked', 'won', 'client'].includes(l.stage)) return null;"]] },
  { name: 'payment-every-event', what: 'every Stripe event of one payment pushes', test: 'coverage-push-test.mjs',
    edits: [[COV, "    if (same) return { pushed: false, why: 'same-payment' };\n", '']] },
  { name: 'overdue-every-run', what: 'an overdue invoice pushes on every run, not once a day', test: 'coverage-push-test.mjs',
    edits: [[COV, " && nudges[l.id]?.day !== today);", ");"], [COV, "  if (gate.overdueDay === today) return out;\n", '']] },
  { name: 'overdue-no-cap', what: 'an overdue invoice is pushed forever, not three times', test: 'coverage-push-test.mjs',
    edits: [[COV, "export const OVERDUE_MAX_NUDGES = 3;", "export const OVERDUE_MAX_NUDGES = 1e9;"]] },
  { name: 'lead-sweep-hand-added', what: 'a lead Rob added by hand is told like a scraped one', test: 'coverage-push-test.mjs',
    edits: [[COV, "sourceId: { $exists: true, $ne: '' }, createdAt: { $gt: new Date(since) } }", "createdAt: { $gt: new Date(since) } }"]] },
  { name: 'lead-sweep-first-look', what: 'the first look tells Rob about every lead already in the CRM', test: 'coverage-push-test.mjs',
    edits: [[COV, "if (!gate.leadSweepMark) { out.patch = { leadSweepAt: stamp, leadSweepMark: nowMs }; return out; }", "if (!gate.leadSweepMark) gate = { ...gate, leadSweepMark: 1 };"]] },
  { name: 'calendly-first-poll', what: 'the first Calendly poll pushes every existing booking', test: 'coverage-push-test.mjs',
    edits: [[COV, "const first = !gate.calendlySeen || typeof gate.calendlySeen !== 'object';", "const first = false;"]] },
  { name: 'calendly-state-on-failure', what: 'a refused Calendly poll forgets what it knew', test: 'coverage-push-test.mjs',
    edits: [[COV, "catch (e) { patch.calendlyError = String(e?.code || 'network'); }", "catch (e) { patch.calendlyError = String(e?.code || 'network'); patch.calendlySeen = {}; }"]] },
  { name: 'calendly-stamp-undelivered', what: 'a booking no device took is marked announced', test: 'coverage-push-test.mjs',
    edits: [[COV, "if (booked.length && handled(await send(db, message(booked, 'Booked')))) {", "await send(db, message(booked, 'Booked')); if (booked.length) {"]] },
  { name: 'import-no-push', what: 'the spreadsheet import pushes nothing', test: 'coverage-push-test.mjs',
    edits: [['api/_routes/leads-import.js', "if (created > 0) { try { await sendPush", "if (false) { try { await sendPush"]] },
];

let unproven = 0;
for (const g of GUARDS) {
  if (process.env.GUARD_ONLY && process.env.GUARD_ONLY !== g.name) continue;
  const dir = fs.mkdtempSync(path.join(tmpBase, 'guard-'));
  try {
    for (const d of ['api', 'src', 'scripts', 'public']) fs.cpSync(path.join(repoRoot, d), path.join(dir, d), { recursive: true, filter: (s) => !s.includes('.tmp-verify') });
    for (const f of ['package.json', 'vercel.json']) if (fs.existsSync(path.join(repoRoot, f))) fs.copyFileSync(path.join(repoRoot, f), path.join(dir, f));
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(dir, 'node_modules'));
    let applied = true;
    for (const [file, from, to] of g.edits) {
      const p = path.join(dir, file); const text = fs.readFileSync(p, 'utf8');
      if (text.split(from).length !== 2) { console.log(`FAIL ${g.name}: "${from.slice(0, 60)}" is not in ${file} exactly once`); applied = false; break; }
      fs.writeFileSync(p, text.replace(from, () => to));
    }
    if (!applied) { unproven++; continue; }
    const r = spawnSync(process.execPath, [path.join(dir, 'scripts', g.test)], { encoding: 'utf8', cwd: dir, timeout: 240000 });
    const out = (r.stdout || '') + (r.stderr || '');
    const fails = out.split('\n').filter(l => l.startsWith('  FAIL '));
    const good = r.status !== 0 && (fails.length > 0 || /Error|Exception/.test(out));
    if (!good) unproven++;
    console.log(`${good ? 'ok  ' : 'FAIL'} ${g.name}: ${good ? `${fails.length || 'the'} check(s) fail${fails[0] ? `, first: ${fails[0].trim().slice(5, 110)}` : ' (the test crashed)'}` : `${g.test} still passes without it`}  (${g.what})`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
console.log(unproven ? `\n${unproven} guard(s) not proven.` : `\nall guards are proven (each cut makes ${GUARDS.length === 1 ? 'its' : 'a'} test fail).`);
process.exit(unproven ? 1 : 0);
