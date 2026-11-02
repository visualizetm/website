#!/usr/bin/env node
/* The shell's guard put back as the fault it stops (the shell, milestone 3): the account card (avatar, Rob, Sign out) restored on
 * the More page in a copy of the repository, built there, served on a port of its own, and the chrome audit run on the More state
 * alone (AUDIT_ONLY=more): it must flag the card. Slow (one vite build); run it when More or the chrome audit changes.
 *   PW_CHROME=/opt/pw-browsers/chromium node scripts/shell-guard-proof.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PROOF_PORT || 4391);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shell-cut-'));
for (const f of ['src', 'public', 'index.html', 'vite.config.js', 'vercel.json', 'package.json', 'scripts']) fs.cpSync(path.join(repoRoot, f), path.join(tmp, f), { recursive: true });
fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
const more = path.join(tmp, 'src', 'pages', 'AdminMore.jsx');
let text = fs.readFileSync(more, 'utf8');
const anchor = "        </Stack>\n      </ScrollArea>";
if (!text.includes(anchor)) { console.log('FAIL the More page has changed shape; update the proof'); process.exit(1); }
text = text.replace(anchor, "          <div className=\"mo-user\"><strong>Rob</strong><span>Visualize Studio</span><button type=\"button\">Sign out</button></div>\n" + anchor);
fs.writeFileSync(more, text);
const build = spawnSync('npx', ['vite', 'build', '--outDir', path.join(tmp, 'dist')], { cwd: tmp, encoding: 'utf8' });
if (build.status !== 0) { console.log('FAIL the faulted copy did not build:', (build.stderr || build.stdout).slice(-400)); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(1); }
const server = spawn('npx', ['vite', 'preview', '--outDir', path.join(tmp, 'dist'), '--port', String(PORT), '--strictPort'], { cwd: tmp, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 3500));
const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'chrome-audit.mjs')], { cwd: repoRoot, env: { ...process.env, AUDIT_BASE: `http://127.0.0.1:${PORT}`, AUDIT_ONLY: 'more' }, encoding: 'utf8' });
server.kill();
fs.rmSync(tmp, { recursive: true, force: true });
const flagged = r.status !== 0 && /account card/.test(r.stdout || '');
console.log(flagged ? 'ok   account-card: with the card restored on More, the chrome audit flags it' : `FAIL account-card: the chrome audit let the restored card through\n${(r.stdout || '').slice(-600)}`);
process.exit(flagged ? 0 : 1);
