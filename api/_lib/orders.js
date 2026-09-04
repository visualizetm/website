// Print orders (Prompt 11): the server side of turning a shop-order submission
// into an orders document. src/lib/orders.js carries the same parser for the
// client (serverless functions cannot import from src/); keep both in sync.

const TURNAROUND_DAYS = 7;
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

/** The shop joins items with " | " and separates name, label, and price with a
 *  spaced dash (the site uses the long dash). Each part becomes
 *  { name, label, qty, priceTotal, quote }. Anything that does not parse keeps
 *  its raw text as the name with qty 1 and a quote flag. */
export function parseItemsString(str) {
  const out = [];
  for (const raw of String(str || '').split('|')) {
    const part = raw.trim();
    if (!part) continue;
    const bits = part.split(/\s+(?:—|–|-)\s+/).map(x => x.trim());
    const name = bits[0] || part;
    const label = bits.length > 2 ? bits.slice(1, -1).join(', ') : (bits[1] || '');
    const priceText = bits.length > 1 ? bits[bits.length - 1] : '';
    const priceMatch = priceText.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
    const quote = !priceMatch || /quote/i.test(priceText);
    const priceTotal = priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null;
    const qtyMatch = `${label} ${bits.length <= 2 ? priceText : ''}`.match(/(?:qty|quantity|x)\s*:?\s*(\d{1,5})/i) || label.match(/^(\d{1,5})\b/);
    const qty = qtyMatch ? Math.max(1, Number(qtyMatch[1])) : 1;
    out.push({ id: Math.random().toString(36).slice(2, 10), productId: '', name: name.slice(0, 160), label: label.slice(0, 200), qty, options: {}, artworkLink: '', priceTotal: quote ? null : priceTotal, quote });
  }
  return out;
}

/** The orders document for a shop-order submission (source shop, status new). */
export function orderFromSubmission(sub) {
  const items = parseItemsString(sub.fields?.Items);
  const subtotal = items.reduce((n, i) => n + (Number(i.priceTotal) || 0), 0);
  const created = sub.createdAt ? new Date(sub.createdAt) : new Date();
  return {
    source: 'shop', status: 'new', submissionId: String(sub._id), leadId: sub.linkedLeadId || '', projectId: '',
    customer: { name: String(sub.name || '').slice(0, 200), email: String(sub.email || '').slice(0, 200), phone: String(sub.phone || '').slice(0, 60) },
    items, subtotal, rush: false, dueAt: dayKey(created.getTime() + TURNAROUND_DAYS * 864e5),
    notes: '', paid: null, createdAt: created, updatedAt: new Date(),
  };
}
