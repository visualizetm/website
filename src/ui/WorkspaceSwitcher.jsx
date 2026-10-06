import { Icon } from './icons';
import Tooltip from './Tooltip';

/**
 * WorkspaceSwitcher (the nav revamp): two or three workspaces as one
 * segmented control at the top of the sidebar; collapsed to the rail it is
 * the same options stacked as icon buttons with tooltips. Radio semantics,
 * arrow keys move, every option a 44px target.
 * @param {object} props
 * @param {Array<{ id, label, icon }>} props.options
 * @param {string} props.value
 * @param {(id: string) => void} props.onChange
 * @param {boolean} [props.collapsed]
 * @param {string} [props.label]
 */
export default function WorkspaceSwitcher({ options, value, onChange, collapsed = false, label = 'Workspace', className = '' }) {
  const onKey = (e) => {
    const i = options.findIndex(o => o.id === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onChange(options[(i + 1) % options.length].id); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onChange(options[(i - 1 + options.length) % options.length].id); }
  };
  return (
    <div className={`v-ws${collapsed ? ' v-ws--rail' : ''} ${className}`.trim()} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map(o => {
        const on = o.id === value;
        const btn = (
          <button key={o.id} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} aria-label={collapsed ? o.label : undefined}
            className={`v-ws-opt${on ? ' is-on' : ''}`} onClick={() => onChange(o.id)} data-ws={o.id}>
            {o.icon && <Icon icon={o.icon} size={16} />}
            {!collapsed && <span className="v-ws-label">{o.label}</span>}
          </button>
        );
        return collapsed ? <Tooltip key={o.id} label={o.label} side="top">{btn}</Tooltip> : btn;
      })}
    </div>
  );
}

export const workspaceSwitcherStyles = `
  .v-ws { display: flex; align-items: stretch; gap: 2px; padding: 2px; background: var(--v-sidebar-hover); border: 1px solid var(--v-sidebar-border); border-radius: var(--v-radius-md); min-width: 0; }
  .v-ws--rail { flex-direction: column; align-items: center; background: transparent; border: 0; padding: 0; gap: var(--v-space-1); }
  .v-ws-opt { min-height: var(--v-tap);
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: var(--v-space-2);
    min-height: 40px; min-width: 0; padding: 0 var(--v-space-2); border: 0; border-radius: calc(var(--v-radius-md) - 2px);
    background: transparent; color: var(--v-sidebar-text-2); cursor: pointer;
    font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold);
    transition: background var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out);
  }
  .v-ws--rail .v-ws-opt { flex: 0 0 auto; width: var(--v-tap); height: var(--v-tap); padding: 0; border-radius: var(--v-radius-md); }
  .v-ws-opt:hover { color: var(--v-sidebar-text); }
  .v-ws-opt.is-on { background: var(--v-sidebar-active-bg); color: var(--v-sidebar-active); }
  .v-ws-opt:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .v-ws-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
