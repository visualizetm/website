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
const WIDTHS = [320, 390, 430, 768, 1280];

// Hostile fixtures: very long unbroken + slash-joined names, long emails.
const LONG = 'Philly Mobile Detailing / KG Mobile Auto Detailing & Ceramic Coating Specialists';
const UNBROKEN = 'Superlongunbrokenbusinessnamethatcouldforcewidth' + 'x'.repeat(40);

const leads = Array.from({ length: 10 }, (_, i) => ({
  _id: 'L' + i,
  business: i === 0 ? LONG : i === 1 ? UNBROKEN : `Lead Business ${i}`,
  industry: 'Auto Detailing', area: 'Wilmington DE',
  descriptor: 'A local business with strong reviews.',
  phone: i % 3 === 2 ? '' : `(302) 555-01${10 + i}`,
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
  phone: '(302) 555-0100', status: ['new', 'contacted', 'replied', 'landed', 'denied'][i % 5],
  read: i % 2 === 0, notes: '', socials: {},
  fields: { 'Business Description': UNBROKEN, Budget: '$600' },
  createdAt: new Date(Date.now() - i * 864e5).toISOString(),
}));

const json = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

// Elements allowed to scroll sideways on purpose (their CONTENT may be wide,
// the element itself must still fit the viewport).
const HSCROLL_OK = ['.li-tablewrap'];

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
  await page.route('**/api/admin/settings**', r => r.fulfill(json({ prefs: { pushEnabled: true, emailEnabled: true } })));
  await page.route('**/api/admin/call-leads**', r => r.fulfill(json({ items: leads })));
  await page.route('**/api/push-key', r => r.fulfill(json({ key: null })));

  const check = async (label) => {
    await page.waitForTimeout(650);
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

  await goto('/admin');
  await page.evaluate(() => localStorage.removeItem('vz_call_session'));
  await check('dashboard');

  await goto('/admin/submissions');
  await check('submissions list');
  await page.locator('.aa-row-main').first().click({ timeout: 4000 }).catch(() => {});
  await check('submission detail (long name)');

  await goto('/admin/orders');
  await check('orders list');

  await goto('/admin/settings');
  await check('settings');

  await goto('/admin/calls');
  await page.evaluate(() => localStorage.removeItem('vz_call_session')).catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
  await check('call console queue');

  await page.locator('.cq-start').click({ timeout: 4000 }).catch(() => {});
  await check('call session (long name lead)');

  await ctx.close();
}

await browser.close();
if (failures) {
  console.log(`\n${failures} failing view(s). Fix before shipping.`);
  process.exit(1);
}
console.log('\nAll routes clean at every width — zero offenders.');
