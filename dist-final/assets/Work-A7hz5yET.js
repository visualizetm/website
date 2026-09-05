import{r as e,j as r,L as s}from"./index-Dba8pkEL.js";import{A as o}from"./ArrowUpRight-Bh-9ADvT.js";import{c as d}from"./index-DG47y-p8.js";function t({client:a}){return r.jsxs(s,{to:`/work/${a.slug}`,className:"wk-card",children:[r.jsx("div",{className:"wk-card-media",children:a.cover?r.jsx("img",{src:a.cover,alt:`${a.name} brand`,loading:"lazy"}):r.jsx("div",{className:"wk-card-mono grid-texture","aria-hidden":"true",children:r.jsx("span",{className:"display",children:a.name.charAt(0)})})}),r.jsxs("div",{className:"wk-card-body",children:[r.jsxs("div",{className:"wk-card-top",children:[r.jsx("h3",{className:"wk-card-name",children:a.name}),r.jsx("span",{className:"wk-card-arrow",children:r.jsx(o,{width:16,height:16})})]}),r.jsx("span",{className:"wk-card-tag",children:a.type}),r.jsx("p",{className:"wk-card-blurb",children:a.blurb})]})]})}function m(){return e.useEffect(()=>{document.title="Work, Visualize"},[]),r.jsxs(r.Fragment,{children:[r.jsx("section",{className:"wk-hero grid-texture",children:r.jsxs("div",{className:"wrap",children:[r.jsx("p",{className:"wk-eyebrow",children:"Client Showcase"}),r.jsx("h1",{className:"wk-title display",children:"Work"}),r.jsx("p",{className:"section-subtitle",children:"Real businesses, built end to end, brand, web, and print under one roof."})]})}),r.jsx("section",{className:"wk-grid-section section",children:r.jsx("div",{className:"wrap",children:r.jsx("div",{className:"wk-grid",children:d.map(a=>r.jsx(t,{client:a},a.slug))})})}),r.jsx("style",{children:i})]})}const i=`
  .wk-hero {
    padding: var(--space-20) 0 var(--space-12);
    border-bottom: 1px solid var(--border);
    background: var(--bg-deep);
  }
  .wk-eyebrow {
    font-size: 0.72rem; font-weight: 800; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--brand);
    margin-bottom: var(--space-4);
  }
  .wk-title {
    font-size: clamp(3.5rem, 10vw, 6.5rem);
    color: var(--text);
    margin-bottom: var(--space-4);
  }

  .wk-grid-section { background: var(--bg); }
  .wk-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-5);
  }

  .wk-card {
    display: flex; flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    transition: transform 0.25s var(--ease), border-color 0.25s, box-shadow 0.25s;
  }
  .wk-card:hover {
    transform: translateY(-4px);
    border-color: rgba(212, 76, 67, 0.5);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(212, 76, 67, 0.2);
  }
  @media (prefers-reduced-motion: reduce) {
    .wk-card, .wk-card:hover { transform: none; transition: border-color 0.25s; }
  }

  .wk-card-media { aspect-ratio: 16 / 10; background: var(--surface); }
  .wk-card-media img { width: 100%; height: 100%; object-fit: cover; }
  .wk-card-mono {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-elevated);
  }
  .wk-card-mono .display {
    font-size: 5rem; color: var(--brand);
    opacity: 0.9;
  }

  .wk-card-body { padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-2); }
  .wk-card-top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
  .wk-card-name { font-size: 1.125rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
  .wk-card-arrow {
    color: var(--text-muted); display: inline-flex;
    transition: color 0.2s, transform 0.25s var(--ease);
  }
  .wk-card:hover .wk-card-arrow { color: var(--brand); transform: translate(2px, -2px); }
  .wk-card-tag {
    align-self: flex-start;
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--text-secondary);
    background: var(--glass-bg); border: 1px solid var(--border);
    padding: 3px 10px; border-radius: 999px;
  }
  .wk-card-blurb { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; }
`;export{t as ClientCard,m as default,i as workStyles};
