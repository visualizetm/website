import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import { fetchShowcase, Pic, IMG_W } from '../marketing/showcase';
import { Section, Block } from '../marketing/motion';
import { useHead } from '../marketing/useHead';
import { spotlightPicks } from '../lib/spotlight';
import { tracksFor, servicesOf, brandColorsOf, spotlightQuote, applicationsOf, introNumbers, chipHref, everyone } from '../lib/projectsPage';
import { safeHref } from '../lib/safeUrl';
import InstagramGlyph from '../components/InstagramGlyph';
import { CALENDLY_URL, INSTAGRAM_URL } from '../marketing/links';

/* The Projects page (the Projects prompt): what I actually do, told with
 * real work. Top to bottom: the intro with the real numbers, the four
 * tracks with the projects behind each as logo chips, three spotlight
 * chapters built only from that client's own assets (the title, the logo
 * on a panel in its first brand colour, the colours, the applications one
 * after another, a pull quote when one is approved, the link to the full
 * project), everyone I have worked with as a list, and the close. One
 * fetchShowcase() feeds all of it; native scroll; every piece reveals
 * once (src/marketing/reveal.js). Nothing here is typed in: no project,
 * no asset, no number that the CRM does not hold. */
const IMG_SIZES = '(max-width: 1023px) 100vw, 30vw';

function Mark({ logo, name, size = 28 }) {
  const src = safeHref(logo);
  return (
    <span className={`img-fit img-fit--contain pj-mark${src ? '' : ' pj-mark--fallback'}`} aria-hidden="true" style={{ width: size, height: size }}>
      {src ? <Pic src={src} alt="" w={IMG_W.logo} widths={[120, 240]} sizes={`${size}px`} width={size} height={size} /> : <span className="pj-mark-letter">{(name || '?').charAt(0)}</span>}
    </span>
  );
}

function Intro({ numbers }) {
  return (
    <Section tone="a" label="Projects" reveal={false} className="pj-intro">
      <div className="wrap pj-intro-col">
        <h1 className="pj-title display">Brands and websites for local businesses.</h1>
        <p className="pj-lead">Logos, websites, print and social, all done by me.</p>
        {numbers.length > 0 && (
          <dl className="pj-nums">
            {numbers.map(x => <div key={x.label} className="pj-num"><dt>{x.label}</dt><dd>{x.n}</dd></div>)}
          </dl>
        )}
      </div>
    </Section>
  );
}

function Tracks({ tracks, picks }) {
  if (!tracks.length) return null;
  return (
    <Section tone="b" label="What I do" className="pj-tracks">
      <div className="wrap">
        <h2 data-step="0" className="section-title pj-h2">What I do</h2>
        <ul className="pj-track-row" aria-label="The four tracks">
          {tracks.map((t, i) => (
            <li key={t.id} data-step={i + 1} className="pj-track">
              <h3 className="pj-track-title">{t.title}</h3>
              <p className="pj-track-line">{t.line}</p>
              <ul className="pj-chips" aria-label={`${t.title} projects`}>
                {t.chips.slice(0, 6).map(c => {
                  const href = chipHref(c.slug, picks);
                  const inner = <><Mark logo={c.logo} name={c.displayName} size={24} /><span className="pj-chip-name">{c.displayName}</span></>;
                  return <li key={c.slug}>{href.startsWith('#') ? <a href={href} className="pj-chip">{inner}</a> : <Link to={href} className="pj-chip">{inner}</Link>}</li>;
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/* Between chapters: a row of flat dots shifting from Visualize red to the next client's colour. Scenery, not content. */
function Seam({ to }) {
  return (
    <div className="pj-seam" aria-hidden="true" style={to ? { '--to': to } : undefined}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} className="pj-dot" style={{ '--k': i / 8 }} />)}
    </div>
  );
}

function Spotlight({ client, tone }) {
  const services = servicesOf(client);
  const colors = brandColorsOf(client);
  const apps = applicationsOf(client);
  const quote = spotlightQuote(client);
  const logo = safeHref(client.brand?.logo);
  const ground = colors[0]?.hex || '';
  return (
    <Section as="article" tone={tone} label={client.displayName} className="pj-spot" id={`spot-${client.slug}`} style={ground ? { '--pj-color': ground } : undefined}>
      <div className="wrap pj-spot-grid">
        <div className="pj-spot-side">
          <div data-step="0" className="pj-spot-head">
            <h2 className="pj-spot-name display">{client.displayName}</h2>
            {client.type && <p className="pj-spot-type">{client.type}</p>}
            {services.length > 0 && <ul className="pj-services" aria-label="What I made">{services.map(s => <li key={s} className="pj-service">{s}</li>)}</ul>}
          </div>
          {logo && (
            <Block className="pj-spot-panel">
              <span className="img-fit img-fit--contain pj-spot-logo"><Pic src={logo} alt={`${client.displayName} logo`} w={IMG_W.logo} widths={[400, 800]} sizes="(max-width: 1023px) 60vw, 25vw" width={400} height={400} /></span>
            </Block>
          )}
        </div>
        <div className="pj-spot-main">
          {colors.length > 0 && (
            <Block as="ul" className="pj-colors" aria-label="Brand colours">
              {colors.map(c => <li key={c.hex} className="pj-color"><span className="pj-swatch" style={{ '--sw': c.hex }} aria-hidden="true" /><span className="pj-color-text">{c.name ? `${c.name}, ` : ''}{c.hex}</span></li>)}
            </Block>
          )}
          {apps.length > 0 && (
            <div className="pj-apps">
              {apps.map((a, i) => (
                <Block key={`${a.kind}-${i}`} as="figure" className={`pj-app pj-app--${a.kind}`}>
                  <span className={`img-fit ${a.fit} pj-app-box`}><Pic src={a.src} alt={a.alt} w={IMG_W.gallery} widths={[480, 800, 1200]} sizes={IMG_SIZES} width={1600} height={a.fit === 'img-fit--1x1' ? 1600 : a.fit === 'img-fit--7x4' ? 914 : 1000} /></span>
                </Block>
              ))}
            </div>
          )}
          {quote && (
            <Block as="figure" className="pj-quote">
              <blockquote>&ldquo;{quote.quote}&rdquo;</blockquote>
              <figcaption>{quote.author}{quote.role ? `, ${quote.role}` : ''}</figcaption>
            </Block>
          )}
          <Block className="pj-spot-more">
            <Link to={`/projects/${client.slug}`} className="btn btn-secondary">See the full project<ArrowRight width={16} height={16} aria-hidden="true" /></Link>
          </Block>
        </div>
      </div>
    </Section>
  );
}

function Everyone({ clients }) {
  if (!clients.length) return null;
  return (
    <Section tone="b" label="Everyone I have worked with" className="pj-all">
      <div className="wrap">
        <h2 data-step="0" className="section-title pj-h2">Everyone I&rsquo;ve worked with</h2>
        <ul className="pj-list">
          {clients.map((c, i) => {
            const services = servicesOf(c);
            return (
              <li key={c.slug} data-step={Math.min(i + 1, 5)} className="pj-row">
                <Link to={`/projects/${c.slug}`} className="pj-row-link">
                  <Mark logo={c.brand?.logo} name={c.displayName} size={40} />
                  <span className="pj-row-text">
                    <span className="pj-row-name">{c.displayName}</span>
                    {c.type && <span className="pj-row-type">{c.type}</span>}
                    {services.length > 0 && <span className="pj-row-chips">{services.map(s => <span key={s} className="pj-service">{s}</span>)}</span>}
                  </span>
                  <span className="pj-row-arrow" aria-hidden="true"><ArrowUpRight width={18} height={18} /></span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}

function Closing() {
  return (
    <Section tone="a" label="Your business next" className="pj-close">
      <div className="wrap pj-close-col">
        <h2 data-step="0" className="section-title pj-h2">Your business next.</h2>
        <div data-step="1" className="pj-close-actions">
          <a href={CALENDLY_URL} className="btn btn-primary" target="_blank" rel="noreferrer">Book a free call</a>
          <a href={INSTAGRAM_URL} className="btn btn-secondary" target="_blank" rel="noreferrer"><InstagramGlyph size={16} />DM me on Instagram</a>
        </div>
      </div>
    </Section>
  );
}

function Skeleton() {
  return (
    <div className="wrap pj-skel" aria-busy="true" aria-label="Loading the projects" role="status">
      <span className="pj-skel-bar pj-skel-bar--title" /><span className="pj-skel-bar pj-skel-bar--w60" />
      <div className="pj-skel-grid">{[0, 1, 2, 3].map(i => <span key={i} className="pj-skel-card" />)}</div>
    </div>
  );
}

export default function Projects() {
  const [state, setState] = useState({ status: 'loading', clients: [], stats: {} });
  useHead({
    title: 'Projects | Visualize.',
    description: 'Brands and websites for local businesses. Logos, websites, print and social, all done by me.',
  });

  const load = useCallback(async () => {
    setState(s => ({ ...s, status: 'loading' }));
    try {
      const { clients, landing } = await fetchShowcase();
      setState({ status: 'ready', clients: clients || [], stats: landing?.stats || {} });
    } catch {
      setState(s => ({ ...s, status: 'error' }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const { clients, stats, status } = state;
  const picks = spotlightPicks(clients);
  const tracks = tracksFor(clients);
  const all = everyone(clients);

  return (
    <>
      <Intro numbers={status === 'ready' ? introNumbers(clients, stats) : []} />
      {status === 'loading' ? <Skeleton /> : status === 'error' ? (
        <div className="wrap pj-state" role="alert">
          <p className="pj-state-title">Could not load the projects.</p>
          <p className="pj-state-body">Something went wrong reaching the server.</p>
          <button type="button" className="btn btn-secondary" onClick={load}>Retry</button>
        </div>
      ) : !clients.length ? (
        <div className="wrap pj-state"><p className="pj-state-title">New work is being added. Check back soon.</p></div>
      ) : (
        <>
          <Tracks tracks={tracks} picks={picks} />
          {picks.map((c, i) => (
            <div key={c.slug} className="pj-chapter">
              {i > 0 && <Seam to={brandColorsOf(c)[0]?.hex || ''} />}
              <Spotlight client={c} tone={i % 2 ? 'b' : 'a'} />
            </div>
          ))}
          <Everyone clients={all} />
        </>
      )}
      <Closing />
      <style>{projectsStyles}</style>
    </>
  );
}

const projectsStyles = `
  .pj-intro { padding-top: calc(84px + clamp(24px, 8vh, 96px)); }
  @media (max-width: 768px) { .pj-intro { padding-top: calc(72px + clamp(24px, 6vh, 64px)); } }
  .pj-intro-col { display: flex; flex-direction: column; gap: clamp(14px, 3vh, 28px); }
  .pj-title { max-width: 14ch; font-size: clamp(2.25rem, min(11vw, 7.5vh), 5rem); color: var(--text); }
  .pj-title::after { content: ''; display: inline-block; width: 0.22em; height: 0.22em; margin-left: 0.14em; border-radius: 50%; background: var(--brand); vertical-align: baseline; }
  .pj-lead { max-width: 34ch; font-size: clamp(1.0625rem, 2.8vh, 1.375rem); line-height: 1.5; color: var(--text-secondary); }
  .pj-nums { display: flex; flex-wrap: wrap; gap: var(--space-6); margin: 0; }
  .pj-num { display: flex; flex-direction: column-reverse; gap: 2px; }
  .pj-num dd { margin: 0; font-size: clamp(1.75rem, 4vw, 2.5rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1; color: var(--text); }
  .pj-num dt { font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
  .pj-h2 { font-size: clamp(1.75rem, 3.6vw, 2.75rem); line-height: 1.08; }

  /* The tracks: four in a row on a computer, a swipeable row on a phone (native scroll, a gentle snap). */
  .pj-track-row { list-style: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-top: var(--space-6); }
  .pj-track { display: flex; flex-direction: column; gap: var(--space-3); padding: clamp(16px, 2.4vh, 24px); background: var(--bg-card); border-radius: var(--radius-lg); min-width: 0; }
  .pj-track-title { font-size: 1.25rem; font-weight: 700; color: var(--text); }
  .pj-track-line { font-size: 0.9375rem; line-height: 1.5; color: var(--text-secondary); }
  .pj-chips { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; }
  .pj-chip { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px 0 6px; border-radius: 999px; background: var(--bg-elevated); color: var(--text); font-size: 0.8125rem; font-weight: 600; max-width: 100%; }
  .pj-chip:hover { background: var(--hover-soft, var(--bg-elevated)); }
  .pj-chip:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .pj-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 18ch; }
  .pj-mark { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; border-radius: 50%; background: var(--text); padding: 3px; }
  .pj-mark--fallback { background: var(--brand); }
  .pj-mark-letter { font-size: 0.75rem; font-weight: 800; color: var(--text); }
  @media (max-width: 1023px) { .pj-track-row { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 767px) {
    .pj-track-row { display: flex; overflow-x: auto; scroll-snap-type: x proximity; gap: var(--space-3); margin: var(--space-5) calc(-1 * var(--space-4)) 0; padding: 0 var(--space-4) var(--space-2); scrollbar-width: none; }
    .pj-track-row::-webkit-scrollbar { display: none; }
    .pj-track-row > * { flex: 0 0 min(82%, 340px); scroll-snap-align: center; position: relative; }
  }

  /* A spotlight chapter: the title and the logo panel beside the applications on a computer (the panel stays while
     they scroll past, the chapter under three screens), everything stacked on a phone. */
  .pj-spot { scroll-margin-top: calc(var(--nav-h) + 16px); }
  .pj-spot-grid { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: var(--space-8); align-items: start; }
  .pj-spot-side { display: flex; flex-direction: column; gap: var(--space-5); }
  .pj-spot-head { display: flex; flex-direction: column; gap: var(--space-2); }
  .pj-spot-name { font-size: clamp(1.75rem, 3.4vw, 2.75rem); color: var(--text); }
  .pj-spot-type { font-size: 1rem; color: var(--text-secondary); }
  .pj-services, .pj-row-chips { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
  .pj-service { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: 999px; background: var(--bg-elevated); font-size: 0.78rem; font-weight: 600; color: var(--text); }
  .pj-spot-panel { display: flex; align-items: center; justify-content: center; aspect-ratio: 1 / 1; border-radius: var(--radius-lg); background: var(--pj-color, var(--bg-deep)); }
  .pj-spot-logo { width: 60%; height: 60%; }
  .pj-spot-logo img { object-fit: contain; }
  .pj-spot-main { display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; }
  .pj-colors { list-style: none; display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); }
  .pj-color { display: inline-flex; align-items: center; gap: 8px; min-height: 32px; font-size: 0.875rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  .pj-swatch { width: 20px; height: 20px; border-radius: 50%; background: var(--sw); flex-shrink: 0; }
  .pj-apps { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
  .pj-app { margin: 0; min-width: 0; }
  .pj-app-box { display: block; width: 100%; border-radius: var(--radius-lg); background: var(--bg-card); overflow: hidden; }
  .pj-quote { margin: 0; display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-5); border-left: 6px solid var(--pj-color, var(--brand)); background: var(--bg-card); border-radius: var(--radius); }
  .pj-quote blockquote { margin: 0; font-size: clamp(1.125rem, 2.2vw, 1.5rem); line-height: 1.45; color: var(--text); }
  .pj-quote figcaption { font-size: 0.875rem; color: var(--text-secondary); }
  .pj-spot-more .btn { gap: 8px; }
  @media (min-width: 1024px) {
    .pj-spot-panel { position: sticky; top: calc(var(--nav-h) + 16px); }
  }
  @media (max-width: 1023px) {
    .pj-spot-grid { grid-template-columns: 1fr; gap: var(--space-5); }
    .pj-spot-panel { max-width: 320px; }
    .pj-apps { grid-template-columns: 1fr; }
  }

  /* The seam: nine flat dots, red to the next client's colour. */
  .pj-seam { display: flex; justify-content: center; gap: 10px; padding: var(--space-3) 0; background: var(--bg); }
  .pj-dot { width: 8px; height: 8px; border-radius: 50%; background: color-mix(in srgb, var(--brand) calc((1 - var(--k)) * 100%), var(--to, var(--brand)) calc(var(--k) * 100%)); }

  /* Everyone: rows, two columns on a computer, one on a phone, the list as one piece. */
  .pj-list { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-6); margin-top: var(--space-6); }
  @media (max-width: 767px) { .pj-list { grid-template-columns: 1fr; } }
  .pj-row-link { display: flex; align-items: center; gap: var(--space-3); min-height: 64px; padding: var(--space-3) 0; border-top: 1px solid var(--border); color: var(--text); }
  .pj-row-link:hover .pj-row-name { color: var(--brand-text); }
  .pj-row-link:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: var(--radius); }
  .pj-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .pj-row-name { font-size: 1.0625rem; font-weight: 700; }
  .pj-row-type { font-size: 0.875rem; color: var(--text-secondary); }
  .pj-row-arrow { color: var(--text-muted); display: inline-flex; flex-shrink: 0; }

  .pj-close-col { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-5); }
  .pj-close-actions { display: flex; flex-wrap: wrap; gap: var(--space-3); }
  .pj-close-actions .btn { gap: 8px; }
  @media (max-width: 767px) { .pj-close-actions .btn { flex: 1 1 100%; justify-content: center; } }

  .pj-state { padding: var(--space-16) var(--space-4); text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--space-4); }
  .pj-state-title { font-size: 1.25rem; font-weight: 700; color: var(--text); margin: 0; }
  .pj-state-body { color: var(--text-secondary); margin: 0; }
  .pj-skel { display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-8) var(--space-4) var(--space-16); }
  .pj-skel-bar { display: block; height: 18px; border-radius: 9px; background: var(--border-light); }
  .pj-skel-bar--title { width: 40%; height: 28px; }
  .pj-skel-bar--w60 { width: 60%; }
  .pj-skel-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-top: var(--space-4); }
  .pj-skel-card { display: block; height: 180px; border-radius: var(--radius-lg); background: var(--bg-card); }
  @media (max-width: 767px) { .pj-skel-grid { grid-template-columns: 1fr 1fr; } }
  .pj-skel .pj-skel-bar, .pj-skel .pj-skel-card { animation: pj-pulse 1.2s ease-in-out infinite; }
  @keyframes pj-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
  @media (prefers-reduced-motion: reduce) { .pj-skel .pj-skel-bar, .pj-skel .pj-skel-card { animation: none; } }
`;
