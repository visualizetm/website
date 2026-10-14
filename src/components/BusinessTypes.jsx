import Building02 from '@untitled-ui/icons-react/build/esm/Building02';
import ShoppingBag03 from '@untitled-ui/icons-react/build/esm/ShoppingBag03';
import Briefcase01 from '@untitled-ui/icons-react/build/esm/Briefcase01';
import Scissors01 from '@untitled-ui/icons-react/build/esm/Scissors01';
import Car01 from '@untitled-ui/icons-react/build/esm/Car01';
import Brush01 from '@untitled-ui/icons-react/build/esm/Brush01';
import { Section } from '../marketing/motion';
import { CALENDLY_URL } from '../marketing/links';

/* What I do for your kind of business: six cards. A grid of three on a
 * computer, a swipeable row on a phone (native scroll, a gentle snap). The
 * section reveals once, the cards a beat apart. No price: every card's link
 * is the free call. */
const TYPES = [
  { icon: Building02, type: 'Restaurants and cafes', needs: ['Menus that read on a phone', 'Online ordering and pickup', 'Hours and location front and center'], does: 'Menu design, ordering that fits your POS, a site people can use while standing in line.' },
  { icon: ShoppingBag03, type: 'Shops and products', needs: ['A storefront that sells', 'Product photos that look real', 'Shipping and pickup that just work'], does: 'Shopify builds and theme customization, product pages, launch graphics.' },
  { icon: Briefcase01, type: 'Service businesses', needs: ['Plumbers, cleaners, movers, landscapers', 'Quote requests and service areas', 'Reviews where people look'], does: 'A site that turns a search into a call, Google Business setup, truck and van decals.' },
  { icon: Scissors01, type: 'Beauty and barbers', needs: ['Booking that actually books', 'Instagram that matches the chair', 'A look clients recognize'], does: 'Booking site, social templates, cards and decals for the shop.' },
  { icon: Car01, type: 'Auto and detailing', needs: ['Before and afters that sell the work', 'Packages that are easy to compare', 'Mobile friendly quotes'], does: 'Brand, gallery site, vehicle decals, quote forms.' },
  { icon: Brush01, type: 'Creators and apparel', needs: ['Drops people show up for', 'Merch that ships', 'A brand people want to wear'], does: 'Logo and identity, Shopify store, product mockups, launch content.' },
];

export default function BusinessTypes({ tone = 'a' }) {
  return (
    <Section tone={tone} label="What I do for your kind of business" className="bt" id="what-i-do">
      <div className="wrap bt-col">
        <div data-step="0" className="bt-head">
          <h2 className="section-title bt-title">What I do for your kind of business</h2>
          <p className="bt-intro">Every business needs something different. Here is what that usually looks like.</p>
        </div>
        <ul className="bt-row" aria-label="Kinds of business">
          {TYPES.map(({ icon: Icon, type, needs, does }, i) => (
            <li key={type} data-step={Math.min(i + 1, 4)} className="bt-card">
              <span className="bt-icon" aria-hidden="true"><Icon width={22} height={22} /></span>
              <h3 className="bt-type">{type}</h3>
              <ul className="bt-needs">
                {needs.map((n) => <li key={n}>{n}</li>)}
              </ul>
              <p className="bt-does">{does}</p>
              <a href={CALENDLY_URL} className="bt-link" target="_blank" rel="noreferrer">
                Book a free call<span className="visually-hidden"> about {type.toLowerCase()}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        .bt-col { display: flex; flex-direction: column; gap: clamp(20px, 3vh, 36px); }
        .bt-title { font-size: clamp(1.75rem, 3.6vw, 2.75rem); line-height: 1.08; }
        .bt-intro { margin-top: clamp(6px, 1.2vh, 12px); max-width: 52ch; font-size: clamp(1rem, 2.2vh, 1.125rem); color: var(--text-secondary); line-height: 1.5; }
        .bt-row { list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
        .bt-card { position: relative; display: flex; flex-direction: column; gap: clamp(8px, 1.4vh, 14px); padding: clamp(16px, 2.4vh, 24px); background: var(--bg-card); border-radius: var(--radius-lg); min-width: 0; }
        .bt-icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--radius); background: var(--glass-bg-brand); color: var(--brand-text); }
        .bt-type { font-size: clamp(1.0625rem, 2.4vh, 1.375rem); font-weight: 700; color: var(--text); }
        .bt-needs { list-style: none; display: flex; flex-direction: column; gap: 6px; }
        .bt-needs li { position: relative; padding-left: var(--space-4); font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.45; }
        .bt-needs li::before { content: ''; position: absolute; left: 0; top: 0.55em; width: 5px; height: 5px; border-radius: 50%; background: var(--brand); }
        .bt-does { font-size: 0.9375rem; color: var(--text); line-height: 1.5; }
        .bt-link { display: inline-flex; align-items: center; align-self: flex-start; min-height: 44px; font-size: 0.9375rem; font-weight: 600; color: var(--brand-text); }
        .bt-link::after { content: ''; position: absolute; inset: 0; }
        .bt-link:hover { text-decoration: underline; }
        .bt-link:focus-visible { outline: none; }
        .bt-card:has(.bt-link:focus-visible) { outline: 2px solid var(--brand); outline-offset: 2px; }
        @media (max-width: 1023px) { .bt-row { grid-template-columns: repeat(2, 1fr); } }
        /* Phones: a swipeable row (one card wide, the next peeking), native scroll with a gentle snap. */
        @media (max-width: 767px) {
          .bt-row { display: flex; overflow-x: auto; scroll-snap-type: x proximity; gap: var(--space-3); margin: 0 calc(-1 * var(--space-4)); padding: 0 var(--space-4) var(--space-2); scrollbar-width: none; }
          .bt-row::-webkit-scrollbar { display: none; }
          .bt-row > * { flex: 0 0 min(82%, 340px); scroll-snap-align: center; }
        }
      `}</style>
    </Section>
  );
}
