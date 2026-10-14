import Manifesto from './Manifesto';
import BusinessTypes from './BusinessTypes';
import Packages from './Packages';
import RecentClients from './RecentClients';
import HomeTestimonials from './HomeTestimonials';
import HowItWorks from './HowItWorks';
import CTA from './CTA';

/* Everything on Home under the hero and the logo strip, one lazy chunk
 * (the faster landing prompt): the hero paints from the entry and this
 * arrives behind it. Tones alternate a, b down whatever sections render,
 * continuing from the hero, so the boundary between any two reads as a
 * shift even when a CRM fed section is missing. */
export default function HomeBelow({ work, testimonials }) {
  let n = 1;
  const tone = () => (n++ % 2 ? 'b' : 'a');
  const manifestoTone = tone();
  const typesTone = tone();
  const tiersTone = tone();
  const clientsTone = work.length ? tone() : null;
  const sayTone = testimonials.length ? tone() : null;
  const howTone = tone();
  const ctaTone = tone();
  return (
    <>
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
