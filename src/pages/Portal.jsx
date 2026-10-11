import { useParams } from 'react-router-dom';
import MessageTextSquare02 from '@untitled-ui/icons-react/build/esm/MessageTextSquare02';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import AtSign from '@untitled-ui/icons-react/build/esm/AtSign';
import Clock from '@untitled-ui/icons-react/build/esm/Clock';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Calendar from '@untitled-ui/icons-react/build/esm/Calendar';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import File06 from '@untitled-ui/icons-react/build/esm/File06';
import FileAttachment04 from '@untitled-ui/icons-react/build/esm/FileAttachment04';
import Table from '@untitled-ui/icons-react/build/esm/Table';
import Link01 from '@untitled-ui/icons-react/build/esm/Link01';
import Share01 from '@untitled-ui/icons-react/build/esm/Share01';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import Lock01 from '@untitled-ui/icons-react/build/esm/Lock01';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

function BookCard({ card }) {
  const url = safeHref(card.url);
  if (!url) return null;
  return (
    <section className="pt-card" aria-labelledby="pt-book-h">
      <h2 className="pt-card-h" id="pt-book-h">Book a call</h2>
      <p className="pt-lead pt-lead--sm">Pick a time that suits you and I'll be on the other end.</p>
      <div className="pt-actions"><a className="pt-btn" href={url} target="_blank" rel="noreferrer"><Calendar width={18} height={18} aria-hidden="true" />Pick a time<ArrowUpRight width={16} height={16} aria-hidden="true" /></a></div>
    </section>
  );
}

const KIND_ICON = { doc: File06, pdf: FileAttachment04, sheet: Table, drive: Link01, link: Link01 };
const KIND_LABEL = { doc: 'Doc', pdf: 'PDF', sheet: 'Sheet', drive: 'Drive', link: 'Link' };
function DocumentsCard({ card }) {
  const items = (Array.isArray(card.items) ? card.items : []).map(d => ({ ...d, href: safeHref(d.url) })).filter(d => d.href && d.label);
  if (!items.length) return null;
  return (
    <section className="pt-card" aria-labelledby="pt-docs-h">
      <h2 className="pt-card-h" id="pt-docs-h">Your documents</h2>
      <ul className="pt-docs">
        {items.map((d) => { const Icon = KIND_ICON[d.kind] || Link01; return (
          <li key={d.id || d.href} className="pt-doc">
            <a className="pt-doc-link" href={d.href} target="_blank" rel="noreferrer">
              <span className="pt-doc-icon" aria-hidden="true"><Icon width={18} height={18} /></span>
              <span className="pt-doc-text"><span className="pt-doc-label">{d.label}</span><span className="pt-doc-kind">{KIND_LABEL[d.kind] || 'Link'}</span></span>
              <ArrowUpRight width={16} height={16} aria-hidden="true" className="pt-doc-arrow" />
            </a>
          </li>
        ); })}
      </ul>
    </section>
  );
}

/* Share this: the system share sheet with the message when the device has one, else the message goes to the clipboard. */
function ShowcaseCard({ card }) {
  const url = safeHref(card.url);
  const [said, setSaid] = useState('');
  if (!url) return null;
  const message = String(card.message || url);
  const share = async () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') { await navigator.share({ title: 'Made with Visualize', text: message, url }); setSaid(''); return; }
      await navigator.clipboard.writeText(message); setSaid('Copied. Paste it anywhere.');
    } catch (e) { if (e?.name !== 'AbortError') setSaid('Copy the link above and share it anywhere.'); }
  };
  return (
    <section className="pt-card" aria-labelledby="pt-show-h">
      <h2 className="pt-card-h" id="pt-show-h">Your showcase</h2>
      <p className="pt-lead pt-lead--sm">Your work is up on visualizestudio.org. Share it with anyone.</p>
      <div className="pt-actions">
        <a className="pt-btn" href={url} target="_blank" rel="noreferrer">See it<ArrowUpRight width={16} height={16} aria-hidden="true" /></a>
        <button type="button" className="pt-btn pt-btn--ghost" onClick={share}><Share01 width={18} height={18} aria-hidden="true" />Share this</button>
      </div>
      {said && <p className="pt-line" role="status"><Copy01 width={16} height={16} aria-hidden="true" /><span>{said}</span></p>}
    </section>
  );
}

const fmtDay = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || '')); if (!m) return String(d || ''); return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
const copyToClipboard = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } };

/* Pay (prompt 2): the open invoice and the ways to pay it, each a full width row in Settings' order. Zelle has no link: the address with Copy. */
function PayCard({ card }) {
  const [said, setSaid] = useState('');
  const methods = (Array.isArray(card.methods) ? card.methods : []).map(m => ({ ...m, href: m.url ? safeHref(m.url) : '' })).filter(m => m.id === 'zelle' ? !!m.copy : !!m.href);
  return (
    <section className="pt-card" aria-labelledby="pt-pay-h">
      <h2 className="pt-card-h" id="pt-pay-h">Pay</h2>
      <div className="pt-pay-head">
        <span className="pt-pay-label">{card.label}</span>
        <span className="pt-pay-amount">{card.amountText}</span>
        {card.due && <span className="pt-pay-due">{card.plan ? 'Next installment' : 'Due'} {fmtDay(card.due)}{card.pastDue ? ', past due' : ''}</span>}
      </div>
      {methods.length > 0 && (
        <ul className="pt-pay-list">
          {methods.map(m => (
            <li key={m.id} className="pt-pay-row" data-method={m.id}>
              {m.id === 'zelle' ? (
                <div className="pt-pay-zelle">
                  <span className="pt-pay-text"><span className="pt-pay-name">{m.name}</span><span className="pt-pay-line">{m.copy}. {m.line}</span></span>
                  <button type="button" className="pt-btn pt-btn--ghost pt-pay-copy" onClick={async () => setSaid((await copyToClipboard(m.copy)) ? `${m.kind === 'phone' ? 'Number' : 'Email'} copied. Send ${card.amountText}.` : `Send ${card.amountText} to ${m.copy}.`)}><Copy01 width={18} height={18} aria-hidden="true" />Copy</button>
                </div>
              ) : (
                <a className="pt-pay-link" href={m.href} target="_blank" rel="noreferrer">
                  <span className="pt-pay-text"><span className="pt-pay-name">{m.name}</span><span className="pt-pay-line">{m.line}</span></span>
                  <ArrowUpRight width={16} height={16} aria-hidden="true" className="pt-doc-arrow" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      {said && <p className="pt-line" role="status"><Check width={16} height={16} aria-hidden="true" /><span>{said}</span></p>}
      {card.hint && <p className="pt-note">{card.hint}</p>}
    </section>
  );
}

/* Payment plan: which installment is next and a dot per installment. */
function PlanCard({ card }) {
  const dots = Array.isArray(card.dots) ? card.dots : [];
  return (
    <section className="pt-card" aria-labelledby="pt-plan-h">
      <h2 className="pt-card-h" id="pt-plan-h">Payment {card.n} of {card.of}</h2>
      {card.nextDue && <p className="pt-lead pt-lead--sm">{card.nextAmountText} on {fmtDay(card.nextDue)}.</p>}
      <ul className="pt-dots" aria-label={`${dots.filter(d => d === 'paid').length} of ${dots.length} paid`}>{dots.map((d, i) => <li key={i} className={`pt-dot${d === 'paid' ? ' is-paid' : ''}`} aria-hidden="true" />)}</ul>
      {card.line && <p className="pt-note">{card.line}</p>}
    </section>
  );
}

/* Retainer: the active plan, or the one plan to keep it running after delivery. */
function RetainerCard({ card }) {
  const sms = smsHref(card.sms); const mailto = mailHref(card.mailto); const url = safeHref(card.url);
  if (card.mode === 'offer' && !url) return null;
  return (
    <section className="pt-card" aria-labelledby="pt-ret-h">
      <h2 className="pt-card-h" id="pt-ret-h">{card.mode === 'offer' ? 'Keep it running' : 'Your retainer'}</h2>
      <div className="pt-pay-head"><span className="pt-pay-label">{card.name}</span><span className="pt-pay-amount">{card.priceText}</span>{card.renews && <span className="pt-pay-due">{card.renews}</span>}</div>
      {card.mode === 'offer' ? (
        <>
          {card.pitch && <p className="pt-lead pt-lead--sm">{card.pitch}</p>}
          <div className="pt-actions"><a className="pt-btn" href={url} target="_blank" rel="noreferrer">Start {card.name}<ArrowUpRight width={16} height={16} aria-hidden="true" /></a></div>
        </>
      ) : (
        <>
          {card.notice && <p className="pt-note">{card.notice}.</p>}
          <div className="pt-actions">
            {sms && <a className="pt-btn pt-btn--ghost" href={sms}><MessageTextSquare02 width={18} height={18} aria-hidden="true" />Message Rob</a>}
            {!sms && mailto && <a className="pt-btn pt-btn--ghost" href={mailto}><Mail01 width={18} height={18} aria-hidden="true" />Message Rob</a>}
          </div>
        </>
      )}
    </section>
  );
}

/* A sensitive card before the device unlocked it: the title and one button into the PIN sheet. */
function LockedCard({ card, onUnlock }) {
  return (
    <section className="pt-card pt-card--locked" aria-label={`${card.title}, locked`}>
      <h2 className="pt-card-h">{card.title}</h2>
      <p className="pt-lead pt-lead--sm">This one is behind your PIN.</p>
      <div className="pt-actions"><button type="button" className="pt-btn" onClick={onUnlock}><Lock01 width={18} height={18} aria-hidden="true" />Enter PIN</button></div>
    </section>
  );
}

const overlay = (node) => (typeof document === 'undefined' ? node : createPortal(node, document.body));
/* The PIN sheet: four digits, one input, the answer from /api/portal's pin door; a right PIN's unlock is kept on the device for thirty days and the page reads again. */
function PinSheet({ token, onClose, onUnlocked }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const submit = async (ev) => {
    ev?.preventDefault();
    if (busy) return;
    if (!/^\d{4}$/.test(pin)) { setError('Four digits.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/portal?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pin', pin }) });
      if (res.status === 401) { setError('That PIN is not it.'); setPin(''); inputRef.current?.focus(); return; }
      if (res.status === 429) { setError('That is a few tries. Give it fifteen minutes.'); return; }
      if (!res.ok) throw new Error(`status ${res.status}`);
      const d = await res.json();
      writeLS(unlockKey(token), String(d.unlock || ''));
      onUnlocked();
    } catch { setError('That did not go through. Try again.'); }
    finally { setBusy(false); }
  };
  return overlay(
    <div className="pt-panel-wrap" role="dialog" aria-modal="true" aria-label="Enter your PIN">
      <button type="button" className="pt-scrim" aria-label="Close" onClick={onClose} />
      <form className="pt-panel" onSubmit={submit} noValidate>
        <div className="pt-panel-head">
          <span className="pt-panel-title">Enter your PIN</span>
          <button type="button" className="pt-hint-x" onClick={onClose} aria-label="Close"><XClose width={18} height={18} aria-hidden="true" /></button>
        </div>
        <div className="pt-panel-body">
          <label className="pt-label" htmlFor="pt-pin">The four digits Rob gave you</label>
          <input id="pt-pin" ref={inputRef} className="pt-input pt-input--pin" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={4} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); if (error) setError(''); }} aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'pt-pin-err' : 'pt-pin-note'} />
          <p className="pt-note" id="pt-pin-note">Remembered on this device for thirty days.</p>
          {error && <p className="pt-err" id="pt-pin-err" role="alert">{error}</p>}
          <button type="submit" className="pt-btn" disabled={busy} aria-busy={busy ? 'true' : undefined}><Check width={18} height={18} aria-hidden="true" />{busy ? 'Checking' : 'Unlock'}</button>
        </div>
      </form>
    </div>
  );
}

/* The module id to its card. Prompts 2 to 4 add a line here and an entry in the registry, nothing else. */
const CARD = { home: HomeCard, contact: ContactCard, book: BookCard, documents: DocumentsCard, showcase: ShowcaseCard, pay: PayCard, plan: PlanCard, retainer: RetainerCard };

export default function Portal() {
  const { token = '' } = useParams();
  const [data, setData] = useState(null);     // { client, cards, pinned, unlocked }
  const [state, setState] = useState('loading'); // loading | ready | expired | failed
  const [hint, setHint] = useState(() => readLS(A2HS_KEY, '') !== 'seen');
  const [pinOpen, setPinOpen] = useState(false);
  const [gen, setGen] = useState(0); // bumps to read again after an unlock

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
  }, [token, gen]);

  const dismissHint = () => { setHint(false); writeLS(A2HS_KEY, 'seen'); };
  const [thanks, setThanks] = useState(false);
  useEffect(() => { if (data?.paid) { setThanks(true); const t = setTimeout(() => setThanks(false), 6000); return () => clearTimeout(t); } return undefined; }, [data]);
  const closePin = useCallback(() => setPinOpen(false), []);
  const unlocked = useCallback(() => { setPinOpen(false); setGen(g => g + 1); }, []);

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
      {(data?.cards || []).map((card) => { if (card.locked) return <LockedCard key={card.id} card={card} onUnlock={() => setPinOpen(true)} />; const Draw = CARD[card.id]; return Draw ? <Draw key={card.id} card={card} client={data.client} token={token} /> : null; })}
      {pinOpen && <PinSheet token={token} onClose={closePin} onUnlocked={unlocked} />}
      {thanks && <p className="pt-toast" role="status"><Check width={16} height={16} aria-hidden="true" /><span>Paid, thank you.</span></p>}
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
  .pt-lead--sm { font-size: 0.9375rem; line-height: 1.5; }
  /* Documents: one row per link, the whole row the target, snap stop per row so a flick lands on one. */
  .pt-docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); scroll-snap-type: y proximity; }
  .pt-doc { scroll-snap-align: start; }
  .pt-doc-link { display: flex; align-items: center; gap: var(--space-3); min-height: 56px; padding: var(--space-2) var(--space-3); border-radius: var(--radius); background: var(--bg); color: var(--text); text-decoration: none; }
  .pt-doc-link:hover { background: var(--hover-soft); }
  .pt-doc-link:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pt-doc-icon { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--radius); background: var(--bg-card); color: var(--text-secondary); }
  .pt-doc-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .pt-doc-label { font-size: 0.9375rem; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
  .pt-doc-kind { font-size: 0.75rem; color: var(--text-muted); }
  .pt-doc-arrow { flex-shrink: 0; color: var(--text-muted); }
  .pt-card--locked { border-left: 6px solid var(--brand); }
  /* The PIN sheet: a bottom sheet on a phone, a side panel from 768 up (the planner's). */
  .pt-panel-wrap { position: fixed; inset: 0; z-index: 60; display: flex; justify-content: flex-end; font-family: var(--font-body); }
  .pt-scrim { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; background: rgba(0, 0, 0, 0.6); border: 0; cursor: pointer; }
  .pt-panel { position: relative; display: flex; flex-direction: column; width: 100%; max-height: 92vh; margin-top: auto; background: var(--bg-elevated); border-top: 1px solid var(--border); border-radius: var(--radius-lg) var(--radius-lg) 0 0; animation: ptUp 0.28s var(--ease); }
  @keyframes ptUp { from { transform: translateY(16px); opacity: 0; } to { transform: none; opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .pt-panel { animation: none; } }
  @media (min-width: 768px) { .pt-panel { width: min(480px, 100%); max-height: none; height: 100%; margin-top: 0; border-radius: 0; border-top: 0; border-left: 1px solid var(--border); } }
  .pt-panel-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3) var(--space-3) var(--space-3) var(--space-5); border-bottom: 1px solid var(--border); }
  .pt-panel-title { font-size: 1rem; font-weight: 700; color: var(--text); }
  .pt-panel-body { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-3); padding: var(--space-5); overflow-y: auto; }
  .pt-label { font-size: 0.9375rem; font-weight: 700; color: var(--text); }
  .pt-note { margin: 0; font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5; }
  .pt-err { margin: 0; font-size: 0.8125rem; font-weight: 600; color: var(--brand-text); }
  .pt-input { width: 100%; min-height: 48px; padding: var(--space-3) var(--space-4); background: var(--bg-card); color: var(--text); border: 0; border-bottom: 2px solid var(--border-light); border-radius: var(--radius) var(--radius) 0 0; font: inherit; font-size: 1rem; }
  .pt-input:focus-visible { outline: 0; border-bottom-color: var(--brand); }
  .pt-input--pin { max-width: 200px; font-size: 1.75rem; letter-spacing: 0.4em; text-align: center; }
  /* Money (prompt 2): the invoice head, the full width pay rows, the plan dots, the one line thanks. */
  .pt-pay-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-1) var(--space-3); }
  .pt-pay-label { font-size: 1rem; font-weight: 600; color: var(--text); min-width: 0; overflow-wrap: anywhere; }
  .pt-pay-amount { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
  .pt-pay-due { flex-basis: 100%; font-size: 0.875rem; color: var(--text-secondary); }
  .pt-pay-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-1); }
  .pt-pay-link, .pt-pay-zelle { display: flex; align-items: center; gap: var(--space-3); min-height: 56px; padding: var(--space-2) var(--space-3); border-radius: var(--radius); background: var(--bg); color: var(--text); text-decoration: none; }
  .pt-pay-link:hover { background: var(--hover-soft); }
  .pt-pay-link:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pt-pay-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .pt-pay-name { font-size: 0.9375rem; font-weight: 600; line-height: 1.3; }
  .pt-pay-line { font-size: 0.8125rem; color: var(--text-muted); overflow-wrap: anywhere; }
  .pt-pay-copy { min-height: 44px; padding: 0 var(--space-3); flex-shrink: 0; }
  .pt-note { margin: 0; font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5; }
  .pt-dots { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .pt-dot { width: 14px; height: 14px; border-radius: 50%; background: var(--bg); border: 2px solid var(--border-light); }
  .pt-dot.is-paid { background: var(--brand); border-color: var(--brand); }
  .pt-toast { position: fixed; left: 50%; bottom: calc(var(--space-6) + env(safe-area-inset-bottom)); transform: translateX(-50%); display: flex; align-items: center; gap: var(--space-2); margin: 0; padding: var(--space-3) var(--space-5); background: var(--bg-elevated); color: var(--text); border-left: 6px solid var(--brand); border-radius: var(--radius); font-size: 0.9375rem; z-index: 50; max-width: calc(100% - 32px); }
`;
