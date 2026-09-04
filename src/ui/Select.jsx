import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import FieldShell from './FieldShell';
/**
 * Select: native select on the shared FieldShell (native picker on mobile is the right call).
 * @param {object} props
 * @param {Array<{id: string, label: string, disabled?: boolean}>} [props.options] or pass <option> children
 * @param {string} [props.placeholder] renders a disabled first option
 */
export default function Select({ label, hint, error, leading, required, disabled, id, className = '', options, placeholder, children, ...rest }) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} leading={leading} trailing={<ChevronDown width={16} height={16} aria-hidden="true" />} required={required} disabled={disabled} className={className}>
      {(a) => (
        <select className="v-field-control" {...a} {...rest}>
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options ? options.map(o => <option key={o.id} value={o.id} disabled={o.disabled}>{o.label}</option>) : children}
        </select>
      )}
    </FieldShell>
  );
}
export const selectStyles = `
  .v-field-shell:has(select) .v-field-trail { pointer-events: none; margin-left: calc(-1 * var(--v-space-6)); }
`;
