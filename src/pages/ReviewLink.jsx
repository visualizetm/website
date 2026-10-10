import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Send01 from '@untitled-ui/icons-react/build/esm/Send01';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import { useHead } from '../marketing/useHead';
import { INSTAGRAM_URL, INSTAGRAM_HANDLE } from '../marketing/links';
import { safeHref } from '../lib/safeUrl';
import { normalizeBrandColor } from '../shared/color';
import { logoSrc } from '../ui/logo.data';
import { ClientBar, ClientFoot, clientChromeStyles } from '../components/ClientPageChrome';
import { StarRating } from './Review';

/* The Visualize review link's page (/r/<token>, review links job): one
 * short screen for a client to review me. The token resolves through
 * /api/review (api/_routes/review-public.js) to the business, the first
 * name, their logo and brand colour and my Google link; a dead token
 * gets the expired state. Brand v3: Inter, ink ground, paper text, the red
 * dot, flat, no outline, gradient or shadow anywhere. Every tap target is
 * 48px. The draft lives in sessionStorage while the tab is open. */

const TEXT_MIN = 20;
const TEXT_MAX = 800;
const DRAFT_PREFIX = 'vz_rlink_draft';
const EMPTY = { name: '', role: '', rating: 0, text: '', consent: false };
const readDraft = (key) => { try { const raw = sessionStorage.getItem(key); return raw ? { ...EMPTY, ...JSON.parse(raw) } : null; } catch { return null; } };

/* The client's own mark on a small flat panel: their first brand colour as the panel's seam beside their logo, or the Aperture on Visualize red when either is missing. The colour never carries text, so it needs no contrast check. */
function ClientMark({ logoUrl, brandHex, business }) {
  const hex = normalizeBrandColor(brandHex).hex;
  const logo = safeHref(logoUrl);
  const fallback = !logo || !hex;
  return (
    <div className={`rl-mark${fallback ? ' rl-mark--fallback' : ''}`} style={!fallback ? { '--rl-brand': hex } : undefined} aria-hidden={logo ? undefined : 'true'}>
      {logo ? <img src={logo} alt={`${business} logo`} className="rl-mark-img" width={56} height={56} loading="eager" /> : <img src={logoSrc('icon', 'reversed')} alt="" className="rl-mark-img" width={40} height={40} />}
    </div>
  );
}

export default function ReviewLink() {
  const { token = '' } = useParams();
  const draftKey = `${DRAFT_PREFIX}:${token || '-'}`;
  const [client, setClient] = useState(null);   // { business, firstName, logoUrl, brandHex, googleReviewUrl }
  const [state, setState] = useState('loading'); // loading | ready | expired | failed
  const [form, setForm] = useState(() => readDraft(`${DRAFT_PREFIX}:${token || '-'}`) || EMPTY);
  const [trap, setTrap] = useState('');
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | done | error

  useHead({ title: 'How was working with me? | Visualize.', description: 'A minute of your time, and it helps more than you know.', noindex: true });

  useEffect(() => {
    let live = true;
    if (!token) { setState('expired'); return undefined; }
    fetch(`/api/review?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (r) => { if (!live) return; if (r.status === 404) { setState('expired'); return; } if (!r.ok) { setState('failed'); return; } const d = await r.json(); setClient(d); setState('ready'); setForm(f => ({ ...f, name: f.name || d.firstName || '', role: f.role || d.business || '' })); })
      .catch(() => { if (live) setState('failed'); });
    return () => { live = false; };
  }, [token]);

  useEffect(() => { if (status === 'done') return; try { sessionStorage.setItem(draftKey, JSON.stringify(form)); } catch { /* private mode */ } }, [form, draftKey, status]);
  const set = useCallback((k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => (e[k] ? { ...e, [k]: '' } : e)); }, []);

  const validate = () => {
    const e = {};
    if (!form.rating) e.rating = 'Pick a rating, one star to five.';
    const n = form.text.trim().length;
    if (n < TEXT_MIN) e.text = n ? `A little more, ${TEXT_MIN} characters at least.` : 'A line or two about how it went.';
    if (!form.name.trim()) e.name = 'Your name, so I know who this is.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const submit = async (ev) => {
    ev?.preventDefault();
    if (status === 'sending') return;
    if (!validate()) { document.querySelector('.rl-field--err input, .rl-field--err textarea, .rl-field--err [role="radio"]')?.focus(); return; }
    setStatus('sending');
    try {
      const res = await fetch(`/api/review?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name.trim(), role: form.role.trim(), business: client?.business || '', rating: form.rating, text: form.text.trim(), consent: !!form.consent, company: trap }) });
      if (res.status === 404) { setState('expired'); return; }
      if (!res.ok) throw new Error(res.status === 429 ? 'rate' : `status ${res.status}`);
      setStatus('done');
      try { sessionStorage.removeItem(draftKey); } catch { /* nothing to clear */ }
    } catch (err) {
      setStatus('error');
      setErrors(e => ({ ...e, submit: err.message === 'rate' ? 'That is a few in a row. Give it a few minutes and try again.' : 'That did not send. Your words are still here, try again.' }));
    }
  };

  const count = form.text.trim().length;
  const google = safeHref(client?.googleReviewUrl);
  const who = client?.firstName ? `Hey ${client.firstName}.` : client?.business ? `Hey ${client.business}.` : 'Hey.';

  let body;
  if (state === 'loading') body = <p className="rl-lead" aria-busy="true">One second.</p>;
  else if (state === 'expired') body = (
    <div className="rl-done" data-state="expired">
      <h1 className="rl-title">This link expired.</h1>
      <p className="rl-lead">Message me on Instagram and I'll send a new one.</p>
      <a className="rl-btn rl-btn--ghost" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">{INSTAGRAM_HANDLE} <ArrowUpRight width={16} height={16} aria-hidden="true" /></a>
    </div>
  );
  else if (state === 'failed') body = (
    <div className="rl-done" data-state="failed"><h1 className="rl-title">That did not load.</h1><p className="rl-lead">Give it a moment and open the link again.</p><button type="button" className="rl-btn" onClick={() => window.location.reload()}>Try again</button></div>
  );
  else if (status === 'done') body = (
    <div className="rl-done" data-state="done">
      <span className="rl-done-icon" aria-hidden="true"><CheckCircle width={22} height={22} /></span>
      <h1 className="rl-title">Thanks. That means a lot.</h1>
      <p className="rl-lead">{form.rating >= 4 ? 'It is the kind of thing that keeps a one person studio going.' : 'I read every one of these, and I will take it to heart.'}</p>
      {google ? <a className="rl-btn rl-btn--ghost" href={google} target="_blank" rel="noreferrer">Leave it on Google too <ArrowUpRight width={16} height={16} aria-hidden="true" /></a> : null}
    </div>
  );
  else body = (
    <>
      <div className="rl-head">
        <ClientMark logoUrl={client.logoUrl} brandHex={client.brandHex} business={client.business} />
        <div className="rl-head-text">
          <h1 className="rl-title">{who}</h1>
          <p className="rl-lead">How was working with me? A minute of your time, and it helps more than you know.</p>
        </div>
      </div>
      <form className="rl-form" onSubmit={submit} noValidate>
        <div className={`rl-field${errors.rating ? ' rl-field--err' : ''}`}>
          <span className="rl-label" id="rl-rating-label">Your rating</span>
          <StarRating value={form.rating} onChange={(n) => set('rating', n)} invalid={!!errors.rating} describedBy={errors.rating ? 'rl-rating-err' : 'rl-rating-said'} size={48} />
          <p className="rl-note" id="rl-rating-said" role="status">{form.rating ? `${form.rating} star${form.rating === 1 ? '' : 's'}.` : 'Tap a star.'}</p>
          {errors.rating && <p className="rl-err" id="rl-rating-err" role="alert">{errors.rating}</p>}
        </div>
        <div className={`rl-field${errors.text ? ' rl-field--err' : ''}`}>
          <label className="rl-label" htmlFor="rl-text">How was working with me?</label>
          <textarea id="rl-text" className="rl-input rl-textarea" rows={5} value={form.text} maxLength={TEXT_MAX} onChange={(e) => set('text', e.target.value.slice(0, TEXT_MAX))} placeholder="What did you need, and how did it turn out?" aria-invalid={errors.text ? 'true' : undefined} aria-describedby={`rl-text-count${errors.text ? ' rl-text-err' : ''}`} />
          <p className="rl-note" id="rl-text-count">{count < TEXT_MIN ? `${count} of ${TEXT_MIN} characters to start` : `${count} of ${TEXT_MAX}`}</p>
          {errors.text && <p className="rl-err" id="rl-text-err" role="alert">{errors.text}</p>}
        </div>
        <div className="rl-two">
          <div className={`rl-field${errors.name ? ' rl-field--err' : ''}`}>
            <label className="rl-label" htmlFor="rl-name">Your name</label>
            <input id="rl-name" className="rl-input" type="text" value={form.name} autoComplete="name" onChange={(e) => set('name', e.target.value.slice(0, 120))} aria-invalid={errors.name ? 'true' : undefined} aria-describedby={errors.name ? 'rl-name-err' : undefined} />
            {errors.name && <p className="rl-err" id="rl-name-err" role="alert">{errors.name}</p>}
          </div>
          <div className="rl-field">
            <label className="rl-label" htmlFor="rl-role">Role or business</label>
            <input id="rl-role" className="rl-input" type="text" value={form.role} autoComplete="organization" onChange={(e) => set('role', e.target.value.slice(0, 120))} />
          </div>
        </div>
        <label className="rl-consent">
          <input type="checkbox" className="rl-check" checked={!!form.consent} onChange={(e) => set('consent', e.target.checked)} />
          <span>Rob can share this on visualizestudio.org</span>
        </label>
        <div className="rl-trap" aria-hidden="true">
          <label htmlFor="rl-company">Company (leave this empty)</label>
          <input id="rl-company" name="company" type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </div>
        {status === 'error' && <p className="rl-submit-err" role="alert">{errors.submit}</p>}
        <button type="submit" className="rl-btn" disabled={status === 'sending'} aria-busy={status === 'sending' ? 'true' : undefined}>
          {status === 'sending' ? 'Sending' : status === 'error' ? 'Try again' : 'Send it'} <Send01 width={16} height={16} aria-hidden="true" />
        </button>
      </form>
    </>
  );

  return (
    <section className="rl section">
      <div className="wrap rl-wrap">
        <ClientBar label={client?.business || undefined} />
        {body}
        <ClientFoot />
      </div>
      <style>{clientChromeStyles + rlStyles}</style>
    </section>
  );
}

/* Flat, ink and paper, the red dot: no outline, gradient or shadow. The tokens are the marketing set (src/index.css). */
const rlStyles = `
  .rl { background: var(--bg); color: var(--text); font-family: var(--font-body); }
  .rl-wrap { max-width: 600px; }
  .rl-head { display: flex; align-items: flex-start; gap: var(--space-4); margin: var(--space-6) 0 var(--space-8); }
  .rl-head-text { min-width: 0; }
  .rl-mark { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: var(--radius); background: var(--bg-card); border-left: 6px solid var(--rl-brand, var(--brand)); }
  .rl-mark--fallback { background: var(--brand); border-left-color: var(--brand); }
  .rl-mark-img { display: block; max-width: 56px; max-height: 56px; object-fit: contain; }
  .rl-title { margin: 0 0 var(--space-2); font-family: var(--font-body); font-weight: 800; font-size: clamp(1.75rem, 6vw, 2.5rem); line-height: 1.1; letter-spacing: -0.02em; color: var(--text); }
  .rl-title::after { content: ''; display: inline-block; width: 0.28em; height: 0.28em; margin-left: 0.18em; border-radius: 50%; background: var(--brand); vertical-align: baseline; }
  .rl-lead { margin: 0; font-size: 1.0625rem; line-height: 1.6; color: var(--text-secondary); }
  .rl-form { display: flex; flex-direction: column; gap: var(--space-6); }
  .rl-field { display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
  .rl-two { display: grid; grid-template-columns: 1fr; gap: var(--space-4); }
  @media (min-width: 480px) { .rl-two { grid-template-columns: 1fr 1fr; } }
  .rl-label { font-size: 0.9375rem; font-weight: 700; color: var(--text); }
  .rl-note { margin: 0; font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5; }
  .rl-err { margin: 0; font-size: 0.8125rem; font-weight: 600; color: var(--brand-text); }
  .rl-input { width: 100%; min-height: 48px; padding: var(--space-3) var(--space-4); background: var(--bg-card); color: var(--text); border: 0; border-bottom: 2px solid var(--border-light); border-radius: var(--radius) var(--radius) 0 0; font: inherit; font-size: 1rem; }
  .rl-input::placeholder { color: var(--text-faint); }
  .rl-input:focus-visible { outline: 0; border-bottom-color: var(--brand); }
  .rl-textarea { min-height: 150px; resize: vertical; line-height: 1.6; }
  .rl-field--err .rl-input { border-bottom-color: var(--brand); }
  .rl .rvw-stars { gap: var(--space-1); }
  .rl .rvw-star { display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; padding: 0; background: var(--bg-card); border: 0; border-radius: var(--radius); color: var(--text-faint); cursor: pointer; }
  .rl .rvw-star:hover { color: var(--brand-text); }
  .rl .rvw-star.is-on { color: var(--brand-text); }
  .rl .rvw-star.is-on svg { fill: currentColor; }
  .rl .rvw-star:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .rl-field--err .rvw-star { color: var(--brand); }
  .rl-consent { display: flex; align-items: center; gap: var(--space-3); min-height: 48px; font-size: 0.9375rem; color: var(--text); cursor: pointer; }
  .rl-check { width: 24px; height: 24px; margin: 0; accent-color: var(--brand); flex-shrink: 0; }
  .rl-trap { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .rl-submit-err { margin: 0; padding: var(--space-4); background: var(--bg-card); border-left: 6px solid var(--brand); border-radius: var(--radius); color: var(--text); font-size: 0.9375rem; line-height: 1.5; }
  /* The button rests on the dark red: paper text on the base red falls short of 4.5 to 1, on --brand-dark it clears it; flat either way. */
  .rl-btn { align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; min-height: 52px; padding: 0 var(--space-6); background: var(--brand-dark); color: var(--text); border: 0; border-radius: var(--radius); font-family: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; text-decoration: none; }
  .rl-btn:hover { opacity: 0.92; }
  .rl-btn:focus-visible { outline: 2px solid var(--brand-light); outline-offset: 3px; }
  .rl-btn[disabled] { opacity: 0.7; cursor: default; }
  .rl-btn--ghost { background: var(--bg-card); color: var(--text); }
  .rl-btn--ghost:hover { background: var(--hover-soft); }
  .rl-done { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); margin: var(--space-6) 0 var(--space-8); padding: var(--space-8); background: var(--bg-card); border-radius: var(--radius-lg); }
  .rl-done-icon { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--radius); background: var(--brand-dark); color: var(--text); }
`;
