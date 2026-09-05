/**
 * PageShell: the full-height flex column every admin page renders inside.
 * Hosts one ScrollArea and any StickyFooterBar as in-flow siblings. Its
 * children render inside an ErrorBoundary (Prompt 15), so a render error in
 * one screen region shows the kit ErrorState there and leaves the shell alive.
 * @param {object} props
 * @param {string} [props.className]
 * @param {string} [props.label] names the region in the boundary's message
 * @param {import('react').ReactNode} props.children
 */
import ErrorBoundary from './ErrorBoundary';
export default function PageShell({ className = '', label, children, ...rest }) {
  return <div className={`lay-shell ${className}`.trim()} {...rest}><ErrorBoundary label={label || 'this screen'}>{children}</ErrorBoundary></div>;
}

export const pageShellStyles = `
  .lay-shell {
    flex: 1 1 auto; display: flex; flex-direction: column;
    min-width: 0; min-height: 0;
    width: 100%; max-width: 100%;
    position: relative;
  }
  /* Page crossfade (Prompt 14). The shell stays mounted on a route change and
     only the content region re-enters: AppShell keys .sh-content by nav id and
     gives it .lay-view, which fades in over --v-dur-base. This is the one
     page level transition; screens do not add their own. */
  .lay-view { animation: lay-view-in var(--v-dur-base) var(--v-ease-out) both; }
  @keyframes lay-view-in { from { opacity: 0; } to { opacity: 1; } }
  /* Tab switches inside a screen crossfade the content only (Settings, the call room, LeadDetail). */
  .lay-tabbody { animation: lay-view-in var(--v-dur-base) var(--v-ease-out) both; min-width: 0; }
`;
