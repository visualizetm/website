import { Section } from '../marketing/motion';

/* What I stand for: the heading, then four numbered lines. One section,
 * revealed once as one piece, the lines a beat apart. */
const LINES = [
  'Most local businesses do great work and have a logo from 2009, an Instagram nobody updates, and a website that does not work on a phone.',
  'That gap costs you customers you never hear from.',
  'Visualize closes it. One person, no agency, no handoffs, every piece made to match.',
  'The goal is simple: when someone finds you online, what they see is as good as what you actually do.',
];

export default function Manifesto({ tone = 'b' }) {
  return (
    <Section tone={tone} label="What I stand for" className="mf">
      <div className="wrap mf-col">
        <h2 data-step="0" className="section-title mf-title">Your business is better than it looks online.</h2>
        <ol className="mf-list">
          {LINES.map((t, i) => (
            <li key={i} data-step={i + 1} className="mf-line">
              <span className="mf-n display" aria-hidden="true">0{i + 1}</span>
              <p>{t}</p>
            </li>
          ))}
        </ol>
      </div>
      <style>{`
        .mf-col { display: flex; flex-direction: column; gap: clamp(16px, 3vh, 32px); }
        .mf-title { font-size: clamp(1.75rem, 4.2vw, 3rem); line-height: 1.05; max-width: 18ch; }
        .mf-list { list-style: none; display: flex; flex-direction: column; }
        .mf-line { display: grid; grid-template-columns: auto 1fr; gap: var(--space-4); align-items: start; padding: clamp(12px, 2vh, 20px) 0; border-top: 1px solid var(--border); }
        .mf-n { font-size: clamp(1.2rem, 2.8vw, 1.75rem); line-height: 1.2; color: var(--brand-text); white-space: nowrap; min-width: 2.2ch; font-variant-numeric: tabular-nums; }
        .mf-line p { font-size: clamp(1.0625rem, 2.2vw, 1.5rem); line-height: 1.4; color: var(--text); max-width: 40ch; }
      `}</style>
    </Section>
  );
}
