import { Link } from 'react-router-dom';
import { IconBrandInstagram, IconPhone, IconMail, IconArrowRight } from '@tabler/icons-react';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <img src="/VisualizeWordmark.png" alt="Visualize" />
            </Link>
            <p className="footer-tagline">Brand Development & Website Design</p>
            <div className="footer-contact">
              <a href="tel:+13024687077" className="footer-contact-item">
                <IconPhone size={14} stroke={1.8} />
                (302) 468-7077
              </a>
              <a href="mailto:contactvisualize@gmail.com" className="footer-contact-item">
                <IconMail size={14} stroke={1.8} />
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
                <Link to="/showcase">Work</Link>
                <Link to="/pricing">Pricing</Link>
                <Link to="/book">Contact</Link>
              </nav>
            </div>
            <div className="footer-col">
              <p className="footer-col-label">Products</p>
              <nav className="footer-col-links">
                <Link to="/prints">Custom Prints</Link>
                <Link to="/portal">Client Portal</Link>
              </nav>
            </div>
          </div>

          <div className="footer-cta-col">
            <p className="footer-cta-label">Ready to start?</p>
            <a href="/book" className="footer-cta-btn">
              Book a Meeting
              <IconArrowRight size={14} stroke={2} />
            </a>
            <a
              href="https://www.instagram.com/visualizetm/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-social"
            >
              <IconBrandInstagram size={16} stroke={1.8} />
              @visualizetm
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <p className="footer-copy">© {new Date().getFullYear()} Visualize Studio. All rights reserved.</p>
          <Link to="/portal" className="footer-portal-link">Client Portal →</Link>
        </div>
      </div>
      <style>{`
        .footer {
          background: rgba(248,248,248,0.97);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border-top: 1px solid var(--glass-border);
          padding: var(--space-16) 0 var(--space-8);
        }
        .footer-top {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr;
          gap: var(--space-12);
          margin-bottom: var(--space-12);
          padding-bottom: var(--space-12);
          border-bottom: 1px solid var(--glass-border);
        }
        @media (max-width: 900px) { .footer-top { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .footer-top { grid-template-columns: 1fr; gap: var(--space-8); } }

        .footer-logo {
          display: inline-flex; align-items: center;
          margin-bottom: var(--space-3);
        }
        .footer-logo img { height: 20px; width: auto; }
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
        .footer-portal-link { font-size: 0.8125rem; color: var(--text-muted); transition: color 0.2s; }
        .footer-portal-link:hover { color: var(--brand); }
      `}</style>
    </footer>
  );
}
