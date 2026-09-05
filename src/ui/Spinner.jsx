/**
 * Spinner: inline only, for button loading states. Never full page (use skeletons).
 * @param {object} props
 * @param {number} [props.size=16]
 */
export default function Spinner({ size = 16, className = '', style, ...rest }) {
  return <span className={`v-spin ${className}`.trim()} role="status" aria-label="Loading" style={{ width: size, height: size, ...style }} {...rest} />;
}
export const spinnerStyles = `
  .v-spin { display: inline-block; flex-shrink: 0; border-radius: 50%; border: 2px solid color-mix(in srgb, currentColor 25%, transparent); border-top-color: currentColor; animation: v-spin calc(var(--v-dur-slow) * 2.5) linear infinite; }
  @keyframes v-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .v-spin { animation: none; border-top-color: color-mix(in srgb, currentColor 25%, transparent); border-right-color: currentColor; } }
  [data-v-motion='reduce'] .v-spin { animation: none; border-top-color: color-mix(in srgb, currentColor 25%, transparent); border-right-color: currentColor; }
`;
