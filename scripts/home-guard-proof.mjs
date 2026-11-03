#!/usr/bin/env node
/* The home's guard put back as the fault it stops (prompt 1b, item 3): a callback row that stays live after Log outcome rendered
 * from the live item alone, so its done ghost never showed. The fault is restored in a copy of the repository, built there, served
 * on a port of its own, and home-nextup-test run against it at 390: "the callback row shows done once the outcome is saved" must
 * fail. Slow (one vite build); run it when the home rows or that test change.
 *   PW_CHROME=/opt/pw-browsers/chromium node scripts/home-guard-proof.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PROOF_PORT || 4392);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'home-cut-'));
for (const f of ['src', 'public', 'index.html', 'vite.config.js', 'vercel.json', 'package.json', 'scripts']) fs.cpSync(path.join(repoRoot, f), path.join(tmp, f), { recursive: true });
fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
const rows = path.join(tmp, 'src', 'lib', 'homeRows.js');
let text = fs.readFileSync(rows, 'utf8');
const guard = "  const live = (list) => (list || []).map(item => { const g = ghosts?.[rowKey(item)]; const stays = !!g?.stay; return { key: rowKey(item), item, done: stays && g.mode === 'done', leaving: stays && g.mode === 'leaving' }; });";
if (!text.includes(guard)) { console.log('FAIL the home rows have changed shape; update the proof'); process.exit(1); }
text = text.replace(guard, "  const live = (list) => (list || []).map(item => ({ key: rowKey(item), item, done: false, leaving: false }));");
fs.writeFileSync(rows, text);
const build = spawnSync('npx', ['vite', 'build', '--outDir', path.join(tmp, 'dist')], { cwd: tmp, encoding: 'utf8' });
if (build.status !== 0) { console.log('FAIL the faulted copy did not build:', (build.stderr || build.stdout).slice(-400)); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1); }
const server = spawn('npx', ['vite', 'preview', '--outDir', path.join(tmp, 'dist'), '--port', String(PORT), '--strictPort'], { cwd: tmp, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 3500));
const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'home-nextup-test.mjs')], { cwd: repoRoot, env: { ...process.env, AUDIT_BASE: `http://127.0.0.1:${PORT}`, AUDIT_WIDTHS: '390' }, encoding: 'utf8' });
server.kill();
fs.rmSync(tmp, { recursive: true, force: true });
const flagged = r.status !== 0 && /FAIL the callback row shows done once the outcome is saved/.test(r.stdout || '');
console.log(flagged ? 'ok   callback-done-ghost: with the ghost merge cut, home-nextup-test fails on the callback row' : `FAIL callback-done-ghost: the test still passes with the guard cut out\n${(r.stdout || '').slice(-600)}`);
process.exit(flagged ? 0 : 1);
