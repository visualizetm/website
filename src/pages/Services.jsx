import Check from '@untitled-ui/icons-react/build/esm/Check';
import { Reveal, Stagger, SectionNumber } from '../marketing/motion';
import { PACKAGES, RETAINERS, ADDONS, REVISION_ROUNDS, EXTRA_ROUND, SINGLE_CAP, money, planLine } from '../shared/pricing';
import { useHead } from '../marketing/useHead';

/* Site Prompt 5, Part 1: rebuilt on Home's numbered section pattern, every
 * price read live from src/shared/pricing.js, nothing retyped. The old
 * catalog (Logo Design, Full Brand Identity, ...) described a different,
 * out of date pricing model; this page now shows the same packages,
 * retainers, and add-ons the admin's own pricing builder uses. */

function PackageCard({ pkg }) {
  const plan = pkg.plan ? planLine({ ...pkg.plan, alt: pkg.altPlan || null, total: pkg.price }) : '';
  return (
    <div className="pk-card">
      <div className="pk-card-head">
        <h3 className="pk-card-name">{pkg.label}</h3>
        <span className="pk-card-price">{money(pkg.price)}</span>
      </div>
      {plan && <p className="pk-card-plan">{plan}</p>}
      <ul className="pk-card-list">
        {pkg.included.map(item => (
          <li key={item}><Check width={14} height={14} /> {item}</li>
        ))}
      </ul>
    </div>
  );
}

function RetainerCard({ retainer }) {
  return (
    <div className="pk-card">
      <div className="pk-card-head">
        <h3 className="pk-card-name">{retainer.label}</h3>
        <span className="pk-card-price">{money(retainer.price)}<span className="pk-card-permo">/mo</span></span>
      </div>
      <p className="pk-card-plan">{retainer.monthly.label}</p>
      <ul className="pk-card-list">
        {retainer.included.map(item => (
          <li key={item}><Check width={14} height={14} /> {item}</li>
        ))}
      </ul>
    </div>
  );
}

const PRINT_ADDON_IDS = ['card-design', 'cards-250', 'cards-500', 'nfc-card', 'stickers', 'vinyl'];

function Line({ number, label, title, sentences, children }) {
  return (
    <Reveal as="section" className="svc-line">
      <SectionNumber value={number} label={label} />
      <h2 className="svc-line-title display">{title}</h2>
      <p className="svc-line-sentence">{sentences[0]}</p>
      <p className="svc-line-sentence">{sentences[1]}</p>
      <Stagger className="svc-line-cards">{children}</Stagger>
    </Reveal>
  );
}

export default function Services() {
  useHead({
    title: 'Services | Visualize.',
    description: 'Brand identity, websites, print, and retainers for local businesses. Simple pricing, no surprises.',
  });

  const brandPackages = PACKAGES.filter(p => ['social-refresh', 'brand-starter', 'brand-complete'].includes(p.id));
  const webPackages = PACKAGES.filter(p => ['web-essentials', 'web-complete', 'launch-plan', 'build-plan'].includes(p.id));
  const printAddons = ADDONS.filter(a => PRINT_ADDON_IDS.includes(a.id));

  return (
    <>
      <Reveal as="header" className="svc-head">
        <h1 className="svc-head-title display">Services</h1>
        <p className="svc-head-sub">Brand, website, print, and ongoing help after launch. Simple pricing, book a call for the exact quote.</p>
      </Reveal>

      <div className="wrap svc-lines">
        <Line
          number={1} label="Brand" title="Brand"
          sentences={[
            'Logo, colors, fonts, the whole identity, built so it actually looks like your business.',
            'Pick the size that fits: a quick refresh, a solid starter, or the full system.',
          ]}
        >
          {brandPackages.map(p => <PackageCard key={p.id} pkg={p} />)}
        </Line>

        <Line
          number={2} label="Website" title="Website"
          sentences={[
            'A site that loads fast, works on phones, and makes it obvious how to book or buy.',
            'Bundled with brand work in the Launch and Build plans if you need both at once.',
          ]}
        >
          {webPackages.map(p => <PackageCard key={p.id} pkg={p} />)}
        </Line>

        <Line
          number={3} label="Print and Product" title="Print and Product"
          sentences={[
            'Stickers, business cards, whatever gets your brand into the real world.',
            'Priced simply, add what you need, no surprises at checkout.',
          ]}
        >
          {printAddons.map(a => (
            <div key={a.id} className="pk-card pk-card--addon">
              <div className="pk-card-head">
                <h3 className="pk-card-name">{a.label}</h3>
                <span className="pk-card-price">{money(a.price)}</span>
              </div>
              {a.freeWith && <p className="pk-card-plan">Free with {a.freeWith.includes('any') ? 'any package' : a.freeWith.join(' or ')}</p>}
            </div>
          ))}
        </Line>

        <Line
          number={4} label="Retainers" title="Retainers"
          sentences={[
            'Ongoing help after launch: site care, content, ads, or all of it.',
            'Pick the one that matches how much you need each month.',
          ]}
        >
          {RETAINERS.map(r => <RetainerCard key={r.id} retainer={r} />)}
        </Line>
      </div>

      <Reveal as="section" className="wrap svc-rules">
        <h2 className="svc-rules-title">How pricing works</h2>
        <ul className="svc-rules-list">
          <li>Every package includes {REVISION_ROUNDS} revision rounds. Extra rounds are {money(EXTRA_ROUND.design)} for design work, {money(EXTRA_ROUND.web)} for web work.</li>
          <li>Projects over {money(SINGLE_CAP)} split into monthly payments. The first payment starts the work.</li>
          <li>Files release at full payment.</li>
          <li>Every package includes a sticker sample pack.</li>
        </ul>
      </Reveal>

      <Reveal as="section" className="svc-cta section">
        <div className="wrap svc-cta-inner">
          <h2 className="svc-cta-title display">Ready to start?</h2>
          <a href="/book" className="btn btn-primary">Book a Meeting</a>
        </div>
      </Reveal>

      <style>{`
        .svc-head { padding: var(--space-20) 0 var(--space-8); text-align: center; }
        .svc-head-title { font-size: clamp(2.2rem, 5vw, 3.2rem); color: var(--text); margin-bottom: var(--space-4); }
        .svc-head-sub { font-size: 1.0625rem; color: var(--text-secondary); max-width: 46ch; margin: 0 auto; }

        .svc-lines { padding-bottom: var(--space-8); }
        .svc-line { padding: var(--space-16) 0; border-top: 1px solid var(--border); }
        .svc-line:first-child { border-top: none; }
        .svc-line-title { font-size: clamp(1.8rem, 3.4vw, 2.4rem); color: var(--text); margin: var(--space-3) 0 var(--space-4); }
        .svc-line-sentence { font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.6; max-width: 60ch; }
        .svc-line-cards {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: var(--space-5); margin-top: var(--space-8);
        }

        .pk-card {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-6);
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .pk-card-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3); }
        .pk-card-name { font-size: 1.0625rem; font-weight: 700; color: var(--text); }
        .pk-card-price { font-size: 1.125rem; font-weight: 800; color: var(--text); white-space: nowrap; }
        .pk-card-permo { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
        .pk-card-plan { font-size: 0.875rem; color: var(--text-muted); line-height: 1.5; }
        .pk-card-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-2); }
        .pk-card-list li { display: flex; align-items: center; gap: 7px; font-size: 0.875rem; color: var(--text-secondary); line-height: 1.4; }
        .pk-card-list svg { color: var(--brand-text); flex-shrink: 0; }
        .pk-card--addon { gap: var(--space-2); }

        .svc-rules { padding: var(--space-12) 0; border-top: 1px solid var(--border); }
        .svc-rules-title { font-size: 1.25rem; font-weight: 700; color: var(--text); margin-bottom: var(--space-4); }
        .svc-rules-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-3); max-width: 60ch; }
        .svc-rules-list li {
          font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.6;
          padding-left: var(--space-5); position: relative;
        }
        .svc-rules-list li::before {
          content: ''; position: absolute; left: 0; top: 0.55em;
          width: 6px; height: 6px; border-radius: 50%; background: var(--brand);
        }

        .svc-cta { border-top: 1px solid var(--border); }
        .svc-cta-inner { text-align: center; }
        .svc-cta-title { font-size: clamp(1.6rem, 3vw, 2.2rem); color: var(--text); margin-bottom: var(--space-6); }
      `}</style>
    </>
  );
}
