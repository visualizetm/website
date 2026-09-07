import { Reveal, Stagger, Tone } from '../marketing/motion';

/* Site Prompt 6, Part 2.4: the "I am not going to argue with you about your
 * platform" section, and Home's second Tone shift. Text pills, no logos:
 * these are other companies' marks, and a row of them reads as a badge
 * wall rather than as the plain statement it is meant to be. */
const PLATFORMS = ['Shopify', 'Wix', 'Squarespace', 'Custom code', 'Google Business'];

export default function Platforms() {
  return (
    <Tone as="section" className="pf section" from="var(--bg)" to="var(--bg-elevated)">
      <div className="wrap">
        <Reveal as="h2" className="section-title">Built on whatever you will actually use.</Reveal>
        <Reveal as="p" className="pf-copy" delay={80}>
          Some businesses live on Shopify. Restaurants lean on Wix or Squarespace. Some need a
          custom coded site. I work in all of them, and I make sure it does not look like a template.
        </Reveal>
        <Stagger className="pf-pills" itemAs="span">
          {PLATFORMS.map(p => <span key={p} className="pf-pill">{p}</span>)}
        </Stagger>
        <Reveal as="p" className="pf-note" delay={120}>
          Not sure which? That is what the first call is for.
        </Reveal>
      </div>
      <style>{`
        .pf-copy {
          margin-top: var(--space-5); max-width: 62ch;
          font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.7;
        }
        .pf-pills {
          display: flex; flex-wrap: wrap; gap: var(--space-3);
          margin-top: var(--space-8);
        }
        /* Stagger wraps each child in its own element; a bare inline span
           would ignore the reveal's transform, so make the wrappers flex. */
        .pf-pills > * { display: inline-flex; }
        .pf-pill {
          display: inline-flex; align-items: center;
          padding: var(--space-3) var(--space-5);
          border: 1px solid var(--border-light); border-radius: 999px;
          font-size: 0.9375rem; font-weight: 600; color: var(--text);
          background: var(--glass-bg);
        }
        .pf-note {
          margin-top: var(--space-8);
          font-size: 0.9375rem; color: var(--text-muted);
        }
      `}</style>
    </Tone>
  );
}
