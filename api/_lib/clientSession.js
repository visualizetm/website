/* The client app's session (client app job): a client's own four digit code and the vz_client cookie it earns.
 *
 * The code lives on the lead as portal.code { hash, salt, setAt, version, fails, lockedUntil, locked }: a scrypt hash and a
 * salt, the team.js way (api/_lib/team.js), never the digits. None of it ever leaves the server: CODE_SECRET_KEYS is the
 * never-send list (security-test and client-app-test scan every response for them), and the CRM reads only codeStatus().
 *
 * The cookie is vz_client = `${leadId}.${version}.${expiresAt}.${hmac}`, the hmac SHA-256 with SESSION_SECRET over
 * `client:${leadId}:${version}:${expiresAt}`, so it never verifies as the admin's or the caller's. HttpOnly, Secure,
 * SameSite=Lax, Path=/, no Domain (host only: app.visualizeclients.com), 365 days. verifyClient() checks the signature and
 * the expiry with no database; sessionLead() then loads the lead and refuses the cookie unless its version is the stored
 * portal.code.version and a code is set. Setting a code and Rob's Reset code both bump the version, which signs out every
 * device signed in before. */
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { sessionSecret } from './config.js';

export const CLIENT_COOKIE = 'vz_client';
export const CLIENT_DAYS = 365;
export const CODE_SECRET_KEYS = ['hash', 'salt', 'version', 'fails', 'lockedUntil', 'locked'];
export const SOFT_LOCK_AT = 5;           // five wrong in a row: fifteen minutes
export const SOFT_LOCK_MS = 15 * 60 * 1000;
export const HARD_LOCK_AT = 10;          // ten wrong in a row: until Rob resets it

const hmac = (value) => crypto.createHmac('sha256', sessionSecret()).update(String(value)).digest('base64url');
const versionOf = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 1 ? n : 0; };
const idShape = (v) => (/^[A-Za-z0-9_-]{1,64}$/.test(String(v ?? '')) ? String(v) : '');
const payload = (leadId, version, expiresAt) => `client:${leadId}:${version}:${expiresAt}`;

/** A lead id as the database holds it: an ObjectId when it is one, else the string (the tests' leads). */
export const leadKey = (id) => { const s = String(id ?? ''); if (/^[a-f0-9]{24}$/i.test(s)) { try { return new ObjectId(s); } catch { return s; } } return s; };

export function signClient(leadId, version, days = CLIENT_DAYS) {
  const id = idShape(leadId); const v = String(versionOf(version) || 1);
  const expiresAt = String(Date.now() + days * 86400000);
  return `${id}.${v}.${expiresAt}.${hmac(payload(id, v, expiresAt))}`;
}
export function clientCookie(value, days = CLIENT_DAYS) {
  const maxAge = days > 0 ? days * 86400 : 0;
  return `${CLIENT_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function readCookie(req, name) {
  const raw = String(req.headers?.cookie || '');
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) { try { return decodeURIComponent(v.join('=')); } catch { return null; } }
  }
  return null;
}
/** { leadId, version } from a valid, unexpired vz_client cookie, else null. No database. */
export function verifyClient(req) {
  const token = readCookie(req, CLIENT_COOKIE);
  if (!token) return null;
  const [leadId, version, expiresAt, sig, ...rest] = token.split('.');
  if (!idShape(leadId) || !versionOf(version) || !expiresAt || !sig || rest.length) return null;
  if (!(Number(expiresAt) > Date.now())) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(payload(leadId, version, expiresAt)));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? { leadId, version: versionOf(version) } : null;
}
/** The signed in client's lead (with the projection asked for), or null: the cookie's version must be the stored one and a code set.
 *  A deleted record still comes back, with deleted: true, so each door answers it the way it always has (the portal's and
 *  the planner's 404). */
export async function sessionLead(db, req, projection = null) {
  const s = verifyClient(req);
  if (!s) return null;
  const proj = projection ? { ...projection, deleted: 1, 'portal.code.version': 1, 'portal.code.hash': 1 } : null;
  if (proj && proj.portal) { delete proj['portal.code.version']; delete proj['portal.code.hash']; }
  const lead = await db.collection('call_leads').findOne({ _id: leadKey(s.leadId) }, proj ? { projection: proj } : undefined);
  const code = lead?.portal?.code;
  if (!lead || !code?.hash || versionOf(code.version) !== s.version) return null;
  return lead;
}
/** 401 { error: 'sign in' }: what every data door answers without a valid session. */
export const signInFirst = (res) => res.status(401).json({ error: 'sign in' });

/* The code itself. */
const scrypt = (code, salt) => crypto.scryptSync(String(code ?? ''), String(salt), 64).toString('base64url');
export function hashCode(code, salt = crypto.randomBytes(16).toString('base64url')) { return { hash: scrypt(code, salt), salt }; }
/** Constant time; a lead with no code still pays for one scrypt on a dummy salt, so no match costs what a wrong code costs. */
export function codeMatches(stored, given) {
  const salt = stored?.salt || 'no-client-code';
  const a = Buffer.from(scrypt(given, salt));
  const b = Buffer.from(String(stored?.hash || ''));
  return !!stored?.hash && a.length === b.length && crypto.timingSafeEqual(a, b);
}
/** What the CRM may read about a client's code: whether it is set, when, and the lock. Never the hash, the salt or the version. */
export function codeStatus(code) {
  const c = code && typeof code === 'object' ? code : {};
  const until = Date.parse(c.lockedUntil || '') || 0;
  return { set: !!c.hash, setAt: c.hash ? String(c.setAt || '') : '', locked: !!c.locked, lockedUntil: until > Date.now() ? new Date(until).toISOString() : '', fails: Math.max(0, Math.round(Number(c.fails)) || 0) };
}
/** A lead as the CRM reads it: portal.code swapped for its status (codeStatus), so a hash never reaches a browser. */
export function withoutCode(lead) {
  if (!lead || typeof lead !== 'object' || !lead.portal || typeof lead.portal !== 'object' || !('code' in lead.portal)) return lead;
  return { ...lead, portal: { ...lead.portal, code: codeStatus(lead.portal.code) } };
}
