/* Billy's record (Billy's Call Room, part 1): one document in its own
 * collection, team { _id: 'billy', name, email, passHash, passSalt, version,
 * canSignIn, moveOffRobLists, openTimes, prefs }, and the log of what he
 * does, team_activity { at, who, kind, leadIds, business, detail }.
 *
 * Neither is a settings document and neither is in the backup's collection
 * whitelist (api/_routes/backup.js), so the passcode hash never reaches the
 * admin's whole-document reads, the service worker's cache or a backup file.
 * The passcode is stored as a scrypt hash and a salt, never in plain text
 * and never logged; publicTeam() is the only shape that leaves the server
 * and it never carries passHash, passSalt or version. */
import crypto from 'crypto';

export const BILLY = 'billy';
export const TEAM_SECRET_KEYS = ['passHash', 'passSalt', 'version'];
/* No 0, O, 1, I or L: Rob reads it out and Billy types it on a phone. */
const PASS_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PASSCODE_LENGTH = 8;

const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const normPasscode = (v) => String(v ?? '').replace(/[\s-]/g, '').toUpperCase().slice(0, 64);
/** A fresh passcode, shown to Rob once: eight characters in two groups of four. */
export function newPasscode() {
  let out = '';
  for (let i = 0; i < PASSCODE_LENGTH; i++) out += PASS_ALPHABET[crypto.randomInt(PASS_ALPHABET.length)];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}
const scrypt = (passcode, salt) => crypto.scryptSync(normPasscode(passcode), String(salt), 64).toString('base64url');
export function hashPasscode(passcode, salt = crypto.randomBytes(16).toString('base64url')) {
  return { passHash: scrypt(passcode, salt), passSalt: salt };
}
/** Constant time; a record without a hash still pays for one scrypt so a missing account answers like a wrong passcode. */
export function passcodeMatches(doc, given) {
  const salt = doc?.passSalt || 'no-account';
  const a = Buffer.from(scrypt(given, salt));
  const b = Buffer.from(String(doc?.passHash || ''));
  return !!doc?.passHash && a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const emailKey = (v) => str(v, 200).toLowerCase();

/** Rob's open times source: a Calendly event type, or weekly hours in 30 minute slots. */
export function sanitizeOpenTimes(v) {
  const o = v && typeof v === 'object' ? v : {};
  const h = o.hours && typeof o.hours === 'object' ? o.hours : {};
  const days = Array.isArray(h.days) ? [...new Set(h.days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [1, 2, 3, 4, 5];
  const uri = str(o.eventType, 200);
  return {
    source: o.source === 'calendly' ? 'calendly' : 'hours',
    eventType: /^https:\/\/api\.calendly\.com\/event_types\/[A-Za-z0-9-]{1,80}$/.test(uri) ? uri : '',
    eventTypeName: str(o.eventTypeName, 120),
    hours: { days, start: HHMM.test(String(h.start)) ? String(h.start) : '10:00', end: HHMM.test(String(h.end)) ? String(h.end) : '16:00' },
  };
}
/** "Tell me when Billy": books a lead (on unless switched off), finishes a session (off unless switched on). */
export const sanitizePrefs = (v) => ({ booked: !(v && typeof v === 'object') || v.booked !== false, session: !!v && typeof v === 'object' && v.session === true });

export const teamDoc = (db) => db.collection('team').findOne({ _id: BILLY });

/** What may leave the server about Billy: everything except the passcode hash, its salt and the cookie version. */
export function publicTeam(doc) {
  const d = doc && typeof doc === 'object' ? doc : {};
  return {
    id: BILLY,
    exists: !!doc,
    name: str(d.name, 40) || 'Billy',
    email: str(d.email, 200),
    hasPasscode: !!d.passHash,
    canSignIn: !!doc && d.canSignIn !== false,
    moveOffRobLists: d.moveOffRobLists !== false,
    openTimes: sanitizeOpenTimes(d.openTimes),
    prefs: sanitizePrefs(d.prefs),
    lastSeenAt: str(d.lastSeenAt, 40),
    passcodeSetAt: str(d.passcodeSetAt, 40),
    pausedAt: str(d.pausedAt, 40),
  };
}

let indexed = false;
/** One row per thing Billy did, newest read first. Stamped on the server; the request never names who or when. */
export async function logActivity(db, { kind, leadIds = [], business = '', detail = {} }, now = Date.now()) {
  const col = db.collection('team_activity');
  if (!indexed) { indexed = true; try { await col.createIndex({ at: -1 }); } catch { /* the read still works unindexed */ } }
  const row = { at: new Date(now).toISOString(), who: BILLY, kind: str(kind, 20), leadIds: leadIds.map(String).slice(0, 500), business: str(business, 200), detail: detail && typeof detail === 'object' ? detail : {} };
  await col.insertOne(row);
  return row;
}
