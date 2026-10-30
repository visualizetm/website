#!/usr/bin/env node
/* Each way the routing can go wrong, put back in a copy of vercel.json and api/ in turn: with the fault in place
 * scripts/routing-test.mjs must exit 1 and say which check caught it. A fault the test lets through is reported as
 * not proven and the run exits 1. The repository itself is never touched.
 *   node scripts/routing-guard-proof.mjs */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const tmpBase = path.join(repoRoot, '.tmp-verify'); fs.mkdirSync(tmpBase, { recursive: true });
const withoutRewrite = (source) => (root) => { const p = path.join(root, 'vercel.json'); const v = JSON.parse(fs.readFileSync(p, 'utf8')); v.rewrites = v.rewrites.filter(r => r.source !== source); fs.writeFileSync(p, JSON.stringify(v, null, 2)); };

const FAULTS = [
  { name: 'dynamic-cron-file', what: 'api/cron/index.js is api/cron/[job].js again and the /api/cron/:job rewrite is gone (the original fault)',
    apply: (root) => { fs.renameSync(path.join(root, 'api/cron/index.js'), path.join(root, 'api/cron/[job].js')); withoutRewrite('/api/cron/:job')(root); }, expect: ['[param] name', 'the single page app'] },
  { name: 'cron-rewrite-missing', what: 'the /api/cron/:job rewrite removed, index.js kept', apply: withoutRewrite('/api/cron/:job'), expect: ['the single page app'] },
  { name: 'cron-rewrite-below-catch-all', what: 'the /api/cron/:job rewrite moved below the catch-all',
    apply: (root) => { const p = path.join(root, 'vercel.json'); const v = JSON.parse(fs.readFileSync(p, 'utf8')); const i = v.rewrites.findIndex(r => r.source === '/api/cron/:job'); const [x] = v.rewrites.splice(i, 1); v.rewrites.push(x); fs.writeFileSync(p, JSON.stringify(v, null, 2)); }, expect: ['after the catch-all'] },
  { name: 'admin-route-without-rewrite', what: 'the /api/admin/log rewrite removed while the dispatcher still registers it', apply: withoutRewrite('/api/admin/log'), expect: ['log has a rewrite'] },
  { name: 'cron-job-unregistered', what: 'the daily job renamed inside the cron dispatcher', apply: (root) => { const p = path.join(root, 'api/cron/index.js'); fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/^(\s*)daily: route\(/m, '$1dailyx: route(')); }, expect: ['daily'] },
  { name: 'dynamic-api-folder', what: 'a [param] file added under api/', apply: (root) => { fs.mkdirSync(path.join(root, 'api/hidden'), { recursive: true }); fs.writeFileSync(path.join(root, 'api/hidden/[id].js'), 'export default function h() {}\n'); }, expect: ['[param] name'] },
  { name: 'unreachable-function', what: 'a function file added that no rewrite or path reaches (api/_x is not one; api/deep/a/index.js is)', apply: (root) => { fs.mkdirSync(path.join(root, 'api/deep/a'), { recursive: true }); fs.writeFileSync(path.join(root, 'api/deep/a/index.js'), 'export default function h() {}\n'); }, expect: ['is reachable'] },
  { name: 'client-url-without-route', what: 'the /api/push-key function removed while the app still requests it', apply: (root) => { fs.rmSync(path.join(root, 'api/push-key.js')); }, expect: ['/api/push-key'] },
];

let unproven = 0;
for (const f of FAULTS) {
  const dir = fs.mkdtempSync(path.join(tmpBase, 'routing-'));
  try {
    fs.cpSync(path.join(repoRoot, 'api'), path.join(dir, 'api'), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, 'vercel.json'), path.join(dir, 'vercel.json'));
    fs.symlinkSync(path.join(repoRoot, 'src'), path.join(dir, 'src'));
    f.apply(dir);
    const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'routing-test.mjs')], { env: { ...process.env, ROUTING_ROOT: dir }, encoding: 'utf8' });
    const fails = (r.stdout || '').split('\n').filter(l => l.startsWith('  FAIL '));
    const named = f.expect.every(w => fails.some(l => l.includes(w)));
    const good = r.status === 1 && named;
    if (!good) unproven++;
    console.log(`${good ? 'ok  ' : 'FAIL'} ${f.name}: ${good ? `${fails.length} check(s) fail` : `exit ${r.status}, the expected check did not fail (${f.expect.join(' / ')})`}  (${f.what})`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
console.log(unproven ? `\n${unproven} fault(s) not proven.` : `\nall ${FAULTS.length} faults are caught.`);
process.exit(unproven ? 1 : 0);
