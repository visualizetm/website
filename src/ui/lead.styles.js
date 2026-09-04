/* Styles for the shared lead components (LeadHistory, LeadNotes, LeadPlaybook,
 * LeadForm). Injected once through uiStyles. */
export const leadHistoryStyles = `
  .lh { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .lh-row .v-lrow-sub { white-space: normal; }
`;
export const leadNotesStyles = `
  .ln { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; }
  .ln-state { min-height: var(--v-lh-xs); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }
  .ln-saved { color: var(--v-status-booked-text); }
`;
export const playbookStyles = `
  .pb-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--v-space-3); }
  .pb-step { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-3); background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); }
  .pb-step-head { display: flex; align-items: baseline; gap: var(--v-space-2); flex-wrap: wrap; }
  .pb-step-n { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--v-red-soft); color: var(--v-red-highlight); font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); }
  .pb-step-title { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); }
  .pb-step-hint { font-size: var(--v-text-xs); color: var(--v-text-3); }
  .pb-say { margin: 0; font-size: var(--v-text-lg); line-height: var(--v-lh-lg); color: var(--v-text); overflow-wrap: anywhere; }
  .pb-qa { display: flex; flex-direction: column; gap: var(--v-space-1); border-top: 1px solid var(--v-border); padding-top: var(--v-space-2); }
  .pb-qa-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: var(--v-space-3); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pb-qa-say { color: var(--v-text-3); font-style: italic; }
  .pb-qa-respond { color: var(--v-text); }
  .pb-obj { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .pb-obj-row { background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); overflow: hidden; }
  .pb-obj-row.is-open { border-color: var(--v-border-strong); }
  .pb-obj-btn { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-2); width: 100%; min-height: var(--v-tap); padding: var(--v-space-2) var(--v-space-3); border: 0; background: transparent; color: var(--v-text); cursor: pointer; text-align: left; font: inherit; font-size: var(--v-text-md); font-weight: var(--v-weight-semibold); }
  .pb-obj-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .pb-chev { flex-shrink: 0; color: var(--v-text-3); transition: transform var(--v-dur-base) var(--v-ease-out); }
  .is-open .pb-chev { transform: rotate(180deg); }
  .pb-obj-respond { margin: 0; padding: 0 var(--v-space-3) var(--v-space-3); font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); }
  .pb-card-h { margin: 0 0 var(--v-space-2); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .pb-say--edit { display: flex; width: 100%; }
  .pb-qa-edit { display: flex; align-items: center; gap: var(--v-space-1); min-width: 0; }
  .pb-obj-edit { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--v-space-1) var(--v-space-2); padding: var(--v-space-2) var(--v-space-3); align-items: start; }
  .pb-obj-edit .pb-obj-say { font-weight: var(--v-weight-semibold); }
  .pb-obj-respond-edit { grid-column: 1; color: var(--v-text-2); }
  .pb-obj-x { grid-row: 1 / span 2; }
  .pb-list { margin: 0; padding-left: var(--v-space-4); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); display: flex; flex-direction: column; gap: var(--v-space-1); }
`;
export const leadFormStyles = `
  .lf { min-width: 0; }
`;

export const leadDetailStyles = `
  .dt { flex: 1; min-height: 0; min-width: 0; }
  .dt-scroll { padding: var(--v-space-4) var(--v-gutter-r) var(--v-space-4) var(--v-gutter-l); }
  .dt-inner { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; max-width: 1200px; margin: 0 auto; }
  .dt-cols { display: grid; grid-template-columns: calc(var(--v-panel-w) + 40px) minmax(0, 1fr); gap: var(--v-space-5); align-items: start; min-width: 0; }
  .dt-left { position: sticky; top: 0; min-width: 0; }
  .dt-right { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; }
  .dt-profile { gap: var(--v-space-3); }
  .dt-biz { margin: 0; font-family: var(--v-font-display); font-size: var(--v-text-3xl); line-height: var(--v-lh-3xl); letter-spacing: var(--v-ls-3xl); text-transform: uppercase; font-weight: var(--v-weight-bold); overflow-wrap: break-word; }
  .dt-desc { color: var(--v-text-2); font-size: var(--v-text-md); }
  .dt-pillbtn { border: 0; background: transparent; padding: 0; cursor: pointer; display: inline-flex; min-height: 26px; }
  .dt-pillbtn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-pill); }
  .dt-inline-pill { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); letter-spacing: 0.04em; color: var(--v-text-2); min-height: 26px; }
  .dt-actions .v-ibtn--ghost { color: var(--v-text-3); opacity: 0.6; }
  .dt-facts { margin-top: var(--v-space-1); }
  .dt-fact { display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); padding: 0 var(--v-space-1); border-bottom: 1px solid var(--v-border); background: transparent; border-left: 0; border-right: 0; border-top: 0; color: inherit; text-align: left; font: inherit; width: 100%; }
  .dt-fact--btn { cursor: pointer; }
  .dt-fact--btn:hover { background: var(--v-surface-2); }
  .dt-fact--btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .dt-fact-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .dt-fact-ro { font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
  .dt-fact-edit { width: 100%; margin: 0; font-size: var(--v-text-sm); }
  .dt-fact-edit .v-inline-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
  .dt-subnav { position: sticky; top: calc(-1 * var(--v-space-4)); z-index: var(--v-z-sticky); background: var(--v-ground); padding-top: var(--v-space-1); }
  .dt-sec { scroll-margin-top: 56px; min-width: 0; }
  .dt-sec .v-section { gap: var(--v-space-3); }
  .dt-list { display: flex; flex-direction: column; gap: var(--v-space-1); }
  .dt-list-row { display: flex; align-items: center; gap: var(--v-space-1); min-width: 0; }
  .dt-list-text { flex: 1; min-width: 0; }
  .dt-block { gap: var(--v-space-2); }
  .dt-block-head { min-height: var(--v-tap); }
  .dt-block-btn { flex: 1; display: flex; align-items: center; gap: var(--v-space-3); min-width: 0; min-height: var(--v-tap); border: 0; background: transparent; color: var(--v-text); cursor: pointer; text-align: left; font: inherit; padding: 0; }
  .dt-block-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-sm); }
  .dt-block-sum { font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
  .dt-when { font-size: var(--v-text-md); font-weight: var(--v-weight-semibold); }
  .dt-muted { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .dt-gp { display: flex; flex-direction: column; gap: 0; min-width: 0; }
  .dt-gp-note { margin-left: 34px; font-size: var(--v-text-sm); color: var(--v-text-2); }
  .dt-opts { align-items: start; }
  .dt-opt { gap: var(--v-space-3); }
  .dt-opt.is-rec { border-color: var(--v-red); }
  .dt-opt-total { display: flex; flex-direction: column; gap: var(--v-space-1); padding: var(--v-space-3); background: var(--v-surface-3); border-radius: var(--v-radius-md); }
  .dt-opt-n { font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: 1; font-weight: var(--v-weight-bold); }
  .dt-opt-plan { font-size: var(--v-text-sm); color: var(--v-text); }
  .dt-opt-gift { font-size: var(--v-text-sm); color: var(--v-status-booked-text); }
  .dt-opt-ret { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .dt-concept { gap: var(--v-space-2); }
  .dt-concept-label { font-weight: var(--v-weight-semibold); }
  .dt-outbar-row { width: 100%; max-width: 760px; flex-wrap: wrap; }
  .dt-outbar-row > .v-btn { flex: 1 1 140px; }
`;
