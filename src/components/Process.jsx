import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import ClipboardCheck from '@untitled-ui/icons-react/build/esm/ClipboardCheck';
import Pencil01 from '@untitled-ui/icons-react/build/esm/Pencil01';
import Rocket01 from '@untitled-ui/icons-react/build/esm/Rocket01';

const steps = [
  { num: '01', title: 'Intro Call', desc: 'A short call to understand your business, your goals, and whether we fit.',           icon: Phone },
  { num: '02', title: 'Onboarding', desc: 'You fill out the project brief, we align on scope and timeline, and lock the plan.',  icon: ClipboardCheck },
  { num: '03', title: 'Build',      desc: 'I design and build. You review at set checkpoints and we refine until it is right.',  icon: Pencil01 },
  { num: '04', title: 'Delivery',   desc: 'Launch day: files, access, and next-step guidance handed over. You own everything.',  icon: Rocket01 },
];

export default function Process() {
  return (
    <section className="process section section-elevated">
      <div className="wrap">
        <h2 className="section-title reveal">How It Works</h2>
        <p className="section-subtitle reveal">The client journey, start to finish — no surprises.</p>
        <div className="process-timeline stagger">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.num} className="process-step">
                <div className="process-step-top">
                  <div className="process-icon">
                    <Icon width={20} height={20} />
                  </div>
                  <span className="process-num">{step.num}</span>
                </div>
                <h3 className="process-title">{step.title}</h3>
                <p className="process-desc">{step.desc}</p>
                {i < steps.length - 1 && (
                  <div className="process-connector" aria-hidden="true">
                    <div className="process-connector-line" />
                    <svg viewBox="0 0 8 8" fill="none" width="8" height="8">
                      <circle cx="4" cy="4" r="3" fill="var(--brand)" opacity="0.4" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
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
      `}</style>
    </section>
  );
}
