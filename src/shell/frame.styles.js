/* The shell's frame: the root, the column, the content region and the offline strip. Shared by the admin shell
 * (src/shell/AppShell.jsx) and Billy's Call Room (src/room/RoomApp.jsx), so the two read one contract: the audits look for
 * .sh-root[data-chrome], .sh-top, .sh-content and .sh-tabs in both. */
export const shellFrameStyles = `
  .sh-root { height: 100vh; height: 100dvh; display: flex; background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); overflow: hidden; }
  /* The floating tab bar's footprint above the safe area (its own height plus the gap it floats above the bottom
     edge, src/shell/TabBar.jsx's --v-space-3): what a bar pinned above it (SaveBar) adds itself to clear it, and
     what every scrolling container (ScrollArea, StickyFooterBar) reserves at its own bottom so nothing hides
     behind the pill. Consumers still add --v-inset-bottom themselves, the same split as before. 0 while a focused
     screen hides the bar (src/shell/chrome.js), 0 on desktop where there is no tab bar at all. */
  .sh-root { --v-tabbar-now: calc(var(--v-tabbar-h) + var(--v-space-3)); }
  .sh-root.is-focused { --v-tabbar-now: 0px; }
  @media (min-width: 768px) { .sh-root { --v-tabbar-now: 0px; } }
  /* Focused mode's own safe-area clearance now lives in ScrollArea's own padding (--v-tabbar-now is 0 there, so it
     is just --v-inset-bottom), the same place tabs mode's clearance lives, instead of a second rule here that
     would double it up. */
  .sh-col { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
  @media (min-width: 768px) { .sh-col { --v-gutter-l: var(--v-gutter); --lay-gutter-l: var(--v-gutter); } }
  .sh-content { flex: 1; min-height: 0; min-width: 0; display: flex; }
  .sh-offline.is-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); border: 0; min-height: 0; }
  .sh-offline { display: flex; align-items: center; justify-content: center; gap: var(--v-space-2); flex-shrink: 0; min-height: var(--v-space-9); padding: var(--v-space-1) var(--v-gutter-r) var(--v-space-1) var(--v-gutter-l); background: var(--v-status-new-soft); color: var(--v-status-new-text); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); border-bottom: 1px solid color-mix(in srgb, var(--v-status-new-text) 30%, transparent); animation: lay-view-in var(--v-dur-base) var(--v-ease-out) both; }
`;
