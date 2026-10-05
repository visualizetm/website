/* Pre-ship gate (CRM mobile revamp, milestone 6): one command, so the gate that was easy to skip is not.
 *
 *   npm run preship            quick: layout-audit and scene-audit at 390 and 1280, plus the fast checks
 *   npm run preship:full       full: all five widths (320, 390, 430, 768, 1280)
 *
 * It builds to its own directory and serves that (never dist/, so a rebuild cannot break a running audit), starts the mock server the
 * scene audit needs, and runs layout-audit and scene-audit as detached processes writing to .tmp-verify/preship/, polling them. One
 * pass or fail line each, with the first error on a fail. Then lint, the hex count, the gesture, chrome and empty audits and the two client docs
 * browser audits (the editor, the flows) run against the same build. Exit code 1 when anything failed. A full run takes about forty minutes; quick takes about fifteen.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const FULL = process.argv.includes('--full');
const REUSE = process.argv.includes('--no-build');
const WIDTHS = FULL ? '320,390,430,768,1280' : '390,1280';
const root = process.cwd();
const out = join(root, '.tmp-verify', 'preship');
const dist = join(out, 'dist');
const PORT = 4341; const MOCK = 4350;
const base = `http://127.0.0.1:${PORT}`;
mkdirSync(out, { recursive: true });
const line = (name, ok, note) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(22)} ${note}`);
let failed = 0;
const fail = () => { failed++; };

if (!REUSE) {
  if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
  const b = spawnSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir'], { cwd: root, encoding: 'utf8' });
  if (b.status !== 0) { console.log(b.stdout.slice(-600), b.stderr.slice(-600)); line('build', false, 'vite build failed'); process.exit(1); }
  line('build', true, `to ${dist}`);
}
const server = (cmd, args, env, log) => spawn(cmd, args, { cwd: root, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', openSync(join(out, log), 'w'), openSync(join(out, log), 'w')] });
const preview = server('npx', ['vite', 'preview', '--outDir', dist, '--port', String(PORT), '--strictPort'], {}, 'preview.log');
const mock = server('node', ['scripts/mock-server.mjs'], { DIST: dist, PORT: String(MOCK) }, 'mock.log');
await sleep(4000);

const detached = (name, script, env) => {
  const log = join(out, `${name}.log`);
  const fd = openSync(log, 'w');
  const child = spawn('node', [script], { cwd: root, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', fd, fd] });
  child.unref();
  return { name, log, done: new Promise(res => child.on('exit', code => res(code))) };
};
const jobs = [
  detached('layout-audit', 'scripts/layout-audit.mjs', { AUDIT_BASE: base, AUDIT_WIDTHS: WIDTHS }),
  detached('scene-audit', 'scripts/scene-audit.mjs', { SCENE_BASE: `http://127.0.0.1:${MOCK}`, SCENE_PATH: '/', SCENE_WIDTHS: WIDTHS }),
];
console.log(`running layout-audit and scene-audit at ${WIDTHS} (logs in .tmp-verify/preship/)`);
const tick = setInterval(() => console.log(`  ... ${jobs.filter(j => !j.finished).map(j => j.name).join(', ')} still running`), 120000);
const codes = await Promise.all(jobs.map(j => j.done.then(c => { j.finished = true; return c; })));
clearInterval(tick);
const text = (f) => (existsSync(f) ? readFileSync(f, 'utf8') : '');
{
  const t = text(jobs[0].log); const m = /(\d+) failing view/.exec(t); const firstFail = (t.match(/ {2}FAIL .*\n(?: {8}.*\n)?/) || [''])[0].trim().replace(/\s+/g, ' ');
  const ok = codes[0] === 0 && !m; line('layout-audit', ok, ok ? `${(t.match(/^ {2}ok /gm) || []).length} views clean at ${WIDTHS}` : `${m ? m[1] : '?'} failing views. First: ${firstFail}`); if (!ok) fail();
}
{
  const t = text(jobs[1].log); const rows = [...t.matchAll(/^\| (\d+x\d+(?: reduce)?) \|.*\| (clean|\d+ failure\(s\)) \|/gm)];
  const bad = rows.filter(r => r[2] !== 'clean'); const firstFail = (t.match(/^FAIL .*\n.*\n/m) || [''])[0].trim().replace(/\s+/g, ' ');
  const ok = codes[1] === 0 && rows.length > 0 && !bad.length; line('scene-audit', ok, ok ? `${rows.length} profiles clean (${rows.map(r => r[1]).join(', ')})` : `${bad.map(r => `${r[1]} ${r[2]}`).join(', ') || 'no result'}. First: ${firstFail}`); if (!ok) fail();
}
const run = (name, cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 15 * 60 * 1000 });
  const tail = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').filter(Boolean).slice(-1)[0] || '';
  const ok = r.status === 0; line(name, ok, tail.slice(0, 160)); if (!ok) fail();
};
run('lint', 'npm', ['run', 'lint', '--silent']);
run('hex count', 'node', ['-e', "const s=require('child_process').spawnSync('node',['scripts/hex-count.js'],{encoding:'utf8'}).stdout;const n=Number(/: *(\\d+)/.exec(s)[1]);console.log('hex '+n+' of 90');process.exit(n<=90?0:1)"]);
run('gesture-test', 'node', ['scripts/gesture-test.mjs'], { AUDIT_BASE: base });
run('chrome-audit', 'node', ['scripts/chrome-audit.mjs'], { AUDIT_BASE: base });
run('empty-audit', 'node', ['scripts/empty-audit.mjs'], { AUDIT_BASE: base });
run('docs-editor-audit', 'node', ['scripts/docs-editor-audit.mjs'], { AUDIT_BASE: base });
run('docs-flow-audit', 'node', ['scripts/docs-flow-audit.mjs'], { AUDIT_BASE: base });

for (const p of [preview, mock]) { try { process.kill(-p.pid); } catch { /* already gone */ } }
console.log(failed ? `\nPRE-SHIP FAILED (${failed})` : '\nPRE-SHIP PASSED');
process.exit(failed ? 1 : 0);
