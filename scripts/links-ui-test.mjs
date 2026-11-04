#!/usr/bin/env node
/* Links in one tap in a browser (prompt 3 of 3, milestone 4), at 390 and 1280, on the Reviews link card: Text it is an sms: link with the
 * message filled in and stamps the link sent with its channel; Share is hidden where the browser has no share sheet and, where it has one,
 * stamps once the sheet resolves and does nothing when it is cancelled; Draft an email opens Compose on the review request template; there is no
 * Mark as sent button and the small "Sent Oct 12, text" line is what shows.
 *   AUDIT_BASE=http://127.0.0.1:4331 PW_CHROME=/opt/pw-browsers/chromium node scripts/links-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
async function session(width, share) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript((mode) => {
    try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch { /* none */ }
    if (mode === 'ok') navigator.share = async (d) => { window.__shared = d; };
    if (mode === 'cancel') navigator.share = async () => { const e = new Error('cancelled'); e.name = 'AbortError'; throw e; };
    if (mode === 'none') Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  }, share);
  const o = {}; await mockRoutes(page, o);
  const writes = [];
  page.on('request', (r) => { if (r.method() === 'PATCH' && /\/api\/admin\/call-leads/.test(r.url())) { try { writes.push(JSON.parse(r.postData() || '{}')); } catch { /* none */ } } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, writes, errors };
}
const openCard = async (page) => {
  await page.goto(`${BASE}/admin/reviews`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /^Open reviews for Lead Business 12/ }).first().click();
  await page.waitForSelector('[data-card="review-visualize"] .ls-send', { timeout: 8000 });
};
const stamp = (w) => w.find(x => x.set?.reviews?.visualize?.sentAt)?.set.reviews.visualize;

for (const width of [390, 1280]) {
  console.log(`── ${width}px ──`);
  const A = await session(width, 'none'); const p = A.page;
  await openCard(p);
  const card = p.locator('[data-card="review-visualize"]');
  ok(await card.getByRole('button', { name: /mark as sent/i }).count() === 0 && await card.locator('text=Mark as sent').count() === 0, 'there is no Mark as sent button');
  const href = await card.locator('.ls-text').getAttribute('href');
  ok(/^sms:/.test(href) && decodeURIComponent(href).includes('https://visualizestudio.org/r/rvwTESTtoken0123456789abcd'), `Text it is an sms: link with the message filled in (${href.slice(0, 40)}...)`);
  ok(await card.locator('.ls-share').count() === 0, 'Share is hidden where the browser has no share sheet');
  ok(await card.locator('.ls-email').count() === 1 && await card.locator('.ls-text').count() === 1, 'Text it and Draft an email are there');
  ok(await card.evaluate(el => [...el.querySelectorAll('.ls-send .v-btn, .ls-send a, .ls-send button')].every(b => b.getBoundingClientRect().height >= 44)), 'every button is a 44px target');
  ok(/^Sent .+/.test((await card.locator('.ls-sent').textContent()) || ''), `the small line shows what was stamped before (${(await card.locator('.ls-sent').textContent()).trim()})`);
  A.writes.length = 0;
  await card.locator('.ls-text').evaluate(a => { a.addEventListener('click', e => e.preventDefault()); });
  await card.locator('.ls-text').click(); await p.waitForTimeout(600);
  const t = stamp(A.writes);
  ok(t && t.sentVia === 'text' && !!t.sentAt, `Text it stamps the link sent, by text (${JSON.stringify(t || null)?.slice(0, 90)})`);
  ok(/, text$/.test((await card.locator('.ls-sent').textContent()).trim()), 'and the line says so');
  await card.locator('.ls-email').click(); await p.waitForURL(/\/email\/compose\?/, { timeout: 6000 });
  ok(/template=review_request/.test(p.url()) && /record=/.test(p.url()), `Draft an email opens Compose on the review request (${new URL(p.url()).search.slice(0, 60)})`);
  ok(A.errors.length === 0, `no page errors (${A.errors.join('; ').slice(0, 80)})`);
  await A.ctx.close();

  const B = await session(width, 'ok'); await openCard(B.page);
  const cb = B.page.locator('[data-card="review-visualize"]');
  ok(await cb.locator('.ls-share').count() === 1, 'Share shows where the browser has one');
  B.writes.length = 0;
  await cb.locator('.ls-share').click(); await B.page.waitForTimeout(600);
  const shared = await B.page.evaluate(() => window.__shared);
  const sb = stamp(B.writes);
  ok(shared && shared.title && /rvwTESTtoken/.test(shared.text + (shared.url || '')), 'the share sheet gets the title and the message with the link');
  ok(sb && sb.sentVia === 'share', 'a resolved share stamps the link sent, by share sheet');
  await B.ctx.close();

  const C = await session(width, 'cancel'); await openCard(C.page);
  C.writes.length = 0;
  await C.page.locator('[data-card="review-visualize"] .ls-share').click(); await C.page.waitForTimeout(600);
  ok(!stamp(C.writes), 'a cancelled share sheet stamps nothing');
  await C.ctx.close();
}

/* The planner link and the month ready draft (1280). */
console.log('── Planner, 1280px ──');
{
  const P = await session(1280, 'none'); const p = P.page;
  await p.goto(`${BASE}/admin/clients/L11/planner`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.pl-invite .ls-send', { timeout: 8000 });
  ok(/sms:/.test(await p.locator('.pl-invite .ls-text').getAttribute('href')), 'the planner link has Text it too');
  ok(await p.locator('.pl-invite').getByText('Mark as sent').count() === 0, 'and no Mark as sent');
  P.writes.length = 0;
  await p.locator('.pl-invite .ls-text').evaluate(a => a.addEventListener('click', e => e.preventDefault()));
  await p.locator('.pl-invite .ls-text').click(); await p.waitForTimeout(800);
  const w = P.writes.find(x => x.set?.planner?.sentAt)?.set.planner;
  ok(w && w.sentVia === 'text' && w.enabled === true && Number(w.postsPerMonth) > 0, `the stamp carries enabled and the count (${JSON.stringify(w || null)?.slice(0, 100)})`);
  ok(P.errors.length === 0, `no page errors (${P.errors.join('; ').slice(0, 80)})`);
  await P.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nAll link checks pass.');
process.exit(fails ? 1 : 0);
