#!/usr/bin/env node
/* The doc editor in a browser (docs job): every block type draws, typing saves after about a second, Enter and Backspace and the markdown
 * shortcuts, bold, italic and a link through the formatting bar, the "+" sheet, the block menu (turn into, move, duplicate, delete with
 * Undo), reorder by the grip, a reference chip that shows the record's live state, the save failure state (text kept, "Not saved, retrying",
 * then saved), Back saving first, markup typed as text staying text, and the print sheet. At 390 (touch) and 1280.
 *   node scripts/docs-editor-audit.mjs        AUDIT_BASE=http://127.0.0.1:4331 node scripts/docs-editor-audit.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

async function session(width, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 768 ? 844 : 900 }, hasTouch: width < 768, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch {} });
  const o = { ...opts };
  await mockRoutes(page, o);
  const patches = [];
  page.on('request', (r) => { if (r.method() === 'PATCH' && r.url().includes('/api/admin/docs')) { try { patches.push(JSON.parse(r.postData() || '{}')); } catch { /* none */ } } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, o, patches, errors };
}
const open = async (page, id = 'DOC1') => { await page.goto(`${BASE}/admin/docs/${id}`, { waitUntil: 'networkidle' }); await page.waitForSelector('.dc-blocks', { timeout: 8000 }); await page.waitForTimeout(300); };
const blocksOf = (page) => page.$$eval('.dc-row', rs => rs.map(r => ({ type: r.dataset.type, text: (r.querySelector('.dc-rt')?.textContent || r.textContent || '').trim().slice(0, 60) })));
const status = (page) => page.$eval('[data-save]', e => e.dataset.save);
const lastPatch = (patches) => patches[patches.length - 1]?.set;

for (const width of [390, 1280]) {
  const phone = width < 768;
  console.log(`\n── ${width}px ──`);
  const S = await session(width);
  const { page } = S;
  await open(page);

  /* Every block type draws. */
  const bl = await blocksOf(page);
  ok(['h1', 'p', 'h2', 'ul', 'ol', 'check', 'quote', 'divider', 'link', 'image', 'ref'].every(t => bl.some(b => b.type === t)) && bl.length === 18, `all eleven block types draw (${bl.length} blocks)`);
  ok(await page.$$eval('.dc-rt strong, .dc-rt em, .dc-rt a', e => e.length) === 3, 'bold, italic and a link draw inside a paragraph');
  const refs = await page.$$eval('.dc-ref', rs => rs.map(r => r.getAttribute('aria-label')));
  ok(refs.length === 5 && refs.every(r => /Open it/.test(r)) && /Concept set: .*Draft|Concept set/.test(refs[0]) && /Task: Make graphics, .*Overdue|Task: Make graphics/.test(refs[2]) && /Invoice: Month 2 of 6/.test(refs[3]), `five reference chips show the live record and say Open it (${refs[2]})`);
  ok(await page.$eval('[data-save]', e => e.textContent.trim()) === 'Saved', 'the header says Saved');
  ok(await page.$eval('.dd-title', e => e.textContent) === 'Project brief', 'the title is the doc\'s');
  ok(S.errors.length === 0, `no page errors on open (${S.errors.join('; ')})`);

  /* Typing saves after about a second. */
  await page.locator('.dc-row[data-block-id="b9"] .dc-rt').click(); await page.keyboard.press('End');
  await page.keyboard.type(' today');
  ok(['dirty', 'saving'].includes(await status(page)), 'typing says Saving at once');
  const n0 = S.patches.length;
  await page.waitForTimeout(500);
  ok(S.patches.length === n0, 'nothing is sent inside the second');
  await page.waitForTimeout(1300);
  ok(S.patches.length === n0 + 1 && await status(page) === 'saved' && JSON.stringify(lastPatch(S.patches).blocks).includes('Menu photos sent today'), 'one request about a second later carries the text and the header says Saved');

  /* Enter, Backspace, markdown. */
  await page.keyboard.press('Enter');
  await page.keyboard.type('Second photo set');
  let b = await blocksOf(page);
  const i9 = b.findIndex(x => x.text.startsWith('Menu photos sent today'));
  ok(b[i9 + 1]?.type === 'check' && b[i9 + 1].text === 'Second photo set', 'Enter in a checklist continues it');
  await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  b = await blocksOf(page);
  ok(b[i9 + 2]?.type === 'p', 'Enter on an empty checklist item leaves the list');
  await page.keyboard.type('- first thing');
  b = await blocksOf(page);
  ok(b[i9 + 2]?.type === 'ul' && b[i9 + 2].text === 'first thing', 'typing "- " turns a paragraph into a bullet');
  await page.keyboard.press('Home'); await page.keyboard.press('Backspace');
  b = await blocksOf(page);
  ok(b[i9 + 2]?.type === 'p', 'Backspace at the start of a bullet makes it a paragraph');
  await page.keyboard.press('Backspace');
  b = await blocksOf(page);
  ok(b[i9 + 1]?.text === 'Second photo setfirst thing', 'Backspace at the start of a paragraph joins the block above');

  /* Marks through the bar. */
  await page.keyboard.press('Shift+Home');
  const bold = page.locator('.dc-fb[data-fmt="bold"]');
  if (phone) await page.waitForSelector('.dc-bar.is-on', { timeout: 3000 });
  await bold.click();
  ok(await page.$$eval('.dc-row:has(.dc-rt:focus) .dc-rt strong, .dc-row:has(.dc-rt:focus) .dc-rt b', e => e.length) === 1, 'Bold from the bar bolds the selection');
  await page.waitForTimeout(1500);
  ok(JSON.stringify(lastPatch(S.patches).blocks).includes('"b":1'), 'the bold run is saved');
  await page.locator('.dc-fb[data-fmt="link"]').click();
  await page.waitForSelector('.dc-link-apply', { timeout: 3000 });
  await page.keyboard.type('example.com/menu');
  await page.locator('.dc-link-apply').click();
  await page.waitForTimeout(1500);
  const linkRun = lastPatch(S.patches).blocks.flatMap(x => x.runs || []).find(r => r.a);
  ok(await page.$$eval('.dc-rt:focus a, .dc-row .dc-rt a', e => e.length) >= 2 && JSON.stringify(lastPatch(S.patches).blocks).includes('https://example.com/menu'), `the Link sheet adds an https link (${linkRun?.a})`);

  /* "+" sheet. */
  await page.locator('.dc-fb[data-fmt="insert"]').click();
  await page.waitForSelector('.dc-opt[data-opt="divider"]');
  const nBefore = (await blocksOf(page)).length;
  await page.locator('.dc-opt[data-opt="divider"]').click();
  await page.waitForTimeout(300);
  ok((await blocksOf(page)).length === nBefore + 1 && (await blocksOf(page)).some((x, k) => x.type === 'divider' && k > 10), 'the "+" sheet adds a divider below the block being typed in');
  await page.locator('.dc-fb[data-fmt="insert"]').click().catch(() => {});
  if (await page.$('.dc-opt[data-opt="ref"]')) { await page.locator('.dc-opt[data-opt="ref"]').click(); await page.waitForSelector('.dc-refopt'); ok(await page.$$eval('.dc-refopt', e => e.length) >= 8, 'the Reference sheet lists the client\'s own concept sets, projects, tasks, invoices and files'); await page.locator('.dc-refopt[data-ref="invoice:m3"]').click(); await page.waitForTimeout(300); ok((await page.$$eval('.dc-ref', r => r.length)) === 6, 'picking a record adds its chip'); }

  /* The block menu: turn into, move, duplicate, delete with Undo. */
  await page.locator('.dc-row[data-block-id="b4"] .dc-grip').click();
  await page.waitForSelector('.dc-turn');
  await page.locator('.dc-turn .dc-opt', { hasText: 'Numbered list' }).click();
  await page.waitForTimeout(200);
  ok((await blocksOf(page)).find(x => x.text === 'Logo and a mark')?.type === 'ol', 'Turn into changes a bullet to a numbered item');
  await page.locator('.dc-row[data-block-id="b4"] .dc-grip').click();
  await page.locator('.dc-act', { hasText: 'Move down' }).click();
  await page.waitForTimeout(200);
  let order = (await blocksOf(page)).map(x => x.text);
  ok(order.indexOf('A one page site') < order.indexOf('Logo and a mark'), 'Move down swaps with the next block');
  await page.locator('.dc-row[data-block-id="b4"] .dc-grip').click();
  await page.locator('.dc-act', { hasText: 'Duplicate' }).click();
  await page.waitForTimeout(200);
  ok((await blocksOf(page)).filter(x => x.text === 'Logo and a mark').length === 2, 'Duplicate adds a copy');
  const cnt = (await blocksOf(page)).length;
  await page.locator('.dc-row[data-block-id="b4"] .dc-grip').click();
  await page.locator('.dc-act.is-danger').click();
  await page.waitForTimeout(300);
  ok((await blocksOf(page)).length === cnt - 1, 'Delete removes the block');
  await page.locator('.v-toast-action', { hasText: 'Undo' }).click();
  await page.waitForTimeout(300);
  ok((await blocksOf(page)).length === cnt, 'Undo puts it back where it was');

  /* Reorder by dragging the grip. */
  const g = await page.locator('.dc-row[data-block-id="b3"] .dc-grip').boundingBox();
  const target = await page.locator('.dc-row[data-block-id="b6"]').boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await page.mouse.down();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2 + 20, { steps: 3 });
  await page.mouse.move(g.x + g.width / 2, target.y + target.height + 4, { steps: 8 });
  const dropShown = await page.$('.dc-slot[data-dropbefore]') !== null;
  await page.mouse.up();
  await page.waitForTimeout(300);
  order = (await blocksOf(page)).map(x => x.text);
  ok(dropShown && order.indexOf('What they need') > order.indexOf('Concepts first'), 'dragging the grip shows a drop line and moves the block');

  /* Markup stays text. */
  await page.locator('.dc-row[data-block-id="b2"] .dc-rt').click(); await page.keyboard.press('End');
  await page.keyboard.type(' <img src=x onerror=window.__pwned=1> <script>window.__pwned=2</script>');
  await page.waitForTimeout(1500);
  ok(await page.evaluate(() => !window.__pwned) && await page.$$eval('.dc-rt img, .dc-rt script', e => e.length) === 0 && JSON.stringify(lastPatch(S.patches).blocks).includes('<img src=x onerror'), 'markup typed into a block is stored and shown as text, never run');

  /* Back saves first. */
  await page.locator('.dc-row[data-block-id="b2"] .dc-rt').click(); await page.keyboard.press('End'); await page.keyboard.type(' ZZ');
  const before = S.patches.length;
  await (phone ? page.locator('.sh-top-back') : page.locator('.dd-back')).click();
  await page.waitForTimeout(600);
  ok(S.patches.length > before && JSON.stringify(lastPatch(S.patches).blocks).includes(' ZZ'), 'Back saves what was typed before leaving');
  await S.ctx.close();

  /* The failure state. */
  const F = await session(width);
  await open(F.page);
  F.o.docsSaveFails = true;
  await F.page.locator('.dc-row[data-block-id="b2"] .dc-rt').click(); await F.page.keyboard.press('End'); await F.page.keyboard.type(' offline text');
  await F.page.waitForTimeout(1600);
  const st = await status(F.page);
  ok(st === 'failed' && await F.page.$eval('[data-save]', e => e.textContent.trim()) === 'Not saved, retrying', `a failed save says "Not saved, retrying" (${st})`);
  ok((await F.page.$eval('.dc-row[data-block-id="b2"] .dc-rt', e => e.textContent)).includes('offline text'), 'and the text is still in the editor');
  F.o.docsSaveFails = false;
  await F.page.waitForFunction(() => document.querySelector('[data-save]')?.dataset.save === 'saved', null, { timeout: 9000 }).catch(() => {});
  ok(await status(F.page) === 'saved' && JSON.stringify(lastPatch(F.patches).blocks).includes('offline text'), 'it retries by itself and saves once the network is back');
  await F.ctx.close();

  /* Leaving with an unsaved failure keeps the text for the next open (it lives in memory, so the whole walk is one page load). */
  const K = await session(width);
  await K.page.goto(`${BASE}/admin/clients?open=L11`, { waitUntil: 'networkidle' });
  await K.page.waitForSelector('.rc-docs-row[data-doc-id="DOC1"]', { timeout: 8000 });
  await K.page.locator('.rc-docs-row[data-doc-id="DOC1"] .v-stretch').click();
  await K.page.waitForSelector('.dc-blocks');
  K.o.docsSaveFails = true;
  await K.page.locator('.dc-row[data-block-id="b2"] .dc-rt').click(); await K.page.keyboard.press('End'); await K.page.keyboard.type(' kept in memory');
  await (phone ? K.page.locator('.sh-top-back') : K.page.locator('.dd-back')).click();
  await K.page.waitForSelector('.rc-docs-row[data-doc-id="DOC1"]', { timeout: 8000 });
  ok(await K.page.$eval('.rc-docs-row[data-doc-id="DOC1"]', e => !!e), 'Back from the doc returns to the client\'s page');
  K.o.docsSaveFails = false;
  await K.page.locator('.rc-docs-row[data-doc-id="DOC1"] .v-stretch').click();
  await K.page.waitForSelector('.dc-blocks');
  await K.page.waitForTimeout(500);
  ok((await K.page.$eval('.dc-row[data-block-id="b2"] .dc-rt', e => e.textContent)).includes('kept in memory'), 'leaving while a save is failing keeps the text for the next open');
  await K.page.waitForFunction(() => document.querySelector('[data-save]')?.dataset.save === 'saved', null, { timeout: 9000 }).catch(() => {});
  ok(await K.page.$eval('[data-save]', e => e.dataset.save) === 'saved' && K.patches.some(p => JSON.stringify(p.set?.blocks || '').includes('kept in memory')), 'and it is sent again at once');
  await K.ctx.close();

  /* The print sheet exists and is hidden on screen. */
  const P = await session(width);
  await open(P.page);
  ok(await P.page.$eval('.dp-doc', e => getComputedStyle(e).display) === 'none' && await P.page.$$eval('.dp-doc *', e => e.length) > 10, 'the print sheet is in the page and hidden on screen');
  await P.page.emulateMedia({ media: 'print' });
  const pr = await P.page.evaluate(() => ({ doc: getComputedStyle(document.querySelector('.dp-doc')).display, root: getComputedStyle(document.querySelector('#root')).display, color: getComputedStyle(document.querySelector('.dp-doc')).color }));
  ok(pr.doc === 'block' && pr.root === 'none' && pr.color === 'rgb(0, 0, 0)', `for print the doc shows alone, black on white (${JSON.stringify(pr)})`);
  await P.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} failing.` : '\nAll doc editor checks pass.');
process.exit(fails ? 1 : 0);
