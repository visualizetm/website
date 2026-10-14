import { Section } from '../marketing/motion';
import { CALENDLY_URL } from '../marketing/links';

/* Start small, go as far as you want: the four tiers, smallest first, each
 * with what is in it and the step it is up from the last; a grid of two on
 * a computer, a swipeable row on a phone. A tier's width bar says how far
 * along it sits. No price. */
const TIERS = [
  { name: 'Social Refresh', line: 'Your Instagram, cleaned up.', contents: ['Profile', 'Highlights', 'Bio', 'Post templates that look like you'], step: 'Your socials stop looking like an afterthought.', width: 40 },
  { name: 'Brand Starter', line: 'A real logo and a real look.', contents: ['Logo', 'Alternate mark', 'Colors', 'Fonts', 'Every file format you will ever need'], step: 'Up from Social Refresh: now you own an identity instead of a profile.', width: 60 },
  { name: 'Brand Complete', line: 'The identity, plus everything you hand someone.', contents: ['Everything in Starter', 'Brand guidelines', 'Social kit', 'Packaging and print design', 'Business cards'], step: 'Up from Starter: it is not just a logo, it is a system.', width: 80 },
  { name: 'The Full Build', line: 'Everything, in one project.', contents: ['The complete identity', 'A website built for booking or buying', 'One project, not pieces', 'Monthly plans after launch for content, ads, or the site itself'], step: 'Up from Complete: the brand and the website arrive together, built to match.', width: 100 },
];
const N = TIERS.length;

export default function Packages({ tone = 'b' }) {
  return (
    <Section tone={tone} label="Start small, go as far as you want" className="pk" id="packages">
      <div className="wrap pk-col">
        <div data-step="0" className="pk-head">
          <h2 className="section-title pk-title">Start small. Go as far as you want.</h2>
          <p className="pk-intro">Some people start with just their Instagram. Some want the whole thing. Both are fine.</p>
        </div>
        {/* tabIndex: the row scrolls sideways on a phone and holds no link of its own, so the keyboard needs the row itself. */}
        <ol className="pk-tiers" aria-label="The four tiers, smallest first" tabIndex={0}>
          {TIERS.map((t, i) => (
            <li key={t.name} data-step={i + 1} className="pk-tier" style={{ '--w': t.width / 100 }}>
              <p className="pk-tier-n"><span className="visually-hidden">Tier </span>{i + 1}<span className="pk-tier-of"> of {N}</span></p>
              <h3 className="pk-name">{t.name}</h3>
              <p className="pk-line">{t.line}</p>
              <ul className="pk-contents" aria-label="What is in it">
                {t.contents.map(c => <li key={c} className="pk-chip">{c}</li>)}
              </ul>
              <p className="pk-step"><span className="pk-step-label">The step: </span>{t.step}</p>
              <span className="pk-bar" aria-hidden="true" />
            </li>
          ))}
        </ol>
        <div data-step={N} className="pk-foot">
          <p className="pk-note">Not sure where to start? That is what the first call is for.</p>
          <a href={CALENDLY_URL} className="btn btn-primary" target="_blank" rel="noreferrer">Book a free call</a>
        </div>
      </div>
      <style>{`
        .pk-col { display: flex; flex-direction: column; gap: clamp(20px, 3vh, 36px); }
        .pk-title { font-size: clamp(1.75rem, 3.6vw, 2.75rem); line-height: 1.08; }
        .pk-intro { margin-top: clamp(6px, 1vh, 12px); max-width: 52ch; font-size: clamp(1rem, 2.2vh, 1.125rem); color: var(--text-secondary); line-height: 1.5; }
        .pk-tiers { list-style: none; display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-4); }
        .pk-tiers:focus-visible { outline: 2px solid var(--brand); outline-offset: 4px; border-radius: var(--radius); }
        /* Phones: the four tiers side by side in a row, smallest first (one tier wide, the next peeking), native scroll with a gentle snap. */
        @media (max-width: 767px) {
          .pk-tiers { display: flex; overflow-x: auto; scroll-snap-type: x proximity; gap: var(--space-3); margin: 0 calc(-1 * var(--space-4)); padding: 0 var(--space-4) var(--space-2); scrollbar-width: none; }
          .pk-tiers::-webkit-scrollbar { display: none; }
          .pk-tiers > * { flex: 0 0 min(82%, 340px); scroll-snap-align: center; }
        }
        /* position: relative so the tier's visually hidden text anchors to the tier, not the section: anchored to the section it sat at the row's far end and widened a phone's layout viewport. */
        .pk-tier { position: relative; display: flex; flex-direction: column; gap: 8px; padding: clamp(16px, 2.4vh, 24px); background: var(--bg-card); border-radius: var(--radius-lg); min-width: 0; }
        .pk-tier-n { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand-text); }
        .pk-tier-of { color: var(--text-muted); }
        .pk-name { font-size: clamp(1.125rem, 2.5vh, 1.375rem); font-weight: 700; color: var(--text); }
        .pk-line { font-size: 1rem; color: var(--text-secondary); line-height: 1.45; }
        .pk-contents { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
        .pk-chip { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; font-size: 0.8125rem; color: var(--text); background: var(--bg-elevated); }
        .pk-step { font-size: 0.9375rem; line-height: 1.5; color: var(--brand-text); }
        .pk-step-label { font-weight: 700; }
        .pk-bar { display: block; width: calc(var(--w) * 100%); height: 6px; border-radius: 3px; background: var(--brand); margin-top: auto; }
        .pk-foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-3) var(--space-6); }
        .pk-note { font-size: 1.0625rem; color: var(--text); }
        @media (max-width: 767px) { .pk-foot .btn { width: 100%; justify-content: center; } }
      `}</style>
    </Section>
  );
}
