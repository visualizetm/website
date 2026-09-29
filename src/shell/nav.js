/* ONE definition of every admin destination. The sidebar, the tab bar, the
 * More sheet, the command bar's "Jump to" group, and the top bar title all
 * render from this array. Active state is derived from the path.
 *
 *   id        section id used by AdminApp's branching
 *   label     shown everywhere
 *   icon      Untitled UI icon name (resolved by src/ui/icons.jsx)
 *   path      relative to the admin base ('' = dashboard)
 *   group     Pipeline | Clients | Studio | System
 *   badge     key into the counts object the shell receives (or null)
 *   tab       true = one of the mobile thumb tabs (tabLabel overrides label)
 *   soon      true = planned screen: rendered disabled, never a dead link
 */
export const NAV = [
  // PIPELINE: the work of landing someone.
  // tab: the phone's thumb tabs in tabOrder (Next up, Lists, Call, Deals, then More); more: the More sheet's rows in moreOrder (CRM revamp, step 7).
  { id: 'dashboard',   label: 'Next up',          icon: 'LayoutAlt01',     path: '',            group: 'Pipeline', badge: 'dashboard', tab: true, tabOrder: 0 },
  { id: 'triage',      label: 'Triage',           icon: 'Inbox01',         path: '/triage',     group: 'Pipeline', badge: 'triage',    more: 0 },
  { id: 'leads',       label: 'Leads',            icon: 'Users01',         path: '/leads',      group: 'Pipeline', badge: 'leads',     more: 1 },
  { id: 'calls',       label: 'Call Console',     icon: 'PhoneCall01',     path: '/calls',      group: 'Pipeline', badge: 'calls',     tab: true, tabOrder: 2, tabLabel: 'Call' },
  { id: 'lists',       label: 'Lists',            icon: 'Rows01',          path: '/lists',      group: 'Pipeline', badge: 'lists',     tab: true, tabOrder: 1 },
  { id: 'deals',       label: 'Deals',            icon: 'Zap',             path: '/deals',      group: 'Pipeline', badge: 'deals',     tab: true, tabOrder: 3 },
  { id: 'calendar',    label: 'Calendar',         icon: 'Calendar',        path: '/calendar',   group: 'Pipeline', badge: 'calendar' },
  // CLIENTS: the work after they say yes. Projects and Planner are the
  // Clients screen with a filter applied (href carries the query; path is
  // what the active state matches on).
  { id: 'clients',     label: 'Clients',          icon: 'Briefcase01',     path: '/clients',    group: 'Clients',  badge: 'clients',   more: 2 },
  // Projects is its own screen since CRM revamp step 7 (/clients?filter=active still redirects there).
  { id: 'projects',    label: 'Projects',         icon: 'Folder',          path: '/projects',   group: 'Clients',  badge: 'projects',  more: 3 },
  { id: 'planner',     label: 'Planner',          icon: 'Send01',          path: '/clients',    href: '/clients?filter=planner', search: 'filter=planner', group: 'Clients', badge: 'planner' },
  // STUDIO
  { id: 'orders',      label: 'Print Orders',     icon: 'Package',         path: '/orders',     group: 'Studio',   badge: 'orders',    more: 4, moreLabel: 'Orders' },
  { id: 'concepts',    label: 'Concepts',         icon: 'Image01',         path: '/concepts',   group: 'Studio',   badge: 'concepts',  more: 6 },
  { id: 'reviews',     label: 'Reviews',          icon: 'Star01',          path: '/reviews',    group: 'Studio',   badge: 'reviews',   more: 5 },
  { id: 'landing',     label: 'Landing',          icon: 'Browser',         path: '/landing',    group: 'Studio',   badge: null },
  // SYSTEM
  { id: 'submissions', label: 'Submissions',      icon: 'Inbox01',         path: '/submissions', group: 'System',  badge: 'submissions' },
  { id: 'deleted',     label: 'Recently Deleted', icon: 'Trash01',         path: '/settings/deleted', group: 'System', badge: null },
  { id: 'design',      label: 'Design',           icon: 'Palette',         path: '/design',     group: 'System',   badge: null },
  { id: 'settings',    label: 'Settings',         icon: 'Settings01',      path: '/settings',   group: 'System',   badge: null,        more: 8 },
  // The More sheet's Declined row: the Leads screen on its Declined pool. moreOnly keeps it out of the sidebar.
  { id: 'declined',    label: 'Declined',         icon: 'SlashCircle01',   path: '/leads',      href: '/leads?pool=declined', search: 'pool=declined', group: 'Pipeline', badge: null, more: 7, moreOnly: true },
];
/** The four screens a phone hands off to the computer (CRM revamp, step 7). */
export const COMPUTER_ONLY = ['Showcase', 'Planner', 'Concepts editor', 'Landing'];

/* One line per group: the icon the collapsed rail shows and the sentence
 * under the group name, so the navigation reads as the process. */
export const NAV_GROUP_META = {
  Pipeline: { icon: 'PhoneCall01',  blurb: 'the work of landing someone' },
  Clients:  { icon: 'Briefcase01',  blurb: 'the work after they say yes' },
  Studio:   { icon: 'Palette',      blurb: 'what gets made' },
  System:   { icon: 'Settings01',   blurb: 'the app itself' },
};

export const NAV_GROUPS = ['Pipeline', 'Clients', 'Studio', 'System'];

/** Entries grouped in display order. */
export const navGroups = () => NAV_GROUPS.map(g => ({ group: g, items: NAV.filter(n => n.group === g && !n.moreOnly) }));

/** The mobile thumb tabs, in order (More is appended by the tab bar itself). */
export const TAB_NAV = NAV.filter(n => n.tab).sort((a, b) => (a.tabOrder ?? 99) - (b.tabOrder ?? 99));

/** Everything that is not a thumb tab (the More sheet). */
export const MORE_NAV = NAV.filter(n => typeof n.more === 'number').sort((a, b) => a.more - b.more);

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

export const navById = (id) => NAV.find(n => n.id === id) || null;
