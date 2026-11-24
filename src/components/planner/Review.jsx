import { useEffect, useMemo, useRef, useState } from 'react';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import { COPY } from '../../shared/copy';
import { IgPost, Layer, Sheet } from './parts';
import { reviewQueue } from '../../lib/plannerView';

/* Review mode (Planner v2, part 1 D): focused, one post at a time in the
 * order of its date. The queue is taken once when Review opens, so a post
 * they just approved does not shuffle the rest. Approve moves on; Ask for a
 * change opens the reason sheet and moves on once it is sent. A failed call
 * keeps the post on screen with the error and a Retry, never skips it. */

export const REASONS = ['photo', 'words', 'date', 'other'];

/** The change sheet: four reasons, an optional note, Cancel and Send to Rob. Sends { reason, note }; a reason alone is enough, and its
 *  words become the note the server keeps (a note is what Rob reads). */
export function ChangeSheet({ onClose, onSend }) {
  const T = COPY.planner.change;
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    if (!reason && !note.trim()) { setError(T.needOne); return; }
    setBusy(true); setError('');
    const r = await onSend({ reason, note: note.trim() || T.reasons[reason] });
    setBusy(false);
    if (r !== true) setError(typeof r === 'string' ? r : COPY.planner.review.failed);
  };
  return (
    <Sheet title={T.title} onClose={onClose} busy={busy} foot={(
      <>
        <button type="button" className="pl-btn pl-btn--secondary" onClick={onClose} disabled={busy}>{T.cancel}</button>
        <button type="button" className="pl-btn pl-send-change" onClick={send} disabled={busy} aria-busy={busy ? 'true' : undefined}>{busy ? T.sending : T.send}</button>
      </>
    )}>
      <div className="pl-chips" role="radiogroup" aria-label={T.title}>
        {REASONS.map(id => (
          <button key={id} type="button" role="radio" aria-checked={reason === id} className={`pl-chip${reason === id ? ' is-on' : ''}`} onClick={() => { setReason(reason === id ? '' : id); setError(''); }}>
            {reason === id && <Check width={14} height={14} aria-hidden="true" />}{T.reasons[id]}
          </button>
        ))}
      </div>
      <div className="pl-field">
        <label className="pl-label" htmlFor="pl-change-note">{T.noteLabel} <span className="pl-opt">{T.optional}</span></label>
        <textarea id="pl-change-note" className="pl-textarea" rows={3} maxLength={500} value={note} placeholder={T.notePlaceholder} onChange={(e) => { setNote(e.target.value.slice(0, 500)); setError(''); }} />
      </div>
      {error && <p className="pl-formerr" role="alert">{error}</p>}
    </Sheet>
  );
}

const failText = (r) => {
  const P = COPY.planner;
  return r === 'limit' ? P.toast.tooMany : P.review.failed;
};

export default function ReviewScreen({ items, client, decide, onDone, onPos }) {
  const R = COPY.planner.review;
  /* The queue, once: the ids in date order at the moment Review opened. */
  const [ids] = useState(() => reviewQueue(items).map(i => i.id));
  const byId = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);
  const [idx, setIdx] = useState(0);
  const [tally, setTally] = useState({ approved: 0, changed: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(null);
  const [asking, setAsking] = useState(false);
  const topRef = useRef(null);
  const done = idx >= ids.length;
  const item = done ? null : byId[ids[idx]];

  useEffect(() => { onPos?.(done ? null : { i: idx + 1, n: ids.length }); }, [idx, done, ids.length, onPos]);
  useEffect(() => () => onPos?.(null), [onPos]);
  useEffect(() => { topRef.current?.focus({ preventScroll: true }); try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch { /* old browsers */ } }, [idx]);

  const next = (what) => { setTally(t => ({ ...t, [what]: t[what] + 1 })); setError(''); setRetry(null); setIdx(i => i + 1); };
  const run = async (action, extra) => {
    setBusy(true); setError('');
    const r = await decide(item, action, extra);
    setBusy(false);
    if (r === 'ok') { next(action === 'approve' ? 'approved' : 'changed'); return true; }
    if (r === 'stale') { setError(''); setRetry(null); setIdx(i => i + 1); return true; } // it is not waiting on them any more: nothing to answer
    setError(failText(r)); setRetry({ action, extra });
    return failText(r);
  };
  const approve = () => run('approve');
  const sendChange = async (extra) => {
    const r = await run('request-change', extra);
    if (r === true) setAsking(false);
    return r;
  };

  if (done) {
    return (
      <div className="pl-screen pl-review-done" ref={topRef} tabIndex={-1}>
        <span className="pl-done-icon"><CheckCircle width={32} height={32} aria-hidden="true" /></span>
        <h2 className="pl-h1">{R.doneTitle}</h2>
        <p className="pl-lead" role="status">{tally.approved || tally.changed ? R.doneLine(tally.approved, tally.changed) : R.doneNone} {R.doneBody}</p>
        <button type="button" className="pl-btn pl-btn--lg pl-back-home" onClick={onDone}>{R.backHome}</button>
      </div>
    );
  }
  if (!item) return null;

  return (
    <div className="pl-screen pl-review" ref={topRef} tabIndex={-1} aria-label={R.of(idx + 1, ids.length)}>
      <ol className="pl-progress" aria-hidden="true">
        {ids.map((id, i) => <li key={id} className={`pl-progress-seg${i < idx ? ' is-done' : i === idx ? ' is-now' : ''}`} />)}
      </ol>
      {item.note && <p className="pl-robnote"><span className="pl-label">{COPY.planner.post.fromRob}</span>{item.note}</p>}
      <IgPost item={item} client={client} />
      {error && (
        <div className="pl-review-err" role="alert">
          <p>{error}</p>
          {retry && <button type="button" className="pl-btn pl-btn--secondary" onClick={() => run(retry.action, retry.extra)} disabled={busy}>{R.retry}</button>}
        </div>
      )}
      <Layer>
        <div className="pl-actionbar" role="region" aria-label={R.title}>
          <button type="button" className="pl-btn pl-btn--secondary pl-btn--lg pl-ask" onClick={() => setAsking(true)} disabled={busy}>{R.change}</button>
          <button type="button" className="pl-btn pl-btn--lg pl-approve" onClick={approve} disabled={busy} aria-busy={busy ? 'true' : undefined}><Check width={18} height={18} aria-hidden="true" />{R.approve}</button>
        </div>
      </Layer>
      {asking && <ChangeSheet onClose={() => setAsking(false)} onSend={sendChange} />}
    </div>
  );
}

export const reviewStyles = `
  .pl-progress { display: flex; gap: var(--v-space-1); list-style: none; margin: 0; padding: 0; }
  .pl-progress-seg { flex: 1; height: 4px; border-radius: var(--v-radius-pill); background: var(--v-surface-3); }
  .pl-progress-seg.is-done { background: var(--v-text); }
  .pl-progress-seg.is-now { background: var(--v-red); }
  .pl-review:focus, .pl-review-done:focus { outline: none; }
  .pl-review .pl-ig { max-width: 480px; width: 100%; margin: 0 auto; }
  .pl-robnote { padding: var(--v-space-3); background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); color: var(--v-text-2); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-review-err { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--v-space-3); padding: var(--v-space-3); border-radius: var(--v-radius-md); background: var(--v-status-danger-soft); color: var(--v-status-danger-text); border: 1px solid color-mix(in srgb, var(--v-status-danger-text) 35%, transparent); font-size: var(--v-text-sm); line-height: var(--v-lh-sm); }
  .pl-actionbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: var(--v-z-sticky); display: flex; gap: var(--v-space-2); justify-content: center; padding: var(--v-space-3) var(--v-gutter-r) calc(var(--v-space-3) + var(--v-inset-bottom)) var(--v-gutter-l); background: var(--v-bar); border-top: 1px solid var(--v-border); }
  .pl-actionbar .pl-btn { flex: 1; max-width: 240px; }
  .pl-review-done { align-items: flex-start; padding-top: var(--v-space-8); }
  .pl-done-icon { color: var(--v-status-booked-text); }
  .pl-opt { text-transform: none; letter-spacing: 0; font-weight: var(--v-weight-regular); color: var(--v-text-3); }
`;
