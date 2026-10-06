/**
 * BarChart (the nav revamp): vertical bars with the value written on each
 * (never a legend to decode), a baseline row of labels, tokens only. The
 * SVG is decorative to a screen reader; a visually hidden table carries the
 * same numbers. Reads at 320: the labels thin to every other one past
 * eight bars, and the bars keep a minimum gap.
 * @param {object} props
 * @param {Array<{ label: string, value: number }>} props.data
 * @param {(n: number) => string} [props.format]  how a value prints (money, a count)
 * @param {string} props.label  the chart's name (the table caption)
 * @param {number} [props.height=140]
 * @param {string} [props.tone='--v-chart-1']  the bar colour token
 */
export default function BarChart({ data = [], format = (n) => String(n), label, height = 140, tone = '--v-chart-1', className = '' }) {
  const W = 320; const PAD = 4; const LABEL_H = 18; const VALUE_H = 14;
  const max = Math.max(1, ...data.map(d => Number(d.value) || 0));
  const n = Math.max(1, data.length);
  const slot = (W - PAD * 2) / n;
  const bw = Math.max(6, Math.min(40, slot * 0.64));
  const plotH = height - LABEL_H - VALUE_H;
  const every = n > 8 ? 2 : 1;
  const empty = data.every(d => !(Number(d.value) > 0));
  return (
    <div className={`v-chart v-chart--bar ${className}`.trim()}>
      <svg className="v-chart-svg" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" style={{ height }}>
        <line x1={PAD} x2={W - PAD} y1={VALUE_H + plotH + 0.5} y2={VALUE_H + plotH + 0.5} className="v-chart-axis" />
        {data.map((d, i) => {
          const v = Number(d.value) || 0; const h = empty ? 0 : Math.max(v > 0 ? 2 : 0, (v / max) * plotH);
          const x = PAD + slot * i + (slot - bw) / 2; const y = VALUE_H + plotH - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={h} rx={2} style={{ fill: `var(${tone})` }} />
              {v > 0 && <text x={x + bw / 2} y={y - 3} textAnchor="middle" className="v-chart-value">{format(v)}</text>}
              {i % every === 0 && <text x={x + bw / 2} y={height - 4} textAnchor="middle" className="v-chart-label">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      <table className="v-sr-only"><caption>{label}</caption><thead><tr><th scope="col">Period</th><th scope="col">Value</th></tr></thead><tbody>{data.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{format(Number(d.value) || 0)}</td></tr>)}</tbody></table>
    </div>
  );
}

export const chartStyles = `
  .v-chart { position: relative; min-width: 0; width: 100%; }
  .v-chart-svg { display: block; width: 100%; overflow: visible; }
  .v-chart-axis { stroke: var(--v-border); stroke-width: 1; }
  .v-chart-grid { stroke: var(--v-border); stroke-width: 1; stroke-dasharray: 2 4; }
  .v-chart-value { font-family: var(--v-font-body); font-size: 10px; font-weight: var(--v-weight-bold); fill: var(--v-text-2); font-variant-numeric: tabular-nums; }
  .v-chart-label { font-family: var(--v-font-body); font-size: 10px; fill: var(--v-text-3); }
  .v-chart-point { fill: var(--v-ground); stroke-width: 2; }
  /* The donut's legend rows: a swatch, the label, the value (the colour is never the only cue). */
  .v-donut { display: flex; align-items: center; gap: var(--v-space-4); min-width: 0; }
  .v-donut-svg { width: 120px; height: 120px; flex-shrink: 0; }
  .v-donut-total { font-family: var(--v-font-display); font-size: var(--v-text-lg); font-weight: var(--v-weight-bold); fill: var(--v-text); text-anchor: middle; }
  .v-donut-rows { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; flex: 1; }
  .v-donut-row { display: flex; align-items: center; gap: var(--v-space-2); font-size: var(--v-text-sm); color: var(--v-text-2); min-width: 0; }
  .v-donut-swatch { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
  .v-donut-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .v-donut-val { color: var(--v-text); font-weight: var(--v-weight-semibold); font-variant-numeric: tabular-nums; }
  @media (max-width: 359px) { .v-donut { flex-direction: column; align-items: stretch; } }
`;
