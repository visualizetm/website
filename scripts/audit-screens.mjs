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

  { id: 'notifications', screen: 'Shell', label: 'notifications drawer', path: '/admin/leads', region: '.v-sheet', resource: 'leads', emptyAlso: ['settings'], act: (p) => click(p.locator('.sh-bell')) },
  { id: 'more', screen: 'Shell', label: 'More sheet', path: '/admin/leads', region: '.v-sheet', maxWidth: 767, resource: null, static: true, act: (p) => click(p.locator('.sh-tab--more')) },
];
