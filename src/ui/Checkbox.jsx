import { useEffect, useId, useRef } from 'react';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Minus from '@untitled-ui/icons-react/build/esm/Minus';
/**
 * Checkbox with label; supports indeterminate for "some selected" headers.
 * @param {object} props
 * @param {boolean} props.checked
 * @param {Function} props.onChange (next: boolean) => void
 * @param {string} [props.label]
 * @param {boolean} [props.indeterminate]
 * @param {boolean} [props.disabled]
 */
export default function Checkbox({ checked, onChange, label, indeterminate = false, disabled = false, className = '', ...rest }) {
  const id = useId();
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return (
    <label className={`v-check${disabled ? ' is-disabled' : ''}${!label ? ' v-check--bare' : ''} ${className}`.trim()} htmlFor={id}>
      <span className="v-check-box">
        <input ref={ref} id={id} type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} {...rest} />
        <span className="v-check-mark">{indeterminate ? <Minus width={12} height={12} /> : <Check width={12} height={12} />}</span>
      </span>
      {label && <span className="v-check-label">{label}</span>}
    </label>
  );
}

export const checkboxStyles = `
  .v-check { display: inline-flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap); cursor: pointer; min-width: 0; -webkit-tap-highlight-color: transparent; }
  .v-check--bare { min-width: var(--v-tap); justify-content: center; }
  .v-check.is-disabled { opacity: 0.55; cursor: not-allowed; }
  .v-check-box { position: relative; flex-shrink: 0; width: 22px; height: 22px; border-radius: var(--v-radius-sm); background: var(--v-surface-2); border: 1px solid var(--v-border-strong); transition: background var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out); }
  .v-check-box input { position: absolute; inset: -11px; opacity: 0; margin: 0; width: calc(100% + 22px); height: calc(100% + 22px); cursor: inherit; }
  .v-check-mark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--v-text-on-red); opacity: 0; transform: scale(0.6); transition: opacity var(--v-dur-fast) var(--v-ease-out), transform var(--v-dur-fast) var(--v-ease-spring); pointer-events: none; }
  .v-check-box:has(input:checked), .v-check-box:has(input:indeterminate) { background: var(--v-red-hover); border-color: var(--v-red); }
  .v-check-box:has(input:checked) .v-check-mark, .v-check-box:has(input:indeterminate) .v-check-mark { opacity: 1; transform: scale(1); }
  .v-check-box:has(input:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .v-check-label { font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text); }
`;
