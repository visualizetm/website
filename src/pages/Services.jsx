import { useState } from 'react';
import Brush01 from '@untitled-ui/icons-react/build/esm/Brush01';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import CreditCard02 from '@untitled-ui/icons-react/build/esm/CreditCard02';
import LayersTwo01 from '@untitled-ui/icons-react/build/esm/LayersTwo01';
import LayoutAlt01 from '@untitled-ui/icons-react/build/esm/LayoutAlt01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import MessageChatCircle from '@untitled-ui/icons-react/build/esm/MessageChatCircle';
import Monitor01 from '@untitled-ui/icons-react/build/esm/Monitor01';
import PenTool01 from '@untitled-ui/icons-react/build/esm/PenTool01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import Ruler from '@untitled-ui/icons-react/build/esm/Ruler';
import Scissors01 from '@untitled-ui/icons-react/build/esm/Scissors01';

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.667 5L7.5 14.167 3.333 10" />
  </svg>
);

const serviceIcons = {
  'Logo Design': Brush01,
  'Full Brand Identity': LayersTwo01,
  'Business Website (5 Pages)': Monitor01,
  'Landing Page': LayoutAlt01,
  'Sticker Production': Scissors01,
  'Business Cards': CreditCard02,
  'Google Business Profile': MarkerPin01,
  'Bulk Custom Products': LayersTwo01,
};

const processIcons = [MessageChatCircle, Ruler, RefreshCw01, CheckCircle];

const catalogCategories = [
  {
    id: 'brand',
    title: 'Brand Development',
    services: [
      {
        name: 'Logo Design',
        description: 'Custom primary logo built for professional credibility and brand recognition.',
        deliverables: ['Primary logo', 'Secondary variation', 'Favicon', 'Black/white versions', 'PNG + SVG files'],
      },
      {
        name: 'Full Brand Identity',
        description: 'Complete brand system including all designs for print: business cards, stickers, and other physical assets, plus digital consistency.',
        deliverables: ['Logo suite', 'Color palette', 'Typography system', 'Brand style guide PDF', 'All print designs (business cards, stickers, etc.)', 'Social profile graphics'],
      },
    ],
  },
  {
    id: 'website',
    title: 'Website Development',
    services: [
      {
        name: 'Business Website (5 Pages)',
        note: 'Hosting & maintenance costs vary by tools used.',
        description: 'Professional business website designed to clearly present your services and make it easy for customers to contact you.',
        deliverables: ['5 custom pages', 'Mobile responsive design', 'Contact form', 'Basic SEO setup', 'Analytics integration'],
      },
      {
        name: 'Landing Page',
        description: 'Single-page website focused on presenting one service or offer clearly and professionally.',
        deliverables: ['Custom landing page design', 'Lead/contact form', 'Mobile responsive layout', 'Basic SEO setup'],
      },
    ],
  },
  {
    id: 'print',
    title: 'Print & Physical',
    services: [
      {
        name: 'Sticker Production',
        description: 'Custom branded stickers produced in-house for physical brand presence and handout materials.',
      },
      {
        name: 'Business Cards',
        description: 'Custom business card design and coordination with a professional print service.',
        includes: ['Custom design', 'Print-ready files', 'Print service coordination', 'Paper/finish options'],
      },
      {
        name: 'Other Print Materials',
        description: 'If you have something you want printed, I can design it and source the right production partner.',
        includes: ['Posters & flyers', 'Signage & banners', 'Apparel graphics', 'Merch and promotional items'],
      },
    ],
  },
  {
    id: 'bulk',
    title: 'Bulk Custom Products',
    services: [
      {
        name: 'Bulk Custom Products',
        description:
          'You want custom products with your brand on them. I handle everything — finding the manufacturer, designing the product, getting you samples, and managing the entire order. You get one quote and one point of contact.',
        note: 'Popular: custom keychains, product packaging, apparel, and branded accessories.',
        includes: [
          'Manufacturer sourcing',
          'Product design',
          'Sample coordination',
          'End-to-end order management',
          'One quote, one point of contact',
        ],
        cta: { label: 'Start a bulk product quote', href: '/book' },
      },
    ],
  },
  {
    id: 'digital',
    title: 'Digital Setup',
    services: [
      {
        name: 'Google Business Profile',
        description: 'Setup or optimization of your Google Business listing for accurate presence online.',
        includes: ['Profile setup or updates', 'Service descriptions', 'Business info formatting', 'Photo upload guidance'],
      },
    ],
  },
];

const processSteps = [
  { title: 'Consultation', desc: 'I align on your goals, audience, and deliverables.' },
  { title: 'Design & Development', desc: 'Your brand and site are built to your scope.' },
  { title: 'Review & Revisions', desc: 'You review and request changes before final delivery.' },
  { title: 'Final Delivery', desc: 'All files and access are handed over. You launch.' },
];

const pillarBlocks = [
  { id: 'brand', title: 'Brand Identity', summary: 'Logo, full identity, and brand systems.' },
  { id: 'website', title: 'Business Websites', summary: '5-page sites, landing pages, and digital presence.' },
  { id: 'print', title: 'Print & Physical Assets', summary: 'Stickers, business cards, and physical brand.' },
  { id: 'bulk', title: 'Bulk Custom Products', summary: 'Manufacturer-sourced keychains, packaging, apparel, and merch.' },
  { id: 'digital', title: 'Digital Setup', summary: 'Google Business and launch essentials.' },
];

const websiteAddOns = [
  {
    id: 'contact-form',
    title: 'Custom Contact Form Upgrade',
    description: 'Advanced contact form with conditional logic, file uploads, and structured inquiry routing.',
    includes: ['Multi-step form', 'Conditional fields', 'File upload capability', 'Email routing customization'],
  },
  {
    id: 'database',
    title: 'Database Integration',
    description: 'Custom database functionality for storing and managing client data securely.',
    includes: ['Backend database setup', 'Secure form-to-database connection', 'Basic admin viewing access'],
    useCases: ['Client submissions', 'Applications', 'Directory systems'],
  },
  {
    id: 'client-portal',
    title: 'Client Portal / Login System',
    description: 'Private login area for clients or members.',
    includes: ['User authentication', 'Protected pages', 'Basic account dashboard'],
  },
  {
    id: 'booking',
    title: 'Booking System Integration',
    description: 'Integrated appointment booking system connected to your calendar.',
    includes: ['Calendar sync', 'Booking confirmations', 'Time slot customization'],
  },
  {
    id: 'ecommerce',
    title: 'E-Commerce Functionality',
    description: 'Online store functionality for selling products directly from your website.',
    includes: ['Product pages', 'Cart system', 'Secure checkout integration', 'Basic payment setup'],
  },
  {
    id: 'cms',
    title: 'CMS / Editable Content Setup',
    description: 'Backend content management system allowing you to edit text and images without coding.',
    includes: ['Editable sections', 'Simple admin interface', 'Basic training guidance'],
  },
  {
    id: 'seo',
    title: 'Advanced SEO Structure',
    description: 'Enhanced on-site SEO structuring beyond basic setup.',
    includes: ['Schema markup', 'Structured metadata', 'Sitemap optimization', 'Technical improvements'],
  },
  {
    id: 'performance',
    title: 'Performance Optimization',
    description: 'Advanced speed and performance optimization.',
    includes: ['Image compression', 'Code optimization', 'Performance testing', 'Load speed improvements'],
  },
  {
    id: 'email-capture',
    title: 'Email Capture Integration',
    description: 'Newsletter signup or lead capture integration.',
    includes: ['Email platform integration', 'Custom signup forms', 'Auto-response setup'],
  },
  {
    id: 'maintenance',
    title: 'Ongoing Website Maintenance',
    description: 'Optional monthly maintenance for updates and minor edits.',
    includes: ['Small content updates', 'Plugin/tool updates', 'Basic troubleshooting'],
  },
];

function ServiceCardCollapsible({ service, categoryTitle, categoryId, isExpanded, onToggle }) {
  const list = service.deliverables || service.includes || [];
  const IconComponent = serviceIcons[service.name];

  return (
    <article
      className={`svc-card ${isExpanded ? 'is-expanded' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle())}
    >
      <span className="svc-card-pill">{categoryTitle}</span>
      {IconComponent && (
        <div className="svc-card-icon" aria-hidden="true">
          <IconComponent width={22} height={22} />
        </div>
      )}
      <div className="svc-card-head">
        <h3 className="svc-card-name">{service.name}</h3>
        <span className="svc-card-quote-badge">By Quote</span>
      </div>
      <p className="svc-card-desc">{service.description}</p>
      <div className="svc-card-expand">
        {service.note && <p className="svc-card-note">{service.note}</p>}
        {list.length > 0 && (
          <ul className="svc-card-list">
            {list.map((item) => (
              <li key={item}><Check /> {item}</li>
            ))}
          </ul>
        )}
        {service.cta && (
          <a
            href={service.cta.href}
            className="btn btn-primary"
            style={{ marginTop: 'var(--space-4)', display: 'inline-flex' }}
            onClick={(e) => e.stopPropagation()}
          >
            {service.cta.label}
          </a>
        )}
      </div>
      <span className="svc-card-toggle" aria-hidden="true">
        {isExpanded ? 'Show less' : 'View deliverables'}
      </span>
    </article>
  );
}

function AddOnCard({ addon, isExpanded, onToggle }) {
  const hasUseCases = addon.useCases?.length;
  return (
    <article
      className={`addon-card ${isExpanded ? 'is-expanded' : ''}`}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onToggle())}
    >
      <div className="addon-card-header">
        <h3 className="addon-card-title">{addon.title}</h3>
        <span className="addon-card-quote-tag">By Quote</span>
      </div>
      <p className="addon-card-desc">{addon.description}</p>
      <div className="addon-card-expand">
        {addon.includes?.length > 0 && (
          <ul className="addon-card-includes">
            {addon.includes.map((item) => (
              <li key={item}><Check /> {item}</li>
            ))}
          </ul>
        )}
        {hasUseCases && (
          <div className="addon-card-usecases">
            <span className="addon-card-usecases-label">Use cases:</span>
            <span className="addon-card-usecases-list">{addon.useCases.join(' • ')}</span>
          </div>
        )}
      </div>
      <span className="addon-card-toggle" aria-hidden="true">
        {isExpanded ? 'Show less' : 'View details'}
      </span>
    </article>
  );
}

export default function ServicesPage() {
  const [expandedServiceKey, setExpandedServiceKey] = useState(null);
  const [expandedAddOn, setExpandedAddOn] = useState(null);
  const [pillarHover, setPillarHover] = useState(null);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* Split Hero */}
      <section className="sv-hero">
        <div className="sv-hero-bg" aria-hidden="true" />
        <div className="wrap sv-hero-wrap">
          <div className="sv-hero-left">
            <h1 className="sv-hero-title">Branding & Websites Built for Real Businesses</h1>
            <p className="sv-hero-sub">
              I design the visuals and build the digital foundation your business needs to launch properly.
            </p>
            <div className="sv-hero-cta">
              <a href="/book" className="btn btn-primary">Start Your Project</a>
              <a href="/book" className="btn btn-secondary">Get an Estimate</a>
            </div>
          </div>
          <div className="sv-hero-right">
            <div className="sv-hero-visual" aria-hidden="true">
              <div className="sv-vis-doc">
                <div className="sv-vis-doc-bar">
                  <span /><span /><span />
                  <span className="sv-vis-doc-name">brand_identity.ai</span>
                </div>
                <div className="sv-vis-doc-body">
                  <div className="sv-vis-logomark">
                    <svg viewBox="0 0 36 36" fill="none" width="22" height="22">
                      <rect x="4" y="4" width="28" height="28" rx="6" stroke="var(--brand)" strokeWidth="1.8"/>
                      <path d="M12 18h12M18 12v12" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="sv-vis-palette">
                    <div className="sv-vis-swatch" style={{background:'var(--brand)'}} />
                    <div className="sv-vis-swatch" style={{background:'#1b1b1c'}} />
                    <div className="sv-vis-swatch" style={{background:'#8a8a8a'}} />
                    <div className="sv-vis-swatch" style={{background:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.12)'}} />
                  </div>
                  <div className="sv-vis-lines">
                    <div className="sv-vis-l sv-vis-l--a" />
                    <div className="sv-vis-l sv-vis-l--b" />
                    <div className="sv-vis-l sv-vis-l--c" />
                  </div>
                </div>
              </div>
              <div className="sv-vis-chip sv-vis-chip--1">
                <div className="sv-vis-dot sv-vis-dot--green" />
                <span>Website Live</span>
              </div>
              <div className="sv-vis-chip sv-vis-chip--2">
                <div className="sv-vis-dot sv-vis-dot--blue" />
                <span>Print Ready</span>
              </div>
              <div className="sv-vis-orbit"><div className="sv-vis-orbit-dot" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* What I Build – Pillar blocks */}
      <section className="sv-pillars">
        <div className="wrap">
          <h2 className="sv-pillars-heading">What I Build</h2>
          <div className="sv-pillars-grid">
            {pillarBlocks.map((pillar) => (
              <button
                key={pillar.id}
                type="button"
                className={`sv-pillar-block ${pillarHover === pillar.id ? 'is-hover' : ''}`}
                onClick={() => scrollToSection(pillar.id)}
                onMouseEnter={() => setPillarHover(pillar.id)}
                onMouseLeave={() => setPillarHover(null)}
              >
                <span className="sv-pillar-title">{pillar.title}</span>
                <span className="sv-pillar-summary">{pillar.summary}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Service Breakdown – Modular collapsible by category */}
      <section className="sv-breakdown" id="catalog">
        <div className="wrap">
          <h2 className="sv-heading">Service Breakdown</h2>
          <p className="sv-heading-sub">Everything I offer. Expand any card for full deliverables and details. All projects are estimated by quote — book a meeting to get yours.</p>
          {catalogCategories.map((cat) => (
            <div key={cat.id} className="svc-category" id={cat.id}>
              <h3 className="svc-category-title">{cat.title}</h3>
              <div className="svc-grid">
                {cat.services.map((service) => (
                  <ServiceCardCollapsible
                    key={service.name}
                    service={service}
                    categoryTitle={cat.title}
                    categoryId={cat.id}
                    isExpanded={expandedServiceKey === `${cat.id}-${service.name}`}
                    onToggle={() => setExpandedServiceKey(expandedServiceKey === `${cat.id}-${service.name}` ? null : `${cat.id}-${service.name}`)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Advanced Website Add-Ons – Visually distinct */}
      <section className="sv-addons" id="addons">
        <div className="sv-addons-bg" aria-hidden="true" />
        <div className="wrap">
          <h2 className="sv-addons-heading">Advanced Website Add-Ons</h2>
          <p className="sv-addons-sub">
            Optional upgrades available for any website project. Each add-on is included in your project estimate.
          </p>
          <div className="addon-grid">
            {websiteAddOns.map((addon) => (
              <AddOnCard
                key={addon.id}
                addon={addon}
                isExpanded={expandedAddOn === addon.id}
                onToggle={() => setExpandedAddOn(expandedAddOn === addon.id ? null : addon.id)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Process – Horizontal timeline */}
      <section className="sv-process">
        <div className="wrap">
          <h2 className="sv-heading">Process</h2>
          <div className="sv-process-timeline">
            {processSteps.map((step, i) => {
              const StepIcon = processIcons[i];
              return (
              <div key={step.title} className="sv-process-step">
                <div className="sv-process-circle">
                  {StepIcon ? <StepIcon width={20} height={20} /> : <span>{String(i + 1).padStart(2, '0')}</span>}
                </div>
                {i < processSteps.length - 1 && <div className="sv-process-line" />}
                <div className="sv-process-content">
                  <h3 className="sv-process-title">{step.title}</h3>
                  <p className="sv-process-desc">{step.desc}</p>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      </section>

      {/* Final CTA – Full width deep brand */}
      <section className="sv-cta">
        <div className="sv-cta-bg" aria-hidden="true" />
        <div className="wrap sv-cta-wrap">
          <h2 className="sv-cta-title">Ready to Build Your Business Foundation?</h2>
          <div className="sv-cta-btns">
            <a href="/book" className="btn btn-primary">Start Your Project</a>
            <a href="/book" className="btn btn-secondary">Book Consultation</a>
          </div>
        </div>
      </section>

      <style>{`
        /* ----- Split Hero ----- */
        .sv-hero {
          position: relative;
          padding: var(--space-24) 0;
          min-height: 70vh;
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        .sv-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--bg) 0%, var(--bg-elevated) 100%);
          z-index: 0;
        }
        .sv-hero-bg::after {
          content: '';
          position: absolute;
          top: -50%;
          right: -20%;
          width: 80%;
          height: 140%;
          background: radial-gradient(ellipse at center, rgba(212, 76, 67, 0.08) 0%, transparent 60%);
          pointer-events: none;
        }
        .sv-hero-wrap {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-16);
          align-items: center;
        }
        @media (max-width: 900px) {
          .sv-hero-wrap { grid-template-columns: 1fr; text-align: center; }
          .sv-hero-left .sv-hero-cta { justify-content: center; }
          .sv-hero-right { min-height: 200px; order: -1; }
        }
        .sv-hero-title {
          font-size: clamp(2rem, 5vw, 3.25rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          margin-bottom: var(--space-4);
          color: var(--text);
        }
        .sv-hero-sub {
          font-size: clamp(1.125rem, 2vw, 1.25rem);
          color: var(--text-secondary);
          max-width: 480px;
          margin-bottom: var(--space-10);
          line-height: 1.6;
        }
        .sv-hero-cta { display: flex; flex-wrap: wrap; gap: var(--space-4); }
        .sv-hero-visual {
          position: relative;
          width: 100%;
          min-height: 320px;
          border-radius: var(--radius-lg);
          background: linear-gradient(145deg, var(--glass-bg) 0%, var(--glass-bg-strong) 100%);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          box-shadow: 0 24px 64px rgba(0,0,0,0.12);
          overflow: hidden;
        }
        .sv-hero-visual::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: radial-gradient(circle at 70% 30%, rgba(212, 76, 67, 0.12) 0%, transparent 50%);
          animation: sv-pulse 8s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes sv-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }

        /* sv-vis branded elements */
        .sv-vis-doc {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -52%);
          width: 72%;
          background: rgba(18,18,22,0.92);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          animation: svDocFloat 6s ease-in-out infinite;
          z-index: 2;
        }
        @keyframes svDocFloat {
          0%, 100% { transform: translate(-50%, -52%) translateY(0); }
          50% { transform: translate(-50%, -52%) translateY(-8px); }
        }
        .sv-vis-doc-bar {
          display: flex; align-items: center; gap: 6px;
          padding: 9px 12px;
          background: rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .sv-vis-doc-bar span:not(.sv-vis-doc-name) {
          width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
        }
        .sv-vis-doc-bar span:nth-child(1) { background: #ff5f57; }
        .sv-vis-doc-bar span:nth-child(2) { background: #febc2e; }
        .sv-vis-doc-bar span:nth-child(3) { background: #28c840; }
        .sv-vis-doc-name {
          font-size: 0.65rem; color: rgba(255,255,255,0.35);
          margin-left: 6px; font-family: monospace;
        }
        .sv-vis-doc-body {
          padding: 14px 16px;
          display: flex; flex-direction: column; gap: 12px;
        }
        .sv-vis-logomark {
          width: 38px; height: 38px;
          background: rgba(212,76,67,0.12);
          border: 1px solid rgba(212,76,67,0.3);
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
        }
        .sv-vis-palette { display: flex; gap: 6px; }
        .sv-vis-swatch {
          width: 20px; height: 20px; border-radius: 5px;
        }
        .sv-vis-lines { display: flex; flex-direction: column; gap: 7px; }
        .sv-vis-l {
          height: 5px; border-radius: 3px;
          background: rgba(255,255,255,0.12);
        }
        .sv-vis-l--a { width: 85%; }
        .sv-vis-l--b { width: 63%; }
        .sv-vis-l--c { width: 42%; }

        .sv-vis-chip {
          position: absolute;
          display: flex; align-items: center; gap: 6px;
          padding: 5px 11px;
          background: rgba(18,18,22,0.9);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 999px;
          font-size: 0.72rem; font-weight: 600;
          color: rgba(255,255,255,0.85);
          box-shadow: 0 6px 20px rgba(0,0,0,0.4);
          white-space: nowrap; z-index: 3;
        }
        .sv-vis-chip--1 {
          top: 16%; right: 7%;
          animation: svChip1Float 7s ease-in-out infinite;
        }
        .sv-vis-chip--2 {
          bottom: 14%; left: 7%;
          animation: svChip2Float 8s ease-in-out 1s infinite;
        }
        @keyframes svChip1Float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes svChip2Float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(5px); }
        }
        .sv-vis-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          animation: svDotPulse 2.5s ease-in-out infinite;
        }
        .sv-vis-dot--green { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,0.7); }
        .sv-vis-dot--blue { background: #60a5fa; box-shadow: 0 0 5px rgba(96,165,250,0.7); }
        @keyframes svDotPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sv-vis-orbit {
          position: absolute;
          top: 50%; left: 50%;
          width: 220px; height: 220px;
          margin: -110px 0 0 -110px;
          border: 1px dashed rgba(212,76,67,0.18);
          border-radius: 50%;
          animation: svOrbit 20s linear infinite;
          pointer-events: none; z-index: 1;
        }
        .sv-vis-orbit-dot {
          position: absolute; top: -4px; left: 50%;
          transform: translateX(-50%);
          width: 7px; height: 7px;
          background: var(--brand); border-radius: 50%;
          box-shadow: 0 0 8px rgba(212,76,67,0.7);
        }
        @keyframes svOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* ----- What I Build – Pillars ----- */
        .sv-pillars {
          padding: var(--space-20) 0;
          background: var(--bg-elevated);
          border-top: 1px solid var(--glass-border);
        }
        .sv-pillars-heading {
          font-size: clamp(1.5rem, 3vw, 2rem);
          font-weight: 800;
          color: var(--text);
          margin-bottom: var(--space-12);
          text-align: center;
        }
        .sv-pillars-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-6);
        }
        @media (max-width: 900px) { .sv-pillars-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 500px) { .sv-pillars-grid { grid-template-columns: 1fr; } }
        .sv-pillar-block {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: var(--space-10);
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          transition: border-color var(--duration) var(--ease), box-shadow var(--duration) var(--ease), transform var(--duration) var(--ease);
        }
        .sv-pillar-block:hover,
        .sv-pillar-block.is-hover {
          border-color: var(--brand);
          box-shadow: 0 12px 40px rgba(0,0,0,0.1), 0 0 0 1px rgba(212, 76, 67, 0.2);
          transform: translateY(-2px);
        }
        .sv-pillar-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--text);
          margin-bottom: var(--space-2);
        }
        .sv-pillar-summary {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        /* ----- Service Breakdown ----- */
        .sv-breakdown {
          padding: var(--space-24) 0;
          background: var(--bg);
          position: relative;
        }
        .sv-breakdown::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, transparent 0%, rgba(212, 76, 67, 0.02) 100%);
          pointer-events: none;
        }
        .sv-heading {
          font-size: clamp(1.75rem, 3.5vw, 2.25rem);
          font-weight: 800;
          margin-bottom: var(--space-3);
          color: var(--text);
        }
        .sv-heading-sub {
          font-size: 1rem;
          color: var(--text-secondary);
          margin-bottom: var(--space-12);
          max-width: 560px;
        }
        .sv-breakdown .sv-heading-sub,
        .sv-packages .sv-heading-sub,
        .sv-process .sv-heading + .sv-heading-sub {
          max-width: 640px;
        }
        .svc-category {
          margin-bottom: var(--space-16);
        }
        .svc-category:last-child { margin-bottom: 0; }
        .svc-category-title {
          font-size: 1rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--brand);
          margin-bottom: var(--space-6);
          padding-bottom: var(--space-2);
          border-bottom: 1px solid var(--glass-border);
        }
        .svc-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: var(--space-6);
        }
        .svc-card {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          transition: border-color var(--duration) var(--ease), box-shadow var(--duration) var(--ease);
        }
        .svc-card:hover {
          border-color: var(--border-light);
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .svc-card.is-expanded {
          border-color: var(--brand);
          box-shadow: 0 12px 40px rgba(0,0,0,0.1);
        }
        .svc-card-pill {
          display: inline-block;
          font-size: 0.6875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--brand);
          margin-bottom: var(--space-4);
        }
        .svc-card-icon {
          color: var(--brand);
          margin-bottom: var(--space-3);
        }
        .svc-card-icon svg { display: block; }
        .svc-card-head { margin-bottom: var(--space-3); }
        .svc-card-name {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text);
          margin-bottom: var(--space-2);
          line-height: 1.25;
        }
        .svc-card-quote-badge {
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--brand);
          border: 1px solid rgba(212,76,67,0.3); border-radius: 999px;
          padding: 2px 8px;
        }
        .svc-card-desc {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: var(--space-4);
        }
        .svc-card-expand {
          max-height: 0;
          overflow: hidden;
          transition: max-height var(--duration) var(--ease);
        }
        .svc-card.is-expanded .svc-card-expand { max-height: 500px; }
        .svc-card-note { font-size: 0.8125rem; color: var(--text-muted); margin-bottom: var(--space-3); }
        .svc-card-table {
          border: 1px solid var(--glass-border);
          border-radius: var(--radius);
          overflow: hidden;
          margin-bottom: var(--space-4);
        }
        .svc-card-table-row {
          display: flex; justify-content: space-between;
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--glass-border);
          font-size: 0.9375rem;
          color: var(--text-secondary);
        }
        .svc-card-table-row:last-child { border-bottom: none; }
        .svc-card-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .svc-card-list li {
          display: flex; align-items: center; gap: var(--space-2);
          font-size: 0.9375rem;
          color: var(--text-secondary);
          margin-bottom: var(--space-2);
        }
        .svc-card-list svg { color: var(--brand); flex-shrink: 0; }
        .svc-card-toggle {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--brand);
          margin-top: auto;
          display: inline-block;
        }
        .svc-card.is-expanded .svc-card-toggle { margin-top: var(--space-4); }

        /* ----- Add-Ons – Distinct section ----- */
        .sv-addons {
          position: relative;
          padding: var(--space-24) 0;
          background: linear-gradient(180deg, var(--bg) 0%, var(--bg-elevated) 100%);
          border-top: 1px solid var(--glass-border);
        }
        .sv-addons-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212, 76, 67, 0.06) 0%, transparent 50%);
          pointer-events: none;
        }
        .sv-addons .wrap { position: relative; z-index: 1; }
        .sv-addons-heading {
          font-size: clamp(1.75rem, 3.5vw, 2.25rem);
          font-weight: 800;
          color: var(--text);
          margin-bottom: var(--space-3);
        }
        .sv-addons-sub {
          font-size: 1rem;
          color: var(--text-secondary);
          margin-bottom: var(--space-12);
          max-width: 560px;
        }
        .addon-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-6);
        }
        @media (max-width: 1000px) { .addon-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .addon-grid { grid-template-columns: 1fr; } }
        .addon-card {
          position: relative;
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-left: 3px solid var(--brand);
          border-radius: var(--radius-lg);
          padding: var(--space-8);
          cursor: pointer;
          transition: border-color var(--duration) var(--ease), box-shadow var(--duration) var(--ease), transform var(--duration) var(--ease);
          display: flex;
          flex-direction: column;
        }
        .addon-card:hover {
          border-color: var(--border-light);
          border-left-color: var(--brand-light);
          box-shadow: 0 12px 40px rgba(0,0,0,0.1);
          transform: translateY(-3px);
        }
        .addon-card.is-expanded {
          border-color: var(--brand);
          box-shadow: 0 16px 48px rgba(0,0,0,0.12);
        }
        .addon-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }
        .addon-card-title {
          font-size: 1.125rem;
          font-weight: 800;
          color: var(--text);
          line-height: 1.3;
          margin: 0;
          flex: 1;
        }
        .addon-card-quote-tag {
          font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--brand);
          border: 1px solid rgba(212,76,67,0.3); border-radius: 999px;
          padding: 2px 8px; flex-shrink: 0;
        }
        .addon-card-desc {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0 0 var(--space-4);
        }
        .addon-card-expand {
          max-height: 0;
          overflow: hidden;
          transition: max-height var(--duration) var(--ease);
        }
        .addon-card.is-expanded .addon-card-expand { max-height: 400px; }
        .addon-card-includes {
          list-style: none;
          padding: 0;
          margin: 0 0 var(--space-4);
        }
        .addon-card-includes li {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: var(--space-2);
        }
        .addon-card-includes svg { color: var(--brand); flex-shrink: 0; }
        .addon-card-usecases {
          font-size: 0.8125rem;
          color: var(--text-muted);
          margin-bottom: var(--space-3);
        }
        .addon-card-usecases-label { font-weight: 600; color: var(--text-secondary); margin-right: var(--space-1); }
        .addon-card-toggle {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--brand);
          margin-top: auto;
          display: inline-block;
        }
        .addon-card.is-expanded .addon-card-toggle { margin-top: var(--space-2); }

        /* ----- Process – Horizontal timeline ----- */
        .sv-process {
          padding: var(--space-24) 0;
          background: var(--bg);
          border-top: 1px solid var(--glass-border);
        }
        .sv-process .sv-heading { margin-bottom: var(--space-12); }
        .sv-process-timeline {
          display: flex;
          align-items: flex-start;
          gap: 0;
          position: relative;
        }
        @media (max-width: 900px) {
          .sv-process-timeline { flex-direction: column; gap: var(--space-6); }
          .sv-process-line { display: none; }
        }
        .sv-process-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          min-width: 0;
        }
        .sv-process-circle {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(212, 76, 67, 0.12);
          border: 1px solid rgba(212, 76, 67, 0.35);
          color: var(--brand);
          font-size: 0.75rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-bottom: var(--space-4);
          box-shadow: 0 0 0 4px var(--bg);
        }
        .sv-process-circle svg { display: block; }
        .sv-process-line {
          flex: 1;
          min-width: 24px;
          height: 2px;
          margin: 25px 0 0;
          background: linear-gradient(90deg, var(--brand) 0%, var(--border) 100%);
          opacity: 0.5;
        }
        @media (max-width: 900px) {
          .sv-process-step { flex-direction: row; align-items: flex-start; gap: var(--space-4); width: 100%; }
          .sv-process-circle { margin-bottom: 0; }
        }
        .sv-process-content {
          text-align: center;
          max-width: 220px;
        }
        @media (max-width: 900px) { .sv-process-content { text-align: left; max-width: none; } }
        .sv-process-title {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--text);
          margin-bottom: var(--space-2);
        }
        .sv-process-desc {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
        }

        /* ----- Final CTA ----- */
        .sv-cta {
          position: relative;
          padding: var(--space-24) 0;
          background: linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 100%);
          border-top: 1px solid var(--glass-border);
        }
        .sv-cta-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 100% 80% at 50% 100%, rgba(212, 76, 67, 0.1) 0%, transparent 60%);
          pointer-events: none;
        }
        .sv-cta .wrap { position: relative; z-index: 1; }
        .sv-cta-wrap { text-align: center; }
        .sv-cta-title {
          font-size: clamp(2rem, 4vw, 2.75rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          margin-bottom: var(--space-10);
          color: var(--text);
        }
        .sv-cta-btns {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: var(--space-4);
        }
      `}</style>
    </>
  );
}
