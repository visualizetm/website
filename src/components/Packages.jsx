import { Scene } from '../marketing/motion';
import { CALENDLY_URL } from '../marketing/links';

/* Scene 4, start small, go as far as you want (Site Prompt 11): four
 * steps, one tier per step, the four tiers and their step lines as built
 * in Site Prompt 10. A tier's width bar grows on arrival (40, 60, 80, 100
 * percent). Arrived tiers collapse to pills under the heading: the pill
 * for tier n appears as tier n+1 arrives, and tier n+1 stacks over tier n,
 * which scales to 0.96 beneath it. The line down the left grows with
 * progress and its nodes fill as each tier lands. After step 4, in the
 * same stage, the note and the one button. No price. "Tier n of 4" and
 * "The step:" carry the progression in text. */
const TIERS = [
  { name: 'Social Refresh', line: 'Your Instagram, cleaned up.', contents: ['Profile', 'Highlights', 'Bio', 'Post templates that look like you'], step: 'Your socials stop looking like an afterthought.', width: 40 },
  { name: 'Brand Starter', line: 'A real logo and a real look.', contents: ['Logo', 'Alternate mark', 'Colors', 'Fonts', 'Every file format you will ever need'], step: 'Up from Social Refresh: now you own an identity instead of a template.', width: 60 },
  { name: 'Brand Complete', line: 'The identity, plus everything you hand someone.', contents: ['Everything in Starter', 'Brand guidelines', 'Social kit', 'Packaging and print design', 'Business cards'], step: 'Up from Starter: it leaves the screen. Your brand exists on paper, on packaging, and in someone’s hand.', width: 80 },
  { name: 'The Full Build', line: 'Everything, in one project.', contents: ['The complete identity', 'A website built for booking or buying', 'One project, not pieces', 'Monthly plans after launch for content, ads, or the site itself'], step: 'Up from Complete: you stop having a brand and start having a business people can find and buy from.', width: 100 },
];
const N = TIERS.length;

export default function Packages({ tone = 'b' }) {
  return (
    <Scene steps={N} tone={tone} label="Start small, go as far as you want" indicator indicatorLabels={TIERS.map(t => t.name)} indicatorLabel="Tiers" className="pk" id="packages">
      <div className="wrap pk-col">
        <div data-step="0" className="pk-head">
          <h2 className="section-title pk-title">Start small. Go as far as you want.</h2>
          <p className="pk-intro">Some people start with just their Instagram. Some want the whole thing. Both are fine.</p>
        </div>
        <div className="pk-pills" aria-hidden="true">
          {TIERS.slice(0, N - 1).map((t, i) => <span key={t.name} data-step={i + 2} className="pk-pill">{t.name}</span>)}
        </div>
        <div className="pk-body">
          <div className="pk-rail" aria-hidden="true">
            <span className="pk-rail-line" />
            {TIERS.map((t, i) => <span key={t.name} data-step={i + 1} className="pk-node" style={{ '--i': i }} />)}
          </div>
          <ol className="pk-tiers" aria-label="The four tiers, smallest first">
            {TIERS.map((t, i) => (
              <li key={t.name} data-step={i + 1} data-reveal="custom" className="pk-tier" style={{ '--i': i, '--w': t.width / 100 }}>
                <p className="pk-tier-n"><span className="visually-hidden">Tier </span>{i + 1}<span className="pk-tier-of"> of {N}</span></p>
                <h3 className="pk-name">{t.name}</h3>
                <p className="pk-line">{t.line}</p>
                <ul className="pk-contents" aria-label="What is in it">
                  {t.contents.map(c => <li key={c} className="pk-chip">{c}</li>)}
                </ul>
                <p className="pk-step"><span className="pk-step-label">The step: </span>{t.step}</p>
                <span className="pk-bar" aria-hidden="true"><span className="pk-bar-fill" /></span>
              </li>
            ))}
          </ol>
        </div>
        <div data-step={N} className="pk-foot">
          <p className="pk-note">Not sure where to start? That is what the first call is for.</p>
          <a href={CALENDLY_URL} className="btn btn-primary" target="_blank" rel="noreferrer">Book a free call</a>
        </div>
      </div>
      <style>{`
        .pk-col { display: flex; flex-direction: column; gap: clamp(6px, 1.3vh, 20px); }
        .pk-title { font-size: clamp(1.75rem, max(3.4vw, 4.6vh), 2.75rem); line-height: 1.08; }
        .pk-intro { margin-top: clamp(4px, 1vh, 12px); max-width: 52ch; font-size: clamp(0.95rem, 2vh, 1.125rem); color: var(--text-secondary); line-height: 1.45; }
        .pk-pills { display: flex; flex-wrap: wrap; gap: var(--space-2); min-height: 32px; }
        .pk-pill {
          display: inline-flex; align-items: center; height: 32px; padding: 0 var(--space-3); border-radius: 999px;
          border: 1px solid var(--glass-border-brand); background: var(--glass-bg-brand); font-size: 0.8125rem; font-weight: 600; color: var(--text);
        }
        @media (max-width: 767px) { .pk-pill { height: 28px; padding: 0 9px; font-size: 0.72rem; } .pk-pills { min-height: 28px; gap: 6px; } }
        .pk-body { display: grid; grid-template-columns: 24px 1fr; gap: var(--space-4); align-items: stretch; }
        .pk-rail { position: relative; }
        .pk-rail::before { content: ''; position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; border-radius: 1px; background: var(--border); }
        .pk-rail-line { position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; border-radius: 1px; background: var(--brand); transform: scaleY(clamp(0, calc(var(--scene-p, ${N}) / ${N}), 1)); transform-origin: top center; }
        .pk-node { position: absolute; left: 4px; width: 16px; height: 16px; border-radius: 50%; top: calc((var(--i) * 2 + 1) / ${N * 2} * 100% - 8px); background: var(--brand); box-shadow: 0 0 0 3px var(--bg-elevated); }
        /* One cell for four tiers; the newest on top, the one before at 0.96 under it. */
        .pk-tiers { list-style: none; display: grid; }
        .pk-tiers > * { grid-area: 1 / 1; align-self: center; }
        .pk-tier {
          position: relative; display: flex; flex-direction: column; gap: clamp(4px, 1vh, 8px);
          padding: clamp(10px, 1.5vh, 20px); background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
          --done: clamp(0, calc((var(--scene-p, 0) - var(--step, 1) + 0.35) / 0.35), 1);
          opacity: var(--sr, 1);
          transform: translate3d(0, calc((1 - var(--sr, 1)) * 16px), 0) scale(calc(1 - 0.04 * var(--done)));
          z-index: calc(var(--i, 0) + 1);
        }
        .pk-tier:last-child { --done: 0; }
        .m-scene--static .pk-tiers { gap: var(--space-3); }
        .m-scene--static .pk-tiers > * { grid-area: auto; }
        .m-scene--static .pk-tier { transform: none; opacity: 1; box-shadow: none; }
        .m-scene--static .pk-pills, .m-scene--static .pk-rail { display: none; }
        .m-scene--static .pk-body { grid-template-columns: 1fr; }
        .pk-tier-n { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--brand-text); }
        .pk-tier-of { color: var(--text-muted); }
        .pk-name { font-size: clamp(1.0625rem, 2.5vh, 1.25rem); font-weight: 700; color: var(--text); }
        .pk-line { font-size: clamp(0.95rem, 2.1vh, 1.0625rem); color: var(--text-secondary); line-height: 1.45; }
        .pk-contents { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
        .pk-chip { display: inline-flex; align-items: center; min-height: 24px; padding: 0 9px; border: 1px solid var(--border-light); border-radius: 999px; font-size: 0.78rem; color: var(--text); background: var(--bg-elevated); }
        .pk-step { font-size: clamp(0.875rem, 1.9vh, 0.9375rem); line-height: 1.5; color: var(--brand-text); }
        .pk-step-label { font-weight: 700; }
        .pk-bar { display: block; width: calc(var(--w) * 100%); height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; }
        .pk-bar-fill { display: block; width: 100%; height: 100%; border-radius: inherit; background: var(--brand); transform: scaleX(var(--sr, 1)); transform-origin: left center; }
        .pk-foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2) var(--space-6); }
        .pk-note { font-size: clamp(0.95rem, 2.1vh, 1.0625rem); color: var(--text); }
        @media (max-width: 767px) { .pk-foot .btn { width: 100%; justify-content: center; } }
        /* A short phone (under 700px tall) cannot hold the tier's chip list,
           the pills and the intro with the rest: the chips and the pills
           are the parts that go, the tier's name, line and step stay. */
        @media (max-width: 767px) and (max-height: 700px) {
          .pk-contents, .pk-pills, .pk-intro { display: none; }
        }
      `}</style>
    </Scene>
  );
}
