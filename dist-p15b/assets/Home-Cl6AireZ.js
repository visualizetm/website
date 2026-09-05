import{r as c,j as e,L as h,A as l,I as x,_ as d,c as v,d as b,e as u,f,g as w,P as j,h as y,C as k}from"./index-B9Tcr1Fm.js";import{c as N}from"./index-DG47y-p8.js";import{ClientCard as C,workStyles as z}from"./Work-CRF6OxTz.js";import"./ArrowUpRight-87jYvWI7.js";function p(s=.15){const r=c.useRef(null),[a,t]=c.useState(!1);return c.useEffect(()=>{const n=r.current;if(!n)return;const i=new IntersectionObserver(([o])=>{o.isIntersecting&&(t(!0),i.disconnect())},{threshold:s});return i.observe(n),()=>i.disconnect()},[s]),[r,a]}function L(){return e.jsxs("div",{className:"hero-visual","aria-hidden":"true",children:[e.jsx("div",{className:"hv-glow"}),e.jsxs("div",{className:"hv-card hv-card--brand",children:[e.jsx("div",{className:"hv-card-dot hv-card-dot--red"}),e.jsxs("div",{className:"hv-card-lines",children:[e.jsx("div",{className:"hv-line hv-line--short"}),e.jsx("div",{className:"hv-line hv-line--medium"})]}),e.jsx("div",{className:"hv-card-icon",children:e.jsx("svg",{viewBox:"0 0 24 24",fill:"none",width:"18",height:"18",children:e.jsx("path",{d:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",stroke:"var(--brand)",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round"})})}),e.jsx("span",{className:"hv-card-label",children:"Brand Identity"})]}),e.jsxs("div",{className:"hv-screen",children:[e.jsxs("div",{className:"hv-screen-bar",children:[e.jsx("span",{}),e.jsx("span",{}),e.jsx("span",{})]}),e.jsxs("div",{className:"hv-screen-body",children:[e.jsxs("div",{className:"hv-screen-hero-block",children:[e.jsx("div",{className:"hv-screen-line hv-screen-line--title"}),e.jsx("div",{className:"hv-screen-line hv-screen-line--sub"})]}),e.jsxs("div",{className:"hv-screen-grid",children:[e.jsx("div",{className:"hv-screen-card hv-screen-card--1"}),e.jsx("div",{className:"hv-screen-card hv-screen-card--2"}),e.jsx("div",{className:"hv-screen-card hv-screen-card--3"})]}),e.jsx("div",{className:"hv-screen-btn"})]})]}),e.jsxs("div",{className:"hv-card hv-card--web",children:[e.jsx("div",{className:"hv-card-dot hv-card-dot--green"}),e.jsxs("div",{className:"hv-card-lines",children:[e.jsx("div",{className:"hv-line hv-line--medium"}),e.jsx("div",{className:"hv-line hv-line--short"})]}),e.jsx("div",{className:"hv-card-icon",children:e.jsxs("svg",{viewBox:"0 0 24 24",fill:"none",width:"18",height:"18",children:[e.jsx("rect",{x:"2",y:"3",width:"20",height:"14",rx:"2",stroke:"var(--brand)",strokeWidth:"1.8"}),e.jsx("path",{d:"M8 21h8M12 17v4",stroke:"var(--brand)",strokeWidth:"1.8",strokeLinecap:"round"})]})}),e.jsx("span",{className:"hv-card-label",children:"Website Live"})]}),e.jsxs("div",{className:"hv-card hv-card--print",children:[e.jsx("div",{className:"hv-card-dot hv-card-dot--blue"}),e.jsx("span",{className:"hv-card-label",children:"Print Ready"})]}),e.jsx("div",{className:"hv-orbit",children:e.jsx("div",{className:"hv-orbit-dot"})})]})}function B(){const s=p(),r=p({threshold:.1});return e.jsxs("section",{className:"hero",children:[e.jsx("div",{className:"hero-bg","aria-hidden":"true"}),e.jsxs("div",{className:"wrap hero-wrap",children:[e.jsxs("div",{className:"hero-left reveal",ref:s,children:[e.jsxs("div",{className:"hero-eyebrow",children:[e.jsx("span",{className:"hero-eyebrow-dot"}),"Branding · Websites · Print"]}),e.jsx("h1",{className:"hero-title",children:"Branding & Websites for Real Businesses"}),e.jsx("p",{className:"hero-sub",children:"I design the visuals and build the digital foundation your business needs to show up professionally."}),e.jsxs("div",{className:"hero-cta",children:[e.jsxs(h,{to:"/start",className:"btn btn-primary hero-btn-primary",children:["Start a Project",e.jsx(l,{width:16,height:16})]}),e.jsxs(h,{to:"/work",className:"btn btn-secondary hero-btn-secondary",children:[e.jsx(x,{width:17,height:17}),"View My Work",e.jsx(l,{width:15,height:15,className:"hero-btn-arrow"})]})]}),e.jsx("div",{className:"hero-stats",children:[{num:"50+",label:"Clients Served"},{num:"100%",label:"Custom Work"},{num:"1",label:"Person Studio"}].map(a=>e.jsxs("div",{className:"hero-stat",children:[e.jsx("span",{className:"hero-stat-num",children:a.num}),e.jsx("span",{className:"hero-stat-label",children:a.label})]},a.label))})]}),e.jsx("div",{className:"hero-right reveal-right",ref:r,children:e.jsx(L,{})})]}),e.jsx("style",{children:`
        .hero {
          position: relative; min-height: 90vh;
          display: flex; align-items: center;
          padding: var(--space-24) 0 var(--space-16); overflow: hidden;
        }
        .hero-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 90% 60% at 60% 40%, rgba(212,76,67,0.07) 0%, transparent 55%),
            linear-gradient(180deg, var(--bg) 0%, var(--bg-elevated) 100%);
          pointer-events: none;
        }
        .hero-bg::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0;
          height: 120px; background: linear-gradient(to bottom, transparent, var(--bg));
          pointer-events: none;
        }
        .hero-wrap {
          position: relative; z-index: 1;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: var(--space-16); align-items: center;
        }
        @media (max-width: 900px) {
          .hero-wrap { grid-template-columns: 1fr; text-align: center; gap: var(--space-12); }
          .hero-left .hero-cta { justify-content: center; }
          .hero-right { order: -1; }
          .hero-stats { justify-content: center; }
          .hero-eyebrow { justify-content: center; }
          .hero-sub { margin-left: auto; margin-right: auto; }
        }
        .hero-eyebrow {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.75rem; font-weight: 700; letter-spacing: 0.15em;
          text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-5);
        }
        .hero-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--brand);
          box-shadow: 0 0 8px rgba(212,76,67,0.7);
          animation: heroDotPulse 2s ease-in-out infinite;
        }
        @keyframes heroDotPulse {
          0%,100% { box-shadow: 0 0 4px rgba(212,76,67,0.5); }
          50%      { box-shadow: 0 0 14px rgba(212,76,67,1); }
        }
        .hero-title {
          font-size: clamp(2.4rem, 5.5vw, 3.8rem); font-weight: 900;
          letter-spacing: -0.03em; line-height: 1.08;
          margin-bottom: var(--space-6); color: var(--text);
        }
        .hero-sub {
          font-size: clamp(1rem, 2vw, 1.2rem); color: var(--text-secondary);
          max-width: 440px; margin-bottom: var(--space-10); line-height: 1.65;
        }
        .hero-cta { display: flex; flex-wrap: wrap; gap: var(--space-3); }
        .hero-btn-primary { display: inline-flex; align-items: center; gap: 7px; }
        .hero-btn-secondary { display: inline-flex; align-items: center; gap: 7px; }
        .hero-btn-arrow { transition: transform 0.2s; }
        .hero-btn-secondary:hover .hero-btn-arrow { transform: translateX(3px); }
        .hero-stats {
          display: flex; gap: var(--space-8); margin-top: var(--space-10);
          padding-top: var(--space-6); border-top: 1px solid var(--glass-border);
        }
        .hero-stat { display: flex; flex-direction: column; gap: 2px; }
        .hero-stat-num { font-size: 1.375rem; font-weight: 800; color: var(--text); letter-spacing: -0.02em; }
        .hero-stat-label { font-size: 0.75rem; color: var(--text-muted); }

        /* HeroVisual */
        .hero-visual {
          position: relative; width: 100%; aspect-ratio: 1 / 0.9;
          max-width: 480px; margin: 0 auto;
        }
        .hv-glow {
          position: absolute; top: 15%; left: 10%; right: 10%; bottom: 0;
          background: radial-gradient(ellipse at center, rgba(212,76,67,0.14) 0%, transparent 65%);
          animation: hvGlow 5s ease-in-out infinite; pointer-events: none;
        }
        @keyframes hvGlow { 0%,100%{opacity:0.7;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
        .hv-screen {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%,-50%); width: 68%;
          background: rgba(20,20,24,0.92);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
          animation: hvFloat 6s ease-in-out infinite;
        }
        @keyframes hvFloat { 0%,100%{transform:translate(-50%,-50%) translateY(0)} 50%{transform:translate(-50%,-50%) translateY(-8px)} }
        .hv-screen-bar {
          height: 24px; background: rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; padding: 0 10px; gap: 5px;
        }
        .hv-screen-bar span { width: 6px; height: 6px; border-radius: 50%; }
        .hv-screen-bar span:nth-child(1){background:var(--dot-close)}
        .hv-screen-bar span:nth-child(2){background:var(--dot-min)}
        .hv-screen-bar span:nth-child(3){background:var(--dot-max)}
        .hv-screen-body { padding: 12px; }
        .hv-screen-hero-block { margin-bottom: 10px; }
        .hv-screen-line { height: 7px; border-radius: 4px; background: rgba(255,255,255,0.1); margin-bottom: 5px; }
        .hv-screen-line--title { width: 75%; background: rgba(255,255,255,0.18); }
        .hv-screen-line--sub   { width: 55%; }
        .hv-screen-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; margin-bottom: 10px; }
        .hv-screen-card { height: 36px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.07); }
        .hv-screen-card--1{background:rgba(212,76,67,0.15)}
        .hv-screen-card--2{background:rgba(255,255,255,0.05)}
        .hv-screen-card--3{background:rgba(255,255,255,0.03)}
        .hv-screen-btn { height: 20px; width: 45%; border-radius: 4px; background: linear-gradient(135deg, rgba(212,76,67,0.5), rgba(168,58,50,0.4)); border: 1px solid rgba(212,76,67,0.4); }
        .hv-card {
          position: absolute; background: rgba(18,18,22,0.92);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 10px;
          padding: 10px 12px; display: flex; align-items: center; gap: 8px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4); backdrop-filter: blur(12px);
          white-space: nowrap;
        }
        .hv-card--brand{top:8%;left:-4%;animation:hvCard1 7s ease-in-out infinite}
        .hv-card--web{bottom:14%;right:-4%;animation:hvCard2 7s ease-in-out infinite 0.8s}
        .hv-card--print{top:58%;left:-8%;animation:hvCard3 7s ease-in-out infinite 1.6s}
        @keyframes hvCard1{0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-6px) rotate(0deg)}}
        @keyframes hvCard2{0%,100%{transform:translateY(0) rotate(1deg)} 50%{transform:translateY(-8px) rotate(0deg)}}
        @keyframes hvCard3{0%,100%{transform:translateY(0) rotate(0.5deg)} 50%{transform:translateY(6px) rotate(-0.5deg)}}
        .hv-card-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;animation:hvDotPulse 2s ease-in-out infinite}
        .hv-card-dot--red  {background:var(--brand);box-shadow:0 0 6px rgba(212,76,67,0.7)}
        .hv-card-dot--green{background:#22c55e;box-shadow:0 0 6px rgba(34,197,94,0.7)}
        .hv-card-dot--blue {background:#60a5fa;box-shadow:0 0 6px rgba(96,165,250,0.7)}
        @keyframes hvDotPulse{0%,100%{transform:scale(1)} 50%{transform:scale(1.35)}}
        .hv-card-lines{display:flex;flex-direction:column;gap:4px}
        .hv-line{height:4px;border-radius:2px;background:rgba(255,255,255,0.12)}
        .hv-line--short{width:28px}.hv-line--medium{width:42px}
        .hv-card-label{font-size:0.7rem;font-weight:700;color:var(--text-secondary);letter-spacing:0.05em}
        .hv-orbit {
          position: absolute; top: 50%; left: 50%; width: 82%; height: 82%;
          transform: translate(-50%,-50%); border-radius: 50%;
          border: 1px dashed rgba(212,76,67,0.15);
          animation: hvOrbit 20s linear infinite;
        }
        .hv-orbit-dot {
          position: absolute; top: -4px; left: 50%; width: 8px; height: 8px; margin-left: -4px;
          background: var(--brand); border-radius: 50%;
          box-shadow: 0 0 10px rgba(212,76,67,0.6);
        }
        @keyframes hvOrbit{from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(360deg)}}
        @media (max-width: 600px) {
          .hv-card--brand{left:0}.hv-card--web{right:0}.hv-card--print{left:0}
        }
      `})]})}function W(){const s=["Client","Client","Client","Client","Client"];return e.jsxs("section",{className:"trust section section-elevated",children:[e.jsx("div",{className:"trust-bg","aria-hidden":"true"}),e.jsxs("div",{className:"wrap",children:[e.jsx("p",{className:"trust-label",children:"Trusted by local businesses"}),e.jsx("div",{className:"trust-logos",children:s.map((r,a)=>e.jsx("div",{className:"trust-logo",title:r,children:e.jsx("span",{children:r})},a))})]}),e.jsx("style",{children:`
        .trust {
          position: relative;
          padding-top: var(--space-12);
          padding-bottom: var(--space-12);
        }
        .trust-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 40% at 50% 100%, rgba(212, 76, 67, 0.04) 0%, transparent 50%);
          pointer-events: none;
        }
        .trust .wrap { position: relative; z-index: 1; }
        .trust-label {
          font-size: 0.8125rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          text-align: center;
          margin-bottom: var(--space-6);
        }
        .trust-logos {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: var(--space-10);
        }
        .trust-logo {
          width: 120px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius);
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
        }
      `})]})}var m=function(r){return e.jsx("svg",d({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},r,{children:e.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"m2.5 21.4998 5.5493-2.1343c.355-.1365.5324-.2048.6984-.2939a3 3 0 0 0 .4203-.2732c.149-.1155.2834-.25.5523-.5189L21 6.9998c1.1046-1.1045 1.1046-2.8954 0-4s-2.8954-1.1046-4 0L5.7203 14.2795c-.269.2689-.4034.4034-.519.5523a3 3 0 0 0-.273.4203c-.0892.166-.1574.3435-.294.6985zm0 0 2.0581-5.351c.1473-.3829.221-.5744.3472-.6621a.5.5 0 0 1 .379-.0804c.151.0288.296.1739.5862.464l2.259 2.2591c.2902.2901.4352.4351.464.5861a.5.5 0 0 1-.0804.379c-.0876.1263-.2791.1999-.662.3472z"})}))};const M=[{title:"Brand Identity",items:["Logo design","Brand identity","Brand guidelines"],icon:m,color:"#d44c43"},{title:"Website Development",items:["Business websites","Landing pages","Contact forms"],icon:v,color:"#60a5fa"},{title:"Print & Physical",items:["Stickers","Business cards","Print-ready files"],icon:b,color:"#a78bfa"},{title:"Digital Setup",items:["Google Business Profile","Basic analytics setup","Launch essentials"],icon:u,color:"#34d399"}];function P(){const[s,r]=c.useState(null);return e.jsxs("section",{className:"services section section-elevated",id:"services",children:[e.jsxs("div",{className:"wrap",children:[e.jsx("h2",{className:"section-title reveal",children:"Studio Services"}),e.jsx("p",{className:"section-subtitle reveal",children:"Brand identity, websites, print design, and essential digital setup, delivered directly, start to finish."}),e.jsx("div",{className:"services-grid stagger",children:M.map((a,t)=>{const n=a.icon,i=s===t;return e.jsxs("button",{type:"button",className:`services-card ${i?"is-expanded":""}`,style:{"--sc":a.color},onMouseEnter:()=>r(t),onMouseLeave:()=>r(null),onClick:()=>r(i?null:t),children:[e.jsxs("div",{className:"services-card-top",children:[e.jsx("div",{className:"services-card-icon",children:e.jsx(n,{width:20,height:20})}),e.jsx(f,{width:16,height:16,className:`services-card-chevron ${i?"is-open":""}`})]}),e.jsx("h3",{className:"services-card-title",children:a.title}),e.jsx("ul",{className:"services-card-list",children:a.items.map(o=>e.jsxs("li",{children:[e.jsx(w,{width:13,height:13}),o]},o))})]},a.title)})})]}),e.jsx("style",{children:`
        .services-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-5);
          margin-top: var(--space-12);
        }
        @media (max-width: 1024px) { .services-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px)  { .services-grid { grid-template-columns: 1fr; } }

        .services-card {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          cursor: pointer; text-align: left; width: 100%;
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s, background 0.25s;
          position: relative; overflow: hidden;
        }
        .services-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: var(--sc, var(--brand));
          transform: scaleX(0); transform-origin: left;
          transition: transform 0.3s var(--ease);
        }
        .services-card:hover::before,
        .services-card.is-expanded::before { transform: scaleX(1); }
        .services-card:hover,
        .services-card.is-expanded {
          border-color: color-mix(in srgb, var(--sc) 45%, transparent);
          box-shadow: 0 12px 40px rgba(0,0,0,0.25), 0 0 0 1px color-mix(in srgb, var(--sc) 15%, transparent);
          background: color-mix(in srgb, var(--sc) 5%, var(--glass-bg));
          transform: translateY(-2px);
        }
        .services-card-top {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--space-4);
        }
        .services-card-icon {
          width: 40px; height: 40px; border-radius: var(--radius);
          background: color-mix(in srgb, var(--sc) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--sc) 25%, transparent);
          display: flex; align-items: center; justify-content: center;
          color: var(--sc, var(--brand));
          transition: background 0.25s;
        }
        .services-card:hover .services-card-icon,
        .services-card.is-expanded .services-card-icon {
          background: color-mix(in srgb, var(--sc) 20%, transparent);
        }
        .services-card-chevron {
          color: var(--text-muted); transition: transform 0.25s, color 0.25s;
        }
        .services-card-chevron.is-open { transform: rotate(180deg); color: var(--sc, var(--brand)); }
        .services-card-title {
          font-size: 1.0625rem; font-weight: 700; color: var(--text);
          margin-bottom: var(--space-4); line-height: 1.3;
        }
        .services-card-list {
          list-style: none; padding: 0;
          display: flex; flex-direction: column; gap: var(--space-2);
        }
        .services-card-list li {
          display: flex; align-items: center; gap: 7px;
          font-size: 0.875rem; color: var(--text-secondary); line-height: 1.4;
        }
        .services-card-list svg { color: var(--sc, var(--brand)); flex-shrink: 0; }
      `})]})}function S(){const s=N.slice(0,3);return e.jsxs("section",{className:"showcase-preview section section-dark",children:[e.jsx("div",{className:"showcase-preview-bg","aria-hidden":"true"}),e.jsxs("div",{className:"wrap",children:[e.jsxs("div",{className:"showcase-preview-head reveal",children:[e.jsxs("div",{children:[e.jsx("h2",{className:"section-title",children:"My Work"}),e.jsx("p",{className:"section-subtitle",children:"Real businesses built end to end, brand, web, and print under one roof."})]}),e.jsxs(h,{to:"/work",className:"btn btn-secondary showcase-view-all",children:["View All Work",e.jsx(l,{width:15,height:15,className:"showcase-arrow"})]})]}),e.jsx("div",{className:"showcase-preview-grid stagger",children:s.map(r=>e.jsx(C,{client:r},r.slug))})]}),e.jsx("style",{children:z}),e.jsx("style",{children:`
        .showcase-preview { position: relative; }
        .showcase-preview-bg {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 60% 40% at 50% 0%, rgba(212,76,67,0.05) 0%, transparent 50%);
          pointer-events: none;
        }
        .showcase-preview .wrap { position: relative; z-index: 1; }
        .showcase-preview-head {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: var(--space-6); flex-wrap: wrap; margin-bottom: var(--space-12);
        }
        .showcase-view-all {
          display: inline-flex; align-items: center; gap: 7px;
          flex-shrink: 0; font-size: 0.875rem;
        }
        .showcase-arrow { transition: transform 0.2s; }
        .showcase-view-all:hover .showcase-arrow { transform: translateX(3px); }

        .showcase-preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-5);
        }
        @media (max-width: 900px) { .showcase-preview-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .showcase-preview-grid { grid-template-columns: 1fr; } }
      `})]})}var Y=function(r){return e.jsx("svg",d({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},r,{children:e.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M16 4c.93 0 1.395 0 1.7765.1022a3 3 0 0 1 2.1213 2.1213C20 6.605 20 7.07 20 8v9.2c0 1.6802 0 2.5202-.327 3.162a3 3 0 0 1-1.311 1.311C17.7202 22 16.8802 22 15.2 22H8.8c-1.6802 0-2.5202 0-3.162-.327a3 3 0 0 1-1.311-1.311C4 19.7202 4 18.8802 4 17.2V8c0-.93 0-1.395.1022-1.7765a3 3 0 0 1 2.1213-2.1213C6.605 4 7.07 4 8 4m1 11 2 2 4.5-4.5M9.6 6h4.8c.5601 0 .8401 0 1.054-.109a1 1 0 0 0 .437-.437C16 5.24 16 4.96 16 4.4v-.8c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C15.2401 2 14.9601 2 14.4 2H9.6c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C8 2.76 8 3.04 8 3.6v.8c0 .56 0 .84.109 1.054a1 1 0 0 0 .437.437C8.76 6 9.04 6 9.6 6"})}))},D=function(r){return e.jsx("svg",d({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},r,{children:e.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"m12.9996 10.9999-9.5 9.5M14.0181 3.5384c1.218.8082 2.3887 1.761 3.4827 2.855 1.1034 1.1034 2.0632 2.285 2.8759 3.5143M9.2546 7.896l-2.8749-.9582a1 1 0 0 0-.9621.1853L2.5604 9.5406c-.585.495-.4187 1.4369.3002 1.7018l2.7072.9974m6.1129 6.1126.9974 2.7072c.2649.719 1.2068.8852 1.7017.3003l2.4176-2.8572a1 1 0 0 0 .1853-.9622l-.9583-2.8748m3.3238-12.395-4.9064.8177a2.443 2.443 0 0 0-1.3827.741l-6.6131 7.069c-1.7141 1.8323-1.6665 4.6939.1078 6.4682 1.7742 1.7742 4.6358 1.8219 6.4682.1077l7.0691-6.613a2.443 2.443 0 0 0 .741-1.3827l.8177-4.9065c.2256-1.3536-.9479-2.5272-2.3016-2.3016"})}))};const g=[{num:"01",title:"Intro Call",desc:"A short call to understand your business, your goals, and whether we fit.",icon:j},{num:"02",title:"Onboarding",desc:"You fill out the project brief, we align on scope and timeline, and lock the plan.",icon:Y},{num:"03",title:"Build",desc:"I design and build. You review at set checkpoints and we refine until it is right.",icon:m},{num:"04",title:"Delivery",desc:"Launch day: files, access, and next-step guidance handed over. You own everything.",icon:D}];function I(){return e.jsxs("section",{className:"process section section-elevated",children:[e.jsxs("div",{className:"wrap",children:[e.jsx("h2",{className:"section-title reveal",children:"How It Works"}),e.jsx("p",{className:"section-subtitle reveal",children:"The client journey, start to finish, no surprises."}),e.jsx("div",{className:"process-timeline stagger",children:g.map((s,r)=>{const a=s.icon;return e.jsxs("div",{className:"process-step",children:[e.jsxs("div",{className:"process-step-top",children:[e.jsx("div",{className:"process-icon",children:e.jsx(a,{width:20,height:20})}),e.jsx("span",{className:"process-num",children:s.num})]}),e.jsx("h3",{className:"process-title",children:s.title}),e.jsx("p",{className:"process-desc",children:s.desc}),r<g.length-1&&e.jsxs("div",{className:"process-connector","aria-hidden":"true",children:[e.jsx("div",{className:"process-connector-line"}),e.jsx("svg",{viewBox:"0 0 8 8",fill:"none",width:"8",height:"8",children:e.jsx("circle",{cx:"4",cy:"4",r:"3",fill:"var(--brand)",opacity:"0.4"})})]})]},s.num)})})]}),e.jsx("style",{children:`
        .process-timeline {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
          margin-top: var(--space-12);
          position: relative;
        }
        @media (max-width: 900px) { .process-timeline { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .process-timeline { grid-template-columns: 1fr; } }

        .process-step {
          position: relative; padding: var(--space-8);
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border); border-radius: var(--radius-lg);
          margin: 0 var(--space-2);
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
        }
        .process-step:hover {
          border-color: rgba(212,76,67,0.4);
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          transform: translateY(-3px);
        }
        .process-step-top {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: var(--space-4);
        }
        .process-icon {
          width: 40px; height: 40px; border-radius: var(--radius);
          background: rgba(212,76,67,0.1); border: 1px solid rgba(212,76,67,0.2);
          display: flex; align-items: center; justify-content: center;
          color: var(--brand);
        }
        .process-num {
          font-size: 1.75rem; font-weight: 900; letter-spacing: -0.04em;
          color: rgba(255,255,255,0.06);
        }
        .process-title {
          font-size: 1.0625rem; font-weight: 700; color: var(--text); margin-bottom: var(--space-3);
        }
        .process-desc { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.65; }

        .process-connector {
          display: none;
          position: absolute; top: 50%; right: calc(-1 * var(--space-2) - 8px);
          transform: translateY(-50%);
          align-items: center; gap: 0; z-index: 1;
        }
        .process-connector-line {
          width: calc(var(--space-2) * 2); height: 1px;
          background: linear-gradient(90deg, rgba(212,76,67,0.3), rgba(212,76,67,0.1));
        }
        @media (min-width: 901px) { .process-connector { display: flex; } }
      `})]})}var R=function(r){return e.jsx("svg",d({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},r,{children:e.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M7 8.5h5M7 12h8m-5.3162 6H16.2c1.6802 0 2.5202 0 3.162-.327a3 3 0 0 0 1.311-1.311C21 15.7202 21 14.8802 21 13.2V7.8c0-1.6802 0-2.5202-.327-3.162a3 3 0 0 0-1.311-1.311C18.7202 3 17.8802 3 16.2 3H7.8c-1.6802 0-2.5202 0-3.162.327a3 3 0 0 0-1.311 1.311C3 5.2798 3 6.1198 3 7.8v12.5355c0 .5329 0 .7993.1092.9361a.5.5 0 0 0 .3913.1881c.1751-.0002.3832-.1666.7993-.4995l2.3854-1.9084c.4873-.3898.731-.5847 1.0023-.7233.2407-.123.497-.2129.7617-.2672C8.7477 18 9.0597 18 9.6838 18"})}))};const H=[{text:"Clear communication, strong design, and a smooth handoff. Everything felt organized from day one.",author:"Client",company:"Local Business"},{text:"The brand and website came together quickly, and the details were handled with care.",author:"Client",company:"Local Business"},{text:"The final site looks professional, loads fast, and matches the brand perfectly.",author:"Client",company:"Local Business"}];function V(){return e.jsxs("section",{className:"testimonials section section-elevated",children:[e.jsxs("div",{className:"wrap",children:[e.jsx("h2",{className:"section-title reveal",children:"What Clients Say"}),e.jsx("p",{className:"section-subtitle reveal",children:"Real feedback from real clients."}),e.jsx("div",{className:"testimonials-grid stagger",children:H.map((s,r)=>e.jsxs("blockquote",{className:"testimonial-card",children:[e.jsx("div",{className:"testimonial-stars",children:[...Array(5)].map((a,t)=>e.jsx(y,{width:13,height:13,fill:"var(--brand)"},t))}),e.jsx(R,{width:28,height:28,className:"testimonial-quote-icon"}),e.jsx("p",{className:"testimonial-text",children:s.text}),e.jsxs("footer",{className:"testimonial-footer",children:[e.jsx("div",{className:"testimonial-avatar",children:s.author.charAt(0)}),e.jsxs("div",{children:[e.jsx("cite",{className:"testimonial-author",children:s.author}),e.jsx("span",{className:"testimonial-company",children:s.company})]})]})]},r))})]}),e.jsx("style",{children:`
        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-6); margin-top: var(--space-12);
        }
        @media (max-width: 900px) { .testimonials-grid { grid-template-columns: 1fr; } }

        .testimonial-card {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border); border-radius: var(--radius-lg);
          padding: var(--space-7); margin: 0;
          display: flex; flex-direction: column; gap: var(--space-4);
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
          position: relative; overflow: hidden;
        }
        .testimonial-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,76,67,0.4), transparent);
          transform: scaleX(0); transition: transform 0.3s;
        }
        .testimonial-card:hover::before { transform: scaleX(1); }
        .testimonial-card:hover {
          border-color: rgba(212,76,67,0.3);
          box-shadow: 0 12px 40px rgba(0,0,0,0.25);
          transform: translateY(-3px);
        }
        .testimonial-stars { display: flex; gap: 3px; }
        .testimonial-quote-icon { color: rgba(212,76,67,0.25); flex-shrink: 0; }
        .testimonial-text {
          font-size: 0.9375rem; color: var(--text-secondary); line-height: 1.75; flex: 1;
        }
        .testimonial-footer { display: flex; align-items: center; gap: var(--space-3); }
        .testimonial-avatar {
          width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
          background: rgba(212,76,67,0.15); border: 1px solid rgba(212,76,67,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.875rem; font-weight: 700; color: var(--brand);
        }
        .testimonial-author { display: block; font-weight: 600; color: var(--text); font-style: normal; font-size: 0.9rem; }
        .testimonial-company { display: block; font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
      `})]})}function T(){return e.jsxs("section",{className:"cta section",children:[e.jsx("div",{className:"cta-bg","aria-hidden":"true"}),e.jsxs("div",{className:"wrap cta-inner",children:[e.jsx("h2",{className:"cta-title",children:"Ready to Build a Brand and Website You're Proud Of?"}),e.jsxs("a",{href:"/book",className:"btn btn-primary cta-btn",children:[e.jsx(k,{width:18,height:18}),"Book a Consultation",e.jsx(l,{width:16,height:16,className:"cta-arrow"})]})]}),e.jsx("style",{children:`
        .cta {
          position: relative;
          background: linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg) 100%);
          border-top: 1px solid var(--glass-border);
        }
        .cta-bg {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 100% 80% at 50% 50%, rgba(212,76,67,0.12) 0%, transparent 65%);
          pointer-events: none;
        }
        .cta-inner { position: relative; z-index: 1; text-align: center; }
        .cta-title {
          font-size: clamp(1.75rem, 3.5vw, 2.5rem); font-weight: 800;
          letter-spacing: -0.02em; line-height: 1.2; margin-bottom: var(--space-8);
          max-width: 16ch; margin-left: auto; margin-right: auto; color: var(--text);
        }
        .cta-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: var(--space-4) var(--space-8); font-size: 1rem;
        }
        .cta-arrow { transition: transform 0.2s; }
        .cta-btn:hover .cta-arrow { transform: translateX(3px); }
      `})]})}function O(){return e.jsxs("section",{className:"prints-section section",children:[e.jsx("div",{className:"prints-section-bg","aria-hidden":"true"}),e.jsxs("div",{className:"wrap",children:[e.jsxs("div",{className:"prints-section-header",children:[e.jsx("p",{className:"prints-section-eyebrow",children:"Custom Prints"}),e.jsx("h2",{className:"prints-section-title",children:"Stickers & Vinyl, Designed and Produced In-House"}),e.jsx("p",{className:"prints-section-sub",children:"I produce custom stickers and vinyl prints for branding, packaging, vehicles, and more. Select your product below to configure your order and get a quote."})]}),e.jsxs("div",{className:"prints-cards",children:[e.jsxs("a",{href:"/prints?type=stickers",target:"_blank",rel:"noopener noreferrer",className:"prints-card prints-card--stickers",children:[e.jsx("div",{className:"prints-card-glow","aria-hidden":"true"}),e.jsx("div",{className:"prints-card-icon","aria-hidden":"true",children:e.jsxs("svg",{viewBox:"0 0 64 64",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:[e.jsx("circle",{cx:"32",cy:"32",r:"26",stroke:"currentColor",strokeWidth:"2.5"}),e.jsx("circle",{cx:"32",cy:"32",r:"14",stroke:"currentColor",strokeWidth:"2",strokeDasharray:"5 4"}),e.jsx("circle",{cx:"32",cy:"32",r:"4.5",fill:"currentColor"}),e.jsx("circle",{cx:"20",cy:"14",r:"3",fill:"currentColor",opacity:"0.4"}),e.jsx("circle",{cx:"46",cy:"18",r:"2",fill:"currentColor",opacity:"0.3"}),e.jsx("circle",{cx:"50",cy:"44",r:"2.5",fill:"currentColor",opacity:"0.4"})]})}),e.jsx("h3",{className:"prints-card-title",children:"Custom Stickers"}),e.jsx("p",{className:"prints-card-desc",children:"Die-cut, circle, square, and rectangle in a clean glossy finish. Perfect for branding, packaging, and giveaways."}),e.jsxs("ul",{className:"prints-card-features",children:[e.jsx("li",{children:"Die-cut to any shape"}),e.jsx("li",{children:"Glossy finish"}),e.jsx("li",{children:"Waterproof, indoor use"}),e.jsx("li",{children:"From $0.75 per sticker"})]}),e.jsxs("div",{className:"prints-card-cta",children:["Configure Order",e.jsx("svg",{viewBox:"0 0 20 20",fill:"none","aria-hidden":"true",children:e.jsx("path",{d:"M4 10h12M10 4l6 6-6 6",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})})]})]}),e.jsxs("a",{href:"/prints?type=vinyl",target:"_blank",rel:"noopener noreferrer",className:"prints-card prints-card--vinyl",children:[e.jsx("div",{className:"prints-card-glow","aria-hidden":"true"}),e.jsx("div",{className:"prints-card-icon","aria-hidden":"true",children:e.jsxs("svg",{viewBox:"0 0 64 64",fill:"none",xmlns:"http://www.w3.org/2000/svg",children:[e.jsx("rect",{x:"8",y:"16",width:"48",height:"32",rx:"6",stroke:"currentColor",strokeWidth:"2.5"}),e.jsx("path",{d:"M8 26h48",stroke:"currentColor",strokeWidth:"2",strokeDasharray:"4 3"}),e.jsx("path",{d:"M20 16v32",stroke:"currentColor",strokeWidth:"1.5",strokeDasharray:"3 3"}),e.jsx("path",{d:"M36 34l5-5-5-5",stroke:"currentColor",strokeWidth:"2.5",strokeLinecap:"round",strokeLinejoin:"round"}),e.jsx("circle",{cx:"50",cy:"12",r:"3",fill:"currentColor",opacity:"0.4"}),e.jsx("circle",{cx:"14",cy:"52",r:"2",fill:"currentColor",opacity:"0.3"})]})}),e.jsx("h3",{className:"prints-card-title",children:"Vinyl Prints"}),e.jsx("p",{className:"prints-card-desc",children:"Durable, weatherproof vinyl for vehicles, windows, walls, and storefronts. Matte, gloss, and holographic finishes. Built to last outdoors."}),e.jsxs("ul",{className:"prints-card-features",children:[e.jsx("li",{children:"Weatherproof & outdoor-rated"}),e.jsx("li",{children:"Vehicle, window & wall-ready"}),e.jsx("li",{children:"Custom sizes available"}),e.jsx("li",{children:"Priced by quote"})]}),e.jsxs("div",{className:"prints-card-cta",children:["Configure Order",e.jsx("svg",{viewBox:"0 0 20 20",fill:"none","aria-hidden":"true",children:e.jsx("path",{d:"M4 10h12M10 4l6 6-6 6",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"})})]})]})]})]}),e.jsx("style",{children:`
        .prints-section {
          position: relative;
          background: var(--bg-elevated);
          border-top: 1px solid var(--glass-border);
          overflow: hidden;
        }
        .prints-section-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 60% 60% at 15% 50%, rgba(212,76,67,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 60% at 85% 50%, rgba(212,76,67,0.05) 0%, transparent 60%);
          pointer-events: none;
        }
        .prints-section-header {
          max-width: 640px;
          margin-bottom: var(--space-12);
        }
        .prints-section-eyebrow {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--brand);
          margin-bottom: var(--space-3);
        }
        .prints-section-title {
          font-size: clamp(1.75rem, 3.5vw, 2.5rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--text);
          margin-bottom: var(--space-4);
        }
        .prints-section-sub {
          font-size: 1.0625rem;
          color: var(--text-secondary);
          line-height: 1.65;
        }
        .prints-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-6);
        }
        @media (max-width: 768px) {
          .prints-cards { grid-template-columns: 1fr; }
        }
        .prints-card {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: var(--space-10);
          border-radius: var(--radius-lg);
          border: 1px solid var(--glass-border);
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          transition: border-color 0.25s, box-shadow 0.25s, transform 0.22s;
        }
        .prints-card:hover {
          border-color: var(--brand);
          box-shadow: 0 16px 60px rgba(0,0,0,0.1), 0 0 0 1px rgba(212,76,67,0.2);
          transform: translateY(-3px);
        }
        .prints-card-glow {
          position: absolute;
          top: -40%;
          right: -30%;
          width: 70%;
          height: 120%;
          background: radial-gradient(circle, rgba(212,76,67,0.12) 0%, transparent 65%);
          pointer-events: none;
          transition: opacity 0.3s;
          opacity: 0;
        }
        .prints-card:hover .prints-card-glow { opacity: 1; }
        .prints-card-icon {
          width: 64px;
          height: 64px;
          color: var(--brand);
          margin-bottom: var(--space-5);
        }
        .prints-card-icon svg { width: 100%; height: 100%; }
        .prints-card-title {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text);
          margin-bottom: var(--space-3);
        }
        .prints-card-desc {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          line-height: 1.65;
          margin-bottom: var(--space-5);
          flex: 1;
        }
        .prints-card-features {
          list-style: none;
          padding: 0;
          margin: 0 0 var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .prints-card-features li {
          font-size: 0.875rem;
          color: var(--text-secondary);
          padding-left: var(--space-5);
          position: relative;
        }
        .prints-card-features li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.55em;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--brand);
        }
        .prints-card-cta {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          font-size: 0.9375rem;
          font-weight: 700;
          color: var(--brand);
          transition: gap 0.2s;
        }
        .prints-card:hover .prints-card-cta { gap: var(--space-3); }
        .prints-card-cta svg {
          width: 18px;
          height: 18px;
          transition: transform 0.2s;
        }
        .prints-card:hover .prints-card-cta svg { transform: translateX(3px); }
      `})]})}function _(){return e.jsxs(e.Fragment,{children:[e.jsx(B,{}),e.jsx(W,{}),e.jsx(P,{}),e.jsx(O,{}),e.jsx(S,{}),e.jsx(I,{}),e.jsx(V,{}),e.jsx(T,{})]})}export{_ as default};
