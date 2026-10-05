import { Pill, Icon } from '../../ui';
import { typeLabel, editedLabel } from '../../lib/docs';

/* One doc as a row (docs job): the same row on the client's Docs card, on All docs and on the More page's Docs section. The title wraps to two
 * lines, the type is a chip, "Edited 2h ago" and a pin mark for a pinned one; the whole row is one stretched button that opens the doc, and
 * `controls` (a menu) sits above it. `client` adds the client's name for the lists that span clients. */
export default function DocRow({ doc, client, now = Date.now(), onOpen, controls }) {
  return (
    <li className={`rc-docs-row${doc.pinned ? ' is-pinned' : ''}`} data-doc-id={doc._id} data-row-id={doc._id}>
      <button type="button" className="v-stretch" onClick={() => onOpen(doc)} aria-label={`Open ${doc.title || 'Untitled'}${client ? `, ${client}` : ''}`}>Open {doc.title || 'Untitled'}</button>
      <span className="rc-docs-title">{doc.pinned && <><Icon icon="Pin01" size={14} className="rc-docs-pin" /><span className="v-sr-only">Pinned. </span></>}{doc.title || 'Untitled'}</span>
      <span className="rc-docs-meta">
        <Pill tone="neutral" label={typeLabel(doc.type)} size="sm" icon={false} variant="soft" />
        {client && <span className="rc-docs-client">{client}</span>}
        <span className="rc-docs-edited">{editedLabel(doc, now)}</span>
      </span>
      {controls && <span className="rc-docs-controls v-above">{controls}</span>}
    </li>
  );
}
