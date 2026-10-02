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
  /* The record (UI simplification, part A): one column, 860px at most, 20px gaps. */
  .rc-inner { display: flex; flex-direction: column; gap: var(--v-space-5); width: 100%; max-width: 860px; margin: 0 auto; min-width: 0; }
  .rc-head { display: flex; flex-wrap: wrap; align-items: flex-start; gap: var(--v-space-3); min-width: 0; border-radius: var(--v-radius-md); }
  .rc-avatar { margin-top: 2px; }
  .rc-head-main { flex: 1 1 300px; min-width: 0; display: flex; flex-direction: column; gap: var(--v-space-1); }
  .rc-head-top { display: flex; flex-wrap: wrap; align-items: center; gap: var(--v-space-1) var(--v-space-3); min-width: 0; min-height: var(--v-tap); }
  .rc-name { margin: 0; flex: 0 1 auto; min-width: 0; font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); letter-spacing: var(--v-ls-display-sm); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; }
  .rc-pills { display: inline-flex; align-items: center; gap: var(--v-space-1); flex-shrink: 0; }
  .rc-ctx { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); min-width: 0; overflow: hidden; overflow-wrap: anywhere; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
  .rc-ctx-part { white-space: normal; }
  .rc-dot { margin: 0 var(--v-space-2); color: var(--v-text-3); }
  /* D4: the number is a link in running text; its tap area is a 44px box laid over it, not a bigger glyph. */
  .rc-tel { position: relative; display: inline-block; color: inherit; text-decoration: none; }
  .rc-tel::after { content: ''; position: absolute; left: -8px; right: -8px; top: 50%; height: var(--v-tap); transform: translateY(-50%); }
  .rc-tel:hover { text-decoration: underline; }
  .rc-head-actions { display: flex; align-items: center; gap: var(--v-space-2); flex-shrink: 0; margin-left: auto; }
  .rc-head--phone { flex-wrap: wrap; }
  .rc-head--phone .rc-head-main { flex: 1 1 100%; }
  .rc-head--phone .rc-head-top { min-height: 0; }
  .rc-head--phone .rc-head-actions { flex: 1 1 100%; flex-wrap: wrap; }
  .rc-head--phone .rc-head-actions .v-btn { flex: 1 1 120px; min-width: 0; }
  /* The next action strip: red-soft, red border, one line, one button. */
  .rc-next { display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap); padding: var(--v-space-2) var(--v-space-3); border: 1px solid var(--v-red); border-radius: var(--v-radius-md); background: var(--v-red-soft); color: var(--v-text); min-width: 0; }
  .rc-next-icon { color: var(--v-red-highlight); flex-shrink: 0; }
  .rc-next-text { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: var(--v-space-2); flex-wrap: wrap; }
  .rc-next-label { font-weight: var(--v-weight-bold); }
  .rc-next-due { font-size: var(--v-text-sm); color: var(--v-text-2); }
  .rc-next-btn { flex-shrink: 0; }
  /* The facts (law 3): two columns of one line rows, the label 88px in caps, only filled values. */
  .rc-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--v-space-5); row-gap: 0; min-width: 0; }
  .rc-fact { display: grid; grid-template-columns: 88px minmax(0, 1fr); align-items: center; gap: var(--v-space-2); min-height: calc(var(--v-tap) + 1px); border-bottom: 1px solid var(--v-border); min-width: 0; }
  .rc-fact--wide { grid-template-columns: 88px minmax(0, 1fr) auto; }
  .rc-fact--add { border-bottom: 0; grid-template-columns: minmax(0, 1fr); }
  .rc-fact--sheet { border-bottom: 0; grid-template-columns: minmax(0, 1fr); gap: 0; }
  .rc-fact-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .rc-fact-ro { font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
  .rc-fact-val { font-size: var(--v-text-sm); color: var(--v-text); min-width: 0; }
  .rc-fact-edit { width: 100%; margin: 0; font-size: var(--v-text-sm); }
  .rc-fact-edit .v-inline-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }
  .rc-fact--sheet .rc-fact-edit .v-inline-text { white-space: normal; }
  .rc-fact-act { flex-shrink: 0; display: inline-flex; gap: var(--v-space-1); }
  .rc-angle { margin: 0; max-width: 68ch; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text-2); overflow-wrap: anywhere; }
  .rc-angle--edit { display: flex; width: 100%; }
  .rc-tabs { position: sticky; top: calc(-1 * var(--v-space-4)); z-index: var(--v-z-sticky); background: var(--v-ground); }
  .rc-panel { min-width: 0; display: flex; flex-direction: column; gap: var(--v-space-4); }
  /* Sections share these: a small caps label, a group, one line of text, the one line empty state (law 6). */
  .rc-group { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .rc-label { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .rc-line { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .rc-line--danger { color: var(--v-status-danger-text); font-weight: var(--v-weight-semibold); }
  .rc-muted { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .rc-empty { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); flex-wrap: wrap; min-height: var(--v-tap); font-size: var(--v-text-sm); color: var(--v-text-2); }
  .rc-empty-text { min-width: 0; }
  .rc-picker { align-self: flex-start; max-width: 100%; }
  .rc-cp, .rc-meeting, .rc-playbook, .rc-notes, .rc-history, .rc-money, .rc-project, .rc-files, .rc-pricing, .rc-details { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; }
  .rc-cp-pkg { max-width: 360px; }
  /* Money (law 1): the one figure, the bar, the table, the ledger behind a disclosure. */
  .rc-money-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--v-space-3); flex-wrap: wrap; min-width: 0; }
  .rc-money-n { font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text); font-variant-numeric: tabular-nums; }
  .rc-money-side { font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
  .rc-money-bar .v-bar-track { height: 6px; }
  .rc-money-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); flex-wrap: wrap; }
  .rc-disclose { display: inline-flex; align-items: center; gap: var(--v-space-1); min-height: var(--v-tap); padding: 0 var(--v-space-2); border: 0; background: transparent; color: var(--v-text-2); font: inherit; font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); cursor: pointer; border-radius: var(--v-radius-sm); }
  .rc-disclose:hover { color: var(--v-text); background: var(--v-surface-2); }
  .rc-disclose:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .rc-disclose-chev { transition: transform var(--v-dur-base) var(--v-ease-out); }
  .rc-disclose.is-open .rc-disclose-chev { transform: rotate(180deg); }
  .rc-ledger { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-1) 0; }
  .rc-ledger-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .rc-ledger-row { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); min-height: var(--v-tap); border-bottom: 1px solid var(--v-border); font-size: var(--v-text-sm); color: var(--v-text); }
  .rc-ledger-what { display: flex; flex-direction: column; min-width: 0; }
  .rc-ledger-amt { font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .rc-rounds { min-height: var(--v-tap); }
  /* Retainer: the months as rows. */
  .rc-month { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: 'name btn' 'bar btn' 'count btn'; align-items: center; column-gap: var(--v-space-3); row-gap: var(--v-space-1); padding: var(--v-space-2) 0; border-bottom: 1px solid var(--v-border); }
  .rc-month:last-child { border-bottom: 0; }
  .rc-month-name { grid-area: name; font-weight: var(--v-weight-bold); color: var(--v-text); }
  .rc-month-bar { grid-area: bar; }
  .rc-month-count { grid-area: count; font-size: var(--v-text-sm); color: var(--v-text-2); }
  .rc-month > .v-btn { grid-area: btn; }
  /* The phone (law 2): a stack of 56px rows, one open at a time, the chevron turns. */
  .rc-rows { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .rc-row { overflow: hidden; gap: 0; }
  .rc-row-btn { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: var(--v-tap-lg); padding: var(--v-space-1) var(--v-space-3); border: 0; background: transparent; color: var(--v-text); text-align: left; font: inherit; cursor: pointer; box-sizing: border-box; }
  .rc-row-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .rc-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .rc-row-title { font-size: var(--v-text-md); line-height: var(--v-lh-md); font-weight: var(--v-weight-bold); }
  .rc-row-sum { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); }
  .rc-row-chev { flex-shrink: 0; color: var(--v-text-3); }
  /* The first screen's own section, and a section on its screen (phone). */
  .rc-first, .rc-secscreen { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; }
  @media (max-width: 767px) {
    .rc-facts { grid-template-columns: minmax(0, 1fr); }
    .rc-fact--stack { grid-template-columns: 88px minmax(0, 1fr); }
    .rc-fact--stack .rc-fact-act { grid-column: 2; justify-self: start; padding-bottom: var(--v-space-2); }
    .rc-money-n { font-size: var(--v-text-xl); }
  }
  /* The checkpoints stepper (CRM revamp, step 5), a plain list now. */
  .dc-steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
  .dc-step { position: relative; display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap); padding: var(--v-space-2) 0; border-bottom: 1px solid var(--v-border); }
  .dc-step:last-child { border-bottom: 0; }
  .dc-dot { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; background: var(--v-surface-3); color: var(--v-text-2); font-size: var(--v-text-xs); font-weight: var(--v-weight-bold); }
  .dc-step.is-done .dc-dot { background: var(--v-status-booked-solid); color: var(--v-text-inverse); }
  .dc-step.is-current .dc-dot { box-shadow: 0 0 0 2px var(--v-red); }
  .dc-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .dc-label { font-weight: var(--v-weight-semibold); color: var(--v-text); }
  .dc-step.is-done .dc-label { color: var(--v-status-booked-text); }
  .dc-when { font-size: var(--v-text-xs); color: var(--v-text-3); }
  .dc-actions { flex-shrink: 0; display: inline-flex; align-items: center; gap: var(--v-space-1); }
  /* Pieces that stayed as they were: the list editor, the game plan, the pricing options, the meeting line. */
  .dt-list { display: flex; flex-direction: column; gap: var(--v-space-1); }
  .dt-list-row { display: flex; align-items: center; gap: var(--v-space-1); min-width: 0; }
  .dt-list-text { flex: 1; min-width: 0; }
  .dt-when { font-size: var(--v-text-md); font-weight: var(--v-weight-semibold); }
  /* A pill that opens a menu (the Submissions detail's status pill): a 44px transparent button around the pill. */
  .dt-pillbtn { border: 0; background: transparent; padding: 0; cursor: pointer; display: inline-flex; align-items: center; min-height: var(--v-tap); min-width: var(--v-tap); }
  .dt-pillbtn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-pill); }
  .dt-muted { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .dt-fact-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .dt-fact-ro { font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
  .dt-block { gap: var(--v-space-2); }
  .dt-block-head { min-height: var(--v-tap); }
  .dt-block-btn { flex: 1 1 var(--v-tap); display: flex; align-items: center; gap: var(--v-space-3); min-width: var(--v-tap); min-height: var(--v-tap); border: 0; background: transparent; color: var(--v-text); cursor: pointer; text-align: left; font: inherit; padding: 0; }
  .dt-block-btn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-sm); }
  .dt-block-sum { font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
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
  /* The outcome bar (booked and deal): the current next action and Mark as lost. */
  .dt-outbar-row { width: 100%; max-width: 860px; margin: 0 auto; }
  .dt-outbar-row > .v-btn, .dt-outbar-row > .v-skel { flex: 1 1 140px; min-width: 0; }
  .dt-triagebar-row > .v-btn, .dt-triagebar-row > .v-skel { flex: 1 1 120px; }
  @media (max-width: 479px) { .dt-triagebar-row > .v-btn, .dt-triagebar-row > .v-skel { flex: 1 1 40%; } }
  /* The lead score pill (Triage and the triage record header). */
  .tr-score { display: inline-flex; align-items: center; justify-content: center; min-width: 36px; height: 28px; padding: 0 var(--v-space-2); border-radius: var(--v-radius-pill); font-family: var(--v-font-display); font-size: var(--v-text-md); font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .tr-score--booked { background: var(--v-status-booked-soft); color: var(--v-status-booked-text); }
  .tr-score--new { background: var(--v-status-new-soft); color: var(--v-status-new-text); }
  .tr-score--neutral { background: var(--v-status-neutral-soft); color: var(--v-status-neutral-text); }
`;

/* Clients module (Prompt 10): the client rows (clc-) and ClientWorkspace (cw-).
 * Prompt 12: the list plus right panel split (po-) used by Print Orders,
 * Concepts, and Submissions lives here so every screen shares it. */
export const clientStyles = `
  /* Orders CSV import (Settings, Data): the file input is a 44px target (Prompt 15). */
  .oi-file { min-height: var(--v-tap); max-width: 100%; padding: var(--v-space-2) 0; color: var(--v-text-2); font-family: var(--v-font-body); font-size: var(--v-text-sm); }
  .oi-file:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-sm); }
  /* Shared list page rules (Prompt 13): every list screen uses these. */
  .cl-shell.aa-main, .po-shell.aa-main { display: flex; flex-direction: column; }
  .cl-page { --v-stack-gap: var(--v-space-4); }
  .cl-search { max-width: 520px; }
  .ts-date { flex: 1 1 160px; }
  .ts-time { flex: 1 1 120px; }
  .lsr { max-width: 520px; flex: 1; min-width: 0; }
  .lsr-skel { display: block; max-width: 520px; }
  /* The 44px clear button sits inside a 44px field shell whose border takes 2px: the negative block margin keeps the shell at 44 whether or not a query is typed (it grew to 46 and shifted the list). */
  .lsr-clear { margin: -1px 0; display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); border: 0; border-radius: var(--v-radius-sm); background: transparent; color: var(--v-text-3); cursor: pointer; }
  .lsr-clear:hover { color: var(--v-text); background: var(--v-surface-3); }
  .cl-stack { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .cl-stack > .v-stagger-item { display: contents; }
  .cl-muted { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .cl-muted-cell { color: var(--v-text-3); }
  .cl-cell-biz { display: inline-block; min-width: 0; max-width: 200px; font-weight: var(--v-weight-semibold); }
  /* The client pill (src/lib/clientRowPill.js) keeps its whole label on a row. */
  .clc-pill { max-width: 60%; }
  .po-split { display: flex; flex: 1; min-height: 0; min-width: 0; }
  .po-page { --v-stack-gap: var(--v-space-4); flex: 1; min-width: 0; }
  .po-panel { width: 440px; flex-shrink: 0; border-left: 1px solid var(--v-border); background: var(--v-surface-1); min-height: 0; display: flex; flex-direction: column; animation: po-panel-in var(--v-dur-base) var(--v-ease-out) both; }
  @keyframes po-panel-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
  @media (min-width: 1440px) { .po-panel { width: 520px; } }
  .po-panel-scroll { padding: var(--v-space-4); }
  /* Mark paid (Prompt 14): the schedule row that just got paid pulses in the won tone. */
  .cw-row-paid .v-td { animation: cw-row-paid calc(var(--v-dur-slow) * 2) var(--v-ease-out) 1; }
  @keyframes cw-row-paid { 0% { background: var(--v-status-won-soft); } 100% { background: var(--v-surface-1); } }



  /* The showcase editor's derived rows (a value edited elsewhere, src/pages/AdminShowcase.jsx). */
  .cw-brand-row { display: grid; grid-template-columns: 96px minmax(0, 1fr); align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); border-bottom: 1px solid var(--v-border); }
  .cw-brand-row:last-child { border-bottom: 0; }
  .sc-derived { grid-template-columns: 96px minmax(0, 1fr) auto; }
  .sc-derived .dt-fact-ro { display: block; min-width: 0; max-width: 100%; }
  .sc-derived-btn { justify-self: end; }

  .cw-project { gap: var(--v-space-3); }
  .cw-project.is-current { border-color: var(--v-border-strong); }
  .cw-project-head { min-width: 0; }
  .cw-project-name { font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); color: var(--v-text); overflow-wrap: anywhere; }
  .cw-stepper { display: flex; align-items: center; gap: var(--v-space-1); margin: 0; padding: var(--v-space-2) 0; min-height: var(--v-tap); list-style: none; overflow-x: auto; scrollbar-width: none; min-width: 0; border-radius: var(--v-radius-sm); }
  .cw-stepper:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .cw-stepper::-webkit-scrollbar { display: none; }
  .cw-step { display: flex; align-items: center; gap: var(--v-space-1); flex: 1 0 auto; min-width: 0; padding: var(--v-space-1) var(--v-space-2); border-radius: var(--v-radius-pill); background: var(--v-surface-2); color: var(--v-text-3); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); font-weight: var(--v-weight-bold); letter-spacing: 0.02em; white-space: nowrap; }
  .cw-step-dot { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--v-surface-3); color: var(--v-text-2); font-size: 10px; flex-shrink: 0; }
  .cw-step.is-done { color: var(--v-status-booked-text); }
  .cw-step.is-done .cw-step-dot { background: var(--v-status-booked-solid); color: var(--v-text-inverse); }
  .cw-step.is-current { background: var(--v-red-soft); color: var(--v-red-highlight); }
  .cw-step.is-current .cw-step-dot { background: var(--v-red); color: var(--v-text-on-red); }
  .cw-rev-label { font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-2); }
  .cw-rev-log { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: var(--v-space-1); }
  .cw-rev-log li { display: flex; align-items: center; gap: var(--v-space-2); flex-wrap: wrap; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); min-width: 0; }
  .cw-rev-when { color: var(--v-text-3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .cw-rev-note { min-width: 0; overflow-wrap: anywhere; }
  /* An invoice row (milestone 2): the title and amount take the first line, the status, the primary action and the menu wrap under it on a narrow row instead of running past the edge. */
  .cw-sched-row { flex-wrap: wrap; }
  /* A phone: the invoice rows sit in the Invoices card as lines, not as cards inside a card (one container, dividers between). */
  @media (max-width: 767px) { .iv-card .cw-sched-row { background: transparent; border-width: 0 0 1px; border-radius: 0; padding-left: 0; padding-right: 0; } .iv-card .cw-sched-row:last-child { border-bottom-width: 0; } }
  .cw-sched-row .v-lrow-main { flex: 1 1 9rem; }
  .cw-sched-row .v-lrow-side { flex: 0 1 auto; min-width: 0; max-width: 100%; margin-left: auto; }
  .cw-sched-row .v-lrow-side > .v-row { flex-wrap: wrap; justify-content: flex-end; min-width: 0; max-width: 100%; }
  .cw-kv { display: flex; flex-direction: column; gap: 2px; font-size: var(--v-text-md); font-weight: var(--v-weight-semibold); color: var(--v-text); min-width: 0; font-variant-numeric: tabular-nums; }
  .cw-sub-id { font-size: var(--v-text-sm); font-family: var(--v-font-mono, monospace); }
  .cw-retainer { gap: var(--v-space-3); }
  .cw-ret-price { font-size: var(--v-text-2xl); }
  .cw-ret-price small { font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-3); margin-left: 2px; }
  .cw-nextbill { min-height: var(--v-tap); }
  .cw-nextbill-amt { font-size: var(--v-text-md); font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; }
  .cw-release-toggle .v-toggle-desc { overflow-wrap: anywhere; }
  .cw-deliv { display: flex; flex-direction: column; gap: 0; min-width: 0; border-bottom: 1px solid var(--v-border); padding-bottom: var(--v-space-1); }
  .cw-deliv:last-child { border-bottom: 0; }
  .cw-deliv-link { display: flex; align-items: center; gap: var(--v-space-1); margin-left: 34px; min-width: 0; font-size: var(--v-text-sm); }
  .cw-deliv-edit.has-link { color: var(--v-status-progress-text); }
  .cw-deliv-link .v-inline { flex: 1; min-width: 0; }
  .cw-deliv-a { color: var(--v-status-progress-text); text-decoration: none; }
  .cw-deliv-a:hover { text-decoration: underline; }
  .cw-deliv-edit { font-size: var(--v-text-sm); color: var(--v-text-3); }
  .cw-deliv-edit .v-inline-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; overflow-wrap: normal; }

  /* Showcase tab (Site Prompt 2 Part 2): sc- prefix. */
  .sc-imgfield { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; }
  .sc-thumb-warn { margin: 0; font-size: var(--v-text-xs); color: var(--v-status-danger-text); }
  .sc-objrow { display: flex; flex-direction: row; align-items: flex-start; gap: var(--v-space-2); min-width: 0; }
  .sc-objrow[draggable="true"] { cursor: grab; }
  .sc-url { display: inline-flex; align-items: center; min-height: var(--v-tap); color: var(--v-status-progress-text); text-decoration: none; }
  .sc-url:hover { text-decoration: underline; }
  .sc-url--min { flex: 1 1 0; min-width: 0; max-width: 100%; }
  .sc-chip { display: inline-block; width: 22px; height: 22px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-border-strong); flex-shrink: 0; }
  .sc-testi-quote { margin: 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); color: var(--v-text); overflow-wrap: anywhere; }
  .sc-testi-author { font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-2); }
  .sc-stars { display: inline-flex; align-items: center; gap: 2px; }
  .sc-star { display: inline-flex; padding: 2px; border: 0; background: transparent; color: var(--v-border-strong); cursor: pointer; border-radius: var(--v-radius-sm); }
  .sc-star:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 1px; }
  .sc-star.is-on, .sc-star-on { color: var(--v-status-new-solid); }
  .sc-star-off { color: var(--v-border-strong); }
`;
