#!/usr/bin/env node
/* The send sheet in a browser (email safety, prompt 1 of 3), against the audit fixtures at 390 and 1280: every path that used to send
 * now opens the sheet, the sheet shows the recipient, the subject and the body, nothing posts to email/send or the log's send: true,
 * and only the sheet's Send now posts to email/approve. The Tasks row, the Drafts screen (both buttons, the chips, the text row),
 * Compose's Send and Send later, and the log sheet's Send now are walked; every network call is counted.
 *   npx vite preview --port 4330 &   AUDIT_BASE=http://127.0.0.1:4330 node scripts/send-sheet-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const WIDTHS = (process.env.AUDIT_WIDTHS || '390,1280').split(',').map(Number);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

async function open(ctx, path) {
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); localStorage.removeItem('vz_call_session'); } catch { /* storage may be off */ } });
  await mockRoutes(page, { session: true });
  const posts = []; // every POST to the email actions
  page.on('request', (rq) => { if (rq.method() === 'POST' && /\/api\/admin\/email\//.test(rq.url())) { let b = null; try { b = JSON.parse(rq.postData() || 'null'); } catch { /* not JSON */ } posts.push({ action: rq.url().split('/').pop().split('?')[0], body: b }); } });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  return { page, posts };
}
const sends = (posts) => posts.filter(p => p.action === 'send' && !p.body?.testToSelf);
const logSends = (posts) => posts.filter(p => p.action === 'log' && p.body?.send === true);
const approves = (posts) => posts.filter(p => p.action === 'approve');

for (const w of WIDTHS) {
  const phone = w < 768;
  console.log(`\n[${w}px]`);
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block' });

  // 1. The Drafts screen.
  let t = await open(ctx, '/admin/drafts');
  const rows = t.page.locator('.dr-row');
  ok(await rows.count() >= 3, `Drafts lists the waiting rows (${await rows.count()})`);
  const first = rows.first();
  ok(await first.locator('.dr-to').count() === 1 && await first.locator('.dr-subject').count() === 1 && await first.locator('.dr-peek').count() === 1 && await first.locator('.dr-why').count() === 1, 'a row shows who, the subject, two lines and why');
  ok(await first.locator('.dr-edit').count() === 1 && await first.locator('.dr-send').count() === 1, 'and Preview and edit plus Send');
  await first.locator('.dr-send').click();
  const sheet = t.page.locator('.v-sheet');
  await sheet.locator('.ss-text').waitFor({ timeout: 8000 }).catch(() => {});
  ok(await sheet.count() === 1 && /\bTo\b/i.test(await sheet.innerText()) && /Subject/i.test(await sheet.innerText()) && await sheet.locator('.ss-text').count() === 1, 'Send on the row opens the sheet with To, Subject and the body, not a send');
  ok(sends(t.posts).length === 0 && logSends(t.posts).length === 0 && approves(t.posts).length === 0, 'nothing was posted yet');
  ok(await sheet.locator('.ss-later').count() === 1 && await sheet.locator('.ss-mail').count() === 1 && await sheet.locator('.ss-send').count() === 1, 'the sheet offers Later, Open in Mail and Send now');
  const mail = await sheet.locator('.ss-mail').getAttribute('href');
  ok(/^mailto:[^?]+\?subject=.+&body=.+/.test(mail || ''), `Open in Mail carries the address, the subject and the body (${(mail || '').slice(0, 40)})`);
  await sheet.locator('.ss-view .v-seg-btn, .ss-view button').nth(1).click().catch(() => {}); await t.page.waitForTimeout(300);
  ok(await sheet.locator('iframe.ep-frame').count() === 1, 'As they see it shows the branded email in the sandboxed preview');
  await sheet.locator('.ss-later').click(); await t.page.waitForTimeout(400);
  const whens = await sheet.locator('.ss-when .v-lrow-title, .ss-when').allInnerTexts();
  ok(whens.length >= 2 && whens.some(x => /Tomorrow 9am/.test(x)) && await sheet.locator('input[type="datetime-local"]').count() === 1, `Later lists the times and a picker (${whens.map(x => x.split('\n')[0]).join(' | ')})`);
  await sheet.getByRole('button', { name: 'Back' }).click(); await t.page.waitForTimeout(300);
  await sheet.locator('.ss-send').click(); await t.page.waitForTimeout(800);
  ok(approves(t.posts).length === 1 && approves(t.posts)[0].body?.id && sends(t.posts).length === 0 && logSends(t.posts).length === 0, `Send now posts to approve, and to nothing else (${JSON.stringify(t.posts.map(p => p.action))})`);
  ok(await t.page.locator('.v-sheet').count() === 0, 'and the sheet closes');
  await t.page.close();

  // 2. The chips and the text row.
  t = await open(ctx, '/admin/drafts');
  await t.page.locator('.dr-chip--text').click(); await t.page.waitForTimeout(400);
  ok(await t.page.locator('.dr-row').count() >= 1 && await t.page.locator('.dr-row.is-text').count() === await t.page.locator('.dr-row').count(), 'the Text chip shows the text rows alone');
  const textRow = t.page.locator('.dr-row.is-text').first();
  ok(/Text it/.test(await textRow.locator('.dr-send').innerText()) && /Edit/.test(await textRow.locator('.dr-edit').innerText()), 'a text row offers Edit and Text it');
  await textRow.locator('.dr-send').click(); await t.page.waitForTimeout(600);
  const ts = t.page.locator('.v-sheet');
  ok(await ts.locator('.ss-text-it').count() === 1 && /phone/i.test(await ts.innerText()), 'the sheet for a text shows the phone and Text it');
  await t.page.locator('.dr-chip--sent').click().catch(() => {});
  await t.page.keyboard.press('Escape'); await t.page.waitForTimeout(300);
  await t.page.locator('.dr-chip--sent').click(); await t.page.waitForTimeout(400);
  ok(await t.page.locator('.dr-row').count() >= 1 && await t.page.locator('.dr-row .dr-send').count() === 0, 'the Sent chip shows what went, with no Send button');
  await t.page.close();

  // 3. The Tasks row's Send icon opens the sheet.
  t = await open(ctx, '/admin/tasks');
  await t.page.waitForSelector('.nu-row .nu-send', { timeout: 8000 }).catch(() => {});
  if (await t.page.locator('.nu-row .nu-send').count()) {
    await t.page.locator('.nu-row .nu-send').first().click(); await t.page.waitForTimeout(700);
    ok(await t.page.locator('.v-sheet .ss-send').count() === 1 && sends(t.posts).length === 0 && logSends(t.posts).length === 0 && approves(t.posts).length === 0, 'the Tasks row Send icon opens the sheet and posts nothing');
    await t.page.keyboard.press('Escape'); await t.page.waitForTimeout(300);
    const emailRow = t.page.locator('.nu-row', { has: t.page.locator('.nu-send') }).first();
    await emailRow.locator('.nu-ctl .v-menu-trig button').first().click(); await t.page.waitForTimeout(400);
    await t.page.getByRole('menuitem', { name: 'Send email' }).click({ timeout: 8000 }); await t.page.waitForTimeout(700);
    ok(await t.page.locator('.v-sheet .ss-send').count() === 1 && sends(t.posts).length === 0 && logSends(t.posts).length === 0, 'and so does its menu');
  } else ok(false, 'the Tasks fixture has an email task row');
  await t.page.close();

  // 4. Compose: Send writes a draft and opens the sheet; Send later opens it on the times.
  t = await open(ctx, '/admin/email/compose?record=L8&template=intro_call');
  await t.page.waitForSelector('.cp-send', { timeout: 8000 });
  await t.page.waitForFunction(() => { const b = document.querySelector('.cp-send'); return b && !b.disabled; }, null, { timeout: 8000 }).catch(() => {});
  await t.page.locator('.cp-send').click(); await t.page.waitForTimeout(900);
  const cs = t.page.locator('.v-sheet');
  ok(sends(t.posts).length === 1 && approves(t.posts).length === 0 && await cs.locator('.ss-send').count() === 1, `Compose's Send writes the draft (one email/send) and opens the sheet, no approve yet (${JSON.stringify(t.posts.map(p => p.action))})`);
  ok(!/confirmDuplicate|sendAt/.test(JSON.stringify(sends(t.posts)[0]?.body || {})), 'the draft request carries no confirm and no time: those belong to the sheet');
  await cs.locator('.ss-send').click(); await t.page.waitForTimeout(900);
  ok(approves(t.posts).length === 1, 'Send now in the sheet approves it');
  ok(/\/admin\/(leads|deals|clients|tasks|\?|$)/.test(t.page.url()) || !t.page.url().includes('/email/compose'), `and Compose closes (${t.page.url().replace(BASE, '')})`);
  await t.page.close();
  t = await open(ctx, '/admin/email/compose?record=L8&template=intro_call');
  await t.page.waitForSelector('.cp-send-more', { timeout: 8000 });
  await t.page.waitForFunction(() => { const b = document.querySelector('.cp-send-more'); return b && !b.disabled; }, null, { timeout: 8000 }).catch(() => {});
  await t.page.locator('.cp-send-more').click(); await t.page.waitForTimeout(300);
  await t.page.getByRole('menuitem', { name: 'Send later' }).click(); await t.page.waitForTimeout(900);
  ok(await t.page.locator('.v-sheet .ss-when').count() >= 2 && approves(t.posts).length === 0, 'Send later opens the sheet on its times, nothing approved');
  await t.page.locator('.v-sheet .ss-when').first().click(); await t.page.waitForTimeout(800);
  ok(approves(t.posts).length === 1 && !!approves(t.posts)[0].body?.sendAt, `picking a time approves with sendAt (${approves(t.posts)[0]?.body?.sendAt})`);
  await t.page.close();

  // 5. The log sheet's Send now hands over to the send sheet.
  t = await open(ctx, '/admin/settings/emails');
  await t.page.waitForSelector('.es-log-row', { timeout: 8000 }).catch(() => {});
  const draftRow = t.page.locator('.es-log-row', { hasText: /Draft/ }).first();
  if (await draftRow.count()) {
    await draftRow.click(); await t.page.waitForTimeout(600);
    await t.page.locator('.el-send').click(); await t.page.waitForTimeout(700);
    ok(await t.page.locator('.v-sheet .ss-send').count() === 1 && sends(t.posts).length === 0 && logSends(t.posts).length === 0 && approves(t.posts).length === 0, 'the log sheet\'s Send now opens the send sheet and posts nothing');
  } else ok(false, 'Recent sends shows a draft row');
  await t.page.close();

  // 6. The home card.
  t = await open(ctx, '/admin');
  ok(await t.page.locator('[data-card="drafts"]').count() === 1 && /waiting for your tap/.test(await t.page.locator('[data-card="drafts"]').innerText()), 'the home shows the Drafts card with the count');
  await t.page.close();
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nAll send sheet checks pass.');
process.exit(fails ? 1 : 0);
