import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useParams } from 'react-router-dom';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import { ClientBar, ClientFoot, clientChromeStyles } from '../components/ClientPageChrome';
import { useMotionPreference } from '../marketing/motion/shared';
import { useHead } from '../marketing/useHead';
import { COPY } from '../shared/copy';
import { safeHref } from '../lib/safeUrl';

/* The client facing concepts page, at /concepts/:token on the marketing
 * host, dark only, standing alone like the planner: its own slim bar, no
 * navbar, no footer, no third party script.
 *
 * The token is the whole credential and the endpoint cannot tell an unknown
 * one from a revoked, draft or archived one: all are the same 404, so this
 * page has one dead end and never implies whether a link was ever good.
 *
 * Each direction is one SECTION: its visual, its name and description and
 * its decision panel together in one card. A section reveals as one unit
 * when any part of it enters the view (one short fade and rise, about
 * 240 ms, a small IntersectionObserver here), never piece by piece, never
 * with text or controls arriving after the image; once it is on screen
 * everything in it is visible and usable, and an anchored jump marks its
 * target revealed before it scrolls. Reduced motion: no animation, every
 * section visible from the first paint. There is no pinned scene and no
 * scroll linked reveal on this page.
 *
 * Two modes, set by Rob in the CRM (approvalMode):
 *   pick    Pick one (and every older set): approve one direction or ask for
 *           changes, once, for the whole set.
 *   review  Review each: an answer on every direction that needs one
 *           (Approve, Needs changes with a note, Not this one when allowed),
 *           saved as the client goes, a progress bar fixed at the bottom,
 *           a summary sheet, one Send my answers. After sending, the same
 *           page reads back their answers.
 * ?present=1 is the meeting mode: the same page with every control hidden.
 * Images are never cropped; every one is contained, and any one opens the
 * viewer with swipe and arrow keys. */

const NAME_KEY = 'vz_concepts_name';
const DRAFT_PREFIX = 'vz_concepts_note';
const NOTE_MAX = 1000;
const letterOf = (i) => String.fromCharCode(65 + i);
const readSS = (k, d = '') => { try { return sessionStorage.getItem(k) ?? d; } catch { return d; } };
const writeSS = (k, v) => { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch { /* private mode */ } };
const overlay = (node) => (typeof document === 'undefined' ? node : createPortal(node, document.body));
const R = COPY.concepts.review;

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
      <div className="cp-viewer-stage img-fit img-fit--contain">
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

/* ── Pick one: the approve confirm panel ──────────────────────────── */
function ApprovePanel({ d, letter, name, onName, busy, onConfirm, onClose }) {
  const A = COPY.concepts.approve;
  const ref = useDialog(onClose);
  const [note, setNote] = useState('');
  const hero = d.items[0];
  return overlay(
    <div className="cp-panel-wrap" role="dialog" aria-modal="true" aria-label={A.heading(letter)} ref={ref}>
      <button type="button" className="cp-viewer-scrim" aria-label={A.cancel} onClick={onClose} />
      <form className="cp-panel" onSubmit={(e) => { e.preventDefault(); onConfirm(note.trim()); }}>
        {hero && <span className="cp-panel-hero img-fit img-fit--contain"><Pic item={hero} /></span>}
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

/* ── Pick one: the change request panel ───────────────────────────── */
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

/* ── The whole section reveal ─────────────────────────────────────── */
/* One unit, once: the section is hidden only while NO part of it has been on screen. The first pixel in starts one fade and rise of the
 * whole card; `instant` (an anchored jump) marks it revealed with no transition so it lands whole. Reduced motion, or no
 * IntersectionObserver: always revealed, never hidden, no transition. */
function useUnitReveal(reduced, instant) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (reduced || seen || typeof IntersectionObserver === 'undefined') { setSeen(true); return undefined; }
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, seen]);
  const shown = reduced || seen || instant;
  return [ref, shown, !seen && instant && !reduced];
}

/* ── The chip that says where a section stands ────────────────────── */
function StateChip({ kind }) {
  if (!kind) return null;
  const tone = kind === 'approved' || kind === 'picked' ? 'ok' : kind === 'changes' ? 'warn' : 'quiet';
  return <span className={`cp-chip cp-chip--${tone}`} data-chip={kind}>{kind === 'approved' || kind === 'picked' ? <Check width={14} height={14} aria-hidden="true" /> : kind === 'changes' ? <Edit02 width={14} height={14} aria-hidden="true" /> : null}{kind === 'picked' ? COPY.concepts.direction.picked : R.chip[kind]}</span>;
}

/* ── Review each: the decision panel under one direction ──────────── */
function ReviewPanel({ d, letter, token, allowPass, answer, busy, error, locked, onDecide }) {
  const key = `${DRAFT_PREFIX}:${token}:${d.id}`;
  const status = answer?.status || '';
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(() => (answer?.status === 'changes' ? answer.note : readSS(key)));
  const [local, setLocal] = useState('');
  const taRef = useRef(null);
  useEffect(() => { if (answer?.status === 'changes') setNote(answer.note || ''); }, [answer?.status, answer?.note]);
  useEffect(() => { if (editing) writeSS(key, note); }, [editing, key, note]);
  useEffect(() => { if (editing) taRef.current?.focus(); }, [editing]);

  if (locked) {
    return (
      <div className="cp-rv-panel cp-rv-panel--read">
        {answer ? <><StateChip kind={answer.status} />{answer.note ? <p className="cp-rv-note">{answer.note}</p> : null}</> : null}
      </div>
    );
  }
  const pick = (next) => { setEditing(false); setLocal(''); writeSS(key, ''); if (next !== status || answer?.note) onDecide(d, next, ''); };
  const saveNote = () => {
    if (!note.trim()) { setLocal(R.noteRequired); return; }
    setLocal('');
    onDecide(d, 'changes', note.trim()).then((ok) => { if (ok) { setEditing(false); writeSS(key, ''); } });
  };
  return (
    <div className="cp-rv-panel" role="group" aria-label={R.groupLabel(letter)}>
      <button type="button" className={`cp-btn cp-rv-btn${status === 'approved' ? ' is-on' : ''}`} aria-pressed={status === 'approved'} disabled={busy} onClick={() => pick('approved')}><Check width={16} height={16} aria-hidden="true" />{R.approve}</button>
      <button type="button" className={`cp-btn cp-btn--ghost cp-rv-btn${status === 'changes' ? ' is-on' : ''}`} aria-pressed={status === 'changes'} disabled={busy} onClick={() => { setEditing(true); setLocal(''); }}><Edit02 width={16} height={16} aria-hidden="true" />{R.changes}</button>
      {allowPass && <button type="button" className={`cp-btn cp-btn--ghost cp-rv-btn${status === 'pass' ? ' is-on' : ''}`} aria-pressed={status === 'pass'} disabled={busy} onClick={() => pick('pass')}><XClose width={16} height={16} aria-hidden="true" />{R.pass}</button>}
      {editing ? (
        <div className="cp-rv-editor">
          <label className="cp-field cp-field--flush">
            <span className="cp-label">{R.noteLabel}</span>
            <textarea ref={taRef} className="cp-input" rows={3} maxLength={NOTE_MAX} value={note} placeholder={R.notePlaceholder} aria-invalid={!!local} aria-describedby={`cp-rvc-${d.id}`} onChange={(e) => { setNote(e.target.value.slice(0, NOTE_MAX)); setLocal(''); }} />
            <span className="cp-count" id={`cp-rvc-${d.id}`}>{note.length} of {NOTE_MAX}</span>
          </label>
          {local && <p className="cp-error" role="alert">{local}</p>}
          <div className="cp-row cp-row--tight">
            <button type="button" className="cp-btn cp-rv-save" disabled={busy || !note.trim()} onClick={saveNote}>{R.saveNote}</button>
            <button type="button" className="cp-btn cp-btn--ghost" disabled={busy} onClick={() => { setEditing(false); setNote(answer?.status === 'changes' ? answer.note : ''); setLocal(''); }}>{R.cancel}</button>
          </div>
        </div>
      ) : status === 'changes' ? (
        <div className="cp-rv-saved">
          <p className="cp-rv-note">{answer.note}</p>
          <button type="button" className="cp-link-btn" onClick={() => setEditing(true)}>{R.edit}</button>
        </div>
      ) : null}
      {error && <p className="cp-error" role="alert">{error}</p>}
    </div>
  );
}

/* ── One direction: a section ─────────────────────────────────────── */
function Direction({ d, index, count, mode, token, allowPass, submitted, present, answer, busy, error, instant, pick, onDecide, onApprove, onChange, onView }) {
  const D = COPY.concepts.direction;
  const reduced = useMotionPreference();
  const [ref, shown, jumped] = useUnitReveal(reduced, instant);
  const [k, setK] = useState(0);
  const letter = letterOf(index);
  const items = d.items;
  const cur = items[Math.min(k, Math.max(0, items.length - 1))];
  const review = mode === 'review';
  const reference = review && d.needsDecision === false;
  const chip = review ? (reference ? 'reference' : (answer?.status || '')) : (pick.approved ? 'picked' : '');
  const state = review ? (reference ? 'reference' : answer?.status || 'open') : pick.approved ? 'picked' : pick.decided ? 'dim' : 'open';
  return (
    <section ref={ref} id={`cp-d-${d.id}`} className={`cp-dir cp-sec${shown ? ' is-in' : ''}${jumped ? ' is-instant' : ''}${pick.decided && !pick.approved ? ' is-dim' : ''}`} data-state={state} data-reveal={shown ? 'in' : 'wait'} aria-labelledby={`cp-h-${d.id}`}>
      <div className="wrap cp-sec-wrap">
        <article className="cp-sec-card">
          <div className="cp-sec-top">
            <p className="cp-eyebrow">{D.label(letter, count)}</p>
            <StateChip kind={chip} />
          </div>
          <div className="cp-sec-grid">
            <div className="cp-sec-visual">
              {items.length > 0 ? (
                <>
                  <button type="button" className="cp-main img-fit img-fit--contain" onClick={() => onView(Math.min(k, items.length - 1))} aria-label={`${cur.caption || `Image ${k + 1}`}, ${D.item(k + 1, items.length)}. Open it full screen.`}>
                    <Pic item={cur} className="cp-main-pic" sizes="(min-width: 1024px) 60vw, 100vw" />
                  </button>
                  {(cur.caption || items.length > 1) && <p className="cp-caption">{cur.caption || ''}{items.length > 1 ? <span className="cp-caption-n">{D.item(k + 1, items.length)}</span> : null}</p>}
                  {items.length > 1 && (
                    <ul className="cp-thumbs" aria-label={`${d.name || `Direction ${letter}`} images`}>
                      {items.map((it, n) => (
                        <li key={it.id}>
                          <button type="button" className={`cp-thumb img-fit img-fit--contain${n === k ? ' is-on' : ''}`} aria-pressed={n === k} aria-label={`Show ${it.caption || `image ${n + 1}`}, ${D.item(n + 1, items.length)}`} onClick={() => setK(n)}><Pic item={it} /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : <span className="cp-pic cp-pic--empty" aria-hidden="true" />}
            </div>
            <div className="cp-sec-side">
              <h2 id={`cp-h-${d.id}`} className="cp-dir-name display">{d.name || `Direction ${letter}`}</h2>
              {d.rationale && <p className="cp-rationale">{d.rationale}</p>}
              {!present && review && reference && <p className="cp-ref">{R.reference}</p>}
              {!present && review && !reference && (
                <ReviewPanel d={d} letter={letter} token={token} allowPass={allowPass} answer={answer} busy={busy} error={error} locked={submitted} onDecide={onDecide} />
              )}
              {!present && !review && (
                <div className="cp-beat">
                  {pick.approved ? (
                    <p className="cp-beat-done"><Check width={18} height={18} aria-hidden="true" />{COPY.concepts.approve.done(letter)}</p>
                  ) : pick.decided ? null : (
                    <>
                      <button type="button" className="cp-btn" onClick={() => onApprove(d)}><Check width={16} height={16} aria-hidden="true" />{D.approve}</button>
                      <button type="button" className="cp-btn cp-btn--ghost" onClick={() => onChange(d)}><Edit02 width={16} height={16} aria-hidden="true" />{D.change}</button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </article>
      </div>
    </section>
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

/* ── Review each: the summary sheet before sending ────────────────── */
function SummarySheet({ rows, name, onName, busy, error, onSend, onClose }) {
  const ref = useDialog(onClose);
  return overlay(
    <div className="cp-panel-wrap cp-panel-wrap--sheet" role="dialog" aria-modal="true" aria-label={R.summaryTitle} ref={ref}>
      <button type="button" className="cp-viewer-scrim" aria-label={R.keepLooking} onClick={onClose} />
      <div className="cp-panel cp-summary">
        <h2 className="cp-panel-h display">{R.summaryTitle}</h2>
        <p className="cp-panel-p">{R.summaryBody}</p>
        <ul className="cp-sum-list">
          {rows.map(({ d, i, answer }) => (
            <li key={d.id} className="cp-sum-row">
              <div className="cp-sum-head"><span className="cp-sum-name">{`Direction ${letterOf(i)}${d.name ? `, ${d.name}` : ''}`}</span><StateChip kind={answer.status} /></div>
              {answer.note ? <p className="cp-rv-note">{answer.note}</p> : null}
            </li>
          ))}
        </ul>
        <label className="cp-field"><span className="cp-label">{R.summaryName}</span><input className="cp-input" value={name} maxLength={80} onChange={(e) => onName(e.target.value)} autoComplete="name" /></label>
        {error && <p className="cp-error" role="alert">{error}</p>}
        <div className="cp-row">
          <button type="button" className="cp-btn" disabled={busy} onClick={onSend}><Check width={16} height={16} aria-hidden="true" />{busy ? R.sending : R.send}</button>
          <button type="button" className="cp-btn cp-btn--ghost" onClick={onClose} disabled={busy}>{R.keepLooking}</button>
        </div>
      </div>
    </div>
  );
}

export default function Concepts() {
  const { token = '' } = useParams();
  const { search } = useLocation();
  const present = new URLSearchParams(search).get('present') === '1';
  const reduced = useMotionPreference();
  const C = COPY.concepts;
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);
  const [name, setName] = useState(() => readSS(NAME_KEY));
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState({}); // direction id -> true while its answer saves
  const [errors, setErrors] = useState({}); // direction id -> a message under its panel
  const [toast, setToast] = useState('');
  const [approving, setApproving] = useState(null);
  const [changing, setChanging] = useState(null);
  const [formError, setFormError] = useState('');
  const [viewer, setViewer] = useState(null); // { dir, index }
  const [summary, setSummary] = useState(false);
  const [sendError, setSendError] = useState('');
  const [instant, setInstant] = useState({}); // direction id -> jumped to, so it lands whole
  const [note, setNote] = useState(() => readSS(`${DRAFT_PREFIX}:${token}:general`));
  const barRef = useRef(null);
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

  const directions = useMemo(() => data?.directions || [], [data]);
  const mode = data?.set?.approvalMode === 'review' ? 'review' : 'pick';
  const review = mode === 'review';
  const allowPass = !!data?.set?.allowPass;
  const submitted = review && !!data?.set?.submittedAt;
  const approvedId = data?.set?.approvedDirectionId || '';
  const decided = !review && (data?.set?.status === 'approved' || !!approvedId);
  const client = data?.client?.displayName || '';
  const heading = data?.set?.title || C.intro.heading(client);
  const need = useMemo(() => directions.filter(d => d.needsDecision !== false), [directions]);
  const answered = need.filter(d => d.decision).length;
  const left = need.length - answered;
  const showBar = review && !present && !submitted && state === 'ready';

  /* The bar's height, so the last section never sits under it. */
  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = barRef.current;
    if (!showBar || !el) { root.style.removeProperty('--cp-bar-h'); return undefined; }
    const set = () => root.style.setProperty('--cp-bar-h', `${el.offsetHeight}px`);
    set();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    window.addEventListener('resize', set);
    return () => { ro?.disconnect(); window.removeEventListener('resize', set); root.style.removeProperty('--cp-bar-h'); };
  }, [showBar]);

  /* One place where every answer the endpoint can give becomes something a person can act on. 404 mid-session is the link revoked while they read. */
  const act = useCallback(async (body, { silent = false } = {}) => {
    if (!silent) { setBusy(true); setFormError(''); }
    try {
      const res = await fetch(`/api/concepts?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!silent) setBusy(false);
      if (res.ok) return { ok: true, data: await res.json().catch(() => ({})) };
      if (res.status === 404) { setState('dead'); return { ok: false }; }
      if (res.status === 409) { setToast(C.toast.decided); setApproving(null); setChanging(null); setSummary(false); await load({ quiet: true }); return { ok: false }; }
      if (res.status === 429) { setToast(C.toast.tooMany); return { ok: false }; }
      if (res.status === 400) { const j = await res.json().catch(() => ({})); return { ok: false, bad: true, data: j }; }
      setToast(C.toast.failed); return { ok: false };
    } catch { if (!silent) setBusy(false); setToast(C.toast.failed); return { ok: false }; }
  }, [token, load, C]);

  /* Pick one. */
  const approve = async (d, extra) => {
    const r = await act({ action: 'approve', directionId: d.id, note: extra, name });
    if (r.bad) { setFormError(C.changes.required); return; }
    if (r.ok) { setApproving(null); setData(x => ({ ...x, set: { ...x.set, status: 'approved', approvedDirectionId: d.id } })); setToast(C.approve.done(letterOf(directions.indexOf(d)))); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); }
  };
  const change = async (d, text, clear) => {
    if (!text) { setFormError(C.changes.required); return; }
    const r = await act({ action: 'change', directionId: d.id, note: text, name });
    if (r.bad) { setFormError(C.changes.required); return; }
    if (r.ok) { clear(); setChanging(null); setToast(C.changes.sent); setData(x => ({ ...x, set: { ...x.set, status: 'changes' } })); }
  };
  const sendNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    const r = await act({ action: 'note', directionId: '', note: note.trim(), name });
    if (r.ok) { setNote(''); setToast(C.feedback.sent); }
  };

  /* Review each: an answer saves the moment it is given, and a changed answer overwrites it. */
  const decide = useCallback(async (d, status, text) => {
    setSaving(s => ({ ...s, [d.id]: true })); setErrors(e => ({ ...e, [d.id]: '' }));
    const r = await act({ action: 'decide', directionId: d.id, status, note: text }, { silent: true });
    setSaving(s => ({ ...s, [d.id]: false }));
    if (r.ok) { setData(x => ({ ...x, directions: x.directions.map(y => (y.id === d.id ? { ...y, decision: { status, note: text, decidedAt: new Date().toISOString() } } : y)) })); return true; }
    if (r.bad) setErrors(e => ({ ...e, [d.id]: r.data?.error === 'Say what should change first.' ? R.noteRequired : R.saveFailed }));
    else setErrors(e => ({ ...e, [d.id]: R.saveFailed }));
    return false;
  }, [act]);
  const submit = async () => {
    setBusy(true); setSendError('');
    const r = await act({ action: 'submit', name }, { silent: true });
    setBusy(false);
    if (r.ok) {
      setSummary(false);
      setData(x => ({ ...x, set: { ...x.set, submittedAt: new Date().toISOString(), status: r.data?.status || x.set.status } }));
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    } else if (r.bad) { setSendError(R.sendBlocked(Math.max(1, left))); setSummary(false); await load({ quiet: true }); }
    else if (!r.ok) setSendError(R.saveFailed);
  };

  /* Anchored jumps: the target is marked revealed first, so it lands whole. */
  const jumpTo = useCallback((id) => {
    setInstant(m => ({ ...m, [id]: true }));
    requestAnimationFrame(() => document.getElementById(`cp-d-${id}`)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }));
  }, [reduced]);
  const nextOpen = need.find(d => !d.decision);

  if (state === 'dead') {
    return (
      <section className="cp cp-dead section">
        <div className="wrap cp-narrow">
          <ClientBar label="Concepts" />
          <h1 className="cp-dead-h display">{C.dead.title}</h1>
          <p className="cp-lead">{C.dead.body} <a className="cp-mail" href={`mailto:${C.dead.email}`}>{C.dead.email}</a></p>
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
  const sumRows = need.map((d) => ({ d, i: directions.indexOf(d), answer: d.decision })).filter(r => r.answer);

  return (
    <section className={`cp${present ? ' is-present' : ''}${decided ? ' is-decided' : ''}${review ? ' is-review' : ''}${submitted ? ' is-submitted' : ''}`}>
      <header className="cp-intro">
        <div className="wrap cp-narrow-head">
          <ClientBar label={client} />
          <h1 className="cp-h1 display">{heading}</h1>
          {data.set.intro && <p className="cp-lead">{data.set.intro}</p>}
          <p className="cp-hint-p">{review ? C.intro.review : C.intro.hint}</p>
          {Number(data.set.round) > 1 && <span className="cp-round">{C.intro.round(data.set.round)}</span>}
        </div>
      </header>

      {submitted && (
        <div className="wrap cp-thanks-wrap">
          <p className="cp-thanks" role="status"><Check width={18} height={18} aria-hidden="true" />{R.thanks}</p>
        </div>
      )}
      {decided && approvedIndex >= 0 && (
        <div className="wrap cp-thanks-wrap">
          <p className="cp-thanks" role="status"><Check width={18} height={18} aria-hidden="true" />{C.approve.done(letterOf(approvedIndex))}</p>
        </div>
      )}

      {directions.map((d, i) => (
        <Direction key={d.id} d={d} index={i} count={directions.length} mode={mode} token={token} allowPass={allowPass} submitted={submitted} present={present}
          answer={d.decision || null} busy={!!saving[d.id]} error={errors[d.id] || ''} instant={!!instant[d.id]}
          pick={{ decided, approved: d.id === approvedId }}
          onDecide={decide} onApprove={setApproving} onChange={setChanging} onView={(k) => setViewer({ dir: i, index: k })} />
      ))}

      {!review && directions.length > 1 && (
        <CompareBlock directions={directions} approvedId={approvedId} present={present} decided={decided} onView={(i) => setViewer({ dir: i, index: 0 })} onApprove={setApproving} />
      )}

      {!review && !present && (
        <section className="cp-feedback cp-sec-plain">
          <form className="wrap cp-narrow" onSubmit={sendNote}>
            <h2 className="cp-h2 display">{C.feedback.heading}</h2>
            {decided && <p className="cp-lead cp-lead--tight">{C.feedback.afterApproval}</p>}
            <label className="cp-field"><span className="cp-label">{C.feedback.note}</span><textarea className="cp-input" rows={4} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} /><span className="cp-count">{note.length} of {NOTE_MAX}</span></label>
            <label className="cp-field"><span className="cp-label">{C.feedback.name}</span><input className="cp-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
            <div className="cp-row"><button type="submit" className="cp-btn" disabled={busy || !note.trim()}>{C.feedback.send}</button></div>
          </form>
        </section>
      )}

      <div className="wrap cp-end"><ClientFoot /></div>

      {showBar && (
        <div className="cp-bar" ref={barRef} role="region" aria-label="Your progress">
          <div className="wrap cp-bar-row">
            {left > 0 ? (
              <button type="button" className="cp-bar-count" onClick={() => nextOpen && jumpTo(nextOpen.id)} aria-label={`${R.progress(answered, need.length)}. ${R.jump(left)}`}>
                <span className="cp-bar-n">{R.progress(answered, need.length)}</span>
                <span className="cp-bar-meter" aria-hidden="true"><span style={{ width: `${need.length ? (answered / need.length) * 100 : 0}%` }} /></span>
              </button>
            ) : (
              <p className="cp-bar-count cp-bar-count--done"><span className="cp-bar-n">{R.progress(answered, need.length)}</span><span className="cp-bar-meter" aria-hidden="true"><span style={{ width: '100%' }} /></span></p>
            )}
            <button type="button" className="cp-btn cp-bar-send" disabled={left > 0 || !need.length} onClick={() => { setSendError(''); setSummary(true); }}>{R.send}</button>
          </div>
          {sendError && <p className="cp-error cp-bar-error wrap" role="alert">{sendError}</p>}
          <p className="visually-hidden" role="status" aria-live="polite">{R.progress(answered, need.length)}</p>
        </div>
      )}

      {approving && <ApprovePanel d={approving} letter={letterOf(directions.indexOf(approving))} name={name} onName={setName} busy={busy} onConfirm={(extra) => approve(approving, extra)} onClose={() => setApproving(null)} />}
      {changing && <ChangePanel d={changing} letter={letterOf(directions.indexOf(changing))} token={token} name={name} onName={setName} busy={busy} error={formError} onSend={(text, clear) => change(changing, text, clear)} onClose={() => { setChanging(null); setFormError(''); }} />}
      {summary && <SummarySheet rows={sumRows} name={name} onName={setName} busy={busy} error={sendError} onSend={submit} onClose={() => setSummary(false)} />}
      {viewer && viewItems.length > 0 && <Viewer items={viewItems} index={Math.min(viewer.index, viewItems.length - 1)} onIndex={(k) => setViewer(v => ({ ...v, index: k }))} onClose={() => setViewer(null)} label={`Direction ${letterOf(viewer.dir)}`} />}
      {toast && overlay(<p className="cp-toast" role="status">{toast}</p>)}
      <style>{clientChromeStyles + conceptsStyles}</style>
    </section>
  );
}

/* ── Pick one: every direction side by side ───────────────────────── */
function CompareBlock({ directions, approvedId, present, decided, onView, onApprove }) {
  const C = COPY.concepts;
  const reduced = useMotionPreference();
  const [ref, shown] = useUnitReveal(reduced, false);
  return (
    <section ref={ref} className={`cp-compare cp-sec cp-sec-plain${shown ? ' is-in' : ''}`} aria-label={C.compare.heading}>
      <div className="wrap">
        <h2 className="cp-h2 display">{C.compare.heading}</h2>
        <p className="cp-lead cp-lead--tight">{C.compare.hint}</p>
        <div className="cp-cards">
          {directions.map((d, i) => (
            <div key={d.id} className={`cp-card${d.id === approvedId ? ' is-picked' : ''}`}>
              <button type="button" className="cp-card-pic img-fit img-fit--contain" onClick={() => onView(i)} aria-label={`Direction ${letterOf(i)}${d.name ? `, ${d.name}` : ''}. Open its images.`}>
                {d.items[0] ? <Pic item={d.items[0]} sizes="(min-width: 768px) 30vw, 100vw" /> : <span className="cp-pic cp-pic--empty" />}
              </button>
              <p className="cp-eyebrow">Direction {letterOf(i)}</p>
              <p className="cp-card-name">{d.name || `Direction ${letterOf(i)}`}</p>
              {!present && !decided && <button type="button" className="cp-btn cp-btn--sm" onClick={() => onApprove(d)}><Check width={16} height={16} aria-hidden="true" />{C.direction.approve}</button>}
              {d.id === approvedId && <span className="cp-picked"><Check width={14} height={14} aria-hidden="true" />{C.direction.picked}</span>}
            </div>
          ))}
        </div>
      </div>
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
  .cp-h1 { font-size: clamp(2rem, 8vw, 4.5rem); color: var(--text); overflow-wrap: anywhere; }
  .cp-h2 { font-size: clamp(1.9rem, 5vw, 3rem); color: var(--text); }
  .cp-eyebrow { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; margin: 0; font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brand-text); }
  .cp-intro { padding: var(--space-8) 0 var(--space-6); }
  @media (min-width: 768px) { .cp-intro { padding: var(--space-12) 0 var(--space-8); } }
  .cp-narrow-head { max-width: 760px; margin-inline: auto; }
  .cp-narrow-head .cpc-bar { margin-bottom: var(--space-8); }
  .cp-hint-p { margin: var(--space-3) 0 0; font-size: 1.0625rem; color: var(--text-secondary); max-width: 52ch; }
  .cp-round { display: inline-block; margin-top: var(--space-3); padding: 4px 10px; border: 1px solid var(--border-light); border-radius: 999px; font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); }
  .cp-thanks-wrap { margin-bottom: var(--space-4); }
  .cp-thanks { display: flex; align-items: center; gap: var(--space-2); margin: 0; padding: var(--space-4) var(--space-5); border: 1px solid var(--success); border-radius: var(--radius-lg); background: var(--bg-card); font-weight: 700; color: var(--success); }

  /* A section: one card per direction, revealed as one unit. Hidden only until the first pixel of it is on screen; one fade and rise. */
  .cp-sec { padding: var(--space-3) 0; }
  .cp-sec-plain { padding: var(--space-10) 0; }
  .cp-sec[data-reveal='wait'] { opacity: 0; transform: translate3d(0, 12px, 0); }
  .cp-sec.is-in { opacity: 1; transform: none; transition: opacity 240ms var(--ease), transform 240ms var(--ease); }
  .cp-sec.is-instant { transition: none; }
  @media (prefers-reduced-motion: reduce) { .cp-sec, .cp-sec[data-reveal='wait'], .cp-sec.is-in { opacity: 1; transform: none; transition: none; } }
  .cp-sec-wrap { max-width: 1280px; }
  .cp-sec-card { padding: var(--space-4); background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); scroll-margin-top: var(--space-4); }
  @media (min-width: 768px) { .cp-sec-card { padding: var(--space-6); } }
  @media (min-width: 1024px) { .cp-sec-card { padding: var(--space-8); } }
  .cp-sec.is-dim .cp-sec-card { opacity: 0.6; }
  .cp-sec-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-4); min-height: 28px; }
  .cp-sec-grid { display: flex; flex-direction: column; gap: var(--space-5); }
  .cp-sec-visual, .cp-sec-side { min-width: 0; }
  .cp-sec-side { display: flex; flex-direction: column; gap: var(--space-3); }
  @media (min-width: 1024px) {
    .cp-sec-grid { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: var(--space-8); align-items: start; }
    /* The panel stays in view while the picture scrolls, inside its own section only. */
    .cp-sec-side { position: sticky; top: var(--space-6); align-self: start; }
  }
  .cp-dir-name { margin: 0; font-size: clamp(1.6rem, 6vw, 2.6rem); color: var(--text); overflow-wrap: anywhere; }
  .cp-rationale { margin: 0; font-size: 1.0625rem; line-height: 1.55; color: var(--text-secondary); max-width: 60ch; overflow-wrap: anywhere; }
  .cp-ref { margin: 0; padding: var(--space-3); border: 1px dashed var(--border-light); border-radius: var(--radius); font-size: 0.9375rem; color: var(--text-muted); }

  /* The visual: the first image large on a board, the rest as a row of thumbnails under it. Never cropped. */
  /* Every image sits in an .img-fit box (the site's image rule); these overrides keep the boards contained and uncropped. */
  .cp-main.img-fit { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 220px; max-height: min(62vh, 560px); padding: var(--space-2); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); cursor: zoom-in; }
  .cp-main.img-fit > img.cp-main-pic { width: auto; height: auto; max-width: 100%; max-height: calc(min(62vh, 560px) - 2 * var(--space-2) - 2px); object-fit: contain; }
  .cp-main:focus-visible, .cp-thumb:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .cp-pic { display: block; width: 100%; height: 100%; object-fit: contain; }
  .cp-pic--empty { display: flex; align-items: center; justify-content: center; min-height: 120px; border: 1px dashed var(--border-light); border-radius: var(--radius); color: var(--text-muted); font-size: 0.8125rem; }
  .cp-caption { margin: var(--space-2) 0 0; font-size: 0.9375rem; color: var(--text-secondary); text-align: center; overflow-wrap: anywhere; }
  .cp-caption-n { margin-left: var(--space-2); color: var(--text-muted); }
  .cp-thumbs { display: flex; gap: var(--space-2); flex-wrap: wrap; justify-content: center; list-style: none; margin: var(--space-3) 0 0; padding: 0; }
  .cp-thumb.img-fit { display: block; width: 56px; height: 56px; padding: 2px; background: var(--bg-elevated); border: 2px solid var(--border); border-radius: 8px; cursor: pointer; }
  .cp-thumb.img-fit.is-on { border-color: var(--brand); }

  /* The decision panel: full width buttons at least 44px tall. */
  .cp-rv-panel, .cp-beat { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2); }
  .cp-rv-panel--read { gap: var(--space-2); align-items: flex-start; }
  .cp-rv-btn { width: 100%; justify-content: center; }
  .cp-rv-btn.is-on { border-color: var(--brand); box-shadow: inset 0 0 0 1px var(--brand); }
  .cp-btn.cp-rv-btn:not(.cp-btn--ghost).is-on { box-shadow: inset 0 0 0 2px var(--text); }
  .cp-rv-editor { display: flex; flex-direction: column; gap: var(--space-2); }
  .cp-field--flush { margin-top: 0; }
  .cp-row--tight { margin-top: var(--space-2); }
  .cp-rv-saved { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-1); padding: var(--space-3); background: var(--bg-elevated); border-radius: var(--radius); }
  .cp-rv-note { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--text-secondary); overflow-wrap: anywhere; white-space: pre-wrap; }
  .cp-link-btn { min-height: 44px; padding: 0; background: none; border: 0; font: inherit; font-size: 0.9375rem; font-weight: 600; color: var(--brand-text); cursor: pointer; text-decoration: underline; }
  .cp-beat-done { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-weight: 700; color: var(--success); }
  @media (min-width: 768px) { .cp-beat { flex-direction: row; flex-wrap: wrap; } }

  /* The chip that says where a section stands. */
  .cp-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px; border: 1px solid var(--border-light); font-size: 0.8125rem; font-weight: 700; letter-spacing: 0; text-transform: none; color: var(--text-secondary); background: var(--glass-bg); }
  .cp-chip--ok { border-color: var(--success); color: var(--success); }
  .cp-chip--warn { border-color: var(--brand); color: var(--brand-text); }
  .cp-picked { display: inline-flex; align-items: center; gap: 4px; color: var(--success); text-transform: none; letter-spacing: 0; font-size: 0.8125rem; }

  /* The progress bar, fixed to the bottom, safe area aware; the page ends --cp-bar-h above it so nothing sits under it. */
  .cp-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; padding: var(--space-3) 0 calc(var(--space-3) + env(safe-area-inset-bottom)); background: var(--chrome-solid); border-top: 1px solid var(--border-light); }
  .cp-bar-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); max-width: 1280px; }
  .cp-bar-count { flex: 1 1 auto; min-width: 0; min-height: 44px; display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 0; margin: 0; background: none; border: 0; font: inherit; color: var(--text); text-align: left; cursor: pointer; }
  .cp-bar-count--done { cursor: default; }
  .cp-bar-n { font-size: 0.9375rem; font-weight: 700; }
  .cp-bar-meter { display: block; height: 4px; border-radius: 999px; background: var(--border-light); overflow: hidden; }
  .cp-bar-meter > span { display: block; height: 100%; background: var(--brand); transition: width 240ms var(--ease); }
  @media (prefers-reduced-motion: reduce) { .cp-bar-meter > span { transition: none; } }
  .cp-bar-count:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .cp-bar-send { flex: 0 0 auto; }
  .cp-bar-error { margin: var(--space-2) auto 0; }
  .cp-end { padding-bottom: calc(var(--cp-bar-h, 0px) + env(safe-area-inset-bottom)); }
  .cp-end .cpc-foot { margin-top: var(--space-10); }
  .cp-summary { max-height: calc(100 * var(--svh) - 2 * var(--space-4)); }
  .cp-sum-list { list-style: none; margin: var(--space-4) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
  .cp-sum-row { padding: var(--space-3); background: var(--bg-elevated); border-radius: var(--radius); }
  .cp-sum-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap; }
  .cp-sum-name { font-weight: 700; color: var(--text); overflow-wrap: anywhere; }
  .cp-sum-row .cp-rv-note { margin-top: var(--space-2); }
  .cp-panel-wrap--sheet { align-items: flex-end; padding: 0; }
  @media (min-width: 768px) { .cp-panel-wrap--sheet { align-items: center; padding: var(--space-4); } }
  .cp-panel-wrap--sheet .cp-panel { width: min(100%, 560px); border-bottom-left-radius: 0; border-bottom-right-radius: 0; padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom)); }
  @media (min-width: 768px) { .cp-panel-wrap--sheet .cp-panel { border-radius: var(--radius-lg); } }

  /* Pick one: every direction side by side. */
  .cp-cards { display: grid; grid-template-columns: 1fr; gap: var(--space-4); margin-top: var(--space-6); }
  @media (min-width: 768px) { .cp-cards { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); } }
  .cp-card { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-card); }
  .cp-card.is-picked { border-color: var(--success); }
  .cp-card-pic.img-fit { display: block; width: 100%; height: 200px; padding: 0; background: var(--bg-elevated); border: 0; border-radius: var(--radius); cursor: zoom-in; }
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
  .cp-panel-hero.img-fit { display: block; height: 160px; margin-bottom: var(--space-4); background: var(--bg-elevated); border-radius: var(--radius); }
  .cp-panel-h { margin: 0; font-size: clamp(1.6rem, 4vw, 2.2rem); color: var(--text); }
  .cp-panel-p { margin: var(--space-2) 0 0; color: var(--text-secondary); line-height: 1.5; }
  .cp-viewer { flex-direction: column; gap: var(--space-3); }
  .cp-viewer-stage.img-fit { position: relative; flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; background: none; }
  .cp-viewer-stage.img-fit > img.cp-viewer-img { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; }
  .cp-viewer-bar { position: relative; display: flex; align-items: center; gap: var(--space-3); width: min(100%, 640px); }
  .cp-viewer-cap { flex: 1 1 auto; text-align: center; font-size: 0.9375rem; color: var(--text-secondary); }
  .cp-viewer-close { position: absolute; top: var(--space-4); right: var(--space-4); }
  .cp-toast { position: fixed; left: 50%; bottom: calc(var(--cp-bar-h, 0px) + var(--space-6)); transform: translateX(-50%); z-index: 90; margin: 0; max-width: min(92vw, 460px); padding: var(--space-3) var(--space-5); background: var(--chrome-solid); color: var(--text); border: 1px solid var(--border-light); border-radius: var(--radius); font-size: 0.9375rem; box-shadow: var(--shadow-chrome-strong); }
  .cp-skel { display: flex; flex-direction: column; gap: var(--space-4); padding-top: var(--space-4); }
  .cp-skel-line { display: block; height: 20px; width: min(80%, 480px); border-radius: var(--radius); background: var(--glass-bg-strong); }
  .cp-skel-line--title { width: min(70%, 420px); height: 56px; }
  .cp-skel-line--short { width: min(50%, 300px); }
  @media (prefers-reduced-motion: no-preference) { .cp-skel-line { animation: cpPulse 1.6s ease-in-out infinite; } }
  @keyframes cpPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
`;
