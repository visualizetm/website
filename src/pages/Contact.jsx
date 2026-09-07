import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Calendar from '@untitled-ui/icons-react/build/esm/Calendar';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import Copy01 from '@untitled-ui/icons-react/build/esm/Copy01';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import InstagramGlyph from '../components/InstagramGlyph';
import { Reveal, Tone, WordReveal } from '../marketing/motion';
import { useHead } from '../marketing/useHead';
import { CALENDLY_URL, CONTACT_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../marketing/links';

/* Site Prompt 6, Part 4: one calm screen. Three ways to reach Rob, each a
 * card-sized target, the free call first and marked as the primary. The
 * contact form and the inline Calendly embed are both gone: the form was
 * a slower path to the same inbox, and the embed loaded a third party
 * script and 700px of iframe on a page whose whole job is to hand the
 * visitor off. /start is still the intake form for anyone who needs to
 * send a brief, and it is unchanged. */
export default function Contact() {
  const location = useLocation();
  const fromPortal = new URLSearchParams(location.search).get('from') === 'portal';
  const [copied, setCopied] = useState(false);

  useHead({
    title: 'Contact | Visualize.',
    description: 'Book a free call, send an email, or send a DM. No pitch, no pressure.',
  });

  useEffect(() => {
    if (!copied) return undefined;
    const t = setTimeout(() => setCopied(false), 2400);
    return () => clearTimeout(t);
  }, [copied]);

  /* The button sits inside the email card, which is itself a link, so the
   * click must not also follow the mailto. */
  const copyEmail = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Tone as="section" className="ct section" from="var(--bg)" to="var(--bg-elevated)">
      <div className="wrap ct-wrap">
        {fromPortal && (
          <p className="ct-notice" role="status">
            The client portal has moved. Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will send your files.
          </p>
        )}

        <WordReveal as="h1" className="ct-title display">Let&apos;s talk.</WordReveal>
        <Reveal as="p" className="ct-lead" delay={80}>
          Book a free call, or reach out first if you would rather chat before booking.
        </Reveal>

        <div className="ct-cards">
          <Reveal as="div" delay={0}>
            <a href={CALENDLY_URL} className="ct-card ct-card--primary" target="_blank" rel="noreferrer">
              <span className="ct-icon" aria-hidden="true"><Calendar width={20} height={20} /></span>
              <span className="ct-card-title">Book a free call</span>
              <span className="ct-card-sub">Twenty minutes, no pitch. Pick a time that suits you.</span>
              <span className="ct-card-go">Open Calendly <ArrowUpRight width={15} height={15} /></span>
            </a>
          </Reveal>

          {/* The only card with two things to do. A button inside a link
              would be a nested control, so the card is a plain box and the
              mailto link stretches across it (its ::after covers the card);
              the Copy button sits above that layer and stays clickable. */}
          <Reveal as="div" delay={80}>
            <div className="ct-card">
              <span className="ct-icon" aria-hidden="true"><Mail01 width={20} height={20} /></span>
              <a href={`mailto:${CONTACT_EMAIL}`} className="ct-card-title ct-stretch">Email</a>
              <span className="ct-card-sub ct-card-address">{CONTACT_EMAIL}</span>
              <button type="button" className="ct-copy" onClick={copyEmail}>
                {copied ? <Check width={15} height={15} /> : <Copy01 width={15} height={15} />}
                {copied ? 'Copied' : 'Copy'}
                <span className="visually-hidden"> email address</span>
              </button>
            </div>
          </Reveal>

          <Reveal as="div" delay={160}>
            <a href={INSTAGRAM_URL} className="ct-card" target="_blank" rel="noreferrer">
              <span className="ct-icon" aria-hidden="true"><InstagramGlyph size={20} /></span>
              <span className="ct-card-title">DM on Instagram</span>
              <span className="ct-card-sub">{INSTAGRAM_HANDLE}</span>
              <span className="ct-card-go">Open Instagram <ArrowUpRight width={15} height={15} /></span>
            </a>
          </Reveal>
        </div>

        <p className="visually-hidden" role="status">{copied ? `${CONTACT_EMAIL} copied to the clipboard` : ''}</p>
      </div>

      <style>{`
        .ct-wrap { max-width: 1000px; }
        .ct-notice {
          margin: 0 0 var(--space-8); padding: var(--space-4) var(--space-5);
          border: 1px solid var(--glass-border-brand); border-radius: var(--radius);
          background: var(--glass-bg-brand); color: var(--text);
          font-size: 0.95rem; line-height: 1.5;
        }
        .ct-notice a { color: var(--brand-text); font-weight: 600; }

        .ct-title { font-size: clamp(2.6rem, 8vw, 5rem); color: var(--text); }
        .ct-lead {
          margin: var(--space-5) 0 var(--space-12);
          max-width: 52ch; font-size: 1.125rem;
          color: var(--text-secondary); line-height: 1.6;
        }

        .ct-cards {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5);
        }
        @media (max-width: 860px) { .ct-cards { grid-template-columns: 1fr; } }

        .ct-card {
          position: relative;
          display: flex; flex-direction: column; align-items: flex-start;
          gap: var(--space-3); height: 100%;
          padding: var(--space-6);
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          transition: border-color 0.2s, transform 0.2s, background 0.2s;
        }
        .ct-card:hover { border-color: var(--border-light); transform: translateY(-2px); }
        .ct-card--primary { border-color: var(--glass-border-brand); background: var(--glass-bg-brand); }

        .ct-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 44px; height: 44px; border-radius: var(--radius);
          background: var(--glass-bg); color: var(--brand-text);
        }
        .ct-card-title { font-size: 1.1875rem; font-weight: 700; color: var(--text); }
        .ct-stretch { display: inline-flex; align-items: center; min-height: 44px; }
        .ct-stretch::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
        .ct-card-sub { font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.55; }
        .ct-card-address { overflow-wrap: anywhere; }
        .ct-card-go {
          display: inline-flex; align-items: center; gap: 6px; margin-top: auto;
          padding-top: var(--space-2);
          font-size: 0.9375rem; font-weight: 600; color: var(--brand-text);
        }
        .ct-copy {
          position: relative; z-index: 1;
          display: inline-flex; align-items: center; gap: 7px;
          margin-top: auto; min-height: 44px; padding: 0 var(--space-4);
          background: var(--glass-bg); border: 1px solid var(--border);
          border-radius: var(--radius); cursor: pointer;
          font-size: 0.875rem; font-weight: 600; color: var(--text);
          transition: background 0.2s, border-color 0.2s;
        }
        .ct-copy:hover { background: var(--hover-soft); border-color: var(--border-light); }
      `}</style>
    </Tone>
  );
}
