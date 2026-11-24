/* The client planner's styles (Planner v2, part 1). Scoped under .pl (the page root, which also carries .lay-root so the --v-* token block
 * applies) and .pl-layer (the portaled layers: the tab bar, sheets, the toast). Every colour, size and duration reads var(--v-...); the
 * planner is dark only, the CRM's dark set. Motion collapses under Reduce motion because the token block zeroes every --v-dur-*. */
export const plannerStyles = `
  .pl { min-height: 100vh; min-height: 100dvh; background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); font-size: var(--v-text-md); line-height: var(--v-lh-md); }
  .pl *, .pl-layer * { box-sizing: border-box; }
  .pl-layer { position: static; width: auto; height: 0; color: var(--v-text); font-family: var(--v-font-body); }
  .pl-main { width: 100%; max-width: var(--v-content-w); margin: 0 auto; padding: var(--v-space-5) var(--v-gutter-r) calc(var(--v-tabbar-h) + var(--v-inset-bottom) + var(--v-space-12)) var(--v-gutter-l); }
  .pl[data-chrome='focused'] .pl-main { padding-bottom: calc(var(--v-inset-bottom) + var(--v-space-12)); }
  .pl[data-chrome='focused'][data-bar='1'] .pl-main { padding-bottom: calc(var(--v-tap-lg) + var(--v-inset-bottom) + var(--v-space-12)); }
  .pl-screen { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; animation: plIn var(--v-dur-enter) var(--v-ease-out) both; }
  @keyframes plIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .pl h1, .pl h2, .pl h3, .pl p { margin: 0; }
  .pl-h1 { font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); letter-spacing: var(--v-ls-display-sm); font-weight: var(--v-weight-bold); text-transform: uppercase; color: var(--v-text); }
  .pl-lead { color: var(--v-text-2); font-size: var(--v-text-md); line-height: var(--v-lh-md); }
  .pl-h2 { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .pl-label { display: block; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); margin-bottom: var(--v-space-1); }
  .pl-muted { color: var(--v-text-3); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl a { color: inherit; }

  /* The top bar: sticky, the bar layer, the CRM's top bar look. */
  .pl-top { position: sticky; top: 0; z-index: var(--v-z-sticky); display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap-lg); padding: calc(var(--v-inset-top) + var(--v-space-2)) var(--v-gutter-r) var(--v-space-2) var(--v-gutter-l); background: var(--v-bar); border-bottom: 1px solid var(--v-border); }
  .pl-top-who { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .pl-top-name { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); color: var(--v-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-top-line { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-top-title { flex: 1; min-width: 0; font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); color: var(--v-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-top-back { margin-left: calc(-1 * var(--v-space-2)); border-color: transparent; }
  .pl-avatar { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: var(--v-radius-pill); background: var(--v-red-hover); color: var(--v-text-on-red); font-weight: var(--v-weight-bold); font-size: var(--v-text-md); overflow: hidden; }
  .pl-avatar--logo { background: var(--v-surface-3); border: 1px solid var(--v-border); }
  .pl-avatar img { width: 100%; height: 100%; object-fit: contain; }

  /* Buttons (the kit's Button look). */
  .pl-btn { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: var(--v-space-2); min-height: var(--v-control-h); min-width: var(--v-tap); padding: 0 var(--v-space-4); border-radius: var(--v-radius-md); border: 1px solid var(--v-red-hover); background: var(--v-red-hover); color: var(--v-text-on-red); font-family: var(--v-font-body); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-bold); text-decoration: none; cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: background var(--v-dur-fast) var(--v-ease-out), transform var(--v-dur-fast) var(--v-ease-out); }
  .pl-btn:hover:not(:disabled) { background: var(--v-red); border-color: var(--v-red); }
  .pl-btn:active:not(:disabled) { transform: scale(0.97); }
  .pl-btn:focus-visible, .pl-iconbtn:focus-visible, .pl-seg-opt:focus-visible, .pl-chip:focus-visible, .pl-stretch:focus-visible, .pl-tab:focus-visible, .pl-day:focus-visible, .pl-step-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .pl-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .pl-btn--secondary { background: var(--v-surface-3); border-color: var(--v-border-strong); color: var(--v-text); }
  .pl-btn--secondary:hover:not(:disabled) { background: var(--v-surface-3); border-color: var(--v-text-3); }
  .pl-btn--ghost { background: transparent; border-color: transparent; color: var(--v-text-2); }
  .pl-btn--ghost:hover:not(:disabled) { background: var(--v-surface-2); border-color: transparent; color: var(--v-text); }
  .pl-btn--full { width: 100%; }
  .pl-btn--lg { min-height: var(--v-tap-lg); font-size: var(--v-text-md); border-radius: var(--v-radius-lg); }
  .pl-iconbtn { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: var(--v-tap); height: var(--v-tap); padding: 0; border-radius: var(--v-radius-md); border: 1px solid var(--v-border); background: transparent; color: var(--v-text-2); cursor: pointer; text-decoration: none; }
  .pl-iconbtn:hover:not(:disabled) { background: var(--v-surface-2); color: var(--v-text); }

  /* Cards and pills (the kit's Card and Pill). */
  .pl-card { position: relative; background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-lg); padding: var(--v-space-4); display: flex; flex-direction: column; gap: var(--v-space-3); min-width: 0; }
  .pl-card--raised { background: var(--v-surface-2); border-color: var(--v-border-strong); }
  .pl-card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); min-width: 0; }
  .pl-pill { display: inline-flex; align-items: center; gap: var(--v-space-1); flex-shrink: 0; height: 26px; padding: 0 var(--v-space-3); border-radius: var(--v-radius-pill); font-size: var(--v-text-xs); line-height: 1; font-weight: var(--v-weight-bold); letter-spacing: 0.04em; white-space: nowrap; border: 1px solid transparent; }
  .pl-pill-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
  .pl-pill--won { background: var(--v-status-won-soft); color: var(--v-status-won-text); border-color: color-mix(in srgb, var(--v-status-won-text) 30%, transparent); }
  .pl-pill--progress { background: var(--v-status-progress-soft); color: var(--v-status-progress-text); border-color: color-mix(in srgb, var(--v-status-progress-text) 30%, transparent); }
  .pl-pill--booked { background: var(--v-status-booked-soft); color: var(--v-status-booked-text); border-color: color-mix(in srgb, var(--v-status-booked-text) 30%, transparent); }
  .pl-pill--new { background: var(--v-status-new-soft); color: var(--v-status-new-text); border-color: color-mix(in srgb, var(--v-status-new-text) 30%, transparent); }
  .pl-pill--neutral { background: var(--v-status-neutral-soft); color: var(--v-status-neutral-text); border-color: color-mix(in srgb, var(--v-status-neutral-text) 30%, transparent); }
  .pl-pill--outline { background: transparent; color: var(--v-text-2); border-color: var(--v-border-strong); }
  .pl-pills { display: flex; flex-wrap: wrap; gap: var(--v-space-2); align-items: center; }

  /* Media: the creative at its format, or a labelled tile. */
  .pl-media { position: relative; display: block; width: 100%; overflow: hidden; background: var(--v-surface-3); border-radius: var(--v-radius-md); }
  .pl-media--4x5 { aspect-ratio: 4 / 5; }
  .pl-media--9x16 { aspect-ratio: 9 / 16; max-height: 70vh; margin: 0 auto; width: auto; max-width: 100%; }
  .pl-media--1x1 { aspect-ratio: 1 / 1; }
  .pl-media--4x5f { aspect-ratio: 4 / 5; border-radius: 0; }
  .pl-media-el { display: block; width: 100%; height: 100%; object-fit: cover; }
  video.pl-media-el { object-fit: contain; background: var(--v-ground); }
  .pl-media--empty { display: flex; align-items: center; justify-content: center; }
  .pl-media-empty { display: flex; flex-direction: column; align-items: center; gap: var(--v-space-2); padding: var(--v-space-3); color: var(--v-text-2); text-align: center; }
  .pl-media-text { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-media-play { position: absolute; right: var(--v-space-1); top: var(--v-space-1); display: inline-flex; padding: var(--v-space-1); border-radius: var(--v-radius-pill); background: var(--v-overlay); color: var(--v-text); }

  /* The post as on Instagram. */
  .pl-ig { background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-lg); overflow: hidden; display: flex; flex-direction: column; }
  .pl-ig-head { display: flex; align-items: center; gap: var(--v-space-3); padding: var(--v-space-3); }
  .pl-ig-who { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .pl-ig-handle { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-bold); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-ig-date { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }
  .pl-ig .pl-media { border-radius: 0; }
  .pl-ig-body { padding: var(--v-space-3); display: flex; flex-direction: column; gap: var(--v-space-2); }
  .pl-ig-caption { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text); white-space: pre-wrap; overflow-wrap: anywhere; }
  .pl-ig-tags { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-status-progress-text); overflow-wrap: anywhere; }
  .pl-ig-concept { padding: var(--v-space-3); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }

  /* The segmented control. */
  .pl-seg { display: inline-flex; align-items: stretch; gap: 2px; padding: 2px; background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); max-width: 100%; }
  .pl-seg--full { display: flex; width: 100%; }
  .pl-seg--full .pl-seg-opt { flex: 1; }
  .pl-seg-opt { display: inline-flex; align-items: center; justify-content: center; min-height: var(--v-tap); min-width: var(--v-tap); padding: 0 var(--v-space-3); border: 0; border-radius: calc(var(--v-radius-md) - 3px); background: transparent; color: var(--v-text-3); font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); cursor: pointer; white-space: nowrap; transition: background var(--v-dur-fast) var(--v-ease-out), color var(--v-dur-fast) var(--v-ease-out); }
  .pl-seg-opt:hover { color: var(--v-text); }
  .pl-seg-opt.is-on { background: var(--v-surface-3); color: var(--v-text); box-shadow: var(--v-shadow-1); }

  /* Chips (reasons, kinds, goals). */
  .pl-chips { display: flex; flex-wrap: wrap; gap: var(--v-space-2); }
  .pl-chip { display: inline-flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); padding: 0 var(--v-space-4); border-radius: var(--v-radius-pill); border: 1px solid var(--v-border-strong); background: var(--v-surface-2); color: var(--v-text-2); font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); cursor: pointer; }
  .pl-chip.is-on { background: var(--v-red-soft); border-color: var(--v-red); color: var(--v-red-highlight); }

  /* Fields. */
  .pl-field { display: flex; flex-direction: column; gap: var(--v-space-2); border: 0; padding: 0; margin: 0; min-width: 0; }
  .pl-field legend { padding: 0; }
  .pl-input, .pl-textarea { width: 100%; min-height: var(--v-control-h); padding: var(--v-space-3); border-radius: var(--v-radius-md); border: 1px solid var(--v-border-strong); background: var(--v-surface-2); color: var(--v-text); font-family: var(--v-font-body); font-size: var(--v-text-md); line-height: var(--v-lh-md); }
  .pl-textarea { resize: vertical; min-height: calc(var(--v-tap) * 2); }
  .pl-input:focus, .pl-textarea:focus { outline: 2px solid var(--v-border-focus); outline-offset: 0; }
  .pl-input::placeholder, .pl-textarea::placeholder { color: var(--v-text-3); }
  .pl-formerr { color: var(--v-status-danger-text); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-hint { color: var(--v-text-3); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }

  /* Rows: one real control each (the stretched button covers the row). */
  .pl-rows { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .pl-row { position: relative; display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap-lg); padding: var(--v-space-2) var(--v-space-3); background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); min-width: 0; transition: background var(--v-dur-fast) var(--v-ease-out); }
  .pl-row:hover { background: var(--v-surface-2); }
  .pl-row-thumb { width: var(--v-tap); flex-shrink: 0; }
  .pl-row-thumb .pl-media { border-radius: var(--v-radius-sm); }
  .pl-row-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .pl-row-title { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-semibold); color: var(--v-text); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-row-line { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-stretch { position: static; display: block; min-width: 0; padding: 0; border: 0; background: none; font-family: inherit; cursor: pointer; }
  .pl-stretch::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
  .pl-row > .pl-pill { position: relative; pointer-events: none; }

  /* The sheet. */
  .pl-sheet-wrap { position: fixed; inset: 0; z-index: var(--v-z-sheet); display: flex; align-items: flex-end; justify-content: center; }
  .pl-scrim { position: absolute; inset: 0; border: 0; padding: 0; background: var(--v-overlay); cursor: pointer; animation: plFade var(--v-dur-base) var(--v-ease-out) both; }
  @keyframes plFade { from { opacity: 0; } to { opacity: 1; } }
  .pl-sheet { position: relative; width: 100%; max-width: 560px; max-height: 90dvh; display: flex; flex-direction: column; background: var(--v-surface-1); border: 1px solid var(--v-border-strong); border-bottom: 0; border-radius: var(--v-radius-xl) var(--v-radius-xl) 0 0; box-shadow: var(--v-shadow-3); animation: plUp var(--v-dur-slow) var(--v-ease-out) both; }
  @keyframes plUp { from { transform: translateY(24px); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (min-width: 768px) { .pl-sheet-wrap { align-items: center; } .pl-sheet { border-bottom: 1px solid var(--v-border-strong); border-radius: var(--v-radius-xl); } }
  .pl-sheet-head { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); padding: var(--v-space-3) var(--v-space-4); border-bottom: 1px solid var(--v-border); }
  .pl-sheet-title { font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); }
  .pl-sheet-body { padding: var(--v-space-4); overflow-y: auto; display: flex; flex-direction: column; gap: var(--v-space-4); overscroll-behavior: contain; }
  .pl-sheet-foot { display: flex; gap: var(--v-space-2); justify-content: flex-end; padding: var(--v-space-3) var(--v-space-4) calc(var(--v-space-3) + var(--v-inset-bottom)); border-top: 1px solid var(--v-border); }
  .pl-sheet-foot .pl-btn { flex: 1; }
  @media (min-width: 768px) { .pl-sheet-foot .pl-btn { flex: 0 0 auto; } }

  /* The glass tab bar (a copy of src/shell/TabBar.jsx's look). */
  .pl-tabs { position: fixed; left: 0; right: 0; bottom: 0; height: 0; z-index: var(--v-z-tabbar); }
  .pl-tabs-glass { position: fixed; left: var(--v-space-4); right: var(--v-space-4); bottom: calc(var(--v-inset-bottom) + var(--v-space-3)); max-width: 360px; margin: 0 auto; display: flex; align-items: center; justify-content: space-around; padding: var(--v-space-2); border-radius: var(--v-radius-pill); background: var(--v-glass-bg); -webkit-backdrop-filter: blur(var(--v-glass-blur)) saturate(var(--v-glass-saturate)); backdrop-filter: blur(var(--v-glass-blur)) saturate(var(--v-glass-saturate)); border: 1px solid var(--v-glass-border); box-shadow: var(--v-glass-shadow); transition: transform var(--v-dur-base) var(--v-ease-out), opacity var(--v-dur-base) var(--v-ease-out); }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .pl-tabs-glass { background: var(--v-surface-1); } }
  @media (prefers-reduced-transparency: reduce) { .pl-tabs-glass { background: var(--v-surface-1); backdrop-filter: none; -webkit-backdrop-filter: none; } }
  .pl-tabs.is-hidden .pl-tabs-glass { transform: translateY(calc(100% + var(--v-inset-bottom) + var(--v-space-4))); opacity: 0; pointer-events: none; }
  .pl-tab { flex: 1; display: flex; align-items: center; justify-content: center; min-width: var(--v-tap); min-height: var(--v-tap); padding: 0; border: 0; background: transparent; color: var(--v-text-3); cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: color var(--v-dur-fast) var(--v-ease-out); border-radius: var(--v-radius-pill); }
  .pl-tab-icon { position: relative; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 36px; border-radius: var(--v-radius-pill); transition: background var(--v-dur-fast) var(--v-ease-out); }
  .pl-tab.is-active { color: var(--v-red-highlight); }
  .pl-tab.is-active .pl-tab-icon { background: var(--v-red-soft); }
  .pl-tab-dot { position: absolute; top: 4px; right: 8px; width: 8px; height: 8px; border-radius: 50%; background: var(--v-red); box-shadow: 0 0 0 2px var(--v-surface-2); }

  /* The toast. */
  .pl-toast { position: fixed; left: 50%; bottom: calc(var(--v-tabbar-h) + var(--v-inset-bottom) + var(--v-space-6)); transform: translate(-50%, 8px); z-index: var(--v-z-toast); max-width: calc(100vw - 2 * var(--v-space-4)); padding: var(--v-space-3) var(--v-space-4); border-radius: var(--v-radius-md); background: var(--v-surface-3); border: 1px solid var(--v-border-strong); box-shadow: var(--v-shadow-2); color: var(--v-text); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); opacity: 0; pointer-events: none; transition: opacity var(--v-dur-base) var(--v-ease-out), transform var(--v-dur-base) var(--v-ease-out); margin: 0; }
  .pl-toast.is-on { opacity: 1; transform: translate(-50%, 0); }
  .pl-toast:empty { padding: 0; border: 0; }

  /* Skeleton, empty, error. */
  .pl-skel { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .pl-skel-b { display: block; border-radius: var(--v-radius-md); background: var(--v-surface-2); background-image: linear-gradient(105deg, transparent 38%, var(--v-surface-3) 50%, transparent 62%); background-size: 240% 100%; animation: plShimmer 1.4s linear infinite; }
  @keyframes plShimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
  @media (prefers-reduced-motion: reduce) { .pl-skel-b { animation: none; } }
  .pl-skel-b--title { height: var(--v-display-sm); width: 55%; }
  .pl-skel-b--line { height: var(--v-text-md); width: 80%; }
  .pl-skel-b--card { height: calc(var(--v-tap-lg) * 2); }
  .pl-skel-b--strip { height: var(--v-tap-lg); }
  .pl-skel-b--seg { height: var(--v-control-h); width: 70%; }
  .pl-skel-b--row { height: var(--v-tap-lg); }
  .pl-skel-b--media { aspect-ratio: 4 / 5; }
  .pl-skel-b--grid { aspect-ratio: 3 / 2; }
  .pl-empty, .pl-error { display: flex; flex-direction: column; align-items: flex-start; gap: var(--v-space-2); padding: var(--v-space-5); background: var(--v-surface-1); border: 1px dashed var(--v-border-strong); border-radius: var(--v-radius-lg); }
  .pl-error { border-style: solid; color: var(--v-status-danger-text); }
  .pl-empty-title { font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .pl-empty-body { color: var(--v-text-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-empty .pl-btn, .pl-error .pl-btn { margin-top: var(--v-space-2); }
  .pl-dead { display: flex; flex-direction: column; gap: var(--v-space-3); }
`;
