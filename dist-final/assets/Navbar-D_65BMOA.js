import{j as a,_ as p,r as s,S as k,M as f,u as j,L as h,W as x,B as y,I as C,P as N,C as g,X as m,a as L}from"./index-DTENpw-5.js";var z=function(r){return a.jsx("svg",p({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},r,{children:a.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M3 12h18M3 6h18M3 18h18"})}))},S=function(r){return a.jsx("svg",p({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},r,{children:a.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M3 10.5651c0-.5744 0-.8616.074-1.126a2 2 0 0 1 .318-.6502c.1633-.2208.39-.3971.8434-.7498l6.7823-5.2751c.3513-.2732.527-.4099.721-.4624a1 1 0 0 1 .5226 0c.194.0525.3697.1891.721.4624l6.7823 5.2751c.4534.3527.6801.529.8434.7498.1446.1955.2524.4159.318.6502.074.2644.074.5516.074 1.126V17.8c0 1.1201 0 1.6801-.218 2.108a2 2 0 0 1-.874.874C19.4802 21 18.9201 21 17.8 21H6.2c-1.1201 0-1.6802 0-2.108-.218a2 2 0 0 1-.874-.874C3 19.4801 3 18.9201 3 17.8z"})}))},E=function(r){return a.jsx("svg",p({xmlns:"http://www.w3.org/2000/svg",width:24,height:24,fill:"none",viewBox:"0 0 24 24"},r,{children:a.jsx("path",{stroke:"currentColor",strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M5.52 2.64 3.96 4.72c-.309.412-.4635.618-.4599.7904a.5.5 0 0 0 .1916.3833C3.8276 6 4.085 6 4.6 6h14.8c.515 0 .7725 0 .9083-.1063a.5.5 0 0 0 .1916-.3833c.0036-.1724-.1509-.3784-.4599-.7904l-1.56-2.08m-12.96 0c.176-.2347.264-.352.3755-.4366a1 1 0 0 1 .3299-.165C6.36 2 6.5067 2 6.8 2h10.4c.2933 0 .44 0 .5746.0385.1192.034.2311.09.3299.1649.1115.0846.1995.202.3755.4366m-12.96 0L3.64 5.1467c-.2375.3166-.3562.4749-.4405.6492a2 2 0 0 0-.1623.487C3 6.473 3 6.671 3 7.0668V18.8c0 1.1201 0 1.6802.218 2.108.1917.3763.4977.6823.874.874C4.5198 22 5.08 22 6.2 22h11.6c1.1201 0 1.6802 0 2.108-.218a2 2 0 0 0 .874-.874C21 20.4802 21 19.9201 21 18.8V7.0667c0-.3958 0-.5937-.0372-.7837a2 2 0 0 0-.1623-.487c-.0843-.1744-.203-.3327-.4405-.6493L18.48 2.64M16 10a4 4 0 0 1-1.1716 2.8284 3.9996 3.9996 0 0 1-5.6568 0A4 4 0 0 1 8 10"})}))};const u="vz_theme";function M({className:n=""}){const[r,l]=s.useState(()=>document.documentElement.dataset.theme||"dark");s.useEffect(()=>{const t=window.matchMedia("(prefers-color-scheme: light)"),i=c=>{try{const o=localStorage.getItem(u);if(o==="light"||o==="dark")return}catch{}const e=c.matches?"light":"dark";document.documentElement.dataset.theme=e,l(e)};return t.addEventListener("change",i),()=>t.removeEventListener("change",i)},[]);const d=()=>{const t=r==="dark"?"light":"dark";document.documentElement.dataset.theme=t;try{localStorage.setItem(u,t)}catch{}l(t)};return a.jsx("button",{type:"button",className:`theme-toggle ${n}`,onClick:d,"aria-label":r==="dark"?"Switch to light theme":"Switch to dark theme",children:r==="dark"?a.jsx(k,{width:16,height:16}):a.jsx(f,{width:16,height:16})})}function W(){const[n,r]=s.useState(!1),[l,d]=s.useState(!1),t=j();s.useEffect(()=>{const e=()=>d(window.scrollY>24);return window.addEventListener("scroll",e,{passive:!0}),()=>window.removeEventListener("scroll",e)},[]),s.useEffect(()=>{r(!1)},[t.pathname]);const i=[{to:"/",label:"Home",icon:S},{to:"/services",label:"Services",icon:y},{to:"/work",label:"Work",icon:C},{to:"/prints",label:"Shop",icon:E,newTab:!0},{to:"/book",label:"Contact",icon:N}],c=e=>e==="/"?t.pathname==="/":t.pathname.startsWith(e);return a.jsxs(a.Fragment,{children:[a.jsx("header",{className:`navbar ${l?"navbar--scrolled":""}`,children:a.jsxs("div",{className:"navbar-pill",children:[a.jsx(h,{to:"/",className:"navbar-logo",onClick:()=>r(!1),children:a.jsx(x,{size:17})}),a.jsx("nav",{className:"navbar-nav","aria-label":"Main navigation",children:a.jsx("ul",{children:i.map(({to:e,label:o,newTab:v})=>a.jsx("li",{children:v?a.jsx("a",{href:e,target:"_blank",rel:"noopener noreferrer",className:"navbar-link",children:o}):a.jsx(h,{to:e,className:`navbar-link ${c(e)?"navbar-link--active":""}`,children:o})},e))})}),a.jsx(M,{}),a.jsx("div",{className:"navbar-actions",children:a.jsxs("a",{href:"/book",className:"btn btn-primary navbar-cta",children:[a.jsx(g,{width:15,height:15}),"Book a Consultation"]})}),a.jsx("button",{type:"button",className:`navbar-burger ${n?"is-open":""}`,"aria-expanded":n,"aria-label":n?"Close menu":"Open menu",onClick:()=>r(e=>!e),children:n?a.jsx(m,{width:20,height:20}):a.jsx(z,{width:20,height:20})})]})}),a.jsx("div",{className:`navbar-overlay ${n?"is-visible":""}`,onClick:()=>r(!1),"aria-hidden":"true"}),a.jsxs("nav",{className:`navbar-drawer ${n?"is-open":""}`,"aria-label":"Mobile navigation",children:[a.jsxs("div",{className:"navbar-drawer-header",children:[a.jsx(x,{size:20}),a.jsx("button",{type:"button",className:"navbar-drawer-close",onClick:()=>r(!1),"aria-label":"Close menu",children:a.jsx(m,{width:16,height:16})})]}),a.jsx("ul",{className:"navbar-drawer-links",children:i.map(({to:e,label:o,icon:v,newTab:w})=>{const b=a.jsxs(a.Fragment,{children:[a.jsxs("span",{className:"navbar-drawer-link-left",children:[a.jsx("span",{className:"navbar-drawer-link-icon",children:a.jsx(v,{width:17,height:17})}),o]}),a.jsx(L,{width:15,height:15,className:"navbar-drawer-arrow"})]});return a.jsx("li",{children:w?a.jsx("a",{href:e,target:"_blank",rel:"noopener noreferrer",className:"navbar-drawer-link",onClick:()=>r(!1),children:b}):a.jsx(h,{to:e,className:`navbar-drawer-link ${c(e)?"navbar-drawer-link--active":""}`,onClick:()=>r(!1),children:b})},e)})}),a.jsxs("a",{href:"/book",className:"btn btn-primary navbar-drawer-cta",onClick:()=>r(!1),children:[a.jsx(g,{width:16,height:16}),"Book a Consultation"]}),a.jsxs("p",{className:"navbar-drawer-contact",children:["Email"," ",a.jsx("a",{href:"mailto:contact@visualizeclients.com",children:"contact@visualizeclients.com"})]})]}),a.jsx("style",{children:`
        /* ── Pill ─────────────────────────────────── */
        .navbar {
          position: sticky; top: 0; z-index: 200;
          padding: 12px var(--space-6);
          transition: padding 0.3s var(--ease);
        }
        .navbar--scrolled { padding: 8px var(--space-6); }
        @media (max-width: 768px) { .navbar { padding: 10px var(--space-4); } }

        .navbar-pill {
          max-width: 1040px; margin: 0 auto;
          display: flex; align-items: center; gap: var(--space-4);
          padding: 0 var(--space-5); height: 52px;
          background: var(--chrome);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--border);
          border-radius: 999px;
          box-shadow: var(--shadow-chrome);
          transition: background 0.3s, box-shadow 0.3s;
        }
        .navbar--scrolled .navbar-pill {
          background: var(--chrome-solid);
          box-shadow: var(--shadow-chrome-strong);
        }
        @media (max-width: 768px) {
          .navbar-pill { padding: 0 var(--space-4); gap: var(--space-3); }
        }

        /* Logo */
        .navbar-logo { display: flex; align-items: center; flex-shrink: 0; }

        /* Desktop nav */
        .navbar-nav { flex: 1; }
        .navbar-nav ul { display: flex; align-items: center; gap: 2px; list-style: none; }
        .navbar-link {
          font-size: 0.875rem; font-weight: 500; color: var(--text-muted);
          padding: 6px 11px; border-radius: 999px;
          transition: color 0.2s, background 0.2s; white-space: nowrap;
        }
        .navbar-link:hover { color: var(--text); background: var(--hover-soft); }
        .navbar-link--active { color: var(--text); background: var(--hover-strong); }

        /* Action group */
        .navbar-actions { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }

        .navbar-cta {
          flex-shrink: 0; font-size: 0.8125rem;
          padding: 7px 14px; white-space: nowrap;
          display: inline-flex; align-items: center; gap: 6px;
        }

        /* Burger */
        .navbar-burger {
          display: none; align-items: center; justify-content: center;
          width: 36px; height: 36px;
          background: var(--glass-bg); border: 1px solid var(--border);
          border-radius: 50%; cursor: pointer; flex-shrink: 0;
          color: var(--text-secondary);
          transition: background 0.2s, color 0.2s;
        }
        .navbar-burger:hover { background: var(--hover-strong); color: var(--text); }

        /* ── Overlay ──────────────────────────────── */
        .navbar-overlay {
          position: fixed; inset: 0; z-index: 210;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
          opacity: 0; pointer-events: none;
          transition: opacity 0.3s var(--ease);
        }
        .navbar-overlay.is-visible { opacity: 1; pointer-events: all; }

        /* ── Drawer ───────────────────────────────── */
        .navbar-drawer {
          position: fixed; top: 0; right: 0;
          width: min(340px, 88vw); height: 100dvh;
          background: var(--chrome-solid);
          backdrop-filter: blur(28px); -webkit-backdrop-filter: blur(28px);
          border-left: 1px solid var(--border);
          z-index: 220; padding: var(--space-5) var(--space-5);
          display: flex; flex-direction: column; gap: 0;
          transform: translateX(100%);
          transition: transform 0.36s cubic-bezier(0.32,0.72,0,1);
          box-shadow: -24px 0 64px rgba(0,0,0,0.55);
        }
        .navbar-drawer.is-open { transform: translateX(0); }

        .navbar-drawer-header {
          display: flex; align-items: center; justify-content: space-between;
          padding-bottom: var(--space-6); margin-bottom: var(--space-2);
          border-bottom: 1px solid var(--border);
        }
        .navbar-drawer-close {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: var(--glass-bg); border: 1px solid var(--border);
          color: var(--text-secondary); cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .navbar-drawer-close:hover { background: var(--hover-strong); color: var(--text); }

        .navbar-drawer-links { list-style: none; padding: var(--space-3) 0; flex: 0; }

        .navbar-drawer-link {
          display: flex; align-items: center; justify-content: space-between;
          padding: 11px var(--space-3); border-radius: var(--radius);
          color: var(--text-secondary); font-size: 1rem; font-weight: 500;
          transition: color 0.2s, background 0.2s; text-decoration: none;
        }
        .navbar-drawer-link:hover { color: var(--text); background: var(--hover-soft); }
        .navbar-drawer-link--active {
          color: var(--text); background: rgba(212,76,67,0.1);
          border-left: 2px solid var(--brand);
        }
        .navbar-drawer-link-left { display: flex; align-items: center; gap: 12px; }
        .navbar-drawer-link-icon {
          width: 32px; height: 32px; border-radius: var(--radius);
          background: var(--glass-bg); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); flex-shrink: 0;
        }
        .navbar-drawer-arrow { color: var(--text-muted); opacity: 0.4; transition: transform 0.2s, opacity 0.2s; }
        .navbar-drawer-link:hover .navbar-drawer-arrow { opacity: 0.7; transform: translateX(3px); }

        .navbar-drawer-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: var(--space-4); font-size: 0.9375rem;
          border-radius: var(--radius-lg); margin-bottom: var(--space-4);
        }
        .navbar-drawer-contact {
          text-align: center; font-size: 0.8125rem; color: var(--text-muted);
          margin-top: auto; padding-top: var(--space-4);
        }
        .navbar-drawer-contact a { color: var(--brand); font-weight: 600; }

        /* ── Responsive ───────────────────────────── */
        @media (max-width: 900px) {
          .navbar-cta { display: none; }
        }
        @media (max-width: 768px) {
          .navbar-nav { display: none; }
          .navbar-actions { display: none; }
          .navbar-burger { display: flex; }
        }
      `})]})}export{W as default};
