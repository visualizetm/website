import { Section } from '../marketing/motion';

const STEPS = [
  { n: 1, title: 'A free call', desc: 'Twenty minutes to talk through what you need. No pitch, no pressure.' },
  { n: 2, title: 'A plan', desc: 'You get a clear scope and timeline before anything starts.' },
  { n: 3, title: 'Launch', desc: 'I design and build it, you review, we ship. You own everything.' },
];

/* How it works: the heading and three numbered steps, one section revealed
 * once, the rows a beat apart. The numerals are plain text. */
export default function HowItWorks({ tone = 'a' }) {
  return (
    <Section tone={tone} label="How it works" className="hiw">
      <div className="wrap hiw-col">
        <h2 data-step="0" className="section-title hiw-title">How it works</h2>
        <ol className="hiw-list">
          {STEPS.map((s, i) => (
            <li key={s.n} data-step={i + 1} className="hiw-step">
              <span className="hiw-n display" aria-hidden="true">0{s.n}</span>
              <div className="hiw-text">
                <h3 className="hiw-h"><span className="visually-hidden">Step {s.n}: </span>{s.title}</h3>
                <p className="hiw-desc">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <style>{`
        .hiw-col { display: flex; flex-direction: column; gap: clamp(20px, 3vh, 36px); }
        .hiw-title { font-size: clamp(1.9rem, 4vw, 3.25rem); line-height: 1.05; }
        .hiw-list { list-style: none; display: flex; flex-direction: column; }
        .hiw-step { display: grid; grid-template-columns: auto 1fr; gap: var(--space-4); align-items: center; padding: clamp(16px, 3vh, 36px) 0; border-top: 1px solid var(--border); }
        .hiw-n { font-size: clamp(2.6rem, 7vw, 5rem); line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; min-width: 2.2ch; color: var(--brand-text); }
        .hiw-step:last-child { padding-bottom: 0; }
        .hiw-h { font-size: clamp(1.125rem, 2.8vh, 1.5rem); font-weight: 700; color: var(--text); }
        .hiw-desc { margin-top: 4px; font-size: clamp(0.95rem, 2.3vh, 1.125rem); line-height: 1.5; color: var(--text-secondary); max-width: 48ch; }
      `}</style>
    </Section>
  );
}
