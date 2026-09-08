import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Star01 from '@untitled-ui/icons-react/build/esm/Star01';
import Send01 from '@untitled-ui/icons-react/build/esm/Send01';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import { Reveal, Stagger } from '../marketing/motion';
import { useHead } from '../marketing/useHead';
import { fetchClient } from '../marketing/showcase';

/* The public review form (/review, and /review/:slug for a link sent to one
 * client). Nothing on the site links here: Rob sends the link after a
 * delivery, so the page is noindex and stays out of the sitemap.
 *
 * It posts to the existing /api/submissions with type: 'review', which the
 * admin's Reviews screen already lists. No new function, no new endpoint.
 *
 * The draft lives in sessionStorage while the tab is open, because the one
 * thing this page cannot do is lose somebody's paragraph to a fumbled
 * submit or a stray back gesture.
 */

const TEXT_GUIDE = 400;   // a soft guide, not a limit; the count turns when it is passed
const TEXT_MAX = 3000;    // what the endpoint stores
const DRAFT_PREFIX = 'vz_review_draft';

const EMPTY = { name: '', business: '', rating: 0, text: '', email: '' };

const readDraft = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : null;
  } catch { return null; }
};

/* ── The star rating ────────────────────────────────────────────────
 * A radiogroup of five 44px buttons. One tab stop (the checked star, or
 * the first when nothing is picked yet), arrow keys move and pick, so it
 * behaves the way a screen reader user expects a radio group to behave.
 */
function StarRating({ value, onChange, invalid, describedBy }) {
  const ref = useRef(null);

  const move = (next) => {
    const n = Math.min(5, Math.max(1, next));
    onChange(n);
    const el = ref.current?.querySelector(`[data-star="${n}"]`);
    if (el) el.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move((value || 0) + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move((value || 6) - 1); }
    else if (e.key === 'Home') { e.preventDefault(); move(1); }
    else if (e.key === 'End') { e.preventDefault(); move(5); }
  };

  return (
    <div
      ref={ref}
      className="rvw-stars"
      role="radiogroup"
      aria-label="Your rating"
      aria-required="true"
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedBy}
      onKeyDown={onKeyDown}
    >
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          data-star={n}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          tabIndex={value === n || (!value && n === 1) ? 0 : -1}
          className={`rvw-star${n <= value ? ' is-on' : ''}`}
          onClick={() => onChange(n)}
        >
          <Star01 width={26} height={26} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

export default function Review() {
  const { slug = '' } = useParams();
  const draftKey = `${DRAFT_PREFIX}:${slug || '-'}`;

  const [client, setClient] = useState(null);   // { displayName, googleReview } once a valid slug resolves
  const [form, setForm] = useState(() => readDraft(`${DRAFT_PREFIX}:${slug || '-'}`) || EMPTY);
  const [trap, setTrap] = useState('');         // the honeypot; a person never sees it
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [sent, setSent] = useState(null);       // the rating that was actually submitted

  const lockedBusiness = !!client?.displayName;

  useHead({
    title: 'How did it go? | Visualize.',
    description: 'Leave a review. It takes a minute.',
    noindex: true,
  });

  /* A slug is a nicety, never a requirement: an unknown or unpublished one
     simply leaves the generic page, with the business field asked for. */
  useEffect(() => {
    if (!slug) return undefined;
    let live = true;
    fetchClient(slug)
      .then(c => { if (live && c?.displayName) setClient(c); })
      .catch(() => { /* generic page */ });
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    if (!client?.displayName) return;
    setForm(f => (f.business ? f : { ...f, business: client.displayName }));
  }, [client]);

  /* Keep the draft while the tab is open. Cleared once it is sent. */
  useEffect(() => {
    if (status === 'done') return;
    try { sessionStorage.setItem(draftKey, JSON.stringify(form)); } catch { /* private mode */ }
  }, [form, draftKey, status]);

  const set = useCallback((k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => (e[k] ? { ...e, [k]: '' } : e));
  }, []);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Your name, so Rob knows who this is.';
    if (!lockedBusiness && !form.business.trim()) e.business = 'The business name.';
    if (!form.rating) e.rating = 'Pick a rating, one star to five.';
    if (!form.text.trim()) e.text = 'A line or two about how it went.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'That email address does not look right.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev?.preventDefault();
    if (status === 'sending') return;
    if (!validate()) {
      const first = document.querySelector('.rvw-field--err input, .rvw-field--err textarea, .rvw-field--err [role="radio"]');
      first?.focus();
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'review',
          name: form.name.trim(),
          business: (lockedBusiness ? client.displayName : form.business).trim(),
          rating: form.rating,
          text: form.text.trim(),
          email: form.email.trim(),
          slug,
          company: trap, // the honeypot, empty for a person
        }),
      });
      if (!res.ok) throw new Error(res.status === 429 ? 'rate' : `status ${res.status}`);
      setSent(form.rating);
      setStatus('done');
      try { sessionStorage.removeItem(draftKey); } catch { /* nothing to clear */ }
    } catch (err) {
      setStatus('error');
      setErrors(e => ({ ...e, submit: err.message === 'rate' ? 'That is a few reviews in one hour. Give it a little while and try again.' : 'That did not send. Your review is still here, try again.' }));
    }
  };

  const count = form.text.trim().length;
  const google = client?.googleReview || '';
  const lead = client?.displayName
    ? `Thanks for working with me on ${client.displayName}.`
    : 'Takes a minute. It helps more than you know.';

  const heading = useMemo(() => (status === 'done' ? 'Thanks. That means a lot.' : 'How did it go?'), [status]);

  return (
    <section className="rvw section">
      <div className="wrap rvw-wrap">
        <Reveal as="h1" className="rvw-title display">{heading}</Reveal>

        {status === 'done' ? (
          <Reveal as="div" className="rvw-done" delay={80}>
            <span className="rvw-done-icon" aria-hidden="true"><CheckCircle width={22} height={22} /></span>
            <p className="rvw-done-line">
              {sent >= 4
                ? 'Your review is in, and it is the kind of thing that keeps a small studio going.'
                : 'Your review is in. Rob reads every one of these.'}
            </p>
            {sent >= 4 && google ? (
              <a className="rvw-btn rvw-btn--ghost" href={google} target="_blank" rel="noreferrer">
                Leave one on Google too <ArrowUpRight width={16} height={16} aria-hidden="true" />
              </a>
            ) : null}
            {sent <= 3 && (
              <p className="rvw-done-sub">
                {form.email.trim()
                  ? 'Rob will reach out to you directly about it.'
                  : 'If anything fell short, reply to the message that brought you here and Rob will make it right.'}
              </p>
            )}
          </Reveal>
        ) : (
          <>
            <Reveal as="p" className="rvw-lead" delay={60}>{lead}</Reveal>

            <form className="rvw-form" onSubmit={submit} noValidate>
              <Stagger className="rvw-fields">
                <div className={`rvw-field${errors.name ? ' rvw-field--err' : ''}`}>
                  <label className="rvw-label" htmlFor="rvw-name">Your name</label>
                  <input
                    id="rvw-name" className="rvw-input" type="text" value={form.name} autoComplete="name"
                    onChange={(e) => set('name', e.target.value.slice(0, 200))}
                    aria-invalid={errors.name ? 'true' : undefined}
                    aria-describedby={errors.name ? 'rvw-name-err' : undefined}
                  />
                  {errors.name && <p className="rvw-err" id="rvw-name-err" role="alert">{errors.name}</p>}
                </div>

                <div className={`rvw-field${errors.business ? ' rvw-field--err' : ''}`}>
                  <label className="rvw-label" htmlFor="rvw-business">Business name</label>
                  <input
                    id="rvw-business" className="rvw-input" type="text" autoComplete="organization"
                    value={lockedBusiness ? client.displayName : form.business}
                    readOnly={lockedBusiness}
                    onChange={(e) => set('business', e.target.value.slice(0, 200))}
                    aria-invalid={errors.business ? 'true' : undefined}
                    aria-describedby={lockedBusiness ? 'rvw-business-note' : errors.business ? 'rvw-business-err' : undefined}
                  />
                  {lockedBusiness && <p className="rvw-note" id="rvw-business-note">Filled in from your link.</p>}
                  {errors.business && <p className="rvw-err" id="rvw-business-err" role="alert">{errors.business}</p>}
                </div>

                <div className={`rvw-field${errors.rating ? ' rvw-field--err' : ''}`}>
                  <span className="rvw-label" id="rvw-rating-label">How would you rate it?</span>
                  <StarRating
                    value={form.rating}
                    onChange={(n) => set('rating', n)}
                    invalid={!!errors.rating}
                    describedBy={errors.rating ? 'rvw-rating-err' : 'rvw-rating-said'}
                  />
                  <p className="rvw-note" id="rvw-rating-said" role="status">
                    {form.rating ? `${form.rating} star${form.rating === 1 ? '' : 's'} chosen.` : 'Tap a star, or use the arrow keys.'}
                  </p>
                  {errors.rating && <p className="rvw-err" id="rvw-rating-err" role="alert">{errors.rating}</p>}
                </div>

                <div className={`rvw-field${errors.text ? ' rvw-field--err' : ''}`}>
                  <label className="rvw-label" htmlFor="rvw-text">The review</label>
                  <textarea
                    id="rvw-text" className="rvw-input rvw-textarea" rows={6} value={form.text}
                    onChange={(e) => set('text', e.target.value.slice(0, TEXT_MAX))}
                    placeholder="What did you need, and how did it turn out?"
                    aria-invalid={errors.text ? 'true' : undefined}
                    aria-describedby={`rvw-text-count${errors.text ? ' rvw-text-err' : ''}`}
                  />
                  <p className={`rvw-note rvw-count${count > TEXT_GUIDE ? ' is-over' : ''}`} id="rvw-text-count">
                    {count} of about {TEXT_GUIDE} characters{count > TEXT_GUIDE ? ', which is plenty. Longer is fine.' : ''}
                  </p>
                  {errors.text && <p className="rvw-err" id="rvw-text-err" role="alert">{errors.text}</p>}
                </div>

                <div className={`rvw-field${errors.email ? ' rvw-field--err' : ''}`}>
                  <label className="rvw-label" htmlFor="rvw-email">Email</label>
                  <input
                    id="rvw-email" className="rvw-input" type="email" value={form.email} autoComplete="email"
                    onChange={(e) => set('email', e.target.value.slice(0, 200))}
                    aria-invalid={errors.email ? 'true' : undefined}
                    aria-describedby={`rvw-email-note${errors.email ? ' rvw-email-err' : ''}`}
                  />
                  <p className="rvw-note" id="rvw-email-note">Only if you want a reply, it is never published.</p>
                  {errors.email && <p className="rvw-err" id="rvw-email-err" role="alert">{errors.email}</p>}
                </div>
              </Stagger>

              {/* The honeypot. Off screen rather than display:none, which is
                  what the simpler bots skip, and never in the tab order. */}
              <div className="rvw-trap" aria-hidden="true">
                <label htmlFor="rvw-company">Company (leave this empty)</label>
                <input id="rvw-company" name="company" type="text" tabIndex={-1} autoComplete="off"
                  value={trap} onChange={(e) => setTrap(e.target.value)} />
              </div>

              {status === 'error' && (
                <p className="rvw-submit-err" role="alert">{errors.submit}</p>
              )}

              <button type="submit" className="rvw-btn" disabled={status === 'sending'} aria-busy={status === 'sending' ? 'true' : undefined}>
                {status === 'sending' ? 'Sending' : status === 'error' ? 'Try again' : 'Send it'}
                <Send01 width={16} height={16} aria-hidden="true" />
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        .rvw { background: var(--bg); }
        .rvw-wrap { max-width: 640px; }
        .rvw-title { font-size: clamp(2.4rem, 7vw, 4.2rem); color: var(--text); }
        .rvw-lead {
          margin: var(--space-4) 0 var(--space-10);
          font-size: 1.125rem; color: var(--text-secondary); line-height: 1.6;
        }

        .rvw-form { display: flex; flex-direction: column; gap: var(--space-8); }
        .rvw-fields { display: flex; flex-direction: column; gap: var(--space-6); }
        .rvw-field { display: flex; flex-direction: column; gap: var(--space-2); }
        .rvw-label { font-size: 0.9375rem; font-weight: 600; color: var(--text); }
        .rvw-note { margin: 0; font-size: 0.8125rem; color: var(--text-muted); line-height: 1.5; }
        .rvw-count.is-over { color: var(--text-secondary); }
        .rvw-err { margin: 0; font-size: 0.8125rem; font-weight: 600; color: var(--brand-light); }

        .rvw-input {
          width: 100%; min-height: 48px;
          padding: var(--space-3) var(--space-4);
          background: var(--bg-card); color: var(--text);
          border: 1px solid var(--border); border-radius: var(--radius);
          font: inherit; font-size: 1rem;
          transition: border-color 0.2s, background 0.2s;
        }
        .rvw-input::placeholder { color: var(--text-faint); }
        .rvw-input:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-color: var(--border-light); }
        .rvw-input:read-only { background: var(--glass-bg); color: var(--text-secondary); }
        .rvw-textarea { min-height: 160px; resize: vertical; line-height: 1.6; }
        .rvw-field--err .rvw-input { border-color: var(--brand); }

        .rvw-stars { display: flex; align-items: center; gap: var(--space-1); }
        .rvw-star {
          display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; padding: 0;
          background: none; border: 0; border-radius: var(--radius);
          color: var(--text-faint); cursor: pointer;
          transition: color 0.15s, transform 0.15s, background 0.15s;
        }
        .rvw-star:hover { background: var(--hover-soft); color: var(--brand-light); }
        .rvw-star.is-on { color: var(--brand-light); }
        .rvw-star.is-on svg { fill: currentColor; }
        .rvw-star:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
        .rvw-field--err .rvw-star { color: var(--brand); }

        .rvw-trap { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }

        .rvw-submit-err {
          margin: 0; padding: var(--space-4);
          border: 1px solid var(--glass-border-brand); border-radius: var(--radius);
          background: var(--glass-bg-brand); color: var(--text);
          font-size: 0.9375rem; line-height: 1.5;
        }

        .rvw-btn {
          align-self: flex-start;
          display: inline-flex; align-items: center; gap: 8px;
          min-height: 52px; padding: 0 var(--space-6);
          /* The same brand gradient over the dark ground the rest of the
             site's primary buttons use, which is what keeps near-white text
             well clear of 4.5:1 (flat --brand behind it would not). */
          background: linear-gradient(135deg, rgba(212, 76, 67, 0.85) 0%, rgba(168, 58, 50, 0.85) 100%);
          color: var(--text);
          border: 1px solid var(--glass-border-brand); border-radius: var(--radius);
          font-size: 1rem; font-weight: 700; cursor: pointer;
          transition: background 0.2s, transform 0.2s, opacity 0.2s;
        }
        .rvw-btn:hover { background: linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%); transform: translateY(-1px); }
        .rvw-btn:focus-visible { outline: 2px solid var(--brand-light); outline-offset: 3px; }
        .rvw-btn[disabled] { opacity: 0.7; cursor: default; transform: none; }
        .rvw-btn--ghost {
          background: var(--glass-bg); color: var(--text);
          border-color: var(--border-light); text-decoration: none;
        }
        .rvw-btn--ghost:hover { background: var(--hover-soft); }

        .rvw-done {
          display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-4);
          margin-top: var(--space-6); padding: var(--space-8);
          background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg);
        }
        .rvw-done-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; border-radius: var(--radius);
          background: var(--glass-bg-brand); color: var(--brand-text);
        }
        .rvw-done-line { margin: 0; font-size: 1.0625rem; color: var(--text); line-height: 1.6; }
        .rvw-done-sub { margin: 0; font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.6; }
      `}</style>
    </section>
  );
}
