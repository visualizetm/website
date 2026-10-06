import { useCallback, useState } from 'react';
import IconButton from './IconButton';
import Avatar from './Avatar';
import Tooltip from './Tooltip';
import useMediaQuery from './useMediaQuery';

/**
 * CollapsiblePane (the nav revamp): the list pane of a list plus detail
 * screen, with one shared collapse. Expanded it holds the list the screen
 * gives it; collapsed it is a narrow rail that still switches records (one
 * avatar per row, the name in a tooltip and the accessible name, the active
 * one marked) with an expand button at the top. The state is remembered per
 * screen in localStorage (try/catch around every read and write, so a
 * blocked storage only forgets). It is independent of the sidebar: with
 * both collapsed the detail takes the full width. On a phone the pane is
 * the whole list screen, so the toggle and the rail do not render there.
 *
 * @param {object} props
 * @param {string} props.id        storage key suffix (clients, leads, deals, triage, tasks)
 * @param {string} props.label     the aside's accessible name
 * @param {Array<{ id, name, selected, onOpen }>} [props.rail]  the rows the rail switches between (at most 60 drawn)
 * @param {import('react').ReactNode} [props.head]  content above the list when expanded (a count line)
 */
const KEY = (id) => `vz_pane_${id}`;
const readCollapsed = (id) => { try { return localStorage.getItem(KEY(id)) === '1'; } catch { return false; } };
const writeCollapsed = (id, v) => { try { localStorage.setItem(KEY(id), v ? '1' : '0'); } catch { /* private mode or blocked */ } };

export default function CollapsiblePane({ id, label, rail = [], head = null, className = '', children }) {
  const phone = useMediaQuery('(max-width: 767px)');
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id));
  const toggle = useCallback(() => setCollapsed(c => { writeCollapsed(id, !c); return !c; }), [id]);
  const railOn = collapsed && !phone;
  return (
    <aside className={`aa-panel v-pane ${className}${railOn ? ' is-collapsed' : ''}`.trim()} aria-label={label} data-pane={id} data-collapsed={railOn ? 'true' : 'false'}>
      <div className="v-pane-head">
        {!railOn && head}
        <IconButton icon={railOn ? 'ChevronRight' : 'ChevronLeft'} label={railOn ? `Expand the ${label.toLowerCase()} list` : `Collapse the ${label.toLowerCase()} list`} tooltip={false}
          aria-expanded={!railOn} onClick={toggle} className="v-pane-toggle" />
      </div>
      {railOn ? (
        <div className="v-pane-rail" role="list" aria-label={`${label}, collapsed`}>
          {rail.slice(0, 60).map(r => (
            <div key={r.id} role="listitem" className="v-pane-railrow">
              <Tooltip label={r.name} side="top">
                <button type="button" className={`v-pane-item${r.selected ? ' is-active' : ''}`} onClick={r.onOpen} aria-label={r.name} aria-current={r.selected ? 'true' : undefined}>
                  <Avatar name={r.name} size="sm" />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      ) : children}
    </aside>
  );
}

export const collapsiblePaneStyles = `
  .v-pane { transition: width var(--v-dur-base) var(--v-ease-out); }
  .v-pane-head { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-2); min-width: 0; }
  .v-pane-head:empty { display: none; }
  .v-pane-toggle { display: none; flex-shrink: 0; margin-left: auto; }
  @media (min-width: 768px) { .v-pane-toggle { display: inline-flex; } }
  .v-pane.is-collapsed { width: var(--lay-rail-w); padding-left: var(--v-space-2); padding-right: var(--v-space-2); }
  .v-pane.is-collapsed .v-pane-head { justify-content: center; }
  .v-pane.is-collapsed .v-pane-toggle { margin-left: 0; }
  .v-pane-rail { display: flex; flex-direction: column; align-items: center; gap: var(--v-space-1); min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; padding-bottom: var(--v-space-2); }
  .v-pane-rail::-webkit-scrollbar { display: none; }
  .v-pane-railrow { display: flex; }
  .v-pane-item { display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); padding: 0; border: 2px solid transparent; border-radius: var(--v-radius-pill); background: transparent; cursor: pointer; transition: border-color var(--v-dur-fast) var(--v-ease-out), background var(--v-dur-fast) var(--v-ease-out); }
  .v-pane-item:hover { background: var(--v-surface-2); }
  .v-pane-item:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-pane-item.is-active { border-color: var(--v-red); }
`;
