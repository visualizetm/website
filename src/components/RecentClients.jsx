import { Link } from 'react-router-dom';
import { Section } from '../marketing/motion';
import { ClientCard, clientCardStyles } from '../marketing/showcase';

/* Recent projects: the heading and the All projects link, then the three
 * newest featured covers from the CRM as cards. One section revealed once;
 * the covers load lazily with their own sizes. Hidden entirely when there
 * is no work. */
export default function RecentClients({ work, tone = 'a' }) {
  const items = (work || []).slice(0, 3);
  if (!items.length) return null;
  return (
    <Section tone={tone} label="Recent projects" className="rc">
      <div className="wrap rc-col">
        <div data-step="0" className="rc-head">
          <h2 className="section-title">Recent projects</h2>
          <Link to="/projects" className="btn btn-secondary">All projects</Link>
        </div>
        <div className="rc-grid">
          {items.map((c, i) => <div key={c.slug} data-step={i + 1}><ClientCard client={c} /></div>)}
        </div>
      </div>
      <style>{`
        .rc-col { display: flex; flex-direction: column; gap: var(--space-6); }
        .rc-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
        .rc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
        /* Phones: the three cards side by side in a row (one card wide, the next peeking), native scroll with a gentle snap. */
        @media (max-width: 900px) {
          .rc-grid { display: flex; overflow-x: auto; scroll-snap-type: x proximity; gap: var(--space-3); margin: 0 calc(-1 * var(--space-4)); padding: 0 var(--space-4) var(--space-2); scrollbar-width: none; }
          .rc-grid::-webkit-scrollbar { display: none; }
          .rc-grid > * { flex: 0 0 min(82%, 340px); scroll-snap-align: center; }
        }
        ${clientCardStyles}
      `}</style>
    </Section>
  );
}
