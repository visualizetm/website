import { Icon } from '../../ui/icons';
import { Runs } from './BlockView';
import { numbering } from '../../lib/docEdit';
import { refInfo } from '../../lib/docRefs';
import { safeHref } from '../../lib/safeUrl';
import { sectionsOf } from '../../lib/docRead';

/* A doc to read (prompt 3 of 3, milestone 3): the same blocks as one article. Every string goes in as React text and every link through
 * safeHref, like the print sheet. A tick is the editor's own block patch (onTick), so a checklist can be worked from the reading view.
 * A block type with no renderer here would fall back to nothing; every type the schema knows has one (docs-read-test lists them). */
export const readId = (id) => `dr-${id}`;

/** The strip under the header: each h1 and h2, tap to jump. */
export function SectionStrip({ blocks }) {
  const secs = sectionsOf(blocks);
  if (secs.length < 2) return null;
  const jump = (id) => {
    const el = document.getElementById(readId(id));
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  };
  return (
    <nav className="dr-strip" aria-label="Sections">
      {secs.map(s => <button key={s.id} type="button" className={`dr-strip-b${s.level === 2 ? ' is-sub' : ''}`} onClick={() => jump(s.id)}>{s.text}</button>)}
    </nav>
  );
}

export default function DocReader({ blocks, ctx, onTick, readOnly, openRef, size = 'm' }) {
  const nums = numbering(blocks);
  return (
    <article className="dr-article" data-size={size}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h1': return <h2 key={b.id} id={readId(b.id)} tabIndex={-1} className="dr-h1"><Runs runs={b.runs} /></h2>;
          case 'h2': return <h3 key={b.id} id={readId(b.id)} tabIndex={-1} className="dr-h2"><Runs runs={b.runs} /></h3>;
          case 'p': return (b.runs || []).length ? <p key={b.id} className="dr-p"><Runs runs={b.runs} /></p> : null;
          case 'ul': return <p key={b.id} className="dr-li"><span className="dr-mark" aria-hidden="true">{'•'}</span><span className="dr-li-t"><Runs runs={b.runs} /></span></p>;
          case 'ol': return <p key={b.id} className="dr-li"><span className="dr-mark dr-mark--n">{nums[i]}.</span><span className="dr-li-t"><Runs runs={b.runs} /></span></p>;
          case 'check': return (
            <div key={b.id} className={`dr-li dr-li--check${b.checked ? ' is-done' : ''}`}>
              <button type="button" className="dc-tick" role="checkbox" aria-checked={!!b.checked} aria-label="Done" disabled={readOnly} onClick={() => onTick(b.id)}>
                <span className="dc-tick-box">{b.checked && <Icon icon="Check" size={14} />}</span>
              </button>
              <span className="dr-li-t"><Runs runs={b.runs} /></span>
            </div>
          );
          case 'quote': return <blockquote key={b.id} className="dr-quote"><Runs runs={b.runs} /></blockquote>;
          case 'divider': return <hr key={b.id} className="dr-hr" />;
          case 'link': return <p key={b.id} className="dr-p">{safeHref(b.url) ? <a href={safeHref(b.url)} target="_blank" rel="noopener noreferrer">{b.text || b.url}</a> : (b.text || '')}</p>;
          case 'image': return b.url && safeHref(b.url) ? <figure key={b.id} className="dr-img"><span className="img-fit img-fit--16x9"><img src={safeHref(b.url)} alt={b.alt || ''} loading="lazy" decoding="async" /></span>{b.alt && <figcaption>{b.alt}</figcaption>}</figure> : null;
          case 'ref': {
            const info = refInfo(b.ref, ctx || {});
            const label = info.gone ? (b.label || info.label) : info.label;
            return <p key={b.id} className="dr-p"><button type="button" className="dr-ref" onClick={() => openRef && openRef(b)} disabled={!openRef || info.gone}><strong>{label}</strong>{`, ${info.status}`}</button></p>;
          }
          default: return null;
        }
      })}
    </article>
  );
}
