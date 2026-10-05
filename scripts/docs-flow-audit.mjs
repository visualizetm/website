#!/usr/bin/env node
/* The docs flows in a browser (docs job): the client page's Docs card (rows, pinned first, two line titles, empty state, New doc), the New doc
 * sheet and what each template fills for this client, Make a task on a call note's follow up line (through the real task write), the
 * Settings Doc templates tab (hide, reorder, rename, delete; built in ones cannot be deleted), and the Docs lists and search added in
 * milestone 5. At 390 and 1280.   node scripts/docs-flow-audit.mjs        AUDIT_BASE=http://127.0.0.1:4331 node scripts/docs-flow-audit.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, DOCS } from './audit-fixtures.mjs';

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

/* ── Milestone 5: All docs, the More page, search, History and Recently Deleted ── */
const touch = async (page, steps) => { const cdp = await page.context().newCDPSession(page); for (const st of steps) { await cdp.send('Input.dispatchTouchEvent', st); if (st.wait) await page.waitForTimeout(st.wait); } await cdp.detach(); };
const swipe = async (page, x0, y, x1, steps = 10) => { const pts = [{ type: 'touchStart', touchPoints: [{ x: x0, y }], wait: 16 }]; for (let i = 1; i <= steps; i++) pts.push({ type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y }], wait: 16 }); pts.push({ type: 'touchEnd', touchPoints: [], wait: 50 }); await touch(page, pts); };
for (const width of [390, 1280]) {
  const phone = width < 768;
  console.log(`\n── All docs, ${width}px ──`);
  const S = await session(width);
  const { page } = S;
  await page.goto(`${BASE}/admin/clients/L11/docs`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.ad-group', { timeout: 8000 });
  const heads = await page.$$eval('.ad-group-h', e => e.map(x => x.textContent));
  ok(heads.length === 5 && heads[0].startsWith('Brief') && heads[1].startsWith('Call notes') && heads[4].startsWith('Brand notes'), `one client's docs are grouped by type in the type order (${heads.join(', ')})`);
  ok(await page.$$eval('.rc-docs-row', e => e.length) === 5 && await page.$eval('.rc-docs-row .rc-docs-pin', e => !!e), 'every doc is a row, the pinned one marked');
  await page.locator('.ad-search input, input[aria-label="Search docs"]').first().fill('neighbourhood');
  await page.waitForTimeout(300);
  ok(await page.$$eval('.rc-docs-row', e => e.map(x => x.dataset.docId).join()) === 'DOC1', 'search finds a doc by what is inside it (block text)');
  await page.locator('input[aria-label="Search docs"]').fill('zzqqxx');
  await page.waitForTimeout(300);
  const nr = await page.$eval('[data-state]', e => ({ kind: e.dataset.state, title: e.querySelector('.v-empty-title').textContent }));
  ok(nr.kind === 'no-results' && nr.title.includes('zzqqxx') && await page.$('[data-state="empty"]') === null, `a search with no match says so and names the search, not the first time state (${nr.title})`);
  await page.getByRole('button', { name: /Clear search/ }).first().click();
  await page.waitForTimeout(300);
  await page.getByLabel('Type', { exact: true }).selectOption({ label: 'Contract, 1' });
  await page.waitForTimeout(300);
  ok(await page.$$eval('.ad-group', e => e.length) === 1 && await page.$$eval('.rc-docs-row', e => e.length) === 1, 'the type filter narrows to one group');
  await page.getByLabel('Type', { exact: true }).selectOption({ label: 'All types' });
  await page.getByLabel('Sort', { exact: true }).selectOption({ label: 'Created' });
  await page.waitForTimeout(300);
  ok(await page.$eval('.ad-group:first-of-type .rc-docs-row', e => e.dataset.docId) === 'DOC1', 'sort by Created keeps the pinned doc first');

  if (phone) {
    const box = await page.locator('.rc-docs-row[data-doc-id="DOC3"]').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' })).then(() => page.waitForTimeout(500)).then(() => page.locator('.rc-docs-row[data-doc-id="DOC3"]').boundingBox());
    const x = box.x + box.width / 2; const y = box.y + box.height / 2;
    await touch(page, [{ type: 'touchStart', touchPoints: [{ x, y }], wait: 650 }, { type: 'touchEnd', touchPoints: [] }]);
    await page.waitForSelector('.rs-actions', { timeout: 3000 });
    const labels = await page.$$eval('.rs-act', e => e.map(x => x.textContent.trim()));
    ok(['Open', 'Pin to card', 'Duplicate', 'Copy as text', 'Move to Recently Deleted'].every(l => labels.includes(l)), `a long press opens the row's sheet (${labels.join(', ')})`);
    await page.locator('.rs-act', { hasText: 'Pin to card' }).click();
    await page.waitForTimeout(400);
    ok(S.reqs.some(r => r.method === 'PATCH' && r.body.id === 'DOC3' && r.body.set?.pinned === true), 'Pin from the sheet pins the doc');
    const b2 = await page.locator('.rc-docs-row[data-doc-id="DOC4"]').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' })).then(() => page.waitForTimeout(500)).then(() => page.locator('.rc-docs-row[data-doc-id="DOC4"]').boundingBox());
    const y2 = b2.y + b2.height / 2;
    await swipe(page, 300, y2, 100);
    await page.waitForTimeout(500);
    ok(S.reqs.some(r => r.method === 'DELETE' && r.body.id === 'DOC4') && await page.$('.rc-docs-row[data-doc-id="DOC4"]') === null, 'a swipe left deletes the doc and it leaves the list');
    await page.locator('.v-toast-action', { hasText: 'Undo' }).click();
    await page.waitForTimeout(500);
    ok(S.reqs.some(r => r.method === 'PATCH' && r.body.id === 'DOC4' && r.body.restore === true), 'Undo restores it');
    const b3 = await page.locator('.rc-docs-row[data-doc-id="DOC2"]').evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' })).then(() => page.waitForTimeout(500)).then(() => page.locator('.rc-docs-row[data-doc-id="DOC2"]').boundingBox());
    const y3 = b3.y + b3.height / 2;
    await swipe(page, 60, y3, 260);
    await page.waitForTimeout(500);
    ok(S.reqs.some(r => r.method === 'PATCH' && r.body.id === 'DOC2' && r.body.set?.pinned === true), 'a swipe right pins the doc');
  } else {
    await page.locator('.rc-docs-row[data-doc-id="DOC3"] [aria-haspopup]').click();
    const labels = await page.$$eval('[role="menuitem"]', e => e.map(x => x.textContent.trim()));
    ok(['Open', 'Pin to card', 'Duplicate', 'Copy as text', 'Move to Recently Deleted'].every(l => labels.includes(l)), `each row has a menu (${labels.join(', ')})`);
    await page.getByRole('menuitem', { name: 'Pin to card' }).click();
    await page.waitForTimeout(400);
    ok(S.reqs.some(r => r.method === 'PATCH' && r.body.id === 'DOC3' && r.body.set?.pinned === true), 'Pin from the menu pins the doc');
    await page.locator('.rc-docs-row[data-doc-id="DOC4"] [aria-haspopup]').click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await page.waitForTimeout(600);
    ok(S.reqs.some(r => r.method === 'POST' && r.body.title === 'Copy of Delivery notes' && r.body.leadId === 'L11'), 'Duplicate makes "Copy of ..." for the same client');
    await page.locator('.rc-docs-row[data-doc-id="DOC5"] [aria-haspopup]').click();
    await page.getByRole('menuitem', { name: 'Move to Recently Deleted' }).click();
    await page.waitForTimeout(500);
    ok(S.reqs.some(r => r.method === 'DELETE' && r.body.id === 'DOC5') && await page.$('.rc-docs-row[data-doc-id="DOC5"]') === null, 'Move to Recently Deleted removes the row and offers Undo');
    ok(await page.locator('.v-toast-action', { hasText: 'Undo' }).count() === 1, 'with an Undo');
  }

  /* The More page and the all clients list. */
  await page.goto(`${BASE}/admin/more`, { waitUntil: 'networkidle' }).catch(() => {});
  if (phone) {
    await page.waitForSelector('.mo-page', { timeout: 8000 });
    ok(await page.getByRole('button', { name: /^Docs/ }).count() >= 1 || await page.locator('.v-lrow', { hasText: 'Docs' }).count() >= 1, 'the More page has a Docs row');
    await page.locator('.v-lrow', { hasText: /^Docs/ }).first().click();
  } else await page.goto(`${BASE}/admin/docs`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.rc-docs-row', { timeout: 8000 });
  const all = await page.$$eval('.rc-docs-row', e => e.map(x => ({ id: x.dataset.docId, client: x.querySelector('.rc-docs-client')?.textContent || '' })));
  ok(all.length >= 6 && all.every(r => r.client) && all.some(r => r.client === 'Lead Business 12'), `Docs across every client, each row naming its client (${all.length} rows)`);
  await page.getByLabel('Client', { exact: true }).selectOption({ label: 'Lead Business 12' }).catch(() => {});
  await page.waitForTimeout(300);
  ok(await page.$$eval('.rc-docs-row', e => e.map(x => x.dataset.docId).join()) === 'DOC6', 'the client filter narrows to that client');

  /* Global search. */
  await page.goto(`${BASE}/admin/clients`, { waitUntil: 'networkidle' });
  if (phone) await page.locator('.sh-top-searchbtn').click(); else await page.locator('.sh-cmd-field input, input[aria-label="Search"]').first().focus();
  await page.locator('input[aria-label="Search"]').first().fill('neighbourhood');
  await page.waitForSelector('.sh-cmd-row', { timeout: 4000 });
  const hit = await page.$eval('.sh-cmd-row', e => e.textContent);
  ok(/Project brief/.test(hit) && /Lead Business 11/.test(hit) && await page.$eval('.sh-cmd-group', e => e.textContent) === 'Docs', `search finds a doc by what is inside it and shows the client's name (${hit.slice(0, 60)})`);
  await page.locator('.sh-cmd-row').first().click();
  await page.waitForSelector('.dc-blocks', { timeout: 8000 });
  ok(await page.$eval('.dd-title', e => e.textContent) === 'Project brief', 'picking it opens the doc');

  /* History and Recently Deleted. */
  const H = await session(width);
  await H.page.goto(`${BASE}/admin/clients?open=L11`, { waitUntil: 'networkidle' });
  await H.page.waitForSelector('.rc-docs-new');
  await H.page.locator('.rc-docs-new').click(); await H.page.waitForSelector('.nd-opt[data-template="brief"]');
  await H.page.locator('.nd-opt[data-template="brief"]').click(); await H.page.waitForSelector('.dc-blocks');
  await (phone ? H.page.locator('.sh-top-back') : H.page.locator('.dd-back')).click();
  await H.page.waitForSelector('.rc-docs-row');
  await H.page.locator('.rc-docs-row').first().locator('.v-stretch').click(); await H.page.waitForSelector('.dc-blocks');
  await H.page.locator('.sh-top-action[aria-label="Doc actions"], .dd-more').first().click();
  await H.page.locator('.rs-act', { hasText: 'Move to Recently Deleted' }).click();
  await H.page.waitForSelector('.rc-docs-row', { timeout: 8000 });
  await H.page.getByRole(phone ? 'button' : 'tab', { name: /History/ }).first().click();
  await H.page.waitForSelector('.lh-row', { timeout: 6000 });
  const lh = await H.page.$$eval('.lh-row', e => e.map(x => x.textContent));
  ok(lh.some(t => /Created doc/.test(t)) && lh.some(t => /Deleted doc/.test(t)), `the client's History says Created doc and Deleted doc (${lh.length} rows)`);
  ok(S.errors.length === 0 && H.errors.length === 0, `no page errors (${[...S.errors, ...H.errors].join('; ')})`);
  await H.ctx.close();

  const D = await session(width, { docs: [...DOCS, { _id: 'DOCX', leadId: 'L11', template: false, projectId: '', type: 'brief', title: 'Old brief', pinned: false, blocks: [], deleted: true, deletedAt: new Date().toISOString(), createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-02T10:00:00.000Z' }] });
  await D.page.goto(`${BASE}/admin/settings/deleted`, { waitUntil: 'networkidle' });
  await D.page.waitForSelector('.st-deleted', { timeout: 8000 });
  const dr = await D.page.$$eval('.st-deleted tbody tr, .st-deleted [role="row"]', e => e.map(x => x.textContent));
  ok(dr.some(t => /Old brief/.test(t) && /Doc, Brief/.test(t)), `Recently Deleted lists a deleted doc with its type (${dr.length} rows)`);
  await D.page.locator('.st-restore').first().click();
  await D.page.waitForTimeout(600);
  ok(D.reqs.some(r => r.method === 'PATCH' && r.body.id === 'DOCX' && r.body.restore === true), 'Restore brings the doc back');
  await D.ctx.close();
  await S.ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} failing.` : '\nAll docs flow checks pass.');
process.exit(fails ? 1 : 0);
