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
 *
 * Step 11 walks the Cloudinary upload flow in the Showcase editor, with
 * Cloudinary itself mocked. The Upload buttons only render when the build
 * carried VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET, so
 * that step reports "skipped" against a build without them:
 *
 *   VITE_CLOUDINARY_CLOUD_NAME=visualize-test \
 *   VITE_CLOUDINARY_UPLOAD_PRESET=visualize npx vite build
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
  googleReview: '',
  testimonials: [],
  socials: {},
});

/** The one client this walk publishes, toggles, and unpublishes. Steps mutate this in place. */
const state = { published: false, c: client(), others: [] };

function payloadFor(slug) {
  const list = state.published ? [state.c] : [];
  if (slug) return list.find(c => c.slug === slug) || null;
  return {
    clients: list,
    landing: {
      logoStrip: list.filter(c => c.featured.logoStrip).map(c => ({ slug: c.slug, displayName: c.displayName, logo: c.brand.logo })),
      work: list.filter(c => c.featured.work).map(c => ({ slug: c.slug, displayName: c.displayName, type: c.type, blurb: c.blurb, cover: c.cover })),
      // Review links: the landing shows featured public cards from every client, the link only when published (api/_lib/reviewPublic.js is the rule).
      testimonials: [state.c, ...state.others].flatMap(c => c.testimonials.filter(t => ((t.status === 'approved' && t.consent === true) || (!t.status && t.published)) && t.featured).map(t => ({ ...t, quote: t.pullQuote || t.quote || t.text, author: t.name || t.author, business: c.displayName, slug: (c === state.c ? state.published : c.published) && c.slug ? c.slug : '', logo: c.brand?.logo || '', brandHex: c.brandHex || '' }))),
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
/* serviceWorkers: 'block', the same as every other audit context: once the
 * app's worker takes control it answers /api/* itself and page.route() no
 * longer sees those requests, which made later admin steps read the SPA
 * fallback HTML instead of a fixture. */
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
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

await step('4a. A featured review from a client without a published showcase shows on Home with their mark and no link; nothing featured hides the section', async () => {
  state.c.testimonials = [];
  state.others = [{ slug: 'quiet-co', displayName: 'Quiet Co', published: false, brand: { logo: '/showcase/fixtures/logo.svg' }, brandHex: '#1d4ed8', testimonials: [{ id: 'q1', name: 'Jo Quiet', role: 'Owner', rating: 5, text: 'Rob made the whole thing easy and the site looks sharp.', pullQuote: 'The site looks sharp.', consent: true, status: 'approved', featured: true }] }];
  await mockAndGoto(page, '/');
  const card = page.locator('.ht .tc-card', { hasText: 'Jo Quiet' });
  if (!(await card.count())) throw new Error('the card is missing on Home');
  if ((await card.locator('.tc-quote').textContent()).indexOf('The site looks sharp.') < 0) throw new Error('the pull quote is not the card line');
  if (!(await card.locator('.tc-mark img').count())) throw new Error('no mark on the card');
  if (await card.locator('a.tc-business').count()) throw new Error('an unpublished client got a link');
  if (!(await card.locator('.tc-business--plain', { hasText: 'Quiet Co' }).count())) throw new Error('the business name is missing');
  const seam = await card.evaluate(el => getComputedStyle(el).borderLeftColor);
  if (seam !== 'rgb(29, 78, 216)') throw new Error(`the seam is ${seam}, not the brand colour`);
  state.others = [];
  await mockAndGoto(page, '/');
  if (await page.locator('.ht').count()) throw new Error('the section rendered with nothing featured');
  return 'card without a link, brand seam, pull quote; section gone when empty';
});

await step('5. Unpublish: disappears from /clients', async () => {
  state.published = false;
  await mockAndGoto(page, '/clients');
  const count = await page.locator('.wk-card', { hasText: 'Site Check Co' }).count();
  if (count !== 0) throw new Error(`found ${count} cards, expected 0`);
});

await step('5a. The review link page: greeted by name with their mark, sends, thanks with my Google link; a dead token is the expired page', async () => {
  const TOKEN = 'rvwSITEtoken0123456789abcde';
  let posted = null;
  await page.route('**/api/review**', (r) => {
    const u = new URL(r.request().url()); const token = u.searchParams.get('token') || '';
    if (token !== TOKEN) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) });
    if (r.request().method() === 'POST') { try { posted = JSON.parse(r.request().postData() || '{}'); } catch { posted = {}; } return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ business: 'Site Check Co', firstName: 'Sam', logoUrl: '/showcase/fixtures/logo.svg', brandHex: '#1d4ed8', googleReviewUrl: 'https://g.page/r/visualize/review' }) });
  });
  await mockAndGoto(page, `/r/${TOKEN}`);
  const title = (await page.locator('.rl-title').textContent()).trim();
  if (title !== 'Hey Sam.') throw new Error(`greeting "${title}"`);
  if (!(await page.locator('.rl-mark img').count())) throw new Error('no client mark');
  const stars = page.locator('.rvw-star'); if (await stars.count() !== 5) throw new Error('not five stars');
  const box = await stars.first().boundingBox(); if (!box || box.width < 48 || box.height < 48) throw new Error(`a star is ${box?.width}x${box?.height}`);
  if ((await page.locator('#rl-role').inputValue()) !== 'Site Check Co' || (await page.locator('#rl-name').inputValue()) !== 'Sam') throw new Error('name and business not prefilled');
  await page.getByRole('radio', { name: '5 stars' }).click(); await page.locator('#rl-text').fill('Rob made the whole thing easy and the site looks sharp.'); await page.locator('.rl-check').check();
  await page.getByRole('button', { name: /^Send it/ }).click(); await page.waitForSelector('.rl-done[data-state="done"]', { timeout: 5000 });
  if (!posted || posted.rating !== 5 || posted.consent !== true || posted.business !== 'Site Check Co' || posted.company !== '') throw new Error(`posted ${JSON.stringify(posted)}`);
  const google = await page.locator('.rl-done a[href="https://g.page/r/visualize/review"]').count(); if (!google) throw new Error('no Leave it on Google too');
  await mockAndGoto(page, '/r/deadTOKENxxxxxxxxxxxxxxxx');
  const dead = (await page.locator('.rl-done[data-state="expired"] .rl-title').textContent().catch(() => '')).trim();
  if (dead !== 'This link expired.') throw new Error(`expired state reads "${dead}"`);
  await page.unroute('**/api/review**').catch(() => {});
  return 'greeted, 48px stars, prefilled, posted with consent, Google offered, expired page';
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
  const barOpen = () => page.$eval('.sb-bar', e => e.classList.contains('is-open')).catch(() => null);
  if (await barOpen() !== false) throw new Error('the save bar was already open on a clean load');

  // Edit: turn Publish on. It must not reach the public site yet.
  await page.locator('.sc-publish .v-toggle').first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  if (await barOpen() !== true) throw new Error('the save bar did not appear after an edit');
  if (patched.length) throw new Error('an edit wrote to the server before Save');

  // Discard puts it back.
  await page.locator('.sb-bar button', { hasText: 'Discard' }).click();
  // The dialog's own button, not the save bar's behind the overlay.
  await page.locator('.v-modal button', { hasText: /^Discard$/ }).first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
  if (await barOpen() !== false) throw new Error('Discard did not clear the unsaved state');

  // Edit again and Save.
  await page.locator('.sc-publish .v-toggle').first().click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.locator('.sb-bar button', { hasText: 'Save changes' }).click();
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
  const inDeck = await page.locator('.hero-cover-name', { hasText: 'Site Check Co' }).count();
  if (!inDeck) throw new Error('the published cover is not in the hero deck');
  return 'one PATCH, then live on /clients and in the hero deck';
});

/* The upload prompt: the Cloudinary flow end to end, with Cloudinary
 * itself mocked. Pick a file, see the button go busy, see the returned
 * secure_url land in the field, see the preview appear, and confirm the
 * request carried the preset and no secret. */
await step('11. Showcase editor: upload an image, see it land in the field', async () => {
  const UPLOADED = 'https://res.cloudinary.com/visualize-test/image/upload/v1712345678/showcase/regression.png';
  let sent = null;
  const adminLead = {
    _id: 'SITECHECK', business: 'Site Check Co', stage: 'client', callStatus: 'booked', clientStatus: 'active',
    industry: 'Testing', socials: {}, links: {}, reviews: { testimonials: [] },
    showcase: { ...client(), published: true, cover: '' },
  };
  await page.unroute('**/api/showcase**').catch(() => {});
  await mockRoutes(page, {});
  // Only this step's handler answers for leads: unroute first so the
  // fixture list registered by mockRoutes cannot win the match.
  await page.unroute('**/api/admin/call-leads**').catch(() => {});
  await page.route('**/api/admin/call-leads**', (r) => (r.request().method() === 'PATCH'
    ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
    : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [adminLead] }) })));
  await page.route('https://api.cloudinary.com/**', async (r) => {
    sent = { url: r.request().url(), body: r.request().postData() || '' };
    await new Promise(res => setTimeout(res, 600));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ secure_url: UPLOADED }) });
  });
  await page.route('https://res.cloudinary.com/**', r => r.fulfill({
    status: 200, contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10"><rect width="16" height="10" fill="#345"/></svg>',
  }));

  await page.goto(`${BASE}/admin/clients/SITECHECK/showcase`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(2200);

  const field = page.locator('.sc-fields .sc-imgfield').first();
  await field.waitFor({ state: 'visible', timeout: 8000 });
  if (!await field.locator('button', { hasText: 'Upload' }).count()) {
    return 'skipped: this build carries no VITE_CLOUDINARY_* config, so no Upload button renders';
  }

  await field.locator('input[type=file]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a', 'hex') });
  await page.waitForTimeout(250);
  const busy = await field.locator('button').first().getAttribute('aria-busy');
  if (busy !== 'true') throw new Error('the Upload button did not enter its loading state');

  await page.waitForTimeout(1400);
  if (!sent) throw new Error('nothing was posted to Cloudinary');
  if (!/\/v1_1\/[^/]+\/image\/upload$/.test(sent.url)) throw new Error(`posted to ${sent.url}`);
  if (!/upload_preset/.test(sent.body)) throw new Error('the request did not carry upload_preset');
  if (/api_key|api_secret|signature/i.test(sent.body)) throw new Error('the request carried a key or secret');

  const link = (await field.locator('.sc-imgfield-edit').innerText()).trim();
  if (link !== UPLOADED) throw new Error(`the field holds "${link.slice(0, 60)}", not the returned secure_url`);
  const preview = await field.locator('.sc-thumb img').getAttribute('src').catch(() => null);
  if (preview !== UPLOADED) throw new Error(`the preview shows "${preview}"`);
  return 'busy state, one POST with the preset and no secret, URL and preview in place';
});

/* The review prompt: /review/<slug>, filled in and submitted against a
 * mocked /api/submissions. The point of the step is the body: the slug and
 * the rating have to reach the endpoint, since that is what lets the admin
 * match the review to the client in one tap. */
await step('12. Review form: fill it, submit, see the thank you', async () => {
  state.published = true;
  state.c.googleReview = 'https://g.page/r/sitecheck/review';
  let body = null;
  await page.unroute('**/api/showcase**').catch(() => {});
  await page.route('**/api/submissions', (r) => {
    try { body = JSON.parse(r.request().postData() || '{}'); } catch { body = null; }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 'SUB1' }) });
  });
  await mockAndGoto(page, '/review/sitecheck-co');

  const lead = (await page.locator('.rvw-lead').innerText()).trim();
  if (!/Site Check Co/.test(lead)) throw new Error(`the slug line reads "${lead}"`);
  const biz = await page.locator('#rvw-business').inputValue();
  if (biz !== 'Site Check Co') throw new Error(`the business field holds "${biz}"`);
  if (!await page.locator('#rvw-business').getAttribute('readonly').then(v => v !== null)) throw new Error('the pre-filled business field is editable');
  if (!/noindex/.test(await page.locator('meta[name=robots]').getAttribute('content') || '')) throw new Error('the page is not noindex');

  await page.fill('#rvw-name', 'Jamie Owner');
  await page.locator('.rvw-star[data-star="5"]').click();
  await page.fill('#rvw-text', 'Fast, clear, and the logo landed on the first try.');
  await page.fill('#rvw-email', 'jamie@sitecheck.example');
  await page.locator('.rvw-btn[type=submit]').click();
  await page.waitForTimeout(900);

  if (!body) throw new Error('nothing was posted to /api/submissions');
  const want = { type: 'review', slug: 'sitecheck-co', rating: 5, name: 'Jamie Owner', business: 'Site Check Co' };
  for (const [k, v] of Object.entries(want)) if (body[k] !== v) throw new Error(`body.${k} was ${JSON.stringify(body[k])}, expected ${JSON.stringify(v)}`);
  if (!body.text) throw new Error('the review text did not reach the endpoint');
  if (body.company !== '') throw new Error('the honeypot was not empty');

  const thanks = (await page.locator('.rvw-title').innerText()).trim();
  // innerText comes back through the heading's own text-transform, so match
  // case insensitively rather than on the styled capitals.
  if (!/thanks/i.test(thanks)) throw new Error(`the thank you never appeared (heading is "${thanks}")`);
  const google = page.locator('.rvw-done a', { hasText: 'Google' });
  if (!await google.count()) throw new Error('a five star review did not offer the Google link');
  if (await google.getAttribute('href') !== state.c.googleReview) throw new Error('the Google button points somewhere else');
  return 'slug line, locked business, five stars and the slug in the body, thank you with the Google prompt';
});

/* The planner prompt: the page a client opens with their token. The month
 * they see, then the two things they can actually do, each checked by what
 * reaches the endpoint and what changes on the page afterwards. */
/* A client tapping a post has to SEE the panel, not merely have it in the
 * document. This step used to assert the caption existed, which stayed true
 * while the whole panel sat a thousand pixels below the fold behind its own
 * backdrop, so it walked straight past that bug. Same rule the layout audit
 * applies: painted, at least 90 percent of its own box inside the viewport,
 * and the thing being drawn at its own centre. */
async function panelOnScreen(page, what) {
  const v = await page.evaluate(() => {
    const el = document.querySelector('.pl-panel');
    if (!el) return { mounted: false };
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    const pct = (r.width * r.height) ? Math.round((w * h) / (r.width * r.height) * 100) : 0;
    const hit = w && h ? document.elementFromPoint(Math.round(Math.max(r.left, 0) + w / 2), Math.round(Math.max(r.top, 0) + h / 2)) : null;
    return { mounted: true, painted: cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0', pct,
      box: `${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)}`,
      viewport: `${innerWidth}x${innerHeight}`,
      onTop: !!hit && (hit === el || el.contains(hit)),
      hit: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).trim().slice(0, 24)}` : 'nothing' };
  });
  if (!v.mounted) throw new Error(`${what}: the detail panel is not mounted at all`);
  if (!v.painted) throw new Error(`${what}: the detail panel is mounted but not painted`);
  if (v.pct < 90) throw new Error(`${what}: only ${v.pct}% of the detail panel is on screen (${v.box}, viewport ${v.viewport})`);
  if (!v.onTop) throw new Error(`${what}: the detail panel is behind ${v.hit} at its own centre`);
}

await step('13. Planner dashboard: Home, approve a post, ask for a change, send an idea', async () => {
  const TOKEN = 'plnrREGRESSIONtoken01234567';
  const MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const bodies = [];
  const rows = [
    { id: 'RG1', kind: 'post', date: `${MONTH}-04`, time: '09:00', platforms: ['instagram'], format: 'portrait', imageUrl: '/showcase/fixtures/square.svg', caption: 'Peach dumplings, back on Friday', hashtags: '#peach', status: 'review', note: 'Happy with this one?', clientNote: '', allowDownload: true, video: null, ad: null },
    { id: 'RG2', kind: 'post', date: `${MONTH}-11`, time: '', platforms: ['tiktok'], format: 'portrait', imageUrl: '', caption: 'Behind the counter', hashtags: '', status: 'review', note: '', clientNote: '', allowDownload: true, video: null, ad: null },
    { id: 'RG3', kind: 'post', date: `${MONTH}-18`, time: '', platforms: ['facebook'], format: 'portrait', imageUrl: '', caption: 'Already up', hashtags: '', status: 'posted', note: '', clientNote: '', allowDownload: true, video: null, ad: null },
  ];
  const ideas = [];
  await page.unroute('**/api/showcase**').catch(() => {});
  await page.route('**/api/planner**', (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('token') !== TOKEN) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) });
    if (r.request().method() === 'POST') {
      const body = JSON.parse(r.request().postData() || '{}');
      bodies.push(body);
      if (body.action === 'suggest') {
        if (!String(body.subject || '').trim()) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"subject"}' });
        const idea = { id: `RGI${ideas.length + 1}`, kind: body.kind, subject: body.subject, goal: body.goal, status: 'new', note: '', createdAt: new Date().toISOString() };
        ideas.unshift(idea);
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, suggestion: idea }) });
      }
      const post = rows.find(x => x.id === body.postId);
      if (!post) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' });
      if (post.status !== 'review') return r.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"stale"}' });
      if (body.action === 'request-change' && !String(body.note || '').trim()) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"note required"}' });
      post.status = body.action === 'approve' ? 'approved' : 'making';
      if (body.action === 'request-change') post.clientNote = body.note;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: post.status }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      client: { displayName: 'Site Check Co', welcome: 'Here is your month.', postsPerMonth: 8 },
      month: u.searchParams.get('month') || MONTH,
      posts: rows, suggestions: ideas,
    }) });
  });

  await page.goto(`${BASE}/planner/${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1600);
  if (!/Site Check Co/i.test(await page.locator('.pl-title').innerText())) throw new Error('the client name is not the heading');
  const needs = await page.locator('.pl-needs-text').innerText();
  if (!/2 things need you/i.test(needs)) throw new Error(`the needs you strip reads "${needs}"`);
  if (!/1 of 8 ready/i.test(await page.locator('.pl-progress-label').innerText())) throw new Error('the progress line is wrong before approving');
  if (await page.locator('.pl-tab').count() !== 4) throw new Error('the four destinations are not there');

  // Posts, the list view: the stable one to click through at any width.
  await page.locator('.pl-tab[data-tab="posts"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pl-view', { hasText: 'List' }).click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(400);
  const rowsSeen = await page.locator('.pl-row').count();
  if (rowsSeen !== 3) throw new Error(`${rowsSeen} rows on Posts, wanted 3`);
  if (!await page.locator('.pl-row .pl-pill--post', { hasText: /^Post$/ }).count()) throw new Error('the rows carry no Post pill');
  await page.locator('.pl-row').filter({ hasText: 'Needs you' }).first().click();
  await page.waitForTimeout(500);
  await panelOnScreen(page, 'approving');
  if (!await page.locator('.pl-caption-body').count()) throw new Error('the caption is not in the detail');
  if (!await page.locator('.pl-caption-body').isVisible()) throw new Error('the caption is in the detail but not visible');
  if (await page.locator('.pl-copy').count() < 2) throw new Error('Copy is not on both the caption and the hashtags');
  if (!await page.locator('.pl-save').count()) throw new Error('Save to photos is not offered on a post with a picture');
  if (await page.locator('.pl-tabbar').count()) throw new Error('the tab bar is still up under the detail');
  await page.locator('.pl-approve').click();
  await page.waitForTimeout(900);
  if (!/Approved/i.test(await page.locator('.pl-toast').innerText().catch(() => ''))) throw new Error('no confirmation after approving');
  if (bodies.at(-1)?.action !== 'approve' || bodies.at(-1)?.postId !== 'RG1') throw new Error(`the approve body was ${JSON.stringify(bodies.at(-1))}`);
  await page.locator('.pl-tab[data-tab="home"]').click();
  await page.waitForTimeout(500);
  if (!/1 thing needs you/i.test(await page.locator('.pl-needs-text').innerText())) throw new Error('the needs you count did not drop');
  if (!/2 of 8 ready/i.test(await page.locator('.pl-progress-label').innerText())) throw new Error('the ready count did not rise');

  // Home's own button opens the one thing left waiting.
  await page.waitForTimeout(2400);
  await page.locator('.pl-needs-btn').click();
  await page.waitForTimeout(500);
  await panelOnScreen(page, 'asking for a change');
  await page.locator('.pl-ask-btn').click();
  await page.waitForTimeout(300);
  if (!await page.locator('#pl-note').isVisible()) throw new Error('the change request box is not visible');
  await page.fill('#pl-note', 'Can we shoot this one outside instead?');
  await page.locator('.pl-panel-foot button', { hasText: /^Send$/ }).click();
  await page.waitForTimeout(1000);
  const sent = bodies.at(-1);
  if (sent?.action !== 'request-change' || sent?.postId !== 'RG2') throw new Error(`the change body was ${JSON.stringify(sent)}`);
  if (sent?.note !== 'Can we shoot this one outside instead?') throw new Error('the note did not reach the endpoint');
  if (!/all caught up/i.test(await page.locator('.pl-needs-text').innerText())) throw new Error('the strip did not settle after the last approval');
  await page.locator('.pl-tab[data-tab="posts"]').click();
  await page.waitForTimeout(500);
  await page.locator('.pl-view', { hasText: 'List' }).click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(300);
  if (!await page.locator('.pl-row').filter({ hasText: /Making/ }).count()) throw new Error('the post did not go back to Making');

  // Ideas: the first time state, then one idea sent and shown.
  await page.locator('.pl-tab[data-tab="ideas"]').click();
  await page.waitForTimeout(500);
  if (!await page.locator('.pl-empty[data-state="empty"]').count()) throw new Error('Ideas has no first time state');
  await page.locator('.pl-suggest').first().click();
  await page.waitForTimeout(500);
  await panelOnScreen(page, 'suggesting');
  await page.locator('.pl-send-idea').click();
  await page.waitForTimeout(300);
  if (!await page.locator('.pl-formerr').count()) throw new Error('an idea with no subject was not refused on the page');
  if (bodies.some(b => b.action === 'suggest')) throw new Error('an empty idea reached the endpoint');
  await page.locator('.pl-kind', { hasText: 'Video' }).click();
  await page.fill('#pl-subject', 'The headlight restoration');
  await page.locator('.pl-chipbtn', { hasText: 'Show my work' }).click();
  await page.locator('.pl-send-idea').click();
  await page.waitForTimeout(900);
  const idea = bodies.at(-1);
  if (idea?.action !== 'suggest' || idea?.kind !== 'video' || idea?.subject !== 'The headlight restoration' || idea?.goal !== 'work') throw new Error(`the idea body was ${JSON.stringify(idea)}`);
  if (!await page.locator('.pl-sent').isVisible()) throw new Error('no confirmation after sending the idea');
  await page.locator('.pl-panel-foot button', { hasText: /^Close$/ }).click();
  await page.waitForTimeout(500);
  if (!await page.locator('.pl-idea').filter({ hasText: 'The headlight restoration' }).count()) throw new Error('the idea is not in the list');
  if (!await page.locator('.pl-idea').filter({ hasText: 'Sent' }).count()) throw new Error('the idea does not say Sent');
  return 'Home with the strip and the progress, the four tabs, a post approved from Posts, a change asked from Home, and an idea refused empty then sent and listed';
});

/* The Concepts rebuild: the presentation a client opens with their token,
 * scrolled through, one direction sent back for changes, another approved,
 * and the two notifications then showing in the admin's drawer. */
await step('14. Concepts: open a set by token, scroll, request changes on one direction, approve another, see both in the admin', async () => {
  const TOKEN = 'cncpREGRESSIONtoken0123456';
  const bodies = [];
  const set = {
    _id: 'SRG1', leadId: 'SITECHECK', title: 'Two ways', round: 1, intro: 'Two directions from the call.', status: 'sent', archived: false,
    directions: [
      { id: 'rA', name: 'Warm', rationale: 'Friendlier.', order: 0, items: [{ id: 'rA1', kind: 'logo', image: '/showcase/fixtures/square.svg', caption: 'Mark', order: 0 }] },
      { id: 'rB', name: 'Clean', rationale: 'Sharper.', order: 1, items: [{ id: 'rB1', kind: 'logo', image: '/showcase/fixtures/wide.svg', caption: 'Wordmark', order: 0 }, { id: 'rB2', kind: 'board', image: '/showcase/fixtures/portrait.svg', caption: 'Board', order: 1 }] },
    ],
    feedback: [], approvedDirectionId: '', approvedAt: '', projectId: '', token: TOKEN, tokenCreatedAt: new Date().toISOString(), sentAt: new Date().toISOString(), lastViewedAt: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  const pub = () => ({ client: { displayName: 'Site Check Co' }, set: { title: set.title, round: set.round, intro: set.intro, status: set.status, approvedDirectionId: set.approvedDirectionId }, directions: set.directions.map(d => ({ id: d.id, name: d.name, rationale: d.rationale, items: d.items.map(i => ({ id: i.id, kind: i.kind, image: i.image, caption: i.caption })) })), feedback: set.feedback.map(f => ({ at: f.at, directionId: f.directionId, action: f.action, name: f.name })) });
  await page.route('**/api/concepts**', (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get('token') !== TOKEN) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) });
    if (r.request().method() === 'POST') {
      const body = JSON.parse(r.request().postData() || '{}'); bodies.push(body);
      const d = set.directions.find(x => x.id === body.directionId);
      if (body.action !== 'note' && !d) return r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' });
      if (set.status === 'approved') return r.fulfill({ status: 409, contentType: 'application/json', body: '{"error":"This set is already decided."}' });
      const at = new Date().toISOString();
      set.feedback.push({ at, directionId: d ? d.id : '', action: body.action, name: body.name || '', note: body.note || '' });
      if (body.action === 'approve') { set.status = 'approved'; set.approvedDirectionId = d.id; set.approvedAt = at; }
      if (body.action === 'change') set.status = 'changes';
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: set.status }) });
    }
    if (set.status === 'sent') { set.status = 'viewed'; set.lastViewedAt = new Date().toISOString(); }
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify(pub()) });
  });

  await page.goto(`${BASE}/concepts/${TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1600);
  if (!/Two ways/i.test(await page.locator('.cp-h1').innerText())) throw new Error('the set title is not the heading');
  if (await page.locator('.cp-dir').count() !== 2) throw new Error('two direction scenes expected');
  // Scroll through every scene, the way a client does, and land on the first decision beat.
  const docH = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < docH; y += 400) { await page.evaluate((t) => window.scrollTo(0, t), y); await page.waitForTimeout(60); }  
  await page.locator('.cp-beat').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('.cp-beat').first().getByRole('button', { name: 'Changes on this one' }).click();
  await page.waitForTimeout(400);
  const note = page.locator('.cp-panel textarea').first();
  if (!await note.isVisible()) throw new Error('the change request box is not visible');
  await note.fill('Warmer still, and drop the outline.');
  await page.locator('.cp-panel').getByRole('button', { name: 'Send to me' }).click();
  await page.waitForTimeout(900);
  const change = bodies.at(-1);
  if (change?.action !== 'change' || change?.directionId !== 'rA' || change?.note !== 'Warmer still, and drop the outline.') throw new Error(`the change body was ${JSON.stringify(change)}`);
  if (!/Sent/i.test(await page.locator('.cp-toast').innerText().catch(() => ''))) throw new Error('no confirmation after the change request');
  await page.waitForTimeout(3000);
  await page.locator('.cp-beat').nth(1).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.locator('.cp-beat').nth(1).getByRole('button', { name: 'This is the one' }).click();
  await page.waitForTimeout(400);
  await page.locator('.cp-panel').getByRole('button', { name: 'Approve this direction' }).click();
  await page.waitForTimeout(900);
  const approve = bodies.at(-1);
  if (approve?.action !== 'approve' || approve?.directionId !== 'rB') throw new Error(`the approve body was ${JSON.stringify(approve)}`);
  if (!await page.locator('.cp-thanks').count()) throw new Error('no approved banner after approving');
  if (await page.locator('.cp-beat .cp-btn').count()) throw new Error('decision buttons still showing after approval');

  // The admin: the two actions as notifications, and the set opens from the drawer.
  await mockRoutes(page, {});
  await page.route('**/api/admin/concept-sets**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [set] }) }));
  await page.route('**/api/admin/call-leads**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [{ _id: 'SITECHECK', business: 'Site Check Co', stage: 'booked', callStatus: 'booked', industry: 'Testing', socials: {}, links: {}, meeting: { date: '', time: '', type: 'call', location: '' } }] }) }));
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(1600);
  await page.locator('.sh-bell').first().click();
  await page.waitForTimeout(600);
  const drawer = await page.locator('[role="dialog"]').innerText();
  if (!/asked for changes on Direction A/i.test(drawer)) throw new Error('the change request is not in the notifications');
  if (!/picked Direction B/i.test(drawer)) throw new Error('the approval is not in the notifications');
  await page.locator('[role="dialog"]').getByText(/picked Direction B/i).first().click();
  await page.waitForTimeout(1200);
  if (!/\/admin\/leads\/SITECHECK\/concepts/.test(page.url())) throw new Error(`the notification opened ${page.url()} instead of the editor`);
  if (!await page.locator('.ce-approved').count()) throw new Error('the editor does not pin the approved direction');
  return 'the set by token, every scene scrolled, a change request on A and an approval on B with their bodies, both in the admin drawer, the drawer opening the editor';
});

/* Concepts review (Review each): the client's walk on a phone-sized page. Nothing answered to start (L12's set, three items and a mood board
 * for reference): Send my answers waits, each answer saves as it is given, the count tells how many are left and jumps to the next, the
 * summary sheet lists every answer, one send, and the page then reads back read-only, also after a reload. */
await step('15. Concepts review: answer each item, save as you go, the progress bar, the summary sheet, send once, read back', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockRoutes(page, { session: false });
  const posts = [];
  page.on('request', (r) => { if (r.method() === 'POST' && /\/api\/concepts/.test(r.url())) { try { posts.push(JSON.parse(r.postData() || '{}')); } catch { /* empty */ } } });
  await page.goto(`${BASE}/concepts/cncpREVIEWtoken0123456789abc`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('.cp-sec', { timeout: 8000 });
  await page.waitForTimeout(500);
  if (await page.locator('.cp-sec').count() !== 4) throw new Error('four sections expected (three to answer, one for reference)');
  if (!/Take a look at each one and let me know what you think\./.test(await page.locator('.cp-hint-p').innerText())) throw new Error('the review intro line is missing');
  if (await page.locator('.cp-sec[data-state="reference"] .cp-rv-btn').count()) throw new Error('a For reference section shows decision buttons');
  if (!/For reference/.test(await page.locator('.cp-sec[data-state="reference"] .cp-chip').innerText())) throw new Error('the reference chip is missing');
  if (await page.getByRole('button', { name: 'Not this one' }).count()) throw new Error('Not this one shows although the set does not allow it');
  const bar = page.locator('.cp-bar');
  if (!/0 of 3 reviewed/.test(await bar.innerText())) throw new Error(`the bar says ${await bar.innerText()}`);
  if (!await page.getByRole('button', { name: 'Send my answers' }).first().isDisabled()) throw new Error('Send my answers is enabled with nothing answered');
  /* Approve the first, the count moves, and a tap on it goes to the next one. */
  await page.locator('.cp-sec').nth(0).getByRole('button', { name: 'Approve' }).click();
  await page.waitForTimeout(500);
  if (posts.at(-1)?.action !== 'decide' || posts.at(-1)?.directionId !== 'rA' || posts.at(-1)?.status !== 'approved') throw new Error(`the first answer body was ${JSON.stringify(posts.at(-1))}`);
  if (!/1 of 3 reviewed/.test(await bar.innerText())) throw new Error('the bar did not count the first answer');
  if (!/Approved/.test(await page.locator('.cp-sec').nth(0).locator('.cp-chip').innerText())) throw new Error('no Approved chip on the first section');
  await page.locator('.cp-bar-count').click();
  await page.waitForTimeout(700);
  const y = await page.locator('#cp-d-rB').evaluate(el => Math.round(el.getBoundingClientRect().top));
  if (y > 200 || y < -20) throw new Error(`the jump landed the second section at ${y}px`);
  if (!await page.locator('#cp-d-rB').evaluate(el => el.classList.contains('is-in'))) throw new Error('the jump target was not revealed');
  /* Needs changes: a note is required, then saved. */
  const second = page.locator('#cp-d-rB');
  await second.getByRole('button', { name: 'Needs changes' }).click();
  const box = second.getByPlaceholder('What would you change?');
  if (!await box.isVisible()) throw new Error('the note box did not open');
  if (!await second.getByRole('button', { name: 'Save', exact: true }).isDisabled()) throw new Error('Save is enabled with no note');
  await box.fill('Make the phone number bigger.');
  await second.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(500);
  if (posts.at(-1)?.status !== 'changes' || posts.at(-1)?.note !== 'Make the phone number bigger.') throw new Error(`the note body was ${JSON.stringify(posts.at(-1))}`);
  /* Send waits for the last one; a changed answer overwrites. */
  if (!await page.getByRole('button', { name: 'Send my answers' }).first().isDisabled()) throw new Error('Send is enabled with one left');
  await page.locator('#cp-d-rC').scrollIntoViewIfNeeded();
  await page.locator('#cp-d-rC').getByRole('button', { name: 'Approve' }).click();
  await page.waitForTimeout(500);
  if (!/3 of 3 reviewed/.test(await bar.innerText())) throw new Error('the bar did not reach 3 of 3');
  await page.locator('#cp-d-rA').scrollIntoViewIfNeeded();
  await page.locator('#cp-d-rA').getByRole('button', { name: 'Needs changes' }).click();
  await page.locator('#cp-d-rA').getByPlaceholder('What would you change?').fill('Warmer.');
  await page.locator('#cp-d-rA').getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForTimeout(500);
  if (!/Needs changes/.test(await page.locator('#cp-d-rA .cp-chip').innerText())) throw new Error('a changed answer did not overwrite the chip');
  /* The bar never covers the last decision button at the bottom of the page. */
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(400);
  const clear = await page.evaluate(() => { const top = document.querySelector('.cp-bar').getBoundingClientRect().top; const b = [...document.querySelectorAll('.cp-rv-btn')].pop().getBoundingClientRect(); return { ok: b.bottom <= top + 1, bottom: Math.round(b.bottom), top: Math.round(top), sy: Math.round(scrollY), h: document.documentElement.scrollHeight }; });
  if (!clear.ok) throw new Error(`the progress bar covers the last decision button ${JSON.stringify(clear)}`);
  /* The summary, then one send. */
  await page.getByRole('button', { name: 'Send my answers' }).first().click();
  const sheet = page.getByRole('dialog', { name: "Here's what you picked" });
  await sheet.waitFor({ timeout: 4000 });
  const sumText = await sheet.innerText();
  if (!/Logo/.test(sumText) || !/Business card/.test(sumText) || !/Homepage/.test(sumText) || !/Make the phone number bigger\./.test(sumText) || !/Warmer\./.test(sumText)) throw new Error(`the summary was ${sumText.slice(0, 200)}`);
  if (/Mood board/.test(sumText)) throw new Error('the summary lists the For reference item');
  /* A row in the summary jumps back to its section, whole. */
  await sheet.getByRole('button', { name: /Change this one: Direction A/ }).click();
  await page.waitForTimeout(800);
  if (await page.getByRole('dialog', { name: "Here's what you picked" }).count()) throw new Error('the summary stayed open after Change this one');
  const jy = await page.locator('#cp-d-rA').evaluate(el => Math.round(el.getBoundingClientRect().top));
  if (jy > 200 || jy < -20) throw new Error(`the summary jump landed the first section at ${jy}px`);
  await page.getByRole('button', { name: 'Send my answers' }).first().click();
  await sheet.waitFor({ timeout: 4000 });
  const before = posts.length;
  await sheet.getByRole('button', { name: 'Send my answers' }).click();
  await page.waitForTimeout(800);
  if (posts.length !== before + 1 || posts.at(-1)?.action !== 'submit') throw new Error(`the send was ${JSON.stringify(posts.slice(before))}`);
  if (!await page.getByText("Got it, thank you. I'll get back to you soon.").isVisible()) throw new Error('no thank you after sending');
  if (await page.locator('.cp-rv-btn').count() || await page.locator('.cp-bar').count()) throw new Error('buttons or the bar are still there after sending');
  /* Reading it back, also after a reload: read only, with their words. */
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.cp-sec', { timeout: 8000 });
  await page.waitForTimeout(400);
  if (!await page.getByText("Got it, thank you. I'll get back to you soon.").isVisible()) throw new Error('the thank you is gone after a reload');
  if (!await page.getByText('Make the phone number bigger.').count()) throw new Error('their note is not read back');
  if (await page.locator('.cp-rv-btn').count()) throw new Error('buttons came back after a reload');
  return 'reference item with no buttons, Not this one hidden, save as you go, count and jump, a note required, a changed answer overwrites, the bar clears the last button, the summary, one send, read only after a reload';
});

/* Concepts review, reduced motion: every section is on the page, fully visible, from the first paint. */
await step('16. Concepts review: reduced motion shows every section at once', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/concepts/cncpPARTLYtoken0123456789abcd`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('.cp-sec', { timeout: 8000 });
  const hidden = await page.evaluate(() => [...document.querySelectorAll('.cp-sec')].filter(el => +getComputedStyle(el).opacity < 0.99 || el.getAttribute('data-reveal') === 'wait').length);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  if (hidden) throw new Error(`${hidden} section(s) hidden under reduced motion`);
  return 'every section visible at first paint under reduced motion';
});

await browser.close();

const failing = rows.filter(r => !r.ok).length;
console.log(`\nSteps: ${rows.length}. Failures: ${failing}.`);
process.exit(failing ? 1 : 0);
