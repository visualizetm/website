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

/* The review link and the testimonial cards (review links job): one brand
 * colour from whatever a record holds. A string is a hex; an object may
 * carry name, hex and use (what the colour is for). Anything that is not a
 * six or three digit hex comes back with hex '' so the caller falls back to
 * Visualize red. rgb is 0 to 255, cmyk 0 to 100. */
export function normalizeBrandColor(input) {
  const o = input && typeof input === 'object' ? input : { hex: input };
  const raw = String(o.hex ?? o.value ?? '').trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  const hex = m ? `#${(m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]).toLowerCase()}` : '';
  const [r, g, b] = hex ? hexToRgb(hex) : [0, 0, 0];
  const k = hex ? 1 - Math.max(r, g, b) / 255 : 1;
  const ch = (v) => (k === 1 ? 0 : Math.round(((1 - v / 255 - k) / (1 - k)) * 100));
  return {
    name: String(o.name ?? '').trim().slice(0, 60),
    hex,
    rgb: hex ? { r, g, b } : null,
    cmyk: hex ? { c: ch(r), m: ch(g), y: ch(b), k: Math.round(k * 100) } : null,
    use: String(o.use ?? '').trim().slice(0, 60),
  };
}
/** The first brand colour on a lead (brand.primary, then brand.colors[0]), as a hex or ''. */
export function brandHexOf(lead) {
  const b = lead?.brand || {};
  const list = [b.primary, ...(Array.isArray(b.colors) ? b.colors : [])];
  for (const c of list) { const n = normalizeBrandColor(c); if (n.hex) return n.hex; }
  return '';
}
/** 4.5 to 1 against paper (white) or ink: a colour that fails for text is used as a 6px accent only. */
export const textSafeOn = (hex, surfaceHex) => { try { return contrast(hex, surfaceHex) >= 4.5; } catch { return false; } };
