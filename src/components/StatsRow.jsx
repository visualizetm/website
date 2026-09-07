import Star01 from '@untitled-ui/icons-react/build/esm/Star01';
import { Stagger, Counter } from '../marketing/motion';

const FIELDS = [
  { key: 'clientsServed', label: 'Clients served', suffix: '+' },
  { key: 'projectsDelivered', label: 'Projects delivered', suffix: '+' },
  { key: 'averageRating', label: 'Average rating', decimals: 1, star: true },
  { key: 'years', label: 'Years in business' },
];

/* Site Prompt 4, Part 1.5: only the keys the endpoint actually returns
 * render, since a toggled-off stat is simply omitted from landing.stats. */
export default function StatsRow({ stats }) {
  const fields = FIELDS.filter(f => stats && stats[f.key] != null);
  if (!fields.length) return null;

  return (
    <section className="stats section">
      <div className="wrap">
        <Stagger className="stats-row">
          {fields.map(f => (
            <div key={f.key} className="stats-item">
              <span className="stats-num">
                {f.star && <Star01 width={22} height={22} className="stats-star" />}
                <Counter value={stats[f.key]} decimals={f.decimals || 0} suffix={f.suffix || ''} />
              </span>
              <span className="stats-label">{f.label}</span>
            </div>
          ))}
        </Stagger>
      </div>
      <style>{`
        .stats-row {
          display: grid; grid-template-columns: repeat(${fields.length}, 1fr);
          gap: var(--space-8); text-align: center;
        }
        @media (max-width: 700px) { .stats-row { grid-template-columns: 1fr 1fr; } }
        .stats-item { display: flex; flex-direction: column; gap: var(--space-2); align-items: center; }
        .stats-num {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-display); font-size: clamp(2rem, 4vw, 2.75rem);
          font-weight: 700; color: var(--text);
        }
        .stats-star { color: var(--brand); fill: var(--brand); }
        .stats-label { font-size: 0.875rem; color: var(--text-muted); }
      `}</style>
    </section>
  );
}
