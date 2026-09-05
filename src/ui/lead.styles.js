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
  .dt-pillbtn { border: 0; background: transparent; padding: 0; cursor: pointer; display: inline-flex; align-items: center; min-height: var(--v-tap); min-width: var(--v-tap); }
  .dt-pillbtn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-pill); }
  .dt-inline-pill { font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); letter-spacing: 0.04em; color: var(--v-text-2); min-height: var(--v-tap); display: inline-flex; align-items: center; }
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

/* Clients module (Prompt 10): ClientCard (clc-) and ClientWorkspace (cw-).
 * Prompt 12: the list plus right panel split (po-) used by Print Orders,
 * Concepts, and Submissions lives here so every screen shares it. */
export const clientStyles = `
  /* Shared list page rules (Prompt 13): every list screen uses these. */
  .cl-shell.aa-main, .po-shell.aa-main { display: flex; flex-direction: column; }
  .cl-page { --v-stack-gap: var(--v-space-4); }
  .cl-search { max-width: 520px; }
  .cl-clear { display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); border: 0; background: transparent; color: var(--v-text-3); cursor: pointer; border-radius: var(--v-radius-sm); }
  .cl-clear:hover { color: var(--v-text); }
  .cl-stack { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .cl-stack > .v-stagger-item { display: contents; }
  .cl-muted { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .cl-muted-cell { color: var(--v-text-3); }
  .cl-cell-biz { display: inline-flex; align-items: center; gap: var(--v-space-2); min-width: 0; max-width: 200px; font-weight: var(--v-weight-semibold); }
  .po-split { display: flex; flex: 1; min-height: 0; min-width: 0; }
  .po-page { --v-stack-gap: var(--v-space-4); flex: 1; min-width: 0; }
  .po-panel { width: 440px; flex-shrink: 0; border-left: 1px solid var(--v-border); background: var(--v-surface-1); min-height: 0; display: flex; flex-direction: column; animation: po-panel-in var(--v-dur-base) var(--v-ease-out) both; }
  @keyframes po-panel-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
  @media (min-width: 1440px) { .po-panel { width: 520px; } }
  .po-panel-scroll { padding: var(--v-space-4); }
  /* Mark paid (Prompt 14): the schedule row that just got paid pulses in the won tone. */
  .cw-row-paid .v-td { animation: cw-row-paid calc(var(--v-dur-slow) * 2) var(--v-ease-out) 1; }
  @keyframes cw-row-paid { 0% { background: var(--v-status-won-soft); } 100% { background: var(--v-surface-1); } }

  .clc { display: flex; flex-direction: column; min-width: 0; }
  .clc .lc { border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
  .clc:has(> .lc:only-child) .lc, .clc > .lc:last-child { border-radius: var(--v-radius-md); }
  .clc-line { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-2) var(--v-space-3); background: var(--v-surface-2); border: 1px solid var(--v-border); border-top: 0; border-radius: 0 0 var(--v-radius-md) var(--v-radius-md); min-width: 0; }
  .clc.is-selected .clc-line { border-color: var(--v-red); }
  .clc-row { display: flex; align-items: center; gap: var(--v-space-2); flex-wrap: wrap; min-width: 0; }
  .clc-pkg .v-pill-label { max-width: 160px; }
  .clc-pay { flex-wrap: nowrap; }
  .clc-pay .v-bar { flex: 1 1 80px; }
  .clc-paid { font-size: var(--v-text-xs); color: var(--v-text-2); font-variant-numeric: tabular-nums; flex-shrink: 0; white-space: nowrap; }
  .clc-next, .clc-muted { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }

  .dt-left--client { display: flex; flex-direction: column; gap: var(--v-space-4); position: static; }
  .cw-links, .cw-brand { gap: var(--v-space-2); }
  .cw-link { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); border-bottom: 1px solid var(--v-border); }
  .cw-link:last-child { border-bottom: 0; }
  .cw-link-btn { display: inline-flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); color: var(--v-text); text-decoration: none; font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); flex-shrink: 0; }
  a.cw-link-btn:hover .cw-link-label { text-decoration: underline; }
  .cw-link-edit { min-width: 0; }
  .cw-link-field { width: 100%; font-size: var(--v-text-sm); }
  .cw-link-field .v-inline-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
  .cw-brand-row { display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); border-bottom: 1px solid var(--v-border); }
  .cw-brand-row:last-child { border-bottom: 0; }
  .cw-swatches { display: flex; flex-wrap: wrap; gap: var(--v-space-2); min-width: 0; }
  .cw-swatch { display: inline-flex; align-items: center; gap: var(--v-space-1); min-width: 0; }
  .cw-swatch-chip { width: 22px; height: 22px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-border-strong); background: var(--v-surface-3); flex-shrink: 0; position: relative; overflow: hidden; }
  .cw-swatch-x { position: absolute; inset: 0; background: linear-gradient(135deg, transparent 46%, var(--v-text-3) 47%, var(--v-text-3) 53%, transparent 54%); }
  .cw-swatch-edit { font-size: var(--v-text-sm); font-variant-numeric: tabular-nums; }
  .cw-copy-brand { flex-shrink: 0; }

  .cw-project { gap: var(--v-space-3); }
  .cw-project.is-current { border-color: var(--v-border-strong); }
  .cw-project-head { min-width: 0; }
  .cw-project-name { font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); color: var(--v-text); overflow-wrap: anywhere; }
  .cw-stepper { display: flex; gap: var(--v-space-1); margin: 0; padding: 0; list-style: none; overflow-x: auto; scrollbar-width: none; min-width: 0; }
  .cw-stepper::-webkit-scrollbar { display: none; }
  .cw-step { display: flex; align-items: center; gap: var(--v-space-1); flex: 1 0 auto; min-width: 0; padding: var(--v-space-1) var(--v-space-2); border-radius: var(--v-radius-pill); background: var(--v-surface-2); color: var(--v-text-3); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); font-weight: var(--v-weight-bold); letter-spacing: 0.02em; white-space: nowrap; }
  .cw-step-dot { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--v-surface-3); color: var(--v-text-2); font-size: 10px; flex-shrink: 0; }
  .cw-step.is-done { color: var(--v-status-booked-text); }
  .cw-step.is-done .cw-step-dot { background: var(--v-status-booked-solid); color: var(--v-text-inverse); }
  .cw-step.is-current { background: var(--v-red-soft); color: var(--v-red-highlight); }
  .cw-step.is-current .cw-step-dot { background: var(--v-red); color: var(--v-text-on-red); }
  .cw-rev { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-3); background: var(--v-surface-2); border-radius: var(--v-radius-md); min-width: 0; }
  .cw-rev-label { font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-2); }
  .cw-rev-log { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--v-space-1); }
  .cw-rev-log li { display: flex; align-items: center; gap: var(--v-space-2); flex-wrap: wrap; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); min-width: 0; }
  .cw-rev-when { color: var(--v-text-3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .cw-rev-note { min-width: 0; overflow-wrap: anywhere; }
  .cw-project-meta { align-items: center; }
  .cw-delivery { gap: var(--v-space-2); }
  .cw-preview { gap: var(--v-space-2); }
  .cw-preview-row { font-size: var(--v-text-sm); color: var(--v-text-2); font-variant-numeric: tabular-nums; }
  .cw-picker { min-width: 200px; }
  .cw-sched-row .v-lrow-trail { flex-wrap: wrap; justify-content: flex-end; }
  .cw-plan { gap: var(--v-space-3); }
  .cw-kv { display: flex; flex-direction: column; gap: 2px; font-size: var(--v-text-md); font-weight: var(--v-weight-semibold); color: var(--v-text); min-width: 0; font-variant-numeric: tabular-nums; }
  .cw-stripe { gap: var(--v-space-2); border-color: color-mix(in srgb, var(--v-status-danger-solid) 45%, transparent); background: var(--v-status-danger-soft); }
  .cw-stripe--ok { border-color: color-mix(in srgb, var(--v-status-booked-solid) 45%, transparent); background: var(--v-status-booked-soft); }
  .cw-stripe-h--ok { color: var(--v-status-booked-text); }
  .cw-sub-id { font-size: var(--v-text-sm); font-family: var(--v-font-mono, monospace); }
  .cw-stripe-h { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); color: var(--v-status-danger-text); }
  .cw-ledger { gap: var(--v-space-3); }
  .cw-ledger-row .v-lrow-meta { font-weight: var(--v-weight-bold); color: var(--v-text); font-variant-numeric: tabular-nums; }
  .cw-retainer { gap: var(--v-space-3); }
  .cw-ret-price { font-size: var(--v-text-2xl); }
  .cw-ret-price small { font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-3); margin-left: 2px; }
  .cw-months { margin-top: var(--v-space-1); }
  .cw-nextbill { gap: 0; }
  .cw-nextbill-amt { font-size: var(--v-text-md); font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; }
  .cw-month { gap: var(--v-space-2); }
  .cw-month.is-current { border-color: var(--v-status-booked-solid); }
  .cw-month-name { display: inline-flex; align-items: center; gap: var(--v-space-2); font-weight: var(--v-weight-bold); color: var(--v-text); flex-wrap: wrap; }
  .cw-release { gap: var(--v-space-3); }
  .cw-release-toggle .v-toggle-desc { overflow-wrap: anywhere; }
  .cw-dgroup { gap: var(--v-space-2); }
  .cw-deliv { display: flex; flex-direction: column; gap: 0; min-width: 0; border-bottom: 1px solid var(--v-border); padding-bottom: var(--v-space-1); }
  .cw-deliv:last-child { border-bottom: 0; }
  .cw-deliv-link { display: flex; align-items: center; gap: var(--v-space-1); margin-left: 34px; min-width: 0; font-size: var(--v-text-sm); }
  .cw-deliv-edit.has-link { color: var(--v-status-progress-text); }
  .cw-deliv-link .v-inline { flex: 1; min-width: 0; }
  .cw-deliv-a { color: var(--v-status-progress-text); text-decoration: none; }
  .cw-deliv-a:hover { text-decoration: underline; }
  .cw-deliv-edit { font-size: var(--v-text-sm); color: var(--v-text-3); }
  .cw-deliv-edit .v-inline-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
`;
