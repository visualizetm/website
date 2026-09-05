/* LeadCard styles, injected once through uiStyles (src/ui/index.js). The
 * component itself lives in src/components/LeadCard.jsx. */
export const leadCardStyles = `
  .lc { position: relative; display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-3); padding-right: calc(var(--v-space-3) + var(--v-tap)); background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); color: var(--v-text); cursor: pointer; transition: border-color var(--v-dur-fast) var(--v-ease-out), transform var(--v-dur-fast) var(--v-ease-out), box-shadow var(--v-dur-fast) var(--v-ease-out); }
  .lc:hover { border-color: var(--v-border-strong); }
  .lc:has(> .lc-open:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .lc-open:focus-visible { outline: 0; }
  .lc:not(.lc--open) { cursor: default; }
  .lc.is-selected { border-color: var(--v-red); background: var(--v-surface-2); }
  .lc.is-checked { border-color: var(--v-red); box-shadow: 0 0 0 1px var(--v-red); }
  .lc.is-dragging { transform: scale(1.02) rotate(0.5deg); box-shadow: var(--v-shadow-3); opacity: 0.9; z-index: 2; }
  .lc-row { display: flex; align-items: center; gap: var(--v-space-2); min-width: 0; }
  .lc-row3 { flex-wrap: wrap; row-gap: var(--v-space-1); min-height: var(--v-tap); }
  .lc-name { flex: 1; font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); }
  .lc-new { height: 20px; padding: 0 var(--v-space-2); }
  .lc-desc { flex: 1; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .lc-phone { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-2); text-decoration: none; font-variant-numeric: tabular-nums; min-height: var(--v-tap); min-width: var(--v-tap); display: inline-flex; align-items: center; white-space: nowrap; border-radius: var(--v-radius-sm); }
  .lc-phone:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .lc-phone:hover { color: var(--v-red-highlight); }
  .lc-phone--none { color: var(--v-text-3); font-weight: var(--v-weight-regular); }
  .lc-socials { display: inline-flex; gap: 2px; }
  .lc-social { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: var(--v-radius-sm); color: var(--v-text-2); }
  .lc-social:hover { background: var(--v-surface-3); color: var(--v-text); }
  .lc-social--off { color: var(--v-text-3); opacity: 0.35; }
  .lc-row4 { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); flex-wrap: wrap; }
  .lc-next { color: var(--v-status-callback-text); min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
  .lc-scan { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: auto; }
  .lc-scan.is-fresh { background: var(--v-status-booked-solid); box-shadow: 0 0 0 3px var(--v-status-booked-soft); }
  .lc-scan.is-stale { background: var(--v-status-new-solid); box-shadow: 0 0 0 3px var(--v-status-new-soft); }
  .lc-menu { position: absolute; top: var(--v-space-1); right: var(--v-space-1); }
  .lc-check { position: absolute; top: var(--v-space-2); left: var(--v-space-2); z-index: 1; opacity: 0; transition: opacity var(--v-dur-fast) var(--v-ease-out); }
  .lc.is-selectable .lc-check, .lc.is-checked .lc-check, .lc:hover .lc-check, .lc:focus-within .lc-check { opacity: 1; }
  .lc.is-selectable .lc-row1, .lc.is-checked .lc-row1 { padding-left: 30px; }
  @media (hover: hover) { .lc:hover .lc-row1, .lc:focus-within .lc-row1 { padding-left: 30px; } }
`;
