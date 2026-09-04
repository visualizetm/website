import { useEffect, useState } from 'react';
/**
 * ProgressBar: linear progress, animated, optional label row, indeterminate mode.
 * @param {object} props
 * @param {number} [props.value=0] 0..100
 * @param {string} [props.tone='booked']
 * @param {'sm'|'md'} [props.size='md'] 4px / 8px
 * @param {string} [props.label] shows a label row with the percentage
 * @param {boolean} [props.indeterminate]
 */
export default function ProgressBar({ value = 0, tone = 'booked', size = 'md', label, indeterminate = false, className = '', style }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, value)))); return () => cancelAnimationFrame(t); }, [value]);
  return (
    <span className={`v-bar v-bar--${size}${indeterminate ? ' is-indeterminate' : ''} ${className}`.trim()} style={{ '--v-bar-c': `var(--v-status-${tone}-solid)`, ...style }}>
      {label && <span className="v-bar-row"><span>{label}</span>{!indeterminate && <span className="v-bar-pct">{Math.round(value)}%</span>}</span>}
      <span className="v-bar-track" role="progressbar" aria-label={label || 'Progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={indeterminate ? undefined : Math.round(value)}>
        <span className="v-bar-fill" style={indeterminate ? undefined : { width: `${shown}%` }} />
      </span>
    </span>
  );
}
export const progressBarStyles = `
  .v-bar { display: flex; flex-direction: column; gap: var(--v-space-2); width: 100%; min-width: 0; }
  .v-bar-row { display: flex; justify-content: space-between; gap: var(--v-space-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-2); font-weight: var(--v-weight-semibold); }
  .v-bar-pct { color: var(--v-text-3); font-variant-numeric: tabular-nums; }
  .v-bar-track { display: block; width: 100%; height: 8px; border-radius: var(--v-radius-pill); background: var(--v-surface-3); overflow: hidden; }
  .v-bar--sm .v-bar-track { height: 4px; }
  .v-bar-fill { display: block; height: 100%; border-radius: inherit; background: var(--v-bar-c); transition: width var(--v-dur-slow) var(--v-ease-in-out); box-shadow: 0 0 8px color-mix(in srgb, var(--v-bar-c) 45%, transparent); }
  /* Indeterminate: the sweep is a background on the track itself, so no box
     ever extends past the track (the layout audit measures real rects). */
  .v-bar.is-indeterminate .v-bar-fill { display: none; }
  .v-bar.is-indeterminate .v-bar-track { background-image: linear-gradient(90deg, transparent, var(--v-bar-c), transparent); background-size: 40% 100%; background-repeat: no-repeat; animation: v-bar-slide calc(var(--v-dur-slow) * 4) var(--v-ease-in-out) infinite; }
  @keyframes v-bar-slide { from { background-position: -60% 0; } to { background-position: 160% 0; } }
  @media (prefers-reduced-motion: reduce) { .v-bar.is-indeterminate .v-bar-track { animation: none; background-image: none; background-color: color-mix(in srgb, var(--v-bar-c) 35%, var(--v-surface-3)); } }
`;
