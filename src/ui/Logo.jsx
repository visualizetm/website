import { logoSrc, logoSize } from './logo.data';

/**
 * Logo: the one place Visualize's own logo is drawn (Brand v3). Every header, footer,
 * sidebar, login card and page chrome renders this; the files are public/brand/svg/.
 *
 * It renders the pack SVG through an <img> instead of inlining the paths: the pack's
 * fills are brand hexes, and an inline copy would add them to the hex audit (src/ is
 * scanned). The file is the same bytes, cached, and precached by the service worker.
 * Nothing is drawn around it: no outline, stroke, gradient, shadow, italic or filter.
 *
 * @param {object} props
 * @param {'wordmark'|'icon'|'lockup'|'stacked'|'tagline'} [props.variant='wordmark']
 *        lockup is the horizontal lockup (icon beside the wordmark); stacked is the icon over it;
 *        tagline is the wordmark with the tagline. The V. submark was not in the pack, so it has no variant.
 * @param {'reversed'|'primary'} [props.tone='reversed'] reversed = light letters for dark surfaces (the site and the admin);
 *        primary = ink letters, for light surfaces (print, invoices on white).
 * @param {number} [props.height] px; the width follows the artwork's ratio. Give height or width, never both.
 * @param {number} [props.width] px; the height follows.
 * @param {boolean} [props.decorative] true when it sits beside visible text (alt empty, hidden from assistive tech).
 * @param {boolean} [props.clearSpace] pads half the V cap height on every side (the brand's clear space).
 */
export default function Logo({ variant = 'wordmark', tone = 'reversed', height, width, decorative = false, clearSpace = false, className = '', style, ...rest }) {
  const size = logoSize(variant, { width, height });
  const img = (
    <img
      className={`v-logo v-logo--${variant} ${className}`.trim()}
      src={logoSrc(variant, tone)}
      width={size.width} height={size.height}
      alt={decorative ? '' : 'Visualize'}
      aria-hidden={decorative ? 'true' : undefined}
      draggable="false" decoding="async"
      style={{ width: size.width, height: size.height, ...style }}
      {...rest}
    />
  );
  return clearSpace ? <span className="v-logo-clear" style={{ padding: size.height / 2 }}>{img}</span> : img;
}

export { logoSrc, logoSize };
export { LOGO_VARIANTS } from './logo.data';

export const logoStyles = `
  .v-logo { display: block; flex-shrink: 0; max-width: none; user-select: none; -webkit-user-drag: none; }
  .v-logo-clear { display: inline-flex; }
`;
