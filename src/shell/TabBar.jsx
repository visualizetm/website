import DotsGrid from '@untitled-ui/icons-react/build/esm/DotsGrid';
import { Badge, Icon, SkeletonBlock } from '../ui';
import { TAB_NAV, MORE_NAV } from './nav';
/**
 * Mobile tab bar (under 768px): a floating glass pill, icons only, five
 * tabs from nav.js plus More. The outer <nav> reserves no layout height
 * (height: 0) so every screen's own scroll content fills the full column
 * and visibly passes behind the pill as it scrolls; every scrolling
 * container (ScrollArea, StickyFooterBar, SaveBar) reserves its own
 * clearance for it through --v-tabbar-now (src/shell/AppShell.jsx).
 */
export default function TabBar({ activeId, counts, countsLoading, onGo, onMore, hidden = false }) {
  const moreActive = activeId === 'more' || MORE_NAV.some(n => n.id === activeId);
  const moreCount = MORE_NAV.reduce((n, e) => n + (e.badge ? counts?.[e.badge] || 0 : 0), 0);
  /* A small dot under ten, the number at ten and up (the prompt's rule for the glass bar specifically; everywhere
     else in the kit a badge still shows its exact count, Badge.jsx itself is unchanged). */
  const badgeFor = (count) => (countsLoading ? <SkeletonBlock width={14} height={14} radius="var(--v-radius-pill)" className="sh-tab-skel" /> : count >= 10 ? <Badge count={count} /> : <Badge dot={count > 0} />);
  return (
    <nav className={`sh-tabs${hidden ? ' is-hidden' : ''}`} aria-label="Sections" inert={hidden ? '' : undefined} aria-hidden={hidden || undefined}>
      <div className="sh-tabs-glass">
        {TAB_NAV.map(n => {
          const active = n.id === activeId;
          const count = n.badge ? counts?.[n.badge] || 0 : 0;
          const label = n.tabLabel || n.label;
          return (
            <button key={n.id} type="button" className={`sh-tab${active ? ' is-active' : ''}`} onClick={() => onGo(n.id)} aria-current={active ? 'page' : undefined} aria-label={label}>
              <span className="sh-tab-icon">
                <Icon icon={n.icon} size="var(--v-icon-md)" />
                {n.badge ? badgeFor(count) : null}
              </span>
            </button>
          );
        })}
        <button type="button" className={`sh-tab sh-tab--more${moreActive ? ' is-active' : ''}`} onClick={onMore} aria-current={activeId === 'more' ? 'page' : undefined} aria-label="More">
          <span className="sh-tab-icon"><DotsGrid width={18} height={18} />{badgeFor(moreCount)}</span>
        </button>
      </div>
    </nav>
  );
}

export const tabBarStyles = `
  .sh-tabs { height: 0; flex-shrink: 0; overflow: visible; z-index: var(--v-z-tabbar); }
  @media (min-width: 768px) { .sh-tabs { display: none; } }
  .sh-tabs-glass {
    position: fixed; left: var(--v-space-4); right: var(--v-space-4);
    bottom: calc(var(--v-inset-bottom) + var(--v-space-3));
    display: flex; align-items: center; justify-content: space-around;
    padding: var(--v-space-2); border-radius: var(--v-radius-pill);
    background: var(--v-glass-bg);
    -webkit-backdrop-filter: blur(var(--v-glass-blur)) saturate(var(--v-glass-saturate));
    backdrop-filter: blur(var(--v-glass-blur)) saturate(var(--v-glass-saturate));
    border: 1px solid var(--v-glass-border);
    box-shadow: var(--v-glass-shadow);
    transition: transform var(--v-dur-base) var(--v-ease-out), opacity var(--v-dur-base) var(--v-ease-out);
  }
  /* No backdrop-filter support, or the person asked for less transparency: a solid bar reads just as well. */
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .sh-tabs-glass { background: var(--v-surface-1); }
  }
  @media (prefers-reduced-transparency: reduce) {
    .sh-tabs-glass { background: var(--v-surface-1); backdrop-filter: none; -webkit-backdrop-filter: none; }
  }
  /* Focused screens (src/shell/chrome.js): the pill slides below the safe area and gives its space back; it slides up on Back. */
  .sh-tabs.is-hidden .sh-tabs-glass { transform: translateY(calc(100% + var(--v-inset-bottom) + var(--v-space-4))); opacity: 0; pointer-events: none; }
  .sh-tab {
    flex: 1; display: flex; align-items: center; justify-content: center;
    min-width: var(--v-tap); min-height: var(--v-tap); padding: 0; border: 0; background: transparent; color: var(--v-text-3); cursor: pointer;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    transition: color var(--v-dur-fast) var(--v-ease-out);
  }
  .sh-tab:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; border-radius: var(--v-radius-pill); }
  .sh-tab-icon { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 36px; border-radius: var(--v-radius-pill); transition: background var(--v-dur-fast) var(--v-ease-out); }
  .sh-tab.is-active { color: var(--v-red-highlight); }
  .sh-tab.is-active .sh-tab-icon { background: var(--v-red-soft); }
  .sh-tab .v-badge { top: -2px; right: 2px; box-shadow: 0 0 0 2px var(--v-surface-2); }
  .sh-tab .v-badge--dot { top: 2px; right: 6px; }
  .sh-tab-skel { position: absolute; top: 0; right: 6px; }
`;
