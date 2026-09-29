import { useEffect, useRef, useState } from 'react';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import { Card, Collapsible } from '../../ui';
import { durationMs } from '../../ui/motion';

/* The phone's sections (law 2): a stack of 56px rows, a bold title over a
 * one line summary, a chevron. Tapping opens that section under the row,
 * one at a time; the open section is the same component the computer
 * shows in its tab. The body mounts while its row is open and stays
 * through the close animation. */
export default function SectionRows({ sections, open, onToggle }) {
  const refs = useRef({});
  const [closing, setClosing] = useState(null);
  const prev = useRef(open);
  useEffect(() => {
    if (prev.current && prev.current !== open) {
      const id = prev.current;
      setClosing(id);
      const t = setTimeout(() => setClosing(c => (c === id ? null : c)), durationMs('--v-dur-slow') + 60);
      prev.current = open;
      return () => clearTimeout(t);
    }
    prev.current = open;
    return undefined;
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const t = setTimeout(() => refs.current[open]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 80);
    return () => clearTimeout(t);
  }, [open]);
  return (
    <div className="rc-rows">
      {sections.map(s => {
        const on = open === s.id;
        return (
          <Card key={s.id} padding={0} className={`rc-row${on ? ' is-open' : ''}`}>
            <button type="button" className="rc-row-btn" ref={(el) => { refs.current[s.id] = el; }} aria-expanded={on} aria-controls={`rc-sec-${s.id}`} onClick={() => onToggle(on ? null : s.id)}>
              <span className="rc-row-text"><span className="rc-row-title">{s.label}</span><span className="rc-row-sum lay-truncate">{s.summary}</span></span>
              <ChevronRight width={18} height={18} className="rc-row-chev" aria-hidden="true" />
            </button>
            <Collapsible open={on}><div id={`rc-sec-${s.id}`} className="rc-row-body">{(on || closing === s.id) && s.body}</div></Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
