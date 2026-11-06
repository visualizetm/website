#!/usr/bin/env node
/* The Concepts full screen guards, each put back as the fault it stops, one at a time. Every cut is made in its own copy of the
 * repository (src, public and the build files; node_modules is a symlink), built there, served by vite preview on a port of its own
 * in its own process group, and scripts/concepts-fullscreen-test.mjs is run against it. The test must exit non zero AND print the
 * FAIL line of the check that guards the fault (the faulted copy may fail other checks too; only that line proves the guard is
 * covered). A guard string that is no longer in the source fails the proof at once: the code changed shape, update the cut.
 *
 *   F1 present  a decision control rendered in present mode (?present=1)
 *   F2 locked   a decision control rendered on a sent (locked) Review each set
 *   F3 note     the note requirement removed (Save with an empty note posts a changes answer)
 *   F4 scrim    the cue scrim's first two stops under alpha 0.6
 *   F5 element  requestFullscreen asked on the stage's own element instead of the document element
 *   F6 scroll   the page's overflow not handed back when the stage closes
 *
 * One vite build per cut (about a minute) and a test run each (the sections that guard the cut, at both widths), run in turn.
 * PROOF_FULL=1 runs the whole test for every cut. PROOF_PORT moves the first port (4392 by default; one more for each cut).
 *   PW_CHROME=/opt/pw-browsers/chromium node scripts/concepts-fullscreen-guard-proof.mjs */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIRST_PORT = Number(process.env.PROOF_PORT || 4392);
const STAGE = path.join('src', 'components', 'ConceptsStage.jsx');
const PAGE = path.join('src', 'pages', 'Concepts.jsx');

/* Each cut: the file, the exact guard text (each must occur exactly once), what replaces it, the test sections that cover it, and the FAIL line that must appear. */
const CUTS = [
  {
    id: 'F1', name: 'present-decision-control',
    why: 'a decision control rendered in present mode',
    sections: '6',
    edits: [
      { file: STAGE, from: '{!present && review && !submitted && !reference && (\n        <div className="cp-st-decide" role="group"', to: '{review && !submitted && !reference && (\n        <div className="cp-st-decide" role="group"' },
      { file: STAGE, from: '{!present && !review && !decided && (\n        <div className="cp-st-decide">', to: '{!review && !decided && (\n        <div className="cp-st-decide">' },
    ],
    expect: /FAIL [^\n]*present: no decision control and no chip in the stage/,
  },
  {
    id: 'F2', name: 'locked-decision-control',
    why: 'a decision control rendered on a locked (sent) set',
    sections: '6',
    edits: [
      { file: STAGE, from: '{!present && review && !submitted && !reference && (\n        <div className="cp-st-decide" role="group"', to: '{!present && review && !reference && (\n        <div className="cp-st-decide" role="group"' },
    ],
    expect: /FAIL a submitted set shows no decision button and no Review and send/,
  },
  {
    id: 'F3', name: 'note-requirement',
    why: 'the note requirement removed, an empty note is posted as a changes answer',
    sections: '5',
    edits: [
      { file: STAGE, from: "    if (!note.trim()) { setLocal(R.noteRequired); return; }\n", to: '' },
    ],
    expect: /FAIL an empty note shows "Say what you would change first\." and posts nothing/,
  },
  {
    id: 'F4', name: 'scrim-alpha',
    why: 'the cue scrim first stops at 0.4',
    sections: '2,11', // 11 measures the same fault on real pixels (a faulted copy fails both)
    edits: [
      { file: PAGE, from: '.cp-cue { --cue-a: 0.78; --cue-b: 0.66;', to: '.cp-cue { --cue-a: 0.4; --cue-b: 0.4;' },
    ],
    expect: /FAIL [^\n]*the first two scrim stops are black at alpha >= 0\.6/,
  },
  {
    id: 'F5', name: 'fullscreen-element',
    why: 'requestFullscreen asked on the overlay (a DIV) instead of the document element',
    sections: '1,4',
    edits: [
      { file: PAGE, from: '    try { document.documentElement.requestFullscreen?.()?.catch?.(() => {}); } catch { /* no Fullscreen API */ }\n', to: '' },
      { file: STAGE, from: '  const ref = useDialog(exit);\n', to: '  const ref = useDialog(exit);\n  useEffect(() => { try { ref.current?.requestFullscreen?.()?.catch?.(() => {}); } catch { /* no Fullscreen API */ } }, [ref]);\n' },
    ],
    expect: /FAIL [^\n]*(asks for full screen on the HTML element once|requestFullscreen was asked once, on HTML)/,
  },
  {
    id: 'F6', name: 'scroll-restore',
    why: 'the page overflow not restored when the stage closes',
    sections: '7',
    edits: [
      { file: STAGE, from: '    return () => { html.style.overflow = before.h; body.style.overflow = before.b; exitFullscreen(); };', to: '    return () => { exitFullscreen(); };' },
    ],
    expect: /FAIL the previous overflow is restored after close/,
  },
];

const pad = (s) => String(s).padEnd(26);
const lineOf = (out, re) => (out.split('\n').find(l => re.test(l)) || '').trim();

async function waitUp(port, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(`http://127.0.0.1:${port}/`); if (r.ok) return true; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

async function runCut(cut, port) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `cfs-${cut.id.toLowerCase()}-`));
  let server = null;
  const cleanup = () => {
    if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch { try { server.kill(); } catch { /* gone */ } } }
    fs.rmSync(tmp, { recursive: true, force: true });
  };
  try {
    for (const f of ['src', 'public', 'index.html', 'vite.config.js', 'vercel.json', 'package.json']) fs.cpSync(path.join(repoRoot, f), path.join(tmp, f), { recursive: true });
    fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');

    /* Every guard text must be there exactly once before it is replaced. */
    const files = new Map();
    for (const e of cut.edits) {
      const p = path.join(tmp, e.file);
      if (!files.has(p)) files.set(p, fs.readFileSync(p, 'utf8'));
      const text = files.get(p);
      const n = text.split(e.from).length - 1;
      if (n !== 1) return { ok: false, line: `FAIL ${cut.name}: the source has changed shape, the guard text in ${e.file} occurs ${n} times (wanted 1); update the proof` };
      files.set(p, text.replace(e.from, () => e.to));
    }
    for (const [p, text] of files) fs.writeFileSync(p, text);

    const build = spawnSync('npx', ['vite', 'build', '--outDir', path.join(tmp, 'dist')], { cwd: tmp, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (build.status !== 0) return { ok: false, line: `FAIL ${cut.name}: the faulted copy did not build: ${(build.stderr || build.stdout || '').slice(-400)}` };

    /* Its own process group, so the kill reaches vite itself and not only npx: a server left on the port would serve the wrong build to the next cut. */
    server = spawn('npx', ['vite', 'preview', '--outDir', path.join(tmp, 'dist'), '--port', String(port), '--strictPort'], { cwd: tmp, stdio: 'ignore', detached: true });
    if (!(await waitUp(port))) return { ok: false, line: `FAIL ${cut.name}: the preview did not come up on ${port}` };

    const env = { ...process.env, AUDIT_BASE: `http://127.0.0.1:${port}`, PW_CHROME: process.env.PW_CHROME || '/opt/pw-browsers/chromium' };
    if (!process.env.PROOF_FULL) env.ONLY = cut.sections;
    const r = spawnSync(process.execPath, [path.join(repoRoot, 'scripts', 'concepts-fullscreen-test.mjs')], { cwd: repoRoot, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const out = `${r.stdout || ''}\n${r.stderr || ''}`;
    const hit = lineOf(out, cut.expect);
    if (r.status !== 0 && hit) return { ok: true, line: `ok   ${cut.name}: ${hit}` };
    const tail = out.split('\n').filter(l => /^FAIL /.test(l)).slice(0, 4).join('\n') || out.slice(-400);
    return { ok: false, line: `FAIL ${cut.name}: the test still passes with the guard cut out (exit ${r.status}${r.status !== 0 ? ', but not on the guarding check' : ''})\n${tail}` };
  } finally {
    cleanup();
  }
}

let bad = 0;
for (let i = 0; i < CUTS.length; i++) {
  const cut = CUTS[i];
  const t0 = Date.now();
  console.log(`-- ${cut.id} ${cut.why} (port ${FIRST_PORT + i})`);
  let res;
  try { res = await runCut(cut, FIRST_PORT + i); } catch (e) { res = { ok: false, line: `FAIL ${cut.name}: ${e && e.message ? e.message : e}` }; }
  console.log(res.line);
  console.log(`   ${pad(cut.id)}${Math.round((Date.now() - t0) / 1000)}s`);
  if (!res.ok) bad++;
}
console.log(bad ? `\n${bad} of ${CUTS.length} cuts were not caught` : `\nall ${CUTS.length} cuts caught`);
process.exit(bad ? 1 : 0);
