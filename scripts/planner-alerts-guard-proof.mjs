#!/usr/bin/env node
/* Proof that each Planner v2 alerts guard is what stops the bad push (part 3). For every guard: copy api/ to a temp tree, put the
 * fault back in the real source, run scripts/planner-alerts-test.mjs against that copy, and require that the guard's own check FAILS.
 * A cut that finds nothing to change is itself a failure.
 *   node scripts/planner-alerts-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PP = '_lib/plannerPush.js';
const PL = 'planner.js';
const CUTS = [
  { name: 'the switch check', expect: /with New posts to review off|with Post today off|with Rob answered my idea off/,
    edits: [[PP, "  if (!alertOn(lead, key)) return 'switched off';\n", '']] },
  { name: 'one Post today a day', expect: /the minute cron later the same day sends nothing more/,
    edits: [[PP, "  if (lead.planner.todayPushedOn === day) return { sent: false, reason: 'already today' };\n", ''], [PP, ", 'planner.todayPushedOn': { $ne: day }", '']] },
  { name: 'no caption in a push', expect: /never carries a caption/,
    edits: [[PP, "status: 'review', deleted: { $ne: true }, archived: { $ne: true } }).project({ _id: 1 })", "status: 'review', deleted: { $ne: true }, archived: { $ne: true } }).project({ _id: 1, caption: 1 })"],
      [PP, "body: 'Tap to look at them and say yes or ask for a change.',", "body: waiting.map(p => p.caption).join(' '),"]] },
  { name: 'alerts are booleans', expect: /alerts with a string is a 400|alerts with a number is a 400|alerts with null is a 400/,
    edits: [[PL, " || typeof a[k] !== 'boolean'", '']] },
  { name: 'quiet hours', expect: /it is quiet: not sent and not stamped/,
    edits: [[PP, "  if (clientQuiet(now)) return 'quiet';\n", '']] },
  { name: 'the device list', expect: /no device: nothing sent/,
    edits: [[PP, "  if (!(await devicesOf(db, lead._id))) return 'no devices';\n", '']] },
];

const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const base = spawnSync('node', ['scripts/planner-alerts-test.mjs'], { cwd: repoRoot, encoding: 'utf8' });
if (base.status !== 0) { console.log('The real source must pass first:\n' + base.stdout.split('\n').filter(l => l.startsWith('FAIL')).join('\n')); process.exit(1); }
let bad = 0;
for (const cut of CUTS) {
  const dir = fs.mkdtempSync(path.join(tmpBase, 'alerts-cut-'));
  const api = path.join(dir, 'api');
  fs.cpSync(path.join(repoRoot, 'api'), api, { recursive: true });
  let ok = true;
  for (const [file, from, to] of cut.edits) {
    const p = path.join(api, file); const src = fs.readFileSync(p, 'utf8');
    if (!src.includes(from)) { console.log(`FAIL ${cut.name}: the cut found nothing to change in ${file}`); ok = false; bad++; break; }
    fs.writeFileSync(p, src.replace(from, to));
  }
  if (ok) {
    const r = spawnSync('node', ['scripts/planner-alerts-test.mjs'], { cwd: repoRoot, encoding: 'utf8', env: { ...process.env, API_SRC: api } });
    const fails = r.stdout.split('\n').filter(l => l.startsWith('FAIL'));
    const own = fails.filter(l => cut.expect.test(l));
    if (r.status !== 0 && own.length) console.log(`ok   ${cut.name}: with the fault back, ${own.length} of its check(s) fail (${own[0].slice(5, 95)})`);
    else { console.log(`FAIL ${cut.name}: ${r.status === 0 ? 'every check still passes' : `the test fails but not on its own check (${fails[0] || r.stderr.slice(0, 120)})`}`); bad++; }
  }
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(bad ? `\n${bad} guard(s) not proven.` : `\nEvery guard proven: ${CUTS.length} faults put back in turn, each one's check fails.`);
process.exit(bad ? 1 : 0);
