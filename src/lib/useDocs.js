import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchDocs, fetchDoc, createDoc, patchDoc, removeDoc, restoreDoc } from './docs';
import { searchTextOf } from '../shared/docBlocks';

/* The docs list at the shell (docs job): meta only (title, type, pinned, the block text for search, the times), loaded once like the
 * other collections so the client page's card, the More page, global search and Recently Deleted's count read one list. The ops are the
 * one place a doc is written from a screen; a created or deleted doc also tells the client record (onLog) so History says so without a
 * refetch. A doc's blocks come with one doc (fetchDoc) and are saved by the editor through ops.patch. */
const metaOf = (d) => { const { blocks, ...rest } = d || {}; return { ...rest, text: rest.text ?? searchTextOf(blocks) }; };

export default function useDocs({ authed, onLog }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const log = useRef(onLog); log.current = onLog;
  const reload = useCallback(async () => {
    const r = await fetchDocs();
    if (r.ok) { setDocs(r.data?.items || []); setError(false); } else setError(true);
    setLoading(false);
  }, []);
  useEffect(() => { if (authed) reload(); }, [authed, reload]);

  const create = useCallback(async (doc) => {
    const r = await createDoc(doc);
    if (!r.ok || !r.data?.item) return null;
    const item = r.data.item;
    if (!item.template) { setDocs(ds => [metaOf(item), ...ds]); log.current?.(item.leadId, { action: 'created', docId: String(item._id), title: item.title }); }
    return item;
  }, []);
  /** Saves and returns { ok, updatedAt }; the list takes the change on success only (the editor keeps its own text on failure). */
  const patch = useCallback(async (id, set) => {
    const r = await patchDoc(id, set);
    if (!r.ok) return { ok: false, status: r.status, error: r.data?.error };
    const { blocks, ...rest } = set;
    setDocs(ds => ds.map(d => (String(d._id) === String(id) ? { ...d, ...rest, ...(blocks ? { text: searchTextOf(blocks), blockCount: blocks.length } : {}), ...(r.data?.updatedAt ? { updatedAt: r.data.updatedAt } : {}) } : d)));
    return { ok: true, updatedAt: r.data?.updatedAt };
  }, []);
  const remove = useCallback(async (doc) => {
    const r = await removeDoc(doc._id);
    if (!r.ok) return false;
    setDocs(ds => ds.filter(d => String(d._id) !== String(doc._id)));
    if (!doc.template) log.current?.(doc.leadId, { action: 'deleted', docId: String(doc._id), title: doc.title });
    return true;
  }, []);
  const restore = useCallback(async (id) => {
    const r = await restoreDoc(id);
    if (r.ok) reload();
    return r.ok;
  }, [reload]);
  /** A copy of a doc with its blocks: "Copy of <title>", not pinned. */
  const duplicate = useCallback(async (doc) => {
    const full = await fetchDoc(doc._id);
    if (!full.ok) return null;
    const src = full.data.item;
    return create({ leadId: src.leadId, type: src.type, projectId: src.projectId || '', title: `Copy of ${src.title}`.slice(0, 160), blocks: src.blocks || [] });
  }, [create]);
  const ops = useMemo(() => ({ create, patch, remove, restore, duplicate, get: fetchDoc }), [create, patch, remove, restore, duplicate]);
  return useMemo(() => ({ docs, loading, error, reload, ops }), [docs, loading, error, reload, ops]);
}
