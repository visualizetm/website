import { useMemo, useState } from 'react';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import { COPY } from '../../shared/copy';
import { IgPost, StatusPill, Segmented, Layer, Sheet, Media, platformNames } from './parts';
import { ChangeSheet } from './Review';
import { AdBody } from './Ads';
import { canPostIt, postItSteps, captionText, timelineOf, hasPrevious, shortDate, statusKey, kindOf } from '../../lib/plannerView';
import { saveMedia } from '../../lib/share';

/* The post page (Planner v2, part 1 F): focused. The status and the date,
 * the first draft beside the new version when Rob answered a change, the
 * post drawn as on Instagram, the words with Copy, the two decisions on a
 * post waiting for them, Post it in 4 taps on an approved post dated today
 * or earlier, and the timeline. */

const longDate = (key) => {
  const [y, m, d] = String(key || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

/** The copy button: the caption and the hashtags, as they will paste. */
function useCopy(toast) {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); toast(COPY.planner.toast.copied); setTimeout(() => setCopied(false), 2400); return true; } catch { toast(COPY.planner.toast.failed); return false; }
  };
  return [copied, copy];
}

/** Where Save the picture lands when the share sheet or the download could not take the file: the picture, big, and the press and hold
 *  that always works on a phone, with the original file behind a link for a computer. */
function HoldSheet({ media, href, item, onClose }) {
  const P = COPY.planner.post;
  return (
    <Sheet title={media.kind === 'video' ? P.holdVideo : P.hold} onClose={onClose} foot={<a className="pl-btn pl-btn--secondary" href={href} target="_blank" rel="noopener noreferrer" download>{P.openFile}</a>}>
      {media.kind === 'video' ? <video className="pl-hold-media" src={media.url} controls playsInline preload="metadata" /> : <Media item={item} />}
    </Sheet>
  );
}

function PostIt({ item, decide, toast, onPosted }) {
  const P = COPY.planner.post;
  const steps = postItSteps(item);
  const [done, setDone] = useState({});
  const [busy, setBusy] = useState('');
  const [hold, setHold] = useState(null);
  const [, copy] = useCopy(toast);
  const tick = (id) => setDone(d => ({ ...d, [id]: true }));
  const media = item.video?.url ? { url: item.video.url, kind: 'video' } : (item.imageUrl || item.video?.poster) ? { url: item.imageUrl || item.video.poster, kind: 'image' } : null;
  const run = async (id) => {
    if (busy) return;
    if (id === 'save') {
      if (!media) return;
      setBusy(id);
      const r = await saveMedia({ url: media.url, kind: media.kind });
      setBusy('');
      if (r.outcome === 'shared') { tick(id); toast(COPY.planner.toast.saved); }
      else if (r.outcome === 'downloaded') { tick(id); toast(COPY.planner.toast.downloaded); }
      else if (r.outcome === 'fallback') { tick(id); setHold({ media, href: r.href }); }
    }
    if (id === 'copy') { if (await copy(captionText(item))) tick(id); }
    if (id === 'posted') {
      setBusy(id);
      const r = await decide(item, 'posted');
      setBusy('');
      if (r === 'ok') { tick(id); toast(P.postedToast); onPosted?.(); }
      else toast(r === 'limit' ? COPY.planner.toast.tooMany : r === 'stale' ? COPY.planner.toast.stale : COPY.planner.toast.failed);
    }
  };
  return (
    <section className="pl-card pl-postit" aria-labelledby="pl-postit-h">
      <h2 className="pl-card-title" id="pl-postit-h">{P.postItTitle}</h2>
      <ol className="pl-steps">
        {steps.map((s, i) => {
          const isDone = !!done[s.id] || (s.id === 'posted' && item.status === 'posted');
          const body = (
            <>
              <span className={`pl-step-n${isDone ? ' is-done' : ''}`} aria-hidden="true">{isDone ? <Check width={16} height={16} /> : i + 1}</span>
              <span className="pl-step-text">
                <span className="pl-step-title">{P.steps[s.id]}{isDone && <span className="v-sr-only">, done</span>}</span>
                <span className="pl-step-help">{s.id === 'save' && !s.available ? P.saveOff : P.stepHelp[s.id]}</span>
              </span>
            </>
          );
          return (
            <li key={s.id} className={`pl-step${isDone ? ' is-done' : ''}`}>
              {s.id === 'open' ? (
                <a className="pl-step-btn" href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" onClick={() => tick('open')}>{body}</a>
              ) : (
                <button type="button" className="pl-step-btn" onClick={() => run(s.id)} disabled={!s.available || !!busy || (s.id === 'posted' && item.status === 'posted')} aria-busy={busy === s.id ? 'true' : undefined}>{body}</button>
              )}
            </li>
          );
        })}
      </ol>
      {hold && <HoldSheet media={hold.media} href={hold.href} item={item} onClose={() => setHold(null)} />}
    </section>
  );
}

function Timeline({ item }) {
  const T = COPY.planner.post.tl;
  const steps = timelineOf(item);
  const text = (s) => (s.id === 'posted' ? T.posted(shortDate(s.at)) : s.id === 'goesUp' ? T.goesUp(shortDate(s.at)) : T[s.id]);
  return (
    <section className="pl-card" aria-labelledby="pl-tl-h">
      <h2 className="pl-h2" id="pl-tl-h">{COPY.planner.post.timeline}</h2>
      <ol className="pl-tl">
        {steps.map(s => <li key={s.id} className={`pl-tl-step${s.done ? ' is-done' : ''}`}><span className="pl-tl-dot" aria-hidden="true" />{text(s)}{s.done && <span className="v-sr-only">, done</span>}</li>)}
      </ol>
    </section>
  );
}

export default function PostPage({ item, client, today, decide, toast }) {
  const C = COPY.planner;
  const P = C.post;
  const [draft, setDraft] = useState('new');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [postedHere, setPostedHere] = useState(false); // the four steps stay on screen, all ticked, after I posted it
  const [copied, copy] = useCopy(toast);
  const words = captionText(item);
  const prev = hasPrevious(item) ? item.previous : null;
  const isAd = kindOf(item) === 'ad';
  const when = useMemo(() => [longDate(kindOf(item) === 'ad' ? (item.ad?.startDate || item.date) : item.date) || P.noDate, item.time, platformNames(item).join(', ')].filter(Boolean).join(' · '), [item, P.noDate]);
  const waiting = item.status === 'review';
  const key = statusKey(item);

  const approve = async () => {
    setBusy(true); setError('');
    const r = await decide(item, 'approve');
    setBusy(false);
    if (r === 'ok') toast(C.toast.approved);
    else if (r === 'stale') toast(C.toast.stale);
    else setError(r === 'limit' ? C.toast.tooMany : C.review.failed);
  };
  const sendChange = async (extra) => {
    const r = await decide(item, 'request-change', extra);
    if (r === 'ok') { setAsking(false); toast(C.toast.changeSent); return true; }
    if (r === 'stale') { setAsking(false); toast(C.toast.stale); return true; }
    return r === 'limit' ? C.toast.tooMany : C.review.failed;
  };

  return (
    <div className="pl-screen pl-postpage">
      <div className="pl-pills">
        <StatusPill item={item} />
        <span className="pl-muted">{when}</span>
      </div>

      {prev && !isAd && (
        <>
          <Segmented label={P.whatChanged} options={[{ id: 'first', label: P.firstDraft }, { id: 'new', label: P.newVersion }]} value={draft} onChange={setDraft} full />
          {prev.note && <p className="pl-card pl-changed"><span className="pl-label">{P.whatChanged}</span>{prev.note}</p>}
        </>
      )}

      {isAd ? <AdBody item={item} /> : <IgPost item={item} client={client} draft={prev && draft === 'first' ? prev : null} />}

      {words && !isAd && !(prev && draft === 'first') && (
        <section className="pl-card" aria-labelledby="pl-words-h">
          <div className="pl-card-head">
            <h2 className="pl-h2" id="pl-words-h">{P.words}</h2>
            <button type="button" className="pl-btn pl-btn--secondary pl-btn--sm pl-copy" onClick={() => copy(words)}>{copied ? <Check width={16} height={16} aria-hidden="true" /> : <Copy01 width={16} height={16} aria-hidden="true" />}{copied ? P.copied : P.copy}</button>
          </div>
          <p className="pl-words">{words}</p>
        </section>
      )}

      {item.note && <p className="pl-card pl-robnote-card"><span className="pl-label">{P.fromRob}</span>{item.note}</p>}
      {item.clientNote && key === 'changes' && <p className="pl-card"><span className="pl-label">{P.yourNote}</span>{item.clientNote}</p>}

      {!waiting && !isAd && !canPostIt(item, today) && !postedHere && P.settled[key] && <p className="pl-muted">{P.settled[key]}</p>}
      {(canPostIt(item, today) || postedHere) && <PostIt item={item} decide={decide} toast={toast} onPosted={() => setPostedHere(true)} />}

      {!isAd && <Timeline item={item} />}

      {error && <p className="pl-review-err" role="alert">{error}</p>}
      {waiting && (
        <Layer>
          <div className="pl-actionbar" role="group" aria-label={C.review.title}>
            <button type="button" className="pl-btn pl-btn--secondary pl-btn--lg pl-ask" onClick={() => setAsking(true)} disabled={busy}>{C.review.change}</button>
            <button type="button" className="pl-btn pl-btn--lg pl-approve" onClick={approve} disabled={busy} aria-busy={busy ? 'true' : undefined}><Check width={18} height={18} aria-hidden="true" />{C.review.approve}</button>
          </div>
        </Layer>
      )}
      {asking && <ChangeSheet onClose={() => setAsking(false)} onSend={sendChange} />}
    </div>
  );
}
