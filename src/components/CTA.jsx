import { IconCalendar, IconArrowRight } from '@tabler/icons-react';

export default function CTA() {
  return (
    <section className="cta section">
      <div className="cta-bg" aria-hidden="true" />
      <div className="wrap cta-inner">
        <h2 className="cta-title">Ready to Build a Brand and Website You&apos;re Proud Of?</h2>
        <a href="/book" className="btn btn-primary cta-btn">
          <IconCalendar size={18} stroke={1.8} />
          Book a Consultation
          <IconArrowRight size={16} stroke={1.8} className="cta-arrow" />
        </a>
      </div>
      <style>{`
        .cta {
          position: relative;
          background: linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 100%);
          border-top: 1px solid var(--glass-border);
        }
        .cta-bg {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 100% 80% at 50% 50%, rgba(212,76,67,0.12) 0%, transparent 65%);
          pointer-events: none;
        }
        .cta-inner { position: relative; z-index: 1; text-align: center; }
        .cta-title {
          font-size: clamp(1.75rem, 3.5vw, 2.5rem); font-weight: 800;
          letter-spacing: -0.02em; line-height: 1.2; margin-bottom: var(--space-8);
          max-width: 16ch; margin-left: auto; margin-right: auto; color: var(--text);
        }
        .cta-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: var(--space-4) var(--space-8); font-size: 1rem;
        }
        .cta-arrow { transition: transform 0.2s; }
        .cta-btn:hover .cta-arrow { transform: translateX(3px); }
      `}</style>
    </section>
  );
}
