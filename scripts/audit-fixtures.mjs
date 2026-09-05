/* Shared audit fixtures and API mocks (Prompt 14). The layout audit and the
 * feel audit register the same mocked admin endpoints against the same
 * deliberately hostile data, so both walk the same screens.
 *
 *   import { mockRoutes, leads, items, ... } from './audit-fixtures.mjs';
 *   await mockRoutes(page, { delay: 400, empty: ['leads'], fail: ['orders'], session: 'hang' });
 *
 * Resource names for `empty` and `fail`: leads, submissions, orders, packs,
 * projects, settings, calendly, stripe. `delay` adds milliseconds to every
 * admin GET so a real skeleton shows before data lands. `session` is true
 * (signed in, the default), false (the login screen), or 'hang' (never answers,
 * the boot frame).
 */
// Hostile fixtures: very long unbroken + slash-joined names, long emails.
export const LONG = 'Philly Mobile Detailing / KG Mobile Auto Detailing & Ceramic Coating Specialists';
export const UNBROKEN = 'Superlongunbrokenbusinessnamethatcouldforcewidth' + 'x'.repeat(40);

export const BOOKED_EXTRA = {
  stage: 'booked', callStatus: 'booked',
  meeting: { date: new Date().toISOString().slice(0, 10), time: '16:30', type: 'call', location: 'Zoom ' + UNBROKEN.slice(0, 20) },
  servicesPlanned: ['logo', 'site-onepager', 'stickers', 'brand-kit'],
  pricingOptions: [
    { label: 'Recommended', price: 1150, plan: '6mo', retainer: '$95/mo growth retainer', notes: LONG },
  ],
  conceptsTracker: { items: [{ label: 'Logo concept ' + UNBROKEN.slice(0, 40), done: false }], demoUrl: 'https://example.com/' + UNBROKEN, driveUrl: '' },
  prepNotes: UNBROKEN,
};

export const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
export const monthsAgo = (n, day) => { const d = new Date(); d.setMonth(d.getMonth() - n); if (day) d.setDate(day); return dayKey(d); };
export const daysFrom = (n) => dayKey(Date.now() + n * 864e5);
export const NOW_ISO = new Date().toISOString();

// Clients module fixtures (Prompt 10): one single-project client (L10, won), one
// payment plan client at month 5 of 6 (L11), one Content Kit retainer client
// (L12), one delivered client (L13).
export const PIPE_EXTRA = {
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
export const projects = [
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
export const stripeEvents = [
  { id: 'evt_matched', type: 'charge.succeeded', amount: 200, currency: 'usd', customerEmail: 'p4@x.com', customerName: 'Lead Business 11', description: 'Launch Plan month 5', subscriptionId: 'sub_1', at: daysFrom(-1), matchedLeadId: 'L11', ledgerId: 'lg4', receivedAt: daysFrom(-1) },
  { id: 'evt_unmatched', type: 'invoice.paid', amount: 250, currency: 'usd', customerEmail: 'unknown.person@' + UNBROKEN.slice(0, 20).toLowerCase() + '.com', customerName: 'Unknown Person ' + UNBROKEN.slice(0, 20), description: 'Content Kit ' + UNBROKEN.slice(0, 20), subscriptionId: 'sub_2', at: NOW_ISO, matchedLeadId: '', ledgerId: '', receivedAt: NOW_ISO },
];
export const health = { enrichment: { lastScanAt: new Date(Date.now() - 6 * 3600e3).toISOString(), leadsScannedLast24h: 41, fieldsFilledLast24h: 97 }, scraper: { lastInsertAt: new Date(Date.now() - 50 * 3600e3).toISOString(), insertedLast24h: 0, insertedLast7d: 63 }, crons: { reminders: { lastRunAt: new Date(Date.now() - 9 * 60e3).toISOString(), checked: 3, sent: 1 }, daily: { lastRunAt: new Date(Date.now() - 5 * 3600e3).toISOString(), rolled: 1, cancelled: 0, extended: 1 } }, stripe: { lastWebhookAt: NOW_ISO, unmatched: 1 }, lastBackupAt: daysFrom(-3) };
export const orders = [
  { _id: 'O1', source: 'shop', status: 'new', submissionId: 'id0', leadId: '', customer: { name: 'Person 0 ' + UNBROKEN.slice(0, 20), email: 'a.very.long.email.address.that.goes.on@extremelylongdomainnamefortesting.com', phone: '(302) 555-0100' },
    items: [{ id: 'i1', productId: '', name: 'Logo Die-Cut Sticker', label: 'Qty 100, 3 in', qty: 100, options: {}, artworkLink: '', priceTotal: 100, quote: false }, { id: 'i2', productId: '', name: 'Custom Text Vinyl ' + UNBROKEN.slice(0, 30), label: '6 x 24', qty: 1, options: { color: 'White' }, artworkLink: 'https://example.com/' + UNBROKEN, priceTotal: null, quote: true }],
    subtotal: 100, rush: true, dueAt: daysFrom(2), notes: UNBROKEN, paid: null, createdAt: daysFrom(-1), archived: false },
  { _id: 'O2', source: 'shop', status: 'cut', submissionId: 'id4', leadId: '', customer: { name: 'Person 4', email: 'p4@x.com', phone: '' },
    items: [{ id: 'i3', productId: 'nfc-card', name: 'NFC card', label: '', qty: 2, options: {}, artworkLink: '', priceTotal: 50, quote: false }], subtotal: 50, rush: false, dueAt: daysFrom(5), notes: '', paid: { at: daysFrom(-2), ledgerId: '', amount: 50 }, createdAt: daysFrom(-3), archived: false },
  { _id: 'O3', source: 'client', status: 'delivered', leadId: 'L11', projectId: 'P11', customer: { name: 'Lead Business 11', email: '', phone: '' },
    items: [{ id: 'i4', productId: 'stickers-50', name: 'Stickers, 50 pack', label: '', qty: 1, options: {}, artworkLink: '', priceTotal: 40, quote: false }, { id: 'i5', productId: 'cards-250', name: 'Business cards, 250', label: '', qty: 1, options: {}, artworkLink: '', priceTotal: 35, quote: false }],
    subtotal: 75, rush: false, dueAt: daysFrom(-8), notes: '', paid: { at: daysFrom(-9), ledgerId: 'lg4', amount: 75 }, packaging: { polyBag: true, headerCard: false, usageGuide: false }, createdAt: daysFrom(-15), archived: false },
];
export const packs = [
  { _id: 'K1', title: 'Universal logo directions', leadId: '', industryKey: '', kind: 'logo', tags: ['seed', 'logo'], prompts: [{ id: 'p1', label: 'Direction 1: wordmark', text: 'A clean, confident wordmark for [business] ' + UNBROKEN }, { id: 'p2', label: 'Direction 2: mark and lockup', text: 'A simple geometric brand mark.' }, { id: 'p3', label: 'Direction 3: badge', text: 'A circular badge logo.' }], images: [], notes: 'Edit these.', usedFor: [], createdAt: daysFrom(-10), updatedAt: daysFrom(-1) },
  { _id: 'K2', title: 'Auto detailing social grid ' + UNBROKEN.slice(0, 20), leadId: 'L8', industryKey: 'auto detailing', kind: 'social', tags: ['grid', 'before and after'], prompts: [{ id: 'p4', label: 'Nine post grid', text: 'A nine post Instagram grid for a mobile detailer.' }], images: [{ id: 'm1', label: 'Grid mock', link: 'https://example.com/grid.png' }, { id: 'm2', label: 'Story', link: 'https://example.com/story.jpg' }, { id: 'm3', label: 'Drive folder', link: 'https://drive.google.com/drive/folders/x' }], notes: '', usedFor: ['L8'], lastUsedAt: daysFrom(-2), createdAt: daysFrom(-20), updatedAt: daysFrom(-2) },
];

export const leads = Array.from({ length: 14 }, (_, i) => ({
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

export const items = Array.from({ length: 13 }, (_, i) => ({
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

export const json = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

const wait = (ms) => new Promise(r => setTimeout(r, ms));
export const EMPTY = { settings: { prefs: { pushEnabled: true, emailEnabled: true }, dashboard: { dailyCallTarget: 25 }, notifications: { readIds: [], lastSeenAt: null, snoozedUntil: {}, reminders: {} }, profile: { name: 'Rob', businessHours: { start: '09:00', end: '17:00' }, theme: 'dark', reduceMotion: false }, health: null, stripe: { configured: false }, cron: { configured: false }, calendly: { configured: false }, reminders: { configured: false }, passwordOverridden: false }, leads: { items: [] }, submissions: { items: [], unread: 0, total: 0, counts: {}, typeCounts: {}, series: [] }, orders: { items: [], unimported: 0 }, packs: { items: [] }, projects: { items: [] }, calendly: { configured: true, events: [] }, stripe: { configured: true, items: [], events: [], ok: true } };
const fail = () => ({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'audit: forced failure' }) });

/** Register every admin API mock on a Playwright page. */
export async function mockRoutes(page, opts = {}) {
  const empty = new Set(opts.empty || []);
  const failing = new Set(opts.fail || []);
  const delay = opts.delay || 0;
  const session = opts.session === undefined ? true : opts.session;
  // respond(name, data): the resource's failure or empty override wins, then the optional delay.
  const respond = async (r, name, data) => {
    if (failing.has(name)) return r.fulfill(fail());
    if (delay && r.request().method() === 'GET') await wait(delay);
    return r.fulfill(json(empty.has(name) && EMPTY[name] ? EMPTY[name] : data));
  };
  await page.route('**/api/admin/session', r => (session === 'hang' ? new Promise(() => {}) : r.fulfill(json({ authed: !!session }))));
  await page.route('**/api/admin/submissions**', r => respond(r, 'submissions', {
    items, unread: 3, total: items.length, counts: {}, typeCounts: {}, series: [{ total: 2, landed: 1 }, { total: 5, landed: 0 }],
  }));
  await page.route('**/api/admin/settings**', r => respond(r, 'settings', { prefs: { pushEnabled: true, emailEnabled: true }, dashboard: { dailyCallTarget: 25 }, notifications: { readIds: [], lastSeenAt: null, snoozedUntil: {}, reminders: { meetings: true, callbacks: true, bills: true, reviews: true } }, profile: { name: 'Rob', businessHours: { start: '09:00', end: '17:00' } }, health, stripe: { configured: true, webhookConfigured: false, lastWebhookAt: NOW_ISO, unmatched: 1 }, cron: { configured: true }, calendly: { configured: true }, reminders: { configured: true, push: true }, passwordOverridden: false }));
  await page.route('**/api/admin/stripe/**', r => respond(r, 'stripe', { configured: true, items: stripeEvents.filter(e => !e.matchedLeadId), events: stripeEvents, ok: true }));
  await page.route('**/api/admin/calendly/events**', r => respond(r, 'calendly', { configured: true, events: [
  { uri: 'https://api.calendly.com/scheduled_events/abc', at: new Date(Date.now() + 3 * 3600e3).toISOString(), end: new Date(Date.now() + 3.5 * 3600e3).toISOString(), name: 'Unmatched Person ' + UNBROKEN.slice(0, 30), email: 'nobody@example.com', phone: '', eventType: 'Intro call', join: 'https://example.com/join' },
  { uri: 'https://api.calendly.com/scheduled_events/def', at: new Date(Date.now() + 26 * 3600e3).toISOString(), end: new Date(Date.now() + 26.5 * 3600e3).toISOString(), name: 'Lead Business 3', email: '', phone: '(302) 555-0113', eventType: 'Intro call', join: '' },
  ] }));
  await page.route('**/api/admin/call-leads**', r => (r.request().method() === 'GET' ? respond(r, 'leads', { items: leads }) : r.fulfill(json({ ok: true, item: { ...leads[0], _id: 'LNEW' } }))));
  await page.route('**/api/admin/orders**', r => (r.request().method() === 'GET' ? respond(r, 'orders', { items: orders, unimported: 2 }) : r.fulfill(json({ ok: true, created: 2, item: { ...orders[0], _id: 'ONEW' } }))));
  await page.route('**/api/admin/concept-packs**', r => (r.request().method() === 'GET' ? respond(r, 'packs', { items: packs }) : r.fulfill(json({ ok: true, item: { ...packs[0], _id: 'KNEW' } }))));
  await page.route('**/api/admin/projects**', r => (r.request().method() === 'GET' ? respond(r, 'projects', { items: projects }) : r.fulfill(json({ ok: true, item: { ...projects[0], _id: 'PNEW' } }))));
  await page.route('**/api/push-key', r => r.fulfill(json({ key: null })));
  // Google Fonts never resolves inside the audit sandbox; answer with an empty stylesheet
  // (after `fontsDelay` ms) so first paint measurements are not bound to a 12 second timeout.
  await page.route('https://fonts.googleapis.com/**', async (r) => { if (opts.fontsDelay) await wait(opts.fontsDelay); return r.fulfill({ status: 200, contentType: 'text/css', body: '' }); });
  await page.route('https://fonts.gstatic.com/**', r => r.abort());
  // Registered last so they win over the broader submissions and call-leads routes above.
  await page.route('**/api/admin/submissions?deleted=1**', r => r.fulfill(json({ items: items.slice(0, 2).map(x => ({ ...x, deleted: true, deletedAt: NOW_ISO })) })));
  await page.route('**/api/admin/call-leads?deleted=1**', r => r.fulfill(json({ items: leads.slice(0, 2).map(x => ({ ...x, deleted: true, deletedAt: NOW_ISO })) })));
}
