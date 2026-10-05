import { safeHref } from '../../lib/safeUrl';
import { numbering } from '../../lib/docEdit';
import { refInfo } from '../../lib/docRefs';

/* A doc drawn read only (docs job): what the print sheet shows. Every string goes in as React text and every link through safeHref, so
 * nothing stored is ever read as markup. The same blocks the editor edits, the same numbering, the references as their live name and status. */
export function Runs({ runs }) {
  return (runs || []).map((r, i) => {
    let node = r.t;
    if (r.i) node = <em>{node}</em>;
    if (r.b) node = <strong>{node}</strong>;
    if (r.a && safeHref(r.a)) node = <a href={safeHref(r.a)} rel="noopener noreferrer">{node}</a>;
    return <span key={i}>{node}</span>;
  });
}

export default function BlockView({ blocks, ctx }) {
  const nums = numbering(blocks);
  return blocks.map((b, i) => {
    switch (b.type) {
      case 'h1': return <h2 key={b.id} className="dp-h1"><Runs runs={b.runs} /></h2>;
      case 'h2': return <h3 key={b.id} className="dp-h2"><Runs runs={b.runs} /></h3>;
      case 'p': return <p key={b.id} className="dp-p"><Runs runs={b.runs} /></p>;
      case 'ul': return <p key={b.id} className="dp-li"><span className="dp-mark" aria-hidden="true">{'•'}</span><span><Runs runs={b.runs} /></span></p>;
      case 'ol': return <p key={b.id} className="dp-li"><span className="dp-mark">{nums[i]}.</span><span><Runs runs={b.runs} /></span></p>;
      case 'check': return <p key={b.id} className="dp-li"><span className="dp-mark" aria-hidden="true">{b.checked ? '☑' : '☐'}</span><span className="v-sr-only">{b.checked ? 'Done: ' : 'Not done: '}</span><span><Runs runs={b.runs} /></span></p>;
      case 'quote': return <blockquote key={b.id} className="dp-quote"><Runs runs={b.runs} /></blockquote>;
      case 'divider': return <hr key={b.id} className="dp-hr" />;
      case 'link': return <p key={b.id} className="dp-p">{safeHref(b.url) ? <a href={safeHref(b.url)} rel="noopener noreferrer">{b.text || b.url}</a> : (b.text || '')}</p>;
      case 'image': return b.url ? <figure key={b.id} className="dp-img"><span className="img-fit img-fit--16x9"><img src={safeHref(b.url)} alt={b.alt || ''} loading="lazy" decoding="async" /></span>{b.alt && <figcaption>{b.alt}</figcaption>}</figure> : null;
      case 'ref': { const info = refInfo(b.ref, ctx || {}); return <p key={b.id} className="dp-ref"><strong>{info.gone ? (b.label || info.label) : info.label}</strong>{`, ${info.status}`}</p>; }
      default: return null;
    }
  });
}
