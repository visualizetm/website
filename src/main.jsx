import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ShellCrash from './shell/ShellCrash';
import { warm } from './shared/api';
import { IS_ADMIN_HOST, IS_DEV_HOST } from './lib/adminPaths';
import { useMotionPreference } from './marketing/motion/shared';
import './fonts.css';
import './index.css';

const SENTENCE = 'Visualize is upgrading its website';
const CHAR_MS = 45;       // typing pace
const START_MS = 750;     // wait for the mark/wordmark reveal before typing starts
const DOT_MS = 400;       // pace between dots
const DOT_MAX = 3;
const PAUSE_FULL_MS = 700; // dwell with all three dots shown
const PAUSE_EMPTY_MS = 500; // dwell with no dots shown, before the next cycle

/** Types SENTENCE out once, then loops "..." growing and shrinking one dot at a
 * time, forever. Under reduced motion, returns the finished sentence and dots
 * immediately, no animation. */
function useTypedLine(reduced) {
  const [text, setText] = useState(reduced ? `${SENTENCE}...` : '');
  useEffect(() => {
    if (reduced) { setText(`${SENTENCE}...`); return undefined; }
    let alive = true;
    let timer;

    const growDot = (count) => {
      if (!alive) return;
      setText(SENTENCE + '.'.repeat(count));
      timer = count < DOT_MAX
        ? setTimeout(() => growDot(count + 1), DOT_MS)
        : setTimeout(() => shrinkDot(count), PAUSE_FULL_MS);
    };
    const shrinkDot = (count) => {
      if (!alive) return;
      const next = count - 1;
      setText(SENTENCE + '.'.repeat(Math.max(next, 0)));
      timer = next > 0
        ? setTimeout(() => shrinkDot(next), DOT_MS)
        : setTimeout(() => growDot(1), PAUSE_EMPTY_MS);
    };
    const typeChar = (i) => {
      if (!alive) return;
      setText(SENTENCE.slice(0, i));
      timer = i < SENTENCE.length
        ? setTimeout(() => typeChar(i + 1), CHAR_MS)
        : setTimeout(() => growDot(1), DOT_MS);
    };

    timer = setTimeout(() => typeChar(1), START_MS);
    return () => { alive = false; clearTimeout(timer); };
  }, [reduced]);
  return text;
}

/* The public maintenance screen (VITE_MAINTENANCE_MODE). Calm, brand only:
 * the mark, the wordmark, one line that types itself out and then loops
 * "..." forever. No password, no countdown, no links; Rob previews the
 * real site through a Vercel preview deployment or by turning the flag
 * off (see docs/RUNBOOK.md). */
function Maintenance() {
  const reduced = useMotionPreference();
  const line = useTypedLine(reduced);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Visualize is upgrading';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => { document.title = prevTitle; meta.remove(); };
  }, []);

  return (
    <div className="uc-screen">
      <div className="uc-glow" aria-hidden="true" />
      <div className="uc-wrap">
        <div className="uc-mark">
          <img src="/logo.svg" alt="" width="64" height="51" />
        </div>
        <h1 className="uc-wordmark">
          Visualize<span className="wordmark-dot">.</span>
        </h1>
        <p className="uc-line" aria-live="off" aria-hidden="true">
          {line}<span className="uc-cursor" aria-hidden="true" />
        </p>
        <p className="visually-hidden">{`${SENTENCE}...`}</p>
      </div>
    </div>
  );
}

// Admin data starts downloading with the entry, not after the shell chunk (Prompt 15): the session
// check always, the five lists and settings when this device was signed in last time (vz_boot).
if (IS_ADMIN_HOST || (IS_DEV_HOST && window.location.pathname.startsWith('/admin'))) {
  let hinted = false; try { hinted = localStorage.getItem('vz_boot') === '1'; } catch { /* private mode */ }
  warm(['/api/admin/session', ...(hinted ? ['/api/admin/call-leads', '/api/admin/submissions', '/api/admin/projects', '/api/admin/orders', '/api/admin/concept-packs', '/api/admin/settings'] : [])]);
}

const maintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

function Root() {
  // Maintenance mode is a full app override, but only on the public host:
  // this build serves both admin.visualizeclients.com and
  // visualizestudio.org from the same bundle (App.jsx tells them apart at
  // runtime via IS_ADMIN_HOST, window.location.hostname), so the same
  // build-time VITE_MAINTENANCE_MODE=true would otherwise show this
  // screen on the admin host too, App.jsx's own host branch never gets a
  // chance to run if Root() returns before reaching it. No api/ function
  // reads this variable at all, so the API itself was never affected.
  if (maintenanceMode && !IS_ADMIN_HOST) {
    return <Maintenance />;
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
// Registered once the first paint is behind us and the browser is idle (Prompt 15): installing the
// worker on load made its precache compete with the app's own requests on a slow connection.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const go = () => navigator.serviceWorker.register('/sw.js').catch(() => { /* non-fatal */ });
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => setTimeout(go, 2500), { timeout: 8000 }); else setTimeout(go, 4000);
  });
}
