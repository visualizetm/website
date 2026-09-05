import { Link } from 'react-router-dom';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import Calendar from '@untitled-ui/icons-react/build/esm/Calendar';
import Image01 from '@untitled-ui/icons-react/build/esm/Image01';
import useReveal from '../hooks/useReveal';

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="hv-glow" />
      <div className="hv-card hv-card--brand">
        <div className="hv-card-dot hv-card-dot--red" />
        <div className="hv-card-lines">
          <div className="hv-line hv-line--short" />
          <div className="hv-line hv-line--medium" />
        </div>
        <div className="hv-card-icon">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="hv-card-label">Brand Identity</span>
      </div>
      <div className="hv-screen">
        <div className="hv-screen-bar"><span /><span /><span /></div>
        <div className="hv-screen-body">
          <div className="hv-screen-hero-block">
            <div className="hv-screen-line hv-screen-line--title" />
            <div className="hv-screen-line hv-screen-line--sub" />
          </div>
          <div className="hv-screen-grid">
            <div className="hv-screen-card hv-screen-card--1" />
            <div className="hv-screen-card hv-screen-card--2" />
            <div className="hv-screen-card hv-screen-card--3" />
          </div>
          <div className="hv-screen-btn" />
        </div>
      </div>
      <div className="hv-card hv-card--web">
        <div className="hv-card-dot hv-card-dot--green" />
        <div className="hv-card-lines">
          <div className="hv-line hv-line--medium" />
          <div className="hv-line hv-line--short" />
        </div>
        <div className="hv-card-icon">
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke="var(--brand)" strokeWidth="1.8" />
            <path d="M8 21h8M12 17v4" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <span className="hv-card-label">Website Live</span>
      </div>
      <div className="hv-card hv-card--print">
        <div className="hv-card-dot hv-card-dot--blue" />
        <span className="hv-card-label">Print Ready</span>
      </div>
      <div className="hv-orbit"><div className="hv-orbit-dot" /></div>
    </div>
  );
}

export default function Hero() {
  const leftRef  = useReveal();
  const rightRef = useReveal({ threshold: 0.1 });

  return (
    <section className="hero">
      <div className="hero-bg" aria-hidden="true" />
      <div className="wrap hero-wrap">
        <div className="hero-left reveal" ref={leftRef}>
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Branding · Websites · Print
          </div>
          <h1 className="hero-title">Branding & Websites for Real Businesses</h1>
          <p className="hero-sub">
            I design the visuals and build the digital foundation your business needs to show up professionally.
          </p>
          <div className="hero-cta">
            <Link to="/start" className="btn btn-primary hero-btn-primary">
              Start a Project
              <ArrowRight width={16} height={16} />
            </Link>
            <Link to="/work" className="btn btn-secondary hero-btn-secondary">
              <Image01 width={17} height={17} />
              View My Work
              <ArrowRight width={15} height={15} className="hero-btn-arrow" />
            </Link>
          </div>
          <div className="hero-stats">
            {[
              { num: '50+', label: 'Clients Served' },
              { num: '100%', label: 'Custom Work' },
              { num: '1', label: 'Person Studio' },
            ].map(s => (
              <div key={s.label} className="hero-stat">
                <span className="hero-stat-num">{s.num}</span>
                <span className="hero-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hero-right reveal-right" ref={rightRef}>
          <HeroVisual />
        </div>
      </div>
      <style>{`
        .hero {
          position: relative; min-height: 90vh;
          display: flex; align-items: center;
          padding: var(--space-24) 0 var(--space-16); overflow: hidden;
        }
        .hero-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 90% 60% at 60% 40%, rgba(212,76,67,0.07) 0%, transparent 55%),
            linear-gradient(180deg, var(--bg) 0%, var(--bg-elevated) 100%);
          pointer-events: none;
        }
        .hero-bg::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0;
          height: 120px; background: linear-gradient(to bottom, transparent, var(--bg));
          pointer-events: none;
        }
        .hero-wrap {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--space-16); align-items: center;
        }
        @media (max-width: 900px) {
          .hero-wrap { grid-template-columns: 1fr; text-align: center; gap: var(--space-12); }
          .hero-left .hero-cta { justify-content: center; }
          .hero-right { order: -1; }
          .hero-stats { justify-content: center; }
          .hero-eyebrow { justify-content: center; }
          .hero-sub { margin-left: auto; margin-right: auto; }
        }
        .hero-eyebrow {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.75rem; font-weight: 700; letter-spacing: 0.15em;
          text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-5);
        }
        .hero-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--brand);
          box-shadow: 0 0 8px rgba(212,76,67,0.7);
          animation: heroDotPulse 2s ease-in-out infinite;
        }
        @keyframes heroDotPulse {
          0%,100% { box-shadow: 0 0 4px rgba(212,76,67,0.5); }
          50%      { box-shadow: 0 0 14px rgba(212,76,67,1); }
        }
        .hero-title {
          font-size: clamp(2.4rem, 5.5vw, 3.8rem); font-weight: 900;
          letter-spacing: -0.03em; line-height: 1.08;
          margin-bottom: var(--space-6); color: var(--text);
        }
        .hero-sub {
          font-size: clamp(1rem, 2vw, 1.2rem); color: var(--text-secondary);
          max-width: 440px; margin-bottom: var(--space-10); line-height: 1.65;
        }
        .hero-cta { display: flex; flex-wrap: wrap; gap: var(--space-3); }
        .hero-btn-primary { display: inline-flex; align-items: center; gap: 7px; }
        .hero-btn-secondary { display: inline-flex; align-items: center; gap: 7px; }
        .hero-btn-arrow { transition: transform 0.2s; }
        .hero-btn-secondary:hover .hero-btn-arrow { transform: translateX(3px); }
        .hero-stats {
          display: flex; gap: var(--space-8); margin-top: var(--space-10);
          padding-top: var(--space-6); border-top: 1px solid var(--glass-border);
        }
        .hero-stat { display: flex; flex-direction: column; gap: 2px; }
        .hero-stat-num { font-size: 1.375rem; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
        .hero-stat-label { font-size: 0.75rem; color: var(--text-muted); }

        /* HeroVisual */
        .hero-visual {
          position: relative; width: 100%; aspect-ratio: 1 / 0.9;
          max-width: 480px; margin: 0 auto;
        }
        .hv-glow {
          position: absolute; top: 15%; left: 10%; right: 10%; bottom: 0;
          background: radial-gradient(ellipse at center, rgba(212,76,67,0.14) 0%, transparent 65%);
          animation: hvGlow 5s ease-in-out infinite; pointer-events: none;
        }
        @keyframes hvGlow { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
        .hv-screen {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%,-50%); width: 68%;
          background: rgba(20,20,24,0.92);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
          animation: hvFloat 6s ease-in-out infinite;
        }
        @keyframes hvFloat { 0%,100%{transform:translate(-50%,-50%) translateY(0)} 50%{transform:translate(-50%,-50%) translateY(-8px)} }
        .hv-screen-bar {
          height: 24px; background: rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; padding: 0 10px; gap: 5px;
        }
        .hv-screen-bar span { width: 6px; height: 6px; border-radius: 50%; }
        .hv-screen-bar span:nth-child(1){background:var(--dot-close)}
        .hv-screen-bar span:nth-child(2){background:var(--dot-min)}
        .hv-screen-bar span:nth-child(3){background:var(--dot-max)}
        .hv-screen-body { padding: 12px; }
        .hv-screen-hero-block { margin-bottom: 10px; }
        .hv-screen-line { height: 7px; border-radius: 4px; background: rgba(255,255,255,0.1); margin-bottom: 5px; }
        .hv-screen-line--title { width: 75%; background: rgba(255,255,255,0.18); }
        .hv-screen-line--sub   { width: 55%; }
        .hv-screen-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; margin-bottom: 10px; }
        .hv-screen-card { height: 36px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.07); }
        .hv-screen-card--1{background:rgba(212,76,67,0.15)}
        .hv-screen-card--2{background:rgba(255,255,255,0.05)}
        .hv-screen-card--3{background:rgba(255,255,255,0.03)}
        .hv-screen-btn { height: 20px; width: 45%; border-radius: 4px; background: linear-gradient(135deg, rgba(212,76,67,0.5), rgba(168,58,50,0.4)); border: 1px solid rgba(212,76,67,0.4); }
        .hv-card {
          position: absolute; background: rgba(18,18,22,0.92);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
          padding: 10px 12px; display: flex; align-items: center; gap: 8px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4); backdrop-filter: blur(12px);
          white-space: nowrap;
        }
        .hv-card--brand{top:8%;left:-4%;animation:hvCard1 7s ease-in-out infinite}
        .hv-card--web{bottom:14%;right:-4%;animation:hvCard2 7s ease-in-out infinite 0.8s}
        .hv-card--print{top:58%;left:-8%;animation:hvCard3 7s ease-in-out infinite 1.6s}
        @keyframes hvCard1{0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-6px) rotate(0deg)}}
        @keyframes hvCard2{0%,100%{transform:translateY(0) rotate(1deg)} 50%{transform:translateY(-8px) rotate(0deg)}}
        @keyframes hvCard3{0%,100%{transform:translateY(0) rotate(0.5deg)} 50%{transform:translateY(6px) rotate(-0.5deg)}}
        .hv-card-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;animation:hvDotPulse 2s ease-in-out infinite}
        .hv-card-dot--red  {background:var(--brand);box-shadow:0 0 6px rgba(212,76,67,0.7)}
        .hv-card-dot--green{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,0.7)}
        .hv-card-dot--blue {background:#60a5fa;box-shadow:0 0 6px rgba(96,165,250,0.7)}
        @keyframes hvDotPulse{0%,100%{transform:scale(1)} 50%{transform:scale(1.35)}}
        .hv-card-lines{display:flex;flex-direction:column;gap:4px}
        .hv-line{height:4px;border-radius:2px;background:rgba(255,255,255,0.12)}
        .hv-line--short{width:28px}.hv-line--medium{width:42px}
        .hv-card-label{font-size:0.7rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.05em}
        .hv-orbit {
          position: absolute; top: 50%; left: 50%; width: 82%; height: 82%;
          transform: translate(-50%,-50%); border-radius: 50%;
          border: 1px dashed rgba(212,76,67,0.15);
          animation: hvOrbit 20s linear infinite;
        }
        .hv-orbit-dot {
          position: absolute; top: -4px; left: 50%; width: 8px; height: 8px; margin-left: -4px;
          background: var(--brand); border-radius: 50%;
          box-shadow: 0 0 10px rgba(212,76,67,0.6);
        }
        @keyframes hvOrbit{from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(360deg)}}
        @media (max-width: 600px) {
          .hv-card--brand{left:0}.hv-card--web{right:0}.hv-card--print{left:0}
        }
      `}</style>
    </section>
  );
}
