/* Tiny color math for the /design page contrast table. WCAG 2.x. */
export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16));
}
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(c => c / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Composite an rgba() tint over a hex surface → hex (for tint contrast). */
export function composite(rgba, overHex) {
  const m = /rgba?\(([^)]+)\)/.exec(rgba);
  if (!m) return rgba;
  const [r, g, b, a = 1] = m[1].split(',').map(s => parseFloat(s));
  const [R, G, B] = hexToRgb(overHex);
  const mix = (c, C) => Math.round(c * a + C * (1 - a));
  return '#' + [mix(r, R), mix(g, G), mix(b, B)].map(v => v.toString(16).padStart(2, '0')).join('');
}
