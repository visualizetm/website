import { Counter, Pin, Reveal, useMediaQuery } from '../marketing/motion';

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
 * Site Prompt 8, check 3: and that is what a phone gets too. Three holds
 * of four tenths of a viewport each came to four and a half screens of
 * scrolling for three short sentences, which on a phone is the single
 * worst "it will not let me scroll" stretch on the page. The beat is
 * worth having on a desktop, where the scroll is cheap; on a phone the
 * steps are just a stack. */
export default function HowItWorks() {
  const phone = useMediaQuery('(max-width: 767px)');
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
        <Reveal as="h2" className="section-title">How it works</Reveal>
        {STEPS.map(s => (phone
          ? <Reveal key={s.n} as="div" className="hiw-plain"><Step step={s} /></Reveal>
          : (
            <Pin key={s.n} height={0.4} as="div" className="hiw-pin" innerClassName="hiw-inner">
              <Step step={s} />
            </Pin>
          )
        ))}
      </div>
      <style>{`
        .hiw-pin { position: relative; }
        .hiw-plain { padding: var(--space-2) 0; }
        .hiw-inner { justify-content: center; }
        .hiw-step {
          display: flex; align-items: baseline; gap: var(--space-6);
          padding: var(--space-8) 0;
          opacity: clamp(0.6, calc(1.25 - var(--pin-p, 0) * 0.65), 1);
          transform: translate3d(0, calc(var(--pin-p, 0) * -24px), 0);
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
