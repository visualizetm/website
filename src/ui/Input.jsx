import FieldShell from './FieldShell';
/**
 * Input: single-line text field on the shared FieldShell.
 * @param {object} props
 * @param {string} [props.label]
 * @param {string} [props.hint]
 * @param {string} [props.error]
 * @param {import('react').ReactNode} [props.leading]
 * @param {import('react').ReactNode} [props.trailing]
 * @param {string} [props.inputMode] passthrough ('tel' for phone fields, 'numeric', 'email')
 * @param {string} [props.type='text']
 * Remaining props go to the <input>.
 */
export default function Input({ label, hint, error, leading, trailing, required, disabled, id, className = '', type = 'text', ...rest }) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} leading={leading} trailing={trailing} required={required} disabled={disabled} className={className}>
      {(a) => <input className="v-field-control" type={type} {...a} {...rest} />}
    </FieldShell>
  );
}
export const inputStyles = '';
