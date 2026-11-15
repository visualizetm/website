#!/usr/bin/env node
/* Billy on Rob's side, in a browser at 390 and 1280 (Billy's Call Room, part 1), against the mocked admin (audit-fixtures.mjs):
 * the home's Billy today card (Calls, Talked, Callbacks, the "N booked" pill, Open Billy's day, one height in every state),
 * the Booked by Billy tag on the home's rows, the Booked by Billy card on the record (inside a section, no new header pill
 * or control).
 *   npx vite preview --port 4330 &   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/team-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, TEAM_BILLY, TEAM_DAY, leads, daysFrom } from './audit-fixtures.mjs';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const ADMIN = `${BASE}/admin`;
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

async function session(width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch { /* none */ } });
  const team = { billy: TEAM_BILLY(), day: TEAM_DAY(), posts: [], ...(opts.team || {}) };
  await mockRoutes(page, { team, ...(opts.routes || {}) });
  /* A booking Billy made an hour ago, with the meeting three days out: what the home looks like right after he books (the fixture's own
     booked leads meet today, and a booking becomes a deal an hour past its meeting, so they cannot stand in for one still ahead). */
  const fresh = { ...leads[8], _id: 'LB1', business: 'Billy Booked Bakery', listId: '', deal: undefined, nextAction: undefined, meeting: { date: daysFrom(3), time: '10:00', type: 'call', location: '' }, bookedBy: { who: 'billy', at: new Date(Date.now() - 3600e3).toISOString() } };
  if (opts.leads !== false) await page.route('**/api/admin/call-leads**', (r) => (r.request().method() === 'GET' && !/deleted=1/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [...leads, fresh] }) }) : r.fallback()));
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, team, errors };
}

for (const width of [390, 1280]) {
  console.log(`\n── ${width}px ──`);
  const S = await session(width); const p = S.page;

  /* 1. The home's card */
  await p.goto(`${ADMIN}/`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-card="billy"] .bt-in', { timeout: 8000 });
  const card = p.locator('[data-card="billy"]');
  const text = (await card.innerText()).replace(/\n+/g, ' | ');
  ok(/Billy today/.test(text) && /14 \| Calls/.test(text) && /6 \| Talked/.test(text) && /2 \| Callbacks/.test(text), `Billy today: Calls, Talked, Callbacks (${text.slice(0, 80)})`);
  ok(/1 booked/.test(await card.locator('.bt-booked').innerText()) && await card.getByRole('button', { name: "Open Billy's day" }).count() === 1, 'an "N booked" pill and Open Billy\'s day');
  const order = await p.evaluate(() => { const a = document.querySelector('.nh-wrap, [data-card="today"], .nh-card'); const b = document.querySelector('[data-card="billy"]'); return a && b ? (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? 'after' : 'before') : 'missing'; });
  ok(order !== 'before', `the card sits under Next up, never above it (${order})`);
  const box = await card.boundingBox();
  ok(box.width <= width && await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'it fits the width with no sideways scroll');

  /* 2. The tag on the home's rows */
  if (await p.locator('.nh-coming-head').getAttribute('aria-expanded') === 'false') await p.locator('.nh-coming-head').click();
  await p.waitForSelector('[data-booked-by="billy"]', { timeout: 5000 }).catch(() => {});
  const tagged = await p.locator('[data-booked-by="billy"]').evaluateAll(els => els.map(e => `${e.closest('[data-card]')?.getAttribute('data-card')}: ${e.innerText.replace(/\n+/g, ' | ')}`));
  ok(tagged.length >= 1 && tagged.every(t => /Billy Booked Bakery · Booked by Billy/.test(t)) && tagged.some(t => t.startsWith('next-coming')), `his booking shows under Coming up with "Booked by Billy" (${tagged.map(t => t.slice(0, 60)).join(' / ')})`);
  ok(await p.locator('[data-row-id="L9"][data-booked-by]').count() === 0 && await p.locator('[data-row-id="L10"][data-booked-by]').count() === 0, 'a lead that is a deal by now, and one he never booked, do not');

  /* 3. One height in every state: loading, failed, loaded */
  const F = await session(width, { routes: { fail: ['team'] } });
  await F.page.addInitScript(() => { try { localStorage.setItem('vz_billy', '1'); } catch { /* none */ } });
  await F.page.goto(`${ADMIN}/`, { waitUntil: 'networkidle' });
  await F.page.waitForSelector('[data-card="billy"] .bt-retry', { timeout: 8000 }).catch(() => {});
  const fbox = await F.page.locator('[data-card="billy"]').boundingBox().catch(() => null);
  ok(!!fbox && /did not load/.test(await F.page.locator('[data-card="billy"]').innerText()) && await F.page.locator('[data-card="billy"] .bt-retry').count() === 1, 'when his day does not load the card says so with Try again');
  ok(!!fbox && Math.abs(fbox.height - box.height) <= 1, `and it keeps the same height (${fbox ? Math.round(fbox.height) : 0} and ${Math.round(box.height)})`);
  await F.ctx.close();
  const N = await session(width, { leads: false, team: { billy: { ...TEAM_BILLY(), exists: false } } });
  /* The same leads with nobody's bookedBy: what the app looked like before Billy. */
  await N.page.route('**/api/admin/call-leads**', (r) => (r.request().method() === 'GET' && !/deleted=1/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: leads.map(({ bookedBy, ...l }) => { void bookedBy; return l; }) }) }) : r.fallback()));
  await N.page.goto(`${ADMIN}/`, { waitUntil: 'networkidle' });
  await N.page.waitForTimeout(400);
  ok(await N.page.locator('[data-card="billy"]').count() === 0 && await N.page.evaluate(() => localStorage.getItem('vz_billy')) === '0', 'a studio with no caller has no card, and the device remembers that');
  ok(await N.page.locator('.nh-row').count() > 0 && await N.page.locator('[data-booked-by]').count() === 0, 'and a booking Rob made himself wears no tag');
  await N.page.goto(`${ADMIN}/deals/L9`, { waitUntil: 'networkidle' });
  await N.page.getByRole(width < 768 ? 'button' : 'tab', { name: /Meeting/ }).first().click().catch(() => {});
  await N.page.waitForTimeout(300);
  ok(await N.page.locator('.rc-meeting').count() === 1 && await N.page.locator('[data-card="booked-by"]').count() === 0, 'nor does its record carry the card');
  await N.ctx.close();

  /* 4. The record: Booked by Billy, inside Meeting, no new header pill or control */
  await p.goto(`${ADMIN}/deals/L9`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.rc-root, .rc-header, [data-record]', { timeout: 8000 }).catch(() => {});
  const head = async (page) => ({ pills: await page.locator('.rc-header .v-pill, .rc-head .v-pill').count(), controls: await page.locator('.rc-header-actions button, .rc-head-actions button').count() });
  const h9 = await head(p);
  const meeting = p.getByRole(width < 768 ? 'button' : 'tab', { name: /Meeting/ }).first();
  await meeting.click();
  await p.waitForSelector('[data-card="booked-by"]', { timeout: 5000 }).catch(() => {});
  const bb = p.locator('[data-card="booked-by"]');
  const bt = (await bb.innerText().catch(() => '')).replace(/\n+/g, ' | ');
  ok(/Booked by Billy/i.test(bt) && /\d{1,2}:\d{2}/.test(bt) && /Wants a new sign before spring/.test(bt), `the record's Booked by Billy card: the time and his notes (${bt.slice(0, 70)})`);
  ok(/No answer: Left a voicemail\./.test(bt) && !/Rang out/.test(bt), 'and his calls on that lead, not Rob\'s');
  ok(await bb.locator('button, a, input').count() === 0 && await bb.locator('.v-pill').count() === 0, 'the card is text only: no control and no pill');
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'a long note wraps: no sideways scroll');
  ok(h9.pills <= 2 && h9.controls <= 3, `the header keeps its laws: at most two pills and three controls (${h9.pills} pills, ${h9.controls} controls)`);

  ok(S.errors.length === 0, `no page errors (${S.errors.slice(0, 2).join(' | ') || 'none'})`);
  await S.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} failed.` : '\nAll team browser checks pass.');
process.exit(fails ? 1 : 0);
