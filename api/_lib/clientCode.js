/* The client app's four digit code (client app job): what a code may be. Mirrored byte for byte in api/_lib/clientCode.js
 * (client-app-test asserts it). The server's check is the rule; the screen's is only a hint before the request.
 *
 * A code is four digits. It is weak, and refused, when it is one digit four times, a straight run up (0123 to 6789) or down
 * (3210 to 9876), or on the list of the codes people pick most. Nothing else is refused: the lockouts carry the rest.
 *
 * The identifier a client signs in with is a phone or an email: a phone is compared on its last ten digits, an email
 * lowercased and trimmed. */
export const CODE_LENGTH = 4;
export const COMMON_CODES = ['1212', '1004', '2000', '2001', '1010', '1122', '1313', '6969', '2580', '0852'];
export const codeShape = (v) => (/^\d{4}$/.test(String(v ?? '')) ? String(v) : '');
const runOf = (c, step) => [1, 2, 3].every(i => Number(c[i]) - Number(c[i - 1]) === step);
export function isWeakCode(v) {
  const c = codeShape(v);
  if (!c) return true;
  if (/^(\d)\1{3}$/.test(c)) return true;
  if (runOf(c, 1) || runOf(c, -1)) return true;
  return COMMON_CODES.includes(c);
}
export const phoneKey = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };
export const emailKey = (v) => { const e = String(v ?? '').trim().toLowerCase().slice(0, 200); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : ''; };
/** What kind of identifier the client typed: an email when it has an @, else a phone when it has ten digits. */
export const identifierOf = (v) => { const s = String(v ?? '').trim(); if (s.includes('@')) { const e = emailKey(s); return e ? { kind: 'email', key: e } : null; } const p = phoneKey(s); return p ? { kind: 'phone', key: p } : null; };
