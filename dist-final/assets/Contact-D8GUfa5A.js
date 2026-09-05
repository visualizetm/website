import{u as r,r as t,j as e}from"./index-DTENpw-5.js";function c(){const o=r(),n=new URLSearchParams(o.search).get("from")==="portal";return t.useEffect(()=>{var a;window.location.hash==="#book"&&((a=document.getElementById("book"))==null||a.scrollIntoView({behavior:"smooth"}))},[]),t.useEffect(()=>{if(document.querySelector('script[src*="calendly.com"]'))return;const a=document.createElement("script");a.src="https://assets.calendly.com/assets/external/widget.js",a.async=!0,document.body.appendChild(a)},[]),e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:"contact-hero section",id:"book",children:[e.jsx("div",{className:"contact-hero-bg","aria-hidden":"true"}),e.jsxs("div",{className:"wrap contact-hero-wrap",children:[n&&e.jsxs("p",{className:"contact-notice",role:"status",children:["The client portal has moved. Email ",e.jsx("a",{href:"mailto:contact@visualizeclients.com",children:"contact@visualizeclients.com"})," and we will send your files."]}),e.jsx("h1",{className:"contact-title",children:"Book a Meeting to Discuss Your Business"}),e.jsx("p",{className:"contact-lead",children:"Schedule a call so I can learn about your business, your goals, and exactly what you need. No pitch, no pressure. Just a clear conversation about how I can help."}),e.jsxs("div",{className:"contact-detail-block",children:[e.jsx("h2",{className:"contact-h2",children:"What I'll cover"}),e.jsxs("ul",{className:"contact-list",children:[e.jsxs("li",{children:[e.jsx("strong",{children:"Your business"})," – what you do, who you serve, and where you are now."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Your goals"})," – what you want to achieve with branding, your website, or both."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"What you need"})," – logo, full brand, site, print, or a full package."]}),e.jsxs("li",{children:[e.jsx("strong",{children:"Timeline and budget"})," – so we can align on scope and next steps."]})]})]}),e.jsxs("div",{className:"contact-detail-block",children:[e.jsx("h2",{className:"contact-h2",children:"What happens next"}),e.jsx("p",{className:"contact-p",children:"After you pick a time below, you'll get a confirmation and a calendar invite. On the call I'll go through the details above and, if it's a fit, I'll outline a clear plan and quote. You can ask anything; there's no obligation to move forward."})]}),e.jsx("p",{className:"contact-cta-copy",children:"Choose a time that works for you. I look forward to talking."})]})]}),e.jsxs("section",{className:"contact-main section",children:[e.jsx("div",{className:"contact-main-bg","aria-hidden":"true"}),e.jsxs("div",{className:"wrap contact-wrap",children:[e.jsx("h2",{className:"contact-embed-title",children:"Pick a time"}),e.jsx("div",{className:"calendly-outer",children:e.jsx("div",{className:"calendly-panel",children:e.jsx("div",{className:"calendly-inline-widget","data-url":"https://calendly.com/contactvisualize/studio-meeting?hide_gdpr_banner=1",style:{minWidth:"320px",height:"700px"}})})})]})]}),e.jsx("style",{children:`
        .contact-hero {
          position: relative;
          background: var(--bg);
          padding-bottom: var(--space-16);
        }
        .contact-hero-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212, 76, 67, 0.08) 0%, transparent 50%);
          pointer-events: none;
        }
        .contact-hero .wrap { position: relative; z-index: 1; }
        .contact-hero-wrap {
          max-width: 720px;
        }
        .contact-title {
          font-size: clamp(2rem, 4vw, 2.75rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.15;
          margin-bottom: var(--space-4);
          color: var(--text);
        }
        .contact-notice {
          margin: 0 0 var(--space-6); padding: var(--space-4) var(--space-5);
          border: 1px solid rgba(212,76,67,0.35); border-radius: var(--radius);
          background: rgba(212,76,67,0.08); color: var(--text); font-size: 0.95rem; line-height: 1.5;
        }
        .contact-notice a { color: var(--brand-light); font-weight: 600; }
        .contact-lead {
          font-size: 1.125rem;
          color: var(--text-secondary);
          line-height: 1.65;
          margin-bottom: var(--space-10);
        }
        .contact-detail-block {
          margin-bottom: var(--space-10);
        }
        .contact-h2 {
          font-size: 1.125rem;
          font-weight: 700;
          color: var(--text);
          margin-bottom: var(--space-3);
        }
        .contact-list {
          list-style: none;
          padding: 0;
          margin: 0;
          color: var(--text-secondary);
          font-size: 1rem;
          line-height: 1.7;
        }
        .contact-list li {
          position: relative;
          padding-left: var(--space-5);
          margin-bottom: var(--space-2);
        }
        .contact-list li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.6em;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--brand);
        }
        .contact-p {
          font-size: 1rem;
          color: var(--text-secondary);
          line-height: 1.7;
          margin: 0;
        }
        .contact-cta-copy {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text);
          margin: 0;
        }
        .contact-main {
          position: relative;
          background: var(--bg-elevated);
          border-top: 1px solid var(--glass-border);
        }
        .contact-main-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 40% at 50% 100%, rgba(212, 76, 67, 0.04) 0%, transparent 50%);
          pointer-events: none;
        }
        .contact-main .wrap { position: relative; z-index: 1; }
        .contact-wrap {
          max-width: 900px;
          margin: 0 auto;
        }
        .contact-embed-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text);
          margin-bottom: var(--space-4);
        }
        .calendly-outer {
          overflow: hidden;
          border-radius: var(--radius-lg);
          height: 700px;
          touch-action: pan-y;
        }
        .calendly-panel {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          height: 700px;
        }
        .calendly-panel .calendly-inline-widget {
          border-radius: var(--radius-lg);
          overflow: hidden !important;
        }
        .calendly-outer .calendly-inline-widget iframe {
          overflow: hidden !important;
        }
      `})]})}export{c as default};
