#!/usr/bin/env node
/* The scroll audit (Site Prompt 11, rebuilt in Site Prompt 12 after real
 * phone screenshots, rebuilt again by the faster landing prompt when the
 * scene engine was retired). Scrolls a page in 5 percent increments and
 * captures, at every increment: a screenshot, every revealing section's
 * rect and state, and what a person would see. Then walks back up and
 * checks that nothing which had revealed hides again.
 *
 * Phone profiles are the viewport a phone actually shows, with Safari's
 * bars on screen (390x720, 320x500, 430x800), not the full screen.
 *
 * The page's rules (docs/SCENE-ENGINE.md, "The reveal"): native scroll,
 * nothing pinned, every section reveals once as one piece when about a
 * fifth of a screen of it has entered, done inside 800ms, and never hides
 * again; reduced motion shows everything with no movement; the landing
 * never loads the animation engine.
 *
 * Fails if:
 *   - anything is pinned (a .m-scene--pinned stage), or a sticky element
 *     travels more than one viewport inside its parent, except a spotlight
 *     chapter's logo panel (.pj-spot-panel), whose chapter must then be
 *     under three viewports tall
 *   - a section (.m-rv) that has entered the observer's band (its top above
 *     85 percent of the viewport, its bottom on screen) is not revealed a
 *     settle after the scroll
 *   - a revealed section still has a piece mid-fade a settle after the
 *     scroll (the whole section is done inside 800ms)
 *   - on the way back up, a section that was revealed on the way down is
 *     not revealed any more (reveal once)
 *   - two visible text elements overlap by more than 4px with no opaque
 *     element between them; a single word broken across lines
 *   - under reduced motion, a section is not fully shown (opacity 1, no
 *     transform) or the engine chunk was fetched
 *   - on Home, the gsap chunk was fetched at all, or the footer is unreachable
 *   - a page error
 *
 * The whole-viewport empty share (painted rows within 8 units of a surface
 * colour) is reported, not judged.
 *
 *   node scripts/scene-audit.mjs                              Home at 390 (touch) and 1280
 *   SCENE_PATH=/projects SCENE_WIDTHS=320,390,430,768,1280 node scripts/scene-audit.mjs
 *   SCENE_HEIGHTS=390:844 node scripts/scene-audit.mjs        override a width's height (the full-screen phone)
 *   SCENE_MOTION=reduce node scripts/scene-audit.mjs          reduced motion: everything shown, no engine
 *   SCENE_OUT=/tmp/strips node scripts/scene-audit.mjs        where the screenshots and the strip go
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.SCENE_BASE || 'http://127.0.0.1:4350';
const PATH = process.env.SCENE_PATH || '/';
const WIDTHS = (process.env.SCENE_WIDTHS || '390,1280').split(',').map(Number);
const REDUCE = process.env.SCENE_MOTION === 'reduce';
const OUT = process.env.SCENE_OUT || path.join(process.cwd(), '.tmp-verify', 'scene-audit');
const STEP_PCT = Number(process.env.SCENE_STEP || 5);
const HEIGHTS = { 320: 500, 390: 720, 430: 800, 768: 1024, 1280: 800 };
for (const pair of (process.env.SCENE_HEIGHTS || '').split(',').filter(Boolean)) { const [w, h] = pair.split(':').map(Number); if (w && h) HEIGHTS[w] = h; }
const SPOT_MAX_VH = 3;    // a spotlight chapter with a sticky panel stays under three screens
const isHome = PATH === '/';
const isConcepts = PATH.startsWith('/concepts/');

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let failures = 0;
const summaries = [];

const SAMPLE = () => {
  const vh = innerHeight; const vw = innerWidth;
  const nav = document.querySelector('.navbar');
  const navRect = nav ? nav.getBoundingClientRect() : null;
  const visible = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const alpha = (el) => { let o = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= +cs.opacity; } return o; };
  const identity = (t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)';
  const secs = [...document.querySelectorAll('.m-rv')].map((el, i) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const label = el.getAttribute('aria-label') || (el.querySelector('h1, h2, h3')?.textContent || el.className).trim().slice(0, 40);
    const steps = [...el.querySelectorAll('[data-step]')].map(c => ({ n: c.getAttribute('data-step'), o: +getComputedStyle(c).opacity, t: getComputedStyle(c).transform }));
    return { i, label, top: Math.round(r.top), bottom: Math.round(r.bottom), in: el.hasAttribute('data-in'), opacity: +cs.opacity, still: identity(cs.transform), steps, due: r.bottom > 0 && r.top < vh * 0.85 && r.height > 0, /* the observer's band: a 15 percent margin at the bottom */ onScreen: r.bottom > 0 && r.top < vh };
  });
  const pinned = document.querySelectorAll('.m-scene--pinned').length;
  const sticky = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.navbar')) continue;
    if (getComputedStyle(el).position !== 'sticky') continue;
    const parent = el.parentElement; const pr = parent.getBoundingClientRect(); const er = el.getBoundingClientRect();
    const chapter = el.closest('.pj-spot');
    sticky.push({ name: `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]}`, travel: Math.round(pr.height - er.height), panel: el.classList.contains('pj-spot-panel'), chapterH: chapter ? Math.round(chapter.getBoundingClientRect().height) : null });
  }
  /* Text overlap across the page, and single words broken across lines. Leaves: elements with their own text. */
  const leaves = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.navbar')) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const box = el.tagName === 'IMG' || /(^|\s)btn(\s|$)/.test(String(el.className || ''));
    if (!own && !box) continue;
    if (!visible(el)) continue;
    const a = alpha(el); if (a < 0.05) continue;
    if (el.closest('.navbar-drawer, [inert]')) continue;
    const q = el.getBoundingClientRect();
    if (q.width < 2 || q.height < 2 || q.bottom < 0 || q.top > vh || q.right < 0 || q.left > vw) continue;
    const name = `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]} "${(el.textContent || el.getAttribute('alt') || '').trim().slice(0, 28)}"`;
    if (own) {
      const cs = getComputedStyle(el);
      const text = (el.textContent || '').trim();
      const oneWord = !/\s/.test(text) && text.length <= 12 && cs.whiteSpace !== 'nowrap';
      leaves.push({ el, q, a, name, oneWord, fontPx: parseFloat(cs.fontSize) || 16 });
    }
  }
  const overlaps = []; const wrapped = [];
  const opaque = (el) => { const bg = getComputedStyle(el).backgroundColor; const m = bg.match(/rgba?\(([^)]+)\)/); if (!m) return false; const parts = m[1].split(',').map(Number); return parts.length < 4 || parts[3] >= 0.95; };
  for (const L of leaves) {
    if (!L.oneWord) continue;
    const tops = new Set();
    for (const node of L.el.childNodes) { if (node.nodeType !== 3 || !node.textContent.trim()) continue; const range = document.createRange(); range.selectNodeContents(node); for (const r of range.getClientRects()) if (r.width > 1) tops.add(Math.round(r.top)); }
    if (tops.size > 1) wrapped.push(`${L.name} breaks across ${tops.size} lines at ${Math.round(L.fontPx)}px: a single word wrapped`);
  }
  for (let i = 0; i < leaves.length && overlaps.length < 12; i++) for (let j = i + 1; j < leaves.length && overlaps.length < 12; j++) {
    const A = leaves[i], B = leaves[j];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
    const x0 = Math.max(A.q.left, B.q.left), x1 = Math.min(A.q.right, B.q.right), y0 = Math.max(A.q.top, B.q.top), y1 = Math.min(A.q.bottom, B.q.bottom);
    if (x1 - x0 <= 4 || y1 - y0 <= 4) continue;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue;
    const stack = document.elementsFromPoint(cx, cy);
    const ia = stack.findIndex(e => e === A.el || A.el.contains(e)), ib = stack.findIndex(e => e === B.el || B.el.contains(e));
    if (ia < 0 || ib < 0) continue;
    const lo = Math.min(ia, ib), hi = Math.max(ia, ib);
    let hidden = false;
    for (let k = lo + 1; k < hi; k++) { const e = stack[k]; if (e === A.el || e === B.el || A.el.contains(e) || B.el.contains(e)) continue; if (opaque(e) && alpha(e) >= 0.95) { hidden = true; break; } }
    if (hidden) continue;
    overlaps.push(`${A.name} (alpha ${A.a.toFixed(2)}) and ${B.name} (alpha ${B.a.toFixed(2)}) overlap ${Math.round(x1 - x0)}x${Math.round(y1 - y0)}px`);
  }
  const footer = document.querySelector('footer'); const fr = footer?.getBoundingClientRect();
  const tok = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const res = performance.getEntriesByType('resource').map(r => r.name);
  return { y: Math.round(scrollY), vh, vw, docH: document.documentElement.scrollHeight, overlaps, wrapped, secs, pinned, sticky, navBottom: navRect ? Math.round(navRect.bottom) : 0, surfaces: [tok('--bg'), tok('--bg-elevated'), tok('--bg-card'), tok('--bg-deep')].filter(Boolean), footerVisible: !!fr && fr.top < vh && fr.bottom > 0, engine: res.some(n => /gsap/.test(n)), lenis: res.some(n => /lenis/.test(n)) };
};

/* The concepts page (Concepts review job) has no sections of this kind: each direction is one section that reveals as one unit. What the gate checks there,
   a moment after every scroll, before the 240ms fade has finished: a section with any part on screen is already revealed (nothing waits for
   scroll), no piece inside a section animates on its own, no element inside a section carries a step or its own reveal, and under reduced
   motion every section is fully opaque and untransformed everywhere. */
const CONCEPTS_QUICK = (reduce) => {
  const vh = innerHeight; const out = [];
  const secs = [...document.querySelectorAll('.cp-sec')];
  if (!secs.length) out.push('no .cp-sec section found on the concepts page');
  secs.forEach((el, i) => {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    const on = r.bottom > 0 && r.top < vh;
    const name = `section ${i + 1} "${(el.querySelector('h2')?.textContent || '').trim().slice(0, 30)}"`;
    if (on && !el.classList.contains('is-in') && !reduce) out.push(`${name} is on screen but not revealed yet`);
    if (reduce && (+cs.opacity < 0.99 || (cs.transform !== 'none' && cs.transform !== 'matrix(1, 0, 0, 1, 0, 0)'))) out.push(`${name} is not fully shown under reduced motion (opacity ${cs.opacity}, transform ${cs.transform})`);
    const own = typeof el.getAnimations === 'function' ? el.getAnimations({ subtree: true }).filter(a => a.effect && a.effect.target !== el && a.playState === 'running') : [];
    if (own.length) out.push(`${name}: ${own.length} piece(s) inside it animate on their own`);
    if (el.querySelector('[data-step], .m-reveal, [data-reveal]')) out.push(`${name} has a piece with its own step or reveal`);
  });
  return out;
};
const CONCEPTS_BAR = () => {
  const bar = document.querySelector('.cp-bar'); if (!bar) return [];
  const top = bar.getBoundingClientRect().top; const out = [];
  const last = [...document.querySelectorAll('.cp-sec')].filter(e => e.querySelector('.cp-rv-btn')).pop();
  const targets = [...(last ? last.querySelectorAll('.cp-rv-btn, .cp-link-btn, textarea') : []), ...document.querySelectorAll('.cpc-mail')];
  for (const t of targets) { const q = t.getBoundingClientRect(); if (q.height && q.bottom > top + 1 && q.top < innerHeight) out.push(`${(t.textContent || t.tagName).trim().slice(0, 24)} sits under the progress bar at the end of the page`); }
  return out;
};

/* Painted rows: decode the screenshot in the page and scan every CSS pixel row. A row is empty when more than 90 percent of its pixels are within 8 units of a surface colour. */
const ROWS = async (page, png, surfaces) => page.evaluate(async ({ b64, surfaces }) => {
  const hex = (h) => { const m = h.replace('#', ''); const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m; return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)); };
  const cols = surfaces.map(hex);
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const sx = c.width / innerWidth, sy = c.height / innerHeight;
  const empty = [];
  for (let y = 0; y < innerHeight; y++) {
    const row = Math.min(c.height - 1, Math.floor((y + 0.5) * sy));
    let hit = 0; let n = 0;
    for (let x = 0; x < innerWidth; x += 2) {
      const i = (row * c.width + Math.min(c.width - 1, Math.floor((x + 0.5) * sx))) * 4; n++;
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      if (cols.some(([cr, cg, cb]) => Math.abs(r - cr) <= 8 && Math.abs(gg - cg) <= 8 && Math.abs(b - cb) <= 8)) hit++;
    }
    empty.push(hit / n > 0.9);
  }
  return empty;
}, { b64: png.toString('base64'), surfaces });
const countRun = (rows, a, b) => { let n = 0; for (let y = Math.max(0, a); y < Math.min(rows.length, b); y++) if (rows[y]) n++; return n; };

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
  const settle = 1100;  // a section is done inside 800ms of its reveal; the observer's own callback adds a frame or two
  const label = `${width}x${height}${REDUCE ? ' reduce' : ''}`;
  const dir = path.join(OUT, label.replace(/[^a-z0-9]+/gi, '-'));
  fs.mkdirSync(dir, { recursive: true });
  const bad = [];
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const positions = []; for (let f = 0; f <= 100; f += STEP_PCT) positions.push(Math.round((f / 100) * max));
  const forward = [];
  for (const [k, y] of positions.entries()) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    if (isConcepts) {
      await page.waitForTimeout(130);
      for (const m of await page.evaluate(CONCEPTS_QUICK, REDUCE)) bad.push(`${Math.round((y / Math.max(1, max)) * 100)}%: ${m}`);
      await page.waitForTimeout(Math.max(0, settle - 130));
      if (k === positions.length - 1) for (const m of await page.evaluate(CONCEPTS_BAR)) bad.push(`end of page: ${m}`);
    } else await page.waitForTimeout(settle);
    const s = await page.evaluate(SAMPLE);
    forward.push(s);
    const shot = path.join(dir, `${String(k).padStart(2, '0')}-${Math.round((y / Math.max(1, max)) * 100)}pct.png`);
    const png = await page.screenshot({ path: shot });
    const rows = await ROWS(page, png, s.surfaces);
    s.empty = countRun(rows, 0, s.vh) / s.vh;
    const at = `${Math.round((y / Math.max(1, max)) * 100)}% (y=${s.y})`;
    if (s.pinned) bad.push(`${at}: ${s.pinned} pinned stage(s) on the page`);
    for (const st of s.sticky) {
      if (st.travel <= s.vh + 2) continue;
      if (st.panel) { if (st.chapterH !== null && st.chapterH >= SPOT_MAX_VH * s.vh) bad.push(`${at}: ${st.name} is sticky inside a chapter ${st.chapterH}px tall (${(st.chapterH / s.vh).toFixed(1)} screens, limit ${SPOT_MAX_VH})`); }
      else bad.push(`${at}: ${st.name} is sticky over ${st.travel}px of scroll, more than one screen (${s.vh}px)`);
    }
    for (const sc of s.secs) {
      const name = `section ${sc.i} "${sc.label}"`;
      if (sc.due && !sc.in) bad.push(`${at}: ${name} has entered (top ${sc.top} of ${s.vh}) but is not revealed`);
      if (sc.in && sc.onScreen) {
        if (sc.opacity < 0.98 || !sc.still) bad.push(`${at}: ${name} revealed but still mid-fade a settle later (opacity ${sc.opacity.toFixed(2)})`);
        const slow = sc.steps.filter(st => st.o < 0.98);
        if (slow.length) bad.push(`${at}: ${name} revealed but ${slow.length} piece(s) still mid-fade a settle later (step ${slow[0].n} at ${slow[0].o.toFixed(2)}): a section must be done inside 800ms`);
      }
      if (REDUCE && (!sc.in || sc.opacity < 0.99 || !sc.still || sc.steps.some(st => st.o < 0.99))) bad.push(`${at}: ${name} is not fully shown under reduced motion`);
    }
    for (const o of s.overlaps) bad.push(`${at}: text overlap: ${o}`);
    for (const w of s.wrapped) bad.push(`${at}: ${w}`);
  }
  const last = forward[forward.length - 1];
  if (isHome && !last.footerVisible) bad.push('footer not reachable at the bottom');
  if (REDUCE && last.engine) bad.push('the engine chunk was fetched under reduced motion');
  if (isHome && last.engine) bad.push('the gsap chunk was fetched on the landing page: the hero must not wait on animation code');
  if (last.lenis) bad.push('a lenis chunk was fetched: no smooth scroll library');
  // Back up: a section revealed on the way down stays revealed (reveal once).
  let hid = 0;
  for (let k = positions.length - 1; k >= 0; k--) {
    await page.evaluate((v) => window.scrollTo(0, v), positions[k]); await page.waitForTimeout(settle);
    const s = await page.evaluate(SAMPLE);
    for (const sc of s.secs) { const f = forward[k].secs[sc.i]; if (f && f.in && !sc.in) hid++; }
  }
  if (hid) bad.push(`scrolling back hid a revealed section at ${hid} section/position(s): a reveal happens once`);
  if (errs.length) bad.push(`page errors: ${errs.join(' | ')}`);
  const uniq = [...new Set(bad)];
  if (uniq.length) failures++;
  const worst = Math.max(...forward.map(s => s.empty));
  const secCount = last.secs.length;
  summaries.push({ label, screens: (last.docH / last.vh).toFixed(1), worstEmpty: Math.round(worst * 100), samples: forward.length, sections: secCount, bad: uniq, dir });
  console.log(`${uniq.length ? 'FAIL' : 'ok  '} ${label}: ${forward.length} positions, ${(last.docH / last.vh).toFixed(1)} screens, ${secCount} sections, worst empty ${Math.round(worst * 100)}%${REDUCE ? `, engine ${last.engine ? 'fetched' : 'not fetched'}` : ''}`);
  for (const b of uniq.slice(0, 80)) console.log('     ' + b);
  if (uniq.length > 80) console.log(`     ... and ${uniq.length - 80} more`);
  await ctx.close();
  // The strip: every screenshot in order, on one page.
  const shots = fs.readdirSync(dir).filter(f => f.endsWith('.png') && /^\d\d-/.test(f)).sort();
  const cols = width < 500 ? 7 : 4; const w = width < 500 ? 180 : 320;
  const uri = (f) => `data:image/png;base64,${fs.readFileSync(path.join(dir, f)).toString('base64')}`;
  const html = `<html><body style="margin:0;background:#fff;font:11px system-ui;color:#333"><div style="padding:8px">${label}: ${shots.length} positions, top to bottom</div><div style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:8px">${shots.map(f => `<div><img src="${uri(f)}" style="width:${w}px;display:block;border:1px solid #ccc"><div style="text-align:center">${f.replace('.png', '')}</div></div>`).join('')}</div></body></html>`;
  const strip = path.join(OUT, `strip-${label.replace(/[^a-z0-9]+/gi, '-')}.png`);
  const sctx = await browser.newContext({ viewport: { width: cols * (w + 6) + 16, height: 800 } });
  const sp = await sctx.newPage(); await sp.setContent(html); await sp.waitForTimeout(300);
  await sp.screenshot({ path: strip, fullPage: true }); await sctx.close();
  console.log(`     strip: ${strip}`);
}

for (const w of WIDTHS) await walk(w);
await browser.close();
console.log(`\n| Profile | Positions | Screens | Sections | Worst empty | Result |\n|---|---|---|---|---|---|`);
for (const s of summaries) console.log(`| ${s.label} | ${s.samples} | ${s.screens} | ${s.sections} | ${s.worstEmpty}% | ${s.bad.length ? s.bad.length + ' failure(s)' : 'clean'} |`);
console.log(failures ? `\n${failures} profile(s) failed.` : '\nEvery profile is clean.');
process.exit(failures ? 1 : 0);
