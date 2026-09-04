/**
 * PageShell: the full-height flex column every admin page renders inside.
 * Hosts one ScrollArea and any StickyFooterBar as in-flow siblings.
 * @param {object} props
 * @param {string} [props.className]
 * @param {import('react').ReactNode} props.children
 */
export default function PageShell({ className = '', children, ...rest }) {
  return <div className={`lay-shell ${className}`.trim()} {...rest}>{children}</div>;
}

export const pageShellStyles = `
  .lay-shell {
    flex: 1 1 auto; display: flex; flex-direction: column;
    min-width: 0; min-height: 0;
    width: 100%; max-width: 100%;
    position: relative;
  }
`;
