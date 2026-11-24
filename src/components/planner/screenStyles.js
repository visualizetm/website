/* The planner screens' own styles (Planner v2, part 1): Home, Plan, the post page, Ads and Ideas. Tokens only. */
export const screenStyles = `
  .pl-top-count { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-bold); color: var(--v-text-2); white-space: nowrap; }
  .pl-btn--sm { min-height: var(--v-tap); padding: 0 var(--v-space-2); gap: var(--v-space-1); }

  /* Home */
  .pl-hello { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-2) 0 var(--v-space-1); }
  .pl-card-title { font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); }
  .pl-needs-line { color: var(--v-text-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-needs-thumbs { display: flex; gap: var(--v-space-2); }
  .pl-needs-thumb { width: 64px; }
  .pl-needs-thumb .pl-media { border-radius: var(--v-radius-sm); }
  .pl-caught { display: flex; align-items: center; gap: var(--v-space-2); padding: var(--v-space-3) var(--v-space-4); background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-lg); color: var(--v-text-2); font-weight: var(--v-weight-semibold); }
  .pl-caught-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: var(--v-status-booked-soft); color: var(--v-status-booked-text); }
  .pl-today { flex-direction: row; align-items: center; }
  .pl-today-thumb { width: 64px; flex-shrink: 0; }
  .pl-today-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .pl-today-title { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); color: var(--v-text); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pl-today-pill { position: relative; pointer-events: none; }
  .pl-week { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--v-space-1); }
  .pl-day { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: var(--v-tap-lg); min-width: 0; padding: var(--v-space-1) 0; border: 1px solid transparent; border-radius: var(--v-radius-md); background: transparent; color: var(--v-text-2); font-family: var(--v-font-body); cursor: pointer; }
  .pl-day:hover { background: var(--v-surface-2); }
  .pl-day.is-today { background: var(--v-red-soft); border-color: color-mix(in srgb, var(--v-red) 40%, transparent); color: var(--v-text); }
  .pl-day-dow { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }
  .pl-day.is-today .pl-day-dow { color: var(--v-red-highlight); }
  .pl-day-num { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); }
  .pl-dots { display: flex; gap: 3px; min-height: 6px; }
  .pl-dot { width: 6px; height: 6px; border-radius: 50%; }
  .pl-dot--needs { background: var(--v-red); }
  .pl-dot--post { background: var(--v-text); }
  .pl-dot--ad { background: var(--v-status-progress-solid); }
  .pl-dot--posted { background: var(--v-status-booked-solid); }
  .pl-stat { display: flex; align-items: baseline; justify-content: space-between; gap: var(--v-space-3); font-size: var(--v-text-lg); line-height: var(--v-lh-lg); }
  .pl-bar { display: block; height: 8px; border-radius: var(--v-radius-pill); background: var(--v-surface-3); overflow: hidden; }
  .pl-bar-fill { display: block; height: 100%; border-radius: inherit; background: var(--v-red); transition: width var(--v-dur-slow) var(--v-ease-out); }
  .pl-adcard-name { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); color: var(--v-text); text-align: left; }
  .pl-fromrob-text { color: var(--v-text-2); white-space: pre-wrap; overflow-wrap: anywhere; }
  /* Plan */
  .pl-monthbar { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-2); }
  .pl-month { font-family: var(--v-font-display); font-size: var(--v-text-3xl); line-height: var(--v-lh-3xl); font-weight: var(--v-weight-bold); text-transform: uppercase; letter-spacing: var(--v-ls-3xl); text-align: center; flex: 1; min-width: 0; }
  @media (max-width: 399px) { .pl-month { font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); } }
  .pl-cal { display: flex; flex-direction: column; gap: var(--v-space-1); }
  @media (max-width: 399px) { .pl-cal { margin: 0 calc(var(--v-space-1) - var(--v-gutter-r)) 0 calc(var(--v-space-1) - var(--v-gutter-l)); } }
  .pl-cal-head, .pl-cal-week { display: grid; grid-template-columns: repeat(7, minmax(var(--v-tap), 1fr)); gap: 0; }
  @media (min-width: 400px) { .pl-cal-head, .pl-cal-week { gap: var(--v-space-1); } }
  .pl-cal-head span { text-align: center; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .pl-cal-pad { min-height: var(--v-tap-lg); }
  .pl-cal-day { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--v-space-1); min-height: var(--v-tap-lg); min-width: var(--v-tap); padding: 0; border: 1px solid transparent; border-radius: var(--v-radius-md); background: var(--v-surface-1); color: var(--v-text-2); font-family: var(--v-font-body); cursor: pointer; }
  .pl-cal-day:hover { background: var(--v-surface-2); }
  .pl-cal-day.is-today { border-color: var(--v-border-strong); color: var(--v-text); }
  .pl-cal-day.is-on { background: var(--v-red-soft); border-color: color-mix(in srgb, var(--v-red) 45%, transparent); color: var(--v-text); }
  .pl-cal-day:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 1px; }
  .pl-cal-num { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); }
  .pl-dayitems, .pl-week-group { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .pl-feed { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px; border-radius: var(--v-radius-md); overflow: hidden; }
  .pl-feed-tile { position: relative; min-width: 0; }
  .pl-feed-tile:has(.pl-stretch:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: -2px; z-index: 1; }
  .pl-feed-chip { position: absolute; left: var(--v-space-1); bottom: var(--v-space-1); display: inline-flex; align-items: center; gap: 2px; padding: 2px var(--v-space-2); border-radius: var(--v-radius-pill); background: var(--v-overlay); color: var(--v-text); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); font-weight: var(--v-weight-bold); pointer-events: none; }
  .pl-feed-chip.is-needs { background: var(--v-red-hover); color: var(--v-text-on-red); }
  .pl-feed-chip.is-posted { color: var(--v-status-booked-text); }
  .pl-feed-tile .pl-stretch { position: absolute; inset: 0; width: 100%; height: 100%; }
  .pl-feed-tile .pl-stretch::after { display: none; }

  /* The post page */
  .pl-postpage .pl-ig { max-width: 480px; width: 100%; margin: 0 auto; }
  .pl-changed, .pl-robnote-card { display: block; color: var(--v-text-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-changed { border-color: color-mix(in srgb, var(--v-status-new-text) 35%, transparent); background: var(--v-status-new-soft); color: var(--v-text); }
  .pl-words { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--v-text); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--v-space-2); }
  .pl-step-btn { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: var(--v-tap-lg); padding: var(--v-space-2) var(--v-space-3); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); background: var(--v-surface-2); color: var(--v-text); font-family: var(--v-font-body); text-align: left; text-decoration: none; cursor: pointer; }
  .pl-step-btn:hover:not(:disabled) { border-color: var(--v-border-strong); }
  .pl-step-btn:disabled { cursor: default; }
  .pl-step-btn:disabled:not(.is-done) .pl-step-title { color: var(--v-text-2); }
  .pl-step-n { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%; background: var(--v-surface-3); color: var(--v-text); font-weight: var(--v-weight-bold); font-size: var(--v-text-sm); }
  .pl-step-n.is-done { background: var(--v-status-booked-soft); color: var(--v-status-booked-text); }
  .pl-step-text { display: flex; flex-direction: column; min-width: 0; }
  .pl-step-title { font-weight: var(--v-weight-bold); font-size: var(--v-text-md); line-height: var(--v-lh-md); }
  .pl-step-help { color: var(--v-text-3); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-tl { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--v-space-3); }
  .pl-tl-step { position: relative; display: flex; align-items: center; gap: var(--v-space-3); color: var(--v-text-3); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-tl-step.is-done { color: var(--v-text); }
  .pl-tl-dot { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--v-border-strong); flex-shrink: 0; }
  .pl-tl-step.is-done .pl-tl-dot { background: var(--v-status-booked-solid); border-color: var(--v-status-booked-solid); }
  .pl-hold-media { width: 100%; border-radius: var(--v-radius-md); }

  /* Ads */
  .pl-adbody-name { font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); }
  .pl-adbody .pl-media--9x16 { max-height: 50vh; }
  .pl-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); gap: var(--v-space-2); }
  .pl-tile { display: flex; flex-direction: column; gap: 2px; padding: var(--v-space-3); border-radius: var(--v-radius-md); background: var(--v-surface-3); border: 1px solid var(--v-border); min-width: 0; }
  .pl-tile-n { font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); font-weight: var(--v-weight-bold); color: var(--v-text); }
  .pl-tile-l { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-2); }
  .pl-adline { color: var(--v-text); font-weight: var(--v-weight-semibold); }
`;
