import { Icon } from './icons';
/**
 * SegmentedControl: Kanban / Table, Week / Day. Radio semantics, arrow keys move.
 * @param {object} props
 * @param {Array<{id: string, label: string, icon?: any}>} props.options
 * @param {string} props.value
 * @param {Function} props.onChange (id) => void
 * @param {'sm'|'md'} [props.size='md'] sm is the smaller label and padding; every option stays a full 44px target (Prompt 15)
 * @param {boolean} [props.full] stretch options evenly
 * @param {string} [props.label] group label
 */
export default function SegmentedControl({ options, value, onChange, size = 'md', full = false, label, className = '' }) {
  const onKey = (e) => {
    const i = options.findIndex(o => o.id === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onChange(options[(i + 1) % options.length].id); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onChange(options[(i - 1 + options.length) % options.length].id); }
  };
  return (
    <div className={`v-seg v-seg--${size}${full ? ' v-seg--full' : ''} ${className}`.trim()} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} className={`v-seg-opt${on ? ' is-on' : ''}`} onClick={() => onChange(o.id)}>
            {o.icon && <Icon icon={o.icon} size={14} />}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const segmentedControlStyles = `
  .v-seg { display: inline-flex; align-items: stretch; gap: 2px; padding: 2px; background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); min-width: 0; max-width: 100%; overflow-x: auto; }
  .v-seg--full { display: flex; width: 100%; }
  .v-seg--full .v-seg-opt { flex: 1; }
  .v-seg-opt {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--v-space-2);
    min-height: var(--v-tap); min-width: var(--v-tap); padding: 0 var(--v-space-3);
    border: 0; border-radius: calc(var(--v-radius-md) - 3px); background: transparent; color: var(--v-text-3); cursor: pointer;
    font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); white-space: nowrap;
    transition: background var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out);
  }
  .v-seg--sm .v-seg-opt { font-size: var(--v-text-xs); padding: 0 var(--v-space-2); }
  .v-seg-opt:hover { color: var(--v-text); }
  .v-seg-opt.is-on { background: var(--v-surface-3); color: var(--v-text); box-shadow: var(--v-shadow-1); }
  .v-seg-opt:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
`;
