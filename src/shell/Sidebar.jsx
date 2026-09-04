import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import { Badge, Tooltip, Menu, Avatar, Icon, SkeletonBlock } from '../ui';
import { navGroups } from './nav';
/**
 * Desktop sidebar (768px and up). Expanded at --v-sidebar-w, collapsed to
 * --v-sidebar-rail-w with Tooltip labels. Renders from nav.js.
 */
export default function Sidebar({ collapsed, canToggle = true, onToggle, activeId, counts, countsLoading, onGo, menuItems }) {
  const groups = navGroups();
  return (
    <nav className={`sh-side${collapsed ? ' is-collapsed' : ''}`} aria-label="Admin sections">
      <button type="button" className="sh-side-brand" onClick={() => onGo('dashboard')} aria-label="Dashboard">
        <img src="/logo.svg" alt="" width="28" height="28" />
        {!collapsed && <span className="sh-wordmark">Visualize<span className="sh-wordmark-dot">.</span></span>}
      </button>
      <div className="sh-side-groups">
        {groups.map(g => (
          <div key={g.group} className="sh-side-group">
            {!collapsed && <p className="sh-side-label">{g.group}</p>}
            {g.items.map(n => {
              const count = n.badge ? counts?.[n.badge] : 0;
              const active = n.id === activeId;
              const item = (
                <button key={n.id} type="button"
                  className={`sh-nav${active ? ' is-active' : ''}${n.soon ? ' is-soon' : ''}`}
                  onClick={() => !n.soon && onGo(n.id)} disabled={n.soon} aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? n.label : undefined}>
                  <span className="sh-nav-icon">
                    <Icon icon={n.icon} size="var(--v-icon-md)" />
                    {collapsed && count > 0 && <Badge count={count} />}
                  </span>
                  {!collapsed && <span className="sh-nav-label">{n.label}</span>}
                  {!collapsed && n.soon && <span className="sh-nav-soon">Soon</span>}
                  {!collapsed && !n.soon && n.badge && (countsLoading ? <SkeletonBlock width={22} height={18} radius="var(--v-radius-pill)" /> : count > 0 && <Badge count={count} inline tone={active ? 'won' : 'neutral'} />)}
                </button>
              );
              return collapsed ? <Tooltip key={n.id} label={n.soon ? `${n.label} (soon)` : n.label} side="bottom">{item}</Tooltip> : item;
            })}
          </div>
        ))}
      </div>
      <div className="sh-side-bottom">
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
    background: var(--v-bar); background-image: var(--v-grid-texture); background-size: var(--v-grid-texture-size);
    border-right: 1px solid var(--v-border);
    padding: var(--v-space-3) var(--v-space-2) calc(var(--v-space-3) + var(--v-inset-bottom)) max(var(--v-space-2), env(safe-area-inset-left));
    transition: width var(--v-dur-base) var(--v-ease-out);
  }
  .sh-side.is-collapsed { width: var(--v-sidebar-rail-w); }
  @media (min-width: 768px) { .sh-side { display: flex; } }
  .sh-side-brand { display: flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); padding: 0 var(--v-space-2); margin-bottom: var(--v-space-2); border: 0; background: transparent; border-radius: var(--v-radius-md); cursor: pointer; color: var(--v-text); }
  .sh-side-brand:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .sh-side.is-collapsed .sh-side-brand { justify-content: center; padding: 0; }
  .sh-wordmark { font-family: var(--v-font-body); font-size: var(--v-text-lg); font-weight: var(--v-weight-bold); letter-spacing: -0.02em; white-space: nowrap; }
  .sh-wordmark-dot { color: var(--v-red); }
  .sh-side-groups { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; display: flex; flex-direction: column; gap: var(--v-space-3); scrollbar-width: none; }
  .sh-side-groups::-webkit-scrollbar { display: none; }
  .sh-side-group { display: flex; flex-direction: column; gap: 2px; }
  .sh-side-label { margin: 0; padding: 0 var(--v-space-3); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .sh-nav {
    position: relative; display: flex; align-items: center; gap: var(--v-space-3); width: 100%;
    min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-md);
    background: transparent; color: var(--v-text-2); cursor: pointer; text-align: left;
    font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold);
    transition: background var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out);
  }
  .sh-side.is-collapsed .sh-nav { justify-content: center; padding: 0; }
  .sh-nav:hover:not(:disabled) { background: var(--v-surface-2); color: var(--v-text); }
  .sh-nav:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-nav.is-active { background: var(--v-red-soft); color: var(--v-red); }
  .sh-nav.is-active::before { content: ''; position: absolute; left: -2px; top: 8px; bottom: 8px; width: 3px; border-radius: 2px; background: var(--v-red); }
  .sh-side.is-collapsed .sh-nav.is-active::before { left: 0; }
  .sh-nav.is-soon { opacity: 0.5; cursor: not-allowed; }
  .sh-nav-icon { position: relative; display: inline-flex; flex-shrink: 0; }
  .sh-nav-label { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sh-nav-soon { font-size: 10px; line-height: 1; letter-spacing: 0.08em; text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); border: 1px solid var(--v-border-strong); border-radius: var(--v-radius-pill); padding: 3px 6px; }
  .sh-side-bottom { display: flex; flex-direction: column; gap: 0; padding-top: var(--v-space-2); border-top: 1px solid var(--v-border); }
  .sh-side-user { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: var(--v-tap); padding: 0 var(--v-space-2); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-text); cursor: pointer; text-align: left; font-family: var(--v-font-body); }
  .sh-side-user:hover { background: var(--v-surface-2); }
  .sh-side-user:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-side.is-collapsed .sh-side-user { justify-content: center; padding: 0; }
  .sh-side-user-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.2; }
  .sh-side-user-text strong { font-size: var(--v-text-sm); }
  .sh-side-user-text span { font-size: var(--v-text-xs); color: var(--v-text-3); }
  .sh-side-toggle { display: flex; align-items: center; gap: var(--v-space-2); width: 100%; min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-text-3); cursor: pointer; font-family: var(--v-font-body); font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); letter-spacing: var(--v-ls-xs); text-transform: uppercase; }
  .sh-side.is-collapsed .sh-side-toggle { justify-content: center; padding: 0; }
  .sh-side-toggle:hover { background: var(--v-surface-2); color: var(--v-text); }
  .sh-side-toggle:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .sh-side .v-menu, .sh-side .v-menu-trig { width: 100%; }
`;
