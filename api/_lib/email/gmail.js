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
export const GMAIL_ENV = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REFRESH_TOKEN'];
export const gmailConnected = () => GMAIL_ENV.every(k => !!String(process.env[k] || '').trim());
export const gmailEnabled = (settings) => !!settings && settings.gmailDrafts === true;
export const gmailDraftUrl = (messageId) => (messageId ? `https://mail.google.com/mail/u/0/#drafts/${encodeURIComponent(messageId)}` : 'https://mail.google.com/mail/u/0/#drafts');

/** A short lived access token from the refresh token; '' when anything is off. The token is used once and never stored. */
async function accessToken() {
  if (!gmailConnected()) return '';
  try {
    const body = new URLSearchParams({ client_id: process.env.GMAIL_CLIENT_ID, client_secret: process.env.GMAIL_CLIENT_SECRET, refresh_token: process.env.GMAIL_REFRESH_TOKEN, grant_type: 'refresh_token' });
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
export async function createGmailDraft(msg) {
  const token = await accessToken();
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
  if (!gmailEnabled(s) || !gmailConnected()) return null;
  const sender = s.sender || {};
  const made = await createGmailDraft({ from: `${sender.name || 'Rob'} <${sender.address || ''}>`, to: row.to || [], cc: row.cc || [], subject: row.subject, text: row.text, html: row.html });
  if (!made) return null;
  try { await updateLog(db, row._id, { gmailDraftId: made.id, gmailMessageId: made.messageId }); } catch { /* the Gmail draft exists; the next read will not know it */ }
  return made;
}
