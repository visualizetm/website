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

/* 2. the spotlight picker (src/lib/spotlight.js) */
import { spotlightPicks, spotlitLeads, spotlightRoom, spotlightOffPatch, SPOTLIGHT_MAX } from '../src/lib/spotlight.js';
const c = (slug, order, over = {}) => ({ slug, displayName: slug, featured: { landing: false, logoStrip: false, work: true, spotlight: false, order, ...over } });
const today = [c('abyssinia', 0), c('ss-guns', 1), c('sharpless', 2), c('nibble', 3), c('nelly', 4), c('paps', 5), c('ghetto-garage', 6), c('city-spice', 7, { work: false })];
ok(spotlightPicks(today).map(x => x.slug).join(',') === 'abyssinia,ss-guns,sharpless', `nothing switched on: the three lowest ordered work clients (${spotlightPicks(today).map(x => x.slug).join(',')})`);
const three = today.map(x => (['paps', 'nelly', 'nibble'].includes(x.slug) ? c(x.slug, x.featured.order, { spotlight: true }) : x));
ok(spotlightPicks(three).map(x => x.slug).join(',') === 'nibble,nelly,paps', `three on: exactly those, by order (${spotlightPicks(three).map(x => x.slug).join(',')})`);
const oneOn = today.map(x => (x.slug === 'paps' ? c('paps', 5, { spotlight: true }) : x));
ok(spotlightPicks(oneOn).map(x => x.slug).join(',') === 'paps,abyssinia,ss-guns', `one on: it leads and two fill from the lowest order (${spotlightPicks(oneOn).map(x => x.slug).join(',')})`);
const four = today.map(x => (['paps', 'nelly', 'nibble', 'sharpless'].includes(x.slug) ? c(x.slug, x.featured.order, { spotlight: true }) : x));
ok(spotlightPicks(four).length === SPOTLIGHT_MAX && spotlightPicks(four).map(x => x.slug).join(',') === 'sharpless,nibble,nelly', `four on (a stale record): the three lowest ordered of them (${spotlightPicks(four).map(x => x.slug).join(',')})`);
ok(spotlightPicks([]).length === 0 && spotlightPicks(null).length === 0 && spotlightPicks([c('', 0)]).length === 0, 'nothing published: nothing picked');
const L = (id, order, spotlight, published = true) => ({ _id: id, business: id, showcase: { published, slug: id, featured: { work: true, spotlight, order } } });
const leads = [L('a', 0, true), L('b', 1, true), L('c', 2, true), L('d', 3, false), L('e', 4, true, false), { _id: 'x', deleted: true, showcase: { published: true, featured: { spotlight: true, order: 0 } } }];
ok(spotlitLeads(leads).map(l => l._id).join(',') === 'a,b,c', `the CRM counts published, undeleted leads with the flag on (${spotlitLeads(leads).map(l => l._id).join(',')})`);
const room = spotlightRoom(leads, leads[3]);
ok(room.ok === false && room.replace.map(l => l._id).join(',') === 'a,b,c', 'a fourth is asked which of the three it replaces');
ok(spotlightRoom(leads.slice(1), leads[3]).ok === true && spotlightRoom(leads, leads[0]).ok === true, 'under three, or already one of the three, it goes on outright');
const off = spotlightOffPatch(leads[0]);
ok(off.showcase.featured.spotlight === false && off.showcase.featured.work === true && off.showcase.slug === 'a', 'the replace patch turns one flag off and carries the rest of the showcase');

/* 3. the redirects in vercel.json: /clients and /clients/<slug> are 301s to the new paths */
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const toRegex = (src) => new RegExp('^' + src.replace(/:path\*/g, '(.*)').replace(/:([a-z]+)/g, '([^/]+)') + '$');
const redirect = (p) => { for (const r of vercel.redirects || []) { const m = toRegex(r.source).exec(p); if (m) return { to: r.destination.replace(/:([a-z]+)/g, () => m[1] ?? '').replace(/:path\*/g, m[1] ?? ''), status: r.permanent ? 301 : 307, has: !!(r.has || r.missing) }; } return null; };
const r1 = redirect('/clients'); const r2 = redirect('/clients/sharpless-detailing'); const r3 = redirect('/work'); const r4 = redirect('/work/sharpless-detailing');
ok(r1 && r1.status === 301 && r1.to === '/projects' && !r1.has, `/clients is a 301 to /projects (${JSON.stringify(r1)})`);
ok(r2 && r2.status === 301 && r2.to === '/projects/sharpless-detailing' && !r2.has, `/clients/sharpless-detailing is a 301 to /projects/sharpless-detailing (${JSON.stringify(r2)})`);
ok(r3 && r3.to === '/projects' && r4 && r4.to === '/projects/sharpless-detailing', 'the older /work paths land on /projects too');
ok(!redirect('/projects') && !redirect('/projects/sharpless-detailing'), 'the new paths redirect nowhere');
ok((vercel.headers || []).some(h => h.source === '/projects/(.*)') && !(vercel.headers || []).some(h => h.source === '/clients/(.*)'), 'the no-cache header rule follows the prerendered pages to /projects');

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
