import { lazy, Suspense, useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Trust from '../components/Trust';
import { fetchShowcase } from '../marketing/showcase';
import { useHead } from '../marketing/useHead';

const HomeBelow = lazy(() => import('../components/HomeBelow'));

const EMPTY = { clients: [], landing: { logoStrip: [], work: [], testimonials: [], stats: {} } };

/* Home (the faster landing prompt): the hero paints with the entry, text
 * first, nothing pinned; the logo strip sits under it; everything below is
 * one lazy chunk (src/components/HomeBelow.jsx) that reveals section by
 * section, once, on native scroll. One fetchShowcase() on mount feeds the
 * logo strip, Recent projects and What clients say; every CRM fed section
 * renders nothing until the data lands and nothing at all with none, and a
 * fetch failure is the same as an empty CRM. The space below the hero is
 * reserved while the chunk is on its way, so the footer never paints up
 * under the hero and then moves. */
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

  const landing = data?.landing || EMPTY.landing;
  const clients = data?.clients || [];
  const work = landing.work || [];
  const testimonials = landing.testimonials || [];

  return (
    <>
      <Hero tone="a" />
      <Trust clients={clients} />
      <Suspense fallback={<div className="home-wait" aria-hidden="true" />}>
        <HomeBelow work={work} testimonials={testimonials} />
      </Suspense>
      <style>{'.home-wait { min-height: calc(100 * var(--svh)); }'}</style>
    </>
  );
}
