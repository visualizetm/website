import Hero from '../components/Hero';
import Trust from '../components/Trust';
import Services from '../components/Services';
import ShowcasePreview from '../components/ShowcasePreview';
import Process from '../components/Process';
import Testimonials from '../components/Testimonials';
import CTA from '../components/CTA';

function PrintsSection() {
  return (
    <section className="prints-section section">
      <div className="prints-section-bg" aria-hidden="true" />
      <div className="wrap">
        <div className="prints-section-header">
          <p className="prints-section-eyebrow">Custom Prints</p>
          <h2 className="prints-section-title">Stickers & Vinyl, Designed and Produced In-House</h2>
          <p className="prints-section-sub">
            I produce custom stickers and vinyl prints for branding, packaging, vehicles, and more.
            Select your product below to configure your order and get a quote.
          </p>
        </div>

        <div className="prints-cards">
          {/* Stickers card */}
          <a href="/prints?type=stickers" target="_blank" rel="noopener noreferrer" className="prints-card prints-card--stickers">
            <div className="prints-card-glow" aria-hidden="true" />
            <div className="prints-card-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="2.5" />
                <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" />
                <circle cx="32" cy="32" r="4.5" fill="currentColor" />
                <circle cx="20" cy="14" r="3" fill="currentColor" opacity="0.4" />
                <circle cx="46" cy="18" r="2" fill="currentColor" opacity="0.3" />
                <circle cx="50" cy="44" r="2.5" fill="currentColor" opacity="0.4" />
              </svg>
            </div>
            <h3 className="prints-card-title">Custom Stickers</h3>
            <p className="prints-card-desc">
              Die-cut, circle, square, and rectangle in a clean glossy finish.
              Perfect for branding, packaging, and giveaways.
            </p>
            <ul className="prints-card-features">
              <li>Die-cut to any shape</li>
              <li>Glossy finish</li>
              <li>Waterproof, indoor use</li>
              <li>From $0.75 per sticker</li>
            </ul>
            <div className="prints-card-cta">
              Configure Order
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </a>

          {/* Vinyl card */}
          <a href="/prints?type=vinyl" target="_blank" rel="noopener noreferrer" className="prints-card prints-card--vinyl">
            <div className="prints-card-glow" aria-hidden="true" />
            <div className="prints-card-icon" aria-hidden="true">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="16" width="48" height="32" rx="6" stroke="currentColor" strokeWidth="2.5" />
                <path d="M8 26h48" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
                <path d="M20 16v32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
                <path d="M36 34l5-5-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="50" cy="12" r="3" fill="currentColor" opacity="0.4" />
                <circle cx="14" cy="52" r="2" fill="currentColor" opacity="0.3" />
              </svg>
            </div>
            <h3 className="prints-card-title">Vinyl Prints</h3>
            <p className="prints-card-desc">
              Durable, weatherproof vinyl for vehicles, windows, walls, and storefronts.
              Matte, gloss, and holographic finishes. Built to last outdoors.
            </p>
            <ul className="prints-card-features">
              <li>Weatherproof & outdoor-rated</li>
              <li>Vehicle, window & wall-ready</li>
              <li>Custom sizes available</li>
              <li>Priced by quote</li>
            </ul>
            <div className="prints-card-cta">
              Configure Order
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4 10h12M10 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </a>
        </div>
      </div>

      <style>{`
        .prints-section {
          position: relative;
          background: var(--bg-elevated);
          border-top: 1px solid var(--glass-border);
          overflow: hidden;
        }
        .prints-section-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 60% 60% at 15% 50%, rgba(212,76,67,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 60% at 85% 50%, rgba(212,76,67,0.05) 0%, transparent 60%);
          pointer-events: none;
        }
        .prints-section-header {
          max-width: 640px;
          margin-bottom: var(--space-12);
        }
        .prints-section-eyebrow {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--brand);
          margin-bottom: var(--space-3);
        }
        .prints-section-title {
          font-size: clamp(1.75rem, 3.5vw, 2.5rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text);
          margin-bottom: var(--space-4);
        }
        .prints-section-sub {
          font-size: 1.0625rem;
          color: var(--text-secondary);
          line-height: 1.65;
        }
        .prints-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-6);
        }
        @media (max-width: 768px) {
          .prints-cards { grid-template-columns: 1fr; }
        }
        .prints-card {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: var(--space-10);
          border-radius: var(--radius-lg);
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.22s;
        }
        .prints-card:hover {
          border-color: var(--brand);
          box-shadow: 0 16px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(212,76,67,0.2);
          transform: translateY(-3px);
        }
        .prints-card-glow {
          position: absolute;
          top: -40%;
          right: -30%;
          width: 70%;
          height: 120%;
          background: radial-gradient(circle, rgba(212,76,67,0.12) 0%, transparent 65%);
          pointer-events: none;
          transition: opacity 0.3s;
          opacity: 0;
        }
        .prints-card:hover .prints-card-glow { opacity: 1; }
        .prints-card-icon {
          width: 64px;
          height: 64px;
          color: var(--brand);
          margin-bottom: var(--space-5);
        }
        .prints-card-icon svg { width: 100%; height: 100%; }
        .prints-card-title {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text);
          margin-bottom: var(--space-3);
        }
        .prints-card-desc {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          line-height: 1.65;
          margin-bottom: var(--space-5);
          flex: 1;
        }
        .prints-card-features {
          list-style: none;
          padding: 0;
          margin: 0 0 var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .prints-card-features li {
          font-size: 0.875rem;
          color: var(--text-secondary);
          padding-left: var(--space-5);
          position: relative;
        }
        .prints-card-features li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.55em;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--brand);
        }
        .prints-card-cta {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--brand);
          transition: gap 0.2s;
        }
        .prints-card:hover .prints-card-cta { gap: var(--space-3); }
        .prints-card-cta svg {
          width: 18px;
          height: 18px;
          transition: transform 0.2s;
        }
        .prints-card:hover .prints-card-cta svg { transform: translateX(3px); }
      `}</style>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Trust />
      <Services />
      <PrintsSection />
      <ShowcasePreview />
      <Process />
      <Testimonials />
      <CTA />
    </>
  );
}
