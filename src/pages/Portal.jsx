import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import MessageTextSquare02 from '@untitled-ui/icons-react/build/esm/MessageTextSquare02';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import AtSign from '@untitled-ui/icons-react/build/esm/AtSign';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import { useHead } from '../marketing/useHead';
import { INSTAGRAM_URL, INSTAGRAM_HANDLE, CONTACT_EMAIL } from '../marketing/links';
import { safeHref } from '../lib/safeUrl';
import { normalizeBrandColor } from '../shared/color';
import { logoSrc } from '../ui/logo.data';
import Logo from '../ui/Logo';
import { ClientBar, ClientFoot, clientChromeStyles } from '../components/ClientPageChrome';

/* The client portal (/c/<token>, client portal prompt 1): one link per
 * client, a home screen of cards. The token resolves through /api/portal
 * (api/_routes/portal-public.js) to { client, cards, pinned, unlocked };
 * every card is a module from src/shared/portalModules.js, resolved and
 * whitelisted on the server, so this page only ever draws what it was
 * handed. A card the server did not send does not exist here: no
 * placeholder, nothing "coming soon". CARD maps a module id to its
 * drawing; an id this page does not know is skipped.
 *
 * Brand v3, the planner's and the review link's shell: Inter, ink ground,
 * paper text, the red dot, flat. The client's brand colour is only ever the
 * seam of the logo panel and never under text. The marketing token set
 * (src/index.css), like every page on this host. Every tap target is 44px
 * or more. The unlock a right PIN earns is kept per device for thirty days
 * (localStorage) and sent back on every read. */

const A2HS_KEY = 'vz_portal_a2hs';
const UNLOCK_PREFIX = 'vz_portal_unlock';
const readLS = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
export const unlockKey = (token) => `${UNLOCK_PREFIX}:${token || '-'}`;

/* The client's own mark: their logo on a flat panel with their first brand colour as its seam, or the Aperture on Visualize red when either is missing. */
function ClientMark({ logoUrl, brandHex, business }) {
  const hex = normalizeBrandColor(brandHex).hex;
  const logo = safeHref(logoUrl);
  const fallback = !logo || !hex;
  return (
    <div className={`pt-mark${fallback ? ' pt-mark--fallback' : ''}`} style={!fallback ? { '--pt-brand': hex } : undefined} aria-hidden={logo ? undefined : 'true'}>
      <span className={`img-fit img-fit--contain pt-mark-fit${logo ? '' : ' pt-mark-fit--icon'}`}>{logo ? <img src={logo} alt={`${business} logo`} className="pt-mark-img" width={56} height={56} loading="eager" /> : <img src={logoSrc('icon', 'reversed')} alt="" className="pt-mark-img" width={40} height={40} />}</span>
    </div>
  );
}

function HomeCard({ card, client }) {
  const who = client?.firstName ? `Hey ${client.firstName}.` : client?.business ? `Hey ${client.business}.` : 'Hey.';
  return (
    <section className="pt-home" aria-label="Home">
      <ClientMark logoUrl={client?.logoUrl} brandHex={client?.brandHex} business={client?.business || 'Client'} />
      <div className="pt-home-text">
        <h1 className="pt-title">{who}</h1>
        {card.status && <p className="pt-status" role="status">{card.status}</p>}
        <p className="pt-made"><Logo width={72} decorative /><span>Made by Rob</span></p>
      </div>
    </section>
  );
}

/* The two hrefs the contact card may carry, exactly: sms: with digits, mailto: with one address. safeHref knows http and site paths only, and these are the only other schemes this page will ever follow. */
const smsHref = (v) => (/^sms:\+?\d{3,20}$/.test(String(v || '')) ? String(v) : '');
const mailHref = (v) => (/^mailto:[^\s@/?#]+@[^\s@/?#]+\.[^\s@/?#]+$/.test(String(v || '')) ? String(v) : '');

function ContactCard({ card }) {
  const sms = smsHref(card.sms); const mailto = mailHref(card.mailto);
  return (
    <section className="pt-card" aria-labelledby="pt-contact-h">
      <h2 className="pt-card-h" id="pt-contact-h">Message Rob</h2>
      <div className="pt-actions">
        {sms && <a className="pt-btn" href={sms}><MessageTextSquare02 width={18} height={18} aria-hidden="true" />Text me</a>}
        {mailto && <a className="pt-btn pt-btn--ghost" href={mailto}><Mail01 width={18} height={18} aria-hidden="true" />Email me</a>}
        <a className="pt-btn pt-btn--ghost" href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><AtSign width={18} height={18} aria-hidden="true" />{card.instagram ? `@${card.instagram}` : INSTAGRAM_HANDLE}</a>
      </div>
      {card.hours && <p className="pt-line"><Clock width={16} height={16} aria-hidden="true" /><span>Hours: {card.hours}</span></p>}
    </section>
  );
}

/* The module id to its card. Prompts 2 to 4 add a line here and an entry in the registry, nothing else. */
const CARD = { home: HomeCard, contact: ContactCard };

export default function Portal() {
  const { token = '' } = useParams();
  const [data, setData] = useState(null);     // { client, cards, pinned, unlocked }
  const [state, setState] = useState('loading'); // loading | ready | expired | failed
  const [hint, setHint] = useState(() => readLS(A2HS_KEY, '') !== 'seen');

  const business = data?.client?.business || '';
  useHead({ title: `${business || 'Your portal'} | Visualize.`, description: 'Everything about your work with Visualize, in one place.', noindex: true });

  useEffect(() => {
    let live = true;
    if (!token) { setState('expired'); return undefined; }
    const unlock = readLS(unlockKey(token), '');
    fetch(`/api/portal?token=${encodeURIComponent(token)}${unlock ? `&unlock=${encodeURIComponent(unlock)}` : ''}`, { cache: 'no-store' })
      .then(async (r) => { if (!live) return; if (r.status === 404) { setState('expired'); return; } if (!r.ok) { setState('failed'); return; } const d = await r.json(); setData(d); setState('ready'); })
      .catch(() => { if (live) setState('failed'); });
    return () => { live = false; };
  }, [token]);

  const dismissHint = () => { setHint(false); writeLS(A2HS_KEY, 'seen'); };

  let body;
  if (state === 'loading') body = <p className="pt-lead" aria-busy="true">One second.</p>;
  else if (state === 'expired') body = (
    <div className="pt-done" data-state="expired">
      <h1 className="pt-title">This link expired.</h1>
      <p className="pt-lead">Message me and I'll send you a new one.</p>
      <div className="pt-actions">
        <a className="pt-btn" href={INSTAGRAM_URL} target="_blank" rel="noreferrer"><AtSign width={18} height={18} aria-hidden="true" />{INSTAGRAM_HANDLE}</a>
        <a className="pt-btn pt-btn--ghost" href={`mailto:${CONTACT_EMAIL}`}><Mail01 width={18} height={18} aria-hidden="true" />Email me</a>
      </div>
    </div>
  );
  else if (state === 'failed') body = (
    <div className="pt-done" data-state="failed"><h1 className="pt-title">That did not load.</h1><p className="pt-lead">Give it a moment and open the link again.</p><button type="button" className="pt-btn" onClick={() => window.location.reload()}>Try again</button></div>
  );
  else body = (
    <div className="pt-cards">
      {hint && (
        <div className="pt-hint" role="note">
          <span>Keep this handy: open your browser's share menu and tap Add to Home Screen.</span>
          <button type="button" className="pt-hint-x" onClick={dismissHint} aria-label="Dismiss"><XClose width={18} height={18} aria-hidden="true" /></button>
        </div>
      )}
      {(data?.cards || []).map((card) => { const Draw = CARD[card.id]; return Draw ? <Draw key={card.id} card={card} client={data.client} token={token} /> : null; })}
    </div>
  );

  return (
    <section className="pt section">
      <div className="wrap pt-wrap">
        <ClientBar label={business || undefined} />
        {body}
        <ClientFoot />
      </div>
      <style>{clientChromeStyles + ptStyles}</style>
    </section>
  );
}

/* Flat, ink and paper, the red dot: no outline, gradient or shadow. The tokens are the marketing set (src/index.css). */
const ptStyles = `
  .pt { background: var(--bg); color: var(--text); font-family: var(--font-body); }
  .pt-wrap { max-width: 600px; }
  .pt-cards { display: flex; flex-direction: column; gap: var(--space-4); }
  .pt-home { display: flex; align-items: flex-start; gap: var(--space-4); margin: var(--space-2) 0 var(--space-4); min-width: 0; }
  .pt-home-text { min-width: 0; flex: 1; }
  .pt-mark { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: var(--radius); background: var(--bg-card); border-left: 6px solid var(--pt-brand, var(--brand)); }
  .pt-mark--fallback { background: var(--brand); border-left-color: var(--brand); }
  .pt-mark-fit { display: block; width: 56px; height: 56px; background: transparent; }
  .pt-mark-fit--icon { width: 40px; height: 40px; }
  .pt-mark-img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .pt-title { margin: 0 0 var(--space-2); font-family: var(--font-body); font-weight: 800; font-size: clamp(1.75rem, 6vw, 2.5rem); line-height: 1.1; letter-spacing: -0.02em; color: var(--text); overflow-wrap: anywhere; }
  .pt-title::after { content: ''; display: inline-block; width: 0.28em; height: 0.28em; margin-left: 0.18em; border-radius: 50%; background: var(--brand); vertical-align: baseline; }
  .pt-status { margin: 0 0 var(--space-3); font-size: 1.0625rem; line-height: 1.5; font-weight: 600; color: var(--text-secondary); }
  .pt-made { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-size: 0.8125rem; color: var(--text-muted); }
  .pt-lead { margin: 0; font-size: 1.0625rem; line-height: 1.6; color: var(--text-secondary); }
  .pt-card { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); background: var(--bg-card); border-radius: var(--radius-lg); min-width: 0; }
  .pt-card-h { margin: 0; font-size: 1.125rem; font-weight: 700; line-height: 1.3; color: var(--text); }
  .pt-actions { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .pt-line { display: flex; align-items: center; gap: var(--space-2); margin: 0; font-size: 0.9375rem; color: var(--text-secondary); min-height: 24px; }
  .pt-line svg { flex-shrink: 0; color: var(--text-muted); }
  /* The button rests on the dark red: paper text on the base red falls short of 4.5 to 1, on --brand-dark it clears it; flat either way. */
  .pt-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 var(--space-5); background: var(--brand-dark); color: var(--text); border: 0; border-radius: var(--radius); font-family: inherit; font-size: 0.9375rem; font-weight: 700; cursor: pointer; text-decoration: none; max-width: 100%; }
  .pt-btn:hover { opacity: 0.92; }
  .pt-btn:focus-visible { outline: 2px solid var(--brand-light); outline-offset: 3px; }
  .pt-btn[disabled] { opacity: 0.7; cursor: default; }
  .pt-btn--ghost { background: var(--bg); color: var(--text); }
  .pt-card .pt-btn--ghost { background: var(--bg); }
  .pt-btn--ghost:hover { background: var(--hover-soft); opacity: 1; }
  .pt-done { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); margin: var(--space-6) 0 var(--space-8); padding: var(--space-8) var(--space-6); background: var(--bg-card); border-radius: var(--radius-lg); }
  .pt-hint { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4); background: var(--bg-card); border-left: 6px solid var(--brand); border-radius: var(--radius); font-size: 0.875rem; line-height: 1.5; color: var(--text-secondary); }
  .pt-hint span { flex: 1; min-width: 0; }
  .pt-hint-x { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; background: transparent; border: 0; border-radius: var(--radius); color: var(--text-secondary); cursor: pointer; }
  .pt-hint-x:hover { background: var(--hover-soft); color: var(--text); }
  .pt-hint-x:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
`;
