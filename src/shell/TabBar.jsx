import DotsGrid from '@untitled-ui/icons-react/build/esm/DotsGrid';
import { Badge, Icon, SkeletonBlock } from '../ui';
import { TAB_NAV, MORE_NAV } from './nav';
/**
 * Mobile tab bar (under 768px): five tabs from nav.js plus More.
 */
export default function TabBar({ activeId, counts, countsLoading, onGo, onMore, moreOpen }) {
  const moreActive = moreOpen || MORE_NAV.some(n => n.id === activeId);
  const moreCount = MORE_NAV.reduce((n, e) => n + (e.badge ? counts?.[e.badge] || 0 : 0), 0);
  return (
    <nav className="sh-tabs" aria-label="Sections">
      {TAB_NAV.map(n => {
        const active = n.id === activeId;
        const count = n.badge ? counts?.[n.badge] : 0;
        return (
          <button key={n.id} type="button" className={`sh-tab${active ? ' is-active' : ''}`} onClick={() => onGo(n.id)} aria-current={active ? 'page' : undefined}>
            <span className="sh-tab-icon">
              <Icon icon={n.icon} size="var(--v-icon-md)" />
              {n.badge && (countsLoading ? <SkeletonBlock width={14} height={14} radius="var(--v-radius-pill)" className="sh-tab-skel" /> : <Badge count={count} />)}
            </span>
            <span className="sh-tab-label">{n.tabLabel || n.label}</span>
          </button>
        );
      })}
      <button type="button" className={`sh-tab sh-tab--more${moreActive ? ' is-active' : ''}`} onClick={onMore} aria-haspopup="dialog" aria-expanded={moreOpen}>
        <span className="sh-tab-icon"><DotsGrid width={18} height={18} /><Badge count={moreCount} /></span>
        <span className="sh-tab-label">More</span>
      </button>
    </nav>
  );
}

export const tabBarStyles = `
  .sh-tabs {
    display: flex; align-items: stretch; justify-content: space-around; flex-shrink: 0;
    height: calc(var(--v-tabbar-h) + var(--v-inset-bottom)); padding: 0 max(var(--v-space-1), env(safe-area-inset-left)) var(--v-inset-bottom) max(var(--v-space-1), env(safe-area-inset-right));
    background: var(--v-surface-1); border-top: 1px solid var(--v-border); z-index: var(--v-z-tabbar);
  }
  @media (min-width: 768px) { .sh-tabs { display: none; } }
  .sh-tab {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    min-width: var(--v-tap); min-height: var(--v-tap); padding: 4px 2px 0; border: 0; background: transparent; color: var(--v-text-3); cursor: pointer;
    font-family: var(--v-font-body); -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    transition: color var(--v-dur-fast) var(--v-ease-out);
  }
  .sh-tab:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; border-radius: var(--v-radius-md); }
  .sh-tab-icon { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 26px; border-radius: var(--v-radius-pill); transition: background var(--v-dur-fast) var(--v-ease-out); }
  .sh-tab.is-active { color: var(--v-red-highlight); }
  .sh-tab.is-active .sh-tab-icon { background: var(--v-red-soft); }
  .sh-tab-label { font-size: 10px; line-height: 12px; font-weight: var(--v-weight-bold); letter-spacing: 0.02em; }
  .sh-tab .v-badge { top: -4px; right: 2px; box-shadow: 0 0 0 2px var(--v-surface-1); }
  .sh-tab-skel { position: absolute; top: -2px; right: 4px; }
`;
