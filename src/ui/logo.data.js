/* Logo geometry and file names (plain data and two pure functions, so Node tests load it). The artwork's
 * ratios are the pack SVGs' viewBoxes; the minimums are the brand's: wordmark 96 px wide (160 with the
 * tagline), icon 24 px. */
export const LOGO_VARIANTS = {
  wordmark: { ratio: 1200 / 208.97, min: { width: 96 } },
  icon:     { ratio: 1,             min: { width: 24 } },
  lockup:   { ratio: 6992.71 / 2037.11, min: { width: 160 } },
  stacked:  { ratio: 5232.07 / 3830.08, min: { width: 120 } },
  tagline:  { ratio: 1200 / 344.54,     min: { width: 160 } },
};
export const logoSrc = (variant = 'wordmark', tone = 'reversed') => `/brand/svg/visualize-${variant === 'lockup' ? 'lockup-horizontal' : variant === 'stacked' ? 'lockup-stacked' : variant === 'tagline' ? 'wordmark-tagline' : variant}-${tone === 'primary' ? 'primary' : 'reversed'}.svg`;

/** The rendered box for a variant: width and height in px, the artwork's ratio, never below the brand minimum. */
export function logoSize(variant, { width, height } = {}) {
  const v = LOGO_VARIANTS[variant] || LOGO_VARIANTS.wordmark;
  let w = width != null ? Number(width) : height != null ? Number(height) * v.ratio : 160;
  w = Math.max(w, v.min.width);
  return { width: Math.round(w * 100) / 100, height: Math.round((w / v.ratio) * 100) / 100 };
}

