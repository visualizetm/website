/**
 * StickyFooterBar: pinned bottom actions. Rendered IN FLOW as a sibling
 * below the ScrollArea, so it can never cover the last row. Opaque, safe-area aware.
 * @param {object} props
 * @param {string} [props.className]
 */
export default function StickyFooterBar({ className = '', children, ...rest }) {
  return <div className={`lay-footbar ${className}`.trim()} {...rest}>{children}</div>;
}

export const stickyFooterBarStyles = `
  .lay-footbar {
    flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center; gap: var(--v-space-2);
    padding: var(--v-space-3) var(--v-gutter-r) calc(var(--v-space-3) + var(--v-inset-bottom)) var(--v-gutter-l);
    background: var(--v-bar);
    border-top: 1px solid var(--v-border);
  }
`;
