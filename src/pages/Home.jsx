import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Trust from '../components/Trust';
import BusinessTypes from '../components/BusinessTypes';
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

      <Curtain className="home-panel">
        <Trust clients={clients} />
        <BusinessTypes />
      </Curtain>

      <Platforms />

      {work.length > 0 && (
        <Curtain className="home-panel">
          <RecentClients work={work} />
        </Curtain>
      )}

      <HomeTestimonials testimonials={landing.testimonials} />
      <HowItWorks />
      <CTA />

      <style>{`
        /* Both Curtains cover the section above them, so they carry the
           page ground themselves rather than letting it show through. */
        .home-panel { background: var(--bg); }
      `}</style>
    </>
  );
}
