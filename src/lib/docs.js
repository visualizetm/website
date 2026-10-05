import { apiFetch } from '../shared/api';
import { DOC_TYPES } from '../shared/docBlocks';
import { relativeTime, toMs } from '../shared/dates';

/* Client docs, the client side's pure logic and its API calls (docs job). The block schema and the plain text
 * export are in src/shared/docBlocks.js (mirrored on the server). What a list holds is the doc's meta: title,
 * type, pinned, projectId, the block text for search, the times; the blocks come with one doc only. */
export { DOC_TYPES };
export const typeLabel = (id) => DOC_TYPES.find(t => t.id === id)?.label || 'General';
export const docTime = (d) => toMs(d?.updatedAt) || toMs(d?.createdAt);
export const editedLabel = (d, now = Date.now()) => `Edited ${relativeTime(d?.updatedAt || d?.createdAt, now)}`;

/** One client's docs. */
export const docsOf = (docs, leadId) => (docs || []).filter(d => String(d.leadId) === String(leadId));
/** Pinned first, then the one the sort asks for: 'edited' (default) or 'created', newest first. */
export function sortDocs(list, by = 'edited') {
  const t = (d) => (by === 'created' ? toMs(d.createdAt) : docTime(d));
  return [...(list || [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || t(b) - t(a) || String(a.title).localeCompare(String(b.title)));
}
/** Grouped by type, in the order of DOC_TYPES, empty types left out; each group sorted. */
export function groupByType(list, by = 'edited') {
  return DOC_TYPES.map(t => ({ ...t, docs: sortDocs((list || []).filter(d => (d.type || 'general') === t.id), by) })).filter(g => g.docs.length);
}
/** A doc matches on its title, its type's name or its block text; every word of the query must. */
export function matchDoc(d, q) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = `${d.title || ''} ${typeLabel(d.type)} ${d.text || ''}`.toLowerCase();
  return words.every(w => hay.includes(w));
}
/** The text around a block text match, for a search row; '' when the title carries it. */
export function snippetFor(d, q, span = 48) {
  const text = String(d?.text || ''); const needle = String(q || '').trim().toLowerCase().split(/\s+/)[0];
  if (!needle || String(d?.title || '').toLowerCase().includes(needle)) return '';
  const at = text.toLowerCase().indexOf(needle);
  if (at < 0) return '';
  const from = Math.max(0, at - span); const to = Math.min(text.length, at + needle.length + span);
  return `${from > 0 ? '...' : ''}${text.slice(from, to)}${to < text.length ? '...' : ''}`;
}

/* ── The API (every call is the admin session's, through /api/admin/docs) ── */
const URL = '/api/admin/docs';
export const fetchDocs = (leadId) => apiFetch(leadId ? `${URL}?leadId=${encodeURIComponent(leadId)}` : URL, { fresh: true });
export const fetchDoc = (id) => apiFetch(`${URL}?id=${encodeURIComponent(id)}`, { fresh: true });
export const fetchDeletedDocs = () => apiFetch(`${URL}?deleted=1`, { fresh: true });
export const fetchTemplates = () => apiFetch(`${URL}?templates=1`, { fresh: true });
export const createDoc = (doc) => apiFetch(URL, { method: 'POST', body: doc });
export const patchDoc = (id, set) => apiFetch(URL, { method: 'PATCH', body: { id, set } });
export const removeDoc = (id, opts = {}) => apiFetch(URL, { method: 'DELETE', body: { id, ...(opts.purge ? { purge: true } : {}) } });
export const restoreDoc = (id) => apiFetch(URL, { method: 'PATCH', body: { id, restore: true } });
export const saveTemplatePrefs = (prefs) => apiFetch(URL, { method: 'PATCH', body: { prefs } });
