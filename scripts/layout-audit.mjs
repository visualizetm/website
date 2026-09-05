/* Layout regression audit — walks every admin route at phone/tablet/desktop
 * widths and fails if ANY element extends past the viewport or the page can
 * scroll sideways. Run it after touching admin layout:
 *
 *   npm run build
 *   npx vite preview --port 4330 &
 *   node scripts/layout-audit.mjs
 *
 * Uses mocked admin APIs (with deliberately hostile long names) so it needs
 * no database and never touches real data. Chromium path can be overridden
 * with PW_CHROME=/path/to/chrome.
 */
import { chromium } from 'playwright-core';
import { orderFromSubmission } from '../api/_lib/orders.js';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const WIDTHS = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(',').map(Number) : [320, 390, 430, 768, 1280];
const SHOTS = process.env.AUDIT_SHOTS || ''; // directory: save a screenshot per check

import { LONG, UNBROKEN, leads, items, orders, json, mockRoutes } from './audit-fixtures.mjs';


// Elements allowed to scroll sideways on purpose (their CONTENT may be wide,
// the element itself must still fit the viewport).
const HSCROLL_OK = ['.li-tablewrap', '.v-tabs', '.v-seg', '.db-funnel', '.ld-board', '.ld-frow-chips', '.v-table-scroll', '.cw-stepper'];

async function collectOffenders(page) {
  return page.evaluate((hscrollOk) => {
    const vw = document.documentElement.clientWidth;
    const bad = [];
    const seen = new Set();
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      // inside an intended horizontal scroller?
      if (hscrollOk.some(sel => el.closest(sel) && !el.matches(sel))) continue;
      const overRight = r.right > vw + 1;
      const overLeft = r.left < -1 && r.right > 0;
      if ((overRight && r.left < vw) || overLeft) {
        const key = el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName;
        if (seen.has(key)) continue;
        seen.add(key);
        bad.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).slice(0, 60),
          rect: { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) },
        });
      }
    }
    return {
      vw,
      scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      offenders: bad.slice(0, 12),
    };
  }, HSCROLL_OK);
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
let failures = 0;

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 500 });
  const page = await ctx.newPage();
  await mockRoutes(page);

  const check = async (label) => {
    await page.waitForTimeout(650);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${width}-${label.replace(/[^a-z0-9]+/gi, '_')}.png` }).catch(() => {});
    const res = await collectOffenders(page);
    const hscroll = res.scrollW > res.vw + 1;
    if (hscroll || res.offenders.length) {
      failures++;
      console.log(`  FAIL [${width}px] ${label} — scrollW=${res.scrollW} vw=${res.vw}`);
      for (const o of res.offenders) console.log(`        <${o.tag} class="${o.cls}"> left=${o.rect.left} right=${o.rect.right} w=${o.rect.w}`);
    } else {
      console.log(`  ok   [${width}px] ${label}`);
    }
  };

  // A layout check that also requires some text on the page (end to end proof).
  const checkText = async (label, text) => {
    await check(label);
    const found = await page.getByText(text, { exact: false }).count().catch(() => 0);
    if (!found) { failures++; console.log(`  FAIL [${width}px] ${label}: expected text "${text}" not found`); }
  };

  // domcontentloaded + settle delay: 'networkidle' never settles with the
  // PWA service worker active, so bounded waits keep the audit fast.
  const goto = (path) => page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  const only = process.env.AUDIT_ONLY; // 'settings', 'clients', or 'studio' reruns just that block

  if (!only || only === 'settings') {
  // Shop checkout end to end (Prompt 13): the public shop posts a shop-order submission,
  // the same server builder turns it into an order, and Print Orders shows it.
  const shopOrders = [];
  await page.route('**/api/submissions', async (r) => {
    if (r.request().method() !== 'POST') return r.continue();
    let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch {}
    const created = orderFromSubmission({ ...body, _id: 'subShop' + shopOrders.length, createdAt: new Date() });
    shopOrders.push({ ...created, _id: 'OSHOP' + shopOrders.length });
    return r.fulfill(json({ ok: true, id: 'subShop' + shopOrders.length }));
  });
  await page.route('https://api.web3forms.com/**', r => r.fulfill(json({ success: true })));
  await goto('/prints');
  await page.getByRole('button', { name: /Customize/ }).nth(3).click({ timeout: 4000 }).catch(() => {});
  await page.locator('.ps-minput').first().fill('@visualize').catch(() => {});
  await page.locator('.ps-color-row button').first().click({ timeout: 2000 }).catch(() => {});
  const grids = page.locator('.ps-opt-grid');
  for (let i = 0; i < await grids.count(); i++) await grids.nth(i).locator('.ps-opt').first().click({ timeout: 2000 }).catch(() => {});
  await page.getByRole('button', { name: /Add to Cart/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.getByRole('button', { name: /Continue to Checkout/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('.ps-minput').nth(0).fill('Audit Shopper').catch(() => {});
  await page.locator('.ps-minput').nth(1).fill('shopper@example.com').catch(() => {});
  await page.locator('.ps-minput').nth(2).fill('(302) 555-0199').catch(() => {});
  await page.getByRole('button', { name: /Place Order|Submit Order|Order/ }).last().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.unroute('**/api/admin/orders**');
  await page.route('**/api/admin/orders**', r => (r.request().method() === 'GET' ? r.fulfill(json({ items: [...shopOrders, ...orders], unimported: 0 })) : r.fulfill(json({ ok: true }))));
  await goto('/admin/orders');
  await checkText('shop checkout became a print order', shopOrders.length ? 'Audit Shopper' : 'NO ORDER WAS POSTED');

  // Settings and Submissions (Prompt 12).
  await goto('/admin/submissions');
  await check('submissions list');
  for (const f of ['Unread', 'Brief', 'Contact', 'Review', 'Shop order', 'Other']) {
    await page.locator('.sb-chips .v-chip', { hasText: new RegExp('^' + f) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`submissions list: ${f.toLowerCase()}`);
    await page.locator('.sb-chips .v-chip', { hasText: /^All/ }).first().click({ timeout: 3000 }).catch(() => {});
  }
  await goto('/admin/submissions?loading=1');
  await check('submissions skeleton');
  await goto('/admin/submissions');
  if (width >= 1024) await page.locator('.v-tr', { hasText: 'Business 5' }).first().click({ timeout: 4000 }).catch(() => {});
  else await page.getByRole('button', { name: /^Open submission from Business 5/ }).first().click({ timeout: 4000 }).catch(() => {});
  await check('submission detail (brief)');
  await page.locator('.sb-open-brief').first().click({ timeout: 3000 }).catch(() => {});
  await check('submission: brief view');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.sb-link').first().click({ timeout: 3000 }).catch(() => {});
  await check('submission: link to lead sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.sb-convert').first().click({ timeout: 3000 }).catch(() => {});
  await check('submission: convert to lead sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await goto('/admin/submissions');
  if (width >= 1024) await page.locator('.v-tr', { hasText: LONG }).first().click({ timeout: 4000 }).catch(() => {});
  else await page.getByRole('button', { name: new RegExp('^Open submission from Philly') }).first().click({ timeout: 4000 }).catch(() => {});
  await check('submission detail (long name, shop order)');

  await goto('/admin/settings');
  await check('settings: profile');
  for (const t of ['Notifications', 'Integrations', 'Data', 'Automation', 'Shortcuts', 'Danger zone']) {
    await page.getByRole('tab', { name: new RegExp('^' + t) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`settings: ${t.toLowerCase()}`);
    if (t === 'Integrations') {
      await page.locator('.st-reconcile').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: reconcile sheet');
      await page.locator('.st-link-event').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: reconcile link to client');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    }
    if (t === 'Data') {
      await page.locator('.st-import-leads').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: lead import sheet');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.locator('.st-import-orders').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: orders csv import sheet');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.evaluate(() => { try { localStorage.setItem('vz_print_orders', JSON.stringify([{ id: 1, date: new Date().toISOString(), source: 'shop', status: 'pending', name: 'Local Person Superlongunbrokenname', email: 'p4@x.com', phone: '', cartItems: [{ productId: 'logo-sticker', productName: 'Logo Die-Cut Sticker', label: 'Qty 100', priceMode: 'sticker', priceTotal: 100, vals: { qty: '100', size: '3 in' } }], summary: 'x', estimatedSubtotal: 100, hasQuoteItems: false }])); } catch {} }).catch(() => {});
      await page.locator('.st-import-device').first().click({ timeout: 3000 }).catch(() => {});
      await check('settings: device import preview');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.evaluate(() => localStorage.removeItem('vz_print_orders')).catch(() => {});
    }
  }
  await goto('/admin/settings?loading=1');
  await check('settings skeleton');
  await goto('/admin/settings/deleted');
  await check('settings: recently deleted via nav');
  if (width >= 768) {
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await goto('/admin/settings');
    await check('sidebar collapsed: settings');
    await goto('/admin/submissions');
    await check('sidebar collapsed: submissions');
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await page.evaluate(() => localStorage.removeItem('vz_shell_collapsed')).catch(() => {});
  }
  if (only === 'settings') { await ctx.close(); continue; }

  await goto('/admin');
  await page.evaluate(() => localStorage.removeItem('vz_call_session'));
  await check('dashboard');
  await goto('/admin/?loading=1');
  await check('dashboard skeleton');

  await goto('/admin/orders');
  await check('orders list');

  await goto('/admin/design');
  await check('design system (tokens + components)');
  await page.locator('.dc-open-sheet').first().click({ timeout: 4000 }).catch(() => {});
  await check('design: Sheet open');
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('.dc-open-modal').first().click({ timeout: 4000 }).catch(() => {});
  await check('design: Modal open');
  await page.keyboard.press('Escape').catch(() => {});

  await goto('/admin/calls');
  await page.evaluate(() => localStorage.removeItem('vz_call_session')).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await check('call console builder');
  await goto('/admin/calls?loading=1');
  await check('call console skeleton');
  await goto('/admin/calls');
  await page.locator('.cc-start').click({ timeout: 4000 }).catch(() => {});
  await check('call session queue');
  if (width < 1024) { await page.locator('.cc-qcard .lc').first().click({ timeout: 4000 }).catch(() => {}); }
  await check('call room (script)');
  for (const t of ['Objections', 'Close', 'Intel', 'Notes', 'History']) {
    const tab = page.getByRole('tab', { name: new RegExp('^' + t) });
    if (await tab.count()) { await tab.first().click({ timeout: 3000 }).catch(() => {}); await check(`call room (${t.toLowerCase()})`); }
  }
  for (const o of ['booked', 'callback', 'no-answer', 'no', 'wrong-number']) {
    await page.locator('.cc-out--' + o).first().click({ timeout: 4000 }).catch(() => {});
    await check(`outcome sheet: ${o}`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(350);
  }
  if (width >= 1024) {
    await page.locator('.cc-keys-btn').first().click({ timeout: 4000 }).catch(() => {});
    await check('shortcuts modal');
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.locator('.cc-edit-btn').first().click({ timeout: 4000 }).catch(() => {});
  await check('edit lead sheet');
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('vz_call_session')); if (s) { s.mode = 'summary'; localStorage.setItem('vz_call_session', JSON.stringify(s)); } } catch {} }).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await check('session summary');
  await page.evaluate(() => localStorage.removeItem('vz_call_session')).catch(() => {});

  for (const v of ['day', 'week', 'month']) {
    await page.evaluate((x) => localStorage.setItem('vz_cal_view', JSON.stringify(x)), v).catch(() => {});
    await goto('/admin/calendar');
    await check(`calendar ${v}`);
    if (v === 'day') {
      for (const f of ['Meetings', 'Callbacks', 'Calendly', 'New leads']) {
        await page.locator('.cal-filters .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
        await check(`calendar day: ${f.toLowerCase()} filter`);
        await page.locator('.cal-filters .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
      }
      await page.locator('.cal-add').first().click({ timeout: 3000 }).catch(() => {});
      await check('calendar: add callback sheet');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
      await page.locator('.cal-row .v-ibtn').first().click({ timeout: 3000 }).catch(() => {});
      await page.getByRole('menuitem', { name: 'Link to lead' }).first().click({ timeout: 2000 }).catch(() => {});
      await check('calendar: link to lead sheet');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    }
    if (v === 'week' && width >= 1024) {
      await page.locator('.cal-block').first().click({ timeout: 3000 }).catch(() => {});
      await check('calendar week: event popover');
      await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    }
  }
  await goto('/admin/calendar?loading=1');
  await check('calendar skeleton');

  await goto('/admin/booked');
  await check('booked list');
  for (const f of ['This week', 'Upcoming', 'No date set', 'Needs concepts', 'Awaiting outcome']) {
    await page.locator('.bk-chips .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`booked list: ${f.toLowerCase()}`);
  }
  await page.locator('.bk-chips .v-chip', { hasText: 'All' }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/booked?loading=1');
  await check('booked skeleton');
  await goto('/admin/booked');
  await page.locator('.lc').first().click({ timeout: 4000 }).catch(() => {});
  await check('booked detail (overview)');
  for (const t of ['Playbook', 'Meeting', 'Notes', 'History']) {
    await page.getByRole('tab', { name: new RegExp('^' + t) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`booked detail (${t.toLowerCase()})`);
  }
  await page.locator('.dt-addopt').first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('.dt-addopt').first().click({ timeout: 3000 }).catch(() => {});
  await check('booked detail: three pricing options');
  await page.getByRole('switch', { name: 'Call mode' }).first().click({ timeout: 3000 }).catch(() => {});
  await check('booked detail: call mode on');
  await page.getByRole('switch', { name: 'Call mode' }).first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('.dt-resched').first().click({ timeout: 3000 }).catch(() => {});
  await check('reschedule sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.dt-won').first().click({ timeout: 3000 }).catch(() => {});
  await check('won dialog');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.dt-editall').first().click({ timeout: 3000 }).catch(() => {});
  await check('edit all sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);

  await page.evaluate(() => localStorage.setItem('vz_leads_view', JSON.stringify('kanban'))).catch(() => {});
  await goto('/admin/leads');
  await page.locator('.lc').first().click({ timeout: 4000 }).catch(() => {});
  await check('lead detail (overview, long name)');
  for (const t of ['Playbook', 'Notes', 'History']) {
    await page.getByRole('tab', { name: new RegExp('^' + t) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`lead detail (${t.toLowerCase()})`);
  }

  } // end !only

  if (only !== 'studio') {
  // Clients module (Prompt 10).
  const openClient = async (name) => {
    await goto('/admin/clients');
    if (width >= 1024) await page.locator('.v-tr', { hasText: name }).first().click({ timeout: 4000 }).catch(() => {});
    else await page.getByRole('button', { name: `Open ${name}` }).first().click({ timeout: 4000 }).catch(() => {});
  };
  const clientTab = async (t) => page.getByRole('tab', { name: new RegExp('^' + t) }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/clients');
  await check('clients list');
  for (const f of ['Active project', 'On retainer', 'Delivered', 'Paused', 'Owes a payment', 'Ready to deliver']) {
    await page.locator('.cl-chips .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`clients list: ${f.toLowerCase()}`);
  }
  await page.locator('.cl-chips .v-chip', { hasText: 'All' }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/clients?loading=1');
  await check('clients skeleton');
  await openClient('Lead Business 11');
  await check('client detail (overview, plan client)');
  for (const t of ['Projects', 'Payments', 'Retainer', 'Deliverables', 'Notes', 'History']) {
    await clientTab(t);
    await check(`client detail (${t.toLowerCase()})`);
  }
  await clientTab('Projects');
  await page.locator('.cw-new-project').first().click({ timeout: 3000 }).catch(() => {});
  await check('new project sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.cw-extra-round').first().click({ timeout: 3000 }).catch(() => {});
  await check('log extra round modal');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await clientTab('Payments');
  await check('payment plan block at month 5');
  await page.locator('.cw-mark-paid').first().click({ timeout: 3000 }).catch(() => {});
  await check('mark paid modal');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.cw-add-manual').first().click({ timeout: 3000 }).catch(() => {});
  await check('add manual payment sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await clientTab('Retainer');
  await page.locator('.cw-start-retainer').first().click({ timeout: 3000 }).catch(() => {});
  await check('start retainer sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await clientTab('Deliverables');
  await check('deliverables (toggle disabled)');
  await openClient('Lead Business 13');
  await clientTab('Deliverables');
  await check('deliverables (released, toggle enabled)');
  await clientTab('Projects');
  await check('delivered project (send delivery checklist)');
  await openClient('Lead Business 12');
  await clientTab('Retainer');
  await check('retainer (content kit months)');
  await page.locator('.cw-log-delivery').first().click({ timeout: 3000 }).catch(() => {});
  await check('log delivery modal');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await openClient('Lead Business 10');
  await check('client detail (hostile long name, single project)');
  await clientTab('Payments');
  await check('client detail (owes a payment)');
  await goto('/admin/clients');
  await page.locator('.cl-add').first().click({ timeout: 3000 }).catch(() => {});
  await check('add client sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  if (width >= 768) {
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await check('sidebar collapsed: clients list');
    await openClient('Lead Business 11');
    await check('sidebar collapsed: client detail');
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await page.evaluate(() => localStorage.removeItem('vz_shell_collapsed')).catch(() => {});
  }
  } // end clients block

  // Studio (Prompt 11): print orders, concepts, reviews.
  const openOrder = async (name) => {
    await goto('/admin/orders');
    if (width >= 1024) await page.locator('.v-tr', { hasText: name }).first().click({ timeout: 4000 }).catch(() => {});
    else await page.getByRole('button', { name: new RegExp(`^Open order for ${name}`) }).first().click({ timeout: 4000 }).catch(() => {});
  };
  await goto('/admin/orders');
  await check('orders list (import banner)');
  for (const f of ['New', 'Designed', 'Cut', 'Packed', 'Delivered', 'Cancelled', 'Rush', 'Due this week']) {
    await page.locator('.po-chips .v-chip', { hasText: new RegExp('^' + f) }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`orders list: ${f.toLowerCase()}`);
  }
  await page.locator('.po-chips .v-chip', { hasText: /^All/ }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/orders?loading=1');
  await check('orders skeleton');
  await openOrder('Person 0');
  await check('order detail (rush shop order, long names)');
  await page.locator('.po-link-client').first().click({ timeout: 3000 }).catch(() => {});
  await check('order: link to client sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.po-mark-paid').first().click({ timeout: 3000 }).catch(() => {});
  await check('order: mark paid modal');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await openOrder('Lead Business 11');
  await check('order detail (delivered, packaging checklist)');
  await goto('/admin/orders');
  await page.locator('.po-new').first().click({ timeout: 3000 }).catch(() => {});
  await check('new order sheet');
  await page.locator('.po-add-item').first().click({ timeout: 3000 }).catch(() => {});
  await check('new order sheet: item added');
  await page.locator('.po-pick-client').first().click({ timeout: 3000 }).catch(() => {});
  await check('new order: pick a client');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);

  await goto('/admin/concepts');
  await check('concepts grid');
  await page.locator('.cp-kinds .v-chip', { hasText: /^Social/ }).first().click({ timeout: 3000 }).catch(() => {});
  await check('concepts grid: social filter');
  await page.locator('.cp-kinds .v-chip', { hasText: /^Social/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('.cp-inds .v-chip').first().click({ timeout: 3000 }).catch(() => {});
  await check('concepts grid: industry filter');
  await page.locator('.cp-inds .v-chip').first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/concepts?loading=1');
  await check('concepts skeleton');
  await goto('/admin/concepts');
  await page.getByRole('button', { name: /^Open Universal logo directions/ }).first().click({ timeout: 4000 }).catch(() => {});
  for (const h of ['Direction 2', 'Direction 3']) await page.locator('.cp-prompt-head', { hasText: h }).first().click({ timeout: 2000 }).catch(() => {});
  await check('pack detail (prompts expanded)');
  await page.locator('.cp-link-lead').first().click({ timeout: 3000 }).catch(() => {});
  await check('pack: link a lead sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await goto('/admin/concepts');
  await page.locator('.cp-new').first().click({ timeout: 3000 }).catch(() => {});
  await check('new pack sheet');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await goto('/admin/booked');
  await page.locator('.lc').first().click({ timeout: 4000 }).catch(() => {});
  await page.getByRole('tab', { name: /^Meeting/ }).first().click({ timeout: 3000 }).catch(() => {});
  await page.getByRole('button', { name: 'Add the usual five' }).first().click({ timeout: 3000 }).catch(() => {});
  await page.locator('.dt-from-library').first().click({ timeout: 3000 }).catch(() => {});
  await check('booked: from library picker');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);

  await goto('/admin/reviews');
  await check('reviews list');
  for (const f of ['Has NFC card', 'No Google link', 'Never asked', 'Asked this month', 'Delivered not asked']) {
    await page.locator('.rv-chips .v-chip', { hasText: f }).first().click({ timeout: 3000 }).catch(() => {});
    await check(`reviews list: ${f.toLowerCase()}`);
  }
  await page.locator('.rv-chips .v-chip', { hasText: /^All/ }).first().click({ timeout: 3000 }).catch(() => {});
  await goto('/admin/reviews?loading=1');
  await check('reviews skeleton');
  await goto('/admin/reviews');
  await page.getByRole('button', { name: /^Open reviews for Lead Business 12/ }).first().click({ timeout: 4000 }).catch(() => {});
  await check('review sheet (nfc, counts, asks)');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  await page.locator('.rv-link-form').first().click({ timeout: 3000 }).catch(() => {});
  await check('reviews: link form submission');
  await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
  if (width >= 768) {
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await goto('/admin/orders');
    await check('sidebar collapsed: orders');
    await goto('/admin/concepts');
    await check('sidebar collapsed: concepts');
    await goto('/admin/reviews');
    await check('sidebar collapsed: reviews');
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await page.evaluate(() => localStorage.removeItem('vz_shell_collapsed')).catch(() => {});
  }
  if (only) { await ctx.close(); continue; }

  await goto('/admin/leads');
  await page.locator('.sh-bell').first().click({ timeout: 4000 }).catch(() => {});
  await check('notifications sheet');
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);

  if (width < 768) {
    await page.locator('.sh-tab--more').click({ timeout: 4000 }).catch(() => {});
    await check('mobile More sheet');
    await page.keyboard.press('Escape').catch(() => {});
  } else {
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await check('sidebar collapsed: leads list');
    await goto('/admin');
    await check('sidebar collapsed: dashboard');
    await goto('/admin/?loading=1');
    await check('sidebar collapsed: dashboard skeleton');
    await goto('/admin/calls');
    await check('sidebar collapsed: call console builder');
    await page.locator('.sh-side-toggle').click({ timeout: 4000 }).catch(() => {});
    await page.evaluate(() => localStorage.removeItem('vz_shell_collapsed')).catch(() => {});
  }

  await ctx.close();
}

await browser.close();
if (failures) {
  console.log(`\n${failures} failing view(s). Fix before shipping.`);
  process.exit(1);
}
console.log('\nAll routes clean at every width — zero offenders.');
