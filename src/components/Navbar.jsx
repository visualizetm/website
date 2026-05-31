import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  IconMenu2,
  IconX,
  IconUser,
  IconCalendar,
  IconChevronRight,
  IconHome,
  IconBriefcase,
  IconPhoto,
  IconPhone,
  IconLogin,
} from '@tabler/icons-react';

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
    { to: '/',         label: 'Home',     icon: IconHome },
    { to: '/services', label: 'Services', icon: IconBriefcase },
    { to: '/showcase', label: 'Work',     icon: IconPhoto },
    { to: '/book',     label: 'Contact',  icon: IconPhone },
  ];

  const isActive = (to) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <>
      <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
        <div className="navbar-pill">
          {/* Logo */}
          <Link to="/" className="navbar-logo" onClick={() => setOpen(false)}>
            <img src="/VisualizeWordmark.png" alt="Visualize Studio" />
          </Link>

          {/* Desktop nav links */}
          <nav className="navbar-nav" aria-label="Main navigation">
            <ul>
              {links.map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className={`navbar-link ${isActive(to) ? 'navbar-link--active' : ''}`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Desktop action buttons */}
          <div className="navbar-actions">
            <Link to="/portal" className="btn-ghost navbar-portal-btn">
              <IconUser size={15} stroke={1.8} />
              Client Login
            </Link>
            <a href="/book" className="btn btn-primary navbar-cta">
              <IconCalendar size={15} stroke={1.8} />
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
            {open ? <IconX size={20} stroke={2} /> : <IconMenu2 size={20} stroke={2} />}
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
          <img src="/VisualizeWordmark.png" alt="Visualize Studio" className="navbar-drawer-logo" />
          <button
            type="button"
            className="navbar-drawer-close"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <IconX size={16} stroke={2} />
          </button>
        </div>

        <ul className="navbar-drawer-links">
          {links.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                className={`navbar-drawer-link ${isActive(to) ? 'navbar-drawer-link--active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="navbar-drawer-link-left">
                  <span className="navbar-drawer-link-icon">
                    <Icon size={17} stroke={1.8} />
                  </span>
                  {label}
                </span>
                <IconChevronRight size={15} stroke={1.8} className="navbar-drawer-arrow" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="navbar-drawer-divider" />

        {/* Client portal link in drawer */}
        <Link
          to="/portal"
          className="navbar-drawer-portal"
          onClick={() => setOpen(false)}
        >
          <span className="navbar-drawer-portal-left">
            <span className="navbar-drawer-link-icon navbar-drawer-link-icon--brand">
              <IconLogin size={17} stroke={1.8} />
            </span>
            <span>
              <span className="navbar-drawer-portal-label">Client Portal</span>
              <span className="navbar-drawer-portal-sub">Track your orders</span>
            </span>
          </span>
          <IconChevronRight size={15} stroke={1.8} className="navbar-drawer-arrow" />
        </Link>

        <a
          href="/book"
          className="btn btn-primary navbar-drawer-cta"
          onClick={() => setOpen(false)}
        >
          <IconCalendar size={16} stroke={1.8} />
          Book a Consultation
        </a>

        <p className="navbar-drawer-contact">
          Call or text{' '}
          <a href="tel:+13024687077">(302) 468-7077</a>
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
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 999px;
          box-shadow: 0 4px 32px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.8) inset;
          transition: background 0.3s, box-shadow 0.3s;
        }
        .navbar--scrolled .navbar-pill {
          background: rgba(255,255,255,0.96);
          box-shadow: 0 8px 40px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset;
        }
        @media (max-width: 768px) {
          .navbar-pill { padding: 0 var(--space-4); gap: var(--space-3); }
        }

        /* Logo */
        .navbar-logo { display: flex; align-items: center; flex-shrink: 0; }
        .navbar-logo img { height: 18px; width: auto; display: block; }
        @media (max-width: 768px) { .navbar-logo img { height: 15px; } }

        /* Desktop nav */
        .navbar-nav { flex: 1; }
        .navbar-nav ul { display: flex; align-items: center; gap: 2px; list-style: none; }
        .navbar-link {
          font-size: 0.875rem; font-weight: 500; color: var(--text-muted);
          padding: 6px 11px; border-radius: 999px;
          transition: color 0.2s, background 0.2s; white-space: nowrap;
        }
        .navbar-link:hover { color: var(--text); background: rgba(0,0,0,0.06); }
        .navbar-link--active { color: var(--text); background: rgba(0,0,0,0.08); }

        /* Action group */
        .navbar-actions { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }

        /* Ghost client login button */
        .btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 0.8125rem; font-weight: 600;
          color: var(--text-secondary);
          padding: 7px 13px; border-radius: 999px;
          border: 1px solid rgba(0,0,0,0.1);
          background: rgba(0,0,0,0.04);
          transition: color 0.2s, background 0.2s, border-color 0.2s;
          white-space: nowrap; text-decoration: none;
        }
        .btn-ghost:hover {
          color: var(--text); background: rgba(0,0,0,0.07);
          border-color: rgba(0,0,0,0.15);
        }
        .navbar-portal-btn { flex-shrink: 0; }
        .navbar-cta {
          flex-shrink: 0; font-size: 0.8125rem;
          padding: 7px 14px; white-space: nowrap;
          display: inline-flex; align-items: center; gap: 6px;
        }

        /* Burger */
        .navbar-burger {
          display: none; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          background: rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.09);
          border-radius: 50%; cursor: pointer; flex-shrink: 0;
          color: var(--text-secondary);
          transition: background 0.2s, color 0.2s;
        }
        .navbar-burger:hover { background: rgba(0,0,0,0.1); color: var(--text); }

        /* ── Overlay ──────────────────────────────── */
        .navbar-overlay {
          position: fixed; inset: 0; z-index: 210;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          opacity: 0; pointer-events: none;
          transition: opacity 0.3s var(--ease);
        }
        .navbar-overlay.is-visible { opacity: 1; pointer-events: all; }

        /* ── Drawer ───────────────────────────────── */
        .navbar-drawer {
          position: fixed; top: 0; right: 0;
          width: min(340px, 88vw); height: 100dvh;
          background: rgba(255,255,255,0.98);
          backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
          border-left: 1px solid rgba(0,0,0,0.08);
          z-index: 220; padding: var(--space-5) var(--space-5);
          display: flex; flex-direction: column; gap: 0;
          transform: translateX(100%);
          transition: transform 0.36s cubic-bezier(0.32,0.72,0,1);
          box-shadow: -24px 0 64px rgba(0,0,0,0.12);
        }
        .navbar-drawer.is-open { transform: translateX(0); }

        .navbar-drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: var(--space-6); margin-bottom: var(--space-2);
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }
        .navbar-drawer-logo { height: 22px; width: auto; }
        .navbar-drawer-close {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.07); border: 1px solid rgba(0,0,0,0.09);
          color: var(--text-secondary); cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .navbar-drawer-close:hover { background: rgba(0,0,0,0.12); color: var(--text); }

        .navbar-drawer-links { list-style: none; padding: var(--space-3) 0; flex: 0; }

        .navbar-drawer-link {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px var(--space-3); border-radius: var(--radius);
          color: var(--text-secondary); font-size: 1rem; font-weight: 500;
          transition: color 0.2s, background 0.2s; text-decoration: none;
        }
        .navbar-drawer-link:hover { color: var(--text); background: rgba(0,0,0,0.05); }
        .navbar-drawer-link--active {
          color: var(--text); background: rgba(212,76,67,0.09);
          border-left: 2px solid var(--brand);
        }
        .navbar-drawer-link-left { display: flex; align-items: center; gap: 12px; }
        .navbar-drawer-link-icon {
          width: 32px; height: 32px; border-radius: var(--radius);
          background: rgba(0,0,0,0.06); border: 1px solid rgba(0,0,0,0.08);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); flex-shrink: 0;
        }
        .navbar-drawer-link-icon--brand {
          background: rgba(212,76,67,0.12); border-color: rgba(212,76,67,0.2);
          color: var(--brand);
        }
        .navbar-drawer-arrow { color: var(--text-muted); opacity: 0.4; transition: transform 0.2s, opacity 0.2s; }
        .navbar-drawer-link:hover .navbar-drawer-arrow { opacity: 0.7; transform: translateX(3px); }

        .navbar-drawer-divider { height: 1px; background: rgba(0,0,0,0.08); margin: var(--space-2) 0 var(--space-3); }

        /* Portal row */
        .navbar-drawer-portal {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px var(--space-3); border-radius: var(--radius);
          background: rgba(212,76,67,0.06); border: 1px solid rgba(212,76,67,0.15);
          text-decoration: none; margin-bottom: var(--space-5);
          transition: background 0.2s, border-color 0.2s;
        }
        .navbar-drawer-portal:hover { background: rgba(212,76,67,0.1); border-color: rgba(212,76,67,0.25); }
        .navbar-drawer-portal-left { display: flex; align-items: center; gap: 12px; }
        .navbar-drawer-portal-label { display: block; font-size: 0.9375rem; font-weight: 700; color: var(--text); }
        .navbar-drawer-portal-sub { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 1px; }

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
