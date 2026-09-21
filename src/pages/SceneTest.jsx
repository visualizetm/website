import { Scene } from '../marketing/motion';
import { useHead } from '../marketing/useHead';

/* Site Prompt 11, Phase A: the scene engine's proving ground. Four scenes,
 * not linked from anywhere, noindex: a steps=3 scene with text, a steps=6
 * scene with cards, a steps=0 scene, and a steps=4 scene with a custom
 * reveal. scripts/scene-audit.mjs walks it. */
const CARDS = ['Restaurants', 'Shops', 'Services', 'Beauty', 'Auto', 'Creators'];

export default function SceneTest() {
  useHead({ title: 'Scene test', description: 'The scene engine, on its own.', noindex: true });
  return (
    <div className="st">
      <Scene steps={3} tone="a" label="Three steps of text" className="st-a">
        <div className="wrap st-col">
          <h1 data-step="0" className="section-title">A scene with three steps.</h1>
          <p data-step="1" className="st-line">Step one: the first line arrives as the stage begins.</p>
          <p data-step="2" className="st-line">Step two: the second line, under the first, which stays.</p>
          <p data-step="3" className="st-line">Step three: the last line, and then the scene lets go.</p>
        </div>
      </Scene>

      <Scene steps={6} tone="b" label="Six cards" indicator indicatorLabels={CARDS} className="st-b">
        <div className="wrap st-col">
          <h2 data-step="0" className="section-title">Six cards, one per step.</h2>
          <div className="st-grid">
            {CARDS.map((c, i) => (
              <article key={c} data-step={i + 1} className="st-card">
                <h3>{c}</h3>
                <p>Card {i + 1} of 6, revealed at step {i + 1} and held.</p>
              </article>
            ))}
          </div>
        </div>
      </Scene>

      <Scene steps={0} tone="a" label="Not pinned" className="st-c">
        <div className="wrap st-col">
          <h2 data-step="1" className="section-title">A plain section.</h2>
          <p data-step="2" className="st-line">Not pinned: each part reveals as it enters the viewport, in order.</p>
          <p data-step="3" className="st-line">And nothing here holds the scroll.</p>
          <div className="st-grid">
            {['One', 'Two', 'Three', 'Four'].map((c, i) => (
              <article key={c} data-step={4 + i} className="st-card"><h3>{c}</h3><p>A card in a plain section, revealed on entry.</p></article>
            ))}
          </div>
        </div>
      </Scene>

      <Scene steps={4} tone="b" label="Four custom reveals" indicator className="st-d">
        <div className="wrap st-col">
          <h2 data-step="0" className="section-title">Four steps, a custom reveal.</h2>
          <div className="st-tiles">
            {[1, 2, 3, 4].map(n => (
              <div key={n} data-step={n} data-reveal="custom" className="st-tile">
                <span className="st-tile-n">0{n}</span>
                <span className="st-tile-bar" style={{ '--w': n / 4 }}><span /></span>
              </div>
            ))}
          </div>
        </div>
      </Scene>

      <style>{`
        /* Dense on purpose: a stage is one viewport and the audit allows a
           quarter of it empty, so a scene's content is sized to fill three
           quarters at every width, big type and all. */
        .st-col { display: flex; flex-direction: column; gap: var(--space-5); }
        @media (min-width: 861px) { .st-a .st-col { gap: var(--space-6); } }
        /* vh in the clamps: a phone stage is one viewport tall, so the type
           scales with the height it has to fill, not only the width. */
        .st .section-title { font-size: clamp(2rem, max(5vw, 7vh), 4rem); line-height: 1.05; }
        .st-line {
          font-size: clamp(1.25rem, max(2.6vw, 3.2vh), 2.25rem); color: var(--text-secondary); line-height: 1.4; max-width: 34ch;
          padding: clamp(20px, 3vh, 32px) var(--space-6); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-card);
        }
        .st-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
        @media (max-width: 767px) { .st-grid { grid-template-columns: repeat(2, 1fr); } }
        .st-card { padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-card); min-height: clamp(120px, 27vh, 240px); }
        @media (max-width: 767px) { .st .st-card { min-height: 17.5vh; } }
        .st-card h3 { font-size: clamp(1.0625rem, 1.6vw, 1.5rem); color: var(--text); }
        .st-card p { margin-top: var(--space-2); font-size: clamp(0.9rem, 1.2vw, 1.125rem); color: var(--text-secondary); }
        .st-tiles { display: flex; flex-direction: column; gap: var(--space-3); }
        .st-tile { min-height: clamp(60px, 15vh, 130px); }
        @media (max-width: 767px) { .st .st-tile { min-height: 11vh; } }
        .st-c .st-col { padding: var(--space-6) 0; }
        /* The custom reveal: a scale from 0.9 and the bar drawing, both off --sr. */
        .st-tile { display: flex; align-items: center; gap: var(--space-4); opacity: var(--sr, 1); transform: scale(calc(0.9 + 0.1 * var(--sr, 1))); transform-origin: left center; }
        .st-tile-n { font-family: var(--font-display); font-size: clamp(3rem, 10vh, 6rem); line-height: 1; color: var(--brand-text); min-width: 3ch; }
        .st-tile-bar { display: block; flex: 0 0 auto; width: calc(var(--w) * 60%); height: 12px; border-radius: 4px; background: var(--border); overflow: hidden; }
        .st-tile-bar > span { display: block; height: 100%; background: var(--brand); transform: scaleX(var(--sr, 1)); transform-origin: left center; }
      `}</style>
    </div>
  );
}
