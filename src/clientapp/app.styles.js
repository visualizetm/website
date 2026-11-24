/* The client app's own frame (client app job): the CRM's --v-* tokens under the page's .lay-root, dark only, the way the
 * planner draws. Only the chrome that joins the portal and the planner lives here; neither screen is restyled. */
export const appStyles = `
  .ca-door { min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: var(--v-space-4); background: var(--v-ground); color: var(--v-text); font-family: var(--v-font-body); }
  .ca-door-form { width: min(360px, 100%); }
  .ca-door-card { display: flex; flex-direction: column; gap: var(--v-space-4); padding: var(--v-space-6) var(--v-space-5); box-shadow: var(--v-shadow-3); }
  .ca-door-title { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); text-align: center; }
  .ca-door-lead { margin: 0; text-align: center; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .ca-door-help { margin: 0; text-align: center; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
`;
