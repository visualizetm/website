import { useState, useEffect, useCallback } from 'react';
import {
  IconLayoutDashboard, IconListDetails, IconLogout, IconRefresh,
  IconTrash, IconMail, IconPhone, IconCheck, IconClock, IconEye,
  IconChartBar, IconArrowRight, IconArrowLeft, IconUsers, IconUser, IconReceipt,
  IconPlus, IconCircleCheck, IconKey, IconLink, IconCopy,
} from '@tabler/icons-react';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

function hashPassword(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
  return btoa(`vz:${h}:${pw.length}`);
}

const ORDER_STATUSES = [
  { id: 'pending',   label: 'Pending',   color: '#f59e0b' },
  { id: 'reviewed',  label: 'Reviewed',  color: '#60a5fa' },
  { id: 'approved',  label: 'Approved',  color: '#a78bfa' },
  { id: 'sent',      label: 'Quote Sent', color: '#34d399' },
  { id: 'completed', label: 'Completed', color: '#22c55e' },
];

function formatDate(iso) {
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  catch { return iso; }
}
function formatDateShort(iso) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return ''; }
}
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function StatusBadge({ status }) {
  const s = ORDER_STATUSES.find(x => x.id === status) || ORDER_STATUSES[0];
  return (
    <span className="adm-status-badge" style={{ '--sc': s.color }}>
      <span className="adm-status-dot" />
      {s.label}
    </span>
  );
}

function StatCard({ label, value, sub, icon, accent }) {
  return (
    <div className="adm-stat" style={accent ? { '--accent': accent } : {}}>
      <div className="adm-stat-top">
        <span className="adm-stat-icon" aria-hidden="true">{icon}</span>
        <span className="adm-stat-val">{value}</span>
      </div>
      <span className="adm-stat-label">{label}</span>
      {sub && <span className="adm-stat-sub">{sub}</span>}
    </div>
  );
}

function MiniBar({ data, max }) {
  return (
    <div className="adm-mini-bar">
      {data.map((d, i) => (
        <div key={i} className="adm-mini-bar-col" title={d.label}>
          <div className="adm-mini-bar-fill" style={{ height: max > 0 ? `${(d.value / max) * 100}%` : '0%' }} />
          <span className="adm-mini-bar-x">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Login screen ─────────────────────────────────────────────── */
function LoginScreen({ onAuth }) {
  const [pw, setPw]         = useState('');
  const [error, setError]   = useState(false);
  const [shaking, setShake] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) { onAuth(); return; }
    setError(true);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="adm-page">
      <div className="adm-login">
        <div className="adm-login-logo">
          <img src="/logo.svg" alt="Visualize" style={{ height: 32 }} />
        </div>
        <h1 className="adm-login-title">Admin Dashboard</h1>
        <p className="adm-login-sub">Visualize Studio — Internal</p>
        <form onSubmit={submit} className={`adm-login-form ${shaking ? 'adm-shake' : ''}`}>
          <input
            type="password"
            className={`adm-input ${error ? 'adm-input--error' : ''}`}
            value={pw}
            onChange={e => { setPw(e.target.value); setError(false); }}
            placeholder="Enter password"
            autoFocus
          />
          {error && <p className="adm-pw-err">Incorrect password</p>}
          <button type="submit" className="btn btn-primary adm-login-btn">Access Dashboard</button>
        </form>
      </div>
      <style>{admStyles}</style>
    </div>
  );
}

/* ── Main dashboard ───────────────────────────────────────────── */
export default function PrintsAdmin() {
  const [auth, setAuth]         = useState(false);
  const [orders, setOrders]     = useState([]);
  const [detail, setDetail]     = useState(null);
  const [filter, setFilter]     = useState('all');
  const [tab, setTab]           = useState('orders'); // 'overview' | 'orders'
  const [search, setSearch]     = useState('');
  const [analytics, setAnalytics] = useState({ pageViews: 0, uniqueVisits: 0, topPages: [], dailyViews: [] });
  const [clients, setClients]     = useState([]);
  const [invoices, setInvoices]   = useState([]);
  const [invForm, setInvForm]     = useState({ clientEmail: '', invoiceNumber: '', description: '', amount: '', dueDate: '', notes: '', stripeLink: '' });
  const [invFormOpen, setInvFormOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ username: '', name: '', email: '', password: '' });
  const [newClientError, setNewClientError] = useState('');
  const [mobileOrderDetail, setMobileOrderDetail] = useState(false);
  const [mobileInvDetail, setMobileInvDetail] = useState(false);
  const [stripeLinkDraft, setStripeLinkDraft] = useState('');

  const loadOrders = useCallback(() => {
    try { setOrders(JSON.parse(localStorage.getItem('vz_print_orders') || '[]')); }
    catch { setOrders([]); }
  }, []);

  const loadAnalytics = useCallback(() => {
    try {
      const raw  = JSON.parse(localStorage.getItem('vz_analytics') || '{"views":[],"sessions":[]}');
      const views = raw.views || [];
      const sessions = raw.sessions || [];

      // Group by page
      const pageMap = {};
      views.forEach(v => { pageMap[v.page] = (pageMap[v.page] || 0) + 1; });
      const topPages = Object.entries(pageMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([page, count]) => ({ page, count }));

      // Group by day (last 7 days)
      const now = Date.now();
      const days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now - (6 - i) * 86400000);
        return { label: d.toLocaleDateString('en-US', { weekday: 'short' }), value: 0, ts: d.setHours(0,0,0,0) };
      });
      views.forEach(v => {
        const vDay = new Date(v.ts).setHours(0,0,0,0);
        const slot = days.find(d => d.ts === vDay);
        if (slot) slot.value++;
      });

      setAnalytics({
        pageViews:    views.length,
        uniqueVisits: sessions.length,
        topPages,
        dailyViews:   days,
      });
    } catch { /* no analytics yet */ }
  }, []);

  const loadClients = useCallback(() => {
    try { setClients(JSON.parse(localStorage.getItem('vz_clients') || '[]')); }
    catch { setClients([]); }
  }, []);

  const loadInvoices = useCallback(() => {
    try { setInvoices(JSON.parse(localStorage.getItem('vz_invoices') || '[]')); }
    catch { setInvoices([]); }
  }, []);

  useEffect(() => {
    if (!auth) return;
    loadOrders();
    loadAnalytics();
    loadClients();
    loadInvoices();
  }, [auth, loadOrders, loadAnalytics, loadClients, loadInvoices]);

  // Track this visit
  useEffect(() => {
    try {
      const key = 'vz_analytics';
      const raw = JSON.parse(localStorage.getItem(key) || '{"views":[],"sessions":[]}');
      raw.views = [...(raw.views || []), { page: window.location.pathname, ts: Date.now() }].slice(-500);
      const sid = sessionStorage.getItem('vz_sid');
      if (!sid) {
        sessionStorage.setItem('vz_sid', '1');
        raw.sessions = [...(raw.sessions || []), { ts: Date.now() }].slice(-200);
      }
      localStorage.setItem(key, JSON.stringify(raw));
    } catch { /* silent */ }
  }, []);

  const updateStatus = (id, status) => {
    const updated = orders.map(o => o.id === id ? { ...o, status } : o);
    setOrders(updated);
    localStorage.setItem('vz_print_orders', JSON.stringify(updated));
    if (detail?.id === id) setDetail(prev => ({ ...prev, status }));
  };

  const deleteClient = (id) => {
    const updated = clients.filter(c => c.id !== id);
    setClients(updated);
    localStorage.setItem('vz_clients', JSON.stringify(updated));
  };

  const deleteOrder = (id) => {
    const updated = orders.filter(o => o.id !== id);
    setOrders(updated);
    localStorage.setItem('vz_print_orders', JSON.stringify(updated));
    if (detail?.id === id) setDetail(null);
  };

  const createClientAccount = (e) => {
    e.preventDefault();
    setNewClientError('');
    const uname = newClientForm.username.trim().toLowerCase();
    if (!uname) return setNewClientError('Username is required.');
    if (/\s/.test(uname)) return setNewClientError('Username cannot contain spaces.');
    if (!newClientForm.password || newClientForm.password.length < 6) return setNewClientError('Password must be at least 6 characters.');
    if (clients.find(c => (c.username || '').toLowerCase() === uname)) return setNewClientError('That username is already taken.');
    const client = {
      id: Date.now(),
      username: uname,
      name: newClientForm.name.trim() || uname,
      email: newClientForm.email.toLowerCase().trim() || null,
      password: newClientForm.password,
      passwordHash: hashPassword(newClientForm.password),
      createdAt: new Date().toISOString(),
      createdByAdmin: true,
    };
    const updated = [...clients, client];
    setClients(updated);
    localStorage.setItem('vz_clients', JSON.stringify(updated));
    setNewClientForm({ username: '', name: '', email: '', password: '' });
    setNewClientOpen(false);
  };

  const createInvoice = (e) => {
    e.preventDefault();
    const client = clients.find(c => c.email === invForm.clientEmail || c.username === invForm.clientEmail);
    const inv = {
      id: `inv_${Date.now()}`,
      clientId: client?.id || null,
      clientEmail: client?.email || invForm.clientEmail,
      clientName: client?.name || invForm.clientEmail,
      invoiceNumber: invForm.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      description: invForm.description,
      amount: parseFloat(invForm.amount) || 0,
      status: 'unpaid',
      dueDate: invForm.dueDate,
      notes: invForm.notes,
      stripeLink: invForm.stripeLink.trim() || null,
      createdAt: new Date().toISOString(),
    };
    const updated = [inv, ...invoices];
    setInvoices(updated);
    localStorage.setItem('vz_invoices', JSON.stringify(updated));
    setInvForm({ clientEmail: '', invoiceNumber: '', description: '', amount: '', dueDate: '', notes: '', stripeLink: '' });
    setInvFormOpen(false);
    setSelectedInvoice(inv);
  };

  const markInvoicePaid = (id) => {
    const updated = invoices.map(inv => inv.id === id ? { ...inv, status: 'paid', paidAt: new Date().toISOString() } : inv);
    setInvoices(updated);
    localStorage.setItem('vz_invoices', JSON.stringify(updated));
    if (selectedInvoice?.id === id) setSelectedInvoice(prev => ({ ...prev, status: 'paid', paidAt: new Date().toISOString() }));
  };

  const markInvoiceOverdue = (id) => {
    const updated = invoices.map(inv => inv.id === id ? { ...inv, status: 'overdue' } : inv);
    setInvoices(updated);
    localStorage.setItem('vz_invoices', JSON.stringify(updated));
    if (selectedInvoice?.id === id) setSelectedInvoice(prev => ({ ...prev, status: 'overdue' }));
  };

  const markInvoiceUpfront = (id) => {
    const updated = invoices.map(inv => inv.id === id ? { ...inv, status: 'upfront', upfrontAt: new Date().toISOString() } : inv);
    setInvoices(updated);
    localStorage.setItem('vz_invoices', JSON.stringify(updated));
    if (selectedInvoice?.id === id) setSelectedInvoice(prev => ({ ...prev, status: 'upfront', upfrontAt: new Date().toISOString() }));
  };

  const deleteInvoice = (id) => {
    const updated = invoices.filter(inv => inv.id !== id);
    setInvoices(updated);
    localStorage.setItem('vz_invoices', JSON.stringify(updated));
    if (selectedInvoice?.id === id) setSelectedInvoice(null);
  };

  const updateInvoiceStripeLink = (id, link) => {
    const clean = link.trim() || null;
    const updated = invoices.map(inv => inv.id === id ? { ...inv, stripeLink: clean } : inv);
    setInvoices(updated);
    localStorage.setItem('vz_invoices', JSON.stringify(updated));
    if (selectedInvoice?.id === id) setSelectedInvoice(prev => ({ ...prev, stripeLink: clean }));
  };

  if (!auth) return <LoginScreen onAuth={() => setAuth(true)} />;

  // Derived stats
  const statusCounts = ORDER_STATUSES.reduce((acc, s) => {
    acc[s.id] = orders.filter(o => (o.status || 'pending') === s.id).length;
    return acc;
  }, {});
  const newToday = orders.filter(o => {
    const d = new Date(o.date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  const filtered = orders.filter(o => {
    const matchStatus = filter === 'all' || (o.status || 'pending') === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || (o.name || '').toLowerCase().includes(q) || (o.email || '').toLowerCase().includes(q) || (o.type || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const maxDay = Math.max(...analytics.dailyViews.map(d => d.value), 1);

  return (
    <div className="adm-page">
      {/* ── Mobile topbar ───────────────────────── */}
      <div className="adm-mobile-topbar">
        <span className="adm-mobile-topbar-title">
          {{ overview: 'Overview', orders: 'Orders', clients: 'Clients', invoices: 'Invoices' }[tab]}
        </span>
        <button className="adm-mobile-logout-btn" onClick={() => setAuth(false)} aria-label="Log out">
          <IconLogout size={18} stroke={1.8} />
        </button>
      </div>

      {/* ── Sidebar ─────────────────────────────── */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-logo">
          <img src="/logo.svg" alt="Visualize" style={{ height: 28 }} />
        </div>
        <nav className="adm-sidebar-nav">
          {[
            { id: 'overview',  label: 'Overview',  icon: <IconLayoutDashboard size={16} stroke={1.6} /> },
            { id: 'orders',    label: 'Orders',    icon: <IconListDetails size={16} stroke={1.6} />, badge: statusCounts.pending || null },
            { id: 'clients',   label: 'Clients',   icon: <IconUsers size={16} stroke={1.6} />, badge: clients.length || null },
            { id: 'invoices',  label: 'Invoices',  icon: <IconReceipt size={16} stroke={1.6} />, badge: invoices.filter(i => i.status === 'unpaid').length || null },
          ].map(item => (
            <button
              key={item.id}
              type="button"
              className={`adm-nav-item ${tab === item.id ? 'adm-nav-item--active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {item.icon}
              {item.label}
              {item.badge ? <span className="adm-nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
        <button className="adm-logout" onClick={() => setAuth(false)}>
          <IconLogout size={14} stroke={1.6} />
          Log out
        </button>
      </aside>

      {/* ── Main content ───────────────────────── */}
      <main className="adm-main">

        {/* ── Overview tab ─────────────────────── */}
        {tab === 'overview' && (
          <div className="adm-content">
            <div className="adm-topbar">
              <div>
                <h1 className="adm-title">Overview</h1>
                <p className="adm-subtitle">Visualize Studio Dashboard</p>
              </div>
              <button className="adm-refresh" onClick={() => { loadOrders(); loadAnalytics(); loadClients(); }} title="Refresh">
                <IconRefresh size={15} stroke={1.8} />
                Refresh
              </button>
            </div>

            {/* Stat cards */}
            <div className="adm-stats-grid">
              <StatCard
                label="Total Orders"
                value={orders.length}
                sub={newToday > 0 ? `+${newToday} today` : 'No new today'}
                accent="var(--brand)"
                icon={<IconListDetails size={18} stroke={1.6} />}
              />
              <StatCard
                label="Pending Review"
                value={statusCounts.pending || 0}
                accent="#f59e0b"
                icon={<IconClock size={18} stroke={1.6} />}
              />
              <StatCard
                label="Completed"
                value={statusCounts.completed || 0}
                accent="#22c55e"
                icon={<IconCheck size={18} stroke={1.8} />}
              />
              <StatCard
                label="Page Views"
                value={analytics.pageViews}
                sub={`${analytics.uniqueVisits} sessions`}
                accent="#60a5fa"
                icon={<IconEye size={18} stroke={1.6} />}
              />
            </div>

            {/* Charts row */}
            <div className="adm-charts-row">
              {/* Daily views chart */}
              <div className="adm-panel">
                <h3 className="adm-panel-title">Page Views — Last 7 Days</h3>
                <MiniBar data={analytics.dailyViews} max={maxDay} />
                {analytics.pageViews === 0 && (
                  <p className="adm-panel-empty">Analytics are recorded as visitors browse the site.</p>
                )}
              </div>

              {/* Order status breakdown */}
              <div className="adm-panel">
                <h3 className="adm-panel-title">Order Status Breakdown</h3>
                <div className="adm-status-list">
                  {ORDER_STATUSES.map(s => (
                    <div key={s.id} className="adm-status-row">
                      <div className="adm-status-row-left">
                        <span className="adm-status-bar-dot" style={{ background: s.color }} />
                        <span className="adm-status-row-label">{s.label}</span>
                      </div>
                      <div className="adm-status-row-right">
                        <div className="adm-status-track">
                          <div
                            className="adm-status-fill"
                            style={{
                              width: orders.length ? `${((statusCounts[s.id] || 0) / orders.length) * 100}%` : '0%',
                              background: s.color,
                            }}
                          />
                        </div>
                        <span className="adm-status-count">{statusCounts[s.id] || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {orders.length === 0 && <p className="adm-panel-empty">No orders yet.</p>}
              </div>
            </div>

            {/* Top pages */}
            {analytics.topPages.length > 0 && (
              <div className="adm-panel adm-panel--full">
                <h3 className="adm-panel-title">Top Pages</h3>
                <div className="adm-top-pages">
                  {analytics.topPages.map((p, i) => (
                    <div key={p.page} className="adm-top-page-row">
                      <span className="adm-top-page-rank">#{i + 1}</span>
                      <span className="adm-top-page-path">{p.page || '/'}</span>
                      <span className="adm-top-page-count">{p.count} views</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent orders */}
            {orders.length > 0 && (
              <div className="adm-panel adm-panel--full">
                <div className="adm-panel-head">
                  <h3 className="adm-panel-title">Recent Orders</h3>
                  <button className="adm-see-all" onClick={() => setTab('orders')}>
                    See all <IconArrowRight size={12} stroke={2} />
                  </button>
                </div>
                <div className="adm-recent-list">
                  {orders.slice(0, 5).map(o => (
                    <div
                      key={o.id}
                      className="adm-recent-row"
                      onClick={() => { setDetail(o); setTab('orders'); }}
                    >
                      <div className="adm-recent-left">
                        <span className="adm-recent-name">{o.name || 'Unknown'}</span>
                        <span className="adm-recent-info">{o.type} · {o.quantity && `${o.quantity} units`} · {o.finish}</span>
                      </div>
                      <div className="adm-recent-right">
                        <StatusBadge status={o.status || 'pending'} />
                        <span className="adm-recent-time">{timeAgo(o.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Orders tab ───────────────────────── */}
        {tab === 'orders' && (
          <div className="adm-content">
            <div className="adm-topbar">
              <div>
                <h1 className="adm-title">Orders</h1>
                <p className="adm-subtitle">{orders.length} total · {statusCounts.pending || 0} pending</p>
              </div>
            </div>

            {/* Filter + search bar */}
            <div className="adm-filters">
              <div className="adm-filter-tabs">
                {[{ id: 'all', label: 'All' }, ...ORDER_STATUSES].map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`adm-filter-tab ${filter === s.id ? 'active' : ''}`}
                    onClick={() => setFilter(s.id)}
                  >
                    {s.label}
                    <span className="adm-filter-count">
                      {s.id === 'all' ? orders.length : statusCounts[s.id] || 0}
                    </span>
                  </button>
                ))}
              </div>
              <input
                className="adm-search"
                placeholder="Search by name, email, type…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {orders.length === 0 ? (
              <div className="adm-empty">
                <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
                  <rect x="8" y="10" width="32" height="28" rx="4" stroke="var(--text-muted)" strokeWidth="2" />
                  <path d="M16 18h16M16 24h10M16 30h8" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p>No orders yet. They&apos;ll appear here once customers submit a quote request.</p>
              </div>
            ) : (
              <div className={`adm-layout ${mobileOrderDetail ? 'adm-detail-open' : ''}`}>
                {/* Order list */}
                <div className="adm-list">
                  {filtered.length === 0 ? (
                    <p className="adm-no-results">No orders match your filters.</p>
                  ) : filtered.map(o => (
                    <button
                      key={o.id}
                      type="button"
                      className={`adm-row ${detail?.id === o.id ? 'adm-row--active' : ''}`}
                      onClick={() => { setDetail(o); setMobileOrderDetail(true); }}
                    >
                      <div className="adm-row-top">
                        <strong className="adm-row-name">{o.name || 'Unknown'}</strong>
                        <span className="adm-row-date">{formatDateShort(o.date)}</span>
                      </div>
                      <div className="adm-row-mid">
                        {o.type && <span className="adm-chip">{o.type}</span>}
                        {o.quantity && <span className="adm-chip">{o.quantity} units</span>}
                        {o.finish && <span className="adm-chip">{o.finish}</span>}
                      </div>
                      <StatusBadge status={o.status || 'pending'} />
                    </button>
                  ))}
                </div>

                {/* Detail panel */}
                <div className="adm-detail">
                  {detail ? (
                    <>
                      <button className="adm-mobile-back-btn" onClick={() => setMobileOrderDetail(false)}>
                        <IconArrowLeft size={15} stroke={2} /> All Orders
                      </button>
                      <div className="adm-detail-header">
                        <div>
                          <h2 className="adm-detail-name">{detail.name}</h2>
                          <p className="adm-detail-date">{formatDate(detail.date)}</p>
                        </div>
                        <button className="adm-delete" onClick={() => deleteOrder(detail.id)}>
                          <IconTrash size={13} stroke={1.6} />
                          Delete
                        </button>
                      </div>

                      {/* Status picker */}
                      <div className="adm-status-picker">
                        <p className="adm-detail-section">Order Status</p>
                        <div className="adm-status-options">
                          {ORDER_STATUSES.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              className={`adm-status-opt ${(detail.status || 'pending') === s.id ? 'active' : ''}`}
                              style={{ '--sc': s.color }}
                              onClick={() => updateStatus(detail.id, s.id)}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Order specs */}
                      <div className="adm-detail-grid">
                        {[
                          ['Product Type', detail.subtype === 'instagram-vinyl' ? 'Instagram Handle Vinyl' : detail.type],
                          ['Instagram Handle', detail.handle],
                          ['Car Color',    detail.carColor],
                          ['Shape',        detail.shape],
                          ['Size',         detail.size],
                          ['Quantity',     detail.quantity ? `${detail.quantity} units` : null],
                          ['Finish',       detail.finish],
                          ['Design',       detail.design],
                          ['Payment',      detail.paymentConfirmed ? '✓ $10 Paid via Stripe' : detail.amount ? `$${detail.amount}` : null],
                        ].filter(([,v]) => v).map(([k, v]) => (
                          <div key={k} className="adm-detail-pair">
                            <span className="adm-detail-key">{k}</span>
                            <span className="adm-detail-val">{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Contact */}
                      <div className="adm-detail-contact">
                        <p className="adm-detail-section">Contact Info</p>
                        <div className="adm-contact-rows">
                          <div className="adm-contact-row">
                            <span className="adm-contact-key">Email</span>
                            <a href={`mailto:${detail.email}`} className="adm-contact-val">{detail.email}</a>
                          </div>
                          {detail.phone && (
                            <div className="adm-contact-row">
                              <span className="adm-contact-key">Phone</span>
                              <a href={`tel:${detail.phone}`} className="adm-contact-val">{detail.phone}</a>
                            </div>
                          )}
                          {detail.social && (
                            <div className="adm-contact-row">
                              <span className="adm-contact-key">Social</span>
                              <span className="adm-contact-val">{detail.social}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {detail.notes && (
                        <div className="adm-detail-notes">
                          <p className="adm-detail-section">Notes</p>
                          <p className="adm-notes-text">{detail.notes}</p>
                        </div>
                      )}

                      {/* Quick actions */}
                      <div className="adm-quick-actions">
                        <a
                          href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(detail.email)}&su=${encodeURIComponent('Your Custom Print Quote — Visualize Studio')}&body=${encodeURIComponent('Hi ' + detail.name + ',\n\nThanks for your order request. Here\'s your quote for ' + detail.type + ' (' + (detail.size || '') + ', ' + (detail.quantity || '') + ' units, ' + (detail.finish || '') + ' finish):\n\n[Insert quote details here]\n\nBest,\nVisualize Studio')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary adm-action-btn"
                        >
                          <IconMail size={15} stroke={1.6} />
                          Send Quote Email
                        </a>
                        {detail.phone && (
                          <a href={`sms:${detail.phone}`} className="btn btn-secondary adm-action-btn">
                            <IconPhone size={15} stroke={1.6} />
                            Text Client
                          </a>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="adm-detail-empty">
                      <svg viewBox="0 0 48 48" fill="none" width="40" height="40">
                        <rect x="8" y="8" width="32" height="32" rx="6" stroke="var(--text-muted)" strokeWidth="1.8" />
                        <path d="M16 18h16M16 24h10" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      <p>Select an order to view details</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {/* ── Invoices tab ─────────────────────── */}
        {tab === 'invoices' && (
          <div className="adm-content">
            <div className="adm-topbar">
              <div>
                <h1 className="adm-title">Invoices</h1>
                <p className="adm-subtitle">{invoices.length} total · {invoices.filter(i => i.status === 'unpaid').length} unpaid</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="adm-refresh" onClick={loadInvoices} title="Refresh">
                  <IconRefresh size={15} stroke={1.8} />
                  Refresh
                </button>
                <button className="btn btn-primary adm-action-btn" onClick={() => setInvFormOpen(v => !v)}>
                  <IconPlus size={15} stroke={2} />
                  New Invoice
                </button>
              </div>
            </div>

            {/* Create invoice form */}
            {invFormOpen && (
              <div className="adm-panel adm-panel--full adm-inv-form-wrap">
                <h3 className="adm-panel-title" style={{ marginBottom: 'var(--space-5)' }}>Create Invoice</h3>
                <form onSubmit={createInvoice} className="adm-inv-form">
                  <div className="adm-inv-form-row">
                    <div className="adm-inv-field">
                      <label className="adm-inv-label">Client</label>
                      {clients.length > 0 ? (
                        <select
                          className="adm-inv-input"
                          value={invForm.clientEmail}
                          onChange={e => setInvForm(f => ({ ...f, clientEmail: e.target.value }))}
                          required
                        >
                          <option value="">Select a client…</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.username || c.email}>
                              {c.name}{c.username ? ` (@${c.username})` : ''}{c.email ? ` — ${c.email}` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="adm-inv-input"
                          type="email"
                          placeholder="client@email.com"
                          value={invForm.clientEmail}
                          onChange={e => setInvForm(f => ({ ...f, clientEmail: e.target.value }))}
                          required
                        />
                      )}
                    </div>
                    <div className="adm-inv-field">
                      <label className="adm-inv-label">Invoice #</label>
                      <input
                        className="adm-inv-input"
                        type="text"
                        placeholder="INV-001"
                        value={invForm.invoiceNumber}
                        onChange={e => setInvForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                      />
                    </div>
                    <div className="adm-inv-field">
                      <label className="adm-inv-label">Amount ($)</label>
                      <input
                        className="adm-inv-input"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={invForm.amount}
                        onChange={e => setInvForm(f => ({ ...f, amount: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="adm-inv-field">
                      <label className="adm-inv-label">Due Date</label>
                      <input
                        className="adm-inv-input"
                        type="date"
                        value={invForm.dueDate}
                        onChange={e => setInvForm(f => ({ ...f, dueDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="adm-inv-field" style={{ marginTop: 'var(--space-3)' }}>
                    <label className="adm-inv-label">Description</label>
                    <input
                      className="adm-inv-input"
                      type="text"
                      placeholder="e.g. Custom die-cut stickers — 250 units"
                      value={invForm.description}
                      onChange={e => setInvForm(f => ({ ...f, description: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="adm-inv-field" style={{ marginTop: 'var(--space-3)' }}>
                    <label className="adm-inv-label">Notes (optional)</label>
                    <textarea
                      className="adm-inv-input adm-inv-textarea"
                      placeholder="Payment instructions, bank details, etc."
                      value={invForm.notes}
                      onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="adm-inv-field" style={{ marginTop: 'var(--space-3)' }}>
                    <label className="adm-inv-label">Stripe Payment Link (optional)</label>
                    <div className="adm-inv-link-wrap">
                      <IconLink size={14} stroke={1.8} className="adm-inv-link-icon" />
                      <input
                        className="adm-inv-input adm-inv-link-input"
                        type="url"
                        placeholder="https://buy.stripe.com/…"
                        value={invForm.stripeLink}
                        onChange={e => setInvForm(f => ({ ...f, stripeLink: e.target.value }))}
                      />
                    </div>
                    <span className="adm-inv-link-hint">Client will see a "Pay Now" button on their portal invoice.</span>
                  </div>
                  <div className="adm-inv-form-actions">
                    <button type="submit" className="btn btn-primary adm-action-btn">
                      <IconReceipt size={14} stroke={1.8} />
                      Create Invoice
                    </button>
                    <button type="button" className="btn btn-secondary adm-action-btn" onClick={() => setInvFormOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {invoices.length === 0 && !invFormOpen ? (
              <div className="adm-empty">
                <IconReceipt size={48} stroke={1.2} color="var(--text-muted)" />
                <p>No invoices yet. Create one with the button above.</p>
              </div>
            ) : invoices.length > 0 && (
              <div className={`adm-layout ${mobileInvDetail ? 'adm-detail-open' : ''}`}>
                {/* Invoice list */}
                <div className="adm-list">
                  {invoices.map(inv => {
                    const statusColor = { paid: '#22c55e', overdue: '#ef4444', upfront: '#60a5fa', unpaid: '#f59e0b' }[inv.status] || '#f59e0b';
                    const statusLabel = { paid: 'Paid in Full', overdue: 'Overdue', upfront: 'Upfront Paid', unpaid: 'Unpaid' }[inv.status] || inv.status;
                    return (
                      <button
                        key={inv.id}
                        type="button"
                        className={`adm-row ${selectedInvoice?.id === inv.id ? 'adm-row--active' : ''}`}
                        onClick={() => { setSelectedInvoice(inv); setMobileInvDetail(true); setStripeLinkDraft(''); }}
                      >
                        <div className="adm-row-top">
                          <strong className="adm-row-name">{inv.invoiceNumber}</strong>
                          <span className="adm-row-date">{formatDateShort(inv.createdAt)}</span>
                        </div>
                        <div className="adm-row-mid">
                          <span className="adm-chip">{inv.clientName}</span>
                          <span className="adm-chip">${Number(inv.amount).toFixed(2)}</span>
                        </div>
                        <span className="adm-status-badge" style={{ '--sc': statusColor }}>
                          <span className="adm-status-dot" />
                          {statusLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Invoice detail */}
                <div className="adm-detail">
                  {selectedInvoice ? (
                    <>
                      <button className="adm-mobile-back-btn" onClick={() => setMobileInvDetail(false)}>
                        <IconArrowLeft size={15} stroke={2} /> All Invoices
                      </button>
                      <div className="adm-detail-header">
                        <div>
                          <h2 className="adm-detail-name">{selectedInvoice.invoiceNumber}</h2>
                          <p className="adm-detail-date">Created {formatDate(selectedInvoice.createdAt)}</p>
                        </div>
                        <button className="adm-delete" onClick={() => deleteInvoice(selectedInvoice.id)}>
                          <IconTrash size={13} stroke={1.6} />
                          Delete
                        </button>
                      </div>

                      {/* Amount hero */}
                      <div className="adm-inv-hero">
                        <span className="adm-inv-hero-label">Amount Due</span>
                        <span className="adm-inv-hero-amount">${Number(selectedInvoice.amount).toFixed(2)}</span>
                        {selectedInvoice.dueDate && (
                          <span className="adm-inv-hero-due">Due {new Date(selectedInvoice.dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        )}
                      </div>

                      {/* Status + actions */}
                      <div className="adm-inv-status-row">
                        {(() => {
                          const statusColors = { paid: '#22c55e', overdue: '#ef4444', upfront: '#60a5fa', unpaid: '#f59e0b' };
                          const statusLabels = { paid: 'Paid in Full', overdue: 'Overdue', upfront: 'Upfront Payment Paid', unpaid: 'Unpaid' };
                          const c = statusColors[selectedInvoice.status] || '#f59e0b';
                          return (
                            <span className="adm-status-badge" style={{ '--sc': c }}>
                              <span className="adm-status-dot" />
                              {statusLabels[selectedInvoice.status] || selectedInvoice.status}
                            </span>
                          );
                        })()}
                        {selectedInvoice.status !== 'paid' && (
                          <button className="adm-inv-mark-paid" onClick={() => markInvoicePaid(selectedInvoice.id)}>
                            <IconCircleCheck size={14} stroke={1.8} />
                            Mark Paid in Full
                          </button>
                        )}
                        {(selectedInvoice.status === 'unpaid' || selectedInvoice.status === 'overdue') && (
                          <button className="adm-inv-mark-upfront" onClick={() => markInvoiceUpfront(selectedInvoice.id)}>
                            <IconCircleCheck size={14} stroke={1.8} />
                            Upfront Paid
                          </button>
                        )}
                        {selectedInvoice.status === 'unpaid' && (
                          <button className="adm-inv-mark-overdue" onClick={() => markInvoiceOverdue(selectedInvoice.id)}>
                            Mark Overdue
                          </button>
                        )}
                      </div>

                      {/* Details */}
                      <div className="adm-detail-grid" style={{ marginTop: 'var(--space-4)' }}>
                        <div className="adm-detail-pair">
                          <span className="adm-detail-key">Client</span>
                          <span className="adm-detail-val">{selectedInvoice.clientName}</span>
                        </div>
                        <div className="adm-detail-pair">
                          <span className="adm-detail-key">Email</span>
                          <span className="adm-detail-val" style={{ fontSize: '0.8rem', textTransform: 'none' }}>{selectedInvoice.clientEmail}</span>
                        </div>
                      </div>

                      <div className="adm-detail-contact" style={{ marginTop: 'var(--space-4)' }}>
                        <p className="adm-detail-section">Description</p>
                        <p className="adm-notes-text">{selectedInvoice.description}</p>
                      </div>

                      {selectedInvoice.notes && (
                        <div className="adm-detail-notes">
                          <p className="adm-detail-section">Notes</p>
                          <p className="adm-notes-text">{selectedInvoice.notes}</p>
                        </div>
                      )}

                      {selectedInvoice.paidAt && (
                        <div className="adm-detail-notes">
                          <p className="adm-detail-section">Paid On</p>
                          <p className="adm-notes-text" style={{ color: '#22c55e' }}>{formatDate(selectedInvoice.paidAt)}</p>
                        </div>
                      )}

                      {/* Stripe Payment Link */}
                      <div className="adm-inv-stripe-section">
                        <p className="adm-detail-section">Stripe Payment Link</p>
                        {selectedInvoice.stripeLink ? (
                          <div className="adm-inv-stripe-linked">
                            <div className="adm-inv-stripe-pill">
                              <IconLink size={13} stroke={1.8} />
                              <span className="adm-inv-stripe-url">{selectedInvoice.stripeLink}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="adm-inv-stripe-btn"
                                onClick={() => { navigator.clipboard?.writeText(selectedInvoice.stripeLink); }}
                              >
                                <IconCopy size={12} stroke={1.8} /> Copy
                              </button>
                              <a href={selectedInvoice.stripeLink} target="_blank" rel="noopener noreferrer" className="adm-inv-stripe-btn">
                                Open ↗
                              </a>
                              <button
                                type="button"
                                className="adm-inv-stripe-btn adm-inv-stripe-btn--danger"
                                onClick={() => updateInvoiceStripeLink(selectedInvoice.id, '')}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="adm-inv-stripe-add">
                            <div className="adm-inv-link-wrap">
                              <IconLink size={14} stroke={1.8} className="adm-inv-link-icon" />
                              <input
                                className="adm-inv-input adm-inv-link-input"
                                type="url"
                                placeholder="https://buy.stripe.com/…"
                                value={stripeLinkDraft}
                                onChange={e => setStripeLinkDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { updateInvoiceStripeLink(selectedInvoice.id, stripeLinkDraft); setStripeLinkDraft(''); } }}
                              />
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary adm-action-btn"
                              style={{ marginTop: 'var(--space-2)' }}
                              onClick={() => { updateInvoiceStripeLink(selectedInvoice.id, stripeLinkDraft); setStripeLinkDraft(''); }}
                              disabled={!stripeLinkDraft.trim()}
                            >
                              <IconLink size={14} stroke={1.8} /> Attach Link
                            </button>
                            <span className="adm-inv-link-hint">Client will see a "Pay Now" button on their portal.</span>
                          </div>
                        )}
                      </div>

                      {/* Send via Gmail */}
                      <div className="adm-quick-actions">
                        <a
                          href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(selectedInvoice.clientEmail)}&su=${encodeURIComponent(`Invoice ${selectedInvoice.invoiceNumber} — Visualize Studio`)}&body=${encodeURIComponent(`Hi ${selectedInvoice.clientName},\n\nPlease find your invoice below:\n\nInvoice #: ${selectedInvoice.invoiceNumber}\nAmount: $${Number(selectedInvoice.amount).toFixed(2)}\n${selectedInvoice.dueDate ? `Due Date: ${selectedInvoice.dueDate}\n` : ''}Description: ${selectedInvoice.description}\n${selectedInvoice.notes ? `\nNotes:\n${selectedInvoice.notes}\n` : ''}${selectedInvoice.stripeLink ? `\nPay online: ${selectedInvoice.stripeLink}\n` : ''}\nThank you!\nVisualize Studio`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-primary adm-action-btn"
                        >
                          <IconMail size={15} stroke={1.6} />
                          Send Invoice Email
                        </a>
                      </div>
                    </>
                  ) : (
                    <div className="adm-detail-empty">
                      <IconReceipt size={40} stroke={1.3} color="var(--text-muted)" />
                      <p>Select an invoice to view details</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Clients tab ──────────────────────── */}
        {tab === 'clients' && (
          <div className="adm-content">
            <div className="adm-topbar">
              <div>
                <h1 className="adm-title">Clients</h1>
                <p className="adm-subtitle">{clients.length} registered portal account{clients.length !== 1 ? 's' : ''}</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button className="adm-refresh" onClick={loadClients} title="Refresh">
                  <IconRefresh size={15} stroke={1.8} />
                  Refresh
                </button>
                <button className="btn btn-primary adm-action-btn" onClick={() => { setNewClientOpen(v => !v); setNewClientError(''); }}>
                  <IconKey size={15} stroke={1.8} />
                  Create Account
                </button>
              </div>
            </div>

            {/* Create client account form */}
            {newClientOpen && (
              <div className="adm-panel adm-panel--full adm-inv-form-wrap">
                <h3 className="adm-panel-title" style={{ marginBottom: 'var(--space-5)' }}>Create Client Account</h3>
                <form onSubmit={createClientAccount} className="adm-inv-form">
                  <div className="adm-inv-form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                    <div className="adm-inv-field">
                      <label className="adm-inv-label">Username <span style={{ color: 'var(--brand)' }}>*</span></label>
                      <input
                        className="adm-inv-input"
                        type="text"
                        placeholder="no spaces"
                        value={newClientForm.username}
                        onChange={e => { setNewClientForm(f => ({ ...f, username: e.target.value })); setNewClientError(''); }}
                        autoCapitalize="none"
                        required
                      />
                    </div>
                    <div className="adm-inv-field">
                      <label className="adm-inv-label">Display Name</label>
                      <input
                        className="adm-inv-input"
                        type="text"
                        placeholder="Client's name (optional)"
                        value={newClientForm.name}
                        onChange={e => setNewClientForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="adm-inv-field">
                      <label className="adm-inv-label">Email (optional)</label>
                      <input
                        className="adm-inv-input"
                        type="email"
                        placeholder="for order matching"
                        value={newClientForm.email}
                        onChange={e => setNewClientForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <div className="adm-inv-field">
                      <label className="adm-inv-label">Password <span style={{ color: 'var(--brand)' }}>*</span></label>
                      <input
                        className="adm-inv-input"
                        type="text"
                        placeholder="6+ characters"
                        value={newClientForm.password}
                        onChange={e => setNewClientForm(f => ({ ...f, password: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                  {newClientError && <p style={{ color: '#f87171', fontSize: '0.8125rem', marginTop: 'var(--space-2)' }}>{newClientError}</p>}
                  <div className="adm-inv-form-actions">
                    <button type="submit" className="btn btn-primary adm-action-btn">
                      <IconKey size={14} stroke={1.8} />
                      Create Account
                    </button>
                    <button type="button" className="btn btn-secondary adm-action-btn" onClick={() => setNewClientOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {clients.length === 0 && !newClientOpen ? (
              <div className="adm-empty">
                <IconUsers size={48} stroke={1.2} color="var(--text-muted)" />
                <p>No client accounts yet. Create one above or they&apos;ll appear here when someone signs up through the portal.</p>
              </div>
            ) : clients.length > 0 && (
              <div className="adm-panel adm-panel--full">
                <div className="adm-clients-table">
                  <div className="adm-clients-head">
                    <span>Name</span>
                    <span>Username</span>
                    <span>Password</span>
                    <span>Joined</span>
                    <span>Orders</span>
                    <span>Actions</span>
                  </div>
                  {clients.map(c => {
                    const clientOrders = orders.filter(o => c.email && o.email?.toLowerCase() === c.email?.toLowerCase());
                    return (
                      <div key={c.id} className="adm-clients-row">
                        <div className="adm-client-name-cell">
                          <div className="adm-client-avatar">
                            {(c.name || c.username || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="adm-client-name">{c.name || c.username}</span>
                        </div>
                        <div className="adm-client-username-cell">
                          <span className="adm-client-username">@{c.username || '—'}</span>
                          {c.email && <span className="adm-client-email-sub">{c.email}</span>}
                        </div>
                        <span className="adm-client-password">{c.password || <em style={{color:'var(--text-muted)',fontStyle:'italic',fontSize:'0.75rem'}}>hidden</em>}</span>
                        <span className="adm-client-joined">{formatDate(c.createdAt)}</span>
                        <span className="adm-client-orders">
                          {clientOrders.length > 0 ? (
                            <button type="button" className="adm-client-orders-btn" onClick={() => setTab('orders')}>
                              {clientOrders.length} order{clientOrders.length !== 1 ? 's' : ''}
                            </button>
                          ) : (
                            <span className="adm-client-no-orders">None</span>
                          )}
                        </span>
                        <div className="adm-client-actions">
                          {c.email && (
                            <a
                              href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(c.email)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="adm-client-action-btn"
                              title="Open in Gmail"
                            >
                              <IconMail size={14} stroke={1.6} />
                            </a>
                          )}
                          <button
                            type="button"
                            className="adm-client-action-btn adm-client-delete-btn"
                            title="Remove account"
                            onClick={() => deleteClient(c.id)}
                          >
                            <IconTrash size={14} stroke={1.6} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Mobile bottom nav ───────────────────── */}
      <nav className="adm-bottom-nav">
        {[
          { id: 'overview',  label: 'Overview',  icon: <IconLayoutDashboard size={22} stroke={1.6} /> },
          { id: 'orders',    label: 'Orders',    icon: <IconListDetails size={22} stroke={1.6} />, badge: statusCounts.pending || null },
          { id: 'clients',   label: 'Clients',   icon: <IconUsers size={22} stroke={1.6} /> },
          { id: 'invoices',  label: 'Invoices',  icon: <IconReceipt size={22} stroke={1.6} />, badge: invoices.filter(i => i.status === 'unpaid').length || null },
        ].map(item => (
          <button
            key={item.id}
            type="button"
            className={`adm-bottom-nav-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => { setTab(item.id); setMobileOrderDetail(false); setMobileInvDetail(false); }}
          >
            <span className="adm-bottom-nav-icon">
              {item.icon}
              {item.badge ? <span className="adm-bottom-nav-badge">{item.badge}</span> : null}
            </span>
            <span className="adm-bottom-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      <style>{admStyles}</style>
    </div>
  );
}

const admStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .adm-page {
    min-height: 100vh;
    background: #0f0f11;
    --bg: #0f0f11;
    --bg-elevated: #141418;
    --bg-card: #1a1a20;
    --glass-bg: rgba(255,255,255,0.04);
    --glass-bg-strong: rgba(255,255,255,0.06);
    --glass-border: rgba(255,255,255,0.09);
    --border-light: rgba(255,255,255,0.13);
    --text: #f4f4f5;
    --text-secondary: #a0a0ab;
    --text-muted: #636373;
    display: flex;
    font-family: 'Inter', -apple-system, sans-serif;
  }

  /* ── Login ───────────────────────────────── */
  .adm-login {
    max-width: 360px;
    margin: auto;
    padding: var(--space-10) var(--space-8);
    background: var(--glass-bg-strong);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    text-align: center;
    box-shadow: 0 24px 80px rgba(0,0,0,0.7);
  }
  .adm-login-logo { display: flex; justify-content: center; margin-bottom: var(--space-6); }
  .adm-login-title { font-size: 1.4rem; font-weight: 800; color: var(--text); margin-bottom: var(--space-1); }
  .adm-login-sub { font-size: 0.8125rem; color: var(--text-muted); margin-bottom: var(--space-6); }
  .adm-login-form { display: flex; flex-direction: column; gap: var(--space-3); }
  .adm-input {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius); border: 1px solid var(--border-light);
    background: var(--glass-bg); color: var(--text);
    font-size: 0.9375rem; font-family: inherit; outline: none;
    text-align: center; width: 100%; transition: border-color 0.2s;
  }
  .adm-input:focus { border-color: var(--brand); }
  .adm-input--error { border-color: rgba(220,80,80,0.7); }
  .adm-pw-err { font-size: 0.8rem; color: rgba(220,80,80,0.9); }
  .adm-login-btn { width: 100%; padding: var(--space-3); }
  @keyframes admShake {
    0%,100% { transform: translateX(0); }
    15%,55%  { transform: translateX(-7px); }
    35%,75%  { transform: translateX(7px); }
  }
  .adm-shake { animation: admShake 0.5s ease; }

  /* ── Sidebar ─────────────────────────────── */
  .adm-sidebar {
    width: 220px;
    flex-shrink: 0;
    background: rgba(8,8,10,0.9);
    border-right: 1px solid rgba(255,255,255,0.07);
    display: flex;
    flex-direction: column;
    padding: var(--space-6) var(--space-4);
    position: sticky;
    top: 0;
    height: 100vh;
  }
  .adm-sidebar-logo {
    padding: var(--space-2) var(--space-2) var(--space-8);
  }
  .adm-sidebar-nav {
    display: flex; flex-direction: column; gap: var(--space-1); flex: 1;
  }
  .adm-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 12px; border-radius: var(--radius);
    background: none; border: none; cursor: pointer;
    font-size: 0.875rem; font-weight: 500; color: var(--text-muted);
    text-align: left; width: 100%;
    transition: background 0.2s, color 0.2s;
  }
  .adm-nav-item:hover { background: rgba(255,255,255,0.05); color: var(--text-secondary); }
  .adm-nav-item--active { background: rgba(212,76,67,0.1); color: var(--text); border-left: 2px solid var(--brand); }
  .adm-nav-badge {
    margin-left: auto;
    font-size: 0.65rem; font-weight: 700;
    background: var(--brand); color: #fff;
    padding: 1px 6px; border-radius: 999px; min-width: 18px; text-align: center;
  }
  .adm-logout {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px; border-radius: var(--radius);
    background: none; border: 1px solid var(--glass-border);
    color: var(--text-muted); font-size: 0.8125rem;
    cursor: pointer; margin-top: var(--space-4);
    transition: color 0.2s, border-color 0.2s;
  }
  .adm-logout:hover { color: var(--text); border-color: var(--text-muted); }

  /* ── Main ────────────────────────────────── */
  .adm-main { flex: 1; overflow-y: auto; }
  .adm-content { width: 100%; padding: var(--space-8); }
  .adm-topbar {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: var(--space-8); gap: var(--space-4);
  }
  .adm-title { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
  .adm-subtitle { font-size: 0.875rem; color: var(--text-muted); margin-top: 3px; }
  .adm-refresh {
    display: flex; align-items: center; gap: 6px;
    background: var(--glass-bg); border: 1px solid var(--glass-border);
    color: var(--text-secondary); font-size: 0.8125rem;
    padding: 7px 12px; border-radius: var(--radius);
    cursor: pointer; transition: color 0.2s; white-space: nowrap;
  }
  .adm-refresh:hover { color: var(--text); }

  /* ── Stat cards ──────────────────────────── */
  .adm-stats-grid {
    display: grid; grid-template-columns: repeat(4, 1fr);
    gap: var(--space-4); margin-bottom: var(--space-6);
  }
  @media (max-width: 900px) { .adm-stats-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 500px) { .adm-stats-grid { grid-template-columns: 1fr 1fr; } }

  .adm-stat {
    background: var(--glass-bg-strong);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .adm-stat:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
  .adm-stat-top {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: var(--space-3);
  }
  .adm-stat-icon { color: var(--accent, var(--text-muted)); opacity: 0.8; }
  .adm-stat-val { font-size: 2rem; font-weight: 900; color: var(--accent, var(--text)); letter-spacing: -0.03em; }
  .adm-stat-label { font-size: 0.8125rem; color: var(--text-secondary); display: block; }
  .adm-stat-sub { font-size: 0.75rem; color: var(--text-muted); display: block; margin-top: 3px; }

  /* ── Charts ──────────────────────────────── */
  .adm-charts-row {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: var(--space-4); margin-bottom: var(--space-4);
  }
  @media (max-width: 780px) { .adm-charts-row { grid-template-columns: 1fr; } }

  .adm-panel {
    background: var(--glass-bg-strong); border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg); padding: var(--space-5);
  }
  .adm-panel--full { margin-bottom: var(--space-4); }
  .adm-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
  .adm-panel-title { font-size: 0.875rem; font-weight: 700; color: var(--text); margin-bottom: var(--space-4); }
  .adm-panel-empty { font-size: 0.8125rem; color: var(--text-muted); margin-top: var(--space-3); }
  .adm-see-all { background: none; border: none; color: var(--brand); font-size: 0.8125rem; cursor: pointer; font-weight: 600; }

  /* Bar chart */
  .adm-mini-bar {
    display: flex; align-items: flex-end; gap: 6px;
    height: 100px;
  }
  .adm-mini-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; justify-content: flex-end; }
  .adm-mini-bar-fill {
    width: 100%; min-height: 2px;
    background: linear-gradient(180deg, var(--brand-light), var(--brand));
    border-radius: 3px 3px 0 0;
    transition: height 0.4s var(--ease);
  }
  .adm-mini-bar-x { font-size: 0.6rem; color: var(--text-muted); }

  /* Status breakdown */
  .adm-status-list { display: flex; flex-direction: column; gap: var(--space-3); }
  .adm-status-row { display: flex; align-items: center; gap: var(--space-3); }
  .adm-status-row-left { display: flex; align-items: center; gap: 8px; min-width: 100px; }
  .adm-status-bar-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .adm-status-row-label { font-size: 0.8125rem; color: var(--text-secondary); }
  .adm-status-row-right { flex: 1; display: flex; align-items: center; gap: var(--space-2); }
  .adm-status-track { flex: 1; height: 4px; background: rgba(255,255,255,0.07); border-radius: 2px; overflow: hidden; }
  .adm-status-fill { height: 100%; border-radius: 2px; min-width: 2px; transition: width 0.4s var(--ease); }
  .adm-status-count { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); min-width: 20px; text-align: right; }

  /* Top pages */
  .adm-top-pages { display: flex; flex-direction: column; gap: var(--space-2); }
  .adm-top-page-row { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--glass-border); }
  .adm-top-page-row:last-child { border-bottom: none; }
  .adm-top-page-rank { font-size: 0.75rem; font-weight: 700; color: var(--text-muted); min-width: 28px; }
  .adm-top-page-path { flex: 1; font-size: 0.875rem; color: var(--text); font-family: monospace; }
  .adm-top-page-count { font-size: 0.8125rem; color: var(--text-muted); }

  /* Recent orders */
  .adm-recent-list { display: flex; flex-direction: column; }
  .adm-recent-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: var(--space-3) var(--space-2); gap: var(--space-3);
    border-bottom: 1px solid var(--glass-border); cursor: pointer;
    border-radius: var(--radius); transition: background 0.15s;
  }
  .adm-recent-row:last-child { border-bottom: none; }
  .adm-recent-row:hover { background: rgba(255,255,255,0.03); }
  .adm-recent-left { flex: 1; min-width: 0; }
  .adm-recent-name { display: block; font-size: 0.9rem; font-weight: 600; color: var(--text); }
  .adm-recent-info { display: block; font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .adm-recent-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .adm-recent-time { font-size: 0.72rem; color: var(--text-muted); }

  /* ── Status badge ────────────────────────── */
  .adm-status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em;
    padding: 3px 8px; border-radius: 999px;
    background: color-mix(in srgb, var(--sc) 12%, transparent);
    color: var(--sc);
    border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent);
    white-space: nowrap;
  }
  .adm-status-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: var(--sc);
    flex-shrink: 0;
  }

  /* ── Orders list ─────────────────────────── */
  .adm-filters {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
    margin-bottom: var(--space-5); flex-wrap: wrap;
  }
  .adm-filter-tabs { display: flex; gap: var(--space-1); flex-wrap: wrap; }
  .adm-filter-tab {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 12px; border-radius: 999px;
    background: none; border: 1px solid var(--glass-border);
    color: var(--text-muted); font-size: 0.8rem; cursor: pointer;
    transition: all 0.2s; white-space: nowrap;
  }
  .adm-filter-tab:hover { color: var(--text); border-color: var(--text-muted); }
  .adm-filter-tab.active { background: rgba(212,76,67,0.1); border-color: rgba(212,76,67,0.4); color: var(--text); }
  .adm-filter-count { font-size: 0.65rem; color: var(--text-muted); }
  .adm-search {
    padding: 8px 14px; border-radius: var(--radius);
    border: 1px solid var(--border-light);
    background: var(--glass-bg); color: var(--text);
    font-size: 0.875rem; font-family: inherit; outline: none;
    min-width: 200px; transition: border-color 0.2s;
  }
  .adm-search:focus { border-color: var(--brand); }
  @media (max-width: 600px) { .adm-search { width: 100%; } }

  .adm-layout { display: grid; grid-template-columns: 300px 1fr; gap: var(--space-5); align-items: start; }
  @media (max-width: 800px) { .adm-layout { grid-template-columns: 1fr; } }

  .adm-list { display: flex; flex-direction: column; gap: var(--space-2); }
  .adm-no-results { font-size: 0.875rem; color: var(--text-muted); padding: var(--space-4); }

  .adm-row {
    display: flex; flex-direction: column; gap: var(--space-2);
    padding: var(--space-4);
    background: var(--glass-bg); border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg); cursor: pointer;
    text-align: left; width: 100%;
    transition: border-color 0.2s, background 0.2s;
  }
  .adm-row:hover { border-color: rgba(212,76,67,0.4); }
  .adm-row--active { border-color: var(--brand); background: rgba(212,76,67,0.07); }
  .adm-row-top { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); }
  .adm-row-name { font-size: 0.9rem; font-weight: 700; color: var(--text); }
  .adm-row-date { font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; }
  .adm-row-mid { display: flex; flex-wrap: wrap; gap: 4px; }
  .adm-chip {
    font-size: 0.7rem; font-weight: 600;
    padding: 2px 7px; border-radius: 999px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    color: var(--text-secondary); text-transform: capitalize;
  }

  /* ── Detail panel ────────────────────────── */
  .adm-detail {
    background: var(--glass-bg-strong); border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg); padding: var(--space-6); min-height: 320px;
    position: sticky; top: var(--space-8);
  }
  .adm-detail-empty {
    height: 200px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: var(--space-3);
    color: var(--text-muted); font-size: 0.875rem; text-align: center;
  }
  .adm-detail-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: var(--space-4); gap: var(--space-3);
  }
  .adm-detail-name { font-size: 1.2rem; font-weight: 800; color: var(--text); }
  .adm-detail-date { font-size: 0.8rem; color: var(--text-muted); margin-top: 3px; }
  .adm-delete {
    display: flex; align-items: center; gap: 5px; flex-shrink: 0;
    background: none; border: 1px solid rgba(180,50,50,0.3);
    color: rgba(220,80,80,0.8); font-size: 0.8rem;
    padding: 5px 10px; border-radius: var(--radius); cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }
  .adm-delete:hover { color: #f87171; border-color: rgba(220,80,80,0.6); }
  .adm-detail-section { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: var(--space-2); }

  /* Status picker */
  .adm-status-picker { margin-bottom: var(--space-5); }
  .adm-status-options { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .adm-status-opt {
    font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 999px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
    color: var(--text-muted); cursor: pointer; transition: all 0.2s;
  }
  .adm-status-opt:hover { color: var(--text); border-color: rgba(255,255,255,0.2); }
  .adm-status-opt.active {
    background: color-mix(in srgb, var(--sc) 15%, transparent);
    border-color: color-mix(in srgb, var(--sc) 40%, transparent);
    color: var(--sc);
  }

  /* Specs grid */
  .adm-detail-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: var(--space-3); margin-bottom: var(--space-5);
  }
  .adm-detail-pair {
    background: var(--glass-bg); border-radius: var(--radius);
    padding: var(--space-3) var(--space-4);
  }
  .adm-detail-key { display: block; font-size: 0.68rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .adm-detail-val { font-size: 0.9rem; font-weight: 600; color: var(--text); text-transform: capitalize; }

  /* Contact */
  .adm-detail-contact { margin-bottom: var(--space-5); }
  .adm-contact-rows { display: flex; flex-direction: column; gap: var(--space-2); }
  .adm-contact-row { display: flex; gap: var(--space-3); align-items: center; }
  .adm-contact-key { font-size: 0.8rem; color: var(--text-muted); min-width: 44px; }
  .adm-contact-val { font-size: 0.9rem; color: var(--brand); font-weight: 600; }
  .adm-contact-val:hover { text-decoration: underline; }

  /* Notes */
  .adm-detail-notes { margin-bottom: var(--space-5); }
  .adm-notes-text { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.65; white-space: pre-wrap; }

  /* Quick actions */
  .adm-quick-actions {
    display: flex; gap: var(--space-3); flex-wrap: wrap;
    padding-top: var(--space-5); border-top: 1px solid var(--glass-border);
  }
  .adm-action-btn { font-size: 0.8125rem; padding: 8px 14px; display: flex; align-items: center; gap: 6px; }

  /* Empty state */
  .adm-empty {
    background: var(--glass-bg); border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg); padding: var(--space-16);
    text-align: center; color: var(--text-secondary);
    display: flex; flex-direction: column; align-items: center; gap: var(--space-4);
  }

  /* ── Clients table ───────────────────────── */
  .adm-clients-table { width: 100%; }
  .adm-clients-head {
    display: grid;
    grid-template-columns: 180px 1fr 130px 160px 90px 72px;
    padding: var(--space-3) var(--space-4);
    font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--text-muted);
    border-bottom: 1px solid var(--glass-border);
  }
  .adm-clients-row {
    display: grid;
    grid-template-columns: 180px 1fr 130px 160px 90px 72px;
    align-items: center;
    padding: var(--space-4);
    border-bottom: 1px solid var(--glass-border);
    transition: background 0.15s;
  }
  .adm-clients-row:last-child { border-bottom: none; }
  .adm-clients-row:hover { background: rgba(255,255,255,0.025); }

  .adm-client-name-cell { display: flex; align-items: center; gap: var(--space-3); min-width: 0; }
  .adm-client-avatar {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    background: rgba(212,76,67,0.15); border: 1px solid rgba(212,76,67,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 0.8125rem; font-weight: 700; color: var(--brand);
  }
  .adm-client-name { font-size: 0.9rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .adm-client-email { font-size: 0.875rem; color: var(--brand); transition: opacity 0.2s; }
  .adm-client-email:hover { opacity: 0.75; text-decoration: underline; }
  .adm-client-joined { font-size: 0.8125rem; color: var(--text-muted); }
  .adm-client-orders { display: flex; align-items: center; }
  .adm-client-orders-btn {
    background: rgba(212,76,67,0.1); border: 1px solid rgba(212,76,67,0.25);
    color: var(--brand); font-size: 0.78rem; font-weight: 700;
    padding: 3px 9px; border-radius: 999px; cursor: pointer;
    transition: background 0.2s;
  }
  .adm-client-orders-btn:hover { background: rgba(212,76,67,0.2); }
  .adm-client-no-orders { font-size: 0.8125rem; color: var(--text-muted); }
  .adm-client-password {
    font-size: 0.875rem; color: var(--text-secondary);
    font-family: 'Courier New', monospace; letter-spacing: 0.03em;
  }
  .adm-client-actions { display: flex; gap: var(--space-2); }
  .adm-client-action-btn {
    width: 30px; height: 30px; border-radius: var(--radius);
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);
    color: var(--text-muted); transition: color 0.2s, background 0.2s;
  }
  .adm-client-action-btn:hover { color: var(--text); background: rgba(255,255,255,0.1); }
  .adm-client-delete-btn:hover { color: #f87171 !important; border-color: rgba(220,80,80,0.4) !important; background: rgba(220,80,80,0.08) !important; }
  .adm-client-username-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .adm-client-username { font-size: 0.875rem; font-weight: 600; color: var(--text); font-family: monospace; }
  .adm-client-email-sub { font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .adm-inv-mark-upfront {
    display: flex; align-items: center; gap: 5px;
    background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.3);
    color: #60a5fa; font-size: 0.8rem; font-weight: 600;
    padding: 5px 12px; border-radius: 999px; cursor: pointer;
    transition: background 0.2s;
  }
  .adm-inv-mark-upfront:hover { background: rgba(96,165,250,0.2); }

  @media (max-width: 1100px) {
    .adm-clients-head { grid-template-columns: 160px 1fr 130px 90px 52px; }
    .adm-clients-head span:nth-child(4) { display: none; }
    .adm-clients-row { grid-template-columns: 160px 1fr 130px 90px 52px; }
    .adm-clients-row > *:nth-child(4) { display: none; }
  }
  @media (max-width: 800px) {
    .adm-clients-head { grid-template-columns: 140px 1fr 90px 52px; }
    .adm-clients-head span:nth-child(3),
    .adm-clients-head span:nth-child(4) { display: none; }
    .adm-clients-row { grid-template-columns: 140px 1fr 90px 52px; }
    .adm-clients-row > *:nth-child(3),
    .adm-clients-row > *:nth-child(4) { display: none; }
  }

  /* ── Invoice tab ─────────────────────────── */
  .adm-inv-form-wrap { margin-bottom: var(--space-5); }
  .adm-inv-form { display: flex; flex-direction: column; }
  .adm-inv-form-row {
    display: grid; grid-template-columns: 1fr 140px 120px 160px;
    gap: var(--space-3);
  }
  @media (max-width: 900px) { .adm-inv-form-row { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 600px) { .adm-inv-form-row { grid-template-columns: 1fr; } }
  .adm-inv-field { display: flex; flex-direction: column; gap: var(--space-1); }
  .adm-inv-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
  .adm-inv-input {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius); border: 1px solid var(--border-light);
    background: var(--glass-bg); color: var(--text);
    font-size: 0.875rem; font-family: inherit; outline: none;
    transition: border-color 0.2s; width: 100%;
  }
  .adm-inv-input:focus { border-color: var(--brand); }
  .adm-inv-input option { background: #1a1a1a; }
  .adm-inv-textarea { resize: vertical; min-height: 72px; }
  .adm-inv-form-actions { display: flex; gap: var(--space-3); margin-top: var(--space-5); }

  /* Invoice hero amount */
  .adm-inv-hero {
    background: linear-gradient(135deg, rgba(212,76,67,0.12), rgba(212,76,67,0.04));
    border: 1px solid rgba(212,76,67,0.2);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-6);
    margin-bottom: var(--space-4);
    text-align: center;
  }
  .adm-inv-hero-label { display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: var(--space-2); }
  .adm-inv-hero-amount { display: block; font-size: 2.4rem; font-weight: 900; color: var(--text); letter-spacing: -0.04em; }
  .adm-inv-hero-due { display: block; font-size: 0.8125rem; color: var(--text-muted); margin-top: var(--space-1); }

  /* Invoice status row */
  .adm-inv-status-row { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; }
  .adm-inv-mark-paid {
    display: flex; align-items: center; gap: 5px;
    background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3);
    color: #22c55e; font-size: 0.8rem; font-weight: 600;
    padding: 5px 12px; border-radius: 999px; cursor: pointer;
    transition: background 0.2s;
  }
  .adm-inv-mark-paid:hover { background: rgba(34,197,94,0.2); }
  .adm-inv-mark-overdue {
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25);
    color: #ef4444; font-size: 0.8rem; font-weight: 600;
    padding: 5px 12px; border-radius: 999px; cursor: pointer;
    transition: background 0.2s;
  }
  .adm-inv-mark-overdue:hover { background: rgba(239,68,68,0.18); }

  /* Invoice Stripe link section */
  .adm-inv-stripe-section { margin-bottom: var(--space-5); }
  .adm-inv-stripe-linked { display: flex; flex-direction: column; gap: var(--space-2); }
  .adm-inv-stripe-pill {
    display: flex; align-items: center; gap: 6px;
    background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25);
    border-radius: var(--radius); padding: 6px 10px;
    color: #818cf8;
  }
  .adm-inv-stripe-url {
    font-size: 0.75rem; white-space: nowrap; overflow: hidden;
    text-overflow: ellipsis; max-width: 260px;
  }
  .adm-inv-stripe-btn {
    font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: var(--radius);
    background: rgba(255,255,255,0.05); border: 1px solid var(--glass-border);
    color: var(--text-secondary); cursor: pointer; text-decoration: none;
    display: inline-flex; align-items: center; gap: 4px; transition: background 0.15s;
  }
  .adm-inv-stripe-btn:hover { background: rgba(255,255,255,0.1); color: var(--text); }
  .adm-inv-stripe-btn--danger:hover { background: rgba(239,68,68,0.1); color: #f87171; border-color: rgba(239,68,68,0.3); }
  .adm-inv-stripe-add { display: flex; flex-direction: column; gap: var(--space-2); }
  .adm-inv-link-wrap { position: relative; display: flex; align-items: center; }
  .adm-inv-link-icon { position: absolute; left: 12px; color: var(--text-muted); pointer-events: none; }
  .adm-inv-link-input { padding-left: 34px !important; }
  .adm-inv-link-hint { font-size: 0.75rem; color: var(--text-muted); }

  /* ── Mobile topbar + bottom nav (hidden on desktop) ── */
  .adm-mobile-topbar { display: none; }
  .adm-bottom-nav    { display: none; }
  .adm-mobile-back-btn { display: none; }

  @media (max-width: 700px) {
    /* Prevent horizontal overflow / zoom */
    .adm-page {
      flex-direction: column;
      overflow-x: hidden;
      min-width: 0;
    }

    /* Hide desktop sidebar */
    .adm-sidebar { display: none; }

    /* Show sticky mobile topbar */
    .adm-mobile-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(10,10,10,0.97);
      border-bottom: 1px solid var(--glass-border);
      padding: calc(10px + env(safe-area-inset-top)) var(--space-4) 10px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      flex-shrink: 0;
    }
    .adm-mobile-topbar-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text);
      letter-spacing: -0.01em;
    }
    .adm-mobile-logout-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      padding: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      -webkit-tap-highlight-color: transparent;
    }

    /* Main fills width */
    .adm-main {
      width: 100%;
      overflow-x: hidden;
      padding-bottom: calc(62px + env(safe-area-inset-bottom));
    }

    .adm-content {
      padding: var(--space-4);
    }

    .adm-topbar {
      margin-bottom: var(--space-5);
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .adm-title { font-size: 1.2rem; }
    .adm-subtitle { font-size: 0.8rem; }

    /* Stats: 2 columns */
    .adm-stats-grid {
      grid-template-columns: 1fr 1fr;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .adm-stat { padding: var(--space-4); }
    .adm-stat-val { font-size: 1.6rem; }

    /* Charts single column */
    .adm-charts-row { grid-template-columns: 1fr; }

    /* Filter row */
    .adm-filters { flex-direction: column; align-items: stretch; gap: var(--space-3); }
    .adm-filter-tabs {
      overflow-x: auto;
      flex-wrap: nowrap;
      scrollbar-width: none;
      padding-bottom: 4px;
      -webkit-overflow-scrolling: touch;
    }
    .adm-filter-tabs::-webkit-scrollbar { display: none; }
    .adm-search { width: 100%; min-width: 0; }

    /* Drill-down layout */
    .adm-layout { grid-template-columns: 1fr; }

    .adm-layout:not(.adm-detail-open) .adm-detail { display: none; }
    .adm-layout.adm-detail-open .adm-list { display: none; }
    .adm-layout.adm-detail-open .adm-detail {
      display: block;
      position: static;
      min-height: unset;
    }

    /* Mobile back button */
    .adm-mobile-back-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: none;
      border: none;
      color: var(--brand);
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      margin-bottom: var(--space-4);
      -webkit-tap-highlight-color: transparent;
    }

    /* Fixed bottom tab bar */
    .adm-bottom-nav {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 100;
      background: rgba(10,10,10,0.97);
      border-top: 1px solid var(--glass-border);
      height: calc(60px + env(safe-area-inset-bottom));
      padding-bottom: env(safe-area-inset-bottom);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .adm-bottom-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      position: relative;
      -webkit-tap-highlight-color: transparent;
      transition: color 0.2s;
    }
    .adm-bottom-nav-item.active { color: var(--brand); }
    .adm-bottom-nav-icon { position: relative; display: flex; }
    .adm-bottom-nav-badge {
      position: absolute;
      top: -4px; right: -7px;
      background: var(--brand);
      color: #fff;
      font-size: 0.55rem; font-weight: 700;
      min-width: 14px; height: 14px;
      border-radius: 999px;
      display: flex; align-items: center; justify-content: center;
      padding: 0 3px;
    }
    .adm-bottom-nav-label {
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    /* Clients: table → cards */
    .adm-clients-head { display: none; }
    .adm-clients-row {
      display: flex !important;
      flex-direction: column !important;
      gap: var(--space-2);
      padding: var(--space-4);
      background: var(--glass-bg);
      border-radius: var(--radius-lg) !important;
      border: 1px solid var(--glass-border) !important;
      margin-bottom: var(--space-3);
    }
    .adm-clients-row > * { display: flex !important; }
    .adm-client-joined::before { content: 'Joined: '; color: var(--text-muted); font-size: 0.75rem; }
    .adm-client-password::before { content: 'Password: '; color: var(--text-muted); font-size: 0.75rem; }
    .adm-client-orders { flex-direction: row; align-items: center; }

    /* Invoice + client create forms: single column */
    .adm-inv-form-row { grid-template-columns: 1fr !important; }

    /* Invoice hero smaller */
    .adm-inv-hero-amount { font-size: 1.8rem; }

    /* Detail grid single col */
    .adm-detail-grid { grid-template-columns: 1fr; }

    /* Actions wrap */
    .adm-quick-actions { flex-direction: column; }
    .adm-action-btn { width: 100%; justify-content: center; }

    /* Invoice status row wraps */
    .adm-inv-status-row { flex-wrap: wrap; gap: var(--space-2); }
  }
`;
