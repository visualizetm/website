import{m as b,r as v,j as s,N as f,L as g,n as u,G as j,o as y,A as w}from"./index-Dba8pkEL.js";import{A as N}from"./ArrowLeft-CtCaFRCZ.js";import{A as k}from"./ArrowUpRight-Bh-9ADvT.js";import{C as z}from"./CreditCard02-BCV8ZPor.js";import{g as C}from"./index-DG47y-p8.js";function h({label:t,ratio:e="16 / 10",children:r}){return s.jsx("div",{className:"cs-slot",style:{aspectRatio:e},children:r||s.jsx("span",{className:"cs-slot-label",children:t})})}function l({src:t,alt:e,label:r,ratio:c}){return s.jsx(h,{label:r,ratio:c,children:t?s.jsx("img",{src:t,alt:e,loading:"lazy"}):null})}function o({icon:t,title:e}){return s.jsxs("div",{className:"cs-sec-head",children:[s.jsx("span",{className:"cs-sec-icon",children:s.jsx(t,{width:17,height:17})}),s.jsx("h2",{className:"cs-sec-title display",children:e})]})}function B(){var d,p,m,x;const{slug:t}=b(),e=C(t);if(v.useEffect(()=>{e&&(document.title=`${e.name}, Work, Visualize`)},[e]),!e)return s.jsx(f,{to:"/work",replace:!0});const{brand:r,website:c,cards:i,print:n}=e.sections||{};return s.jsxs(s.Fragment,{children:[s.jsxs("article",{className:"cs-page",children:[s.jsx("header",{className:"cs-hero grid-texture",children:s.jsxs("div",{className:"wrap",children:[s.jsxs(g,{to:"/work",className:"cs-back",children:[s.jsx(N,{width:15,height:15}),"All work"]}),s.jsxs("div",{className:"cs-hero-meta",children:[s.jsx("span",{className:"wk-card-tag",children:e.type}),e.year&&s.jsx("span",{className:"cs-year",children:e.year})]}),s.jsx("h1",{className:"cs-title display",children:e.name}),s.jsx("p",{className:"section-subtitle",children:e.blurb})]})}),s.jsxs("div",{className:"wrap cs-body",children:[r&&s.jsxs("section",{className:"cs-section",children:[s.jsx(o,{icon:u,title:"Brand Identity"}),s.jsxs("div",{className:"cs-brand-grid",children:[s.jsx(l,{src:r.logo,alt:`${e.name} logo`,label:"Logo",ratio:"4 / 3"}),s.jsxs("div",{className:"cs-brand-side",children:[((d=r.palette)==null?void 0:d.length)>0&&s.jsx("div",{className:"cs-palette",children:r.palette.map(a=>s.jsxs("div",{className:"cs-swatch",children:[s.jsx("span",{className:"cs-swatch-chip",style:{background:a.hex}}),s.jsx("span",{className:"cs-swatch-name",children:a.name}),s.jsx("span",{className:"cs-swatch-hex",children:a.hex})]},a.hex))}),((p=r.typography)==null?void 0:p.length)>0&&s.jsx("div",{className:"cs-type-list",children:r.typography.map(a=>s.jsxs("div",{className:"cs-type-row",children:[s.jsx("span",{className:"cs-type-family",children:a.family}),s.jsx("span",{className:"cs-type-role",children:a.role})]},a.family))})]})]}),((m=r.images)==null?void 0:m.length)>0&&s.jsx("div",{className:"cs-media-grid",children:r.images.map(a=>s.jsx(l,{src:a,alt:`${e.name} brand`,label:"Brand"},a))}),r.notes&&s.jsx("p",{className:"cs-notes",children:r.notes})]}),c&&s.jsxs("section",{className:"cs-section",children:[s.jsx(o,{icon:j,title:"Website"}),s.jsxs("div",{className:"cs-browser",children:[s.jsxs("div",{className:"cs-browser-bar",children:[s.jsx("span",{}),s.jsx("span",{}),s.jsx("span",{})]}),((x=c.screenshots)==null?void 0:x.length)>0?c.screenshots.map(a=>s.jsx("img",{src:a,alt:`${e.name} website`,loading:"lazy",className:"cs-browser-shot"},a)):s.jsx(h,{label:"Website screenshot",ratio:"16 / 9"})]}),s.jsxs("div",{className:"cs-sec-foot",children:[c.notes&&s.jsx("p",{className:"cs-notes",children:c.notes}),c.url&&s.jsxs("a",{href:c.url,target:"_blank",rel:"noopener noreferrer",className:"btn btn-secondary cs-live-btn",children:["Visit live site ",s.jsx(k,{width:15,height:15})]})]})]}),i&&s.jsxs("section",{className:"cs-section",children:[s.jsx(o,{icon:z,title:"Business Cards"}),s.jsxs("div",{className:"cs-cards-grid",children:[s.jsx(l,{src:i.front,alt:`${e.name} card front`,label:"Card front",ratio:"7 / 4"}),s.jsx(l,{src:i.back,alt:`${e.name} card back`,label:"Card back",ratio:"7 / 4"})]}),i.notes&&s.jsx("p",{className:"cs-notes",children:i.notes})]}),n&&s.jsxs("section",{className:"cs-section",children:[s.jsx(o,{icon:y,title:"Print & Product"}),s.jsx("div",{className:"cs-media-grid",children:(n.items||[]).map(a=>s.jsxs("figure",{className:"cs-print-item",children:[s.jsx(l,{src:a.image,alt:a.label,label:a.label}),s.jsx("figcaption",{className:"cs-print-caption",children:a.label})]},a.label))}),n.notes&&s.jsx("p",{className:"cs-notes",children:n.notes})]}),s.jsxs("section",{className:"cs-cta grid-texture",children:[s.jsx("h2",{className:"cs-cta-title display",children:"Start your own"}),s.jsx("p",{className:"cs-cta-sub",children:"Same process, your business. Tell me what we're building."}),s.jsxs(g,{to:"/start",className:"btn btn-primary cs-cta-btn",children:["Start a Project ",s.jsx(w,{width:16,height:16})]})]})]})]}),s.jsx("style",{children:A})]})}const A=`
  .cs-hero {
    padding: var(--space-16) 0 var(--space-12);
    border-bottom: 1px solid var(--border);
    background: var(--bg-deep);
  }
  .cs-back {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.84rem; font-weight: 600; color: var(--text-muted);
    margin-bottom: var(--space-8); transition: color 0.2s;
  }
  .cs-back:hover { color: var(--text); }
  .cs-hero-meta { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); }
  .cs-year { font-size: 0.8rem; color: var(--text-muted); }
  .cs-title {
    font-size: clamp(3rem, 8vw, 5.5rem);
    color: var(--text);
    margin-bottom: var(--space-4);
  }

  .cs-body { display: flex; flex-direction: column; gap: var(--space-20); padding: var(--space-16) var(--space-6) var(--space-20); }

  .cs-sec-head { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-6); }
  .cs-sec-icon {
    width: 36px; height: 36px; border-radius: var(--radius);
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--brand); background: var(--glass-bg-brand);
    border: 1px solid var(--glass-border-brand); flex-shrink: 0;
  }
  .cs-sec-title { font-size: clamp(1.6rem, 3.5vw, 2.4rem); color: var(--text); }

  .cs-slot {
    width: 100%; border-radius: var(--radius-lg); overflow: hidden;
    background: var(--bg-card); border: 1px dashed var(--border-light);
    display: flex; align-items: center; justify-content: center;
  }
  .cs-slot:has(img) { border-style: solid; border-color: var(--border); }
  .cs-slot img { width: 100%; height: 100%; object-fit: cover; }
  .cs-slot-label {
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--text-faint);
  }

  .cs-brand-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: var(--space-6); align-items: start; }
  @media (max-width: 760px) { .cs-brand-grid { grid-template-columns: 1fr; } }
  .cs-brand-side { display: flex; flex-direction: column; gap: var(--space-5); }

  .cs-palette { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--space-3); }
  .cs-swatch {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-3);
    display: flex; flex-direction: column; gap: 6px;
  }
  .cs-swatch-chip { height: 44px; border-radius: 6px; border: 1px solid var(--border); }
  .cs-swatch-name { font-size: 0.8rem; font-weight: 700; color: var(--text); }
  .cs-swatch-hex { font-size: 0.7rem; font-family: monospace; color: var(--text-muted); text-transform: uppercase; }

  .cs-type-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .cs-type-row {
    display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-4);
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: var(--radius); padding: var(--space-3) var(--space-4);
  }
  .cs-type-family { font-size: 1rem; font-weight: 800; color: var(--text); }
  .cs-type-role { font-size: 0.78rem; color: var(--text-muted); }

  .cs-browser {
    border: 1px solid var(--border); border-radius: var(--radius-lg);
    overflow: hidden; background: var(--bg-card);
  }
  .cs-browser-bar {
    display: flex; gap: 6px; padding: 10px 14px;
    border-bottom: 1px solid var(--border); background: var(--bg-elevated);
  }
  .cs-browser-bar span { width: 10px; height: 10px; border-radius: 50%; background: var(--surface); }
  .cs-browser-bar span:nth-child(1) { background: var(--dot-close); }
  .cs-browser-bar span:nth-child(2) { background: var(--dot-min); }
  .cs-browser-bar span:nth-child(3) { background: var(--dot-max); }
  .cs-browser .cs-slot { border: none; border-radius: 0; }
  .cs-browser-shot { width: 100%; display: block; }

  .cs-sec-foot {
    display: flex; align-items: flex-start; justify-content: space-between;
    gap: var(--space-6); margin-top: var(--space-5); flex-wrap: wrap;
  }
  .cs-live-btn { display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; }

  .cs-cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); }
  @media (max-width: 640px) { .cs-cards-grid { grid-template-columns: 1fr; } }

  .cs-media-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--space-4); margin-top: var(--space-2);
  }
  .cs-print-item { display: flex; flex-direction: column; gap: var(--space-2); }
  .cs-print-caption { font-size: 0.8125rem; color: var(--text-secondary); }

  .cs-notes {
    margin-top: var(--space-5); max-width: 620px;
    font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.7;
  }
  .cs-sec-foot .cs-notes { margin-top: 0; }

  .cs-cta {
    text-align: center; padding: var(--space-16) var(--space-6);
    background: var(--bg-elevated); border: 1px solid var(--border);
    border-radius: var(--radius-lg);
  }
  .cs-cta-title { font-size: clamp(2.2rem, 6vw, 3.6rem); color: var(--text); margin-bottom: var(--space-3); }
  .cs-cta-sub { color: var(--text-secondary); margin-bottom: var(--space-6); }
  .cs-cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: var(--space-3) var(--space-8); }
`;export{B as default};
