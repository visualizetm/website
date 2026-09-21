import { Link } from 'react-router-dom';
import { Scene } from '../marketing/motion';
import { ClientCard, workStyles } from '../pages/Clients';

/* Scene 5, recent clients (Site Prompt 11): not pinned. The heading and
 * the All clients link, then the three cards from the CRM, each revealing
 * as it enters in step order. Hidden entirely when there is no work. */
export default function RecentClients({ work, tone = 'a' }) {
  const items = (work || []).slice(0, 3);
  if (!items.length) return null;
  return (
    <Scene steps={0} tone={tone} label="Recent clients" className="rc">
      <div className="wrap rc-col">
        <div data-step="1" className="rc-head">
          <h2 className="section-title">Recent clients</h2>
          <Link to="/clients" className="btn btn-secondary">All clients</Link>
        </div>
        <div className="rc-grid">
          {items.map((c, i) => <div key={c.slug} data-step={i + 2}><ClientCard client={c} parallax /></div>)}
        </div>
      </div>
      <style>{`
        .rc .m-scene-body { padding: clamp(28px, 6vh, 64px) 0; }
        .rc-col { display: flex; flex-direction: column; gap: var(--space-6); }
        .rc-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
        .rc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
        /* Phones: the three cards side by side in a snap row (one card
           wide, the next peeking) rather than a stack of three screens,
           which is what keeps Home inside its length budget. */
        @media (max-width: 900px) {
          .rc-grid { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: var(--space-3); margin: 0 calc(-1 * var(--space-4)); padding: 0 var(--space-4) var(--space-2); scrollbar-width: none; }
          .rc-grid::-webkit-scrollbar { display: none; }
          .rc-grid > * { flex: 0 0 min(82%, 340px); scroll-snap-align: center; }
        }
        ${workStyles}
      `}</style>
    </Scene>
  );
}
