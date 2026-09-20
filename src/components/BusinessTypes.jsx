import { Building02, ShoppingBag03, Briefcase01, Scissors01, Car01, Brush01 } from '@untitled-ui/icons-react';
import { useRef } from 'react';
import { Reveal, ScaleIn, Tone, TrackScroll, WordReveal, useNearestCenter } from '../marketing/motion';
import { CALENDLY_URL } from '../marketing/links';

/* Site Prompt 6, Part 2.3: the point of the landing page. Six kinds of
 * local business, what each one actually needs, and the one line on what
 * Rob does about it. No prices anywhere: the answer to "how much" is the
 * free call, which is what every card links to.
 *
 * TrackScroll moves the row sideways while the section is held on a
 * desktop with a fine pointer, one card reaching the centre at a time
 * (Site Prompt 9: scale, opacity, the outline and the bullet reveal all
 * read the card's closeness to the centre), and is a plain vertical stack
 * of the same six cards everywhere else, including under reduced motion,
 * where the card nearest the centre of the screen carries the outline. */
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
  const ref = useRef(null);

  // The phone stack's sense of focus: the card nearest the centre of the
  // screen carries the outline; the held track decides its own centre.
  useNearestCenter(ref, '.bt-card', '.m-track--h');

  return (
    <Tone as="section" className="bt section" id="what-i-do" from="var(--bg-elevated)" to="var(--bg)">
      <div ref={ref} className="bt-body">
      <TrackScroll
        className="bt-track"
        rowClassName="bt-row"
        segments={TYPES.map(t => t.type)}
        progressLabel="Kinds of business"
        head={(
          <div className="wrap bt-head">
            <WordReveal as="h2" className="section-title">What I do for your kind of business</WordReveal>
            <Reveal as="p" className="bt-intro">
              Every business needs something different. Here is what that usually looks like.
            </Reveal>
          </div>
        )}
      >
        {TYPES.map(({ icon: Icon, type, needs, does }) => (
          <ScaleIn as="article" soft threshold={0.4} className="bt-card" key={type}>
            <span className="bt-icon" aria-hidden="true"><Icon width={22} height={22} /></span>
            <h3 className="bt-type">{type}</h3>
            <ul className="bt-needs">
              {needs.map((n, i) => <li key={n} style={{ '--li-i': i }}>{n}</li>)}
            </ul>
            <p className="bt-does" style={{ '--li-i': needs.length }}>{does}</p>
            {/* The one real control per card, stretched over the whole card
                (the ::after below), so the card is tappable in full. */}
            <a href={CALENDLY_URL} className="bt-link" style={{ '--li-i': needs.length + 1 }} target="_blank" rel="noreferrer">
              Book a free call
              <span className="visually-hidden"> about {type.toLowerCase()}</span>
            </a>
          </ScaleIn>
        ))}
      </TrackScroll>
      </div>

      <style>{`
        /* No overflow on this section: TrackScroll holds itself still with
           position: sticky, and sticky stops working inside any ancestor
           that clips. The row's own clipping happens on .m-track-viewport,
           one level in. */
        .bt-head { margin-bottom: var(--space-10); }
        /* Inside the held panel the panel's own gap spaces the heading
           from the row; the stack keeps the margin. */
        .m-track--h .bt-head { margin-bottom: 0; }
        .bt-intro {
          margin-top: var(--space-4); max-width: 52ch;
          font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.6;
        }

        .bt-row { padding: 0 var(--space-6); }
        /* Padded so the first and the last card can both sit at the
           centre: the row starts with card one centred and ends with
           card six centred, and every card between reaches it in turn. */
        @media (min-width: 861px) and (pointer: fine) {
          .m-track--h .bt-row { padding: 0 calc(50% - 170px); gap: var(--space-6); }
        }

        .bt-card {
          position: relative;
          display: flex; flex-direction: column; gap: var(--space-3);
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-lg); padding: var(--space-6);
        }
        /* The inset outline: brand red, one pixel, at 40 percent when the
           card is the one in focus. An opacity on a pseudo element, never
           a border that would move layout. */
        .bt-card::before {
          content: ''; position: absolute; inset: 0; border-radius: inherit;
          box-shadow: inset 0 0 0 1px var(--brand);
          opacity: 0; pointer-events: none;
          transition: opacity var(--m-dur) var(--m-ease);
        }
        .bt-card[data-center]::before { opacity: 0.4; }

        /* ── The held track (desktop, engine on) ──
           Everything below reads --card-c, the card's closeness to the
           centre that TrackScroll writes every frame: 1 at the centre,
           0 one card away. Scale and opacity on the card, the outline,
           then the bullets one after another as the card arrives, the
           closing line and the link last. All scrubbed, so scrolling back
           plays it in reverse. The fallbacks are the resting state. */
        @media (min-width: 861px) and (pointer: fine) {
          .m-track--h .bt-card {
            width: 340px; flex: 0 0 340px;
            transform: scale(calc(0.94 + 0.06 * var(--card-c, 1)));
            opacity: calc(0.55 + 0.45 * var(--card-c, 1));
            transition: none; filter: none;
          }
          /* A side card sits at scale 0.94; 48px still measures 44 there. */
          .m-track--h .bt-link { min-height: 48px; }
          .m-track--h .bt-card::before {
            opacity: calc(0.4 * clamp(0, calc((var(--card-c, 1) - 0.7) / 0.3), 1));
            transition: none;
          }
          .m-track--h .bt-needs li,
          .m-track--h .bt-does,
          .m-track--h .bt-link {
            --lp: clamp(0, calc((var(--card-c, 1) - 0.4 - var(--li-i, 0) * 0.07) / 0.2), 1);
            opacity: var(--lp);
            transform: translate3d(0, calc((1 - var(--lp)) * 8px), 0);
            transition: none;
          }
        }
        /* The icon tile pulses its tint once as the card lands: an overlay
           whose opacity rises and falls, run once per landing. */
        .bt-icon {
          position: relative; overflow: hidden;
          display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; border-radius: var(--radius);
          background: var(--glass-bg-brand); color: var(--brand-text);
        }
        .bt-icon::after {
          content: ''; position: absolute; inset: 0; border-radius: inherit;
          background: var(--brand); opacity: 0; pointer-events: none;
        }
        .bt-card[data-landed] .bt-icon::after { animation: bt-pulse 1.4s var(--m-ease) 1; }
        @keyframes bt-pulse {
          0% { opacity: 0; }
          30% { opacity: 0.35; }
          100% { opacity: 0; }
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
        /* 46px, not 44: a card waiting to enter sits at scale 0.97, and
           the target has to measure 44px even then. */
        .bt-link {
          display: inline-flex; align-items: center; align-self: flex-start;
          min-height: 46px; font-size: 0.9375rem; font-weight: 600;
          color: var(--brand-text);
        }
        .bt-link::after { content: ''; position: absolute; inset: 0; }
        .bt-link:hover { text-decoration: underline; }
        .bt-link:focus-visible { outline: none; }
        .bt-card:has(.bt-link:focus-visible) { outline: 2px solid var(--brand); outline-offset: 2px; }

        /* ── The stack (phones, touch, reduced motion, no engine) ──
           Each card settles from 0.97 as it enters (ScaleIn, soft), and
           once it is 40 percent visible its bullets rise in 50ms apart,
           the closing line and the link after them. Reduced motion marks
           every card in on the first frame and the sitewide rule collapses
           the transitions, so nothing is hidden and nothing moves. */
        .m-track:not(.m-track--h) .bt-card .bt-needs li,
        .m-track:not(.m-track--h) .bt-card .bt-does,
        .m-track:not(.m-track--h) .bt-card .bt-link {
          opacity: 0; transform: translate3d(0, 8px, 0);
          transition: opacity var(--m-dur) var(--m-ease), transform var(--m-dur) var(--m-ease);
          transition-delay: calc(var(--li-i, 0) * 50ms + 100ms);
        }
        .m-track:not(.m-track--h) .bt-card.m-scalein--in .bt-needs li,
        .m-track:not(.m-track--h) .bt-card.m-scalein--in .bt-does,
        .m-track:not(.m-track--h) .bt-card.m-scalein--in .bt-link {
          opacity: 1; transform: none;
        }

        /* Six cards stacked is the longest run of real content on a phone
           (Site Prompt 8): tighter padding and gaps take it from 2.6
           screens to under two, without dropping a card or a line. */
        @media (max-width: 767px) {
          .bt-row { gap: var(--space-4); padding: 0 var(--space-4); }
          .bt-card { padding: var(--space-5); gap: var(--space-2); }
          .bt-needs { gap: 2px; }
          .bt-needs li { font-size: 0.9rem; line-height: 1.45; }
          .bt-does { padding-top: 0; }
          .bt-link { min-height: 46px; }
          .bt-head { margin-bottom: var(--space-8); }
        }
        /* Narrow phones (320 wide): the same six cards, tighter still, so
           the stack costs the fewest screens the content allows. */
        @media (max-width: 360px) {
          .bt-row { gap: var(--space-3); }
          .bt-card { padding: var(--space-4); }
          .bt-icon { width: 36px; height: 36px; }
          .bt-type { font-size: 1.0625rem; }
          .bt-needs li { font-size: 0.875rem; line-height: 1.35; }
          .bt-does { font-size: 0.875rem; line-height: 1.45; }
          .bt-intro { font-size: 1rem; }
        }
      `}</style>
    </Tone>
  );
}
