import { useState, useCallback, useRef } from 'react';
import ShoppingCart01 from '@untitled-ui/icons-react/build/esm/ShoppingCart01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import Send01 from '@untitled-ui/icons-react/build/esm/Send01';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import Upload01 from '@untitled-ui/icons-react/build/esm/Upload01';
import ChevronRight from '@untitled-ui/icons-react/build/esm/ChevronRight';
import Star01 from '@untitled-ui/icons-react/build/esm/Star01';

const ACCESS_KEY = import.meta.env.VITE_WEB3FORMS_KEY || '';

/* ─── Catalog ────────────────────────────────────────────────────── */

const CATS = [
  { id: 'all',      label: 'All' },
  { id: 'stickers', label: 'Stickers' },
  { id: 'vinyl',    label: 'Vinyl' },
  { id: 'print',    label: 'Print & Cards' },
];

const PRODUCTS = [
  {
    id: 'logo-sticker', cat: 'stickers', popular: true,
    name: 'Logo Die-Cut Sticker',
    desc: 'Your logo precision-cut to shape. Glossy, waterproof, and made for indoor use — keep out of direct sunlight.',
    pricing: { mode: 'sticker' },
    fields: ['qty', 'size', 'artwork'],
  },
  {
    id: 'qr-sticker', cat: 'stickers',
    name: 'QR Code Sticker',
    desc: 'Logo + scannable QR code in one sticker. Link customers to your site, menu, or booking page.',
    pricing: { mode: 'sticker' },
    fields: ['qty', 'size', 'qrUrl', 'artwork'],
  },
  {
    id: 'sticker-sheet', cat: 'stickers',
    name: 'Kiss-Cut Sticker Sheet',
    desc: 'Multiple designs on one sheet. Perfect for variety packs, packaging inserts, and giveaways.',
    pricing: { mode: 'quote' },
    fields: ['qty', 'sheetSize', 'artwork'],
  },
  {
    id: 'ig-vinyl', cat: 'vinyl', badge: '$15 flat',
    name: 'Instagram Handle Vinyl',
    desc: 'Your @handle on your car — includes 2, one for each side. Single color, clean and sharp.',
    pricing: { mode: 'flat', amount: 15, note: 'Includes 2 — one for each side of your car' },
    fields: ['text', 'vinylColor', 'vinylSize'],
  },
  {
    id: 'custom-text-vinyl', cat: 'vinyl',
    name: 'Custom Text Vinyl',
    desc: 'Any text you want. Single-color vinyl for vehicles, windows, storefronts, or walls.',
    pricing: { mode: 'quote' },
    fields: ['text', 'vinylColor', 'vinylSize'],
  },
  {
    id: 'logo-vinyl', cat: 'vinyl',
    name: 'Logo Vinyl Decal',
    desc: 'Your logo as a single-color vinyl decal. Die-cut silhouette — minimal and sharp.',
    pricing: { mode: 'quote' },
    fields: ['artwork', 'vinylColor', 'vinylSize'],
  },
  {
    id: 'business-cards', cat: 'print',
    name: 'Business Cards',
    desc: "Premium card stock, matte or gloss finish. Bring your design or we'll build it from scratch.",
    pricing: { mode: 'quote' },
    fields: ['qty', 'cardFinish', 'artwork'],
  },
];

/* ─── Pricing engine ─────────────────────────────────────────────── */

// Sticker pricing scales with size. Bulk rate applies at BULK_MIN+ per order.
const STICKER_PRICES = {
  '2" × 2"': { base: 0.75, bulk: 0.53 },
  '3" × 3"': { base: 1.00, bulk: 0.70 },
  '4" × 4"': { base: 1.35, bulk: 0.95 },
  '5" × 5"': { base: 1.75, bulk: 1.25 },
  '6" × 8"': { base: 2.50, bulk: 1.75 },
};
const BULK_MIN = 250;

function priceLabelForCard(product) {
  const p = product.pricing;
  if (!p) return 'By quote';
  if (p.mode === 'flat')    return `$${p.amount} flat`;
  if (p.mode === 'sticker') return 'From $0.75/ea';
  return 'By quote';
}

// Returns { mode, qty, unit, total, display } — display is null until enough is chosen
function computePrice(product, vals) {
  const p = product.pricing;
  if (!p || p.mode === 'quote') return { mode: 'quote', total: null, display: 'By quote' };
  if (p.mode === 'flat') return { mode: 'flat', total: p.amount, display: `$${p.amount} flat` };
  if (p.mode === 'sticker') {
    const qty = parseInt(String(vals.qty || '').replace(/[^0-9]/g, ''), 10) || 0;
    if (vals.size === 'Custom') return { mode: 'quote', total: null, display: 'By quote' };
    const tier = STICKER_PRICES[vals.size];
    if (!qty || !tier) return { mode: 'sticker', qty, total: null, display: null };
    const unit = qty >= BULK_MIN ? tier.bulk : tier.base;
    const total = +(unit * qty).toFixed(2);
    return { mode: 'sticker', qty, unit, total, display: `$${unit.toFixed(2)}/ea` };
  }
  return { mode: 'quote', total: null, display: 'By quote' };
}

function fmtMoney(n) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ─── Field options ──────────────────────────────────────────────── */

const STICKER_SIZES  = ['2" × 2"', '3" × 3"', '4" × 4"', '5" × 5"', '6" × 8"', 'Custom'];
const SHEET_SIZES    = ['4" × 6"', '5" × 7"', '8.5" × 11"', 'Custom'];
const VINYL_SIZES    = ['4" × 16"', '6" × 24"', '8" × 32"', 'Custom'];
const CARD_FINISHES  = ['Matte', 'Gloss', 'Spot UV'];
const STICKER_QTYS   = ['10', '25', '50', '100', '250', '500', '1,000+'];
const CARD_QTYS      = ['50', '100', '250', '500', '1,000'];
const VINYL_COLORS   = [
  { label: 'White',  hex: '#ffffff', border: true },
  { label: 'Black',  hex: '#111111' },
  { label: 'Red',    hex: '#d44c43' },
  { label: 'Gold',   hex: '#c9a12a' },
  { label: 'Blue',   hex: '#2563eb' },
  { label: 'Silver', hex: '#a1a1aa' },
  { label: 'Other — specify in notes', hex: null },
];

/* ─── Mini helpers ───────────────────────────────────────────────── */

function Chip({ label, selected, onClick }) {
  return (
    <button type="button" className={`ps-chip${selected ? ' is-sel' : ''}`} onClick={onClick}>
      {label}
    </button>
  );
}

function SizeGrid({ value, onChange }) {
  return (
    <div className="ps-opt-grid">
      {STICKER_SIZES.map(s => {
        const p = STICKER_PRICES[s];
        return (
          <button key={s} type="button"
            className={`ps-opt ps-opt--size${value === s ? ' is-sel' : ''}`}
            onClick={() => onChange(s)}>
            <span>{s}</span>
            <span className="ps-opt-price">{p ? `$${p.base.toFixed(2)}/ea` : 'By quote'}</span>
          </button>
        );
      })}
    </div>
  );
}

function OptionGrid({ opts, value, onChange }) {
  return (
    <div className="ps-opt-grid">
      {opts.map(o => (
        <button key={o} type="button"
          className={`ps-opt${value === o ? ' is-sel' : ''}`}
          onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

function ColorRow({ value, onChange }) {
  return (
    <div className="ps-color-row">
      {VINYL_COLORS.map(c => (
        <button key={c.label} type="button" title={c.label}
          className={`ps-swatch${value === c.label ? ' is-sel' : ''}`}
          onClick={() => onChange(c.label)}
          style={{ background: c.hex || 'conic-gradient(red,orange,yellow,green,blue,purple,red)', border: c.border ? '2px solid #555' : undefined }}>
          {value === c.label && <Check width={12} height={12} color={c.border ? '#333' : '#fff'} />}
        </button>
      ))}
    </div>
  );
}

/* ─── Product icon SVGs ──────────────────────────────────────────── */

const ICONS = {
  'logo-sticker': (
    <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5"/><circle cx="24" cy="24" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"/><circle cx="24" cy="24" r="3" fill="currentColor"/></svg>
  ),
  'qr-sticker': (
    <svg viewBox="0 0 48 48" fill="none"><rect x="8" y="8" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2.2"/><rect x="26" y="8" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2.2"/><rect x="8" y="26" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2.2"/><rect x="11" y="11" width="8" height="8" rx="1" fill="currentColor"/><rect x="29" y="11" width="8" height="8" rx="1" fill="currentColor"/><rect x="11" y="29" width="8" height="8" rx="1" fill="currentColor"/><path d="M30 26h4M30 30h8M34 34h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
  ),
  'sticker-sheet': (
    <svg viewBox="0 0 48 48" fill="none"><rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" strokeWidth="2.2"/><rect x="13" y="13" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2"/><rect x="26" y="13" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2"/><rect x="13" y="26" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2"/><rect x="26" y="26" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="2"/></svg>
  ),
  'ig-vinyl': (
    <svg viewBox="0 0 48 48" fill="none"><rect x="10" y="10" width="28" height="28" rx="8" stroke="currentColor" strokeWidth="2.5"/><circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2.2"/><circle cx="33" cy="15" r="2" fill="currentColor"/></svg>
  ),
  'custom-text-vinyl': (
    <svg viewBox="0 0 48 48" fill="none"><path d="M8 36h8M12 12v24M12 12h8M20 12h8M24 12v12M32 12v24M28 36h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  'logo-vinyl': (
    <svg viewBox="0 0 48 48" fill="none"><path d="M10 38L24 10L38 38Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><circle cx="24" cy="28" r="4" stroke="currentColor" strokeWidth="2.2"/></svg>
  ),
  'business-cards': (
    <svg viewBox="0 0 48 48" fill="none"><rect x="6" y="13" width="36" height="22" rx="3" stroke="currentColor" strokeWidth="2.4"/><path d="M13 22h10M13 27h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="33" cy="24.5" r="5" stroke="currentColor" strokeWidth="2"/></svg>
  ),
};

/* ─── Customize Modal ────────────────────────────────────────────── */

const EMPTY_CUSTOM = { qty: '', size: '', sheetSize: '', finish: '', artwork: '', artworkFile: null, qrUrl: '', text: '', vinylColor: '', vinylSize: '', cardFinish: '', notes: '' };

function CustomizeModal({ product, onClose, onAdd }) {
  const [vals, setVals] = useState(EMPTY_CUSTOM);
  const [errors, setErrors] = useState({});
  const fileRef = useRef(null);

  const set = (k, v) => setVals(p => ({ ...p, [k]: v }));

  const flds = product.fields;
  const needsQty   = flds.includes('qty');
  const needsSize  = flds.includes('size');
  const needsSheet = flds.includes('sheetSize');
  const needsCardFin = flds.includes('cardFinish');
  const needsArtwork = flds.includes('artwork');
  const needsQr    = flds.includes('qrUrl');
  const needsText  = flds.includes('text');
  const needsColor = flds.includes('vinylColor');
  const needsVSz   = flds.includes('vinylSize');

  const validate = () => {
    const e = {};
    if (needsQty   && !vals.qty)         e.qty      = 'Select a quantity';
    if (needsSize  && !vals.size)        e.size     = 'Select a size';
    if (needsSheet && !vals.sheetSize)   e.sheetSize = 'Select a sheet size';
    if (needsCardFin && !vals.cardFinish) e.cardFinish = 'Select a finish';
    if (needsText  && !vals.text.trim()) e.text     = product.id === 'ig-vinyl' ? 'Enter your Instagram handle' : 'Enter your text';
    if (needsColor && !vals.vinylColor)  e.vinylColor = 'Select a color';
    if (needsVSz   && !vals.vinylSize)   e.vinylSize = 'Select a size';
    return e;
  };

  const price = computePrice(product, vals);

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const label = buildLabel(product, vals);
    onAdd({
      cartId: Date.now(), productId: product.id, productName: product.name,
      vals: { ...vals }, label,
      priceMode: price.mode, priceTotal: price.total,
    });
    onClose();
  };

  // Sticker orders: quantity note reflects the selected size's rates
  const sizeTier = product.pricing?.mode === 'sticker' ? STICKER_PRICES[vals.size] : null;
  const tierNote = sizeTier
    ? `$${sizeTier.base.toFixed(2)} each · $${sizeTier.bulk.toFixed(2)} each at ${BULK_MIN}+`
    : null;

  return (
    <div className="ps-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ps-modal">
        <div className="ps-modal-head">
          <div>
            <p className="ps-modal-eyebrow">{product.price}</p>
            <h3 className="ps-modal-title">{product.name}</h3>
          </div>
          <button type="button" className="ps-modal-close" onClick={onClose}><XClose width={20} height={20} /></button>
        </div>

        <div className="ps-modal-body">

          {/* Quantity */}
          {needsQty && (
            <div className={`ps-mfield${errors.qty ? ' is-err' : ''}`}>
              <label className="ps-mlabel">Quantity {errors.qty && <span className="ps-merr">{errors.qty}</span>}</label>
              <OptionGrid opts={product.id === 'business-cards' ? CARD_QTYS : STICKER_QTYS} value={vals.qty} onChange={v => set('qty', v)} />
              {tierNote && <p className="ps-mhint">{tierNote}</p>}
            </div>
          )}

          {/* Size */}
          {needsSize && (
            <div className={`ps-mfield${errors.size ? ' is-err' : ''}`}>
              <label className="ps-mlabel">Size {errors.size && <span className="ps-merr">{errors.size}</span>}</label>
              <SizeGrid value={vals.size} onChange={v => set('size', v)} />
              <p className="ps-mhint">Glossy finish · Waterproof · Indoor use — keep out of direct sunlight.</p>
            </div>
          )}

          {/* Sheet size */}
          {needsSheet && (
            <div className={`ps-mfield${errors.sheetSize ? ' is-err' : ''}`}>
              <label className="ps-mlabel">Sheet Size {errors.sheetSize && <span className="ps-merr">{errors.sheetSize}</span>}</label>
              <OptionGrid opts={SHEET_SIZES} value={vals.sheetSize} onChange={v => set('sheetSize', v)} />
            </div>
          )}

          {/* Card finish */}
          {needsCardFin && (
            <div className={`ps-mfield${errors.cardFinish ? ' is-err' : ''}`}>
              <label className="ps-mlabel">Card Finish {errors.cardFinish && <span className="ps-merr">{errors.cardFinish}</span>}</label>
              <OptionGrid opts={CARD_FINISHES} value={vals.cardFinish} onChange={v => set('cardFinish', v)} />
            </div>
          )}

          {/* Instagram handle / text */}
          {needsText && (
            <div className={`ps-mfield${errors.text ? ' is-err' : ''}`}>
              <label className="ps-mlabel">
                {product.id === 'ig-vinyl' ? 'Instagram Handle' : 'Your Text'}
                {errors.text && <span className="ps-merr">{errors.text}</span>}
              </label>
              <input
                className="ps-minput"
                type="text"
                placeholder={product.id === 'ig-vinyl' ? '@yourhandle' : 'e.g. Sopes Detailing · Wilmington, DE'}
                value={vals.text}
                onChange={e => { set('text', e.target.value); if (errors.text) setErrors(p => ({ ...p, text: '' })); }}
              />
              {product.id === 'ig-vinyl' && (
                <p className="ps-mhint">Printed twice — once for each side of your car. White text only.</p>
              )}
            </div>
          )}

          {/* Vinyl color */}
          {needsColor && (
            <div className={`ps-mfield${errors.vinylColor ? ' is-err' : ''}`}>
              <label className="ps-mlabel">Vinyl Color {errors.vinylColor && <span className="ps-merr">{errors.vinylColor}</span>}</label>
              <ColorRow value={vals.vinylColor} onChange={v => { set('vinylColor', v); if (errors.vinylColor) setErrors(p => ({ ...p, vinylColor: '' })); }} />
              {vals.vinylColor === 'Other — specify in notes' && (
                <p className="ps-mhint">Add your color in the notes field below.</p>
              )}
            </div>
          )}

          {/* Vinyl size */}
          {needsVSz && (
            <div className={`ps-mfield${errors.vinylSize ? ' is-err' : ''}`}>
              <label className="ps-mlabel">Size (per set) {errors.vinylSize && <span className="ps-merr">{errors.vinylSize}</span>}</label>
              <OptionGrid opts={VINYL_SIZES} value={vals.vinylSize} onChange={v => set('vinylSize', v)} />
            </div>
          )}

          {/* QR URL */}
          {needsQr && (
            <div className="ps-mfield">
              <label className="ps-mlabel">QR Code Destination URL</label>
              <input className="ps-minput" type="url" placeholder="https://yourbusiness.com" value={vals.qrUrl} onChange={e => set('qrUrl', e.target.value)} />
              <p className="ps-mhint">We'll generate the QR code. Just give us the URL it should open.</p>
            </div>
          )}

          {/* Artwork */}
          {needsArtwork && (
            <div className="ps-mfield">
              <label className="ps-mlabel">Artwork / Logo File</label>
              <div className="ps-upload-zone" onClick={() => fileRef.current?.click()}>
                {vals.artworkFile
                  ? <><Check width={18} height={18} color="#22c55e" /><span className="ps-upload-name">{vals.artworkFile.name}</span><button type="button" className="ps-upload-clear" onClick={e => { e.stopPropagation(); set('artworkFile', null); }}>Remove</button></>
                  : <><Upload01 width={20} height={20} /><span>Click to upload file<br /><small>.ai, .pdf, .png, .svg, .psd</small></span></>}
              </div>
              <input ref={fileRef} type="file" accept=".ai,.pdf,.png,.svg,.psd,.jpg,.jpeg,.eps" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) set('artworkFile', e.target.files[0]); }} />
              <p className="ps-mhint">Don't have files ready? Leave blank and we'll follow up after your order.</p>
            </div>
          )}

          {/* Notes */}
          <div className="ps-mfield">
            <label className="ps-mlabel">Special Notes <span style={{ fontWeight: 400, color: 'var(--ps-muted)' }}>(optional)</span></label>
            <textarea className="ps-mtextarea" rows={3}
              placeholder="Any specific requirements, colors, or details we should know."
              value={vals.notes} onChange={e => set('notes', e.target.value)} />
          </div>

        </div>

        <div className="ps-modal-foot">
          <div className="ps-price-box">
            {price.mode === 'quote' ? (
              <>
                <span className="ps-price-amt">By Quote</span>
                <span className="ps-price-note">We'll price after reviewing your details</span>
              </>
            ) : price.mode === 'flat' ? (
              <>
                <span className="ps-price-amt">{fmtMoney(price.total)}</span>
                <span className="ps-price-note">{product.pricing.note || 'Flat rate'}</span>
              </>
            ) : price.total != null ? (
              <>
                <span className="ps-price-amt">{fmtMoney(price.total)}</span>
                <span className="ps-price-note">{price.display} × {price.qty} stickers</span>
              </>
            ) : (
              <>
                <span className="ps-price-amt ps-price-amt--dim">Select size & quantity</span>
                {tierNote && <span className="ps-price-note">{tierNote}</span>}
              </>
            )}
          </div>
          <button type="button" className="ps-btn-primary" onClick={submit}>
            Add to Cart <ArrowRight width={16} height={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Cart Drawer ────────────────────────────────────────────────── */

function CartDrawer({ cart, onRemove, onClose, onCheckoutDone }) {
  const [step, setStep] = useState('cart'); // 'cart' | 'checkout' | 'done'
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const fileRefs = useRef({});

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validateForm = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'Required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    return e;
  };

  const handleCheckout = async () => {
    const e = validateForm();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSubmitting(true);
    setSubmitErr('');

    const cartSummary = cart.map(item => item.label).join(' | ');

    try {
      const subtotal = cart.reduce((s, i) => s + (i.priceMode !== 'quote' && i.priceTotal != null ? i.priceTotal : 0), 0);
      const hasQuote = cart.some(i => i.priceMode === 'quote' || i.priceTotal == null);

      const fd = new FormData();
      fd.append('access_key', ACCESS_KEY);
      fd.append('subject', `New Shop Order — ${form.name}`);
      fd.append('from_name', form.name);
      fd.append('email', form.email);
      fd.append('Phone', form.phone || '—');
      fd.append('Order Items', cart.length.toString());
      fd.append('Estimated Subtotal', `${fmtMoney(subtotal)}${hasQuote ? ' + quote items' : ''}`);
      cart.forEach((item, i) => {
        const priceStr = item.priceMode === 'quote' || item.priceTotal == null ? 'Quote' : fmtMoney(item.priceTotal);
        fd.append(`Item ${i + 1}`, `${item.productName} — ${item.label} — ${priceStr}`);
        if (item.vals.notes) fd.append(`Item ${i + 1} Notes`, item.vals.notes);
        if (item.vals.artworkFile) fd.append(`Artwork — ${item.productName}`, item.vals.artworkFile);
      });

      fd.append('Payment', 'No deposit — collected when production begins');
      if (ACCESS_KEY) await fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd });

      const orderId = Date.now();
      const orderData = {
        id: orderId, date: new Date().toISOString(),
        source: 'shop', status: 'pending',
        name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(),
        cartItems: cart.map(c => ({ productId: c.productId, productName: c.productName, label: c.label, priceMode: c.priceMode, priceTotal: c.priceTotal, vals: { ...c.vals, artworkFile: c.vals.artworkFile?.name || null } })),
        summary: cartSummary,
        estimatedSubtotal: subtotal, hasQuoteItems: hasQuote,
      };
      try {
        const existing = JSON.parse(localStorage.getItem('vz_print_orders') || '[]');
        localStorage.setItem('vz_print_orders', JSON.stringify([orderData, ...existing]));
      } catch {}

      // Also file the order as a lead in the admin panel (best-effort).
      try {
        await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'shop-order',
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            fields: {
              'Items': cart.map(i => `${i.productName} — ${i.label} — ${i.priceMode === 'quote' || i.priceTotal == null ? 'Quote' : fmtMoney(i.priceTotal)}`).join(' | '),
              'Estimated Subtotal': `${fmtMoney(subtotal)}${hasQuote ? ' + quote items' : ''}`,
              'Payment': 'Collected when production begins',
            },
          }),
        });
      } catch {}

      setStep('done');
      onCheckoutDone();
    } catch {
      setSubmitErr('Something went wrong. Email us at visualizeserviceco@gmail.com.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ps-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ps-drawer">
        <div className="ps-drawer-head">
          <h3 className="ps-drawer-title">
            {step === 'cart' ? `Cart (${cart.length})` : step === 'checkout' ? 'Your Info' : 'Order Placed'}
          </h3>
          <button type="button" className="ps-modal-close" onClick={onClose}><XClose width={20} height={20} /></button>
        </div>

        {step === 'cart' && (
          <>
            {cart.length === 0 ? (
              <div className="ps-drawer-empty">
                <Package width={40} height={40} />
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="ps-drawer-items">
                  {cart.map(item => (
                    <div key={item.cartId} className="ps-cart-item">
                      <div className="ps-ci-icon">{ICONS[item.productId]}</div>
                      <div className="ps-ci-body">
                        <p className="ps-ci-name">{item.productName}</p>
                        <p className="ps-ci-label">{item.label}</p>
                      </div>
                      <div className="ps-ci-right">
                        <span className="ps-ci-price">
                          {item.priceMode === 'quote' || item.priceTotal == null ? 'Quote' : fmtMoney(item.priceTotal)}
                        </span>
                        <button type="button" className="ps-ci-remove" onClick={() => onRemove(item.cartId)}>
                          <Trash01 width={14} height={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="ps-drawer-foot">
                  {(() => {
                    const subtotal = cart.reduce((s, i) => s + (i.priceMode !== 'quote' && i.priceTotal != null ? i.priceTotal : 0), 0);
                    const hasQuote = cart.some(i => i.priceMode === 'quote' || i.priceTotal == null);
                    return (
                      <div className="ps-subtotal-row">
                        <span>Estimated subtotal</span>
                        <span className="ps-subtotal-amt">
                          {fmtMoney(subtotal)}{hasQuote ? ' + quote' : ''}
                        </span>
                      </div>
                    );
                  })()}
                  <p className="ps-drawer-note">Quote items are priced after review. No payment is due today — payment is collected when production begins.</p>
                  <button type="button" className="ps-btn-primary" style={{ width: '100%' }} onClick={() => setStep('checkout')}>
                    Continue to Checkout <ArrowRight width={16} height={16} />
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {step === 'checkout' && (
          <>
            <div className="ps-drawer-items" style={{ gap: 16, padding: '20px 24px' }}>
              {/* Order recap */}
              <div className="ps-checkout-recap">
                <p className="ps-cr-label">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
                {cart.map(item => <p key={item.cartId} className="ps-cr-item">{item.productName}</p>)}
              </div>

              <div className="ps-co-field">
                <label className="ps-mlabel">Full Name {errors.name && <span className="ps-merr">{errors.name}</span>}</label>
                <input className={`ps-minput${errors.name ? ' is-err' : ''}`} placeholder="Carlos Mendez" value={form.name} onChange={e => { setF('name', e.target.value); if (errors.name) setErrors(p => ({ ...p, name: '' })); }} />
              </div>
              <div className="ps-co-field">
                <label className="ps-mlabel">Email {errors.email && <span className="ps-merr">{errors.email}</span>}</label>
                <input className={`ps-minput${errors.email ? ' is-err' : ''}`} type="email" placeholder="you@example.com" value={form.email} onChange={e => { setF('email', e.target.value); if (errors.email) setErrors(p => ({ ...p, email: '' })); }} />
              </div>
              <div className="ps-co-field">
                <label className="ps-mlabel">Phone <span style={{ fontWeight: 400, color: 'var(--ps-muted)' }}>(optional)</span></label>
                <input className="ps-minput" type="tel" placeholder="(302) 555-0123" value={form.phone} onChange={e => setF('phone', e.target.value)} />
              </div>

              {submitErr && <p className="ps-merr" style={{ fontSize: '0.8rem' }}>{submitErr}</p>}
            </div>
            <div className="ps-drawer-foot">
              <button type="button" className="ps-back-btn" onClick={() => setStep('cart')}>← Back</button>
              <button type="button" className="ps-btn-primary" style={{ flex: 1 }} onClick={handleCheckout} disabled={submitting}>
                {submitting ? <span className="ps-spinner" /> : <><Send01 width={15} height={15} /> Place Order</>}
              </button>
            </div>
          </>
        )}

        {step === 'done' && (
          <div className="ps-drawer-empty" style={{ gap: 16 }}>
            <div className="ps-done-icon"><Check width={30} height={30} /></div>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--ps-text)' }}>Order received.</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--ps-muted)', textAlign: 'center', lineHeight: 1.6 }}>
              Rob will follow up within 24 hours to confirm details. Payment is collected when production begins.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Label builder ──────────────────────────────────────────────── */

function buildLabel(product, vals) {
  const parts = [];
  if (vals.qty)        parts.push(`Qty: ${vals.qty}`);
  if (vals.size)       parts.push(vals.size, 'Glossy');
  if (vals.sheetSize)  parts.push(vals.sheetSize);
  if (vals.vinylSize)  parts.push(vals.vinylSize);
  if (vals.cardFinish) parts.push(vals.cardFinish);
  if (vals.vinylColor) parts.push(vals.vinylColor);
  if (vals.text)       parts.push(`"${vals.text}"`);
  if (vals.artworkFile) parts.push(`File: ${vals.artworkFile.name}`);
  return parts.join(' · ') || product.name;
}

/* ─── Product Card ───────────────────────────────────────────────── */

function ProductCard({ product, onCustomize }) {
  return (
    <div className="ps-card">
      {product.popular && <span className="ps-card-badge ps-card-badge--pop"><Star01 width={10} height={10} /> Popular</span>}
      {product.badge && !product.popular && <span className="ps-card-badge ps-card-badge--price">{product.badge}</span>}
      <div className="ps-card-icon">{ICONS[product.id]}</div>
      <div className="ps-card-body">
        <h3 className="ps-card-name">{product.name}</h3>
        <p className="ps-card-desc">{product.desc}</p>
      </div>
      <div className="ps-card-foot">
        <span className="ps-card-price">{priceLabelForCard(product)}</span>
        <button type="button" className="ps-card-btn" onClick={() => onCustomize(product)}>
          Customize <ChevronRight width={14} height={14} />
        </button>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */

export default function Prints() {
  const [cat, setCat]         = useState('all');
  const [cart, setCart]       = useState(() => { try { return JSON.parse(localStorage.getItem('vz_cart') || '[]'); } catch { return []; } });
  const [modal, setModal]     = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  const saveCart = useCallback((c) => {
    const serializable = c.map(item => ({ ...item, vals: { ...item.vals, artworkFile: null } }));
    try { localStorage.setItem('vz_cart', JSON.stringify(serializable)); } catch {}
  }, []);

  const addToCart = (item) => {
    const next = [...cart, item];
    setCart(next);
    saveCart(next);
    setModal(null);
    setCartOpen(true);
  };

  const removeFromCart = (cartId) => {
    const next = cart.filter(i => i.cartId !== cartId);
    setCart(next);
    saveCart(next);
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem('vz_cart');
  };

  const visible = cat === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.cat === cat);

  return (
    <div className="ps-page">

      {/* Header */}
      <header className="ps-header">
        <div className="ps-header-inner">
          <div className="ps-header-brand">
            <img src="/VisualizeWordmark.png" alt="Visualize Studio" className="ps-wordmark" />
          </div>
          <div className="ps-header-center">
            <span className="ps-header-title">Print Shop</span>
          </div>
          <button type="button" className="ps-cart-toggle" onClick={() => setCartOpen(true)}>
            <ShoppingCart01 width={18} height={18} />
            Cart
            {cart.length > 0 && <span className="ps-cart-count">{cart.length}</span>}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="ps-hero">
        <div className="ps-hero-inner">
          <p className="ps-hero-eyebrow">Custom Print Services</p>
          <h1 className="ps-hero-title">Your brand,<br />on everything.</h1>
          <p className="ps-hero-sub">Stickers, vinyl, and print — designed and produced for your business. Select a product, customize it, and we'll handle the rest.</p>
        </div>
        <div className="ps-hero-visual" aria-hidden="true">
          {[...Array(6)].map((_, i) => <div key={i} className="ps-hero-dot" style={{ '--i': i }} />)}
        </div>
      </section>

      {/* Category tabs */}
      <div className="ps-cat-bar">
        {CATS.map(c => (
          <Chip key={c.id} label={c.label} selected={cat === c.id} onClick={() => setCat(c.id)} />
        ))}
      </div>

      {/* Product grid */}
      <main className="ps-grid-wrap">
        <div className="ps-grid">
          {visible.map(p => (
            <ProductCard key={p.id} product={p} onCustomize={prod => setModal(prod)} />
          ))}
        </div>
      </main>

      {/* Footer note */}
      <footer className="ps-foot">
        <p>No payment is due at checkout — payment is collected when production begins. Final pricing confirmed after review.<br />Questions? Call <a href="tel:+12159082000">(215) 908-2000</a> or email visualizeserviceco@gmail.com</p>
      </footer>

      {/* Customize modal */}
      {modal && (
        <CustomizeModal
          product={modal}
          onClose={() => setModal(null)}
          onAdd={addToCart}
        />
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          onRemove={removeFromCart}
          onClose={() => setCartOpen(false)}
          onCheckoutDone={clearCart}
        />
      )}

      <style>{psStyles}</style>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────── */

const psStyles = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .ps-page {
    min-height: 100vh;
    background: #0d0d0f;
    --ps-bg:      #0d0d0f;
    --ps-surface: #141418;
    --ps-card:    #1a1a22;
    --ps-border:  rgba(255,255,255,0.09);
    --ps-text:    #f2f2f3;
    --ps-sub:     #9a9aab;
    --ps-muted:   #5e5e6e;
    --ps-brand:   #d44c43;
    --ps-brand-dim: rgba(212,76,67,0.12);
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
    color: var(--ps-text);
  }

  /* ── Header ──────────────────────────── */
  .ps-header {
    position: sticky; top: 0; z-index: 50;
    background: rgba(13,13,15,0.88);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--ps-border);
  }
  .ps-header-inner {
    max-width: 1100px; margin: 0 auto;
    padding: 14px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .ps-wordmark { height: 18px; filter: brightness(0) invert(1); }
  .ps-header-center { position: absolute; left: 50%; transform: translateX(-50%); }
  .ps-header-title { font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ps-sub); }
  .ps-cart-toggle {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 16px; border-radius: 999px;
    border: 1px solid var(--ps-border); background: var(--ps-surface);
    color: var(--ps-text); font-size: 0.875rem; font-weight: 600;
    cursor: pointer; font-family: inherit; position: relative;
    transition: border-color 0.18s, background 0.18s;
  }
  .ps-cart-toggle:hover { border-color: rgba(212,76,67,0.5); background: var(--ps-brand-dim); }
  .ps-cart-count {
    position: absolute; top: -7px; right: -7px;
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--ps-brand); color: #fff;
    font-size: 0.65rem; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }

  /* ── Hero ────────────────────────────── */
  .ps-hero {
    padding: 72px 24px 56px; max-width: 1100px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 40px;
  }
  .ps-hero-inner { max-width: 520px; }
  .ps-hero-eyebrow {
    font-size: 0.7rem; font-weight: 800; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--ps-brand); margin-bottom: 16px;
  }
  .ps-hero-title {
    font-size: clamp(2.2rem, 5vw, 3.4rem); font-weight: 900;
    letter-spacing: -0.04em; line-height: 1.06; color: var(--ps-text);
    margin-bottom: 18px;
  }
  .ps-hero-sub { font-size: 1rem; color: var(--ps-sub); line-height: 1.7; max-width: 420px; }
  .ps-hero-visual {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 10px; opacity: 0.4;
  }
  .ps-hero-dot {
    width: 28px; height: 28px; border-radius: 6px;
    background: var(--ps-brand);
    opacity: calc(0.3 + var(--i) * 0.12);
    animation: dotPulse 2.5s ease-in-out infinite;
    animation-delay: calc(var(--i) * 0.3s);
  }
  @keyframes dotPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(0.85)} }
  @media(max-width:600px){ .ps-hero{grid-template-columns:1fr;} .ps-hero-visual{display:none;} .ps-hero{padding:48px 20px 36px;} }

  /* ── Category chips ──────────────────── */
  .ps-cat-bar {
    display: flex; gap: 8px; padding: 0 24px 24px;
    max-width: 1100px; margin: 0 auto; overflow-x: auto; scrollbar-width: none;
  }
  .ps-cat-bar::-webkit-scrollbar { display: none; }
  .ps-chip {
    padding: 7px 18px; border-radius: 999px; font-size: 0.875rem; font-weight: 600;
    border: 1px solid var(--ps-border); background: var(--ps-surface);
    color: var(--ps-sub); cursor: pointer; white-space: nowrap; font-family: inherit;
    transition: all 0.18s;
  }
  .ps-chip:hover { border-color: rgba(212,76,67,0.4); color: var(--ps-text); }
  .ps-chip.is-sel { background: var(--ps-brand); border-color: var(--ps-brand); color: #fff; }

  /* ── Product grid ────────────────────── */
  .ps-grid-wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px 48px; }
  .ps-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .ps-card {
    background: var(--ps-card); border: 1px solid var(--ps-border);
    border-radius: 16px; padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
    position: relative; overflow: hidden;
    transition: border-color 0.2s, transform 0.15s, box-shadow 0.2s;
  }
  .ps-card:hover {
    border-color: rgba(212,76,67,0.3);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  }
  .ps-card-badge {
    position: absolute; top: 16px; right: 16px;
    font-size: 0.65rem; font-weight: 800; letter-spacing: 0.06em;
    padding: 3px 9px; border-radius: 999px;
    display: flex; align-items: center; gap: 4px;
  }
  .ps-card-badge--pop { background: rgba(212,76,67,0.18); color: var(--ps-brand); border: 1px solid rgba(212,76,67,0.3); }
  .ps-card-badge--price { background: rgba(201,161,42,0.15); color: #c9a12a; border: 1px solid rgba(201,161,42,0.3); }
  .ps-card-icon {
    width: 52px; height: 52px; color: var(--ps-brand);
    display: flex; align-items: center; justify-content: center;
    background: var(--ps-brand-dim); border-radius: 12px;
    flex-shrink: 0;
  }
  .ps-card-icon svg { width: 28px; height: 28px; }
  .ps-card-body { flex: 1; }
  .ps-card-name { font-size: 1rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ps-text); margin-bottom: 6px; }
  .ps-card-desc { font-size: 0.8375rem; color: var(--ps-sub); line-height: 1.6; }
  .ps-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ps-card-price { font-size: 0.875rem; font-weight: 700; color: var(--ps-sub); }
  .ps-card-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 8px 18px; border-radius: 999px;
    background: var(--ps-brand); color: #fff;
    border: none; font-size: 0.84rem; font-weight: 700;
    cursor: pointer; font-family: inherit;
    transition: opacity 0.18s, transform 0.15s;
  }
  .ps-card-btn:hover { opacity: 0.88; transform: scale(1.03); }

  /* ── Overlay ─────────────────────────── */
  .ps-overlay {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  /* ── Modal ───────────────────────────── */
  .ps-modal {
    background: var(--ps-surface); border-top: 1px solid var(--ps-border);
    border-radius: 24px 24px 0 0; width: 100%; max-width: 560px;
    max-height: 90vh; display: flex; flex-direction: column;
    animation: slideUp 0.22s cubic-bezier(0.32,0.72,0,1);
  }
  @keyframes slideUp { from{transform:translateY(32px);opacity:0} to{transform:translateY(0);opacity:1} }
  .ps-modal-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 22px 24px 18px; border-bottom: 1px solid var(--ps-border); flex-shrink: 0;
  }
  .ps-modal-eyebrow { font-size: 0.75rem; font-weight: 700; color: var(--ps-brand); margin-bottom: 4px; letter-spacing: 0.04em; }
  .ps-modal-title { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.025em; color: var(--ps-text); }
  .ps-modal-close {
    width: 34px; height: 34px; border-radius: 50%;
    border: 1px solid var(--ps-border); background: var(--ps-card);
    color: var(--ps-sub); cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 2px;
    transition: background 0.15s;
  }
  .ps-modal-close:hover { background: rgba(255,255,255,0.08); }
  .ps-modal-body { flex: 1; overflow-y: auto; padding: 22px 24px; display: flex; flex-direction: column; gap: 22px; }
  .ps-modal-foot { padding: 16px 24px; border-top: 1px solid var(--ps-border); flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .ps-price-box { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .ps-price-amt { font-size: 1.375rem; font-weight: 800; letter-spacing: -0.03em; color: var(--ps-text); line-height: 1.1; }
  .ps-price-amt--dim { font-size: 1rem; font-weight: 600; color: var(--ps-muted); }
  .ps-price-note { font-size: 0.72rem; color: var(--ps-muted); line-height: 1.4; }
  .ps-modal-foot .ps-btn-primary { flex-shrink: 0; }

  /* ── Modal fields ────────────────────── */
  .ps-mfield { display: flex; flex-direction: column; gap: 8px; }
  .ps-mfield.is-err .ps-opt,
  .ps-mfield.is-err .ps-minput,
  .ps-mfield.is-err .ps-swatch { outline: 1px solid var(--ps-brand); }
  .ps-mlabel { font-size: 0.875rem; font-weight: 700; color: var(--ps-text); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ps-merr { font-size: 0.75rem; font-weight: 600; color: var(--ps-brand); }
  .ps-mhint { font-size: 0.78rem; color: var(--ps-muted); line-height: 1.55; }
  .ps-minput, .ps-mtextarea {
    width: 100%; padding: 11px 14px; border-radius: 10px;
    border: 1.5px solid var(--ps-border); background: var(--ps-card);
    color: var(--ps-text); font-family: inherit; font-size: 0.9375rem; outline: none;
    transition: border-color 0.18s;
  }
  .ps-minput::placeholder, .ps-mtextarea::placeholder { color: var(--ps-muted); }
  .ps-minput:focus, .ps-mtextarea:focus { border-color: var(--ps-brand); }
  .ps-minput.is-err { border-color: var(--ps-brand); }
  .ps-mtextarea { resize: vertical; min-height: 80px; }
  .ps-opt-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .ps-opt {
    padding: 7px 14px; border-radius: 8px;
    border: 1.5px solid var(--ps-border); background: var(--ps-card);
    color: var(--ps-sub); font-size: 0.84rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .ps-opt:hover { border-color: rgba(212,76,67,0.4); color: var(--ps-text); }
  .ps-opt--size { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .ps-opt-price { font-size: 0.68rem; font-weight: 700; color: var(--ps-muted); }
  .ps-opt.is-sel .ps-opt-price { color: var(--ps-text); opacity: 0.75; }
  .ps-opt.is-sel { border-color: var(--ps-brand); background: var(--ps-brand-dim); color: var(--ps-text); }
  .ps-color-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .ps-swatch {
    width: 32px; height: 32px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.12); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .ps-swatch:last-child { width: auto; border-radius: 8px; padding: 0 12px; font-size: 0.78rem; font-weight: 600; color: var(--ps-sub); background: var(--ps-card); }
  .ps-swatch.is-sel { transform: scale(1.15); box-shadow: 0 0 0 3px var(--ps-brand); }
  .ps-upload-zone {
    border: 1.5px dashed var(--ps-border); border-radius: 10px;
    padding: 22px; display: flex; align-items: center; justify-content: center;
    gap: 10px; color: var(--ps-sub); cursor: pointer; font-size: 0.875rem;
    text-align: center; line-height: 1.55;
    transition: border-color 0.18s, background 0.18s;
  }
  .ps-upload-zone:hover { border-color: rgba(212,76,67,0.5); background: var(--ps-brand-dim); }
  .ps-upload-name { font-weight: 600; color: #22c55e; }
  .ps-upload-clear { background: none; border: none; color: var(--ps-muted); font-size: 0.78rem; cursor: pointer; text-decoration: underline; font-family: inherit; margin-left: 8px; }

  /* ── Cart drawer ─────────────────────── */
  .ps-drawer {
    background: var(--ps-surface); border-top: 1px solid var(--ps-border);
    border-radius: 24px 24px 0 0; width: 100%; max-width: 480px;
    max-height: 90vh; display: flex; flex-direction: column;
    animation: slideUp 0.22s cubic-bezier(0.32,0.72,0,1);
  }
  .ps-drawer-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px 18px; border-bottom: 1px solid var(--ps-border); flex-shrink: 0;
  }
  .ps-drawer-title { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em; color: var(--ps-text); }
  .ps-drawer-items { flex: 1; overflow-y: auto; padding: 16px 24px; display: flex; flex-direction: column; gap: 10px; }
  .ps-drawer-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px 24px; color: var(--ps-muted); text-align: center; }
  .ps-drawer-foot { padding: 18px 24px; border-top: 1px solid var(--ps-border); flex-shrink: 0; display: flex; flex-direction: column; gap: 12px; }
  .ps-drawer-note { font-size: 0.775rem; color: var(--ps-muted); line-height: 1.5; text-align: center; }
  .ps-cart-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border-radius: 10px;
    border: 1px solid var(--ps-border); background: var(--ps-card);
  }
  .ps-ci-icon { width: 36px; height: 36px; flex-shrink: 0; color: var(--ps-brand); }
  .ps-ci-icon svg { width: 36px; height: 36px; }
  .ps-ci-body { flex: 1; min-width: 0; }
  .ps-ci-name { font-size: 0.875rem; font-weight: 700; color: var(--ps-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ps-ci-label { font-size: 0.775rem; color: var(--ps-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ps-ci-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .ps-ci-price { font-size: 0.875rem; font-weight: 800; color: var(--ps-text); white-space: nowrap; }
  .ps-ci-remove { background: none; border: none; color: var(--ps-muted); cursor: pointer; padding: 4px; border-radius: 6px; flex-shrink: 0; transition: color 0.15s, background 0.15s; }
  .ps-ci-remove:hover { color: var(--ps-brand); background: var(--ps-brand-dim); }
  .ps-subtotal-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.9rem; font-weight: 600; color: var(--ps-sub); padding-bottom: 4px; }
  .ps-subtotal-amt { font-size: 1.05rem; font-weight: 800; color: var(--ps-text); letter-spacing: -0.02em; }

  /* ── Checkout fields ─────────────────── */
  .ps-checkout-recap { background: var(--ps-card); border-radius: 10px; padding: 14px; border: 1px solid var(--ps-border); }
  .ps-cr-label { font-size: 0.7rem; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ps-muted); margin-bottom: 6px; }
  .ps-cr-item { font-size: 0.875rem; color: var(--ps-sub); line-height: 1.6; }
  .ps-co-field { display: flex; flex-direction: column; gap: 7px; }
  .ps-back-btn { background: none; border: 1px solid var(--ps-border); border-radius: 8px; color: var(--ps-sub); padding: 10px 18px; font-family: inherit; font-size: 0.875rem; cursor: pointer; transition: background 0.15s; }
  .ps-back-btn:hover { background: rgba(255,255,255,0.05); }

  /* ── CTA buttons ─────────────────────── */
  .ps-btn-primary {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px 24px; border-radius: 12px;
    background: var(--ps-brand); color: #fff;
    border: none; font-size: 0.9375rem; font-weight: 700; letter-spacing: -0.01em;
    cursor: pointer; font-family: inherit;
    box-shadow: 0 4px 20px rgba(212,76,67,0.3);
    transition: opacity 0.18s, transform 0.15s;
  }
  .ps-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .ps-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ── Misc ────────────────────────────── */
  .ps-done-icon {
    width: 64px; height: 64px; border-radius: 50%;
    background: rgba(34,197,94,0.12); border: 1.5px solid rgba(34,197,94,0.3);
    display: flex; align-items: center; justify-content: center; color: #22c55e;
  }
  .ps-done-banner {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 300;
    background: #14532d; border: 1px solid rgba(34,197,94,0.3); color: #86efac;
    padding: 12px 20px; border-radius: 12px;
    display: flex; align-items: center; gap: 10px; font-size: 0.875rem; font-weight: 600;
    white-space: nowrap; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  .ps-done-banner button { background: none; border: none; color: inherit; cursor: pointer; display: flex; align-items: center; margin-left: 4px; }
  .ps-spinner {
    width: 18px; height: 18px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
    animation: spin 0.6s linear infinite;
  }
  @keyframes spin { to{transform:rotate(360deg)} }
  .ps-foot { padding: 32px 24px 48px; text-align: center; color: var(--ps-muted); font-size: 0.8rem; line-height: 1.7; }
  .ps-foot a { color: var(--ps-sub); text-decoration: underline; }
  @media(max-width:480px) {
    .ps-header-center { display: none; }
    .ps-grid { grid-template-columns: 1fr; }
    .ps-modal, .ps-drawer { border-radius: 20px 20px 0 0; max-height: 92vh; }
    .ps-hero-title { font-size: 2rem; }
  }
`;
