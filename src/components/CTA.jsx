import { Reveal } from '../marketing/motion';
import Wordmark from './Wordmark';
import { CALENDLY_URL, CONTACT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../marketing/links';

/* Site Prompt 4, Part 1.8, updated by Site Prompt 6, Part 2.8: the last
 * thing on the page. The wordmark, the one line, the free call, and the
 * two ways to reach Rob without booking anything. The footer that follows
 * is rendered by App.jsx, not here. */
export default function CTA() {
  return (
    <section className="cta section">
      <Reveal as="div" className="wrap cta-inner">
        <Wordmark size={28} className="cta-wordmark" />
        <h2 className="cta-title">Your vision, our creation.</h2>
        <a href={CALENDLY_URL} className="btn btn-primary cta-btn" target="_blank" rel="noreferrer">Book a free call</a>
        <div className="cta-reach">
          <a href={`mailto:${CONTACT_EMAIL}`} className="cta-link">{CONTACT_EMAIL}</a>
          <a href={INSTAGRAM_URL} className="cta-link" target="_blank" rel="noreferrer">{INSTAGRAM_HANDLE}</a>
        </div>
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
        .cta-reach { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-6); }
        .cta-link {
          display: inline-flex; align-items: center; min-height: 44px;
          font-size: 0.9375rem; color: var(--text-secondary);
        }
        .cta-link:hover { color: var(--text); }
      `}</style>
    </section>
  );
}
