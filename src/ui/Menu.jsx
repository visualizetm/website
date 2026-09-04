import { useEffect, useRef, useState } from 'react';
import DotsVertical from '@untitled-ui/icons-react/build/esm/DotsVertical';
import Popover from './Popover';
import IconButton from './IconButton';
import { Icon } from './icons';
/**
 * Menu: the three-dot action menu on cards. Keyboard: arrows move, Enter selects, Escape closes.
 * @param {object} props
 * @param {Array<{id: string, label: string, icon?: any, danger?: boolean, disabled?: boolean, onSelect: Function}|'divider'>} props.items
 * @param {import('react').ReactElement} [props.trigger] custom trigger; default is a dots IconButton
 * @param {string} [props.label='Actions']
 * @param {'start'|'end'} [props.align='end']
 */
export default function Menu({ items, trigger, label = 'Actions', align = 'end', className = '' }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const listRef = useRef(null);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => listRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);
  const onKey = (e) => {
    const els = [...(listRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    const i = els.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
  };
  const trig = trigger
    ? <span ref={anchorRef} className="v-menu-trig" onClick={() => setOpen(o => !o)}>{trigger}</span>
    : <span ref={anchorRef} className="v-menu-trig"><IconButton icon={DotsVertical} label={label} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} /></span>;
  return (
    <span className={`v-menu ${className}`.trim()}>
      {trig}
      <Popover open={open} onClose={close} anchorRef={anchorRef} align={align} trap label={label}>
        <div ref={listRef} role="menu" aria-label={label} className="v-menu-list" onKeyDown={onKey}>
          {items.map((it, i) => it === 'divider' ? <hr key={`d${i}`} className="v-menu-div" /> : (
            <button key={it.id} type="button" role="menuitem" className={`v-menu-item${it.danger ? ' is-danger' : ''}`} disabled={it.disabled}
              onClick={() => { close(); it.onSelect?.(); }}>
              {it.icon && <Icon icon={it.icon} size="var(--v-icon-sm)" />}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      </Popover>
    </span>
  );
}
export const menuStyles = `
  .v-menu, .v-menu-trig { display: inline-flex; }
  .v-menu-list { display: flex; flex-direction: column; padding: var(--v-space-1); min-width: 200px; }
  .v-menu-item { display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-sm); background: transparent; color: var(--v-text); cursor: pointer; text-align: left; font-family: var(--v-font-body); font-size: var(--v-text-md); font-weight: var(--v-weight-medium); }
  .v-menu-item:hover, .v-menu-item:focus-visible { background: var(--v-surface-3); outline: 0; }
  .v-menu-item:focus-visible { box-shadow: inset 0 0 0 2px var(--v-border-focus); }
  .v-menu-item:disabled { opacity: 0.45; cursor: not-allowed; }
  .v-menu-item.is-danger { color: var(--v-status-danger-text); }
  .v-menu-div { border: 0; height: 1px; background: var(--v-border); margin: var(--v-space-1) 0; }
`;
