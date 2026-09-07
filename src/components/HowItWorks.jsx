import { Reveal, Stagger, SectionNumber } from '../marketing/motion';

const STEPS = [
  { n: 1, title: 'Book a call', desc: 'A quick call to talk through what you need and whether it is a fit.' },
  { n: 2, title: 'Pick a package', desc: 'You choose a package that matches the work, I lock the scope and timeline.' },
  { n: 3, title: 'Launch', desc: 'I design and build it, you review, we ship. You walk away owning everything.' },
];

/* Site Prompt 4, Part 1.7: the only process content on the page. */
export default function HowItWorks() {
  return (
    <section className="hiw section section-elevated">
      <div className="wrap">
        <Reveal as="h2" className="section-title">How it works</Reveal>
        <Stagger className="hiw-row">
          {STEPS.map(s => (
            <div key={s.n} className="hiw-step">
              <SectionNumber value={s.n} />
              <h3 className="hiw-title">{s.title}</h3>
              <p className="hiw-desc">{s.desc}</p>
            </div>
          ))}
        </Stagger>
        <Reveal as="p" className="hiw-plan" delay={120}>
          Bigger projects split into monthly payments. First payment starts the work.
        </Reveal>
      </div>
      <style>{`
        .hiw-row {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-8);
          margin-top: var(--space-10);
        }
        @media (max-width: 700px) { .hiw-row { grid-template-columns: 1fr; gap: var(--space-6); } }
        .hiw-step { display: flex; flex-direction: column; gap: var(--space-3); }
        .hiw-title { font-size: 1.125rem; font-weight: 700; color: var(--text); }
        .hiw-desc { font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.6; }
        .hiw-plan {
          margin-top: var(--space-12); padding-top: var(--space-8);
          border-top: 1px solid var(--border);
          font-size: 0.9375rem; color: var(--text-muted); text-align: center;
        }
      `}</style>
    </section>
  );
}
