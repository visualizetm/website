import{j as e,L as o,W as t,b as a,A as s}from"./index-f7ZHxK8e.js";function l({size:r=16}){return e.jsxs("svg",{width:r,height:r,viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg","aria-hidden":"true",children:[e.jsx("rect",{x:"3",y:"3",width:"18",height:"18",rx:"5",stroke:"currentColor",strokeWidth:"2"}),e.jsx("circle",{cx:"12",cy:"12",r:"4",stroke:"currentColor",strokeWidth:"2"}),e.jsx("circle",{cx:"17.2",cy:"6.8",r:"1.2",fill:"currentColor"})]})}function c(){return e.jsxs("footer",{className:"footer",children:[e.jsxs("div",{className:"wrap footer-inner",children:[e.jsxs("div",{className:"footer-top",children:[e.jsxs("div",{className:"footer-brand",children:[e.jsx(o,{to:"/",className:"footer-logo",children:e.jsx(t,{size:22})}),e.jsx("p",{className:"footer-tagline",children:"Brand Development & Website Design"}),e.jsx("div",{className:"footer-contact",children:e.jsxs("a",{href:"mailto:contact@visualizeclients.com",className:"footer-contact-item",children:[e.jsx(a,{width:14,height:14}),"contact@visualizeclients.com"]})})]}),e.jsxs("div",{className:"footer-cols",children:[e.jsxs("div",{className:"footer-col",children:[e.jsx("p",{className:"footer-col-label",children:"Navigation"}),e.jsxs("nav",{className:"footer-col-links",children:[e.jsx(o,{to:"/",children:"Home"}),e.jsx(o,{to:"/services",children:"Services"}),e.jsx(o,{to:"/work",children:"Work"}),e.jsx(o,{to:"/book",children:"Contact"})]})]}),e.jsxs("div",{className:"footer-col",children:[e.jsx("p",{className:"footer-col-label",children:"Products"}),e.jsx("nav",{className:"footer-col-links",children:e.jsx("a",{href:"/prints",target:"_blank",rel:"noopener noreferrer",children:"Custom Prints"})})]})]}),e.jsxs("div",{className:"footer-cta-col",children:[e.jsx("p",{className:"footer-cta-label",children:"Ready to start?"}),e.jsxs("a",{href:"/book",className:"footer-cta-btn",children:["Book a Meeting",e.jsx(s,{width:14,height:14})]}),e.jsxs("a",{href:"https://www.instagram.com/visualizetm/",target:"_blank",rel:"noopener noreferrer",className:"footer-social",children:[e.jsx(l,{size:16}),"@visualizetm"]})]})]}),e.jsxs("div",{className:"footer-bottom",children:[e.jsxs("p",{className:"footer-copy",children:["© ",new Date().getFullYear()," Visualize. All rights reserved."]}),e.jsx("p",{className:"footer-build",children:"dev"})]})]}),e.jsx("style",{children:`
        .footer {
          background: var(--bg-deep);
          border-top: 1px solid var(--border);
          padding: var(--space-16) 0 var(--space-8);
        }
        .footer-top {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr;
          gap: var(--space-12);
          margin-bottom: var(--space-12);
          padding-bottom: var(--space-12);
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 900px) { .footer-top { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .footer-top { grid-template-columns: 1fr; gap: var(--space-8); } }

        .footer-logo {
          display: inline-flex; align-items: center;
          margin-bottom: var(--space-3);
        }
        .footer-tagline { font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-4); }
        .footer-contact { display: flex; flex-direction: column; gap: var(--space-2); }
        .footer-contact-item {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.8125rem; color: var(--text-secondary);
          transition: color 0.2s;
        }
        .footer-contact-item:hover { color: var(--text); }

        .footer-cols { display: flex; gap: var(--space-10); }
        @media (max-width: 600px) { .footer-cols { gap: var(--space-8); } }
        .footer-col-label {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--text-muted); margin-bottom: var(--space-4);
        }
        .footer-col-links {
          display: flex; flex-direction: column; gap: var(--space-3);
        }
        .footer-col-links a {
          font-size: 0.9rem; color: var(--text-secondary); transition: color 0.2s;
        }
        .footer-col-links a:hover { color: var(--text); }

        .footer-cta-col { display: flex; flex-direction: column; gap: var(--space-4); }
        .footer-cta-label {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em;
          text-transform: uppercase; color: var(--text-muted);
        }
        .footer-cta-btn {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.9rem; font-weight: 700; color: var(--brand);
          transition: gap 0.2s;
        }
        .footer-cta-btn:hover { gap: 10px; }
        .footer-social {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.875rem; color: var(--text-secondary); transition: color 0.2s;
        }
        .footer-social:hover { color: var(--text); }

        .footer-bottom {
          display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
          flex-wrap: wrap;
        }
        .footer-copy { font-size: 0.8125rem; color: var(--text-muted); }
        .footer-build {
          font-size: 0.6875rem; color: var(--text-faint);
          font-family: monospace; letter-spacing: 0.04em;
        }
      `})]})}export{c as default};
