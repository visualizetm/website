import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import { useHead } from '../marketing/useHead';
import { INSTAGRAM_URL, INSTAGRAM_HANDLE } from '../marketing/links';
import { ClientBar, ClientFoot, clientChromeStyles } from '../components/ClientPageChrome';

/* The opt out page (the email system): /u/<token>, one screen. Opening it
 * opts the record out of the marketing emails through /api/unsubscribe
 * (api/_routes/unsubscribe-public.js), says so, and offers one tap of Undo.
 * The mail client's one click unsubscribe posts to the door directly and
 * never lands here. A dead token gets the expired state. Brand v3: Inter,
 * ink ground, paper text, the red dot, flat. */
export default function Unsubscribe() {
  const { token = '' } = useParams();
  const [state, setState] = useState('loading'); // loading | out | back | expired | failed
  const [business, setBusiness] = useState('');
  useHead({ title: 'Stop these emails | Visualize.', description: 'You will not get these emails anymore.', noindex: true });
  const call = async (method, body) => fetch(`/api/unsubscribe?token=${encodeURIComponent(token)}`, { method, cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  useEffect(() => {
    let live = true;
    if (!token) { setState('expired'); return undefined; }
    (async () => {
      try {
        const r = await call('GET');
        if (!live) return;
        if (r.status === 404) { setState('expired'); return; }
        if (!r.ok) { setState('failed'); return; }
        const d = await r.json(); setBusiness(d.business || '');
        const o = await call('POST', { action: 'out' });
        if (!live) return;
        setState(o.ok ? 'out' : 'failed');
      } catch { if (live) setState('failed'); }
    })();
    return () => { live = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const undo = async () => { try { const r = await call('POST', { action: 'undo' }); setState(r.ok ? 'back' : 'failed'); } catch { setState('failed'); } };
  const again = async () => { try { const r = await call('POST', { action: 'out' }); setState(r.ok ? 'out' : 'failed'); } catch { setState('failed'); } };

  let body;
  if (state === 'loading') body = <p className="un-lead" aria-busy="true">One second.</p>;
  else if (state === 'expired') body = (
    <div className="un-done" data-state="expired"><h1 className="un-title">This link expired</h1><p className="un-lead">Reply to any email from me and I will take you off the list by hand.</p><a className="un-btn un-btn--ghost" href={INSTAGRAM_URL} target="_blank" rel="noreferrer">{INSTAGRAM_HANDLE} <ArrowUpRight width={16} height={16} aria-hidden="true" /></a></div>
  );
  else if (state === 'failed') body = (
    <div className="un-done" data-state="failed"><h1 className="un-title">That did not go through</h1><p className="un-lead">Give it a moment and open the link again.</p><button type="button" className="un-btn" onClick={() => window.location.reload()}>Try again</button></div>
  );
  else if (state === 'back') body = (
    <div className="un-done" data-state="back"><h1 className="un-title">You're back on</h1><p className="un-lead">I will keep you posted{business ? ` about ${business}` : ''}. Change your mind any time.</p><button type="button" className="un-btn un-btn--ghost" onClick={again}>Stop these emails</button></div>
  );
  else body = (
    <div className="un-done" data-state="out" role="status"><h1 className="un-title">You won't get these emails anymore</h1><p className="un-lead">That was quick and painless. Anything I owe you (an invoice, your files) still comes through.</p><button type="button" className="un-btn" onClick={undo}>Undo</button></div>
  );
  return (
    <section className="un section">
      <div className="wrap un-wrap">
        <ClientBar label={business || undefined} />
        {body}
        <ClientFoot />
      </div>
      <style>{clientChromeStyles + unStyles}</style>
    </section>
  );
}

const unStyles = `
  .un { background: var(--bg); color: var(--text); font-family: var(--font-body); }
  .un-wrap { max-width: 600px; }
  .un-title { margin: 0 0 var(--space-2); font-family: var(--font-body); font-weight: 800; font-size: clamp(1.75rem, 6vw, 2.5rem); line-height: 1.1; letter-spacing: -0.02em; color: var(--text); }
  .un-title::after { content: ''; display: inline-block; width: 0.28em; height: 0.28em; margin-left: 0.18em; border-radius: 50%; background: var(--brand); vertical-align: baseline; }
  .un-lead { margin: 0; font-size: 1.0625rem; line-height: 1.6; color: var(--text-secondary); }
  .un-done { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4); margin: var(--space-6) 0 var(--space-8); padding: var(--space-8); background: var(--bg-card); border-radius: var(--radius-lg); }
  .un-btn { display: inline-flex; align-items: center; gap: 8px; min-height: 52px; padding: 0 var(--space-6); background: var(--brand-dark); color: var(--text); border: 0; border-radius: var(--radius); font-family: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; text-decoration: none; }
  .un-btn:hover { opacity: 0.92; }
  .un-btn:focus-visible { outline: 2px solid var(--brand-light); outline-offset: 3px; }
  .un-btn--ghost { background: var(--bg-card); color: var(--text); box-shadow: inset 0 0 0 1px var(--border-light); }
  .un-btn--ghost:hover { background: var(--hover-soft); }
`;
