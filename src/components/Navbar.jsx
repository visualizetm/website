import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Menu01 from '@untitled-ui/icons-react/build/esm/Menu01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Calendar from '@untitled-ui/icons-react/build/esm/Calendar';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import Home01 from '@untitled-ui/icons-react/build/esm/Home01';
import Briefcase01 from '@untitled-ui/icons-react/build/esm/Briefcase01';
import Image01 from '@untitled-ui/icons-react/build/esm/Image01';
import ShoppingBag01 from '@untitled-ui/icons-react/build/esm/ShoppingBag01';
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import Wordmark from './Wordmark';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const [open, setOpen]         = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location                = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const links = [
    { to: '/',         label: 'Home',     icon: Home01 },
    { to: '/services', label: 'Services', icon: Briefcase01 },
    { to: '/work',     label: 'Work',     icon: Image01 },
    { to: '/prints',   label: 'Shop',     icon: ShoppingBag01, newTab: true },
    { to: '/book',     label: 'Contact',  icon: Phone },
  ];

  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <>
      <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <div className="navbar-pill">
          {/* Logo */}
          <Link to="/" className="navbar-logo" onClick={() => setOpen(false)}>
            <Wordmark size={17} />
          </Link>

          {/* Desktop nav links */}
          <nav className="navbar-nav" aria-label="Main navigation">
            <ul>
              {links.map(({ to, label, newTab }) => (
                <li key={to}>
                  {newTab ? (
                    <a
                      href={to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="navbar-link"
                    >
                      {label}
                    </a>
                  ) : (
                    <Link
                      to={to}
                      className={`navbar-link ${isActive(to) ? 'navbar-link--active' : ''}`}
                    >
                      {label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Theme switch — visible at all widths */}
          <ThemeToggle />

          {/* Desktop action buttons */}
          <div className="navbar-actions">
            <a href="/book" className="btn btn-primary navbar-cta">
              <Calendar width={15} height={15} />
              Book a Consultation
            </a>
          </div>

          {/* Mobile burger */}
          <button
            type="button"
            className={`navbar-burger ${open ? 'is-open' : ''}`}
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen(o => !o)}
          >
            {open ? <XClose width={20} height={20} /> : <Menu01 width={20} height={20} />}
          </button>
        </div>
      </header>

      {/* Overlay */}
      <div
        className={`navbar-overlay ${open ? 'is-visible' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <nav
        className={`navbar-drawer ${open ? 'is-open' : ''}`}
        aria-label="Mobile navigation"
      >
        <div className="navbar-drawer-header">
          <Wordmark size={20} />
          <button
            type="button"
            className="navbar-drawer-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <XClose width={16} height={16} />
          </button>
        </div>

        <ul className="navbar-drawer-links">
          {links.map(({ to, label, icon: IconEl, newTab }) => {
            const inner = (
              <>
                <span className="navbar-drawer-link-left">
                  <span className="navbar-drawer-link-icon">
                    <IconEl width={17} height={17} />
                  </span>
                  {label}
                </span>
                <ChevronRight width={15} height={15} className="navbar-drawer-arrow" />
              </>
            );
            return (
              <li key={to}>
                {newTab ? (
                  <a
                    href={to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="navbar-drawer-link"
                    onClick={() => setOpen(false)}
                  >
                    {inner}
                  </a>
                ) : (
                  <Link
                    to={to}
                    className={`navbar-drawer-link ${isActive(to) ? 'navbar-drawer-link--active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        <a
          href="/book"
          className="btn btn-primary navbar-drawer-cta"
          onClick={() => setOpen(false)}
        >
          <Calendar width={16} height={16} />
          Book a Consultation
        </a>

        <p className="navbar-drawer-contact">
          Email{' '}
          <a href="mailto:contact@visualizeclients.com">contact@visualizeclients.com</a>
        </p>
      </nav>

      <style>{`
        /* ── Pill ─────────────────────────────────── */
        .navbar {
          position: sticky; top: 0; z-index: 200;
          padding: 12px var(--space-6);
          transition: padding 0.3s var(--ease);
        }
        .navbar--scrolled { padding: 8px var(--space-6); }
        @media (max-width: 768px) { .navbar { padding: 10px var(--space-4); } }

        .navbar-pill {
          max-width: 1040px; margin: 0 auto;
          display: flex; align-items: center; gap: var(--space-4);
          padding: 0 var(--space-5); height: 52px;
          background: var(--chrome);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--border);
          border-radius: 999px;
          box-shadow: var(--shadow-chrome);
          transition: background 0.3s, box-shadow 0.3s;
        }
        .navbar--scrolled .navbar-pill {
          background: var(--chrome-solid);
          box-shadow: var(--shadow-chrome-strong);
        }
        @media (max-width: 768px) {
          .navbar-pill { padding: 0 var(--space-4); gap: var(--space-3); }
        }

        /* Logo */
        .navbar-logo { display: flex; align-items: center; flex-shrink: 0; }

        /* Desktop nav */
        .navbar-nav { flex: 1; }
        .navbar-nav ul { display: flex; align-items: center; gap: 2px; list-style: none; }
        .navbar-link {
          font-size: 0.875rem; font-weight: 500; color: var(--text-muted);
          padding: 6px 11px; border-radius: 999px;
          transition: color 0.2s, background 0.2s; white-space: nowrap;
        }
        .navbar-link:hover { color: var(--text); background: var(--hover-soft); }
        .navbar-link--active { color: var(--text); background: var(--hover-strong); }

        /* Action group */
        .navbar-actions { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }

        .navbar-cta {
          flex-shrink: 0; font-size: 0.8125rem;
          padding: 7px 14px; white-space: nowrap;
          display: inline-flex; align-items: center; gap: 6px;
        }

        /* Burger */
        .navbar-burger {
          display: none; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          background: var(--glass-bg); border: 1px solid var(--border);
          border-radius: 50%; cursor: pointer; flex-shrink: 0;
          color: var(--text-secondary);
          transition: background 0.2s, color 0.2s;
        }
        .navbar-burger:hover { background: var(--hover-strong); color: var(--text); }

        /* ── Overlay ──────────────────────────────── */
        .navbar-overlay {
          position: fixed; inset: 0; z-index: 210;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          opacity: 0; pointer-events: none;
          transition: opacity 0.3s var(--ease);
        }
        .navbar-overlay.is-visible { opacity: 1; pointer-events: all; }

        /* ── Drawer ───────────────────────────────── */
        .navbar-drawer {
          position: fixed; top: 0; right: 0;
          width: min(340px, 88vw); height: 100dvh;
          background: var(--chrome-solid);
          backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
          border-left: 1px solid var(--border);
          z-index: 220; padding: var(--space-5) var(--space-5);
          display: flex; flex-direction: column; gap: 0;
          transform: translateX(100%);
          transition: transform 0.36s cubic-bezier(0.32,0.72,0,1);
          box-shadow: -24px 0 64px rgba(0,0,0,0.55);
        }
        .navbar-drawer.is-open { transform: translateX(0); }

        .navbar-drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: var(--space-6); margin-bottom: var(--space-2);
          border-bottom: 1px solid var(--border);
        }
        .navbar-drawer-close {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--glass-bg); border: 1px solid var(--border);
          color: var(--text-secondary); cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .navbar-drawer-close:hover { background: var(--hover-strong); color: var(--text); }

        .navbar-drawer-links { list-style: none; padding: var(--space-3) 0; flex: 0; }

        .navbar-drawer-link {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px var(--space-3); border-radius: var(--radius);
          color: var(--text-secondary); font-size: 1rem; font-weight: 500;
          transition: color 0.2s, background 0.2s; text-decoration: none;
        }
        .navbar-drawer-link:hover { color: var(--text); background: var(--hover-soft); }
        .navbar-drawer-link--active {
          color: var(--text); background: rgba(212,76,67,0.1);
          border-left: 2px solid var(--brand);
        }
        .navbar-drawer-link-left { display: flex; align-items: center; gap: 12px; }
        .navbar-drawer-link-icon {
          width: 32px; height: 32px; border-radius: var(--radius);
          background: var(--glass-bg); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); flex-shrink: 0;
        }
        .navbar-drawer-arrow { color: var(--text-muted); opacity: 0.4; transition: transform 0.2s, opacity 0.2s; }
        .navbar-drawer-link:hover .navbar-drawer-arrow { opacity: 0.7; transform: translateX(3px); }

        .navbar-drawer-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: var(--space-4); font-size: 0.9375rem;
          border-radius: var(--radius-lg); margin-bottom: var(--space-4);
        }
        .navbar-drawer-contact {
          text-align: center; font-size: 0.8125rem; color: var(--text-muted);
          margin-top: auto; padding-top: var(--space-4);
        }
        .navbar-drawer-contact a { color: var(--brand); font-weight: 600; }

        /* ── Responsive ───────────────────────────── */
        @media (max-width: 900px) {
          .navbar-cta { display: none; }
        }
        @media (max-width: 768px) {
          .navbar-nav { display: none; }
          .navbar-actions { display: none; }
          .navbar-burger { display: flex; }
        }
      `}</style>
    </>
  );
}
