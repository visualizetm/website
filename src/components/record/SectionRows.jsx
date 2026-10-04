import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import { Card, ProgressBar } from '../../ui';

/* The phone's sections (law 2, and the mobile revamp's one job per screen): a stack of rows, a bold title over a one line summary and a
 * chevron. A row does not unfold: it opens that section on a screen of its own (a history entry, so Back returns to this list), and the
 * section is the same component the computer shows in its tab. onOpen(id) is the record's openTab. */
export default function SectionRows({ sections, onOpen }) {
  return (
    <div className="rc-rows">
      {sections.map(s => (
        <Card key={s.id} padding={0} className="rc-row">
          <button type="button" className="rc-row-btn" onClick={() => onOpen(s.id)}>
            <span className="rc-row-text"><span className="rc-row-title">{s.label}</span><span className="rc-row-sum lay-truncate">{s.summary}</span>{typeof s.bar === 'number' && <ProgressBar value={s.bar} size="sm" tone={s.bar >= 100 ? 'booked' : 'progress'} className="rc-row-bar" />}</span>
            <ChevronRight width={18} height={18} className="rc-row-chev" aria-hidden="true" />
          </button>
        </Card>
      ))}
    </div>
  );
}
