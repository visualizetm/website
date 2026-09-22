/* Concept sets, the pure logic (Concepts rebuild, docs/CONCEPTS-AUDIT.md).
 * A set is what the editor at /leads/:id/concepts builds and what the
 * client opens at /concepts/:token. Nothing here touches the network. */
import { uid } from './projects';

export const SITE = 'https://visualizestudio.org';
export const MAX_DIRECTIONS = 6;
export const MAX_ITEMS = 12;
export const UNANSWERED_MS = 48 * 36e5;

export const letterOf = (i) => String.fromCharCode(65 + Math.max(0, Math.min(25, i)));
export const statusOf = (set) => (set?.archived ? 'archived' : set?.status || 'draft');
export const isLive = (set) => !!set && !set.deleted;

/** Every set for one lead, newest round first. */
export const setsOf = (sets, leadId) => (sets || []).filter(s => isLive(s) && String(s.leadId) === String(leadId))
  .sort((a, b) => (b.round || 0) - (a.round || 0) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
/** The set the record's pill and the meeting card speak for: the newest one that is not archived. */
export const newestSet = (sets, leadId) => setsOf(sets, leadId).find(s => !s.archived) || null;

/* The list's order: what needs Rob first. Changes requested, then viewed
 * and unanswered, then sent, then drafts, then approved, then archived. */
const RANK = { changes: 0, viewed: 1, sent: 2, draft: 3, approved: 4, archived: 5 };
export const rankOf = (set) => RANK[statusOf(set)] ?? 3;
export const sortSets = (sets) => [...(sets || [])].filter(isLive).sort((a, b) => rankOf(a) - rankOf(b) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));

export const directionsOf = (set) => [...(set?.directions || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
export const itemsOf = (d) => [...(d?.items || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
export const itemCount = (set) => directionsOf(set).reduce((n, d) => n + itemsOf(d).length, 0);
export const firstImage = (set) => { for (const d of directionsOf(set)) for (const it of itemsOf(d)) if (it.image) return it.image; return ''; };
export const directionIndex = (set, id) => directionsOf(set).findIndex(d => d.id === id);
/** "Direction B" or "Direction B, Warm serif" when it has a name. */
export function directionLabel(set, id, withName = true) {
  const i = directionIndex(set, id);
  if (i < 0) return 'a direction';
  const d = directionsOf(set)[i];
  return withName && d.name ? `Direction ${letterOf(i)}, ${d.name}` : `Direction ${letterOf(i)}`;
}

/** Why Send to client is disabled, or null when it can go. */
export function sendBlockReason(set) {
  const ds = directionsOf(set);
  if (!ds.length) return 'Add a direction first.';
  if (!ds.some(d => itemsOf(d).some(it => it.image))) return 'Add at least one image to a direction first.';
  return null;
}
export const publicUrl = (set) => (set?.token ? `${SITE}/concepts/${set.token}` : '');

/** The feedback timeline, newest first. */
export const timelineOf = (set) => [...(set?.feedback || [])].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
/** Change requests that arrived after the last time Rob sent or edited. */
export const changeRequests = (set) => timelineOf(set).filter(f => f.action === 'change');

/** A viewed set nobody has answered in 48 hours. */
export const viewedUnanswered = (set, now = Date.now()) => statusOf(set) === 'viewed' && !!set.lastViewedAt && now - new Date(set.lastViewedAt).getTime() > UNANSWERED_MS;
/** The Studio > Concepts badge: changes requested, plus viewed and unanswered past 48 hours. */
export const conceptsBadge = (sets, now = Date.now()) => (sets || []).filter(isLive).filter(s => statusOf(s) === 'changes' || viewedUnanswered(s, now)).length;

/** A fresh empty direction / item as the editor adds them. */
export const blankDirection = (order = 0) => ({ id: uid(), name: '', rationale: '', order, items: [] });
export const blankItem = (image, order = 0, kind = 'other') => ({ id: uid(), kind, image, caption: '', order });
/** The next round: the same directions with new ids, as a draft the client has not seen. */
export function nextRoundOf(set) {
  return {
    leadId: String(set.leadId), title: set.title || '', round: (Number(set.round) || 1) + 1, intro: set.intro || '', projectId: set.projectId || '',
    directions: directionsOf(set).map((d, i) => ({ ...d, id: uid(), order: i, items: itemsOf(d).map((it, k) => ({ ...it, id: uid(), order: k })) })),
  };
}
/** What the editor drafts: the four writable fields and nothing the server owns. */
export function draftOf(set) {
  return {
    title: String(set?.title || ''), intro: String(set?.intro || ''), projectId: String(set?.projectId || ''),
    directions: directionsOf(set).map((d, i) => ({ id: d.id || uid(), name: String(d.name || ''), rationale: String(d.rationale || ''), order: i, items: itemsOf(d).map((it, k) => ({ id: it.id || uid(), kind: it.kind || 'other', image: String(it.image || ''), caption: String(it.caption || ''), order: k })) })),
  };
}
export const sameDraft = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* The notifications feed (Part 6): what a client did on a set within the
 * window. Opened is the last view, picked is the approval, changes is each
 * change request. Each carries the set so the shell can open the editor. */
export function recentConceptActions(sets, { now = Date.now(), windowMs = UNANSWERED_MS } = {}) {
  const out = [];
  for (const s of (sets || []).filter(isLive)) {
    if (s.archived) continue;
    const seen = s.lastViewedAt ? new Date(s.lastViewedAt).getTime() : 0;
    if (seen && now - seen <= windowMs && statusOf(s) === 'viewed') out.push({ kind: 'opened', at: s.lastViewedAt, set: s });
    for (const f of timelineOf(s)) {
      const t = new Date(f.at || 0).getTime();
      if (!t || now - t > windowMs) continue;
      if (f.action === 'approve') out.push({ kind: 'picked', at: f.at, set: s, directionId: f.directionId, name: f.name || '' });
      if (f.action === 'change') out.push({ kind: 'changes', at: f.at, set: s, directionId: f.directionId, name: f.name || '', note: f.note || '' });
    }
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
