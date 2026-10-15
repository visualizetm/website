/* The email transport (the email system, milestone 1): one door out of the
 * app for every email, sendEmail().
 *
 * With RESEND_API_KEY set the message goes to Resend's HTTPS API through
 * fetch (no SDK), ten seconds to answer, one retry on a 5xx or a network
 * error (a timeout counts as one), never on a 4xx. Without the key the app
 * is in test mode: nothing leaves the server, the answer says test: true
 * and the caller logs the message with status test, so every screen, every
 * rule and every stamp can be used before the key exists.
 *
 * The sender comes from the settings document (api/_lib/email/settings.js),
 * never from a request; the default is Rob at Visualize at the studio
 * address, reply to the same. The rate guard is thirty sends per rolling
 * hour through the shared limiter's rate: key pattern (api/_lib/limit.js),
 * counted in test mode too, so the guard is exercised before the key is
 * in. The key never rides in an answer, an error or a log line. */
import { rateKey, rateState, rateHit } from '../limit.js';

export const RESEND_URL = 'https://api.resend.com/emails';
export const SEND_TIMEOUT_MS = 10000;
export const SENDS_PER_HOUR = 30;
export const SEND_WINDOW_MS = 60 * 60 * 1000;
export const DEFAULT_SENDER = Object.freeze({ name: 'Rob at Visualize', address: 'contact@visualizeclients.com', replyTo: 'contact@visualizeclients.com' });
export const LIMIT_MESSAGE = 'That is a lot of emails in one hour. Give it a little while and try again.';
export const TEST_MESSAGE = "Test only, email isn't connected yet.";
const RATE_KEY = rateKey('esend', 'all');

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
export const apiKey = () => String(process.env.RESEND_API_KEY || '').trim();
/** Connected means the key is set; everything else about the transport is the same in both modes. */
export const emailConnected = () => !!apiKey();

/** The sender from the emails settings document: a name, an address and a reply to, each falling back to the studio's. */
export function senderOf(doc) {
  const s = doc && typeof doc === 'object' ? (doc.sender && typeof doc.sender === 'object' ? doc.sender : doc) : {};
  const address = isEmail(s.address) ? String(s.address).trim().slice(0, 120) : DEFAULT_SENDER.address;
  return {
    name: String(s.name || '').replace(/[<>"\r\n]/g, '').trim().slice(0, 80) || DEFAULT_SENDER.name,
    address,
    replyTo: isEmail(s.replyTo) ? String(s.replyTo).trim().slice(0, 120) : address,
  };
}
export const fromLine = (sender) => `${sender.name} <${sender.address}>`;
const addressList = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(x => String(x || '').trim().toLowerCase()).filter(isEmail).filter((x, i, a) => a.indexOf(x) === i).slice(0, 10);
const scrub = (text, key) => { let s = String(text ?? ''); if (key) s = s.split(key).join('[key]'); return s.replace(/\s+/g, ' ').trim().slice(0, 300); };

/** How many sends the guard has counted in the rolling hour. */
export async function sendsThisHour(db) {
  const st = await rateState(db, RATE_KEY, { max: SENDS_PER_HOUR, windowMs: SEND_WINDOW_MS });
  return st.hits.length;
}

async function post(payload, key) {
  try {
    const r = await fetch(RESEND_URL, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
    let body = null;
    try { body = await r.json(); } catch { body = null; }
    return { status: Number(r.status) || 0, body };
  } catch (e) { return { status: 0, body: null, error: String(e?.message || e) }; }
}
/* A 5xx or no answer at all (a refused connection, a timeout) is worth one more try; a 4xx said no and is never retried. */
const retriable = (r) => r.status === 0 || r.status >= 500;

/**
 * sendEmail(db, { to, cc, replyTo, subject, html, text, headers, sender })
 *   -> { ok, test, status: 'sent' | 'test' | 'failed', providerId, error, attempts, limited, retryAfter }
 * `sender` is the settings document's sender (or the document itself); the request never names one.
 */
export async function sendEmail(db, msg = {}) {
  const to = addressList(msg.to); const cc = addressList(msg.cc).filter(x => !to.includes(x));
  if (!to.length) return { ok: false, test: !emailConnected(), status: 'failed', providerId: '', error: 'No address to send to.', attempts: 0 };
  const subject = String(msg.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  if (!subject) return { ok: false, test: !emailConnected(), status: 'failed', providerId: '', error: 'The email has no subject.', attempts: 0 };
  const limit = await rateState(db, RATE_KEY, { max: SENDS_PER_HOUR, windowMs: SEND_WINDOW_MS });
  if (limit.exceeded) return { ok: false, test: !emailConnected(), status: 'failed', providerId: '', error: LIMIT_MESSAGE, attempts: 0, limited: true, retryAfter: limit.retryAfter };
  await rateHit(db, RATE_KEY, limit.hits);
  const sender = senderOf(msg.sender);
  const key = apiKey();
  if (!key) return { ok: true, test: true, status: 'test', providerId: '', error: '', attempts: 0 };
  const replyTo = isEmail(msg.replyTo) ? String(msg.replyTo).trim().slice(0, 120) : sender.replyTo;
  const headers = msg.headers && typeof msg.headers === 'object' ? Object.fromEntries(Object.entries(msg.headers).filter(([k, v]) => /^[A-Za-z][A-Za-z0-9-]{0,60}$/.test(k) && typeof v === 'string').map(([k, v]) => [k, v.replace(/[\r\n]+/g, ' ').slice(0, 600)])) : null;
  const payload = { from: fromLine(sender), to, ...(cc.length ? { cc } : {}), reply_to: replyTo, subject, html: String(msg.html || ''), text: String(msg.text || ''), ...(headers && Object.keys(headers).length ? { headers } : {}) };
  let attempts = 1;
  let r = await post(payload, key);
  if (retriable(r)) { attempts = 2; r = await post(payload, key); }
  if (r.status >= 200 && r.status < 300) return { ok: true, test: false, status: 'sent', providerId: String(r.body?.id || '').slice(0, 80), error: '', attempts };
  const said = r.body?.message || r.error || `Resend answered ${r.status}`;
  return { ok: false, test: false, status: 'failed', providerId: '', error: scrub(said, key), attempts, httpStatus: r.status };
}
