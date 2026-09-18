/* Pure helpers for the Leads screen: filtering with cross-counts, search,
 * sort, industry normalization, duplicate detection, merge planning, CSV.
 * Rules are documented in reports/PROMPT-06-REPORT.md section 4. */
import { last10, digitsOf, formatPhone } from '../shared/phone';
import { industryKey, displayIndustry, normalizeStage } from '../shared/semantics';
import { hasAnySocial } from './socials';

const DAY = 864e5;

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
  if ('intel' in out && out.intel && typeof out.intel === 'object') out.intel = { accomplishments: asArray(out.intel.accomplishments), gaps: asArray(out.intel.gaps), dropLines: asArray(out.intel.dropLines) };
  if ('script' in out && out.script && typeof out.script === 'object' && 'likelyAnswers' in out.script) out.script = { ...out.script, likelyAnswers: asArray(out.script.likelyAnswers) };
  if ('reviews' in out && out.reviews && typeof out.reviews === 'object') out.reviews = { ...out.reviews, asks: asArray(out.reviews.asks), testimonials: asArray(out.reviews.testimonials) };
  if ('stage' in out && out.stage !== undefined && !STAGE_IDS_SAFE.includes(out.stage)) out.stage = '';
  if ('priority' in out && !PRIORITY_IDS_SAFE.includes(out.priority)) out.priority = 'warm';
  if ('callStatus' in out && !CALL_STATUS_IDS_SAFE.includes(out.callStatus)) out.callStatus = 'not-called';
  return out;
}
export const normalizeLeads = (list) => (Array.isArray(list) ? list.map(normalizeLead) : []);
export const isNewLead = (l, now = Date.now()) => l.createdAt && now - new Date(l.createdAt).getTime() < 2 * DAY;
export const lastCall = (l) => (l.callLog || [])[l.callLog?.length - 1] || null;
export const lastTouchAt = (l) => {
  let best = 0;
  for (const e of (l.callLog || [])) best = Math.max(best, new Date(e.at).getTime() || 0);
  for (const e of (l.contactLog || [])) best = Math.max(best, new Date(e.at).getTime() || 0);
  return best || 0;
};
export const scanAgeDays = (l, now = Date.now()) => (l.enrichment?.lastScanAt ? (now - new Date(l.enrichment.lastScanAt).getTime()) / DAY : null);

/** Industry facets from the pool, keyed by industryKey, sorted by count desc then label. */
export function industryFacets(leads) {
  const m = new Map();
  for (const l of leads) { const k = industryKey(l.industry); if (!k) continue; const e = m.get(k) || { key: k, label: displayIndustry(l.industry), count: 0 }; e.count++; m.set(k, e); }
  return [...m.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Text or digit search over business, contact name, phone (last10 partial), industry. */
export function matchesSearch(l, q) {
  const s = String(q || '').trim();
  if (!s) return true;
  const d = digitsOf(s);
  if (d && /^[\s()+\-.\d]+$/.test(s)) { const p = last10(l.phone); return !!p && p.includes(last10(d) || d); }
  const n = s.toLowerCase();
  return `${l.business} ${l.askFor} ${l.industry} ${l.descriptor}`.toLowerCase().includes(n);
}

export const EMPTY_FILTERS = { status: [], prio: [], industry: [], data: [] };

/** One lead against one filter group. `dupes` is the set of ids in a duplicate pair. */
function passesGroup(l, group, values, dupes) {
  if (!values.length) return true;
  switch (group) {
    case 'status': return values.includes(l.callStatus || 'not-called');
    case 'prio': return values.includes(l.priority || 'warm');
    case 'industry': return values.includes(industryKey(l.industry));
    case 'data': return values.every(v => (
      v === 'phone' ? !!last10(l.phone)
        : v === 'socials' ? hasAnySocial(l.socials)
          : v === 'never' ? !l.enrichment?.lastScanAt
            : v === 'dupes' ? dupes.has(l._id) : true));
    default: return true;
  }
}

/** Filtered pool. `except` skips one group so its chip counts reflect the other filters. */
export function applyFilters(pool, filters, q, dupes, except) {
  return pool.filter(l => matchesSearch(l, q) && ['status', 'prio', 'industry', 'data'].every(g => g === except || passesGroup(l, g, filters[g] || [], dupes)));
}

/** Chip count for a value in a group: leads passing every OTHER filter that also match this value. */
export function countFor(pool, filters, q, dupes, group, value) {
  const base = applyFilters(pool, filters, q, dupes, group);
  return base.filter(l => passesGroup(l, group, [value], dupes)).length;
}

export const SORTS = [
  { id: 'added', label: 'Added, newest first', dir: 'desc' },
  { id: 'business', label: 'Business A to Z', dir: 'asc' },
  { id: 'priority', label: 'Priority, hot first', dir: 'asc' },
  { id: 'status', label: 'Status', dir: 'asc' },
  { id: 'lastCall', label: 'Last call, newest first', dir: 'desc' },
  { id: 'calls', label: 'Most calls', dir: 'desc' },
  { id: 'scanned', label: 'Scanned, newest first', dir: 'desc' },
];
const PRIO_RANK = { hot: 0, warm: 1, cold: 2 };
const STATUS_RANK = { 'not-called': 0, callback: 1, 'no-answer': 2, no: 3, booked: 4 };
const VAL = {
  added: (l) => new Date(l.createdAt || 0).getTime(),
  business: (l) => String(l.business || '').toLowerCase(),
  priority: (l) => PRIO_RANK[l.priority] ?? 1,
  status: (l) => STATUS_RANK[l.callStatus] ?? 0,
  lastCall: (l) => (lastCall(l) ? new Date(lastCall(l).at).getTime() : 0),
  calls: (l) => (l.callLog || []).length,
  scanned: (l) => (l.enrichment?.lastScanAt ? new Date(l.enrichment.lastScanAt).getTime() : 0),
};
export function sortLeads(list, sort) {
  const f = VAL[sort?.id] || VAL.added; const dir = sort?.dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => { const x = f(a); const y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * dir || String(a.business).localeCompare(String(b.business)); });
}

/** Duplicate pairs: same last10 phone, or same normalized business within the same industry key. */
const STOP = new Set(['the', 'llc', 'inc']);
export const normName = (v) => String(v || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).join(' ');
export function findDuplicates(pool) {
  const byPhone = new Map(); const byName = new Map();
  for (const l of pool) {
    const p = last10(l.phone); if (p) (byPhone.get(p) || byPhone.set(p, []).get(p)).push(l);
    const n = normName(l.business); if (n) { const k = `${industryKey(l.industry)}|${n}`; (byName.get(k) || byName.set(k, []).get(k)).push(l); }
  }
  // Union-find into groups.
  const parent = new Map(); const find = (id) => { while (parent.get(id) !== id) { parent.set(id, parent.get(parent.get(id))); id = parent.get(id); } return id; };
  const union = (a, b) => { parent.set(a, parent.get(a) ?? a); parent.set(b, parent.get(b) ?? b); const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const reasons = new Map();
  for (const [m, why] of [[byPhone, 'phone'], [byName, 'name']]) for (const list of m.values()) if (list.length > 1) for (let i = 1; i < list.length; i++) { union(list[0]._id, list[i]._id); reasons.set(list[i]._id, why); reasons.set(list[0]._id, why); }
  const groups = new Map();
  for (const id of parent.keys()) { const r = find(id); (groups.get(r) || groups.set(r, []).get(r)).push(id); }
  const byId = new Map(pool.map(l => [l._id, l]));
  const out = [...groups.values()].filter(g => g.length > 1).map(g => ({ ids: g, leads: g.map(id => byId.get(id)).filter(Boolean), reason: reasons.get(g[0]) || 'name' }));
  return { groups: out, ids: new Set(out.flatMap(g => g.ids)) };
}

/** Fields that can conflict in a merge. */
export const MERGE_FIELDS = [
  { id: 'phone', label: 'Phone', show: (v) => formatPhone(v) || '' },
  { id: 'askFor', label: 'Contact' },
  { id: 'descriptor', label: 'Descriptor' },
  { id: 'priority', label: 'Priority' },
  { id: 'socials', label: 'Socials', show: (v) => Object.entries(v || {}).filter(([, u]) => u).map(([k]) => k).join(', ') },
];
const eqVal = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
export const conflicts = (a, b) => MERGE_FIELDS.filter(f => !eqVal(a[f.id], b[f.id]) && (a[f.id] || b[f.id]) && (f.id !== 'socials' || hasAnySocial(a.socials) || hasAnySocial(b.socials)));

/** The $set payload for the winner. choices: { field: 'a'|'b' } (a = winner, b = loser). */
export function mergePayload(winner, loser, choices, now = new Date()) {
  const set = {};
  for (const f of MERGE_FIELDS) if (choices[f.id] === 'b') set[f.id] = loser[f.id];
  const dedupe = (arr, keyOf) => { const seen = new Set(); return arr.filter(x => { const k = keyOf(x); if (seen.has(k)) return false; seen.add(k); return true; }); };
  set.callLog = dedupe([...(winner.callLog || []), ...(loser.callLog || [])].sort((x, y) => new Date(x.at) - new Date(y.at)), (e) => `${e.at}|${e.outcome}`);
  set.contactLog = dedupe([...(winner.contactLog || []), ...(loser.contactLog || [])].sort((x, y) => new Date(x.at) - new Date(y.at)), (e) => `${e.at}|${e.type}|${e.note || ''}`);
  set.purchases = dedupe([...(winner.purchases || []), ...(loser.purchases || [])], (p) => `${p.at}|${p.label}|${p.amount}`);
  const stamp = `[Merged from ${loser.business} on ${now.toLocaleDateString()}]`;
  set.notes = [winner.notes, loser.notes, stamp].filter(Boolean).join('\n\n');
  if (!set.socials) { const merged = { ...(loser.socials || {}), ...(winner.socials || {}) }; if (hasAnySocial(merged)) set.socials = merged; }
  return set;
}

/** CSV of the given leads with the given columns [{id,label,csv:(l)=>string}]. */
export function leadsToCsv(leads, columns) {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [columns.map(c => esc(c.label)).join(','), ...leads.map(l => columns.map(c => esc(c.csv ? c.csv(l) : l[c.id])).join(','))].join('\n');
}

export const openLeads = (leads) => leads.filter(l => normalizeStage(l) === 'lead');
