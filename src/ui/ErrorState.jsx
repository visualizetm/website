import { useState } from 'react';
import AlertCircle from '@untitled-ui/icons-react/build/esm/AlertCircle';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import Button from './Button';
/**
 * ErrorState: something failed, here is how to try again.
 * @param {object} props
 * @param {string} [props.title='Could not load this']
 * @param {string} [props.description]
 * @param {Function} [props.onRetry]
 * @param {string} [props.details] technical detail behind a disclosure
 * @param {boolean} [props.retrying]
 */
export default function ErrorState({ title = 'Could not load this', description = 'Check the connection and try again.', onRetry, details, retrying = false, className = '', ...rest }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`v-error ${className}`.trim()} role="alert" {...rest}>
      <span className="v-error-icon"><AlertCircle width={22} height={22} aria-hidden="true" /></span>
      <div className="v-error-body">
        <p className="v-error-title">{title}</p>
        {description && <p className="v-error-desc">{description}</p>}
        <div className="v-error-actions">
          {onRetry && <Button variant="secondary" size="md" icon={RefreshCw01} loading={retrying} onClick={onRetry}>Try again</Button>}
          {details && <Button variant="ghost" size="md" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Hide details' : 'Show details'}</Button>}
        </div>
        {details && open && <pre className="v-error-details">{details}</pre>}
      </div>
    </div>
  );
}

export const errorStateStyles = `
  .v-error { display: flex; gap: var(--v-space-3); padding: var(--v-space-4); border-radius: var(--v-radius-lg); background: var(--v-status-danger-soft); border: 1px solid color-mix(in srgb, var(--v-status-danger-text) 30%, transparent); min-width: 0; }
  .v-error-icon { color: var(--v-status-danger-text); flex-shrink: 0; display: inline-flex; padding-top: 2px; }
  .v-error-body { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; flex: 1; }
  .v-error-title { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .v-error-desc { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .v-error-actions { display: flex; flex-wrap: wrap; gap: var(--v-space-2); margin-top: var(--v-space-2); }
  .v-error-details { margin: var(--v-space-2) 0 0; padding: var(--v-space-3); background: var(--v-ground); border-radius: var(--v-radius-md); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 200px; overflow: auto; }
`;
