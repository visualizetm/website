/* ── The shape guard (lead crash fix) ────────────────────────────────
 * A record that reaches a card or the detail has to have the shape the
 * screens assume: strings where they print text, arrays where they map,
 * objects where they read keys. A batch written straight into the
 * collection (the enricher, a scraper, a one-off script) can carry a JSON
 * string where an array should be, an array where a string should be, or
 * a null, and one such record used to take the whole screen down through
 * the ErrorBoundary. normalizeLead() runs on every record as it enters the
 * app (AdminApp and the Call Console's own load) and again inside LeadCard
 * and LeadDetail, and it is idempotent: a lead with a broken field renders
 * as a lead with a missing field. scripts/repair-leads.mjs applies the same
 * rules to the stored records. Keep the three in step. */
const parseJson = (v) => { try { return JSON.parse(v); } catch { return undefined; } };
export const asString = (v, max = 4000) => {
  if (v == null) return '';
  if (typeof v === 'string') return v.slice(0, max);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(x => asString(x, max)).filter(Boolean).join(' ').slice(0, max);
  if (typeof v === 'object') return asString(v.name ?? v.label ?? v.value ?? v.text ?? '', max);
  return '';
};
export const asArray = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('[')) { const p = parseJson(v); if (Array.isArray(p)) return p; }
  return [];
};
export const asObject = (v) => {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim().startsWith('{')) { const p = parseJson(v); if (p && typeof p === 'object' && !Array.isArray(p)) return p; }
  return {};
};
const asEnum = (v, ids, fallback) => (ids.includes(v) ? v : fallback);
const STRING_FIELDS = ['business', 'industry', 'descriptor', 'phone', 'phoneNote', 'email', 'area', 'askFor', 'bestWindow', 'angle', 'notes', 'prepNotes', 'address', 'serviceInterest', 'callbackAt', 'clientSince', 'sourceId', 'mergedInto', 'calendlyEventUri'];
const ARRAY_FIELDS = ['beforeYouDial', 'objections', 'callLog', 'contactLog', 'concepts', 'purchases', 'checklists', 'gamePlan', 'servicesPlanned', 'pricingOptions'];
const OBJECT_FIELDS = ['script', 'close', 'afterCall', 'intel', 'socials', 'meeting', 'brand', 'links', 'reviews', 'showcase', 'planner', 'retainer', 'enrichment', 'conceptsTracker', 'bookedOutcome'];
const STAGE_IDS_SAFE = ['lead', 'booked', 'won', 'client', 'lost'];
const PRIORITY_IDS_SAFE = ['hot', 'warm', 'cold'];
const CALL_STATUS_IDS_SAFE = ['not-called', 'callback', 'no-answer', 'booked', 'no', 'wrong-number'];
/** Every field a screen reads, coerced to the type the screen expects; unknown fields pass through. */
export function normalizeLead(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const out = { ...raw };
  for (const k of STRING_FIELDS) if (k in out && typeof out[k] !== 'string') out[k] = asString(out[k]);
  for (const k of ARRAY_FIELDS) if (k in out && !Array.isArray(out[k])) out[k] = asArray(out[k]);
  for (const k of OBJECT_FIELDS) if (k in out && out[k] != null && (typeof out[k] !== 'object' || Array.isArray(out[k]))) out[k] = asObject(out[k]);
  if ('intel' in out) { const i = asObject(out.intel); out.intel = { ...i, accomplishments: asArray(i.accomplishments), gaps: asArray(i.gaps), dropLines: asArray(i.dropLines) }; }
  if ('script' in out && out.script && typeof out.script === 'object' && 'likelyAnswers' in out.script) out.script = { ...out.script, likelyAnswers: asArray(out.script.likelyAnswers) };
  if ('reviews' in out && out.reviews && typeof out.reviews === 'object') out.reviews = { ...out.reviews, asks: asArray(out.reviews.asks), testimonials: asArray(out.reviews.testimonials) };
  if ('stage' in out && out.stage !== undefined && !STAGE_IDS_SAFE.includes(out.stage)) out.stage = '';
  if ('priority' in out && !PRIORITY_IDS_SAFE.includes(out.priority)) out.priority = 'warm';
  if ('callStatus' in out && !CALL_STATUS_IDS_SAFE.includes(out.callStatus)) out.callStatus = 'not-called';
  return out;
}
export const normalizeLeads = (list) => (Array.isArray(list) ? list.map(normalizeLead) : []);
