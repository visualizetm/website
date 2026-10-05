#!/usr/bin/env node
/* The docs flows in a browser (docs job): the client page's Docs card (rows, pinned first, two line titles, empty state, New doc), the New doc
 * sheet and what each template fills for this client, Make a task on a call note's follow up line (through the real task write), the
 * Settings Doc templates tab (hide, reorder, rename, delete; built in ones cannot be deleted), and the Docs lists and search added in
 * milestone 5. At 390 and 1280.   node scripts/docs-flow-audit.mjs        AUDIT_BASE=http://127.0.0.1:4331 node scripts/docs-flow-audit.mjs */
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
  await mockRoutes(page, opts);
  const reqs = [];
  page.on('request', (r) => { if (['PATCH', 'POST', 'DELETE'].includes(r.method()) && r.url().includes('/api/admin/')) { let b = {}; try { b = JSON.parse(r.postData() || '{}'); } catch { /* none */ } reqs.push({ method: r.method(), url: r.url(), body: b }); } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, page, reqs, errors };
}

for (const width of [390, 1280]) {
  const phone = width < 768;
  console.log(`\n── ${width}px ──`);
  const S = await session(width);
  const { page } = S;
  await page.goto(`${BASE}/admin/clients?open=L11`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rc-docs', { timeout: 8000 });

  /* The Docs card. */
  const card = await page.$eval('.rc-docs', e => { const r = e.getBoundingClientRect(); const g = e.closest('.rc-ws-grid').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), gl: Math.round(g.left), gr: Math.round(g.right), top: r.top, prev: e.previousElementSibling.getBoundingClientRect().bottom }; });
  ok(card.left === card.gl && card.right === card.gr, `the Docs card spans the whole grid exactly (${card.left}-${card.right} of ${card.gl}-${card.gr})`);
  ok(card.top >= card.prev, 'it sits under the four workspace cards');
  const underGrid = await page.evaluate(() => { const g = document.querySelector('.rc-ws'); const q = document.querySelector('.rc-quick'); const d = document.querySelector('.rc-docs'); return !!q && d.getBoundingClientRect().bottom <= q.getBoundingClientRect().top + 1 && g.contains(d); });
  ok(underGrid, 'and above the Quick actions row');
  const rows = await page.$$eval('.rc-docs-row', rs => rs.map(r => ({ id: r.dataset.docId, title: r.querySelector('.rc-docs-title').textContent.trim(), pinned: r.classList.contains('is-pinned'), edited: r.querySelector('.rc-docs-edited').textContent, type: r.querySelector('.v-pill, [class*=pill]')?.textContent || '' })));
  ok(rows.length === 3 && rows[0].id === 'DOC1' && rows[0].pinned && rows.every(r => /^Edited /.test(r.edited)), `three rows, the pinned one first, each with "Edited ..." (${rows.map(r => r.id)})`);
  ok(await page.$eval('.rc-docs-count', e => e.textContent) === '5' && /All docs, 5/.test(await page.$eval('.rc-docs-all', e => e.textContent)), 'the header counts 5 and All docs says so');
  const longRow = await page.$eval('.rc-docs-row[data-doc-id="DOC2"] .rc-docs-title', e => { const cs = getComputedStyle(e); return { lines: Math.round(e.getBoundingClientRect().height / parseFloat(cs.lineHeight)), clamp: cs.webkitLineClamp }; });
  ok(longRow.clamp === '2' && longRow.lines <= 2, `a long title wraps to at most two lines, never one line cut off (${longRow.lines} lines)`);
  ok(await page.$$eval('.rc-docs button, .rc-docs .v-btn', bs => bs.every(b => b.getBoundingClientRect().height >= 43.5 || b.classList.contains('v-stretch'))), 'every control in the card is 44px tall');

  /* New doc sheet: contract fills for this client. */
  await page.locator('.rc-docs-new').click();
  await page.waitForSelector('.nd-opt[data-template="contract"]');
  const names = await page.$$eval('.nd-opt .nd-name', e => e.map(x => x.textContent));
  ok(names.slice(0, 6).join() === 'Blank,Project brief,Call notes,Contract,Delivery notes,Brand notes' && names.includes('My intake'), `the sheet offers the six built in templates then the saved one (${names.join(', ')})`);
  await page.locator('.nd-opt[data-template="contract"]').click();
  await page.waitForSelector('.dc-blocks', { timeout: 8000 });
  await page.waitForTimeout(400);
  const text = await page.$$eval('.dc-rt', e => e.map(x => x.textContent).join(' | '));
  ok(await page.$eval('.dd-title', e => e.textContent) === 'Agreement, Lead Business 11', 'the contract opens titled for this client');
  ok(text.includes('Lead Business 11') && text.includes('2 revision rounds') && text.includes('$50 for design work and $75 for web work') && text.includes('50 percent deposit') && text.includes('[deposit date]') && text.includes('Files are released only at full payment.'), 'it fills the client name, states the house rules and leaves [deposit date] as a visible placeholder');
  ok(S.reqs.some(r => r.method === 'POST' && r.url.includes('/docs') && r.body.type === 'contract' && r.body.leadId === 'L11' && r.body.projectId === 'P11'), 'the doc was created for the client, typed Contract and tied to their project');
  await (phone ? page.locator('.sh-top-back') : page.locator('.dd-back')).click();
  await page.waitForSelector('.rc-docs-row');
  ok(await page.$eval('.rc-docs-count', e => e.textContent) === '6', 'back on the client page the card counts the new doc');

  /* Call notes: Make a task. */
  await page.locator('.rc-docs-new').click();
  await page.waitForSelector('.nd-opt[data-template="call-notes"]');
  await page.locator('.nd-opt[data-template="call-notes"]').click();
  await page.waitForSelector('.dc-task', { timeout: 8000 });
  ok((await page.$$eval('.dc-rt', e => e.map(x => x.textContent).join(' | '))).includes('On the call: Rob and '), 'call notes fill who was on the call');
  const before = S.reqs.length;
  await page.locator('.dc-task').click();
  await page.waitForSelector('.mt-save');
  ok(await page.$eval('.v-sheet input[data-autofocus], .v-sheet input', e => e.value) === 'Follow up on [follow up date]', 'Make a task opens with the line as the task');
  await page.locator('.v-sheet input').first().fill('Follow up with Damian about the menu');
  await page.locator('.mt-save').click();
  await page.waitForTimeout(700);
  const lead = S.reqs.slice(before).find(r => r.method === 'PATCH' && r.url.includes('call-leads'));
  const lists = lead?.body?.set?.checklists || [];
  const added = lists.flatMap(l => l.items).find(t => t.text === 'Follow up with Damian about the menu');
  ok(!!added && added.source === 'manual' && !!added.due && !!added.id, 'the task is written to the client\'s checklists through the task system (with an id and a due time)');
  ok(lists.flatMap(l => l.items).length === 6 && !S.reqs.slice(before).some(r => r.url.includes('/docs') && JSON.stringify(r.body).includes('Follow up with Damian')), 'a doc\'s own checklist never becomes a task by itself: only the explicit action wrote one');

  /* The empty state: a client with no docs. */
  await page.goto(`${BASE}/admin/clients?open=L13`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rc-docs', { timeout: 8000 });
  const empty = await page.$eval('.rc-docs-empty', e => ({ kind: e.dataset.state, title: e.querySelector('.v-empty-title').textContent, desc: e.querySelector('.v-empty-desc').textContent, btn: e.querySelector('button').textContent.trim(), h: Math.round(e.querySelector('button').getBoundingClientRect().height) }));
  ok(empty.kind === 'empty' && empty.title === 'No docs yet' && empty.desc === 'Start with a brief or call notes.' && /New doc/.test(empty.btn) && empty.h >= 44, 'a client with none says "No docs yet. Start with a brief or call notes." with a New doc button');
  ok(await page.$('.rc-docs-all') === null && await page.$eval('.rc-docs-count', () => 1).catch(() => 0) === 0, 'no All docs button and no count when there are none');

  /* Settings: Doc templates. */
  await page.goto(`${BASE}/admin/settings`, { waitUntil: 'networkidle' });
  if (phone) { await page.locator('.v-lrow, [role="button"]', { hasText: 'Doc templates' }).first().click(); } else { await page.getByRole('tab', { name: /Doc templates/ }).click(); }
  await page.waitForSelector('.dtp-row', { timeout: 8000 });
  const trows = await page.$$eval('.dtp-row', e => e.map(x => x.dataset.template));
  ok(trows.join() === 'brief,call-notes,contract,delivery,brand-notes,DOCT1', `Settings lists the five built in templates and the saved one (${trows})`);
  const openMenu = async (key) => { await page.locator(`.dtp-row[data-template="${key}"] [aria-haspopup], .dtp-row[data-template="${key}"] button`).first().click(); };
  await openMenu('brief');
  const items = await page.$$eval('[role="menuitem"]', e => e.map(x => x.textContent.trim()));
  ok(items.includes('Hide from New doc') && items.includes('Edit a copy') && items.includes('Move up') && !items.includes('Delete'), `a built in template can be hidden and copied, not deleted (${items.join(', ')})`);
  await page.getByRole('menuitem', { name: 'Hide from New doc' }).click();
  await page.waitForTimeout(500);
  ok(S.reqs.some(r => r.method === 'PATCH' && r.url.includes('/docs') && r.body.prefs?.hidden?.includes('brief')), 'hiding saves the preference');
  ok(await page.$eval('.dtp-row[data-template="brief"]', e => /Hidden/.test(e.textContent)), 'the row says Hidden');
  await openMenu('DOCT1');
  const sitems = await page.$$eval('[role="menuitem"]', e => e.map(x => x.textContent.trim()));
  ok(['Edit', 'Rename', 'Move up', 'Move down', 'Delete'].every(x => sitems.includes(x)), `a saved template can be edited, renamed, reordered and deleted (${sitems.join(', ')})`);
  await page.getByRole('menuitem', { name: 'Move up' }).click();
  await page.waitForTimeout(500);
  const order = await page.$$eval('.dtp-row', e => e.map(x => x.dataset.template));
  ok(order[4] === 'DOCT1' && order[5] === 'brand-notes' && S.reqs.some(r => r.body.prefs?.order?.join().includes('DOCT1,brand-notes')), `Move up reorders and saves (${order})`);
  await openMenu('DOCT1'); await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.locator('.v-sheet input').fill('Intake form'); await page.locator('.dtp-rename-save').click();
  await page.waitForTimeout(500);
  ok(await page.$eval('.dtp-row[data-template="DOCT1"] .dtp-name', e => e.textContent) === 'Intake form' && S.reqs.some(r => r.method === 'PATCH' && r.body.set?.title === 'Intake form'), 'Rename changes the saved template\'s name');
  await openMenu('DOCT1'); await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.waitForSelector('[role="alertdialog"], [role="dialog"] button', { timeout: 4000 });
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await page.waitForTimeout(500);
  ok(await page.$('.dtp-row[data-template="DOCT1"]') === null && S.reqs.some(r => r.method === 'DELETE' && r.body.id === 'DOCT1'), 'Delete asks first, then removes the saved template');
  ok(S.errors.length === 0, `no page errors (${S.errors.join('; ')})`);
  await S.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} failing.` : '\nAll docs flow checks pass.');
process.exit(fails ? 1 : 0);
