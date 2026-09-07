import { Reveal } from '../marketing/motion';
import Wordmark from './Wordmark';

/* Site Prompt 4, Part 1.8: the final CTA, wordmark, the one line, Book a
 * Meeting, the contact email. The footer that follows is rendered by
 * App.jsx, not here. */
export default function CTA() {
  return (
    <section className="cta section">
      <Reveal as="div" className="wrap cta-inner">
        <Wordmark size={28} className="cta-wordmark" />
        <h2 className="cta-title">Your vision, our creation.</h2>
        <a href="/book" className="btn btn-primary cta-btn">Book a Meeting</a>
        <a href="mailto:contact@visualizeclients.com" className="cta-email">contact@visualizeclients.com</a>
      </Reveal>
      <style>{`
        .cta {
          position: relative;
          background: linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 100%);
          border-top: 1px solid var(--border);
        }
        .cta-inner {
          text-align: center; display: flex; flex-direction: column;
          align-items: center; gap: var(--space-5);
        }
        .cta-wordmark { margin-bottom: var(--space-2); }
        .cta-title {
          font-size: clamp(1.75rem, 3.5vw, 2.5rem); font-weight: 800;
          letter-spacing: -0.02em; color: var(--text);
        }
        .cta-btn { padding: var(--space-4) var(--space-8); font-size: 1rem; }
        .cta-email {
          display: inline-flex; align-items: center; min-height: 44px;
          font-size: 0.9375rem; color: var(--text-secondary);
        }
        .cta-email:hover { color: var(--text); }
      `}</style>
    </section>
  );
}
