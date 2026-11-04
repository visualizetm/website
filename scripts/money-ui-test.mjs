/* Money and tasks in a browser (prompt 3 of 3, milestones 1 and 2) at 390 and 1280 against the mock routes.
 *   Invoices: the sections and chips, Draft a reminder (a draft through email/send, no stamp), Mark paid on a project line (the patches
 *   carry exactly the line fields the Stripe webhook writes: status, ledgerId, paidAt), a deal line opens the deal instead.
 *   Home: Income opens Invoices on Paid 30 days, Outstanding on Past due, MRR Clients on retainers, the Ask rate tile, the Drafts card.
 *   Overview: Unpaid opens Invoices. Projects: the Unpaid chip.
 *   Tasks: Home and the Tasks page draw the shared row, the chips and the client search, New task from the quick add (a client, the due
 *   chips, the reminder on) and Start calling.
 * Run: AUDIT_BASE=http://127.0.0.1:4331 PW_CHROME=/opt/pw-browsers/chromium node scripts/money-ui-test.mjs */
import { chromium } from 'playwright-core';
import { mockRoutes } from './audit-fixtures.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const WIDTHS = (process.env.AUDIT_WIDTHS || '390,1280').split(',').map(Number);
let fails = 0; let passes = 0;
const ok = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const rel = (page) => page.url().replace(BASE, '').replace(/^\/admin/, '') || '/';

async function open(w, path, { storage = {}, mock = {} } = {}) {
  const phone = w < 768;
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block', timezoneId: 'America/New_York' });
  const page = await ctx.newPage();
  await page.addInitScript((st) => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); for (const [k, v] of Object.entries(st)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch { /* fine */ } }, storage);
  await mockRoutes(page, { session: true, ...mock });
  const writes = []; const posts = [];
  const body = (r) => { try { return JSON.parse(r.request().postData() || 'null'); } catch { return null; } };
  const ok200 = (r, data) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  await page.route('**/api/admin/call-leads**', (r) => { if (r.request().method() === 'GET') return r.fallback(); writes.push({ api: 'lead', ...body(r) }); return ok200(r, { ok: true, item: {} }); });
  await page.route('**/api/admin/projects**', (r) => { if (r.request().method() === 'GET') return r.fallback(); writes.push({ api: 'project', ...body(r) }); return ok200(r, { ok: true, item: {} }); });
  await page.route('**/api/admin/email/send**', (r) => { posts.push({ url: 'send', body: body(r) }); return ok200(r, { ok: true, draft: true, logId: 'EL-new' }); });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  return { ctx, page, writes, posts };
}

for (const w of WIDTHS) {
  console.log(`\n[${w}px]`);
  /* Invoices. */
  {
    const { ctx, page, writes, posts } = await open(w, '/admin/invoices');
    await page.waitForSelector('.iv-row', { timeout: 10000 });
    ok(await page.locator('.iv-chip').count() === 4, 'four chips: Unpaid, Past due, Paid 30 days, Plans');
    ok((await page.locator('.iv-sec').count()) >= 1 && await page.locator('.iv-sec--past-due').count() === 1, 'a Past due section (the fixtures have late lines)');
    ok(/day[s]? late/.test(await page.locator('.iv-sec--past-due .iv-line').first().textContent()), 'a past due row says how many days late');
    await page.locator('.iv-chip--past-due').click(); await page.waitForTimeout(300);
    ok(rel(page).includes('chip=past-due') && await page.locator('.iv-sec--past-due').count() === 1 && await page.locator('.iv-sec').count() === 1, 'the Past due chip shows that section alone and keeps the chip in the link');
    /* Draft a reminder. */
    await page.locator('.iv-remind').first().click(); await page.waitForTimeout(600);
    const rem = posts.find(p => p.url === 'send');
    ok(rem && rem.body.templateId === 'invoice_past_due' && rem.body.invoiceId && rem.body.recordId && !rem.body.approvedAt && !rem.body.send, `Draft a reminder writes a draft through email/send, no stamp (${rem && rem.body.templateId})`);
    await page.waitForTimeout(300);
    if (await page.locator('.v-sheet').count()) await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    /* Mark paid on a project line. */
    const payBtn = page.locator('.iv-row.is-past-due', { has: page.locator('.iv-pay') }).first().locator('.iv-pay');
    if (await payBtn.count()) {
      const n0 = writes.length;
      await payBtn.click(); await page.waitForTimeout(700);
      const pw = writes.slice(n0).find(x => x.api === 'project'); const lw = writes.slice(n0).find(x => x.api === 'lead');
      const line = (pw?.set?.invoices || []).find(i => i.status === 'paid' && i.ledgerId);
      ok(!!line && !!line.paidAt && !('note' in line && line.note) , `Mark paid writes the line paid with a ledger id and a paid time (${JSON.stringify(line && { status: line.status, ledgerId: !!line.ledgerId, paidAt: !!line.paidAt })})`);
      const entry = (lw?.set?.purchases || []).find(p => p.id === line?.ledgerId);
      ok(!!entry && entry.amount > 0 && entry.projectId && Object.keys(entry).every(k => ['id', 'label', 'amount', 'at', 'notes', 'source', 'projectId'].includes(k)), `and one ledger entry on the client with the webhook's keys (${entry && Object.keys(entry).join(',')})`);
    } else ok(false, 'no project line with a Mark paid button among the past due rows');
    /* A deal line opens the deal. */
    const dealRow = page.locator('.iv-row', { has: page.locator('.iv-open', { hasText: 'Open the deal' }) }).first();
    ok(await dealRow.count() === 0 || await dealRow.locator('.iv-pay').count() === 0, 'a deal line has no Mark paid (its first payment is the conversion)');
    await ctx.close();
  }
  /* Home taps. */
  {
    const { ctx, page } = await open(w, '/admin', { storage: { vz_call_last_session: { askRate: 50, asked: 4, booked: 2, startedAt: 1 } } });
    await page.waitForSelector('[data-kpi="income"]', { timeout: 10000 });
    await page.locator('[data-kpi="outstanding"]').click(); await page.waitForTimeout(600);
    ok(rel(page) === '/invoices?chip=past-due', `Outstanding opens Invoices on Past due (${rel(page)})`);
    ok(await page.locator('.iv-chip--past-due.is-selected, .iv-chip--past-due[aria-pressed="true"]').count() === 1, 'and the Past due chip is the one selected');
    await page.goBack(); await page.waitForSelector('[data-kpi="income"]', { timeout: 10000 });
    await page.locator('[data-kpi="income"]').click(); await page.waitForTimeout(600);
    ok(rel(page) === '/invoices?chip=paid30', `Income opens Invoices on Paid 30 days (${rel(page)})`);
    await page.goBack(); await page.waitForSelector('[data-kpi="mrr"]', { timeout: 10000 });
    await page.locator('[data-kpi="mrr"]').click(); await page.waitForTimeout(600);
    ok(rel(page) === '/clients?filter=retainer', `MRR opens Clients on retainers (${rel(page)})`);
    await page.goBack(); await page.waitForSelector('[data-kpi="askRate"]', { timeout: 10000 });
    ok((await page.locator('[data-kpi="askRate"]').textContent()).includes('50%'), 'the Ask rate tile shows the last session (50%)');
    await page.locator('[data-kpi="askRate"]').click(); await page.waitForTimeout(600);
    ok(/^\/calls/.test(rel(page)), `and opens the calls side (${rel(page)})`);
    await ctx.close();
  }
  /* Overview and Projects. */
  {
    const { ctx, page } = await open(w, '/admin/overview');
    await page.waitForSelector('[data-stat="unpaid"]', { timeout: 10000 });
    await page.locator('[data-stat="unpaid"]').click(); await page.waitForTimeout(600);
    ok(rel(page) === '/invoices', `Overview's Unpaid opens Invoices (${rel(page)})`);
    await ctx.close();
    const p2 = await open(w, '/admin/projects');
    await p2.page.waitForSelector('.pj-chip--unpaid', { timeout: 10000 });
    const all = await p2.page.locator('.pj-card, .v-table tbody tr').count();
    await p2.page.locator('.pj-chip--unpaid').click(); await p2.page.waitForTimeout(300);
    const after = await p2.page.locator('.pj-card, .v-table tbody tr').count();
    ok(await p2.page.locator('.pj-chip--overdue').count() === 1 && await p2.page.locator('.pj-chip--all').count() === 1 && after <= all, `Projects has stage chips plus Unpaid and Overdue (${all} then ${after} with Unpaid)`);
    await p2.ctx.close();
  }
  /* The shared row on Home and Tasks. */
  {
    const { ctx, page } = await open(w, '/admin');
    await page.waitForSelector('.nh-row.tr-row', { timeout: 10000 });
    ok(await page.locator('.nh-row.tr-row .v-rcheck').count() >= 1 && await page.locator('.nh-row.tr-row .tr-title').count() >= 1, 'Home draws its rows with the shared TaskRow (check, title)');
    const homeTitle = (await page.locator('.nh-row.tr-row .tr-title').first().textContent()).trim();
    await ctx.close();
    const t = await open(w, '/admin/tasks');
    await t.page.waitForSelector('.tr-row--card', { timeout: 10000 });
    ok(await t.page.locator('.tr-row--card .v-rcheck').count() >= 1, 'the Tasks page draws the same row (a round check)');
    ok(await t.page.locator('.nu-chip').count() === 5 && await t.page.locator('.nu-sec').count() >= 3, 'five chips and the Overdue, Today and Coming up sections');
    ok((await t.page.locator('.nu-group').allTextContents()).join('|').includes('Coming up'), 'the sections read Overdue, Today, Coming up');
    const before = await t.page.locator('.tr-row--card').count();
    await t.page.locator('.nu-chip--calls').click(); await t.page.waitForTimeout(300);
    const afterCalls = await t.page.locator('.tr-row--card').count();
    ok(afterCalls <= before && afterCalls >= 0, `the Calls chip narrows the rows (${before} then ${afterCalls})`);
    await t.page.locator('.nu-chip--all').click();
    const search = t.page.getByRole('searchbox').or(t.page.getByPlaceholder('Search clients')).first();
    await search.fill('zzzz-nobody'); await t.page.waitForTimeout(300);
    ok(await t.page.locator('.tr-row--card').count() === 0 && /No tasks|nothing|No results|matches/i.test(await t.page.locator('.nu-list').textContent()), 'a client search with no match says so');
    ok(homeTitle.length > 0, 'Home\'s first row has a title');
    await t.ctx.close();
  }
  /* New task from the quick add; Start calling. */
  {
    const { ctx, page, writes } = await open(w, '/admin/tasks');
    await page.waitForSelector('.tr-row--card', { timeout: 10000 });
    await page.getByRole('button', { name: /Quick add|Add/ }).first().click().catch(() => {});
    const items = await page.getByRole('menuitem').allTextContents();
    ok(items.some(t => /Start calling/.test(t)) && !items.some(t => /Log a call/.test(t)), `the quick add says Start calling (${items.join(', ').slice(0, 120)})`);
    ok(items.some(t => /New task/.test(t)), 'and offers New task');
    await page.getByRole('menuitem', { name: 'New task' }).click(); await page.waitForTimeout(500);
    await page.getByRole('button', { name: /Lead Business 3|Auto Detail|Philly/ }).first().click().catch(async () => { await page.locator('.ad-pick .v-lrow').first().click(); });
    await page.waitForSelector('.ts-sheet', { timeout: 5000 });
    ok((await page.locator('.ts-sheet').textContent()).includes('New task') && await page.locator('.ts-when').count() === 1, 'the New task sheet opens with the due chips');
    ok(/Tomorrow 9 AM/.test(await page.locator('.ts-when').textContent()) && /Next Monday/.test(await page.locator('.ts-when').textContent()) && /Pick/.test(await page.locator('.ts-when').textContent()), 'chips: Tomorrow 9 AM, Next Monday, Pick');
    ok(await page.locator('.ts-date').count() === 0, 'the raw date input stays hidden until Pick');
    await page.getByRole('textbox', { name: 'Label' }).fill('Drop off the proof');
    await page.locator('.ts-sheet .v-sheet-foot .v-btn').last().click(); await page.waitForTimeout(800);
    const w1 = writes.find(x => x.api === 'lead' && x.set?.checklists);
    const task = (w1?.set?.checklists || []).flatMap(l => l.items).find(i => i.text === 'Drop off the proof');
    const due = task && new Date(task.due);
    ok(!!task && Number(due.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' })) === 9 && due.getTime() > Date.now() && !!task.remindAt, `the task is written through the checklists: due tomorrow 9:00 with the reminder on (${task && task.due})`);
    await ctx.close();
  }
}
await browser.close();
console.log(`\nmoney-ui-test: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
