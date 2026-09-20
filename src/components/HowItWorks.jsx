import { Counter, Reveal, WordReveal } from '../marketing/motion';

const STEPS = [
  { n: 1, title: 'A free call', desc: 'Twenty minutes to talk through what you need. No pitch, no pressure.' },
  { n: 2, title: 'A plan', desc: 'You get a clear scope and timeline before anything starts.' },
  { n: 3, title: 'Launch', desc: 'I design and build it, you review, we ship. You own everything.' },
];

/* Site Prompt 6, Part 2.7: three steps, each held briefly while its
 * number counts in, so the process reads one beat at a time instead of as
 * a row of three columns skimmed at once. Four tenths of a viewport each
 * is deliberate: enough to land, short enough that a visitor who already
 * gets it is not trapped scrolling through it.
 *
 * No price or payment line: Home says what happens, never what it costs.
 * Without the engine the three steps are a plain stack, numbers already
 * counted, which is what reduced motion gets.
 *
 * Site Prompt 8, check 3 took the holds off the phone: three of them came
 * to four and a half screens of scrolling for three short sentences.
 * Site Prompt 9, Part 4 took them off the desktop as well: one line of
 * text held in the middle of a full viewport left that viewport 45
 * percent empty, and the page's rule is now that no scroll position may
 * be more than 30 percent empty. The beat is the Reveal's own stagger
 * (each step a beat after the last) and the number counting in. */
export default function HowItWorks() {
  const Step = ({ step }) => (
    <div className="hiw-step">
      <Counter as="span" className="hiw-n display" value={step.n} format={(v) => `0${Math.round(v)}`} />
      <div className="hiw-text">
        <h3 className="hiw-title">{step.title}</h3>
        <p className="hiw-desc">{step.desc}</p>
      </div>
    </div>
  );
  return (
    <section className="hiw section section-elevated">
      <div className="wrap">
        <WordReveal as="h2" className="section-title">How it works</WordReveal>
        {STEPS.map((s, i) => (
          <Reveal key={s.n} as="div" className="hiw-plain" delay={i * 90} threshold={0.3}><Step step={s} /></Reveal>
        ))}
      </div>
      <style>{`
        .hiw-plain { padding: var(--space-2) 0; }
        .hiw-step {
          display: flex; align-items: baseline; gap: var(--space-6);
          padding: var(--space-6) 0;
        }
        @media (max-width: 700px) {
          .hiw-step { flex-direction: column; align-items: flex-start; gap: var(--space-3); }
        }
        .hiw-n {
          font-size: clamp(2.75rem, 8vw, 5rem);
          line-height: 1; color: var(--brand-text);
          font-variant-numeric: tabular-nums;
        }
        .hiw-text { display: flex; flex-direction: column; gap: var(--space-3); max-width: 46ch; }
        .hiw-title { font-size: 1.375rem; font-weight: 700; color: var(--text); }
        .hiw-desc { font-size: 1rem; color: var(--text-secondary); line-height: 1.6; }
      `}</style>
    </section>
  );
}
