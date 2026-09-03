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
  /* ══════════════════════════════════════════════════════════════
     VISUALIZE DARK — design tokens (Prompt 2). Prefix --v-.
     Dark is the only theme. Every admin surface reads these through
     var() from its CSS-in-JSX string; nothing imports anything.
     Full reference with contrast table: docs/TOKENS.md
     ══════════════════════════════════════════════════════════════ */
  .lay-root {
    /* Layers: ground → surface-1 → surface-2 → surface-3, each a step lighter */
    --v-ground: #080808;
    --v-surface-1: #121212;
    --v-surface-2: #1a1a1a;
    --v-surface-3: #232323;
    --v-overlay: rgba(0,0,0,0.65);
    --v-bar: #0a0a0a;                 /* pinned bars and rail (between ground and surface-1) */

    /* Lines */
    --v-border: rgba(255,255,255,0.08);
    --v-border-strong: rgba(255,255,255,0.16);
    --v-border-focus: #d44c43;

    /* Text: text-3 is the muted floor and passes 4.5:1 on every surface */
    --v-text: #fafafa;
    --v-text-2: #cccccc;
    --v-text-3: #8f8f8f;
    --v-text-inverse: #080808;
    --v-text-on-red: #ffffff;

    /* Brand */
    --v-red: #d44c43;
    --v-red-hover: #c2413a;
    --v-red-highlight: #e66b63;
    --v-red-soft: rgba(212,76,67,0.14);
    --v-red-glow: 0 8px 28px rgba(212,76,67,0.32);

    /* Semantic status set: -solid (fills; dark text), -soft (tints), -text (on dark) */
    --v-status-new-solid: #f59e0b;      --v-status-new-soft: rgba(245,158,11,0.14);   --v-status-new-text: #f59e0b;
    --v-status-progress-solid: #60a5fa; --v-status-progress-soft: rgba(96,165,250,0.14); --v-status-progress-text: #60a5fa;
    --v-status-callback-solid: #a78bfa; --v-status-callback-soft: rgba(167,139,250,0.14); --v-status-callback-text: #a78bfa;
    --v-status-booked-solid: #22c55e;   --v-status-booked-soft: rgba(34,197,94,0.14);  --v-status-booked-text: #22c55e;
    --v-status-won-solid: #d44c43;      --v-status-won-soft: rgba(212,76,67,0.16);    --v-status-won-text: #e66b63;
    --v-status-danger-solid: #dc2626;   --v-status-danger-soft: rgba(239,68,68,0.14);  --v-status-danger-text: #f87171;
    --v-status-neutral-solid: #8f8f8f;  --v-status-neutral-soft: rgba(255,255,255,0.07); --v-status-neutral-text: #8f8f8f;

    /* Charts */
    --v-chart-1: #d44c43; --v-chart-2: #60a5fa; --v-chart-3: #22c55e;
    --v-chart-4: #f59e0b; --v-chart-5: #a78bfa; --v-chart-6: #34d399;

    /* Typography */
    --v-font-display: 'Barlow Condensed', 'Inter', -apple-system, sans-serif;
    --v-font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --v-text-xs: 12px;  --v-lh-xs: 16px;  --v-ls-xs: 0.08em;    /* all-caps labels */
    --v-text-sm: 13px;  --v-lh-sm: 18px;  --v-ls-sm: 0;
    --v-text-md: 15px;  --v-lh-md: 22px;  --v-ls-md: 0;
    --v-text-lg: 17px;  --v-lh-lg: 24px;  --v-ls-lg: -0.005em;
    --v-text-xl: 20px;  --v-lh-xl: 26px;  --v-ls-xl: -0.01em;
    --v-text-2xl: 24px; --v-lh-2xl: 28px; --v-ls-2xl: -0.015em;
    --v-text-3xl: 30px; --v-lh-3xl: 34px; --v-ls-3xl: -0.02em;
    --v-display-sm: 32px; --v-lh-display-sm: 32px; --v-ls-display-sm: -0.01em;
    --v-display-md: 44px; --v-lh-display-md: 42px; --v-ls-display-md: -0.012em;
    --v-display-lg: 60px; --v-lh-display-lg: 56px; --v-ls-display-lg: -0.015em;
    --v-weight-regular: 400; --v-weight-medium: 500; --v-weight-semibold: 600; --v-weight-bold: 700;

    /* Spacing: 4px base */
    --v-space-1: 4px;  --v-space-2: 8px;  --v-space-3: 12px; --v-space-4: 16px;
    --v-space-5: 20px; --v-space-6: 24px; --v-space-7: 28px; --v-space-8: 32px;
    --v-space-9: 36px; --v-space-10: 40px; --v-space-11: 44px; --v-space-12: 48px;
    --v-gutter: clamp(16px, 3vw, 24px);                 /* 16 mobile → 24 desktop */
    --v-tabbar-h: 58px;
    --v-safe-bottom: calc(var(--v-tabbar-h) + env(safe-area-inset-bottom, 0px));

    /* Radius */
    --v-radius-sm: 6px; --v-radius-md: 10px; --v-radius-lg: 16px; --v-radius-xl: 22px; --v-radius-pill: 999px;

    /* Shadow and glow: on dark, mostly border and a faint spread */
    --v-shadow-1: 0 0 0 1px var(--v-border);
    --v-shadow-2: 0 4px 16px rgba(0,0,0,0.40), 0 0 0 1px var(--v-border);
    --v-shadow-3: 0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px var(--v-border-strong);
    --v-glow-red: var(--v-red-glow);
    --v-glow-status: 0 0 0 3px color-mix(in srgb, currentColor 22%, transparent);

    /* Motion */
    --v-dur-fast: 120ms; --v-dur-base: 200ms; --v-dur-slow: 320ms; --v-dur-enter: 400ms;
    --v-ease-out: cubic-bezier(0.25, 0.1, 0.25, 1);
    --v-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
    --v-ease-spring: cubic-bezier(0.34, 1.3, 0.64, 1);
    --v-stagger: 40ms;

    /* Sizing */
    --v-tap: 44px; --v-tap-lg: 56px; --v-control-h: 44px;
    --v-icon-sm: 14px; --v-icon-md: 18px; --v-icon-lg: 24px;
    --v-sidebar-w: 240px; --v-sidebar-rail-w: 68px;

    /* Z index */
    --v-z-base: 0; --v-z-sticky: 10; --v-z-tabbar: 50; --v-z-sheet: 60;
    --v-z-modal: 70; --v-z-toast: 90; --v-z-command: 100;

    /* Texture: the faint red grid, applied intentionally */
    --v-grid-texture:
      linear-gradient(rgba(204,34,34,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(204,34,34,0.045) 1px, transparent 1px);
    --v-grid-texture-size: 44px 44px;

    /* ── Layout measurements (Prompt-1 era names kept as aliases to --v-) ── */
    --lay-gutter: var(--v-gutter);
    --lay-gutter-l: max(var(--v-gutter), env(safe-area-inset-left));
    --lay-gutter-r: max(var(--v-gutter), env(safe-area-inset-right));
    --lay-safe-top: env(safe-area-inset-top, 0px);
    --lay-safe-bottom: env(safe-area-inset-bottom, 0px);
    --lay-content-w: 760px;                       /* detail / list content */
    --lay-content-w-wide: 900px;                  /* dashboard-style pages */
    --lay-tabbar-h: var(--v-tabbar-h);
    --lay-panel-w: 324px;                         /* desktop contextual panel */
    --lay-rail-w: var(--v-sidebar-rail-w);
    --lay-bar-bg: var(--v-bar);
    --lay-border: var(--v-border);
    width: 100%; max-width: 100%; min-width: 0;
    overflow-x: clip;
    font-family: var(--v-font-body);
  }
  @media (prefers-reduced-motion: reduce) {
    .lay-root {
      --v-dur-fast: 0ms; --v-dur-base: 0ms; --v-dur-slow: 0ms; --v-dur-enter: 0ms; --v-stagger: 0ms;
    }
  }
  /* Light variant STUB (Phase E). Placeholder values, wired to nothing. */
  .lay-root[data-v-theme='light'] {
    --v-ground: #f7f7f7; --v-surface-1: #ffffff; --v-surface-2: #f2f2f2; --v-surface-3: #e9e9e9;
    --v-text: #111111; --v-text-2: #3a3a3a; --v-text-3: #5f5f5f; --v-text-inverse: #ffffff;
    --v-border: rgba(0,0,0,0.08); --v-border-strong: rgba(0,0,0,0.16); --v-bar: #ffffff;
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
