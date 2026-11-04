#!/usr/bin/env node
/* The three editors that used to have a Save bar (Planner, Showcase, Concepts) save themselves (prompt 3 of 3, milestone 3), in a browser:
 * there is no Save changes button; about a second and a half after the last change one write goes out and the chip says Saving then Saved;
 * a failed write says "Not saved, retrying" and lands on a retry; the Showcase's Published flag is the one change that never goes out on a
 * timer (its own Publish button writes it). Concepts at 390 and 1280, the Planner and the Showcase at 1280.
 *   AUDIT_BASE=http://127.0.0.1:4331 PW_CHROME=/opt/pw-browsers/chromium node scripts/autosave-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
async function session(width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch {} });
  const o = {}; await mockRoutes(page, o);
  const writes = [];
  page.on('request', (r) => { if (!['GET', 'HEAD'].includes(r.method()) && /\/api\/admin\/(call-leads|concept-sets)/.test(r.url())) { let b = {}; try { b = JSON.parse(r.postData() || '{}'); } catch { /* none */ } writes.push({ url: r.url(), method: r.method(), body: b }); } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, writes, errors };
}
const chip = (page) => page.locator('.sb-chip');
const noSaveButton = async (page) => (await page.getByRole('button', { name: /^Save changes$/ }).count()) === 0 && (await page.locator('.sb-bar button', { hasText: 'Discard' }).count()) === 0;

for (const width of [390, 1280]) {
  const phone = width < 768;
  console.log(`── Concepts, ${width}px ──`);
  const C = await session(width); const p = C.page;
  await p.goto(`${BASE}/admin/concepts`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.cl-row');
  ok(await p.locator('input[aria-label="Search concept sets"]').count() === 1, 'the Concepts list has a search');
  await p.locator('input[aria-label="Search concept sets"]').fill('zzzz-nothing');
  ok(await p.locator('.cl-row').count() === 0, 'a search with no match shows no rows (NoResults)');
  await p.locator('input[aria-label="Search concept sets"]').fill('Lead Business 8');
  ok(await p.locator('.cl-row').count() >= 1, 'and the client name finds its set');
  await p.getByRole('button', { name: /^Open Lead Business 8/ }).first().click();
  await p.waitForSelector('input[aria-label="Title"], [aria-label="Title"]', { timeout: 8000 }).catch(async () => { if (phone) await p.locator('.sh-content').getByRole('button', { name: /^Setup/ }).first().click(); });
  if (phone && !(await p.getByLabel('Title').count())) await p.locator('.sh-content').getByRole('button', { name: /^Setup/ }).first().click();
  await p.getByLabel('Title').first().fill('Autosave title'); await p.getByLabel('Title').first().blur();
  ok(await noSaveButton(p), 'there is no Save changes or Discard');
  C.writes.length = 0;
  await p.waitForTimeout(700);
  ok(C.writes.length === 0, 'nothing is written inside the first second');
  await p.waitForTimeout(2200);
  const w = C.writes.filter(x => JSON.stringify(x.body).includes('Autosave title'));
  ok(w.length === 1, `one write carries the title (${C.writes.length} writes)`);
  ok((await chip(p).getAttribute('data-save')) === 'saved' && /Saved/.test(await chip(p).textContent()), 'the chip says Saved');
  await p.waitForTimeout(2600);
  ok(!(await chip(p).evaluate(e => e.classList.contains('is-open'))), 'and goes away after two seconds');
  ok(C.errors.length === 0, `no page errors (${C.errors.join('; ').slice(0, 90)})`);
  await C.ctx.close();
}

console.log('── A failed write, 1280px ──');
{
  const F = await session(1280); const p = F.page;
  let failed = 0;
  await p.route('**/api/admin/concept-sets**', (r) => { if (r.request().method() !== 'GET' && failed < 1) { failed++; return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"no"}' }); } return r.fallback(); });
  await p.goto(`${BASE}/admin/concepts`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /^Open Lead Business 8/ }).first().click();
  await p.getByLabel('Title').first().fill('Retry title'); await p.getByLabel('Title').first().blur();
  await p.waitForTimeout(2300);
  ok((await chip(p).getAttribute('data-save')) === 'failed' && /Not saved, retrying/.test(await chip(p).textContent()), 'a failed write says Not saved, retrying');
  await p.waitForTimeout(4500);
  ok((await chip(p).getAttribute('data-save')) === 'saved', 'and the retry lands');
  ok(F.writes.filter(x => JSON.stringify(x.body).includes('Retry title')).length === 2, 'after exactly one retry');
  await F.ctx.close();
}

console.log('── Showcase, 1280px ──');
{
  const S = await session(1280); const p = S.page;
  await p.goto(`${BASE}/admin/clients/L11/showcase`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.sc-publish', { timeout: 8000 });
  ok(await noSaveButton(p), 'there is no Save changes or Discard');
  await p.locator('button.v-inline[aria-label^="Blurb"]').first().click();
  await p.locator('.v-inline-input').first().fill('Autosaved blurb'); await p.keyboard.press('Tab'); S.writes.length = 0;
  await p.waitForTimeout(3000);
  const w = S.writes.filter(x => x.body?.set?.showcase);
  ok(w.length === 1 && w[0].body.set.showcase.blurb === 'Autosaved blurb', `one write carries the blurb (${S.writes.length} writes: ${JSON.stringify(S.writes.map(x => [x.method, Object.keys(x.body?.set || x.body || {}).join('+'), String(x.body?.set?.showcase?.blurb || '').slice(0, 20)]))})`);
  const pubBefore = !!w[0]?.body?.set?.showcase?.published;
  S.writes.length = 0;
  await p.locator('.sc-publish .v-toggle').first().click();
  await p.waitForTimeout(3500);
  ok(S.writes.length === 0, 'flipping Published writes nothing on a timer');
  ok(await p.locator('.sb-chip .sb-action').isVisible(), `the chip offers ${pubBefore ? 'Unpublish' : 'Publish'}`);
  await p.locator('.sb-chip .sb-action').click(); await p.waitForTimeout(1200);
  const pw = S.writes.filter(x => x.body?.set?.showcase);
  ok(pw.length === 1 && !!pw[0].body.set.showcase.published === !pubBefore, `its button writes the flag once (${pw.length} writes, was ${pubBefore}, now ${pw[0] ? !!pw[0].body.set.showcase.published : 'none'})`);
  await S.ctx.close();
}

console.log('── Planner, 1280px ──');
{
  const P = await session(1280); const p = P.page;
  await p.goto(`${BASE}/admin/clients/L11/planner`, { waitUntil: 'networkidle' });
  await p.waitForSelector('textarea, input', { timeout: 8000 });
  ok(await noSaveButton(p), 'there is no Save changes or Discard');
  await p.getByLabel('Welcome message').first().fill('Autosaved welcome'); P.writes.length = 0;
  await p.waitForTimeout(3200);
  const w = P.writes.filter(x => JSON.stringify(x.body).includes('Autosaved welcome'));
  ok(w.length === 1, `one write carries the welcome message (${P.writes.length} writes)`);
  ok((await chip(p).getAttribute('data-save')) === 'saved', 'the chip says Saved');
  ok(P.errors.length === 0, `no page errors (${P.errors.join('; ').slice(0, 90)})`);
  await P.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nAll autosave checks pass.');
process.exit(fails ? 1 : 0);
