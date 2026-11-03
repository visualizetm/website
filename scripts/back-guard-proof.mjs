#!/usr/bin/env node
/* The back tree's guards, each put back as the fault it stops (one back stack, milestone 2): a copy of src/shell with one line
 * cut, then the pure half of scripts/back-test.mjs on it (BACK_ROOT); the named check must fail.
 *   planner-to-root   a record's sub screen backs to the section root instead of the record (the old nav-history fallback)
 *   room-to-calls     the room backs to Calls instead of the queue
 *   summary-home      the summary backs to the home
 *   design-root       the design system is a root again (no Back, reachable from anywhere) */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const T = 'src/shell/backTree.js';
const CUTS = [
  { name: 'planner-to-root', file: T, check: /planner|tasks backs to the client|docs back to the client|showcase/, from: "  if ((m = p.match(/^\\/clients\\/([^/]+)\\/(planner|tasks|docs|showcase)$/))) return recordPathOf('clients', m[1]);", to: "  if ((m = p.match(/^\\/clients\\/([^/]+)\\/(planner|tasks|docs|showcase)$/))) return '/clients';" },
  { name: 'room-to-calls', file: T, check: /room backs to the queue/, from: "  if (/^\\/calls\\/room\\/[^/]+$/.test(p)) return '/calls/queue';", to: "  if (/^\\/calls\\/room\\/[^/]+$/.test(p)) return '/calls';" },
  { name: 'summary-home', file: T, check: /summary backs to Calls/, from: "  if (p === '/calls/queue' || p === '/calls/summary') return '/calls';", to: "  if (p === '/calls/queue') return '/calls';\n  if (p === '/calls/summary') return '/';" },
  { name: 'design-root', file: T, check: /design/, from: "'settings', 'more', 'leads', 'lists', 'triage', 'booked'];", to: "'settings', 'more', 'leads', 'lists', 'triage', 'booked', 'design'];" },
];
let bad = 0, proven = 0;
for (const cut of CUTS) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'back-cut-'));
  fs.cpSync(path.join(repoRoot, 'src', 'shell'), path.join(tmp, 'src', 'shell'), { recursive: true });
  const file = path.join(tmp, cut.file);
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(cut.from)) { console.log(`FAIL ${cut.name}: the guard's line is not in ${cut.file}`); bad++; fs.rmSync(tmp, { recursive: true, force: true }); continue; }
  fs.writeFileSync(file, text.replace(cut.from, cut.to));
  const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'back-test.mjs')], { cwd: repoRoot, env: { ...process.env, BACK_ROOT: tmp, AUDIT_BASE: '' }, encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  const fails = `${r.stdout || ''}`.split('\n').filter(l => /^FAIL/.test(l));
  const named = fails.filter(l => cut.check.test(l));
  if (r.status !== 0 && named.length) { proven++; console.log(`ok   ${cut.name}: without the guard, ${fails.length} check(s) fail (${named[0].slice(5, 110)})`); }
  else { bad++; console.log(`FAIL ${cut.name}: every check still passes with the guard cut out${fails.length ? ` (other failures: ${fails[0].slice(0, 80)})` : ''}`); }
}
console.log(bad ? `\n${bad} guard(s) not proven.` : `\nEvery guard proven: ${proven} cut in turn, each one's check fails.`);
process.exit(bad ? 1 : 0);
