import { Component } from 'react';
import ErrorState from './ErrorState';
import { logClient } from '../shared/log';
/**
 * ErrorBoundary (Prompt 15): catches a render error below it, logs it to
 * /api/admin/log, and shows the kit ErrorState with a Reload button while the
 * rest of the shell stays alive. PageShell wraps its children in one, so
 * every screen region has its own; AdminApp keys another by section.
 * @param {object} props
 * @param {string} [props.label] what broke, for the message ("this screen")
 * @param {Function} [props.fallback] (error, reset) => node, replaces the default ErrorState
 * @param {Function} [props.onError]
 */
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; this.reset = this.reset.bind(this); }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    logClient({ kind: 'boundary', message: `${this.props.label || 'screen'}: ${error?.message || String(error)}`, stack: `${error?.stack || ''}\n${info?.componentStack || ''}`.trim() });
    this.props.onError?.(error, info);
  }
  reset() { this.setState({ error: null }); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="v-boundary">
        <ErrorState title={`Something broke on ${this.props.label || 'this screen'}`} description="The rest of the app is fine. Reload this screen; the error is saved under Settings, Automation." onRetry={() => (this.props.reload ? window.location.reload() : this.reset())} retryLabel="Reload" details={`${error?.message || error}\n${error?.stack || ''}`.trim()} />
      </div>
    );
  }
}
export const errorBoundaryStyles = `
  .v-boundary { flex: 1; min-width: 0; padding: var(--v-space-4) var(--v-gutter-r) var(--v-space-4) var(--v-gutter-l); }
  .v-boundary .v-error { max-width: 640px; margin: 0 auto; }
`;
