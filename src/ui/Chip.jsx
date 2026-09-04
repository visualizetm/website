import { Icon } from './icons';
import Check from '@untitled-ui/icons-react/build/esm/Check';
/**
 * Chip: the selectable filter chip (label, count, selected).
 * @param {object} props
 * @param {string} props.label
 * @param {number} [props.count]
 * @param {boolean} [props.selected]
 * @param {string|Function} [props.icon]
 * @param {Function} [props.onClick]
 * @param {boolean} [props.disabled]
 */
export default function Chip({ label, count, selected = false, icon, onClick, disabled = false, className = '', ...rest }) {
  return (
    <button type="button" className={`v-chip${selected ? ' is-selected' : ''} ${className}`.trim()} aria-pressed={selected} onClick={onClick} disabled={disabled} {...rest}>
      {selected ? <Check width={13} height={13} aria-hidden="true" /> : icon ? <Icon icon={icon} size={13} /> : null}
      <span className="v-chip-label">{label}</span>
      {typeof count === 'number' && <span className="v-chip-count">{count}</span>}
    </button>
  );
}

/**
 * ChipGroup: single or multi select over Chip. With allWhenEmpty (default),
 * an empty selection means "all of them" and every chip reads unselected.
 * @param {object} props
 * @param {Array<{id: string, label: string, count?: number, icon?: any}>} props.options
 * @param {Set|Array|string|null} props.value selected id(s)
 * @param {Function} props.onChange receives a Set (multi) or id|null (single)
 * @param {boolean} [props.multi=true]
 * @param {boolean} [props.allWhenEmpty=true]
 * @param {string} [props.label] group label for assistive tech
 */
export function ChipGroup({ options, value, onChange, multi = true, allWhenEmpty = true, label, className = '' }) {
  const sel = multi ? new Set(value instanceof Set ? value : value || []) : value;
  const isOn = (id) => (multi ? sel.has(id) : sel === id);
  const toggle = (id) => {
    if (multi) { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); onChange(n); }
    else onChange(sel === id && allWhenEmpty ? null : id);
  };
  const empty = multi ? sel.size === 0 : sel == null;
  return (
    <div className={`v-chipgroup ${className}`.trim()} role="group" aria-label={label}>
      {options.map(o => <Chip key={o.id} label={o.label} count={o.count} icon={o.icon} selected={isOn(o.id)} onClick={() => toggle(o.id)} />)}
      {allWhenEmpty && empty && <span className="v-chipgroup-all">All</span>}
    </div>
  );
}

export const chipStyles = `
  .v-chip {
    display: inline-flex; align-items: center; gap: var(--v-space-2); flex-shrink: 0;
    min-height: var(--v-tap); padding: 0 var(--v-space-4); border-radius: var(--v-radius-md);
    background: var(--v-surface-2); border: 1px solid var(--v-border); color: var(--v-text-2); cursor: pointer;
    font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); letter-spacing: 0.02em; white-space: nowrap;
    -webkit-tap-highlight-color: transparent; touch-action: manipulation;
    transition: background var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out), transform var(--v-dur-fast) var(--v-ease-out);
  }
  .v-chip:hover { border-color: var(--v-border-strong); color: var(--v-text); }
  .v-chip:active { transform: scale(0.97); }
  .v-chip:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-chip:disabled { opacity: 0.5; cursor: not-allowed; }
  .v-chip.is-selected { background: var(--v-red-soft); border-color: var(--v-red); color: var(--v-text); }
  .v-chip-count { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: var(--v-radius-pill); background: var(--v-surface-3); color: var(--v-text-3); font-size: var(--v-text-xs); font-variant-numeric: tabular-nums; }
  .v-chip.is-selected .v-chip-count { background: var(--v-red); color: var(--v-text-on-red); }
  .v-chipgroup { display: flex; flex-wrap: wrap; align-items: center; gap: var(--v-space-2); min-width: 0; }
  .v-chipgroup-all { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); padding: 0 var(--v-space-1); }
`;
