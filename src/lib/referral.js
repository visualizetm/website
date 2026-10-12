/* The referral link (portal prompt 4). A delivered client's portal carries https://visualizestudio.org/?ref=<code>; the code
 * is their showcase slug when the showcase is published, else the first ten characters of their portal token (enough to find
 * them, never enough to open the portal). The marketing site keeps the code in sessionStorage for the tab and the Start
 * form sends it as referredBy; the server resolves it to the referring client and writes "Referred by <business>" on the
 * submission and the new lead. Nothing else is promised. */
export const REF_RE = /^[A-Za-z0-9_-]{3,80}$/;
export const REF_KEY = 'vz_ref';
export const REF_PREFIX = 10;
export const SITE_ORIGIN = 'https://visualizestudio.org';

export const cleanRef = (v) => { const s = String(v ?? '').trim(); return REF_RE.test(s) ? s : ''; };
export const refFromSearch = (search) => { try { return cleanRef(new URLSearchParams(String(search || '')).get('ref')); } catch { return ''; } };
/** On the marketing host: a ?ref= on any page is kept for the tab. Returns the code kept, or ''. */
export function captureRef(search, storage) {
  const code = refFromSearch(search);
  if (!code) return '';
  try { (storage || sessionStorage).setItem(REF_KEY, code); } catch { /* private mode: the form still works, the code is lost */ }
  return code;
}
export function readRef(storage) { try { return cleanRef((storage || sessionStorage).getItem(REF_KEY)); } catch { return ''; } }
export const referralCode = (lead) => { const sh = lead?.showcase; if (sh?.published && REF_RE.test(String(sh.slug || ''))) return String(sh.slug); const t = String(lead?.portal?.token || ''); return t.length >= 16 ? t.slice(0, REF_PREFIX) : ''; };
export const referralUrl = (code) => (code ? `${SITE_ORIGIN}/?ref=${encodeURIComponent(code)}` : '');
