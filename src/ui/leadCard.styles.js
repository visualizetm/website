/* LeadCard styles, injected once through uiStyles (src/ui/index.js). The
 * component itself lives in src/components/LeadCard.jsx. One row: 64px,
 * a level-1 card, two lines, one pill, the menu at the end. */
export const leadCardStyles = `
  .lc { position: relative; display: flex; align-items: center; gap: var(--v-space-2); min-height: 64px; padding: var(--v-space-2) var(--v-space-3); padding-right: calc(var(--v-space-2) + var(--v-tap)); background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); color: var(--v-text); cursor: pointer; transition: border-color var(--v-dur-fast) var(--v-ease-out), transform var(--v-dur-fast) var(--v-ease-out), box-shadow var(--v-dur-fast) var(--v-ease-out); }
  .lc--nomenu { padding-right: var(--v-space-3); }
  .lc:hover { border-color: var(--v-border-strong); }
  .lc:has(> .lc-open:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .lc-open:focus-visible { outline: 0; }
  .lc:not(.lc--open) { cursor: default; }
  .lc.is-selected { border-color: var(--v-red); background: var(--v-surface-2); }
  .lc.is-checked { border-color: var(--v-red); box-shadow: 0 0 0 1px var(--v-red); }
  .lc.is-dragging { transform: scale(1.02) rotate(0.5deg); box-shadow: var(--v-shadow-3); opacity: 0.9; z-index: 2; }
  .lc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .lc-l1, .lc-l2 { display: flex; align-items: center; gap: var(--v-space-2); min-width: 0; }
  .lc-name { flex: 1 1 60%; min-width: 72px; font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); }
  /* In a narrow kanban column the pill gives way before the name does. */
  .lc-pill { flex: 0 1 auto; min-width: 0; display: inline-flex; }
  .lc-pill > .v-pill { max-width: 100%; }
  .lc-ctx { flex: 1; min-width: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  /* The tel link sits on line two, right aligned; its 44px target reaches above and below the line without moving it. */
  .lc-phone { flex-shrink: 0; display: inline-flex; align-items: center; min-height: var(--v-tap); min-width: var(--v-tap); margin: calc((var(--v-lh-sm) - var(--v-tap)) / 2) 0; padding: 0 var(--v-space-1); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-2); text-decoration: none; font-variant-numeric: tabular-nums; white-space: nowrap; border-radius: var(--v-radius-sm); }
  .lc-phone:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .lc-phone:hover { color: var(--v-red-highlight); }
  .lc-phone--none { color: var(--v-text-3); font-weight: var(--v-weight-regular); }
  .lc-trail { flex-shrink: 0; display: inline-flex; }
  .lc-menu { position: absolute; top: 50%; right: var(--v-space-1); transform: translateY(-50%); }
  /* Outside the two lines (law 5): the checkbox in select mode, the drag handle inside a list. */
  .lc-check { flex-shrink: 0; display: inline-flex; margin-left: calc(-1 * var(--v-space-1)); }
  .lc-handle { flex-shrink: 0; display: inline-flex; color: var(--v-text-3); margin-left: calc(-1 * var(--v-space-1)); cursor: grab; }
`;
