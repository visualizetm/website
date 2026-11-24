/* The client app's own frame (client app job): the CRM's --v-* tokens under the page's .lay-root, dark only, the way the
 * planner draws. Only the chrome that joins the portal and the planner lives here (the code door, the Add to Home Screen
 * card, Settings); neither screen is restyled. */
export const appStyles = `
  .ca-door { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: max(var(--v-space-4), env(safe-area-inset-top)) var(--v-space-4) max(var(--v-space-4), env(safe-area-inset-bottom)); background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); box-sizing: border-box; }
  .ca-door-form { width: min(380px, 100%); }
  .ca-door-card { display: flex; flex-direction: column; gap: var(--v-space-4); padding: var(--v-space-6) var(--v-space-5); box-shadow: var(--v-shadow-3); }
  .ca-door-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); text-align: center; overflow-wrap: anywhere; }
  .ca-door-lead { margin: 0; text-align: center; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .ca-door-help { margin: 0; text-align: center; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); overflow-wrap: anywhere; }
  .ca-door-link { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 var(--v-space-2); color: var(--v-text-2); text-decoration: underline; text-underline-offset: 3px; }
  .ca-door-who { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .ca-page { min-height: 100vh; min-height: 100dvh; background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); }
  .ca-bar { position: sticky; top: 0; z-index: 2; display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; gap: var(--v-space-2); min-height: 60px; padding: calc(var(--v-space-2) + env(safe-area-inset-top, 0px)) var(--v-space-4) var(--v-space-2); background: var(--v-bar); border-bottom: 1px solid var(--v-border); box-sizing: border-box; }
  .ca-bar-title { margin: 0; text-align: center; font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-semibold); }
  .ca-page-body { width: min(600px, 100%); margin: 0 auto; padding: var(--v-space-5) var(--v-space-4) calc(var(--v-space-8) + env(safe-area-inset-bottom, 0px)); box-sizing: border-box; }
  .ca-who { margin: 0; color: var(--v-text-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .ca-row { display: flex; align-items: flex-start; gap: var(--v-space-3); }
  .ca-row-icon { display: inline-flex; flex-shrink: 0; color: var(--v-text-2); padding-top: 2px; }
  .ca-row-text { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; }
  .ca-row-title { font-weight: var(--v-weight-semibold); }
  .ca-row-line { color: var(--v-text-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); overflow-wrap: anywhere; }
  .ca-signout { align-self: center; margin-top: var(--v-space-4); text-decoration: underline; text-underline-offset: 3px; }
`;
