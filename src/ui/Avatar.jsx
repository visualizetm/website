import { SkeletonCircle } from './Skeleton';
/**
 * Avatar: initials from a business or person name, image when given, optional status dot.
 * @param {object} props
 * @param {string} props.name used for initials, the deterministic hue, and alt text
 * @param {string} [props.src]
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.size='md'] 24 / 32 / 40 / 56 / 72
 * @param {string} [props.status] status tone for the corner dot
 */
const PX = { xs: 24, sm: 32, md: 40, lg: 56, xl: 72 };
export function initialsOf(name = '') {
  const words = String(name).replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}
export function hueIndex(name = '') {
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h % 6) + 1;
}
export default function Avatar({ name = '', src, size = 'md', status, className = '', style, ...rest }) {
  const px = PX[size] || PX.md;
  return (
    <span className={`v-avatar v-avatar--${size} ${className}`.trim()} style={{ width: px, height: px, '--v-avatar-c': `var(--v-chart-${hueIndex(name)})`, ...style }} title={name} {...rest}>
      {src ? <img src={src} alt={name} width={px} height={px} loading="lazy" decoding="async" /> : <span className="v-avatar-txt" aria-label={name}>{initialsOf(name)}</span>}
      {status && <span className="v-avatar-dot" style={{ background: `var(--v-status-${status}-solid)` }} aria-hidden="true" />}
    </span>
  );
}
Avatar.Skeleton = function AvatarSkeleton({ size = 'md' }) { return <SkeletonCircle size={PX[size] || PX.md} />; };
Avatar.sizes = PX;

export const avatarStyles = `
  .v-avatar {
    position: relative; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    border-radius: 50%; overflow: visible;
    background: color-mix(in srgb, var(--v-avatar-c) 18%, var(--v-surface-2));
    border: 1px solid color-mix(in srgb, var(--v-avatar-c) 40%, transparent);
    color: var(--v-text); font-weight: var(--v-weight-bold); letter-spacing: 0.02em;
  }
  .v-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; }
  .v-avatar--xs .v-avatar-txt { font-size: 10px; }
  .v-avatar--sm .v-avatar-txt { font-size: var(--v-text-xs); }
  .v-avatar--md .v-avatar-txt { font-size: var(--v-text-sm); }
  .v-avatar--lg .v-avatar-txt { font-size: var(--v-text-lg); }
  .v-avatar--xl .v-avatar-txt { font-size: var(--v-text-2xl); font-family: var(--v-font-display); }
  .v-avatar-dot { position: absolute; right: 0; bottom: 0; width: 26%; height: 26%; min-width: 8px; min-height: 8px; border-radius: 50%; box-shadow: 0 0 0 2px var(--v-surface-1); }
`;
