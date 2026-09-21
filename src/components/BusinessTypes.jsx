import { Building02, ShoppingBag03, Briefcase01, Scissors01, Car01, Brush01 } from '@untitled-ui/icons-react';
import { Scene } from '../marketing/motion';
import { CALENDLY_URL } from '../marketing/links';

/* Scene 3, what I do for your kind of business (Site Prompt 11): six
 * steps, one business type per step. Each card arrives centred and stays;
 * its three bullets and closing line stagger in over the step, reading
 * the scene's own progress. On a desktop an arrived card slides left and
 * up into a compact row along the top of the stage as the next arrives
 * (a transform of the same element, so it is never hidden), and by step
 * six all six are in the row with the sixth in the centre. On a phone the
 * arrived card scales to 0.96 and the next stacks over it. The cards
 * share one grid cell, so the zone is exactly as tall as the tallest card
 * and nothing in the stage moves as they arrive. No price: the link on
 * every card is the free call. */
const TYPES = [
  { icon: Building02, type: 'Restaurants and cafes', needs: ['Menus that read on a phone', 'Online ordering and pickup', 'Hours and location front and center'], does: 'Menu design, ordering that fits your POS, a site people can use while hungry.' },
  { icon: ShoppingBag03, type: 'Shops and products', needs: ['A storefront that sells', 'Product photos that look real', 'Shipping and pickup that just work'], does: 'Shopify builds and theme customization, product pages, launch graphics.' },
  { icon: Briefcase01, type: 'Service businesses', needs: ['Plumbers, cleaners, movers, landscapers', 'Quote requests and service areas', 'Reviews where people look'], does: 'A site that turns a search into a call, Google Business set up right, a logo that fits the truck.' },
  { icon: Scissors01, type: 'Beauty and barbers', needs: ['Booking that actually books', 'Instagram that matches the chair', 'A look clients recognize'], does: 'Booking site, social templates, cards and decals for the shop.' },
  { icon: Car01, type: 'Auto and detailing', needs: ['Before and afters that sell the work', 'Packages that are easy to compare', 'Mobile friendly quotes'], does: 'Brand, gallery site, vehicle decals, quote forms.' },
  { icon: Brush01, type: 'Creators and apparel', needs: ['Drops people show up for', 'Merch that ships', 'A brand people want to wear'], does: 'Logo and identity, Shopify store, product mockups, launch content.' },
];

export default function BusinessTypes({ tone = 'a' }) {
  return (
    <Scene steps={6} tone={tone} label="What I do for your kind of business" indicator indicatorLabels={TYPES.map(t => t.type)} indicatorLabel="Kinds of business" className="bt" id="what-i-do">
      <div className="wrap bt-col">
        <div data-step="0" className="bt-head">
          <h2 className="section-title bt-title">What I do for your kind of business</h2>
          <p className="bt-intro">Every business needs something different. Here is what that usually looks like.</p>
        </div>
        <div className="bt-zone">
          {TYPES.map(({ icon: Icon, type, needs, does }, i) => (
            <article key={type} data-step={i + 1} data-reveal="custom" className="bt-card" style={{ '--i': i }}>
              <span className="bt-icon" aria-hidden="true"><Icon width={22} height={22} /></span>
              <h3 className="bt-type">{type}</h3>
              <ul className="bt-needs">
                {needs.map((n, e) => <li key={n} style={{ '--e': e }}>{n}</li>)}
              </ul>
              <p className="bt-does" style={{ '--e': 3 }}>{does}</p>
              <a href={CALENDLY_URL} className="bt-link" style={{ '--e': 4 }} target="_blank" rel="noreferrer">
                Book a free call<span className="visually-hidden"> about {type.toLowerCase()}</span>
              </a>
            </article>
          ))}
        </div>
      </div>
      <style>{`
        .bt-col { display: flex; flex-direction: column; gap: clamp(12px, 2.4vh, 28px); }
        .bt-title { font-size: clamp(1.75rem, max(3.4vw, 4.6vh), 2.75rem); line-height: 1.08; }
        .bt-intro { margin-top: clamp(6px, 1.2vh, 12px); max-width: 52ch; font-size: clamp(1rem, 2.2vh, 1.125rem); color: var(--text-secondary); line-height: 1.5; }
        /* One cell for six cards. */
        .bt-zone { display: grid; }
        .bt-zone > * { grid-area: 1 / 1; align-self: center; justify-self: center; width: min(100%, 420px); }
        .bt-card {
          position: relative; display: flex; flex-direction: column; gap: clamp(6px, 1.4vh, 16px);
          padding: clamp(14px, 2.4vh, 28px); background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
          /* Done when the next card arrives: 0.35 of a step before its beat. */
          --done: clamp(0, calc((var(--scene-p, 0) - var(--step, 1) + 0.35) / 0.35), 1);
          --dx: 0px; --dy: 0px; --ds: 0.04;
          /* On a phone the card arrives opaque and grows from 0.97 over the
             one before it (settled to 0.96 underneath); a fade showed the
             card below through it (Site Prompt 12). */
          opacity: clamp(0, calc(var(--sr, 1) * 100), 1);
          transform: translate3d(calc(var(--dx) * var(--done)), calc(var(--dy) * var(--done)), 0) scale(calc(0.97 + 0.03 * var(--sr, 1) - var(--ds) * var(--done)));
          z-index: calc(var(--i, 0) + 1);
        }
        /* Desktop: the card sits at the bottom of a zone that leaves room
           above it for the compact row the arrived cards slide into
           (scale 0.28, so a 520px card becomes a 146px tile). */
        @media (min-width: 861px) {
          .bt-zone { min-height: 450px; }
          .bt-zone > * { width: min(100%, 520px); align-self: end; }
          /* Desktop: the outgoing card moves to the row over the first
             half of the window, the incoming fades in over the second, so
             the two never share the centre while both are visible. */
          .bt-card {
            --dx: calc((var(--i, 0) - 2.5) * min(158px, 12.4vw)); --dy: calc(-1 * (50% + 110px)); --ds: 0.72; transform-origin: center center;
            --done: clamp(0, calc((var(--scene-p, 0) - var(--step, 1) + 0.35) / 0.175), 1);
            --late: clamp(0, calc((var(--sr, 1) - 0.5) / 0.5), 1);
            opacity: var(--late);
            transform: translate3d(calc(var(--dx) * var(--done)), calc((1 - var(--late)) * 16px + var(--dy) * var(--done)), 0) scale(calc(1 - var(--ds) * var(--done)));
          }
        }
        /* The sixth card has no next card to make room for: it stays centred to the end. */
        .bt-card:last-child { --done: 0; }
        /* Static (reduced motion, no engine): the six as a plain grid. */
        .m-scene--static .bt-zone { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4); }
        .m-scene--static .bt-zone > * { grid-area: auto; width: auto; align-self: stretch; }
        .m-scene--static .bt-card { transform: none; opacity: 1; box-shadow: none; }
        @media (max-width: 767px) and (max-height: 600px) { .bt-intro { display: none; } .bt-card { gap: 4px; } }
        .bt-icon { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--radius); background: var(--glass-bg-brand); color: var(--brand-text); }
        .bt-type { font-size: clamp(1.0625rem, 2.4vh, 1.5rem); font-weight: 700; color: var(--text); }
        .bt-needs { list-style: none; display: flex; flex-direction: column; gap: clamp(2px, 0.8vh, 10px); }
        .bt-needs li { position: relative; padding-left: var(--space-4); font-size: clamp(0.9rem, 2vh, 1.125rem); color: var(--text-secondary); line-height: 1.45; }
        .bt-needs li::before { content: ''; position: absolute; left: 0; top: 0.55em; width: 5px; height: 5px; border-radius: 50%; background: var(--brand); }
        .bt-does { font-size: clamp(0.9rem, 2vh, 1.125rem); color: var(--text); line-height: 1.5; }
        .bt-link { display: inline-flex; align-items: center; align-self: flex-start; min-height: 44px; font-size: 0.9375rem; font-weight: 600; color: var(--brand-text); }
        .bt-link::after { content: ''; position: absolute; inset: 0; }
        .bt-link:hover { text-decoration: underline; }
        .bt-link:focus-visible { outline: none; }
        .bt-card:has(.bt-link:focus-visible) { outline: 2px solid var(--brand); outline-offset: 2px; }
        /* The parts stagger in over the step, off the scene's progress. */
        /* Inside the card's own 0.35 reveal window, 0.05 apart, so a card
           that has arrived has every part at full (step 1 at progress 0
           included: a half-faded line at rest is a contrast failure). */
        .m-scene--pinned .bt-needs li, .m-scene--pinned .bt-does, .m-scene--pinned .bt-link {
          --lt: calc(var(--scene-p, 0) - var(--step, 1) + 1.35);
          --lp: clamp(0, calc((var(--lt) - var(--e, 0) * 0.05) / 0.15), 1);
          opacity: var(--lp); transform: translate3d(0, calc((1 - var(--lp)) * 8px), 0);
        }
      `}</style>
    </Scene>
  );
}
