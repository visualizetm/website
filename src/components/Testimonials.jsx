import MessageTextSquare01 from '@untitled-ui/icons-react/build/esm/MessageTextSquare01';
import Star01 from '@untitled-ui/icons-react/build/esm/Star01';

const quotes = [
  { text: 'Clear communication, strong design, and a smooth handoff. Everything felt organized from day one.',         author: 'Client', company: 'Local Business' },
  { text: 'The brand and website came together quickly, and the details were handled with care.',                       author: 'Client', company: 'Local Business' },
  { text: 'The final site looks professional, loads fast, and matches the brand perfectly.',                           author: 'Client', company: 'Local Business' },
];

export default function Testimonials() {
  return (
    <section className="testimonials section section-elevated">
      <div className="wrap">
        <h2 className="section-title reveal">What Clients Say</h2>
        <p className="section-subtitle reveal">Real feedback from real clients.</p>
        <div className="testimonials-grid stagger">
          {quotes.map((q, i) => (
            <blockquote key={i} className="testimonial-card">
              <div className="testimonial-stars">
                {[...Array(5)].map((_, si) => (
                  <Star01 key={si} width={13} height={13} fill="var(--brand)" />
                ))}
              </div>
              <MessageTextSquare01 width={28} height={28} className="testimonial-quote-icon" />
              <p className="testimonial-text">{q.text}</p>
              <footer className="testimonial-footer">
                <div className="testimonial-avatar">
                  {q.author.charAt(0)}
                </div>
                <div>
                  <cite className="testimonial-author">{q.author}</cite>
                  <span className="testimonial-company">{q.company}</span>
                </div>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
      <style>{`
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
      `}</style>
    </section>
  );
}
