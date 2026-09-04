import { useId } from 'react';
/**
 * FieldShell: the label / hint / error / slots wrapper shared by Input,
 * Textarea, and Select. Render-prop children receive the input id and
 * aria attributes to spread onto the control.
 * @param {object} props
 * @param {string} [props.label]
 * @param {string} [props.hint]
 * @param {string} [props.error] replaces the hint and turns the border danger
 * @param {import('react').ReactNode} [props.leading] icon or text inside the shell, left
 * @param {import('react').ReactNode} [props.trailing] right slot (button, unit)
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {Function} props.children ({ id, 'aria-describedby', 'aria-invalid' }) => control
 */
export default function FieldShell({ id: idProp, label, hint, error, leading, trailing, required, disabled, multiline = false, className = '', children }) {
  const auto = useId();
  const id = idProp || auto;
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className={`v-field${error ? ' has-error' : ''}${disabled ? ' is-disabled' : ''}${multiline ? ' v-field--multi' : ''} ${className}`.trim()}>
      {label && <label className="v-field-label" htmlFor={id}>{label}{required && <span className="v-field-req" aria-hidden="true"> *</span>}</label>}
      <div className="v-field-shell">
        {leading && <span className="v-field-lead">{leading}</span>}
        {children({ id, 'aria-describedby': descId, 'aria-invalid': error ? true : undefined, disabled, required })}
        {trailing && <span className="v-field-trail">{trailing}</span>}
      </div>
      {(error || hint) && <p id={descId} className={`v-field-msg${error ? ' v-field-msg--error' : ''}`} role={error ? 'alert' : undefined}>{error || hint}</p>}
    </div>
  );
}

export const fieldShellStyles = `
  .v-field { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; width: 100%; }
  .v-field-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .v-field-req { color: var(--v-red-highlight); }
  .v-field-shell {
    display: flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-control-h); min-width: 0;
    background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md);
    padding: 0 var(--v-space-3);
    transition: border-color var(--v-dur-fast) var(--v-ease-out), box-shadow var(--v-dur-fast) var(--v-ease-out);
  }
  .v-field--multi .v-field-shell { align-items: flex-start; padding-top: var(--v-space-3); padding-bottom: var(--v-space-3); }
  .v-field-shell:focus-within { border-color: var(--v-border-focus); box-shadow: 0 0 0 3px var(--v-red-soft); }
  .v-field.has-error .v-field-shell { border-color: var(--v-status-danger-text); }
  .v-field.has-error .v-field-shell:focus-within { box-shadow: 0 0 0 3px var(--v-status-danger-soft); }
  .v-field.is-disabled .v-field-shell { opacity: 0.55; }
  .v-field-lead, .v-field-trail { display: inline-flex; align-items: center; gap: var(--v-space-1); flex-shrink: 0; color: var(--v-text-3); font-size: var(--v-text-sm); }
  .v-field-control {
    flex: 1; min-width: 0; width: 100%; min-height: calc(var(--v-control-h) - 2px);
    background: transparent; border: 0; outline: 0; color: var(--v-text);
    font-family: var(--v-font-body); font-size: var(--v-text-md); line-height: var(--v-lh-md);
  }
  .v-field-control::placeholder { color: var(--v-text-3); }
  .v-field-control:disabled { cursor: not-allowed; }
  textarea.v-field-control { min-height: 0; resize: vertical; padding: 0; }
  select.v-field-control { appearance: none; -webkit-appearance: none; cursor: pointer; padding-right: var(--v-space-6); }
  .v-field-msg { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .v-field-msg--error { color: var(--v-status-danger-text); }
`;
