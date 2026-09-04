import { useEffect, useMemo, useState } from 'react';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import DesignComponents from './AdminDesignComponents';
import { contrast, composite } from '../shared/color';
import {
  CALL_STATUSES, PRIORITIES, STAGES, LEAD_STATUSES, ORDER_STATUSES, PREP_STATUSES,
} from '../shared/semantics';

/* /design: the Visualize Dark system rendered from the live tokens on
 * .lay-root. Values are read with getComputedStyle so this page can never
 * drift from what the app actually uses. Sign-off surface, not a debug page. */

const LAYERS = ['ground', 'surface-1', 'surface-2', 'surface-3'];
const TEXT = ['text', 'text-2', 'text-3'];
const STATUS_NAMES = ['new', 'progress', 'callback', 'booked', 'won', 'danger', 'neutral'];
const TYPE_STEPS = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];
const DISPLAY_STEPS = ['display-sm', 'display-md', 'display-lg'];
const SPACES = Array.from({ length: 12 }, (_, i) => i + 1);
const RADII = ['sm', 'md', 'lg', 'xl', 'pill'];

function useTokens() {
  const [t, setT] = useState({});
  useEffect(() => {
    const root = document.querySelector('.lay-root') || document.documentElement;
    const cs = getComputedStyle(root);
    const read = (name) => cs.getPropertyValue(name).trim();
    const names = [];
    for (const sheet of document.styleSheets) {
      let rules = [];
      try { rules = [...sheet.cssRules]; } catch { continue; }
      for (const r of rules) {
        if (r.selectorText === '.lay-root' && r.style) for (const p of r.style) if (p.startsWith('--v-')) names.push(p);
      }
    }
    const out = {};
    for (const n of [...new Set(names)]) out[n] = read(n);
    setT(out);
  }, []);
  return t;
}

const hexOf = (v) => (v || '').trim();
const ratio = (fg, bg) => {
  try {
    const f = fg.startsWith('rgba') ? composite(fg, bg) : fg;
    return contrast(f, bg).toFixed(2);
  } catch { return '?'; }
};
const grade = (r) => (r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'fail');

function Pill({ label, tone, variant }) {
  const style = variant === 'solid'
    ? { background: `var(--v-status-${tone}-solid)`, color: 'var(--v-text-inverse)', border: '1px solid transparent' }
    : variant === 'soft'
      ? { background: `var(--v-status-${tone}-soft)`, color: `var(--v-status-${tone}-text)`, border: `1px solid color-mix(in srgb, var(--v-status-${tone}-text) 30%, transparent)` }
      : { background: 'transparent', color: `var(--v-status-${tone}-text)`, border: '1px solid var(--v-border)' };
  return <span className="ds-pill" style={style}>{label}</span>;
}

export default function AdminDesign({ onBack }) {
  const t = useTokens();
  const [texture, setTexture] = useState(true);
  const [enterKey, setEnterKey] = useState(0);
  const [pressed, setPressed] = useState(false);
  const v = (n) => hexOf(t[`--v-${n}`]);

  const toneFor = (entry) => (entry.solid || '').replace('var(--v-status-', '').replace('-solid)', '');
  const groups = useMemo(() => [
    ['Call status', CALL_STATUSES], ['Priority', PRIORITIES], ['Stage', STAGES],
    ['Submission status', LEAD_STATUSES], ['Order status', ORDER_STATUSES], ['Prep status', PREP_STATUSES],
  ], []);

  return (
    <main className={`aa-main aa-main--wide lay-scroll ds-page${texture ? ' ds-page--texture' : ''}`}>
      <div className="lay-content lay-content--wide ds-wrap">
        <header className="ds-hero">
          <p className="ds-kicker">Visualize Dark</p>
          <h1 className="ds-title">Design system</h1>
          <p className="ds-lede">
            Every value on this page is read live from the tokens on <code>.lay-root</code>.
            What you see here is exactly what every screen will be assembled from.
          </p>
          <div className="ds-toolbar">
            <button type="button" className="ds-btn" onClick={() => setTexture(x => !x)}>
              <Check width={14} height={14} style={{ opacity: texture ? 1 : 0.25 }} /> Grid texture {texture ? 'on' : 'off'}
            </button>
            <a className="ds-btn ds-btn--ghost" href="#components">Jump to components</a>
            {onBack && <button type="button" className="ds-btn ds-btn--ghost" onClick={onBack}>Back to settings</button>}
          </div>
        </header>

        {/* ── Layers + text contrast ── */}
        <section className="ds-sec">
          <h2 className="ds-h">Layers and text</h2>
          <p className="ds-p">Four surface steps and three text levels. Every text level passes 4.5:1 on every layer it can sit on.</p>
          <div className="ds-layers">
            {LAYERS.map(l => (
              <div key={l} className="ds-layer" style={{ background: `var(--v-${l})` }}>
                <div className="ds-layer-name">--v-{l} <code>{v(l)}</code></div>
                {TEXT.map(tx => (
                  <div key={tx} className="ds-layer-row" style={{ color: `var(--v-${tx})` }}>
                    <span>--v-{tx} sample text</span>
                    <span className="ds-ratio">{v(tx) && v(l) ? `${ratio(v(tx), v(l))} ${grade(Number(ratio(v(tx), v(l))))}` : ''}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="ds-swatches">
            {['overlay', 'bar', 'border', 'border-strong', 'border-focus', 'text-inverse', 'text-on-red'].map(n => (
              <div key={n} className="ds-swatch"><span className="ds-chip" style={{ background: `var(--v-${n})` }} /><span>--v-{n}</span><code>{v(n)}</code></div>
            ))}
          </div>
        </section>

        {/* ── Brand ── */}
        <section className="ds-sec">
          <h2 className="ds-h">Brand red</h2>
          <div className="ds-swatches">
            {['red', 'red-hover', 'red-highlight', 'red-soft'].map(n => (
              <div key={n} className="ds-swatch"><span className="ds-chip" style={{ background: `var(--v-${n})` }} /><span>--v-{n}</span><code>{v(n)}</code></div>
            ))}
          </div>
          <div className="ds-row">
            <button type="button" className="ds-primary">Primary action <span className="ds-sub">white on red {v('red') ? ratio('#ffffff', v('red')) : ''}</span></button>
            <button type="button" className="ds-primary ds-primary--hover">Hover <span className="ds-sub">{v('red-hover') ? ratio('#ffffff', v('red-hover')) : ''}</span></button>
            <span className="ds-redtext">Red as text uses --v-red-highlight <code>{v('red-highlight')}</code> {v('red-highlight') && v('surface-1') ? `(${ratio(v('red-highlight'), v('surface-1'))} on surface-1)` : ''}</span>
          </div>
        </section>

        {/* ── Status set ── */}
        <section className="ds-sec">
          <h2 className="ds-h">Status set</h2>
          <p className="ds-p">Seven semantic tones, three variants each. The real pipeline labels below come from <code>src/shared/semantics.js</code>.</p>
          <div className="ds-tones">
            {STATUS_NAMES.map(n => (
              <div key={n} className="ds-tone">
                <div className="ds-tone-name">{n}</div>
                <Pill label="Solid" tone={n} variant="solid" />
                <Pill label="Soft" tone={n} variant="soft" />
                <Pill label="Text" tone={n} variant="text" />
                <code className="ds-tone-hex">{v(`status-${n}-solid`)}</code>
                <span className="ds-ratio">text on surface-1 {v(`status-${n}-text`) && v('surface-1') ? ratio(v(`status-${n}-text`), v('surface-1')) : ''}</span>
              </div>
            ))}
          </div>
          {groups.map(([name, list]) => (
            <div key={name} className="ds-group">
              <div className="ds-group-name">{name}</div>
              <div className="ds-group-row">{list.map(e => <Pill key={e.id} label={e.label} tone={toneFor(e) || 'neutral'} variant="soft" />)}</div>
            </div>
          ))}
        </section>

        {/* ── Charts ── */}
        <section className="ds-sec">
          <h2 className="ds-h">Chart palette</h2>
          <div className="ds-bars">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="ds-bar" style={{ background: `var(--v-chart-${i})`, height: `${40 + i * 14}px` }}><span>{v(`chart-${i}`)}</span></div>)}</div>
        </section>

        {/* ── Type ── */}
        <section className="ds-sec">
          <h2 className="ds-h">Type scale</h2>
          <div className="ds-type">
            {DISPLAY_STEPS.map(s => (
              <div key={s} className="ds-type-row">
                <code>--v-{s} {v(s)} / {v(`lh-${s}`)} / {v(`ls-${s}`)}</code>
                <div style={{ fontFamily: 'var(--v-font-display)', fontSize: `var(--v-${s})`, lineHeight: `var(--v-lh-${s})`, letterSpacing: `var(--v-ls-${s})`, fontWeight: 700, textTransform: 'uppercase' }}>Working Class Coffee</div>
              </div>
            ))}
            {[...TYPE_STEPS].reverse().map(s => (
              <div key={s} className="ds-type-row">
                <code>--v-text-{s} {v(`text-${s}`)} / {v(`lh-${s}`)} / {v(`ls-${s}`)}</code>
                <div style={{ fontFamily: 'var(--v-font-body)', fontSize: `var(--v-text-${s})`, lineHeight: `var(--v-lh-${s})`, letterSpacing: `var(--v-ls-${s})`, textTransform: s === 'xs' ? 'uppercase' : 'none', fontWeight: s === 'xs' ? 700 : 500 }}>
                  {s === 'xs' ? 'Section label' : 'Reviews carry them, but the site is a dead link.'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Spacing + radius ── */}
        <section className="ds-sec ds-sec--split">
          <div>
            <h2 className="ds-h">Spacing</h2>
            <div className="ds-spaces">{SPACES.map(i => <div key={i} className="ds-space"><span style={{ width: `var(--v-space-${i})` }} /><code>--v-space-{i} {v(`space-${i}`)}</code></div>)}</div>
            <p className="ds-p">Gutter <code>{v('gutter')}</code> · safe bottom <code>{v('safe-bottom')}</code></p>
          </div>
          <div>
            <h2 className="ds-h">Radius</h2>
            <div className="ds-radii">{RADII.map(r => <div key={r} className="ds-radius" style={{ borderRadius: `var(--v-radius-${r})` }}><code>{r} {v(`radius-${r}`)}</code></div>)}</div>
          </div>
        </section>

        {/* ── Shadow, glow, motion ── */}
        <section className="ds-sec ds-sec--split">
          <div>
            <h2 className="ds-h">Shadow and glow</h2>
            <div className="ds-cards">
              {[1, 2, 3].map(i => <div key={i} className="ds-card" style={{ boxShadow: `var(--v-shadow-${i})` }}>--v-shadow-{i}</div>)}
              <div className="ds-card ds-card--red" style={{ boxShadow: 'var(--v-glow-red)' }}>--v-glow-red</div>
              <div className="ds-card" style={{ color: 'var(--v-status-booked-text)', boxShadow: 'var(--v-glow-status)' }}>--v-glow-status</div>
            </div>
          </div>
          <div>
            <h2 className="ds-h">Motion</h2>
            <div className="ds-motion">
              <div key={enterKey} className="ds-card ds-enter">Enters in {v('dur-enter')}</div>
              <div className="ds-row">
                <button type="button" className="ds-btn" onClick={() => setEnterKey(k => k + 1)}><RefreshCw01 width={14} height={14} /> Replay</button>
                <button type="button" className={`ds-primary ds-press${pressed ? ' is-pressed' : ''}`} onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}>
                  <PhoneCall01 width={15} height={15} /> Press me
                </button>
              </div>
              <p className="ds-p">fast {v('dur-fast')} · base {v('dur-base')} · slow {v('dur-slow')} · enter {v('dur-enter')} · stagger {v('stagger')}</p>
            </div>
          </div>
        </section>

        {/* ── Sizing + z ── */}
        <section className="ds-sec ds-sec--split">
          <div>
            <h2 className="ds-h">Sizing</h2>
            <div className="ds-row">
              <span className="ds-tap" style={{ width: 'var(--v-tap)', height: 'var(--v-tap)' }}>{v('tap')}</span>
              <span className="ds-tap" style={{ width: 'var(--v-tap-lg)', height: 'var(--v-tap-lg)' }}>{v('tap-lg')}</span>
              <span className="ds-tap ds-tap--wide" style={{ height: 'var(--v-control-h)' }}>control {v('control-h')}</span>
            </div>
            <p className="ds-p">icons {v('icon-sm')} / {v('icon-md')} / {v('icon-lg')} · tab bar {v('tabbar-h')} · sidebar {v('sidebar-w')} / rail {v('sidebar-rail-w')}</p>
          </div>
          <div>
            <h2 className="ds-h">Z index</h2>
            <div className="ds-z">{['base', 'sticky', 'tabbar', 'sheet', 'modal', 'toast', 'command'].map(z => <div key={z} className="ds-z-row"><code>--v-z-{z}</code><span>{v(`z-${z}`)}</span></div>)}</div>
          </div>
        </section>

        <DesignComponents />
      </div>
      <style>{dsStyles}</style>
    </main>
  );
}

const dsStyles = `
  .ds-page { color: var(--v-text); font-family: var(--v-font-body); }
  .ds-page--texture { background-image: var(--v-grid-texture); background-size: var(--v-grid-texture-size); }
  .ds-wrap { --v-stack-gap: var(--v-space-8); }
  .ds-hero { display: flex; flex-direction: column; gap: var(--v-space-3); padding-top: var(--v-space-2); }
  .ds-kicker { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-red-highlight); }
  .ds-title { font-family: var(--v-font-display); font-size: var(--v-display-lg); line-height: var(--v-lh-display-lg); letter-spacing: var(--v-ls-display-lg); text-transform: uppercase; font-weight: var(--v-weight-bold); }
  .ds-lede { font-size: var(--v-text-lg); line-height: var(--v-lh-lg); color: var(--v-text-2); max-width: 640px; }
  .ds-lede code, .ds-p code, .ds-swatch code, .ds-tone-hex, .ds-type-row code, .ds-space code, .ds-radius code, .ds-z-row code, .ds-layer-name code, .ds-redtext code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: var(--v-text-xs); color: var(--v-text-3);
    background: var(--v-surface-2); padding: 2px 6px; border-radius: var(--v-radius-sm);
  }
  .ds-toolbar { display: flex; gap: var(--v-space-2); flex-wrap: wrap; }
  .ds-btn { display: inline-flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-tap); padding: 0 var(--v-space-4); border-radius: var(--v-radius-md); cursor: pointer;
    background: var(--v-surface-2); border: 1px solid var(--v-border); color: var(--v-text-2); font: inherit; font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold);
    transition: color var(--v-dur-fast) var(--v-ease-out), border-color var(--v-dur-fast) var(--v-ease-out); }
  .ds-btn:hover { color: var(--v-text); border-color: var(--v-border-strong); }
  .ds-btn--ghost { background: transparent; }
  .ds-sec { display: flex; flex-direction: column; gap: var(--v-space-4); background: var(--v-surface-1); border: 1px solid var(--v-border); border-radius: var(--v-radius-lg); padding: var(--v-space-6); }
  .ds-sec--split { display: grid; grid-template-columns: 1fr; gap: var(--v-space-8); }
  .ds-sec--split > div { display: flex; flex-direction: column; gap: var(--v-space-4); min-width: 0; }
  @media (min-width: 900px) { .ds-sec--split { grid-template-columns: 1fr 1fr; } }
  .ds-h { font-family: var(--v-font-display); font-size: var(--v-display-sm); line-height: var(--v-lh-display-sm); letter-spacing: var(--v-ls-display-sm); text-transform: uppercase; font-weight: var(--v-weight-bold); }
  .ds-p { font-size: var(--v-text-sm); line-height: var(--v-lh-sm); color: var(--v-text-3); }
  .ds-layers { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: var(--v-space-3); }
  .ds-layer { border: 1px solid var(--v-border-strong); border-radius: var(--v-radius-md); padding: var(--v-space-4); display: flex; flex-direction: column; gap: var(--v-space-2); }
  .ds-layer-name { font-size: var(--v-text-xs); line-height: var(--v-lh-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-2); display: flex; gap: var(--v-space-2); align-items: center; flex-wrap: wrap; }
  .ds-layer-row { display: flex; justify-content: space-between; gap: var(--v-space-2); font-size: var(--v-text-md); line-height: var(--v-lh-md); }
  .ds-ratio { font-size: var(--v-text-xs); color: var(--v-text-3); white-space: nowrap; }
  .ds-swatches { display: flex; flex-wrap: wrap; gap: var(--v-space-3); }
  .ds-swatch { display: flex; align-items: center; gap: var(--v-space-2); font-size: var(--v-text-sm); color: var(--v-text-2); }
  .ds-chip { width: 28px; height: 28px; border-radius: var(--v-radius-sm); border: 1px solid var(--v-border-strong); display: inline-block; }
  .ds-row { display: flex; align-items: center; gap: var(--v-space-3); flex-wrap: wrap; }
  .ds-primary { display: inline-flex; align-items: center; gap: var(--v-space-2); min-height: var(--v-control-h); padding: 0 var(--v-space-5); border-radius: var(--v-radius-md); cursor: pointer;
    background: var(--v-red); border: 1px solid var(--v-red); color: var(--v-text-on-red); font: inherit; font-size: var(--v-text-sm); font-weight: var(--v-weight-bold); box-shadow: var(--v-glow-red);
    transition: transform var(--v-dur-fast) var(--v-ease-out), background var(--v-dur-fast) var(--v-ease-out); }
  .ds-primary--hover { background: var(--v-red-hover); border-color: var(--v-red-hover); }
  .ds-press.is-pressed { transform: scale(0.96); }
  .ds-sub { font-weight: var(--v-weight-medium); opacity: 0.8; font-size: var(--v-text-xs); }
  .ds-redtext { color: var(--v-red-highlight); font-size: var(--v-text-sm); }
  .ds-tones { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--v-space-3); }
  .ds-tone { display: flex; flex-direction: column; gap: var(--v-space-2); background: var(--v-surface-2); border: 1px solid var(--v-border); border-radius: var(--v-radius-md); padding: var(--v-space-3); }
  .ds-tone-name { font-size: var(--v-text-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-2); }
  .ds-pill { display: inline-flex; align-items: center; align-self: flex-start; font-size: var(--v-text-xs); line-height: 1; font-weight: var(--v-weight-bold); letter-spacing: 0.04em; padding: 6px 10px; border-radius: var(--v-radius-pill); white-space: nowrap; }
  .ds-group { display: flex; flex-direction: column; gap: var(--v-space-2); }
  .ds-group-name { font-size: var(--v-text-xs); letter-spacing: var(--v-ls-xs); text-transform: uppercase; font-weight: var(--v-weight-bold); color: var(--v-text-3); }
  .ds-group-row { display: flex; flex-wrap: wrap; gap: var(--v-space-2); }
  .ds-bars { display: flex; align-items: flex-end; gap: var(--v-space-2); height: 140px; }
  .ds-bar { flex: 1; border-radius: var(--v-radius-sm) var(--v-radius-sm) 0 0; display: flex; align-items: flex-end; justify-content: center; padding-bottom: var(--v-space-1); }
  .ds-bar span { font-size: 10px; color: var(--v-text-inverse); font-weight: var(--v-weight-bold); }
  .ds-type { display: flex; flex-direction: column; gap: var(--v-space-4); }
  .ds-type-row { display: flex; flex-direction: column; gap: var(--v-space-1); min-width: 0; overflow-wrap: anywhere; }
  .ds-spaces { display: flex; flex-direction: column; gap: var(--v-space-1); }
  .ds-space { display: flex; align-items: center; gap: var(--v-space-3); }
  .ds-space span { display: inline-block; height: 10px; background: var(--v-red); border-radius: 2px; flex-shrink: 0; }
  .ds-radii { display: flex; flex-wrap: wrap; gap: var(--v-space-3); }
  .ds-radius { width: 92px; height: 92px; background: var(--v-surface-2); border: 1px solid var(--v-border-strong); display: flex; align-items: center; justify-content: center; text-align: center; }
  .ds-cards { display: flex; flex-wrap: wrap; gap: var(--v-space-4); }
  .ds-card { min-width: 150px; padding: var(--v-space-4); background: var(--v-surface-2); border-radius: var(--v-radius-lg); font-size: var(--v-text-sm); font-weight: var(--v-weight-semibold); }
  .ds-card--red { background: var(--v-red); color: var(--v-text-on-red); }
  .ds-motion { display: flex; flex-direction: column; gap: var(--v-space-3); }
  .ds-enter { animation: ds-in var(--v-dur-enter) var(--v-ease-out); }
  @keyframes ds-in { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
  .ds-tap { display: inline-flex; align-items: center; justify-content: center; background: var(--v-surface-3); border: 1px dashed var(--v-border-strong); border-radius: var(--v-radius-md); font-size: var(--v-text-xs); color: var(--v-text-2); }
  .ds-tap--wide { padding: 0 var(--v-space-4); }
  .ds-z { display: flex; flex-direction: column; gap: var(--v-space-1); }
  .ds-z-row { display: flex; justify-content: space-between; gap: var(--v-space-2); font-size: var(--v-text-sm); color: var(--v-text-2); }
`;
