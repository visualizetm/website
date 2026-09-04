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
        reviews: { nfcCard: true, nfcGivenAt: daysFrom(-20), googleLink: 'https://g.page/r/' + UNBROKEN, baseline: { count: 12, rating: 4.3, at: daysFrom(-30) }, latest: { count: 19, rating: 4.6, at: daysFrom(-2) }, asks: [{ at: new Date(Date.now() - 5 * 864e5).toISOString(), channel: 'nfc', result: 'asked', note: 'Handed the card ' + UNBROKEN.slice(0, 30) }, { at: NOW_ISO, channel: 'text', result: 'left', note: '' }] },
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
    delivery: { driveShared: true, emailSent: true, pitchSent: false, followUpLeadCallbackAt: '' }, releasedAt: new Date(Date.now() - 6 * 864e5).toISOString(), monthly: [], createdAt: '2026-11-01', archived: false },
];
// Studio fixtures (Prompt 11): two shop orders (one rush), one client order, two packs, one review submission.
// Prompt 12 fixtures: two Stripe events (one unmatched), a health document with a stale scraper.
const stripeEvents = [
  { id: 'evt_matched', type: 'charge.succeeded', amount: 200, currency: 'usd', customerEmail: 'p4@x.com', customerName: 'Lead Business 11', description: 'Launch Plan month 5', subscriptionId: 'sub_1', at: daysFrom(-1), matchedLeadId: 'L11', ledgerId: 'lg4', receivedAt: daysFrom(-1) },
  { id: 'evt_unmatched', type: 'invoice.paid', amount: 250, currency: 'usd', customerEmail: 'unknown.person@' + UNBROKEN.slice(0, 20).toLowerCase() + '.com', customerName: 'Unknown Person ' + UNBROKEN.slice(0, 20), description: 'Content Kit ' + UNBROKEN.slice(0, 20), subscriptionId: 'sub_2', at: NOW_ISO, matchedLeadId: '', ledgerId: '', receivedAt: NOW_ISO },
];
const health = { enrichment: { lastScanAt: new Date(Date.now() - 6 * 3600e3).toISOString(), leadsScannedLast24h: 41, fieldsFilledLast24h: 97 }, scraper: { lastInsertAt: new Date(Date.now() - 50 * 3600e3).toISOString(), insertedLast24h: 0, insertedLast7d: 63 }, crons: { reminders: { lastRunAt: new Date(Date.now() - 9 * 60e3).toISOString(), checked: 3, sent: 1 }, daily: { lastRunAt: new Date(Date.now() - 5 * 3600e3).toISOString(), rolled: 1, cancelled: 0, extended: 1 } }, stripe: { lastWebhookAt: NOW_ISO, unmatched: 1 }, lastBackupAt: daysFrom(-3) };
const orders = [
  { _id: 'O1', source: 'shop', status: 'new', submissionId: 'id0', leadId: '', customer: { name: 'Person 0 ' + UNBROKEN.slice(0, 20), email: 'a.very.long.email.address.that.goes.on@extremelylongdomainnamefortesting.com', phone: '(302) 555-0100' },
    items: [{ id: 'i1', productId: '', name: 'Logo Die-Cut Sticker', label: 'Qty 100, 3 in', qty: 100, options: {}, artworkLink: '', priceTotal: 100, quote: false }, { id: 'i2', productId: '', name: 'Custom Text Vinyl ' + UNBROKEN.slice(0, 30), label: '6 x 24', qty: 1, options: { color: 'White' }, artworkLink: 'https://example.com/' + UNBROKEN, priceTotal: null, quote: true }],
    subtotal: 100, rush: true, dueAt: daysFrom(2), notes: UNBROKEN, paid: null, createdAt: daysFrom(-1), archived: false },
  { _id: 'O2', source: 'shop', status: 'cut', submissionId: 'id4', leadId: '', customer: { name: 'Person 4', email: 'p4@x.com', phone: '' },
    items: [{ id: 'i3', productId: 'nfc-card', name: 'NFC card', label: '', qty: 2, options: {}, artworkLink: '', priceTotal: 50, quote: false }], subtotal: 50, rush: false, dueAt: daysFrom(5), notes: '', paid: { at: daysFrom(-2), ledgerId: '', amount: 50 }, createdAt: daysFrom(-3), archived: false },
  { _id: 'O3', source: 'client', status: 'delivered', leadId: 'L11', projectId: 'P11', customer: { name: 'Lead Business 11', email: '', phone: '' },
    items: [{ id: 'i4', productId: 'stickers-50', name: 'Stickers, 50 pack', label: '', qty: 1, options: {}, artworkLink: '', priceTotal: 40, quote: false }, { id: 'i5', productId: 'cards-250', name: 'Business cards, 250', label: '', qty: 1, options: {}, artworkLink: '', priceTotal: 35, quote: false }],
    subtotal: 75, rush: false, dueAt: daysFrom(-8), notes: '', paid: { at: daysFrom(-9), ledgerId: 'lg4', amount: 75 }, packaging: { polyBag: true, headerCard: false, usageGuide: false }, createdAt: daysFrom(-15), archived: false },
];
const packs = [
  { _id: 'K1', title: 'Universal logo directions', leadId: '', industryKey: '', kind: 'logo', tags: ['seed', 'logo'], prompts: [{ id: 'p1', label: 'Direction 1: wordmark', text: 'A clean, confident wordmark for [business] ' + UNBROKEN }, { id: 'p2', label: 'Direction 2: mark and lockup', text: 'A simple geometric brand mark.' }, { id: 'p3', label: 'Direction 3: badge', text: 'A circular badge logo.' }], images: [], notes: 'Edit these.', usedFor: [], createdAt: daysFrom(-10), updatedAt: daysFrom(-1) },
  { _id: 'K2', title: 'Auto detailing social grid ' + UNBROKEN.slice(0, 20), leadId: 'L8', industryKey: 'auto detailing', kind: 'social', tags: ['grid', 'before and after'], prompts: [{ id: 'p4', label: 'Nine post grid', text: 'A nine post Instagram grid for a mobile detailer.' }], images: [{ id: 'm1', label: 'Grid mock', link: 'https://example.com/grid.png' }, { id: 'm2', label: 'Story', link: 'https://example.com/story.jpg' }, { id: 'm3', label: 'Drive folder', link: 'https://drive.google.com/drive/folders/x' }], notes: '', usedFor: ['L8'], lastUsedAt: daysFrom(-2), createdAt: daysFrom(-20), updatedAt: daysFrom(-2) },
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

const items = Array.from({ length: 13 }, (_, i) => ({
  _id: 'id' + i,
  type: i === 12 ? 'review' : i === 2 ? 'contact' : i === 6 ? 'other' : i % 4 === 0 ? 'shop-order' : 'start',
  projectType: 'Brand', name: 'Person ' + i,
  business: i === 0 ? LONG : i === 1 ? UNBROKEN : 'Business ' + i,
  email: i === 2 ? 'a.very.long.email.address.that.goes.on@extremelylongdomainnamefortesting.com' : `p${i}@x.com`,
  linkedLeadId: i === 3 ? 'L0' : undefined,
  phone: '(302) 555-0100', status: ['new', 'contacted', 'replied', 'landed', 'denied'][i % 5],
  read: i % 2 === 0, notes: '', socials: {},
  fields: i === 12 ? { rating: 5, text: 'Rob nailed the logo. ' + UNBROKEN } : i === 2 ? { Message: 'Can you do a quick logo? ' + UNBROKEN } : { 'Business Description': UNBROKEN, Budget: '$600', 'What do you sell': 'Mobile detailing for busy people.\nSecond line of the answer.', Timeline: 'Two weeks' },
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
  await page.route('**/api/admin/settings**', r => r.fulfill(json({ prefs: { pushEnabled: true, emailEnabled: true }, dashboard: { dailyCallTarget: 25 }, notifications: { readIds: [], lastSeenAt: null, snoozedUntil: {}, reminders: { meetings: true, callbacks: true, bills: true, reviews: true } }, profile: { name: 'Rob', businessHours: { start: '09:00', end: '17:00' } }, health, stripe: { configured: true, webhookConfigured: false, lastWebhookAt: NOW_ISO, unmatched: 1 }, cron: { configured: true }, calendly: { configured: true }, reminders: { configured: true, push: true }, passwordOverridden: false })));
  await page.route('**/api/admin/stripe/**', r => r.fulfill(json({ configured: true, items: stripeEvents.filter(e => !e.matchedLeadId), events: stripeEvents, ok: true })));
  await page.route('**/api/admin/calendly/events**', r => r.fulfill(json({ configured: true, events: [
    { uri: 'https://api.calendly.com/scheduled_events/abc', at: new Date(Date.now() + 3 * 3600e3).toISOString(), end: new Date(Date.now() + 3.5 * 3600e3).toISOString(), name: 'Unmatched Person ' + UNBROKEN.slice(0, 30), email: 'nobody@example.com', phone: '', eventType: 'Intro call', join: 'https://example.com/join' },
    { uri: 'https://api.calendly.com/scheduled_events/def', at: new Date(Date.now() + 26 * 3600e3).toISOString(), end: new Date(Date.now() + 26.5 * 3600e3).toISOString(), name: 'Lead Business 3', email: '', phone: '(302) 555-0113', eventType: 'Intro call', join: '' },
  ] })));
  await page.route('**/api/admin/call-leads**', r => r.fulfill(json({ items: leads })));
  await page.route('**/api/admin/orders**', r => (r.request().method() === 'GET' ? r.fulfill(json({ items: orders, unimported: 2 })) : r.fulfill(json({ ok: true, created: 2, item: { ...orders[0], _id: 'ONEW' } }))));
  await page.route('**/api/admin/concept-packs**', r => (r.request().method() === 'GET' ? r.fulfill(json({ items: packs })) : r.fulfill(json({ ok: true, item: { ...packs[0], _id: 'KNEW' } }))));
  await page.route('**/api/admin/projects**', r => (r.request().method() === 'GET' ? r.fulfill(json({ items: projects })) : r.fulfill(json({ ok: true, item: { ...projects[0], _id: 'PNEW' } }))));
  await page.route('**/api/push-key', r => r.fulfill(json({ key: null })));
  // Registered last so they win over the broader submissions and call-leads routes above.
  await page.route('**/api/admin/submissions?deleted=1**', r => r.fulfill(json({ items: items.slice(0, 2).map(x => ({ ...x, deleted: true, deletedAt: NOW_ISO })) })));
  await page.route('**/api/admin/call-leads?deleted=1**', r => r.fulfill(json({ items: leads.slice(0, 2).map(x => ({ ...x, deleted: true, deletedAt: NOW_ISO })) })));

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
  const only = process.env.AUDIT_ONLY; // 'settings', 'clients', or 'studio' reruns just that block

  if (!only || only === 'settings') {
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
