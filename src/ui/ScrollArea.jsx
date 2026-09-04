/**
 * ScrollArea: the only sanctioned scroll container. Gutter padding that
 * respects the notch, overflow-x clipped, content centered in .lay-content.
 * @param {object} props
 * @param {boolean} [props.wide] use the wide content width (dashboards)
 * @param {boolean} [props.bare] skip the centered .lay-content wrapper
 * @param {string} [props.className]
 * @param {string} [props.contentClassName]
 */
export default function ScrollArea({ className = '', contentClassName = '', wide = false, bare = false, children, ...rest }) {
  return (
    <div className={`lay-scroll ${className}`.trim()} {...rest}>
      {bare ? children : (
        <div className={`lay-content${wide ? ' lay-content--wide' : ''} ${contentClassName}`.trim()}>
          {children}
        </div>
      )}
    </div>
  );
}

export const scrollAreaStyles = `
  .lay-scroll {
    flex: 1 1 auto; min-height: 0; min-width: 0;
    overflow-y: auto; overflow-x: clip;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: var(--v-gutter) var(--v-gutter-r)
             calc(var(--v-gutter) + var(--v-scroll-extra, 0px))
             var(--v-gutter-l);
    scroll-padding-bottom: calc(var(--v-scroll-extra, 0px) + var(--v-space-4));
  }
  .lay-content {
    width: 100%; max-width: var(--v-content-w); margin: 0 auto;
    min-width: 0;
    display: flex; flex-direction: column; gap: var(--v-stack-gap, var(--v-space-5));
  }
  .lay-content--wide { max-width: var(--v-content-w-wide); }

  /* Card / list-row contract: never wider than the parent, children can
     shrink, titles truncate one line. */
  .lay-card { width: 100%; max-width: 100%; min-width: 0; }
  .lay-card > * { min-width: 0; }
  .lay-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* Overlay contract for anything positioned over the page */
  .lay-overlay {
    position: fixed; inset: 0;
    padding: max(var(--v-space-4), var(--v-inset-top)) max(var(--v-space-4), env(safe-area-inset-right))
             max(var(--v-space-4), var(--v-inset-bottom)) max(var(--v-space-4), env(safe-area-inset-left));
  }
  .lay-modal-box {
    max-width: 100%; min-width: 0;
    max-height: calc(100dvh - var(--v-space-8) - var(--v-inset-top) - var(--v-inset-bottom));
    overflow-y: auto; overscroll-behavior: contain;
  }
`;
