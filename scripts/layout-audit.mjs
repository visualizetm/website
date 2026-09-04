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

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';
const WIDTHS = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(',').map(Number) : [320, 390, 430, 768, 1280];
const SHOTS = process.env.AUDIT_SHOTS || ''; // directory: save a screenshot per check

// Hostile fixtures: very long unbroken + slash-joined names, long emails.
const LONG = 'Philly Mobile Detailing / KG Mobile Auto Detailing & Ceramic Coating Specialists';
const UNBROKEN = 'Superlongunbrokenbusinessnamethatcouldforcewidth' + 'x'.repeat(40);

const BOOKED_EXTRA = {
  stage: 'booked', callStatus: 'booked',
  meeting: { date: new Date().toISOString().slice(0, 10), time: '16:30', type: 'call', location: 'Zoom ' + UNBROKEN.slice(0, 20) },
  servicesPlanned: ['logo', 'site-onepager', 'stickers', 'brand-kit'],
  pricingOptions: [
    { label: 'Recommended', price: 1150, plan: '6mo', retainer: '$95/mo growth retainer', notes: LONG },
  ],
  conceptsTracker: { items: [{ label: 'Logo concept ' + UNBROKEN.slice(0, 40), done: false }], demoUrl: 'https://example.com/' + UNBROKEN, driveUrl: '' },
  prepNotes: UNBROKEN,
};

const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const monthsAgo = (n, day) => { const d = new Date(); d.setMonth(d.getMonth() - n); if (day) d.setDate(day); return dayKey(d); };
const daysFrom = (n) => dayKey(Date.now() + n * 864e5);
const NOW_ISO = new Date().toISOString();

// Clients module fixtures (Prompt 10): one single-project client (L10, won), one
// payment plan client at month 5 of 6 (L11), one Content Kit retainer client
// (L12), one delivered client (L13).
const PIPE_EXTRA = {
  10: { stage: 'won', callStatus: 'booked', bookedOutcome: { result: 'won', reason: '', at: '2027-01-02T10:00:00Z' },
        servicesPlanned: ['logo', 'site-full'], checklists: [{ name: 'Kickoff ' + UNBROKEN.slice(0, 30), items: [{ text: UNBROKEN, done: false }, { text: 'Send contract', done: true }] }] },
  11: { stage: 'client', callStatus: 'booked', clientSince: '2027-01-05T10:00:00Z', clientStatus: 'active',
        servicesPlanned: ['brand-kit', 'site-shop', 'stickers'],
        pricingOptions: [{ label: LONG, price: 1150, plan: '6mo', retainer: LONG, notes: 'A\nB\nC' }],
        checklists: [{ name: 'Launch', items: [{ text: 'Domain live', done: true }] }],
        links: { website: 'https://example.com/' + UNBROKEN, drive: 'https://drive.google.com/drive/folders/' + UNBROKEN, clickup: '', instagram: '' },
        brand: { primary: '#d44c43', colors: ['#080808', '#fafafa', 'notahex', ''], fontDisplay: 'Barlow Condensed ' + UNBROKEN.slice(0, 20), fontBody: 'Inter', logoLink: 'https://example.com/' + UNBROKEN, notes: UNBROKEN },
        purchases: [
          { id: 'lg1', label: 'Launch Plan: Month 1 of 6', amount: 200, at: monthsAgo(4, 5), notes: UNBROKEN.slice(0, 50), projectId: 'P11' },
          { id: 'lg2', label: 'Launch Plan: Month 2 of 6', amount: 200, at: monthsAgo(3, 5), notes: '', projectId: 'P11' },
          { id: 'lg3', label: 'Launch Plan: Month 3 of 6', amount: 200, at: monthsAgo(2, 5), notes: '', projectId: 'P11' },
          { id: 'lg4', label: 'Launch Plan: Month 4 of 6', amount: 200, at: monthsAgo(1, 5), notes: '', projectId: 'P11' },
          { label: LONG, amount: 40, at: '2027-01-05', notes: UNBROKEN.slice(0, 50) },
        ],
        contactLog: [{ type: 'meeting', at: '2027-02-03', note: UNBROKEN }] },
  12: { stage: 'client', callStatus: 'booked', clientSince: '2026-12-01T10:00:00Z', clientStatus: 'active',
        retainer: { projectId: 'P12', planId: 'content-kit', amount: 250, status: 'active', startedAt: monthsAgo(2, 12), billDay: 12, nextBillAt: daysFrom(3), cancelAt: '' },
        purchases: [{ id: 'lg12a', label: 'Content Kit retainer: Month 1', amount: 250, at: monthsAgo(2, 12), notes: '', projectId: 'P12' }, { id: 'lg12b', label: 'Content Kit retainer: Month 2', amount: 250, at: monthsAgo(1, 12), notes: '', projectId: 'P12' }] },
  13: { stage: 'client', callStatus: 'booked', clientSince: '2026-11-01T10:00:00Z', clientStatus: 'delivered',
        purchases: [{ id: 'lg13', label: 'Brand Starter: Full payment', amount: 350, at: '2026-11-02', notes: '', projectId: 'P13' }] },
};
const projects = [
  { _id: 'P10', leadId: 'L10', name: 'Web Essentials', kind: 'web', packageId: 'web-essentials', stage: 'design', stages: ['kickoff', 'design', 'revisions', 'build', 'delivery', 'delivered'], total: 500,
    schedule: [{ id: 's1', amount: 500, dueAt: daysFrom(-10), status: 'upcoming', ledgerId: '', label: 'Full payment' }], revisions: { max: 2, used: 1, log: [{ at: NOW_ISO, note: 'Tightened the hero ' + UNBROKEN.slice(0, 40), extra: false }] }, plan: null,
    links: { drive: '', clickup: '' }, deliverables: [{ id: 'd1', group: '02', label: 'Access and credentials', done: false, link: '' }, { id: 'd2', group: '02', label: 'Walkthrough video', done: false, link: '' }, { id: 'd3', group: '04', label: 'Source files', done: false, link: '' }],
    delivery: { driveShared: false, emailSent: false, pitchSent: false, followUpLeadCallbackAt: '' }, monthly: [], createdAt: daysFrom(-12), archived: false },
  { _id: 'P11', leadId: 'L11', name: 'Launch Plan', kind: 'combined', packageId: 'launch-plan', stage: 'revisions', stages: ['kickoff', 'design', 'revisions', 'build', 'delivery', 'delivered'], total: 1275,
    schedule: [
      { id: 'm1', amount: 200, dueAt: monthsAgo(4, 5), status: 'paid', ledgerId: 'lg1', label: 'Month 1 of 6', paidAt: NOW_ISO },
      { id: 'm2', amount: 200, dueAt: monthsAgo(3, 5), status: 'paid', ledgerId: 'lg2', label: 'Month 2 of 6' },
      { id: 'm3', amount: 200, dueAt: monthsAgo(2, 5), status: 'paid', ledgerId: 'lg3', label: 'Month 3 of 6' },
      { id: 'm4', amount: 200, dueAt: monthsAgo(1, 5), status: 'paid', ledgerId: 'lg4', label: 'Month 4 of 6' },
      { id: 'm5', amount: 200, dueAt: daysFrom(2), status: 'upcoming', ledgerId: '', label: 'Month 5 of 6' },
      { id: 'm6', amount: 200, dueAt: daysFrom(32), status: 'upcoming', ledgerId: '', label: 'Month 6 of 6' },
      { id: 'x1', amount: 75, dueAt: daysFrom(-3), status: 'upcoming', ledgerId: '', label: 'Extra revision round 1', extra: true },
    ],
    revisions: { max: 2, used: 2, log: [{ at: NOW_ISO, note: 'Round one', extra: false }, { at: NOW_ISO, note: 'Round two ' + UNBROKEN.slice(0, 30), extra: false }, { at: NOW_ISO, note: 'They want the mark reworked after approving it ' + UNBROKEN.slice(0, 30), extra: true }] },
    plan: { months: 6, monthly: 200, stripeCancelled: false }, links: { drive: 'https://drive.google.com/drive/folders/' + UNBROKEN, clickup: 'https://app.clickup.com/x' },
    deliverables: [{ id: 'a1', group: '01', label: 'Logo PNG', done: true, link: 'https://drive.google.com/file/' + UNBROKEN }, { id: 'a2', group: '01', label: 'Logo SVG', done: false, link: '' }, { id: 'a3', group: '02', label: 'Access and credentials', done: false, link: '' }, { id: 'a4', group: '04', label: 'Source files', done: false, link: '' }],
    delivery: { driveShared: false, emailSent: false, pitchSent: false, followUpLeadCallbackAt: '' }, monthly: [], createdAt: monthsAgo(4, 5), archived: false },
  { _id: 'P12', leadId: 'L12', name: 'Content Kit retainer', kind: 'retainer', packageId: 'content-kit', stage: 'kickoff', stages: ['kickoff', 'delivered'], total: 0,
    schedule: [{ id: 'r1', amount: 250, dueAt: monthsAgo(2, 12), status: 'paid', ledgerId: 'lg12a', label: 'Month 1' }, { id: 'r2', amount: 250, dueAt: monthsAgo(1, 12), status: 'paid', ledgerId: 'lg12b', label: 'Month 2' }, { id: 'r3', amount: 250, dueAt: daysFrom(3), status: 'upcoming', ledgerId: '', label: 'Month 3' }, { id: 'r4', amount: 250, dueAt: daysFrom(33), status: 'upcoming', ledgerId: '', label: 'Month 4' }],
    revisions: { max: 2, used: 0, log: [] }, plan: null, links: { drive: '', clickup: '' }, deliverables: [], delivery: { driveShared: false, emailSent: false, pitchSent: false, followUpLeadCallbackAt: '' },
    monthly: [{ month: dayKey(Date.now()).slice(0, 7), included: 8, delivered: 3, log: [{ at: NOW_ISO, count: 3, note: 'Three story graphics ' + UNBROKEN.slice(0, 30) }] }, { month: monthsAgo(1).slice(0, 7), included: 8, delivered: 8, log: [{ at: NOW_ISO, count: 8, note: 'Full month' }] }],
    retainer: { planId: 'content-kit', billDay: 12, startedAt: monthsAgo(2, 12) }, createdAt: monthsAgo(2, 12), archived: false },
  { _id: 'P13', leadId: 'L13', name: 'Brand Starter', kind: 'brand', packageId: 'brand-starter', stage: 'delivered', stages: ['kickoff', 'design', 'revisions', 'delivery', 'delivered'], total: 350,
    schedule: [{ id: 'f1', amount: 350, dueAt: '2026-11-02', status: 'paid', ledgerId: 'lg13', label: 'Full payment' }], revisions: { max: 2, used: 2, log: [] }, plan: null, links: { drive: 'https://drive.google.com/drive/folders/abc', clickup: '' },
    deliverables: [{ id: 'b1', group: '01', label: 'Logo PNG', done: true, link: '' }, { id: 'b2', group: '01', label: 'Logo SVG', done: true, link: '' }, { id: 'b3', group: '04', label: 'Source files', done: true, link: '' }],
    delivery: { driveShared: true, emailSent: true, pitchSent: false, followUpLeadCallbackAt: '' }, releasedAt: '2026-11-20T10:00:00Z', monthly: [], createdAt: '2026-11-01', archived: false },
];

const leads = Array.from({ length: 14 }, (_, i) => ({
  ...(i === 8 || i === 9 ? BOOKED_EXTRA : {}),
  ...(PIPE_EXTRA[i] || {}),
  _id: 'L' + i,
  business: i === 0 ? LONG : i === 1 ? UNBROKEN : `Lead Business ${i}`,
  industry: 'Auto Detailing', area: 'Wilmington DE',
  descriptor: 'A local business with strong reviews.',
  phone: i % 3 === 2 ? '' : i === 5 ? '(302) 555-0114' : `(302) 555-01${10 + i}`, // i=5 duplicates i=4 (merge modal)
  enrichment: i % 2 ? { lastScanAt: new Date(Date.now() - (i > 6 ? 20 : 2) * 864e5).toISOString(), scanCount: i } : undefined,
  callbackAt: i === 1 ? new Date(Date.now() + 2 * 3600e3).toISOString() : i === 6 ? new Date(Date.now() - 26 * 3600e3).toISOString() : undefined,
  sourceId: i > 9 ? 'gm:' + i : undefined,
  phoneNote: '', askFor: 'Damian', bestWindow: 'Before 8am or after 5pm',
  priority: ['hot', 'warm', 'cold'][i % 3], callStatus: ['not-called', 'callback', 'booked', 'no', 'no-answer'][i % 5],
  angle: 'Their reviews carry them but the site is a dead link — show them what they lose. '.repeat(3),
  notes: i === 1 ? 'WARNING do not mention the old owner ' + UNBROKEN : 'Friendly front desk.',
  socials: { instagram: 'https://instagram.com/x', website: 'https://example.com' },
  beforeYouDial: ['Open socials'], objections: [{ say: 'How much?', respond: 'Concepts first.' }],
  script: { confirm: 'Hey', intro: 'Hi', homework: 'Saw you', question: 'Who handles it?', likelyAnswers: [], hook: 'Free concepts', ask: '15 min?' },
  close: { lockIt: 'Lock', ifNo: 'Ok', noAnswer: 'Retry' },
  afterCall: {}, intel: { accomplishments: [], gaps: [], dropLines: [] },
  callLog: [{ at: '2026-08-05T14:22:00Z', outcome: 'no-answer', note: 'Rang out ' + UNBROKEN.slice(0, 60), meeting: '', email: '' }],
  createdAt: new Date(Date.now() - i * 864e5).toISOString(),
}));

const items = Array.from({ length: 12 }, (_, i) => ({
  _id: 'id' + i,
  type: i % 4 === 0 ? 'shop-order' : 'start',
  projectType: 'Brand', name: 'Person ' + i,
  business: i === 0 ? LONG : i === 1 ? UNBROKEN : 'Business ' + i,
  email: i === 2 ? 'a.very.long.email.address.that.goes.on@extremelylongdomainnamefortesting.com' : `p${i}@x.com`,
  linkedLeadId: i === 3 ? 'L0' : undefined,
  phone: '(302) 555-0100', status: ['new', 'contacted', 'replied', 'landed', 'denied'][i % 5],
  read: i % 2 === 0, notes: '', socials: {},
  fields: { 'Business Description': UNBROKEN, Budget: '$600' },
  createdAt: new Date(Date.now() - i * 864e5).toISOString(),
}));

const json = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

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
  await page.route('**/api/admin/session', r => r.fulfill(json({ authed: true })));
  await page.route('**/api/admin/submissions**', r => r.fulfill(json({
    items, unread: 3, total: items.length, counts: {}, typeCounts: {}, series: [{ total: 2, landed: 1 }, { total: 5, landed: 0 }],
  })));
  await page.route('**/api/admin/settings**', r => r.fulfill(json({ prefs: { pushEnabled: true, emailEnabled: true }, dashboard: { dailyCallTarget: 25 }, notifications: { readIds: [], lastSeenAt: null, snoozedUntil: {}, reminders: { meetings: true, callbacks: true } }, calendly: { configured: true }, reminders: { configured: false, push: true } })));
  await page.route('**/api/admin/calendly/events**', r => r.fulfill(json({ configured: true, events: [
    { uri: 'https://api.calendly.com/scheduled_events/abc', at: new Date(Date.now() + 3 * 3600e3).toISOString(), end: new Date(Date.now() + 3.5 * 3600e3).toISOString(), name: 'Unmatched Person ' + UNBROKEN.slice(0, 30), email: 'nobody@example.com', phone: '', eventType: 'Intro call', join: 'https://example.com/join' },
    { uri: 'https://api.calendly.com/scheduled_events/def', at: new Date(Date.now() + 26 * 3600e3).toISOString(), end: new Date(Date.now() + 26.5 * 3600e3).toISOString(), name: 'Lead Business 3', email: '', phone: '(302) 555-0113', eventType: 'Intro call', join: '' },
  ] })));
  await page.route('**/api/admin/call-leads**', r => r.fulfill(json({ items: leads })));
  await page.route('**/api/admin/projects**', r => (r.request().method() === 'GET' ? r.fulfill(json({ items: projects })) : r.fulfill(json({ ok: true, item: { ...projects[0], _id: 'PNEW' } }))));
  await page.route('**/api/push-key', r => r.fulfill(json({ key: null })));

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

  // domcontentloaded + settle delay: 'networkidle' never settles with the
  // PWA service worker active, so bounded waits keep the audit fast.
  const goto = (path) => page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  const only = process.env.AUDIT_ONLY; // 'clients' reruns just the Clients module block

  if (!only) {
  await goto('/admin');
  await page.evaluate(() => localStorage.removeItem('vz_call_session'));
  await check('dashboard');
  await goto('/admin/?loading=1');
  await check('dashboard skeleton');

  await goto('/admin/submissions');
  await check('submissions list');
  await page.locator('.aa-row-main').first().click({ timeout: 4000 }).catch(() => {});
  await check('submission detail (long name)');

  await goto('/admin/orders');
  await check('orders list');

  await goto('/admin/settings');
  await check('settings');
  await page.getByRole('button', { name: /Notifications/ }).first().click({ timeout: 3000 }).catch(() => {});
  await check('settings: notifications and calendly rows');

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
