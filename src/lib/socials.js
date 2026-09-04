// Social channel model + input normalization.
// Rob pastes handles inconsistently ("@mrburgers", "instagram.com/x", full URLs),
// so every value is normalized to a full https URL before it's stored or linked.

export const SOCIAL_KEYS = [
  'website', 'instagram', 'facebook', 'tiktok', 'google', 'yelp', 'linkedin', 'x', 'youtube',
];

export const SOCIAL_META = {
  website:   { label: 'Website',   placeholder: 'their-site.com' },
  instagram: { label: 'Instagram', placeholder: '@handle' },
  facebook:  { label: 'Facebook',  placeholder: 'page name or URL' },
  tiktok:    { label: 'TikTok',    placeholder: '@handle' },
  google:    { label: 'Google',    placeholder: 'Maps / Business URL' },
  yelp:      { label: 'Yelp',      placeholder: 'biz URL' },
  linkedin:  { label: 'LinkedIn',  placeholder: 'company URL or name' },
  x:         { label: 'X',         placeholder: '@handle' },
  youtube:   { label: 'YouTube',   placeholder: '@handle or URL' },
};

// Common TLDs used to decide "is this already a domain?" vs "is this a handle?".
// Instagram/TikTok handles can contain dots (e.g. mr.burgers), so we only treat a
// value as a URL when its first segment ends in one of these.
const TLDS = ['com', 'net', 'org', 'co', 'io', 'us', 'de', 'biz', 'app', 'shop', 'site', 'store', 'me', 'tv', 'xyz', 'info'];

function looksLikeDomain(v) {
  const firstSeg = v.split('/')[0];
  const dot = firstSeg.lastIndexOf('.');
  if (dot < 0) return false;
  const tld = firstSeg.slice(dot + 1).toLowerCase();
  return TLDS.includes(tld);
}

export function normalizeSocial(key, raw) {
  let v = String(raw ?? '').trim().replace(/^[<"'\s]+|[>"'\s]+$/g, '').trim();
  if (!v) return '';

  if (/^https?:\/\//i.test(v)) return v;                 // full URL, use as-is
  if (/^www\./i.test(v)) return 'https://' + v;          // www.x.com → https://…
  if (v.includes('/') || looksLikeDomain(v)) {           // bare-domain URL
    return 'https://' + v.replace(/^\/+/, '');
  }

  // Otherwise it's a bare handle: drop leading @ / slash, then build the URL.
  const h = v.replace(/^@+/, '').replace(/^\/+/, '');
  switch (key) {
    case 'website':   return 'https://' + h;
    case 'instagram': return `https://instagram.com/${h}`;
    case 'facebook':  return `https://facebook.com/${h}`;
    case 'tiktok':    return `https://tiktok.com/@${h}`;
    case 'yelp':      return `https://yelp.com/biz/${h}`;
    case 'linkedin':  return `https://linkedin.com/company/${h}`;
    case 'x':         return `https://x.com/${h}`;
    case 'youtube':   return /^uc[\w-]{20,}$/i.test(h) ? `https://youtube.com/channel/${h}` : `https://youtube.com/@${h}`;
    case 'google':    return `https://www.google.com/maps/search/${encodeURIComponent(h)}`;
    default:          return 'https://' + h;
  }
}

// Normalize a whole {key:value} object; drops empties. Safe on partial input.
export function normalizeSocials(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const key of SOCIAL_KEYS) {
    const url = normalizeSocial(key, obj[key]);
    if (url) out[key] = url;
  }
  return out;
}

export const hasAnySocial = (obj) => SOCIAL_KEYS.some(k => obj?.[k]);
