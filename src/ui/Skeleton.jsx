/**
 * Skeleton primitives. One shared shimmer keyframe: a diagonal highlight in
 * --v-surface-3 sweeping over --v-surface-2, lasting --v-dur-slow x 4. Under
 * reduced motion the sweep stops and the static blocks remain.
 *
 * SkeletonBlock({ width, height, radius })  any rectangle
 * SkeletonText({ lines, width })            paragraph, last line shorter
 * SkeletonCircle({ size })                  avatar / icon tile
 */
export function SkeletonBlock({ width = '100%', height = 16, radius = 'var(--v-radius-sm)', className = '', style, ...rest }) {
  return <span className={`v-skel ${className}`.trim()} aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} {...rest} />;
}

export function SkeletonText({ lines = 3, width = '100%', lineHeight = 14, gap = 2, className = '', style }) {
  return (
    <span className={`v-skel-text ${className}`.trim()} aria-hidden="true" style={{ width, gap: `var(--v-space-${gap})`, ...style }}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="v-skel" style={{ height: lineHeight, width: i === lines - 1 && lines > 1 ? '62%' : '100%' }} />
      ))}
    </span>
  );
}

export function SkeletonCircle({ size = 40, className = '', style }) {
  return <span className={`v-skel v-skel--circle ${className}`.trim()} aria-hidden="true" style={{ width: size, height: size, ...style }} />;
}

export default SkeletonBlock;

export const skeletonStyles = `
  .v-skel {
    display: block; flex-shrink: 0; min-width: 0;
    background-color: var(--v-surface-2);
    background-image: linear-gradient(105deg, transparent 38%, var(--v-surface-3) 50%, transparent 62%);
    background-size: 240% 100%;
    background-position: 120% 0;
    animation: v-shimmer calc(var(--v-dur-slow) * 4) linear infinite;
  }
  .v-skel--circle { border-radius: var(--v-radius-pill); }
  .v-skel-text { display: flex; flex-direction: column; }
  @keyframes v-shimmer { from { background-position: 120% 0; } to { background-position: -120% 0; } }
  @media (prefers-reduced-motion: reduce) { .v-skel { animation: none; background-image: none; } }
`;
