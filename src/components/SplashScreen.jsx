import { useState, useEffect } from 'react';

export default function SplashScreen({ name, subtitle, duration, onDone }) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setExiting(true), duration);
    const t2 = setTimeout(() => onDone(), duration + 380);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [duration, onDone]);

  return (
    <>
      <div className={`vz-splash ${exiting ? 'vz-splash--exit' : ''}`}>
        <div className="vz-splash-inner">
          <div className="vz-splash-logo-wrap">
            <div className="vz-splash-glow" />
            <img src="/VisualizeWordmark.png" alt="Visualize Studio" className="vz-splash-logo" />
          </div>
          {name && <p className="vz-splash-greeting">Welcome back, {name.split(' ')[0]}</p>}
          <p className="vz-splash-sub">{subtitle}</p>
          <div className="vz-splash-track" style={{ '--dur': `${duration}ms` }}>
            <div className="vz-splash-bar" />
          </div>
        </div>
      </div>
      <style>{splashStyles}</style>
    </>
  );
}

const splashStyles = `
  .vz-splash {
    position: fixed; inset: 0; z-index: 9999;
    background: #ffffff;
    display: flex; align-items: center; justify-content: center;
    animation: vzSplashIn 0.25s ease both;
  }
  .vz-splash--exit {
    animation: vzSplashExit 0.38s ease-in both;
    pointer-events: none;
  }
  @keyframes vzSplashIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes vzSplashExit { from { transform: translateY(0); } to { transform: translateY(-100%); } }

  .vz-splash-inner {
    display: flex; flex-direction: column; align-items: center; gap: 18px;
    text-align: center; padding: 0 40px; max-width: 340px; width: 100%;
  }

  /* Logo + glow */
  .vz-splash-logo-wrap {
    position: relative; display: flex; align-items: center; justify-content: center;
    margin-bottom: 4px;
    animation: vzLogoIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  @keyframes vzLogoIn {
    from { opacity: 0; transform: scale(0.78) translateY(10px); }
    to   { opacity: 1; transform: scale(1)    translateY(0);    }
  }
  .vz-splash-glow {
    position: absolute; inset: -32px;
    background: radial-gradient(circle, rgba(212,76,67,0.28) 0%, rgba(212,76,67,0.06) 55%, transparent 75%);
    border-radius: 50%;
    animation: vzGlowPulse 2.4s ease-in-out infinite alternate;
  }
  @keyframes vzGlowPulse {
    from { opacity: 0.55; transform: scale(0.88); }
    to   { opacity: 1;    transform: scale(1.12); }
  }
  .vz-splash-logo { height: 36px; position: relative; z-index: 1; }

  /* Text */
  .vz-splash-greeting {
    font-size: 1.3rem; font-weight: 800; letter-spacing: -0.025em;
    color: #1b1b1c;
    animation: vzTextIn 0.45s 0.18s ease both;
    margin: 0;
  }
  .vz-splash-sub {
    font-size: 0.875rem; color: rgba(27,27,28,0.5);
    animation: vzTextIn 0.45s 0.25s ease both;
    margin-top: -10px;
  }
  @keyframes vzTextIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0);   }
  }

  /* Progress bar */
  .vz-splash-track {
    width: 100%; height: 2px;
    background: rgba(0,0,0,0.08);
    border-radius: 999px; overflow: hidden;
    animation: vzTextIn 0.45s 0.32s ease both;
  }
  .vz-splash-bar {
    height: 100%; width: 0%;
    background: linear-gradient(90deg, #d44c43 0%, rgba(212,76,67,0.55) 100%);
    border-radius: 999px;
    animation: vzBarFill var(--dur, 1000ms) 0.35s cubic-bezier(0.4,0,0.2,1) both;
  }
  @keyframes vzBarFill { from { width: 0%; } to { width: 100%; } }
`;
