#!/usr/bin/env node
/* The faster landing and Projects page prompt: the pure rules and the perf script.
 *
 *   node scripts/landing-test.mjs                 every check (the perf script's write runs one throttled load against a mock server this test starts)
 *   LANDING_QUICK=1 node scripts/landing-test.mjs  the pure checks only
 *
 * Sections:
 *   1. the perf script: the median across runs, the two column table, the targets, and that it writes docs/PERF.md
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { summarize, renderPerf, checkTargets } from './perf-landing.mjs';

let pass = 0; let fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log(`ok   ${msg}`); } else { fail++; console.log(`FAIL ${msg}`); } };
const QUICK = !!process.env.LANDING_QUICK;

/* 1. the perf script */
const run = (over) => ({ fcpMs: 500, lcpMs: 1500, lcpEl: 'h1.hero-title', cls: 0.01, inpMs: 40, jsKb: 120, jsDecodedKb: 400, cssKb: 9, fontKb: 30, imgKb: 10, imgDecodedKb: 10, docKb: 5, requests: 12, chunks: ['index.js'], longTasks: 2, longestTaskMs: 120, scrollLongTasks: 0, scrollLongestTaskMs: 0, droppedFrames: 0, worstFrameGapMs: 20, scrollFrames: 900, scrollPx: 5000, docPx: 6000, ...over });
const s3 = summarize([run({ lcpMs: 1800, jsKb: 130 }), run({ lcpMs: 1200, jsKb: 110 }), run({ lcpMs: 1500, jsKb: 120 })]);
ok(s3.lcpMs === 1500 && s3.jsKb === 120 && s3.runs === 3 && s3.lcpEl === 'h1.hero-title', `the summary is the median of the runs (${s3.lcpMs} ms, ${s3.jsKb} KB)`);
const s2 = summarize([run({ lcpMs: 1000 }), run({ lcpMs: 2000 })]);
ok(s2.lcpMs === 1500, 'an even count averages the middle two');
ok(summarize([]) === null, 'no runs, no summary');
const base = { ...run({ lcpMs: 1552, jsKb: 195, droppedFrames: 59 }), date: '2026-10-14', runs: 3 };
const after = { ...run({ lcpMs: 1300, jsKb: 130, droppedFrames: 0 }), date: '2026-10-15', runs: 3 };
const md = renderPerf({ baseline: base, after, page: '/' });
ok(/\| Metric \| Baseline \(2026-10-14\) \| After \(2026-10-15\) \|/.test(md) && /\| Largest contentful paint \| 1552 ms \| 1300 ms \|/.test(md) && /\| JS over the wire \(gzipped\) \| 195 KB \| 130 KB \|/.test(md), 'the table carries both columns side by side');
ok(/met: landing JS under 150 KB gzipped/.test(md) && /met: no dropped frames/.test(md) && /met: LCP under 2500 ms/.test(md), 'the targets are checked against the After column');
const one = renderPerf({ baseline: base, after: null, page: '/' });
ok(/\| Metric \| Baseline \(2026-10-14\) \|\n/.test(one) && !/After/.test(one) && /missed: landing JS under 150 KB/.test(one), 'a baseline alone is one column with its own target check');
const t = checkTargets({ ...run({ jsKb: 160, lcpMs: 2600, cls: 0.08, scrollLongestTaskMs: 250, droppedFrames: 3 }) }, { jsKb: 240 });
ok(t.find(x => /landing JS/.test(x.name)).ok === true && t.find(x => /LCP/.test(x.name)).ok === false && t.find(x => /CLS/.test(x.name)).ok === false && t.find(x => /long task/.test(x.name)).ok === false && t.find(x => /dropped/.test(x.name)).ok === false, 'the JS target accepts 30 percent under the baseline; LCP, CLS, long tasks and dropped frames are judged on their own');

/* 1b. the script writes docs/PERF.md: one throttled load against a mock server started here */
if (!QUICK) {
  const port = 4361;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-'));
  const out = path.join(tmp, 'PERF.md'); const bl = path.join(tmp, 'baseline.json');
  const server = spawn('node', ['scripts/mock-server.mjs'], { env: { ...process.env, DIST: 'dist', PORT: String(port) }, stdio: 'ignore', detached: true });
  await new Promise(r => setTimeout(r, 2000));
  try {
    const r = spawnSync('node', ['scripts/perf-landing.mjs', '--baseline'], { env: { ...process.env, PERF_BASE: `http://127.0.0.1:${port}`, PERF_RUNS: '1', PERF_OUT: out, PERF_BASELINE: bl }, encoding: 'utf8', timeout: 240000 });
    const text = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
    ok(r.status === 0 && /^# Landing page performance/.test(text) && /\| Largest contentful paint \| \d+ ms \|/.test(text) && /\| JS over the wire \(gzipped\) \| \d+ KB \|/.test(text) && /Dropped frames during the scroll/.test(text), `the perf script runs and writes the report (exit ${r.status}, ${text.length} chars)`);
    ok(fs.existsSync(bl) && typeof JSON.parse(fs.readFileSync(bl, 'utf8')).lcpMs === 'number', 'and the baseline JSON beside it');
  } finally {
    try { process.kill(-server.pid); } catch { /* already gone */ }
  }
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);
