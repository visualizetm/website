import { useCallback, useRef } from 'react';
import { Scene, useScrollEngine, REVEAL_SPAN } from '../marketing/motion';

const STEPS = [
  { n: 1, title: 'A free call', desc: 'Twenty minutes to talk through what you need. No pitch, no pressure.' },
  { n: 2, title: 'A plan', desc: 'You get a clear scope and timeline before anything starts.' },
  { n: 3, title: 'Launch', desc: 'I design and build it, you review, we ship. You own everything.' },
];

/* Scene 7, how it works (Site Prompt 11): four steps. Step 1 is the
 * heading; steps 2 to 4 are the three numbered steps, each staying once
 * revealed, so by step 4 all three sit under the heading. The number is
 * in the brand red display face and counts up from 00 as its step
 * arrives (the one place text changes per frame, written straight to the
 * DOM from the scene's onProgress, never through React). Before its step
 * a row shows a muted 00 and nothing else: the reserved space the stage
 * centres, so the heading is never over a hole and the stage never has
 * less on it than the three rows. */
export default function HowItWorks({ tone = 'a' }) {
  const nums = useRef([]);
  const state = useScrollEngine();
  const live = state !== 'off';
  const onProgress = useCallback((p) => {
    STEPS.forEach((s, i) => {
      const el = nums.current[i]; if (!el) return;
      const t = Math.max(0, Math.min(1, (p - (i + 1)) / REVEAL_SPAN));
      const v = `0${Math.round(t * s.n)}`;
      if (el.textContent !== v) el.textContent = v;
    });
  }, []);
  return (
    <Scene steps={4} tone={tone} label="How it works" className="hiw" onProgress={onProgress}>
      <div className="wrap hiw-col">
        <h2 data-step="1" className="section-title hiw-title">How it works</h2>
        <ol className="hiw-list">
          {STEPS.map((s, i) => (
            <li key={s.n} data-step={i + 2} data-reveal="custom" className="hiw-step">
              <span className="hiw-num" aria-hidden="true">
                <span className="hiw-n hiw-n--ghost display">00</span>
                <span className="hiw-n display" ref={el => { nums.current[i] = el; }}>{live ? '00' : `0${s.n}`}</span>
              </span>
              <div className="hiw-text">
                <h3 className="hiw-h"><span className="visually-hidden">Step {s.n}: </span>{s.title}</h3>
                <p className="hiw-desc">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <style>{`
        .hiw-col { display: flex; flex-direction: column; gap: clamp(12px, 2.6vh, 32px); }
        .hiw-title { font-size: clamp(1.9rem, max(4vw, 5.6vh), 3.25rem); line-height: 1.05; }
        .hiw-list { list-style: none; display: flex; flex-direction: column; }
        .hiw-step {
          display: grid; grid-template-columns: minmax(3.2ch, auto) 1fr; gap: var(--space-4); align-items: center;
          padding: clamp(10px, 2.8vh, 32px) 0; border-top: 1px solid var(--border);
        }
        /* Two numerals in one cell: a muted 00 that is always there (the
           reserved row, and 5.4:1 on the ground so it passes as text) and
           the brand red counter that fades in over it as its step arrives. */
        .hiw-num { display: grid; }
        .hiw-num > * { grid-area: 1 / 1; }
        .hiw-n { font-size: clamp(2.6rem, 8.5vh, 5rem); line-height: 1; color: var(--brand-text); font-variant-numeric: tabular-nums; }
        .hiw-n--ghost { color: var(--text-muted); }
        .m-scene--static .hiw-n--ghost { display: none; }
        .hiw-h { font-size: clamp(1.1rem, 2.6vh, 1.5rem); font-weight: 700; color: var(--text); }
        .hiw-desc { margin-top: clamp(2px, 0.8vh, 8px); font-size: clamp(0.95rem, 2.1vh, 1.125rem); line-height: 1.5; color: var(--text-secondary); max-width: 48ch; }
        /* The custom reveal: the number is a faint 00 before its step (the
           reserved row), then counts and brightens; the text fades in. */
        .m-scene--pinned .hiw-n:not(.hiw-n--ghost) { opacity: var(--sr, 1); }
        .m-scene--pinned .hiw-text { opacity: var(--sr, 1); transform: translate3d(0, calc((1 - var(--sr, 1)) * 12px), 0); }
      `}</style>
    </Scene>
  );
}
