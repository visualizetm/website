/* The doc editor's styles (docs job): the page, the blocks, the formatting bar, the sheets and the print sheet. Tokens only on screen; the
 * print sheet is black on white by design (paper does not take the theme), so it names its colours. */
export const docEditorStyles = `
  .dd-topbar { position: sticky; top: 0; z-index: var(--v-z-sticky); display: flex; align-items: center; gap: var(--v-space-2); padding: var(--v-space-2) 0; background: var(--v-surface-1); border-bottom: 1px solid var(--v-border-1); }
  .dd-topspace { flex: 1; }
  .dd-body { display: flex; flex-direction: column; gap: var(--v-space-3); width: 100%; max-width: 760px; margin: 0 auto; padding-top: var(--v-space-3); padding-bottom: calc(var(--v-space-8) + 96px); min-width: 0; }
  .dd-head { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .dd-title { width: 100%; margin: 0; padding: var(--v-space-1) 0; min-height: var(--v-tap); color: var(--v-text); font-family: var(--v-font-display); font-size: var(--v-text-2xl); line-height: var(--v-lh-2xl); letter-spacing: var(--v-ls-2xl); text-transform: uppercase; font-weight: var(--v-weight-bold); overflow-wrap: anywhere; outline: none; }
  .dd-title:empty::before { content: attr(data-placeholder); color: var(--v-text-3); pointer-events: none; }
  .dd-title:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 4px; border-radius: var(--v-radius-sm); }
  .dd-meta { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); min-width: 0; }
  .dd-client { margin: 0; min-width: 0; font-size: var(--v-text-sm); color: var(--v-text-2); }
  .dd-clientbtn { min-height: var(--v-tap); padding: 0; border: 0; background: transparent; color: var(--v-text-2); font: inherit; text-align: left; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; overflow-wrap: anywhere; }
  .dd-clientbtn:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; border-radius: var(--v-radius-sm); }
  .dd-status { margin: 0; flex-shrink: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }
  .dd-status.is-failed, .dd-status.is-rejected { color: var(--v-status-danger-text); font-weight: var(--v-weight-bold); }
  .dd-selects { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--v-space-3); }
  .dd-selects > :only-child { grid-column: 1 / -1; }
  @media (min-width: 768px) { .dd-selects { grid-template-columns: minmax(0, 220px) minmax(0, 280px); } }
  .dd-deleted { display: flex; align-items: center; justify-content: space-between; gap: var(--v-space-3); flex-wrap: wrap; padding: var(--v-space-3); border: 1px solid var(--v-status-danger-text); border-radius: var(--v-radius-md); background: var(--v-status-danger-soft); color: var(--v-text); font-size: var(--v-text-sm); }
  .dd-skel { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .dd-sheetfoot { display: flex; justify-content: flex-end; gap: var(--v-space-2); flex-wrap: wrap; }

  .dc { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .dc-blocks { display: flex; flex-direction: column; min-width: 0; }
  .dc-slot { position: relative; min-width: 0; }
  .dc-slot[data-dropbefore]::before { content: ''; position: absolute; left: 0; right: 0; top: -2px; height: 3px; border-radius: 2px; background: var(--v-border-focus); z-index: 3; }
  .dc-slot[data-dropbefore='end'] { height: 6px; }
  .dc-row { position: relative; display: flex; align-items: flex-start; gap: var(--v-space-1); min-width: 0; min-height: var(--v-tap); background: var(--v-ground); border-radius: var(--v-radius-md); }
  .dc-row.is-dragging { box-shadow: var(--v-shadow-3, 0 8px 24px var(--v-border-2)); background: var(--v-surface-2); opacity: 0.92; }
  .dc-body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; align-self: stretch; }
  .dc-grip { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); padding: 0; border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-text-3); cursor: grab; touch-action: none; opacity: 0.6; }
  .dc-grip:hover, .dc-grip:focus-visible { opacity: 1; background: var(--v-surface-2); }
  .dc-grip:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  @media (hover: hover) and (min-width: 768px) { .dc-grip { opacity: 0; } .dc-row:hover .dc-grip, .dc-row:focus-within .dc-grip { opacity: 0.8; } }
  .dc-rt { flex: 1; min-width: 0; padding: 10px 0; outline: none; color: var(--v-text); font-size: var(--v-text-md); line-height: var(--v-lh-md); white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; caret-color: var(--v-red-highlight); -webkit-user-select: text; user-select: text; }
  .dc-rt:empty::before { content: attr(data-placeholder); color: var(--v-text-3); pointer-events: none; }
  .dc-rt a { color: var(--v-status-progress-text); text-decoration: underline; text-underline-offset: 3px; }
  .dc-rt--h1 { font-size: var(--v-text-xl); line-height: var(--v-lh-xl); font-weight: var(--v-weight-bold); padding-top: var(--v-space-3); }
  .dc-rt--h2 { font-size: var(--v-text-lg); line-height: var(--v-lh-lg); font-weight: var(--v-weight-bold); padding-top: var(--v-space-2); }
  .dc-rt--quote { padding-left: var(--v-space-3); border-left: 3px solid var(--v-border-2); color: var(--v-text-2); font-style: italic; }
  .dc-rt--check.is-done { color: var(--v-text-3); text-decoration: line-through; }
  .dc-li { display: flex; align-items: flex-start; gap: var(--v-space-1); min-width: 0; }
  .dc-mark { flex: 0 0 auto; width: 20px; padding-top: 10px; text-align: center; color: var(--v-text-3); font-size: var(--v-text-md); line-height: var(--v-lh-md); }
  .dc-mark--n { width: 28px; text-align: right; padding-right: var(--v-space-1); font-variant-numeric: tabular-nums; }
  .dc-tick { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); margin-left: -8px; margin-right: -8px; padding: 0; border: 0; background: transparent; cursor: pointer; }
  .dc-tick:disabled { cursor: default; }
  .dc-tick-box { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-border-strong); background: var(--v-surface-2); color: var(--v-text-on-red); }
  .dc-tick[aria-checked='true'] .dc-tick-box { background: var(--v-red-hover); border-color: var(--v-red); }
  .dc-tick:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -4px; border-radius: var(--v-radius-md); }
  .dc-divider { padding: var(--v-space-4) 0; outline: none; border-radius: var(--v-radius-sm); }
  .dc-divider hr { margin: 0; border: 0; border-top: 1px solid var(--v-border-2); }
  .dc-divider:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .dc-link, .dc-image { display: flex; flex-direction: column; gap: var(--v-space-2); padding: var(--v-space-1) 0; min-width: 0; }
  .dc-linkro { margin: 0; padding: 10px 0; font-size: var(--v-text-md); line-height: var(--v-lh-md); overflow-wrap: anywhere; }
  .dc-linkro a { color: var(--v-status-progress-text); text-decoration: underline; text-underline-offset: 3px; }
  .dc-open { display: inline-flex; align-items: center; gap: var(--v-space-1); min-height: var(--v-tap); color: var(--v-status-progress-text); font-size: var(--v-text-sm); text-decoration: underline; text-underline-offset: 3px; }
  .dc-img { border-radius: var(--v-radius-md); border: 1px solid var(--v-border-1); }
  .dc-image-empty { display: flex; }
  .dc-upload { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: var(--v-space-2); min-height: var(--v-tap-lg); width: 100%; border: 1px dashed var(--v-border-strong); border-radius: var(--v-radius-md); color: var(--v-text-2); font-size: var(--v-text-sm); cursor: pointer; }
  .dc-upload input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
  .dc-upload:has(input:focus-visible) { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .dc-upload.is-busy { opacity: 0.6; }
  .dc-hint { margin: 0; font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .dc-ref { display: flex; align-items: center; gap: var(--v-space-3); width: 100%; min-height: 56px; margin: var(--v-space-1) 0; padding: var(--v-space-2) var(--v-space-3); text-align: left; border: 1px solid var(--v-border-1); border-radius: var(--v-radius-md); background: var(--v-surface-2); color: var(--v-text); cursor: pointer; }
  .dc-ref:hover { border-color: var(--v-border-2); }
  .dc-ref:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .dc-ref.is-gone { opacity: 0.65; cursor: default; }
  .dc-ref-icon { flex-shrink: 0; color: var(--v-text-3); }
  .dc-ref-text { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .dc-ref-kind { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-3); }
  .dc-ref-label { font-size: var(--v-text-md); line-height: var(--v-lh-md); overflow-wrap: anywhere; }
  .dc-task { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); margin: 0 0 var(--v-space-1) var(--v-tap); padding: 0 var(--v-space-3); border: 1px solid var(--v-border-strong); border-radius: var(--v-radius-pill); background: var(--v-surface-2); color: var(--v-text); font: inherit; font-size: var(--v-text-sm); cursor: pointer; }
  .dc-task:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .dc-tail { display: flex; align-items: center; min-height: var(--v-tap); padding: 0 var(--v-space-2) 0 var(--v-tap); border: 0; background: transparent; color: var(--v-text-3); font: inherit; font-size: var(--v-text-sm); text-align: left; cursor: text; }
  .dc-tail:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; border-radius: var(--v-radius-md); }

  /* The bar: above the keyboard on a phone (it follows visualViewport), a sticky strip on a computer. */
  .dc-bar { display: flex; align-items: center; background: var(--v-surface-2); border: 1px solid var(--v-border-1); border-radius: var(--v-radius-md); min-width: 0; }
  .dc-bar[hidden] { display: none; }
  .dc-bar:not(.is-phone) { position: sticky; top: calc(var(--v-tap) + var(--v-space-4)); z-index: 4; }
  .dc-bar.is-phone { position: fixed; left: 0; right: 0; z-index: var(--v-z-sheet); border-radius: 0; border-width: 1px 0 0; padding: 0 var(--v-gutter-r) env(safe-area-inset-bottom, 0px) var(--v-gutter-l); }
  .dc-bar.is-phone.has-kb { padding-bottom: 0; }
  .dc-bar-row { display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .dc-bar-row::-webkit-scrollbar { display: none; }
  .dc-bar-row[data-fade='end'] { -webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent); mask-image: linear-gradient(to right, black calc(100% - 28px), transparent); }
  .dc-bar-row[data-fade='start'] { -webkit-mask-image: linear-gradient(to left, black calc(100% - 28px), transparent); mask-image: linear-gradient(to left, black calc(100% - 28px), transparent); }
  .dc-bar-row[data-fade='both'] { -webkit-mask-image: linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent); mask-image: linear-gradient(to right, transparent, black 28px, black calc(100% - 28px), transparent); }
  .dc-fb { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: var(--v-tap); height: var(--v-tap); padding: 0; border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-text-2); cursor: pointer; }
  .dc-fb:hover:not(:disabled) { background: var(--v-surface-3); color: var(--v-text); }
  .dc-fb:disabled { opacity: 0.35; cursor: default; }
  .dc-fb.is-on { background: var(--v-surface-3); color: var(--v-text); box-shadow: inset 0 -2px 0 var(--v-red); }
  .dc-fb:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .dc-bar-sep { flex: 0 0 1px; align-self: stretch; margin: var(--v-space-2) var(--v-space-1); background: var(--v-border-1); }
  .dc-done { flex: 0 0 auto; min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 0; background: transparent; color: var(--v-status-progress-text); font: inherit; font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); cursor: pointer; }

  /* The sheets. */
  .dc-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--v-space-2); }
  .dc-turn { display: flex; flex-wrap: wrap; gap: var(--v-space-2); margin-bottom: var(--v-space-3); }
  .dc-opt { display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap-lg); padding: 0 var(--v-space-3); border: 1px solid var(--v-border-1); border-radius: var(--v-radius-md); background: var(--v-surface-2); color: var(--v-text); font: inherit; font-size: var(--v-text-sm); text-align: left; cursor: pointer; }
  .dc-opt--sm { min-height: var(--v-tap); padding: 0 var(--v-space-3); }
  .dc-opt.is-on { border-color: var(--v-red); background: var(--v-surface-3); }
  .dc-opt:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .dc-acts { display: flex; flex-direction: column; gap: var(--v-space-1); }
  .dc-act { display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap-lg); padding: 0 var(--v-space-3); border: 0; border-radius: var(--v-radius-md); background: transparent; color: var(--v-text); font: inherit; font-size: var(--v-text-md); text-align: left; cursor: pointer; }
  .dc-act:hover:not(:disabled), .dc-act:focus-visible { background: var(--v-surface-2); outline: none; }
  .dc-act:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: -2px; }
  .dc-act:disabled { opacity: 0.4; cursor: default; }
  .dc-act.is-danger { color: var(--v-status-danger-text); }
  .dc-refgroup { display: flex; flex-direction: column; gap: var(--v-space-1); margin-bottom: var(--v-space-3); }
  .dc-refgroup-h { margin: 0; font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .dc-refopt { display: flex; align-items: center; gap: var(--v-space-3); min-height: var(--v-tap-lg); padding: var(--v-space-2) var(--v-space-3); border: 1px solid var(--v-border-1); border-radius: var(--v-radius-md); background: var(--v-surface-2); color: var(--v-text); font: inherit; font-size: var(--v-text-sm); text-align: left; cursor: pointer; }
  .dc-refopt-label { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .dc-refopt:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
  .dc-linkform { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .dc-linkfoot { display: flex; justify-content: flex-end; gap: var(--v-space-2); flex-wrap: wrap; }

  /* The print sheet: the doc alone, black on white, in a portal at the end of body; the app is hidden for print. */
  .dp-doc { display: none; }
  @media print {
    @page { margin: 18mm; }
    body > *:not(.dp-doc) { display: none !important; }
    html, body { height: auto !important; overflow: visible !important; background: white !important; color: black !important; }
    .dp-doc { display: block; color: black; background: white; font-family: Georgia, 'Times New Roman', serif; font-size: 11.5pt; line-height: 1.5; }
    .dp-kicker { margin: 0 0 4pt; font-family: system-ui, sans-serif; font-size: 9pt; letter-spacing: 0.08em; text-transform: uppercase; color: rgb(80 80 80); }
    .dp-title { margin: 0 0 4pt; font-family: system-ui, sans-serif; font-size: 22pt; line-height: 1.2; }
    .dp-date { margin: 0 0 14pt; font-family: system-ui, sans-serif; font-size: 9pt; color: rgb(80 80 80); }
    .dp-h1 { margin: 16pt 0 6pt; font-family: system-ui, sans-serif; font-size: 16pt; break-after: avoid; }
    .dp-h2 { margin: 12pt 0 4pt; font-family: system-ui, sans-serif; font-size: 13pt; break-after: avoid; }
    .dp-p, .dp-li, .dp-ref { margin: 0 0 6pt; break-inside: avoid; }
    .dp-li { display: flex; gap: 8pt; padding-left: 6pt; }
    .dp-mark { flex: 0 0 auto; min-width: 14pt; }
    .dp-quote { margin: 8pt 0; padding-left: 10pt; border-left: 2pt solid rgb(120 120 120); font-style: italic; }
    .dp-hr { margin: 12pt 0; border: 0; border-top: 0.75pt solid rgb(120 120 120); }
    .dp-img { margin: 8pt 0; break-inside: avoid; }
    .dp-img .img-fit { background: none; aspect-ratio: auto; overflow: visible; }
    .dp-img .img-fit > img { height: auto; max-height: 120mm; object-fit: contain; }
    .dp-img figcaption { font-family: system-ui, sans-serif; font-size: 9pt; color: rgb(80 80 80); }
    .dp-doc a { color: black; text-decoration: underline; }
  }
`;
