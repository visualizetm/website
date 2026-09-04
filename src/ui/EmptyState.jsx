import { Icon } from './icons';
import Button from './Button';
/**
 * EmptyState: warm and specific. Say what will appear here and how to make it happen.
 * @param {object} props
 * @param {string|Function} [props.icon]
 * @param {string} props.title
 * @param {string} [props.description] one line
 * @param {{label: string, onClick?: Function, href?: string, icon?: any}} [props.action] primary
 * @param {{label: string, onClick?: Function, href?: string}} [props.secondary] link-style
 * @param {'sm'|'md'} [props.size='md']
 */
export default function EmptyState({ icon, title, description, action, secondary, size = 'md', className = '', ...rest }) {
  return (
    <div className={`v-empty v-empty--${size} ${className}`.trim()} role="status" {...rest}>
      {icon && <span className="v-empty-icon"><Icon icon={icon} size="var(--v-icon-lg)" /></span>}
      <p className="v-empty-title">{title}</p>
      {description && <p className="v-empty-desc">{description}</p>}
      {(action || secondary) && (
        <div className="v-empty-actions">
          {action && <Button variant="primary" size="md" icon={action.icon} onClick={action.onClick} href={action.href}>{action.label}</Button>}
          {secondary && <Button variant="ghost" size="md" onClick={secondary.onClick} href={secondary.href}>{secondary.label}</Button>}
        </div>
      )}
    </div>
  );
}

export const emptyStateStyles = `
  .v-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--v-space-2); padding: var(--v-space-8) var(--v-space-4); min-width: 0; }
  .v-empty--sm { padding: var(--v-space-5) var(--v-space-3); }
  .v-empty-icon { display: inline-flex; width: 56px; height: 56px; align-items: center; justify-content: center; border-radius: var(--v-radius-lg); background: var(--v-red-soft); color: var(--v-red-highlight); margin-bottom: var(--v-space-2); }
  .v-empty-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); }
  .v-empty--sm .v-empty-title { font-size: var(--v-text-xl); line-height: var(--v-lh-xl); }
  .v-empty-desc { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); max-width: 420px; }
  .v-empty-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--v-space-2); margin-top: var(--v-space-3); }
`;
