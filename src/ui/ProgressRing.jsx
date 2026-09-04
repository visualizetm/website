import { useEffect, useState } from 'react';
/**
 * ProgressRing: SVG ring, animated fill on mount and on value change.
 * @param {object} props
 * @param {number} props.value 0..100
 * @param {number} [props.size=64]
 * @param {number} [props.thickness=6]
 * @param {string} [props.tone='booked'] status tone (won = brand red)
 * @param {string} [props.label] accessible label
 * @param {import('react').ReactNode} [props.children] center slot (defaults to the percentage)
 */
export default function ProgressRing({ value = 0, size = 64, thickness = 6, tone = 'booked', label = 'Progress', className = '', children, style }) {
  const [shown, setShown] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setShown(Math.max(0, Math.min(100, value)))); return () => cancelAnimationFrame(t); }, [value]);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={`v-ring ${className}`.trim()} style={{ width: size, height: size, '--v-ring-c': `var(--v-status-${tone}-solid)`, ...style }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="v-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={thickness} />
        <circle className="v-ring-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={thickness} strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} />
      </svg>
      <span className="v-ring-center" style={{ fontSize: size < 56 ? 'var(--v-text-xs)' : size < 88 ? 'var(--v-text-md)' : 'var(--v-text-2xl)' }}>{children ?? `${Math.round(value)}%`}</span>
    </span>
  );
}
export const progressRingStyles = `
  .v-ring { position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .v-ring svg { transform: rotate(-90deg); display: block; }
  .v-ring-track { fill: none; stroke: var(--v-surface-3); }
  .v-ring-fill { fill: none; stroke: var(--v-ring-c); stroke-linecap: round; transition: stroke-dashoffset var(--v-dur-slow) var(--v-ease-in-out); filter: drop-shadow(0 0 6px color-mix(in srgb, var(--v-ring-c) 45%, transparent)); }
  .v-ring-center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--v-font-display); font-weight: var(--v-weight-bold); color: var(--v-text); font-variant-numeric: tabular-nums; }
`;
