import { Link } from 'react-router-dom';
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import Wordmark from './Wordmark';

// Untitled UI's free line set has no social brand marks — this glyph matches
// its 24-grid, stroke-2, currentColor conventions so it reads as one system.
function InstagramGlyph({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <Wordmark size={22} />
            </Link>
            <p className="footer-tagline">Brand Development & Website Design</p>
            <div className="footer-contact">
              <a href="tel:+13024687077" className="footer-contact-item">
                <Phone width={14} height={14} />
                (302) 468-7077
              </a>
              <a href="mailto:contactvisualize@gmail.com" className="footer-contact-item">
                <Mail01 width={14} height={14} />
                contactvisualize@gmail.com
              </a>
            </div>
          </div>

          <div className="footer-cols">
            <div className="footer-col">
              <p className="footer-col-label">Navigation</p>
              <nav className="footer-col-links">
                <Link to="/">Home</Link>
                <Link to="/services">Services</Link>
                <Link to="/work">Work</Link>
                <Link to="/book">Contact</Link>
              </nav>
            </div>
            <div className="footer-col">
              <p className="footer-col-label">Products</p>
              <nav className="footer-col-links">
                <a href="/prints" target="_blank" rel="noopener noreferrer">Custom Prints</a>
              </nav>
            </div>
          </div>

          <div className="footer-cta-col">
            <p className="footer-cta-label">Ready to start?</p>
            <a href="/book" className="footer-cta-btn">
              Book a Meeting
              <ArrowRight width={14} height={14} />
            </a>
            <a
              href="https://www.instagram.com/visualizetm/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social"
            >
              <InstagramGlyph size={16} />
              @visualizetm
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">&copy; {new Date().getFullYear()} Visualize. All rights reserved.</p>
          <p className="footer-build">{typeof __BUILD_SHA__ !== 'undefined' ? __BUILD_SHA__ : 'dev'}</p>
        </div>
      </div>
      <style>{`
        .footer {
          background: var(--bg-deep);
          border-top: 1px solid var(--border);
          padding: var(--space-16) 0 var(--space-8);
        }
        .footer-top {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr;
          gap: var(--space-12);
          margin-bottom: var(--space-12);
          padding-bottom: var(--space-12);
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 900px) { .footer-top { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .footer-top { grid-template-columns: 1fr; gap: var(--space-8); } }

        .footer-logo {
          display: inline-flex; align-items: center;
          margin-bottom: var(--space-3);
        }
        .footer-tagline { font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-4); }
        .footer-contact { display: flex; flex-direction: column; gap: var(--space-2); }
        .footer-contact-item {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.8125rem; color: var(--text-secondary);
          transition: color 0.2s;
        }
        .footer-contact-item:hover { color: var(--text); }

        .footer-cols { display: flex; gap: var(--space-10); }
        @media (max-width: 600px) { .footer-cols { gap: var(--space-8); } }
        .footer-col-label {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-4);
        }
        .footer-col-links {
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .footer-col-links a {
          font-size: 0.9rem; color: var(--text-secondary); transition: color 0.2s;
        }
        .footer-col-links a:hover { color: var(--text); }

        .footer-cta-col { display: flex; flex-direction: column; gap: var(--space-4); }
        .footer-cta-label {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--text-muted);
        }
        .footer-cta-btn {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.9rem; font-weight: 700; color: var(--brand);
          transition: gap 0.2s;
        }
        .footer-cta-btn:hover { gap: 10px; }
        .footer-social {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.875rem; color: var(--text-secondary); transition: color 0.2s;
        }
        .footer-social:hover { color: var(--text); }

        .footer-bottom {
          display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
          flex-wrap: wrap;
        }
        .footer-copy { font-size: 0.8125rem; color: var(--text-muted); }
        .footer-build {
          font-size: 0.6875rem; color: var(--text-faint);
          font-family: monospace; letter-spacing: 0.04em;
        }
      `}</style>
    </footer>
  );
}
