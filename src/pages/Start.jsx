import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import CheckCircle from '@untitled-ui/icons-react/build/esm/CheckCircle';
import Send01 from '@untitled-ui/icons-react/build/esm/Send01';
import PenTool01 from '@untitled-ui/icons-react/build/esm/PenTool01';
import Palette from '@untitled-ui/icons-react/build/esm/Palette';
import Globe01 from '@untitled-ui/icons-react/build/esm/Globe01';
import MarkerPin01 from '@untitled-ui/icons-react/build/esm/MarkerPin01';
import CreditCard02 from '@untitled-ui/icons-react/build/esm/CreditCard02';
import Scissors01 from '@untitled-ui/icons-react/build/esm/Scissors01';
import Lightbulb01 from '@untitled-ui/icons-react/build/esm/Lightbulb01';
import LayersTwo01 from '@untitled-ui/icons-react/build/esm/LayersTwo01';
import Wordmark from '../components/Wordmark';

const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_KEY || '';

/* ─── Data ──────────────────────────────────────────────────────── */

const EMPTY = {
  projectType: '',
  fullName: '', businessName: '', businessDesc: '',
  industry: '', location: '', timeInBusiness: '',
  servicesNeeded: [], whyNow: '', pagesNeeded: [],
  brandFeel: [], colorPrefs: '', brandsAdmired: '',
  idealCustomer: '', competitors: '',
  assetsHave: [], existingLinks: '', photosReady: '',
  email: '', phone: '', bestContact: '',
  timeline: '', budget: '', additionalInfo: '',
};

const SERVICE_OPTS = [
  { v: 'Logo Design',                  icon: PenTool01,    desc: 'A professional logo built for your brand' },
  { v: 'Full Brand Identity',          icon: Palette,      desc: 'Logo + colors + typography + brand guidelines' },
  { v: 'Website Design & Development', icon: Globe01,      desc: 'A custom site built and launched' },
  { v: 'Google Business Setup',        icon: MarkerPin01,  desc: 'Claimed, optimized, ready to rank locally' },
  { v: 'Business Cards',               icon: CreditCard02, desc: 'Design and/or printing' },
  { v: 'Custom Stickers / Vinyl',      icon: Scissors01,   desc: 'Die-cut stickers, window vinyl, handle stickers' },
  { v: 'Not sure — I need advice',     icon: Lightbulb01,  desc: 'Help me figure out where to start' },
];

const PROJECT_TYPES = [
  { v: 'Brand',   icon: Palette,     desc: 'Logo, identity, and brand systems' },
  { v: 'Website', icon: Globe01,     desc: 'A site that turns visitors into customers' },
  { v: 'Both',    icon: LayersTwo01, desc: 'Brand and website, built together' },
  { v: 'Other',   icon: Lightbulb01, desc: 'Print, bulk products, or something else' },
];

const STEPS = [
  { id: 'type',      title: 'What are we building?', sub: 'This routes your brief to the right process.' },
  { id: 'business',  title: 'Your Business',         sub: 'Tell us who you are and what you do.' },
  { id: 'scope',     title: 'Project Scope',         sub: 'What are you building or improving?' },
  { id: 'direction', title: 'Brand Direction',       sub: "Your visual identity and who you're speaking to." },
  { id: 'assets',    title: 'What You Already Have', sub: "We'll work with what exists and fill in the gaps." },
  { id: 'contact',   title: 'Contact & Timeline',    sub: 'How to reach you and when you need this done.' },
];

/* ─── Small field components ────────────────────────────────────── */

function Field({ label, required, desc, error, id, children }) {
  return (
    <div className={`st-field${error ? ' st-field--err' : ''}`} id={id}>
      {label && <p className="st-label">{label}{required && <span className="st-req" aria-label="required">*</span>}</p>}
      {desc && <p className="st-desc">{desc}</p>}
      {children}
      {error && <p className="st-err-msg" role="alert">{error}</p>}
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

function IconCards({ value, onChange, opts, multi = false, max, name = 'st-icards' }) {
  const isSel = (v) => (multi ? value.includes(v) : value === v);
  const toggle = (v) => {
    if (!multi) return onChange(v);
    if (value.includes(v)) return onChange(value.filter(x => x !== v));
    if (max != null && value.length >= max) return;
    onChange([...value, v]);
  };
  return (
    <div className="st-cards">
      {opts.map(o => {
        const IconEl = o.icon;
        const sel = isSel(o.v);
        return (
          <label key={o.v} className={`st-icard${sel ? ' is-sel' : ''}`}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              checked={sel}
              onChange={() => toggle(o.v)}
              name={multi ? undefined : name}
            />
            <span className="st-icard-icon" aria-hidden="true"><IconEl width={20} height={20} /></span>
            <span className="st-icard-body">
              <span className="st-icard-lbl">{o.v}</span>
              {o.desc && <span className="st-icard-desc">{o.desc}</span>}
            </span>
            <span className="st-icard-mark" aria-hidden="true">{sel && <Check width={13} height={13} />}</span>
          </label>
        );
      })}
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
        return (
          <label key={o.v} className={`st-check${sel ? ' is-sel' : ''}${dis ? ' is-dis' : ''}`}>
            <input type="checkbox" checked={sel} onChange={() => toggle(o.v)} disabled={dis} />
            <span className="st-check-box">{sel && <Check width={10} height={10} />}</span>
            <span className="st-check-body">
              <span className="st-check-lbl">{o.label}</span>
              {o.desc && <span className="st-check-desc">{o.desc}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

/* ─── Per-step validation ───────────────────────────────────────── */

function validateStep(stepId, f) {
  const e = {};
  if (stepId === 'type') {
    if (!f.projectType) e.projectType = 'Pick one to continue';
  }
  if (stepId === 'business') {
    if (!f.fullName.trim())     e.fullName       = 'Required';
    if (!f.businessName.trim()) e.businessName   = 'Required';
    if (!f.businessDesc.trim()) e.businessDesc   = 'Required';
    if (!f.industry)            e.industry       = 'Select an industry';
    if (!f.location.trim())     e.location       = 'Required';
    if (!f.timeInBusiness)      e.timeInBusiness = 'Select one';
  }
  if (stepId === 'scope') {
    if (!f.servicesNeeded.length) e.servicesNeeded = 'Select at least one';
    if (!f.whyNow.trim())         e.whyNow         = 'Required';
  }
  if (stepId === 'direction') {
    if (!f.brandFeel.length)     e.brandFeel     = 'Select at least one feeling';
    if (!f.brandsAdmired.trim()) e.brandsAdmired = 'Required';
    if (!f.idealCustomer.trim()) e.idealCustomer = 'Required';
  }
  if (stepId === 'assets') {
    if (!f.assetsHave.length) e.assetsHave  = 'Select at least one';
    if (!f.photosReady)       e.photosReady = 'Select one';
  }
  if (stepId === 'contact') {
    if (!f.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Valid email required';
    if (!f.bestContact) e.bestContact = 'Select one';
    if (!f.timeline)    e.timeline    = 'Select one';
    if (!f.budget)      e.budget      = 'Select one';
  }
  return e;
}

/* ─── Main ──────────────────────────────────────────────────────── */

export default function Start() {
  const [f, setF]            = useState(EMPTY);
  const [stage, setStage]    = useState('intro');   // 'intro' | step index | 'done'
  const [dir, setDir]        = useState('fwd');     // animation direction
  const [errors, setErrors]  = useState({});
  const [submitting, setSub] = useState(false);
  const headingRef           = useRef(null);

  useEffect(() => { document.title = 'Start a Project — Visualize'; }, []);

  // Move keyboard focus to the new step's heading when it appears.
  useEffect(() => {
    if (typeof stage === 'number' && headingRef.current) {
      headingRef.current.focus();
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [stage]);

  const set = (key, val) => {
    setF(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validateCurrent = () => {
    const errs = validateStep(STEPS[stage].id, f);
    if (Object.keys(errs).length) {
      setErrors(errs);
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`f-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    setErrors({});
    return true;
  };

  const goNext = () => {
    if (!validateCurrent()) return;
    setDir('fwd');
    setStage(stage + 1);
  };

  const goBack = () => {
    setErrors({});
    setDir('back');
    setStage(stage === 0 ? 'intro' : stage - 1);
  };

  const handleSubmit = async () => {
    if (!validateCurrent()) return;
    setSub(true);

    const answers = {
      'Project Type': f.projectType,
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
    };

    try {
      // Primary: site backend — stores the lead and notifies Rob (push + email).
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'start',
          projectType: f.projectType,
          name: f.fullName,
          business: f.businessName,
          email: f.email,
          phone: f.phone,
          fields: answers,
        }),
      });
      if (!res.ok) throw new Error('api');
      setStage('done');
    } catch {
      // Backup: send the brief straight to email so the lead is never lost.
      try {
        const res2 = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY,
            subject: `New ${f.projectType} Project Brief — ${f.fullName} / ${f.businessName}`,
            from_name: f.fullName,
            email: f.email,
            ...answers,
          }),
        });
        const data = await res2.json();
        if (!data.success) throw new Error('backup');
        setStage('done');
      } catch {
        setErrors({ _submit: 'Something went wrong. Email us directly at contact@visualizeclients.com.' });
      }
    } finally {
      setSub(false);
    }
  };

  /* ── Intro ── */
  if (stage === 'intro') {
    return (
      <div className="st-shell">
        <section className="st-intro grid-texture">
          <div className="st-intro-inner">
            <Wordmark size={18} className="st-intro-mark" />
            <h1 className="st-intro-title display">Let's build<br />something<br /><span className="st-intro-red">you're proud of.</span></h1>
            <p className="st-intro-sub">
              Six short steps, about 10 minutes. The more detail you give,
              the faster we can move.
            </p>
            <button
              type="button"
              className="btn btn-primary st-begin-btn"
              onClick={() => { setDir('fwd'); setStage(0); }}
            >
              Begin Form <ArrowRight width={17} height={17} />
            </button>
          </div>
        </section>
        <style>{startStyles}</style>
      </div>
    );
  }

  /* ── Success ── */
  if (stage === 'done') {
    return (
      <div className="st-shell">
        <section className="st-success">
          <div className="st-success-inner st-anim-fwd">
            <span className="st-success-icon"><CheckCircle width={56} height={56} /></span>
            <h1 className="st-success-title display">We got it.</h1>
            <p className="st-success-body">Here's exactly what happens next:</p>
            <ol className="st-success-steps">
              <li><strong>Within 24 hours</strong> — Rob reads your brief and replies to {f.email} to schedule your kickoff call.</li>
              <li><strong>Kickoff call</strong> — 20–30 minutes to align on scope, timeline, and your quote.</li>
              <li><strong>Build begins</strong> — a clear timeline and one point of contact the whole way.</li>
            </ol>
            <p className="st-success-sub">Nothing else is needed from you right now.</p>
            <Link to="/" className="btn btn-secondary st-success-btn">Back to Home</Link>
          </div>
        </section>
        <style>{startStyles}</style>
      </div>
    );
  }

  /* ── Steps ── */
  const step = STEPS[stage];
  const pct = ((stage + 1) / STEPS.length) * 100;
  const isLast = stage === STEPS.length - 1;

  return (
    <div className="st-shell">
      {/* Progress */}
      <div className="st-progress" role="status" aria-live="polite">
        <div className="wrap st-progress-inner">
          <span className="st-progress-label">Step {stage + 1} of {STEPS.length}</span>
          <span className="st-progress-title">{step.title}</span>
        </div>
        <div className="st-progress-track"><div className="st-progress-fill" style={{ width: `${pct}%` }} /></div>
      </div>

      <form
        className="wrap st-form"
        onSubmit={(e) => { e.preventDefault(); isLast ? handleSubmit() : goNext(); }}
        noValidate
      >
        <div key={stage} className={`st-step ${dir === 'fwd' ? 'st-anim-fwd' : 'st-anim-back'}`}>
          <header className="st-step-head">
            <h2 className="st-step-title" tabIndex={-1} ref={headingRef}>{step.title}</h2>
            <p className="st-step-sub">{step.sub}</p>
          </header>

          {step.id === 'type' && (
            <Field id="f-projectType" error={errors.projectType}>
              <IconCards value={f.projectType} onChange={v => set('projectType', v)} opts={PROJECT_TYPES} name="projectType" />
            </Field>
          )}

          {step.id === 'business' && (
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
                desc="Write it how you'd explain it at a networking event."
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
          )}

          {step.id === 'scope' && (
            <div className="st-fields">
              <Field label="What do you need?" required desc="Select all that apply."
                id="f-servicesNeeded" error={errors.servicesNeeded}>
                <IconCards multi value={f.servicesNeeded} onChange={v => set('servicesNeeded', v)} opts={SERVICE_OPTS} />
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
                  opts={['Home / Landing Page','About / Our Story','Services / Menu','Portfolio / Gallery',
                    'Contact / Book Now','Online Store','Booking / Scheduling','Blog','Not sure']
                    .map(v => ({ v, label: v }))} />
              </Field>
            </div>
          )}

          {step.id === 'direction' && (
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
                  placeholder="e.g. I like dark colors — black, navy. No bright or neon."
                  value={f.colorPrefs} onChange={e => set('colorPrefs', e.target.value)} />
              </Field>
              <Field label="Name 1–3 brands whose look you admire and what you like about them." required
                desc="Doesn't have to be your industry. Just visual styles you respect."
                id="f-brandsAdmired" error={errors.brandsAdmired}>
                <textarea className="st-textarea" rows={3}
                  placeholder="e.g. I like how Supreme keeps it clean and minimal but feels exclusive."
                  value={f.brandsAdmired} onChange={e => set('brandsAdmired', e.target.value)} />
              </Field>
              <Field label="Who is your ideal customer? Describe them like a real person." required
                desc="Age, lifestyle, how they find businesses like yours. Specific beats vague."
                id="f-idealCustomer" error={errors.idealCustomer}>
                <textarea className="st-textarea" rows={4}
                  placeholder="e.g. Guy in his late 20s to 40s who takes pride in his car, has disposable income, follows car culture on Instagram."
                  value={f.idealCustomer} onChange={e => set('idealCustomer', e.target.value)} />
              </Field>
              <Field label="Who are your main competitors and what do you do better?"
                desc="Optional." id="f-competitors">
                <textarea className="st-textarea" rows={3}
                  placeholder="e.g. DetailPros and CleanRide in Wilmington. They both require you to come to them. I go to the customer."
                  value={f.competitors} onChange={e => set('competitors', e.target.value)} />
              </Field>
            </div>
          )}

          {step.id === 'assets' && (
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
                  placeholder="e.g. Instagram: @sopesdetailing"
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
          )}

          {step.id === 'contact' && (
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
                    { v: 'ASAP — within 1 week',        label: 'ASAP — within 1 week',        note: 'Rush fees may apply' },
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
                desc="Specific requirements, concerns, or anything that would help from day one."
                id="f-additionalInfo">
                <textarea className="st-textarea" rows={4}
                  placeholder="e.g. I have a big event coming up in 6 weeks."
                  value={f.additionalInfo} onChange={e => set('additionalInfo', e.target.value)} />
              </Field>
            </div>
          )}

          {errors._submit && <p className="st-err-msg st-submit-err" role="alert">{errors._submit}</p>}

          {/* Step controls */}
          <div className="st-controls">
            <button type="button" className="st-back" onClick={goBack}>
              <ArrowLeft width={15} height={15} /> Back
            </button>
            <button type="submit" className="btn btn-primary st-next" disabled={submitting}>
              {submitting
                ? <span className="st-spinner" aria-label="Submitting" />
                : isLast
                  ? <><Send01 width={16} height={16} /> Submit Your Brief</>
                  : <>Continue <ArrowRight width={16} height={16} /></>}
            </button>
          </div>
        </div>
      </form>
      <style>{startStyles}</style>
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────── */

const startStyles = `
  .st-shell { background: var(--bg); min-height: calc(100vh - 76px); }

  /* ── Intro ── */
  .st-intro {
    min-height: calc(100vh - 180px);
    display: flex; align-items: center; justify-content: center;
    background: var(--bg-deep); text-align: center;
    padding: var(--space-16) var(--space-6);
  }
  .st-intro-inner {
    max-width: 640px; display: flex; flex-direction: column; align-items: center;
    animation: stIn 0.6s var(--ease) both;
  }
  .st-intro-mark { margin-bottom: var(--space-8); opacity: 0.9; }
  .st-intro-title {
    font-size: clamp(3.2rem, 10vw, 6rem); color: var(--text);
    margin-bottom: var(--space-6);
  }
  .st-intro-red { color: var(--brand); }
  .st-intro-sub {
    font-size: 1.0625rem; color: var(--text-secondary); line-height: 1.7;
    max-width: 420px; margin-bottom: var(--space-8);
  }
  .st-begin-btn {
    display: inline-flex; align-items: center; gap: 10px;
    padding: 15px 40px; font-size: 1.0625rem; font-weight: 700;
    border-radius: 12px;
  }

  /* ── Progress ── */
  .st-progress {
    position: sticky; top: 0; z-index: 100;
    background: var(--chrome-solid);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
  }
  .st-progress-inner {
    display: flex; align-items: baseline; gap: var(--space-4);
    padding: 14px var(--space-6) 12px;
  }
  .st-progress-label {
    font-size: 0.7rem; font-weight: 800; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--brand); white-space: nowrap;
  }
  .st-progress-title { font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); }
  .st-progress-track { height: 2px; background: var(--glass-bg); }
  .st-progress-fill {
    height: 100%; background: var(--brand);
    transition: width 0.45s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ── Step frame + transitions ── */
  .st-form { max-width: 760px; padding-top: var(--space-10); padding-bottom: var(--space-24); }
  @keyframes stIn      { from { opacity: 0; transform: translateY(18px); }  to { opacity: 1; transform: none; } }
  @keyframes stInFwd   { from { opacity: 0; transform: translateX(36px); }  to { opacity: 1; transform: none; } }
  @keyframes stInBack  { from { opacity: 0; transform: translateX(-36px); } to { opacity: 1; transform: none; } }
  .st-anim-fwd  { animation: stInFwd  0.4s var(--ease) both; }
  .st-anim-back { animation: stInBack 0.4s var(--ease) both; }
  @media (prefers-reduced-motion: reduce) {
    .st-anim-fwd, .st-anim-back, .st-intro-inner { animation: stIn 0.01s both; }
    .st-progress-fill { transition: none; }
  }

  .st-step-head { margin-bottom: var(--space-8); }
  .st-step-title {
    font-size: clamp(1.7rem, 4vw, 2.4rem); font-weight: 800;
    letter-spacing: -0.03em; color: var(--text); outline: none;
    margin-bottom: var(--space-2);
  }
  .st-step-sub { color: var(--text-secondary); }

  .st-fields { display: flex; flex-direction: column; gap: var(--space-6); }

  /* ── Fields ── */
  .st-field { display: flex; flex-direction: column; gap: 6px; }
  .st-label { font-size: 0.9375rem; font-weight: 700; color: var(--text); line-height: 1.4; }
  .st-req { color: var(--brand); margin-left: 2px; }
  .st-desc { font-size: 0.84rem; color: var(--text-muted); line-height: 1.6; }
  .st-err-msg { font-size: 0.78rem; color: var(--brand); font-weight: 700; }
  .st-submit-err { margin-top: var(--space-4); }
  .st-field--err .st-input,
  .st-field--err .st-textarea,
  .st-field--err .st-select { border-color: rgba(212,76,67,0.6) !important; }

  .st-input, .st-textarea, .st-select {
    width: 100%; padding: 12px 15px;
    border: 1.5px solid var(--border-light); border-radius: 10px;
    background: var(--bg-card); color: var(--text);
    font-family: inherit; font-size: 0.9375rem; line-height: 1.5;
    outline: none; transition: border-color 0.18s, box-shadow 0.18s;
  }
  .st-input:focus, .st-textarea:focus, .st-select:focus {
    border-color: var(--brand);
    box-shadow: 0 0 0 3px rgba(212,76,67,0.15);
  }
  .st-textarea { resize: vertical; min-height: 100px; }
  .st-select { appearance: none; cursor: pointer; }
  .st-row2 { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
  @media (max-width: 580px) { .st-row2 { grid-template-columns: 1fr; } }

  /* ── Icon cards (project type + services) ── */
  .st-cards { display: flex; flex-direction: column; gap: 8px; position: relative; }
  .st-icard {
    display: flex; align-items: center; gap: 14px;
    padding: 15px 18px; border: 1.5px solid var(--border);
    border-radius: 12px; cursor: pointer; background: var(--bg-card);
    transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
    user-select: none; position: relative;
  }
  .st-icard input { position: absolute; opacity: 0; pointer-events: none; }
  .st-icard:hover { border-color: rgba(212,76,67,0.4); }
  .st-icard:has(input:focus-visible) { box-shadow: 0 0 0 3px rgba(212,76,67,0.3); }
  .st-icard.is-sel {
    border-color: var(--brand); background: var(--glass-bg-brand);
    box-shadow: 0 0 0 3px rgba(212,76,67,0.12);
  }
  .st-icard-icon {
    width: 38px; height: 38px; border-radius: 9px; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--brand); background: var(--glass-bg);
    border: 1px solid var(--border);
  }
  .st-icard-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .st-icard-lbl { font-size: 0.9375rem; font-weight: 700; color: var(--text); line-height: 1.3; }
  .st-icard-desc { font-size: 0.8125rem; color: var(--text-muted); line-height: 1.45; }
  .st-icard-mark {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    border: 2px solid var(--border-light); background: transparent;
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; transition: all 0.18s;
  }
  .st-icard.is-sel .st-icard-mark { background: var(--brand); border-color: var(--brand); }

  /* ── Radios ── */
  .st-radio-group { display: flex; flex-direction: column; gap: 8px; }
  .st-radio {
    display: flex; align-items: center; gap: 12px;
    padding: 13px 16px; border: 1.5px solid var(--border);
    border-radius: 10px; cursor: pointer; background: var(--bg-card);
    transition: border-color 0.18s, background 0.18s; user-select: none;
    position: relative;
  }
  .st-radio input { position: absolute; opacity: 0; pointer-events: none; }
  .st-radio:hover { border-color: rgba(212,76,67,0.4); }
  .st-radio:has(input:focus-visible) { box-shadow: 0 0 0 3px rgba(212,76,67,0.3); }
  .st-radio.is-sel { border-color: var(--brand); background: var(--glass-bg-brand); }
  .st-radio-dot {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid var(--border-light); flex-shrink: 0;
    position: relative; transition: border-color 0.18s;
  }
  .st-radio.is-sel .st-radio-dot { border-color: var(--brand); }
  .st-radio.is-sel .st-radio-dot::after {
    content: ''; position: absolute; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 9px; height: 9px; border-radius: 50%; background: var(--brand);
  }
  .st-radio-txt { font-size: 0.9375rem; font-weight: 500; color: var(--text); flex: 1; line-height: 1.4; }
  .st-radio-note {
    font-size: 0.7rem; font-weight: 600; color: var(--text-muted);
    padding: 3px 9px; background: var(--glass-bg); border-radius: 999px; flex-shrink: 0;
  }

  /* ── Checkboxes ── */
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
    padding: 13px 15px; border: 1.5px solid var(--border);
    border-radius: 10px; cursor: pointer; background: var(--bg-card);
    transition: border-color 0.18s, background 0.18s; user-select: none;
    position: relative;
  }
  .st-check input { position: absolute; opacity: 0; pointer-events: none; }
  .st-check:hover { border-color: rgba(212,76,67,0.4); }
  .st-check:has(input:focus-visible) { box-shadow: 0 0 0 3px rgba(212,76,67,0.3); }
  .st-check.is-sel { border-color: var(--brand); background: var(--glass-bg-brand); }
  .st-check.is-dis { opacity: 0.35; cursor: not-allowed; }
  .st-check-box {
    width: 20px; height: 20px; border-radius: 5px;
    border: 2px solid var(--border-light); flex-shrink: 0; margin-top: 1px;
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; transition: background 0.18s, border-color 0.18s;
  }
  .st-check.is-sel .st-check-box { background: var(--brand); border-color: var(--brand); }
  .st-check-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .st-check-lbl { font-size: 0.9375rem; font-weight: 600; color: var(--text); line-height: 1.3; }
  .st-check-desc { font-size: 0.8125rem; color: var(--text-muted); line-height: 1.45; }

  /* ── Controls ── */
  .st-controls {
    display: flex; align-items: center; justify-content: space-between;
    gap: var(--space-4); margin-top: var(--space-10);
    padding-top: var(--space-6); border-top: 1px solid var(--border);
  }
  .st-back {
    display: inline-flex; align-items: center; gap: 7px;
    background: none; border: 1px solid var(--border); border-radius: 10px;
    color: var(--text-secondary); font-size: 0.9rem; font-weight: 600;
    padding: 11px 20px; cursor: pointer; font-family: inherit;
    transition: color 0.2s, border-color 0.2s;
  }
  .st-back:hover { color: var(--text); border-color: var(--border-light); }
  .st-next {
    display: inline-flex; align-items: center; gap: 9px;
    padding: 13px 32px; font-size: 1rem; font-weight: 700;
    border-radius: 10px; min-width: 170px; justify-content: center;
  }
  .st-next:disabled { opacity: 0.6; cursor: not-allowed; }
  .st-spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
    animation: stSpin 0.65s linear infinite; display: inline-block;
  }
  @keyframes stSpin { to { transform: rotate(360deg); } }

  /* ── Success ── */
  .st-success {
    display: flex; align-items: center; justify-content: center;
    min-height: calc(100vh - 200px); padding: var(--space-16) var(--space-6);
  }
  .st-success-inner {
    display: flex; flex-direction: column; align-items: center;
    max-width: 520px; text-align: center;
  }
  .st-success-icon { color: #22c55e; margin-bottom: var(--space-5); display: inline-flex; }
  .st-success-title { font-size: clamp(2.6rem, 7vw, 4rem); color: var(--text); margin-bottom: var(--space-3); }
  .st-success-body { font-size: 1.0625rem; color: var(--text-secondary); margin-bottom: var(--space-5); }
  .st-success-steps {
    text-align: left; display: flex; flex-direction: column; gap: var(--space-3);
    margin: 0 0 var(--space-6); padding-left: 1.2em;
    color: var(--text-secondary); font-size: 0.9375rem; line-height: 1.65;
  }
  .st-success-steps strong { color: var(--text); }
  .st-success-sub { font-size: 0.875rem; color: var(--text-muted); margin-bottom: var(--space-6); }
  .st-success-btn { padding: 12px 32px; border-radius: 10px; }
`;
