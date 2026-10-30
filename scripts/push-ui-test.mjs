#!/usr/bin/env node
/* Push on the screens, in a browser against the audit fixtures (the finish notifications job, milestone 2). Run at 390 and 1280.
 *   npx vite preview --port 4330 &   AUDIT_BASE=http://127.0.0.1:4330 node scripts/push-ui-test.mjs
 * Checks: the red alarm shows on the home and on Settings when the reminders job has not run in ten minutes (and says since when,
 * or never), stays away while it keeps its pace, and has a way to Settings; Settings says Armed only when the cron ran in the last
 * three minutes, the server has keys and this device is subscribed, and lists the last five runs; the Test button prints how many
 * devices took it and why when none did; a server that removed the last device shows Turn push on again, which drops the old
 * subscription and saves a new one; on app open an allowed device with no subscription subscribes and the server is told, a
 * device that has not allowed notifications is never asked; axe finds nothing on the alarm. Milestone 4: Settings > Notifications lists
 * the seven kinds of push as switches (each save is one PATCH and a failed save puts the switch back), and quiet hours, off by default,
 * show their From and To and the reminders switch only when turned on. */
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { mockRoutes, SETTINGS_DOC, json } from './audit-fixtures.mjs';

const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const WIDTHS = (process.env.AUDIT_WIDTHS || '390,1280').split(',').map(Number);
const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const minsAgo = (m) => new Date(Date.now() - m * 60e3).toISOString();

/* What the page sees of push: a service worker registration whose subscription this test controls, and the permission. */
const pushInit = (o) => {
  window.__push = { subscribes: 0, unsubscribes: 0, permissionAsks: 0, failNext: o.subscribeFails || 0 };
  let sub = null;
  const mk = () => ({ unsubscribe: async () => { window.__push.unsubscribes++; sub = null; return true; }, toJSON: () => ({ endpoint: `https://push.example/dev${window.__push.subscribes}`, keys: { p256dh: 'k', auth: 'a' } }) });
  if (o.hasSub) sub = mk();
  const reg = { pushManager: { getSubscription: async () => sub, subscribe: async () => { if (window.__push.failNext > 0) { window.__push.failNext--; throw new Error('subscribe refused'); } window.__push.subscribes++; sub = mk(); return sub; } } };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve(reg), register: () => Promise.resolve(reg), addEventListener() {}, controller: null } });
  window.PushManager = window.PushManager || function PushManager() {};
  window.Notification = Object.assign(function Notification() {}, { permission: o.permission, requestPermission: async () => { window.__push.permissionAsks++; return o.permission === 'denied' ? 'denied' : 'granted'; } });
  try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch { /* storage may be off */ }
};

async function open(ctx, path, o = {}) {
  const page = await ctx.newPage();
  await page.addInitScript(pushInit, { hasSub: o.hasSub !== false, permission: o.permission || 'granted', subscribeFails: o.subscribeFails || 0 });
  await mockRoutes(page, { session: true });
  const saved = []; const testCalls = []; const patches = [];
  page.on('request', (rq) => { if (rq.method() === 'PATCH' && /\/api\/admin\/settings/.test(rq.url())) { try { patches.push(JSON.parse(rq.postData() || 'null')); } catch { /* not JSON */ } } });
  const reminders = o.never ? undefined : { lastRunAt: minsAgo(o.ranMinsAgo ?? 0.7), runs: [0.7, 1.7, 2.7, 3.7, 4.7, 5.7, 6.7].map(m => minsAgo(m)), devices: 1, failed: 0, ...(o.reminders || {}) };
  const settings = () => ({ ...SETTINGS_DOC, notifications: { ...SETTINGS_DOC.notifications, ...(o.categories ? { categories: o.categories } : {}), ...(o.quiet ? { quiet: o.quiet } : {}) }, health: { ...SETTINGS_DOC.health, crons: { ...SETTINGS_DOC.health.crons, reminders } }, push: { devices: 1, needsResubscribe: !!o.needsResubscribe } });
  let patchFails = o.patchFails || 0;
  await page.route('**/api/admin/settings**', (r) => {
    const req = r.request();
    if (req.method() === 'GET') return r.fulfill(json(settings()));
    let body = null; try { body = JSON.parse(req.postData() || 'null'); } catch { /* not JSON */ }
    if (req.method() === 'PATCH' && patchFails > 0) { patchFails--; return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server error"}' }); }
    if (body?.action === 'test-push') { testCalls.push(body); return r.fulfill(json({ ok: true, ...(o.testResult || { attempted: 1, delivered: 1, removed: 0, errors: [] }) })); }
    return r.fallback();
  });
  await page.route('**/api/push-key', (r) => r.fulfill(json({ key: 'BKEY' })));
  let saveFails = o.saveFails || 0;
  await page.route('**/api/admin/push-subscribe', (r) => { if (saveFails > 0) { saveFails--; return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"server error"}' }); } let b = null; try { b = JSON.parse(r.request().postData() || 'null'); } catch { /* not JSON */ } saved.push(b); return r.fulfill(json({ ok: true })); });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  if (o.tab) { // the tab bar on a computer, the list of sections on a phone
    const t = page.getByRole('tab', { name: new RegExp('^' + o.tab) });
    if (await t.count()) await t.first().click(); else await page.locator('.sh-content').getByRole('button', { name: new RegExp('^' + o.tab) }).first().click();
    await page.waitForTimeout(700);
  }
  return { page, saved, testCalls, patches };
}

for (const w of WIDTHS) {
  const phone = w < 768;
  console.log(`\n[${w}px]`);
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block' });

  // 1. The alarm on the home.
  let t = await open(ctx, '/admin');
  ok(await t.page.locator('[data-card="cron-alarm"]').count() === 0, 'home: a cron that ran seconds ago raises no alarm');
  await t.page.close();
  t = await open(ctx, '/admin', { ranMinsAgo: 25 });
  const alarm = t.page.locator('[data-card="cron-alarm"]');
  ok(await alarm.count() === 1 && /^Reminders have not run since .+\. Pushes will not arrive until they do\.$/.test((await alarm.innerText()).split('\n')[0]), `home: 25 minutes with no run shows the red alarm ("${(await alarm.innerText()).split('\n')[0]}")`);
  ok((await alarm.getAttribute('role')) === 'status', 'the alarm is a polite status region');
  const y = await t.page.evaluate(() => { const top = (s) => document.querySelector(s)?.getBoundingClientRect().top ?? -1; return { alarm: top('[data-card="cron-alarm"]'), today: top('[data-card="next-today"]') }; });
  ok(y.alarm > 0 && y.alarm < y.today, 'it sits above Next up');
  const axe = await t.page.evaluate(async (src) => { const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s); const r = await window.axe.run(document.querySelector('[data-card="cron-alarm"]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } }); return r.violations.map(v => v.id); }, AXE);
  ok(axe.length === 0, `axe finds nothing on the alarm (${axe.join(', ') || 'clean'})`);
  await alarm.getByRole('button', { name: 'Open Settings' }).click();
  await t.page.waitForTimeout(500);
  ok(/\/admin\/settings/.test(t.page.url()), `its button opens Settings (${t.page.url().replace(BASE, '')})`);
  await t.page.close();
  t = await open(ctx, '/admin', { never: true });
  ok(/^Reminders have never run\./.test((await t.page.locator('[data-card="cron-alarm"]').innerText()).split('\n')[0]), 'home: no run on record at all says never');
  await t.page.close();
  t = await open(ctx, '/admin', { ranMinsAgo: 25 });
  await t.page.context().setOffline(true); await t.page.evaluate(() => window.dispatchEvent(new Event('offline'))); await t.page.waitForTimeout(400);
  ok(await t.page.locator('[data-card="cron-alarm"]').count() === 0, 'offline: the alarm stays away (an offline phone cannot know)');
  await t.page.context().setOffline(false);
  await t.page.close();

  // 2. Settings: the alarm, Armed, the last five runs.
  t = await open(ctx, '/admin/settings', { tab: 'Notifications', ranMinsAgo: 25 });
  ok(await t.page.locator('[data-card="cron-alarm"]').count() === 1, 'settings: the alarm shows here too');
  let card = t.page.locator('[data-card="push-status"]');
  ok(/Not armed/.test(await card.innerText()) && /last ran 25 minutes ago/.test(await card.innerText()), 'a stale cron is Not armed and says how long ago it ran');
  ok(/Not running/.test(await card.locator('.cw-kv', { hasText: 'Next run' }).innerText()), 'Next run says Not running');
  await t.page.close();
  t = await open(ctx, '/admin/settings', { tab: 'Notifications' });
  card = t.page.locator('[data-card="push-status"]');
  ok(await t.page.locator('[data-card="cron-alarm"]').count() === 0 && /Armed/.test(await card.locator('.v-pill').first().innerText()) && !/Not armed/.test(await card.innerText()), 'a healthy cron, keys and a subscribed device: Armed, no alarm');
  const runsText = await card.locator('.st-rem-runs').innerText();
  ok(runsText.replace('Last runs:', '').split(',').length === 5, `the last five runs are listed (${runsText})`);
  ok(/Within a minute/.test(await card.locator('.cw-kv', { hasText: 'Next run' }).innerText()) && /1/.test(await card.locator('.cw-kv', { hasText: 'Devices' }).innerText()), 'Next run says within a minute and Devices says 1');
  await t.page.close();
  t = await open(ctx, '/admin/settings', { tab: 'Notifications', hasSub: false, permission: 'default' });
  ok(/Not armed/.test(await t.page.locator('[data-card="push-status"]').innerText()) && /not subscribed/.test(await t.page.locator('[data-card="push-status"]').innerText()), 'a device with no subscription is Not armed, and says so');
  await t.page.close();

  // 3. The Test button.
  const press = async (testResult) => { const x = await open(ctx, '/admin/settings', { tab: 'Notifications', testResult }); await x.page.getByRole('button', { name: 'Send test notification' }).click(); await x.page.waitForTimeout(500); const text = (await x.page.locator('.st-test-note').innerText()).trim(); await x.page.close(); return { text, calls: x.testCalls.length }; };
  let r = await press({ attempted: 3, delivered: 2, removed: 1, errors: [] });
  ok(r.calls === 1 && r.text === 'Sent to 2 of 3 devices. 1 device was no longer valid and removed.', `two of three took it, one was removed (${r.text})`);
  r = await press({ attempted: 2, delivered: 2, removed: 0, errors: [] });
  ok(r.text === 'Sent to 2 of 2 devices.', `all took it (${r.text})`);
  r = await press({ attempted: 0, delivered: 0, removed: 0, errors: ['no-devices'] });
  ok(/^No device is subscribed yet/.test(r.text), `no device says so (${r.text})`);
  r = await press({ attempted: 1, delivered: 0, removed: 0, errors: ['http-403'] });
  ok(/refused it \(403\)/.test(r.text), `a refusal names the status (${r.text})`);
  r = await press({ attempted: 0, delivered: 0, removed: 0, errors: ['no-vapid'] });
  ok(/no push keys/.test(r.text), `missing keys say so (${r.text})`);

  // 5. What gets pushed, and quiet hours.
  t = await open(ctx, '/admin/settings', { tab: 'Notifications' });
  const cats = t.page.locator('[data-card="push-categories"]');
  const names = ['Reminders', 'Meetings', 'Payments', 'New leads', 'Client activity', 'Email failures', 'Daily digest'];
  const labels = await cats.locator('.st-cat-reminders, .st-cat-meetings, .st-cat-payments, .st-cat-leads, .st-cat-client, .st-cat-email, .st-cat-digest').locator('.v-toggle-label').allInnerTexts();
  ok(await cats.count() === 1 && labels.join() === names.join(), `Settings lists the seven kinds of push in order (${labels.join(', ')})`);
  ok((await cats.locator('input[role="switch"]').evaluateAll(els => els.map(e => e.checked))).slice(0, 7).every(Boolean), 'every kind is on by default');
  ok(await cats.getByLabel('From', { exact: true }).count() === 0 && await cats.getByLabel('To', { exact: true }).count() === 0, 'quiet hours are off: no From and To yet');
  await cats.locator('.st-cat-payments input').click();
  await t.page.waitForTimeout(400);
  const last = () => t.patches[t.patches.length - 1]?.set?.notifications;
  ok(t.patches.length === 1 && last()?.categories?.payments === false && last()?.categories?.leads === true && Object.keys(last().categories).length === 7, `switching Payments off is one save of all seven (${JSON.stringify(last())})`);
  await cats.getByRole('switch', { name: /^Quiet hours/ }).click();
  await t.page.waitForTimeout(400);
  ok(last()?.quiet?.on === true && last().quiet.from === '22:00' && last().quiet.to === '07:00' && last().quiet.reminders === false, `quiet hours on saves 22:00 to 07:00, reminders allowed (${JSON.stringify(last()?.quiet)})`);
  ok(await cats.getByLabel('From', { exact: true }).inputValue() === '22:00' && await cats.getByLabel('To', { exact: true }).inputValue() === '07:00', 'From and To appear');
  await cats.getByLabel('From', { exact: true }).fill('21:30');
  await t.page.waitForTimeout(400);
  ok(last()?.quiet?.from === '21:30', 'changing From saves it');
  await cats.getByRole('switch', { name: /^Quiet reminders and meetings too/ }).click();
  await t.page.waitForTimeout(400);
  ok(last()?.quiet?.reminders === true, 'the reminders switch silences them too');
  const axeC = await t.page.evaluate(async (src) => { const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s); const r = await window.axe.run(document.querySelector('[data-card="push-categories"]'), { runOnly: ['wcag2a', 'wcag2aa'] }); return r.violations.map(v => v.id); }, AXE);
  ok(axeC.length === 0, `axe finds nothing on the card (${axeC.join(', ') || 'clean'})`);
  const small = await cats.locator('.v-toggle').evaluateAll(els => els.filter(e => e.getBoundingClientRect().height < 44).length);
  ok(small === 0, 'every row is at least 44px tall');
  await t.page.close();
  t = await open(ctx, '/admin/settings', { tab: 'Notifications', categories: { payments: false, digest: false }, quiet: { on: true, from: '23:00', to: '06:00', reminders: false } });
  const c2 = t.page.locator('[data-card="push-categories"]');
  ok(!(await c2.locator('.st-cat-payments input').isChecked()) && !(await c2.locator('.st-cat-digest input').isChecked()) && await c2.locator('.st-cat-leads input').isChecked(), 'what the server says is what shows: Payments and the digest off, the rest on');
  ok(await c2.getByLabel('From', { exact: true }).inputValue() === '23:00' && await c2.getByLabel('To', { exact: true }).inputValue() === '06:00', 'saved quiet hours show their times');
  await t.page.close();
  t = await open(ctx, '/admin/settings', { tab: 'Notifications', patchFails: 1 });
  await t.page.locator('[data-card="push-categories"] .st-cat-leads input').click();
  await t.page.waitForTimeout(600);
  ok(await t.page.locator('[data-card="push-categories"] .st-cat-leads input').isChecked() && /could not save|Could not save|try again/i.test(await t.page.locator('.v-toast, [role="status"], [role="alert"]').allInnerTexts().then(a => a.join(' '))), 'a save the server refuses puts the switch back and says so');
  await t.page.close();

  // 4. A server that removed the last device.
  t = await open(ctx, '/admin/settings', { tab: 'Notifications', needsResubscribe: true, saveFails: 1 });
  ok(await t.page.getByText('Push stopped working on this device').count() === 1, 'the open-time sync made a new subscription but the server did not save it, so the flag stays and the stopped card shows');
  await t.page.getByRole('button', { name: 'Turn push on again' }).click();
  await t.page.waitForTimeout(700);
  const st = await t.page.evaluate(() => window.__push);
  ok(st.unsubscribes >= 1 && st.subscribes >= 1 && t.saved.length >= 1, `Turn push on again drops the old subscription, makes a new one and saves it (${JSON.stringify(st)}, saved ${t.saved.length})`);
  ok(await t.page.getByText('Push is on for this device').count() === 1, 'and the card goes back to Push is on for this device');
  await t.page.close();
  t = await open(ctx, '/admin/settings', { tab: 'Notifications', hasSub: false, permission: 'granted', subscribeFails: 1 });
  ok(await t.page.getByRole('button', { name: 'Enable push on this device' }).count() === 1, 'an open-time subscribe the browser refuses leaves the Enable push button, not a false Push is on');
  await t.page.close();
  t = await open(ctx, '/admin/settings', { tab: 'Notifications', needsResubscribe: true });
  await t.page.waitForTimeout(400);
  ok(await t.page.getByText('Push stopped working on this device').count() === 0 && await t.page.getByText('Push is on for this device').count() === 1, 'when the open-time sync does remake it, the Settings card never shows the stopped notice');
  await t.page.close();

  // 5. The app opening: an allowed device heals itself, a device that has not allowed is never asked.
  t = await open(ctx, '/admin', { hasSub: false, permission: 'granted' });
  let ps = await t.page.evaluate(() => window.__push);
  ok(ps.subscribes === 1 && t.saved.length === 1 && ps.permissionAsks === 0, `allowed and no subscription: it subscribes on open and tells the server, with no permission prompt (${JSON.stringify(ps)}, saved ${t.saved.length})`);
  await t.page.close();
  t = await open(ctx, '/admin', { hasSub: true, permission: 'granted' });
  ps = await t.page.evaluate(() => window.__push);
  ok(ps.subscribes === 0 && t.saved.length === 1, 'allowed and subscribed: the server is told again, nothing new is made (a pruned row comes back)');
  await t.page.close();
  t = await open(ctx, '/admin', { hasSub: true, permission: 'granted', needsResubscribe: true });
  ps = await t.page.evaluate(() => window.__push);
  ok(ps.unsubscribes === 1 && ps.subscribes === 1 && t.saved.length === 1, `the server removed the last device: on open the old subscription is dropped and a fresh one saved (${JSON.stringify(ps)})`);
  await t.page.close();
  t = await open(ctx, '/admin', { hasSub: false, permission: 'default' });
  ps = await t.page.evaluate(() => window.__push);
  ok(ps.subscribes === 0 && ps.permissionAsks === 0 && t.saved.length === 0, 'a device that has not allowed notifications is left alone: no prompt, no subscribe, nothing saved');
  await t.page.close();
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\npush-ui-test: all passed');
process.exit(fails ? 1 : 0);
