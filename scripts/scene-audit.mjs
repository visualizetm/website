#!/usr/bin/env node
/* The scene audit (Site Prompt 11). Scrolls a page in 5 percent increments
 * and captures, at every increment: a screenshot, every stage's rect,
 * whether any content overlaps the navbar, the share of the viewport with
 * nothing in it, and which steps are revealed. Then walks back up and
 * checks the reveal reversed exactly. Fails if:
 *   - a pinned stage is ever not exactly the viewport height
 *   - any content overlaps the navbar
 *   - a step shows before its progress
 *   - a revealed step later hides while its scene is pinned
 *   - the viewport is ever more than 25 percent empty
 *   - two pinned stages are visible at once (Home)
 *   - the footer is unreachable (Home)
 *   - scrolling back does not reverse the reveal
 * "Empty" is the share of the viewport's height with no content box in
 * it; a data-step child counts by its final box whether or not it has
 * revealed (that reserved space is the point of the layout), anything
 * else counts only when visible.
 *
 *   node scripts/scene-audit.mjs                              /scene-test at 390 (touch) and 1280
 *   SCENE_PATH=/ SCENE_WIDTHS=320,390,430,768,1280 node scripts/scene-audit.mjs
 *   SCENE_MOTION=reduce node scripts/scene-audit.mjs          reduced motion: nothing pinned, everything shown, no engine
 *   SCENE_OUT=/tmp/strips node scripts/scene-audit.mjs        where the screenshots and the strip go
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.SCENE_BASE || 'http://127.0.0.1:4350';
const PATH = process.env.SCENE_PATH || '/scene-test';
const WIDTHS = (process.env.SCENE_WIDTHS || '390,1280').split(',').map(Number);
const REDUCE = process.env.SCENE_MOTION === 'reduce';
const OUT = process.env.SCENE_OUT || path.join(process.cwd(), '.tmp-verify', 'scene-audit');
const STEP_PCT = Number(process.env.SCENE_STEP || 5);
const MAX_EMPTY = 0.25;
const HEIGHTS = { 320: 640, 390: 844, 430: 932, 768: 1024, 1280: 800 };
const isHome = PATH === '/';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let failures = 0;
const summaries = [];

const SAMPLE = () => {
  const vh = innerHeight;
  const nav = document.querySelector('.navbar');
  const navRect = nav ? nav.getBoundingClientRect() : null;
  const visible = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const inStep = (el) => !!el.closest('[data-step]');
  const scenes = [...document.querySelectorAll('.m-scene')].map((root, i) => {
    const stage = root.querySelector(':scope > .m-scene-stage');
    const r = stage.getBoundingClientRect();
    const steps = Number(root.style.getPropertyValue('--scene-steps')) || 0;
    const pinned = root.classList.contains('m-scene--pinned');
    const p = root.style.getPropertyValue('--scene-p');
    const reveal = {};
    for (const el of root.querySelectorAll('[data-step]')) {
      const n = Number(el.getAttribute('data-step')) || 0;
      if (!n) continue;
      const sr = pinned ? Number(getComputedStyle(el).getPropertyValue('--sr')) : Number(getComputedStyle(el).opacity);
      reveal[n] = Math.max(reveal[n] || 0, Number.isFinite(sr) ? sr : 1);
    }
    const body = stage.querySelector(':scope > .m-scene-body');
    const fits = !pinned || !body || body.scrollHeight <= body.clientHeight + 2;
    return { i, label: stage.getAttribute('aria-label') || '', steps, pinned, p: p === '' ? null : Number(p), top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), onScreen: r.bottom > 0 && r.top < vh, reveal, fits, bodyH: body ? body.scrollHeight : 0, bodyBox: body ? body.clientHeight : 0 };
  });
  // Content boxes for the empty measure and the navbar overlap.
  const N = 40; const bands = new Array(N).fill(false); const bh = vh / N;
  let overlap = null;
  // The navbar is on screen too: its rows are not empty.
  if (navRect) { const from = Math.max(0, Math.floor(navRect.top / bh)), to = Math.min(N - 1, Math.floor((navRect.bottom - 1) / bh)); for (let k = from; k <= to; k++) bands[k] = true; }
  const sel = 'h1,h2,h3,p,li,a,button,img,[data-step],.hero-card,.tc-card,.pf-pill,.trust-logo,footer *';
  for (const el of document.querySelectorAll(sel)) {
    if (el.closest('.navbar')) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > vh) continue;
    const reserved = inStep(el) && !!el.closest('.m-scene--pinned');
    if (!reserved) {
      let hidden = +getComputedStyle(el).opacity < 0.08; let a = el.parentElement;
      while (!hidden && a && a !== document.body) { if (+getComputedStyle(a).opacity < 0.08) hidden = true; a = a.parentElement; }
      if (hidden) continue;
    }
    const from = Math.max(0, Math.floor(r.top / bh)), to = Math.min(N - 1, Math.floor((r.bottom - 1) / bh));
    for (let k = from; k <= to; k++) bands[k] = true;
    /* Overlap: content a HELD stage keeps under the navbar. A normal
       section's text passing under the sticky navbar as the page scrolls
       is how every page works; a stage stuck at the top with its content
       under the pill is the failure. */
    if (navRect && !overlap && !el.closest('.m-scene-backdrop') && r.top < navRect.bottom - 6 && r.bottom > navRect.top + 2 && r.left < navRect.right && r.right > navRect.left) {
      const stage = el.closest('.m-scene--pinned > .m-scene-stage');
      const sr = stage?.getBoundingClientRect();
      const held = sr && Math.abs(sr.top) < 2 && sr.height >= vh - 2;
      if (held && +getComputedStyle(el).opacity >= 0.08) overlap = `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]} "${(el.textContent || '').trim().slice(0, 30)}" top ${Math.round(r.top)} under navbar bottom ${Math.round(navRect.bottom)}`;
    }
  }
  const footer = document.querySelector('footer'); const fr = footer?.getBoundingClientRect();
  return { y: Math.round(scrollY), vh, docH: document.documentElement.scrollHeight, empty: bands.filter(b => !b).length / N, overlap, scenes, footerVisible: !!fr && fr.top < vh && fr.bottom > 0, engine: !!performance.getEntriesByType('resource').find(e => /gsap/.test(e.name)) };
};

async function walk(width) {
  const height = HEIGHTS[width] || 844;
  const touch = width < 500;
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1, reducedMotion: REDUCE ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await page.addInitScript((reduce) => { try { localStorage.setItem('vz_theme', 'dark'); if (reduce) localStorage.setItem('vz_motion', 'reduce'); else localStorage.removeItem('vz_motion'); } catch {} }, REDUCE);
  await page.goto(BASE + PATH, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const settle = touch ? 750 : 1100;  // the scrub catches up over half a second on touch; Lenis smooths a jump over a second on a desktop
  const label = `${width}x${height}${REDUCE ? ' reduce' : ''}`;
  const dir = path.join(OUT, label.replace(/[^a-z0-9]+/gi, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const bad = [];
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const positions = []; for (let f = 0; f <= 100; f += STEP_PCT) positions.push(Math.round((f / 100) * max));
  const forward = [];
  const maxSeen = {};   // `${scene}:${step}` -> highest reveal seen while that scene was pinned
  for (const [k, y] of positions.entries()) {
    await page.evaluate((v) => window.scrollTo(0, v), y); await page.waitForTimeout(settle);
    const s = await page.evaluate(SAMPLE);
    forward.push(s);
    const shot = path.join(dir, `${String(k).padStart(2, '0')}-${Math.round((y / Math.max(1, max)) * 100)}pct.png`);
    await page.screenshot({ path: shot });
    const at = `${Math.round((y / Math.max(1, max)) * 100)}% (y=${s.y})`;
    if (s.empty > MAX_EMPTY) bad.push(`${at}: viewport ${Math.round(s.empty * 100)}% empty (on screen: ${s.scenes.filter(sc => sc.onScreen).map(sc => `${sc.label} ${sc.top}..${sc.bottom}`).join('; ')})`);
    if (s.overlap) bad.push(`${at}: content overlaps the navbar: ${s.overlap}`);
    let pinnedOnScreen = 0;
    for (const sc of s.scenes) {
      const held = sc.pinned && sc.p !== null && sc.p > 0.001 && sc.p < sc.steps - 0.001;
      if (sc.pinned && sc.onScreen && sc.top <= 0 && sc.bottom >= s.vh - 1) pinnedOnScreen++;
      if (held && Math.abs(sc.height - s.vh) > 1) bad.push(`${at}: scene ${sc.i} "${sc.label}" stage is ${sc.height}px while pinned, viewport ${s.vh}`);
      if (sc.pinned && !sc.fits) bad.push(`scene ${sc.i} "${sc.label}": content (${sc.bodyH}px) does not fit its stage (${sc.bodyBox}px)`);
      if (sc.pinned && sc.p !== null) {
        for (const [n, sr] of Object.entries(sc.reveal)) {
          const key = `${sc.i}:${n}`;
          if (sr > 0.02 && sc.p < Number(n) - 1 - 0.01) bad.push(`${at}: scene ${sc.i} step ${n} visible (${sr.toFixed(2)}) at progress ${sc.p.toFixed(2)}`);
          if (held && maxSeen[key] !== undefined && sr < maxSeen[key] - 0.05) bad.push(`${at}: scene ${sc.i} step ${n} hid (${sr.toFixed(2)} after ${maxSeen[key].toFixed(2)}) while pinned`);
          if (held) maxSeen[key] = Math.max(maxSeen[key] || 0, sr);
        }
      }
      if (REDUCE && sc.pinned) bad.push(`${at}: scene ${sc.i} is pinned under reduced motion`);
      if (REDUCE) for (const [n, sr] of Object.entries(sc.reveal)) if (sr < 0.99) bad.push(`${at}: scene ${sc.i} step ${n} not fully shown under reduced motion (${sr.toFixed(2)})`);
    }
    if (isHome && pinnedOnScreen > 1) bad.push(`${at}: two pinned stages fill the viewport at once`);
  }
  const last = forward[forward.length - 1];
  if (isHome && !last.footerVisible) bad.push('footer not reachable at the bottom');
  if (REDUCE && last.engine) bad.push('the engine chunk was fetched under reduced motion');
  // Back up: the reveal at each position must match the way down.
  let reverseMismatch = 0;
  for (let k = positions.length - 1; k >= 0; k--) {
    await page.evaluate((v) => window.scrollTo(0, v), positions[k]); await page.waitForTimeout(settle);
    const s = await page.evaluate(SAMPLE);
    for (const sc of s.scenes) {
      const f = forward[k].scenes[sc.i]; if (!f || !sc.pinned) continue;
      for (const [n, sr] of Object.entries(sc.reveal)) if (Math.abs(sr - (f.reveal[n] ?? 1)) > 0.06) reverseMismatch++;
    }
  }
  if (reverseMismatch) bad.push(`scrolling back did not reverse the reveal at ${reverseMismatch} scene/step/position(s)`);
  if (errs.length) bad.push(`page errors: ${errs.join(' | ')}`);
  const uniq = [...new Set(bad)];
  if (uniq.length) failures++;
  const worst = Math.max(...forward.map(s => s.empty));
  summaries.push({ label, screens: (last.docH / last.vh).toFixed(1), worstEmpty: Math.round(worst * 100), samples: forward.length, bad: uniq, dir });
  console.log(`${uniq.length ? 'FAIL' : 'ok  '} ${label}: ${forward.length} positions, ${(last.docH / last.vh).toFixed(1)} screens, worst empty ${Math.round(worst * 100)}%${REDUCE ? `, pinned ${forward.some(s => s.scenes.some(sc => sc.pinned)) ? 'yes' : 'none'}, engine ${last.engine ? 'fetched' : 'not fetched'}` : ''}`);
  for (const b of uniq.slice(0, 25)) console.log('     ' + b);
  if (uniq.length > 25) console.log(`     ... and ${uniq.length - 25} more`);
  await ctx.close();
  // The strip: every screenshot in order, on one page.
  const shots = fs.readdirSync(dir).filter(f => f.endsWith('.png') && /^\d\d-/.test(f)).sort();
  const cols = width < 500 ? 7 : 4; const w = width < 500 ? 180 : 320;
  const uri = (f) => `data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}`;
  const html = `<html><body style="margin:0;background:#fff;font:11px system-ui;color:#333"><div style="padding:8px">${label}: ${shots.length} positions, top to bottom</div><div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:8px">${shots.map(f => `<figure style="margin:0"><img src="${uri(f)}" style="width:${w}px;display:block;border:1px solid #ccc"><figcaption>${f.replace('.png', '')}</figcaption></figure>`).join('')}</div></body></html>`;
  const strip = path.join(OUT, `strip-${label.replace(/[^a-z0-9]+/gi, '-')}.png`);
  const sctx = await browser.newContext({ viewport: { width: cols * (w + 6) + 16, height: 800 } });
  const sp = await sctx.newPage(); await sp.setContent(html); await sp.waitForTimeout(300);
  await sp.screenshot({ path: strip, fullPage: true }); await sctx.close();
  console.log(`     strip: ${strip}`);
}

for (const w of WIDTHS) await walk(w);
await browser.close();
console.log(`\n| Profile | Positions | Screens | Worst empty | Result |\n|---|---|---|---|---|`);
for (const s of summaries) console.log(`| ${s.label} | ${s.samples} | ${s.screens} | ${s.worstEmpty}% | ${s.bad.length ? s.bad.length + ' failure(s)' : 'clean'} |`);
console.log(failures ? `\n${failures} profile(s) failed.` : '\nEvery profile is clean.');
process.exit(failures ? 1 : 0);
