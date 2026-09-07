import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Trust from '../components/Trust';
import ServicesSections from '../components/ServicesSections';
import RecentClients from '../components/RecentClients';
import StatsRow from '../components/StatsRow';
import HomeTestimonials from '../components/HomeTestimonials';
import HowItWorks from '../components/HowItWorks';
import CTA from '../components/CTA';
import { fetchShowcase } from '../marketing/showcase';

const EMPTY = { clients: [], landing: { logoStrip: [], work: [], testimonials: [], stats: {} } };

/* Site Prompt 4: one fetchShowcase() call on mount hydrates every
 * client-fed section below. The hero renders its text immediately either
 * way; each CRM section stays hidden (its own empty check) until data
 * lands, then Reveals. A fetch failure is treated the same as a genuinely
 * empty CRM, since every section already has a clean hidden-when-empty
 * state, there is no separate error UI to build for the landing page. */
export default function Home() {
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
  const work0 = landing.work?.[0];

  return (
    <>
      <Hero cover={work0 ? { src: work0.cover, alt: `${work0.displayName} project` } : null} />
      <Trust clients={clients} />
      <ServicesSections clients={clients} heroCover={work0?.cover} />
      <RecentClients work={landing.work} />
      <StatsRow stats={landing.stats} />
      <HomeTestimonials testimonials={landing.testimonials} />
      <HowItWorks />
      <CTA />
    </>
  );
}
