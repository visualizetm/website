import Globe01 from '@untitled-ui/icons-react/build/esm/Globe01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import Star01 from '@untitled-ui/icons-react/build/esm/Star01';
import { Grid, Input } from '../ui';
import { SOCIAL_KEYS, SOCIAL_META, hasAnySocial } from '../lib/socials';

/* SocialFields (kit build, Prompt 13): one Input per channel for LeadForm.
 * The read view (SocialButtons) went with the old Clients screen; LeadCard
 * and LeadDetail render social links themselves. Brand glyphs are hand drawn
 * on the Untitled UI 24 grid because the free set carries no brand marks. */
const S = (props) => ({ width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', xmlns: 'http://www.w3.org/2000/svg', 'aria-hidden': true, ...props });
const ICONS = {
  website: () => <Globe01 width={16} height={16} />,
  google: () => <MarkerPin01 width={16} height={16} />,
  yelp: () => <Star01 width={16} height={16} />,
  instagram: () => <svg {...S()}><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" /><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" /></svg>,
  facebook: () => <svg {...S()}><path d="M15.5 8.2h-1.7c-1.1 0-1.6.6-1.6 1.7V12H15l-.4 3h-2.4v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.4 12h2.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  tiktok: () => <svg {...S()}><path d="M13 4v11.5a3.5 3.5 0 1 1-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M13 4c.6 2.6 2.3 4.2 5 4.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  linkedin: () => <svg {...S()}><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" /><path d="M7.5 10.5V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="7.5" cy="7.6" r="1" fill="currentColor" /><path d="M11.5 17v-3.4c0-1.4.9-2.1 2-2.1s2 .8 2 2.3V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  x: () => <svg {...S()}><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>,
  youtube: () => <svg {...S()}><rect x="3" y="6" width="18" height="12" rx="4" stroke="currentColor" strokeWidth="2" /><path d="M11 9.8l4 2.2-4 2.2z" fill="currentColor" /></svg>,
};

/** Edit view: one Input per channel, for lead forms. Props { values, onChange(key, value) }. */
export function SocialFields({ values, onChange }) {
  return (
    <Grid minColumnWidth={220} gap={2} className="sl-fields">
      {SOCIAL_KEYS.map(k => { const Icon = ICONS[k]; return (
        <Input key={k} value={values?.[k] || ''} onChange={(e) => onChange(k, e.target.value)} leading={<Icon />} placeholder={`${SOCIAL_META[k].label}, ${SOCIAL_META[k].placeholder}`} aria-label={SOCIAL_META[k].label} autoComplete="off" autoCapitalize="none" spellCheck="false" />
      ); })}
    </Grid>
  );
}

export { hasAnySocial };
