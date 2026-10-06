/* ONE definition of every admin destination (the nav revamp). The sidebar,
 * the tab bar, the More page, the command bar's "Jump to" group and the top
 * bar title all render from this array. Active state is derived from the path.
 *
 *   id         section id used by AdminApp's branching
 *   label      shown everywhere
 *   icon       Untitled UI icon name (resolved by src/ui/icons.jsx)
 *   path       relative to the admin base ('' = the home)
 *   workspace  pipeline | clients | studio | system (the switcher shows pipeline and clients; studio rows ride under clients)
 *   group      the older grouping (Pipeline | Clients | Studio | System), still read by navGroups()
 *   pinned     'top' (Analytics, above both workspaces) or 'bottom' (Settings, Design, under them)
 *   badge      key into the counts object the shell receives (or null)
 *   tab        true = one of the phone's thumb tabs, in tabOrder (tabLabel overrides label)
 *   more       the More page's row order (milestone 7 renders the More page from the workspaces instead)
 *   soon       true = planned screen: rendered disabled, never a dead link
 */
export const NAV = [
  /* The home (milestone 6): Analytics, pinned above both workspaces; the phone's first tab reads Home. The Next up queue is /tasks. */
  { id: 'dashboard',   label: 'Analytics',        icon: 'BarChart01',      path: '',            workspace: 'top',      group: 'Pipeline', badge: null,        tab: true, tabOrder: 0, tabLabel: 'Home', pinned: 'top' },
  // PIPELINE: the work of landing someone.
  { id: 'pipeline',    label: 'Dashboard',        icon: 'BarChartSquare01', path: '/pipeline',  workspace: 'pipeline', group: 'Pipeline', badge: null,        moreLabel: 'Pipeline dashboard' },
  { id: 'triage',      label: 'Triage',           icon: 'Inbox01',         path: '/triage',     workspace: 'pipeline', group: 'Pipeline', badge: 'triage',    more: 0 },
  { id: 'leads',       label: 'Leads',            icon: 'Users01',         path: '/leads',      workspace: 'pipeline', group: 'Pipeline', badge: 'leads',     more: 1 },
  { id: 'calls',       label: 'Call Console',     icon: 'PhoneCall01',     path: '/calls',      workspace: 'pipeline', group: 'Pipeline', badge: 'calls',     tab: true, tabOrder: 2, tabLabel: 'Call' },
  { id: 'lists',       label: 'Lists',            icon: 'Rows01',          path: '/lists',      workspace: 'pipeline', group: 'Pipeline', badge: 'lists',     tab: true, tabOrder: 1 },
  { id: 'deals',       label: 'Deals',            icon: 'Zap',             path: '/deals',      workspace: 'pipeline', group: 'Pipeline', badge: 'deals',     tab: true, tabOrder: 3 },
  { id: 'calendar',    label: 'Calendar',         icon: 'Calendar',        path: '/calendar',   workspace: 'pipeline', group: 'Pipeline', badge: 'calendar',  more: 6 },
  // CLIENTS: the work after they say yes. Planner is the Clients screen with a filter applied (href carries the query; path is what the active state matches on).
  { id: 'overview',    label: 'Dashboard',        icon: 'BarChartSquare01', path: '/overview',  workspace: 'clients',  group: 'Clients',  badge: null,        moreLabel: 'Clients dashboard' },
  { id: 'clients',     label: 'Clients',          icon: 'Briefcase01',     path: '/clients',    workspace: 'clients',  group: 'Clients',  badge: 'clients',   more: 2 },
  { id: 'projects',    label: 'Projects',         icon: 'Folder',          path: '/projects',   workspace: 'clients',  group: 'Clients',  badge: 'projects',  more: 3 },
  // Docs (client docs job): every client's docs in one list, between Projects and Planner; a doc itself is /docs/:id.
  { id: 'docs',        label: 'Docs',             icon: 'File02',          path: '/docs',       workspace: 'clients',  group: 'Clients',  badge: null,        more: 3.5 },
  { id: 'planner',     label: 'Planner',          icon: 'Send01',          path: '/clients',    href: '/clients?filter=planner', search: 'filter=planner', workspace: 'clients', group: 'Clients', badge: 'planner' },
  { id: 'tasks',       label: 'Tasks',            icon: 'CheckDone01',     path: '/tasks',      workspace: 'clients',  group: 'Clients',  badge: 'tasks' },
  // STUDIO: what gets made and what comes in from the site. Rows under the Clients workspace (seven is the cap per workspace).
  { id: 'orders',      label: 'Print Orders',     icon: 'Package',         path: '/orders',     workspace: 'studio',   group: 'Studio',   badge: 'orders',    more: 4, moreLabel: 'Orders' },
  { id: 'concepts',    label: 'Concepts',         icon: 'Image01',         path: '/concepts',   workspace: 'studio',   group: 'Studio',   badge: 'concepts',  more: 9 },
  { id: 'reviews',     label: 'Reviews',          icon: 'Star01',          path: '/reviews',    workspace: 'studio',   group: 'Studio',   badge: 'reviews',   more: 5 },
  { id: 'submissions', label: 'Submissions',      icon: 'Inbox01',         path: '/submissions', workspace: 'studio',  group: 'System',   badge: 'submissions', more: 7 },
  { id: 'landing',     label: 'Landing',          icon: 'Browser',         path: '/landing',    workspace: 'studio',   group: 'Studio',   badge: null,        more: 12 },
  // SYSTEM: pinned under both workspaces, plus the rows only the More page lists.
  { id: 'settings',    label: 'Settings',         icon: 'Settings01',      path: '/settings',   workspace: 'system',   group: 'System',   badge: null,        more: 11, pinned: 'bottom' },
  { id: 'design',      label: 'Design',           icon: 'Palette',         path: '/design',     workspace: 'system',   group: 'System',   badge: null,        more: 13, pinned: 'bottom' },
  { id: 'deleted',     label: 'Recently Deleted', icon: 'Trash01',         path: '/settings/deleted', workspace: 'system', group: 'System', badge: null,     more: 8, moreOnly: true },
  // The phone's More screen: not a destination of its own, so the sidebar and the command bar skip it (phoneOnly).
  { id: 'more',        label: 'More',             icon: 'Rows01',          path: '/more',       workspace: 'system',   group: 'System',   badge: null,        phoneOnly: true },
  // The More screen's Declined row: the Leads screen on its Declined pool. moreOnly keeps it out of the sidebar.
  { id: 'declined',    label: 'Declined',         icon: 'SlashCircle01',   path: '/leads',      href: '/leads?pool=declined', search: 'pool=declined', workspace: 'pipeline', group: 'Pipeline', badge: null, more: 10, moreOnly: true },
];

/* The two workspaces the switcher offers, in order. Studio rides under Clients; system is pinned. */
export const WORKSPACES = [
  { id: 'pipeline', label: 'Pipeline', icon: 'PhoneCall01', blurb: 'cold calling: the work of landing someone' },
  { id: 'clients',  label: 'Clients',  icon: 'Briefcase01', blurb: 'client management: the work after they say yes' },
];
export const WORKSPACE_IDS = WORKSPACES.map(w => w.id);

/* One line per group: the icon the collapsed rail shows and the sentence
 * under the group name, so the navigation reads as the process. */
export const NAV_GROUP_META = {
  Pipeline: { icon: 'PhoneCall01',  blurb: 'the work of landing someone' },
  Clients:  { icon: 'Briefcase01',  blurb: 'the work after they say yes' },
  Studio:   { icon: 'Palette',      blurb: 'what gets made' },
  System:   { icon: 'Settings01',   blurb: 'the app itself' },
};

export const NAV_GROUPS = ['Pipeline', 'Clients', 'Studio', 'System'];

const listed = (n) => !n.moreOnly && !n.phoneOnly;

/** Entries grouped in display order (the older sidebar and the More page). */
export const navGroups = () => NAV_GROUPS.map(g => ({ group: g, items: NAV.filter(n => n.group === g && listed(n)) }));

/** The items of one workspace (at most seven), and the Studio rows that ride under Clients. */
export const navWorkspace = (ws) => ({
  items: NAV.filter(n => n.workspace === ws && listed(n) && !n.pinned),
  studio: ws === 'clients' ? NAV.filter(n => n.workspace === 'studio' && listed(n)) : [],
});
export const PINNED_TOP = () => NAV.filter(n => n.pinned === 'top');
export const PINNED_BOTTOM = () => NAV.filter(n => n.pinned === 'bottom');

/** The workspace an entry belongs to, for the switcher that follows the route: studio reads as clients; the pinned entries keep the current one (null). */
export function workspaceOf(id) {
  const n = navById(id);
  if (!n) return null;
  if (n.workspace === 'pipeline') return 'pipeline';
  if (n.workspace === 'clients' || n.workspace === 'studio') return 'clients';
  return null;
}

/** The mobile thumb tabs, in order (More is appended by the tab bar itself). */
export const TAB_NAV = NAV.filter(n => n.tab).sort((a, b) => (a.tabOrder ?? 99) - (b.tabOrder ?? 99));

/** Everything that is not a thumb tab (the More page's flat list, the tab bar's badge sum). */
export const MORE_NAV = NAV.filter(n => !n.tab && !n.phoneOnly);

/** The More page by workspace (milestone 7): Pipeline, Clients, Studio, then System, each in NAV order, tabs left out. */
export const MORE_SECTIONS = [
  { id: 'pipeline', label: 'Pipeline', items: NAV.filter(n => n.workspace === 'pipeline' && !n.tab && !n.phoneOnly) },
  { id: 'clients',  label: 'Clients',  items: NAV.filter(n => n.workspace === 'clients' && !n.tab && !n.phoneOnly) },
  { id: 'studio',   label: 'Studio',   items: NAV.filter(n => n.workspace === 'studio' && !n.tab && !n.phoneOnly) },
  { id: 'system',   label: 'System',   items: NAV.filter(n => n.workspace === 'system' && !n.tab && !n.phoneOnly) },
].filter(s => s.items.length);

/** Active entry for a path relative to the admin base. Longest path wins so
 *  '/settings/deleted' resolves to Recently Deleted, not Settings. */
export function navForPath(rel, search = '') {
  const p = rel || '/';
  const q = String(search || '').replace(/^\?/, '');
  let best = NAV[0];
  for (const n of NAV) {
    if (!n.path) continue;
    if (p === n.path || p.startsWith(n.path + '/')) {
      // an entry with a search part only matches when the query carries it; among equals the longer path wins
      if (n.search && !q.split('&').includes(n.search)) continue;
      if (!best.path || n.path.length > best.path.length || (n.path.length === best.path.length && n.search)) best = n;
    }
  }
  if (p === '/' || p === '') return NAV[0];
  return best;
}

/** Section id AdminApp branches on for a nav entry. */
export const sectionOf = (entry) => (entry.id === 'deleted' ? 'settings' : (entry.id === 'planner' || entry.id === 'declined') ? (entry.id === 'planner' ? 'clients' : 'leads') : entry.id);

/* Older ids that other code still names: 'analytics' and 'dashboard' are both the home. */
const ALIASES = { analytics: 'dashboard' };
export const navById = (id) => NAV.find(n => n.id === (ALIASES[id] || id)) || null;
