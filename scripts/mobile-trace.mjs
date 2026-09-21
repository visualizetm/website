#!/usr/bin/env node
/* The phone walk (Site Prompt 9, Part 5): Home top to bottom on a touch
 * profile, scrolled with real CDP touch drags (Input.dispatchTouchEvent:
 * touchStart, touchMove, touchEnd, with the fling that follows), never
 * window.scrollTo, the CPU throttled 4x.
 *
 * Reports, per width: the document height in screens, the longest single
 * section in screens, frames where the scroll position moved backwards,
 * whether the footer was reached, the long task count, and page errors.
 * A section over 2.5 screens, a backwards frame, or an unreachable footer
 * is a failure.
 *
 *   node scripts/mobile-trace.mjs                       390, 320, 430, then 390 with reduce motion
 *   TRACE_WIDTHS=390 node scripts/mobile-trace.mjs      one width
 *   TRACE_WIDTHS=320 TRACE_HEIGHT=640 node scripts/mobile-trace.mjs   a taller 320 phone (568 is the default there)
 *   TRACE_BASE=http://127.0.0.1:4350 TRACE_PATH=/       where to look (defaults shown)
 */
import { chromium } from 'playwright-core';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.TRACE_BASE || 'http://127.0.0.1:4350';
const PATH = process.env.TRACE_PATH || '/';
const WIDTHS = (process.env.TRACE_WIDTHS || '390,320,430').split(',').map(Number);
const HEIGHTS = { 320: 568, 390: 844, 430: 932 };
const MAX_SECTION = 2.5;

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let failures = 0;
const rows = [];

async function walk(width, reduced) {
  const height = Number(process.env.TRACE_HEIGHT) || HEIGHTS[width] || 844;
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    reducedMotion: reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.TRACE_CPU || 4) });
  await page.addInitScript(() => {
    window.__long = []; window.__samples = []; window.__engine = { gsap: false, lenis: false };
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); } catch {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (/gsap/.test(e.name)) window.__engine.gsap = true; if (/lenis/.test(e.name)) window.__engine.lenis = true; } }).observe({ type: 'resource', buffered: true }); } catch {}
    const sample = () => { window.__samples.push([Math.round(scrollY), Math.round(document.documentElement.scrollHeight)]); requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
  });
  await page.goto(BASE + PATH, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__long.length = 0; window.__samples.length = 0; });

  /* One finger, dragging up 60 percent of a screen over a fifth of a
   * second, then lifting, so the page gets the fling a real flick gives
   * it (Input.dispatchTouchEvent; synthesizeScrollGesture is a no-op in
   * headless Chromium). Repeated until the page stops moving. */
  const drag = Math.round(height * 0.6);
  const x = Math.round(width / 2); const y0 = Math.round(height * 0.75);
  const touchDrag = async () => {
    const steps = 12;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: Math.round(y0 - (drag * i) / steps) }] });
      await new Promise(r => setTimeout(r, 16));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  let stuck = 0; let last = -1;
  for (let i = 0; i < 400; i++) {
    await touchDrag();
    await page.waitForTimeout(700);
    const y = await page.evaluate(() => Math.round(scrollY));
    const done = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
    if (done) break;
    if (y === last) { if (++stuck >= 4) break; } else stuck = 0;
    last = y;
  }
  await page.waitForTimeout(800);

  const out = await page.evaluate(({ maxSection }) => {
    const s = window.__samples;
    let back = 0; let worstBack = 0; const backAt = [];
    for (let i = 1; i < s.length; i++) { const d = s[i][0] - s[i - 1][0]; if (d < -2) { back++; worstBack = Math.min(worstBack, d); if (backAt.length < 6) backAt.push(`${s[i - 1][0]}:${d}`); } }
    const footer = document.querySelector('footer'); const fr = footer?.getBoundingClientRect();
    const root = document.querySelector('.page-shell') || document.body;
    const els = [...root.querySelectorAll('section, .m-scene')];
    const sections = els.filter(el => !els.some(o => o !== el && el.contains(o)))
      .map(el => ({ name: (el.querySelector('h1,h2')?.textContent || el.className).trim().slice(0, 34), vhs: Math.round((el.getBoundingClientRect().height / innerHeight) * 10) / 10 }))
      .filter(x => x.vhs > 0.05).sort((a, b) => b.vhs - a.vhs);
    return {
      frames: s.length, backwardsFrames: back, worstBackwards: worstBack, backAt,
      docHeightVh: Math.round((document.documentElement.scrollHeight / innerHeight) * 10) / 10,
      footerReachable: !!fr && fr.top < innerHeight && fr.bottom > 0,
      longTasks: window.__long.length, longTaskMs: window.__long.reduce((a, x) => a + x, 0), worstLongTask: Math.max(0, ...window.__long),
      longest: sections[0], over: sections.filter(x => x.vhs > maxSection), sections: sections.slice(0, 5),
      pinned: document.querySelectorAll('.m-pin--active, .m-track--h').length,
      hidden: [...document.querySelectorAll('.m-reveal:not(.m-reveal--visible), .m-scalein:not(.m-scalein--in)')].length,
      engine: window.__engine,
    };
  }, { maxSection: MAX_SECTION });
  await ctx.close();

  const label = `${width}x${height}${reduced ? ' reduce' : ''}`;
  const bad = [];
  if (out.backwardsFrames) bad.push(`${out.backwardsFrames} backwards frame(s), worst ${out.worstBackwards}px at ${out.backAt.join(' ')}`);
  if (!out.footerReachable) bad.push('footer not reached');
  if (out.over.length) bad.push(`over ${MAX_SECTION} screens: ${out.over.map(x => `${x.name} ${x.vhs}`).join(', ')}`);
  if (errs.length) bad.push(`page errors: ${errs.join(' | ')}`);
  if (reduced && (out.pinned || out.hidden)) bad.push(`reduce motion: ${out.pinned} pinned, ${out.hidden} hidden`);
  if (reduced && out.engine.gsap) bad.push('reduce motion: the engine chunk was fetched');
  if (bad.length) failures++;
  rows.push({ label, ...out, bad });
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${label}: ${out.docHeightVh} screens, longest ${out.longest?.name} ${out.longest?.vhs}, backwards ${out.backwardsFrames}, footer ${out.footerReachable ? 'reached' : 'NOT reached'}, long tasks ${out.longTasks} (${out.longTaskMs}ms, worst ${out.worstLongTask}ms), ${out.frames} frames${reduced ? `, pinned ${out.pinned}, hidden ${out.hidden}, engine ${out.engine.gsap ? 'fetched' : 'not fetched'}` : ''}`);
  console.log(`     sections: ${out.sections.map(x => `${x.name} ${x.vhs}`).join(' | ')}`);
  for (const b of bad) console.log('     ' + b);
}

for (const w of WIDTHS) await walk(w, false);
await walk(WIDTHS[0], true);
await browser.close();
console.log(`\n| Profile | Screens | Longest section | Backwards frames | Footer | Long tasks |\n|---|---|---|---|---|---|`);
for (const r of rows) console.log(`| ${r.label} | ${r.docHeightVh} | ${r.longest?.name} (${r.longest?.vhs}) | ${r.backwardsFrames} | ${r.footerReachable ? 'reached' : 'not reached'} | ${r.longTasks} (${r.longTaskMs}ms) |`);
console.log(failures ? `\n${failures} profile(s) failed.` : '\nEvery profile passes.');
process.exit(failures ? 1 : 0);
