import Globe01 from '@untitled-ui/icons-react/build/esm/Globe01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import Star01 from '@untitled-ui/icons-react/build/esm/Star01';
import Plus from '@untitled-ui/icons-react/build/esm/Plus';
import { SOCIAL_KEYS, SOCIAL_META, hasAnySocial } from '../lib/socials';

// Untitled UI's free set carries no brand marks, so these are hand-drawn to its
// 24-grid / stroke-2 / currentColor conventions (same approach as the footer's
// Instagram glyph) so they read as one system. Website + Google + Yelp reuse
// real Untitled UI icons.
const S = (props) => ({ width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true, ...props });

const ICONS = {
  website: () => <Globe01 width={18} height={18} />,
  google:  () => <MarkerPin01 width={18} height={18} />,
  yelp:    () => <Star01 width={18} height={18} />,
  instagram: () => (
    <svg {...S()}><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" /><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" /></svg>
  ),
  facebook: () => (
    <svg {...S()}><path d="M15.5 8.2h-1.7c-1.1 0-1.6.6-1.6 1.7V12H15l-.4 3h-2.4v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.4 12h2.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  tiktok: () => (
    <svg {...S()}><path d="M13 4v11.5a3.5 3.5 0 1 1-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M13 4c.6 2.6 2.3 4.2 5 4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  linkedin: () => (
    <svg {...S()}><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" /><path d="M7.5 10.5V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="7.5" cy="7.6" r="1" fill="currentColor" /><path d="M11.5 17v-3.4c0-1.4.9-2.1 2-2.1s2 .8 2 2.3V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  x: () => (
    <svg {...S()}><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  ),
  youtube: () => (
    <svg {...S()}><rect x="3" y="6" width="18" height="12" rx="4" stroke="currentColor" strokeWidth="2" /><path d="M11 9.8l4 2.2-4 2.2z" fill="currentColor" /></svg>
  ),
};

/* Read view — a tappable button per present channel. */
export function SocialButtons({ socials, onAdd }) {
  const present = SOCIAL_KEYS.filter(k => socials?.[k]);

  if (!present.length) {
    return (
      <div className="sl-empty">
        <span>No links yet</span>
        {onAdd && (
          <button type="button" className="sl-addbtn" onClick={onAdd}>
            <Plus width={13} height={13} /> Add links
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="sl-row">
      {present.map(k => {
        const Icon = ICONS[k];
        return (
          <a key={k} href={socials[k]} target="_blank" rel="noopener noreferrer"
             className="sl-btn" title={`${SOCIAL_META[k].label} — opens in new tab`}>
            <Icon />
            <span className="sl-btn-lbl">{SOCIAL_META[k].label}</span>
          </a>
        );
      })}
      {onAdd && (
        <button type="button" className="sl-btn sl-btn--edit" onClick={onAdd} title="Edit links">
          <Plus width={16} height={16} /><span className="sl-btn-lbl">Edit</span>
        </button>
      )}
      <style>{socialStyles}</style>
    </div>
  );
}

/* Edit view — one input per channel, for lead forms. */
export function SocialFields({ values, onChange }) {
  return (
    <div className="sl-fields">
      {SOCIAL_KEYS.map(k => {
        const Icon = ICONS[k];
        return (
          <label key={k} className="sl-field">
            <span className="sl-field-ico"><Icon /></span>
            <input
              className="sl-field-input"
              value={values?.[k] || ''}
              onChange={(e) => onChange(k, e.target.value)}
              placeholder={`${SOCIAL_META[k].label} — ${SOCIAL_META[k].placeholder}`}
              autoComplete="off" autoCapitalize="none" spellCheck="false"
            />
          </label>
        );
      })}
      <style>{socialStyles}</style>
    </div>
  );
}

export { hasAnySocial };

const socialStyles = `
  .sl-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .sl-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 13px; border-radius: 10px; min-height: 40px;
    background: #141414; border: 1px solid rgba(255,255,255,0.1);
    color: #cfcfcf; font-size: 0.8rem; font-weight: 600; font-family: inherit;
    text-decoration: none; white-space: nowrap; cursor: pointer;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }
  .sl-btn:hover { color: #fff; border-color: rgba(212,76,67,0.55); background: rgba(212,76,67,0.12); }
  .sl-btn:hover svg { color: #d44c43; }
  .sl-btn svg { color: #9a9a9a; flex-shrink: 0; transition: color 0.15s; }
  .sl-btn--edit { color: #8a8a8a; }
  @media (max-width: 560px) {
    .sl-btn-lbl { display: none; }
    .sl-btn { padding: 10px; min-width: 44px; justify-content: center; }
  }

  .sl-empty {
    display: inline-flex; align-items: center; gap: 12px;
    font-size: 0.82rem; color: #7a7a7a;
    padding: 8px 0;
  }
  .sl-addbtn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 9px; cursor: pointer;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    color: #cfcfcf; font-size: 0.76rem; font-weight: 700; font-family: inherit;
    transition: color 0.15s, border-color 0.15s;
  }
  .sl-addbtn:hover { color: #fff; border-color: rgba(212,76,67,0.5); }

  .sl-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 560px) { .sl-fields { grid-template-columns: 1fr; } }
  .sl-field {
    display: flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
    border-radius: 10px; padding: 0 12px; transition: border-color 0.15s;
  }
  .sl-field:focus-within { border-color: #d44c43; }
  .sl-field-ico { color: #8a8a8a; flex-shrink: 0; display: flex; }
  .sl-field-input {
    flex: 1; min-width: 0; background: none; border: none; outline: none;
    color: #fafafa; font-family: inherit; font-size: 0.84rem; padding: 10px 0;
  }
  .sl-field-input::placeholder { color: #6a6a6a; }
`;
