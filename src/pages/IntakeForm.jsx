import { useState } from 'react';
import { Link, useSearchParams, Navigate } from 'react-router-dom';

const INTAKE_KEY  = 'vz_intake_forms';
const SESSION_KEY = 'vz_portal_session';

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function getForms() {
  try { return JSON.parse(localStorage.getItem(INTAKE_KEY) || '[]'); } catch { return []; }
}
function saveForms(f) { localStorage.setItem(INTAKE_KEY, JSON.stringify(f)); }

const EMPTY = {
  name: '', businessName: '', websiteUrl: '', email: '',
  businessDesc: '', targetAudience: '', primaryGoal: '',
  pages: [],
  contentReady: '', hasPhotos: '',
  sitesAdmired: '', competitors: '',
  designStyle: [],
  hasBrandColors: '', colorsToAvoid: '',
  platform: '', hasDomain: '', mustHaveFeatures: '',
  timeline: '', hardDeadline: '', budget: '', additionalInfo: '',
};

function RadioGroup({ name, value, onChange, options, error }) {
  return (
    <>
      <div className="if-options">
        {options.map((opt, i) => (
          <button
            key={opt} type="button"
            className={`if-option ${value === opt ? 'selected' : ''} ${i === 0 ? 'first' : ''} ${i === options.length - 1 ? 'last' : ''}`}
            onClick={() => onChange(opt)}
          >
            <span className={`if-radio ${value === opt ? 'on' : ''}`} />
            {opt}
          </button>
        ))}
      </div>
      {error && <span className="if-err-msg">{error}</span>}
    </>
  );
}

function ChipGroup({ value, onChange, options, error }) {
  const toggle = (opt) =>
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  return (
    <>
      <div className="if-chips">
        {options.map(opt => (
          <button key={opt} type="button"
            className={`if-chip ${value.includes(opt) ? 'on' : ''}`}
            onClick={() => toggle(opt)}
          >{opt}</button>
        ))}
      </div>
      {error && <span className="if-err-msg">{error}</span>}
    </>
  );
}

function Section({ num, title, children }) {
  return (
    <div className="if-card">
      <div className="if-card-header">
        <span className="if-num">{num}</span>
        <span className="if-card-title">{title}</span>
      </div>
      <div className="if-card-body">{children}</div>
    </div>
  );
}

function Q({ label, req, helper, error, children }) {
  return (
    <div className="if-q">
      <label className="if-label">{label}{req && <span className="if-req"> *</span>}</label>
      {helper && <p className="if-helper">{helper}</p>}
      {children}
      {error && <span className="if-err-msg">{error}</span>}
    </div>
  );
}

export default function IntakeForm() {
  const [searchParams] = useSearchParams();
  const editId  = searchParams.get('edit');
  const session = getSession();

  const [fields, setFields] = useState(() => {
    if (editId) {
      const existing = getForms().find(f => String(f.id) === editId);
      if (existing) return { ...EMPTY, ...existing.fields };
    }
    return { ...EMPTY, email: session?.email || '' };
  });

  const [errors, setErrors]     = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Gate: must be logged into client portal to access (checked after all hooks)
  if (!session) return <Navigate to="/portal" replace />;

  const set  = (k, v) => setFields(p => ({ ...p, [k]: v }));
  const clrE = (k)    => setErrors(p => ({ ...p, [k]: '' }));

  const validate = () => {
    const e = {};
    if (!fields.name.trim())           e.name          = 'Required';
    if (!fields.businessName.trim())   e.businessName  = 'Required';
    if (!fields.email.trim())          e.email         = 'Required';
    if (!fields.businessDesc.trim())   e.businessDesc  = 'Required';
    if (!fields.targetAudience.trim()) e.targetAudience = 'Required';
    if (!fields.primaryGoal)           e.primaryGoal   = 'Please select one';
    if (fields.pages.length === 0)     e.pages         = 'Select at least one page';
    if (!fields.contentReady)          e.contentReady  = 'Please select one';
    if (!fields.hasPhotos)             e.hasPhotos     = 'Please select one';
    if (!fields.sitesAdmired.trim())   e.sitesAdmired  = 'Required';
    if (fields.designStyle.length===0) e.designStyle   = 'Select at least one';
    if (!fields.hasBrandColors)        e.hasBrandColors= 'Please select one';
    if (!fields.platform)              e.platform      = 'Please select one';
    if (!fields.hasDomain)             e.hasDomain     = 'Please select one';
    if (!fields.timeline)              e.timeline      = 'Please select one';
    if (!fields.budget)                e.budget        = 'Please select one';
    return e;
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setTimeout(() => {
        const el = document.querySelector('.if-err-msg');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    const forms = getForms();
    if (editId) {
      const idx = forms.findIndex(f => String(f.id) === editId);
      if (idx !== -1) {
        forms[idx] = {
          ...forms[idx],
          fields,
          editHistory: [
            ...(forms[idx].editHistory || []),
            { editedAt: new Date().toISOString() },
          ],
        };
        saveForms(forms);
      }
    } else {
      saveForms([{
        id: Date.now(),
        type: 'website',
        clientId:    session?.id    || null,
        clientEmail: fields.email,
        clientName:  fields.name,
        submittedAt: new Date().toISOString(),
        editHistory: [],
        adminSeenAt: null,
        fields,
      }, ...forms]);
    }

    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (submitted) {
    return (
      <div className="if-success-wrap">
        <div className="if-success-card">
          <div className="if-success-check" aria-hidden="true">OK</div>
          <h1 className="if-success-title">{editId ? 'Changes saved!' : 'Form submitted!'}</h1>
          <p className="if-success-sub">
            {editId
              ? 'Your updates have been saved. Visualize Studio has been notified of your changes.'
              : "We've received your Website Design brief. We'll be in touch within 1 business day."}
          </p>
          <div className="if-success-btns">
            {session
              ? <Link to="/portal" className="if-btn-primary">Back to Portal</Link>
              : <Link to="/" className="if-btn-primary">Back to Site</Link>}
          </div>
        </div>
        <style>{ifStyles}</style>
      </div>
    );
  }

  return (
    <>
      <div className="if-topbar">
        <Link to="/" className="if-topbar-logo">
          <img src="/logo.svg" alt="Visualize Studio" style={{ height: 26 }} />
        </Link>
        {session && <Link to="/portal" className="if-topbar-back">Portal</Link>}
      </div>

      <form className="if-page" onSubmit={submit} noValidate>
        <p className="if-step">Step 1 of 6</p>
        <h1 className="if-title">Website Design</h1>
        <p className="if-sub">Help us understand exactly what you need so we can build a site that works as hard as your business does. Takes 5–10 minutes.</p>

        {/* 1 — About You */}
        <Section num={1} title="About You">
          <Q label="Your full name" req error={errors.name}>
            <input className={`if-input ${errors.name ? 'err' : ''}`} value={fields.name}
              onChange={e => { set('name', e.target.value); clrE('name'); }} placeholder="Full name" />
          </Q>
          <Q label="Your business name" req error={errors.businessName}>
            <input className={`if-input ${errors.businessName ? 'err' : ''}`} value={fields.businessName}
              onChange={e => { set('businessName', e.target.value); clrE('businessName'); }} placeholder="Business name" />
          </Q>
          <Q label="Your current website URL" helper="Leave blank if you don't have one yet.">
            <input className="if-input" value={fields.websiteUrl}
              onChange={e => set('websiteUrl', e.target.value)} placeholder="https://" type="url" />
          </Q>
          <Q label="Your email address" req error={errors.email}>
            <input className={`if-input ${errors.email ? 'err' : ''}`} value={fields.email}
              onChange={e => { set('email', e.target.value); clrE('email'); }} placeholder="you@example.com" type="email" />
          </Q>
        </Section>

        {/* 2 — Project Overview */}
        <Section num={2} title="Project Overview">
          <Q label="Describe your business and what you do." req error={errors.businessDesc}>
            <textarea className={`if-textarea ${errors.businessDesc ? 'err' : ''}`} value={fields.businessDesc}
              onChange={e => { set('businessDesc', e.target.value); clrE('businessDesc'); }} />
          </Q>
          <Q label="Who is your target audience?" req error={errors.targetAudience}>
            <textarea className={`if-textarea ${errors.targetAudience ? 'err' : ''}`} value={fields.targetAudience}
              onChange={e => { set('targetAudience', e.target.value); clrE('targetAudience'); }} />
          </Q>
          <Q label="Primary goal of this website?" req>
            <RadioGroup value={fields.primaryGoal} error={errors.primaryGoal}
              onChange={v => { set('primaryGoal', v); clrE('primaryGoal'); }}
              options={['Generate leads / inquiries','Sell products online (e-commerce)','Book appointments or consultations','Showcase my portfolio or work','Provide information about my business','Other']} />
          </Q>
        </Section>

        {/* 3 — Pages & Content */}
        <Section num={3} title="Pages & Content">
          <Q label="Which pages do you need?" req>
            <ChipGroup value={fields.pages} error={errors.pages}
              onChange={v => { set('pages', v); clrE('pages'); }}
              options={['Home','About','Services','Portfolio','Blog','Shop','Contact','FAQ','Pricing','Booking','Testimonials','Other']} />
          </Q>
          <Q label="Is your written content ready?" req>
            <RadioGroup value={fields.contentReady} error={errors.contentReady}
              onChange={v => { set('contentReady', v); clrE('contentReady'); }}
              options={['Fully written and ready','Rough notes — needs polishing','Need help writing from scratch','Mix of the above']} />
          </Q>
          <Q label="Do you have professional photos?" req>
            <RadioGroup value={fields.hasPhotos} error={errors.hasPhotos}
              onChange={v => { set('hasPhotos', v); clrE('hasPhotos'); }}
              options={['Yes, high-quality photos ready','I have some but may need more','No — need stock images or guidance','No images yet']} />
          </Q>
        </Section>

        {/* 4 — Design Direction */}
        <Section num={4} title="Design Direction">
          <Q label="List 2–5 websites you love the look of." req helper="Any industry — just sites whose design you admire." error={errors.sitesAdmired}>
            <textarea className={`if-textarea ${errors.sitesAdmired ? 'err' : ''}`} value={fields.sitesAdmired}
              onChange={e => { set('sitesAdmired', e.target.value); clrE('sitesAdmired'); }} />
          </Q>
          <Q label="List competitor websites in your space.">
            <textarea className="if-textarea" value={fields.competitors}
              onChange={e => set('competitors', e.target.value)} />
          </Q>
          <Q label="Design style you're going for?" req>
            <ChipGroup value={fields.designStyle} error={errors.designStyle}
              onChange={v => { set('designStyle', v); clrE('designStyle'); }}
              options={['Clean & minimal','Bold & modern','Warm & friendly','Elegant & high-end','Professional','Playful','Edgy','Not sure — I trust you']} />
          </Q>
          <Q label="Do you have existing brand colors?" req>
            <RadioGroup value={fields.hasBrandColors} error={errors.hasBrandColors}
              onChange={v => { set('hasBrandColors', v); clrE('hasBrandColors'); }}
              options={["Yes — I'll share them","No — open to suggestions","Partially — some direction"]} />
          </Q>
          <Q label="Colors or styles you absolutely don't want?">
            <textarea className="if-textarea" value={fields.colorsToAvoid}
              onChange={e => set('colorsToAvoid', e.target.value)} />
          </Q>
        </Section>

        {/* 5 — Platform & Technical */}
        <Section num={5} title="Platform & Technical">
          <Q label="Platform preference?" req>
            <RadioGroup value={fields.platform} error={errors.platform}
              onChange={v => { set('platform', v); clrE('platform'); }}
              options={['Webflow','WordPress','Shopify','Squarespace',"No preference — recommend what's best"]} />
          </Q>
          <Q label="Do you already have a domain?" req>
            <RadioGroup value={fields.hasDomain} error={errors.hasDomain}
              onChange={v => { set('hasDomain', v); clrE('hasDomain'); }}
              options={['Yes, I own one','No, I need one','Not sure']} />
          </Q>
          <Q label="Must-have features?" helper="e.g., online booking, contact form, e-commerce, live chat">
            <textarea className="if-textarea" value={fields.mustHaveFeatures}
              onChange={e => set('mustHaveFeatures', e.target.value)} />
          </Q>
        </Section>

        {/* 6 — Timeline & Budget */}
        <Section num={6} title="Timeline & Budget">
          <Q label="Ideal launch timeline?" req>
            <RadioGroup value={fields.timeline} error={errors.timeline}
              onChange={v => { set('timeline', v); clrE('timeline'); }}
              options={['ASAP (rush)','Within 4 weeks','4–8 weeks','2–3 months','Flexible — quality over speed']} />
          </Q>
          <Q label="Hard launch deadline? (if any)">
            <input className="if-input" type="date" value={fields.hardDeadline}
              onChange={e => set('hardDeadline', e.target.value)} />
          </Q>
          <Q label="Budget range?" req error={errors.budget}>
            <select className={`if-select ${errors.budget ? 'err' : ''}`} value={fields.budget}
              onChange={e => { set('budget', e.target.value); clrE('budget'); }}>
              <option value="">Select a range</option>
              <option>Under $1,000</option>
              <option>$1,000 – $2,500</option>
              <option>$2,500 – $5,000</option>
              <option>$5,000 – $10,000</option>
              <option>$10,000+</option>
              <option>Not sure yet</option>
            </select>
          </Q>
          <Q label="Anything else we should know?">
            <textarea className="if-textarea" value={fields.additionalInfo}
              onChange={e => set('additionalInfo', e.target.value)} />
          </Q>
        </Section>

        <div className="if-submit-row">
          <p className="if-req-note"><span className="if-req">*</span> Required fields</p>
          <button type="submit" className="if-submit">{editId ? 'Save Changes' : 'Submit'}</button>
        </div>
      </form>

      <style>{ifStyles}</style>
    </>
  );
}

const ifStyles = `
  /* ── Top bar ──────────────────────────── */
  .if-topbar {
    position: sticky; top: 0; z-index: 50;
    background: #ffffff;
    border-bottom: 1px solid #e8e8e6;
    height: 58px; padding: 0 20px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .if-topbar-back {
    font-size: 13px; font-weight: 600; color: #767676;
    text-decoration: none; transition: color 0.15s;
  }
  .if-topbar-back:hover { color: #1a1a1a; }

  /* ── Page ────────────────────────────── */
  .if-page {
    max-width: 520px; margin: 0 auto;
    padding: 32px 20px 80px;
    font-family: inherit;
  }
  .if-step {
    font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
    text-transform: uppercase; color: #d44c43; margin-bottom: 6px;
  }
  .if-title {
    font-size: 30px; font-weight: 900; letter-spacing: -0.03em;
    line-height: 1.1; color: #1a1a1a; margin-bottom: 10px;
  }
  .if-sub {
    font-size: 15px; color: #4a4a4a; line-height: 1.6; margin-bottom: 28px;
  }

  /* ── Cards ───────────────────────────── */
  .if-card {
    background: #ffffff; border: 1px solid #e8e8e6;
    border-radius: 14px; overflow: hidden; margin-bottom: 16px;
  }
  .if-card-header {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 20px 12px; border-bottom: 1px solid #e8e8e6;
  }
  .if-num {
    width: 22px; height: 22px; border-radius: 50%;
    background: #1a1a1a; color: #fff;
    font-size: 11px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .if-card-title {
    font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #4a4a4a;
  }
  .if-card-body {
    padding: 20px; display: flex; flex-direction: column; gap: 20px;
  }

  /* ── Form elements ───────────────────── */
  .if-q { display: flex; flex-direction: column; gap: 6px; }
  .if-label { font-size: 14px; font-weight: 700; color: #1a1a1a; line-height: 1.3; }
  .if-req { color: #d44c43; font-weight: 800; }
  .if-helper { font-size: 12px; color: #767676; line-height: 1.5; margin-top: -2px; }
  .if-err-msg { font-size: 12px; color: #d44c43; font-weight: 600; margin-top: 2px; }

  .if-input, .if-textarea, .if-select {
    width: 100%; font-family: inherit;
    border: 1px solid #e8e8e6; border-radius: 8px;
    background: #ffffff; color: #1a1a1a; font-size: 15px;
    outline: none; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .if-input:focus, .if-textarea:focus, .if-select:focus {
    border-color: #d44c43; box-shadow: 0 0 0 2px rgba(212,76,67,0.12);
  }
  .if-input.err, .if-textarea.err, .if-select.err { border-color: #d44c43; }
  .if-input    { height: 48px; padding: 0 14px; }
  .if-textarea { min-height: 90px; padding: 12px 14px; resize: vertical; }
  .if-select   { height: 48px; padding: 0 14px; appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%23b0b0b0' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 14px center;
    padding-right: 36px;
  }

  /* ── Radio options ───────────────────── */
  .if-options { display: flex; flex-direction: column; }
  .if-option {
    display: flex; align-items: center; gap: 12px;
    padding: 13px 16px;
    border: 1px solid #e8e8e6; border-bottom: none;
    background: #ffffff; font-size: 14px; color: #4a4a4a; font-weight: 500;
    cursor: pointer; text-align: left; width: 100%;
    font-family: inherit; transition: background 0.12s;
  }
  .if-option.first { border-radius: 8px 8px 0 0; }
  .if-option.last  { border-bottom: 1px solid #e8e8e6; border-radius: 0 0 8px 8px; }
  .if-option.first.last { border-radius: 8px; border-bottom: 1px solid #e8e8e6; }
  .if-option.selected { background: #fff8f8; border-color: #d44c43; }
  .if-option.selected + .if-option { border-top-color: #d44c43; }
  .if-option:hover:not(.selected) { background: #fafafa; }

  .if-radio {
    width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
    border: 1.5px solid #b0b0b0; background: #fff;
    display: flex; align-items: center; justify-content: center;
    transition: border-color 0.15s, background 0.15s;
  }
  .if-radio.on { border-color: #d44c43; background: #d44c43; }
  .if-radio.on::after { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #fff; }

  /* ── Chips ───────────────────────────── */
  .if-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .if-chip {
    font-size: 12px; font-weight: 600;
    padding: 6px 13px; border-radius: 20px;
    border: 1px solid #e8e8e6; background: #fff; color: #4a4a4a;
    cursor: pointer; font-family: inherit;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .if-chip.on { border-color: #d44c43; color: #d44c43; background: #fff5f5; }
  .if-chip:hover:not(.on) { border-color: #b0b0b0; }

  /* ── Submit row ──────────────────────── */
  .if-submit-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-top: 8px; flex-wrap: wrap; gap: 12px;
  }
  .if-req-note { font-size: 12px; color: #767676; }
  .if-submit {
    background: #1a1a1a; color: #fff;
    font-size: 14px; font-weight: 800; letter-spacing: -0.01em;
    padding: 14px 26px; border-radius: 50px; border: none;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  .if-submit:hover { background: #2a2a2a; }

  /* ── Success ──────────────────────────── */
  .if-success-wrap {
    min-height: 100vh; background: #f6f5f3;
    display: flex; align-items: center; justify-content: center;
    padding: 40px 20px;
  }
  .if-success-card {
    background: #fff; border: 1px solid #e8e8e6;
    border-radius: 16px; padding: 48px 36px;
    max-width: 420px; width: 100%; text-align: center;
  }
  .if-success-check {
    width: 52px; height: 52px; border-radius: 50%;
    background: #d44c43; color: #fff;
    font-size: 22px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 20px;
  }
  .if-success-title {
    font-size: 24px; font-weight: 900; letter-spacing: -0.02em;
    color: #1a1a1a; margin-bottom: 10px;
  }
  .if-success-sub {
    font-size: 14px; color: #4a4a4a; line-height: 1.65; margin-bottom: 28px;
  }
  .if-success-btns { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
  .if-btn-primary {
    background: #1a1a1a; color: #fff; font-size: 14px; font-weight: 700;
    padding: 12px 22px; border-radius: 50px; text-decoration: none;
    transition: background 0.15s;
  }
  .if-btn-primary:hover { background: #2a2a2a; }
`;
