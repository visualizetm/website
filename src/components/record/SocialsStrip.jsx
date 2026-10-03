import { Button, Icon } from '../../ui';
import { SOCIAL_KEYS, SOCIAL_META, instagramHandle } from '../../lib/socials';
import { safeHref } from '../../lib/safeUrl';

/* The socials strip: what this business has online, one tappable row each, and only those. A channel it does not have is not drawn, so
 * the strip reads as the answer to "where can I look them up before I call". Nothing at all on file is one line with one action. */
const ICON = { website: 'Globe01', instagram: 'Camera01', facebook: 'ThumbsUp', google: 'MarkerPin01', yelp: 'Star01', tiktok: 'Play', youtube: 'Play', linkedin: 'Link01', x: 'Link01' };
const LABEL = { google: 'Google Maps' };

/* The part worth reading: "@handle" for Instagram, otherwise the address without the scheme, www and trailing slash. */
function shown(key, url) {
  if (key === 'instagram') { const h = instagramHandle(url); if (h) return `@${h}`; }
  return String(url).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '').replace(/^google\.com\/maps\/search\//i, '');
}

export default function SocialsStrip({ rec, onAdd }) {
  const { lead, readOnly } = rec;
  const found = SOCIAL_KEYS.map(k => [k, safeHref(lead.socials?.[k])]).filter(([, u]) => u);
  if (!found.length) {
    if (readOnly) return null;
    return (
      <div className="rc-soc rc-soc--none" role="region" aria-label="Socials">
        <span className="rc-soc-none">No socials on file.</span>
        <Button variant="ghost" icon="Plus" onClick={onAdd}>Add</Button>
      </div>
    );
  }
  return (
    <div className="rc-soc" role="region" aria-label="Socials">
      <p className="rc-soc-head"><span>Socials</span><span className="rc-soc-count">{found.length} found</span></p>
      <ul className="rc-soc-list">
        {found.map(([k, u]) => (
          <li key={k}>
            <a className="rc-soc-link" href={u} target="_blank" rel="noopener noreferrer" aria-label={`Open ${LABEL[k] || SOCIAL_META[k].label}, ${shown(k, u)}`}>
              <span className="rc-soc-icon" aria-hidden="true"><Icon icon={ICON[k] || 'Link01'} size="var(--v-icon-md)" /></span>
              <span className="rc-soc-text"><span className="rc-soc-name">{LABEL[k] || SOCIAL_META[k].label}</span><span className="rc-soc-url">{shown(k, u)}</span></span>
              <span className="rc-soc-out" aria-hidden="true"><Icon icon="LinkExternal01" size="var(--v-icon-sm)" /></span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
