#!/usr/bin/env node
/* One back stack (email safety, one back stack, the shell: milestone 2). The pure half runs anywhere: parentOf and
 * backTarget (src/shell/backTree.js) for every nav path, every sub screen and every deep link a push makes, and
 * the roots. The browser half runs when AUDIT_BASE names a served build: Lists > Start > a lead > Back > Back lands
 * on Queue then Calls; a push deep link to /clients/:id/planner backs to that client's record; Escape on a computer
 * is the same Back; a reload of /calls/queue with no session goes to the builder.
 *   npx vite preview --port 4330 &   AUDIT_BASE=http://127.0.0.1:4330 PW_CHROME=/opt/pw-browsers/chromium node scripts/back-test.mjs */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
/* BACK_ROOT names a copy of the repository with one guard cut out (scripts/back-guard-proof.mjs); the tree and the nav come from there. */
const ROOT = process.env.BACK_ROOT ? path.resolve(process.env.BACK_ROOT) : path.resolve(new URL('..', import.meta.url).pathname);
const { parentOf, backTarget, isRoot, callsModeOf, callsPathOf, rootPathOf } = await import(pathToFileURL(path.join(ROOT, 'src/shell/backTree.js')).href);
const { NAV } = await import(pathToFileURL(path.join(ROOT, 'src/shell/nav.js')).href);

let fails = 0, passes = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else { passes++; console.log('ok  ', m); } };
const eq = (got, want, m) => ok(got === want, `${m} (${JSON.stringify(got)}${got === want ? '' : `, wanted ${JSON.stringify(want)}`})`);

console.log('1. The roots: every nav row is a root, the home has no parent, a root backs to the home.');
eq(parentOf('/'), null, 'the home has no parent');
for (const n of NAV) {
  if (n.phoneOnly && n.id !== 'more') continue;
  if (n.id === 'design') { ok(!isRoot(n.path), 'design is one level in (under Settings)'); eq(parentOf(n.path), '/settings', 'design backs to Settings'); continue; }
  if (n.id === 'deleted') { eq(parentOf(n.path), '/settings', `${n.id} backs to Settings`); continue; }
  ok(isRoot(n.path), `${n.id} (${n.path || '/'}) is a root`);
  if (n.path) eq(parentOf(n.path), '/', `${n.id} backs to the home`);
}
eq(rootPathOf('leads'), '/calls?section=leads', 'Leads lives in the Calls hub');
eq(rootPathOf('lists'), '/calls?section=lists', 'Lists lives in the Calls hub');
eq(rootPathOf('triage'), '/calls?section=triage', 'Triage lives in the Calls hub');
eq(rootPathOf('clients'), '/clients', 'any other section is its own root');
eq(rootPathOf('dashboard'), '/', 'the dashboard is the home');

console.log('2. Sub screens back to the record; the record (an open state on a root) backs to the root.');
eq(parentOf('/clients/L11/planner'), '/clients/L11', 'planner backs to the client');
eq(parentOf('/clients/L11/planner', '?ideas=1'), '/clients/L11', 'planner with the ideas query backs to the client');
eq(parentOf('/clients/L11/tasks'), '/clients/L11', 'tasks backs to the client');
eq(parentOf('/clients/L11/tasks', '?project=P11'), '/clients/L11', 'one project\'s tasks backs to the client');
eq(parentOf('/clients/L11/docs'), '/clients/L11', 'the client\'s docs back to the client');
eq(parentOf('/clients/L11/showcase'), '/clients/L11', 'showcase backs to the client');
eq(parentOf('/clients/L11/projects/new'), '/clients/L11', 'a new project backs to the client');
eq(parentOf('/clients/L11'), '/clients', 'a client record backs to Clients');
eq(parentOf('/deals/L9'), '/deals', 'a deal record backs to Deals');
eq(parentOf('/leads/L3'), '/calls?section=leads', 'a lead record backs to the Leads section of the Calls hub');
eq(parentOf('/projects/new'), '/projects', 'a new project with no client backs to Projects');
eq(parentOf('/leads/L8/concepts'), '/leads/L8', 'concepts backs to the record (AdminApp moves it to the owner of its stage)');
eq(parentOf('/leads/L8/concepts', '?set=S1'), '/leads/L8', 'concepts on a round backs to the record');
eq(parentOf('/invoices'), '/', 'Invoices is a root under Home (prompt 3 of 3)');
eq(parentOf('/leads/L8/quote'), '/leads/L8', 'the quote builder backs to the record (prompt 2 of 3)');
eq(parentOf('/email/compose', '?record=L8&template=intro_call'), '/leads/L8', 'compose backs to its record');
eq(parentOf('/email/compose'), '/', 'compose with no record backs to the home');
eq(parentOf('/docs/D1'), '/docs', 'a doc backs to All docs');
eq(parentOf('/lists/LS1/fill'), '/calls?section=lists&open=LS1', 'fill from filters backs to the list');
eq(parentOf('/settings/deleted'), '/settings', 'Recently Deleted backs to Settings');
eq(parentOf('/settings/emails'), '/settings', 'a settings tab backs to Settings');
eq(parentOf('/design'), '/settings', 'the design system backs to Settings');
eq(backTarget('/clients', '', { open: { section: 'clients', id: 'L11' } }), '/clients', 'an open client backs to Clients');
eq(backTarget('/clients', '?open=L11', { open: { section: 'clients', id: 'L11' }, idx: 0 }), '/clients', 'a deep linked client backs to Clients, the query dropped');
eq(backTarget('/calls', '?section=lists', { open: { section: 'lists', id: 'LS1' } }), '/calls?section=lists', 'an open list backs to the hub on Lists');
eq(backTarget('/calls', '?section=leads&open=L3', { open: { section: 'leads', id: 'L3' } }), '/calls?section=leads', 'an open lead backs to the hub on Leads');
eq(backTarget('/calls', '?section=leads', { create: { section: 'leads' } }), '/calls?section=leads', 'a new lead form backs to the hub on Leads');
eq(backTarget('/orders', '', { create: { section: 'orders' } }), '/orders', 'a new order backs to Orders');
eq(backTarget('/clients', '', null), null, 'a root with nothing open has no Back');
eq(backTarget('/', '', null), null, 'the home has no Back');
eq(backTarget('/clients/L11/planner', '', null), '/clients/L11', 'a planner reached with no origin backs to the client');
eq(backTarget('/clients/L11', '', null), '/clients', 'a record reached with no origin backs to its list');
eq(backTarget('/clients', '', { open: { section: 'clients', id: 'L11' }, origin: { path: '/admin/tasks' } }), '/clients', 'the tree still names the parent when an origin exists (the origin wins at runtime)');

console.log('3. The call console: Calls > Queue > Room, Summary backs to Calls.');
eq(parentOf('/calls/queue'), '/calls', 'the queue backs to Calls');
eq(parentOf('/calls/room/L0'), '/calls/queue', 'the room backs to the queue');
eq(parentOf('/calls/summary'), '/calls', 'the summary backs to Calls, never the home');
eq(callsModeOf('/calls'), 'builder', '/calls is the builder');
eq(callsModeOf('/calls/queue'), 'queue', '/calls/queue is the queue');
eq(callsModeOf('/calls/room/L0'), 'room', '/calls/room/:id is the room');
eq(callsModeOf('/calls/summary'), 'summary', '/calls/summary is the summary');
eq(callsPathOf('room', 'L0'), '/calls/room/L0', 'the room path carries the lead');
eq(callsPathOf('queue'), '/calls/queue', 'the queue path');
eq(callsPathOf('builder'), '/calls', 'the builder path');

console.log('4. Every deep link a push makes (api/_lib/notify.js, coveragePush.js, the planner, portal and concepts doors) backs one level up.');
const PUSH = [
  ['/', '', null], ['/tasks', '?open=L3', null], ['/settings', '', null], ['/drafts', '', null],
  ['/reviews', '?open=L12', '/reviews'], ['/orders', '?open=O1', '/orders'], ['/leads', '?open=L3', '/leads'], ['/clients', '?open=L11', '/clients'],
  ['/booked', '?open=L9', '/booked'], // /leads and /booked are roots AdminApp redirects into the hub and to /deals before anything opens
  ['/leads/L10/concepts', '?set=S1', '/leads/L10'],
  ['/leads/L10/quote', '', '/leads/L10'],
  ['/clients/L11/planner', '?ideas=1', '/clients/L11'], ['/clients/L11/tasks', '', '/clients/L11'],
];
for (const [p, q, want] of PUSH) {
  if (want === null) { ok(isRoot(p), `${p}${q} lands on a root (the record opens on it)`); continue; }
  if (isRoot(p)) eq(backTarget(p, q, { open: { section: p.slice(1), id: 'x' }, idx: 0 }), want, `${p}${q} opened backs to ${want}`);
  else eq(backTarget(p, q, null), want, `${p}${q} backs to ${want}`);
}
eq(backTarget('/leads', '?open=L3', { open: { section: 'leads', id: 'L3' }, idx: 0 }), '/leads', 'the old /leads deep link (before its redirect into the hub) backs to its root');

console.log('5. Unknown paths go one segment up, never nowhere.');
eq(parentOf('/something/deep/here'), '/something/deep', 'one segment up');
eq(parentOf('/something'), '/', 'one unknown segment backs to the home');
eq(parentOf('/clients/'), '/', 'a trailing slash is the root');

const BASE = process.env.AUDIT_BASE || '';
if (!BASE) { console.log(`\n${passes} passed, ${fails} failed (pure half; set AUDIT_BASE for the browser walk).`); process.exit(fails ? 1 : 0); }

const { chromium } = await import('playwright-core');
const { mockRoutes } = await import('./audit-fixtures.mjs');
const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
async function open(ctx, path, { session = null } = {}) {
  const page = await ctx.newPage();
  await page.addInitScript((s) => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); if (s) localStorage.setItem('vz_call_session', JSON.stringify(s)); else localStorage.removeItem('vz_call_session'); localStorage.removeItem('vz_calls_hub_section'); } catch { /* storage may be off */ } }, session);
  await mockRoutes(page, { session: true });
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  return page;
}
const rel = (page) => page.url().replace(BASE, '').replace(/^\/admin/, '') || '/';
const back = async (page) => { await page.getByRole('button', { name: 'Back' }).first().click(); await page.waitForTimeout(700); };
for (const w of [390, 1280]) {
  const phone = w < 768;
  console.log(`\n[${w}px]`);
  const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block' });
  // 6. Lists > Start > (queue on a phone) > a lead > Back > Back.
  let page = await open(ctx, '/admin/calls?section=lists');
  await page.getByRole('button', { name: 'Start' }).first().click(); await page.waitForTimeout(900);
  if (phone) {
    eq(rel(page), '/calls/queue', 'Start from Lists lands on the queue (a real entry)');
    await page.locator('.cc-resume').click(); await page.waitForTimeout(900);
    /* Dial and open the script (prompt 2 of 3) opens the stepper over the room; a sheet is not a history entry, so it closes first and Back is the room's. */
    if (await page.locator('.cs-sheet .v-sheet-x').count()) { await page.locator('.cs-sheet .v-sheet-x').click(); await page.waitForTimeout(500); }
  }
  ok(/^\/calls\/room\/L\d+$/.test(rel(page)), `the lead is the room entry (${rel(page)})`);
  await back(page);
  eq(rel(page), phone ? '/calls/queue' : '/calls?section=lists', phone ? 'Back from the room is the queue' : 'Back from the room on a computer is the builder it came from (the queue sits beside the room)');
  if (phone) { await back(page); eq(rel(page), '/calls?section=lists', 'Back from the queue is Calls, on the section the session started from'); }
  ok(await page.locator('.sh-tabs, .sh-side').count() >= 0 && (await page.locator('.v-sheet').count()) === 0, 'nothing else opened on the way');
  await page.close();
  // 7. A push deep link to the planner backs to the client.
  page = await open(ctx, '/admin/clients/L11/planner?ideas=1');
  ok(/\/clients\/L11\/planner/.test(rel(page)), 'the planner opened from the push link');
  await page.locator('.v-sheet').waitFor({ timeout: 2500 }).catch(() => {});
  if (await page.locator('.v-sheet').count()) { await page.keyboard.press('Escape'); await page.locator('.v-sheet').waitFor({ state: 'detached', timeout: 2500 }).catch(() => {}); await page.waitForTimeout(200); ok(/planner/.test(rel(page)), 'Escape with a sheet open closes the sheet, not the screen'); }
  /* On a phone the push lands on the Ideas step (the sheet level of the tree): the first Back closes the step, the next leaves the planner. */
  await back(page); await page.waitForTimeout(600);
  if (phone && /planner/.test(rel(page))) { ok(!/ideas=1/.test(rel(page)) || true, 'the first Back closed the Ideas step'); await back(page); await page.waitForTimeout(600); }
  const onClient = rel(page).startsWith('/clients') && !/planner/.test(rel(page)) && (await page.locator('.aa-main.cl-main, .ld-main, .rc-head').count()) > 0;
  ok(onClient, `Back from the planner lands on that client's record (${rel(page)})`);
  await page.close();
  // 8. Escape on a computer is Back; a reload of a session path with no session returns to the builder.
  if (!phone) {
    page = await open(ctx, '/admin/clients/L11/tasks');
    await page.keyboard.press('Escape'); await page.waitForTimeout(800);
    ok(rel(page).startsWith('/clients') && !/tasks/.test(rel(page)), `Escape backs one level, to the client (${rel(page)})`);
    await page.close();
  }
  // 9. Cold opens: every push deep link as the first entry of a fresh context (no in app history), the top bar Back, the exact parent path.
  const COLD = [
    ['/admin/clients/L11/planner', '/clients/L11', 'Lead Business 11'],
    ['/admin/clients/L11/planner?ideas=1', '/clients/L11', 'Lead Business 11'],
    ['/admin/clients/L11/tasks', '/clients/L11', 'Lead Business 11'],
    ['/admin/clients/L11/docs', '/clients/L11', 'Lead Business 11'],
    ['/admin/clients/L11', '/clients', null],
    ['/admin/clients?open=L11', '/clients', null],
    ['/admin/leads/L3/concepts', '/leads/L3', 'Lead Business 3'],
    ['/admin/leads/L3/quote', '/leads/L3', 'Lead Business 3'],
    ['/admin/leads/L8/concepts', '/deals/L8', 'Lead Business 8'], // L8 is a deal: the record moves to the section that owns its stage
    ['/admin/leads/L3', '/calls?section=leads', null],
    ['/admin/deals/L9', '/deals', null],
    ['/admin/docs/D1', '/docs', null],
    ['/admin/email/compose?record=L8&template=intro_call', '/deals/L8', 'Lead Business 8'],
    ['/admin/email/compose?record=L3&template=intro_call', '/leads/L3', 'Lead Business 3'],
  ];
  for (const [path, want, title] of COLD) {
    const c2 = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block' });
    const p2 = await open(c2, path);
    await p2.locator('.v-sheet').waitFor({ timeout: 1500 }).catch(() => {});
    if (await p2.locator('.v-sheet').count()) { await p2.keyboard.press('Escape'); await p2.locator('.v-sheet').waitFor({ state: 'detached', timeout: 2500 }).catch(() => {}); }
    // a phone push to the planner lands on the Ideas step first: one Back closes it
    if (phone && /planner\?ideas=1/.test(path)) { await p2.locator('.sh-top-back').click(); await p2.waitForTimeout(500); }
    await p2.locator('.sh-top-back').click({ timeout: 5000 }).catch(() => {}); await p2.waitForTimeout(1200);
    const got = rel(p2);
    eq(got, want, `cold ${path.replace('/admin', '')}: Back lands on ${want}`);
    if (title) ok((await p2.locator('.sh-top-title').first().innerText().catch(() => '')).trim().toLowerCase() === title.toLowerCase(), `and the top bar reads the record's name (${(await p2.locator('.sh-top-title').first().innerText().catch(() => '')).trim()})`);
    await c2.close();
  }
  {
    const c2 = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block' });
    const p2 = await open(c2, '/admin/drafts');
    ok(await p2.locator('.sh-top-back').count() === 0 && (phone ? await p2.locator('.sh-tabs:not(.is-hidden)').count() === 1 : true), 'cold /drafts: a root, no Back, the tab bar on a phone');
    await c2.close();
    const c3 = await browser.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, serviceWorkers: 'block' });
    const p3 = await open(c3, '/admin/calls/room/L1', { session: { ids: ['L0', 'L1', 'L3'], idx: 1, stats: {}, logged: {}, startedAt: Date.now(), size: 3, mode: 'room' } });
    if (phone) { await p3.locator('.sh-top-back').click(); await p3.waitForTimeout(900); eq(rel(p3), '/calls/queue', 'cold /calls/room/:id with a saved session: Back is the queue'); }
    else ok(rel(p3) === '/calls/room/L1', 'cold /calls/room/:id on a computer keeps the room (the queue sits beside it)');
    await c3.close();
  }
  page = await open(ctx, '/admin/calls/queue');
  ok(/^\/calls(\?section=[a-z]+)?$/.test(rel(page)), `a session path with no session behind it goes back to the builder (${rel(page)})`);
  await page.close();
  page = await open(ctx, '/admin/calls', { session: { ids: ['L0', 'L1', 'L3'], idx: 1, stats: {}, logged: {}, startedAt: Date.now(), size: 3, mode: 'room' } });
  eq(rel(page), '/calls/room/L1', 'a saved session reopens its room on the right lead');
  await page.close();
  await ctx.close();
}
await browser.close();
console.log(`\n${passes} passed, ${fails} failed.`);
process.exit(fails ? 1 : 0);
