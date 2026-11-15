/* Billy's Call Room: the styles its own screens add on top of the kit and the shell frame. Tokens only. */
export const roomStyles = `
  .rm-content > .lay-shell { animation: none; }
  .rm-wait { min-height: var(--v-space-9); }
  .rm-skel { min-width: 0; }
  .rm-signin { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: var(--v-space-4); background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); }
  .rm-signin-form { width: min(360px, 100%); }
  .rm-signin-card { display: flex; flex-direction: column; gap: var(--v-space-4); padding: var(--v-space-6) var(--v-space-5); box-shadow: var(--v-shadow-3); }
  .rm-signin-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); }
  .rm-signin-help { margin: 0; text-align: center; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .rm-strip { width: 100%; }
  .rm-today, .rm-lead, .rm-summary, .rm-sections { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; }
  .rm-hello { display: grid; gap: var(--v-space-1); min-width: 0; }
  .rm-hello-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); font-weight: var(--v-weight-bold); color: var(--v-text); overflow-wrap: anywhere; }
  .rm-hello-date { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .rm-k { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: 0.06em; text-transform: uppercase; color: var(--v-text-3); font-weight: var(--v-weight-semibold); }
  .rm-h { margin: 0 0 var(--v-space-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-bold); color: var(--v-text-2); display: flex; align-items: center; gap: var(--v-space-2); }
  .rm-h-n { font-weight: var(--v-weight-semibold); color: var(--v-text-3); }
  .rm-block { min-width: 0; }
  .rm-list-name, .rm-lead-name { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-xl); line-height: var(--v-lh-xl); font-weight: var(--v-weight-bold); color: var(--v-text); overflow-wrap: anywhere; }
  .rm-lead-name { font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); }
  .rm-lead-owner { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .rm-row { position: relative; }
  .rm-row-name { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .rm-row-sub { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); min-width: 0; }
  .rm-row-call { display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); border-radius: var(--v-radius-pill); background: var(--v-surface-2); color: var(--v-text-2); flex-shrink: 0; }
  .rm-dl { margin: 0; display: grid; gap: var(--v-space-2); }
  .rm-dl > div { display: grid; grid-template-columns: 88px minmax(0, 1fr); gap: var(--v-space-3); align-items: baseline; }
  .rm-dl dt { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .rm-dl dd { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text); overflow-wrap: anywhere; }
  .rm-note { color: var(--v-text-2); }
  .rm-note-text { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .rm-bullets { margin: 0; padding-left: var(--v-space-5); display: grid; gap: var(--v-space-1); font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text); }
  .rm-opener { display: grid; gap: var(--v-space-2); }
  .rm-opener .cs-line, .rm-line .cs-line, .rm-respond { margin: 0; }
  .rm-foot { display: flex; flex-direction: row; align-items: center; justify-content: flex-end; gap: var(--v-space-2); flex-wrap: wrap; }
  .rm-foot .rm-call, .rm-foot .rm-next-list { flex: 1 1 0; min-width: 160px; }
  .rm-foot--call { flex-direction: column; align-items: stretch; }
  .rm-foot-row > * { flex: 1 1 0; min-width: 0; }
  .rm-step { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-2); }
  .rm-call-body .cs-prog { margin-bottom: 0; }
  .rm-line { animation: lay-view-in var(--v-dur-base) var(--v-ease-out) both; }
  .rm-respond { margin-top: var(--v-space-3); padding-left: var(--v-space-3); border-left: 2px solid var(--v-border-focus); }
  .rm-text-body { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text); }
  .rm-booked { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--v-space-2); }
  .rm-booked-row { min-width: 0; }
  .rm-signout { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); flex-wrap: wrap; padding-top: var(--v-space-2); border-top: 1px solid var(--v-border); }
  .rm-link { min-height: var(--v-tap); padding: 0 var(--v-space-2); border: 0; background: none; color: var(--v-text-2); font: inherit; font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); text-decoration: underline; cursor: pointer; border-radius: var(--v-radius-sm); }
  .rm-link:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  /* The room is phone first, but a computer still needs its three tabs: the same pill, centred, at every width. */
  @media (min-width: 768px) {
    .rm-root { --v-tabbar-now: calc(var(--v-tabbar-h) + var(--v-space-3)); }
    .rm-root.is-focused { --v-tabbar-now: 0px; }
    .rm-root .sh-tabs { display: block; }
    .rm-root .sh-tabs-glass { left: 50%; right: auto; width: min(360px, calc(100% - 2 * var(--v-space-4))); transform: translateX(-50%); }
    .rm-root .sh-tabs.is-hidden .sh-tabs-glass { transform: translate(-50%, calc(100% + var(--v-inset-bottom) + var(--v-space-4))); }
  }
  @media (prefers-reduced-motion: reduce) { .rm-line { animation: none; } }
  [data-v-motion='reduce'] .rm-line { animation: none; }
`;
