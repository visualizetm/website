const TONES = ['--v-chart-1', '--v-chart-2', '--v-chart-3', '--v-chart-4', '--v-chart-5', '--v-chart-6'];

/**
 * DonutChart (the nav revamp): shares of one total, the total written in
 * the middle and every slice named in a row beside it with its value (the
 * colour is never the only cue). Decorative SVG plus a visually hidden table.
 * @param {object} props
 * @param {Array<{ label: string, value: number }>} props.data
 * @param {(n: number) => string} [props.format]
 * @param {string} props.label
 * @param {string} [props.totalLabel]  the word under the total
 */
export default function DonutChart({ data = [], format = (n) => String(n), label, totalLabel = '', className = '' }) {
  const rows = data.filter(d => Number(d.value) > 0).slice(0, 6);
  const total = rows.reduce((n, d) => n + (Number(d.value) || 0), 0);
  const R = 50; const r = 36; const C = 2 * Math.PI * ((R + r) / 2); const sw = R - r;
  let acc = 0;
  return (
    <div className={`v-chart v-donut ${className}`.trim()}>
      <svg className="v-donut-svg" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle cx={60} cy={60} r={(R + r) / 2} fill="none" style={{ stroke: 'var(--v-surface-3)' }} strokeWidth={sw} />
        {total > 0 && rows.map((d, i) => {
          const share = (Number(d.value) || 0) / total; const len = share * C; const off = -acc * C; acc += share;
          return <circle key={i} cx={60} cy={60} r={(R + r) / 2} fill="none" style={{ stroke: `var(${TONES[i % TONES.length]})` }} strokeWidth={sw} strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`} strokeDashoffset={off.toFixed(2)} transform="rotate(-90 60 60)" />;
        })}
        <text x={60} y={totalLabel ? 60 : 65} className="v-donut-total">{format(total)}</text>
        {totalLabel && <text x={60} y={76} textAnchor="middle" className="v-chart-label">{totalLabel}</text>}
      </svg>
      <div className="v-donut-rows" aria-hidden="true">
        {rows.map((d, i) => <div key={i} className="v-donut-row"><span className="v-donut-swatch" style={{ background: `var(${TONES[i % TONES.length]})` }} /><span className="v-donut-name">{d.label}</span><span className="v-donut-val">{format(Number(d.value) || 0)}</span></div>)}
      </div>
      <div className="v-sr-only"><table><caption>{label}</caption><thead><tr><th scope="col">Share</th><th scope="col">Value</th></tr></thead><tbody>{rows.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{format(Number(d.value) || 0)}</td></tr>)}<tr><th scope="row">Total</th><td>{format(total)}</td></tr></tbody></table></div>
    </div>
  );
}
