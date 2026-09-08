/* Site Prompt 5, Part 3: the one per-page head helper, generalized from
 * CaseStudy.jsx's useClientHead (Site Prompt 3). Sets document.title, the
 * meta description, and og:title/og:image, restoring whatever was there
 * before on unmount and removing any tag it created itself. Every static
 * marketing page calls this with fixed values; CaseStudy.jsx calls it with
 * the client's own displayName/blurb/cover once the fetch resolves.
 *
 * No prerender step reads this today except for published clients (see
 * scripts/prerender-clients.mjs): a crawler or link-preview fetch on any
 * other route still only ever sees index.html's static tags, since these
 * land after the SPA's JS runs. docs/RUNBOOK.md, "Prerender", has the
 * detail.
 */
import { useEffect } from 'react';

export const DEFAULT_OG_IMAGE = '/og-default.png';

/* noindex: the one page that is a link Rob sends rather than a page anyone
 * browses to (/review) asks crawlers to stay out. The tag is removed on
 * unmount like every other tag this hook creates, so navigating away from
 * it does not leave the rest of the site noindex. */
export function useHead({ title, description, ogImage, noindex = false }) {
  useEffect(() => {
    if (!title) return undefined;
    const prevTitle = document.title;
    document.title = title;

    const created = [];
    const setMeta = (name, attr, value) => {
      if (!value) return;
      let el = document.head.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
        created.push(el);
      }
      el.setAttribute('content', value);
    };

    setMeta('description', 'name', description);
    setMeta('og:title', 'property', title);
    setMeta('og:description', 'property', description);
    setMeta('og:image', 'property', ogImage || DEFAULT_OG_IMAGE);
    if (noindex) setMeta('robots', 'name', 'noindex, nofollow');

    return () => {
      document.title = prevTitle;
      created.forEach(el => el.remove());
    };
  }, [title, description, ogImage, noindex]);
}
