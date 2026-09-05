import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ShellCrash from './shell/ShellCrash';
import './fonts.css';
import './index.css';

// Deterministic star field, stable across renders, no Math.random
const STARS = (() => {
  let s = 0xdeadbeef;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
  return Array.from({ length: 130 }, () => ({
    cx: (next() * 100).toFixed(2) + '%',
    cy: (next() * 100).toFixed(2) + '%',
    r:  next() > 0.85 ? 2 : next() > 0.55 ? 1.5 : 1,
    o:  (0.15 + next() * 0.7).toFixed(2),
    delay: (next() * 6).toFixed(2),
    dur:   (2.5 + next() * 3.5).toFixed(2),
  }));
})();

function Maintenance({ onUnlock }) {
  const [pw, setPw]       = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const ok = onUnlock(pw.trim());
    if (!ok) {
      setError(true);
      setTimeout(() => setError(false), 600);
    }
  };

  return (
    <div className="uc-screen">
      {/* Animated star field */}
      <svg className="uc-stars-svg" aria-hidden="true">
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="white"
            className="uc-star"
            style={{ '--o': s.o, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
          />
        ))}
      </svg>

      <div className="uc-wrap">
        <p className="uc-brand-name">VISUALIZE.</p>

        {/* Rocket + orbit ring */}
        <div className="uc-rocket-area" aria-hidden="true">
          <svg className="uc-orbit-ring" viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="150" cy="60" rx="138" ry="48"
              fill="none" stroke="rgba(212,76,67,0.22)"
              strokeWidth="1.5" strokeDasharray="7 5" />
          </svg>
          <svg className="uc-rocket-svg" viewBox="0 0 80 140" xmlns="http://www.w3.org/2000/svg">
            {/* Body */}
            <path d="M40 8 C28 8 18 30 18 72 L62 72 C62 30 52 8 40 8 Z" fill="var(--brand)" />
            {/* Nose cone highlight */}
            <path d="M40 8 C34 8 28 18 28 32 L52 32 C52 18 46 8 40 8 Z" fill="var(--brand-light)" />
            {/* Body shadow */}
            <path d="M52 32 L52 72 C47 70 40 70 40 70 L40 8 C46 8 52 18 52 32 Z" fill="rgba(0,0,0,0.18)" />
            {/* Window */}
            <circle cx="40" cy="52" r="9"   fill="#152855" stroke="#3a6cb5" strokeWidth="2.5" />
            <circle cx="40" cy="52" r="5.5" fill="#1e3d7a" />
            <circle cx="37" cy="49" r="2"   fill="#4a7dd5" opacity="0.65" />
            {/* Left fin */}
            <path d="M18 72 L4  90 L18 86 Z" fill="var(--brand-dark)" />
            {/* Right fin */}
            <path d="M62 72 L76 90 L62 86 Z" fill="var(--brand-dark)" />
            {/* Nozzle */}
            <ellipse cx="40" cy="76" rx="13" ry="5" fill="#7c2b26" />
            {/* Flames */}
            <path d="M29 78 C32 96 37 108 40 122 C43 108 48 96 51 78 Z" fill="#e05010" opacity="0.95" />
            <path d="M32 78 C35 92 38 102 40 114 C42 102 45  92 48 78 Z" fill="#f08020" />
            <path d="M35 78 C37 88 39  96 40 106 C41  96 43  88 45 78 Z" fill="#ffcc00" />
            <path d="M37 78 C38 84 39.5 90 40  98 C40.5 90 42 84 43 78 Z" fill="#fffacc" opacity="0.8" />
          </svg>
        </div>

        {/* Badge */}
        <div className="uc-badge">
          <span className="uc-dot" aria-hidden="true" />
          UNDER CONSTRUCTION
        </div>

        {/* Headline */}
        <h1 className="uc-headline">
          WE&apos;RE<br />
          <span className="uc-gold">LAUNCHING</span><br />
          SOMETHING NEW
        </h1>

        {/* Subtitle */}
        <p className="uc-sub">
          <strong>Visualize.</strong> is working on the website.
          <br />We&apos;ll be back up and running shortly.
        </p>

        <hr className="uc-divider" />

        <p className="uc-contact">
          Questions? Email{' '}
          <a href="mailto:contact@visualizeclients.com" className="uc-phone">contact@visualizeclients.com</a>
        </p>

        {/* Password gate */}
        <form className={`uc-form${error ? ' uc-form--error' : ''}`} onSubmit={handleSubmit}>
          <input
            type="password"
            className="uc-pw-input"
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(false); }}
            placeholder="Enter password to access site"
            autoComplete="current-password"
          />
          <button type="submit" className="uc-pw-btn">Enter</button>
          {error && <span className="uc-pw-error">Incorrect password</span>}
        </form>

        <p className="uc-footer-credit">BUILT BY VISUALIZE.</p>
      </div>
    </div>
  );
}

const maintenanceMode     = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
const maintenancePassword = import.meta.env.VITE_MAINTENANCE_PASSWORD || 'preview2025';

function Root() {
  const [unlocked, setUnlocked] = useState(false);
  // The per-device preview flag went with the old print dashboard (Prompt 13); the env var is the only switch.
  if (maintenanceMode && !unlocked) {
    return (
      <Maintenance
        onUnlock={(entered) => {
          if (!maintenancePassword || entered === maintenancePassword) {
            setUnlocked(true);
            return true;
          }
          return false;
        }}
      />
    );
  }

  return (
    <ShellCrash>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ShellCrash>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

// PWA: the service worker handles web push, notification deep links, and the offline shell (public/sw.js).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ });
  });
}
