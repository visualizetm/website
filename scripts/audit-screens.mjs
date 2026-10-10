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
/* A tab on a computer, a row button on a phone (Settings is a list of rows there). */
export const tab = async (page, name) => { const t = page.getByRole('tab', { name: new RegExp('^' + name) }); if (await t.count()) return click(t, 3000); return click(page.locator('.sh-content').getByRole('button', { name: new RegExp('^' + name) }), 3000); };
/* The record's sections (UI simplification, part A): a tab on a computer, a row button on a phone. */
/* A phone's record is a first screen (the header, the strip and the stage's own section) with a row per other section; a row opens that section on
   a screen of its own. To reach a section: if its row is not here we are on another section's screen, so go Back to the first screen, then press the row.
   The section the first screen already shows has no row. */
export const phoneSection = async (page, name, t = 3000) => {
  const row = page.locator('.sh-content .rc-row-btn').filter({ hasText: new RegExp('^' + name) }).first();
  if (!(await row.count()) && (await page.locator('.rc-secscreen').count())) { await page.locator('.sh-top-back').first().click({ timeout: t }).catch(() => {}); await page.waitForTimeout(500); }
  if (await row.count()) { await row.click({ timeout: t }).catch(() => {}); await page.waitForTimeout(400); }
};
export const openSection = async (page, width, name) => { if (width >= 768) await tab(page, name); else await phoneSection(page, name); };
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

  // Next up with no folds: six sections always open (Overdue, Today, This week, Later, Meetings, Lists ready) under four tiles;
  // the skeleton draws the sections at fixed counts. The prep clears a stale call session.
  { id: 'analytics', screen: 'Analytics', label: 'the home: greeting, range, KPIs and charts', path: '/admin', resource: 'analytics', prep: (p) => p.waitForSelector('[data-card="kpis"], .v-error', { timeout: 4000 }).catch(() => {}) },
  { id: 'analytics-year', screen: 'Analytics', label: 'the Year range', path: '/admin', resource: 'analytics', prep: (p) => p.waitForSelector('[data-card="kpis"], .v-error', { timeout: 4000 }).catch(() => {}), act: (p) => click(p.getByRole('radio', { name: 'Year' })) },
  { id: 'analytics-empty', screen: 'Analytics', label: 'nothing recorded yet: every chart in its empty state', path: '/admin', resource: 'analytics', emptyResource: 'analytics', prep: (p) => p.waitForSelector('[data-card="kpis"], .v-error', { timeout: 4000 }).catch(() => {}) },
  { id: 'tasks-home', screen: 'Tasks', label: 'the queue', path: '/admin/tasks', resource: 'leads', prep: async (p) => { await rmLS(p, 'vz_call_session'); await p.waitForSelector('.nu-row, .v-empty', { timeout: 4000 }).catch(() => {}); } },
  { id: 'tasks-home-record', screen: 'Tasks', label: 'a tapped record beside the queue', path: '/admin/tasks', resource: 'leads', minWidth: 1024, region: '.db-main', detail: true, prep: (p) => rmLS(p, 'vz_call_session'), act: (p) => click(p.locator('.nu-row .v-stretch').first()) },
  { id: 'tasks-home-snooze', screen: 'Tasks', label: 'the snooze picker', path: '/admin/tasks', resource: 'leads', region: '.v-sheet', detail: true, prep: (p) => rmLS(p, 'vz_call_session'), act: async (p) => { await click(p.locator('.nu-row button[aria-haspopup]').first()); await click(p.getByRole('menuitem', { name: 'Snooze until' })); } },


  /* Back, done once: one back state per section. The third row opens, Back (the top bar, or a phone sheet's Close) returns to the list with the row lit (.nav-restored). */
  ...[['leads', '/admin/leads', { vz_leads_view: 'list' }], ['triage', '/admin/triage', null], ['lists', '/admin/lists', null], ['deals', '/admin/deals', null], ['clients', '/admin/clients', null], ['projects', '/admin/projects', null], ['orders', '/admin/orders', null], ['reviews', '/admin/reviews', null], ['submissions', '/admin/submissions', null], ['dashboard', '/admin', null]].map(([id, path, ls]) => ({
    id: `back-${id}`, screen: 'Back', label: `${id}: the list after Back, the row lit`, path, resource: id === 'orders' ? 'orders' : id === 'submissions' ? 'submissions' : id === 'lists' ? 'lists' : id === 'projects' ? 'projects' : 'leads', detail: true, noFit: true,
    prep: ls ? (p) => Promise.all(Object.entries(ls).map(([k, v]) => setLS(p, k, v))) : undefined,
    act: async (p) => {
      const rows = p.locator('.sh-content [data-row-id]:visible'); const n = await rows.count(); if (!n) return;
      const row = rows.nth(Math.min(2, n - 1)); const s = row.locator('.v-stretch');
      if (await s.count()) await s.first().evaluate(el => el.click()); else await row.click({ timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(700);
      const x = p.locator('[role="dialog"] .v-sheet-x');
      if (await x.count() && await x.first().isVisible().catch(() => false)) await click(x); else await click(p.locator('.sh-top-back'));
      await p.locator('.sh-content .nav-restored').first().waitFor({ state: 'attached', timeout: 4000 }).catch(() => {});
    },
  })),
  { id: 'leads-kanban', screen: 'Leads', label: 'list, kanban', path: '/admin/leads', resource: 'leads', minWidth: 1024, prep: (p) => setLS(p, 'vz_leads_view', 'kanban') },
  { id: 'leads-list', screen: 'Leads', label: 'list, cards or table', path: '/admin/leads', resource: 'leads', prep: (p) => setLS(p, 'vz_leads_view', 'list') },
  { id: 'leads-filters', screen: 'Leads', label: 'the Filters sheet', path: '/admin/leads', resource: 'leads', region: '.v-sheet', detail: true, prep: (p) => setLS(p, 'vz_leads_view', 'list'), act: async (p) => { await click(p.locator('.ld-filters-btn')); await p.waitForSelector('.v-sheet', { timeout: 4000 }).catch(() => {}); } },
  { id: 'leads-detail', screen: 'Leads', label: 'lead detail', path: '/admin/leads', open: 'L0', region: '.aa-main.ld-main', resource: 'leads', detail: true, prep: (p) => setLS(p, 'vz_leads_view', 'list'), act: (p, w) => click(p.locator(w >= 1024 ? '.v-tr' : '.lc')) },

  { id: 'calls-lists', screen: 'Call Console', label: 'the lists to run', path: '/admin/calls', resource: 'lists', prep: (p) => rmLS(p, 'vz_call_session') },
  // calls-builder is noFit: the builder is reached by a click on the lists screen, so the skeleton the audit sees is the lists one.
  { id: 'calls-builder', screen: 'Call Console', label: 'quick session builder', path: '/admin/calls', resource: 'leads', noFit: true, prep: (p) => rmLS(p, 'vz_call_session'), act: async (p) => { await click(p.getByRole('button', { name: 'Quick session' })); await p.mouse.move(0, 0); } }, // the pointer leaves the sticky Start button, so axe reads it at rest and not on hover
  { id: 'calls-queue', screen: 'Call Console', label: 'queue', path: '/admin/calls', resource: 'leads', region: '.cc-page', detail: true, prep: (p) => setLS(p, 'vz_call_session', SESSION('queue')) },
  { id: 'calls-room', screen: 'Call Console', label: 'room', path: '/admin/calls', resource: 'leads', region: '.cc-page', detail: true, prep: (p) => setLS(p, 'vz_call_session', SESSION('room')) },
  { id: 'calls-summary', screen: 'Call Console', label: 'summary', path: '/admin/calls', resource: 'leads', region: '.cc-page', detail: true, prep: (p) => setLS(p, 'vz_call_session', SESSION('summary')) },

  // Triage (CRM revamp, step 4): the stack on a phone, the table on a desktop, the Keep sheet, the Capture sheet.
  { id: 'pipeline', screen: 'Pipeline dashboard', label: 'the funnel and the six cards', path: '/admin/pipeline', resource: 'leads', prep: (p) => p.waitForSelector('.dash-grid, .v-error', { timeout: 4000 }).catch(() => {}) },
  { id: 'pipeline-deny', screen: 'Pipeline dashboard', label: 'Deny from the Triage card opens the decline sheet', path: '/admin/pipeline', resource: 'leads', region: '.v-sheet', detail: true, act: (p) => click(p.locator('.pd-deny').first()) },
  { id: 'overview', screen: 'Clients dashboard', label: 'the stat row and the six cards', path: '/admin/overview', resource: 'leads', prep: (p) => p.waitForSelector('.dash-grid, .v-error', { timeout: 4000 }).catch(() => {}) },
  { id: 'triage-pile', screen: 'Triage', label: 'the pile (stack on a phone, table on a desktop)', path: '/admin/triage', resource: 'leads', region: '.tr-shell' },
  /* Look before you decide: the record opened from the stack or the table, the search and a chip on. */
  { id: 'triage-record', screen: 'Triage', label: 'the record with the decision bar', path: '/admin/triage', open: 'L16', resource: 'leads', region: '.tr-main', detail: true },
  { id: 'triage-search', screen: 'Triage', label: 'a search and a chip on', path: '/admin/triage', resource: 'leads', region: '.tr-shell', detail: true, act: async (p) => { await p.getByLabel('Search triage').fill('Lead'); await click(p.getByRole('button', { name: /^Has phone/ })); } },
  { id: 'triage-keep', screen: 'Triage', label: 'the Keep sheet', path: '/admin/triage', resource: 'leads', region: '.v-sheet', detail: true, act: async (p, w) => { if (w >= 768) { await click(p.getByRole('button', { name: /^Lead Business 16 actions$/ })); await click(p.getByRole('menuitem', { name: 'Keep' })); } else await click(p.getByRole('button', { name: /^Keep Lead Business 16/ })); await p.waitForSelector('.v-sheet', { timeout: 4000 }).catch(() => {}); } },
  { id: 'triage-capture', screen: 'Triage', label: 'Capture a lead', path: '/admin/triage', resource: 'leads', region: '.v-sheet', detail: true, act: async (p) => { await click(p.getByRole('button', { name: 'Quick add' })); await click(p.getByRole('menuitem', { name: 'Capture a lead' })); await p.waitForSelector('.v-sheet', { timeout: 4000 }).catch(() => {}); } },
  // Dial lists (CRM revamp, step 3).
  { id: 'lists-grid', screen: 'Lists', label: 'the open lists', path: '/admin/lists', resource: 'lists' },
  { id: 'lists-detail', screen: 'Lists', label: 'one list, its leads in order', path: '/admin/lists', open: 'LS1', resource: 'lists', region: '.ls-shell', detail: true, act: (p) => click(p.getByRole('button', { name: /^Open Tuesday morning/ })) },
  { id: 'lists-fill', screen: 'Fill from filters', label: 'the chips in one column, the count, the sticky Add', path: '/admin/lists/LS1/fill', resource: 'lists' },
  { id: 'lists-picker', screen: 'Lists', label: 'Add to list from a record', path: '/admin/leads', open: 'L3', region: '.v-sheet', resource: 'lists', detail: true, prep: (p) => setLS(p, 'vz_leads_view', 'list'), act: async (p) => { await p.waitForSelector('.rc-head', { timeout: 8000 }).catch(() => {}); await click(p.getByRole('button', { name: /^(Add to list|Move list)$/ })); await p.waitForSelector('.v-sheet', { timeout: 4000 }).catch(() => {}); } },
  // Deals (CRM revamp, step 5): the board on a desktop, the grouped list on a phone, the record on Checkpoints, the Mark paid modal.
  { id: 'deals-board', screen: 'Deals', label: 'the board', path: '/admin/deals', resource: 'leads', minWidth: 1024 },
  { id: 'deals-list', screen: 'Deals', label: 'the grouped list', path: '/admin/deals', resource: 'leads', maxWidth: 1023 },
  { id: 'deals-detail', screen: 'Deals', label: 'the record on Checkpoints', path: '/admin/deals', open: 'L9', region: '.aa-main.dl-main', resource: 'leads', detail: true, act: (p) => click(p.getByRole('button', { name: /^Open Lead Business 9/ })) },
  { id: 'deals-send', screen: 'Deals', label: 'the send email modal', path: '/admin/deals', open: 'L8', region: '.v-modal', resource: 'leads', detail: true, act: async (p, w) => { await p.waitForSelector('.rc-head', { timeout: 8000 }).catch(() => {}); await openSection(p, w, 'Checkpoints'); await click(p.locator('.dc-send')); await p.waitForSelector('.v-modal', { timeout: 4000 }).catch(() => {}); await p.mouse.move(0, 0); } },
  { id: 'deals-markpaid', screen: 'Deals', label: 'the Mark paid modal', path: '/admin/deals', open: 'L9', region: '.v-modal', resource: 'leads', detail: true, act: async (p, w) => { await p.waitForSelector('.rc-head', { timeout: 8000 }).catch(() => {}); await openSection(p, w, 'Money'); await click(p.locator('.iv-paid')); await p.waitForSelector('.v-modal', { timeout: 4000 }).catch(() => {}); await p.mouse.move(0, 0); } }, // the pointer leaves the confirm button, so axe reads it at rest and not on hover

  // calendar-day is noFit: its Overdue callbacks card shows only when callbacks are overdue, which the skeleton cannot know.
  { id: 'calendar-day', screen: 'Calendar', label: 'day', path: '/admin/calendar', resource: 'leads', noFit: true, prep: (p) => setLS(p, 'vz_cal_view', 'day') },
  { id: 'calendar-week', screen: 'Calendar', label: 'week', path: '/admin/calendar', resource: 'leads', prep: (p) => setLS(p, 'vz_cal_view', 'week') },
  { id: 'calendar-month', screen: 'Calendar', label: 'month', path: '/admin/calendar', resource: 'leads', prep: (p) => setLS(p, 'vz_cal_view', 'month') },

  { id: 'clients-list', screen: 'Clients', label: 'list', path: '/admin/clients', resource: 'leads' },
  { id: 'clients-filters', screen: 'Clients', label: 'the Filters sheet', path: '/admin/clients', resource: 'leads', region: '.v-sheet', detail: true, act: async (p) => { await click(p.locator('.cl-filters-btn')); await p.waitForSelector('.v-sheet', { timeout: 4000 }).catch(() => {}); } },
  { id: 'clients-detail', screen: 'Clients', label: 'client detail (the Project tab, the rows on a phone)', path: '/admin/clients', open: 'L11', region: '.aa-main.cl-main', resource: 'leads', detail: true, act: (p, w) => openRow(p, w, 'Lead Business 11', 'Open Lead Business 11') },
  // UI simplification, part A: the record in lead, deal and client modes at both widths is leads-detail, deals-detail and clients-detail; these are its Money section and the Add a detail sheet.
  { id: 'task-sheet', screen: 'Clients', label: 'the Set task sheet', path: '/admin/clients', open: 'L11', region: '.v-sheet', resource: 'leads', detail: true, act: async (p) => { await p.waitForSelector('.rc-head', { timeout: 8000 }).catch(() => {}); await click(p.getByRole('button', { name: 'More actions' })); await click(p.getByRole('menuitem', { name: /^Set task|^Edit task/ })); } },
  { id: 'clients-pane-rail', screen: 'Clients', label: 'client detail, the list pane collapsed to its rail', path: '/admin/clients', open: 'L11', minWidth: 1024, region: '.sh-content', resource: 'leads', detail: true, noFit: true, act: async (p) => { await p.waitForSelector('.v-pane-toggle', { timeout: 8000 }).catch(() => {}); await click(p.locator('.v-pane-toggle')); await p.waitForTimeout(400); } },
  { id: 'clients-profile', screen: 'Clients', label: 'client detail, the full profile (a panel or a pushed screen)', path: '/admin/clients', open: 'L11&sec=profile', region: (w) => (w < 768 ? '.aa-main.cl-main' : '.v-sheet'), resource: 'leads', detail: true, act: async (p, w) => { if (w < 768) return; /* a phone opens on the Profile screen by its link (sec=profile); a computer opens the panel */ await p.waitForSelector('.rc-pf-open', { timeout: 8000 }).catch(() => {}); await click(p.locator('.rc-pf-open')); await p.waitForTimeout(500); } },
  { id: 'clients-profile-add', screen: 'Clients', label: 'client detail, Add a detail from the profile', path: '/admin/clients', open: 'L11', region: '.v-sheet', resource: 'leads', detail: true, act: async (p) => { await p.waitForSelector('.rc-pf-open', { timeout: 8000 }).catch(() => {}); await click(p.locator('.rc-pf-open')); await p.waitForTimeout(500); await click(p.locator('.rc-add-detail')); await p.waitForTimeout(400); } },
  { id: 'clients-money', screen: 'Clients', label: 'client detail, Money', path: '/admin/clients', open: 'L11', region: '.aa-main.cl-main', resource: 'leads', detail: true, noFit: true, act: async (p, w) => { await p.waitForSelector('.rc-head', { timeout: 8000 }).catch(() => {}); await openSection(p, w, 'Money'); } },
  { id: 'record-add-detail', screen: 'Leads', label: 'the Add a detail sheet', path: '/admin/leads', open: 'L3', region: '.v-sheet', resource: 'leads', detail: true, prep: (p) => setLS(p, 'vz_leads_view', 'list'), act: async (p, w) => { await p.waitForSelector('.rc-head', { timeout: 8000 }).catch(() => {}); if (w < 768) await openSection(p, w, 'Details'); await click(p.locator('.rc-add-detail')); await p.waitForSelector('.v-sheet', { timeout: 4000 }).catch(() => {}); } },
  /* Site Prompt 7 moved the Showcase editor out of the client record into
   * its own page, so this is a plain route now, not a tab to click. Two
   * rows: the fully populated client, and the one whose uploads are a
   * portrait and a panorama. */
  // Projects (CRM revamp, step 7): the table on a desktop, the cards on a phone, archived shown.
  { id: 'projects-list', screen: 'Projects', label: 'every project with its next action and invoice', path: '/admin/projects', resource: 'projects' },
  { id: 'projects-archived', screen: 'Projects', label: 'archived shown', path: '/admin/projects', resource: 'projects', detail: true, act: (p) => click(p.getByRole('button', { name: /^Show archived/ })) },
  // Nothing computer only: the new project page at every width, then the four editors, one column under 768.
  { id: 'project-new', screen: 'New project', label: 'a package for a client', path: '/admin/clients/L11/projects/new', resource: 'leads' },
  { id: 'project-new-retainer', screen: 'New project', label: 'a retainer plan and the bill day', path: '/admin/clients/L11/projects/new?mode=retainer', resource: 'leads', detail: true },
  { id: 'project-new-pick', screen: 'New project', label: 'which client first', path: '/admin/projects/new', resource: 'leads', region: '.v-sheet', detail: true },
  { id: 'clients-showcase', screen: 'Showcase editor', label: 'published, every section', path: '/admin/clients/L11/showcase', resource: 'leads', noFit: true },
  { id: 'clients-showcase-shapes', screen: 'Showcase editor', label: 'portrait and panoramic uploads', path: '/admin/clients/L14/showcase', resource: 'leads', noFit: true },

  /* The Content Planner editor (planner prompt 2). L11 has a planner on with
     a full month including a post in review carrying a client note; L13 has
     one switched off. The Sheet, the save bar and the regenerate dialog are
     driven by the layout audit's own walk, which can press things. */
  // The planner states are noFit: the layout depends on the client's planner setting and the month's posts, unknown until the lead loads.
  { id: 'planner-on', screen: 'Planner editor', noFit: true, label: 'enabled, a full month', path: '/admin/clients/L11/planner', resource: 'leads' },
  { id: 'planner-off', screen: 'Planner editor', noFit: true, label: 'disabled', path: '/admin/clients/L13/planner', resource: 'leads' },
  { id: 'planner-empty', screen: 'Planner editor', noFit: true, label: 'a month with no posts', path: '/admin/clients/L11/planner?month=2030-07', resource: 'leads' },
  { id: 'planner-sheet', screen: 'Planner editor', label: 'post editor sheet', path: '/admin/clients/L11/planner', region: '.v-sheet', resource: 'leads', detail: true, act: (p) => click(p.locator('.pl-post .v-stretch').first()) },
  /* The format control and the platform chips, on a post that is a story
     (no hashtag field) and on one that is blocked from approval. */
  /* Tasks (the task system, milestone 5): a focused screen; a checklist is a step on a phone; Quick add and the template picker are sheets. */
  // noFit: the overview is one row per checklist the client and their projects carry, so the loaded row count depends on the data (the same exemption as the planner editor); the skeleton draws the search, the total, three rows and the add bar.
  { id: 'clients-tasks', screen: 'Tasks', label: 'a client with checklists', path: '/admin/clients/L11/tasks', resource: 'leads', noFit: true },
  { id: 'clients-tasks-empty', screen: 'Tasks', label: 'a client with none yet', path: '/admin/clients/L13/tasks', resource: 'leads', noFit: true },
  { id: 'clients-tasks-list', screen: 'Tasks', label: 'one checklist (a step on a phone)', path: '/admin/clients/L11/tasks', resource: 'leads', noFit: true, act: async (p, w) => { if (w < 768) { await click(p.locator('.tk-body .v-stretch').first()); await p.waitForTimeout(500); } } },
  { id: 'clients-tasks-quick', screen: 'Tasks', label: 'the Quick add sheet', path: '/admin/clients/L11/tasks', resource: 'leads', region: '.v-sheet', detail: true, act: (p, w) => click(p.locator(w < 768 ? '.tk-add' : '.tk-add-top').first()) },
  { id: 'clients-tasks-template', screen: 'Tasks', label: 'the template picker', path: '/admin/clients/L11/tasks', resource: 'leads', region: '.v-sheet', detail: true, act: (p) => click(p.locator('.tk-template').first()) },
  { id: 'planner-sheet-ad', screen: 'Planner editor', label: 'post editor sheet, an ad', path: '/admin/clients/L11/planner', region: '.v-sheet', resource: 'leads', detail: true, act: (p) => click(p.locator('.pl-post').filter({ hasText: 'October interior offer' }).first().locator('.v-stretch')) },
  { id: 'planner-sheet-video', screen: 'Planner editor', label: 'post editor sheet, a planned video ad', path: '/admin/clients/L11/planner', region: '.v-sheet', resource: 'leads', detail: true, act: (p) => click(p.locator('.pl-post').filter({ hasText: 'Ceramic coat reel' }).first().locator('.v-stretch')) },
  { id: 'planner-ideas', screen: 'Planner editor', noFit: true, label: 'the ideas inbox', path: '/admin/clients/L11/planner?ideas=1', resource: 'leads', region: (w) => (w < 768 ? '.sh-content' : '.pl-ideas') },
  { id: 'planner-ideas-decline', screen: 'Planner editor', noFit: true, label: 'declining an idea', path: '/admin/clients/L11/planner?ideas=1', resource: 'leads', region: (w) => (w < 768 ? '.sh-content' : '.pl-ideas'), act: (p) => click(p.locator('.pl-idea-actions .v-btn--ghost, .pl-idea-actions button').filter({ hasText: /^Decline$/ })) },
  { id: 'planner-sheet-story', screen: 'Planner editor', label: 'post editor sheet, a story', path: '/admin/clients/L11/planner', region: '.v-sheet', resource: 'leads', detail: true, act: (p) => click(p.locator('.pl-post').filter({ hasText: 'Story' }).first().locator('.v-stretch')) },
  { id: 'planner-sheet-blocked', screen: 'Planner editor', label: 'post editor sheet, approval blocked', path: '/admin/clients/L11/planner', region: '.v-sheet', resource: 'leads', detail: true, act: (p) => click(p.locator('.pl-post').filter({ hasText: 'Waiting on the photo' }).first().locator('.v-stretch')) },

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

  /* The client facing Content Planner (planner prompt 3). The token in these
     paths is the audit fixture's, answered by the mocked /api/planner. */
  /* The client's planner dashboard (milestone 3): the four destinations, the
     two details (a post, an image ad and a planned video ad) and the Suggest
     sheet. The tab lives in the URL, so each destination is its own path. */
  { id: 'mkt-planner-home', screen: 'Planner (marketing)', label: 'Home', path: '/planner/plnrTESTtoken0123456789abcdEF', session: false, static: true, marketing: true },
  { id: 'mkt-planner-posts', screen: 'Planner (marketing)', label: 'Posts, the list', path: '/planner/plnrTESTtoken0123456789abcdEF?tab=posts', session: false, static: true, marketing: true,
    act: async (p) => { await click(p.locator('.pl-view').filter({ hasText: 'List' }), 1500); await p.waitForTimeout(300); } },
  { id: 'mkt-planner-cal', screen: 'Planner (marketing)', label: 'Posts, the calendar', path: '/planner/plnrTESTtoken0123456789abcdEF?tab=posts', session: false, static: true, marketing: true,
    act: async (p) => { await click(p.locator('.pl-view').filter({ hasText: 'Calendar' }), 1500); await p.waitForTimeout(300); } },
  { id: 'mkt-planner-ads', screen: 'Planner (marketing)', label: 'Ads', path: '/planner/plnrTESTtoken0123456789abcdEF?tab=ads', session: false, static: true, marketing: true },
  { id: 'mkt-planner-ideas', screen: 'Planner (marketing)', label: 'Ideas', path: '/planner/plnrTESTtoken0123456789abcdEF?tab=ideas', session: false, static: true, marketing: true },
  { id: 'mkt-planner-post', screen: 'Planner (marketing)', label: 'a post, needs you', path: '/planner/plnrTESTtoken0123456789abcdEF?tab=posts', session: false, static: true, marketing: true, detail: true, region: '.pl-panel',
    act: async (p) => { await click(p.locator('.pl-view').filter({ hasText: 'List' }), 1500); await p.waitForTimeout(300); await click(p.locator('.pl-row').filter({ hasText: 'Needs you' })); await p.waitForTimeout(500); } },
  { id: 'mkt-planner-ad-image', screen: 'Planner (marketing)', label: 'an image ad, live, with results', path: '/planner/plnrTESTtoken0123456789abcdEF?tab=ads', session: false, static: true, marketing: true, detail: true, region: '.pl-panel',
    act: async (p) => { await click(p.locator('.pl-row').filter({ hasText: 'October interior offer' })); await p.waitForTimeout(500); } },
  { id: 'mkt-planner-ad-video', screen: 'Planner (marketing)', label: 'a planned video ad, needs you', path: '/planner/plnrTESTtoken0123456789abcdEF?tab=ads', session: false, static: true, marketing: true, detail: true, region: '.pl-panel',
    act: async (p) => { await click(p.locator('.pl-row').filter({ hasText: 'Ceramic coat reel' })); await p.waitForTimeout(500); } },
  { id: 'mkt-planner-suggest', screen: 'Planner (marketing)', label: 'the Suggest sheet', path: '/planner/plnrTESTtoken0123456789abcdEF?tab=ideas', session: false, static: true, marketing: true, detail: true, region: '.pl-panel',
    act: async (p) => { await click(p.locator('.pl-suggest')); await p.waitForTimeout(500); } },
  { id: 'mkt-planner-dead', screen: 'Planner (marketing)', label: 'a link that is not active', path: '/planner/notarealtokenatall000000000', session: false, static: true, marketing: true },
  // Concepts (Concepts rebuild, Part 7): the client presentation and its states.
  { id: 'mkt-concepts', screen: 'Concepts (marketing)', label: 'the presentation, three directions', path: '/concepts/cncpTESTtoken0123456789abcdEF', session: false, static: true, marketing: true, noFit: true },
  { id: 'mkt-concepts-present', screen: 'Concepts (marketing)', label: 'present mode, no controls', path: '/concepts/cncpTESTtoken0123456789abcdEF?present=1', session: false, static: true, marketing: true, noFit: true },
  { id: 'mkt-concepts-approved', screen: 'Concepts (marketing)', label: 'a decided set, the banner and the dimmed others', path: '/concepts/cncpAPPROVEDtoken0123456789a', session: false, static: true, marketing: true, noFit: true },
  { id: 'mkt-concepts-dead', screen: 'Concepts (marketing)', label: 'a link that is not active', path: '/concepts/notarealtokenatall000000000', session: false, static: true, marketing: true },
  { id: 'mkt-concepts-viewer', screen: 'Concepts (marketing)', label: 'the full screen viewer', path: '/concepts/cncpTESTtoken0123456789abcdEF', session: false, static: true, marketing: true, detail: true, region: '.cp-viewer', act: (p) => click(p.locator('.cp-card-pic').first()) },
  { id: 'mkt-concepts-approve', screen: 'Concepts (marketing)', label: 'the approve confirm panel', path: '/concepts/cncpTESTtoken0123456789abcdEF', session: false, static: true, marketing: true, detail: true, region: '.cp-panel', act: (p) => click(p.locator('.cp-card .cp-btn').first()) },
  { id: 'mkt-concepts-changes', screen: 'Concepts (marketing)', label: 'the change request form', path: '/concepts/cncpTESTtoken0123456789abcdEF', session: false, static: true, marketing: true, detail: true, region: '.cp-panel', act: (p) => click(p.locator('.cp-beat .cp-btn--ghost').first()) },
  // Review each (Concepts review job): nothing answered, partly answered, all answered, the summary sheet, the submitted state. Pick one is mkt-concepts above.
  { id: 'mkt-concepts-review-open', screen: 'Concepts (marketing)', label: 'Review each, nothing answered', path: '/concepts/cncpREVIEWtoken0123456789abc', session: false, static: true, marketing: true },
  { id: 'mkt-concepts-review-partly', screen: 'Concepts (marketing)', label: 'Review each, partly answered', path: '/concepts/cncpPARTLYtoken0123456789abcd', session: false, static: true, marketing: true },
  { id: 'mkt-concepts-review-all', screen: 'Concepts (marketing)', label: 'Review each, all answered, ready to send', path: '/concepts/cncpALLINtoken01234567890abcde', session: false, static: true, marketing: true },
  { id: 'mkt-concepts-review-note', screen: 'Concepts (marketing)', label: 'Review each, the Needs changes note open', path: '/concepts/cncpREVIEWtoken0123456789abc', session: false, static: true, marketing: true, act: async (p) => { await click(p.locator('.cp-sec').nth(1).getByRole('button', { name: 'Needs changes' })); await p.waitForTimeout(300); } },
  { id: 'mkt-concepts-review-summary', screen: 'Concepts (marketing)', label: 'Review each, the summary sheet', path: '/concepts/cncpALLINtoken01234567890abcde', session: false, static: true, marketing: true, detail: true, region: '[role="dialog"]', act: (p) => click(p.getByRole('button', { name: 'Send my answers' }).first()) },
  { id: 'mkt-concepts-review-submitted', screen: 'Concepts (marketing)', label: 'Review each, sent, read only', path: '/concepts/cncpSUBMITTEDtoken0123456789ab', session: false, static: true, marketing: true },
  /* The expanded image: a dialog, so it gets its own axe row. */
  { id: 'mkt-planner-zoom', screen: 'Planner (marketing)', label: 'the whole picture, expanded', path: '/planner/plnrTESTtoken0123456789abcdEF?tab=posts', session: false, static: true, marketing: true, detail: true,
    act: async (p) => { await click(p.locator('.pl-view').filter({ hasText: 'List' }), 1500); await p.waitForTimeout(300); await click(p.locator('.pl-row').first()); await p.waitForTimeout(500); await click(p.locator('button.pl-img--whole').first()); } },
  // The maintenance screen (VITE_MAINTENANCE_MODE): a full app override at
  // the React root, not a route, so unlike every other marketing: true
  // entry above it only renders against a build made with that env var
  // set, not the shared dist/ this repo's audits normally share; see
  // reports/MAINTENANCE-PAGE-REPORT.md for how it was verified.
  { id: 'mkt-maintenance', screen: 'Maintenance (marketing)', label: 'full', path: '/', session: false, static: true, marketing: true },

  // orders-list is noFit: the shop-order import banner appears only when submissions are unimported, which the skeleton cannot know.
  { id: 'orders-list', screen: 'Print Orders', label: 'list', noFit: true, path: '/admin/orders', resource: 'orders' },
  { id: 'orders-detail', screen: 'Print Orders', label: 'order detail (panel or sheet)', path: '/admin/orders', open: 'O1', region: (w) => (w >= 1024 ? '.po-panel' : '.v-sheet'), resource: 'orders', detail: true, act: (p, w) => openRow(p, w, 'Person 0', /^Open order for Person 0/) },

  { id: 'concepts-list', screen: 'Concepts', label: 'list, every status', path: '/admin/concepts', resource: 'sets' },
  { id: 'leads-declined', screen: 'Leads', label: 'the Declined pool', path: '/admin/leads', resource: 'leads', act: (p) => click(p.getByRole('radio', { name: 'Declined' })) },
  { id: 'leads-nurture', screen: 'Leads', label: 'the Nurture pool', path: '/admin/leads', resource: 'leads', act: (p) => click(p.getByRole('radio', { name: 'Nurture' })) },
  { id: 'leads-decline-sheet', screen: 'Leads', label: 'the Decline sheet', path: '/admin/leads', open: 'L3', region: '.v-sheet', resource: 'leads', detail: true, prep: (p) => setLS(p, 'vz_leads_view', 'list'), act: async (p) => { await p.waitForSelector('.rc-head', { timeout: 8000 }).catch(() => {}); await click(p.getByRole('button', { name: 'More actions' })); await click(p.getByRole('menuitem', { name: 'Decline' })); await p.waitForSelector('.v-sheet', { timeout: 4000 }).catch(() => {}); } },
  { id: 'concepts-list-filter', screen: 'Concepts', label: 'list filtered to a status with nothing in it', path: '/admin/concepts', resource: 'sets', act: (p) => click(p.getByRole('button', { name: /^Sent/ })) },
  { id: 'concepts-editor', screen: 'Concepts editor', label: 'a viewed set, three directions, one change note', path: '/admin/leads/L8/concepts', resource: 'sets', noFit: true },
  { id: 'concepts-editor-draft', screen: 'Concepts editor', label: 'a draft with a linked project', path: '/admin/leads/L11/concepts', resource: 'sets', noFit: true },
  { id: 'concepts-editor-changes', screen: 'Concepts editor', label: 'changes requested, a note without a direction', path: '/admin/leads/L0/concepts', resource: 'sets', noFit: true },
  { id: 'concepts-editor-approved', screen: 'Concepts editor', label: 'approved round two, archived round one', path: '/admin/leads/L3/concepts', resource: 'sets', noFit: true },
  // Review each: the editor with nothing answered (Setup), the sent set's answers and Log as a round, and that round's modal. noFit like the other editor states: the loaded editor is far taller than its three card skeleton.
  { id: 'concepts-editor-review-setup', screen: 'Concepts editor', label: 'Review each, the approval mode and which items need a decision', path: '/admin/leads/L12/concepts', resource: 'sets', noFit: true, act: async (p, w) => { if (w < 768) { await click(p.locator('.sh-content').getByRole('button', { name: /^Setup/ }), 3000); await p.waitForTimeout(500); } } },
  { id: 'concepts-editor-review-sent', screen: 'Concepts editor', label: 'Review each, sent: the answers and Log as a round', path: '/admin/leads/L10/concepts', resource: 'sets', noFit: true, act: async (p, w) => { if (w < 768) { await click(p.locator('.sh-content').getByRole('button', { name: /^Feedback/ }), 3000); await p.waitForTimeout(500); } } },
  { id: 'concepts-editor-review-round', screen: 'Concepts editor', label: 'Review each, Log as a round with the change notes filled in', path: '/admin/leads/L10/concepts', resource: 'sets', region: '[role="dialog"]', detail: true, act: async (p, w) => { if (w < 768) { await click(p.locator('.sh-content').getByRole('button', { name: /^Feedback/ }), 3000); await p.waitForTimeout(500); } await click(p.locator('.ce-log-round')); await p.waitForTimeout(400); } },
  { id: 'concepts-editor-none', screen: 'Concepts editor', noFit: true, label: 'a lead with no set yet', path: '/admin/leads/L5/concepts', resource: 'sets' },
  { id: 'concepts-editor-dirty', screen: 'Concepts editor', label: 'unsaved change, the save bar', path: '/admin/leads/L8/concepts', resource: 'sets', noFit: true, act: async (p, w) => { /* a phone edits the title in the Setup step, then Done returns to the overview where the save bar is */ if (w < 768) { await click(p.locator('.sh-content').getByRole('button', { name: /^Setup/ }), 3000); await p.waitForTimeout(500); } const t = p.getByLabel('Title'); await t.fill('Edited title'); await t.blur(); if (w < 768) { await click(p.getByRole('button', { name: 'Done' }), 3000); await p.waitForTimeout(500); } } },
  { id: 'concepts-editor-menu', screen: 'Concepts editor', label: 'direction actions menu', path: '/admin/leads/L8/concepts', resource: 'sets', noFit: true, act: async (p, w) => { if (w < 768) { await click(p.locator('.sh-content').getByRole('button', { name: /^Direction A/ }), 3000); await p.waitForTimeout(500); } await click(p.getByRole('button', { name: 'Direction A actions' })); } },

  { id: 'reviews-list', screen: 'Reviews', label: 'list', path: '/admin/reviews', resource: 'leads' },
  { id: 'reviews-sheet', screen: 'Reviews', label: 'review sheet', path: '/admin/reviews', open: 'L12', region: '.v-sheet', resource: 'leads', detail: true, act: (p) => click(p.getByRole('button', { name: /^Open reviews for Lead Business 12/ })) },
  { id: 'reviews-generate', screen: 'Reviews', label: 'review sheet, no Visualize link yet (Generate)', path: '/admin/reviews', open: 'L11', region: '.v-sheet', resource: 'leads', detail: true, act: (p) => click(p.getByRole('button', { name: /^Open reviews for Lead Business 11/ })) },

  { id: 'submissions-list', screen: 'Submissions', label: 'list', path: '/admin/submissions', resource: 'submissions' },
  { id: 'submissions-detail', screen: 'Submissions', label: 'submission detail (panel or sheet)', path: '/admin/submissions', open: 'id5', region: (w) => (w >= 1024 ? '.po-panel' : '.v-sheet'), resource: 'submissions', detail: true, act: (p, w) => openRow(p, w, 'Business 5', /^Open submission from Business 5/) },

  ...['Profile', 'Notifications', 'Integrations', 'Doc templates', 'Data', 'Danger zone'].map(t => ({
    id: `settings-${t.toLowerCase().replace(/ /g, '-')}`, screen: 'Settings', label: `${t} tab`, path: '/admin/settings', resource: 'settings', noEmpty: true,
    act: t === 'Profile' ? undefined : (p) => tab(p, t),
  })),

  /* Client docs (docs job). The Docs card is part of clients-detail (filled); its empty state shares that skeleton, so it is static (the fit is measured on the filled one).
     The editor's states: a doc with nothing in it, one with every block type, the formatting bar over a fake keyboard (visualViewport shrunk, a phone only), a save that
     fails (the PATCH refused: the text stays, the header says Not saved, retrying), and the two sheets. the empty state of a doc is the doc not being there (the mock answers 404 when the resource is emptied). */
  { id: 'clients-docs-empty', screen: 'Clients', label: 'client detail, the Docs card empty', path: '/admin/clients', open: 'L13', region: '.aa-main.cl-main', resource: 'leads', detail: true, static: true, act: (p, w) => openRow(p, w, 'Lead Business 13', 'Open Lead Business 13') },
  { id: 'docs-newdoc', screen: 'Docs', label: 'the New doc template sheet', path: '/admin/clients', open: 'L11', region: '.v-sheet', resource: 'leads', detail: true, act: async (p, w) => { await openRow(p, w, 'Lead Business 11', 'Open Lead Business 11'); await p.waitForSelector('.rc-docs-new', { timeout: 8000 }).catch(() => {}); await click(p.locator('.rc-docs-new')); await p.waitForSelector('.nd-opt', { timeout: 4000 }).catch(() => {}); await p.mouse.move(0, 0); } },
  { id: 'docs-client', screen: 'Docs', label: "one client's docs, grouped by type", path: '/admin/clients/L11/docs', resource: 'docs' },
  { id: 'docs-all', screen: 'Docs', label: 'every client, with the filters', path: '/admin/docs', resource: 'docs' },
  { id: 'doc-empty', screen: 'Doc editor', label: 'a doc with nothing in it', path: '/admin/docs/DOCE', resource: 'docs' },
  { id: 'doc-blocks', screen: 'Doc editor', label: 'every block type', path: '/admin/docs/DOC1', resource: 'docs' },
  { id: 'doc-keyboard', screen: 'Doc editor', label: 'the formatting bar over the keyboard', path: '/admin/docs/DOC1', maxWidth: 767, resource: 'docs', static: true, act: async (p) => { await p.waitForSelector('.dc-blocks', { timeout: 8000 }).catch(() => {}); await click(p.locator('.dc-row[data-block-id="b9"] .dc-rt')); await p.evaluate(() => { const vv = window.visualViewport; Object.defineProperty(vv, 'height', { configurable: true, get: () => 470 }); vv.dispatchEvent(new Event('resize')); }); await p.waitForTimeout(400); } },
  { id: 'doc-save-failed', screen: 'Doc editor', label: 'a save that fails: Not saved, retrying', path: '/admin/docs/DOC1', resource: 'docs', static: true, act: async (p) => { await p.waitForSelector('.dc-blocks', { timeout: 8000 }).catch(() => {}); await p.route('**/api/admin/docs**', r => (r.request().method() === 'PATCH' ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"audit: refused"}' }) : r.fallback())); await click(p.locator('.dc-row[data-block-id="b9"] .dc-rt')); await p.keyboard.press('End'); await p.keyboard.type(' x'); await p.waitForSelector('[data-save="failed"]', { timeout: 5000 }).catch(() => {}); } },
  { id: 'doc-insert', screen: 'Doc editor', label: 'the Add a block sheet', path: '/admin/docs/DOC1', region: '.v-sheet', resource: 'docs', detail: true, act: async (p, w) => { await p.waitForSelector('.dc-blocks', { timeout: 8000 }).catch(() => {}); if (w < 768) await click(p.locator('.dc-row[data-block-id="b9"] .dc-rt')); await click(p.locator('.dc-fb[data-fmt="insert"]')); await p.waitForSelector('.dc-opt', { timeout: 4000 }).catch(() => {}); await p.mouse.move(0, 0); } },
  { id: 'doc-blocksheet', screen: 'Doc editor', label: 'the block menu', path: '/admin/docs/DOC1', region: '.v-sheet', resource: 'docs', detail: true, act: async (p) => { await p.waitForSelector('.dc-blocks', { timeout: 8000 }).catch(() => {}); await click(p.locator('.dc-row[data-block-id="b4"] .dc-grip')); await p.waitForSelector('.dc-turn', { timeout: 4000 }).catch(() => {}); await p.mouse.move(0, 0); } },
  { id: 'doc-refsheet', screen: 'Doc editor', label: 'the Reference sheet', path: '/admin/docs/DOC1', region: '.v-sheet', resource: 'docs', detail: true, act: async (p, w) => { await p.waitForSelector('.dc-blocks', { timeout: 8000 }).catch(() => {}); if (w < 768) await click(p.locator('.dc-row[data-block-id="b9"] .dc-rt')); await click(p.locator('.dc-fb[data-fmt="insert"]')); await click(p.locator('.dc-opt[data-opt="ref"]')); await p.waitForSelector('.dc-refopt', { timeout: 4000 }).catch(() => {}); await p.mouse.move(0, 0); } },

  // design is noFit: a developer reference page whose loaded state is the whole kit, a thousand pixels past any skeleton.
  { id: 'design', screen: 'Design system', label: 'design page', path: '/admin/design', resource: null, noFit: true, noEmpty: true, noError: true },

  // Site Prompt 2 (Part 3): the Landing screen (logo strip, featured work, testimonials, stats).
  { id: 'landing', screen: 'Landing', label: 'landing screen', path: '/admin/landing', resource: 'leads' },

  // The Emails card on Settings, Integrations (CRM revamp, step 6): three hooks connected in the fixtures, one not.
  // settings-emails is static: the card is reached by a tab click after the screen has loaded, so there is no skeleton of its own to measure.
  { id: 'settings-emails', screen: 'Settings', label: 'the Emails card', path: '/admin/settings', resource: 'settings', noEmpty: true, static: true, region: '.lay-tabbody', detail: true, act: async (p) => { await tab(p, 'Integrations'); await p.waitForSelector('.st-emails', { timeout: 4000 }).catch(() => {}); } },
  { id: 'notifications', screen: 'Shell', label: 'notifications drawer', path: '/admin/leads', region: '.v-sheet', resource: 'leads', emptyAlso: ['settings'], act: (p) => click(p.locator('.sh-bell')) },
  /* The sidebar rebuild: the groups are disclosure widgets, the rail's groups are menus. */
  { id: 'side-groups', screen: 'Shell', label: 'sidebar, the Clients workspace with the Studio rows', path: '/admin', minWidth: 768, resource: 'leads', static: true, act: async (p) => { await click(p.locator('.sh-side-ws [data-ws="clients"]')); await p.waitForTimeout(300); } },
  { id: 'side-rail', screen: 'Shell', label: 'sidebar rail, the Clients workspace', path: '/admin', minWidth: 768, resource: 'leads', static: true, prep: (p) => setLS(p, 'vz_shell_collapsed', true), act: async (p) => { await click(p.locator('.v-ws--rail [data-ws="clients"]')); await p.waitForTimeout(300); } },
  { id: 'more', screen: 'More', label: 'the More screen', path: '/admin/more', maxWidth: 767, resource: null, static: true },
];
