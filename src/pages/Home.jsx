import { useEffect, useState } from 'react';
import Hero from '../components/Hero';
import Trust from '../components/Trust';
import Manifesto from '../components/Manifesto';
import BusinessTypes from '../components/BusinessTypes';
import Packages from '../components/Packages';
import RecentClients from '../components/RecentClients';
import HomeTestimonials from '../components/HomeTestimonials';
import HowItWorks from '../components/HowItWorks';
import CTA from '../components/CTA';
import { fetchShowcase } from '../marketing/showcase';
import { useHead } from '../marketing/useHead';
import { useScrollRefresh } from '../marketing/motion';

const EMPTY = { clients: [], landing: { logoStrip: [], work: [], testimonials: [], stats: {} } };

/* Home as a funnel (Site Prompt 11), every section a Scene on the one
 * primitive: what Visualize is (the hero), what it stands for, what it
 * does for each kind of business, how far you can take it, proof (recent
 * clients, what clients say), process (how it works), action (the CTA).
 * The logo strip is a thin band between the hero and the manifesto.
 *
 * One fetchShowcase() on mount hydrates the hero deck, the client cards
 * and the testimonials. Every CRM fed scene renders correctly with empty
 * data: the hero shows the default cover, Recent clients and What clients
 * say do not render at all, and the other scenes carry no CRM data. A
 * fetch failure is the same as an empty CRM.
 *
 * Tones alternate a, b, a, b down whatever scenes are actually rendered,
 * so the boundary between any two reads as a shift rather than a seam
 * even when a CRM fed scene is missing. */
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

  // Triggers created before the CRM's sections mounted measure again once they have.
  useScrollRefresh(data);

  const landing = data?.landing || EMPTY.landing;
  const clients = data?.clients || [];
  const work = landing.work || [];
  const deck = (work.length ? work : clients).map(c => ({ slug: c.slug, displayName: c.displayName, type: c.type, cover: c.cover }));
  const testimonials = landing.testimonials || [];

  let n = 0;
  const tone = () => (n++ % 2 ? 'b' : 'a');
  const heroTone = tone();
  const manifestoTone = tone();
  const typesTone = tone();
  const tiersTone = tone();
  const clientsTone = work.length ? tone() : null;
  const sayTone = testimonials.length ? tone() : null;
  const howTone = tone();
  const ctaTone = tone();

  return (
    <>
      <Hero items={data ? deck : null} tone={heroTone} />
      <Trust clients={clients} />
      <Manifesto tone={manifestoTone} />
      <BusinessTypes tone={typesTone} />
      <Packages tone={tiersTone} />
      {work.length > 0 && <RecentClients work={work} tone={clientsTone} />}
      {testimonials.length > 0 && <HomeTestimonials testimonials={testimonials} tone={sayTone} />}
      <HowItWorks tone={howTone} />
      <CTA tone={ctaTone} />
    </>
  );
}
