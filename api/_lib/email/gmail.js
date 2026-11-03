/* Draft into Gmail (email safety, prompt 1 of 3), optional and off by default.
 * When Settings, Emails has the toggle on and the three variables exist
 * (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN: a refresh token
 * from a one time OAuth consent for Rob's account), every new draft and every
 * email approved for later is also created as a Gmail draft (the Gmail API's
 * drafts.create with the rendered HTML) and the draft id is kept on the log
 * entry, so the Drafts screen can say In Gmail and open it. A refresh token
 * never expires on its own, so there is no in app OAuth dance: the connect
 * step is the three variables. Nothing here ever logs a token, and a failure
 * (no variables, a refused token, a network error) leaves the CRM's draft
 * exactly as it was: Gmail is a mirror, never the record.
 *
 *   gmailConnected()               the three variables exist (names only)
 *   gmailEnabled(settings)         the toggle on the emails settings document
 *   createGmailDraft(msg)          -> { id, messageId } or null
 *   mirrorToGmail(db, row)         -> { id, messageId } written on the row, or null */
import { updateLog } from './log.js';
import { readEmailSettings } from './settings.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRAFTS_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts';
const TIMEOUT_MS = 8000;
import crypto from 'node:crypto';
import { sessionSecret } from '../config.js';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
/* The Connect flow (prompt 1b): GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are variables; the refresh token comes from Google's
   consent screen through the callback and lives on the emails settings document, encrypted with the session secret
   (settings.gmail: { token, email, connectedAt }). GMAIL_REFRESH_TOKEN is an optional override only. Names only, never values. */
export const GMAIL_ENV = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
export const GMAIL_CALLBACK_PATH = '/api/settings/gmail/callback';
const env = (k) => String(process.env[k] || '').trim();
export const gmailAppConfigured = () => !!env('GMAIL_CLIENT_ID') && !!env('GMAIL_CLIENT_SECRET');
/** The refresh token in use: the variable when set, else the stored one, decrypted; '' when neither. */
export const refreshTokenOf = (settings) => env('GMAIL_REFRESH_TOKEN') || decryptToken(settings?.gmail?.token || '');
export const gmailConnected = (settings = null) => gmailAppConfigured() && !!refreshTokenOf(settings);
export const gmailEnabled = (settings) => !!settings && settings.gmailDrafts === true;
/** What Settings shows: connected, the address, where the token comes from. Never the token. */
export const gmailStatus = (settings) => ({ connected: gmailConnected(settings), configured: gmailAppConfigured(), email: env('GMAIL_REFRESH_TOKEN') ? '' : String(settings?.gmail?.email || ''), source: env('GMAIL_REFRESH_TOKEN') ? 'variable' : settings?.gmail?.token ? 'connect' : '' });

/* The stored token is AES-256-GCM under a key derived from the session secret: the database alone cannot read it. */
const key = () => crypto.createHash('sha256').update(`gmail:${sessionSecret()}`).digest();
export function encryptToken(raw) {
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(String(raw), 'utf8'), c.final()]);
  return `v1.${iv.toString('base64url')}.${enc.toString('base64url')}.${c.getAuthTag().toString('base64url')}`;
}
export function decryptToken(stored) {
  try {
    const [v, iv, enc, tag] = String(stored || '').split('.');
    if (v !== 'v1' || !iv || !enc || !tag) return '';
    const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url')); d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
  } catch { return ''; }
}
/** The state Google hands back: an HMAC of the day under the session secret, so only this deployment's own consent screen lands. */
export const connectState = (now = Date.now()) => crypto.createHmac('sha256', sessionSecret()).update(`gmail-connect:${Math.floor(now / 864e5)}`).digest('base64url');
export const stateOk = (state, now = Date.now()) => [0, 1].some(d => String(state || '') === connectState(now - d * 864e5));
/** The consent URL the Connect button opens (offline access, consent forced so a refresh token comes back every time). */
export function connectUrl(base, now = Date.now()) {
  if (!gmailAppConfigured()) return '';
  const q = new URLSearchParams({ client_id: env('GMAIL_CLIENT_ID'), redirect_uri: `${base}${GMAIL_CALLBACK_PATH}`, response_type: 'code', scope: GMAIL_SCOPE, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state: connectState(now) });
  return `${AUTH_URL}?${q.toString()}`;
}
/** The callback: the code for a refresh token, the profile for the address; { ok, email, token } (token raw, for the caller to encrypt and store), never logged. */
export async function exchangeCode(code, base) {
  if (!gmailAppConfigured() || !code) return { ok: false, error: 'Gmail is not set up: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are needed first.' };
  try {
    const body = new URLSearchParams({ code: String(code), client_id: env('GMAIL_CLIENT_ID'), client_secret: env('GMAIL_CLIENT_SECRET'), redirect_uri: `${base}${GMAIL_CALLBACK_PATH}`, grant_type: 'authorization_code' });
    const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return { ok: false, error: `Google refused the code (${r.status}).` };
    const j = await r.json();
    const token = typeof j?.refresh_token === 'string' ? j.refresh_token : '';
    if (!token) return { ok: false, error: 'Google sent no refresh token. Remove the app at myaccount.google.com, Security, Third party access, then Connect again.' };
    let email = '';
    if (typeof j?.access_token === 'string') {
      try { const p = await fetch(PROFILE_URL, { headers: { Authorization: `Bearer ${j.access_token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) }); if (p.ok) email = String((await p.json())?.emailAddress || ''); } catch { email = ''; }
    }
    return { ok: true, token, email };
  } catch { return { ok: false, error: 'Google did not answer.' }; }
}
export const gmailDraftUrl = (messageId) => (messageId ? `https://mail.google.com/mail/u/0/#drafts/${encodeURIComponent(messageId)}` : 'https://mail.google.com/mail/u/0/#drafts');

/** A short lived access token from the refresh token; '' when anything is off. The token is used once and never stored. */
async function accessToken(settings = null) {
  if (!gmailConnected(settings)) return '';
  try {
    const body = new URLSearchParams({ client_id: env('GMAIL_CLIENT_ID'), client_secret: env('GMAIL_CLIENT_SECRET'), refresh_token: refreshTokenOf(settings), grant_type: 'refresh_token' });
    const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString(), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return '';
    const j = await r.json();
    return typeof j?.access_token === 'string' ? j.access_token : '';
  } catch { return ''; }
}

const header = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim();
const b64url = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** One RFC 822 message, multipart alternative (text and html), base64url for the API's raw field. */
export function rawMessage({ from, to = [], cc = [], subject = '', text = '', html = '' }) {
  const boundary = 'vz-' + Math.random().toString(36).slice(2, 12);
  const lines = [
    `From: ${header(from)}`, `To: ${to.map(header).join(', ')}`, ...(cc.length ? [`Cc: ${cc.map(header).join(', ')}`] : []),
    `Subject: =?UTF-8?B?${Buffer.from(header(subject), 'utf8').toString('base64')}?=`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${boundary}"`, '',
    `--${boundary}`, 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from(String(text), 'utf8').toString('base64'), '',
    `--${boundary}`, 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '', Buffer.from(String(html), 'utf8').toString('base64'), '',
    `--${boundary}--`, '',
  ];
  return b64url(lines.join('\r\n'));
}

/** drafts.create: { id, messageId } or null. Never throws, never logs the token. */
export async function createGmailDraft(msg, settings = null) {
  const token = await accessToken(settings);
  if (!token) return null;
  try {
    const r = await fetch(DRAFTS_URL, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { raw: rawMessage(msg) } }), signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return null;
    const j = await r.json();
    const id = String(j?.id || '').slice(0, 120); const messageId = String(j?.message?.id || '').slice(0, 120);
    return id ? { id, messageId } : null;
  } catch { return null; }
}

/** The CRM draft mirrored into Gmail when the toggle is on and the variables exist; the ids are written on the row. */
export async function mirrorToGmail(db, row, settings = null) {
  if (!row || row.channel === 'text' || row.gmailDraftId) return null;
  const s = settings || await readEmailSettings(db);
  if (!gmailEnabled(s) || !gmailConnected(s)) return null;
  const sender = s.sender || {};
  const made = await createGmailDraft({ from: `${sender.name || 'Rob'} <${sender.address || ''}>`, to: row.to || [], cc: row.cc || [], subject: row.subject, text: row.text, html: row.html }, s);
  if (!made) return null;
  try { await updateLog(db, row._id, { gmailDraftId: made.id, gmailMessageId: made.messageId }); } catch { /* the Gmail draft exists; the next read will not know it */ }
  return made;
}
