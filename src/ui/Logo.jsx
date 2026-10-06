import { logoSrc, logoSize } from './logo.data';

/**
 * Logo: the one place Visualize's own logo is drawn (Brand v3). Every header, footer,
 * sidebar, login card and page chrome renders this; the files are public/brand/svg/.
 *
 * It draws the pack SVG as the background of a role="img" box instead of inlining the paths: the pack's
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
  const part = (t, extra = '') => (
    <span
      className={`v-logo v-logo--${variant} ${extra} ${tone === 'auto' ? '' : className}`.replace(/\s+/g, ' ').trim()}
      data-tone={t}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'Visualize'}
      aria-hidden={decorative ? 'true' : undefined}
      {...(tone === 'auto' ? {} : rest)}
      style={{ display: 'block', flexShrink: 0, width: size.width, height: size.height, backgroundImage: `url(${logoSrc(variant, t)})`, backgroundRepeat: 'no-repeat', backgroundPosition: 'center', backgroundSize: 'contain', ...(tone === 'auto' ? {} : style) }}
    />
  );
  /* A role="img" box with the file as its background, not an <img>: the logo is a fixed size mark that sits on
   * top of covers, cards and scenes by design, and an <img> there reads as one picture overlapping another.
   * The box is the logo's exact size, so nothing crops or stretches it. auto: the admin's own surfaces change
   * with its theme (a cream card in the light theme), so both tones are in the markup and the stylesheet shows
   * the one that reads on the ground; the hidden one is out of the accessibility tree by display: none. */
  const mark = tone === 'auto'
    ? (<span className={`v-logo-auto ${className}`.trim()} {...rest} style={{ display: 'block', flexShrink: 0, width: size.width, height: size.height, ...style }}>{part('reversed', 'v-logo-rev')}{part('primary', 'v-logo-pri')}<style>{logoToneStyles}</style></span>)
    : part(tone);
  return clearSpace ? <span className="v-logo-clear" style={{ display: 'inline-flex', padding: size.height / 2 }}>{mark}</span> : mark;
}

export const logoToneStyles = `
  .v-logo-pri { display: none !important; }
  [data-v-theme='light'] .v-logo-pri { display: block !important; }
  [data-v-theme='light'] .v-logo-rev { display: none !important; }
`;

export const logoStyles = logoToneStyles;
