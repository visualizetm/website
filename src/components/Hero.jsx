import { Link } from 'react-router-dom';
import { Section } from '../marketing/motion';
import Logo from '../ui/Logo';
import { CALENDLY_URL } from '../marketing/links';

/* The hero (the faster landing prompt): text first, nothing waits. The
 * wordmark, the headline, the line and the two buttons paint with the
 * page, no reveal, no image and no engine; the covers that used to cycle
 * behind the headline ride below under Recent projects, where they load
 * lazily. Native scroll, nothing pinned. */
export default function Hero({ tone = 'a' }) {
  return (
    <Section tone={tone} label="Visualize" reveal={false} className="hero">
      <div className="wrap hero-copy">
        <div className="hero-mark"><Logo width={195} /></div>
        <h1 className="hero-title display">Branding and websites for local businesses.</h1>
        <p className="hero-sub">Solo studio in Delaware. Brand, website, print, all in one place.</p>
        <div className="hero-cta">
          <a href={CALENDLY_URL} className="btn btn-primary" target="_blank" rel="noreferrer">Book a free call</a>
          <Link to="/projects" className="btn btn-secondary">See the projects</Link>
        </div>
      </div>
      <style>{`
        .hero { padding-top: calc(84px + clamp(24px, 8vh, 96px)); padding-bottom: clamp(40px, 8vh, 96px); min-height: calc(72 * var(--svh)); display: flex; align-items: center; }
        @media (max-width: 768px) { .hero { padding-top: calc(72px + clamp(24px, 6vh, 64px)); } }
        .hero-copy { display: flex; flex-direction: column; gap: clamp(14px, 3vh, 28px); }
        .hero-mark { display: flex; }
        .hero-title { max-width: 14ch; font-size: clamp(2.25rem, min(11vw, 7.5vh), 5rem); color: var(--text); }
        .hero-title::after { content: ''; display: inline-block; width: 0.22em; height: 0.22em; margin-left: 0.14em; border-radius: 50%; background: var(--brand); vertical-align: baseline; }
        .hero-sub { max-width: 34ch; font-size: clamp(1.0625rem, 2.8vh, 1.375rem); line-height: 1.5; color: var(--text-secondary); }
        .hero-cta { display: flex; flex-wrap: wrap; gap: var(--space-3); }
        @media (max-width: 767px) { .hero-cta .btn { flex: 1 1 100%; justify-content: center; } }
      `}</style>
    </Section>
  );
}
