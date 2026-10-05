/* Command bar matching. Digit queries behave exactly like the old reverse
 * phone lookup (last10 + matchRank from src/shared/phone.js, partial trailing
 * digits allowed). Text queries match business, contact name, descriptor,
 * and industry. Nav entries match on label for "Jump to". */
import { digitsOf, matchRank, formatPhone } from '../shared/phone';
import { normalizeStage } from '../shared/semantics';
import { NAV } from './nav';
import { matchDoc, snippetFor, typeLabel } from '../lib/docs';

export const isDigitQuery = (q) => /^[\s()+\-.\d]+$/.test(q) && digitsOf(q).length > 0;

const lower = (v) => String(v ?? '').toLowerCase();
const CLIENT_STAGES = new Set(['won', 'client']);

function textScore(lead, needle) {
  const biz = lower(lead.business);
  if (!needle) return -1;
  if (biz.startsWith(needle)) return 0;
  if (biz.includes(needle)) return 1;
  if (lower(lead.askFor).includes(needle)) return 2;
  if (lower(lead.industry).includes(needle)) return 3;
  if (lower(lead.descriptor).includes(needle)) return 4;
  return -1;
}

/**
 * @returns {{ leads: Array, clients: Array, showcases: Array, jumps: Array, docs: Array, digits: boolean }}
 * leads/clients/showcases entries are { lead, rank }; showcases are the same
 * client matches offered a second time as "Showcase: <business>", the jump
 * to that client's showcase editor (Site Prompt 7, Part 3).
 */
export function searchAll(query, leads, { limit = 6, docs = [] } = {}) {
  const q = String(query || '').trim();
  const digits = isDigitQuery(q);
  const needle = lower(q);
  const scored = [];
  if (q) {
    for (const lead of leads) {
      const rank = digits ? matchRank(lead.phone, digitsOf(q)) : textScore(lead, needle);
      if (rank >= 0) scored.push({ lead, rank });
    }
    scored.sort((a, b) => a.rank - b.rank || String(a.lead.business).localeCompare(String(b.lead.business)));
  }
  const clients = scored.filter(x => CLIENT_STAGES.has(normalizeStage(x.lead))).slice(0, limit);
  const leadsOut = scored.filter(x => !CLIENT_STAGES.has(normalizeStage(x.lead))).slice(0, limit);
  const jumps = q && !digits
    ? NAV.filter(n => !n.soon && !n.phoneOnly && (lower(n.label).includes(needle) || lower(n.id).includes(needle))).slice(0, 4)
    : [];
  const showcases = digits ? [] : clients.slice(0, 3);
  /* Docs (client docs job): by title and by block text, each with its client's name; a title match ranks first. */
  const byId = new Map(leads.map(l => [String(l._id), l]));
  const docHits = q && !digits ? docs.filter(d => matchDoc(d, q)).map(d => {
    const title = lower(d.title); const rank = title.startsWith(needle) ? 0 : title.includes(needle) ? 1 : 2;
    return { doc: d, lead: byId.get(String(d.leadId)) || null, rank, snippet: snippetFor(d, q), type: typeLabel(d.type) };
  }).sort((a, b) => a.rank - b.rank || String(b.doc.updatedAt).localeCompare(String(a.doc.updatedAt))).slice(0, limit) : [];
  return {
    docs: docHits, leads: leadsOut, clients, showcases, jumps, digits, digitsPretty: digits ? (formatPhone(digitsOf(q)) || digitsOf(q)) : '' };
}
