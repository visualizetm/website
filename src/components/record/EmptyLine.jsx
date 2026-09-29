import { Button } from '../../ui';

/* Law 6 of the record: every section's empty state is one line with one
 * action, never a card per empty thing. `text` is a COPY.empty title. */
export default function EmptyLine({ text, action = null, className = '' }) {
  return (
    <div className={`rc-empty ${className}`.trim()}>
      <span className="rc-empty-text">{text}</span>
      {action && <Button variant="ghost" size="md" icon={action.icon || 'Plus'} onClick={action.onClick} className={action.className}>{action.label}</Button>}
    </div>
  );
}
