import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Trust from '../components/Trust';
import BusinessTypes from '../components/BusinessTypes';
import Packages from '../components/Packages';
import Platforms from '../components/Platforms';
import RecentClients from '../components/RecentClients';
import HomeTestimonials from '../components/HomeTestimonials';
import HowItWorks from '../components/HowItWorks';
import CTA from '../components/CTA';
import { fetchShowcase } from '../marketing/showcase';
import { useHead } from '../marketing/useHead';
import { Curtain, useScrollRefresh } from '../marketing/motion';

const EMPTY = { clients: [], landing: { logoStrip: [], work: [], testimonials: [], stats: {} } };

/* Site Prompt 4: one fetchShowcase() call on mount hydrates every
 * client-fed section below. The hero renders its text immediately either
 * way; each CRM section stays hidden (its own empty check) until data
 * lands, then Reveals. A fetch failure is treated the same as a genuinely
 * empty CRM, since every section already has a clean hidden-when-empty
 * state, there is no separate error UI to build for the landing page.
 *
 * Site Prompt 6 rebuilt the page around what Rob does for each kind of
 * local business, and gave it the heavy motion set: the hero pins, two
 * sections arrive as Curtains over the one before them, two shift Tone.
 * The two Curtains are rendered here rather than inside their sections
 * because a Curtain animates whatever element precedes it, so it has to
 * know its neighbours. The second one is skipped entirely when the CRM has
 * no published work, since an empty rounded panel sliding up over the page
 * is worse than no transition at all. */
export default function Home() {
  useHead({
    title: 'Visualize. | Branding and websites for local businesses',
    description: 'Solo studio in Delaware. Brand, website, print, all in one place.',
  });
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchShowcase()
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setData(EMPTY); });
    return () => { alive = false; };
  }, []);

  // Pinned and scrubbed sections measured the pre-data page; re-measure
  // once the CRM's own sections have their content (Site Prompt 6).
  useScrollRefresh(data);

  const landing = data?.landing || EMPTY.landing;
  const clients = data?.clients || [];
  const work = landing.work || [];
  /* Site Prompt 7, Part 1: the hero deck is every showcased cover. The
   * landing's own featured work when there is any, otherwise the newest
   * published clients, which the list already arrives sorted as. */
  const deck = (work.length ? work : clients).map(c => ({
    slug: c.slug, displayName: c.displayName, type: c.type, cover: c.cover,
  }));

  return (
    <>
      <Hero items={data ? deck : null} />

      {/* Site Prompt 9, Part 4: every boundary is a Curtain or a Tone
          shift, alternating, so the page reads as one continuous scroll.
          In order: hero -> Trust (Curtain, the deck's last cover hands
          straight into it), Trust -> Business types (Tone, elevated to
          ground), Business types -> Packages (Curtain, elevated panel),
          Packages -> Platforms (Tone, back to ground), Platforms ->
          Recent clients (Curtain, elevated), Recent clients ->
          Testimonials (Tone, back to ground), Testimonials -> How it
          works (Curtain, elevated), How it works -> CTA (Tone, back to
          ground). With no published work the Recent clients curtain is
          not rendered and Testimonials takes that curtain instead. */}
      <Curtain className="home-panel">
        <Trust clients={clients} />
        <BusinessTypes />
      </Curtain>

      <Curtain className="home-panel home-panel--elevated">
        <Packages />
      </Curtain>

      <Platforms />

      {work.length > 0 ? (
        <>
          <Curtain className="home-panel home-panel--elevated">
            <RecentClients work={work} />
          </Curtain>
          <HomeTestimonials testimonials={landing.testimonials} />
        </>
      ) : (
        <Curtain className="home-panel home-panel--elevated">
          <HomeTestimonials testimonials={landing.testimonials} tone={false} />
        </Curtain>
      )}

      <Curtain className="home-panel home-panel--elevated">
        <HowItWorks />
      </Curtain>

      <CTA />

      <style>{`
        /* Every Curtain covers the section above it, so it carries its
           own ground rather than letting the page show through: the page
           ground, or the elevated one where the boundary before it is a
           Tone back down to the page ground. */
        .home-panel { background: var(--bg); }
        .home-panel--elevated { background: var(--bg-elevated); }
        /* A panel's own top edge is the curtain's rounded edge and its
           hairline; a second rule there would double it. */
        .home-panel .section-elevated { border-top: 0; }
      `}</style>
    </>
  );
}
