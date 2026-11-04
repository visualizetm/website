/* Links in one tap (prompt 3 of 3, milestone 4): the pure half of the three buttons under a link's message (Text it, Share, Draft an email)
 * on the Reviews, Portal, planner and concepts links. A text is an sms: link the phone's own Messages opens, filled in; Share is the phone's
 * share sheet; neither is a send from this system, and the Drafts rule is about what this system sends, so an email stays a draft in Compose. */
export const VIA_LABEL = { text: 'text', share: 'share sheet' };
/** sms: with the number (digits and a leading plus) and the body. "?&body=" is the form both iOS and Android read. */
export const smsHref = (phone, body) => `sms:${String(phone || '').replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(String(body || ''))}`;
/** The small line that replaced the Mark as sent tap: "Sent Oct 12, text". '' before it was sent. */
export function shortDay(iso, now = Date.now()) {
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) });
}
export const sentLine = (sentAt, via, now = Date.now()) => (sentAt && shortDay(sentAt, now) ? `Sent ${shortDay(sentAt, now)}${VIA_LABEL[via] ? `, ${VIA_LABEL[via]}` : ''}` : '');
export const canShare = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';
/** What navigator.share takes: the title, the text and, when the message does not already hold it, the url. */
export const sharePayload = (title, message, url) => ({ title, text: message, ...(url && !String(message).includes(url) ? { url } : {}) });
/** A cancelled share sheet rejects with AbortError: that is not a send. */
export const shareWasCancelled = (e) => !!e && (e.name === 'AbortError' || /cancel/i.test(String(e.message || '')));
