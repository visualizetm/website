import { useEffect } from 'react';

const calendlyUrl =
  'https://calendly.com/contactvisualize/15min-onboarding-meeting?hide_event_type_details=1&hide_gdpr_banner=1';

export default function LeadPartner() {
  useEffect(() => {
    if (document.querySelector('script[src*="calendly.com"]')) return;
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="lp-hero section">
        <div className="lp-hero-bg" aria-hidden="true" />
        <div className="wrap lp-hero-wrap">
          <div className="lp-hero-content">
            <h1 className="lp-title">Lead Partner Opportunity</h1>
            <p className="lp-subtitle">
              Earn commission by connecting businesses with professional branding and website services.
            </p>
            <a className="btn btn-primary lp-hero-btn" href="#book-call">
              Book a Call
            </a>
          </div>
          <div className="lp-hero-visual" aria-hidden="true">
            <div className="lp-hero-abstract" />
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="lp-content section">
        <div className="lp-content-bg" aria-hidden="true" />
        <div className="wrap lp-content-wrap">
          <div className="lp-grid">
            <article className="lp-card">
              <h2 className="lp-h">Compensation Model</h2>
              <p className="lp-p">
                Lead Partners earn <strong>10%</strong> of every invoice <strong>paid</strong> that is directly tied to
                the initial project scope for a client they bring in.
              </p>
              <div className="lp-split">
                <div>
                  <h3 className="lp-k">Commission is only earned when</h3>
                  <ul className="lp-list">
                    <li>The client attends a strategy meeting</li>
                    <li>Agrees to move forward</li>
                    <li>Pays the 50% upfront deposit</li>
                  </ul>
                </div>
                <div>
                  <h3 className="lp-k">No commission is paid for</h3>
                  <ul className="lp-list lp-list--muted">
                    <li>Messages</li>
                    <li>Conversations</li>
                    <li>"Interested" replies</li>
                    <li>Meetings that do not convert</li>
                    <li>Unpaid invoices</li>
                  </ul>
                </div>
              </div>
            </article>

            <article className="lp-card">
              <h2 className="lp-h">How Commission Works</h2>
              <p className="lp-p"><strong>Example – $500 Project</strong></p>
              <div className="lp-example">
                <div className="lp-example-row">
                  <span>Invoice 1 (50% deposit)</span>
                  <span>$250 → <strong>$25</strong> commission</span>
                </div>
                <div className="lp-example-row">
                  <span>Invoice 2 (final 50%)</span>
                  <span>$250 → <strong>$25</strong> commission</span>
                </div>
                <div className="lp-example-total">
                  <span>Total commission earned</span>
                  <span><strong>$50</strong></span>
                </div>
              </div>
              <p className="lp-p lp-p--muted">
                Commission is calculated from each paid invoice, not promised revenue.
              </p>
            </article>

            <article className="lp-card">
              <h2 className="lp-h">What Counts Toward Commission</h2>
              <div className="lp-split">
                <div>
                  <h3 className="lp-k">Included</h3>
                  <ul className="lp-list">
                    <li>Deposit invoice</li>
                    <li>Final payment invoice</li>
                    <li>Approved add-ons within the same project scope</li>
                  </ul>
                </div>
                <div>
                  <h3 className="lp-k">Not included</h3>
                  <ul className="lp-list lp-list--muted">
                    <li>Future unrelated projects</li>
                    <li>Monthly retainers (unless agreed separately)</li>
                    <li>Work outside the original signed scope</li>
                  </ul>
                </div>
              </div>
            </article>

            <article className="lp-card">
              <h2 className="lp-h">Process Structure</h2>
              <div className="lp-steps">
                <div className="lp-step">
                  <div className="lp-step-num">01</div>
                  <div>
                    <h3 className="lp-step-title">Prospecting</h3>
                    <p className="lp-step-desc">
                      Identify service-based local businesses that have no website, have an outdated website, have weak
                      branding, or have poor social presence.
                    </p>
                  </div>
                </div>
                <div className="lp-step">
                  <div className="lp-step-num">02</div>
                  <div>
                    <h3 className="lp-step-title">Pre-Review</h3>
                    <p className="lp-step-desc">
                      Before pitching, send the business name + website + social links. Note weaknesses and possible
                      improvements. I confirm if it's worth pursuing.
                    </p>
                  </div>
                </div>
                <div className="lp-step">
                  <div className="lp-step-num">03</div>
                  <div>
                    <h3 className="lp-step-title">Outreach</h3>
                    <p className="lp-step-desc">
                      Introduce Visualize briefly and point out 1–2 clear improvement opportunities. The goal is to book
                      a strategy meeting.
                    </p>
                  </div>
                </div>
                <div className="lp-step">
                  <div className="lp-step-num">04</div>
                  <div>
                    <h3 className="lp-step-title">Qualification</h3>
                    <p className="lp-step-desc">
                      Confirm they are decision-makers, have budget, and are serious about improvement. No meetings with
                      unqualified prospects.
                    </p>
                  </div>
                </div>
                <div className="lp-step">
                  <div className="lp-step-num">05</div>
                  <div>
                    <h3 className="lp-step-title">Strategy Meeting</h3>
                    <p className="lp-step-desc">
                      I review needs, improvements, scope, and pricing. If they agree, an invoice is sent.
                    </p>
                  </div>
                </div>
                <div className="lp-step">
                  <div className="lp-step-num">06</div>
                  <div>
                    <h3 className="lp-step-title">Deposit = Success</h3>
                    <p className="lp-step-desc">
                      Once the 50% upfront payment is received, the project officially starts, the lead is considered
                      successful, and commission is earned on that paid invoice.
                    </p>
                  </div>
                </div>
              </div>
            </article>

            <article className="lp-principle">
              <h2 className="lp-h">Quality Over Quantity</h2>
              <p className="lp-p lp-p--muted">Commission is tied to real revenue, not activity.</p>
            </article>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="lp-calendly section" id="book-call">
        <div className="lp-calendly-bg" aria-hidden="true" />
        <div className="wrap lp-calendly-wrap">
          <div className="lp-calendly-head">
            <h2 className="lp-calendly-title">Interested in Becoming a Lead Partner?</h2>
            <p className="lp-calendly-sub">Book a call below.</p>
          </div>
          <div className="lp-calendly-panel">
            <div className="calendly-inline-widget" data-url={calendlyUrl} style={{ minWidth: '320px', height: '700px' }} />
          </div>
        </div>
      </section>

      <style>{`
        .lp-hero {
          position: relative;
          background: var(--bg);
          overflow: hidden;
        }
        .lp-hero-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, var(--bg) 0%, var(--bg-elevated) 100%);
          pointer-events: none;
        }
        .lp-hero-bg::after {
          content: '';
          position: absolute;
          top: -50%;
          right: -25%;
          width: 85%;
          height: 140%;
          background: radial-gradient(ellipse at center, rgba(212, 76, 67, 0.10) 0%, transparent 60%);
          pointer-events: none;
        }
        .lp-hero-wrap {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: var(--space-16);
          align-items: center;
        }
        @media (max-width: 900px) {
          .lp-hero-wrap { grid-template-columns: 1fr; text-align: center; }
          .lp-hero-btn { margin-left: auto; margin-right: auto; }
        }
        .lp-title {
          font-size: clamp(2rem, 5vw, 3.25rem);
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.1;
          color: var(--text);
          margin-bottom: var(--space-4);
        }
        .lp-subtitle {
          color: var(--text-secondary);
          font-size: clamp(1.125rem, 2vw, 1.25rem);
          line-height: 1.6;
          margin-bottom: var(--space-10);
          max-width: 54ch;
        }
        @media (max-width: 900px) { .lp-subtitle { margin-left: auto; margin-right: auto; } }
        .lp-hero-btn { width: fit-content; }

        .lp-hero-abstract {
          width: 100%;
          height: 300px;
          border-radius: var(--radius-lg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          background:
            radial-gradient(circle at 30% 30%, rgba(212, 76, 67, 0.18) 0%, transparent 55%),
            radial-gradient(circle at 70% 60%, rgba(212, 76, 67, 0.10) 0%, transparent 55%),
            linear-gradient(145deg, var(--glass-bg) 0%, var(--glass-bg-strong) 100%);
          border: 1px solid var(--glass-border);
          box-shadow: 0 24px 64px rgba(0,0,0,0.12);
        }

        .lp-content {
          position: relative;
          background: var(--bg-elevated);
          border-top: 1px solid var(--glass-border);
        }
        .lp-content-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(212, 76, 67, 0.05) 0%, transparent 55%);
          pointer-events: none;
        }
        .lp-content-wrap { position: relative; z-index: 1; }

        .lp-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: var(--space-8);
        }
        .lp-card, .lp-principle {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: var(--space-10);
          box-shadow: 0 12px 40px rgba(0,0,0,0.08);
        }
        .lp-h {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--text);
          margin-bottom: var(--space-4);
        }
        .lp-p {
          color: var(--text-secondary);
          line-height: 1.7;
          margin: 0 0 var(--space-6);
        }
        .lp-p--muted { color: var(--text-muted); margin: 0; }
        .lp-split {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-8);
        }
        @media (max-width: 900px) { .lp-split { grid-template-columns: 1fr; } }
        .lp-k {
          font-size: 0.8125rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--brand);
          margin: 0 0 var(--space-3);
        }
        .lp-list {
          list-style: none;
          padding: 0;
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.9;
        }
        .lp-list li { position: relative; padding-left: var(--space-4); }
        .lp-list li::before {
          content: '-';
          position: absolute;
          left: 0;
          color: var(--brand);
        }
        .lp-list--muted { color: var(--text-muted); }
        .lp-list--muted li::before { color: var(--border-light); }

        .lp-example {
          border: 1px solid var(--glass-border);
          border-radius: var(--radius);
          overflow: hidden;
          margin: var(--space-6) 0;
        }
        .lp-example-row, .lp-example-total {
          display: flex;
          justify-content: space-between;
          gap: var(--space-6);
          padding: var(--space-4) var(--space-5);
          color: var(--text-secondary);
          background: var(--bg);
          border-bottom: 1px solid var(--glass-border);
        }
        .lp-example-total {
          border-bottom: none;
          color: var(--text);
          font-weight: 700;
        }

        .lp-steps {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-6);
        }
        @media (max-width: 900px) { .lp-steps { grid-template-columns: 1fr; } }
        .lp-step {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: var(--space-4);
          padding: var(--space-6);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          background: var(--bg-elevated);
        }
        .lp-step-num {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(212, 76, 67, 0.12);
          border: 1px solid rgba(212, 76, 67, 0.35);
          color: var(--brand);
          font-weight: 800;
          font-size: 0.8125rem;
          letter-spacing: 0.02em;
        }
        .lp-step-title {
          font-size: 1rem;
          font-weight: 800;
          color: var(--text);
          margin: 0 0 var(--space-2);
        }
        .lp-step-desc {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.6;
          font-size: 0.9375rem;
        }

        .lp-calendly {
          position: relative;
          background: var(--bg);
          border-top: 1px solid var(--glass-border);
        }
        .lp-calendly-bg {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 90% 70% at 50% 0%, rgba(212, 76, 67, 0.08) 0%, transparent 60%);
          pointer-events: none;
        }
        .lp-calendly-wrap { position: relative; z-index: 1; }
        .lp-calendly-head {
          text-align: center;
          margin-bottom: var(--space-10);
        }
        .lp-calendly-title {
          font-size: clamp(1.75rem, 3.5vw, 2.25rem);
          font-weight: 800;
          color: var(--text);
          margin-bottom: var(--space-3);
        }
        .lp-calendly-sub { color: var(--text-secondary); margin: 0 0 var(--space-8); }
        .lp-calendly-panel {
          background: var(--glass-bg);
          backdrop-filter: blur(var(--glass-blur));
          -webkit-backdrop-filter: blur(var(--glass-blur));
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0,0,0,0.1);
        }
      `}</style>
    </>
  );
}
