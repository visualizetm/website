import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../shared/api';
import { dealQuoteOf, quoteBody, newestQuoteFor, blankQuote, isBlankQuote } from './quote';
import { dealOf } from './deal';

/* Quotes at the shell (the Quotes page): the list is loaded once, like the docs, so /quotes, the editor, the
 * record's Quote row and the old builder's path read one list; the saved items (settings.quoteItems) ride with it.
 * The ops are the one place a quote is written from a screen.
 *
 *   save(quote)        the editor's one door: a quote with no id is created (it takes its number then), one with an
 *                      id is patched; when it is attached to a lead its summary goes onto deal.quote through the
 *                      lead's own patch helper, so the record, the price presenter and the next action stay in step.
 *                      Resolves the stored quote, or null when either write failed (autosave tries again).
 *   start({ lead, pkgId })  the quote to open: the lead's newest when it has one, else a new one (a blank draft nobody touched is
 *                      used again before another number is taken)
 *   setStatus(q, s)    Mark sent, accepted, declined, or back to a draft
 *   stamp(id, set)     a field the editor does not own (the email it drafted)
 *   refresh(id)        one quote read again (the read is where a sent email turns the quote sent)
 *   duplicate, remove, saveItems
 * Nothing here sends. */
const QUOTES = '/api/admin/quotes';

export default function useQuotes({ authed, leadOf, onPatchLead }) {
  const [quotes, setQuotes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const leadRef = useRef(leadOf); leadRef.current = leadOf;
  const patchRef = useRef(onPatchLead); patchRef.current = onPatchLead;
  const put = useCallback((item) => setQuotes(qs => (qs.some(q => String(q._id) === String(item._id)) ? qs.map(q => (String(q._id) === String(item._id) ? item : q)) : [item, ...qs])), []);
  const reload = useCallback(async () => {
    const [q, s] = await Promise.all([apiFetch(QUOTES), apiFetch('/api/admin/settings')]);
    if (q.ok) { setQuotes(q.data?.items || []); setError(false); } else setError(true);
    if (s.ok) setItems(Array.isArray(s.data?.quoteItems) ? s.data.quoteItems : []);
    setLoading(false);
  }, []);
  useEffect(() => { if (authed) reload(); }, [authed, reload]);

  /* The summary on the deal: the lead's newest quote is the one the record reads. */
  const mirror = useCallback(async (item, all) => {
    const lead = item.leadId ? leadRef.current?.(item.leadId) : null;
    if (!lead || !patchRef.current) return true;
    const newest = newestQuoteFor(all, item.leadId);
    if (newest && String(newest._id) !== String(item._id)) return true;
    /* A quote with nothing on it yet leaves nothing on the deal. */
    if (!(item.lines || []).length && String(lead.deal?.quote?.quoteId || '') !== String(item._id)) return true;
    return patchRef.current(lead._id, { deal: { ...dealOf(lead), quote: dealQuoteOf(item) } });
  }, []);
  const quotesRef = useRef(quotes); quotesRef.current = quotes;
  const withItem = (item) => (quotesRef.current.some(q => String(q._id) === String(item._id)) ? quotesRef.current.map(q => (String(q._id) === String(item._id) ? item : q)) : [item, ...quotesRef.current]);

  const save = useCallback(async (quote) => {
    const r = quote._id
      ? await apiFetch(QUOTES, { method: 'PATCH', body: { id: String(quote._id), set: quoteBody(quote) } })
      : await apiFetch(QUOTES, { method: 'POST', body: quoteBody(quote) });
    if (!r.ok || !r.data?.item) return null;
    const item = r.data.item;
    const all = withItem(item);
    put(item);
    return (await mirror(item, all)) ? item : null;
  }, [put, mirror]);
  const patch = useCallback(async (id, set) => {
    const r = await apiFetch(QUOTES, { method: 'PATCH', body: { id: String(id), set } });
    if (!r.ok || !r.data?.item) return null;
    const all = withItem(r.data.item);
    put(r.data.item);
    await mirror(r.data.item, all);
    return r.data.item;
  }, [put, mirror]);
  const setStatus = useCallback((quote, status) => patch(quote._id, { status }), [patch]);
  const start = useCallback(async ({ lead = null, pkgId = '' } = {}) => {
    const all = quotesRef.current;
    if (lead) { const q = newestQuoteFor(all, lead._id); if (q) return q; }
    const spare = all.find(isBlankQuote);
    return save({ ...blankQuote(lead, pkgId), ...(spare ? { _id: spare._id } : {}) });
  }, [save]);
  const refresh = useCallback(async (id) => {
    const r = await apiFetch(`${QUOTES}?id=${encodeURIComponent(id)}`);
    if (!r.ok || !r.data?.item) return null;
    const before = quotesRef.current.find(q => String(q._id) === String(id));
    const all = withItem(r.data.item);
    put(r.data.item);
    if (before && before.status !== r.data.item.status) await mirror(r.data.item, all);
    return r.data.item;
  }, [put, mirror]);
  const duplicate = useCallback(async (quote) => {
    const r = await apiFetch(QUOTES, { method: 'POST', body: { from: String(quote._id) } });
    if (!r.ok || !r.data?.item) return null;
    const all = withItem(r.data.item);
    put(r.data.item);
    await mirror(r.data.item, all);
    return r.data.item;
  }, [put, mirror]);
  const remove = useCallback(async (quote) => {
    const r = await apiFetch(`${QUOTES}?id=${encodeURIComponent(quote._id)}`, { method: 'DELETE' });
    if (!r.ok) return false;
    const rest = quotesRef.current.filter(q => String(q._id) !== String(quote._id));
    setQuotes(rest);
    /* The deal's summary follows: the lead's next newest quote, or none. */
    const lead = quote.leadId ? leadRef.current?.(quote.leadId) : null;
    if (lead && patchRef.current && String(lead.deal?.quote?.quoteId || '') === String(quote._id)) {
      const next = newestQuoteFor(rest, quote.leadId);
      await patchRef.current(lead._id, { deal: { ...dealOf(lead), quote: next && (next.lines || []).length ? dealQuoteOf(next) : null } });
    }
    return true;
  }, []);
  const saveItems = useCallback(async (next) => {
    const prev = items;
    setItems(next);
    const r = await apiFetch('/api/admin/settings', { method: 'PATCH', body: { set: { quoteItems: next } } });
    if (!r.ok) { setItems(prev); return false; }
    if (Array.isArray(r.data?.quoteItems)) setItems(r.data.quoteItems);
    return true;
  }, [items]);

  const ops = useMemo(() => ({ save, start, patch, setStatus, refresh, duplicate, remove, saveItems }), [save, start, patch, setStatus, refresh, duplicate, remove, saveItems]);
  return useMemo(() => ({ quotes, items, loading, error, reload, ops }), [quotes, items, loading, error, reload, ops]);
}
