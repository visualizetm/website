import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useParams } from 'react-router-dom';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import { ClientBar, ClientFoot, clientChromeStyles } from '../components/ClientPageChrome';
import { Scene, Reveal } from '../marketing/motion';
import { useHead } from '../marketing/useHead';
import { COPY } from '../shared/copy';
import { safeHref } from '../lib/safeUrl';

/* The client facing concepts presentation (Concepts rebuild, Part 4), at
 * /concepts/:token on the marketing host, dark only, standing alone like the
 * planner: its own slim bar, no navbar, no footer, no third party script.
 *
 * The token is the whole credential and the endpoint cannot tell an unknown
 * one from a revoked, draft or archived one: all are the same 404, so this
 * page has one dead end and never implies whether a link was ever good.
 *
 * It is built on the Scene engine and nothing else: one intro scene, one
 * pinned scene per direction whose steps are the label, the rationale and
 * each image in turn (earlier images settle into a filmstrip), an unpinned
 * decision beat after each, a compare scene and the feedback section.
 * Reduced motion, or no engine, renders every scene fully revealed and
 * unpinned. ?present=1 is the meeting mode: the same page with the approve
 * and feedback controls hidden. Images are never cropped; every one is
 * contained, and any one opens the viewer with swipe and arrow keys. */

const NAME_KEY = 'vz_concepts_name';
const DRAFT_PREFIX = 'vz_concepts_note';
const NOTE_MAX = 1000;
const letterOf = (i) => String.fromCharCode(65 + i);
const readSS = (k, d = '') => { try { return sessionStorage.getItem(k) ?? d; } catch { return d; } };
const writeSS = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* private mode */ } };
const overlay = (node) => (typeof document === 'undefined' ? node : createPortal(node, document.body));

/* A dialog: labelled, focus trapped, Escape closes. Every layer that means
 * "the screen" is portaled to the body so a transform up the tree never
 * becomes its containing block (the planner's note). */
function useDialog(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const first = ref.current?.querySelector('button, input, textarea, [tabindex="0"]');
    first?.focus?.();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = [...(ref.current?.querySelectorAll('button:not([disabled]), input, textarea, [tabindex="0"]') || [])];
      if (!f.length) return;
      const a = f[0]; const b = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
      else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return ref;
}

/* One image, contained, never cropped. */
function Pic({ item, className = '', sizes }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [item.image]);
  const src = safeHref(item.image);
  if (!src || broken) return <span className={`cp-pic cp-pic--empty ${className}`.trim()} aria-hidden="true">{broken ? 'Image did not load' : ''}</span>;
  return <img className={`cp-pic ${className}`.trim()} src={src} alt={item.caption || ''} loading="lazy" decoding="async" sizes={sizes} onError={() => setBroken(true)} />;
}

/* ── The full screen viewer: swipe on a phone, arrow keys on a desktop ── */
function Viewer({ items, index, onIndex, onClose, label }) {
  const V = COPY.concepts.viewer;
  const ref = useDialog(onClose);
  const touch = useRef(null);
  const item = items[index];
  const go = useCallback((by) => onIndex(Math.max(0, Math.min(items.length - 1, index + by))), [index, items.length, onIndex]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);
  return overlay(
    <div className="cp-viewer" role="dialog" aria-modal="true" aria-label={`${label}, image ${index + 1} of ${items.length}`} ref={ref}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const x = touch.current; touch.current = null; if (x == null) return; const dx = e.changedTouches[0].clientX - x; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }}>
      <button type="button" className="cp-viewer-scrim" aria-label={V.close} onClick={onClose} />
      <div className="cp-viewer-stage">
        <Pic item={item} className="cp-viewer-img" />
      </div>
      <div className="cp-viewer-bar">
        <button type="button" className="cp-icon-btn" onClick={() => go(-1)} disabled={index === 0} aria-label={V.prev}><ChevronLeft width={20} height={20} aria-hidden="true" /></button>
        <span className="cp-viewer-cap">{item.caption ? `${item.caption}. ` : ''}{index + 1} of {items.length}</span>
        <button type="button" className="cp-icon-btn" onClick={() => go(1)} disabled={index === items.length - 1} aria-label={V.next}><ChevronRight width={20} height={20} aria-hidden="true" /></button>
      </div>
      <button type="button" className="cp-icon-btn cp-viewer-close" onClick={onClose} aria-label={V.close}><XClose width={20} height={20} aria-hidden="true" /></button>
    </div>
  );
}

/* ── The approve confirm panel ────────────────────────────────────── */
function ApprovePanel({ d, letter, name, onName, busy, onConfirm, onClose }) {
  const A = COPY.concepts.approve;
  const ref = useDialog(onClose);
  const [note, setNote] = useState('');
  const hero = d.items[0];
  return overlay(
    <div className="cp-panel-wrap" role="dialog" aria-modal="true" aria-label={A.heading(letter)} ref={ref}>
      <button type="button" className="cp-viewer-scrim" aria-label={A.cancel} onClick={onClose} />
      <form className="cp-panel" onSubmit={(e) => { e.preventDefault(); onConfirm(note.trim()); }}>
        {hero && <span className="cp-panel-hero"><Pic item={hero} /></span>}
        <h2 className="cp-panel-h display">{A.heading(letter)}</h2>
        <p className="cp-panel-p">{d.name ? `${d.name}. ` : ''}{A.body}</p>
        <label className="cp-field"><span className="cp-label">{A.name}</span><input className="cp-input" value={name} maxLength={80} onChange={(e) => onName(e.target.value)} autoComplete="name" /></label>
        <label className="cp-field"><span className="cp-label">{A.note}</span><textarea className="cp-input" rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} /></label>
        <div className="cp-row">
          <button type="submit" className="cp-btn" disabled={busy}><Check width={16} height={16} aria-hidden="true" />{A.confirm}</button>
          <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose} disabled={busy}>{A.cancel}</button>
        </div>
      </form>
    </div>
  );
}

/* ── The change request panel ─────────────────────────────────────── */
function ChangePanel({ d, letter, token, name, onName, busy, error, onSend, onClose }) {
  const Ch = COPY.concepts.changes;
  const ref = useDialog(onClose);
  const key = `${DRAFT_PREFIX}:${token}:${d.id}`;
  const [note, setNote] = useState(() => readSS(key));
  useEffect(() => { writeSS(key, note); }, [key, note]);
  return overlay(
    <div className="cp-panel-wrap" role="dialog" aria-modal="true" aria-label={Ch.heading(letter)} ref={ref}>
      <button type="button" className="cp-viewer-scrim" aria-label={Ch.cancel} onClick={onClose} />
      <form className="cp-panel" onSubmit={(e) => { e.preventDefault(); onSend(note.trim(), () => { writeSS(key, ''); setNote(''); }); }}>
        <h2 className="cp-panel-h display">{Ch.heading(letter)}</h2>
        <p className="cp-panel-p">{Ch.body}</p>
        <label className="cp-field">
          <span className="cp-label">{Ch.note}</span>
          <textarea className="cp-input" rows={4} maxLength={NOTE_MAX} value={note} required aria-invalid={!!error} aria-describedby={`cp-cnt-${d.id}`} onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} />
          <span className="cp-count" id={`cp-cnt-${d.id}`}>{note.length} of {NOTE_MAX}</span>
        </label>
        <label className="cp-field"><span className="cp-label">{Ch.name}</span><input className="cp-input" value={name} maxLength={80} onChange={(e) => onName(e.target.value)} autoComplete="name" /></label>
        {error && <p className="cp-error" role="alert">{error}</p>}
        <div className="cp-row">
          <button type="submit" className="cp-btn" disabled={busy || !note.trim()}>{Ch.send}</button>
          <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose} disabled={busy}>{Ch.cancel}</button>
        </div>
      </form>
    </div>
  );
}

/* ── One direction: a pinned scene, then its decision beat ─────────── */
function Direction({ d, index, count, present, decided, approved, onApprove, onChange, onView }) {
  const D = COPY.concepts.direction;
  const letter = letterOf(index);
  const items = d.items;
  const steps = items.length + 2;
  const labels = ['Label', 'Why this one', ...items.map((it, k) => it.caption || `Image ${k + 1}`)];
  return (
    <>
      <Scene steps={steps} tone={index % 2 ? 'b' : 'a'} label={`Direction ${letter}`} className={`cp-dir${decided && !approved ? ' is-dim' : ''}`} indicator indicatorLabels={labels} indicatorLabel={`Direction ${letter} steps`}>
        <div className="wrap cp-dir-col">
          <div data-step="1" className="cp-dir-head">
            <p className="cp-eyebrow">{D.label(letter, count)}{approved && <span className="cp-picked"><Check width={14} height={14} aria-hidden="true" />{D.picked}</span>}</p>
            <h2 className="cp-dir-name display">{d.name || `Direction ${letter}`}</h2>
          </div>
          {d.rationale && <p data-step="2" className="cp-rationale">{d.rationale}</p>}
          {items.length > 0 && (
            <div data-step="3" className="cp-show">
              {items.map((it, k) => (
                <div key={it.id} data-step={k + 3} data-reveal="custom" className="cp-item">
                  <button type="button" className="cp-item-btn" onClick={() => onView(k)} aria-label={`${it.caption || `Image ${k + 1}`}, ${D.item(k + 1, items.length)}. Open it full screen.`}>
                    <Pic item={it} className="cp-item-pic" sizes="(min-width: 768px) 60vw, 100vw" />
                  </button>
                  <p className="cp-caption" aria-hidden="true">{it.caption || ''}{items.length > 1 ? <span className="cp-caption-n">{D.item(k + 1, items.length)}</span> : null}</p>
                </div>
              ))}
            </div>
          )}
          {items.length > 1 && (
            <div data-step="4" className="cp-strip" aria-hidden="true">
              {items.slice(0, -1).map((it, k) => (
                <span key={it.id} data-step={k + 4} className="cp-strip-thumb"><Pic item={it} /></span>
              ))}
            </div>
          )}
        </div>
      </Scene>
      {!present && (
        <Scene steps={0} tone={index % 2 ? 'b' : 'a'} label={`Direction ${letter}, your call`} className="cp-beat">
          <div className="wrap cp-beat-row" data-step="1">
            {approved ? (
              <p className="cp-beat-done"><Check width={18} height={18} aria-hidden="true" />{COPY.concepts.approve.done(letter)}</p>
            ) : decided ? null : (
              <>
                <button type="button" className="cp-btn" onClick={() => onApprove(d)}><Check width={16} height={16} aria-hidden="true" />{D.approve}</button>
                <button type="button" className="cp-btn cp-btn--ghost" onClick={() => onChange(d)}><Edit02 width={16} height={16} aria-hidden="true" />{D.change}</button>
              </>
            )}
          </div>
        </Scene>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div className="cp-skel wrap" aria-busy="true" aria-label="Loading your concepts">
      <ClientBar />
      <span className="cp-skel-line cp-skel-line--title" />
      <span className="cp-skel-line" />
      <span className="cp-skel-line cp-skel-line--short" />
    </div>
  );
}

export default function Concepts() {
  const { token = '' } = useParams();
  const { search } = useLocation();
  const present = new URLSearchParams(search).get('present') === '1';
  const C = COPY.concepts;
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [name, setName] = useState(() => readSS(NAME_KEY));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [approving, setApproving] = useState(null);
  const [changing, setChanging] = useState(null);
  const [formError, setFormError] = useState('');
  const [viewer, setViewer] = useState(null); // { dir, index }
  const [note, setNote] = useState(() => readSS(`${DRAFT_PREFIX}:${token}:general`));
  useEffect(() => { writeSS(NAME_KEY, name); }, [name]);
  useEffect(() => { writeSS(`${DRAFT_PREFIX}:${token}:general`, note); }, [token, note]);
  useHead({ title: 'Concepts | Visualize.', description: 'Your directions, ready for a decision.', noindex: true });

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setState(s => (s === 'ready' ? s : 'loading'));
    try {
      const res = await fetch(`/api/concepts?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (res.status === 404) { setState('dead'); return; }
      if (!res.ok) { setState(s => (s === 'ready' ? s : 'error')); return; }
      setData(await res.json());
      setState('ready');
    } catch { setState(s => (s === 'ready' ? s : 'error')); }
  }, [token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  /* One place where every answer the endpoint can give becomes something a
   * person can act on. 404 mid-session is the link revoked while they read. */
  const act = useCallback(async (body) => {
    setBusy(true); setFormError('');
    try {
      const res = await fetch(`/api/concepts?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setBusy(false);
      if (res.ok) return true;
      if (res.status === 404) { setState('dead'); return false; }
      if (res.status === 409) { setToast(C.toast.decided); setApproving(null); setChanging(null); await load({ quiet: true }); return false; }
      if (res.status === 429) { setToast(C.toast.tooMany); return false; }
      if (res.status === 400) { setFormError(C.changes.required); return false; }
      setToast(C.toast.failed); return false;
    } catch { setBusy(false); setToast(C.toast.failed); return false; }
  }, [token, load, C]);

  const directions = data?.directions || [];
  const approvedId = data?.set?.approvedDirectionId || '';
  const decided = data?.set?.status === 'approved' || !!approvedId;
  const client = data?.client?.displayName || '';
  const heading = data?.set?.title || C.intro.heading(client);

  const approve = async (d, extra) => {
    const ok = await act({ action: 'approve', directionId: d.id, note: extra, name });
    if (ok) { setApproving(null); setData(x => ({ ...x, set: { ...x.set, status: 'approved', approvedDirectionId: d.id } })); setToast(C.approve.done(letterOf(directions.indexOf(d)))); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };
  const change = async (d, text, clear) => {
    if (!text) { setFormError(C.changes.required); return; }
    const ok = await act({ action: 'change', directionId: d.id, note: text, name });
    if (ok) { clear(); setChanging(null); setToast(C.changes.sent); setData(x => ({ ...x, set: { ...x.set, status: 'changes' } })); }
  };
  const sendNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    const ok = await act({ action: 'note', directionId: '', note: note.trim(), name });
    if (ok) { setNote(''); setToast(C.feedback.sent); }
  };

  if (state === 'dead') {
    return (
      <section className="cp cp-dead section">
        <div className="wrap cp-narrow">
          <ClientBar label="Concepts" />
          <Reveal as="h1" className="cp-dead-h display">{C.dead.title}</Reveal>
          <Reveal as="p" className="cp-lead" delay={60}>{C.dead.body} <a className="cp-mail" href={`mailto:${C.dead.email}`}>{C.dead.email}</a></Reveal>
          <ClientFoot />
        </div>
        <style>{clientChromeStyles + conceptsStyles}</style>
      </section>
    );
  }
  if (state === 'error') {
    return (
      <section className="cp cp-dead section">
        <div className="wrap cp-narrow">
          <ClientBar label="Concepts" />
          <h1 className="cp-dead-h display">{COPY.planner.error.title}</h1>
          <p className="cp-lead">{COPY.planner.error.body}</p>
          <button type="button" className="cp-btn" onClick={() => load()}>{COPY.planner.error.retry}</button>
          <ClientFoot />
        </div>
        <style>{clientChromeStyles + conceptsStyles}</style>
      </section>
    );
  }
  if (state !== 'ready' || !data) {
    return <section className="cp cp-loading"><Skeleton /><style>{clientChromeStyles + conceptsStyles}</style></section>;
  }

  const approvedIndex = directions.findIndex(d => d.id === approvedId);
  const viewItems = viewer ? directions[viewer.dir]?.items || [] : [];

  return (
    <section className={`cp${present ? ' is-present' : ''}${decided ? ' is-decided' : ''}`}>
      <Scene steps={3} tone="a" label="Introduction" className="cp-intro">
        <div className="wrap cp-intro-grid">
          <div className="cp-intro-col">
            <div data-step="1">
              <ClientBar label={client} />
              <h1 className="cp-h1 display">{heading}</h1>
            </div>
            {data.set.intro && <p data-step="2" className="cp-lead">{data.set.intro}</p>}
            <div data-step="3" className="cp-hint">
              <p className="cp-hint-p">{C.intro.hint}</p>
              {Number(data.set.round) > 1 && <span className="cp-round">{C.intro.round(data.set.round)}</span>}
            </div>
          </div>
          {/* A desktop only deck of each direction's first image, fanned, so
              the intro stage is as full as the directions that follow. */}
          <div data-step="3" className="cp-deck" aria-hidden="true">
            {directions.slice(0, 4).map((d, i) => (
              <span key={d.id} className="cp-deck-card" style={{ '--k': i, '--n': Math.min(4, directions.length) }}>{d.items[0] ? <Pic item={d.items[0]} /> : null}</span>
            ))}
          </div>
        </div>
      </Scene>

      {decided && approvedIndex >= 0 && (
        <Scene steps={0} tone="b" label="Your decision" className="cp-banner">
          <div className="wrap" data-step="1">
            <p className="cp-banner-p"><Check width={18} height={18} aria-hidden="true" />{C.approve.done(letterOf(approvedIndex))}</p>
          </div>
        </Scene>
      )}

      {directions.map((d, i) => (
        <Direction key={d.id} d={d} index={i} count={directions.length} present={present} decided={decided} approved={d.id === approvedId}
          onApprove={setApproving} onChange={setChanging} onView={(k) => setViewer({ dir: i, index: k })} />
      ))}

      {directions.length > 1 && (
        <Scene steps={0} tone="b" label={C.compare.heading} className="cp-compare">
          <div className="wrap">
            <h2 data-step="1" className="cp-h2 display">{C.compare.heading}</h2>
            <p data-step="1" className="cp-lead cp-lead--tight">{C.compare.hint}</p>
            <div className="cp-cards">
              {directions.map((d, i) => (
                <div key={d.id} data-step={i + 2} className={`cp-card${d.id === approvedId ? ' is-picked' : ''}`}>
                  <button type="button" className="cp-card-pic" onClick={() => setViewer({ dir: i, index: 0 })} aria-label={`Direction ${letterOf(i)}${d.name ? `, ${d.name}` : ''}. Open its images.`}>
                    {d.items[0] ? <Pic item={d.items[0]} sizes="(min-width: 768px) 30vw, 100vw" /> : <span className="cp-pic cp-pic--empty" />}
                  </button>
                  <p className="cp-eyebrow">Direction {letterOf(i)}</p>
                  <p className="cp-card-name">{d.name || `Direction ${letterOf(i)}`}</p>
                  {!present && !decided && <button type="button" className="cp-btn cp-btn--sm" onClick={() => setApproving(d)}><Check width={16} height={16} aria-hidden="true" />{C.direction.approve}</button>}
                  {d.id === approvedId && <span className="cp-picked"><Check width={14} height={14} aria-hidden="true" />{C.direction.picked}</span>}
                </div>
              ))}
            </div>
          </div>
        </Scene>
      )}

      {!present && (
        <Scene steps={0} tone="a" label={C.feedback.heading} className="cp-feedback">
          <form className="wrap cp-narrow" data-step="1" onSubmit={sendNote}>
            <h2 className="cp-h2 display">{C.feedback.heading}</h2>
            {decided && <p className="cp-lead cp-lead--tight">{C.feedback.afterApproval}</p>}
            <label className="cp-field"><span className="cp-label">{C.feedback.note}</span><textarea className="cp-input" rows={4} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} /><span className="cp-count">{note.length} of {NOTE_MAX}</span></label>
            <label className="cp-field"><span className="cp-label">{C.feedback.name}</span><input className="cp-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            <div className="cp-row"><button type="submit" className="cp-btn" disabled={busy || !note.trim()}>{C.feedback.send}</button></div>
            <ClientFoot />
          </form>
        </Scene>
      )}
      {present && <div className="wrap"><ClientFoot /></div>}

      {approving && <ApprovePanel d={approving} letter={letterOf(directions.indexOf(approving))} name={name} onName={setName} busy={busy} onConfirm={(extra) => approve(approving, extra)} onClose={() => setApproving(null)} />}
      {changing && <ChangePanel d={changing} letter={letterOf(directions.indexOf(changing))} token={token} name={name} onName={setName} busy={busy} error={formError} onSend={(text, clear) => change(changing, text, clear)} onClose={() => { setChanging(null); setFormError(''); }} />}
      {viewer && viewItems.length > 0 && <Viewer items={viewItems} index={Math.min(viewer.index, viewItems.length - 1)} onIndex={(k) => setViewer(v => ({ ...v, index: k }))} onClose={() => setViewer(null)} label={`Direction ${letterOf(viewer.dir)}`} />}
      {toast && overlay(<p className="cp-toast" role="status">{toast}</p>)}
      <style>{clientChromeStyles + conceptsStyles}</style>
    </section>
  );
}

export const conceptsStyles = `
  .cp { --nav-h: 0px; background: var(--bg); color: var(--text); }
  .cp .cpc-bar { margin-bottom: var(--space-4); }
  .cp-narrow { max-width: 620px; }
  .cp-lead { margin: var(--space-4) 0 0; font-size: clamp(1rem, 2.6vh, 1.375rem); line-height: 1.55; color: var(--text-secondary); max-width: 60ch; }
  .cp-lead--tight { margin-top: var(--space-2); }
  .cp-mail { color: var(--brand-text); font-weight: 600; }
  .cp-dead, .cp-loading { min-height: calc(100 * var(--svh)); padding-top: var(--space-16); }
  .cp-dead-h { font-size: clamp(2.2rem, 6vw, 3.6rem); color: var(--text); }
  .cp-h1 { font-size: clamp(2rem, max(10vw, 8.5vh), 5rem); color: var(--text); overflow-wrap: normal; }
  /* No indicator on the intro, so nothing to keep the block off: centred means centred. */
  .cp-intro .m-scene-body > :last-child { padding-bottom: 0; }
  .cp-intro-grid { display: grid; grid-template-columns: minmax(0, 1fr); }
  .cp-deck { display: none; }
  /* A tablet: the deck under the text, so the tall stage is as full as a
     phone's; a desktop: beside it. */
  @media (min-width: 768px) {
    .cp-intro-grid { gap: var(--space-8); }
    .cp-deck { display: block; position: relative; height: min(40vh, 420px); }
    .cp-deck-card { position: absolute; top: calc(var(--k) * (32% / max(1, var(--n) - 1))); left: calc(var(--k) * (24% / max(1, var(--n) - 1))); width: 76%; height: 68%; padding: var(--space-3); background: var(--surface); border: 1px solid var(--border-light); border-radius: var(--radius-lg); box-shadow: var(--shadow-chrome); transform: rotate(calc((var(--k) - (var(--n) - 1) / 2) * 3deg)); }
  }
  @media (min-width: 1024px) {
    .cp-intro-grid { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: var(--space-10); align-items: center; }
    .cp-deck { height: min(74vh, 620px); }
  }
  .cp-h2 { font-size: clamp(1.9rem, 5vw, 3rem); color: var(--text); }
  .cp-eyebrow { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin: 0; font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brand-text); }
  .cp-intro-col, .cp-dir-col { display: flex; flex-direction: column; gap: clamp(8px, 2vh, 20px); }
  .cp-hint-p { margin: 0; font-size: clamp(0.95rem, 2.4vh, 1.125rem); color: var(--text-secondary); max-width: 44ch; }
  .cp-round { display: inline-block; margin-top: var(--space-2); padding: 4px 10px; border: 1px solid var(--border-light); border-radius: 999px; font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); }
  .cp-banner .m-scene-stage { padding: var(--space-6) 0; }
  .cp-banner-p, .cp-beat-done { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-weight: 700; color: var(--success); }
  .cp-picked { display: inline-flex; align-items: center; gap: 4px; color: var(--success); text-transform: none; letter-spacing: 0; font-size: 0.8125rem; }

  /* A direction: label, name, rationale, the show box, the filmstrip. */
  .cp-dir-name { font-size: clamp(1.6rem, max(6vw, 4vh), 3.2rem); color: var(--text); overflow-wrap: normal; }
  .cp-rationale { margin: 0; font-size: clamp(0.95rem, 2.2vh, 1.0625rem); line-height: 1.5; color: var(--text-secondary); max-width: 60ch; overflow-wrap: anywhere; }
  .cp-show { position: relative; height: clamp(150px, calc(100 * var(--svh) - 400px), 520px); }
  @media (min-width: 768px) { .cp-show { height: clamp(220px, calc(100 * var(--svh) - 360px), 560px); } }
  /* A short phone (500px tall in landscape or an old SE): the rationale
     clamps to three lines and the strip tightens so the stack fits. */
  @media (max-height: 600px) {
    .cp .cp-show { height: clamp(150px, calc(100 * var(--svh) - 350px), 520px); }
    .cp .cp-rationale { font-size: 0.875rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .cp .cp-strip { height: 36px; }
    .cp .cp-strip-thumb { width: 36px; height: 36px; }
    .cp .cp-dir-col { gap: 8px; }
    .cp .cp-dir .m-scene-body > :last-child { padding-bottom: 12px; }
  }
  .cp-item { position: absolute; inset: 0; display: grid; grid-template-rows: minmax(0, 1fr) auto; }
  /* The mount the image sits on, so a landscape image in a tall box is a
     picture on a board rather than a picture over a hole. */
  .cp-item-btn { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-2); }
  /* --nx is the next image's own reveal, so this one fades and shrinks
     toward the strip exactly as the next arrives; the last one has no next
     and holds. Captions swap hard (one is ever visible) so no two lines of
     text sit over each other mid-fade. */
  .m-scene--pinned .cp-item { --nx: clamp(0, calc((var(--scene-p, 0) - var(--step, 1) + 0.35) / 0.35), 1); opacity: calc(var(--sr, 1) * (1 - var(--nx))); transform: translate3d(0, calc((1 - var(--sr, 1)) * 16px), 0) scale(calc(1 - 0.06 * var(--nx))); will-change: opacity, transform; pointer-events: none; }
  .m-scene--pinned .cp-item:last-child { --nx: 0; }
  .m-scene--pinned .cp-item-live { pointer-events: auto; }
  .m-scene--pinned .cp-item .cp-caption { opacity: clamp(0, calc((var(--sr, 1) - 0.5) * 100 * (0.5 - var(--nx)) * 100), 1); }
  /* Not pinned (reduced motion, no engine): every image in the flow, one
     under the other, and no strip because nothing settles into one. */
  .m-scene--flow .cp-show, .m-scene--static .cp-show { height: auto; }
  .m-scene--flow .cp-item, .m-scene--static .cp-item { position: relative; margin-bottom: var(--space-4); }
  .m-scene--flow .cp-strip, .m-scene--static .cp-strip { display: none; }
  .cp-item-btn { position: relative; min-height: 0; display: block; width: 100%; cursor: zoom-in; }
  /* Absolute inside the button: a percentage height never resolves inside a
     <button>, so the image is pinned to the mount's padding box and contained
     by max-width and max-height instead. */
  .m-scene--pinned .cp-item-pic { position: absolute; inset: var(--space-2); width: auto; height: auto; max-width: calc(100% - 2 * var(--space-2)); max-height: calc(100% - 2 * var(--space-2)); margin: auto; }
  .cp-item-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .cp-pic { display: block; width: 100%; height: 100%; object-fit: contain; }
  .cp-item-pic { max-height: 100%; }
  .m-scene--flow .cp-item-btn, .m-scene--static .cp-item-btn { height: clamp(220px, 50vh, 560px); }
  .cp-pic--empty { display: flex; align-items: center; justify-content: center; min-height: 120px; border: 1px dashed var(--border-light); border-radius: var(--radius); color: var(--text-muted); font-size: 0.8125rem; }
  .cp-caption { margin: var(--space-2) 0 0; min-height: 1.4em; font-size: 0.9375rem; color: var(--text-secondary); text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .cp-caption-n { margin-left: var(--space-2); color: var(--text-muted); }
  .cp-strip { display: flex; gap: var(--space-2); justify-content: center; height: 44px; }
  .cp-strip-thumb { display: block; width: 44px; height: 44px; border-radius: 6px; overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--border); }
  .cp-dir.is-dim .cp-dir-head, .cp-dir.is-dim .cp-rationale { opacity: 0.55; }

  /* The decision beat, not pinned. */
  .cp-beat .m-scene-stage { padding: var(--space-6) 0 var(--space-8); }
  .cp-beat-row { display: flex; gap: var(--space-3); flex-wrap: wrap; align-items: center; }
  .cp-compare .m-scene-stage, .cp-feedback .m-scene-stage { padding: var(--space-12) 0; }
  .cp-cards { display: grid; grid-template-columns: 1fr; gap: var(--space-4); margin-top: var(--space-6); }
  @media (min-width: 768px) { .cp-cards { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); } }
  .cp-card { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-card); }
  .cp-card.is-picked { border-color: var(--success); }
  .cp-card-pic { display: block; width: 100%; height: 200px; padding: 0; background: var(--bg-elevated); border: 0; border-radius: var(--radius); cursor: zoom-in; overflow: hidden; }
  .cp-card-pic:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .cp-card-name { margin: 0; font-size: 1.125rem; font-weight: 700; color: var(--text); }

  /* Forms, buttons, panels, the viewer, the toast. */
  .cp-field { display: flex; flex-direction: column; gap: var(--space-1); margin-top: var(--space-4); }
  .cp-label { font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); }
  .cp-input { width: 100%; min-height: 44px; padding: var(--space-3); font: inherit; font-size: 1rem; color: var(--text); background: var(--glass-bg); border: 1px solid var(--border-light); border-radius: var(--radius); resize: vertical; }
  .cp-input:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
  .cp-count { font-size: 0.8125rem; color: var(--text-muted); }
  .cp-error { margin: var(--space-2) 0 0; font-size: 0.875rem; color: var(--brand-text); }
  .cp-row { display: flex; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-5); }
  .cp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 var(--space-5); background: linear-gradient(135deg, rgba(212, 76, 67, 0.85) 0%, rgba(168, 58, 50, 0.85) 100%); color: var(--text); border: 1px solid var(--glass-border-brand); border-radius: var(--radius); font: inherit; font-size: 0.9375rem; font-weight: 700; cursor: pointer; }
  .cp-btn:hover { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%); }
  .cp-btn:focus-visible { outline: 2px solid var(--brand-light); outline-offset: 3px; }
  .cp-btn[disabled] { opacity: 0.6; cursor: default; }
  .cp-btn--ghost { background: var(--glass-bg); border-color: var(--border-light); color: var(--text); }
  .cp-btn--ghost:hover { background: var(--hover-soft); }
  .cp-btn--sm { align-self: flex-start; margin-top: var(--space-2); }
  .cp-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; background: var(--glass-bg-strong); color: var(--text); border: 1px solid var(--border-light); border-radius: var(--radius); cursor: pointer; }
  .cp-icon-btn:hover { background: var(--hover-strong); }
  .cp-icon-btn[disabled] { opacity: 0.4; cursor: default; }
  .cp-icon-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .cp-panel-wrap, .cp-viewer { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; padding: var(--space-4); }
  .cp-viewer-scrim { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.9); border: 0; padding: 0; cursor: pointer; }
  .cp-panel { position: relative; width: min(100%, 520px); max-height: calc(100 * var(--svh) - 2 * var(--space-4)); overflow: auto; padding: var(--space-6); background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-lg); box-shadow: var(--shadow-chrome-strong); }
  .cp-panel-hero { display: block; height: 160px; margin-bottom: var(--space-4); background: var(--bg-elevated); border-radius: var(--radius); overflow: hidden; }
  .cp-panel-h { margin: 0; font-size: clamp(1.6rem, 4vw, 2.2rem); color: var(--text); }
  .cp-panel-p { margin: var(--space-2) 0 0; color: var(--text-secondary); line-height: 1.5; }
  .cp-viewer { flex-direction: column; gap: var(--space-3); }
  .cp-viewer-stage { position: relative; flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
  .cp-viewer-img { max-width: 100%; max-height: 100%; width: auto; height: auto; }
  .cp-viewer-bar { position: relative; display: flex; align-items: center; gap: var(--space-3); width: min(100%, 640px); }
  .cp-viewer-cap { flex: 1 1 auto; text-align: center; font-size: 0.9375rem; color: var(--text-secondary); }
  .cp-viewer-close { position: absolute; top: var(--space-4); right: var(--space-4); }
  .cp-toast { position: fixed; left: 50%; bottom: var(--space-6); transform: translateX(-50%); z-index: 90; margin: 0; max-width: min(92vw, 460px); padding: var(--space-3) var(--space-5); background: var(--chrome-solid); color: var(--text); border: 1px solid var(--border-light); border-radius: var(--radius); font-size: 0.9375rem; box-shadow: var(--shadow-chrome-strong); }
  .cp-skel { display: flex; flex-direction: column; gap: var(--space-4); padding-top: var(--space-4); }
  .cp-skel-line { display: block; height: 20px; width: min(80%, 480px); border-radius: var(--radius); background: var(--glass-bg-strong); }
  .cp-skel-line--title { width: min(70%, 420px); height: 56px; }
  .cp-skel-line--short { width: min(50%, 300px); }
  @media (prefers-reduced-motion: no-preference) { .cp-skel-line { animation: cpPulse 1.6s ease-in-out infinite; } }
  @keyframes cpPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
`;
