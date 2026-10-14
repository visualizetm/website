#!/usr/bin/env node
/* The landing page's performance profile (the faster landing prompt).
 *
 * Loads a page in a phone profile (390 x 844, 3x pixels, touch, the CPU
 * throttled 4x, Chrome's Slow 4G preset: 1.6 Mbps down, 750 Kbps up, 150 ms
 * of latency) PERF_RUNS times (three by default), each in a fresh browser
 * context with no cache and no service worker, and records per load:
 *
 *   FCP and LCP (ms, what the LCP element was), CLS (the max session window,
 *   the standard), INP (the slowest interaction from a scripted touch scroll
 *   to the bottom of the page, event timing entries with an interaction id),
 *   JS, CSS, image, font and document bytes (what crossed the wire, gzipped
 *   where the server gzips, and decoded), the request count, the chunks that
 *   loaded, long tasks over 50 ms (count, the longest) over the whole load
 *   and during the scroll alone, and dropped frames during the scroll (a
 *   requestAnimationFrame gap longer than two frames counts the frames it
 *   skipped).
 *
 * The median of the runs is the number reported. `--baseline` saves the
 * run as docs/perf/baseline.json and writes docs/PERF.md with one column;
 * a later run reads the baseline and writes both columns side by side with
 * the targets checked against the new column.
 *
 *   DIST=dist PORT=4350 node scripts/mock-server.mjs &      the fixture backed server (the API answers with the fixtures)
 *   node scripts/perf-landing.mjs --baseline                 before the work
 *   node scripts/perf-landing.mjs                            after it
 *   PERF_RUNS=1 PERF_OUT=/tmp/PERF.md PERF_BASELINE=/tmp/b.json node scripts/perf-landing.mjs --baseline
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const PROFILE = {
  viewport: { width: 390, height: 844 },
  cpu: 4,
  net: { offline: false, latency: 150, downloadThroughput: (1.6 * 1000 * 1000) / 8, uploadThroughput: (750 * 1000) / 8 },
  netLabel: 'Slow 4G (1.6 Mbps down, 750 Kbps up, 150 ms latency), CPU 4x slower, 390 x 844 at 3x, touch, no cache, no service worker',
};
export const TARGETS = { lcpMs: 2500, cls: 0.05, scrollLongTaskMs: 200, jsGzKb: 150, jsCutShare: 0.3 };

/* What the page records about itself, installed before any of its own code runs. */
const INSTALL = () => {
  const P = { lcp: [], shifts: [], long: [], events: [], paints: [], scrollStart: null, frames: [] };
  window.__perf = P;
  const obs = (type, fn, extra = {}) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true, ...extra }); } catch { /* an older engine */ } };
  obs('largest-contentful-paint', (e) => P.lcp.push({ t: e.startTime, size: e.size, url: e.url || '', el: e.element ? `${e.element.tagName.toLowerCase()}${e.element.className ? '.' + String(e.element.className).split(' ')[0] : ''}` : '' }));
  obs('layout-shift', (e) => { if (!e.hadRecentInput) P.shifts.push({ t: e.startTime, v: e.value }); });
  obs('longtask', (e) => P.long.push({ t: e.startTime, d: e.duration }));
  obs('paint', (e) => P.paints.push({ name: e.name, t: e.startTime }));
  obs('event', (e) => { if (e.interactionId) P.events.push({ t: e.startTime, d: e.duration, name: e.name }); }, { durationThreshold: 16 });
  /* When each section revealed, so a frame gap can be read against the reveals. */
  P.reveals = [];
  try { new MutationObserver((ms) => { for (const m of ms) if (m.attributeName === 'data-in' && m.target.hasAttribute('data-in')) P.reveals.push({ t: Math.round(performance.now()), label: m.target.getAttribute('aria-label') || m.target.className }); }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-in'] }); } catch { /* fine */ }
  const tick = (t) => { if (P.scrollStart !== null) P.frames.push(t); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};

/* The numbers from one loaded page. */
const COLLECT = ({ scrollEnd }) => {
  const P = window.__perf;
  const lcp = P.lcp[P.lcp.length - 1] || null;
  /* CLS, the standard: session windows of shifts less than a second apart and at most five seconds long; the largest window counts. */
  let cls = 0; let win = 0; let first = 0; let prev = 0;
  for (const s of P.shifts) {
    if (win && s.t - prev < 1000 && s.t - first < 5000) win += s.v; else { win = s.v; first = s.t; }
    prev = s.t; cls = Math.max(cls, win);
  }
  const inp = P.events.length ? Math.max(...P.events.map(e => e.d)) : 0;
  const over50 = P.long.filter(l => l.d > 50);
  const scrollLong = P.long.filter(l => l.d > 50 && l.t >= P.scrollStart && l.t <= scrollEnd);
  const frames = P.frames.filter(t => t <= scrollEnd);
  let dropped = 0; let worstGap = 0; let worstGapAt = 0; const gaps = [];
  for (let i = 1; i < frames.length; i++) { const gap = frames[i] - frames[i - 1]; if (gap > worstGap) { worstGap = gap; worstGapAt = Math.round(frames[i - 1]); } if (gap > 34) { dropped += Math.round(gap / 16.7) - 1; gaps.push(`${Math.round(frames[i - 1])}:${Math.round(gap)}`); } }
  const res = performance.getEntriesByType('resource');
  const nav = performance.getEntriesByType('navigation')[0];
  const kind = (r) => {
    const u = r.name.split('?')[0];
    if (/\.(m?js)$/.test(u) || r.initiatorType === 'script') return 'js';
    if (/\.css$/.test(u) || r.initiatorType === 'css') return 'css';
    if (/\.(woff2?|ttf|otf)$/.test(u)) return 'font';
    if (/\.(png|jpe?g|webp|avif|gif|svg)$/.test(u) || r.initiatorType === 'img' || /res\.cloudinary\.com/.test(u)) return 'img';
    return 'other';
  };
  const bytes = { js: 0, css: 0, font: 0, img: 0, other: 0, jsDecoded: 0, imgDecoded: 0, doc: nav ? nav.transferSize : 0 };
  const chunks = [];
  for (const r of res) {
    const k = kind(r); bytes[k] += r.transferSize || 0;
    if (k === 'js') { bytes.jsDecoded += r.decodedBodySize || 0; chunks.push(r.name.split('/').pop().split('?')[0]); }
    if (k === 'img') bytes.imgDecoded += r.decodedBodySize || 0;
  }
  const fcp = P.paints.find(p => p.name === 'first-contentful-paint')?.t ?? null;
  return {
    fcpMs: fcp === null ? null : Math.round(fcp), lcpMs: lcp ? Math.round(lcp.t) : null, lcpEl: lcp ? `${lcp.el}${lcp.url ? ' ' + lcp.url.split('/').pop().slice(0, 40) : ''}` : '',
    cls: Math.round(cls * 1000) / 1000, inpMs: Math.round(inp),
    jsKb: Math.round(bytes.js / 1024), jsDecodedKb: Math.round(bytes.jsDecoded / 1024), cssKb: Math.round(bytes.css / 1024), fontKb: Math.round(bytes.font / 1024), imgKb: Math.round(bytes.img / 1024), imgDecodedKb: Math.round(bytes.imgDecoded / 1024), docKb: Math.round(bytes.doc / 1024),
    requests: res.length + 1, chunks,
    longTasks: over50.length, longestTaskMs: Math.round(Math.max(0, ...over50.map(l => l.d))),
    scrollLongTasks: scrollLong.length, scrollLongestTaskMs: Math.round(Math.max(0, ...scrollLong.map(l => l.d))),
    droppedFrames: dropped, worstFrameGapMs: Math.round(worstGap), scrollFrames: frames.length, worstGapAt, gaps: gaps.slice(0, 12), reveals: P.reveals.filter(r => r.t >= P.scrollStart).map(r => `${r.t}:${String(r.label).slice(0, 18)}`),
    scrollPx: Math.round(scrollY), docPx: document.documentElement.scrollHeight,
  };
};

/** The median of each numeric metric across the runs; strings and lists from the median LCP run. */
export function summarize(runs) {
  if (!runs.length) return null;
  const med = (xs) => { const a = xs.filter(x => typeof x === 'number' && Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : Math.round(((a[m - 1] + a[m]) / 2) * 1000) / 1000; };
  const out = {};
  for (const k of Object.keys(runs[0])) {
    const v = runs[0][k];
    if (typeof v === 'number' || v === null) out[k] = med(runs.map(r => r[k]));
  }
  const byLcp = [...runs].sort((a, b) => (a.lcpMs ?? 0) - (b.lcpMs ?? 0));
  const mid = byLcp[Math.floor(byLcp.length / 2)];
  out.lcpEl = mid.lcpEl; out.chunks = mid.chunks; out.runs = runs.length;
  return out;
}

const ROWS = [
  ['First contentful paint', 'fcpMs', 'ms'],
  ['Largest contentful paint', 'lcpMs', 'ms'],
  ['LCP element', 'lcpEl', ''],
  ['Cumulative layout shift', 'cls', ''],
  ['INP, the slowest interaction of the scroll', 'inpMs', 'ms'],
  ['JS over the wire (gzipped)', 'jsKb', 'KB'],
  ['JS decoded', 'jsDecodedKb', 'KB'],
  ['CSS over the wire', 'cssKb', 'KB'],
  ['Fonts', 'fontKb', 'KB'],
  ['Images over the wire', 'imgKb', 'KB'],
  ['Document', 'docKb', 'KB'],
  ['Requests', 'requests', ''],
  ['Long tasks over 50 ms (whole load)', 'longTasks', ''],
  ['Longest task (whole load)', 'longestTaskMs', 'ms'],
  ['Long tasks over 50 ms during the scroll', 'scrollLongTasks', ''],
  ['Longest task during the scroll', 'scrollLongestTaskMs', 'ms'],
  ['Dropped frames during the scroll', 'droppedFrames', ''],
  ['Worst frame gap during the scroll', 'worstFrameGapMs', 'ms'],
  ['Frames sampled during the scroll', 'scrollFrames', ''],
  ['Page height', 'docPx', 'px'],
];
const fmt = (v, unit) => (v === null || v === undefined ? 'n/a' : typeof v === 'number' ? `${v}${unit ? ' ' + unit : ''}` : String(v));

/** The targets against a summary (and the baseline for the JS fallback). */
export function checkTargets(s, baseline) {
  const out = [];
  out.push({ name: `LCP under ${TARGETS.lcpMs} ms`, ok: s.lcpMs !== null && s.lcpMs < TARGETS.lcpMs, value: fmt(s.lcpMs, 'ms') });
  out.push({ name: `CLS under ${TARGETS.cls}`, ok: s.cls !== null && s.cls < TARGETS.cls, value: fmt(s.cls, '') });
  out.push({ name: `no long task over ${TARGETS.scrollLongTaskMs} ms during the scroll`, ok: s.scrollLongestTaskMs <= TARGETS.scrollLongTaskMs, value: fmt(s.scrollLongestTaskMs, 'ms') });
  out.push({ name: 'no dropped frames during the scroll', ok: s.droppedFrames === 0, value: fmt(s.droppedFrames, '') });
  const cut = baseline && baseline.jsKb ? 1 - s.jsKb / baseline.jsKb : null;
  out.push({ name: `landing JS under ${TARGETS.jsGzKb} KB gzipped, or ${Math.round(TARGETS.jsCutShare * 100)} percent under the baseline`, ok: s.jsKb < TARGETS.jsGzKb || (cut !== null && cut >= TARGETS.jsCutShare), value: `${fmt(s.jsKb, 'KB')}${cut !== null ? ` (${Math.round(cut * 100)} percent under the baseline's ${baseline.jsKb} KB)` : ''}` });
  return out;
}

/** docs/PERF.md: the profile, one or two columns, the targets. */
export function renderPerf({ baseline, after, page }) {
  const cols = [baseline && ['Baseline', baseline], after && ['After', after]].filter(Boolean);
  const head = `| Metric | ${cols.map(([n, s]) => `${n} (${s.date})`).join(' | ')} |\n|---|${cols.map(() => '---').join('|')}|`;
  const rows = ROWS.map(([label, key, unit]) => `| ${label} | ${cols.map(([, s]) => fmt(s[key], unit)).join(' | ')} |`).join('\n');
  const chunks = cols.map(([n, s]) => `- ${n}: ${(s.chunks || []).join(', ') || 'none recorded'}`).join('\n');
  const latest = after || baseline;
  const targets = checkTargets(latest, after ? baseline : null).map(t => `- ${t.ok ? 'met' : 'missed'}: ${t.name} (${t.value})`).join('\n');
  return `# Landing page performance

Measured by \`scripts/perf-landing.mjs\` against the fixture backed mock server (\`DIST=dist PORT=4350 node scripts/mock-server.mjs\`), so the API answers with the audit fixtures and the images are the fixture SVGs; the real site's photos are larger, the JS, the fonts and the document are the real build. Profile: ${PROFILE.netLabel}. Each column is the median of ${latest.runs} load${latest.runs === 1 ? '' : 's'} of \`${page}\`, each in a fresh context; the scroll is a scripted touch flick to the bottom.

${head}
${rows}

Chunks that loaded:
${chunks}

Targets, against the ${after ? 'After' : 'Baseline'} column:
${targets}
`;
}

async function loadOnce(browser, url) {
  const ctx = await browser.newContext({
    viewport: PROFILE.viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', PROFILE.net);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: PROFILE.cpu });
  await page.addInitScript(INSTALL);
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { window.__perf.scrollStart = performance.now(); window.__perf.frames = []; });
  /* The scroll: one finger flicking up 60 percent of a screen, lifted, repeated until the page stops moving (the mobile trace's drag). */
  const { width, height } = PROFILE.viewport; const drag = Math.round(height * 0.6); const x = Math.round(width / 2); const y0 = Math.round(height * 0.75);
  let stuck = 0; let last = -1;
  for (let i = 0; i < 80; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let s = 1; s <= 12; s++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - (drag * s) / 12) }] }); await new Promise(r => setTimeout(r, 16)); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(600);
    const y = await page.evaluate(() => Math.round(scrollY));
    const done = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
    if (done) break;
    if (y === last) { if (++stuck >= 4) break; } else stuck = 0;
    last = y;
  }
  await page.waitForTimeout(800);
  const scrollEnd = await page.evaluate(() => performance.now());
  const out = await page.evaluate(COLLECT, { scrollEnd });
  await ctx.close();
  return out;
}

export async function measure({ base, pagePath, runs }) {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const all = [];
  try { for (let i = 0; i < runs; i++) all.push(await loadOnce(browser, base + pagePath)); } finally { await browser.close(); }
  return all;
}

async function main() {
  const BASE = process.env.PERF_BASE || 'http://127.0.0.1:4350';
  const PAGE = process.env.PERF_PATH || '/';
  const RUNS = Number(process.env.PERF_RUNS || 3);
  const OUT = process.env.PERF_OUT || 'docs/PERF.md';
  const BASELINE = process.env.PERF_BASELINE || 'docs/perf/baseline.json';
  const isBaseline = process.argv.includes('--baseline');
  const runs = await measure({ base: BASE, pagePath: PAGE, runs: RUNS });
  const summary = { ...summarize(runs), date: new Date().toISOString().slice(0, 10), page: PAGE };
  for (const [i, r] of runs.entries()) console.log(`run ${i + 1}: LCP ${r.lcpMs} ms (${r.lcpEl}), CLS ${r.cls}, INP ${r.inpMs} ms, JS ${r.jsKb} KB gz, img ${r.imgKb} KB, long ${r.longTasks} (max ${r.longestTaskMs} ms), scroll long ${r.scrollLongTasks} (max ${r.scrollLongestTaskMs} ms), dropped ${r.droppedFrames}${process.env.PERF_VERBOSE ? ` gaps ${r.gaps.join(' ')} reveals ${r.reveals.join(' ')}` : ''}`);
  let baseline = null;
  if (isBaseline) {
    fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify(summary, null, 2));
    baseline = summary;
  } else if (fs.existsSync(BASELINE)) baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  /* A "## Notes" section written by hand under the table survives a rerun. */
  const had = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const notes = had.includes('\n## Notes') ? had.slice(had.indexOf('\n## Notes')) : '';
  const md = renderPerf({ baseline, after: isBaseline ? null : summary, page: PAGE }) + notes;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, md);
  console.log(`\n${md}`);
  console.log(`written: ${OUT}${isBaseline ? ` and ${BASELINE}` : ''}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
