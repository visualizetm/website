/* The admin screen and state table every walking audit shares (Prompt 15):
 * the feel audit, the a11y audit, and the regression walk read this one list
 * so they cover the same screens the layout audit knows.
 *
 *   id        stable id (AUDIT_ONLY matches on its prefix)
 *   screen    group label for the report tables
 *   label     the state
 *   path      route (relative to the origin)
 *   region    where the checks look (default .sh-content); a function of width for panel or sheet
 *   resource  the mocked endpoint that drives empty and error states
 *   open      record id the forced loading variant deep links to (?open=)
 *   prep      runs on /admin before the state loads (localStorage setup)
 *   act       runs after load (opens a row, a tab, a sheet)
 *   detail    a detail state: empty and error belong to its list
 *   static    no forced loading state
 *   boot      'authed' or 'fresh': the boot frame rows
 *   session   set false for a public marketing page (no admin auth mock needed)
 *   emptyResource  a11y-audit only: mocks this resource's empty payload (see audit-fixtures.mjs EMPTY)
 *   marketing a public marketing page: a11y-audit runs it, feel-audit skips it
 *             (its skeleton/fit/entrance machinery is built around the admin
 *             shell's .sh-content region and .v-skel convention, not this
 *             site's own .wk-skel/.cs-skel; layout-audit covers it separately)
 */
export const SESSION = (mode) => ({ ids: ['L0', 'L1', 'L3', 'L4', 'L6', 'L7'], idx: 0, stats: {}, logged: {}, startedAt: Date.now(), size: 6, mode });
export const setLS = (page, k, v) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [k, v]).catch(() => {});
export const rmLS = (page, k) => page.evaluate((k) => localStorage.removeItem(k), k).catch(() => {});
export const click = (loc, t = 4000) => loc.first().click({ timeout: t }).catch(() => {});
export const tab = (page, name) => click(page.getByRole('tab', { name: new RegExp('^' + name) }), 3000);
export const openRow = async (page, width, text, mobileName) => {
  if (width >= 1024) await click(page.locator('.v-tr', { hasText: text }));
  else await click(page.getByRole('button', { name: mobileName }));
};

/* Every screen and state. `region` is where the checks look; `resource` is the
 * mocked endpoint that drives the empty and error states; `open` is the record
 * the forced loading variant deep links to (a skeleton must show while it resolves). */
export const SCREENS = [
  { id: 'boot', screen: 'Boot and login', label: 'boot, signed in hint', path: '/admin', region: '#root', boot: 'authed', static: true },
  { id: 'boot-fresh', screen: 'Boot and login', label: 'boot, no hint', path: '/admin', region: '#root', boot: 'fresh', static: true },
  { id: 'login', screen: 'Boot and login', label: 'login form', path: '/admin', region: '.aa-loginpage', session: false, static: true, resource: null },

  // The Today card's skeleton draws the last known row count (vz_dash_today, written by every loaded render), so the prep is a
  // previous visit: let the dashboard land its data once before the forced loading state reads the key.
  { id: 'dashboard', screen: 'Dashboard', label: 'dashboard', path: '/admin', resource: 'leads', prep: async (p) => { await rmLS(p, 'vz_call_session'); await p.waitForSelector('.db-today .v-lrow, .db-today .v-empty', { timeout: 4000 }).catch(() => {}); } },

  { id: 'leads-kanban', screen: 'Leads', label: 'list, kanban', path: '/admin/leads', resource: 'leads', minWidth: 1024, prep: (p) => setLS(p, 'vz_leads_view', 'kanban') },
  { id: 'leads-list', screen: 'Leads', label: 'list, cards or table', path: '/admin/leads', resource: 'leads', prep: (p) => setLS(p, 'vz_leads_view', 'list') },
  { id: 'leads-detail', screen: 'Leads', label: 'lead detail', path: '/admin/leads', open: 'L0', region: '.aa-main.ld-main', resource: 'leads', detail: true, prep: (p) => setLS(p, 'vz_leads_view', 'list'), act: (p, w) => click(p.locator(w >= 1024 ? '.v-tr' : '.lc')) },

  { id: 'calls-builder', screen: 'Call Console', label: 'builder', path: '/admin/calls', resource: 'leads', prep: (p) => rmLS(p, 'vz_call_session') },
  { id: 'calls-queue', screen: 'Call Console', label: 'queue', path: '/admin/calls', resource: 'leads', region: '.cc-page', detail: true, prep: (p) => setLS(p, 'vz_call_session', SESSION('queue')) },
  { id: 'calls-room', screen: 'Call Console', label: 'room', path: '/admin/calls', resource: 'leads', region: '.cc-page', detail: true, prep: (p) => setLS(p, 'vz_call_session', SESSION('room')) },
  { id: 'calls-summary', screen: 'Call Console', label: 'summary', path: '/admin/calls', resource: 'leads', region: '.cc-page', detail: true, prep: (p) => setLS(p, 'vz_call_session', SESSION('summary')) },

  { id: 'booked-list', screen: 'Booked', label: 'list', path: '/admin/booked', resource: 'leads' },
  { id: 'booked-detail', screen: 'Booked', label: 'detail', path: '/admin/booked', open: 'L8', region: '.aa-main.bk-main', resource: 'leads', detail: true, act: (p) => click(p.locator('.lc')) },

  { id: 'calendar-day', screen: 'Calendar', label: 'day', path: '/admin/calendar', resource: 'leads', prep: (p) => setLS(p, 'vz_cal_view', 'day') },
  { id: 'calendar-week', screen: 'Calendar', label: 'week', path: '/admin/calendar', resource: 'leads', prep: (p) => setLS(p, 'vz_cal_view', 'week') },
  { id: 'calendar-month', screen: 'Calendar', label: 'month', path: '/admin/calendar', resource: 'leads', prep: (p) => setLS(p, 'vz_cal_view', 'month') },

  { id: 'clients-list', screen: 'Clients', label: 'list', path: '/admin/clients', resource: 'leads' },
  { id: 'clients-detail', screen: 'Clients', label: 'client detail', path: '/admin/clients', open: 'L11', region: '.aa-main.cl-main', resource: 'leads', detail: true, act: (p, w) => openRow(p, w, 'Lead Business 11', 'Open Lead Business 11') },
  /* Site Prompt 7 moved the Showcase editor out of the client record into
   * its own page, so this is a plain route now, not a tab to click. Two
   * rows: the fully populated client, and the one whose uploads are a
   * portrait and a panorama. */
  { id: 'clients-showcase', screen: 'Showcase editor', label: 'published, every section', path: '/admin/clients/L11/showcase', resource: 'leads', noFit: true },
  { id: 'clients-showcase-shapes', screen: 'Showcase editor', label: 'portrait and panoramic uploads', path: '/admin/clients/L14/showcase', resource: 'leads', noFit: true },

  // Site Prompt 3: the public /clients page, driven by /api/showcase. session:
  // false since these are marketing pages, not admin (no auth mock needed).
  { id: 'mkt-clients-list', screen: 'Clients (marketing)', label: 'list', path: '/clients', session: false, static: true, marketing: true },
  { id: 'mkt-clients-full', screen: 'Clients (marketing)', label: 'detail, full showcase', path: '/clients/full-showcase-co', session: false, static: true, marketing: true },
  { id: 'mkt-clients-brand', screen: 'Clients (marketing)', label: 'detail, brand only', path: '/clients/brand-only-co', session: false, static: true, marketing: true },
  // The highlights prompt: the client detail of the fixture that carries six
  // story highlights, linked and unlinked, above its post grid.
  { id: 'mkt-clients-highlights', screen: 'Clients (marketing)', label: 'detail, Instagram highlights', path: '/clients/portrait-co', session: false, static: true, marketing: true },
  { id: 'mkt-clients-empty', screen: 'Clients (marketing)', label: 'empty state', path: '/clients', session: false, static: true, marketing: true, emptyResource: 'showcase' },
  { id: 'mkt-clients-error', screen: 'Clients (marketing)', label: 'error state (unknown slug)', path: '/clients/does-not-exist', session: false, static: true, marketing: true },

  // Site Prompt 4: the landing page, one fetchShowcase() call feeding every
  // client-fed section; the empty state hides those, hero and how-it-works stay.
  { id: 'mkt-home', screen: 'Home (marketing)', label: 'full', path: '/', session: false, static: true, marketing: true },
  { id: 'mkt-home-empty', screen: 'Home (marketing)', label: 'empty landing', path: '/', session: false, static: true, marketing: true, emptyResource: 'showcase' },

  // Site Prompt 5: the rebuilt Services page, static (no CRM data).
  { id: 'mkt-services', screen: 'Services (marketing)', label: 'full', path: '/services', session: false, static: true, marketing: true },
  // Site Prompt 5, Part 2: Contact and Start restyled to match; the
  // shop and checkout flow itself is still covered by layout-audit's own
  // AUDIT_ONLY=settings "shop checkout end to end" walk, not here.
  { id: 'mkt-contact', screen: 'Contact (marketing)', label: 'full', path: '/contact', session: false, static: true, marketing: true },
  { id: 'mkt-start', screen: 'Start (marketing)', label: 'intro', path: '/start', session: false, static: true, marketing: true },
  /* The review prompt: /review, and /review/<slug> for a link sent to one
     client (the slug pre-fills the business and unlocks the Google prompt
     after a four or five star review). Nothing on the site links here; it
     is noindex and out of the sitemap, but it is still a public page and
     gets audited like one. */
  { id: 'mkt-review', screen: 'Review (marketing)', label: 'form, no slug', path: '/review', session: false, static: true, marketing: true },
  { id: 'mkt-review-slug', screen: 'Review (marketing)', label: 'form, client slug', path: '/review/full-showcase-co', session: false, static: true, marketing: true },
  { id: 'mkt-review-unknown', screen: 'Review (marketing)', label: 'unknown slug falls back to the generic form', path: '/review/does-not-exist', session: false, static: true, marketing: true },
  // The maintenance screen (VITE_MAINTENANCE_MODE): a full app override at
  // the React root, not a route, so unlike every other marketing: true
  // entry above it only renders against a build made with that env var
  // set, not the shared dist/ this repo's audits normally share; see
  // reports/MAINTENANCE-PAGE-REPORT.md for how it was verified.
  { id: 'mkt-maintenance', screen: 'Maintenance (marketing)', label: 'full', path: '/', session: false, static: true, marketing: true },

  { id: 'orders-list', screen: 'Print Orders', label: 'list', path: '/admin/orders', resource: 'orders' },
  { id: 'orders-detail', screen: 'Print Orders', label: 'order detail (panel or sheet)', path: '/admin/orders', open: 'O1', region: (w) => (w >= 1024 ? '.po-panel' : '.v-sheet'), resource: 'orders', detail: true, act: (p, w) => openRow(p, w, 'Person 0', /^Open order for Person 0/) },

  { id: 'concepts-grid', screen: 'Concepts', label: 'grid', path: '/admin/concepts', resource: 'packs' },
  { id: 'concepts-detail', screen: 'Concepts', label: 'pack detail (panel or sheet)', path: '/admin/concepts', open: 'K1', region: (w) => (w >= 1024 ? '.po-panel' : '.v-sheet'), resource: 'packs', detail: true, act: (p) => click(p.getByRole('button', { name: /^Open Universal logo directions/ })) },

  { id: 'reviews-list', screen: 'Reviews', label: 'list', path: '/admin/reviews', resource: 'leads' },
  { id: 'reviews-sheet', screen: 'Reviews', label: 'review sheet', path: '/admin/reviews', open: 'L12', region: '.v-sheet', resource: 'leads', detail: true, act: (p) => click(p.getByRole('button', { name: /^Open reviews for Lead Business 12/ })) },

  { id: 'submissions-list', screen: 'Submissions', label: 'list', path: '/admin/submissions', resource: 'submissions' },
  { id: 'submissions-detail', screen: 'Submissions', label: 'submission detail (panel or sheet)', path: '/admin/submissions', open: 'id5', region: (w) => (w >= 1024 ? '.po-panel' : '.v-sheet'), resource: 'submissions', detail: true, act: (p, w) => openRow(p, w, 'Business 5', /^Open submission from Business 5/) },

  ...['Profile', 'Notifications', 'Integrations', 'Data', 'Automation', 'Shortcuts', 'Danger zone'].map(t => ({
    id: `settings-${t.toLowerCase().replace(/ /g, '-')}`, screen: 'Settings', label: `${t} tab`, path: '/admin/settings', resource: 'settings', noEmpty: true,
    act: t === 'Profile' ? undefined : (p) => tab(p, t),
  })),

  { id: 'design', screen: 'Design system', label: 'design page', path: '/admin/design', resource: null, noEmpty: true, noError: true },

  // Site Prompt 2 (Part 3): the Landing screen (logo strip, featured work, testimonials, stats).
  { id: 'landing', screen: 'Landing', label: 'landing screen', path: '/admin/landing', resource: 'leads' },

  { id: 'notifications', screen: 'Shell', label: 'notifications drawer', path: '/admin/leads', region: '.v-sheet', resource: 'leads', emptyAlso: ['settings'], act: (p) => click(p.locator('.sh-bell')) },
  { id: 'more', screen: 'Shell', label: 'More sheet', path: '/admin/leads', region: '.v-sheet', maxWidth: 767, resource: null, static: true, act: (p) => click(p.locator('.sh-tab--more')) },
];
