/**
 * FunnelBar (the nav revamp): the pipeline as one horizontal bar. Each step
 * is a segment sized by its count (never under a readable minimum), with
 * the count and the step conversion written on it, and a button when the
 * step opens a screen. Tokens only: the red for the first step, neutrals
 * fading after it; never colour alone, every number is text, and a
 * visually hidden table carries the same numbers for a screen reader.
 * @param {object} props
 * @param {Array<{ id, label, n, onClick, pct }>} props.steps  in order; the conversion of each step is n over the previous n (pct: false hides it, for an intake step)
 * @param {string} [props.label]
 */
export default function FunnelBar({ steps = [], label = 'Pipeline funnel', className = '' }) {
  const max = Math.max(1, ...steps.map(s => Number(s.n) || 0));
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  return (
    <div className={`v-funnel ${className}`.trim()} role="group" aria-label={label}>
      <div className="v-funnel-bar" aria-hidden="true">
        {steps.map((s, i) => {
          const n = Number(s.n) || 0;
          const grow = Math.max(12, Math.round((n / max) * 100));
          const conv = i > 0 && s.pct !== false ? pct(n, Number(steps[i - 1].n) || 0) : null;
          return (
            <div key={s.id} className={`v-funnel-seg v-funnel-seg--${Math.min(i, 5)}`} style={{ flexGrow: grow, flexBasis: 0 }}>
              <span className="v-funnel-n">{n}</span>
              <span className="v-funnel-label">{s.label}</span>
              {conv !== null && <span className="v-funnel-pct">{conv}%</span>}
            </div>
          );
        })}
      </div>
      <div className="v-sr-only"><table className="v-chart-table">
        <caption>{label}</caption>
        <thead><tr><th scope="col">Step</th><th scope="col">Count</th><th scope="col">Of the step before</th></tr></thead>
        <tbody>{steps.map((s, i) => { const conv = i > 0 && s.pct !== false ? pct(Number(s.n) || 0, Number(steps[i - 1].n) || 0) : null; return <tr key={s.id}><th scope="row">{s.label}</th><td>{Number(s.n) || 0}</td><td>{conv === null ? '' : `${conv}%`}</td></tr>; })}</tbody>
      </table></div>
      {steps.some(s => s.onClick) && (
        <div className="v-funnel-links">
          {steps.filter(s => s.onClick).map(s => <button key={s.id} type="button" className="v-funnel-link" onClick={s.onClick}>{s.label} {Number(s.n) || 0}</button>)}
        </div>
      )}
    </div>
  );
}

export const funnelBarStyles = `
  .v-funnel { display: flex; flex-direction: column; gap: var(--v-space-2); min-width: 0; }
  .v-funnel-bar { display: flex; gap: 2px; min-width: 0; height: 56px; border-radius: var(--v-radius-md); overflow: hidden; }
  .v-funnel-seg { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 1px; min-width: 0; padding: 0 var(--v-space-2); background: var(--v-surface-3); color: var(--v-text); text-align: left; overflow: hidden; }
  /* The first step rests on the hover red: white on it reads 5.11:1 (docs/TOKENS.md), the base red falls short for small text. */
  .v-funnel-seg--0 { background: var(--v-red-hover); color: var(--v-text-on-red); }
  .v-funnel-seg--0 .v-funnel-label, .v-funnel-seg--0 .v-funnel-pct { color: var(--v-text-on-red); }
  .v-funnel-seg--1 { background: var(--v-surface-4, var(--v-surface-3)); }
  .v-funnel-n { font-family: var(--v-font-display); font-size: var(--v-text-lg); line-height: 1.1; font-weight: var(--v-weight-bold); font-variant-numeric: tabular-nums; }
  .v-funnel-label { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); color: var(--v-text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .v-funnel-pct { font-size: 10px; line-height: 12px; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  /* The step buttons: the readable row under the bar (the bar's segments are decorative, the links are the 44px targets). */
  .v-funnel-links { display: flex; flex-wrap: wrap; gap: var(--v-space-1); }
  .v-funnel-link { min-height: var(--v-tap); padding: 0 var(--v-space-3); border: 1px solid var(--v-border); border-radius: var(--v-radius-pill); background: var(--v-surface-2); color: var(--v-text-2); cursor: pointer; font-family: var(--v-font-body); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); }
  .v-funnel-link:hover { background: var(--v-surface-3); color: var(--v-text); }
  .v-funnel-link:focus-visible { outline: 2px solid var(--v-border-focus); outline-offset: 2px; }
`;
