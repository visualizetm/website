/* Shared phone normalization — the ONE way phone numbers are compared.
 *
 * Stored numbers are inconsistent: "302-345-0738", "(302) 345-0738",
 * "3023450738", "+1 302 345 0738". Every comparison anywhere in the app
 * (reverse lookup, import dedupe) goes through these helpers so a match
 * never misses on formatting.
 *
 * api/admin/leads/import.js keeps a mirrored copy of last10() because
 * serverless functions can't import from src/ — keep them in sync.
 */

/** Digits only: strips spaces, dashes, parens, dots, +, everything. */
export const digitsOf = (v) => String(v ?? '').replace(/\D/g, '');

/** Canonical key: last 10 digits, dropping a leading US country code. */
export function last10(v) {
  const d = digitsOf(v);
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d.slice(-10);
}

/** True when two stored/typed numbers refer to the same line. */
export const samePhone = (a, b) => {
  const ka = last10(a); const kb = last10(b);
  return !!ka && ka === kb;
};

/**
 * Rank how well a stored phone matches typed digits. Lower is better:
 *   0 exact (all 10 digits) · 1 starts with (typing from the front)
 *   2 ends with (caller-ID fragment, e.g. last 4) · 3 contains · -1 no match
 */
export function matchRank(storedPhone, queryDigits) {
  const s = last10(storedPhone);
  const q = last10(queryDigits);
  if (!s || !q) return -1;
  if (s === q) return 0;
  if (s.startsWith(q)) return 1;
  if (s.endsWith(q)) return 2;
  if (s.includes(q)) return 3;
  return -1;
}

/** Pretty-print 10 digits as (302) 345-0738; anything else returns as-is. */
export function formatPhone(v) {
  const d = last10(v);
  if (d.length !== 10) return String(v ?? '');
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
