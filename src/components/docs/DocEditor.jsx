import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Icon, Input, Pill, Sheet, SwipeRow, useMediaQuery, useToast } from '../../ui';
import RichText, { caretOffset, placeCaret } from './RichText';
import useScrollFade from '../record/useScrollFade';
import { BLOCK_TYPES, linkUrl, imageUrl } from '../../shared/docBlocks';
import { cloudinaryEnabled, uploadToCloudinary, ACCEPT_ATTR } from '../../lib/cloudinary';
import { safeHref } from '../../lib/safeUrl';
import { refInfo, refOptions, REF_KIND_LABELS } from '../../lib/docRefs';
import { newBlock, insertAfter, removeBlock, patchBlock, setRuns, moveBlock, moveTo, duplicateBlock, convertBlock, enterAt, backspaceStart, markdownShortcut, numbering, isText, textOf, indexOfBlock } from '../../lib/docEdit';

/* The doc editor's body (docs job, milestone 3): the blocks, the formatting bar, the block menu, the "+" sheet, reorder and delete. The
 * state is the parent's (blocks in, onChange out); the operations are src/lib/docEdit.js, so a key, a menu item and a bar button do the
 * same thing. Text is RichText (contentEditable holding runs, never HTML).
 *
 * On a phone: a slim bar above the keyboard (it follows visualViewport, so it sits on the keyboard on iOS too, and clears the safe area
 * when there is none), 44px targets, a grip on every block that drags to reorder (touch-action none on the grip alone, so the page still
 * scrolls everywhere else) and opens the block menu on a tap, a swipe left on a block that is not being typed in deletes it with Undo. On
 * a computer the bar is a sticky strip and the grip is a hover handle. Doc checklists stay in the doc. */

export const BLOCK_LABELS = { h1: 'Heading', h2: 'Subheading', p: 'Text', ul: 'Bulleted list', ol: 'Numbered list', check: 'Checklist', quote: 'Quote', divider: 'Divider', link: 'Link', image: 'Image', ref: 'Reference' };
const BLOCK_ICONS = { h1: 'Heading01', h2: 'Heading02', p: 'Type01', ul: 'Dotpoints01', ol: 'List', check: 'CheckSquare', quote: 'MessageTextSquare01', divider: 'Minus', link: 'Link01', image: 'Image01', ref: 'LayersThree01' };
const INSERT_ORDER = ['p', 'h1', 'h2', 'ul', 'ol', 'check', 'quote', 'divider', 'link', 'image', 'ref'];
const TEXT_TURN = ['p', 'h1', 'h2', 'ul', 'ol', 'check', 'quote'];
const PLACEHOLDER = { p: 'Write something', h1: 'Heading', h2: 'Subheading', ul: 'List item', ol: 'List item', check: 'To do', quote: 'Quote' };

/** How far the on screen keyboard covers the bottom of the layout viewport (0 when there is none). */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop))));
    update();
    vv.addEventListener('resize', update); vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);
  return inset > 80 ? inset : 0;
}

/* ── One block ───────────────────────────────────────────────────────── */
function ImageBody({ b, readOnly, api }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true);
    const res = await uploadToCloudinary(file);
    setBusy(false);
    if (res.url && imageUrl(res.url)) api.patch(b.id, { url: res.url }); else toast.error(res.error || 'That image could not be added.');
  };
  return (
    <div className="dc-image">
      {b.url ? <span className="img-fit img-fit--16x9 dc-img"><img src={safeHref(b.url)} alt={b.alt || ''} loading="lazy" decoding="async" /></span> : (
        <div className="dc-image-empty">
          {cloudinaryEnabled
            ? <label className={`dc-upload${busy ? ' is-busy' : ''}`}><Icon icon="Upload01" size={18} /><span>{busy ? 'Uploading...' : 'Add an image'}</span><input type="file" accept={ACCEPT_ATTR} onChange={pick} disabled={busy || readOnly} /></label>
            : <p className="dc-hint">Image upload is not set up for this deployment.</p>}
        </div>
      )}
      {b.url && !readOnly && <Input label="Caption" value={b.alt || ''} onChange={(e) => api.patch(b.id, { alt: e.target.value.slice(0, 200) })} placeholder="What it shows" />}
      {b.url && readOnly && b.alt && <p className="dc-hint">{b.alt}</p>}
    </div>
  );
}

function LinkBody({ b, readOnly, api }) {
  const bad = !!b.url && !linkUrl(b.url);
  const norm = () => { const v = String(b.url || '').trim(); if (v && !/^[a-z][a-z0-9+.-]*:/i.test(v) && /^[^\s/]+\.[^\s/]+/.test(v)) api.patch(b.id, { url: `https://${v}` }); };
  if (readOnly) return <p className="dc-linkro">{linkUrl(b.url) ? <a href={safeHref(b.url)} target="_blank" rel="noopener noreferrer">{b.text || b.url}</a> : (b.text || '')}</p>;
  return (
    <div className="dc-link">
      <Input label="Link text" value={b.text || ''} onChange={(e) => api.patch(b.id, { text: e.target.value.slice(0, 200) })} placeholder="What to call it" />
      <Input label="Link" value={b.url || ''} onChange={(e) => api.patch(b.id, { url: e.target.value.slice(0, 500) })} onBlur={norm} placeholder="https://" inputMode="url" autoCapitalize="none" autoCorrect="off" error={bad ? 'Start with http:// or https://' : undefined} data-link-url={b.id} />
      {linkUrl(b.url) && <a className="dc-open" href={safeHref(b.url)} target="_blank" rel="noopener noreferrer"><Icon icon="LinkExternal01" size={14} />Open link</a>}
    </div>
  );
}

function RefBody({ b, ctx, api }) {
  const info = refInfo(b.ref, ctx);
  return (
    <button type="button" className={`dc-ref${info.gone ? ' is-gone' : ''}`} onClick={() => api.openRef(b)} disabled={info.gone} aria-label={`${REF_KIND_LABELS[b.ref.kind]}: ${info.gone ? (b.label || info.label) : info.label}, ${info.status}${info.gone ? '' : '. Open it.'}`}>
      <Icon icon={info.icon} size={18} className="dc-ref-icon" />
      <span className="dc-ref-text"><span className="dc-ref-kind">{REF_KIND_LABELS[b.ref.kind]}</span><span className="dc-ref-label">{info.gone ? (b.label || info.label) : info.label}</span></span>
      <Pill tone={info.tone} label={info.status} size="sm" icon={false} variant="soft" />
    </button>
  );
}

const Block = memo(function Block({ b, n, readOnly, phone, ctx, api, dragging }) {
  const type = b.type;
  const text = isText(b);
  const body = (() => {
    if (text) {
      const rt = <RichText id={b.id} runs={b.runs} readOnly={readOnly} label={BLOCK_LABELS[type]} placeholder={PLACEHOLDER[type]} className={`dc-rt--${type}${type === 'check' && b.checked ? ' is-done' : ''}`}
        onRuns={(r) => api.runs(b.id, r)} onEnter={(at) => api.enter(b.id, at)} onBackspaceStart={() => api.backspace(b.id)} onPasteLines={(l) => api.pasteLines(b.id, l)}
        onFocus={() => api.focus(b.id)} onBlur={() => api.blur(b.id)} onMarkdown={(r) => api.markdown(b.id, r)} />;
      if (type === 'ul') return <div className="dc-li"><span className="dc-mark" aria-hidden="true">{'•'}</span>{rt}</div>;
      if (type === 'ol') return <div className="dc-li"><span className="dc-mark dc-mark--n" aria-hidden="true">{n}.</span>{rt}</div>;
      if (type === 'check') return <div className="dc-li"><button type="button" className="dc-tick" role="checkbox" aria-checked={!!b.checked} aria-label="Done" disabled={readOnly} onClick={() => api.patch(b.id, { checked: !b.checked })}><span className="dc-tick-box">{b.checked && <Icon icon="Check" size={14} />}</span></button>{rt}</div>;
      return rt;
    }
    if (type === 'divider') return <div className="dc-divider" role="separator" tabIndex={readOnly ? -1 : 0} aria-label="Divider. Backspace removes it." onKeyDown={(e) => { if (!readOnly && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); api.remove(b.id); } }}><hr /></div>;
    if (type === 'link') return <LinkBody b={b} readOnly={readOnly} api={api} />;
    if (type === 'image') return <ImageBody b={b} readOnly={readOnly} api={api} />;
    if (type === 'ref') return <RefBody b={b} ctx={ctx} api={api} />;
    return null;
  })();
  return (
    <SwipeRow enabled={phone && !readOnly} gate={(e) => !(e.target.closest?.('.dc-rt') && document.activeElement === e.target.closest('.dc-rt'))}
      left={{ label: 'Delete', icon: 'Trash01', tone: 'danger', onCommit: () => api.remove(b.id, true) }}>
      <div className={`dc-row dc-row--${type}${dragging ? ' is-dragging' : ''}`} data-block-id={b.id} data-type={type}>
        {!readOnly && <button type="button" className="dc-grip" aria-label={`${BLOCK_LABELS[type]} block, actions and reorder`} onPointerDown={(e) => api.gripDown(e, b.id)} onPointerMove={api.gripMove} onPointerUp={api.gripUp} onPointerCancel={api.gripCancel} onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); api.move(b.id, e.key === 'ArrowUp' ? -1 : 1); } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api.menu(b.id); } }}><Icon icon="DotsGrid" size={18} /></button>}
        <div className="dc-body">{body}</div>
      </div>
    </SwipeRow>
  );
});

/* ── The formatting bar ──────────────────────────────────────────────── */
function FormatBar({ visible, phone, inset, focusType, marks, onCmd, onType, onInsert, onDone, readOnly }) {
  const ref = useRef(null);
  useScrollFade(ref);
  if (readOnly) return null;
  const textFocused = TEXT_TURN.includes(focusType);
  const keep = (e) => e.preventDefault();
  const B = ({ id, icon, label, pressed, disabled, onClick }) => (
    <button type="button" className={`dc-fb${pressed ? ' is-on' : ''}`} aria-label={label} aria-pressed={pressed === undefined ? undefined : !!pressed} disabled={disabled} onPointerDown={keep} onMouseDown={keep} onClick={onClick} data-fmt={id}><Icon icon={icon} size={20} /></button>
  );
  return (
    <div className={`dc-bar${phone ? ' is-phone' : ''}${visible ? ' is-on' : ''}${inset > 0 ? ' has-kb' : ''}`} style={phone ? { bottom: inset } : undefined} role="toolbar" aria-label="Formatting" aria-hidden={phone && !visible ? 'true' : undefined} hidden={phone && !visible}>
      <div className="dc-bar-row" ref={ref}>
        <B id="bold" icon="Bold01" label="Bold" pressed={marks.b} disabled={!textFocused} onClick={() => onCmd('bold')} />
        <B id="italic" icon="Italic01" label="Italic" pressed={marks.i} disabled={!textFocused} onClick={() => onCmd('italic')} />
        <B id="link" icon="Link01" label="Link" pressed={marks.a} disabled={!textFocused} onClick={() => onCmd('link')} />
        <span className="dc-bar-sep" aria-hidden="true" />
        <B id="h1" icon="Heading01" label="Heading" pressed={focusType === 'h1'} disabled={!textFocused} onClick={() => onType('h1')} />
        <B id="h2" icon="Heading02" label="Subheading" pressed={focusType === 'h2'} disabled={!textFocused} onClick={() => onType('h2')} />
        <B id="ul" icon="Dotpoints01" label="Bulleted list" pressed={focusType === 'ul'} disabled={!textFocused} onClick={() => onType('ul')} />
        <B id="ol" icon="List" label="Numbered list" pressed={focusType === 'ol'} disabled={!textFocused} onClick={() => onType('ol')} />
        <B id="check" icon="CheckSquare" label="Checklist" pressed={focusType === 'check'} disabled={!textFocused} onClick={() => onType('check')} />
        <B id="quote" icon="MessageTextSquare01" label="Quote" pressed={focusType === 'quote'} disabled={!textFocused} onClick={() => onType('quote')} />
        <span className="dc-bar-sep" aria-hidden="true" />
        <B id="insert" icon="Plus" label="Add a block" onClick={onInsert} />
      </div>
      {phone && <button type="button" className="dc-done" onPointerDown={keep} onMouseDown={keep} onClick={onDone}>Done</button>}
    </div>
  );
}

/* ── Sheets ──────────────────────────────────────────────────────────── */
function InsertSheet({ onPick, onClose }) {
  return (
    <Sheet open onClose={onClose} title="Add a block" label="Add a block" className="dc-sheet">
      <div className="dc-opts" role="group" aria-label="Block types">
        {INSERT_ORDER.map(t => <button key={t} type="button" className="dc-opt" data-opt={t} onClick={() => { onClose(); onPick(t); }}><Icon icon={BLOCK_ICONS[t]} size={20} /><span>{BLOCK_LABELS[t]}</span></button>)}
      </div>
    </Sheet>
  );
}

function BlockSheet({ block, index, count, onTurn, onMove, onDuplicate, onDelete, onClose }) {
  const text = isText(block);
  return (
    <Sheet open onClose={onClose} title={BLOCK_LABELS[block.type]} label={`${BLOCK_LABELS[block.type]} block actions`} className="dc-sheet">
      {text && (
        <div className="dc-turn" role="group" aria-label="Turn into">
          {TEXT_TURN.map(t => <button key={t} type="button" className={`dc-opt dc-opt--sm${block.type === t ? ' is-on' : ''}`} aria-pressed={block.type === t} onClick={() => { onClose(); onTurn(t); }}><Icon icon={BLOCK_ICONS[t]} size={18} /><span>{BLOCK_LABELS[t]}</span></button>)}
        </div>
      )}
      <div className="dc-acts" role="group" aria-label="Block actions">
        <button type="button" className="dc-act" disabled={index === 0} onClick={() => { onClose(); onMove(-1); }}><Icon icon="ArrowUp" size={20} /><span>Move up</span></button>
        <button type="button" className="dc-act" disabled={index === count - 1} onClick={() => { onClose(); onMove(1); }}><Icon icon="ArrowDown" size={20} /><span>Move down</span></button>
        <button type="button" className="dc-act" onClick={() => { onClose(); onDuplicate(); }}><Icon icon="Copy01" size={20} /><span>Duplicate</span></button>
        <button type="button" className="dc-act is-danger" onClick={() => { onClose(); onDelete(); }}><Icon icon="Trash01" size={20} /><span>Delete</span></button>
      </div>
    </Sheet>
  );
}

function RefSheet({ ctx, onPick, onClose }) {
  const groups = useMemo(() => refOptions(ctx), [ctx]);
  return (
    <Sheet open onClose={onClose} title="Reference" description="A live chip for something of theirs. It always shows where that record stands now." label="Add a reference" className="dc-sheet" tall>
      {groups.length === 0 ? <p className="dc-hint">Nothing to point at yet. A concept set, a project, a task, an invoice or a file of theirs shows up here.</p> : groups.map(g => (
        <section key={g.kind} className="dc-refgroup" aria-label={g.label}>
          <p className="dc-refgroup-h">{g.label}</p>
          {g.items.map(it => (
            <button key={`${it.ref.kind}:${it.ref.id}`} type="button" className="dc-refopt" data-ref={`${it.ref.kind}:${it.ref.id}`} onClick={() => { onClose(); onPick(it); }}>
              <Icon icon={it.icon} size={18} /><span className="dc-refopt-label">{it.label}</span><Pill tone={it.tone} label={it.status} size="sm" icon={false} variant="soft" />
            </button>
          ))}
        </section>
      ))}
    </Sheet>
  );
}

function LinkSheet({ collapsed, hasLink, onApply, onRemove, onClose }) {
  const [url, setUrl] = useState('https://');
  const [text, setText] = useState('');
  const clean = (() => { const v = url.trim(); return linkUrl(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`); })();
  const bad = url.trim() !== '' && url.trim() !== 'https://' && !clean;
  return (
    <Sheet open onClose={onClose} title="Link" label="Add a link" className="dc-sheet"
      footer={<div className="dc-linkfoot">{hasLink && <Button variant="ghost" onClick={() => { onClose(); onRemove(); }}>Remove link</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button icon="Check" disabled={!clean || (collapsed && false)} onClick={() => { onClose(); onApply(clean, text.trim()); }} className="dc-link-apply">Add link</Button></div>}>
      <div className="dc-linkform">
        <Input label="Link" value={url} onChange={(e) => setUrl(e.target.value.slice(0, 500))} inputMode="url" autoCapitalize="none" autoCorrect="off" data-autofocus error={bad ? 'Use a link that starts with http:// or https://' : undefined} onKeyDown={(e) => { if (e.key === 'Enter' && clean) { onClose(); onApply(clean, text.trim()); } }} />
        {collapsed && <Input label="Text to show" value={text} onChange={(e) => setText(e.target.value.slice(0, 200))} placeholder="Leave blank to show the link" />}
      </div>
    </Sheet>
  );
}

/* ── The editor ──────────────────────────────────────────────────────── */
export default function DocEditor({ blocks, onChange, readOnly = false, ctx, openRef }) {
  const toast = useToast();
  const phone = useMediaQuery('(max-width: 767px)');
  const inset = useKeyboardInset();
  const rootRef = useRef(null);
  const blocksRef = useRef(blocks); blocksRef.current = blocks;
  const [focusId, setFocusId] = useState(null);
  const [marks, setMarks] = useState({});
  const [sheet, setSheet] = useState(null); // { kind: 'insert' | 'block' | 'ref' | 'link', ... }
  const [drag, setDrag] = useState(null);
  const pending = useRef(null);
  const savedRange = useRef(null);
  const blurTimer = useRef(0);
  const insertAnchor = useRef(null);
  const dragRef = useRef(null);
  const ctxRef = useRef(ctx); ctxRef.current = ctx;

  const commit = useCallback((next, focus) => { if (focus) pending.current = focus; onChange(next); }, [onChange]);
  /* After a change, put the caret where the operation says (the new block, the join). */
  useLayoutEffect(() => {
    const f = pending.current; if (!f) return;
    pending.current = null;
    const el = rootRef.current?.querySelector(`[data-rt="${CSS.escape(f.id)}"]`);
    if (el) placeCaret(el, f.at || 0);
    else if (f.input) rootRef.current?.querySelector(`[data-link-url="${CSS.escape(f.id)}"], .dc-upload input`)?.focus();
  });

  const focusedBlock = blocks.find(b => b.id === focusId) || null;
  /* The bar's pressed marks follow the selection. */
  useEffect(() => {
    const on = () => {
      const a = document.activeElement;
      if (!a || !a.classList?.contains('dc-rt')) { setMarks({}); return; }
      const inLink = (() => { const s = window.getSelection(); let n = s?.anchorNode; while (n && n !== a) { if (n.nodeName === 'A') return true; n = n.parentNode; } return false; })();
      setMarks({ b: document.queryCommandState('bold'), i: document.queryCommandState('italic'), a: inLink });
    };
    document.addEventListener('selectionchange', on);
    return () => document.removeEventListener('selectionchange', on);
  }, []);

  const api = useMemo(() => {
    const cur = () => blocksRef.current;
    return {
      runs: (id, r) => onChange(setRuns(cur(), id, r)),
      patch: (id, set) => onChange(patchBlock(cur(), id, set)),
      enter: (id, at) => { const r = enterAt(cur(), id, at); commit(r.blocks, r.focus); },
      backspace: (id) => { const r = backspaceStart(cur(), id); if (r.blocks !== cur()) commit(r.blocks, r.focus); },
      /* the runs just typed are not in the blocks yet (the state follows this event), so the shortcut reads them from the event */
      markdown: (id, runs) => { const r = markdownShortcut(setRuns(cur(), id, runs), id); if (r) commit(r.blocks, r.focus); },
      pasteLines: (id, lines) => { let next = cur(); let at = id; for (const l of lines) { const nb = newBlock(next.find(b => b.id === id)?.type === 'p' ? 'p' : (next.find(b => b.id === id)?.type || 'p'), { runs: [{ t: l }] }); next = insertAfter(next, at, nb); at = nb.id; } commit(next, { id: at, at: 1e6 }); },
      focus: (id) => { clearTimeout(blurTimer.current); setFocusId(id); },
      blur: (id) => { clearTimeout(blurTimer.current); blurTimer.current = setTimeout(() => setFocusId(f => (f === id && !document.activeElement?.classList?.contains('dc-rt') ? null : f)), 150); },
      remove: (id, withUndo) => {
        const before = cur(); const at = indexOfBlock(before, id); const gone = before[at];
        if (!gone) return;
        const next = removeBlock(before, id);
        const near = next[Math.min(at, next.length - 1)];
        commit(next, near && isText(near) ? { id: near.id, at: 1e6 } : null);
        if (withUndo) toast.undo(`${BLOCK_LABELS[gone.type]} deleted.`, () => onChange(insertAfterIndex(blocksRef.current, at - 1, gone)));
      },
      move: (id, dir) => onChange(moveBlock(cur(), id, dir)),
      menu: (id) => setSheet({ kind: 'block', id }),
      openRef: (b) => openRef?.(b),
      gripDown: (e, id) => {
        if (e.button !== undefined && e.button !== 0) return;
        const list = rootRef.current; if (!list) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const rects = [...list.querySelectorAll('.dc-row')].map(r => { const b = r.getBoundingClientRect(); return { id: r.dataset.blockId, top: b.top, bottom: b.bottom, mid: (b.top + b.bottom) / 2 }; });
        const sc = list.closest('.lay-scroll'); if (sc) sc.style.scrollBehavior = 'auto'; dragRef.current = { id, y0: e.clientY, rects, sc, s0: sc ? sc.scrollTop : 0, moved: false, to: indexOfBlock(cur(), id) };
      },
      gripMove: (e) => {
        const d = dragRef.current; if (!d) return;
        const dy = e.clientY - d.y0;
        if (!d.moved && Math.abs(dy) < 6) return;
        d.moved = true;
        if (d.sc) { const r = d.sc.getBoundingClientRect(); if (e.clientY < r.top + 60) d.sc.scrollTop -= 14; else if (e.clientY > r.bottom - 60) d.sc.scrollTop += 14; }
        const scrolled = d.sc ? d.sc.scrollTop - d.s0 : 0;
        const y = e.clientY + scrolled;
        const others = d.rects.filter(r => r.id !== d.id);
        d.to = others.filter(r => r.mid + 0 < y).length;
        setDrag({ id: d.id, dy: dy + scrolled * 0, to: d.to });
      },
      gripUp: (e) => {
        const d = dragRef.current; dragRef.current = null;
        try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch { /* released already */ }
        if (!d) return;
        if (d.sc) d.sc.style.scrollBehavior = '';
        if (!d.moved) { setDrag(null); setSheet({ kind: 'block', id: d.id }); return; }
        setDrag(null);
        onChange(moveTo(cur(), d.id, d.to));
      },
      gripCancel: () => { const d = dragRef.current; if (d?.sc) d.sc.style.scrollBehavior = ''; dragRef.current = null; setDrag(null); },
    };
  }, [onChange, commit, toast, openRef]);

  /* A computer: the bar's actions run on the focused text block. */
  const typeToggle = (type) => {
    const b = blocksRef.current.find(x => x.id === focusId); if (!b || !isText(b)) return;
    commit(convertBlock(blocksRef.current, b.id, b.type === type ? 'p' : type), { id: b.id, at: 1e6 });
  };
  const exec = (cmd) => {
    const el = document.activeElement;
    if (!el?.classList?.contains('dc-rt')) return;
    if (cmd === 'link') {
      const s = window.getSelection();
      savedRange.current = s && s.rangeCount ? { el, range: s.getRangeAt(0).cloneRange() } : null;
      setSheet({ kind: 'link', collapsed: !s || s.isCollapsed, hasLink: !!marks.a });
      return;
    }
    document.execCommand(cmd);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const restoreSel = () => { const sr = savedRange.current; if (!sr) return null; sr.el.focus(); const s = window.getSelection(); s.removeAllRanges(); s.addRange(sr.range); return sr; };
  const applyLink = (url, text) => {
    const sr = restoreSel(); if (!sr) return;
    if (!sr.range.collapsed) document.execCommand('createLink', false, url);
    else { const a = document.createElement('a'); a.setAttribute('href', url); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); a.textContent = text || url; sr.range.insertNode(a); const s = window.getSelection(); const r = document.createRange(); r.setStartAfter(a); r.collapse(true); s.removeAllRanges(); s.addRange(r); }
    sr.el.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const removeLink = () => { const sr = restoreSel(); if (!sr) return; document.execCommand('unlink'); sr.el.dispatchEvent(new Event('input', { bubbles: true })); };

  /* "+" and Add a block: a text type turns an empty paragraph into itself, anything else goes in below the block being typed in (or at the end). */
  const insertType = (type) => {
    const cur = blocksRef.current;
    const anchor = insertAnchor.current && cur.find(b => b.id === insertAnchor.current) ? insertAnchor.current : (focusId && cur.find(b => b.id === focusId) ? focusId : cur[cur.length - 1]?.id);
    const here = cur.find(b => b.id === anchor);
    if (isText({ type }) && here && here.type === 'p' && !textOf(here.runs)) { commit(convertBlock(cur, here.id, type), { id: here.id, at: 0 }); return; }
    if (type === 'ref') { insertAnchor.current = anchor; setSheet({ kind: 'ref' }); return; }
    const nb = newBlock(type);
    const next = anchor ? insertAfter(cur, anchor, nb) : [...cur, nb];
    commit(next, isText(nb) ? { id: nb.id, at: 0 } : type === 'link' ? { id: nb.id, input: true } : null);
  };
  const openInsert = () => { insertAnchor.current = focusId || blocksRef.current[blocksRef.current.length - 1]?.id || null; setSheet({ kind: 'insert' }); };
  const addRef = (it) => {
    const cur = blocksRef.current; const anchor = insertAnchor.current;
    const nb = newBlock('ref', { ref: it.ref, label: it.label.slice(0, 200) });
    commit(anchor && cur.find(b => b.id === anchor) ? insertAfter(cur, anchor, nb) : [...cur, nb], null);
  };

  const nums = numbering(blocks);
  const dropAt = drag ? (() => { const others = blocks.filter(b => b.id !== drag.id); return others[drag.to]?.id || null; })() : null;
  const barVisible = !!focusedBlock && !readOnly && !sheet;
  const sheetBlock = sheet?.kind === 'block' ? blocks.find(b => b.id === sheet.id) : null;

  return (
    <div className={`dc${readOnly ? ' is-readonly' : ''}`}>
      {!phone && <FormatBar visible phone={false} inset={0} focusType={focusedBlock?.type} marks={marks} onCmd={exec} onType={typeToggle} onInsert={openInsert} readOnly={readOnly} />}
      <div className="dc-blocks" ref={rootRef} role="group" aria-label="Doc blocks">
        {blocks.map((b, i) => (
          <div key={b.id} className="dc-slot" data-dropbefore={dropAt === b.id ? 'true' : undefined} style={drag?.id === b.id ? { transform: `translate3d(0, ${drag.dy}px, 0)`, zIndex: 4, pointerEvents: 'none' } : undefined}>
            <Block b={b} n={nums[i]} readOnly={readOnly} phone={phone} ctx={ctx} api={api} dragging={drag?.id === b.id} />
          </div>
        ))}
        {drag && !dropAt && <div className="dc-slot" data-dropbefore="end" />}
        {!readOnly && blocks.length > 0 && <button type="button" className="dc-tail" onClick={() => { const last = blocks[blocks.length - 1]; if (last && last.type === 'p' && !textOf(last.runs)) { placeCaret(rootRef.current.querySelector(`[data-rt="${CSS.escape(last.id)}"]`), 0); return; } const nb = newBlock('p'); commit([...blocks, nb], { id: nb.id, at: 0 }); }} aria-label="Add a paragraph at the end"><span>Tap to keep writing</span></button>}
      </div>
      {phone && <FormatBar visible={barVisible} phone inset={inset} focusType={focusedBlock?.type} marks={marks} onCmd={exec} onType={typeToggle} onInsert={openInsert} onDone={() => document.activeElement?.blur?.()} readOnly={readOnly} />}
      {sheet?.kind === 'insert' && <InsertSheet onPick={insertType} onClose={() => setSheet(null)} />}
      {sheetBlock && <BlockSheet block={sheetBlock} index={indexOfBlock(blocks, sheetBlock.id)} count={blocks.length} onClose={() => setSheet(null)}
        onTurn={(t) => commit(convertBlock(blocks, sheetBlock.id, t), { id: sheetBlock.id, at: 1e6 })} onMove={(d) => onChange(moveBlock(blocks, sheetBlock.id, d))} onDuplicate={() => onChange(duplicateBlock(blocks, sheetBlock.id))} onDelete={() => api.remove(sheetBlock.id, true)} />}
      {sheet?.kind === 'ref' && <RefSheet ctx={ctx} onPick={addRef} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'link' && <LinkSheet collapsed={sheet.collapsed} hasLink={sheet.hasLink} onApply={applyLink} onRemove={removeLink} onClose={() => setSheet(null)} />}
    </div>
  );
}

/** Put a block back after index `at` (-1: first); the Undo of a delete. */
function insertAfterIndex(blocks, at, block) {
  const next = [...blocks]; next.splice(Math.max(0, at + 1), 0, block);
  return next;
}

export const KNOWN_BLOCKS = BLOCK_TYPES;
export { caretOffset };
