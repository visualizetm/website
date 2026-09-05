import Card from './Card';
import IconTile from './IconTile';
import { SkeletonBlock } from './Skeleton';
import TrendUp01 from '@untitled-ui/icons-react/build/esm/TrendUp01';
import TrendDown01 from '@untitled-ui/icons-react/build/esm/TrendDown01';
import Minus from '@untitled-ui/icons-react/build/esm/Minus';
/**
 * StatCard: icon tile, big display value, label, optional trend line.
 * @param {object} props
 * @param {string|Function} props.icon
 * @param {string} [props.tone='neutral'] status tone for the tile and glow
 * @param {import('react').ReactNode} props.value
 * @param {string} props.label
 * @param {{value: string, direction: 'up'|'down'|'flat', tone?: string}} [props.trend]
 * @param {Function} [props.onClick]
 */
const TREND = { up: TrendUp01, down: TrendDown01, flat: Minus };
export default function StatCard({ icon, tone = 'neutral', value, label, trend, onClick, className = '', ...rest }) {
  const T = trend ? TREND[trend.direction] || Minus : null;
  const trendTone = trend?.tone || (trend?.direction === 'up' ? 'booked' : trend?.direction === 'down' ? 'danger' : 'neutral');
  return (
    <Card glow={tone} onClick={onClick} className={`v-stat ${className}`.trim()} aria-label={onClick ? `${label}: ${value}` : undefined} {...rest}>
      <IconTile icon={icon} tone={tone} />
      <div className="v-stat-body">
        <span className="v-stat-value">{value}</span>
        <span className="v-stat-label">{label}</span>
        {trend && (
          <span className="v-stat-trend" style={{ color: `var(--v-status-${trendTone}-text)` }}>
            <T width={12} height={12} aria-hidden="true" /> {trend.value}
          </span>
        )}
      </div>
    </Card>
  );
}

/** StatCard.Skeleton: identical box so nothing jumps when the value lands. */
StatCard.Skeleton = function StatCardSkeleton({ trend = false, className = '' }) {
  return (
    <Card className={`v-stat ${className}`.trim()} aria-busy="true" aria-hidden="true">
      <IconTile.Skeleton />
      <div className="v-stat-body">
        <SkeletonBlock width={72} height={30} style={{ marginBottom: 4 }} />
        <SkeletonBlock width={96} height={13} />
        {trend && <SkeletonBlock width={80} height={12} style={{ marginTop: 6 }} />}
      </div>
    </Card>
  );
};

export const statCardStyles = `
  .v-stat { gap: var(--v-space-4); min-height: 132px; }
  .v-stat-body { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; }
  .v-stat-value { font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); letter-spacing: var(--v-ls-display-sm); font-weight: var(--v-weight-bold); color: var(--v-text); font-variant-numeric: tabular-nums; }
  .v-stat-label { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); font-weight: var(--v-weight-semibold); color: var(--v-text-3); }
  .v-stat-trend { display: inline-flex; align-items: center; gap: var(--v-space-1); font-size: var(--v-text-xs); line-height: var(--v-lh-xs); font-weight: var(--v-weight-bold); margin-top: var(--v-space-1); }
`;
