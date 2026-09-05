import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import Badge from './Badge';
/**
 * Tabs: underline style, scrolls sideways on narrow screens, arrow keys move.
 * @param {object} props
 * @param {Array<{id: string, label: string, count?: number, icon?: any, pulse?: boolean}>} props.tabs `pulse` plays one booked tone pulse on that tab
 * @param {string} props.value
 * @param {Function} props.onChange (id) => void
 * @param {string} [props.label]
 */
export default function Tabs({ tabs, value, onChange, label, className = '' }) {
  const ref = useRef(null);
  const [ind, setInd] = useState(null); // { left, width } of the active tab, for the sliding underline
  useEffect(() => {
    // Scroll the strip sideways only; never move the page vertically.
    const p = ref.current; const el = p?.querySelector('[aria-selected="true"]');
    if (!p || !el) return;
    if (el.offsetLeft < p.scrollLeft || el.offsetLeft + el.offsetWidth > p.scrollLeft + p.clientWidth) p.scrollTo({ left: Math.max(0, el.offsetLeft - 16) });
    const place = () => setInd({ left: el.offsetLeft, width: el.offsetWidth });
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(el); ro?.observe(p);
    return () => ro?.disconnect();
  }, [value, tabs]);
  const onKey = (e) => {
    const i = tabs.findIndex(t => t.id === value);
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(tabs[(i + 1) % tabs.length].id); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(tabs[(i - 1 + tabs.length) % tabs.length].id); }
  };
  return (
    <div ref={ref} className={`v-tabs ${className}`.trim()} role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map(t => {
        const on = t.id === value;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1} className={`v-tab${on ? ' is-on' : ''}${t.pulse ? ' is-pulse' : ''}`} onClick={() => onChange(t.id)}>
            {t.icon && <Icon icon={t.icon} size={14} />}
            <span>{t.label}</span>
            {typeof t.count === 'number' && <Badge count={t.count} inline tone={on ? 'won' : 'neutral'} />}
          </button>
        );
      })}
      {ind && <span className="v-tabs-ind" aria-hidden="true" style={{ width: ind.width, transform: `translateX(${ind.left}px)` }} />}
    </div>
  );
}

export const tabsStyles = `
  .v-tabs { position: relative; display: flex; gap: var(--v-space-1); border-bottom: 1px solid var(--v-border); min-width: 0; max-width: 100%; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
  /* The one underline slides between tabs (Prompt 14); its inset matches the old per-tab bar. */
  .v-tabs-ind { position: absolute; left: 0; bottom: 0; height: 2px; border-radius: 2px 2px 0 0; background: var(--v-red); pointer-events: none; box-sizing: border-box; border-left: var(--v-space-3) solid transparent; border-right: var(--v-space-3) solid transparent; background-clip: padding-box; transition: transform var(--v-dur-base) var(--v-ease-out), width var(--v-dur-base) var(--v-ease-out); }
  .v-tabs::-webkit-scrollbar { display: none; }
  .v-tab {
    position: relative; display: inline-flex; align-items: center; gap: var(--v-space-2); flex-shrink: 0;
    min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; background: transparent; color: var(--v-text-3); cursor: pointer;
    font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); white-space: nowrap;
    transition: color var(--v-dur-fast) var(--v-ease-out);
  }
  .v-tab.is-pulse { animation: v-tab-pulse calc(var(--v-dur-slow) * 2) var(--v-ease-spring) 1; }
  @keyframes v-tab-pulse { 0% { transform: scale(1); color: inherit; } 35% { transform: scale(1.08); color: var(--v-status-booked-text); } 100% { transform: scale(1); } }
  .v-tab:hover { color: var(--v-text); }
  .v-tab.is-on { color: var(--v-text); }
  .v-tab:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; border-radius: var(--v-radius-sm); }
  .v-tab .v-badge--inline { background: var(--v-surface-3); color: var(--v-text-2); }
  .v-tab.is-on .v-badge--inline { background: var(--v-red-hover); color: var(--v-text-on-red); }
`;
