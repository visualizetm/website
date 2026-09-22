#!/usr/bin/env node
/* The scene audit (Site Prompt 11, rebuilt in Site Prompt 12 after real
 * phone screenshots showed bugs it had passed). Scrolls a page in 5
 * percent increments and captures, at every increment: a screenshot,
 * every stage's rect, which steps are revealed, and what a person would
 * see. Then walks back up and checks the reveal reversed exactly.
 *
 * Phone profiles are the viewport a phone actually shows, with Safari's
 * bars on screen (390x720, 320x500, 430x800), not the full screen: the
 * old 390x844 was 124px taller than any phone at that width ever shows
 * Home, and that is where the button under the indicator lived.
 *
 * Fails if:
 *   - a pinned stage is ever not exactly the viewport height
 *   - a pinned stage's content does not fit its box
 *   - any visible content inside a held stage is above the navbar's
 *     bottom edge (bug 6)
 *   - any visible content intersects the step indicator's box or comes
 *     within 16px of it (bug 5)
 *   - two visible text elements overlap by more than 4px, unless an opaque
 *     element sits between them (bugs 3, 4, 5); a single word broken
 *     across lines counts too (bug 2)
 *   - more than one hero cover name is visible at any of 20 positions
 *     through the hero (bug 4)
 *   - dead space, measured from painted pixels: a screenshot row is empty
 *     when it is within 8 units of a surface colour across more than 90
 *     percent of its width. Inside a held stage no band between the
 *     block's first and last painted row may exceed 15 percent of the
 *     viewport; the block is centred (bands within 32px of each other) or,
 *     when too short to centre without more than 15 percent above it, sits
 *     at that cap and builds downward; once fully revealed no band above
 *     or below it may exceed 15 percent; and a stage entering from below
 *     has its first content within 15 percent of its own top edge (bugs
 *     1, 7). A cover photo is painted, not empty. The whole-viewport share
 *     is reported, not judged: by the row rule a paragraph is mostly empty
 *     rows and a four letter link is an empty row.
 *   - a step shows before its progress, a revealed step hides while its
 *     scene is pinned, two pinned stages fill the viewport at once, the
 *     footer is unreachable, or scrolling back does not reverse the reveal
 *
 *   node scripts/scene-audit.mjs                              /scene-test at 390 (touch) and 1280
 *   SCENE_PATH=/ SCENE_WIDTHS=320,390,430,768,1280 node scripts/scene-audit.mjs
 *   SCENE_HEIGHTS=390:844 node scripts/scene-audit.mjs        override a width's height (the full-screen phone)
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
const HEIGHTS = { 320: 500, 390: 720, 430: 800, 768: 1024, 1280: 800 };
for (const pair of (process.env.SCENE_HEIGHTS || '').split(',').filter(Boolean)) { const [w, h] = pair.split(':').map(Number); if (w && h) HEIGHTS[w] = h; }
const MAX_BAND = 0.15;
const CENTRE_TOL = 32;
const INDICATOR_GAP = 16;
const isHome = PATH === '/';

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let failures = 0;
const summaries = [];

const SAMPLE = () => {
  const INDICATOR_GAP = 16;
  const vh = innerHeight; const vw = innerWidth;
  const nav = document.querySelector('.navbar');
  const navRect = nav ? nav.getBoundingClientRect() : null;
  const visible = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden'; };
  const alpha = (el) => { let o = 1; for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return 0; o *= +cs.opacity; if (o < 0.001) return 0; } return o; };
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
    const ind = stage.querySelector(':scope > .m-scene-steps');
    const ir = ind ? ind.getBoundingClientRect() : null;
    const br = body ? body.getBoundingClientRect() : r;
    // The visible content block: leaf text, images, buttons, bars inside the body at alpha > 0.05.
    let cTop = Infinity, cBottom = -Infinity;
    if (body) for (const el of body.querySelectorAll('*')) {
      const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      const box = /(^|\s)(btn|pk-bar|pk-chip|bt-icon|pk-node|hero-cover-name)(\s|$)/.test(String(el.className || '')) || el.tagName === 'IMG';
      if (!own && !box) continue;
      if (alpha(el) < 0.05) continue;
      const q = el.getBoundingClientRect(); if (q.height < 2 || q.width < 2) continue;
      cTop = Math.min(cTop, q.top); cBottom = Math.max(cBottom, q.bottom);
    }
    const held = pinned && Math.abs(r.top) < 2 && r.height >= vh - 2;
    const names = [...root.querySelectorAll('.hero-cover-name')].filter(el => alpha(el) > 0.02).length;
    // Something mid-fade: the block's extent is not settled, so its centring is not judged this frame.
    let settling = false;
    if (body) for (const el of body.querySelectorAll('[data-step], [data-step] *')) { const cs = getComputedStyle(el); const o = +cs.opacity; const d = Number(cs.getPropertyValue('--done')); if ((o > 0.05 && o < 0.95) || (Number.isFinite(d) && d > 0.02 && d < 0.98)) { settling = true; break; } }
    const backdrop = !!stage.querySelector(':scope > .m-scene-backdrop');
    return { i, label: stage.getAttribute('aria-label') || '', steps, pinned, held, p: p === '' ? null : Number(p), top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), onScreen: r.bottom > 0 && r.top < vh, reveal, fits, bodyH: body ? body.scrollHeight : 0, bodyBox: body ? body.clientHeight : 0,
      bodyTop: Math.round(br.top), bodyBottom: Math.round(br.bottom), contentTop: cTop === Infinity ? null : Math.round(cTop), contentBottom: cBottom === -Infinity ? null : Math.round(cBottom),
      indicator: ir ? { top: Math.round(ir.top), bottom: Math.round(ir.bottom) } : null, names, settling, backdrop };
  });
  /* Navbar clearance and indicator clearance inside a held stage; text
     overlap across the page. Leaves: elements with their own text. */
  let overlapNav = null; let overlapInd = null;
  const leaves = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('.navbar') || el.closest('.m-scene-backdrop') || el.closest('.m-scene-steps')) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const box = el.tagName === 'IMG' || /(^|\s)btn(\s|$)/.test(String(el.className || ''));
    if (!own && !box) continue;
    if (!visible(el)) continue;
    const a = alpha(el); if (a < 0.05) continue;
    if (el.closest('.navbar-drawer, [inert]')) continue;
    const q = el.getBoundingClientRect();
    if (q.width < 2 || q.height < 2 || q.bottom < 0 || q.top > vh || q.right < 0 || q.left > vw) continue;
    const stage = el.closest('.m-scene--pinned > .m-scene-stage');
    const sr = stage?.getBoundingClientRect();
    const heldIn = sr && Math.abs(sr.top) < 2 && sr.height >= vh - 2;
    const name = `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]} "${(el.textContent || el.getAttribute('alt') || '').trim().slice(0, 28)}"`;
    if (heldIn && navRect && !overlapNav && q.top < navRect.bottom - 1) overlapNav = `${name} top ${Math.round(q.top)} under navbar bottom ${Math.round(navRect.bottom)}`;
    if (heldIn && !overlapInd) { const ind = stage.querySelector(':scope > .m-scene-steps'); if (ind) { const ir = ind.getBoundingClientRect(); if (q.bottom > ir.top - INDICATOR_GAP && q.top < ir.bottom + INDICATOR_GAP) overlapInd = `${name} bottom ${Math.round(q.bottom)} vs indicator top ${Math.round(ir.top)} (gap ${Math.round(ir.top - q.bottom)}px, needs ${INDICATOR_GAP})`; } }
    if (own) {
      const cs = getComputedStyle(el);
      const text = (el.textContent || '').trim();
      const oneWord = !/\s/.test(text) && text.length <= 12 && cs.whiteSpace !== 'nowrap';
      leaves.push({ el, q, a, name, oneWord, fontPx: parseFloat(cs.fontSize) || 16, lh: parseFloat(cs.lineHeight) || 0 });
    }
  }
  const overlaps = []; const wrapped = [];
  const opaque = (el) => { const bg = getComputedStyle(el).backgroundColor; const m = bg.match(/rgba?\(([^)]+)\)/); if (!m) return false; const parts = m[1].split(',').map(Number); return parts.length < 4 || parts[3] >= 0.9; };
  for (const L of leaves) {
    // A single word whose text occupies more than one line box has broken across lines (a numeral in a column too narrow for it).
    if (!L.oneWord) continue;
    // The element's own text nodes only: an icon beside the text sits on a different line box top.
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
    // An occluder has to be opaque itself: an opaque background on a card that is mid-fade hides nothing.
    for (let k = lo + 1; k < hi; k++) { const e = stack[k]; if (e === A.el || e === B.el || A.el.contains(e) || B.el.contains(e)) continue; if (opaque(e) && alpha(e) >= 0.95) { hidden = true; break; } }
    if (hidden) continue;
    overlaps.push(`${A.name} (alpha ${A.a.toFixed(2)}) and ${B.name} (alpha ${B.a.toFixed(2)}) overlap ${Math.round(x1 - x0)}x${Math.round(y1 - y0)}px`);
  }
  const footer = document.querySelector('footer'); const fr = footer?.getBoundingClientRect();
  const tok = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return { y: Math.round(scrollY), vh, vw, docH: document.documentElement.scrollHeight, overlapNav, overlapInd, overlaps, wrapped, scenes, navBottom: navRect ? Math.round(navRect.bottom) : 0, surfaces: [tok('--bg'), tok('--bg-elevated')], footerVisible: !!fr && fr.top < vh && fr.bottom > 0, engine: !!performance.getEntriesByType('resource').find(e => /gsap/.test(e.name)) };
};

/* Painted rows: decode the screenshot in the page and scan every CSS
   pixel row. A row is empty when more than 90 percent of its pixels are
   within 8 units of a surface colour. */
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

/* The longest run of true in rows[a..b). */
const longestRun = (rows, a, b) => { let best = 0, cur = 0; for (let y = Math.max(0, a); y < Math.min(rows.length, b); y++) { cur = rows[y] ? cur + 1 : 0; if (cur > best) best = cur; } return best; };
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
    const png = await page.screenshot({ path: shot });
    const rows = await ROWS(page, png, s.surfaces);
    const emptyShare = countRun(rows, 0, s.vh) / s.vh;
    s.empty = emptyShare;
    const at = `${Math.round((y / Math.max(1, max)) * 100)}% (y=${s.y})`;
    const heldScene = s.scenes.find(sc => sc.held);
    const fully = heldScene && heldScene.p !== null && heldScene.p >= heldScene.steps - 1 - 0.01;
    /* The whole-viewport limit applies where a person expects a full
       screen: a held stage that has finished revealing. A stage still
       revealing one step at a time, or a footer of short links, is
       judged by the band, centring and entry rules instead: the row rule
       reads a four letter link as an empty row. A photo backdrop paints
       its own rows, so it is judged by centring alone. */
    /* The whole-viewport share is reported, not judged: by the row rule a
       paragraph is mostly empty rows (line gaps, ascender space) and a
       four letter link is an empty row, so a screen full of text reads
       60 percent empty. The bands below are the signal a person sees. */
    for (const sc of s.scenes) {
      /* An entering stage (on screen, not yet held): its first painted content within 15% of the viewport from its own top edge. */
      if (sc.pinned && sc.onScreen && sc.top > s.navBottom + 2 && sc.contentTop !== null && sc.contentTop - sc.top > MAX_BAND * s.vh) bad.push(`${at}: scene ${sc.i} "${sc.label}" enters with ${sc.contentTop - sc.top}px between its top edge and its first content (limit ${Math.round(MAX_BAND * s.vh)})`);
    }
    if (s.overlapNav) bad.push(`${at}: content under the navbar inside a held stage: ${s.overlapNav}`);
    if (s.overlapInd) bad.push(`${at}: content against the step indicator: ${s.overlapInd}`);
    for (const o of s.overlaps) bad.push(`${at}: text overlap: ${o}`);
    for (const w of s.wrapped) bad.push(`${at}: ${w}`);
    let pinnedOnScreen = 0;
    for (const sc of s.scenes) {
      const held = sc.pinned && sc.p !== null && sc.p > 0.001 && sc.p < sc.steps - 0.001;
      if (sc.pinned && sc.onScreen && sc.top <= 0 && sc.bottom >= s.vh - 1) pinnedOnScreen++;
      if (held && Math.abs(sc.height - s.vh) > 1) bad.push(`${at}: scene ${sc.i} "${sc.label}" stage is ${sc.height}px while pinned, viewport ${s.vh}`);
      if (sc.pinned && !sc.fits) bad.push(`scene ${sc.i} "${sc.label}": content (${sc.bodyH}px) does not fit its stage (${sc.bodyBox}px)`);
      if (sc.held && sc.contentTop !== null) {
        /* The bands, from painted rows: above the block (from the navbar's
           bottom), inside it, and below it (to the indicator or the stage's
           bottom). Centring from the block's rect against the body's box. */
        const lower = sc.indicator ? sc.indicator.top : sc.bottom;
        const above = countRun(rows, s.navBottom, sc.contentTop), below = countRun(rows, sc.contentBottom, lower);
        const inner = longestRun(rows, sc.contentTop, sc.contentBottom);
        /* Against the stage's fixed space (navbar bottom to the indicator
           or the stage's bottom), never the body box, which moves with
           the block and so can never look off centre. */
        const rectAbove = sc.contentTop - s.navBottom, rectBelow = lower - sc.contentBottom;
        const full = sc.p !== null && sc.p >= sc.steps - 1 - 0.01;
        if (!sc.backdrop && !sc.settling && inner > MAX_BAND * s.vh) bad.push(`${at}: scene ${sc.i} "${sc.label}" has a ${inner}px dead band inside its content (${Math.round(100 * inner / s.vh)}% of the viewport, limit ${MAX_BAND * 100})`);
        /* Placement: the block is centred (bands within 32px of each other)
           or, when it is too short to centre without a band over 15
           percent above it, it sits at that cap and builds downward.
           Never lower than the cap; never both off the cap and off centre. */
        const cap = MAX_BAND * s.vh;
        // A block is placed at the cap, centred, or (once fully revealed on a tall viewport) centred below the cap.
        if (!sc.settling && !full && rectAbove > cap + CENTRE_TOL && Math.abs(rectAbove - rectBelow) > CENTRE_TOL) bad.push(`${at}: scene ${sc.i} "${sc.label}" block sits ${rectAbove}px below the navbar (limit ${Math.round(cap)})`);
        if (!sc.settling && rectAbove < cap - CENTRE_TOL && Math.abs(rectAbove - rectBelow) > CENTRE_TOL) bad.push(`${at}: scene ${sc.i} "${sc.label}" is neither centred nor at the cap: ${rectAbove}px above the visible block, ${rectBelow}px below (tolerance ${CENTRE_TOL})`);
        if (full && !sc.backdrop && (above > MAX_BAND * s.vh || below > MAX_BAND * s.vh)) bad.push(`${at}: scene ${sc.i} "${sc.label}" fully revealed with ${above}px empty above and ${below}px below the block (limit ${Math.round(MAX_BAND * s.vh)})`);
        if (full && sc.backdrop && (rectAbove > MAX_BAND * s.vh || rectBelow > MAX_BAND * s.vh)) bad.push(`${at}: scene ${sc.i} "${sc.label}" fully revealed with its block ${rectAbove}px from the navbar and ${rectBelow}px from the bottom (limit ${Math.round(MAX_BAND * s.vh)})`);
      }
      if (sc.pinned && sc.p !== null) {
        for (const [n, sr] of Object.entries(sc.reveal)) {
          const key = `${sc.i}:${n}`;
          if (sr > 0.02 && sc.p < Number(n) - 1.35 - 0.01) bad.push(`${at}: scene ${sc.i} step ${n} visible (${sr.toFixed(2)}) at progress ${sc.p.toFixed(2)}`);
          if (held && maxSeen[key] !== undefined && sr < maxSeen[key] - 0.05) bad.push(`${at}: scene ${sc.i} step ${n} hid (${sr.toFixed(2)} after ${maxSeen[key].toFixed(2)}) while pinned`);
          if (held) maxSeen[key] = Math.max(maxSeen[key] || 0, sr);
        }
      }
      if (REDUCE && sc.pinned) bad.push(`${at}: scene ${sc.i} is pinned under reduced motion`);
      if (REDUCE) for (const [n, sr] of Object.entries(sc.reveal)) if (sr < 0.99) bad.push(`${at}: scene ${sc.i} step ${n} not fully shown under reduced motion (${sr.toFixed(2)})`);
    }
    if (isHome && pinnedOnScreen > 1) bad.push(`${at}: two pinned stages fill the viewport at once`);
  }
  /* The hero's cover names at 20 positions through its hold: never more than one visible. */
  if (!REDUCE) {
    const hero = await page.evaluate(() => { const root = document.querySelector('.m-scene--pinned:has(.hero-cover-name)'); if (!root) return null; let t = 0; for (let n = root; n; n = n.offsetParent) t += n.offsetTop; return { top: t, hold: root.offsetHeight - root.firstElementChild.offsetHeight }; });
    if (hero) for (let k = 0; k < 20; k++) {
      await page.evaluate((v) => window.scrollTo(0, v), Math.round(hero.top + (k / 19) * hero.hold)); await page.waitForTimeout(settle);
      const r = await page.evaluate(SAMPLE);
      const sc = r.scenes.find(x => x.names !== undefined && x.label);
      const n = Math.max(...r.scenes.map(x => x.names));
      if (n > 1) bad.push(`hero position ${k + 1}/20 (progress ${sc?.p?.toFixed?.(2)}): ${n} cover names visible at once`);
    }
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
  for (const b of uniq.slice(0, 80)) console.log('     ' + b);
  if (uniq.length > 80) console.log(`     ... and ${uniq.length - 80} more`);
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
