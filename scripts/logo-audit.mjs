#!/usr/bin/env node
/* The rendered checks for the logo rollout (Brand v3), against a built dist/ served on AUDIT_BASE.
 *
 *   1. LogoSpinner: the computed animation turns the icon once every 1.1 s, linear; under prefers-reduced-motion
 *      it does not rotate (a still icon with an opacity pulse); the parser painted splash is in the built
 *      dist/index.html, is there before any JS runs, and is gone after mount; Home's layout shift is 0.
 *   2. Every logo on Home, /start, a planner page, the admin login, and the admin sidebar open and collapsed, at 390
 *      and 1280: its box is at least the brand minimum, it is not stretched (ratio within 1 percent of the file's),
 *      its letters have 4.5:1 against the ground it sits on, and half the V cap height of clear space around it
 *      holds no other text, image or control.
 *   Screenshots go to OUT (default /tmp/logo-audit); CONTACT=docs/logo-rollout-contact-sheet.png writes the sheet.
 *
 *   npx vite preview --port 4331 &   node scripts/logo-audit.mjs */
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { mockRoutes } from './audit-fixtures.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4331';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const OUT = process.env.OUT || '/tmp/logo-audit';
mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

/* ── 1. the loading screen ───────────────────────────────────────── */
{
  ok(/class="[^"]*vz-splash/.test(readFileSync('dist/index.html', 'utf8')), 'the splash is in the built dist/index.html');
  const probe = async (reduce) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
    const p = await ctx.newPage();
    await p.route('**/assets/*.js', r => r.abort());
    await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const el = document.querySelector('.vz-splash'); const i = el?.querySelector('.lspin-icon'); const cs = i && getComputedStyle(i); return { before: !!el, name: cs?.animationName, dur: cs?.animationDuration, timing: cs?.animationTimingFunction, iter: cs?.animationIterationCount, bg: el && getComputedStyle(el).backgroundColor, pos: el && getComputedStyle(el).position }; });
    // sample the rotation: the icon's transform matrix at two moments
    const spin = await p.evaluate(async () => { const i = document.querySelector('.vz-splash .lspin-icon'); const m = () => getComputedStyle(i).transform; const a = m(); await new Promise(r => setTimeout(r, 275)); const b = m(); return { a, b }; });
    await ctx.close();
    return { ...r, ...spin };
  };
  const on = await probe(false), off = await probe(true);
  ok(on.before && on.name === 'lspin-turn' && on.dur === '1.1s' && on.timing === 'linear' && on.iter === 'infinite', `the parser painted splash rotates linear, 1.1 s, forever (${on.name} ${on.dur} ${on.timing})`);
  ok(on.a !== on.b, `the icon's transform changes over time (${on.a} to ${on.b})`);
  ok(on.pos === 'fixed' && on.bg !== 'rgba(0, 0, 0, 0)', 'the splash is a fixed layer on the ground color');
  ok(off.name === 'lspin-pulse' && (off.a === 'none' || off.a === off.b), `under reduced motion it does not rotate (${off.name}; transform ${off.a} then ${off.b})`);

  // After mount: the splash is gone, the React spinner is not on screen, nothing shifted.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const p = await ctx.newPage();
  await mockRoutes(p, { session: false });
  await p.addInitScript(() => { window.__cls = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch {} });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(3500);
  const after = await p.evaluate(() => ({ splash: !!document.querySelector('.vz-splash'), spinner: !!document.querySelector('.lspin'), cls: window.__cls }));
  ok(!after.splash && !after.spinner, 'after mount the splash and the spinner are gone');
  ok(after.cls === 0, `Home's cumulative layout shift is 0 (${after.cls})`);
  await ctx.close();

  // The component in React, in the admin: the Design page's demo.
  const c2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'no-preference' });
  const q = await c2.newPage();
  await mockRoutes(q, { session: true });
  await q.goto(BASE + '/admin/design', { waitUntil: 'networkidle' }).catch(() => {});
  await q.waitForTimeout(800);
  const demo = await q.evaluate(() => { const el = [...document.querySelectorAll('.lspin .lspin-icon')].find(e => e.offsetParent); const cs = el && getComputedStyle(el); const w = document.querySelector('.lspin[role="status"]'); return { name: cs?.animationName, dur: cs?.animationDuration, label: w?.getAttribute('aria-label'), sr: w?.textContent.includes('Loading'), hidden: el?.querySelector('img')?.getAttribute('aria-hidden') }; });
  ok(demo.name === 'lspin-turn' && demo.dur === '1.1s' && demo.label === 'Loading' && demo.sr && demo.hidden === 'true', `LogoSpinner in the admin: rotates, role status, label Loading, icon aria-hidden (${JSON.stringify(demo)})`);
  await c2.close();
}

/* ── 2. every logo, measured ─────────────────────────────────────── */
const MIN = { wordmark: 96, icon: 24, lockup: 160, stacked: 120 };
const measure = () => {
  const lum = (c) => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const groundOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) stack.push(e); let col = { r: 255, g: 255, b: 255 };
    for (const e of stack.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) col = { r: c.r * c.a + col.r * (1 - c.a), g: c.g * c.a + col.g * (1 - c.a), b: c.b * c.a + col.b * (1 - c.a) }; } return col; };
  const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0; };
  const logos = [...document.querySelectorAll('img.v-logo')].filter(visible);
  const others = [...document.querySelectorAll('body *')].filter(e => visible(e) && (e.tagName === 'IMG' || e.tagName === 'SVG' || e.tagName === 'svg' || e.tagName === 'BUTTON' || e.tagName === 'INPUT' || [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())));
  return logos.map((img) => {
    const r = img.getBoundingClientRect();
    const variant = [...img.classList].find(c => c.startsWith('v-logo--'))?.slice(8) || 'wordmark';
    const tone = /primary/.test(img.getAttribute('src')) ? 'primary' : 'reversed';
    const ground = groundOf(img);
    const ink = tone === 'primary' ? [10, 10, 10] : [250, 250, 250];
    const l1 = lum(ink), l2 = lum([ground.r, ground.g, ground.b]);
    const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const ratioFile = img.naturalWidth / img.naturalHeight, ratioBox = r.width / r.height;
    const pad = r.height / 2; const zone = { l: r.left - pad, t: r.top - pad, r: r.right + pad, b: r.bottom + pad };
    const intruder = others.find(e => e !== img && !e.contains(img) && !img.contains(e) && (() => { const q = e.getBoundingClientRect(); if (q.left <= r.left && q.right >= r.right && q.top <= r.top && q.bottom >= r.bottom) return false; /* a backdrop under the logo, not a neighbor */ return q.right > zone.l && q.left < zone.r && q.bottom > zone.t && q.top < zone.b; })());
    const clash = intruder ? `${intruder.tagName.toLowerCase()}.${String(intruder.className).split(' ')[0]} "${(intruder.textContent || '').trim().slice(0, 24)}"` : '';
    return { variant, tone, w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100, ratioErr: Math.abs(ratioBox - ratioFile) / ratioFile, contrast: Math.round(contrast * 100) / 100, clash };
  });
};

const targets = [
  { id: 'home', path: '/', session: false },
  { id: 'start', path: '/start', session: false },
  { id: 'planner', path: '/planner/plnrTESTtoken0123456789abcdEF', session: false },
  { id: 'admin-login', path: '/admin', session: false },
  { id: 'admin-sidebar-open', path: '/admin', session: true, widths: [1280] },
  { id: 'admin-sidebar-collapsed', path: '/admin', session: true, collapsed: true, widths: [1280] },
];
const shots = [];
for (const t of targets) for (const w of t.widths || [390, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 800 : 800 } });
  const p = await ctx.newPage();
  await p.addInitScript(([c]) => { try { localStorage.setItem('vz_theme', 'dark'); if (c) localStorage.setItem('vz_shell_collapsed', 'true'); } catch {} }, [!!t.collapsed]);
  await mockRoutes(p, { session: t.session });
  await p.goto(BASE + t.path, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(t.id === 'home' ? 2500 : 1200);
  const rows = await p.evaluate(measure);
  const file = join(OUT, `${t.id}-${w}.png`);
  await p.screenshot({ path: file }); shots.push({ id: `${t.id} ${w}`, file });
  ok(rows.length > 0, `${t.id} at ${w}: ${rows.length} logo(s) found`);
  for (const r of rows) {
    const tag = `${t.id} ${w} ${r.variant}/${r.tone}`;
    ok(r.w >= MIN[r.variant], `${tag}: ${r.w} px wide, minimum ${MIN[r.variant]}`);
    ok(r.ratioErr < 0.01, `${tag}: not stretched (ratio off by ${(r.ratioErr * 100).toFixed(2)} percent)`);
    ok(r.contrast >= 4.5, `${tag}: contrast ${r.contrast}:1 on its ground`);
    ok(!r.clash, `${tag}: clear space of half the V cap height (${(r.h / 2).toFixed(1)} px)${r.clash ? ', but ' + r.clash + ' is inside it' : ''}`);
  }
  await ctx.close();
}

/* ── 3. one email header, rendered from the markup in docs/LOGO-ROLLOUT.md ── */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 260 } });
  const p = await ctx.newPage();
  const png = readFileSync('public/brand/png/visualize-wordmark-reversed-480.png');
  await p.route('https://visualizestudio.org/brand/png/*', r => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
  const snippet = readFileSync('docs/LOGO-ROLLOUT.md', 'utf8').match(/<a href="https:\/\/visualizestudio\.org"><img[^\n]*<\/a>/)[0];
  await p.setContent(`<body style="margin:0;background:#080808;font-family:Inter,Arial,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px"><table role="presentation" width="340" cellpadding="0" cellspacing="0" style="background:#121212;border-radius:12px"><tr><td style="padding:24px">${snippet}<p style="color:#fafafa;font-size:15px;margin:20px 0 0">Hi Maria, your invoice is ready.</p><p style="color:#8f8f8f;font-size:12px;margin:12px 0 0">Visualize<span style="color:#d44c43">.</span></p></td></tr></table></td></tr></table>`);
  await p.waitForTimeout(300);
  const e = await p.evaluate(() => { const i = document.querySelector('img'); const r = i.getBoundingClientRect(); return { w: r.width, h: r.height, alt: i.alt, nat: [i.naturalWidth, i.naturalHeight] }; });
  ok(e.w === 240 && Math.abs(e.h - 42) <= 1 && e.alt === 'Visualize.' && e.nat[0] === 480, `email header: 240 x 42, alt "Visualize.", the 480 wordmark PNG (${JSON.stringify(e)})`);
  const file = join(OUT, 'email-390.png'); await p.screenshot({ path: file }); shots.push({ id: 'email header 390', file });
  await ctx.close();
}

/* ── 4. the contact sheet ────────────────────────────────────────── */
if (process.env.CONTACT) {
  const cells = shots.map(s => `<figure style="margin:0"><img src="data:image/png;base64,${readFileSync(s.file).toString('base64')}" style="width:100%;display:block;border:1px solid #333"><figcaption style="color:#ccc;font:12px Inter,Arial;padding:4px 0">${s.id}</figcaption></figure>`).join('');
  const sheet = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await sheet.setContent(`<body style="margin:0;background:#111;padding:16px"><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start">${cells}</div>`);
  await sheet.waitForTimeout(500);
  await sheet.screenshot({ path: process.env.CONTACT, fullPage: true });
  console.log('contact sheet', process.env.CONTACT, existsSync(process.env.CONTACT) ? 'written' : 'MISSING');
}
await browser.close();
console.log(fails ? `\nlogo-audit: ${fails} FAILED` : '\nlogo-audit: all checks passed');
process.exit(fails ? 1 : 0);
