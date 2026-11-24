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
`;
