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
 * @param {'wordmark'|'icon'|'lockup'|'stacked'} [props.variant='wordmark']
 *        lockup is the horizontal lockup (icon beside the wordmark); stacked is the icon over it.
 *        The V. submark and the tagline wordmark are not variants (see logo.data.js).
 * @param {'reversed'|'primary'|'auto'} [props.tone='reversed'] reversed = light letters for dark surfaces (the site, the admin sidebar);
 *        primary = ink letters, for light surfaces (print, invoices on white); auto = the admin's own surfaces,
 *        reversed on its dark theme and primary on its light one.
 * @param {number} [props.height] px; the width follows the artwork's ratio. Give height or width, never both.
 * @param {number} [props.width] px; the height follows.
 * @param {boolean} [props.decorative] true when it sits beside visible text (alt empty, hidden from assistive tech).
 * @param {boolean} [props.clearSpace] pads half the V cap height on every side (the brand's clear space).
 */
export default function Logo({ variant = 'wordmark', tone = 'reversed', height, width, decorative = false, clearSpace = false, className = '', style, ...rest }) {
  const size = logoSize(variant, { width, height });
  const one = (t, extra = '') => (
    <img
      className={`v-logo v-logo--${variant} ${extra} ${className}`.replace(/\s+/g, ' ').trim()}
      src={logoSrc(variant, t)}
      width={size.width} height={size.height}
      alt={decorative ? '' : 'Visualize'}
      aria-hidden={decorative ? 'true' : undefined}
      draggable="false" decoding="async"
      style={{ display: 'block', flexShrink: 0, maxWidth: 'none', width: size.width, height: size.height, ...style }}
      {...rest}
    />
  );
  /* auto: the admin's own surfaces change with its theme (a cream card in the light theme), so both
   * tones are in the markup and the stylesheet shows the one that reads on the ground. The one that is
   * hidden is out of the accessibility tree by display: none. */
  const img = tone === 'auto'
    ? (<>{one('reversed', 'v-logo-rev')}{one('primary', 'v-logo-pri')}<style>{logoToneStyles}</style></>)
    : one(tone);
  return clearSpace ? <span className="v-logo-clear" style={{ display: 'inline-flex', padding: size.height / 2 }}>{img}</span> : img;
}

export const logoToneStyles = `
  .v-logo-pri { display: none !important; }
  [data-v-theme='light'] .v-logo-pri { display: block !important; }
  [data-v-theme='light'] .v-logo-rev { display: none !important; }
`;

export const logoStyles = logoToneStyles;
