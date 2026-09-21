import { Scene } from '../marketing/motion';

/* Scene 2, what we stand for (Site Prompt 11): the heading with the stage,
 * then four lines, one per step, each a numbered row that stays. */
const LINES = [
  'Most local businesses do great work and have a logo from 2009, an Instagram nobody updates, and a website that does not work on a phone.',
  'That gap costs you customers you never hear from.',
  'Visualize closes it. One person, no agency, no handoffs, every piece made to match.',
  'The goal is simple: when someone finds you online, what they see is as good as what you actually do.',
];

export default function Manifesto({ tone = 'b' }) {
  return (
    <Scene steps={4} tone={tone} label="What we stand for" className="mf">
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
        .mf-col { display: flex; flex-direction: column; gap: clamp(8px, 1.8vh, 24px); }
        .mf-title { font-size: clamp(1.7rem, max(3.6vw, 4.6vh), 3rem); line-height: 1.05; max-width: 18ch; }
        .mf-list { list-style: none; display: flex; flex-direction: column; }
        /* The numeral column is sized by the numeral's own face, never by
           ch of the row's body font: 2.6ch of Inter at 16px was 23px, and
           "01" in the display face at 25px wrapped into "0" over "1" on a
           phone (Site Prompt 12, bug 2). auto plus a nowrap numeral with
           a two digit minimum in its own em fits "04" at every width. */
        .mf-line {
          display: grid; grid-template-columns: auto 1fr; gap: var(--space-4); align-items: start;
          padding: clamp(8px, 1.6vh, 18px) 0; border-top: 1px solid var(--border);
        }
        .mf-n { font-size: clamp(1.2rem, 3.2vh, 2rem); line-height: 1.2; color: var(--brand-text); white-space: nowrap; min-width: 2.2ch; font-variant-numeric: tabular-nums; }
        .mf-line p { font-size: clamp(1rem, 2.5vh, 1.85rem); line-height: 1.38; color: var(--text); max-width: 40ch; }
      `}</style>
    </Scene>
  );
}
