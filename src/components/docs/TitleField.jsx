import { useLayoutEffect, useRef } from 'react';

/* The doc's big title (docs job): a single line of plain text that wraps. A contentEditable and not a textarea because the app keeps every
 * form control at 16px on a phone (the iOS zoom rule), which would make a title the size of a label. Plain text only: paste is text,
 * Enter moves on to the first block, the length is capped. */
export default function TitleField({ value, onChange, onEnter, readOnly, max = 160 }) {
  const ref = useRef(null);
  useLayoutEffect(() => { if (ref.current && ref.current.textContent !== value) ref.current.textContent = value || ''; }, [value]);
  const read = () => { const el = ref.current; let t = el.textContent.replace(/\s+/g, ' '); if (t.length > max) { t = t.slice(0, max); el.textContent = t; } if (!t && el.firstChild) el.textContent = ''; onChange(t); };
  return (
    <div ref={ref} className="dd-title" role="textbox" aria-label="Doc title" aria-multiline="false" data-placeholder="Untitled" contentEditable={!readOnly} suppressContentEditableWarning spellCheck
      onInput={read} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); } }}
      onPaste={(e) => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData?.getData('text/plain') || '').replace(/\s+/g, ' ')); }} onDrop={(e) => e.preventDefault()} />
  );
}
