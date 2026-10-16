/* Invoice numbers (the email system, milestone 6): INV-0001 and up from
 * settings.emails.invoiceCounter, taken with one atomic $inc on the first
 * send of an invoice email and written on the line, so two sends at once
 * never share a number and a number is never handed out twice. A preview
 * before the first send shows the next number as it stands. */
import { EMAIL_SETTINGS_ID } from './settings.js';

export const INVOICE_PREFIX = 'INV-';
export const invoiceNumberOf = (n) => `${INVOICE_PREFIX}${String(Math.max(1, Math.round(Number(n) || 1))).padStart(4, '0')}`;
/** The number the next first send takes, for a preview: the counter plus one. */
export const nextInvoiceNumber = (settings) => invoiceNumberOf((Number(settings?.invoiceCounter) || 0) + 1);

/** One atomic step of the counter; the number it answers belongs to the caller alone. */
export async function allocateInvoiceNumber(db) {
  const r = await db.collection('settings').findOneAndUpdate(
    { _id: EMAIL_SETTINGS_ID },
    { $inc: { invoiceCounter: 1 }, $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, returnDocument: 'after', includeResultMetadata: true },
  );
  const doc = r && typeof r === 'object' && 'value' in r ? r.value : r;
  return invoiceNumberOf(doc?.invoiceCounter);
}
