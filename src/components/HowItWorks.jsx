import { useCallback, useRef } from 'react';
import { Scene, useScrollEngine, stepReveal } from '../marketing/motion';

const STEPS = [
  { n: 1, title: 'A free call', desc: 'Twenty minutes to talk through what you need. No pitch, no pressure.' },
  { n: 2, title: 'A plan', desc: 'You get a clear scope and timeline before anything starts.' },
  { n: 3, title: 'Launch', desc: 'I design and build it, you review, we ship. You own everything.' },
];

/* Scene 7, how it works (Site Prompt 11): four steps. Step 1 is the
 * heading; steps 2 to 4 are the three numbered steps, each staying once
 * revealed, so by step 4 all three sit under the heading. The number is
 * one glyph, never two stacked: it counts up from 00 in the brand red
 * display face as its step arrives (the one place text changes per
 * frame, written straight to the DOM from the scene's onProgress, never
 * through React), fading in with its row. A real phone caught the first
 * build of this (Site Prompt 12, bug 3): a muted "00" sat permanently
 * behind the live digit in the same grid cell, and opaque text does not
 * occlude what is behind it in the gaps of its own glyphs, so a live "1"
 * over a ghost "0" showed both strokes smeared together. One element
 * now, hidden until its step, so there is nothing behind it to show
 * through and nothing painted for a row that has not arrived. */
export default function HowItWorks({ tone = 'a' }) {
  const nums = useRef([]);
  const state = useScrollEngine();
  const live = state !== 'off';
  const onProgress = useCallback((p) => {
    STEPS.forEach((s, i) => {
      const el = nums.current[i]; if (!el) return;
      const t = stepReveal(p, i + 2);
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
              <span className="hiw-n display" aria-hidden="true" ref={el => { nums.current[i] = el; }}>{live ? '00' : `0${s.n}`}</span>
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
          display: grid; grid-template-columns: auto 1fr; gap: var(--space-4); align-items: center;
          padding: clamp(10px, 4.2vh, 44px) 0; border-top: 1px solid var(--border);
        }
        /* One glyph, never a ghost stacked behind it: before its step the
           colour reads as muted text (5.4:1 on the ground, the reserved
           row a screen reader and a contrast checker both see), and as
           --sr runs 0 to 1 the colour blends to brand red while the JS
           count runs. color-mix with a plain colour declared first, so a
           browser that does not know color-mix keeps the muted colour
           rather than showing nothing. */
        .hiw-n {
          font-size: clamp(2.6rem, 9.5vh, 5.5rem); line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; min-width: 2.2ch;
          color: var(--brand-text);
        }
        .m-scene--pinned .hiw-n { opacity: var(--sr, 1); }
        .hiw-step:last-child { padding-bottom: 0; }
        .hiw-h { font-size: clamp(1.1rem, 2.8vh, 1.5rem); font-weight: 700; color: var(--text); }
        .hiw-desc { margin-top: clamp(2px, 0.8vh, 8px); font-size: clamp(0.95rem, 2.3vh, 1.125rem); line-height: 1.5; color: var(--text-secondary); max-width: 48ch; }
        .m-scene--pinned .hiw-text { opacity: var(--sr, 1); transform: translate3d(0, calc((1 - var(--sr, 1)) * 12px), 0); will-change: opacity, transform; }
      `}</style>
    </Scene>
  );
}
