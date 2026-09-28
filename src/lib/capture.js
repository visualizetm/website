/* Quick capture (CRM revamp, step 4): one field that takes an Instagram
 * handle, a phone number or a business name, and the triage lead it makes.
 * A leading @ (or an instagram.com link) is a handle, mostly digits is a
 * phone, anything else is a name. The nightly scan fills in the rest. */
export function parseCapture(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  const ig = v.match(/^@([A-Za-z0-9._]{1,30})$/) || v.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  if (ig) { const h = ig[1].replace(/\.+$/, ''); return { kind: 'instagram', business: h, socials: { instagram: `https://instagram.com/${h}` } }; }
  const digits = v.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length / v.replace(/\s/g, '').length > 0.6) {
    const d = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
    const phone = d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : v;
    return { kind: 'phone', business: phone, phone };
  }
  return { kind: 'name', business: v.slice(0, 120) };
}
/** The POST body for the capture: a triage lead with the one field filled. */
export const captureLead = (parsed) => ({ business: parsed.business, stage: 'triage', source: 'capture', callStatus: 'not-called', priority: 'warm', ...(parsed.phone ? { phone: parsed.phone } : {}), ...(parsed.socials ? { socials: parsed.socials } : {}) });
