/* Site Prompt 5, Part 4: docs/SITE-QA-CHECKLIST.md as a Playwright walk
 * against the marketing site, the same shape as scripts/regression.mjs for
 * the admin. There is no live database here, so /api/showcase is mocked
 * with one mutable fixture client; each step mutates it (publish, toggle a
 * featured flag, add a testimonial, unpublish) and reloads the relevant
 * page, exactly the shape a real publish in the CRM takes: the marketing
 * site always fetches fresh on a real page load, the 60 second figure in
 * the checklist is fetchShowcase()'s in-memory cache TTL for a tab that
 * was already open, not a delay a first visit ever waits through.
 *
 * Site Prompt 6 added the last three steps: the simplified header and
 * footer, the removed print shop, and the rebuilt Contact page. Step 6
 * also flipped on Home, which now has to show no price at all.
 *
 *   npx vite build && npx vite preview --port 4330 &
 *   node scripts/site-regression.mjs
 */
import { chromium } from 'playwright-core';
import { PACKAGES, ADDONS, money } from '../src/shared/pricing.js';
import { mockRoutes } from './audit-fixtures.mjs';

const EXE = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = process.env.AUDIT_BASE || 'http://127.0.0.1:4330';

const client = () => ({
  slug: 'sitecheck-co',
  displayName: 'Site Check Co',
  type: 'Testing',
  blurb: 'A fixture client for the site regression walk.',
  cover: '',
  year: '2026',
  // Site Prompt 7: one logo string, and a cover so the hero deck has a card.
  brand: { enabled: true, logo: '/showcase/fixtures/logo.svg', palette: [], typography: [], images: [], notes: '' },
  instagram: { enabled: false, handle: '', url: '', profileImage: '', posts: [], notes: '' },
  website: { enabled: false, url: '', screenshots: [], notes: '' },
  cards: { enabled: false, front: '', back: '', notes: '' },
  print: { enabled: false, items: [], notes: '' },
  featured: { landing: false, logoStrip: false, work: false, order: 0 },
  testimonials: [],
  socials: {},
});

/** The one client this walk publishes, toggles, and unpublishes. Steps mutate this in place. */
const state = { published: false, c: client() };

function payloadFor(slug) {
  const list = state.published ? [state.c] : [];
  if (slug) return list.find(c => c.slug === slug) || null;
  return {
    clients: list,
    landing: {
      logoStrip: list.filter(c => c.featured.logoStrip).map(c => ({ slug: c.slug, displayName: c.displayName, logo: c.brand.logo })),
      work: list.filter(c => c.featured.work).map(c => ({ slug: c.slug, displayName: c.displayName, type: c.type, blurb: c.blurb, cover: c.cover })),
      testimonials: list.flatMap(c => c.testimonials.filter(t => t.published && t.featured).map(t => ({ ...t, business: c.displayName, slug: c.slug }))),
      stats: {},
    },
  };
}

async function mockAndGoto(page, path) {
  await page.unroute('**/api/showcase**').catch(() => {});
  await page.route('**/api/showcase**', (r) => {
    const u = new URL(r.request().url());
    const slug = u.searchParams.get('slug');
    const data = payloadFor(slug);
    if (slug && !data) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.addInitScript(() => { try { localStorage.setItem('vz_theme', 'dark'); localStorage.setItem('vz_boot', '1'); } catch {} });
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(900);
}

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();

const rows = [];
const step = async (label, fn) => {
  let ok = false, detail = '';
  try { detail = (await fn()) || ''; ok = true; }
  catch (err) { detail = err.message; }
  rows.push({ label, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` (${detail})` : ''}`);
};

await step('1. Not published: absent from /clients', async () => {
  await mockAndGoto(page, '/clients');
  const count = await page.locator('.wk-card', { hasText: 'Site Check Co' }).count();
  if (count !== 0) throw new Error(`found ${count} cards, expected 0`);
});

await step('2. Publish: appears on /clients', async () => {
  state.published = true;
  await mockAndGoto(page, '/clients');
  const count = await page.locator('.wk-card', { hasText: 'Site Check Co' }).count();
  if (count !== 1) throw new Error(`found ${count} cards, expected 1`);
});

await step('3. Toggle logo strip + work flags: logo and card appear on Home', async () => {
  state.c.featured.logoStrip = true;
  state.c.featured.work = true;
  await mockAndGoto(page, '/');
  const logo = await page.locator('.trust-logo[aria-label="Site Check Co"]').count();
  const card = await page.locator('.wk-card', { hasText: 'Site Check Co' }).count();
  if (!logo) throw new Error('no logo strip entry');
  if (!card) throw new Error('no recent-clients card');
});

await step('4. Publish a testimonial: shows on Home and /clients', async () => {
  state.c.testimonials = [{ quote: 'Great to work with.', author: 'Test Author', role: 'Owner', rating: 5, source: 'text', published: true, featured: true }];
  await mockAndGoto(page, '/');
  const onHome = await page.locator('.tc-business', { hasText: 'Site Check Co' }).count();
  await mockAndGoto(page, '/clients');
  const onClients = await page.locator('.tc-business', { hasText: 'Site Check Co' }).count();
  if (!onHome) throw new Error('missing on Home');
  if (!onClients) throw new Error('missing on /clients');
});

await step('5. Unpublish: disappears from /clients', async () => {
  state.published = false;
  await mockAndGoto(page, '/clients');
  const count = await page.locator('.wk-card', { hasText: 'Site Check Co' }).count();
  if (count !== 0) throw new Error(`found ${count} cards, expected 0`);
});

await step('6. A price in pricing.js reads live on Services, and Home shows no price at all', async () => {
  const brandStarter = PACKAGES.find(p => p.id === 'brand-starter');
  const stickers = ADDONS.find(a => a.id === 'stickers');
  await mockAndGoto(page, '/services');
  const svcBrand = await page.locator('.pk-card').filter({ has: page.locator('.pk-card-name', { hasText: /^Brand Starter$/ }) }).locator('.pk-card-price').textContent();
  if (svcBrand.trim() !== money(brandStarter.price)) throw new Error(`Services shows ${svcBrand.trim()}, pricing.js has ${money(brandStarter.price)}`);
  const svcSticker = await page.locator('.pk-card').filter({ has: page.locator('.pk-card-name', { hasText: /^Stickers$/ }) }).locator('.pk-card-price').textContent();
  if (svcSticker.trim() !== money(stickers.price)) throw new Error(`Services shows ${svcSticker.trim()}, pricing.js has ${money(stickers.price)}`);
  // Site Prompt 6: Home is built around what Rob does for each kind of
  // business and says nothing about what it costs, so the check here is
  // the opposite of the one on Services: no money anywhere on the page.
  await mockAndGoto(page, '/');
  const homeText = await page.locator('body').innerText();
  const priced = homeText.match(/\$\s?\d/);
  if (priced) throw new Error(`Home shows a price (${priced[0]})`);
});

await step('7. Header and footer: three links and one free call, no Services or Shop', async () => {
  await mockAndGoto(page, '/');
  const nav = await page.locator('.navbar-link').allInnerTexts();
  if (nav.join(',') !== 'Home,Clients,Contact') throw new Error(`header links are ${nav.join(', ')}`);
  const cta = await page.locator('.navbar-cta').innerText();
  if (!/Book a free call/.test(cta)) throw new Error(`header button reads ${cta}`);
  const ctaHref = await page.locator('.navbar-cta').getAttribute('href');
  if (!/calendly\.com/.test(ctaHref || '')) throw new Error(`header button points at ${ctaHref}`);
  const footer = await page.locator('.footer-col-links a').allInnerTexts();
  if (footer.join(',') !== 'Home,Clients,Contact') throw new Error(`footer links are ${footer.join(', ')}`);
  const strays = await page.locator('a[href="/prints"], a[href="/services"]').count();
  if (strays) throw new Error(`${strays} link(s) still point at the shop or Services`);
});

await step('8. The shop is gone: /prints lands on Home', async () => {
  await mockAndGoto(page, '/prints');
  const path = new URL(page.url()).pathname;
  if (path !== '/') throw new Error(`/prints landed on ${path}`);
  return 'redirected to /';
});

await step('9. Contact: three cards, no form and no Calendly embed', async () => {
  await mockAndGoto(page, '/contact');
  const cards = await page.locator('.ct-card').count();
  if (cards !== 3) throw new Error(`found ${cards} cards, expected 3`);
  const call = await page.locator('.ct-card--primary').getAttribute('href');
  if (!/calendly\.com/.test(call || '')) throw new Error(`the primary card points at ${call}`);
  if (await page.locator('form').count()) throw new Error('a form is still on the page');
  if (await page.locator('.calendly-inline-widget').count()) throw new Error('the Calendly embed is still on the page');
  if (!await page.locator('.ct-copy').count()) throw new Error('the email Copy button is missing');
});

/* Site Prompt 7, Part 3: the Showcase editor, end to end. The same fixture
 * client this walk has been publishing through /api/showcase is edited in
 * the admin instead: the save bar appears, Discard puts it back, Save sends
 * one PATCH, and what that PATCH says is then what the public site serves,
 * so the last two checks are the client on /clients and its cover in the
 * hero deck on Home. */
await step('10. Showcase editor: edit, save bar, discard, save, publish, live', async () => {
  state.published = false;
  state.c.featured.work = true;
  const adminLead = {
    _id: 'SITECHECK', business: 'Site Check Co', stage: 'client', callStatus: 'booked', clientStatus: 'active',
    industry: 'Testing', clientSince: '2026-01-01T10:00:00Z', socials: {}, links: {}, reviews: { testimonials: [] },
    showcase: { ...state.c, published: false, cover: '/showcase/fixtures/wide.svg' },
  };
  const patched = [];
  await page.unroute('**/api/showcase**').catch(() => {});
  await mockRoutes(page, {});
  await page.route('**/api/admin/call-leads**', async (r) => {
    if (r.request().method() === 'PATCH') {
      let body = {}; try { body = JSON.parse(r.request().postData() || '{}'); } catch {}
      patched.push(body);
      if (body.set?.showcase) { adminLead.showcase = body.set.showcase; Object.assign(state.c, body.set.showcase); state.published = !!body.set.showcase.published; }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [adminLead] }) });
  });

  await page.goto(`${BASE}/admin/clients/SITECHECK/showcase`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2000);
  const barOpen = () => page.$eval('.sc-savebar', e => e.classList.contains('is-open')).catch(() => null);
  if (await barOpen() !== false) throw new Error('the save bar was already open on a clean load');

  // Edit: turn Publish on. It must not reach the public site yet.
  await page.locator('.sc-publish .v-toggle').first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  if (await barOpen() !== true) throw new Error('the save bar did not appear after an edit');
  if (patched.length) throw new Error('an edit wrote to the server before Save');

  // Discard puts it back.
  await page.locator('.sc-savebar button', { hasText: 'Discard' }).click();
  // The dialog's own button, not the save bar's behind the overlay.
  await page.locator('.v-modal button', { hasText: /^Discard$/ }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  if (await barOpen() !== false) throw new Error('Discard did not clear the unsaved state');

  // Edit again and Save.
  await page.locator('.sc-publish .v-toggle').first().click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.locator('.sc-savebar button', { hasText: 'Save changes' }).click();
  await page.waitForTimeout(1200);
  if (patched.length !== 1) throw new Error(`expected exactly one PATCH, got ${patched.length}`);
  if (!patched[0].set?.showcase?.published) throw new Error('the saved showcase was not published');
  if (!patched[0].set?.reviews) throw new Error('the PATCH did not carry testimonials alongside the showcase');
  if (await barOpen() !== false) throw new Error('the save bar stayed open after a successful save');

  // And now the public site.
  await page.unroute('**/api/admin/call-leads**').catch(() => {});
  await mockAndGoto(page, '/clients');
  if (!await page.locator('.wk-card', { hasText: 'Site Check Co' }).count()) throw new Error('the published client is not on /clients');
  await mockAndGoto(page, '/');
  const inDeck = await page.locator('.hero-card', { hasText: 'Site Check Co' }).count();
  if (!inDeck) throw new Error('the published cover is not in the hero deck');
  return 'one PATCH, then live on /clients and in the hero deck';
});

await browser.close();

const failing = rows.filter(r => !r.ok).length;
console.log(`\nSteps: ${rows.length}. Failures: ${failing}.`);
process.exit(failing ? 1 : 0);
