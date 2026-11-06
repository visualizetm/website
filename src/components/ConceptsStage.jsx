import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Edit02 from '@untitled-ui/icons-react/build/esm/Edit02';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import ChevronDown from '@untitled-ui/icons-react/build/esm/ChevronDown';
import ChevronUp from '@untitled-ui/icons-react/build/esm/ChevronUp';
import Minimize01 from '@untitled-ui/icons-react/build/esm/Minimize01';
import { COPY } from '../shared/copy';
import { safeHref } from '../lib/safeUrl';
import { NOTE_MAX, DRAFT_PREFIX, letterOf, readSS, writeSS, overlay, R, useDialog, Pic, StateChip, useQuery } from './conceptsParts';

/* The full screen stage on the client facing concepts page (src/pages/Concepts.jsx): one direction at a time, its picture
 * contained on a near black surface and, beside it (a computer) or under it (a phone), everything needed to answer and move
 * on. It is a controlled view over the page's data: the page owns the answers, the progress numbers (need, answered, left:
 * the one count the bottom bar uses too) and the network; this reads them and calls decide(), onApprove(), onAsk() and onSend().
 *
 * Three layouts, one component and one set of state, so a window that is resized or turned mid answer loses nothing:
 *   wide   900px and up (and tall enough): top bar with the dots, the picture, a right hand panel that scrolls on its own, its footer pinned
 *   phone  under 900px: a slim top bar, the picture, a dock at the bottom (safe area aware, lifted above the keyboard)
 *   rail   any window under 500px tall and wider than tall (a phone on its side): the dock becomes a right hand rail
 * Nothing here animates: no entrance, no transition, so reduced motion has nothing to turn off.
 * Real full screen is asked for by the page, on the document element, from the tap that opens this (see Concepts.jsx);
 * this only hands it back when it closes. */
const FS = COPY.concepts.fullscreen;
const V = COPY.concepts.viewer;
const D = COPY.concepts.direction;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const exitFullscreen = () => { try { if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {}); } catch { /* not in full screen */ } };

export default function ConceptsStage({ directions, dir, index, onNav, onClose, review, present, submitted, allowPass, approvedId, decided, token, need, answered, left, saving, errors, onDecide, onApprove, onAsk, onSend, sendError }) {
  const bigScreen = useQuery('(min-width: 900px)');
  /* A window that is short and wider than tall (a phone on its side, of any width) is the rail: the way on must never fall below the fold. */
  const rail = useQuery('(max-height: 499.98px) and (orientation: landscape)');
  const layout = rail ? 'rail' : bigScreen ? 'wide' : 'phone';
  const wide = layout === 'wide';
  const count = directions.length;
  const di = clamp(dir, 0, count - 1);
  const d = directions[di];
  const items = useMemo(() => d.items || [], [d.items]);
  const idx = clamp(index, 0, Math.max(0, items.length - 1));
  const item = items[idx];
  const letter = letterOf(di);
  const name = d.name || `Direction ${letter}`;
  const reference = review && d.needsDecision === false;
  const answer = d.decision || null;
  const approved = d.id === approvedId;
  const key = `${DRAFT_PREFIX}:${token}:${d.id}`;

  const [about, setAbout] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [local, setLocal] = useState('');
  const [savedFor, setSavedFor] = useState('');
  const taRef = useRef(null);
  const changesRef = useRef(null);
  const savedTimer = useRef(0);
  const savedTimer2 = useRef(0);
  const curId = useRef(d.id); curId.current = d.id;

  /* Close: hand real full screen back, then leave. Escape goes the same way (a first Escape is the browser's own and leaves
     full screen; the second one lands here). */
  const exit = useCallback(() => { exitFullscreen(); onClose(); }, [onClose]);
  const ref = useDialog(exit);

  /* The page behind does not scroll while the stage is open, and gets its own overflow back when it closes or unmounts. */
  useEffect(() => {
    const html = document.documentElement; const body = document.body;
    const before = { h: html.style.overflow, b: body.style.overflow };
    html.style.overflow = 'hidden'; body.style.overflow = 'hidden';
    return () => { html.style.overflow = before.h; body.style.overflow = before.b; exitFullscreen(); };
  }, []);

  /* The current picture loads at once (Pic eager); the next one in this direction is fetched ahead. */
  useEffect(() => {
    const next = items[idx + 1];
    const src = next ? safeHref(next.image) : '';
    if (src) { const im = new Image(); im.src = src; }
  }, [items, idx]);

  /* A phone's keyboard lifts the whole stage, so the dock and the note stay in view. */
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return undefined;
    /* A pinch zoom shrinks the visual viewport too, and is not a keyboard: only an unscaled viewport lifts the stage. */
    const set = () => ref.current?.style.setProperty('--st-kb', vv.scale > 1.01 ? '0px' : `${Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))}px`);
    set();
    vv.addEventListener('resize', set); vv.addEventListener('scroll', set);
    return () => { vv.removeEventListener('resize', set); vv.removeEventListener('scroll', set); };
  }, [ref]);

  /* Another direction: its own about, its own editor. */
  useEffect(() => { setAbout(false); setEditing(false); setLocal(''); }, [d.id]);
  useEffect(() => { if (editing) taRef.current?.focus(); }, [editing]);
  useEffect(() => () => { clearTimeout(savedTimer.current); clearTimeout(savedTimer2.current); }, []);
  /* Saved is cleared for an instant first, so a second save on the same direction is announced again. */
  const flash = (id) => {
    setSavedFor(''); clearTimeout(savedTimer.current); clearTimeout(savedTimer2.current);
    savedTimer.current = setTimeout(() => { setSavedFor(id); savedTimer2.current = setTimeout(() => setSavedFor(''), 4000); }, 60);
  };
  /* The active thumbnail stays in view when the strip scrolls sideways. */
  useEffect(() => { ref.current?.querySelector('.cp-st-thumb.is-on')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [idx, di, ref]);

  const goImage = useCallback((by) => onNav(di, clamp(idx + by, 0, Math.max(0, items.length - 1))), [onNav, di, idx, items.length]);
  const goDir = useCallback((i) => onNav(clamp(i, 0, count - 1), 0), [onNav, count]);
  useEffect(() => {
    const onKey = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || document.querySelector('.cp-panel-wrap')) return; // typing, or a panel open above the stage
      if (e.key === 'ArrowLeft') goImage(-1);
      if (e.key === 'ArrowRight') goImage(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goImage]);

  /* A horizontal swipe on the picture moves between its images (40px, and more across than down). The thumbnails scroll sideways
     themselves, so nothing is attached to them; the chevrons are the visible way. */
  const touch = useRef(null);
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const t = touch.current; touch.current = null;
    if (!t) return;
    const dx = e.changedTouches[0].clientX - t.x; const dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goImage(dx < 0 ? 1 : -1);
  };

  /* Where Next goes: the next direction that still needs an answer, wrapping; with none left, the next one in order. */
  const openIdx = review ? directions.map((x, i) => i).filter(i => directions[i].needsDecision !== false && !directions[i].decision) : [];
  const nextTarget = (() => {
    if (count < 2) return -1;
    for (let s = 1; s <= count; s++) { const i = (di + s) % count; if (i !== di && openIdx.includes(i)) return i; }
    return (di + 1) % count;
  })();
  const canSend = review && !present && !submitted && need.length > 0 && left === 0;
  const nextPrimary = review && !present && !canSend && (!!answer || reference);

  /* Answers: the page's decide() saves at once and updates the data behind; a changed answer overwrites it. The pressed control is never
     disabled while it saves (that would drop keyboard focus); a second press is simply ignored. */
  const busy = !!saving[d.id];
  const refocusChanges = () => requestAnimationFrame(() => changesRef.current?.focus());
  const decide = async (status) => {
    if (busy) return;
    setEditing(false); setLocal(''); writeSS(key, '');
    if (status === answer?.status && !answer?.note) return;
    if (await onDecide(d, status, '')) flash(d.id);
  };
  const startNote = () => { setEditing(true); setLocal(''); setNote(answer?.status === 'changes' ? answer.note || '' : readSS(key)); };
  const typeNote = (v) => { const t = v.slice(0, NOTE_MAX); setNote(t); setLocal(''); writeSS(key, t); }; // the draft is written from the typing, under the key of the direction typed on
  const saveNote = async () => {
    if (busy) return;
    if (!note.trim()) { setLocal(R.noteRequired); return; }
    setLocal('');
    const from = d.id;
    if (await onDecide(d, 'changes', note.trim())) {
      writeSS(key, ''); flash(from);
      if (curId.current === from) { setEditing(false); refocusChanges(); } // the client may have moved on while it saved
    }
  };
  const cancelNote = () => { setEditing(false); setNote(''); writeSS(key, ''); setLocal(''); refocusChanges(); };

  const chipKind = review ? (reference ? 'reference' : answer?.status || '') : (approved ? 'picked' : '');
  const dotState = (x) => (review ? (x.needsDecision === false ? 'reference' : x.decision?.status || 'open') : (x.id === approvedId ? 'picked' : 'open'));
  const dotWord = (s) => (s === 'open' ? FS.open : s === 'picked' ? FS.picked : R.chip[s]);
  const err = local || errors[d.id] || '';

  /* The decision area: the buttons while there is something to answer, otherwise the chip or the line that says why not. */
  const decisions = (
    <div className="cp-st-decisions">
      {!present && review && !submitted && !reference && (
        <div className="cp-st-decide" role="group" aria-label={R.groupLabel(letter)}>
          <button type="button" className={`cp-btn cp-st-btn cp-st-approve${answer?.status === 'approved' ? ' is-on' : ''}`} aria-pressed={answer?.status === 'approved'} aria-disabled={busy || undefined} onClick={() => decide('approved')}><Check width={16} height={16} aria-hidden="true" />{R.approve}</button>
          <button type="button" ref={changesRef} className={`cp-btn cp-btn--ghost cp-st-btn cp-st-changes${answer?.status === 'changes' ? ' is-on' : ''}`} aria-pressed={answer?.status === 'changes'} aria-disabled={busy || undefined} onClick={startNote}><Edit02 width={16} height={16} aria-hidden="true" />{R.changes}</button>
          {allowPass && <button type="button" className={`cp-btn cp-btn--ghost cp-st-btn cp-st-pass${answer?.status === 'pass' ? ' is-on' : ''}`} aria-pressed={answer?.status === 'pass'} aria-disabled={busy || undefined} onClick={() => decide('pass')}><XClose width={16} height={16} aria-hidden="true" />{R.pass}</button>}
        </div>
      )}
      {!present && !review && !decided && (
        <div className="cp-st-decide">
          <button type="button" className="cp-btn cp-st-btn cp-st-approve" onClick={() => onApprove(d)}><Check width={16} height={16} aria-hidden="true" />{R.approve}</button>
          <button type="button" className="cp-btn cp-btn--ghost cp-st-btn cp-st-ask" onClick={() => onAsk(d)}><Edit02 width={16} height={16} aria-hidden="true" />{FS.ask}</button>
        </div>
      )}
      {!present && !review && decided && (approved ? <p className="cp-beat-done"><Check width={18} height={18} aria-hidden="true" />{COPY.concepts.approve.done(letter)}</p> : <p className="cp-ref">{FS.decidedOther}</p>)}
      {!present && review && reference && <p className="cp-ref">{R.reference}</p>}
      {!present && review && submitted && !reference && answer && <>{!wide && <StateChip kind={answer.status} />}{answer.note ? <p className="cp-rv-note">{answer.note}</p> : null}</>}
      {!present && review && !submitted && !reference && editing && (
        <div className="cp-rv-editor cp-st-editor">
          <label className="cp-field cp-field--flush">
            <span className="cp-label">{R.noteLabel}</span>
            <textarea ref={taRef} className="cp-input cp-st-note" rows={3} maxLength={NOTE_MAX} value={note} placeholder={R.notePlaceholder} aria-invalid={!!local} aria-describedby={`cp-stc-${d.id}`} onFocus={(e) => e.target.scrollIntoView?.({ block: 'nearest' })} onChange={(e) => typeNote(e.target.value)} />
          </label>
          <span className="cp-count" id={`cp-stc-${d.id}`}>{note.length} of {NOTE_MAX}</span>
          <div className="cp-row cp-row--tight">
            <button type="button" className="cp-btn cp-st-save" aria-disabled={busy || undefined} onClick={saveNote}>{R.saveNote}</button>
            <button type="button" className="cp-btn cp-btn--ghost cp-st-cancel" onClick={cancelNote}>{R.cancel}</button>
          </div>
        </div>
      )}
      {!present && review && !submitted && !reference && !editing && answer?.status === 'changes' && (
        <div className="cp-rv-saved">
          <p className="cp-rv-note">{answer.note}</p>
          <button type="button" className="cp-link-btn" onClick={startNote}>{R.edit}</button>
        </div>
      )}
      {err && <p className="cp-error" role="alert">{err}</p>}
      <p className="cp-st-saved" role="status" aria-live="polite">{savedFor === d.id ? <><Check width={16} height={16} aria-hidden="true" />{FS.saved}</> : ''}</p>
    </div>
  );

  const dots = (
    <ul className="cp-st-dots" aria-label={FS.dots}>
      {directions.map((x, i) => {
        const st = dotState(x);
        return (
          <li key={x.id}>
            <button type="button" className="cp-st-dot" data-dir={i} data-state={st} aria-current={i === di ? 'step' : undefined} aria-label={FS.dot(letterOf(i), dotWord(st))} onClick={() => goDir(i)}><span className="cp-st-dot-i" aria-hidden="true" /></button>
          </li>
        );
      })}
    </ul>
  );

  const meter = review && !present ? (
    <p className="cp-st-meter"><span className="cp-st-meter-n">{R.progress(answered, need.length)}</span><span className="cp-bar-meter" aria-hidden="true"><span style={{ width: `${need.length ? (answered / need.length) * 100 : 0}%` }} /></span></p>
  ) : <span className="cp-st-meter cp-st-meter--none" />;

  const nav = (
    <div className="cp-st-nav">
      <button type="button" className="cp-icon-btn cp-st-prev" onClick={() => goDir(di - 1)} disabled={di === 0} aria-label={FS.prev}><ChevronLeft width={20} height={20} aria-hidden="true" /></button>
      {meter}
      <button type="button" className={`cp-btn cp-st-next${nextPrimary ? '' : ' cp-btn--ghost'}`} onClick={() => goDir(nextTarget)} disabled={nextTarget < 0}>{FS.next}<ChevronRight width={16} height={16} aria-hidden="true" /></button>
    </div>
  );
  const send = canSend ? (
    <>
      {sendError && <p className="cp-error" role="alert">{sendError}</p>}
      <button type="button" className="cp-btn cp-st-send" onClick={onSend}><Check width={16} height={16} aria-hidden="true" />{FS.send}</button>
    </>
  ) : null;

  const media = (
    <div className="cp-st-media">
      <div className="cp-st-stage img-fit img-fit--contain" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {item ? <Pic item={item} className="cp-st-img" eager /> : <span className="cp-pic cp-pic--empty" aria-hidden="true" />}
        {items.length > 1 && (
          <>
            <button type="button" className="cp-icon-btn cp-st-chev cp-st-chev--prev" onClick={() => goImage(-1)} disabled={idx === 0} aria-label={V.prev}><ChevronLeft width={20} height={20} aria-hidden="true" /></button>
            <button type="button" className="cp-icon-btn cp-st-chev cp-st-chev--next" onClick={() => goImage(1)} disabled={idx === items.length - 1} aria-label={V.next}><ChevronRight width={20} height={20} aria-hidden="true" /></button>
          </>
        )}
      </div>
      {(item?.caption || items.length > 1) && <p className="cp-st-cap" aria-live="polite">{item?.caption || ''}{items.length > 1 ? <span className="cp-st-cap-n">{D.item(idx + 1, items.length)}</span> : null}</p>}
      {items.length > 1 && (
        <ul className="cp-st-thumbs" aria-label={FS.images(letter)}>
          {items.map((it, n) => (
            <li key={it.id}><button type="button" className={`cp-st-thumb img-fit img-fit--contain${n === idx ? ' is-on' : ''}`} aria-pressed={n === idx} aria-label={`Show ${it.caption || `image ${n + 1}`}, ${D.item(n + 1, items.length)}`} onClick={() => onNav(di, n)}><Pic item={it} /></button></li>
          ))}
        </ul>
      )}
    </div>
  );

  return overlay(
    <div className="cp-viewer cp-stage" data-layout={layout} role="dialog" aria-modal="true" aria-label={FS.dialog(letter, count, d.name)} ref={ref}>
      <header className="cp-st-top">
        <div className="cp-st-info" aria-live="polite">
          <p className="cp-st-label">{wide ? D.label(letter, count) : FS.short(letter, count)}</p>
          <p className="cp-st-name">{name}</p>
        </div>
        {wide && dots}
        <button type="button" className="cp-btn cp-btn--ghost cp-st-exit" data-autofocus onClick={exit}><Minimize01 width={16} height={16} aria-hidden="true" />{FS.exit}</button>
      </header>
      <div className="cp-st-body">
        {media}
        {wide ? (
          <aside className="cp-st-panel" aria-label={name}>
            <div className="cp-st-main">
              <div className="cp-st-chip"><StateChip kind={present ? '' : chipKind} /></div>
              <h2 className="cp-st-h display">{name}</h2>
              {d.rationale && <p className="cp-rationale">{d.rationale}</p>}
              {decisions}
            </div>
            <div className="cp-st-foot">{send}{nav}</div>
          </aside>
        ) : (
          <aside className="cp-st-panel cp-st-panel--dock" aria-label={name}>
            <div className="cp-st-main">
              {d.rationale && (
                <>
                  <button type="button" className="cp-link-btn cp-st-about-btn" aria-expanded={about} aria-controls="cp-st-about" onClick={() => setAbout(a => !a)}>{FS.about}{about ? <ChevronUp width={16} height={16} aria-hidden="true" /> : <ChevronDown width={16} height={16} aria-hidden="true" />}</button>
                  {about && <p className="cp-rationale cp-st-about" id="cp-st-about" tabIndex={0}>{d.rationale}</p>}
                </>
              )}
              {decisions}
              {!editing && dots}
            </div>
            <div className="cp-st-foot">{send}{nav}</div>
          </aside>
        )}
      </div>
    </div>
  );
}

export const conceptsStageStyles = `
  /* The stage: over the page (z 70, under the panels at 80 and the toast at 90), a near black surface that fills the window. */
  .cp-viewer.cp-stage { position: fixed; inset: auto; top: 0; left: 0; right: 0; height: calc(100 * var(--svh)); z-index: 70; display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 0; padding: env(safe-area-inset-top) 0 var(--st-kb, 0px); background: rgb(5, 5, 5); color: var(--text); overscroll-behavior: contain; }
  .cp-st-top { flex: 0 0 auto; display: flex; align-items: center; gap: var(--space-4); min-height: 52px; padding: 0 var(--space-3); border-bottom: 1px solid var(--border-light); padding-left: max(var(--space-3), env(safe-area-inset-left)); padding-right: max(var(--space-3), env(safe-area-inset-right)); }
  .cp-stage[data-layout='wide'] .cp-st-top { min-height: 56px; padding-inline: var(--space-5); }
  .cp-st-info { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
  .cp-stage[data-layout='phone'] .cp-st-info, .cp-stage[data-layout='rail'] .cp-st-info { flex-direction: row; align-items: baseline; justify-content: flex-start; gap: var(--space-2); }
  .cp-st-label { margin: 0; font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brand-text); white-space: nowrap; }
  .cp-st-name { margin: 0; font-size: 1rem; font-weight: 700; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .cp-st-exit { flex: 0 0 auto; }
  .cp-st-dots { display: flex; align-items: center; justify-content: center; gap: 0; list-style: none; margin: 0; padding: 0; flex: 0 0 auto; }
  .cp-stage[data-layout='wide'] .cp-st-top .cp-st-dots { flex: 1 1 0; }
  .cp-st-dot { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; background: none; border: 0; cursor: pointer; }
  .cp-st-dot-i { display: block; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--text-secondary); background: transparent; }
  .cp-st-dot[data-state='approved'] .cp-st-dot-i, .cp-st-dot[data-state='picked'] .cp-st-dot-i { background: var(--success); border-color: var(--success); }
  .cp-st-dot[data-state='changes'] .cp-st-dot-i { background: var(--brand); border-color: var(--brand); border-radius: 2px; transform: rotate(45deg); }
  .cp-st-dot[data-state='pass'] .cp-st-dot-i { background: transparent; border-color: var(--text-muted); border-width: 5px; }
  .cp-st-dot[data-state='reference'] .cp-st-dot-i { border-style: dashed; }
  .cp-st-dot[aria-current='step'] .cp-st-dot-i { box-shadow: 0 0 0 3px var(--bg), 0 0 0 5px var(--text); }
  .cp-st-dot:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; border-radius: var(--radius); }

  .cp-st-body { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
  .cp-stage[data-layout='wide'] .cp-st-body { display: grid; grid-template-columns: minmax(0, 1fr) clamp(340px, 30vw, 400px); }
  .cp-stage[data-layout='rail'] .cp-st-body { display: grid; grid-template-columns: minmax(0, 1fr) 280px; }
  .cp-st-media { position: relative; flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-3); }
  .cp-stage[data-layout='wide'] .cp-st-media { padding: var(--space-4) var(--space-5); }
  .cp-stage[data-layout='rail'] .cp-st-media { padding-left: max(var(--space-3), env(safe-area-inset-left)); }
  .cp-st-stage.img-fit { position: relative; flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; background: none; touch-action: pan-y; }
  .cp-st-stage.img-fit > img.cp-st-img { width: auto; height: auto; max-width: 100%; max-height: 100%; object-fit: contain; }
  .cp-st-chev { position: absolute; top: 50%; margin-top: -22px; background: rgba(0, 0, 0, 0.6); }
  .cp-st-chev--prev { left: var(--space-1); }
  .cp-st-chev--next { right: var(--space-1); }
  .cp-st-cap { flex: 0 0 auto; margin: 0; text-align: center; font-size: 0.9375rem; color: var(--text-secondary); overflow-wrap: anywhere; }
  .cp-st-cap-n { margin-left: var(--space-2); color: var(--text-muted); }
  .cp-st-thumbs { flex: 0 0 auto; display: flex; gap: var(--space-2); justify-content: flex-start; list-style: none; margin: 0; padding: 2px 0; overflow-x: auto; max-width: 100%; }
  .cp-st-thumbs > li:first-child { margin-left: auto; }
  .cp-st-thumbs > li:last-child { margin-right: auto; }
  .cp-st-thumb.img-fit { display: block; width: 48px; height: 48px; padding: 2px; background: var(--bg-elevated); border: 2px solid var(--border); border-radius: 8px; cursor: pointer; flex: 0 0 auto; }
  .cp-st-thumb.img-fit.is-on { border-color: var(--brand); }
  .cp-st-thumb:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

  /* The panel (a computer), the dock (a phone) and the rail hold the same things: the answer in a part that scrolls on its own, then the way on pinned under it. */
  .cp-st-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border-left: 1px solid var(--border-light); background: var(--bg-card); }
  .cp-st-main { flex: 1 1 auto; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-5); overscroll-behavior: contain; }
  .cp-st-foot { flex: 0 0 auto; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3) var(--space-5) var(--space-4); border-top: 1px solid var(--border-light); }
  .cp-st-h { margin: 0; font-size: clamp(1.6rem, 3vw, 2.2rem); color: var(--text); overflow-wrap: anywhere; }
  .cp-st-chip { min-height: 28px; }
  .cp-st-decisions { display: flex; flex-direction: column; gap: var(--space-2); }
  .cp-st-decide { display: flex; flex-direction: column; gap: var(--space-2); }
  .cp-st-btn { box-sizing: border-box; width: 100%; justify-content: center; }
  .cp-st-btn.is-on { border-color: var(--brand); box-shadow: inset 0 0 0 1px var(--brand); }
  .cp-st-btn.cp-st-approve.is-on { box-shadow: inset 0 0 0 2px var(--text); }
  .cp-stage .cp-btn[aria-disabled='true'] { opacity: 0.6; cursor: default; }
  .cp-st-saved { display: flex; align-items: center; gap: var(--space-1); margin: 0; min-height: 20px; font-size: 0.875rem; font-weight: 700; color: var(--success); }
  .cp-st-nav { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .cp-st-prev { flex: 0 0 44px; }
  .cp-st-meter { flex: 1 0 100%; order: -1; min-width: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; text-align: center; font-size: 0.8125rem; color: var(--text-secondary); }
  .cp-st-meter--none { display: none; }
  .cp-st-meter-n { font-weight: 700; color: var(--text); }
  .cp-stage .cp-bar-meter > span { transition: none; }
  .cp-st-send { width: 100%; }
  .cp-st-next { flex: 1 1 auto; }

  /* A phone: the dock is as tall as its content up to 58 percent of the window, then its part above the pinned way on scrolls. */
  .cp-stage[data-layout='phone'] .cp-st-panel--dock { flex: 0 0 auto; max-height: calc(58 * var(--svh)); border-left: 0; border-top: 1px solid var(--border-light); background: var(--chrome-solid); padding-bottom: env(safe-area-inset-bottom); padding-inline: max(0px, env(safe-area-inset-left)) max(0px, env(safe-area-inset-right)); }
  .cp-stage[data-layout='phone'] .cp-st-main { gap: var(--space-2); padding: var(--space-3); }
  .cp-stage[data-layout='phone'] .cp-st-foot { padding: var(--space-2) var(--space-3) var(--space-3); }
  .cp-stage[data-layout='phone'] .cp-st-decide { flex-direction: row; }
  .cp-stage[data-layout='phone'] .cp-st-decide .cp-st-btn { flex: 1 1 0; min-width: 0; min-height: 48px; padding-inline: var(--space-2); }
  /* A phone on its side: the same, as a right hand rail, its way on pinned at the bottom. */
  .cp-stage[data-layout='rail'] .cp-st-panel--dock { background: var(--chrome-solid); padding-right: env(safe-area-inset-right); padding-bottom: env(safe-area-inset-bottom); }
  .cp-stage[data-layout='rail'] .cp-st-main { gap: var(--space-2); padding: var(--space-3); }
  .cp-stage[data-layout='rail'] .cp-st-foot { padding: var(--space-2) var(--space-3) var(--space-3); }
  .cp-st-about-btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; }
  .cp-st-about { max-height: calc(40 * var(--svh)); overflow-y: auto; }
  .cp-stage[data-layout='phone'] .cp-st-dots, .cp-stage[data-layout='rail'] .cp-st-dots { justify-content: center; flex-wrap: wrap; }
  .cp-stage .cp-input { font-size: 1rem; }

`;
