import { Section } from '../marketing/motion';
import Logo from '../ui/Logo';
import { CALENDLY_URL, CONTACT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../marketing/links';

/* The close: the wordmark, the line, the one button, the email and
 * Instagram, then the footer. One section revealed once. */
export default function CTA({ tone = 'b' }) {
  return (
    <Section tone={tone} label="Get in touch" className="cta">
      <div className="wrap cta-inner">
        <div data-step="0"><Logo width={160} className="cta-wordmark" /></div>
        <h2 data-step="1" className="cta-title">Your vision, our creation.</h2>
        <div data-step="2"><a href={CALENDLY_URL} className="btn btn-primary cta-btn" target="_blank" rel="noreferrer">Book a free call</a></div>
        <div data-step="3" className="cta-reach">
          <a href={`mailto:${CONTACT_EMAIL}`} className="cta-link">{CONTACT_EMAIL}</a>
          <a href={INSTAGRAM_URL} className="cta-link" target="_blank" rel="noreferrer">{INSTAGRAM_HANDLE}</a>
        </div>
      </div>
      <style>{`
        .cta-inner { text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--space-5); }
        .cta-wordmark { opacity: 0.9; }
        .cta-title { font-size: clamp(2rem, 5vw, 3.5rem); line-height: 1.05; color: var(--text); max-width: 16ch; }
        .cta-btn { min-width: 220px; justify-content: center; }
        .cta-reach { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-3) var(--space-6); }
        .cta-link { min-height: 44px; display: inline-flex; align-items: center; color: var(--text-secondary); font-size: 0.95rem; }
        .cta-link:hover { color: var(--text); }
      `}</style>
    </Section>
  );
}
