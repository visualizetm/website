import { useRef } from 'react';
import { Pin, Reveal, ScaleIn, WordReveal, useMediaQuery, useNearestCenter, useScrollEngine } from '../marketing/motion';
import { CALENDLY_URL } from '../marketing/links';

/* Site Prompt 10, Part 1: the packages ladder, rebuilt to teach the
 * difference between the four tiers rather than list them. Each tier says
 * what it is, what is in it, and the step it is up from the one before.
 * No price anywhere on Home: the answer to "how much" is the free call,
 * which is the one button under the four.
 *
 * Desktop (engine on, fine pointer, above 860px): the section is a Pin
 * held for four beats, one per tier. --u runs 0 to 4 across the hold
 * (Pin's --pin-p times four); every tier reads its own --t = --u minus its
 * index and turns it into a crossfade and a small vertical slide in and
 * out, with the name, the line, the contents (60ms apart in scroll
 * space) and the step line revealing in sequence as it arrives. Tiers
 * that have passed collapse to a row of pills under the heading; a line
 * down the left grows with --u and its four nodes fill as each tier
 * lands; the tier's width bar grows from the previous tier's width to its
 * own, 40, 60, 80, 100 percent, scrubbed. Everything is a transform or an
 * opacity, and every property's fallback is the resting state, so with no
 * engine (reduced motion, admin host, a failed import) the four tiers are
 * a plain stack with every bar at its final width and nothing hidden.
 *
 * Phone: no pin. Four compact cards, each settling from 0.97 as it enters
 * and its contents stepping in 50ms apart once 40 percent visible, the
 * step line last in the brand red; each carries its "n of 4" and its
 * width bar, and the card nearest the centre of the screen carries the
 * outline. The progression is in the text too: "Tier n of 4" on every
 * card, and "The step:" before the step line. */
const TIERS = [
  {
    name: 'Social Refresh', line: 'Your Instagram, cleaned up.',
    contents: ['Profile', 'Highlights', 'Bio', 'Post templates that look like you'],
    step: 'Your socials stop looking like an afterthought.', width: 40,
  },
  {
    name: 'Brand Starter', line: 'A real logo and a real look.',
    contents: ['Logo', 'Alternate mark', 'Colors', 'Fonts', 'Every file format you will ever need'],
    step: 'Up from Social Refresh: now you own an identity instead of a template.', width: 60,
  },
  {
    name: 'Brand Complete', line: 'The identity, plus everything you hand someone.',
    contents: ['Everything in Starter', 'Brand guidelines', 'Social kit', 'Packaging and print design', 'Business cards'],
    step: 'Up from Starter: it leaves the screen. Your brand exists on paper, on packaging, and in someone’s hand.', width: 80,
  },
  {
    name: 'The Full Build', line: 'Everything, in one project.',
    contents: ['The complete identity', 'A website built for booking or buying', 'One project, not pieces', 'Monthly plans after launch for content, ads, or the site itself'],
    step: 'Up from Complete: you stop having a brand and start having a business people can find and buy from.', width: 100,
  },
];
const BEATS = TIERS.length;
const BEAT_VH = 0.8;   // viewports of scroll per tier while held
const DESKTOP_QUERY = '(min-width: 861px) and (pointer: fine)';

function Tier({ tier, index }) {
  const prev = index ? TIERS[index - 1].width : 0;
  return (
    <ScaleIn
      as="li"
      soft
      threshold={0.4}
      className={`pk-tier${index === BEATS - 1 ? ' pk-tier--last' : ''}`}
      style={{ '--i': index, '--w': tier.width / 100, '--wp': prev / 100 }}
    >
      <p className="pk-tier-n" style={{ '--e': 0 }}>
        <span className="visually-hidden">Tier </span>{index + 1}<span className="pk-tier-of"> of {BEATS}</span>
      </p>
      <h3 className="pk-name" style={{ '--e': 1 }}>{tier.name}</h3>
      <p className="pk-line" style={{ '--e': 2 }}>{tier.line}</p>
      <ul className="pk-contents" aria-label="What is in it">
        {tier.contents.map((c, i) => <li key={c} className="pk-chip" style={{ '--e': 3 + i }}>{c}</li>)}
      </ul>
      <p className="pk-step" style={{ '--e': 3 + tier.contents.length }}>
        <span className="pk-step-label">The step: </span>{tier.step}
      </p>
      <span className="pk-bar" aria-hidden="true" style={{ '--e': 4 + tier.contents.length }}>
        <span className="pk-bar-fill" />
      </span>
    </ScaleIn>
  );
}

export default function Packages() {
  const ref = useRef(null);
  const state = useScrollEngine();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const held = state !== 'off' && desktop;
  useNearestCenter(ref, '.pk-tier', '.m-pin--active');

  const head = (
    <div className="pk-head">
      <WordReveal as="h2" id="pk-title" className="section-title">Start small. Go as far as you want.</WordReveal>
      <Reveal as="p" className="pk-intro">
        Some people start with just their Instagram. Some want the whole thing. Both are fine.
      </Reveal>
    </div>
  );
  const foot = (
    <Reveal as="div" className="pk-foot">
      <p className="pk-note">Not sure where to start? That is what the first call is for.</p>
      <a href={CALENDLY_URL} className="btn btn-primary" target="_blank" rel="noreferrer">Book a free call</a>
    </Reveal>
  );
  const body = (
    <>
      {head}
      {/* The tiers already climbed, as a row of pills; decorative, the
          tiers themselves are the content. Reserved height so nothing
          moves when the first one appears. */}
      <div className="pk-pills" aria-hidden="true">
        {TIERS.map((t, i) => <span key={t.name} className="pk-pill" style={{ '--i': i }}>{t.name}</span>)}
      </div>
      <div className="pk-body">
        <div className="pk-rail" aria-hidden="true">
          <span className="pk-rail-line" />
          {TIERS.map((t, i) => <span key={t.name} className="pk-node" style={{ '--i': i }} />)}
        </div>
        <ol className="pk-tiers" aria-label="The four tiers, smallest first">
          {TIERS.map((t, i) => <Tier key={t.name} tier={t} index={i} />)}
        </ol>
      </div>
      {foot}
    </>
  );

  return (
    <div ref={ref} className="pk-root">
      {held ? (
        <Pin height={BEATS * BEAT_VH} className="pk section pk--held" innerClassName="pk-inner wrap" id="packages" aria-labelledby="pk-title">
          {body}
        </Pin>
      ) : (
        <section className="pk section" id="packages" aria-labelledby="pk-title">
          <div className="pk-inner wrap">{body}</div>
        </section>
      )}

      <style>{`
        .pk-inner { display: flex; flex-direction: column; gap: var(--space-6); }
        .pk-intro {
          margin-top: var(--space-3); max-width: 52ch;
          font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.6;
        }
        .pk-tiers { list-style: none; display: flex; flex-direction: column; gap: var(--space-4); }
        .pk-tier {
          position: relative;
          display: flex; flex-direction: column; gap: var(--space-2);
          padding: var(--space-5);
          background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
        }
        /* The inset outline: brand red, one pixel, at 40 percent on the
           card in focus. An opacity on a pseudo element, never a border. */
        .pk-tier::before {
          content: ''; position: absolute; inset: 0; border-radius: inherit;
          box-shadow: inset 0 0 0 1px var(--brand);
          opacity: 0; pointer-events: none;
          transition: opacity var(--m-dur) var(--m-ease);
        }
        .pk-tier[data-center]::before { opacity: 0.4; }
        .pk-tier-n {
          font-size: 0.75rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--brand-text);
        }
        .pk-tier-of { color: var(--text-muted); }
        .pk-name { font-size: 1.25rem; font-weight: 700; color: var(--text); }
        .pk-line { font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.5; }
        .pk-contents { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-1); }
        .pk-chip {
          display: inline-flex; align-items: center; min-height: 28px; padding: 0 var(--space-3);
          border: 1px solid var(--border-light); border-radius: 999px;
          font-size: 0.875rem; color: var(--text); background: var(--bg-elevated);
        }
        .pk-step { margin-top: var(--space-1); font-size: 0.9375rem; line-height: 1.55; color: var(--brand-text); }
        .pk-step-label { font-weight: 700; }
        /* The width bar: its box is the tier's width (40, 60, 80, 100
           percent), the fill a scaleX. Width is set, never animated. */
        .pk-bar {
          display: block; width: calc(var(--w) * 100%); height: 6px; border-radius: 3px;
          margin-top: var(--space-2); background: var(--border); overflow: hidden;
        }
        .pk-bar-fill { display: block; width: 100%; height: 100%; border-radius: inherit; background: var(--brand); transform-origin: left center; }
        .pk-pills, .pk-rail { display: none; }
        .pk-foot { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-4) var(--space-8); margin-top: var(--space-2); }
        .pk-note { font-size: 1.0625rem; color: var(--text); }

        /* ── The phone stack (and any stack with the engine): each card
           settles in, then its parts step in 50ms apart, the step line
           and the bar last. Reduced motion marks every card in on the
           first frame and the sitewide rule collapses the transitions. */
        .pk:not(.pk--held) .pk-tier > [style*="--e"],
        .pk:not(.pk--held) .pk-tier .pk-chip {
          opacity: 0; transform: translate3d(0, 8px, 0);
          transition: opacity var(--m-dur) var(--m-ease), transform var(--m-dur) var(--m-ease);
          transition-delay: calc(var(--e, 0) * 50ms + 80ms);
        }
        .pk:not(.pk--held) .pk-tier .pk-bar-fill {
          transform: scaleX(0);
          transition: transform var(--m-dur) var(--m-ease);
          transition-delay: calc(var(--e, 0) * 50ms + 80ms);
        }
        .pk:not(.pk--held) .pk-tier.m-scalein--in > [style*="--e"],
        .pk:not(.pk--held) .pk-tier.m-scalein--in .pk-chip { opacity: 1; transform: none; }
        .pk:not(.pk--held) .pk-tier.m-scalein--in .pk-bar-fill { transform: scaleX(1); }

        /* ── Held (desktop, engine on): four beats, one tier at the centre
           at a time. --u runs 0 to 4 across the hold. */
        /* The panel's spare height is spread evenly between its five
           blocks rather than pooled above and below them, so no run of
           the viewport is empty while the panel is held (Part 4's rule). */
        .pk--held .pk-inner {
          --u: calc(var(--pin-p, 0) * ${BEATS});
          justify-content: space-evenly; gap: 0;
          padding-top: var(--space-4); padding-bottom: var(--space-4);
        }
        .pk--held .pk-head { flex: 0 0 auto; }
        .pk--held .pk-pills {
          display: flex; flex-wrap: wrap; gap: var(--space-2); min-height: 32px;
        }
        .pk--held .pk-pill {
          display: inline-flex; align-items: center; height: 32px; padding: 0 var(--space-3);
          border-radius: 999px; border: 1px solid var(--glass-border-brand); background: var(--glass-bg-brand);
          font-size: 0.8125rem; font-weight: 600; color: var(--text);
          --pp: clamp(0, calc((var(--u) - var(--i) - 0.8) / 0.2), 1);
          opacity: var(--pp); transform: translate3d(0, calc((1 - var(--pp)) * 6px), 0);
        }
        .pk--held .pk-body { display: grid; grid-template-columns: 24px 1fr; gap: var(--space-6); align-items: stretch; }
        .pk--held .pk-rail { display: block; position: relative; }
        .pk--held .pk-rail-line {
          position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; border-radius: 1px;
          background: var(--brand);
          transform: scaleY(calc(var(--u) / ${BEATS})); transform-origin: top center;
        }
        .pk--held .pk-rail::before {
          content: ''; position: absolute; left: 11px; top: 0; bottom: 0; width: 2px; border-radius: 1px; background: var(--border);
        }
        .pk--held .pk-node {
          position: absolute; left: 4px; width: 16px; height: 16px; border-radius: 50%;
          top: calc((var(--i) * 2 + 1) / ${BEATS * 2} * 100% - 8px);
          border: 2px solid var(--brand); background: var(--bg);
        }
        .pk--held .pk-node::after {
          content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--brand);
          transform: scale(clamp(0, calc((var(--u) - var(--i) + 0.15) / 0.15), 1));
        }
        .pk--held .pk-tiers { position: relative; min-height: 330px; }
        .pk--held .pk-tier {
          position: absolute; inset: 0;
          --t: calc(var(--u) - var(--i));
          --in: clamp(0, calc((var(--t) + 0.35) / 0.25), 1);
          --out: calc(1 - clamp(0, calc((var(--t) - 0.82) / 0.18), 1));
          opacity: calc(var(--in) * var(--out));
          transform: translate3d(0, calc((1 - var(--in)) * 28px - (1 - var(--out)) * 28px), 0);
          transition: none; filter: none;
          pointer-events: none;
        }
        .pk--held .pk-tier--last { --out: 1; }
        .pk--held .pk-tier > [style*="--e"],
        .pk--held .pk-tier .pk-chip {
          --ep: clamp(0, calc((var(--t) + 0.33 - var(--e, 0) * 0.03) / 0.12), 1);
          opacity: calc(var(--ep) * var(--out));
          transform: translate3d(0, calc((1 - var(--ep)) * 10px), 0);
          transition: none;
        }
        .pk--held .pk-tier .pk-bar { width: calc(var(--w) * 100%); }
        .pk--held .pk-tier .pk-bar-fill {
          transform: scaleX(calc(var(--wp) / var(--w) + (1 - var(--wp) / var(--w)) * clamp(0, calc(var(--t) / 0.5), 1)));
          transition: none;
        }
        .pk--held .pk-tier::before { transition: none; }
        .pk--held .pk-foot { margin-top: 0; }

        @media (max-width: 767px) {
          .pk-tiers { gap: var(--space-3); }
          .pk-tier { padding: var(--space-4); }
          .pk-name { font-size: 1.125rem; }
          .pk-line { font-size: 1rem; }
          .pk-foot .btn { width: 100%; justify-content: center; }
        }
      `}</style>
    </div>
  );
}
