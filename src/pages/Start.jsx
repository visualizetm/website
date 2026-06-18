import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { IconCheck, IconCircleCheck, IconSend } from '@tabler/icons-react';

// Get your free access key at web3forms.com — enter visualizeserviceco@gmail.com
const ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_KEY || '';

const SECTIONS = [
  { num: 1, id: 'sec1', title: 'Your Business' },
  { num: 2, id: 'sec2', title: 'Project Scope' },
  { num: 3, id: 'sec3', title: 'Brand Direction' },
  { num: 4, id: 'sec4', title: 'What You Have' },
  { num: 5, id: 'sec5', title: 'Contact & Timeline' },
];

const EMPTY = {
  fullName: '', businessName: '', businessDesc: '',
  industry: '', location: '', timeInBusiness: '',
  servicesNeeded: [], whyNow: '', pagesNeeded: [],
  brandFeel: [], colorPrefs: '', brandsAdmired: '',
  idealCustomer: '', competitors: '',
  assetsHave: [], existingLinks: '', photosReady: '',
  email: '', phone: '', bestContact: '',
  timeline: '', budget: '', additionalInfo: '',
};

function Req() {
  return <span className="st-req" aria-label="required">*</span>;
}

function Field({ label, required, desc, error, id, children }) {
  return (
    <div className={`st-field${error ? ' st-field--err' : ''}`} id={id}>
      <p className="st-label">{label}{required && <Req />}</p>
      {desc && <p className="st-desc">{desc}</p>}
      {children}
      {error && <p className="st-err-msg">{error}</p>}
    </div>
  );
}

function Radio({ name, value, onChange, opts }) {
  return (
    <div className="st-radio-group" role="radiogroup">
      {opts.map(o => (
        <label key={o.v} className={`st-radio${value === o.v ? ' is-sel' : ''}`}>
          <input type="radio" name={name} value={o.v} checked={value === o.v} onChange={() => onChange(o.v)} />
          <span className="st-radio-dot" />
          <span className="st-radio-txt">{o.label}</span>
          {o.note && <span className="st-radio-note">{o.note}</span>}
        </label>
      ))}
    </div>
  );
}

function Checks({ value, onChange, opts, max, layout = 'stack' }) {
  const toggle = (v) => {
    if (value.includes(v)) return onChange(value.filter(x => x !== v));
    if (max != null && value.length >= max) return;
    onChange([...value, v]);
  };
  return (
    <div className={`st-checks st-checks--${layout}`}>
      {opts.map(o => {
        const sel = value.includes(o.v);
        const dis = !sel && max != null && value.length >= max;
        const isFeatured = layout === 'featured';
        return (
          <label key={o.v} className={`st-check${sel ? ' is-sel' : ''}${dis ? ' is-dis' : ''}${isFeatured ? ' st-check--feat' : ''}`}>
            <input type="checkbox" checked={sel} onChange={() => toggle(o.v)} disabled={dis} />
            {isFeatured ? (
              <>
                {o.icon && <span className="st-check-icon" aria-hidden="true">{o.icon}</span>}
                <span className="st-check-body">
                  <span className="st-check-lbl">{o.label}</span>
                  {o.desc && <span className="st-check-desc">{o.desc}</span>}
                </span>
                <span className="st-check-mark" aria-hidden="true">
                  {sel ? <IconCheck size={13} stroke={2.5} /> : null}
                </span>
              </>
            ) : (
              <>
                <span className="st-check-box">{sel && <IconCheck size={10} stroke={3} />}</span>
                <span className="st-check-body">
                  <span className="st-check-lbl">{o.label}</span>
                  {o.desc && <span className="st-check-desc">{o.desc}</span>}
                </span>
              </>
            )}
          </label>
        );
      })}
    </div>
  );
}

export default function Start() {
  const [f, setF]              = useState(EMPTY);
  const [errors, setErrors]    = useState({});
  const [submitting, setSub]   = useState(false);
  const [submitted, setDone]   = useState(false);
  const [activeSec, setActive] = useState(1);
  const [navH, setNavH]        = useState(76);
  const secRefs                = useRef([]);

  useEffect(() => {
    const nav = document.querySelector('.navbar');
    if (nav) setNavH(nav.getBoundingClientRect().height);
  }, []);

  useEffect(() => {
    if (submitted) return;
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(+e.target.dataset.sec); }),
      { rootMargin: '-25% 0px -65% 0px', threshold: 0 }
    );
    secRefs.current.forEach(el => el && obs.observe(el));
    return () => obs.disconnect();
  }, [submitted]);

  const set = (key, val) => {
    setF(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!f.fullName.trim())       e.fullName       = 'Required';
    if (!f.businessName.trim())   e.businessName   = 'Required';
    if (!f.businessDesc.trim())   e.businessDesc   = 'Required';
    if (!f.industry)              e.industry       = 'Select an industry';
    if (!f.location.trim())       e.location       = 'Required';
    if (!f.timeInBusiness)        e.timeInBusiness = 'Select one';
    if (!f.servicesNeeded.length) e.servicesNeeded = 'Select at least one';
    if (!f.whyNow.trim())         e.whyNow         = 'Required';
    if (!f.brandFeel.length)      e.brandFeel      = 'Select at least one feeling';
    if (!f.brandsAdmired.trim())  e.brandsAdmired  = 'Required';
    if (!f.idealCustomer.trim())  e.idealCustomer  = 'Required';
    if (!f.assetsHave.length)     e.assetsHave     = 'Select at least one';
    if (!f.photosReady)           e.photosReady    = 'Select one';
    if (!f.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Valid email required';
    if (!f.bestContact)           e.bestContact    = 'Select one';
    if (!f.timeline)              e.timeline       = 'Select one';
    if (!f.budget)                e.budget         = 'Select one';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`f-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSub(true);
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: `New Project Brief — ${f.fullName} / ${f.businessName}`,
          from_name: f.fullName,
          email: f.email,
          'Full Name': f.fullName,
          'Business Name': f.businessName,
          'Business Description': f.businessDesc,
          'Industry': f.industry,
          'Location': f.location,
          'Time in Business': f.timeInBusiness,
          'Services Needed': f.servicesNeeded.join(', '),
          'Why Now': f.whyNow,
          'Website Pages': f.pagesNeeded.length ? f.pagesNeeded.join(', ') : '—',
          'Brand Feel': f.brandFeel.join(', '),
          'Color Preferences': f.colorPrefs || '—',
          'Brands Admired': f.brandsAdmired,
          'Ideal Customer': f.idealCustomer,
          'Competitors': f.competitors || '—',
          'Current Assets': f.assetsHave.join(', '),
          'Existing Links': f.existingLinks || '—',
          'Photos Ready': f.photosReady,
          'Phone': f.phone || '—',
          'Best Contact': f.bestContact,
          'Timeline': f.timeline,
          'Budget': f.budget,
          'Additional Info': f.additionalInfo || '—',
        }),
      });
      const data = await res.json();
      if (data.success) { setDone(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else throw new Error();
    } catch {
      setErrors(prev => ({ ...prev, _submit: 'Something went wrong. Email us directly at visualizeserviceco@gmail.com.' }));
    } finally {
      setSub(false);
    }
  };

  /* ── Success ── */
  if (submitted) {
    return (
      <div className="st-success-page section">
        <div className="st-success-inner">
          <div className="st-success-icon"><IconCircleCheck size={60} stroke={1.4} /></div>
          <h1 className="st-success-title">We got it.</h1>
          <p className="st-success-body">Rob will reach out within 24 hours to schedule your kickoff call.</p>
          <p className="st-success-sub">Check your inbox — a confirmation may be on its way to {f.email}.</p>
          <Link to="/" className="btn btn-primary st-success-btn">Back to Home</Link>
        </div>
        <style>{startStyles}</style>
      </div>
    );
  }

  /* ── Form ── */
  return (
    <>
      {/* Sticky progress bar */}
      <div className="st-progress" style={{ top: navH }}>
        <div className="st-prog-inner wrap">
          <div className="st-prog-track" aria-hidden="true">
            <div className="st-prog-track-fill" style={{ width: `${((activeSec - 1) / (SECTIONS.length - 1)) * 100}%` }} />
          </div>
          {SECTIONS.map(s => (
            <button
              key={s.num}
              type="button"
              className={`st-prog-step${activeSec === s.num ? ' is-active' : ''}${activeSec > s.num ? ' is-done' : ''}`}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              <span className="st-prog-num">
                {activeSec > s.num ? <IconCheck size={11} stroke={3} /> : s.num}
              </span>
              <span className="st-prog-lbl">{s.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="st-hero">
        <div className="wrap st-hero-inner">
          <div className="st-hero-eyebrow"><span className="st-hero-dot" />New Project Brief</div>
          <h1 className="st-hero-title">Let's build something you're proud of.</h1>
          <p className="st-hero-sub">
            Fill this out before your first call. Takes about 10 minutes.
            The more detail you give, the faster we can move.
          </p>
        </div>
      </section>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="st-form-shell">
        <div className="wrap st-form-wrap">

          {/* Section 1 */}
          <div className="st-section" id="sec1" data-sec="1" ref={el => { secRefs.current[0] = el; }}>
            <div className="st-sec-head">
              <span className="st-sec-badge">01</span>
              <div>
                <h2 className="st-sec-title">Your Business</h2>
                <p className="st-sec-desc">Tell us who you are and what you do.</p>
              </div>
            </div>
            <div className="st-fields">
              <div className="st-row2">
                <Field label="Full Name" required id="f-fullName" error={errors.fullName}>
                  <input className="st-input" type="text" placeholder="e.g. Carlos Mendez"
                    value={f.fullName} onChange={e => set('fullName', e.target.value)} autoComplete="name" />
                </Field>
                <Field label="Business Name" required id="f-businessName" error={errors.businessName}>
                  <input className="st-input" type="text" placeholder="e.g. Sopes Detailing"
                    value={f.businessName} onChange={e => set('businessName', e.target.value)} />
                </Field>
              </div>
              <Field label="What does your business do and who do you serve?" required
                desc="Describe what you do and who your customers are. Write it how you'd explain it at a networking event."
                id="f-businessDesc" error={errors.businessDesc}>
                <textarea className="st-textarea" rows={4}
                  placeholder="e.g. I run a mobile auto detailing service in Wilmington, DE. I serve car enthusiasts who want showroom results without going to a shop."
                  value={f.businessDesc} onChange={e => set('businessDesc', e.target.value)} />
              </Field>
              <div className="st-row2">
                <Field label="Industry" required id="f-industry" error={errors.industry}>
                  <select className="st-select" value={f.industry} onChange={e => set('industry', e.target.value)}>
                    <option value="">Select an industry…</option>
                    {['Food & Beverage','Health & Wellness','Automotive','Beauty & Personal Care',
                      'Home Services / Trades','Photography / Creative','Real Estate',
                      'Retail / E-commerce','Professional Services','Other'].map(i => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Where are you based?" required id="f-location" error={errors.location}>
                  <input className="st-input" type="text" placeholder="e.g. Wilmington, DE"
                    value={f.location} onChange={e => set('location', e.target.value)} />
                </Field>
              </div>
              <Field label="How long have you been in business?" required id="f-timeInBusiness" error={errors.timeInBusiness}>
                <Radio name="timeInBusiness" value={f.timeInBusiness} onChange={v => set('timeInBusiness', v)}
                  opts={[
                    { v: 'Just starting out', label: 'Just starting out' },
                    { v: 'Less than 1 year',  label: 'Less than 1 year' },
                    { v: '1–3 years',         label: '1–3 years' },
                    { v: '3+ years',          label: '3+ years' },
                  ]} />
              </Field>
            </div>
          </div>

          {/* Section 2 */}
          <div className="st-section" id="sec2" data-sec="2" ref={el => { secRefs.current[1] = el; }}>
            <div className="st-sec-head">
              <span className="st-sec-badge">02</span>
              <div>
                <h2 className="st-sec-title">Project Scope</h2>
                <p className="st-sec-desc">What are you building or improving?</p>
              </div>
            </div>
            <div className="st-fields">
              <Field label="What do you need?" required desc="Select all that apply."
                id="f-servicesNeeded" error={errors.servicesNeeded}>
                <Checks value={f.servicesNeeded} onChange={v => set('servicesNeeded', v)} layout="featured"
                  opts={[
                    { v: 'Logo Design',                  icon: '🎨', label: 'Logo Design',                  desc: 'A professional logo built for your brand' },
                    { v: 'Full Brand Identity',          icon: '💎', label: 'Full Brand Identity',          desc: 'Logo + colors + typography + brand guidelines' },
                    { v: 'Website Design & Development', icon: '🌐', label: 'Website Design & Development', desc: 'A custom site built and launched' },
                    { v: 'Google Business Setup',        icon: '📍', label: 'Google Business Setup',        desc: 'Claimed, optimized, ready to rank locally' },
                    { v: 'Business Cards',               icon: '🪪', label: 'Business Cards',               desc: 'Design and/or printing' },
                    { v: 'Custom Stickers / Vinyl',      icon: '✂️', label: 'Custom Stickers / Vinyl',      desc: 'Die-cut stickers, window vinyl, handle stickers' },
                    { v: 'Not sure — I need advice',     icon: '💡', label: 'Not sure — I need advice',     desc: 'Help me figure out where to start' },
                  ]} />
              </Field>
              <Field label="Why now? What's pushing you to invest in your brand?" required
                desc="This helps us understand what problem we're actually solving."
                id="f-whyNow" error={errors.whyNow}>
                <textarea className="st-textarea" rows={4}
                  placeholder="e.g. I've been running off my personal Instagram for 8 months and keep losing clients to competitors who look more established."
                  value={f.whyNow} onChange={e => set('whyNow', e.target.value)} />
              </Field>
              <Field label="If you need a website, what pages do you think you need?"
                desc="Optional — check all that apply. Skip if no website needed." id="f-pagesNeeded">
                <Checks value={f.pagesNeeded} onChange={v => set('pagesNeeded', v)} layout="grid"
                  opts={[
                    { v: 'Home / Landing Page',  label: 'Home / Landing Page' },
                    { v: 'About / Our Story',    label: 'About / Our Story' },
                    { v: 'Services / Menu',      label: 'Services / Menu' },
                    { v: 'Portfolio / Gallery',  label: 'Portfolio / Gallery' },
                    { v: 'Contact / Book Now',   label: 'Contact / Book Now' },
                    { v: 'Online Store',         label: 'Online Store' },
                    { v: 'Booking / Scheduling', label: 'Booking / Scheduling' },
                    { v: 'Blog',                 label: 'Blog' },
                    { v: 'Not sure',             label: 'Not sure' },
                  ]} />
              </Field>
            </div>
          </div>

          {/* Section 3 */}
          <div className="st-section" id="sec3" data-sec="3" ref={el => { secRefs.current[2] = el; }}>
            <div className="st-sec-head">
              <span className="st-sec-badge">03</span>
              <div>
                <h2 className="st-sec-title">Brand Direction</h2>
                <p className="st-sec-desc">Your visual identity and who you're speaking to.</p>
              </div>
            </div>
            <div className="st-fields">
              <Field label="How do you want people to feel when they see your brand?" required
                desc="Pick up to 5." id="f-brandFeel" error={errors.brandFeel}>
                <Checks value={f.brandFeel} onChange={v => set('brandFeel', v)} layout="pills" max={5}
                  opts={['Trustworthy','Bold & Confident','Luxurious','Friendly & Approachable',
                    'Clean & Minimal','Energetic & Exciting','Professional & Polished',
                    'Raw & Authentic','Playful & Fun','Edgy & Streetwear',
                    'Warm & Inviting','Premium & Exclusive'].map(v => ({ v, label: v }))} />
              </Field>
              <Field label="Color preferences? Anything you absolutely don't want?"
                desc="No need for hex codes. Just tell us what you're drawn to." id="f-colorPrefs">
                <textarea className="st-textarea" rows={3}
                  placeholder="e.g. I like dark colors — black, navy. No bright or neon. If there's an accent it should feel premium, like gold or white."
                  value={f.colorPrefs} onChange={e => set('colorPrefs', e.target.value)} />
              </Field>
              <Field label="Name 1–3 brands whose look you admire and what you like about them." required
                desc="Doesn't have to be your industry. Just visual styles you respect."
                id="f-brandsAdmired" error={errors.brandsAdmired}>
                <textarea className="st-textarea" rows={3}
                  placeholder="e.g. I like how Supreme keeps it clean and minimal but feels exclusive. And Lamborghini — all black, serious without trying too hard."
                  value={f.brandsAdmired} onChange={e => set('brandsAdmired', e.target.value)} />
              </Field>
              <Field label="Who is your ideal customer? Describe them like a real person." required
                desc="Age, lifestyle, how they find businesses like yours. Specific beats vague — it shapes every design decision."
                id="f-idealCustomer" error={errors.idealCustomer}>
                <textarea className="st-textarea" rows={4}
                  placeholder="e.g. Guy in his late 20s to 40s who takes pride in his car, works, has disposable income, follows car culture on Instagram."
                  value={f.idealCustomer} onChange={e => set('idealCustomer', e.target.value)} />
              </Field>
              <Field label="Who are your main competitors and what do you do better?"
                desc="Optional." id="f-competitors">
                <textarea className="st-textarea" rows={3}
                  placeholder="e.g. DetailPros and CleanRide in Wilmington. They both require you to come to them. I go to the customer — no shop needed."
                  value={f.competitors} onChange={e => set('competitors', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Section 4 */}
          <div className="st-section" id="sec4" data-sec="4" ref={el => { secRefs.current[3] = el; }}>
            <div className="st-sec-head">
              <span className="st-sec-badge">04</span>
              <div>
                <h2 className="st-sec-title">What You Already Have</h2>
                <p className="st-sec-desc">We'll work with what exists and fill in the gaps.</p>
              </div>
            </div>
            <div className="st-fields">
              <Field label="What do you currently have?" required desc="Check everything that applies."
                id="f-assetsHave" error={errors.assetsHave}>
                <Checks value={f.assetsHave} onChange={v => set('assetsHave', v)} layout="stack"
                  opts={[
                    { v: 'A logo',                       label: 'A logo',                       desc: "Even if you're not happy with it" },
                    { v: 'Brand colors or fonts',        label: 'Brand colors or fonts',        desc: 'Colors or fonts you use consistently' },
                    { v: 'An existing website',          label: 'An existing website',          desc: 'Add URL in links below' },
                    { v: 'Active social media profiles', label: 'Active social media profiles' },
                    { v: 'Professional photos',          label: 'Professional photos',          desc: 'Of your work or team' },
                    { v: 'Written content',              label: 'Written content',              desc: 'Service descriptions, about us, pricing' },
                    { v: 'A domain name',                label: 'A domain name',                desc: 'Even with no site on it' },
                    { v: 'Google Business profile',      label: 'Google Business profile',      desc: 'Claimed' },
                    { v: 'None — starting from zero',    label: 'None — starting from zero' },
                  ]} />
              </Field>
              <Field label="Drop any relevant links"
                desc="Website, Instagram, Facebook, Google listing — anything that shows what your business looks like right now."
                id="f-existingLinks">
                <textarea className="st-textarea" rows={3}
                  placeholder="e.g. Instagram: @sopesdetailing · Google: https://maps.app.goo.gl/xxx"
                  value={f.existingLinks} onChange={e => set('existingLinks', e.target.value)} />
              </Field>
              <Field label="Do you have photos ready to use?" required id="f-photosReady" error={errors.photosReady}>
                <Radio name="photosReady" value={f.photosReady} onChange={v => set('photosReady', v)}
                  opts={[
                    { v: 'Yes — high quality photos ready to go',           label: 'Yes — high quality photos ready to go' },
                    { v: 'Kind of — some but inconsistent or phone photos', label: 'Kind of — some but inconsistent or phone photos' },
                    { v: "No — I'll need to gather or take photos",         label: "No — I'll need to gather or take photos during the project" },
                    { v: 'No — stock photos or illustrations preferred',    label: "No — I'd prefer stock photos or illustrations" },
                  ]} />
              </Field>
            </div>
          </div>

          {/* Section 5 */}
          <div className="st-section" id="sec5" data-sec="5" ref={el => { secRefs.current[4] = el; }}>
            <div className="st-sec-head">
              <span className="st-sec-badge">05</span>
              <div>
                <h2 className="st-sec-title">Contact & Timeline</h2>
                <p className="st-sec-desc">How to reach you and when you need this done.</p>
              </div>
            </div>
            <div className="st-fields">
              <div className="st-row2">
                <Field label="Email Address" required id="f-email" error={errors.email}>
                  <input className="st-input" type="email" placeholder="e.g. carlos@sopesdetailing.com"
                    value={f.email} onChange={e => set('email', e.target.value)} autoComplete="email" />
                </Field>
                <Field label="Phone Number" desc="Text is fine. Include if you prefer it over email." id="f-phone">
                  <input className="st-input" type="tel" placeholder="e.g. (302) 555-0123"
                    value={f.phone} onChange={e => set('phone', e.target.value)} autoComplete="tel" />
                </Field>
              </div>
              <Field label="Best way to reach you?" required id="f-bestContact" error={errors.bestContact}>
                <Radio name="bestContact" value={f.bestContact} onChange={v => set('bestContact', v)}
                  opts={[
                    { v: 'Email',        label: 'Email' },
                    { v: 'Text',         label: 'Text' },
                    { v: 'Instagram DM', label: 'Instagram DM' },
                    { v: 'Phone Call',   label: 'Phone Call' },
                  ]} />
              </Field>
              <Field label="When do you need this completed?" required id="f-timeline" error={errors.timeline}>
                <Radio name="timeline" value={f.timeline} onChange={v => set('timeline', v)}
                  opts={[
                    { v: 'ASAP — within 1 week',       label: 'ASAP — within 1 week',       note: 'Rush fees may apply' },
                    { v: 'Within 2–3 weeks',            label: 'Within 2–3 weeks' },
                    { v: 'Within 1 month',              label: 'Within 1 month' },
                    { v: '1–3 months — planning ahead', label: '1–3 months — planning ahead' },
                    { v: 'I have a specific date',      label: 'I have a specific date',      note: 'Add details below' },
                    { v: 'No rush',                     label: 'No rush' },
                  ]} />
              </Field>
              <Field label="Budget range" required id="f-budget" error={errors.budget}>
                <Radio name="budget" value={f.budget} onChange={v => set('budget', v)}
                  opts={[
                    { v: 'Under $300',    label: 'Under $300',    note: 'Something specific and small' },
                    { v: '$300–$600',     label: '$300–$600',     note: 'Starter brand or basic website' },
                    { v: '$600–$1,000',   label: '$600–$1,000',   note: 'Full brand or full website' },
                    { v: '$1,000–$2,000', label: '$1,000–$2,000', note: 'Brand + website together' },
                    { v: '$2,000+',       label: '$2,000+',       note: 'Full package with everything' },
                    { v: 'Not sure — need to see costs first', label: 'Not sure — I need to see what things cost first' },
                  ]} />
              </Field>
              <Field label="Anything else we should know?"
                desc="Specific requirements, concerns, past experiences with designers, or anything that would help us serve you better from day one."
                id="f-additionalInfo">
                <textarea className="st-textarea" rows={4}
                  placeholder="e.g. I worked with a designer before who ghosted me after I paid a deposit. I have a big event coming up in 6 weeks."
                  value={f.additionalInfo} onChange={e => set('additionalInfo', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Submit */}
          <div className="st-submit-row">
            {errors._submit && <p className="st-err-msg">{errors._submit}</p>}
            <button type="submit" className="btn btn-primary st-submit-btn" disabled={submitting}>
              {submitting
                ? <span className="st-spinner" aria-label="Submitting…" />
                : <><IconSend size={17} stroke={1.8} />Submit Your Brief</>}
            </button>
            <p className="st-submit-note">Rob will reach out within 24 hours to schedule your kickoff call.</p>
          </div>

        </div>
      </form>
      <style>{startStyles}</style>
    </>
  );
}

const startStyles = `
  /* ── Progress bar ─────────────────────────── */
  .st-progress {
    position: sticky; z-index: 100;
    background: rgba(255,255,255,0.97);
    backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
    border-bottom: 1px solid rgba(0,0,0,0.07);
    padding: 18px 0 14px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.055);
  }
  .st-prog-inner {
    display: flex; align-items: flex-start;
    justify-content: space-between;
    position: relative; overflow-x: auto; scrollbar-width: none;
  }
  .st-prog-inner::-webkit-scrollbar { display: none; }
  .st-prog-track {
    position: absolute; left: 12px; right: 12px; top: 12px;
    height: 2px; background: #e5e5e5; border-radius: 2px;
    pointer-events: none;
  }
  .st-prog-track-fill {
    height: 100%; background: var(--brand); border-radius: 2px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .st-prog-step {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    flex: 1; min-width: 48px; padding: 0 6px;
    border: none; background: none; cursor: pointer;
    position: relative; z-index: 1; font-family: inherit;
    transition: opacity 0.2s;
  }
  .st-prog-step:hover { opacity: 0.8; }
  .st-prog-num {
    width: 26px; height: 26px; border-radius: 50%;
    background: #fff; border: 2px solid #e0e0e0;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.7rem; font-weight: 800; color: #bbb;
    flex-shrink: 0; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 0 0 transparent;
  }
  .st-prog-step.is-active .st-prog-num {
    background: var(--brand); border-color: var(--brand); color: #fff;
    box-shadow: 0 0 0 5px rgba(212,76,67,0.14);
    transform: scale(1.08);
  }
  .st-prog-step.is-done .st-prog-num {
    background: #16a34a; border-color: #16a34a; color: #fff;
  }
  .st-prog-lbl {
    font-size: 0.675rem; font-weight: 600; letter-spacing: 0.025em;
    color: #c0c0c0; white-space: nowrap; transition: color 0.2s;
    text-align: center;
  }
  .st-prog-step.is-active .st-prog-lbl { color: var(--brand); }
  .st-prog-step.is-done .st-prog-lbl { color: #16a34a; }
  @media (max-width: 480px) {
    .st-prog-step { min-width: 40px; }
    .st-prog-lbl { display: none; }
    .st-progress { padding: 14px 0; }
  }

  /* ── Hero ─────────────────────────────────── */
  .st-hero {
    background: linear-gradient(160deg, #fff 0%, #f9f5f4 100%);
    border-bottom: 1px solid rgba(0,0,0,0.07);
    padding: var(--space-16) 0 var(--space-14);
    position: relative; overflow: hidden;
  }
  .st-hero::before {
    content: ''; position: absolute;
    top: -60px; right: -40px;
    width: 420px; height: 420px; border-radius: 50%;
    background: radial-gradient(circle, rgba(212,76,67,0.055) 0%, transparent 70%);
    pointer-events: none;
  }
  .st-hero-inner { max-width: 680px; position: relative; }
  .st-hero-eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    font-size: 0.7rem; font-weight: 800; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--brand);
    background: rgba(212,76,67,0.07); border: 1px solid rgba(212,76,67,0.18);
    padding: 5px 12px; border-radius: 999px; margin-bottom: var(--space-5);
  }
  .st-hero-dot {
    width: 5px; height: 5px; border-radius: 50%; background: var(--brand);
    box-shadow: 0 0 8px rgba(212,76,67,0.7); flex-shrink: 0;
  }
  .st-hero-title {
    font-size: clamp(2rem, 4.5vw, 3.1rem); font-weight: 900;
    letter-spacing: -0.035em; line-height: 1.08; color: var(--text);
    margin-bottom: var(--space-5);
  }
  .st-hero-sub {
    font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.72;
    max-width: 500px;
  }

  /* ── Form shell + sections ────────────────── */
  .st-form-shell {
    background: #f4f4f6;
    padding: var(--space-10) 0 var(--space-24);
  }
  .st-form-wrap { display: flex; flex-direction: column; gap: var(--space-4); max-width: 820px; }
  .st-section {
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 16px; overflow: hidden;
    box-shadow: 0 2px 16px rgba(0,0,0,0.055), 0 1px 3px rgba(0,0,0,0.04);
    scroll-margin-top: 140px;
    transition: box-shadow 0.2s;
  }
  .st-section:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04); }
  .st-sec-head {
    display: flex; align-items: center; gap: var(--space-4);
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid rgba(0,0,0,0.06);
    background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
    border-left: 4px solid var(--brand);
  }
  .st-sec-badge {
    font-size: 0.625rem; font-weight: 900; letter-spacing: 0.12em;
    color: var(--brand); background: rgba(212,76,67,0.1);
    border: 1px solid rgba(212,76,67,0.22);
    border-radius: 6px; padding: 3px 8px; flex-shrink: 0;
  }
  .st-sec-title { font-size: 1.125rem; font-weight: 800; letter-spacing: -0.025em; color: var(--text); margin-bottom: 2px; }
  .st-sec-desc { font-size: 0.84rem; color: var(--text-secondary); }
  .st-fields { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-6); }

  /* ── Field wrapper ────────────────────────── */
  .st-field { display: flex; flex-direction: column; gap: 6px; }
  .st-field--err .st-input,
  .st-field--err .st-textarea,
  .st-field--err .st-select { border-color: rgba(212,76,67,0.5) !important; box-shadow: 0 0 0 3px rgba(212,76,67,0.08); }
  .st-label { font-size: 0.9375rem; font-weight: 700; color: var(--text); line-height: 1.4; }
  .st-req { color: var(--brand); margin-left: 2px; }
  .st-desc { font-size: 0.84rem; color: var(--text-secondary); line-height: 1.6; }
  .st-err-msg { font-size: 0.78rem; color: var(--brand); font-weight: 700; }

  /* ── Inputs ───────────────────────────────── */
  .st-input, .st-textarea, .st-select {
    width: 100%; padding: 12px 15px;
    border: 1.5px solid rgba(0,0,0,0.13); border-radius: 10px;
    background: #fafafa; color: var(--text);
    font-family: inherit; font-size: 0.9375rem; line-height: 1.5;
    outline: none; transition: border-color 0.18s, box-shadow 0.18s, background 0.18s;
  }
  .st-input:focus, .st-textarea:focus, .st-select:focus {
    border-color: var(--brand); background: #fff;
    box-shadow: 0 0 0 3.5px rgba(212,76,67,0.1);
  }
  .st-textarea { resize: vertical; min-height: 100px; }
  .st-select {
    appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%238a8a8a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center;
    padding-right: 38px; background-color: #fafafa;
  }
  .st-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
  @media (max-width: 580px) { .st-row2 { grid-template-columns: 1fr; } }

  /* ── Radio ────────────────────────────────── */
  .st-radio-group { display: flex; flex-direction: column; gap: 8px; }
  .st-radio {
    display: flex; align-items: center; gap: 12px;
    padding: 13px 16px; border: 1.5px solid rgba(0,0,0,0.1);
    border-radius: 10px; cursor: pointer;
    background: #fafafa; transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
    user-select: none;
  }
  .st-radio:hover { border-color: rgba(212,76,67,0.35); background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .st-radio.is-sel {
    border-color: var(--brand); background: rgba(212,76,67,0.04);
    box-shadow: 0 0 0 3px rgba(212,76,67,0.09);
  }
  .st-radio input { display: none; }
  .st-radio-dot {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid #d0d0d0; flex-shrink: 0;
    position: relative; transition: border-color 0.18s;
    background: #fff;
  }
  .st-radio.is-sel .st-radio-dot { border-color: var(--brand); border-width: 2px; }
  .st-radio.is-sel .st-radio-dot::after {
    content: ''; position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 9px; height: 9px; border-radius: 50%; background: var(--brand);
  }
  .st-radio-txt { font-size: 0.9375rem; font-weight: 500; color: var(--text); flex: 1; line-height: 1.4; }
  .st-radio.is-sel .st-radio-txt { font-weight: 600; color: var(--text); }
  .st-radio-note {
    font-size: 0.7rem; font-weight: 600; color: var(--text-muted); letter-spacing: 0.02em;
    padding: 3px 9px; background: rgba(0,0,0,0.05); border-radius: 999px; flex-shrink: 0;
  }

  /* ── Checkboxes (stack / grid / pills) ───── */
  .st-checks--stack { display: flex; flex-direction: column; gap: 8px; }
  .st-checks--grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 560px) { .st-checks--grid { grid-template-columns: 1fr; } }
  .st-checks--pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .st-checks--pills .st-check { padding: 8px 16px; border-radius: 999px; align-items: center; gap: 7px; }
  .st-checks--pills .st-check-desc { display: none; }
  .st-checks--pills .st-check-box { width: 14px; height: 14px; border-radius: 50%; margin-top: 0; }
  .st-checks--pills .st-check-lbl { font-size: 0.875rem; }
  .st-check {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 13px 15px; border: 1.5px solid rgba(0,0,0,0.1);
    border-radius: 10px; cursor: pointer;
    background: #fafafa; transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
    user-select: none;
  }
  .st-check:hover { border-color: rgba(212,76,67,0.35); background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .st-check.is-sel {
    border-color: var(--brand); background: rgba(212,76,67,0.04);
    box-shadow: 0 0 0 3px rgba(212,76,67,0.09);
  }
  .st-check.is-dis { opacity: 0.35; cursor: not-allowed; }
  .st-check input { display: none; }
  .st-check-box {
    width: 20px; height: 20px; border-radius: 5px;
    border: 2px solid #d0d0d0; flex-shrink: 0; margin-top: 1px;
    display: flex; align-items: center; justify-content: center;
    color: #fff; transition: background 0.18s, border-color 0.18s;
    background: #fff;
  }
  .st-check.is-sel .st-check-box { background: var(--brand); border-color: var(--brand); }
  .st-check-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .st-check-lbl { font-size: 0.9375rem; font-weight: 600; color: var(--text); line-height: 1.3; }
  .st-check.is-sel .st-check-lbl { color: var(--text); }
  .st-check-desc { font-size: 0.8125rem; color: var(--text-secondary); line-height: 1.45; }

  /* ── Featured checkboxes (service cards) ─── */
  .st-checks--featured { display: flex; flex-direction: column; gap: 8px; }
  .st-check--feat {
    align-items: center; padding: 15px 18px;
    border-radius: 12px; background: #fafafa;
    gap: 14px;
  }
  .st-check--feat:hover { background: #fff; box-shadow: 0 3px 12px rgba(0,0,0,0.08); }
  .st-check--feat.is-sel {
    background: rgba(212,76,67,0.03);
    border-color: var(--brand);
    box-shadow: 0 0 0 3px rgba(212,76,67,0.09), 0 2px 12px rgba(212,76,67,0.07);
  }
  .st-check-icon {
    font-size: 1.375rem; flex-shrink: 0; width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.04); border-radius: 9px;
    transition: background 0.18s;
  }
  .st-check--feat.is-sel .st-check-icon { background: rgba(212,76,67,0.08); }
  .st-check-mark {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid #d8d8d8; background: #fff;
    display: flex; align-items: center; justify-content: center;
    color: #fff; transition: all 0.18s;
    margin-left: auto;
  }
  .st-check--feat.is-sel .st-check-mark {
    background: var(--brand); border-color: var(--brand);
  }

  /* ── Submit row ───────────────────────────── */
  .st-submit-row {
    display: flex; flex-direction: column; align-items: flex-start;
    gap: var(--space-4); padding: var(--space-6) 0 var(--space-8);
  }
  .st-submit-btn {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 15px 40px; font-size: 1.0625rem; font-weight: 700;
    min-width: 240px; justify-content: center;
    border-radius: 12px; letter-spacing: -0.01em;
    box-shadow: 0 4px 20px rgba(212,76,67,0.3);
    transition: box-shadow 0.2s, transform 0.15s;
  }
  .st-submit-btn:hover { box-shadow: 0 6px 28px rgba(212,76,67,0.38); }
  .st-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none !important; box-shadow: none; }
  .st-submit-note { font-size: 0.84rem; color: var(--text-muted); line-height: 1.5; }
  .st-spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
    animation: stSpin 0.65s linear infinite; display: inline-block;
  }
  @keyframes stSpin { to { transform: rotate(360deg); } }

  /* ── Success ──────────────────────────────── */
  .st-success-page {
    display: flex; align-items: center; justify-content: center;
    min-height: 70vh; text-align: center;
    background: linear-gradient(180deg, #fff 0%, #f5f5f5 100%);
  }
  .st-success-inner {
    display: flex; flex-direction: column; align-items: center;
    gap: var(--space-5); max-width: 480px;
    padding: var(--space-12) var(--space-8);
  }
  .st-success-icon {
    width: 80px; height: 80px; border-radius: 50%;
    background: rgba(34,197,94,0.1); border: 2px solid rgba(34,197,94,0.25);
    display: flex; align-items: center; justify-content: center;
    color: #22c55e;
  }
  .st-success-title {
    font-size: clamp(2rem, 5vw, 2.8rem); font-weight: 900;
    letter-spacing: -0.04em; color: var(--text);
  }
  .st-success-body { font-size: 1.125rem; color: var(--text-secondary); line-height: 1.65; }
  .st-success-sub { font-size: 0.875rem; color: var(--text-muted); }
  .st-success-btn {
    padding: 14px 36px; margin-top: var(--space-2);
    border-radius: 10px; font-size: 1rem;
  }
`;
