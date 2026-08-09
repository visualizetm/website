/* Admin layout primitives — the ONE place layout structure is defined.
 *
 * Every admin surface renders inside these. The rules:
 *   - Every page body is a <PageShell> (or carries .lay-shell).
 *   - Every scrolling list/detail area is a <ScrollArea> (.lay-scroll),
 *     with centered content in .lay-content / .lay-content--wide.
 *   - Every pinned bottom action area is a <StickyFooterBar> (.lay-footbar):
 *     IN-FLOW (a flex sibling below the scroll area), solid background,
 *     safe-area aware. Because it is in normal flow it is structurally
 *     incapable of covering the last list item.
 *   - List rows/cards carry .lay-card for the width/min-width/truncation
 *     contract.
 *
 * All shared measurements live as CSS variables on .lay-root so every
 * primitive (and any page-specific rule) reads the same numbers.
 * See LAYOUT.md at the repo root.
 */

export function PageShell({ className = '', children, ...rest }) {
  return <div className={`lay-shell ${className}`.trim()} {...rest}>{children}</div>;
}

export function ScrollArea({ className = '', contentClassName = '', wide = false, bare = false, children, ...rest }) {
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

export function StickyFooterBar({ className = '', children, ...rest }) {
  return <div className={`lay-footbar ${className}`.trim()} {...rest}>{children}</div>;
}

export const adminLayoutStyles = `
  /* ── Shared measurements: change them here, everywhere follows ── */
  .lay-root {
    --lay-gutter: clamp(16px, 3vw, 24px);        /* horizontal page padding */
    --lay-gutter-l: max(var(--lay-gutter), env(safe-area-inset-left));
    --lay-gutter-r: max(var(--lay-gutter), env(safe-area-inset-right));
    --lay-safe-top: env(safe-area-inset-top, 0px);
    --lay-safe-bottom: env(safe-area-inset-bottom, 0px);
    --lay-content-w: 760px;                       /* detail / list content */
    --lay-content-w-wide: 900px;                  /* dashboard-style pages */
    --lay-tabbar-h: 58px;                         /* mobile bottom tab bar */
    --lay-panel-w: 324px;                         /* desktop contextual panel */
    --lay-rail-w: 68px;                           /* desktop icon rail */
    --lay-bar-bg: #0a0a0a;                        /* pinned bar surface — solid */
    --lay-border: rgba(255,255,255,0.08);
    width: 100%; max-width: 100%; min-width: 0;
    overflow-x: clip;
  }

  /* ── PageShell: a full-height column that can host scroll + pinned bars ── */
  .lay-shell {
    flex: 1 1 auto; display: flex; flex-direction: column;
    min-width: 0; min-height: 0;
    width: 100%; max-width: 100%;
    position: relative;
  }

  /* ── ScrollArea: the standard scroll container ──
     Bottom padding clears any overlay via --lay-scroll-extra (0 by default —
     pinned bars are in-flow siblings, so nothing needs clearing). */
  .lay-scroll {
    flex: 1 1 auto; min-height: 0; min-width: 0;
    overflow-y: auto; overflow-x: clip;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding: var(--lay-gutter) var(--lay-gutter-r)
             calc(var(--lay-gutter) + var(--lay-scroll-extra, 0px))
             var(--lay-gutter-l);
    scroll-padding-bottom: calc(var(--lay-scroll-extra, 0px) + 16px);
  }
  .lay-content {
    width: 100%; max-width: var(--lay-content-w); margin: 0 auto;
    min-width: 0;
    display: flex; flex-direction: column; gap: var(--lay-stack-gap, 20px);
  }
  .lay-content--wide { max-width: var(--lay-content-w-wide); }

  /* ── StickyFooterBar: pinned bottom actions, in-flow, opaque, safe ── */
  .lay-footbar {
    flex-shrink: 0;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 10px var(--lay-gutter-r) calc(10px + var(--lay-safe-bottom)) var(--lay-gutter-l);
    background: var(--lay-bar-bg);
    border-top: 1px solid var(--lay-border);
  }

  /* ── Card / list-row contract ──
     A row can never poke past its parent; its flexible children can always
     shrink; titles truncate to one line (the site-wide list treatment). */
  .lay-card { width: 100%; max-width: 100%; min-width: 0; }
  .lay-card > * { min-width: 0; }
  .lay-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* ── Overlays / modals / sheets: never wider or taller than the viewport,
     internal scroll, safe-area aware ── */
  .lay-overlay {
    position: fixed; inset: 0;
    padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
             max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  }
  .lay-modal-box {
    max-width: 100%; min-width: 0;
    max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    overflow-y: auto; overscroll-behavior: contain;
  }
`;
