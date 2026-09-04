import FieldShell from './FieldShell';
/**
 * Textarea: multi-line field on the shared FieldShell. Same label/hint/error props as Input.
 * @param {object} props
 * @param {number} [props.rows=3]
 */
export default function Textarea({ label, hint, error, leading, trailing, required, disabled, id, className = '', rows = 3, ...rest }) {
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} leading={leading} trailing={trailing} required={required} disabled={disabled} multiline className={className}>
      {(a) => <textarea className="v-field-control" rows={rows} {...a} {...rest} />}
    </FieldShell>
  );
}
export const textareaStyles = '';
