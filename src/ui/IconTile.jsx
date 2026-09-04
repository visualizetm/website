import { Icon } from './icons';
import { SkeletonBlock } from './Skeleton';
/**
 * IconTile: the tinted, glowing rounded icon square used on stat cards and list rows.
 * @param {object} props
 * @param {string|Function} props.icon semantics icon name or component
 * @param {string} [props.tone='neutral'] status tone
 * @param {'sm'|'md'|'lg'} [props.size='md'] 32 / 40 / 48
 * @param {boolean} [props.glow=true]
 */
const PX = { sm: 32, md: 40, lg: 48 };
export default function IconTile({ icon, tone = 'neutral', size = 'md', glow = true, className = '', style, ...rest }) {
  return (
    <span className={`v-tile v-tile--${size}${glow ? ' v-tile--glow' : ''} ${className}`.trim()}
      style={{ '--v-tile-c': `var(--v-status-${tone}-text)`, '--v-tile-bg': `var(--v-status-${tone}-soft)`, ...style }} {...rest}>
      <Icon icon={icon} size={size === 'lg' ? 'var(--v-icon-lg)' : 'var(--v-icon-md)'} />
    </span>
  );
}
IconTile.Skeleton = function IconTileSkeleton({ size = 'md' }) {
  return <SkeletonBlock width={PX[size]} height={PX[size]} radius="var(--v-radius-md)" />;
};

export const iconTileStyles = `
  .v-tile {
    display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    color: var(--v-tile-c); background: var(--v-tile-bg);
    border: 1px solid color-mix(in srgb, var(--v-tile-c) 28%, transparent);
    border-radius: var(--v-radius-md);
  }
  .v-tile--sm { width: 32px; height: 32px; }
  .v-tile--md { width: 40px; height: 40px; }
  .v-tile--lg { width: 48px; height: 48px; border-radius: var(--v-radius-lg); }
  .v-tile--glow { box-shadow: 0 0 18px color-mix(in srgb, var(--v-tile-c) 22%, transparent); }
`;
