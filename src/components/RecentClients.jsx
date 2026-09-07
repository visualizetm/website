import { Link } from 'react-router-dom';
import { Reveal, Stagger } from '../marketing/motion';
import { ClientCard, workStyles } from '../pages/Clients';

/* Site Prompt 4, Part 1.4: three cards from landing.work (already ordered
 * by the endpoint, featured.order then updatedAt). Hidden when empty.
 * Site Prompt 6, Part 2.5: the covers drift with Parallax, and Home wraps
 * this section in a Curtain so it arrives over the platforms section. */
export default function RecentClients({ work }) {
  const items = (work || []).slice(0, 3);
  if (!items.length) return null;

  return (
    <section className="rc section">
      <div className="wrap">
        <Reveal as="div" className="rc-head">
          <h2 className="section-title">Recent clients</h2>
          <Link to="/clients" className="btn btn-secondary">All clients</Link>
        </Reveal>
        <Stagger className="rc-grid">
          {items.map(c => <ClientCard key={c.slug} client={c} parallax />)}
        </Stagger>
      </div>
      <style>{`
        .rc-head {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-10);
        }
        .rc-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5);
        }
        @media (max-width: 900px) { .rc-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .rc-grid { grid-template-columns: 1fr; } }
      `}</style>
      <style>{workStyles}</style>
    </section>
  );
}
