import { useLayoutEffect, useRef } from 'react';
import { linkUrl } from '../../shared/docBlocks';
import { normalizeRuns } from '../../lib/docEdit';

/* One block's text (docs job): a contentEditable that holds only runs. The page is never the source of truth and never HTML: runs go in
 * as text nodes inside strong, em and a (built with createElement and textContent), and come out through domToRuns, which keeps text, bold,
 * italic and an http or https link and nothing else. Paste is plain text. Enter and Backspace at the start are the editor's (the block
 * operations in src/lib/docEdit.js), so the browser never makes its own divs and paragraphs. */

export function renderRuns(el, runs) {
  el.textContent = '';
  for (const r of runs || []) {
    let node = document.createTextNode(r.t);
    if (r.i) { const e = document.createElement('em'); e.appendChild(node); node = e; }
    if (r.b) { const e = document.createElement('strong'); e.appendChild(node); node = e; }
    if (r.a) { const e = document.createElement('a'); e.setAttribute('href', r.a); e.setAttribute('rel', 'noopener noreferrer'); e.setAttribute('target', '_blank'); e.appendChild(node); node = e; }
    el.appendChild(node);
  }
}

export function domToRuns(root) {
  const out = [];
  const walk = (node, marks) => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { const t = n.nodeValue.replace(/\xa0/g, ' ').replace(/[\r\n]+/g, ' '); if (t) out.push({ t, ...marks }); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (tag === 'BR') continue;
      const m = { ...marks };
      const st = n.style || {};
      if (tag === 'B' || tag === 'STRONG' || st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) m.b = 1;
      if (tag === 'I' || tag === 'EM' || st.fontStyle === 'italic') m.i = 1;
      if (tag === 'A') { const u = linkUrl(n.getAttribute('href')); if (u) m.a = u; }
      walk(n, m);
    }
  };
  walk(root, {});
  return normalizeRuns(out);
}

/** The caret's character offset inside root, or -1 when the selection is not collapsed inside it. */
export function caretOffset(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !root.contains(sel.anchorNode)) return -1;
  const range = sel.getRangeAt(0);
  const pre = document.createRange(); pre.selectNodeContents(root); pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}
export const selectionCollapsed = () => { const s = window.getSelection(); return !s || s.isCollapsed; };

export function placeCaret(root, offset) {
  root.focus({ preventScroll: false });
  const sel = window.getSelection(); const range = document.createRange();
  let left = Math.max(0, offset); let done = false;
  const walk = (node) => {
    for (const n of node.childNodes) {
      if (done) return;
      if (n.nodeType === 3) { if (left <= n.nodeValue.length) { range.setStart(n, left); done = true; return; } left -= n.nodeValue.length; }
      else walk(n);
    }
  };
  walk(root);
  if (!done) { range.selectNodeContents(root); range.collapse(false); } else range.collapse(true);
  sel.removeAllRanges(); sel.addRange(range);
}

export default function RichText({ id, runs, label, placeholder, className = '', readOnly, onRuns, onEnter, onBackspaceStart, onPasteLines, onFocus, onBlur, onMarkdown }) {
  const ref = useRef(null);
  const last = useRef('');
  /* Take the runs from outside only when they are not what the page already holds (a convert, a template, an undo); typing never resets the caret. */
  useLayoutEffect(() => {
    const key = JSON.stringify(runs || []);
    if (key === last.current) return;
    last.current = key;
    renderRuns(ref.current, runs);
  }, [runs]);
  const emit = () => { const r = domToRuns(ref.current); if (!r.length && ref.current.firstChild) ref.current.textContent = ''; last.current = JSON.stringify(r); onRuns?.(r); return r; };
  const onKeyDown = (e) => {
    if (readOnly) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.nativeEvent.isComposing) return;
      const at = caretOffset(ref.current);
      onEnter?.(at < 0 ? domToRuns(ref.current).reduce((n, r) => n + r.t.length, 0) : at);
      return;
    }
    if (e.key === 'Backspace' && selectionCollapsed() && caretOffset(ref.current) === 0) { e.preventDefault(); onBackspaceStart?.(); }
  };
  const onPaste = (e) => {
    if (readOnly) return;
    e.preventDefault();
    const text = (e.clipboardData?.getData('text/plain') || '').replace(/\r/g, '');
    const lines = text.split('\n').map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
    if (!lines.length) return;
    document.execCommand('insertText', false, lines[0]);
    emit();
    if (lines.length > 1) onPasteLines?.(lines.slice(1));
  };
  return (
    <div ref={ref} className={`dc-rt ${className}`.trim()} data-rt={id} data-placeholder={placeholder} role="textbox" aria-multiline="false" aria-label={label}
      contentEditable={!readOnly} suppressContentEditableWarning spellCheck autoCorrect="on" autoCapitalize="sentences" enterKeyHint="enter"
      onInput={() => { const r = emit(); onMarkdown?.(r); }} onKeyDown={onKeyDown} onPaste={onPaste} onFocus={onFocus} onBlur={onBlur}
      onDrop={(e) => e.preventDefault()} />
  );
}
