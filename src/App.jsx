import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import Wordmark from './components/Wordmark';
import BootFrame from './shell/BootFrame';
import { IS_ADMIN_HOST, IS_DEV_HOST } from './lib/adminPaths';

/* Code split by host (Prompt 15): the admin host never downloads the
 * marketing pages and the marketing site never downloads the admin. Each
 * page is its own chunk; the shell components load with the first page. */
const Navbar = lazy(() => import('./components/Navbar'));
const Footer = lazy(() => import('./components/Footer'));
const Home = lazy(() => import('./pages/Home'));
const Services = lazy(() => import('./pages/Services'));
const Clients = lazy(() => import('./pages/Clients'));
const CaseStudy = lazy(() => import('./pages/CaseStudy'));
const Contact = lazy(() => import('./pages/Contact'));
const LeadPartner = lazy(() => import('./pages/LeadPartner'));
const Start = lazy(() => import('./pages/Start'));
/* The review form. Nothing links to it: it is a link Rob sends after a
 * delivery, so it is noindex and out of the sitemap. */
const Review = lazy(() => import('./pages/Review'));
/* The scroll engine's mount point (Site Prompt 6). Lazy, and rendered only
 * in the marketing branch below, so the admin's entry never carries the
 * loader or the gsap/lenis chunk URLs behind it. */
const ScrollRoot = lazy(() => import('./marketing/ScrollRoot'));
const AdminApp = lazy(() => import('./pages/AdminApp'));

/* /work/:slug moved to /clients/:slug (Site Prompt 3); this keeps the old
 * deep link's slug alive as a client-side fallback, vercel.json does the
 * real 301 for anyone hitting the server directly. */
function RedirectWorkSlug() {
  const { slug } = useParams();
  return <Navigate to={`/clients/${slug}`} replace />;
}

function LoadingScreen({ done }) {
  return (
    <div className={`app-loader ${done ? 'app-loader--done' : ''}`} aria-hidden="true">
      <div className="app-loader-inner">
        <span className="app-loader-logo"><Wordmark size={26} /></span>
        <div className="app-loader-bar">
          <div className="app-loader-fill" />
        </div>
      </div>
      <style>{`
        .app-loader {
          position: fixed; inset: 0; z-index: 9999;
          background: var(--bg-deep, #080808);
          display: flex; align-items: center; justify-content: center;
          transition: opacity 0.5s ease, visibility 0.5s ease;
        }
        .app-loader--done {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
        .app-loader-inner {
          display: flex; flex-direction: column; align-items: center; gap: 28px;
        }
        .app-loader-logo {
          display: inline-flex;
          animation: loaderPulse 1.4s ease-in-out infinite;
        }
        @keyframes loaderPulse {
          0%, 100% { opacity: 0.5; transform: scale(0.95); }
          50%       { opacity: 1;   transform: scale(1.02); filter: drop-shadow(0 0 18px rgba(212,76,67,0.5)); }
        }
        .app-loader-bar {
          width: 120px; height: 2px;
          background: rgba(255,255,255,0.1);
          border-radius: 999px; overflow: hidden;
        }
        .app-loader-fill {
          height: 100%; width: 0%;
          background: linear-gradient(90deg, var(--brand), var(--brand-light));
          border-radius: 999px;
          animation: loaderBar 1.2s var(--ease) forwards;
        }
        @keyframes loaderBar {
          0%   { width: 0%; }
          60%  { width: 80%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  const location              = useLocation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1300);
    return () => clearTimeout(t);
  }, []);


  // ── Host split ─────────────────────────────────────────────────
  // admin.visualizeclients.com serves ONLY the admin app, at root paths.
  if (IS_ADMIN_HOST) {
    // The old print dashboard lived at /prints; Print Orders replaced it (Prompt 13).
    if (location.pathname === '/prints' || location.pathname === '/admin/prints') return <Navigate to="/orders" replace />;
    // The same boot frame the parser painted (index.html) stays up while the admin chunk loads, then AdminApp renders it again until the session answers.
    return <Suspense fallback={<BootFrame />}><AdminApp /></Suspense>;
  }

  // On the public domain the admin is not served (vercel.json also blocks it
  // at the edge). Localhost keeps /admin/* working for development.
  if (location.pathname.startsWith('/admin')) {
    if (!IS_DEV_HOST) return <Navigate to="/" replace />;
    if (location.pathname === '/admin/prints') return <Navigate to="/admin/orders" replace />;
    return <Suspense fallback={<BootFrame />}><AdminApp /></Suspense>;
  }

  // Routes outside the normal navbar/footer layout.
  // The print shop was retired (Site Prompt 6, Part 3); vercel.json 301s
  // /prints and /prints/* to /, this is the client-side fallback for a
  // link followed inside an already-loaded session.
  if (location.pathname === '/prints' || location.pathname.startsWith('/prints/')) return <Navigate to="/" replace />;
  // The client portal and intake form were retired (Prompt 13); old links land on Contact with a notice.
  if (location.pathname === '/portal' || location.pathname.startsWith('/intake')) return <Navigate to="/contact?from=portal" replace />;

  return (
    <Suspense fallback={<LoadingScreen done={false} />}>
      <LoadingScreen done={!loading} />
      <ScrollRoot />
      <Navbar />
      <main className="page-shell page-fade" key={location.pathname}>
        <Routes location={location}>
          <Route path="/"            element={<Home />} />
          <Route path="/services"    element={<Services />} />
          <Route path="/clients"        element={<Clients />} />
          <Route path="/clients/:slug"  element={<CaseStudy />} />
          <Route path="/work"        element={<Navigate to="/clients" replace />} />
          <Route path="/work/:slug"  element={<RedirectWorkSlug />} />
          <Route path="/showcase"    element={<Navigate to="/clients" replace />} />
          <Route path="/contact"     element={<Contact />} />
          <Route path="/book"        element={<Contact />} />
          <Route path="/lead-partner" element={<LeadPartner />} />
          <Route path="/pricing"     element={<Navigate to="/services" replace />} />
          <Route path="/start"       element={<Start />} />
          <Route path="/review"       element={<Review />} />
          <Route path="/review/:slug" element={<Review />} />
        </Routes>
      </main>
      <Footer />
    </Suspense>
  );
}
