import { useId } from 'react';
/**
 * Toggle: on/off switch with a label. Tap target is the whole row.
 * @param {object} props
 * @param {boolean} props.checked
 * @param {Function} props.onChange (next: boolean) => void
 * @param {string} [props.label]
 * @param {string} [props.description]
 * @param {boolean} [props.disabled]
 * @param {'sm'|'md'} [props.size='md']
 */
export default function Toggle({ checked, onChange, label, description, disabled = false, size = 'md', className = '', ...rest }) {
  const id = useId();
  return (
    <label className={`v-toggle v-toggle--${size}${disabled ? ' is-disabled' : ''} ${className}`.trim()} htmlFor={id}>
      {(label || description) && (
        <span className="v-toggle-text">
          {label && <span className="v-toggle-label">{label}</span>}
          {description && <span className="v-toggle-desc">{description}</span>}
        </span>
      )}
      <span className="v-toggle-track">
        <input id={id} type="checkbox" role="switch" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} {...rest} />
        <span className="v-toggle-thumb" />
      </span>
    </label>
  );
}

export const toggleStyles = `
  .v-toggle { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); min-height: var(--v-tap); cursor: pointer; min-width: 0; -webkit-tap-highlight-color: transparent; }
  .v-toggle.is-disabled { opacity: 0.55; cursor: not-allowed; }
  .v-toggle-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .v-toggle-label { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .v-toggle-desc { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .v-toggle-track { position: relative; flex-shrink: 0; width: 46px; height: 26px; border-radius: var(--v-radius-pill); background: var(--v-surface-3); border: 1px solid var(--v-border-strong); transition: background var(--v-dur-base) var(--v-ease-out), border-color var(--v-dur-base) var(--v-ease-out); }
  .v-toggle--sm .v-toggle-track { width: 38px; height: 22px; }
  .v-toggle-track input { position: absolute; inset: 0; opacity: 0; margin: 0; width: 100%; height: 100%; cursor: inherit; }
  .v-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--v-text-2); transition: transform var(--v-dur-base) var(--v-ease-spring), background var(--v-dur-base) var(--v-ease-out); pointer-events: none; }
  .v-toggle--sm .v-toggle-thumb { width: 16px; height: 16px; }
  .v-toggle-track:has(input:checked) { background: var(--v-red-hover); border-color: var(--v-red); }
  .v-toggle-track:has(input:checked) .v-toggle-thumb { transform: translateX(20px); background: var(--v-text-on-red); }
  .v-toggle--sm .v-toggle-track:has(input:checked) .v-toggle-thumb { transform: translateX(16px); }
  .v-toggle-track:has(input:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
`;
