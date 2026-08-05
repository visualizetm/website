import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Wordmark from './components/Wordmark';
import Home from './pages/Home';
import Services from './pages/Services';
import Work from './pages/Work';
import CaseStudy from './pages/CaseStudy';
import Contact from './pages/Contact';
import LeadPartner from './pages/LeadPartner';
import Prints from './pages/Prints';
import Admin from './pages/Admin';
import AdminCalls from './pages/AdminCalls';
import PrintsAdmin from './pages/PrintsAdmin';
import ClientPortal from './pages/ClientPortal';
import IntakeForm from './pages/IntakeForm';
import Start from './pages/Start';

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

  // Global scroll-reveal
  useEffect(() => {
    const selector = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger';
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    const attach = () => document.querySelectorAll(selector).forEach(el => obs.observe(el));
    attach();
    // Re-observe after route change gives new elements time to mount
    const tid = setTimeout(attach, 100);
    return () => { obs.disconnect(); clearTimeout(tid); };
  }, [location.pathname]);

  // Routes outside the normal navbar/footer layout
  if (location.pathname === '/admin/prints') return <PrintsAdmin />;
  if (location.pathname === '/admin/calls')  return <AdminCalls />;
  if (location.pathname === '/admin')  return <Admin />;
  if (location.pathname === '/prints') return <Prints />;
  if (location.pathname === '/portal') return <ClientPortal />;
  if (location.pathname.startsWith('/intake')) return <IntakeForm />;

  return (
    <>
      <LoadingScreen done={!loading} />
      <Navbar />
      <main className="page-shell page-fade" key={location.pathname}>
        <Routes location={location}>
          <Route path="/"            element={<Home />} />
          <Route path="/services"    element={<Services />} />
          <Route path="/work"        element={<Work />} />
          <Route path="/work/:slug"  element={<CaseStudy />} />
          <Route path="/showcase"    element={<Navigate to="/work" replace />} />
          <Route path="/contact"     element={<Contact />} />
          <Route path="/book"        element={<Contact />} />
          <Route path="/lead-partner" element={<LeadPartner />} />
          <Route path="/pricing"     element={<Navigate to="/services" replace />} />
          <Route path="/prints"       element={<Prints />} />
          <Route path="/admin"        element={<Admin />} />
          <Route path="/admin/calls"  element={<AdminCalls />} />
          <Route path="/admin/prints" element={<PrintsAdmin />} />
          <Route path="/portal"      element={<ClientPortal />} />
          <Route path="/start"       element={<Start />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}
