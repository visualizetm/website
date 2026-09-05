/* The Visualize Dark token block. Declared once on .lay-root; see docs/TOKENS.md.
 * Injected through uiStyles (src/ui/index.js) by the app shells. */
export const tokenStyles = `
  /* ══════════════════════════════════════════════════════════════
     VISUALIZE DARK design tokens (Prompt 2). Prefix --v-.
     Dark is the only theme. Every admin surface and every src/ui component
     reads these through var(); nothing imports anything.
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

    /* Semantic status set: -solid (fills; dark text, the won fill carries white), -soft (tints), -text (on dark).
       Prompt 15: won solid is the pressed red so white passes 4.5:1 on it, danger solid #ef4444 so dark text passes,
       neutral text #a3a3a3 so a neutral pill still passes on a selected (surface-2 plus tint) card. */
    --v-status-new-solid: #f59e0b;      --v-status-new-soft: rgba(245,158,11,0.14);   --v-status-new-text: #f59e0b;
    --v-status-progress-solid: #60a5fa; --v-status-progress-soft: rgba(96,165,250,0.14); --v-status-progress-text: #60a5fa;
    --v-status-callback-solid: #a78bfa; --v-status-callback-soft: rgba(167,139,250,0.14); --v-status-callback-text: #a78bfa;
    --v-status-booked-solid: #22c55e;   --v-status-booked-soft: rgba(34,197,94,0.14);  --v-status-booked-text: #22c55e;
    --v-status-won-solid: #c2413a;      --v-status-won-soft: rgba(212,76,67,0.16);    --v-status-won-text: #e66b63;
    --v-status-danger-solid: #ef4444;   --v-status-danger-soft: rgba(239,68,68,0.14);  --v-status-danger-text: #f87171;
    --v-status-neutral-solid: #8f8f8f;  --v-status-neutral-soft: rgba(255,255,255,0.07); --v-status-neutral-text: #a3a3a3;

    /* Charts: bars pass 3:1 against every layer, --v-chart-text is the label on a bar (4.5:1) */
    --v-chart-1: #d44c43; --v-chart-2: #60a5fa; --v-chart-3: #22c55e;
    --v-chart-4: #f59e0b; --v-chart-5: #a78bfa; --v-chart-6: #34d399;
    --v-chart-text: var(--v-text-inverse);

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

    /* Sidebar (Prompt 14): the rail stays Visualize black in both themes, so it
       reads its own tokens. In dark they alias the shell's; the light block
       pins them to the dark values. */
    --v-sidebar-bg: var(--v-bar); --v-sidebar-text: var(--v-text); --v-sidebar-text-2: var(--v-text-2); --v-sidebar-text-3: var(--v-text-3);
    --v-sidebar-border: var(--v-border); --v-sidebar-hover: var(--v-surface-2); --v-sidebar-active-bg: var(--v-red-soft); --v-sidebar-active: var(--v-red-highlight);

    /* Z index */
    --v-z-base: 0; --v-z-sticky: 10; --v-z-tabbar: 50; --v-z-sheet: 60;
    --v-z-modal: 70; --v-z-toast: 90; --v-z-command: 100;

    /* Texture: the faint red grid, applied intentionally */
    --v-grid-texture:
      linear-gradient(rgba(204,34,34,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(204,34,34,0.045) 1px, transparent 1px);
    --v-grid-texture-size: 44px 44px;

    /* Layout measurements (Prompt 3): gutters floored by the notch, raw insets, content widths */
    --v-gutter-l: max(var(--v-gutter), env(safe-area-inset-left));
    --v-gutter-r: max(var(--v-gutter), env(safe-area-inset-right));
    --v-inset-top: env(safe-area-inset-top, 0px);
    --v-inset-bottom: env(safe-area-inset-bottom, 0px);
    --v-content-w: 760px;                         /* detail / list content */
    --v-content-w-wide: 900px;                    /* dashboard-style pages */
    --v-panel-w: 324px;                           /* desktop contextual panel */

    /* ── Prompt-1 era names kept as aliases to --v- (existing screens only) ── */
    --lay-gutter: var(--v-gutter);
    --lay-gutter-l: var(--v-gutter-l);
    --lay-gutter-r: var(--v-gutter-r);
    --lay-safe-top: var(--v-inset-top);
    --lay-safe-bottom: var(--v-inset-bottom);
    --lay-content-w: var(--v-content-w);
    --lay-content-w-wide: var(--v-content-w-wide);
    --lay-tabbar-h: var(--v-tabbar-h);
    --lay-panel-w: var(--v-panel-w);
    --lay-rail-w: var(--v-sidebar-rail-w);
    --lay-bar-bg: var(--v-bar);
    --lay-border: var(--v-border);
    width: 100%; max-width: 100%; min-width: 0;
    overflow-x: clip;
    font-family: var(--v-font-body);
  }
  /* Visually hidden text for assistive tech (Prompt 15) */
  .v-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  /* Reduced motion (Prompt 14): the OS setting and the in-app switch
     (data-v-motion='reduce' on .lay-root, mirrored on <html> for portals and
     the boot frame) both zero every duration. Components that animate with
     their own keyframes check the same two conditions. */
  @media (prefers-reduced-motion: reduce) {
    .lay-root {
      --v-dur-fast: 0ms; --v-dur-base: 0ms; --v-dur-slow: 0ms; --v-dur-enter: 0ms; --v-stagger: 0ms;
    }
  }
  .lay-root[data-v-motion='reduce'], [data-v-motion='reduce'] .lay-root {
    --v-dur-fast: 0ms; --v-dur-base: 0ms; --v-dur-slow: 0ms; --v-dur-enter: 0ms; --v-stagger: 0ms;
  }
  /* Light theme (Prompt 14). The picker sets data-v-theme on <html> (and the
     shell repeats it on .lay-root); every --v- variable the dark block
     declares is redefined here. Values and the contrast table: docs/TOKENS.md. */
  .lay-root[data-v-theme='light'], [data-v-theme='light'] .lay-root {
    /* Layers: a cream ground, warm surfaces stepping darker */
    --v-ground: #f7f3ee; --v-surface-1: #f1ece5; --v-surface-2: #eae4db; --v-surface-3: #e2dbd0;
    --v-overlay: rgba(26,22,19,0.45);
    --v-bar: #f3efe8;
    /* Lines */
    --v-border: rgba(26,22,19,0.10); --v-border-strong: rgba(26,22,19,0.20);
    /* Text: text-3 passes 4.5:1 on every surface (5.16 on surface-3) */
    --v-text: #1a1613; --v-text-2: #4a433c; --v-text-3: #5f574e;
    --v-text-inverse: var(--v-text);                 /* solid fills stay light, so their label is the dark text */
    /* Brand: the same red; as text it uses the won tone's dark red */
    --v-red-highlight: var(--v-status-won-text);
    --v-red-soft: rgba(212,76,67,0.12);
    --v-red-glow: 0 8px 28px rgba(212,76,67,0.22);
    /* Semantic text retuned so every text-on-surface pairing passes 4.5:1; solids keep their hue with dark labels */
    --v-status-new-text: #8a3d0c;
    --v-status-progress-text: #1a44c2;
    --v-status-callback-text: #6d28d9;
    --v-status-booked-text: #166534;
    --v-status-won-text: #9e2f28;      --v-status-won-soft: rgba(212,76,67,0.12);
    --v-status-danger-solid: #f87171;  --v-status-danger-text: #a91b1b;  --v-status-danger-soft: rgba(239,68,68,0.12);
    --v-status-neutral-solid: #a3a3a3; --v-status-neutral-text: var(--v-text-3); --v-status-neutral-soft: rgba(26,22,19,0.06);
    /* Shadows: more spread, warm */
    --v-shadow-2: 0 6px 20px rgba(26,22,19,0.12), 0 0 0 1px var(--v-border);
    --v-shadow-3: 0 16px 48px rgba(26,22,19,0.18), 0 0 0 1px var(--v-border-strong);
    /* Texture toned down */
    --v-grid-texture:
      linear-gradient(rgba(204,34,34,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(204,34,34,0.03) 1px, transparent 1px);
    /* Charts (Prompt 15): darker fills so a bar reads 3:1 on the cream layers and a white label passes 4.5:1 on it */
    --v-chart-1: #c2413a; --v-chart-2: #1d4ed8; --v-chart-3: #15803d;
    --v-chart-4: #b45309; --v-chart-5: #6d28d9; --v-chart-6: #047857;
    --v-chart-text: #ffffff;
    /* The sidebar stays Visualize black */
    --v-sidebar-bg: #0a0a0a; --v-sidebar-text: #fafafa; --v-sidebar-text-2: #cccccc; --v-sidebar-text-3: #8f8f8f;
    --v-sidebar-border: rgba(255,255,255,0.08); --v-sidebar-hover: rgba(255,255,255,0.06); --v-sidebar-active-bg: rgba(212,76,67,0.18); --v-sidebar-active: #e66b63;
  }
`;
