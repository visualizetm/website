import { useCallback, useEffect, useState } from 'react';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import { Badge, Tooltip, Menu, Avatar, Icon, SkeletonBlock, Logo, WorkspaceSwitcher } from '../ui';
import { WORKSPACES, WORKSPACE_IDS, navWorkspace, PINNED_TOP, PINNED_BOTTOM, workspaceOf } from './nav';
import { KEYS, readJSON, writeJSON } from './storage';

/**
 * Desktop sidebar (768px and up), the nav revamp: the home pinned on top,
 * a workspace switcher (Pipeline, Clients), the one short list of the
 * workspace that is on (the Studio rows ride under Clients), then Settings,
 * Design, the profile row and Collapse pinned at the bottom. The workspace
 * follows the route: opening a client shows Clients, opening Triage shows
 * Pipeline, and the switcher only changes what is listed, never where Rob
 * is. Collapsed to the rail every item is an icon with a tooltip and its
 * badge; the switcher is two stacked icons. Renders from nav.js.
 */

/* UI simplification, part B: badges only where a count is a to do list. */
const SIDEBAR_BADGES = new Set(['triage', 'lists', 'deals', 'projects', 'tasks']);

export default function Sidebar({ collapsed, canToggle = true, onToggle, activeId, counts, countsLoading, onGo, menuItems }) {
  const routeWs = workspaceOf(activeId);
  /* The workspace on show: the route's own when the screen belongs to one, else the last one picked (per device). */
  const [picked, setPicked] = useState(() => { const v = readJSON(KEYS.workspace, 'pipeline'); return WORKSPACE_IDS.includes(v) ? v : 'pipeline'; });
  useEffect(() => { if (routeWs && routeWs !== picked) { setPicked(routeWs); writeJSON(KEYS.workspace, routeWs); } }, [routeWs]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = useCallback((id) => { setPicked(id); writeJSON(KEYS.workspace, id); }, []);
  const ws = navWorkspace(picked);
  const countOf = (n) => (n.badge && SIDEBAR_BADGES.has(n.id) ? counts?.[n.badge] || 0 : 0);

  const item = (n) => {
    const count = countOf(n);
    const active = n.id === activeId;
    const btn = (
      <button key={n.id} type="button"
        className={`sh-nav${active ? ' is-active' : ''}${n.soon ? ' is-soon' : ''}`}
        onClick={() => !n.soon && onGo(n.id)} disabled={n.soon} aria-current={active ? 'page' : undefined} aria-label={collapsed ? `${n.label}${count ? `, ${count}` : ''}${n.soon ? ', soon' : ''}` : undefined} data-nav={n.id}>
        <span className="sh-nav-icon">
          <Icon icon={n.icon} size="var(--v-icon-md)" />
          {collapsed && !n.soon && count > 0 && <Badge count={count} />}
        </span>
        {!collapsed && <span className="sh-nav-label">{n.label}</span>}
        {!collapsed && n.soon && <span className="sh-nav-soon">Soon</span>}
        {!collapsed && !n.soon && n.badge && SIDEBAR_BADGES.has(n.id) && (countsLoading ? <SkeletonBlock width={22} height={18} radius="var(--v-radius-pill)" /> : count > 0 && <Badge count={count} inline tone={active ? 'won' : 'neutral'} />)}
      </button>
    );
    return collapsed ? <Tooltip key={n.id} label={`${n.label}${n.soon ? ' (soon)' : ''}`} side="right">{btn}</Tooltip> : btn;
  };

  return (
    <nav className={`sh-side${collapsed ? ' is-collapsed' : ''}`} aria-label="Admin sections" data-workspace={picked}>
      <button type="button" className="sh-side-brand" onClick={() => onGo('dashboard')} aria-label="Home">
        <Logo variant="icon" width={28} decorative />
        {!collapsed && <Logo width={104} decorative />}
      </button>
      <div className="sh-side-top">{PINNED_TOP().map(item)}</div>
      <WorkspaceSwitcher options={WORKSPACES.map(w => ({ id: w.id, label: w.label, icon: w.icon }))} value={picked} onChange={pick} collapsed={collapsed} label="Workspace" className="sh-side-ws" />
      <div className="sh-side-groups">
        <div role="group" aria-label={`${WORKSPACES.find(w => w.id === picked)?.label || 'Workspace'} sections`} className="sh-group-items">{ws.items.map(item)}</div>
        {ws.studio.length > 0 && (
          <div role="group" aria-label="Studio sections" className="sh-group-items sh-group-items--studio">
            {!collapsed && <span className="sh-side-label">Studio</span>}
            {collapsed && <span className="sh-side-rule" aria-hidden="true" />}
            {ws.studio.map(item)}
          </div>
        )}
      </div>
      <div className="sh-side-bottom">
        <div className="sh-group-items">{PINNED_BOTTOM().map(item)}</div>
        <Menu label="Account" align="start" items={menuItems}
          trigger={
            <button type="button" className="sh-side-user" aria-label="Account menu">
              <Avatar name="Rob" size="sm" />
              {!collapsed && <span className="sh-side-user-text"><strong>Rob</strong><span>Visualize Studio</span></span>}
            </button>
          } />
        {canToggle && (
          <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} side="top">
            <button type="button" className="sh-side-toggle" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
              {collapsed ? <ChevronRight width={16} height={16} /> : <ChevronLeft width={16} height={16} />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </Tooltip>
        )}
      </div>
    </nav>
  );
}

export const sidebarStyles = `
  .sh-side {
    display: none; flex-direction: column; flex-shrink: 0;
    width: var(--v-sidebar-w); height: 100%; min-height: 0;
    background: var(--v-sidebar-bg);
    border-right: 1px solid var(--v-sidebar-border); color: var(--v-sidebar-text);
    padding: var(--v-space-3) var(--v-space-2) calc(var(--v-space-3) + var(--v-inset-bottom)) max(var(--v-space-2), env(safe-area-inset-left));
    transition: width var(--v-dur-base) var(--v-ease-out);
  }
  .sh-side.is-collapsed { width: var(--v-sidebar-rail-w); }
  @media (min-width: 768px) { .sh-side { display: flex; } }
  .sh-side-brand { display: flex; align-items: center; gap: var(--v-space-4); min-height: var(--v-tap); padding: 0 var(--v-space-2); margin-bottom: var(--v-space-2); border: 0; background: transparent; border-radius: var(--v-radius-md); color: var(--v-sidebar-text); cursor: pointer; }
  .sh-side-brand:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .sh-side.is-collapsed .sh-side-brand { justify-content: center; padding: 0; }
  /* The home pinned above the switcher, then the one list of the workspace on show. */
  .sh-side-top { display: flex; flex-direction: column; gap: 2px; margin-bottom: var(--v-space-2); }
  .sh-side.is-collapsed .sh-side-top { align-items: center; }
  .sh-side-ws { margin: 0 0 var(--v-space-3); }
  .sh-side.is-collapsed .sh-side-ws { align-self: center; }
  .sh-side-groups { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: var(--v-space-3); scrollbar-width: none; }
  .sh-side-groups::-webkit-scrollbar { display: none; }
  .sh-group-items { display: flex; flex-direction: column; gap: 2px; }
  .sh-side.is-collapsed .sh-group-items { align-items: center; }
  .sh-group-items--studio { padding-top: var(--v-space-1); }
  .sh-side-label { margin: 0; padding: var(--v-space-1) var(--v-space-3); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-sidebar-text-3); }
  .sh-side-rule { display: block; width: 24px; height: 1px; margin: var(--v-space-1) 0; background: var(--v-sidebar-border); }
  .sh-nav {
    position: relative; display: flex; align-items: center; gap: var(--v-space-3); width: 100%;
    min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-md);
    background: transparent; color: var(--v-sidebar-text-2); cursor: pointer; text-align: left;
    font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold);
    transition: background var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out);
  }
  .sh-side.is-collapsed .sh-nav { justify-content: center; padding: 0; width: var(--v-tap); }
  .sh-nav:hover:not(:disabled) { background: var(--v-sidebar-hover); color: var(--v-sidebar-text); }
  .sh-nav:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-nav.is-active { background: var(--v-sidebar-active-bg); color: var(--v-sidebar-active); }
  .sh-nav.is-active::before { content: ''; position: absolute; left: -2px; top: 8px; bottom: 8px; width: 3px; border-radius: 2px; background: var(--v-sidebar-active); }
  .sh-side.is-collapsed .sh-nav.is-active::before { left: 0; }
  .sh-nav.is-soon { opacity: 0.5; cursor: not-allowed; }
  .sh-nav-icon { position: relative; display: inline-flex; flex-shrink: 0; }
  .sh-nav-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sh-nav-soon { font-size: 10px; line-height: 1; letter-spacing: 0.08em; text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-sidebar-text-3); border: 1px solid var(--v-sidebar-border); border-radius: var(--v-radius-pill); padding: 3px 6px; }
  .sh-side-bottom { display: flex; flex-direction: column; gap: 2px; padding-top: var(--v-space-2); border-top: 1px solid var(--v-sidebar-border); }
  .sh-side.is-collapsed .sh-side-bottom { align-items: center; }
  .sh-side-user { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: var(--v-tap); padding: 0 var(--v-space-2); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-sidebar-text); cursor: pointer; text-align: left; }
  .sh-side-user:hover { background: var(--v-sidebar-hover); }
  .sh-side-user:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-side.is-collapsed .sh-side-user { justify-content: center; padding: 0; width: var(--v-tap); }
  .sh-side-user-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
  .sh-side-user-text strong { font-size: var(--v-text-sm); }
  .sh-side-user-text span { font-size: var(--v-text-xs); color: var(--v-sidebar-text-3); }
  .sh-side-toggle { display: flex; align-items: center; gap: var(--v-space-2); width: 100%; min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-sidebar-text-2); cursor: pointer; font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); }
  .sh-side.is-collapsed .sh-side-toggle { justify-content: center; padding: 0; width: var(--v-tap); }
  .sh-side-toggle:hover { background: var(--v-sidebar-hover); color: var(--v-sidebar-text); }
  .sh-side-toggle:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-side .v-badge--inline { background: rgba(255,255,255,0.10); color: var(--v-sidebar-text-2); }
  .sh-side .sh-nav.is-active .v-badge--inline { background: var(--v-red-hover); color: var(--v-text-on-red); }
  .sh-side .v-menu, .sh-side .v-menu-trig { width: 100%; }
  .sh-side.is-collapsed .v-menu, .sh-side.is-collapsed .v-menu-trig { width: auto; }
`;
