#!/usr/bin/env node
/* The Concepts page's full screen cue and stage, in a browser, written from the specification and not from the code.
 *
 * Runs at 390 and 1280, plus a phone on its side (844 x 390, the rail) and a width sweep. Every public door answer comes from a route
 * of its own built from a deep copy of publicConceptSet(...) for the token under test, so no check depends on what an earlier one answered:
 * the handler records every POST body and mimics the real endpoint (decide saves an answer, a change answer needs a note else 400, submit
 * locks the set, approve and change on a Review each set are 409, and a decided Pick one set is 409).
 *
 * The real Fullscreen API is not usable headless, so an init script swaps Element.prototype.requestFullscreen for a recorder that pushes
 * the tag of the element it was asked on to window.__fs.
 *
 * Sections, as the specification numbers them:
 *   1 the cue on every main image     2 the scrim and static cue         3 the compact chip after the first entry
 *   4 opening on that direction       5 Review each in the stage         6 Pick one, locked and present
 *   7 Escape, focus, trap, scroll lock, typing    8 layouts and gestures   9 targets and overflow   10 reduced motion
 *   11 the cue's contrast measured on real pixels over a pure white picture
 *
 *   AUDIT_BASE=http://127.0.0.1:4334 PW_CHROME=/opt/pw-browsers/chromium node scripts/concepts-fullscreen-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, sets, publicConceptSet } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4334';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0;
const failed = [];
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) { fails++; failed.push(m); } };
const note = (m) => console.log('note ' + m);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Tokens of the fixture sets (scripts/audit-fixtures.mjs). */
const TOK = {
  pick: 'cncpTESTtoken0123456789abcdEF', // Pick one: three directions with 1, 4 and 8 images
  review: 'cncpREVIEWtoken0123456789abc', // Review each: A to D, D for reference, nothing answered, allowPass false
  partly: 'cncpPARTLYtoken0123456789abcd', // Review each: A approved, B changes, C open, allowPass true
  allin: 'cncpALLINtoken01234567890abcde', // Review each: all three answered, not sent
  submitted: 'cncpSUBMITTEDtoken0123456789ab', // Review each: sent and locked
  approved: 'cncpAPPROVEDtoken0123456789a', // Pick one: decided
};
const WORD = { open: 'Open', approved: 'Approved', changes: 'Needs changes', pass: 'Not this one', reference: 'For reference', picked: 'Picked' };
const letter = (i) => String.fromCharCode(65 + i);
const expected = (token) => publicConceptSet(sets.find(s => s.token === token));
/* What a direction's dot should say, from the fixture alone. */
const dotStateOf = (pub, d) => (pub.set.approvalMode === 'review' ? (d.needsDecision === false ? 'reference' : d.decision?.status || 'open') : (d.id === pub.set.approvedDirectionId ? 'picked' : 'open'));

/* ── A session: a context, a page, the recorder, and a public door of our own ── */
async function session({ width = 390, height, token, touch, reduced = false, storage = true } = {}) {
  const h = height || (width < 768 ? 844 : 900);
  const ctx = await browser.newContext({ viewport: { width, height: h }, hasTouch: touch ?? width < 768, reducedMotion: reduced ? 'reduce' : 'no-preference', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__fs = [];
    window.__mv = (v) => String(v).split(',').some(x => (x.trim().endsWith('ms') ? parseFloat(x) / 1000 : parseFloat(x)) > 0.001);
    Element.prototype.requestFullscreen = function () { window.__fs.push(this.tagName); return Promise.resolve(); };
  });
  await mockRoutes(page, { session: false });
  const state = structuredClone(expected(token));
  const posts = [];
  const door = { delay: 0, failNext: 0 };
  /* Registered after mockRoutes, so it answers first. */
  await page.route('**/api/concepts**', async (r) => {
    const url = new URL(r.request().url());
    const send = (status, payload) => r.fulfill({ status, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(payload) });
    if (url.searchParams.get('token') !== token) return send(404, { error: 'not found' });
    if (r.request().method() !== 'POST') return send(200, state);
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch { body = {}; }
    posts.push(body);
    if (door.delay) await new Promise(res => setTimeout(res, door.delay));
    if (door.failNext > 0) { door.failNext--; return send(500, { error: 'boom' }); }
    const review = state.set.approvalMode === 'review';
    const d = state.directions.find(x => x.id === body.directionId);
    if (body.action === 'decide') {
      if (!review || state.set.submittedAt) return send(409, { error: 'locked' });
      if (!d) return send(404, { error: 'not found' });
      if (d.needsDecision === false) return send(400, { error: 'That one is for reference, nothing to decide.' });
      if (!['approved', 'changes', 'pass'].includes(body.status) || (body.status === 'pass' && !state.set.allowPass)) return send(400, { error: 'unknown answer' });
      if (body.status === 'changes' && !String(body.note || '').trim()) return send(400, { error: 'Say what should change first.' });
      d.decision = { status: body.status, note: String(body.note || '').slice(0, 1000), decidedAt: new Date().toISOString() };
      return send(200, { ok: true, decision: d.decision });
    }
    if (body.action === 'submit') {
      if (!review || state.set.submittedAt) return send(409, { error: 'locked' });
      const open = state.directions.filter(x => x.needsDecision !== false && !x.decision);
      if (open.length) return send(400, { error: 'Answer every one first.' });
      state.set.submittedAt = new Date().toISOString();
      return send(200, { ok: true, status: 'approved' });
    }
    if (review && (body.action === 'approve' || body.action === 'change')) return send(409, { error: 'answered one by one' });
    if (body.action === 'note') return send(200, { ok: true });
    if (!d) return send(404, { error: 'not found' });
    if (state.set.status === 'approved' || state.set.approvedDirectionId) return send(409, { error: 'decided' });
    if (body.action === 'change' && !String(body.note || '').trim()) return send(400, { error: 'note required' });
    if (body.action === 'approve') { state.set.status = 'approved'; state.set.approvedDirectionId = d.id; }
    if (body.action === 'change') state.set.status = 'changes';
    return send(200, { ok: true, status: state.set.status });
  });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const open = async (query = '') => {
    await page.goto(`${BASE}/concepts/${token}${query}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cp-main', { timeout: 10000 });
  };
  return { ctx, page, posts, state, door, errors, open };
}

/* ── Small readers and drivers ── */
const stageUp = (p) => p.waitForSelector('.cp-stage', { timeout: 6000 });
const stageGone = (p) => p.waitForSelector('.cp-stage', { state: 'detached', timeout: 6000 });
/* Open the stage from the cue of direction `dir` (and, with `img`, from that thumbnail of the section first). */
async function openAt(p, dir, img = 0) {
  const sec = p.locator('.cp-dir').nth(dir);
  if (img > 0) await sec.locator('.cp-thumb').nth(img).click();
  await sec.locator('.cp-main').click();
  await stageUp(p);
}
const esc = async (p) => { await p.keyboard.press('Escape'); await stageGone(p); };
const savedSaid = (p) => p.waitForFunction(() => /Saved/.test(document.querySelector('.cp-st-saved')?.textContent || ''), null, { timeout: 5000 });
/* Everything the checks read from the open stage, in one round trip. */
const stageInfo = (p) => p.evaluate(() => {
  const s = document.querySelector('.cp-stage');
  const t = (sel) => s.querySelector(sel)?.textContent?.trim() || '';
  return {
    layout: s.dataset.layout, label: t('.cp-st-label'), name: t('.cp-st-name'), capN: t('.cp-st-cap-n'), cap: t('.cp-st-cap'),
    chip: s.querySelector('.cp-chip')?.dataset.chip || '', src: s.querySelector('.cp-st-img')?.getAttribute('src') || '',
    dots: [...s.querySelectorAll('.cp-st-dot')].map(d => ({ dir: d.dataset.dir, state: d.dataset.state, label: d.getAttribute('aria-label'), cur: d.getAttribute('aria-current'), top: !!d.closest('.cp-st-top'), dock: !!d.closest('.cp-st-panel--dock') })),
    chevs: s.querySelectorAll('.cp-st-chev').length, thumbs: s.querySelectorAll('.cp-st-thumb').length,
    pressed: [...s.querySelectorAll('.cp-st-thumb')].findIndex(b => b.getAttribute('aria-pressed') === 'true'),
  };
});
const dirLetterNow = async (p) => (await stageInfo(p)).label.replace(/^Direction /, '').slice(0, 1);
/* The page may still be smooth scrolling to the cue that was clicked (html scroll-behavior); wait until scrollY holds still. */
const scrollSettled = (p) => p.evaluate(() => new Promise((res) => { let last = -1; let n = 0; const f = () => { if (window.scrollY === last) n++; else { n = 0; last = window.scrollY; } if (n >= 20) res(window.scrollY); else requestAnimationFrame(f); }; f(); }));
const barText = (p) => p.locator('.cp-bar-n').first().innerText();

/* ── 1 The cue on every main image ── */
async function section1(width) {
  console.log(`── 1 cue, ${width}px ──`);
  for (const [mode, token] of [['Pick one', TOK.pick], ['Review each', TOK.review]]) {
    const S = await session({ width, token }); const p = S.page; await S.open();
    const pub = expected(token);
    const n = pub.directions.filter(d => d.items.length).length;
    const rows = await p.evaluate(() => [...document.querySelectorAll('.cp-dir')].map(sec => {
      const m = sec.querySelector('.cp-main'); const cue = m?.querySelector('.cp-cue');
      const ico = m?.querySelector('.cp-cue-ico'); const r = ico?.getBoundingClientRect();
      return {
        tag: m?.tagName, mains: sec.querySelectorAll('.cp-main').length, framed: sec.querySelectorAll('.cp-sec-visual > button.cp-main').length,
        nested: m ? m.querySelectorAll('button, a, input, select, textarea, [role="button"], [tabindex]').length : -1, inButton: m?.parentElement?.closest('button') ? 1 : 0,
        cueIn: !!cue, cueHidden: cue?.getAttribute('aria-hidden'), svg: !!m?.querySelector('.cp-cue-ico svg'), compact: !!cue?.classList.contains('cp-cue--compact'),
        title: m?.querySelector('.cp-cue-title')?.textContent?.trim(), line: m?.querySelector('.cp-cue-line')?.textContent?.trim(),
        icoW: r ? Math.round(r.width) : 0, icoH: r ? Math.round(r.height) : 0, label: m?.getAttribute('aria-label') || '',
      };
    }));
    ok(rows.length === n && rows.every(r => r.mains === 1 && r.tag === 'BUTTON' && r.framed === 1), `${mode}: every direction has exactly one main image button (${rows.length} of ${n})`);
    ok(rows.every(r => r.nested === 0 && r.inButton === 0), `${mode}: no button, link or focusable is nested inside the main image button`);
    ok(rows.every(r => r.cueIn && r.cueHidden === 'true' && !r.compact), `${mode}: every main button holds a big, aria-hidden cue on first load`);
    ok(rows.every(r => r.svg && r.title === 'Enter full screen' && r.line === 'See it big and answer right there.'), `${mode}: every cue has the svg icon, "Enter full screen" and "See it big and answer right there."`);
    const want = width < 480 ? 56 : 64;
    ok(rows.every(r => r.icoW === want && r.icoH === want), `${mode}: the cue chip is ${want}px at ${width}px (saw ${[...new Set(rows.map(r => r.icoW + 'x' + r.icoH))].join(', ')})`);
    ok(rows.every(r => /, \d+ of \d+\. Enter full screen\.$/.test(r.label) && /full screen/i.test(r.label)), `${mode}: the accessible name is "<caption>, <n of m>. Enter full screen." (${rows[0]?.label})`);
    const byRole = await p.getByRole('button', { name: /enter full screen/i }).count();
    ok(byRole === n, `${mode}: ${byRole} buttons answer to the role query "Enter full screen" (want ${n})`);
    ok(await p.locator('.cp-intro-fs').count() === 1, `${mode}: the intro button exists`);
    const introText = (await p.locator('.cp-intro-fs').innerText()).trim();
    ok(introText === (mode === 'Pick one' ? 'See them full screen' : 'Review in full screen'), `${mode}: the intro button reads "${introText}"`);
    await S.ctx.close();

    const P = await session({ width, token }); await P.open('?present=1');
    ok(await P.page.locator('.cp-intro-fs').count() === 0, `${mode}, ?present=1: the intro button is absent`);
    const pc = await P.page.evaluate(() => ({ big: document.querySelectorAll('.cp-cue:not(.cp-cue--compact)').length, compact: document.querySelectorAll('.cp-cue--compact').length, texts: [...new Set([...document.querySelectorAll('.cp-cue--compact')].map(c => c.textContent.trim()))] }));
    ok(pc.big === 0 && pc.compact === n && same(pc.texts, ['Full screen']), `${mode}, ?present=1: every cue is the compact "Full screen" chip (${pc.compact} of ${n}, ${pc.big} big)`);
    await P.ctx.close();
  }
  /* The intro button opens at direction A. */
  for (const [mode, token] of [['Pick one', TOK.pick], ['Review each', TOK.review]]) {
    const S = await session({ width, token }); const p = S.page; await S.open();
    await p.locator('.cp-intro-fs').click(); await stageUp(p);
    ok(await dirLetterNow(p) === 'A', `${mode}: the intro button opens the stage at Direction A`);
    ok(same(await p.evaluate(() => window.__fs), ['HTML']), `${mode}: the intro button asks for full screen on the HTML element once`);
    await S.ctx.close();
  }
}

/* ── 2 The scrim, static ── */
const parseStops = (bg) => [...bg.matchAll(/rgba?\(([^)]+)\)/g)].map(m => { const v = m[1].split(',').map(x => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; });
const secondsOf = (v) => String(v).split(',').map(x => x.trim()).map(x => (x.endsWith('ms') ? parseFloat(x) / 1000 : parseFloat(x)));
/* The rule for "no duration": the site's reduced motion rule (src/index.css) collapses every transition and animation to 0.01ms, so
 * anything at or under 1ms counts as none; a real transition is tens of milliseconds or more. */
const NONE = 0.001;
const isMoving = (v) => secondsOf(v).some(x => x > NONE);
async function section2(width) {
  console.log(`── 2 scrim, ${width}px ──`);
  for (const reduced of [false, true]) {
    const tag = reduced ? 'reduced motion' : 'normal motion';
    const S = await session({ width, token: TOK.pick, reduced }); const p = S.page; await S.open();
    const cues = await p.evaluate(() => [...document.querySelectorAll('.cp-cue')].map(c => { const s = getComputedStyle(c); const line = c.querySelector('.cp-cue-line'); return { bg: s.backgroundImage, bgc: s.backgroundColor, td: s.transitionDuration, ad: s.animationDuration, text: line ? getComputedStyle(line).color : '' }; }));
    const stops = cues.map(c => parseStops(c.bg));
    ok(cues.length > 0 && cues.every(c => /^radial-gradient\(/.test(c.bg)), `${tag}: the cue scrim is a radial-gradient`);
    ok(stops.every(s => s.length >= 2 && s[0].a >= 0.6 && s[1].a >= 0.6 && s[0].r === 0 && s[0].g === 0 && s[0].b === 0), `${tag}: the first two scrim stops are black at alpha >= 0.6 (${stops[0].map(s => s.a).join(', ')})`);
    /* White text over the lightest possible picture (pure white) under the weaker of the two stops. */
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
    const textRgb = (cues[0].text.match(/[\d.]+/g) || [255, 255, 255]).slice(0, 3).map(Number);
    const worst = 255 * (1 - Math.min(stops[0][0].a, stops[0][1].a));
    const ratio = (lum([worst, worst, worst]) + 0.05) / (lum(textRgb) + 0.05);
    const contrast = Math.max(ratio, 1 / ratio);
    ok(contrast >= 4.5, `${tag}: the cue text clears 4.5:1 over a white picture under that scrim (${contrast.toFixed(1)}:1)`);
    ok(cues.every(c => !isMoving(c.td) && !isMoving(c.ad)), `${tag}: no cue has a transition or an animation (${cues[0].td})`);
    /* The compact chip, after one entry. */
    await openAt(p, 0);
    if (reduced) {
      const moving = await p.evaluate(() => [...document.querySelectorAll('.cp-stage, .cp-stage *')].map(e => { const s = getComputedStyle(e); return { t: s.transitionDuration, a: s.animationDuration, n: e.tagName + '.' + String(e.className?.baseVal ?? e.className).split(' ')[0] }; }).filter(x => window.__mv(x.t) || window.__mv(x.a)));
      ok(moving.length === 0, `${tag}: nothing inside .cp-stage has a transition or animation duration${moving.length ? ' (' + [...new Set(moving.map(m => m.n + ' ' + m.t))].join('; ') + ')' : ''}`);
    } else {
      const moving = await p.evaluate(() => [...document.querySelectorAll('.cp-stage, .cp-stage *')].map(e => ({ t: getComputedStyle(e).transitionDuration, n: e.tagName + '.' + String(e.className?.baseVal ?? e.className).split(' ')[0] })).filter(x => window.__mv(x.t)));
      if (moving.length) note(`${tag}: ${[...new Set(moving.map(m => m.n + ' ' + m.t))].join('; ')} in the stage transitions in normal motion (the stage source says "Nothing here animates"; the specification only requires none under reduced motion)`);
    }
    await esc(p);
    /* The big cue's span becomes the chip in place, so under reduced motion its 0.01ms background transition can still be on its first frame. */
    await p.waitForFunction(() => { const c = [...document.querySelectorAll('.cp-cue--compact')]; return c.length > 0 && c.every(e => getComputedStyle(e).backgroundColor !== 'rgba(0, 0, 0, 0)'); });
    const compact = await p.evaluate(() => [...document.querySelectorAll('.cp-cue--compact')].map(c => { const s = getComputedStyle(c); return { bgc: s.backgroundColor, td: s.transitionDuration }; }));
    ok(compact.length > 0 && compact.every(c => parseStops(c.bgc)[0].a >= 0.6 && !isMoving(c.td)), `${tag}: the compact chip is alpha >= 0.6 black and static (${[...new Set(compact.map(c => c.bgc))].join(' | ')})`);
    await S.ctx.close();
  }
}

/* ── 3 The compact chip after the first entry ── */
async function section3(width) {
  console.log(`── 3 first entry, ${width}px ──`);
  for (const [mode, token] of [['Pick one', TOK.pick], ['Review each', TOK.review]]) {
    const S = await session({ width, token }); const p = S.page; await S.open();
    const n = expected(token).directions.filter(d => d.items.length).length;
    const count = () => p.evaluate(() => ({ big: document.querySelectorAll('.cp-cue:not(.cp-cue--compact)').length, compact: document.querySelectorAll('.cp-cue--compact').length, ss: sessionStorage.getItem('vz_concepts_fs') }));
    const before = await count();
    ok(before.big === n && before.compact === 0 && before.ss === null, `${mode}: before any entry there are ${n} big cues and no vz_concepts_fs`);
    await openAt(p, 0); await esc(p);
    const after = await count();
    ok(after.big === 0 && after.compact === n, `${mode}: after one entry every direction shows the compact chip (${after.compact} of ${n})`);
    ok(after.ss === '1', `${mode}: sessionStorage vz_concepts_fs is "1" (${after.ss})`);
    await p.reload(); await p.waitForSelector('.cp-main');
    const reloaded = await count();
    ok(reloaded.big === 0 && reloaded.compact === n, `${mode}: the chip survives a reload in the same tab`);
    await S.ctx.close();
    const F = await session({ width, token }); await F.open();
    const fresh = await F.page.evaluate(() => ({ big: document.querySelectorAll('.cp-cue:not(.cp-cue--compact)').length, ss: sessionStorage.getItem('vz_concepts_fs') }));
    ok(fresh.big === n && fresh.ss === null, `${mode}: a fresh context starts with the big cue again`);
    await F.ctx.close();
  }
}

/* ── 4 Opening on that direction and image ── */
async function section4(width) {
  console.log(`── 4 opening, ${width}px ──`);
  /* Pick one: the second direction at its first image, then a later image of the 8 image direction. */
  for (const [dir, img] of [[1, 0], [1, 2], [2, 5]]) {
    const token = TOK.pick; const pub = expected(token);
    const S = await session({ width, token }); const p = S.page; await S.open();
    await openAt(p, dir, img);
    const i = await stageInfo(p); const d = pub.directions[dir]; const it = d.items[img];
    const wide = width >= 900;
    ok(i.label === (wide ? `Direction ${letter(dir)} of ${pub.directions.length}` : `${letter(dir)} of ${pub.directions.length}`), `Pick one ${letter(dir)} image ${img + 1}: label "${i.label}"`);
    ok(i.name === d.name, `Pick one ${letter(dir)} image ${img + 1}: name "${i.name}"`);
    ok(i.capN === `${img + 1} of ${d.items.length}` && i.cap.startsWith(it.caption), `Pick one ${letter(dir)} image ${img + 1}: caption and counter "${i.cap}"`);
    ok(i.src.endsWith(it.image.split('/').pop()) && i.pressed === img, `Pick one ${letter(dir)}: the big image is #${img + 1} (${i.src.split('/').pop()}) and its thumbnail is pressed`);
    ok(same(await p.evaluate(() => window.__fs), ['HTML']), `Pick one ${letter(dir)}: requestFullscreen was asked once, on HTML (${JSON.stringify(await p.evaluate(() => window.__fs))})`);
    ok(i.dots.length === pub.directions.length && i.dots.every((x, k) => x.state === dotStateOf(pub, pub.directions[k]) && x.label === `Direction ${letter(k)}, ${WORD[x.state]}` && x.dir === String(k)), `Pick one ${letter(dir)}: dots carry the right state and aria-label (${i.dots.map(x => x.label).join(' | ')})`);
    ok(i.dots.filter(x => x.cur === 'step').length === 1 && i.dots[dir].cur === 'step', `Pick one ${letter(dir)}: aria-current="step" is on dot ${letter(dir)} only`);
    ok(wide ? i.dots.every(x => x.top && !x.dock) : i.dots.every(x => x.dock && !x.top), `Pick one ${letter(dir)}: the dots are in the ${wide ? 'top bar' : 'dock'}`);
    ok(i.chip === '', `Pick one ${letter(dir)}: no state chip on an open direction (${JSON.stringify(i.chip)})`);
    await S.ctx.close();
  }
  /* Review each: every state a dot and a chip can be in. */
  for (const [token, which] of [[TOK.review, 'nothing answered'], [TOK.partly, 'partly answered']]) {
    const pub = expected(token);
    const S = await session({ width, token }); const p = S.page; await S.open();
    for (let dir = 0; dir < pub.directions.length; dir++) {
      if (dir > 0) await esc(p).catch(() => {});
      await openAt(p, dir);
      const i = await stageInfo(p); const d = pub.directions[dir]; const st = dotStateOf(pub, d);
      ok(i.name === d.name && i.capN === (d.items.length > 1 ? `1 of ${d.items.length}` : ''), `Review (${which}) ${letter(dir)}: name "${i.name}" and counter "${i.capN}"`);
      ok(i.dots.every((x, k) => x.state === dotStateOf(pub, pub.directions[k]) && x.label === `Direction ${letter(k)}, ${WORD[x.state]}`), `Review (${which}) ${letter(dir)}: dots ${i.dots.map(x => x.state).join('/')}`);
      const wantChip = st === 'open' ? '' : st;
      if (width >= 900 || st === 'reference') ok(i.chip === wantChip, `Review (${which}) ${letter(dir)}: chip ${JSON.stringify(i.chip)} matches the fixture (${JSON.stringify(wantChip)})`);
      else {
        /* On a phone the dock shows the answer on the buttons and the note, not as a chip, until the set is sent. */
        const pressed = await p.evaluate(() => ({ a: document.querySelector('.cp-st-approve')?.getAttribute('aria-pressed'), c: document.querySelector('.cp-st-changes')?.getAttribute('aria-pressed'), x: document.querySelector('.cp-st-pass')?.getAttribute('aria-pressed') }));
        ok(st === 'open' ? i.chip === '' : (pressed.a === 'true') === (st === 'approved') && (pressed.c === 'true') === (st === 'changes') && (pressed.x === 'true') === (st === 'pass'), `Review (${which}) ${letter(dir)}: the dock shows the answer "${st}" on the buttons (chip ${JSON.stringify(i.chip)})`);
      }
    }
    await S.ctx.close();
  }
}

/* ── 5 Review each in the stage ── */
async function section5(width) {
  console.log(`── 5 Review each, ${width}px ──`);
  const wide = width >= 900;
  const S = await session({ width, token: TOK.review }); const p = S.page; await S.open();
  ok(await barText(p) === '0 of 3 reviewed', 'the bottom bar starts at "0 of 3 reviewed"');
  await openAt(p, 0);
  ok(await p.evaluate(() => document.querySelector('.cp-st-next').classList.contains('cp-btn--ghost')), 'Next direction is secondary while the current direction is open');
  ok(await p.locator('.cp-st-approve').count() === 1 && await p.locator('.cp-st-changes').count() === 1 && await p.locator('.cp-st-pass').count() === 0, 'allowPass false: Approve and Needs changes, no Not this one');
  ok(await p.locator('.cp-st-send').count() === 0, 'no Review and send before every direction is answered');
  ok(await p.locator('.cp-st-meter').innerText().then(t => t.trim() === '0 of 3 reviewed'), 'the stage meter reads "0 of 3 reviewed"');

  /* Approve A: one decide body, Saved, the primary moves on, the page behind follows. */
  await p.locator('.cp-st-approve').click(); await savedSaid(p);
  ok(S.posts.length === 1 && same(S.posts[0], { action: 'decide', directionId: 'rA', status: 'approved', note: '' }), `Approve posts exactly one decide body (${JSON.stringify(S.posts)})`);
  const sv = await p.locator('.cp-st-saved').evaluate(e => ({ role: e.getAttribute('role'), live: e.getAttribute('aria-live'), text: e.textContent.trim() }));
  ok(sv.role === 'status' && sv.live === 'polite' && sv.text === 'Saved', `the saved region is role=status, polite, and says "${sv.text}"`);
  ok(await p.evaluate(() => !document.querySelector('.cp-st-next').classList.contains('cp-btn--ghost')), 'Next direction becomes the primary once A is answered');
  const afterA = await stageInfo(p);
  ok(afterA.dots[0].state === 'approved' && afterA.dots[0].label === 'Direction A, Approved', 'dot A turns to approved with its aria-label');
  if (wide) ok(afterA.chip === 'approved', 'the panel chip reads approved'); else ok(await p.locator('.cp-st-approve').getAttribute('aria-pressed') === 'true', 'the dock shows Approve pressed');
  ok(await p.locator('.cp-st-meter').innerText().then(t => t.trim() === '1 of 3 reviewed'), 'the stage meter reads "1 of 3 reviewed"');
  await esc(p);
  ok(await barText(p) === '1 of 3 reviewed', 'the bottom bar behind the stage reads "1 of 3 reviewed"');
  ok(await p.locator('#cp-d-rA .cp-chip[data-chip="approved"]').count() === 1, 'the section behind shows the Approved chip');
  ok(await p.locator('#cp-d-rA .cp-main .cp-cue--compact').count() === 1, 'the section behind now carries the compact cue');

  /* Needs changes on B: empty is refused locally, then a note posts once. */
  await openAt(p, 1);
  await p.locator('.cp-st-changes').click();
  await p.locator('.cp-st-note').waitFor();
  const fsz = await p.locator('.cp-st-note').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  ok(fsz >= 16, `the note textarea is ${fsz}px (16px or more, so a phone does not zoom)`);
  ok(await p.evaluate(() => document.activeElement?.classList.contains('cp-st-note')), 'the textarea has focus when the editor opens');
  const before = S.posts.length;
  await p.locator('.cp-st-save').click();
  await p.locator('.cp-stage .cp-error[role="alert"]').waitFor();
  ok((await p.locator('.cp-stage .cp-error[role="alert"]').innerText()).trim() === 'Say what you would change first.' && S.posts.length === before, 'an empty note shows "Say what you would change first." and posts nothing');
  await p.locator('.cp-st-note').fill('Make the phone number bigger');
  await p.locator('.cp-st-save').click(); await savedSaid(p);
  ok(S.posts.length === before + 1 && same(S.posts.at(-1), { action: 'decide', directionId: 'rB', status: 'changes', note: 'Make the phone number bigger' }), `a note posts once (${JSON.stringify(S.posts.at(-1))})`);
  ok(await p.locator('.cp-st-editor').count() === 0 && await p.locator('.cp-stage .cp-error[role="alert"]').count() === 0, 'the editor and the error close after a saved note');
  ok(await p.locator('.cp-stage .cp-rv-note').first().innerText().then(t => t.includes('Make the phone number bigger')), 'the saved note reads back in the panel');
  /* The Saved flash ends by itself (about 4 s). */
  const cleared = await p.waitForFunction(() => !/Saved/.test(document.querySelector('.cp-st-saved')?.textContent || ''), null, { timeout: 7000 }).then(() => true, () => false);
  ok(cleared, 'the Saved flash clears on its own (about 4 seconds)');

  /* Next direction from B lands on C (the only one still open), and Review and send appears with the last answer. */
  await p.locator('.cp-st-next').click();
  ok(await dirLetterNow(p) === 'C', 'Next direction from B lands on C, the next one that needs an answer');
  ok(await p.locator('.cp-st-send').count() === 0, 'Review and send is still absent with one direction open');
  await p.locator('.cp-st-approve').click(); await savedSaid(p);
  ok(await p.locator('.cp-st-send').count() === 1 && /Review and send/.test(await p.locator('.cp-st-send').innerText()), 'Review and send appears once the last open direction is answered');
  ok(await p.evaluate(() => !document.querySelector('.cp-st-send').classList.contains('cp-btn--ghost') && document.querySelector('.cp-st-next').classList.contains('cp-btn--ghost')), 'Review and send is the primary; Next direction steps back to secondary');
  /* With nothing open Next goes to the next in order, and wraps. */
  await p.locator('.cp-st-next').click();
  ok(await dirLetterNow(p) === 'D', 'with nothing open, Next direction from C goes to D, the next in order');
  const ref = await p.evaluate(() => ({ ref: document.querySelector('.cp-stage .cp-ref')?.textContent?.trim() || '', approve: !!document.querySelector('.cp-st-approve'), changes: !!document.querySelector('.cp-st-changes'), pass: !!document.querySelector('.cp-st-pass'), chip: document.querySelector('.cp-stage .cp-chip')?.dataset.chip || '' }));
  ok(/^For reference\./.test(ref.ref) && !ref.approve && !ref.changes && !ref.pass, `the For reference direction shows .cp-ref ("${ref.ref}") and no decision button`);
  await p.locator('.cp-st-prev').click();
  ok(await dirLetterNow(p) === 'C', 'Previous direction from D goes back to C');
  await p.locator('.cp-st-next').click();
  await p.locator('.cp-st-next').click();
  ok(await dirLetterNow(p) === 'A', 'Next direction from the last one wraps to A');
  ok(await p.locator('.cp-st-prev').isDisabled(), 'Previous direction is disabled on the first direction');
  await p.locator('.cp-st-dot[data-dir="3"]').click();
  ok(await dirLetterNow(p) === 'D' && await p.locator('.cp-stage .cp-ref').count() === 1, 'the For reference direction is reachable by its dot');

  /* The summary sheet sits above the stage; Send closes everything and the thanks line shows. */
  await p.locator('.cp-st-send').click();
  await p.locator('.cp-summary').waitFor();
  const z = await p.evaluate(() => ({ stage: +getComputedStyle(document.querySelector('.cp-stage')).zIndex, wrap: +getComputedStyle(document.querySelector('.cp-panel-wrap')).zIndex, top: (() => { const r = document.querySelector('.cp-summary').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + 40); return !!e?.closest('.cp-panel-wrap'); })(), stageStill: !!document.querySelector('.cp-stage') }));
  ok(z.stage === 70 && z.wrap === 80 && z.top && z.stageStill, `the summary sheet (z ${z.wrap}) opens above the stage (z ${z.stage}) and the stage stays under it`);
  await p.locator('.cp-summary .cp-btn:not(.cp-btn--ghost)').click();
  await stageGone(p);
  await p.locator('.cp-thanks').waitFor();
  ok(S.posts.at(-1)?.action === 'submit' && S.posts.filter(x => x.action === 'submit').length === 1, 'Send posts one submit');
  ok((await p.locator('.cp-thanks').innerText()).includes('Got it, thank you'), 'the stage closed and the thanks line shows');
  ok(await p.evaluate(() => document.documentElement.style.overflow !== 'hidden'), 'the page scrolls again after sending');
  ok(S.errors.length === 0, `no page errors in the Review each walk${S.errors.length ? ' (' + S.errors[0] + ')' : ''}`);
  await S.ctx.close();

  /* Wrap: from C with A and B open, Next goes to A (wrapping past the reference D), then B. */
  const W = await session({ width, token: TOK.review }); await W.open();
  await openAt(W.page, 2);
  await W.page.locator('.cp-st-next').click();
  ok(await dirLetterNow(W.page) === 'A', 'Next direction from the last open direction wraps to the earlier open one (C to A, skipping the reference D)');
  await W.page.locator('.cp-st-next').click();
  ok(await dirLetterNow(W.page) === 'B', 'and then goes on to B');
  await W.ctx.close();

  /* Pass shows only when the set allows it. */
  const Pa = await session({ width, token: TOK.partly }); await Pa.open();
  await openAt(Pa.page, 2);
  ok(await Pa.page.locator('.cp-st-pass').count() === 1 && (await Pa.page.locator('.cp-st-pass').innerText()).trim() === 'Not this one', 'allowPass true: Not this one is offered');
  await Pa.page.locator('.cp-st-pass').click(); await savedSaid(Pa.page);
  ok(same(Pa.posts.at(-1), { action: 'decide', directionId: 'rC', status: 'pass', note: '' }) && await Pa.page.locator('.cp-st-pass').getAttribute('aria-pressed') === 'true', 'Not this one posts a pass and shows pressed');
  ok(await Pa.page.locator('.cp-st-send').count() === 1, 'answering the last open direction of a partly answered set offers Review and send');
  await Pa.ctx.close();

  /* A failed save keeps the stage honest: an error under the buttons, nothing marked saved. */
  const F = await session({ width, token: TOK.review }); await F.open();
  await openAt(F.page, 0);
  F.door.failNext = 1;
  await F.page.locator('.cp-st-approve').click();
  await F.page.locator('.cp-stage .cp-error[role="alert"]').waitFor();
  ok((await F.page.locator('.cp-stage .cp-error[role="alert"]').innerText()).includes('did not save') && (await F.page.locator('.cp-st-saved').innerText()).trim() === '', 'a failed save shows "That did not save" and no Saved');
  await F.ctx.close();
}

/* ── 6 Pick one, decided, submitted and present ── */
async function section6(width) {
  console.log(`── 6 Pick one, locked, present, ${width}px ──`);
  /* Approve through the page's own panel, above the stage. */
  const S = await session({ width, token: TOK.pick }); const p = S.page; await S.open();
  await openAt(p, 0);
  ok(await p.locator('.cp-st-approve').count() === 1 && await p.locator('.cp-st-ask').count() === 1 && await p.locator('.cp-st-changes').count() === 0, 'Pick one: Approve and Ask for changes, no per direction answer buttons');
  ok((await p.locator('.cp-st-ask').innerText()).trim() === 'Ask for changes', 'the second button reads "Ask for changes"');
  await p.locator('.cp-st-approve').click();
  await p.locator('.cp-panel-wrap').waitFor();
  const z = await p.evaluate(() => { const r = document.querySelector('.cp-panel').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + 30); return { stage: +getComputedStyle(document.querySelector('.cp-stage')).zIndex, wrap: +getComputedStyle(document.querySelector('.cp-panel-wrap')).zIndex, over: !!e?.closest('.cp-panel-wrap'), heading: document.querySelector('.cp-panel-h')?.textContent, stageStill: !!document.querySelector('.cp-stage') }; });
  ok(z.wrap > z.stage && z.over && z.stageStill && /Direction A it is\?/.test(z.heading), `Approve opens the page's approve panel ("${z.heading}") above the stage (z ${z.wrap} over ${z.stage})`);
  await p.locator('.cp-panel button[type="submit"]').click();
  await stageGone(p);
  ok(S.posts.length === 1 && S.posts[0].action === 'approve' && S.posts[0].directionId === 'dA', `confirming posts one approve body (${JSON.stringify(S.posts)})`);
  await p.locator('.cp-thanks').waitFor();
  ok((await p.locator('.cp-thanks').innerText()).includes('You picked Direction A'), 'the stage closed and the banner "You picked Direction A" shows');
  const toastZ = await p.locator('.cp-toast').evaluate(e => +getComputedStyle(e).zIndex);
  ok(toastZ === 90 && toastZ > z.wrap, `the toast sits above the panels (z ${toastZ} over ${z.wrap})`);

  /* Ask for changes opens the change panel, also above the stage. */
  const A = await session({ width, token: TOK.pick }); const q = A.page; await A.open();
  await openAt(q, 1);
  await q.locator('.cp-st-ask').click();
  await q.locator('.cp-panel-wrap').waitFor();
  const ch = await q.evaluate(() => ({ heading: document.querySelector('.cp-panel-h')?.textContent, ta: !!document.querySelector('.cp-panel textarea'), stage: !!document.querySelector('.cp-stage') }));
  ok(/What should change on Direction B\?/.test(ch.heading) && ch.ta && ch.stage, `Ask for changes opens the change panel ("${ch.heading}") with the stage under it`);
  /* Extra: Escape inside a panel above the stage closes the panel only. */
  await q.keyboard.press('Escape');
  await q.waitForTimeout(250);
  const afterEsc = await q.evaluate(() => ({ panel: !!document.querySelector('.cp-panel-wrap'), stage: !!document.querySelector('.cp-stage') }));
  ok(!afterEsc.panel && afterEsc.stage, `Escape on the panel above the stage closes the panel and leaves the stage open (panel ${afterEsc.panel ? 'still open' : 'closed'}, stage ${afterEsc.stage ? 'open' : 'closed'})`);
  await A.ctx.close();

  /* A decided Pick one set: nothing to decide. */
  const D = await session({ width, token: TOK.approved }); const d = D.page; await D.open();
  await openAt(d, 0);
  const dd = await d.evaluate(() => ({ approve: document.querySelectorAll('.cp-st-approve').length, ask: document.querySelectorAll('.cp-st-ask').length, changes: document.querySelectorAll('.cp-st-changes').length, done: document.querySelector('.cp-stage .cp-beat-done')?.textContent || '', chip: document.querySelector('.cp-stage .cp-chip')?.dataset.chip || '', dot: document.querySelector('.cp-st-dot')?.dataset.state }));
  ok(dd.approve === 0 && dd.ask === 0 && dd.changes === 0, 'a decided Pick one set shows no decision button');
  ok(/You picked Direction A/.test(dd.done) && dd.chip === 'picked' && dd.dot === 'picked', `and reads back the pick instead (chip ${dd.chip}, dot ${dd.dot}, "${dd.done}")`);
  await D.ctx.close();

  /* Submitted Review each: the chip and the note read back. */
  const U = await session({ width, token: TOK.submitted }); const u = U.page; await U.open();
  const pubU = expected(TOK.submitted);
  const rows = [];
  await openAt(u, 0);
  for (let k = 0; k < 4; k++) {
    if (k > 0) await u.locator('.cp-st-dot').nth(k).click();
    rows.push(await u.evaluate(() => ({ btn: document.querySelectorAll('.cp-st-approve, .cp-st-changes, .cp-st-pass, .cp-st-ask').length, chip: document.querySelector('.cp-stage .cp-chip')?.dataset.chip || '', note: document.querySelector('.cp-stage .cp-rv-note')?.textContent || '', send: document.querySelectorAll('.cp-st-send').length, ref: !!document.querySelector('.cp-stage .cp-ref') })));
  }
  ok(rows.every(r => r.btn === 0 && r.send === 0), 'a submitted set shows no decision button and no Review and send');
  ok(rows.slice(0, 3).every((r, k) => r.chip === pubU.directions[k].decision.status), `the chip reads back each answer (${rows.map(r => r.chip || '-').join(', ')})`);
  ok(rows[1].note.includes('Can the phone number be bigger?') && rows[3].ref, 'the changes note reads back, and the reference direction stays for reference');
  await U.ctx.close();

  /* Present mode: navigation only. */
  for (const [mode, token] of [['Pick one', TOK.pick], ['Review each', TOK.partly]]) {
    const P = await session({ width, token }); const pp = P.page; await P.open('?present=1');
    await openAt(pp, 0);
    const pm = await pp.evaluate(() => ({ btn: document.querySelectorAll('.cp-st-approve, .cp-st-changes, .cp-st-pass, .cp-st-ask, .cp-st-send, .cp-st-save').length, chip: document.querySelectorAll('.cp-st-chip .cp-chip, .cp-st-panel .cp-chip').length, prev: !!document.querySelector('.cp-st-prev'), next: !!document.querySelector('.cp-st-next'), dots: document.querySelectorAll('.cp-st-dot').length, meter: document.querySelector('.cp-st-meter')?.textContent?.trim() || '' }));
    ok(pm.btn === 0 && pm.chip === 0, `${mode}, present: no decision control and no chip in the stage`);
    ok(pm.prev && pm.next && pm.dots === expected(token).directions.length && pm.meter === '', `${mode}, present: the stage keeps Previous, Next and the dots, with no progress count`);
    await P.ctx.close();
  }
}

/* ── 7 Escape, focus, trap, scroll lock, typing ── */
async function section7(width) {
  console.log(`── 7 keyboard and scroll, ${width}px ──`);
  const S = await session({ width, token: TOK.review }); const p = S.page; await S.open();
  /* Focus returns to the cue that opened it. */
  await openAt(p, 1);
  ok(await p.evaluate(() => document.activeElement?.classList.contains('cp-st-exit')), 'the stage takes focus on open (Exit)');
  await esc(p);
  await p.waitForFunction(() => document.activeElement?.classList.contains('cp-main'));
  ok(await p.evaluate(() => document.activeElement?.closest('.cp-dir')?.id === 'cp-d-rB'), 'Escape closes the stage and focus is back on the cue (.cp-main) that opened it');
  /* From the intro button. */
  await p.locator('.cp-intro-fs').click(); await stageUp(p);
  await esc(p);
  await p.waitForTimeout(150);
  const fromIntro = await p.evaluate(() => ({ intro: document.activeElement?.classList.contains('cp-intro-fs'), cls: String(document.activeElement?.className).split(' ')[0], dir: document.activeElement?.closest('.cp-dir')?.id || '' }));
  ok(fromIntro.intro, `closing on direction A after opening from the intro button puts focus back on .cp-intro-fs (focus is on ${fromIntro.cls}${fromIntro.dir ? ' in ' + fromIntro.dir : ''})`);

  /* The trap. */
  await openAt(p, 0);
  let outside = 0; let sample = '';
  for (let k = 0; k < 40; k++) { await p.keyboard.press('Tab'); const inside = await p.evaluate(() => !!document.activeElement?.closest('.cp-stage')); if (!inside) { outside++; sample = await p.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className); } }
  for (let k = 0; k < 20; k++) { await p.keyboard.press('Shift+Tab'); const inside = await p.evaluate(() => !!document.activeElement?.closest('.cp-stage')); if (!inside) { outside++; sample = await p.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className); } }
  ok(outside === 0, `Tab and Shift+Tab (60 presses) never leave the stage${outside ? ` (${outside} outside, e.g. ${sample})` : ''}`);
  await esc(p);

  /* Scroll lock: the page keeps its place and gets its overflow back. */
  await p.evaluate(() => { document.documentElement.style.overflow = 'auto'; document.body.style.overflow = ''; window.scrollTo(0, 500); });
  await p.locator('.cp-dir').nth(1).locator('.cp-main').click(); await stageUp(p);
  const y0 = await scrollSettled(p);
  const lock = await p.evaluate(() => ({ html: document.documentElement.style.overflow, body: document.body.style.overflow }));
  ok(lock.html === 'hidden', `documentElement overflow is "hidden" while the stage is open (${lock.html})`);
  await p.mouse.move(width / 2, 300);
  await p.mouse.wheel(0, 700); await p.keyboard.press('End'); await p.keyboard.press('PageDown'); await p.keyboard.press('ArrowDown');
  await p.waitForTimeout(250);
  const y1 = await p.evaluate(() => window.scrollY);
  ok(y1 === y0, `window.scrollY is unchanged after wheel and keys (${y0} then ${y1})`);
  await esc(p);
  const back = await p.evaluate(() => ({ html: document.documentElement.style.overflow, body: document.body.style.overflow, y: window.scrollY }));
  ok(back.html === 'auto' && back.body === '', `the previous overflow is restored after close (html "${back.html}", body "${back.body}")`);
  ok(Math.abs(back.y - y0) <= 2, `the page is still where it was after close (${y0} then ${back.y})`);

  /* Typing in the note while the parent re-renders (reduced motion toggling re-renders the page component). */
  await openAt(p, 0);
  await p.locator('.cp-st-changes').click();
  await p.locator('.cp-st-note').waitFor();
  const chunk = '0123456789';
  await p.keyboard.type(chunk, { delay: 5 });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  await p.keyboard.type(chunk, { delay: 5 });
  await p.emulateMedia({ reducedMotion: 'no-preference' });
  await p.waitForFunction(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  await p.keyboard.type(chunk, { delay: 5 });
  const typed = await p.evaluate(() => ({ v: document.querySelector('.cp-st-note')?.value || '', focus: document.activeElement?.classList.contains('cp-st-note') }));
  ok(typed.v === chunk.repeat(3) && typed.focus, `30 typed characters all land in the note across parent re-renders, focus kept (${typed.v.length} characters)`);
  await esc(p);
  ok(S.errors.length === 0, `no page errors in the keyboard walk${S.errors.length ? ' (' + S.errors[0] + ')' : ''}`);
  await S.ctx.close();
}

/* ── 8 Layouts and gestures ── */
const touchSwipe = (p, sel, dx, dy = 0) => p.evaluate(({ sel, dx, dy }) => {
  const el = document.querySelector(sel); const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2; const y = r.top + r.height / 2;
  const mk = (cx, cy) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
  const fire = (type, list, changed) => el.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: list, targetTouches: list, changedTouches: changed }));
  fire('touchstart', [mk(x, y)], [mk(x, y)]);
  fire('touchend', [], [mk(x + dx, y + dy)]);
}, { sel, dx, dy });
const imageNow = async (p) => (await stageInfo(p)).pressed;

async function section8Phone() {
  console.log('── 8 phone layout, 390px ──');
  const S = await session({ width: 390, token: TOK.partly }); const p = S.page; await S.open();
  await openAt(p, 2); // C: open, three answer buttons
  const g = await p.evaluate(() => {
    const s = document.querySelector('.cp-stage'); const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const dock = document.querySelector('aside.cp-st-panel--dock'); const btns = [...document.querySelectorAll('.cp-st-decide .cp-st-btn')].map(r);
    return { layout: s.dataset.layout, stage: r(s), dock: dock ? r(dock) : null, media: r(document.querySelector('.cp-st-media')), btns, vw: innerWidth, vh: innerHeight, sw: s.scrollWidth, cw: s.clientWidth, sh: s.scrollHeight, ch: s.clientHeight, docSw: document.documentElement.scrollWidth, docCw: document.documentElement.clientWidth, panelIsAside: !!document.querySelector('aside.cp-st-panel') };
  });
  ok(g.layout === 'phone' && g.panelIsAside && g.dock, `data-layout is phone at 390 and the dock is an aside.cp-st-panel--dock`);
  ok(Math.abs(g.stage.l) < 1 && Math.abs(g.stage.w - g.vw) < 1 && Math.abs(g.stage.t) < 1 && g.stage.b <= g.vh + 1 && g.sh <= g.ch + 1, `100% of the stage fits the viewport (${Math.round(g.stage.w)}x${Math.round(g.stage.h)} in ${g.vw}x${g.vh}, scrollHeight ${g.sh} vs ${g.ch})`);
  ok(g.sw <= g.cw && g.docSw <= g.docCw, 'no sideways overflow on the phone stage or the page');
  ok(Math.abs(g.dock.b - g.stage.b) <= 1 && g.dock.t > g.media.t, `the dock sits at the bottom of the stage (dock bottom ${Math.round(g.dock.b)}, stage bottom ${Math.round(g.stage.b)})`);
  /* The specification says 48px tall. The rule used here is a 48px minimum (border box); an exact 48 is reported as a note when it differs. */
  ok(g.btns.length === 3 && g.btns.every(b => b.h >= 47.5), `the three decision buttons are at least 48px tall (${g.btns.map(b => b.h).join(', ')})`);
  if (g.btns.some(b => Math.abs(b.h - 48) > 0.6)) note(`the phone decision buttons render ${g.btns.map(b => b.h).join(', ')}px tall, not exactly 48 (min-height 48px on a content-box button plus its 1px borders)`);
  ok(g.btns.every(b => Math.abs(b.w - g.btns[0].w) < 1.5) && g.btns.every(b => Math.abs(b.t - g.btns[0].t) < 1), `they are equal width in one row (${g.btns.map(b => Math.round(b.w)).join(', ')})`);
  await esc(p);
  /* The two button set too. */
  const R2 = await session({ width: 390, token: TOK.review }); await R2.open(); await openAt(R2.page, 0);
  const two = await R2.page.evaluate(() => [...document.querySelectorAll('.cp-st-decide .cp-st-btn')].map(e => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, t: b.top }; }));
  ok(two.length === 2 && two.every(b => b.h >= 47.5 && Math.abs(b.w - two[0].w) < 1.5 && Math.abs(b.t - two[0].t) < 1), `two buttons: at least 48px tall, equal width, one row (${two.map(b => Math.round(b.w) + 'x' + Math.round(b.h)).join(', ')})`);
  await R2.ctx.close();

  /* About this direction: collapsed by default, expands, capped at 40% of the height. */
  const ab = p.locator('.cp-st-about-btn');
  await openAt(p, 0);
  ok(await ab.count() === 1 && await ab.getAttribute('aria-expanded') === 'false' && await p.locator('.cp-st-about').count() === 0, 'the about text is collapsed by default (aria-expanded false, no text in the dock)');
  await ab.click();
  ok(await ab.getAttribute('aria-expanded') === 'true' && await p.locator('.cp-st-about').count() === 1, 'the about toggle expands it (aria-expanded true)');
  const hAbout = await p.locator('.cp-st-about').evaluate(e => e.getBoundingClientRect().height);
  ok(hAbout <= 0.4 * 844 + 1, `the expanded about text is capped at 40% of the viewport (${Math.round(hAbout)}px of ${Math.round(0.4 * 844)}px)`);
  await ab.click();
  ok(await ab.getAttribute('aria-expanded') === 'false', 'a second tap collapses it again');
  await esc(p);

  /* A long about text really hits the cap. */
  S.state.directions[0].rationale = 'A long reason. '.repeat(120);
  await p.reload(); await p.waitForSelector('.cp-main');
  await openAt(p, 0); await ab.click();
  const capped = await p.locator('.cp-st-about').evaluate(e => ({ h: e.getBoundingClientRect().height, sh: e.scrollHeight, oy: getComputedStyle(e).overflowY }));
  ok(capped.h <= 0.4 * 844 + 1 && capped.sh > capped.h && /auto|scroll/.test(capped.oy), `a very long about text stops at 40% and scrolls inside (${Math.round(capped.h)}px, content ${capped.sh}px)`);
  await esc(p);

  /* Gestures and images on a multi image direction (Review each B has two images; the Pick one set has 4 and 8). */
  const T = await session({ width: 390, token: TOK.pick }); const t = T.page; await T.open();
  await openAt(t, 1, 1); // image 2 of 4
  ok(await imageNow(t) === 1, 'the stage opens on image 2 of 4');
  await touchSwipe(t, '.cp-st-stage', -80);
  ok(await imageNow(t) === 2, 'a swipe of 80px (finger moving left) on the picture moves to the next image');
  await touchSwipe(t, '.cp-st-stage', 80);
  ok(await imageNow(t) === 1, 'a swipe of 80px the other way moves back');
  await touchSwipe(t, '.cp-st-stage', -30);
  ok(await imageNow(t) === 1, 'a swipe under 40px does nothing');
  await touchSwipe(t, '.cp-st-stage', -60, 90);
  ok(await imageNow(t) === 1, 'a mostly vertical swipe does nothing');
  await touchSwipe(t, '.cp-st-thumbs', -80);
  ok(await imageNow(t) === 1, 'a swipe on the thumbnails does not move the picture');
  const chev = await t.evaluate(() => ({ prev: !!document.querySelector('.cp-st-chev--prev'), next: !!document.querySelector('.cp-st-chev--next') }));
  ok(chev.prev && chev.next, 'chevrons exist when a direction has more than one image');
  await t.locator('.cp-st-chev--next').click();
  ok(await imageNow(t) === 2, 'the next chevron moves to the next image');
  await T.ctx.close();
  await S.ctx.close();
}

async function section8Wide() {
  console.log('── 8 wide layout, 1280px ──');
  const S = await session({ width: 1280, token: TOK.pick }); const p = S.page; await S.open();
  await openAt(p, 1);
  const g = await p.evaluate(() => { const s = document.querySelector('.cp-stage'); const a = document.querySelector('aside.cp-st-panel'); const b = a.getBoundingClientRect(); const m = document.querySelector('.cp-st-media').getBoundingClientRect(); return { layout: s.dataset.layout, dock: a.classList.contains('cp-st-panel--dock'), w: b.width, right: b.right, vw: innerWidth, mediaW: m.width, tops: document.querySelectorAll('.cp-st-top .cp-st-dot').length, label: document.querySelector('.cp-st-label').textContent.trim() }; });
  ok(g.layout === 'wide' && !g.dock, 'data-layout is wide at 1280 and the panel is not a dock');
  ok(g.w >= 340 && g.w <= 400 && Math.abs(g.right - g.vw) < 1, `the right panel is ${Math.round(g.w)}px wide (340 to 400) and sits on the right edge`);
  ok(g.label === 'Direction B of 3' && g.tops === 3, `wide label "${g.label}" and the dots in the top bar`);
  for (const [w, h] of [[900, 800], [1000, 800], [1920, 1000]]) {
    await p.setViewportSize({ width: w, height: h });
    await p.waitForFunction((w) => document.querySelector('.cp-stage')?.dataset.layout === 'wide' && Math.round(document.querySelector('aside.cp-st-panel').getBoundingClientRect().width) > 0, w);
    const pw = await p.evaluate(() => document.querySelector('aside.cp-st-panel').getBoundingClientRect().width);
    ok(pw >= 340 && pw <= 400, `the panel stays 340 to 400 at ${w}px (${Math.round(pw)}px)`);
  }
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.waitForFunction(() => document.querySelector('aside.cp-st-panel')?.getBoundingClientRect().width > 0);
  /* Arrow keys move between images on a computer. */
  ok(await imageNow(p) === 0 && await p.locator('.cp-st-chev--prev').isDisabled(), 'on image 1 the previous chevron is disabled');
  await p.keyboard.press('ArrowRight');
  ok(await imageNow(p) === 1, 'ArrowRight moves to the next image');
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('ArrowLeft');
  ok(await imageNow(p) === 1, 'ArrowLeft moves back');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  ok(await imageNow(p) === 0, 'the arrows stop at the first image');
  await p.locator('.cp-st-thumb').nth(3).click();
  ok(await imageNow(p) === 3 && await p.locator('.cp-st-chev--next').isDisabled(), 'a thumbnail jumps to that image, and the next chevron is disabled on the last');
  await p.keyboard.press('ArrowRight');
  ok(await imageNow(p) === 3, 'ArrowRight does nothing past the last image');
  /* A one image direction has no chevrons. */
  await p.locator('.cp-st-dot[data-dir="0"]').click();
  const one = await stageInfo(p);
  ok(one.chevs === 0 && one.thumbs === 0, 'a one image direction shows no chevrons and no thumbnails');
  await S.ctx.close();
}

async function section8Rail() {
  console.log('── 8 rail layout, 844x390 ──');
  const S = await session({ width: 844, height: 390, touch: true, token: TOK.partly }); const p = S.page; await S.open();
  await openAt(p, 2);
  const g = await p.evaluate(() => { const s = document.querySelector('.cp-stage'); const d = document.querySelector('aside.cp-st-panel--dock'); const b = d.getBoundingClientRect(); const sr = s.getBoundingClientRect(); return { layout: s.dataset.layout, left: b.left, right: b.right, bottom: b.bottom, vw: innerWidth, vh: innerHeight, sw: s.scrollWidth, cw: s.clientWidth, docSw: document.documentElement.scrollWidth, docCw: document.documentElement.clientWidth, stageH: sr.height, dots: document.querySelectorAll('.cp-st-panel--dock .cp-st-dot').length, topDots: document.querySelectorAll('.cp-st-top .cp-st-dot').length }; });
  ok(g.layout === 'rail', `data-layout is rail at 844x390 (${g.layout})`);
  ok(g.left > g.vw / 2 && Math.abs(g.right - g.vw) < 1 && g.bottom <= g.vh + 1, `the dock is a rail on the right (${Math.round(g.left)} to ${Math.round(g.right)} of ${g.vw})`);
  ok(g.dots === 4 && g.topDots === 0, 'the dots live in the rail');
  ok(g.sw <= g.cw && g.docSw <= g.docCw && g.stageH <= g.vh + 1, 'the rail stage fits the window with no sideways overflow');
  await S.ctx.close();
}

/* ── 9 Targets and overflow ── */
/* The rule: every visible interactive element inside the stage (button, link, input, textarea, select, role=button, tabindex 0) has a
 * bounding box of at least 44 by 44 CSS pixels (a half pixel of rounding is allowed). */
const smallTargets = (p) => p.evaluate(() => [...document.querySelectorAll('.cp-stage button, .cp-stage a[href], .cp-stage input, .cp-stage textarea, .cp-stage select, .cp-stage [role="button"], .cp-stage [tabindex="0"]')]
  .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; })
  .map(e => ({ n: e.tagName.toLowerCase() + '.' + String(e.className).split(' ').slice(0, 2).join('.'), r: e.getBoundingClientRect() }))
  .filter(x => x.r.width < 43.5 || x.r.height < 43.5).map(x => `${x.n} ${x.r.width.toFixed(1)}x${x.r.height.toFixed(1)}`));
const imgEager = (p) => p.evaluate(() => [...document.querySelectorAll('.cp-stage img.cp-st-img')].map(i => i.getAttribute('loading')));

async function section9Targets(label, opts) {
  console.log(`── 9 targets, ${label} ──`);
  const S = await session(opts); const p = S.page; await S.open();
  const pub = expected(opts.token);
  const offenders = [];
  for (let dir = 0; dir < pub.directions.length; dir++) {
    if (dir > 0) await esc(p);
    await openAt(p, dir);
    offenders.push(...(await smallTargets(p)).map(x => `${letter(dir)}: ${x}`));
    /* The editor and the about text are states with controls of their own. */
    if (await p.locator('.cp-st-changes').count()) { await p.locator('.cp-st-changes').click(); await p.locator('.cp-st-editor').waitFor(); offenders.push(...(await smallTargets(p)).map(x => `${letter(dir)} editor: ${x}`)); await p.locator('.cp-st-cancel').click(); }
    if (await p.locator('.cp-st-about-btn').count()) { await p.locator('.cp-st-about-btn').click(); offenders.push(...(await smallTargets(p)).map(x => `${letter(dir)} about: ${x}`)); }
    const eager = await imgEager(p);
    ok(eager.length === 1 && eager[0] === 'eager', `${label}: the active image of direction ${letter(dir)} is loading="eager" (${JSON.stringify(eager)})`);
  }
  ok(offenders.length === 0, `${label}: every interactive element in the stage is at least 44x44${offenders.length ? ' (offenders: ' + [...new Set(offenders)].join('; ') + ')' : ''}`);
  /* After moving to another image and direction the active image stays eager. */
  const m = await p.evaluate(() => document.querySelectorAll('.cp-st-chev--next').length);
  if (m) { await p.locator('.cp-st-chev--next').click(); ok(same(await imgEager(p), ['eager']), `${label}: the next image is loading="eager" too`); }
  await S.ctx.close();
}

async function section9Overflow() {
  console.log('── 9 overflow sweep ──');
  for (const width of [320, 390, 430, 768, 1280]) {
    for (const token of [TOK.pick, TOK.partly]) {
      const name = token === TOK.pick ? 'Pick one' : 'Review each';
      const S = await session({ width, token }); const p = S.page; await S.open();
      const probe = () => p.evaluate(() => { const s = document.querySelector('.cp-stage'); const d = document.documentElement; return { page: d.scrollWidth - d.clientWidth, body: document.body.scrollWidth - d.clientWidth, stage: s ? s.scrollWidth - s.clientWidth : null, over: s ? [...s.querySelectorAll('*')].filter(e => { if (e.closest('.cp-st-thumbs')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]).slice(0, 4) : [] }; });
      const closed = await probe();
      ok(closed.page <= 0 && closed.body <= 0, `${width}px ${name}, stage closed: no horizontal overflow (page ${closed.page}, body ${closed.body})`);
      /* The long caption of Pick one B image 4, the editor open on Review each. */
      if (token === TOK.pick) await openAt(p, 1, 3); else { await openAt(p, 2); await p.locator('.cp-st-changes').click(); await p.locator('.cp-st-note').fill('x'.repeat(200)); }
      const opened = await probe();
      ok(opened.page <= 0 && opened.stage <= 0 && opened.over.length === 0, `${width}px ${name}, stage open: no horizontal overflow (page ${opened.page}, stage ${opened.stage}${opened.over.length ? ', past the edge: ' + opened.over.join(', ') : ''})`);
      await S.ctx.close();
    }
  }
}

/* ── 10 Reduced motion ── */
async function section10(width) {
  console.log(`── 10 reduced motion, ${width}px ──`);
  for (const [mode, token] of [['Pick one', TOK.pick], ['Review each', TOK.partly]]) {
    const S = await session({ width, token, reduced: true }); const p = S.page; await S.open();
    const hidden = await p.evaluate(() => [...document.querySelectorAll('.cp-sec')].filter(s => getComputedStyle(s).opacity !== '1').length);
    ok(hidden === 0, `${mode}: under reduced motion every section is visible from the first paint`);
    const pagePass = async (where) => p.evaluate(() => [...document.querySelectorAll('.cp-cue, .cp-stage, .cp-stage *')].map(e => ({ t: getComputedStyle(e).transitionDuration, a: getComputedStyle(e).animationDuration, n: e.tagName.toLowerCase() + '.' + String(e.className?.baseVal ?? e.className).split(' ')[0] })).filter(x => window.__mv(x.t) || window.__mv(x.a)).map(x => `${x.n} ${x.t} ${x.a}`));
    ok((await pagePass()).length === 0, `${mode}: no cue has a transition or animation (stage closed)`);
    await openAt(p, 0);
    for (const step of ['open', 'next direction', 'an answer']) {
      if (step === 'next direction') await p.locator('.cp-st-next').click();
      if (step === 'an answer' && await p.locator('.cp-st-approve').count()) { await p.locator('.cp-st-approve').click(); await p.waitForTimeout(150); }
      const moving = await pagePass();
      ok(moving.length === 0, `${mode}: nothing in .cp-stage or .cp-cue has a transition or animation duration after ${step}${moving.length ? ' (' + [...new Set(moving)].join('; ') + ')' : ''}`);
    }
    await S.ctx.close();
  }
}

/* ── 11 The cue over the lightest possible picture, measured on real pixels ── */
/* axe cannot judge text over a gradient (it reports it as incomplete), so the contrast is measured here: every picture is replaced by pure
 * white, the cue is screenshotted, and the typical background pixel around the title and the line is compared with the white text. */
async function section11(width) {
  console.log(`── 11 cue contrast on white, ${width}px ──`);
  const S = await session({ width, token: TOK.pick }); const p = S.page;
  const white = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="white"/></svg>';
  await p.route('**/*', (r) => (r.request().resourceType() === 'image' ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: white }) : r.fallback()));
  await S.open();
  await p.waitForFunction(() => { const i = document.querySelector('.cp-main-pic'); return i && i.complete && i.naturalWidth > 0; });
  await p.locator('.cp-main').first().scrollIntoViewIfNeeded();
  await p.waitForTimeout(300);
  for (const sel of ['.cp-cue-title', '.cp-cue-line']) {
    const box = await p.locator(sel).first().boundingBox();
    const png = (await p.screenshot({ clip: { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height: Math.ceil(box.height) } })).toString('base64');
    const r = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      const lum = (i) => 0.2126 * f(d[i]) + 0.7152 * f(d[i + 1]) + 0.0722 * f(d[i + 2]);
      const bg = []; let text = 0;
      /* Text pixels are the near white ones; the anti aliased edges between text and scrim are neither, so the background is the median of what is clearly darker than half. */
      for (let i = 0; i < d.length; i += 4) { const L = lum(i); if (L > 0.8) text++; else if (L < 0.6) bg.push(L); }
      bg.sort((a, b) => a - b);
      return { text, bgMax: bg.length ? bg[Math.floor(bg.length * 0.5)] : 1, n: bg.length };
    }, png);
    const contrast = 1.05 / (r.bgMax + 0.05);
    ok(r.text > 20 && r.n > 20 && contrast >= 4.5, `${width}px: ${sel} text is ${contrast.toFixed(1)}:1 against the scrim around it, over a pure white picture (needs 4.5:1; ${r.text} text pixels)`);
  }
  await S.ctx.close();
}

/* ── Run ── (ONLY=2,5 runs just those sections while working on one) */
const only = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (n) => only.length === 0 || only.includes(String(n));
const widths = (process.env.WIDTHS || '390,1280').split(',').map(Number);
for (const width of widths) {
  console.log(`\n════ ${width}px ════`);
  if (want(1)) await section1(width);
  if (want(2)) await section2(width);
  if (want(3)) await section3(width);
  if (want(4)) await section4(width);
  if (want(5)) await section5(width);
  if (want(6)) await section6(width);
  if (want(7)) await section7(width);
  if (want(9)) {
    await section9Targets(`${width}px Pick one`, { width, token: TOK.pick });
    await section9Targets(`${width}px Review each`, { width, token: TOK.partly });
  }
  if (want(10)) await section10(width);
  if (want(11)) await section11(width);
}
if (want(8) || want(9)) console.log('\n════ layouts ════');
if (want(8)) {
  await section8Phone();
  await section8Wide();
  await section8Rail();
}
if (want(9)) {
  await section9Targets('844x390 rail', { width: 844, height: 390, touch: true, token: TOK.partly });
  await section9Overflow();
}

await browser.close();
console.log(fails ? `\n${fails} FAILED:\n - ${failed.join('\n - ')}` : '\nall passed');
process.exit(fails ? 1 : 0);
