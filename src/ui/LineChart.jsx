/**
 * LineChart (the nav revamp): one series as a line over a soft area, the
 * last value written at its point and the first label and the last on the
 * baseline, tokens only. Decorative SVG plus a visually hidden table.
 * @param {object} props
 * @param {Array<{ label: string, value: number }>} props.data
 * @param {(n: number) => string} [props.format]
 * @param {string} props.label
 * @param {number} [props.height=140]
 * @param {string} [props.tone='--v-chart-1']
 */
export default function LineChart({ data = [], format = (n) => String(n), label, height = 140, tone = '--v-chart-1', className = '' }) {
  const W = 320; const PAD = 8; const LABEL_H = 18; const VALUE_H = 14;
  const max = Math.max(1, ...data.map(d => Number(d.value) || 0));
  const n = data.length;
  const plotH = height - LABEL_H - VALUE_H;
  const x = (i) => (n <= 1 ? W / 2 : PAD + ((W - PAD * 2) * i) / (n - 1));
  const y = (v) => VALUE_H + plotH - ((Number(v) || 0) / max) * plotH;
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.value).toFixed(1)}`);
  const line = pts.join(' ');
  const area = n ? `M${x(0).toFixed(1)},${(VALUE_H + plotH).toFixed(1)} L${line.replace(/ /g, ' L')} L${x(n - 1).toFixed(1)},${(VALUE_H + plotH).toFixed(1)} Z` : '';
  const last = n ? data[n - 1] : null;
  const every = n > 6 ? Math.ceil(n / 4) : 1;
  return (
    <div className={`v-chart v-chart--line ${className}`.trim()}>
      <svg className="v-chart-svg" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false" style={{ height }}>
        <line x1={PAD} x2={W - PAD} y1={VALUE_H + plotH + 0.5} y2={VALUE_H + plotH + 0.5} className="v-chart-axis" />
        <line x1={PAD} x2={W - PAD} y1={VALUE_H + 0.5} y2={VALUE_H + 0.5} className="v-chart-grid" />
        {n > 0 && <path d={area} style={{ fill: `var(${tone})`, opacity: 0.14 }} />}
        {n > 1 && <polyline points={line} fill="none" style={{ stroke: `var(${tone})` }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
        {data.map((d, i) => (i % every === 0 || i === n - 1) && <text key={i} x={x(i)} y={height - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="v-chart-label">{d.label}</text>)}
        {last && <circle cx={x(n - 1)} cy={y(last.value)} r={3.5} className="v-chart-point" style={{ stroke: `var(${tone})` }} />}
        {last && <text x={x(n - 1)} y={y(last.value) - 7} textAnchor="end" className="v-chart-value">{format(Number(last.value) || 0)}</text>}
      </svg>
      <div className="v-sr-only"><table><caption>{label}</caption><thead><tr><th scope="col">Period</th><th scope="col">Value</th></tr></thead><tbody>{data.map((d, i) => <tr key={i}><th scope="row">{d.label}</th><td>{format(Number(d.value) || 0)}</td></tr>)}</tbody></table></div>
    </div>
  );
}
