/* The Gmail draft a CRM draft was mirrored into (email safety, prompt 1 of 3; the server writes gmailMessageId on the row). */
export const gmailDraftUrl = (messageId) => (messageId ? `https://mail.google.com/mail/u/0/#drafts/${encodeURIComponent(messageId)}` : 'https://mail.google.com/mail/u/0/#drafts');
