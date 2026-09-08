import { Building02, ShoppingBag03, Briefcase01, Scissors01, Car01, Brush01 } from '@untitled-ui/icons-react';
import { Reveal, TrackScroll, WordReveal } from '../marketing/motion';
import { CALENDLY_URL } from '../marketing/links';

/* Site Prompt 6, Part 2.3: the point of the landing page. Six kinds of
 * local business, what each one actually needs, and the one line on what
 * Rob does about it. No prices anywhere: the answer to "how much" is the
 * free call, which is what every card links to.
 *
 * TrackScroll moves the row sideways while the section is pinned on a
 * desktop with a fine pointer, and is a plain vertical stack of the same
 * six cards everywhere else, including under reduced motion. */
const TYPES = [
  {
    icon: Building02,
    type: 'Restaurants and cafes',
    needs: ['Menus that read on a phone', 'Online ordering and pickup', 'Hours and location front and center'],
    does: 'Menu design, ordering that fits your POS, a site people can use while hungry.',
  },
  {
    icon: ShoppingBag03,
    type: 'Shops and products',
    needs: ['A storefront that sells', 'Product photos that look real', 'Shipping and pickup that just work'],
    does: 'Shopify builds and theme customization, product pages, launch graphics.',
  },
  {
    icon: Briefcase01,
    type: 'Service businesses',
    needs: ['Plumbers, cleaners, movers, landscapers', 'Quote requests and service areas', 'Reviews where people look'],
    does: 'A site that turns a search into a call, Google Business set up right, a logo that fits the truck.',
  },
  {
    icon: Scissors01,
    type: 'Beauty and barbers',
    needs: ['Booking that actually books', 'Instagram that matches the chair', 'A look clients recognize'],
    does: 'Booking site, social templates, cards and decals for the shop.',
  },
  {
    icon: Car01,
    type: 'Auto and detailing',
    needs: ['Before and afters that sell the work', 'Packages that are easy to compare', 'Mobile friendly quotes'],
    does: 'Brand, gallery site, vehicle decals, quote forms.',
  },
  {
    icon: Brush01,
    type: 'Creators and apparel',
    needs: ['Drops people show up for', 'Merch that ships', 'A brand people want to wear'],
    does: 'Logo and identity, Shopify store, product mockups, launch content.',
  },
];

export default function BusinessTypes() {
  return (
    <section className="bt section" id="what-i-do">
      <div className="wrap bt-head">
        <WordReveal as="h2" className="section-title">What I do for your kind of business</WordReveal>
        <Reveal as="p" className="bt-intro">
          Every business needs something different. Here is what that usually looks like.
        </Reveal>
      </div>

      <TrackScroll className="bt-track" rowClassName="bt-row">
        {TYPES.map(({ icon: Icon, type, needs, does }) => (
          <article className="bt-card" key={type}>
            <span className="bt-icon" aria-hidden="true"><Icon width={22} height={22} /></span>
            <h3 className="bt-type">{type}</h3>
            <ul className="bt-needs">
              {needs.map(n => <li key={n}>{n}</li>)}
            </ul>
            <p className="bt-does">{does}</p>
            <a href={CALENDLY_URL} className="bt-link" target="_blank" rel="noreferrer">
              Book a free call
              <span className="visually-hidden"> about {type.toLowerCase()}</span>
            </a>
          </article>
        ))}
      </TrackScroll>

      <style>{`
        /* No overflow on this section: TrackScroll holds itself still with
           position: sticky, and sticky stops working inside any ancestor
           that clips. The row's own clipping happens on .m-track-viewport,
           one level in. */
        .bt-head { margin-bottom: var(--space-10); }
        .bt-intro {
          margin-top: var(--space-4); max-width: 52ch;
          font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.6;
        }

        .bt-row { padding: 0 var(--space-6); }
        @media (min-width: 861px) and (pointer: fine) {
          .m-track--h .bt-row { padding: 0 var(--space-10); }
        }

        .bt-card {
          display: flex; flex-direction: column; gap: var(--space-3);
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-6);
        }
        @media (min-width: 861px) and (pointer: fine) {
          .m-track--h .bt-card { width: 340px; flex: 0 0 340px; }
        }
        .bt-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; border-radius: var(--radius);
          background: var(--glass-bg-brand); color: var(--brand-text);
        }
        .bt-type { font-size: 1.1875rem; font-weight: 700; color: var(--text); }
        .bt-needs { list-style: none; display: flex; flex-direction: column; gap: var(--space-2); }
        .bt-needs li {
          position: relative; padding-left: var(--space-4);
          font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.5;
        }
        .bt-needs li::before {
          content: ''; position: absolute; left: 0; top: 0.55em;
          width: 5px; height: 5px; border-radius: 50%; background: var(--brand);
        }
        .bt-does {
          margin-top: auto; padding-top: var(--space-2);
          font-size: 0.9375rem; color: var(--text); line-height: 1.6;
        }
        .bt-link {
          display: inline-flex; align-items: center; align-self: flex-start;
          min-height: 44px; font-size: 0.9375rem; font-weight: 600;
          color: var(--brand-text);
        }
        .bt-link:hover { text-decoration: underline; }

        /* Six cards stacked is the longest run of real content on a phone
           (Site Prompt 8): tighter padding and gaps take it from 2.6
           screens to under two, without dropping a card or a line. */
        @media (max-width: 767px) {
          .bt-row { gap: var(--space-4); padding: 0 var(--space-4); }
          .bt-card { padding: var(--space-5); gap: var(--space-2); }
          .bt-needs { gap: 2px; }
          .bt-needs li { font-size: 0.9rem; line-height: 1.45; }
          .bt-does { padding-top: 0; }
          .bt-link { min-height: 44px; }
          .bt-head { margin-bottom: var(--space-8); }
        }
      `}</style>
    </section>
  );
}
