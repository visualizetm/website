import { Link } from 'react-router-dom';
import { Reveal, SectionNumber } from '../marketing/motion';
import { capImageWidth } from '../marketing/showcase';
import { packageOf, printProductOf, money } from '../shared/pricing';

const BRAND_FROM = money(packageOf('brand-starter')?.price);
const WEB_FROM = money(packageOf('web-essentials')?.price);
const PRINT_FROM = money(printProductOf('stickers-2')?.price);

function firstWebsiteScreenshot(clients) {
  for (const c of clients || []) {
    const link = c.website?.screenshots?.[0]?.link;
    if (link) return link;
  }
  return '';
}

function firstPrintImage(clients) {
  for (const c of clients || []) {
    for (const item of c.print?.items || []) {
      if (item.image) return item.image;
    }
  }
  return '';
}

function Section({ number, label, title, sentences, from, image, imageAlt, reverse }) {
  return (
    <Reveal as="div" className={`svc-section ${reverse ? 'is-reverse' : ''} ${image ? '' : 'is-textonly'}`}>
      <div className="svc-copy">
        <SectionNumber value={number} label={label} />
        <h2 className="svc-title display">{title}</h2>
        <p className="svc-sentence">{sentences[0]}</p>
        <p className="svc-sentence">{sentences[1]}</p>
        <p className="svc-from">from {from}</p>
        <Link to="/services" className="svc-link">See services</Link>
      </div>
      {image && (
        <div className="svc-image">
          <img src={capImageWidth(image)} alt={imageAlt} loading="lazy" width={800} height={600} />
        </div>
      )}
    </Reveal>
  );
}

export default function ServicesSections({ clients, heroCover }) {
  const websiteShot = firstWebsiteScreenshot(clients);
  const printImg = firstPrintImage(clients);

  return (
    <section className="svc-sections">
      <Section
        number={1}
        label="Brand"
        title="Brand"
        sentences={[
          'Logo, colors, fonts, the whole identity. Something that actually looks like your business, not a template with your name swapped in.',
          'You get files that work everywhere, print, web, signage, and a short guide so it stays consistent.',
        ]}
        from={BRAND_FROM}
        image={heroCover}
        imageAlt="Brand identity example"
      />
      <Section
        number={2}
        label="Website"
        title="Website"
        sentences={[
          'A site that loads fast, works on phones, and makes it obvious how to book or buy.',
          'Built by hand, not from a drag-and-drop kit, so it looks like nobody else’s.',
        ]}
        from={WEB_FROM}
        image={websiteShot}
        imageAlt="Website example"
        reverse
      />
      <Section
        number={3}
        label="Print and Product"
        title="Print and Product"
        sentences={[
          'Stickers, business cards, signage, whatever gets your brand into the real world.',
          'Same files, same colors, no surprises when it comes back from the print shop.',
        ]}
        from={PRINT_FROM}
        image={printImg}
        imageAlt="Print example"
      />
      <style>{`
        .svc-sections { padding: var(--space-16) 0; }
        .svc-section {
          display: grid; grid-template-columns: 1fr 1fr; align-items: center;
          gap: var(--space-12);
          padding: var(--space-16) 0;
          border-top: 1px solid var(--border);
        }
        .svc-section:first-child { border-top: none; }
        .svc-section.is-reverse { direction: rtl; }
        .svc-section.is-reverse > * { direction: ltr; }
        .svc-section.is-textonly { grid-template-columns: 1fr; }
        .svc-section.is-textonly .svc-copy { max-width: 640px; margin: 0 auto; text-align: center; align-items: center; }
        .svc-section.is-textonly .svc-sentence { max-width: 46ch; margin: 0 auto; }

        @media (max-width: 860px) {
          .svc-section { grid-template-columns: 1fr; direction: ltr; gap: var(--space-6); }
        }

        .svc-copy { display: flex; flex-direction: column; gap: var(--space-3); align-items: flex-start; }
        .svc-title { font-size: clamp(1.9rem, 3.6vw, 2.6rem); color: var(--text); margin-top: var(--space-3); }
        .svc-sentence { font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.65; max-width: 46ch; }
        .svc-from { font-size: 0.9375rem; font-weight: 700; color: var(--text); margin-top: var(--space-2); }
        .svc-link {
          display: inline-flex; align-items: center; min-height: 44px;
          font-size: 0.9375rem; font-weight: 700; color: var(--brand);
        }

        .svc-image {
          width: 100%; aspect-ratio: 4 / 3; border-radius: var(--radius-lg);
          overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--border);
        }
        .svc-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
      `}</style>
    </section>
  );
}
