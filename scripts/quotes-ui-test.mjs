#!/usr/bin/env node
/* The Quotes page in a browser at 390 and 1280, against the mocked API (scripts/audit-fixtures.mjs): the list (search, chips, no
 * results), New quote, someone new (a lead, stage lead, source quote), a logo plus 250 cards, a price edit, a Free line, a custom
 * "Yard signs" line of ten with a cost and a supplier, Save as an item and a saved item added, the honest package check, the totals
 * and what only Rob sees, autosave (the quote, then its summary on the deal), Copy as text, the quote email as a draft into the send
 * sheet with nothing sent, Mark accepted, Duplicate, and the deposit invoice on the deal.
 *   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/quotes-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes, leads } from './audit-fixtures.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || process.env.PLAYWRIGHT_CHROMIUM || undefined;
let fails = 0; let count = 0;
const ok = (pass, desc) => { count++; if (!pass) fails++; console.log((pass ? 'ok   ' : 'FAIL ') + desc); };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const bodyOf = (r) => { try { return JSON.parse(r.request().postData() || 'null'); } catch { return null; } };

for (const w of [390, 1280]) {
  console.log(`\n== ${w} ==`);
  const phone = w < 768;
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block', timezoneId: 'America/New_York' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch { /* fine */ } });
  await mockRoutes(page, { session: true });
  const R = { quotes: [], leads: [], settings: [], sends: [], approves: [], projects: [] };
  const NEW_ID = `LQ${w}`; const NAME = `Riverside Lawn Care ${w}`;
  await page.route('**/api/admin/quotes**', (r) => { if (r.request().method() !== 'GET') R.quotes.push({ method: r.request().method(), body: bodyOf(r), url: r.request().url() }); return r.fallback(); });
  await page.route('**/api/admin/call-leads**', (r) => {
    const m = r.request().method(); if (m === 'GET') return r.fallback();
    const body = bodyOf(r); R.leads.push({ method: m, body });
    if (m === 'POST') { leads.push({ ...leads[3], ...body, _id: NEW_ID, deal: undefined, checklists: [], nextAction: null }); return r.fulfill(json({ ok: true, inserted: 1 })); }
    return r.fulfill(json({ ok: true }));
  });
  await page.route('**/api/admin/projects**', (r) => { if (r.request().method() === 'GET') return r.fallback(); R.projects.push({ method: r.request().method(), body: bodyOf(r) }); return r.fulfill(json({ ok: true })); });
  await page.route('**/api/admin/settings**', (r) => { if (r.request().method() !== 'GET') R.settings.push(bodyOf(r)); return r.fallback(); });
  await page.route('**/api/admin/email/send**', (r) => { R.sends.push(bodyOf(r)); return r.fallback(); });
  await page.route('**/api/admin/email/approve**', (r) => { R.approves.push(bodyOf(r)); return r.fallback(); });
  const stepTo = async (id) => {
    if (!phone) return;
    if (await page.locator('.qb-step').count()) await page.locator('.sh-top-back').click();
    await page.waitForSelector('.qb-over', { timeout: 10000 });
    await page.locator(`.qb-step-row[data-step="${id}"]`).click();
    await page.waitForSelector(`.qb-step[data-step="${id}"]`, { timeout: 5000 });
  };
  const lastQuote = () => [...R.quotes].reverse().find(x => x.method === 'PATCH' && x.body?.set?.lines)?.body.set;
  const lastMirror = () => [...R.leads].reverse().find(x => x.body?.set?.deal?.quote)?.body.set.deal.quote;
  const text = async (sel) => (await page.locator(sel).first().textContent().catch(() => '')) || '';

  /* The list. */
  await page.goto(`${BASE}/admin/quotes`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.qs-row', { timeout: 15000 });
  ok((await page.locator('.qs-row').count()) === 4 && /4 quotes/.test(await text(phone ? '.qs-count' : '.qs-page .v-section-desc')), 'the list holds every quote under its count line');
  ok(/Draft\s*1/.test(await text('.qs-chip--draft')) && /All\s*4/.test(await text('.qs-chip--all')) && /Accepted\s*1/.test(await text('.qs-chip--accepted')), 'the chips carry their counts');
  ok((await page.locator('.qs-row .v-stretch').count()) === 4 && (await page.locator('.qs-row button, .qs-row a').count()) === 4, 'one real control per row');
  ok(/Lead Business 11/.test(await text('.qs-row[data-row-id="QT1"]')) && /Q-0004/.test(await text('.qs-row[data-row-id="QT1"]')) && /\$325/.test(await text('.qs-row[data-row-id="QT1"] .qs-amt')) && /Sent/.test(await text('.qs-row[data-row-id="QT1"]')), 'a row reads the business, the number, the total and where it stands');
  await page.locator('.qs-chip--sent').click();
  ok((await page.locator('.qs-row').count()) === 1, 'a chip narrows the list');
  await page.locator('.qs-chip--all').click();
  await page.locator('.qs-search input').fill('q-0002');
  ok((await page.locator('.qs-row').count()) === 1 && /Lead Business 12/.test(await text('.qs-row')), 'search finds a quote by its number');
  await page.locator('.qs-search input').fill('zzzz');
  await page.waitForSelector('[data-state="no-results"]', { timeout: 4000 }).catch(() => {});
  ok(/zzzz/.test(await text('[data-state="no-results"]')) && (await page.locator('.qs-row').count()) === 0, 'a search with no match names what was typed');
  await page.locator('.qs-search input').fill('');

  /* New quote. */
  await page.locator('.qs-new').click();
  await page.waitForURL(/\/admin\/quotes\/QN5/, { timeout: 8000 });
  await page.waitForSelector(phone ? '.qb-over' : '.qb-cols', { timeout: 8000 });
  ok(R.quotes.length === 1 && R.quotes[0].method === 'POST' && R.quotes[0].body.lines.length === 0 && R.quotes[0].body.leadId === '', 'New quote makes one draft and opens it');
  if (phone) ok((await page.locator('.qb-step-row').count()) === 4 && (await page.locator('[data-step-card]').count()) === 0, 'on a phone the editor is an overview of four rows, each opening its step');
  else ok((await page.locator('[data-step-card]').count()) === 4 && (await page.locator('.qb-step-row').count()) === 0, 'on a computer the four steps sit side by side');

  /* Who: someone new. */
  await stepTo('who');
  await page.locator('.qb-who-new').click();
  await page.waitForSelector('.qb-newwho-add', { timeout: 4000 });
  await page.getByLabel('Business').fill(NAME);
  await page.getByLabel('Name', { exact: true }).fill('Pat Rivers');
  await page.getByLabel('Phone').fill('(302) 555-0199');
  await page.getByLabel('Email').fill('pat@riverside.example');
  await page.locator('.qb-newwho-add').click();
  await page.waitForSelector('.qb-who-now', { timeout: 6000 });
  const made = R.leads.find(x => x.method === 'POST')?.body || {};
  ok(made.business === NAME && made.askFor === 'Pat Rivers' && made.stage === 'lead' && made.source === 'quote' && made.email === 'pat@riverside.example', 'someone new is a lead through the normal lead POST: stage lead, source quote');
  ok((await text('.qb-who-now')).includes(NAME), 'and the quote is theirs');
  await page.waitForTimeout(1100);
  ok(R.quotes.some(x => x.method === 'PATCH' && x.body?.set?.leadId === NEW_ID), 'the lead is attached by the autosave');

  /* What they need: a logo plus 250 cards. */
  await stepTo('need');
  await page.locator('.qb-row[data-row="item:logo"]').click();
  await page.locator('.qb-group--print').click();
  await page.locator('.qb-row[data-row="print:cards-250"]').click();
  ok((await page.locator('.qb-line').count()) === 2 && (await page.locator('.qb-line[data-line="logo"] .qb-price input').inputValue()) === '250' && /List \$250/.test(await text('.qb-line[data-line="logo"]')), 'a tap adds a line at its list price, the list price under the field');
  ok((await page.locator('.qb-line[data-line="logo"] .qb-qty').count()) === 1 && (await page.locator('.qb-line[data-line="cards-250"] .qb-qty-n input').inputValue()) === '1', 'a line has a quantity stepper');
  await page.locator('.qb-line[data-line="cards-250"] .qb-qty-more').click();
  ok((await page.locator('.qb-line[data-line="cards-250"] .qb-qty-n input').inputValue()) === '2' && /\$70/.test(await text('.qb-line[data-line="cards-250"] .qb-line-total')), 'one more is two, and the line total follows');
  /* A price edit. */
  await page.locator('.qb-line[data-line="logo"] .qb-price input').fill('199.50');
  ok(/\$50\.50 off list/.test(await text('.qb-line[data-line="logo"]')) && /\$199\.50/.test(await text('.qb-line[data-line="logo"] .qb-line-total')), 'a price edit is Rob\'s price, and the line says what it is off list');
  /* A Free line. */
  await page.locator('.qb-line[data-line="cards-250"] .qb-free input').check();
  ok(/On me/.test(await text('.qb-line[data-line="cards-250"] .qb-line-total')) && (await page.locator('.qb-line[data-line="cards-250"] .qb-price input').isDisabled()), 'Free charges nothing for the line');
  /* A custom item. */
  await page.locator('.qb-add-custom').click();
  await page.waitForSelector('.qb-custom-name', { timeout: 4000 });
  await page.locator('.qb-custom-name input').fill('Yard signs');
  await page.locator('.qb-custom-qty input').fill('10');
  await page.locator('.qb-custom-unit input').fill('12.5');
  ok((await page.locator('.qb-custom-cost').count()) === 0, 'cost, supplier and note start collapsed');
  await page.locator('.qb-custom-more').click();
  ok(/Only you see this/.test(await text('.qb-custom .qb-mine')), 'and are marked Only you see this');
  await page.locator('.qb-custom-cost input').fill('4.25');
  await page.locator('.qb-custom-link input').fill('https://signs-supplier.example/order');
  await page.locator('.qb-custom-note input').fill('SUPPLIER-LINE-NOTE');
  await page.locator('.qb-custom-save').click();
  await page.waitForSelector('.qb-line[data-kind="custom"]', { timeout: 4000 });
  ok((await page.locator('.qb-line').count()) === 3 && /Yard signs/.test(await text('.qb-line[data-kind="custom"]')) && /\$125\.00/.test(await text('.qb-line[data-kind="custom"] .qb-line-total')) && (await page.locator('.qb-line[data-kind="custom"] .qb-supplier').count()) === 1, 'a custom item is a line: ten yard signs at $12.50, with Open supplier');
  /* Save as an item, and a saved item added. */
  await page.locator('.qb-line[data-kind="custom"] .qb-line-menu button').first().click();
  await page.getByRole('menuitem', { name: 'Save as an item' }).click();
  await page.waitForTimeout(500);
  const savedSet = R.settings.at(-1)?.set?.quoteItems || [];
  ok(savedSet.length === 2 && savedSet[0].label === 'Yard signs' && savedSet[0].unit === 12.5 && savedSet[0].cost === 4.25 && savedSet[0].supplierUrl === 'https://signs-supplier.example/order' && !('qty' in savedSet[0]), 'Save as an item writes it to the saved items in settings: the name, the price, the cost, the supplier');
  await page.locator('.qb-group--saved').click();
  await page.locator('.qb-row[data-row="saved:s1"]').click();
  ok((await page.locator('.qb-line').count()) === 4 && (await page.locator('.qb-line[data-kind="custom"]').count()) === 2, 'a saved item is added as a custom line at its saved price');
  /* The honest package check. */
  await page.locator('.qb-group--brand').click();
  await page.locator('.qb-row[data-row="item:palette-type"]').click();
  await page.locator('.qb-row[data-row="item:brand-sheet"]').click();
  await stepTo('check');
  ok((await page.locator('.qb-check').count()) === 0, 'with the logo under list the lines already cost less than the package, so nothing is said');
  await stepTo('need');
  await page.locator('.qb-line[data-line="logo"] .qb-price input').fill('250');
  await stepTo('check');
  ok((await text('.qb-check-t')) === 'Brand Starter covers these for $350, $25 less.', `the honest package check (${await text('.qb-check-t')})`);
  /* Check: the totals and what only Rob sees. */
  ok((await text('.qb-total')) === '$512.50' && (await text('.qb-deposit')) === '$257' && (await text('.qb-off-total')) === '$70.00' && (await text('.qb-free-total')) === '$70.00', `the total, the deposit rounded up, off list and given free (${await text('.qb-total')}, ${await text('.qb-deposit')}, ${await text('.qb-off-total')})`);
  ok(/Only you see this/.test(await text('.qb-totals .qb-mine')) && /2 revision rounds/.test(await text('.qb-terms-card')) && /Only you see this/.test(await text('.qb-terms-card .qb-mine')) && (await page.locator('.qb-days input').inputValue()) === '30' && (await page.locator('.qb-retainer input').isChecked()), 'the terms, good for 30 days, the retainer pitch on; off list, given free and the private note are marked Only you see this');
  ok(/Total \$512\.50, deposit \$257/.test(await text('.qb-page [aria-live="polite"].v-sr-only')), 'the total is announced in a live region');
  await page.locator('.qb-note textarea').fill('Signs ship in a week.');
  await page.locator('.qb-private textarea').fill('PRIVATE-MARGIN-NOTE');
  await page.waitForTimeout(1200);
  const sq = lastQuote(); const mq = lastMirror();
  ok(sq && sq.lines.length === 6 && sq.note === 'Signs ship in a week.' && sq.privateNote === 'PRIVATE-MARGIN-NOTE' && sq.lines.find(l => l.id === 'cards-250').qty === 2 && sq.lines.find(l => l.id === 'cards-250').free === true && sq.lines.filter(l => l.kind === 'custom').length === 2, 'the draft saves itself: one PATCH with every line and both notes');
  ok(mq && mq.total === 512.5 && mq.deposit === 257 && mq.givenFree === 70 && mq.quoteId === 'QN5' && mq.lines.length === 6 && mq.lines.every(l => typeof l.listPrice === 'number'), `and leaves its summary on the lead's deal (${mq?.total}, deposit ${mq?.deposit})`);
  ok((await page.locator('.sb-chip').getAttribute('data-save')) === 'saved', 'the chip says Saved');

  /* Send: Copy as text, the draft email, the statuses, Duplicate, the invoice. */
  await stepTo('send');
  await page.locator('.qb-copy').click(); await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  ok(/Yard signs x 10: \$125\.00/.test(clip) && /Business cards, 250 x 2: on me/.test(clip) && /Total \$512\.50\./.test(clip) && /Signs ship in a week\./.test(clip) && !/4\.25|signs-supplier|SUPPLIER-LINE-NOTE|PRIVATE-MARGIN-NOTE|off list/i.test(clip), 'Copy as text reads what the client may read and nothing of Rob\'s');
  await page.locator('.qb-draft').click();
  await page.waitForSelector('.ss-send', { timeout: 8000 });
  const sent = R.sends.at(-1) || {};
  const ov = JSON.stringify(sent.override || {});
  ok(sent.templateId === 'custom' && sent.recordId === NEW_ID && !sent.send && !sent.approvedAt && /Your quote from Visualize, Pat/.test(sent.override?.subject || ''), 'Draft the quote email posts the custom template with no send and no stamp');
  ok(/Yard signs x 10: \$125\.00/.test(ov) && !/4\.25|signs-supplier|SUPPLIER-LINE-NOTE|PRIVATE-MARGIN-NOTE|off list/i.test(ov), 'the email carries the lines and nothing of Rob\'s');
  ok((await page.locator('.ss-send').count()) === 1 && R.approves.length === 0, 'the send sheet opens on the draft and nothing has been sent');
  ok(R.quotes.some(x => x.method === 'PATCH' && typeof x.body?.set?.emailLogId === 'string' && x.body.set.emailLogId), 'the quote remembers the email it drafted, so it turns sent when that email goes out');
  await page.keyboard.press('Escape'); await page.locator('.ss-send').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
  await page.locator('.qb-mark-accepted').click(); await page.waitForTimeout(500);
  ok(R.quotes.some(x => x.method === 'PATCH' && x.body?.set?.status === 'accepted') && /Accepted/.test(await text('.qb-send .qb-status')), 'Mark accepted writes the status');
  await page.locator('.qb-mark-draft').click(); await page.waitForTimeout(400);
  const before = R.leads.length;
  await page.locator('.qb-invoice').click(); await page.waitForTimeout(900);
  const dw = R.leads.slice(before).find(x => x.body?.set?.deal?.invoices)?.body.set.deal;
  const inv = dw?.invoices?.at(-1);
  ok(inv && inv.amount === 257 && inv.kind === 'deposit' && inv.status === 'draft' && inv.items.some(i => i.label === 'Yard signs x 10' && i.amount === 125) && inv.items.some(i => i.label === 'Business cards, 250 x 2' && i.amount === 'Included') && !/4\.25|signs-supplier|SUPPLIER-LINE-NOTE|PRIVATE-MARGIN-NOTE/.test(JSON.stringify(inv)), 'Make the deposit invoice adds the deposit to the lead\'s deal: the lines as rows, nothing of Rob\'s');
  ok(/\/email\/compose/.test(page.url()) && /template=invoice/.test(page.url()), 'and opens Compose on the invoice template');
  ok(R.approves.length === 0 && R.sends.every(p => !p?.send && !p?.approvedAt), 'nothing on these screens sent anything');

  /* A client: the invoice goes on their newest open project. Then Duplicate. */
  await page.goto(`${BASE}/admin/quotes/QT1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(phone ? '.qb-over' : '.qb-cols', { timeout: 10000 });
  await stepTo('send');
  ok(/^Goes on .+\.$/.test(await text('.qb-invoice-note')) && !/their deal/.test(await text('.qb-invoice-note')), `a client's invoice names the open project it goes on (${await text('.qb-invoice-note')})`);
  const l0 = R.leads.length;
  await page.locator('.qb-invoice').click(); await page.waitForTimeout(900);
  const pinv = R.projects.find(x => x.method === 'PATCH' && Array.isArray(x.body?.set?.invoices))?.body.set.invoices.at(-1);
  ok(pinv && pinv.amount === 163 && pinv.kind === 'deposit' && pinv.items.some(i => i.label === 'Yard signs x 10' && i.amount === 125) && !R.leads.slice(l0).some(x => x.body?.set?.deal?.invoices), 'and it is added to that project, not to a deal');
  await page.goto(`${BASE}/admin/quotes/QT1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(phone ? '.qb-over' : '.qb-cols', { timeout: 10000 });
  await stepTo('send');
  const n0 = R.quotes.length;
  await page.locator('.qb-dup').click();
  await page.waitForURL(/\/admin\/quotes\/QN/, { timeout: 8000 }).catch(() => {});
  ok(R.quotes.slice(n0).some(x => x.method === 'POST' && x.body?.from === 'QT1') && /\/admin\/quotes\/QN/.test(page.url()), 'Duplicate makes a copy and opens it');

  /* Leaving inside the autosave wait by something other than Back: the last change is still saved. */
  if (!phone) {
    await page.waitForSelector('.qb-note textarea', { timeout: 8000 });
    await page.locator('.qb-note textarea').fill('LAST-EDIT-BEFORE-LEAVING');
    await page.locator('nav').getByText('Quotes', { exact: true }).first().click();
    await page.waitForSelector('.qs-row', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    ok(R.quotes.some(x => x.method === 'PATCH' && x.body?.set?.note === 'LAST-EDIT-BEFORE-LEAVING') && /\/admin\/quotes$/.test(page.url()), 'a change made just before leaving by the sidebar is saved on the way out');
  }

  const at = leads.findIndex(l => l._id === NEW_ID); if (at >= 0) leads.splice(at, 1);
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} failing of ${count}.` : `\nAll ${count} quotes UI checks pass.`);
process.exit(fails ? 1 : 0);
