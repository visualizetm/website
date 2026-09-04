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
  { id: 'dashboard',   label: 'Dashboard',        icon: 'LayoutAlt01',     path: '',            group: 'Pipeline', badge: null,        tab: true },
  { id: 'leads',       label: 'Leads',            icon: 'Users01',         path: '/leads',      group: 'Pipeline', badge: 'leads',     tab: true },
  { id: 'calls',       label: 'Call Console',     icon: 'PhoneCall01',     path: '/calls',      group: 'Pipeline', badge: 'calls',     tab: true, tabLabel: 'Call' },
  { id: 'booked',      label: 'Booked',           icon: 'CalendarCheck01', path: '/booked',     group: 'Pipeline', badge: 'booked',    tab: true },
  { id: 'clients',     label: 'Clients',          icon: 'Briefcase01',     path: '/clients',    group: 'Clients',  badge: null },
  { id: 'orders',      label: 'Print Orders',     icon: 'Package',         path: '/orders',     group: 'Studio',   badge: 'orders' },
  { id: 'concepts',    label: 'Concepts',         icon: 'Image01',         path: null,          group: 'Studio',   badge: null, soon: true },
  { id: 'reviews',     label: 'Reviews',          icon: 'Star01',          path: null,          group: 'Studio',   badge: null, soon: true },
  { id: 'submissions', label: 'Submissions',      icon: 'Inbox01',         path: '/submissions', group: 'System',  badge: 'submissions' },
  { id: 'deleted',     label: 'Recently Deleted', icon: 'Trash01',         path: '/settings/deleted', group: 'System', badge: null },
  { id: 'design',      label: 'Design',           icon: 'Palette',         path: '/design',     group: 'System',   badge: null },
  { id: 'settings',    label: 'Settings',         icon: 'Settings01',      path: '/settings',   group: 'System',   badge: null },
];

export const NAV_GROUPS = ['Pipeline', 'Clients', 'Studio', 'System'];

/** Entries grouped in display order. */
export const navGroups = () => NAV_GROUPS.map(g => ({ group: g, items: NAV.filter(n => n.group === g) }));

/** The mobile thumb tabs, in order (More is appended by the tab bar itself). */
export const TAB_NAV = NAV.filter(n => n.tab);

/** Everything that is not a thumb tab (the More sheet). */
export const MORE_NAV = NAV.filter(n => !n.tab);

/** Active entry for a path relative to the admin base. Longest path wins so
 *  '/settings/deleted' resolves to Recently Deleted, not Settings. */
export function navForPath(rel) {
  const p = rel || '/';
  let best = NAV[0];
  for (const n of NAV) {
    if (!n.path) continue;
    if (p === n.path || p.startsWith(n.path + '/')) { if (!best.path || n.path.length > best.path.length) best = n; }
  }
  if (p === '/' || p === '') return NAV[0];
  return best;
}

/** Section id AdminApp branches on for a nav entry. */
export const sectionOf = (entry) => (entry.id === 'deleted' ? 'settings' : entry.id);

export const navById = (id) => NAV.find(n => n.id === id) || null;
