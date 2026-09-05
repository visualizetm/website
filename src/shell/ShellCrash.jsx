import { uiStyles, ErrorBoundary } from '../ui';
import { logClient } from '../shared/log';
/**
 * ShellCrash (Prompt 15): the top level boundary around the admin. If the
 * shell itself fails to render, this shows the login card outline with a
 * message and a Reload button instead of a blank page. The error is logged
 * like any other (Settings, Automation once the app loads again).
 */
export default function ShellCrash({ children }) {
  return (
    <ErrorBoundary label="the app shell" onError={(e) => logClient({ kind: 'boundary', message: `shell: ${e?.message || e}`, stack: e?.stack })} fallback={(error) => (
      <div className="lay-root aa-loginpage sh-crash">
        <div className="v-card lay-card v-card--l1 sh-crash-card" role="alert">
          <p className="sh-crash-title">Visualize could not start</p>
          <p className="sh-crash-text">The shell hit an error before it could draw. Reload the page; if it keeps happening, the message below is what to send along.</p>
          <pre className="sh-crash-detail">{String(error?.message || error)}</pre>
          <button type="button" className="v-btn v-btn--primary v-btn--md v-btn--full" onClick={() => window.location.reload()}><span className="v-btn-inner"><span className="v-btn-label">Reload</span></span></button>
        </div>
        <style>{uiStyles + shellCrashStyles}</style>
      </div>
    )}>{children}</ErrorBoundary>
  );
}
export const shellCrashStyles = `
  .sh-crash { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); padding: var(--v-space-4); }
  .sh-crash-card { width: min(360px, 100%); gap: var(--v-space-3); padding: var(--v-space-6) var(--v-space-5); box-shadow: var(--v-shadow-3); }
  .sh-crash-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); }
  .sh-crash-text { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .sh-crash-detail { margin: 0; padding: var(--v-space-3); background: var(--v-surface-2); border-radius: var(--v-radius-md); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 120px; overflow: auto; }
`;
