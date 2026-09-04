/* Command bar matching. Digit queries behave exactly like the old reverse
 * phone lookup (last10 + matchRank from src/shared/phone.js, partial trailing
 * digits allowed). Text queries match business, contact name, descriptor,
 * and industry. Nav entries match on label for "Jump to". */
import { digitsOf, matchRank, formatPhone } from '../shared/phone';
import { normalizeStage } from '../shared/semantics';
import { NAV } from './nav';

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
 * @returns {{ leads: Array, clients: Array, jumps: Array, digits: boolean }}
 * leads/clients entries are { lead, rank }.
 */
export function searchAll(query, leads, { limit = 6 } = {}) {
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
    ? NAV.filter(n => !n.soon && (lower(n.label).includes(needle) || lower(n.id).includes(needle))).slice(0, 4)
    : [];
  return { leads: leadsOut, clients, jumps, digits, digitsPretty: digits ? (formatPhone(digitsOf(q)) || digitsOf(q)) : '' };
}
