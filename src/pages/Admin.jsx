import { useState, useEffect, useCallback, useRef } from 'react';
import Bell01 from '@untitled-ui/icons-react/build/esm/Bell01';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import LogOut01 from '@untitled-ui/icons-react/build/esm/LogOut01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import Printer from '@untitled-ui/icons-react/build/esm/Printer';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import Save01 from '@untitled-ui/icons-react/build/esm/Save01';
import LayersTwo01 from '@untitled-ui/icons-react/build/esm/LayersTwo01';
import TrendUp01 from '@untitled-ui/icons-react/build/esm/TrendUp01';
import Trophy01 from '@untitled-ui/icons-react/build/esm/Trophy01';
import Wordmark from '../components/Wordmark';

const STATUSES = [
  { id: 'new',       label: 'New',       color: '#f59e0b' },
  { id: 'contacted', label: 'Contacted', color: '#60a5fa' },
  { id: 'replied',   label: 'Replied',   color: '#a78bfa' },
  { id: 'landed',    label: 'Landed',    color: '#22c55e' },
  { id: 'denied',    label: 'Denied',    color: '#ef4444' },
];
const TYPE_LABELS = { start: 'Project Brief', 'shop-order': 'Shop Order', contact: 'Contact', other: 'Other' };

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return String(iso); }
};

function StatusBadge({ status }) {
  const s = STATUSES.find(x => x.id === status) || STATUSES[0];
  return (
    <span className="ad-badge" style={{ '--sc': s.color }}>
      <span className="ad-badge-dot" />{s.label}
    </span>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/* ── Dashboard overview ────────────────────────────────────────── */

function WeeklyChart({ series }) {
  const max = Math.max(1, ...series.map(w => w.total));
  const weekMs = 7 * 86400000;
  return (
    <div className="ad-chart">
      <div className="ad-chart-bars">
        {series.map((w, i) => {
          const label = new Date(Date.now() - (series.length - 1 - i) * weekMs)
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const landedPct = w.total ? (w.landed / max) * 100 : 0;
          const restPct = ((w.total - w.landed) / max) * 100;
          return (
            <div key={i} className="ad-chart-col" title={`${w.total} lead${w.total !== 1 ? 's' : ''}, ${w.landed} landed`}>
              <div className="ad-chart-stack">
                <div className="ad-chart-seg ad-chart-seg--rest" style={{ height: `${restPct}%` }} />
                <div className="ad-chart-seg ad-chart-seg--landed" style={{ height: `${landedPct}%` }} />
              </div>
              <span className="ad-chart-x">{label}</span>
            </div>
          );
        })}
      </div>
      <div className="ad-chart-legend">
        <span><i className="ad-dot ad-dot--rest" /> New &amp; in progress</span>
        <span><i className="ad-dot ad-dot--landed" /> Landed</span>
      </div>
    </div>
  );
}

function Overview({ total, unread, counts, series, items, onOpen }) {
  const pipeline = (counts.contacted || 0) + (counts.replied || 0);
  const landed = counts.landed || 0;
  const cards = [
    { label: 'Total Leads',  value: total,          icon: LayersTwo01, accent: '#d44c43' },
    { label: 'New / Unread', value: unread,         icon: Bell01,      accent: '#f59e0b' },
    { label: 'In Pipeline',  value: pipeline,       icon: TrendUp01,   accent: '#60a5fa' },
    { label: 'Landed',       value: landed,         icon: Trophy01,    accent: '#22c55e' },
  ];
  const pipeMax = Math.max(1, ...STATUSES.map(s => counts[s.id] || 0));
  const recent = items.slice(0, 6);

  return (
    <div className="ad-overview">
      <header className="ad-greet">
        <h1 className="ad-greet-title">{greeting()}.</h1>
        <p className="ad-greet-sub">Here's what's coming in across your funnel.</p>
      </header>

      {/* Stat cards */}
      <div className="ad-cards">
        {cards.map(c => {
          const IconEl = c.icon;
          return (
            <div key={c.label} className="ad-card" style={{ '--ac': c.accent }}>
              <span className="ad-card-icon"><IconEl width={18} height={18} /></span>
              <span className="ad-card-value">{c.value}</span>
              <span className="ad-card-label">{c.label}</span>
            </div>
          );
        })}
      </div>

      {/* Chart + pipeline */}
      <div className="ad-panels">
        <div className="ad-panel">
          <div className="ad-panel-head">
            <h2 className="ad-panel-title">Leads — last 8 weeks</h2>
          </div>
          <WeeklyChart series={series.length ? series : Array.from({ length: 8 }, () => ({ total: 0, landed: 0 }))} />
        </div>
        <div className="ad-panel">
          <div className="ad-panel-head">
            <h2 className="ad-panel-title">Pipeline</h2>
          </div>
          <div className="ad-pipe">
            {STATUSES.map(s => {
              const n = counts[s.id] || 0;
              return (
                <div key={s.id} className="ad-pipe-row">
                  <span className="ad-pipe-label" style={{ color: s.color }}>{s.label}</span>
                  <div className="ad-pipe-track">
                    <div className="ad-pipe-fill" style={{ width: `${(n / pipeMax) * 100}%`, background: s.color }} />
                  </div>
                  <span className="ad-pipe-n">{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="ad-panel ad-panel--full">
        <div className="ad-panel-head">
          <h2 className="ad-panel-title">Recent Activity</h2>
        </div>
        {recent.length === 0 ? (
          <p className="ad-empty-note">No submissions yet — new /start briefs and shop orders land here automatically.</p>
        ) : (
          <div className="ad-recent">
            {recent.map(item => (
              <button key={item._id} type="button" className={`ad-recent-row${item.read ? '' : ' is-unread'}`} onClick={() => onOpen(item)}>
                <span className="ad-recent-dot" aria-hidden="true" />
                <span className="ad-recent-name">{item.business || item.name}</span>
                <span className="ad-recent-type">{TYPE_LABELS[item.type] || item.type}</span>
                <StatusBadge status={item.status} />
                <span className="ad-recent-date">{fmtDate(item.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Login ─────────────────────────────────────────────────────── */

function Login({ onAuthed }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(false);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) throw new Error();
      onAuthed();
    } catch { setErr(true); }
    finally { setBusy(false); }
  };

  return (
    <div className="ad-page ad-login-page grid-texture">
      <form onSubmit={submit} className={`ad-login${err ? ' ad-shake' : ''}`}>
        <Wordmark size={22} />
        <h1 className="ad-login-title">Admin</h1>
        <p className="ad-login-sub">Owner access only</p>
        <input
          type="password"
          className="ad-input ad-login-input"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(false); }}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
        />
        {err && <p className="ad-login-err" role="alert">Incorrect password</p>}
        <button type="submit" className="ad-btn ad-btn--primary ad-login-btn" disabled={busy || !pw}>
          {busy ? '…' : 'Sign In'}
        </button>
      </form>
      <style>{adStyles}</style>
    </div>
  );
}

/* ── Push notification setup ───────────────────────────────────── */

function usePush() {
  const [state, setState] = useState('idle'); // idle|unsupported|denied|subscribed|error

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setState('unsupported'); return; }
    if (Notification.permission === 'denied') { setState('denied'); return; }
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      if (sub) setState('subscribed');
    }).catch(() => {});
  }, []);

  const enable = useCallback(async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setState('denied'); return; }
      const { key } = await (await fetch('/api/push-key')).json();
      if (!key) { setState('error'); return; }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      const res = await fetch('/api/admin/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      setState(res.ok ? 'subscribed' : 'error');
    } catch { setState('error'); }
  }, []);

  return { state, enable };
}

/* ── Detail panel ──────────────────────────────────────────────── */

function Detail({ sub, onPatch, onClose }) {
  const [notes, setNotes] = useState(sub.notes || '');
  const [savedTick, setSavedTick] = useState(false);
  useEffect(() => { setNotes(sub.notes || ''); }, [sub._id]);

  const saveNotes = async () => {
    await onPatch(sub._id, { notes });
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1500);
  };

  return (
    <div className="ad-detail">
      <button type="button" className="ad-detail-back" onClick={onClose}>
        <ArrowLeft width={15} height={15} /> All submissions
      </button>

      <header className="ad-detail-head">
        <div>
          <h2 className="ad-detail-name">{sub.business || sub.name}</h2>
          <p className="ad-detail-meta">
            {TYPE_LABELS[sub.type] || sub.type}
            {sub.projectType ? ` · ${sub.projectType}` : ''} · {fmtDate(sub.createdAt)}
          </p>
        </div>
        <button
          type="button"
          className="ad-btn"
          onClick={() => onPatch(sub._id, { read: !sub.read })}
          title={sub.read ? 'Mark unread' : 'Mark read'}
        >
          {sub.read ? 'Mark unread' : 'Mark read'}
        </button>
      </header>

      {/* Status pipeline */}
      <div className="ad-sec">
        <p className="ad-sec-label">Status</p>
        <div className="ad-status-row">
          {STATUSES.map(s => (
            <button
              key={s.id}
              type="button"
              className={`ad-status-opt${sub.status === s.id ? ' is-on' : ''}`}
              style={{ '--sc': s.color }}
              onClick={() => onPatch(sub._id, { status: s.id })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div className="ad-sec">
        <p className="ad-sec-label">Contact</p>
        <div className="ad-contact">
          <a href={`mailto:${sub.email}`} className="ad-contact-item">
            <Mail01 width={14} height={14} /> {sub.email}
          </a>
          {sub.phone && sub.phone !== '—' && (
            <a href={`sms:${sub.phone}`} className="ad-contact-item">
              <Phone width={14} height={14} /> {sub.phone}
            </a>
          )}
        </div>
      </div>

      {/* Answers */}
      <div className="ad-sec">
        <p className="ad-sec-label">Submission</p>
        <div className="ad-answers">
          {Object.entries(sub.fields || {}).map(([k, v]) => (
            <div key={k} className="ad-answer">
              <span className="ad-answer-k">{k}</span>
              <span className="ad-answer-v">{String(v)}</span>
            </div>
          ))}
          {!Object.keys(sub.fields || {}).length && <p className="ad-empty-note">No detail fields.</p>}
        </div>
      </div>

      {/* Private notes */}
      <div className="ad-sec">
        <p className="ad-sec-label">Private Notes</p>
        <textarea
          className="ad-input ad-notes"
          rows={4}
          placeholder="Only you can see these."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button type="button" className="ad-btn" onClick={saveNotes}>
          {savedTick ? <><Check width={14} height={14} /> Saved</> : <><Save01 width={14} height={14} /> Save Notes</>}
        </button>
      </div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────── */

export default function Admin() {
  const [authed, setAuthed]   = useState(null);   // null = checking
  const [items, setItems]     = useState([]);
  const [counts, setCounts]   = useState({});
  const [unread, setUnread]   = useState(0);
  const [total, setTotal]     = useState(0);
  const [series, setSeries]   = useState([]);
  const [view, setView]       = useState('overview'); // 'overview' | 'leads'
  const [sel, setSel]         = useState(null);
  const [status, setStatus]   = useState('all');
  const [type, setType]       = useState('all');
  const [days, setDays]       = useState('0');
  const [q, setQ]             = useState('');
  const [loading, setLoading] = useState(false);
  const { state: pushState, enable: enablePush } = usePush();
  const deepLinked = useRef(false);

  useEffect(() => {
    fetch('/api/admin/session').then(r => r.json())
      .then(d => setAuthed(!!d.authed))
      .catch(() => setAuthed(false));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status !== 'all') params.set('status', status);
      if (type !== 'all') params.set('type', type);
      if (days !== '0') params.set('days', days);
      const res = await fetch(`/api/admin/submissions?${params}`);
      if (res.status === 401) { setAuthed(false); return; }
      const d = await res.json();
      setItems(d.items || []);
      setCounts(d.counts || {});
      setUnread(d.unread || 0);
      setTotal(d.total || 0);
      setSeries(d.series || []);
    } catch { /* keep last data */ }
    finally { setLoading(false); }
  }, [q, status, type, days]);

  useEffect(() => { if (authed) load(); }, [authed, load]);

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Admin — Visualize` : 'Admin — Visualize';
  }, [unread]);

  // Deep link from a push notification: /admin?submission=<id>
  useEffect(() => {
    if (!authed || deepLinked.current) return;
    const id = new URLSearchParams(window.location.search).get('submission');
    if (!id) return;
    deepLinked.current = true;
    fetch(`/api/admin/submissions?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => { if (d.submission) openDetail(d.submission); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const patch = async (id, set) => {
    await fetch('/api/admin/submissions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, set }),
    });
    setItems(prev => prev.map(it => it._id === id ? { ...it, ...set } : it));
    setSel(prev => (prev && prev._id === id ? { ...prev, ...set } : prev));
    if ('read' in set || 'status' in set) load();
  };

  const openDetail = (item) => {
    setSel(item);
    if (!item.read) patch(item._id, { read: true });
  };

  const goOverview = () => {
    setSel(null); setView('overview');
    setStatus('all'); setType('all'); setDays('0'); setQ('');
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
  };

  if (authed === null) return <div className="ad-page"><style>{adStyles}</style></div>;
  if (!authed) return <Login onAuthed={() => setAuthed(true)} />;

  return (
    <div className="ad-page">
      {/* Topbar */}
      <header className="ad-topbar">
        <div className="ad-topbar-left">
          <Wordmark size={16} />
          <nav className="ad-tabs" aria-label="Dashboard sections">
            <button type="button" className={`ad-tab${view === 'overview' && !sel ? ' is-on' : ''}`} onClick={goOverview}>Overview</button>
            <button type="button" className={`ad-tab${view === 'leads' || sel ? ' is-on' : ''}`} onClick={() => { setSel(null); setView('leads'); }}>Leads</button>
          </nav>
          {unread > 0 && <span className="ad-unread-pill">{unread} new</span>}
        </div>
        <div className="ad-topbar-right">
          {pushState !== 'subscribed' && pushState !== 'unsupported' && (
            <button type="button" className="ad-btn" onClick={enablePush} title="Enable push notifications on this device">
              <Bell01 width={14} height={14} />
              {pushState === 'denied' ? 'Notifications blocked' : 'Enable notifications'}
            </button>
          )}
          {pushState === 'subscribed' && (
            <span className="ad-push-on"><Bell01 width={13} height={13} /> Notifications on</span>
          )}
          <a href="/admin/calls" className="ad-btn" title="Cold call console">
            <PhoneCall01 width={14} height={14} /> Calls
          </a>
          <a href="/admin/prints" className="ad-btn" title="Print shop admin">
            <Printer width={14} height={14} /> Print Shop
          </a>
          <button type="button" className="ad-btn" onClick={load} title="Refresh">
            <RefreshCw01 width={14} height={14} />
          </button>
          <button type="button" className="ad-btn" onClick={logout} title="Log out">
            <LogOut01 width={14} height={14} />
          </button>
        </div>
      </header>

      <main className="ad-main">
        {sel ? (
          <Detail sub={sel} onPatch={patch} onClose={() => { setSel(null); load(); }} />
        ) : view === 'overview' ? (
          <Overview total={total} unread={unread} counts={counts} series={series} items={items} onOpen={openDetail} />
        ) : (
          <>
            {/* Status filter tiles */}
            <div className="ad-stats">
              <button type="button" className={`ad-stat${status === 'all' ? ' is-on' : ''}`} onClick={() => setStatus('all')}>
                <span className="ad-stat-n">{total}</span><span className="ad-stat-l">All</span>
              </button>
              {STATUSES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className={`ad-stat${status === s.id ? ' is-on' : ''}`}
                  style={{ '--sc': s.color }}
                  onClick={() => setStatus(status === s.id ? 'all' : s.id)}
                >
                  <span className="ad-stat-n" style={{ color: s.color }}>{counts[s.id] || 0}</span>
                  <span className="ad-stat-l">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Filters */}
            <div className="ad-filters">
              <div className="ad-search-wrap">
                <SearchMd width={15} height={15} />
                <input
                  className="ad-input ad-search"
                  placeholder="Search name, business, email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q && <button type="button" className="ad-search-clear" onClick={() => setQ('')} aria-label="Clear search"><XClose width={13} height={13} /></button>}
              </div>
              <select className="ad-input ad-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type">
                <option value="all">All types</option>
                <option value="start">Project briefs</option>
                <option value="shop-order">Shop orders</option>
                <option value="contact">Contact</option>
              </select>
              <select className="ad-input ad-select" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Filter by date">
                <option value="0">All time</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </div>

            {/* List */}
            <div className="ad-list">
              {loading && !items.length && <p className="ad-empty-note">Loading…</p>}
              {!loading && !items.length && (
                <div className="ad-empty">
                  <p className="ad-empty-title">No submissions {status !== 'all' || type !== 'all' || q ? 'match your filters' : 'yet'}.</p>
                  <p className="ad-empty-note">New /start briefs and shop orders land here automatically.</p>
                </div>
              )}
              {items.map(item => (
                <button key={item._id} type="button" className={`ad-row${item.read ? '' : ' is-unread'}`} onClick={() => openDetail(item)}>
                  <span className="ad-row-dot" aria-hidden="true" />
                  <div className="ad-row-main">
                    <span className="ad-row-name">{item.business || item.name}</span>
                    <span className="ad-row-sub">
                      {item.name} · {TYPE_LABELS[item.type] || item.type}
                      {item.projectType ? ` · ${item.projectType}` : ''}
                    </span>
                  </div>
                  <div className="ad-row-right">
                    <StatusBadge status={item.status} />
                    <span className="ad-row-date">{fmtDate(item.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
      <style>{adStyles}</style>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────────── */

const adStyles = `
  .ad-page {
    min-height: 100vh; background: #0a0a0a; color: #fafafa;
    font-family: 'Inter', -apple-system, sans-serif;
    --a-border: rgba(255,255,255,0.09);
    --a-card: #121212;
    --a-muted: #8a8a8a;
    --a-sec: #cccccc;
  }

  /* Login */
  .ad-login-page { display: flex; align-items: center; justify-content: center; background: #080808; }
  .ad-login {
    width: min(360px, 90vw); padding: 40px 32px;
    background: var(--a-card); border: 1px solid var(--a-border); border-radius: 16px;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.7);
  }
  .ad-login-title { font-size: 1.3rem; font-weight: 800; margin-top: 10px; }
  .ad-login-sub { font-size: 0.8rem; color: var(--a-muted); margin-bottom: 12px; }
  .ad-login-input { text-align: center; width: 100%; }
  .ad-login-btn { width: 100%; justify-content: center; margin-top: 4px; }
  .ad-login-err { font-size: 0.8rem; color: #f87171; }
  @keyframes adShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-7px)} 40%,80%{transform:translateX(7px)} }
  .ad-shake { animation: adShake 0.45s ease; }

  /* Inputs + buttons */
  .ad-input {
    padding: 10px 14px; border-radius: 9px;
    border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04);
    color: #fafafa; font-size: 0.9rem; font-family: inherit; outline: none;
    transition: border-color 0.2s;
  }
  .ad-input:focus { border-color: #d44c43; }
  .ad-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 8px 13px; border-radius: 9px; cursor: pointer;
    border: 1px solid var(--a-border); background: rgba(255,255,255,0.05);
    color: var(--a-sec); font-size: 0.8125rem; font-weight: 600; font-family: inherit;
    text-decoration: none; transition: background 0.15s, color 0.15s;
  }
  .ad-btn:hover { background: rgba(255,255,255,0.1); color: #fafafa; }
  .ad-btn--primary {
    background: #d44c43; border-color: #d44c43; color: #fff;
  }
  .ad-btn--primary:hover { background: #c2413a; color: #fff; }
  .ad-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Topbar */
  .ad-topbar {
    position: sticky; top: 0; z-index: 50;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 12px clamp(16px, 4vw, 32px);
    background: rgba(8,8,8,0.95); border-bottom: 1px solid var(--a-border);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    flex-wrap: wrap;
  }
  .ad-topbar-left { display: flex; align-items: center; gap: 14px; }
  .ad-tabs { display: flex; gap: 2px; background: rgba(255,255,255,0.05); border: 1px solid var(--a-border); border-radius: 999px; padding: 3px; }
  .ad-tab {
    padding: 6px 16px; border-radius: 999px; border: none; background: none;
    color: var(--a-muted); font-size: 0.82rem; font-weight: 700; cursor: pointer; font-family: inherit;
    transition: color 0.15s, background 0.15s;
  }
  .ad-tab:hover { color: #fafafa; }
  .ad-tab.is-on { background: #d44c43; color: #fff; }
  .ad-unread-pill {
    font-size: 0.7rem; font-weight: 800; padding: 3px 10px; border-radius: 999px;
    background: #d44c43; color: #fff;
  }
  .ad-topbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .ad-push-on {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 0.75rem; font-weight: 700; color: #22c55e;
    padding: 6px 11px; border: 1px solid rgba(34,197,94,0.3); border-radius: 9px;
    background: rgba(34,197,94,0.08);
  }

  .ad-main { max-width: 1000px; margin: 0 auto; padding: clamp(16px, 4vw, 32px); }

  /* ── Dashboard overview ── */
  .ad-overview { display: flex; flex-direction: column; gap: 20px; }
  .ad-greet-title { font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 800; letter-spacing: -0.03em; }
  .ad-greet-sub { font-size: 0.9rem; color: var(--a-muted); margin-top: 4px; }

  .ad-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 720px) { .ad-cards { grid-template-columns: 1fr 1fr; } }
  .ad-card {
    position: relative; overflow: hidden;
    display: flex; flex-direction: column; gap: 4px;
    padding: 18px; border-radius: 16px;
    background: var(--a-card); border: 1px solid var(--a-border);
  }
  .ad-card::after {
    content: ''; position: absolute; top: -30px; right: -30px;
    width: 90px; height: 90px; border-radius: 50%;
    background: var(--ac); opacity: 0.12; filter: blur(6px);
  }
  .ad-card-icon {
    width: 34px; height: 34px; border-radius: 9px; margin-bottom: 6px;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--ac); background: color-mix(in srgb, var(--ac) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--ac) 30%, transparent);
  }
  .ad-card-value { font-size: 1.9rem; font-weight: 900; letter-spacing: -0.03em; color: #fafafa; line-height: 1; }
  .ad-card-label { font-size: 0.75rem; font-weight: 600; color: var(--a-muted); }

  .ad-panels { display: grid; grid-template-columns: 1.5fr 1fr; gap: 12px; }
  @media (max-width: 780px) { .ad-panels { grid-template-columns: 1fr; } }
  .ad-panel { background: var(--a-card); border: 1px solid var(--a-border); border-radius: 16px; padding: 18px 20px; }
  .ad-panel--full { grid-column: 1 / -1; }
  .ad-panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .ad-panel-title { font-size: 0.9rem; font-weight: 700; color: #fafafa; }

  /* Bar chart */
  .ad-chart-bars { display: flex; align-items: flex-end; gap: 8px; height: 150px; }
  .ad-chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; height: 100%; justify-content: flex-end; min-width: 0; }
  .ad-chart-stack {
    width: 100%; max-width: 34px; height: 100%;
    display: flex; flex-direction: column; justify-content: flex-end;
    background: rgba(255,255,255,0.04); border-radius: 6px 6px 0 0; overflow: hidden;
  }
  .ad-chart-seg { width: 100%; transition: height 0.4s var(--ease, ease); }
  .ad-chart-seg--rest { background: #d44c43; }
  .ad-chart-seg--landed { background: #22c55e; }
  .ad-chart-x { font-size: 0.62rem; color: var(--a-muted); white-space: nowrap; }
  .ad-chart-legend { display: flex; gap: 16px; margin-top: 14px; font-size: 0.72rem; color: var(--a-muted); }
  .ad-chart-legend span { display: inline-flex; align-items: center; gap: 6px; }
  .ad-dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
  .ad-dot--rest { background: #d44c43; }
  .ad-dot--landed { background: #22c55e; }

  /* Pipeline */
  .ad-pipe { display: flex; flex-direction: column; gap: 12px; }
  .ad-pipe-row { display: flex; align-items: center; gap: 10px; }
  .ad-pipe-label { font-size: 0.78rem; font-weight: 600; min-width: 74px; }
  .ad-pipe-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
  .ad-pipe-fill { height: 100%; border-radius: 999px; min-width: 2px; transition: width 0.4s ease; }
  .ad-pipe-n { font-size: 0.8rem; font-weight: 800; color: #fafafa; min-width: 22px; text-align: right; }

  /* Recent activity */
  .ad-recent { display: flex; flex-direction: column; }
  .ad-recent-row {
    display: grid; grid-template-columns: 12px 1.4fr 1fr auto auto; align-items: center; gap: 12px;
    padding: 12px 6px; border-bottom: 1px solid var(--a-border);
    background: none; border-left: none; border-right: none; border-top: none;
    cursor: pointer; text-align: left; font-family: inherit; width: 100%;
    transition: background 0.12s;
  }
  .ad-recent-row:last-child { border-bottom: none; }
  .ad-recent-row:hover { background: rgba(255,255,255,0.03); }
  .ad-recent-dot { width: 8px; height: 8px; border-radius: 50%; background: transparent; }
  .ad-recent-row.is-unread .ad-recent-dot { background: #d44c43; }
  .ad-recent-name { font-size: 0.875rem; font-weight: 600; color: #fafafa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ad-recent-row.is-unread .ad-recent-name { font-weight: 800; }
  .ad-recent-type { font-size: 0.78rem; color: var(--a-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ad-recent-date { font-size: 0.72rem; color: var(--a-muted); white-space: nowrap; }
  @media (max-width: 640px) {
    .ad-recent-row { grid-template-columns: 10px 1fr auto; }
    .ad-recent-type, .ad-recent-date { display: none; }
  }

  /* Stats */
  .ad-stats { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; margin-bottom: 18px; }
  @media (max-width: 720px) { .ad-stats { grid-template-columns: repeat(3, 1fr); } }
  .ad-stat {
    display: flex; flex-direction: column; gap: 2px; align-items: flex-start;
    padding: 12px 14px; border-radius: 12px; cursor: pointer;
    background: var(--a-card); border: 1px solid var(--a-border);
    font-family: inherit; transition: border-color 0.15s;
  }
  .ad-stat:hover { border-color: rgba(255,255,255,0.2); }
  .ad-stat.is-on { border-color: var(--sc, #d44c43); }
  .ad-stat-n { font-size: 1.4rem; font-weight: 900; letter-spacing: -0.03em; color: #fafafa; }
  .ad-stat-l { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--a-muted); }

  /* Filters */
  .ad-filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
  .ad-search-wrap {
    flex: 1; min-width: 220px; position: relative;
    display: flex; align-items: center; color: var(--a-muted);
  }
  .ad-search-wrap > svg { position: absolute; left: 12px; pointer-events: none; }
  .ad-search { width: 100%; padding-left: 36px; padding-right: 34px; }
  .ad-search-clear {
    position: absolute; right: 8px; background: none; border: none;
    color: var(--a-muted); cursor: pointer; display: flex; padding: 4px;
  }
  .ad-select { cursor: pointer; }
  .ad-select option { background: #1a1a1a; }

  /* List */
  .ad-list { display: flex; flex-direction: column; gap: 8px; }
  .ad-row {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 16px; border-radius: 12px; cursor: pointer;
    background: var(--a-card); border: 1px solid var(--a-border);
    text-align: left; width: 100%; font-family: inherit;
    transition: border-color 0.15s;
  }
  .ad-row:hover { border-color: rgba(212,76,67,0.5); }
  .ad-row-dot { width: 8px; height: 8px; border-radius: 50%; background: transparent; flex-shrink: 0; }
  .ad-row.is-unread .ad-row-dot { background: #d44c43; }
  .ad-row.is-unread .ad-row-name { font-weight: 800; }
  .ad-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .ad-row-name { font-size: 0.9375rem; font-weight: 600; color: #fafafa; }
  .ad-row-sub { font-size: 0.78rem; color: var(--a-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ad-row-right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .ad-row-date { font-size: 0.72rem; color: var(--a-muted); }

  .ad-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.05em;
    padding: 3px 9px; border-radius: 999px; white-space: nowrap;
    color: var(--sc); background: color-mix(in srgb, var(--sc) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent);
  }
  .ad-badge-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sc); }

  .ad-empty { padding: 48px 24px; text-align: center; border: 1px dashed var(--a-border); border-radius: 12px; }
  .ad-empty-title { font-weight: 700; margin-bottom: 6px; }
  .ad-empty-note { font-size: 0.85rem; color: var(--a-muted); }

  /* Detail */
  .ad-detail { display: flex; flex-direction: column; gap: 22px; }
  .ad-detail-back {
    display: inline-flex; align-items: center; gap: 7px; align-self: flex-start;
    background: none; border: none; color: var(--a-muted); cursor: pointer;
    font-size: 0.85rem; font-weight: 600; font-family: inherit; padding: 0;
  }
  .ad-detail-back:hover { color: #fafafa; }
  .ad-detail-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
  .ad-detail-name { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }
  .ad-detail-meta { font-size: 0.82rem; color: var(--a-muted); margin-top: 3px; }

  .ad-sec { display: flex; flex-direction: column; gap: 10px; }
  .ad-sec-label {
    font-size: 0.68rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.14em; color: var(--a-muted);
  }
  .ad-status-row { display: flex; gap: 7px; flex-wrap: wrap; }
  .ad-status-opt {
    font-size: 0.78rem; font-weight: 700; padding: 6px 14px; border-radius: 999px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
    color: var(--a-muted); cursor: pointer; font-family: inherit; transition: all 0.15s;
  }
  .ad-status-opt:hover { color: #fafafa; }
  .ad-status-opt.is-on {
    color: var(--sc);
    background: color-mix(in srgb, var(--sc) 14%, transparent);
    border-color: color-mix(in srgb, var(--sc) 45%, transparent);
  }

  .ad-contact { display: flex; gap: 10px; flex-wrap: wrap; }
  .ad-contact-item {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 0.875rem; font-weight: 600; color: #e66b63;
    padding: 8px 14px; border: 1px solid rgba(212,76,67,0.3); border-radius: 9px;
    background: rgba(212,76,67,0.06); text-decoration: none;
  }
  .ad-contact-item:hover { background: rgba(212,76,67,0.14); }

  .ad-answers { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 680px) { .ad-answers { grid-template-columns: 1fr; } }
  .ad-answer {
    display: flex; flex-direction: column; gap: 4px;
    background: var(--a-card); border: 1px solid var(--a-border);
    border-radius: 10px; padding: 12px 14px;
  }
  .ad-answer-k {
    font-size: 0.64rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--a-muted);
  }
  .ad-answer-v { font-size: 0.9rem; color: #eaeaea; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }

  .ad-notes { width: 100%; resize: vertical; min-height: 90px; }
  .ad-sec .ad-btn { align-self: flex-start; }
`;
