import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  IconInfoCircle, IconX, IconCalendar, IconLogout, IconArrowLeft,
  IconLogin, IconUserPlus, IconPackage, IconArrowRight,
  IconLayoutDashboard, IconReceipt, IconPlus, IconCheck,
  IconClock, IconAlertCircle, IconChevronRight, IconLock,
  IconRefresh, IconExternalLink, IconLayoutGrid, IconList,
  IconClipboardList, IconPencil, IconCircleCheck,
} from '@tabler/icons-react';
import SplashScreen from '../components/SplashScreen';

const CLIENTS_KEY  = 'vz_clients';
const ORDERS_KEY   = 'vz_print_orders';
const INVOICES_KEY = 'vz_invoices';
const INTAKE_KEY   = 'vz_intake_forms';
const SESSION_KEY  = 'vz_portal_session';
const CALENDLY_URL = 'https://calendly.com/contactvisualize/studio-meeting?hide_gdpr_banner=1';

const STATUS_META = {
  pending:   { label: 'Pending Review', color: '#f59e0b', desc: 'Your order has been received and is waiting to be reviewed.' },
  reviewed:  { label: 'Reviewed',       color: '#60a5fa', desc: 'Your order has been reviewed. A quote is being prepared.' },
  approved:  { label: 'Approved',       color: '#a78bfa', desc: 'Your order is approved and moving forward.' },
  sent:      { label: 'Quote Sent',     color: '#34d399', desc: 'A quote has been sent to your email. Check your inbox.' },
  completed: { label: 'Completed',      color: '#22c55e', desc: 'Your order is complete. Thank you!' },
};

const INVOICE_STATUS = {
  unpaid:  { label: 'Unpaid',                color: '#f59e0b', icon: IconClock },
  upfront: { label: 'Upfront Payment Paid',  color: '#60a5fa', icon: IconCheck },
  paid:    { label: 'Paid in Full',          color: '#22c55e', icon: IconCheck },
  overdue: { label: 'Overdue',               color: '#ef4444', icon: IconAlertCircle },
};

function getClients() {
  try { return JSON.parse(localStorage.getItem(CLIENTS_KEY) || '[]'); } catch { return []; }
}
function saveClients(c) { localStorage.setItem(CLIENTS_KEY, JSON.stringify(c)); }
function getOrders() {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); } catch { return []; }
}
function getInvoices() {
  try { return JSON.parse(localStorage.getItem(INVOICES_KEY) || '[]'); } catch { return []; }
}
function getIntakeForms() {
  try { return JSON.parse(localStorage.getItem(INTAKE_KEY) || '[]'); } catch { return []; }
}
function hashPassword(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
  return btoa(`vz:${h}:${pw.length}`);
}
function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ── Calendly modal ────────────────────────────────────── */
function CalendlyModal({ onClose }) {
  useEffect(() => {
    if (!document.querySelector('script[src*="calendly.com"]')) {
      const s = document.createElement('script');
      s.src = 'https://assets.calendly.com/assets/external/widget.js';
      s.async = true;
      document.body.appendChild(s);
    }
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="cp-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cp-modal">
        <div className="cp-modal-header">
          <h3 className="cp-modal-title">Book a Meeting</h3>
          <button className="cp-modal-close" onClick={onClose} aria-label="Close">
            <IconX size={18} stroke={2} />
          </button>
        </div>
        <div className="calendly-inline-widget" data-url={CALENDLY_URL} style={{ minWidth: '320px', height: '620px' }} />
      </div>
    </div>
  );
}

/* ── Auth screen ─────────────────────────────────────── */
function AuthScreen({ onAuth }) {
  const [mode, setMode]       = useState('login');
  const [username, setUsername] = useState('');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [error, setError]     = useState('');
  const [shaking, setShake]   = useState(false);

  const shake = (msg) => { setError(msg); setShake(true); setTimeout(() => setShake(false), 500); };

  const submit = (e) => {
    e.preventDefault(); setError('');
    const clients = getClients();
    if (mode === 'signup') {
      const uname = username.trim().toLowerCase();
      if (!uname) return shake('Please choose a username.');
      if (/\s/.test(uname)) return shake('Username cannot contain spaces.');
      if (pw.length < 6) return shake('Password must be at least 6 characters.');
      if (email.trim() && !/\S+@\S+\.\S+/.test(email)) return shake('Enter a valid email address or leave it blank.');
      if (clients.find(c => (c.username || '').toLowerCase() === uname))
        return shake('That username is taken. Try a different one or sign in.');
      const displayName = name.trim() || uname;
      const client = { id: Date.now(), username: uname, name: displayName, email: email.toLowerCase().trim() || null, passwordHash: hashPassword(pw), password: pw, createdAt: new Date().toISOString() };
      saveClients([...clients, client]);
      const session = { id: client.id, username: client.username, name: client.name, email: client.email };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      onAuth(session);
    } else {
      const uname = username.trim().toLowerCase();
      if (!uname) return shake('Please enter your username.');
      if (!pw) return shake('Please enter your password.');
      const client = clients.find(c =>
        (c.username && c.username.toLowerCase() === uname) ||
        (c.email    && c.email.toLowerCase()    === uname) ||
        (c.name     && c.name.toLowerCase()     === uname)
      );
      if (!client) return shake('No account found with that username.');
      if (client.passwordHash !== hashPassword(pw)) return shake('Incorrect password.');
      const session = {
        id:       client.id,
        username: client.username || client.email || client.name || uname,
        name:     client.name     || client.username || uname,
        email:    client.email    || null,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      onAuth(session);
    }
  };

  const switchMode = (m) => { setMode(m); setError(''); setUsername(''); setName(''); setEmail(''); setPw(''); };

  return (
    <div className="cp-auth-wrap">
      <div className="cp-auth-card">
        <div className="cp-auth-logo"><img src="/logo.svg" alt="Visualize Studio" style={{ height: 32 }} /></div>
        <h1 className="cp-auth-title">{mode === 'login' ? 'Client Portal' : 'Create an Account'}</h1>
        <p className="cp-auth-sub">
          {mode === 'login' ? 'Sign in with your username and password.' : 'Create an account to track orders, view invoices, and book meetings.'}
        </p>
        {mode === 'signup' && (
          <div className="cp-auth-notice">
            <IconInfoCircle size={15} stroke={1.5} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Use a <strong>new password</strong> created just for this portal — not one you use elsewhere.</span>
          </div>
        )}
        <form className={`cp-auth-form ${shaking ? 'cp-shake' : ''}`} onSubmit={submit} noValidate>
          <div className="cp-field">
            <label className="cp-label">Username</label>
            <input className="cp-input" value={username} onChange={e => { setUsername(e.target.value); setError(''); }} placeholder={mode === 'signup' ? 'Choose a username (no spaces)' : 'Username or email'} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" />
            {mode === 'login' && <span className="cp-label-opt" style={{ marginTop: 3 }}>Previously signed up with email? Enter your email address here.</span>}
          </div>
          {mode === 'signup' && (
            <>
              <div className="cp-field">
                <label className="cp-label">Display Name <span className="cp-label-opt">(optional)</span></label>
                <input className="cp-input" value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="How we'll address you" autoComplete="name" />
              </div>
              <div className="cp-field">
                <label className="cp-label">Email <span className="cp-label-opt">(optional — for order notifications)</span></label>
                <input className="cp-input" type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="you@example.com" autoComplete="email" />
              </div>
            </>
          )}
          <div className="cp-field">
            <label className="cp-label">Password</label>
            <input className="cp-input" type="password" value={pw} onChange={e => { setPw(e.target.value); setError(''); }} placeholder={mode === 'signup' ? 'Create a password (6+ chars)' : 'Your password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </div>
          {error && <p className="cp-auth-error">{error}</p>}
          <button type="submit" className="btn btn-primary cp-auth-btn">
            {mode === 'login' ? <IconLogin size={16} stroke={1.8} /> : <IconUserPlus size={16} stroke={1.8} />}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
        <p className="cp-auth-switch">
          {mode === 'login'
            ? <> Don&apos;t have an account?{' '}<button type="button" className="cp-switch-btn" onClick={() => switchMode('signup')}>Sign up</button></>
            : <> Already have an account?{' '}<button type="button" className="cp-switch-btn" onClick={() => switchMode('login')}>Sign in</button></>}
        </p>
        <Link to="/" className="cp-back-link"><IconArrowLeft size={13} stroke={2} />Back to site</Link>
      </div>
    </div>
  );
}

/* ── Status timeline ──────────────────────────────────── */
function StatusTimeline({ status }) {
  const steps = ['pending', 'reviewed', 'approved', 'sent', 'completed'];
  const current = steps.indexOf(status || 'pending');
  return (
    <div className="cp-timeline">
      {steps.map((s, i) => {
        const meta   = STATUS_META[s];
        const done   = i < current;
        const active = i === current;
        return (
          <div key={s} className={`cp-tl-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
            <div className="cp-tl-left">
              <div className="cp-tl-dot" style={active || done ? { '--sc': meta.color } : {}}>
                {done && <svg viewBox="0 0 12 12" fill="none" width="10" height="10"><path d="M2 6l2.5 2.5L10 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              {i < steps.length - 1 && <div className="cp-tl-line" />}
            </div>
            <div className="cp-tl-body">
              <span className="cp-tl-label" style={active ? { color: meta.color } : {}}>{meta.label}</span>
              {active && <p className="cp-tl-desc">{meta.desc}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Forms view ─────────────────────────────────────── */
function FormsView({ user }) {
  const allForms = getIntakeForms();
  const myForms  = allForms.filter(f =>
    (f.clientId && f.clientId === user.id) ||
    (user.email && f.clientEmail?.toLowerCase() === user.email?.toLowerCase())
  );

  const TYPE_LABELS = { website: 'Website Design' };

  if (myForms.length === 0) {
    return (
      <div className="cp-view">
        <div className="cp-view-header cp-view-header--row">
          <div>
            <h1 className="cp-view-title">My Forms</h1>
            <p className="cp-view-sub">Project briefs submitted to Visualize Studio</p>
          </div>
          <Link to="/intake/website" className="btn btn-primary"
            style={{ fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconPlus size={15} stroke={2} />New Brief
          </Link>
        </div>
        <div className="cp-panel cp-panel-empty-lg">
          <IconClipboardList size={40} stroke={1.2} />
          <h3>No briefs submitted yet</h3>
          <p>Fill out a project brief so we can understand your needs and get started.</p>
          <Link to="/intake/website" className="btn btn-primary" style={{ fontSize: '0.875rem' }}>
            <IconPlus size={15} stroke={2} />Start Website Brief
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-view">
      <div className="cp-view-header cp-view-header--row">
        <div>
          <h1 className="cp-view-title">My Forms</h1>
          <p className="cp-view-sub">{myForms.length} brief{myForms.length !== 1 ? 's' : ''} submitted</p>
        </div>
        <Link to="/intake/website" className="btn btn-primary"
          style={{ fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconPlus size={15} stroke={2} />New Brief
        </Link>
      </div>
      <div className="cp-order-list">
        {myForms.map(form => {
          const isEdited = form.editHistory?.length > 0;
          const label    = TYPE_LABELS[form.type] || form.type;
          return (
            <div key={form.id} className="cp-order-card" style={{ cursor: 'default' }}>
              <div className="cp-order-card-top">
                <span className="cp-order-card-type">{label}</span>
                <span className="cp-order-card-time">{timeAgo(form.submittedAt)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="cp-tag">Submitted {formatDate(form.submittedAt)}</span>
                {isEdited && (
                  <span className="cp-tag" style={{ borderColor: '#60a5fa', color: '#2563eb' }}>
                    Edited {formatDate(form.editHistory.at(-1).editedAt)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <Link to={`/intake/website?edit=${form.id}`} className="btn btn-secondary"
                  style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <IconPencil size={13} stroke={1.8} />Edit Submission
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Sidebar ───────────────────────────────────────────── */
function Sidebar({ tab, setTab, user, onLogout, onCalendly }) {
  const nav = [
    { id: 'dashboard', label: 'Dashboard',  icon: IconLayoutDashboard },
    { id: 'orders',    label: 'My Orders',  icon: IconPackage },
    { id: 'invoices',  label: 'Invoices',   icon: IconReceipt },
    { id: 'meetings',  label: 'Meetings',   icon: IconCalendar },
    { id: 'forms',     label: 'My Briefs',  icon: IconClipboardList },
  ];
  return (
    <aside className="cp-sidebar">
      <div className="cp-sidebar-brand">
        <img src="/logo.svg" alt="Visualize Studio" style={{ height: 28 }} />
        <span className="cp-sidebar-brand-label">Client Portal</span>
      </div>
      <nav className="cp-sidebar-nav">
        {nav.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button"
              className={`cp-nav-item ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={17} stroke={1.7} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="cp-sidebar-footer">
        <button type="button" className="cp-book-sidebar" onClick={onCalendly}>
          <IconCalendar size={16} stroke={1.8} />
          Book a Meeting
        </button>
        <div className="cp-sidebar-user">
          <div className="cp-sidebar-avatar">{(user.name || user.username || '?').charAt(0).toUpperCase()}</div>
          <div className="cp-sidebar-user-info">
            <span className="cp-sidebar-name">{user.name || user.username}</span>
            <span className="cp-sidebar-email">@{user.username || user.email || '—'}</span>
          </div>
          <button className="cp-sidebar-logout" onClick={onLogout} title="Sign out">
            <IconLogout size={15} stroke={1.6} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ── Dashboard view ────────────────────────────────────── */
function DashboardView({ user, orders, invoices, onCalendly, setTab }) {
  const unpaidInv = invoices.filter(i => i.status === 'unpaid' || i.status === 'overdue');

  const allItems = [
    ...orders.map(o => ({ ...o, _type: 'order' })),
    ...invoices.map(i => ({ ...i, _type: 'invoice' })),
  ].sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  return (
    <div className="cp-view">
      {/* My Drive header */}
      <div className="cp-drive-header">
        <h1 className="cp-drive-title">My Drive</h1>
        <div className="cp-drive-view-btns">
          <button type="button" className="cp-drive-view-btn" title="Grid view"><IconLayoutGrid size={16} stroke={1.8} /></button>
          <button type="button" className="cp-drive-view-btn" title="List view"><IconList size={16} stroke={1.8} /></button>
        </div>
      </div>

      {/* Quick Access */}
      <div className="cp-quick-access">
        <p className="cp-section-label">Quick Access</p>
        <div className="cp-qa-row">
          <button type="button" className="cp-qa-card" onClick={() => setTab('orders')}>
            <span className="cp-qa-icon" style={{ '--c': 'var(--brand)' }}><IconPackage size={20} stroke={1.7} /></span>
            <p className="cp-qa-label">My Orders</p>
            <p className="cp-qa-sub">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
          </button>
          <button type="button" className="cp-qa-card" onClick={() => setTab('invoices')}>
            <span className="cp-qa-icon" style={{ '--c': '#f59e0b' }}><IconReceipt size={20} stroke={1.7} /></span>
            <p className="cp-qa-label">Invoices</p>
            <p className="cp-qa-sub">{unpaidInv.length} due</p>
          </button>
          <button type="button" className="cp-qa-card" onClick={onCalendly}>
            <span className="cp-qa-icon" style={{ '--c': '#34d399' }}><IconCalendar size={20} stroke={1.7} /></span>
            <p className="cp-qa-label">Book a Meeting</p>
            <p className="cp-qa-sub">Schedule time</p>
          </button>
        </div>
      </div>

      {/* All Files */}
      <div className="cp-files-section">
        <p className="cp-section-label">All Files</p>
        {allItems.length === 0 ? (
          <div className="cp-files-empty">
            <IconPackage size={40} stroke={1.2} />
            <p>No files yet</p>
            <span>Your orders and invoices will appear here.</span>
          </div>
        ) : (
          <div className="cp-files-table">
            <div className="cp-files-head">
              <span>Name</span>
              <span>Type</span>
              <span>Status</span>
              <span>Date</span>
              <span></span>
            </div>
            {allItems.map((item, idx) => {
              if (item._type === 'order') {
                const meta = STATUS_META[item.status || 'pending'];
                return (
                  <button key={item.id || idx} type="button" className="cp-files-row" onClick={() => setTab('orders')}>
                    <div className="cp-files-name">
                      <span className="cp-files-icon cp-files-icon--order"><IconPackage size={15} stroke={1.7} /></span>
                      <span>{item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Custom Print'} Order</span>
                    </div>
                    <span><span className="cp-files-chip cp-files-chip--order">Order</span></span>
                    <span>
                      <span className="cp-status-pill" style={{ '--sc': meta.color }}>
                        <span className="cp-status-pill-dot" />{meta.label}
                      </span>
                    </span>
                    <span className="cp-files-date">{formatDate(item.date)}</span>
                    <span className="cp-files-action"><IconArrowRight size={14} stroke={2} /></span>
                  </button>
                );
              } else {
                const s = INVOICE_STATUS[item.status] || INVOICE_STATUS.unpaid;
                return (
                  <button key={item.id || idx} type="button" className="cp-files-row" onClick={() => setTab('invoices')}>
                    <div className="cp-files-name">
                      <span className="cp-files-icon cp-files-icon--invoice"><IconReceipt size={15} stroke={1.7} /></span>
                      <span>{item.invoiceNumber || `INV-${item.id}`}</span>
                    </div>
                    <span><span className="cp-files-chip cp-files-chip--invoice">Invoice</span></span>
                    <span>
                      <span className="cp-status-pill" style={{ '--sc': s.color }}>
                        <span className="cp-status-pill-dot" />{s.label}
                      </span>
                    </span>
                    <span className="cp-files-date">{formatDate(item.createdAt)}</span>
                    <span className="cp-files-action">
                      {item.stripeLink && item.status !== 'paid'
                        ? <a href={item.stripeLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="cp-files-pay">Pay</a>
                        : <IconArrowRight size={14} stroke={2} />}
                    </span>
                  </button>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Orders view ─────────────────────────────────────────── */
function OrdersView({ orders, onCalendly }) {
  const [selected, setSelected]         = useState(orders[0] || null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const selectedOrder = orders.find(o => o.id === selected?.id) || selected;

  const handleSelect = (o) => { setSelected(o); setMobileDetail(true); };

  return (
    <div className="cp-view">
      <div className="cp-view-header cp-view-header--row">
        <div>
          <h1 className="cp-view-title">My Orders</h1>
          <p className="cp-view-sub">{orders.length} order{orders.length !== 1 ? 's' : ''} total</p>
        </div>
        <Link to="/prints" className="btn btn-primary" style={{ fontSize: '0.875rem', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconPlus size={15} stroke={2} />New Order
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="cp-panel cp-panel-empty-lg">
          <IconPackage size={40} stroke={1.2} />
          <h3>No orders yet</h3>
          <p>Once you submit a quote request, your orders will appear here with live status updates.</p>
          <Link to="/prints" className="btn btn-primary" style={{ fontSize: '0.875rem' }}>
            <IconPlus size={15} stroke={2} />Place Your First Order
          </Link>
        </div>
      ) : (
        <div className={`cp-orders-layout ${mobileDetail ? 'cp-detail-open' : ''}`}>
          {/* Left list */}
          <div className="cp-order-list">
            {orders.map(o => {
              const meta = STATUS_META[o.status || 'pending'];
              return (
                <button key={o.id} type="button"
                  className={`cp-order-card ${selectedOrder?.id === o.id ? 'active' : ''}`}
                  onClick={() => handleSelect(o)}
                >
                  <div className="cp-order-card-top">
                    <span className="cp-order-card-type">{o.type ? o.type.charAt(0).toUpperCase() + o.type.slice(1) : 'Custom Print'}</span>
                    <span className="cp-order-card-time">{timeAgo(o.date)}</span>
                  </div>
                  <div className="cp-order-card-tags">
                    {o.shape    && <span className="cp-tag">{o.shape}</span>}
                    {o.size     && <span className="cp-tag">{o.size}</span>}
                    {o.quantity && <span className="cp-tag">{o.quantity} units</span>}
                    {o.finish   && <span className="cp-tag">{o.finish}</span>}
                  </div>
                  <span className="cp-status-pill" style={{ '--sc': meta.color }}>
                    <span className="cp-status-pill-dot" />
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right detail */}
          {selectedOrder && (
            <div className="cp-order-detail">
              <button className="cp-mobile-back-btn" onClick={() => setMobileDetail(false)}>
                <IconArrowLeft size={15} stroke={2} />All Orders
              </button>
              <div className="cp-detail-top">
                <div>
                  <h3 className="cp-detail-title">
                    {selectedOrder.type ? selectedOrder.type.charAt(0).toUpperCase() + selectedOrder.type.slice(1) : 'Custom Print'} Order
                  </h3>
                  <p className="cp-detail-date">Submitted {formatDate(selectedOrder.date)}</p>
                </div>
                <span className="cp-status-pill" style={{ '--sc': STATUS_META[selectedOrder.status || 'pending'].color }}>
                  <span className="cp-status-pill-dot" />
                  {STATUS_META[selectedOrder.status || 'pending'].label}
                </span>
              </div>

              <div className="cp-detail-section">
                <p className="cp-detail-section-label">Order Progress</p>
                <StatusTimeline status={selectedOrder.status || 'pending'} />
              </div>

              <div className="cp-detail-section">
                <p className="cp-detail-section-label">Order Details</p>
                <div className="cp-spec-grid">
                  {[
                    ['Type',     selectedOrder.type],
                    ['Shape',    selectedOrder.shape],
                    ['Size',     selectedOrder.size],
                    ['Quantity', selectedOrder.quantity ? `${selectedOrder.quantity} units` : null],
                    ['Finish',   selectedOrder.finish],
                    ['Design',   selectedOrder.design],
                  ].filter(([,v]) => v).map(([k, v]) => (
                    <div key={k} className="cp-spec-pair">
                      <span className="cp-spec-key">{k}</span>
                      <span className="cp-spec-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="cp-detail-section">
                  <p className="cp-detail-section-label">Notes</p>
                  <p className="cp-notes-text">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="cp-help-box">
                <div>
                  <p className="cp-help-title">Have a question?</p>
                  <p className="cp-help-sub">Book a meeting or call us directly.</p>
                </div>
                <div className="cp-help-actions">
                  <button type="button" className="btn btn-primary cp-help-btn" onClick={onCalendly}>
                    <IconCalendar size={14} stroke={1.8} />Book Meeting
                  </button>
                  <a href="tel:+13024687077" className="btn btn-secondary cp-help-btn">(302) 468-7077</a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Invoices view ───────────────────────────────────────── */
function InvoicesView({ invoices, onCalendly }) {
  const [selected, setSelected]         = useState(invoices[0] || null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const selectedInv = invoices.find(i => i.id === selected?.id) || selected;

  const handleSelect = (inv) => { setSelected(inv); setMobileDetail(true); };
  const totalOwed = invoices
    .filter(i => i.status !== 'paid')
    .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);

  return (
    <div className="cp-view">
      <div className="cp-view-header">
        <h1 className="cp-view-title">Invoices</h1>
        <p className="cp-view-sub">
          {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
          {totalOwed > 0 && <> · <span style={{ color: '#ef4444' }}>${totalOwed.toFixed(2)} outstanding</span></>}
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="cp-panel cp-panel-empty-lg">
          <IconReceipt size={40} stroke={1.2} />
          <h3>No invoices yet</h3>
          <p>Invoices created by Visualize Studio will appear here once your order is approved.</p>
          <button type="button" className="btn btn-secondary" onClick={onCalendly} style={{ fontSize: '0.875rem' }}>
            <IconCalendar size={15} stroke={1.8} />Book a Meeting
          </button>
        </div>
      ) : (
        <div className={`cp-orders-layout ${mobileDetail ? 'cp-detail-open' : ''}`}>
          {/* Invoice list */}
          <div className="cp-order-list">
            {invoices.map(inv => {
              const s = INVOICE_STATUS[inv.status] || INVOICE_STATUS.unpaid;
              return (
                <button key={inv.id} type="button"
                  className={`cp-order-card ${selectedInv?.id === inv.id ? 'active' : ''}`}
                  onClick={() => handleSelect(inv)}
                >
                  <div className="cp-order-card-top">
                    <span className="cp-order-card-type">{inv.invoiceNumber || `INV-${inv.id}`}</span>
                    <span className="cp-order-card-time">{timeAgo(inv.createdAt)}</span>
                  </div>
                  <p className="cp-inv-desc">{inv.description}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="cp-inv-amount">${parseFloat(inv.amount || 0).toFixed(2)}</span>
                    <span className="cp-status-pill" style={{ '--sc': s.color }}>
                      <span className="cp-status-pill-dot" />{s.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Invoice detail */}
          {selectedInv && (() => {
            const s = INVOICE_STATUS[selectedInv.status] || INVOICE_STATUS.unpaid;
            const SIcon = s.icon;
            return (
              <div className="cp-order-detail">
                <button className="cp-mobile-back-btn" onClick={() => setMobileDetail(false)}>
                  <IconArrowLeft size={15} stroke={2} />All Invoices
                </button>
                <div className="cp-detail-top">
                  <div>
                    <h3 className="cp-detail-title">{selectedInv.invoiceNumber || `INV-${selectedInv.id}`}</h3>
                    <p className="cp-detail-date">Issued {formatDate(selectedInv.createdAt)}</p>
                  </div>
                  <span className="cp-status-pill" style={{ '--sc': s.color }}>
                    <span className="cp-status-pill-dot" />{s.label}
                  </span>
                </div>

                {/* Amount hero */}
                <div className="cp-inv-hero" style={{ '--sc': s.color }}>
                  <div className="cp-inv-hero-icon"><SIcon size={22} stroke={1.8} /></div>
                  <div>
                    <p className="cp-inv-hero-label">Amount Due</p>
                    <p className="cp-inv-hero-amount">${parseFloat(selectedInv.amount || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="cp-detail-section">
                  <p className="cp-detail-section-label">Description</p>
                  <p className="cp-notes-text">{selectedInv.description}</p>
                </div>

                {selectedInv.dueDate && (
                  <div className="cp-detail-section">
                    <p className="cp-detail-section-label">Due Date</p>
                    <p style={{ fontSize: '0.9375rem', color: selectedInv.status === 'overdue' ? '#ef4444' : 'var(--text)', fontWeight: 600 }}>
                      {formatDate(selectedInv.dueDate)}
                    </p>
                  </div>
                )}

                {selectedInv.notes && (
                  <div className="cp-detail-section">
                    <p className="cp-detail-section-label">Notes from Visualize</p>
                    <p className="cp-notes-text">{selectedInv.notes}</p>
                  </div>
                )}

                {selectedInv.status !== 'paid' && selectedInv.stripeLink && (
                  <a
                    href={selectedInv.stripeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cp-inv-pay-btn"
                  >
                    <IconLock size={15} stroke={2} />
                    Pay ${parseFloat(selectedInv.amount || 0).toFixed(2)} with Stripe
                  </a>
                )}

                {selectedInv.status !== 'paid' && !selectedInv.stripeLink && (
                  <div className="cp-help-box">
                    <div>
                      <p className="cp-help-title">Ready to pay?</p>
                      <p className="cp-help-sub">Book a meeting or reach out to arrange payment.</p>
                    </div>
                    <button type="button" className="btn btn-primary cp-help-btn" onClick={onCalendly}>
                      <IconCalendar size={14} stroke={1.8} />Book Meeting
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/* ── Meetings view ───────────────────────────────────────── */
function MeetingsView({ user, onCalendly }) {
  const [meetings, setMeetings] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const fetchMeetings = useCallback(async () => {
    if (!user.email) return;
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/calendly-meetings?email=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setMeetings(data.meetings || []);
    } catch (err) {
      setError(err.message);
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [user.email]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const fmtDate = iso => {
    try { return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return ''; }
  };
  const fmtTime = (s, e) => {
    try {
      const fmt = d => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `${fmt(s)} – ${fmt(e)}`;
    } catch { return ''; }
  };

  const isNotConfigured = error === 'Calendly not configured';

  return (
    <div className="cp-view">
      <div className="cp-view-header cp-view-header--row">
        <div>
          <h1 className="cp-view-title">My Meetings</h1>
          <p className="cp-view-sub">
            {!user.email ? 'Email required' : meetings ? `${meetings.length} upcoming` : 'Loading…'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {user.email && (
            <button type="button" className="cp-icon-btn" onClick={fetchMeetings} disabled={loading} title="Refresh">
              <IconRefresh size={16} stroke={1.8} />
            </button>
          )}
          <button type="button" className="btn btn-primary"
            style={{ fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={onCalendly}>
            <IconCalendar size={15} stroke={2} />Book Meeting
          </button>
        </div>
      </div>

      {!user.email ? (
        <div className="cp-panel cp-panel-empty-lg">
          <IconCalendar size={40} stroke={1.2} />
          <h3>Email required</h3>
          <p>To sync your Calendly meetings here, your account needs an email address on file. Contact Visualize Studio to link your email.</p>
        </div>
      ) : loading && !meetings ? (
        <div className="cp-meetings-loading">
          <div className="cp-meetings-spinner" />
          <p>Loading your meetings…</p>
        </div>
      ) : error ? (
        <div className="cp-panel cp-panel-empty-lg">
          <IconCalendar size={40} stroke={1.2} style={{ color: isNotConfigured ? '#34d399' : '#f59e0b' }} />
          <h3>{isNotConfigured ? 'No upcoming meetings' : 'Couldn\'t load meetings'}</h3>
          <p>
            {isNotConfigured
              ? 'You don\'t have any scheduled meetings with Visualize Studio right now.'
              : error}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {!isNotConfigured && (
              <button type="button" className="btn btn-secondary" onClick={fetchMeetings}
                style={{ fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconRefresh size={14} stroke={1.8} />Retry
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={onCalendly}
              style={{ fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconCalendar size={14} stroke={1.8} />Book a Meeting
            </button>
          </div>
        </div>
      ) : meetings && meetings.length === 0 ? (
        <div className="cp-panel cp-panel-empty-lg">
          <IconCalendar size={40} stroke={1.2} />
          <h3>No upcoming meetings</h3>
          <p>You don&apos;t have any scheduled meetings with Visualize Studio right now.</p>
          <button type="button" className="btn btn-primary" onClick={onCalendly}
            style={{ fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <IconCalendar size={15} stroke={1.8} />Book a Meeting
          </button>
        </div>
      ) : meetings ? (
        <div className="cp-meetings-list">
          {meetings.map((m, i) => {
            const d = new Date(m.start_time);
            return (
              <div key={m.uri || i} className="cp-meeting-card">
                <div className="cp-meeting-date-col">
                  <span className="cp-meeting-month">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                  <span className="cp-meeting-day">{d.getDate()}</span>
                </div>
                <div className="cp-meeting-body">
                  <p className="cp-meeting-name">{m.name}</p>
                  <p className="cp-meeting-time">
                    <IconClock size={12} stroke={1.8} />
                    {fmtDate(m.start_time)} · {fmtTime(m.start_time, m.end_time)}
                  </p>
                  {m.location?.join_url && (
                    <a href={m.location.join_url} target="_blank" rel="noopener noreferrer" className="cp-meeting-join">
                      <IconExternalLink size={12} stroke={2} />Join Meeting
                    </a>
                  )}
                </div>
                <div className="cp-meeting-actions">
                  {m.rescheduleUrl && (
                    <a href={m.rescheduleUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary cp-help-btn">
                      Reschedule
                    </a>
                  )}
                  {m.cancelUrl && (
                    <a href={m.cancelUrl} target="_blank" rel="noopener noreferrer" className="cp-meeting-cancel-btn">
                      Cancel
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* ── Main portal ───────────────────────────────────────────── */
function Portal({ user, onLogout }) {
  const [tab, setTab]               = useState('dashboard');
  const [showCalendly, setCalendly] = useState(false);
  const [orders, setOrders]         = useState([]);
  const [invoices, setInvoices]     = useState([]);

  const load = useCallback(() => {
    const allOrders   = getOrders();
    const allInvoices = getInvoices();
    setOrders(allOrders.filter(o => user.email && o.email?.toLowerCase() === user.email.toLowerCase()));
    setInvoices(allInvoices.filter(i =>
      (i.clientId && i.clientId === user.id) ||
      (user.email && i.clientEmail?.toLowerCase() === user.email.toLowerCase())
    ));
  }, [user.id, user.email]);

  useEffect(() => { load(); }, [load]);

  const unpaidCount  = invoices.filter(i => i.status !== 'paid').length;
  const pendingCount = orders.filter(o => (o.status || 'pending') !== 'completed').length;

  const bottomNavItems = [
    { id: 'dashboard', label: 'Home',     icon: IconLayoutDashboard },
    { id: 'orders',    label: 'Orders',   icon: IconPackage,       badge: pendingCount },
    { id: 'invoices',  label: 'Invoices', icon: IconReceipt,       badge: unpaidCount  },
    { id: 'meetings',  label: 'Meetings', icon: IconCalendar },
    { id: 'forms',     label: 'Briefs',   icon: IconClipboardList },
  ];

  return (
    <div className="cp-portal">
      {/* Mobile-only top bar */}
      <div className="cp-mobile-topbar">
        <img src="/logo.svg" alt="Visualize" style={{ height: 22 }} />
        <div className="cp-mobile-topbar-right">
          <div className="cp-sidebar-avatar" style={{ width: 30, height: 30, fontSize: '0.75rem' }}>
            {(user.name || user.username || '?').charAt(0).toUpperCase()}
          </div>
          <button className="cp-sidebar-logout" onClick={onLogout} title="Sign out">
            <IconLogout size={15} stroke={1.6} />
          </button>
        </div>
      </div>

      <Sidebar tab={tab} setTab={setTab} user={user} onLogout={onLogout} onCalendly={() => setCalendly(true)} />

      <main className="cp-main">
        {tab === 'dashboard' && <DashboardView user={user} orders={orders} invoices={invoices} onCalendly={() => setCalendly(true)} setTab={setTab} />}
        {tab === 'orders'    && <OrdersView    orders={orders}   onCalendly={() => setCalendly(true)} />}
        {tab === 'invoices'  && <InvoicesView  invoices={invoices} onCalendly={() => setCalendly(true)} />}
        {tab === 'meetings'  && <MeetingsView  user={user} onCalendly={() => setCalendly(true)} />}
        {tab === 'forms'     && <FormsView     user={user} />}
      </main>

      {/* Mobile-only bottom tab bar */}
      <nav className="cp-bottom-nav" aria-label="Main navigation">
        {bottomNavItems.map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button key={item.id} type="button"
              className={`cp-bottom-nav-item ${active ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className="cp-bottom-nav-icon">
                <Icon size={22} stroke={active ? 2 : 1.6} />
                {item.badge > 0 && <span className="cp-bottom-nav-badge">{item.badge}</span>}
              </span>
              <span className="cp-bottom-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showCalendly && <CalendlyModal onClose={() => setCalendly(false)} />}
    </div>
  );
}

/* ── Root export ───────────────────────────────────────────── */
function normalizeSession(raw) {
  if (!raw) return null;
  return {
    id:       raw.id,
    username: raw.username || raw.email || raw.name || 'user',
    name:     raw.name     || raw.username || raw.email || 'User',
    email:    raw.email    || null,
  };
}

export default function ClientPortal() {
  const [user, setUser] = useState(() => {
    try { return normalizeSession(JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')); } catch { return null; }
  });

  const [splash, setSplash] = useState(() => {
    // If session already exists on page load, show a quick splash
    try {
      const s = normalizeSession(JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'));
      if (s) return { name: s.name, subtitle: 'Loading your portal…', duration: 900 };
    } catch {}
    return null;
  });

  const logout = () => { sessionStorage.removeItem(SESSION_KEY); setUser(null); };

  const handleAuth = (session) => {
    const s = normalizeSession(session);
    setUser(s);
    setSplash({ name: s.name, subtitle: 'Setting up your portal…', duration: 1800 });
  };

  return (
    <>
      {user ? <Portal user={user} onLogout={logout} /> : <AuthScreen onAuth={handleAuth} />}
      {splash && (
        <SplashScreen
          name={splash.name}
          subtitle={splash.subtitle}
          duration={splash.duration}
          onDone={() => setSplash(null)}
        />
      )}
      <style>{cpStyles}</style>
    </>
  );
}

const cpStyles = `
  /* ── Layout ────────────────────────────── */
  .cp-portal { display: flex; min-height: 100vh; background: #f7f7f7; }
  .cp-main { flex: 1; overflow-y: auto; min-width: 0; }

  /* ── Sidebar ────────────────────────────── */
  .cp-sidebar {
    width: 260px; flex-shrink: 0;
    background: #ffffff;
    border-right: 1px solid #e0e0e0;
    display: flex; flex-direction: column;
    position: sticky; top: 0; height: 100vh;
    overflow: hidden;
  }
  .cp-sidebar-brand {
    display: flex; align-items: center; gap: 10px;
    padding: var(--space-6) var(--space-5) var(--space-5);
    border-bottom: 1px solid #e0e0e0;
  }
  .cp-sidebar-brand-label {
    font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em;
    text-transform: uppercase; color: var(--text-muted);
  }
  .cp-sidebar-nav {
    flex: 1; display: flex; flex-direction: column; gap: 2px;
    padding: var(--space-4) var(--space-3);
  }
  .cp-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: var(--radius);
    background: none; border: none; cursor: pointer;
    font-size: 0.875rem; font-weight: 500; color: var(--text-secondary);
    text-align: left; width: 100%;
    transition: background 0.15s, color 0.15s;
  }
  .cp-nav-item:hover { background: #f7f7f7; color: var(--text); }
  .cp-nav-item.active { background: rgba(212,76,67,0.08); color: var(--brand); border-left: 2px solid var(--brand); padding-left: 10px; font-weight: 600; }
  .cp-sidebar-footer {
    padding: var(--space-4) var(--space-3);
    border-top: 1px solid #e0e0e0;
    display: flex; flex-direction: column; gap: var(--space-3);
  }
  .cp-book-sidebar {
    display: flex; align-items: center; justify-content: center; gap: 7px;
    width: 100%; padding: 10px; border-radius: 999px;
    background: var(--brand); border: none;
    color: #fff; font-size: 0.875rem; font-weight: 600; cursor: pointer;
    transition: background 0.2s;
  }
  .cp-book-sidebar:hover { background: #a83a32; }
  .cp-sidebar-user {
    display: flex; align-items: center; gap: var(--space-2);
    padding: var(--space-2) 0;
  }
  .cp-sidebar-avatar {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    background: rgba(212,76,67,0.12); border: 1px solid rgba(212,76,67,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8125rem; font-weight: 700; color: var(--brand);
  }
  .cp-sidebar-user-info { flex: 1; min-width: 0; }
  .cp-sidebar-name { display: block; font-size: 0.8125rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cp-sidebar-email { display: block; font-size: 0.68rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: monospace; }
  .cp-sidebar-logout {
    width: 28px; height: 28px; flex-shrink: 0; border-radius: var(--radius);
    display: flex; align-items: center; justify-content: center;
    background: none; border: 1px solid #e0e0e0;
    color: var(--text-muted); cursor: pointer; transition: color 0.2s, border-color 0.2s;
  }
  .cp-sidebar-logout:hover { color: #ef4444; border-color: rgba(239,68,68,0.4); }

  /* ── View container ──────────────────────── */
  .cp-view { padding: var(--space-8); max-width: 1000px; }
  .cp-view-header { margin-bottom: var(--space-7); }
  .cp-view-header--row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); }
  .cp-view-title { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text); margin-bottom: 4px; }
  .cp-view-sub { font-size: 0.9rem; color: var(--text-muted); }

  /* ── Drive header ──────────────────────── */
  .cp-drive-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-8); }
  .cp-drive-title { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
  .cp-drive-view-btns { display: flex; gap: 4px; }
  .cp-drive-view-btn {
    width: 32px; height: 32px; border-radius: var(--radius);
    display: flex; align-items: center; justify-content: center;
    background: none; border: 1px solid #e0e0e0;
    color: var(--text-muted); cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .cp-drive-view-btn:hover { background: #f0f0f0; color: var(--text); }

  /* ── Section label ──────────────────────── */
  .cp-section-label {
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--text-muted);
    margin-bottom: var(--space-4);
  }

  /* ── Quick Access ───────────────────────── */
  .cp-quick-access { margin-bottom: var(--space-8); }
  .cp-qa-row { display: flex; gap: var(--space-3); overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
  .cp-qa-row::-webkit-scrollbar { display: none; }
  .cp-qa-card {
    min-width: 190px; flex-shrink: 0;
    background: #ffffff; border: 1px solid #e0e0e0;
    border-radius: var(--radius-lg); padding: var(--space-4);
    display: flex; flex-direction: column; gap: var(--space-2);
    text-align: left; cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .cp-qa-card:hover { border-color: rgba(212,76,67,0.4); box-shadow: 0 4px 16px rgba(0,0,0,0.07); }
  .cp-qa-icon {
    width: 40px; height: 40px; border-radius: var(--radius);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 20%, transparent);
    display: flex; align-items: center; justify-content: center;
    color: var(--c); margin-bottom: var(--space-1);
  }
  .cp-qa-label { font-size: 0.9rem; font-weight: 700; color: var(--text); }
  .cp-qa-sub { font-size: 0.75rem; color: var(--text-muted); }

  /* ── Files table ─────────────────────────── */
  .cp-files-table { background: #ffffff; border: 1px solid #e0e0e0; border-radius: var(--radius-lg); overflow: hidden; }
  .cp-files-head {
    display: grid; grid-template-columns: 1fr 90px 150px 130px 50px;
    padding: 10px 16px; background: #fafafa;
    font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--text-muted);
    border-bottom: 1px solid #f0f0f0;
  }
  .cp-files-row {
    display: grid; grid-template-columns: 1fr 90px 150px 130px 50px;
    align-items: center; padding: 12px 16px;
    width: 100%; text-align: left; background: none; border: none; cursor: pointer;
    border-bottom: 1px solid #f5f5f5; transition: background 0.12s;
  }
  .cp-files-row:last-child { border-bottom: none; }
  .cp-files-row:hover { background: #f7f7f7; }
  .cp-files-name { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; font-weight: 500; color: var(--text); min-width: 0; }
  .cp-files-name span:last-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cp-files-icon { width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
  .cp-files-icon--order { background: rgba(212,76,67,0.1); color: var(--brand); }
  .cp-files-icon--invoice { background: rgba(245,158,11,0.1); color: #f59e0b; }
  .cp-files-chip { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; padding: 2px 8px; border-radius: 999px; }
  .cp-files-chip--order { background: rgba(212,76,67,0.08); color: var(--brand); border: 1px solid rgba(212,76,67,0.2); }
  .cp-files-chip--invoice { background: rgba(245,158,11,0.08); color: #d97706; border: 1px solid rgba(245,158,11,0.2); }
  .cp-files-date { font-size: 0.8125rem; color: var(--text-muted); }
  .cp-files-action { display: flex; align-items: center; justify-content: flex-end; color: var(--text-muted); }
  .cp-files-pay {
    font-size: 0.75rem; font-weight: 700; color: var(--brand);
    padding: 3px 10px; border-radius: 999px;
    background: rgba(212,76,67,0.08); border: 1px solid rgba(212,76,67,0.2);
    text-decoration: none; white-space: nowrap; transition: background 0.15s;
  }
  .cp-files-pay:hover { background: rgba(212,76,67,0.16); }
  .cp-files-empty {
    display: flex; flex-direction: column; align-items: center; gap: var(--space-3);
    padding: var(--space-16) var(--space-8); text-align: center; color: var(--text-muted);
    background: #ffffff; border: 1px solid #e0e0e0; border-radius: var(--radius-lg);
  }
  .cp-files-empty p { font-size: 1rem; font-weight: 600; color: var(--text); }
  .cp-files-empty span { font-size: 0.875rem; color: var(--text-secondary); }

  /* ── Panels ────────────────────────────── */
  .cp-panel {
    background: #ffffff; border: 1px solid #e0e0e0;
    border-radius: var(--radius-lg); padding: var(--space-6);
  }
  .cp-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-5); }
  .cp-panel-title { font-size: 1rem; font-weight: 700; color: var(--text); margin-bottom: var(--space-5); }
  .cp-panel-head .cp-panel-title { margin-bottom: 0; }
  .cp-panel-link {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 0.8125rem; color: var(--brand); font-weight: 600;
    background: none; border: none; cursor: pointer;
    transition: gap 0.2s;
  }
  .cp-panel-link:hover { gap: 5px; }
  .cp-panel-empty {
    display: flex; flex-direction: column; align-items: center;
    gap: var(--space-3); padding: var(--space-8) 0;
    text-align: center; color: var(--text-muted);
  }
  .cp-panel-empty p { font-size: 0.875rem; color: var(--text-secondary); max-width: 300px; line-height: 1.6; }

  /* Empty panel (large) */
  .cp-panel-empty-lg {
    display: flex; flex-direction: column; align-items: center;
    gap: var(--space-4); padding: var(--space-16) var(--space-8);
    text-align: center; color: var(--text-muted);
    background: #ffffff; border: 1px solid #e0e0e0;
    border-radius: var(--radius-lg);
  }
  .cp-panel-empty-lg h3 { font-size: 1.2rem; font-weight: 700; color: var(--text); }
  .cp-panel-empty-lg p { font-size: 0.9rem; color: var(--text-secondary); max-width: 380px; line-height: 1.65; }

  /* ── Recent order ─────────────────────────── */
  .cp-recent-order { display: flex; flex-direction: column; gap: var(--space-3); }
  .cp-recent-order-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); }
  .cp-recent-type { font-size: 1rem; font-weight: 700; color: var(--text); text-transform: capitalize; margin-bottom: 3px; }
  .cp-recent-date { font-size: 0.78rem; color: var(--text-muted); }
  .cp-recent-tags { display: flex; flex-wrap: wrap; gap: 4px; }

  /* ── Quick actions ────────────────────────── */
  .cp-quick-actions { display: flex; flex-direction: column; gap: var(--space-2); }
  .cp-quick-btn {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-4); border-radius: var(--radius-lg);
    background: #ffffff; border: 1px solid #e0e0e0;
    cursor: pointer; text-align: left; width: 100%;
    transition: border-color 0.2s, background 0.2s;
    text-decoration: none; color: inherit;
  }
  .cp-quick-btn:hover { border-color: rgba(212,76,67,0.3); background: rgba(212,76,67,0.04); }
  .cp-quick-icon {
    width: 36px; height: 36px; flex-shrink: 0; border-radius: var(--radius);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 25%, transparent);
    display: flex; align-items: center; justify-content: center; color: var(--c);
  }
  .cp-quick-label { font-size: 0.875rem; font-weight: 600; color: var(--text); margin-bottom: 2px; }
  .cp-quick-sub { font-size: 0.75rem; color: var(--text-muted); }
  .cp-quick-arrow { color: var(--text-muted); margin-left: auto; flex-shrink: 0; }

  /* ── Status pill ─────────────────────────── */
  .cp-status-pill {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px; white-space: nowrap;
    background: color-mix(in srgb, var(--sc) 12%, transparent);
    color: var(--sc); border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent);
  }
  .cp-status-pill-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sc); flex-shrink: 0; }

  /* ── Tags ────────────────────────────────── */
  .cp-tag { font-size: 0.7rem; padding: 2px 7px; border-radius: 999px; background: #f7f7f7; border: 1px solid #e0e0e0; color: var(--text-secondary); text-transform: capitalize; }

  /* ── Orders layout ────────────────────────── */
  .cp-orders-layout { display: grid; grid-template-columns: 300px 1fr; gap: var(--space-5); align-items: start; }
  @media (max-width: 800px) { .cp-orders-layout { grid-template-columns: 1fr; } }

  .cp-order-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .cp-order-card {
    display: flex; flex-direction: column; gap: var(--space-2);
    padding: var(--space-4); text-align: left; width: 100%;
    background: #ffffff; border: 1px solid #e0e0e0;
    border-radius: var(--radius-lg); cursor: pointer;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .cp-order-card:hover { border-color: rgba(212,76,67,0.35); box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
  .cp-order-card.active { border-color: var(--brand); background: rgba(212,76,67,0.04); }
  .cp-order-card-top { display: flex; justify-content: space-between; align-items: baseline; }
  .cp-order-card-type { font-size: 0.9375rem; font-weight: 700; color: var(--text); text-transform: capitalize; }
  .cp-order-card-time { font-size: 0.72rem; color: var(--text-muted); }
  .cp-order-card-tags { display: flex; flex-wrap: wrap; gap: 4px; }

  /* ── Order / Invoice detail ──────────────────── */
  .cp-order-detail {
    background: #ffffff; border: 1px solid #e0e0e0;
    border-radius: var(--radius-lg); padding: var(--space-6);
    position: sticky; top: var(--space-6);
    display: flex; flex-direction: column; gap: var(--space-5);
  }
  .cp-detail-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
  .cp-detail-title { font-size: 1.25rem; font-weight: 800; color: var(--text); margin-bottom: 4px; }
  .cp-detail-date { font-size: 0.8125rem; color: var(--text-muted); }
  .cp-detail-section { display: flex; flex-direction: column; gap: var(--space-3); }
  .cp-detail-section-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); }

  /* ── Timeline ────────────────────────────── */
  .cp-timeline { display: flex; flex-direction: column; }
  .cp-tl-step { display: flex; gap: var(--space-3); }
  .cp-tl-left { display: flex; flex-direction: column; align-items: center; }
  .cp-tl-dot {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid #e0e0e0; background: #ffffff;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.25s;
  }
  .cp-tl-step.done .cp-tl-dot { background: var(--sc,var(--brand)); border-color: var(--sc,var(--brand)); }
  .cp-tl-step.active .cp-tl-dot { border-color: var(--sc,var(--brand)); background: color-mix(in srgb,var(--sc,var(--brand)) 15%,transparent); box-shadow: 0 0 0 3px color-mix(in srgb,var(--sc,var(--brand)) 15%,transparent); }
  .cp-tl-line { width: 2px; flex: 1; min-height: 14px; background: #e0e0e0; margin: 3px 0; }
  .cp-tl-step.done .cp-tl-line { background: var(--sc,var(--brand)); }
  .cp-tl-body { padding: 1px 0 12px; }
  .cp-tl-label { font-size: 0.8125rem; font-weight: 600; color: var(--text-secondary); }
  .cp-tl-step.active .cp-tl-label { font-weight: 700; }
  .cp-tl-step.done .cp-tl-label { color: var(--text-muted); }
  .cp-tl-desc { font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; margin-top: 3px; }

  /* ── Spec grid ────────────────────────────── */
  .cp-spec-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
  @media (max-width: 500px) { .cp-spec-grid { grid-template-columns: 1fr; } }
  .cp-spec-pair { background: #f7f7f7; border-radius: var(--radius); padding: var(--space-3) var(--space-4); }
  .cp-spec-key { display: block; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .cp-spec-val { font-size: 0.875rem; font-weight: 600; color: var(--text); text-transform: capitalize; }
  .cp-notes-text { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.65; white-space: pre-wrap; }

  /* ── Invoice specifics ──────────────────────── */
  .cp-inv-desc { font-size: 0.8125rem; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cp-inv-amount { font-size: 1.125rem; font-weight: 800; color: var(--text); }
  .cp-inv-hero {
    display: flex; align-items: center; gap: var(--space-4);
    background: color-mix(in srgb, var(--sc) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--sc) 20%, transparent);
    border-radius: var(--radius-lg); padding: var(--space-5);
  }
  .cp-inv-hero-icon {
    width: 44px; height: 44px; border-radius: var(--radius);
    background: color-mix(in srgb, var(--sc) 15%, transparent);
    display: flex; align-items: center; justify-content: center;
    color: var(--sc); flex-shrink: 0;
  }
  .cp-inv-hero-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .cp-inv-hero-amount { font-size: 1.75rem; font-weight: 900; color: var(--text); letter-spacing: -0.02em; }

  /* ── Help box ────────────────────────────── */
  .cp-help-box {
    background: #fff5f5; border: 1px solid rgba(212,76,67,0.18);
    border-radius: var(--radius-lg); padding: var(--space-5);
    display: flex; align-items: center; justify-content: space-between;
    gap: var(--space-4); flex-wrap: wrap;
  }
  .cp-help-title { font-size: 0.9375rem; font-weight: 700; color: var(--text); margin-bottom: 3px; }
  .cp-help-sub { font-size: 0.8125rem; color: var(--text-muted); }
  .cp-help-actions { display: flex; gap: var(--space-3); flex-wrap: wrap; }
  .cp-help-btn { font-size: 0.8125rem; padding: 8px 14px; display: inline-flex; align-items: center; gap: 5px; }
  .cp-inv-pay-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: var(--space-4);
    background: var(--brand);
    border: none;
    border-radius: var(--radius-lg);
    color: #fff; font-size: 1rem; font-weight: 700;
    text-decoration: none;
    box-shadow: 0 4px 16px rgba(212,76,67,0.25);
    transition: background 0.2s, transform 0.2s;
  }
  .cp-inv-pay-btn:hover { background: #c0392b; transform: translateY(-1px); }

  /* ── Auth ─────────────────────────────────────── */
  .cp-auth-wrap {
    min-height: 100vh; background: var(--bg);
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-6);
    background-image: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(212,76,67,0.07) 0%, transparent 55%);
  }
  .cp-auth-card {
    width: 100%; max-width: 420px;
    background: #ffffff; border: 1px solid #e0e0e0;
    border-radius: var(--radius-lg); padding: var(--space-10) var(--space-8);
    box-shadow: 0 8px 40px rgba(0,0,0,0.08);
  }
  .cp-auth-logo { display: flex; justify-content: center; margin-bottom: var(--space-6); }
  .cp-auth-title { font-size: 1.5rem; font-weight: 800; color: var(--text); text-align: center; margin-bottom: var(--space-2); }
  .cp-auth-sub { font-size: 0.875rem; color: var(--text-secondary); text-align: center; line-height: 1.6; margin-bottom: var(--space-6); }
  .cp-auth-notice {
    display: flex; align-items: flex-start; gap: 8px;
    background: #fff8f0; border: 1px solid rgba(212,76,67,0.2);
    border-radius: var(--radius); padding: var(--space-3) var(--space-4);
    font-size: 0.8125rem; line-height: 1.5; margin-bottom: var(--space-4);
    color: #7a4100;
  }
  .cp-auth-notice strong { color: #5a2f00; }
  .cp-auth-form { display: flex; flex-direction: column; gap: var(--space-4); }
  .cp-field { display: flex; flex-direction: column; gap: var(--space-2); }
  .cp-label { font-size: 0.875rem; font-weight: 600; color: var(--text); }
  .cp-label-opt { font-size: 0.75rem; font-weight: 400; color: var(--text-muted); }
  .cp-input {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius); border: 1px solid #e0e0e0;
    background: #ffffff; color: var(--text);
    font-size: 0.9375rem; font-family: inherit; outline: none;
    width: 100%; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .cp-input:focus { border-color: var(--brand); box-shadow: 0 0 0 1px rgba(212,76,67,0.25); }
  .cp-auth-error { font-size: 0.8125rem; color: rgba(248,113,113,0.9); text-align: center; }
  .cp-auth-btn { display: flex; align-items: center; justify-content: center; gap: 7px; width: 100%; padding: var(--space-3); font-size: 1rem; margin-top: var(--space-2); }
  .cp-auth-switch { text-align: center; font-size: 0.875rem; color: var(--text-muted); margin-top: var(--space-4); }
  .cp-switch-btn { background: none; border: none; color: var(--brand); font-weight: 600; cursor: pointer; font-size: inherit; padding: 0; }
  .cp-switch-btn:hover { text-decoration: underline; }
  .cp-back-link { display: flex; align-items: center; justify-content: center; gap: 4px; text-align: center; font-size: 0.8125rem; color: var(--text-muted); margin-top: var(--space-4); }
  .cp-back-link:hover { color: var(--text); }
  @keyframes cpShake { 0%,100%{transform:translateX(0)} 15%,55%{transform:translateX(-6px)} 35%,75%{transform:translateX(6px)} }
  .cp-shake { animation: cpShake 0.5s ease; }

  /* ── Calendly modal ─────────────────────────── */
  .cp-modal-overlay {
    position: fixed; inset: 0; z-index: 300;
    background: rgba(0,0,0,0.45);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-4); animation: cpFadeIn 0.2s ease;
  }
  @keyframes cpFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .cp-modal {
    background: #ffffff; border: 1px solid #e0e0e0;
    border-radius: var(--radius-lg); width: 100%; max-width: 780px;
    overflow: hidden; box-shadow: 0 16px 60px rgba(0,0,0,0.15);
    animation: cpSlideUp 0.25s var(--ease);
  }
  @keyframes cpSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .cp-modal-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--space-4) var(--space-6); border-bottom: 1px solid #e0e0e0;
  }
  .cp-modal-title { font-size: 1rem; font-weight: 700; color: var(--text); }
  .cp-modal-close {
    width: 32px; height: 32px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: #f7f7f7; border: 1px solid #e0e0e0;
    color: var(--text-secondary); cursor: pointer; transition: background 0.2s, color 0.2s;
  }
  .cp-modal-close:hover { background: #eeeeee; color: var(--text); }

  /* ── Mobile back button (desktop: hidden) ── */
  .cp-mobile-back-btn { display: none; }

  /* ── Mobile top bar (desktop: hidden) ────── */
  .cp-mobile-topbar { display: none; }

  /* ── Bottom nav (desktop: hidden) ────────── */
  .cp-bottom-nav { display: none; }

  /* ── Mobile layout ──────────────────────────── */
  @media (max-width: 700px) {
    /* Portal becomes a column so topbar sits above */
    .cp-portal { flex-direction: column; }

    /* Hide sidebar — replaced by bottom nav + top bar */
    .cp-sidebar { display: none; }

    /* Mobile top bar */
    .cp-mobile-topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px var(--space-4);
      padding-top: calc(10px + env(safe-area-inset-top));
      background: #ffffff;
      border-bottom: 1px solid #e0e0e0;
      position: sticky; top: 0; z-index: 50;
      flex-shrink: 0;
    }
    .cp-mobile-topbar-right {
      display: flex; align-items: center; gap: var(--space-2);
    }

    /* Main view */
    .cp-main {
      flex: 1; overflow-y: auto;
      padding-bottom: calc(72px + env(safe-area-inset-bottom));
    }

    /* Bottom tab nav */
    .cp-bottom-nav {
      display: flex; align-items: stretch;
      position: fixed; bottom: 0; left: 0; right: 0;
      height: calc(60px + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      background: #ffffff;
      border-top: 1px solid #e0e0e0;
      z-index: 100;
    }
    .cp-bottom-nav-item {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 3px;
      background: none; border: none; cursor: pointer;
      color: var(--text-muted);
      transition: color 0.15s;
      padding: 6px 0;
      -webkit-tap-highlight-color: transparent;
    }
    .cp-bottom-nav-item.active { color: var(--brand); }
    .cp-bottom-nav-icon {
      position: relative; display: flex; align-items: center; justify-content: center;
    }
    .cp-bottom-nav-badge {
      position: absolute; top: -4px; right: -6px;
      background: var(--brand); color: #fff;
      font-size: 0.55rem; font-weight: 800;
      width: 14px; height: 14px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .cp-bottom-nav-label {
      font-size: 0.65rem; font-weight: 600; letter-spacing: 0.03em;
    }

    /* View padding */
    .cp-view { padding: var(--space-4) var(--space-4); }
    .cp-view-title { font-size: 1.3rem; }

    /* Stats row: horizontal scroll instead of stacking */
    .cp-stats-row {
      display: flex; overflow-x: auto; gap: var(--space-3);
      padding-bottom: 4px; scrollbar-width: none;
    }
    .cp-stats-row::-webkit-scrollbar { display: none; }
    .cp-stat-card { min-width: 130px; flex: 1; }

    /* Dashboard grid: single column */
    .cp-dash-grid { grid-template-columns: 1fr; }

    /* Orders/invoices: drill-down */
    .cp-orders-layout { grid-template-columns: 1fr; }
    .cp-orders-layout:not(.cp-detail-open) .cp-order-detail { display: none; }
    .cp-orders-layout.cp-detail-open .cp-order-list { display: none; }
    .cp-orders-layout.cp-detail-open .cp-order-detail { display: flex !important; }

    /* Mobile back button inside detail */
    .cp-mobile-back-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: none; border: none; cursor: pointer;
      color: var(--brand); font-size: 0.9rem; font-weight: 600;
      padding: 0 0 var(--space-4) 0;
      -webkit-tap-highlight-color: transparent;
    }

    /* Order cards: bigger tap targets */
    .cp-order-card { padding: var(--space-5); }
    .cp-quick-btn { padding: var(--space-4) var(--space-4); }

    /* Detail: no sticky on mobile */
    .cp-order-detail { position: static; }

    /* Help box: stack vertically */
    .cp-help-box { flex-direction: column; align-items: flex-start; }
    .cp-help-actions { width: 100%; }
    .cp-help-btn { flex: 1; justify-content: center; }

    /* Auth card: full width */
    .cp-auth-card { padding: var(--space-8) var(--space-5); }

    /* Calendly modal: full screen on mobile */
    .cp-modal { border-radius: var(--radius-lg) var(--radius-lg) 0 0; position: fixed; bottom: 0; left: 0; right: 0; max-width: 100%; }
    .cp-modal-overlay { align-items: flex-end; padding: 0; }
    .calendly-inline-widget { height: 70dvh !important; }

    /* Meeting cards: stack on mobile */
    .cp-meeting-card { flex-wrap: wrap; }
    .cp-meeting-actions { flex-direction: row; width: 100%; justify-content: flex-end; margin-top: var(--space-2); }
  }

  /* ── Meetings ────────────────────────────── */
  .cp-meetings-list { display: flex; flex-direction: column; gap: var(--space-3); }
  .cp-meeting-card {
    display: flex; align-items: flex-start; gap: var(--space-4);
    padding: var(--space-5);
    background: #ffffff; border: 1px solid #e0e0e0;
    border-radius: var(--radius-lg);
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .cp-meeting-card:hover { border-color: #34d399; box-shadow: 0 2px 8px rgba(52,211,153,0.08); }
  .cp-meeting-date-col {
    flex-shrink: 0; width: 46px; text-align: center;
    background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.2);
    border-radius: var(--radius); padding: var(--space-2) var(--space-3);
    display: flex; flex-direction: column; align-items: center;
  }
  .cp-meeting-month { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #34d399; }
  .cp-meeting-day   { font-size: 1.5rem; font-weight: 900; color: var(--text); line-height: 1.1; }
  .cp-meeting-body  { flex: 1; min-width: 0; }
  .cp-meeting-name  { font-size: 0.9375rem; font-weight: 700; color: var(--text); margin-bottom: 5px; }
  .cp-meeting-time  { display: flex; align-items: center; gap: 5px; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px; }
  .cp-meeting-join  {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 0.78rem; font-weight: 600; color: #34d399;
    text-decoration: none; transition: opacity 0.2s;
  }
  .cp-meeting-join:hover { opacity: 0.75; }
  .cp-meeting-actions { display: flex; flex-direction: column; gap: var(--space-2); flex-shrink: 0; }
  .cp-meeting-cancel-btn {
    font-size: 0.78rem; font-weight: 600; color: #f87171;
    text-decoration: none; text-align: center;
    padding: 6px 12px; border-radius: var(--radius);
    transition: background 0.2s;
  }
  .cp-meeting-cancel-btn:hover { background: rgba(248,113,113,0.1); }

  /* ── Meetings loading ──────────────────────── */
  .cp-meetings-loading {
    display: flex; flex-direction: column; align-items: center; gap: var(--space-4);
    padding: var(--space-16) var(--space-8); color: var(--text-muted);
  }
  .cp-meetings-loading p { font-size: 0.9rem; }
  .cp-meetings-spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid #e0e0e0;
    border-top-color: #34d399;
    animation: cp-spin 0.7s linear infinite;
  }
  @keyframes cp-spin { to { transform: rotate(360deg); } }

  /* ── Icon button ───────────────────────────── */
  .cp-icon-btn {
    width: 36px; height: 36px; flex-shrink: 0; border-radius: var(--radius);
    display: flex; align-items: center; justify-content: center;
    background: #f7f7f7; border: 1px solid #e0e0e0;
    color: var(--text-muted); cursor: pointer; transition: color 0.2s, background 0.2s, border-color 0.2s;
  }
  .cp-icon-btn:hover { color: var(--text); background: #eeeeee; border-color: #d0d0d0; }
  .cp-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }
`;
