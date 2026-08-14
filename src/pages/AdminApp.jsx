import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LayoutAlt01 from '@untitled-ui/icons-react/build/esm/LayoutAlt01';
import Inbox01 from '@untitled-ui/icons-react/build/esm/Inbox01';
import Package from '@untitled-ui/icons-react/build/esm/Package';
import PhoneCall01 from '@untitled-ui/icons-react/build/esm/PhoneCall01';
import Settings01 from '@untitled-ui/icons-react/build/esm/Settings01';
import LogOut01 from '@untitled-ui/icons-react/build/esm/LogOut01';
import SearchMd from '@untitled-ui/icons-react/build/esm/SearchMd';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import CheckSquare from '@untitled-ui/icons-react/build/esm/CheckSquare';
import Square from '@untitled-ui/icons-react/build/esm/Square';
import Trash01 from '@untitled-ui/icons-react/build/esm/Trash01';
import Download01 from '@untitled-ui/icons-react/build/esm/Download01';
import FlipBackward from '@untitled-ui/icons-react/build/esm/FlipBackward';
import ArrowLeft from '@untitled-ui/icons-react/build/esm/ArrowLeft';
import ArrowUpRight from '@untitled-ui/icons-react/build/esm/ArrowUpRight';
import TrendUp01 from '@untitled-ui/icons-react/build/esm/TrendUp01';
import TrendDown01 from '@untitled-ui/icons-react/build/esm/TrendDown01';
import Mail01 from '@untitled-ui/icons-react/build/esm/Mail01';
import Phone from '@untitled-ui/icons-react/build/esm/Phone';
import Bell01 from '@untitled-ui/icons-react/build/esm/Bell01';
import Key01 from '@untitled-ui/icons-react/build/esm/Key01';
import Archive from '@untitled-ui/icons-react/build/esm/Archive';
import Printer from '@untitled-ui/icons-react/build/esm/Printer';
import Save01 from '@untitled-ui/icons-react/build/esm/Save01';
import RefreshCw01 from '@untitled-ui/icons-react/build/esm/RefreshCw01';
import CalendarCheck01 from '@untitled-ui/icons-react/build/esm/CalendarCheck01';
import PhoneIncoming01 from '@untitled-ui/icons-react/build/esm/PhoneIncoming01';
import PhoneOutgoing01 from '@untitled-ui/icons-react/build/esm/PhoneOutgoing01';
import Zap from '@untitled-ui/icons-react/build/esm/Zap';
import Users01 from '@untitled-ui/icons-react/build/esm/Users01';
import Briefcase01 from '@untitled-ui/icons-react/build/esm/Briefcase01';
import DotsGrid from '@untitled-ui/icons-react/build/esm/DotsGrid';
import Wordmark from '../components/Wordmark';
import AdminCalls from './AdminCalls';
import AdminBooked from './AdminBooked';
import AdminLeads from './AdminLeads';
import AdminClients from './AdminClients';
import { ScrollArea, StickyFooterBar, adminLayoutStyles } from '../components/AdminLayout';
import { effectiveStage } from '../lib/booked';

/* Rotating hello for the dashboard hero — always addressed to Rob. */
const GREETINGS = [
  'Coffee and cold calls, Rob?',
  "Hey there, Rob'neH?",
  'Back on the phones, Rob?',
  "Who's getting booked today, Rob?",
  'The pipeline missed you, Rob.',
  'Rob. The myth. The legend.',
  'Another day, another closed deal, Rob?',
  'Dial it up, Rob.',
  'Ship visuals, take names, Rob.',
  'The leads called — they want you back, Rob.',
];
import { IS_ADMIN_HOST } from '../lib/adminPaths';
import { SocialButtons, SocialFields } from '../components/SocialLinks';
import { normalizeSocials, hasAnySocial } from '../lib/socials';

/* ── Config ────────────────────────────────────────────────────── */

const BASE = IS_ADMIN_HOST ? '' : '/admin';

const LEAD_STATUSES = [
  { id: 'new',       label: 'New',       color: '#f59e0b' },
  { id: 'contacted', label: 'Contacted', color: '#60a5fa' },
  { id: 'replied',   label: 'Replied',   color: '#a78bfa' },
  { id: 'landed',    label: 'Landed',    color: '#22c55e' },
  { id: 'denied',    label: 'Denied',    color: '#ef4444' },
];
const ORDER_STATUSES = [
  { id: 'new',           label: 'New',           color: '#f59e0b' },
  { id: 'paid',          label: 'Paid',          color: '#60a5fa' },
  { id: 'in-production', label: 'In Production', color: '#a78bfa' },
  { id: 'packaged',      label: 'Packaged',      color: '#34d399' },
  { id: 'delivered',     label: 'Delivered',     color: '#22c55e' },
];
const TYPE_LABELS = { start: 'Project Brief', 'shop-order': 'Shop Order', contact: 'Contact', other: 'Other' };

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return String(iso); }
};

function StatusBadge({ status, set }) {
  const s = set.find(x => x.id === status) || set[0];
  return (
    <span className="aa-badge" style={{ '--sc': s.color }}>
      <span className="aa-badge-dot" />{s.label}
    </span>
  );
}

function usePush() {
  const [state, setState] = useState('idle');
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
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const res = await fetch('/api/admin/push-subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      setState(res.ok ? 'subscribed' : 'error');
    } catch { setState('error'); }
  }, []);
  return { state, enable };
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) throw new Error();
      onAuthed();
    } catch { setErr(true); }
    finally { setBusy(false); }
  };
  return (
    <div className="aa-loginpage grid-texture">
      <form onSubmit={submit} className={`aa-login${err ? ' aa-shake' : ''}`}>
        <Wordmark size={22} />
        <h1 className="aa-login-title">Admin</h1>
        <p className="aa-login-sub">Owner access only</p>
        <input type="password" className="aa-input aa-login-input" value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(false); }}
          placeholder="Password" autoFocus autoComplete="current-password" />
        {err && <p className="aa-login-err" role="alert">Incorrect password</p>}
        <button type="submit" className="aa-btn aa-btn--primary aa-login-btn" disabled={busy || !pw}>
          {busy ? '…' : 'Sign In'}
        </button>
      </form>
      <style>{adminLayoutStyles + aaStyles}</style>
    </div>
  );
}

/* ── Confirm modal (deliberate delete) ─────────────────────────── */

function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="aa-modal-overlay lay-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="aa-modal lay-modal-box">
        <h2 className="aa-modal-title">{title}</h2>
        <p className="aa-modal-body">{body}</p>
        <div className="aa-modal-actions">
          <button type="button" className="aa-btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="aa-btn aa-btn--danger" onClick={onConfirm}>
            <Trash01 width={14} height={14} /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Skeleton rows ─────────────────────────────────────────────── */

function Skeletons({ n = 6 }) {
  return (
    <div className="aa-skels" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="aa-skel"><span className="aa-skel-a" /><span className="aa-skel-b" /></div>
      ))}
    </div>
  );
}

/* ── Detail view (submission or order) ─────────────────────────── */

function ItemDetail({ item, statusSet, onPatch, onDelete, onClose }) {
  const [notes, setNotes] = useState(item.notes || '');
  const [saved, setSaved] = useState(false);
  const [editSoc, setEditSoc] = useState(false);
  const [socDraft, setSocDraft] = useState(item.socials || {});
  useEffect(() => { setNotes(item.notes || ''); setEditSoc(false); setSocDraft(item.socials || {}); }, [item._id]);

  const saveSocials = async () => {
    const clean = normalizeSocials(socDraft);
    await onPatch(item._id, { socials: clean });
    setSocDraft(clean);
    setEditSoc(false);
  };

  const saveNotes = async () => {
    await onPatch(item._id, { notes });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="aa-detail lay-content">
      <div className="aa-detail-top">
        <button type="button" className="aa-back" onClick={onClose}>
          <ArrowLeft width={15} height={15} /> Back
        </button>
        <div className="aa-detail-topbtns">
          <button type="button" className="aa-btn" onClick={() => onPatch(item._id, { read: !item.read })}>
            {item.read ? 'Mark unread' : 'Mark read'}
          </button>
          <button type="button" className="aa-btn aa-btn--dangerghost" onClick={() => onDelete([item._id])}>
            <Trash01 width={14} height={14} /> Delete
          </button>
        </div>
      </div>

      <header className="aa-detail-head">
        <h1 className="aa-detail-name">{item.business || item.name}</h1>
        <p className="aa-detail-meta">
          {TYPE_LABELS[item.type] || item.type}
          {item.projectType ? ` · ${item.projectType}` : ''} · {fmtDate(item.createdAt)}
        </p>
      </header>

      <div className="aa-sec">
        <p className="aa-sec-label">Status</p>
        <div className="aa-status-row">
          {statusSet.map(s => (
            <button key={s.id} type="button"
              className={`aa-status-opt${item.status === s.id ? ' is-on' : ''}`}
              style={{ '--sc': s.color }}
              onClick={() => onPatch(item._id, { status: s.id })}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="aa-sec">
        <p className="aa-sec-label">Contact</p>
        <div className="aa-contact">
          <a href={`mailto:${item.email}`} className="aa-contact-item"><Mail01 width={14} height={14} /> {item.email}</a>
          {item.phone && item.phone !== '—' && (
            <a href={`sms:${item.phone}`} className="aa-contact-item"><Phone width={14} height={14} /> {item.phone}</a>
          )}
        </div>
      </div>

      <div className="aa-sec">
        <div className="aa-sec-headrow">
          <p className="aa-sec-label">Links</p>
          {(hasAnySocial(item.socials) && !editSoc) && (
            <button type="button" className="aa-minibtn" onClick={() => { setSocDraft(item.socials || {}); setEditSoc(true); }}>Edit</button>
          )}
        </div>
        {editSoc ? (
          <div className="aa-socedit">
            <SocialFields values={socDraft} onChange={(k, v) => setSocDraft(d => ({ ...d, [k]: v }))} />
            <div className="aa-socedit-actions">
              <button type="button" className="aa-btn aa-btn--primary" onClick={saveSocials}><Check width={14} height={14} /> Save links</button>
              <button type="button" className="aa-btn" onClick={() => setEditSoc(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <SocialButtons socials={item.socials} onAdd={() => { setSocDraft(item.socials || {}); setEditSoc(true); }} />
        )}
      </div>

      <div className="aa-sec">
        <p className="aa-sec-label">{item.type === 'shop-order' ? 'Order' : 'Submission'}</p>
        <div className="aa-answers">
          {Object.entries(item.fields || {}).map(([k, v]) => (
            <div key={k} className="aa-answer">
              <span className="aa-answer-k">{k}</span>
              <span className="aa-answer-v">{String(v)}</span>
            </div>
          ))}
          {!Object.keys(item.fields || {}).length && <p className="aa-muted">No detail fields.</p>}
        </div>
      </div>

      <div className="aa-sec">
        <p className="aa-sec-label">Private Notes</p>
        <textarea className="aa-input aa-notes" rows={4} value={notes}
          onChange={(e) => setNotes(e.target.value)} placeholder="Only you can see these." />
        <button type="button" className="aa-btn" onClick={saveNotes}>
          {saved ? <><Check width={14} height={14} /> Saved</> : <><Save01 width={14} height={14} /> Save Notes</>}
        </button>
      </div>
    </div>
  );
}

/* ── List section (Submissions / Orders share this) ────────────── */

function ListSection({ label, items, loading, statusSet, exportType, sel, onSelect, onPatch, onDelete }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [checked, setChecked] = useState(() => new Set());
  const [confirm, setConfirm] = useState(null); // array of ids pending delete

  useEffect(() => { setChecked(new Set()); }, [status, q]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(it =>
      (status === 'all' || it.status === status) &&
      (!needle || `${it.name} ${it.business} ${it.email}`.toLowerCase().includes(needle))
    );
  }, [items, q, status]);

  const counts = useMemo(() => {
    const c = {};
    for (const it of items) c[it.status] = (c[it.status] || 0) + 1;
    return c;
  }, [items]);

  // Keyboard: arrows move through the filtered list, Esc closes detail.
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (confirm) return;
      if (e.key === 'Escape' && sel) { onSelect(null); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      if (!filtered.length) return;
      e.preventDefault();
      const idx = filtered.findIndex(it => it._id === sel?._id);
      const next = e.key === 'ArrowDown'
        ? filtered[Math.min(filtered.length - 1, idx + 1)]
        : filtered[Math.max(0, idx - 1)];
      if (next) onSelect(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, sel, onSelect, confirm]);

  const toggle = (id) => setChecked(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allChecked = filtered.length > 0 && filtered.every(it => checked.has(it._id));
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(filtered.map(it => it._id)));

  const exportUrl = (format) => {
    const p = new URLSearchParams({ type: exportType, format });
    if (status !== 'all') p.set('status', status);
    if (q.trim()) p.set('q', q.trim());
    return `/api/admin/export?${p}`;
  };

  const requestDelete = (ids) => setConfirm(ids);
  const doDelete = async () => {
    const ids = confirm;
    setConfirm(null);
    setChecked(new Set());
    await onDelete(ids);
  };

  return (
    <>
      <aside className="aa-panel">
        <div className="aa-panel-head">
          <h2 className="aa-panel-title">{label}</h2>
          <div className="aa-panel-headbtns">
            <a className="aa-iconbtn" href={exportUrl('csv')} title="Export CSV (respects current filter)" download>
              <Download01 width={15} height={15} />
            </a>
            <a className="aa-minibtn" href={exportUrl('json')} title="Export JSON" download>JSON</a>
          </div>
        </div>

        <div className="aa-search-wrap">
          <SearchMd width={14} height={14} />
          <input className="aa-input aa-search" placeholder={`Search ${label.toLowerCase()}…`} value={q} onChange={e => setQ(e.target.value)} />
          {q && <button type="button" className="aa-search-clear" onClick={() => setQ('')} aria-label="Clear search"><XClose width={12} height={12} /></button>}
        </div>

        {/* Status groups */}
        <nav className="aa-groups" aria-label={`${label} status groups`}>
          <button type="button" className={`aa-group${status === 'all' ? ' is-on' : ''}`} onClick={() => setStatus('all')}>
            <span>All</span><span className="aa-group-n">{items.length}</span>
          </button>
          {statusSet.map(s => (
            <button key={s.id} type="button" className={`aa-group${status === s.id ? ' is-on' : ''}`} style={{ '--sc': s.color }} onClick={() => setStatus(status === s.id ? 'all' : s.id)}>
              <span className="aa-group-dot" /><span>{s.label}</span>
              <span className="aa-group-n">{counts[s.id] || 0}</span>
            </button>
          ))}
        </nav>

        {/* Select-all row */}
        {filtered.length > 0 && (
          <button type="button" className="aa-selectall" onClick={toggleAll}>
            {allChecked ? <CheckSquare width={15} height={15} /> : <Square width={15} height={15} />}
            Select all in view
          </button>
        )}

        {/* List */}
        <ScrollArea bare className="aa-rows">
          {loading && !items.length && <Skeletons />}
          {!loading && !filtered.length && <p className="aa-muted aa-empty">Nothing here{status !== 'all' || q ? ' with these filters' : ' yet'}.</p>}
          {filtered.map(it => (
            <div key={it._id} className={`aa-row lay-card${sel?._id === it._id ? ' is-sel' : ''}${it.read ? '' : ' is-unread'}`}>
              <button type="button" className="aa-row-check" aria-label="Select" onClick={() => toggle(it._id)}>
                {checked.has(it._id) ? <CheckSquare width={15} height={15} /> : <Square width={15} height={15} />}
              </button>
              <button type="button" className="aa-row-main" onClick={() => onSelect(it)}>
                <span className="aa-row-dot" aria-hidden="true" />
                <span className="aa-row-body">
                  <span className="aa-row-name">{it.business || it.name}</span>
                  <span className="aa-row-sub">{it.projectType || TYPE_LABELS[it.type] || it.type} · {fmtDate(it.createdAt)}</span>
                </span>
                <StatusBadge status={it.status} set={statusSet} />
              </button>
              <button type="button" className="aa-row-del" aria-label="Delete" onClick={() => requestDelete([it._id])}>
                <Trash01 width={14} height={14} />
              </button>
            </div>
          ))}
        </ScrollArea>

        {/* Bulk bar — in flow below the list, so it can never cover a row */}
        {checked.size > 0 && (
          <StickyFooterBar className="aa-bulkbar">
            <span>{checked.size} selected</span>
            <button type="button" className="aa-btn aa-btn--danger" onClick={() => requestDelete([...checked])}>
              <Trash01 width={14} height={14} /> Delete
            </button>
          </StickyFooterBar>
        )}
      </aside>

      <main className="aa-main lay-scroll">
        {sel ? (
          <ItemDetail item={sel} statusSet={statusSet} onPatch={onPatch} onDelete={requestDelete} onClose={() => onSelect(null)} />
        ) : (
          <div className="aa-main-empty">
            <Inbox01 width={34} height={34} />
            <p>Select {label.toLowerCase() === 'orders' ? 'an order' : 'a submission'} to see the full detail.</p>
          </div>
        )}
      </main>

      {confirm && (
        <ConfirmModal
          title={`Delete ${confirm.length} ${confirm.length === 1 ? label.slice(0, -1).toLowerCase() : label.toLowerCase()}?`}
          body={`${confirm.length === 1 ? 'It moves' : 'They move'} to Recently deleted in Settings and can be restored for 30 days. After that ${confirm.length === 1 ? 'it is' : 'they are'} gone for good.`}
          confirmLabel={`Delete ${confirm.length}`}
          onConfirm={doDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

/* ── Dashboard ─────────────────────────────────────────────────── */

function Dashboard({ subs, orders, unread, onGo, stageCounts, callLeads }) {
  const greeting = useMemo(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)], []);

  // Leads + calling activity, computed from the real records.
  const stats = useMemo(() => {
    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);
    const total = callLeads.length;
    let withPhone = 0; let called = 0; let callbacks = 0; let new48 = 0;
    let callsWeek = 0; let callsToday = 0;
    for (const l of callLeads) {
      if (l.phone) withPhone++;
      if ((l.callLog || []).length > 0) called++;
      if (effectiveStage(l) === 'lead' && l.callStatus === 'callback') callbacks++;
      const created = new Date(l.createdAt).getTime();
      if (created && now - created < 48 * 3600e3) new48++;
      for (const e of (l.callLog || [])) {
        const t = new Date(e.at).getTime();
        if (!t) continue;
        if (now - t < 7 * 864e5) callsWeek++;
        if (t >= dayStart) callsToday++;
      }
    }
    return { total, withPhone, called, notCalled: total - called, callbacks, new48, callsWeek, callsToday };
  }, [callLeads]);

  // Cards that land in the Call Console pre-fill the session builder.
  const goWithPreset = (section, preset) => {
    if (preset) { try { localStorage.setItem('vz_builder_preset', JSON.stringify(preset)); } catch { /* fine */ } }
    onGo(section);
  };

  const cards = [
    { label: 'Total leads', value: stats.total, icon: Users01, accent: '#d44c43', go: 'leads' },
    { label: 'Have a phone', value: stats.withPhone, icon: Phone, accent: '#22c55e', go: 'leads' },
    { label: 'Called', value: stats.called, icon: PhoneOutgoing01, accent: '#60a5fa', go: 'leads' },
    { label: 'Not yet called', value: stats.notCalled, icon: PhoneCall01, accent: '#d44c43', go: 'calls', preset: { status: ['not-called'] } },
    { label: 'Booked', value: stageCounts.booked, icon: CalendarCheck01, accent: '#22c55e', go: 'booked' },
    { label: 'Callbacks pending', value: stats.callbacks, icon: PhoneIncoming01, accent: '#f59e0b', go: 'calls', preset: { status: ['callback'] } },
    { label: 'New in last 48h', value: stats.new48, icon: Zap, accent: '#a78bfa', go: 'leads' },
    { label: 'Calls this week', value: stats.callsWeek, icon: TrendUp01, accent: '#60a5fa',
      trend: { up: true, text: `${stats.callsToday} today` }, go: 'calls' },
  ];
  const pct = stats.total ? Math.round((stats.called / stats.total) * 100) : 0;

  const feed = [...subs, ...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  const FUNNEL = [
    { id: 'leads', label: 'Leads', n: stageCounts.lead },
    { id: 'booked', label: 'Booked', n: stageCounts.booked },
    { id: 'clients', label: 'Clients', n: stageCounts.client + stageCounts.won },
  ];

  return (
    <main className="aa-main aa-main--wide lay-scroll">
      <div className="aa-dash lay-content lay-content--wide">
        <header className="aa-greet">
          <h1 className="aa-greet-title"><img src="/logo.svg" alt="" width="24" height="24" className="aa-greet-mark" />{greeting}</h1>
          <div className="aa-funnel" aria-label="Pipeline">
            {FUNNEL.map((f, i) => (
              <span key={f.id} className="aa-funnel-seg">
                {i > 0 && <span className="aa-funnel-arrow" aria-hidden="true">→</span>}
                <button type="button" className="aa-funnel-btn" onClick={() => onGo(f.id)}>
                  <strong>{f.n}</strong> {f.label}
                </button>
              </span>
            ))}
            {stageCounts.won > 0 && (
              <span className="aa-funnel-hint">{stageCounts.won} awaiting first invoice</span>
            )}
          </div>
        </header>

        <div className="aa-cards">
          {cards.map(c => {
            const IconEl = c.icon;
            return (
              <button key={c.label} type="button" className="aa-card" style={{ '--ac': c.accent }} onClick={() => goWithPreset(c.go, c.preset)}>
                <span className="aa-card-icon"><IconEl width={17} height={17} /></span>
                <span className="aa-card-value">{c.value}</span>
                <span className="aa-card-label">{c.label}</span>
                {c.trend && (
                  <span className={`aa-card-trend${c.trend.up ? ' is-up' : ' is-down'}`}>
                    {c.trend.up ? <TrendUp01 width={12} height={12} /> : <TrendDown01 width={12} height={12} />}
                    {c.trend.text}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* How far through the list — called X of Y */}
        <div className="aa-callprog" role="img" aria-label={`Called ${stats.called} of ${stats.total} leads`}>
          <div className="aa-callprog-top">
            <span className="aa-callprog-lbl">Called <strong>{stats.called}</strong> of <strong>{stats.total}</strong> leads</span>
            <span className="aa-callprog-pct">{pct}%</span>
          </div>
          <div className="aa-callprog-bar"><span style={{ width: `${pct}%` }} /></div>
        </div>

        <div className="aa-panelbox">
          <div className="aa-panelbox-head">
            <h2 className="aa-panelbox-title">Recent Activity</h2>
            <button type="button" className="aa-minibtn" onClick={() => onGo('submissions')}>
              Open Submissions <ArrowUpRight width={12} height={12} />
            </button>
          </div>
          {feed.length === 0 ? (
            <p className="aa-muted">Nothing yet — new briefs and orders show up here the moment they land.</p>
          ) : (
            <div className="aa-feed">
              {feed.map(it => (
                <button key={it._id} type="button" className="aa-feed-row"
                  onClick={() => onGo(it.type === 'shop-order' ? 'orders' : 'submissions', it._id)}>
                  <span className={`aa-feed-dot${it.read ? '' : ' is-new'}`} />
                  <span className="aa-feed-name">{it.business || it.name}</span>
                  <span className="aa-feed-type">{TYPE_LABELS[it.type] || it.type}</span>
                  <span className="aa-feed-date">{fmtDate(it.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="aa-shortcuts">
          <button type="button" className="aa-btn" onClick={() => onGo('calls')}><PhoneCall01 width={14} height={14} /> Call Console</button>
          <a className="aa-btn" href="/api/admin/export?type=submissions&format=csv" download><Download01 width={14} height={14} /> Export submissions</a>
          <button type="button" className="aa-btn" onClick={() => onGo('settings')}><Settings01 width={14} height={14} /> Settings</button>
        </div>
      </div>
    </main>
  );
}

/* ── Settings ──────────────────────────────────────────────────── */

function SettingsSection({ onDataChanged, onMobileOpen, onMobileClose }) {
  const [sub, setSub] = useState('security');
  const [prefs, setPrefs] = useState(null);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const [deleted, setDeleted] = useState(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const { state: pushState, enable: enablePush } = usePush();

  useEffect(() => {
    fetch('/api/admin/settings').then(r => r.json()).then(d => setPrefs(d.prefs)).catch(() => {});
  }, []);

  const [deletedLeads, setDeletedLeads] = useState(null);
  const loadDeleted = useCallback(() => {
    fetch('/api/admin/submissions?deleted=1').then(r => r.json()).then(d => setDeleted(d.items || [])).catch(() => setDeleted([]));
    fetch('/api/admin/call-leads?deleted=1').then(r => r.json()).then(d => setDeletedLeads(d.items || [])).catch(() => setDeletedLeads([]));
  }, []);
  useEffect(() => { if (sub === 'deleted') loadDeleted(); }, [sub, loadDeleted]);

  const restoreLeads = async (ids) => {
    await fetch('/api/admin/call-leads', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', ids }),
    });
    loadDeleted();
    onDataChanged();
  };

  const changePw = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.next !== pwForm.confirm) { setPwMsg({ err: true, text: 'New passwords do not match' }); return; }
    const res = await fetch('/api/admin/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'password', current: pwForm.current, next: pwForm.next }),
    });
    const d = await res.json();
    if (!res.ok) { setPwMsg({ err: true, text: d.error || 'Failed' }); return; }
    setPwForm({ current: '', next: '', confirm: '' });
    setPwMsg({ err: false, text: 'Password changed. It takes effect on your next sign-in.' });
  };

  const savePrefs = async (next) => {
    setPrefs(next);
    await fetch('/api/admin/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prefs', ...next }),
    });
  };

  const restore = async (ids) => {
    await fetch('/api/admin/submissions', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', ids }),
    });
    loadDeleted();
    onDataChanged();
  };

  const purge = async () => {
    setConfirmPurge(false);
    await fetch('/api/admin/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'purge' }),
    });
    await fetch('/api/admin/call-leads?purgeDeleted=1', { method: 'DELETE' });
    loadDeleted();
  };

  const SUBS = [
    { id: 'security', label: 'Security', icon: Key01 },
    { id: 'notifications', label: 'Notifications', icon: Bell01 },
    { id: 'export', label: 'Export', icon: Download01 },
    { id: 'deleted', label: 'Recently deleted', icon: Archive },
    { id: 'legacy', label: 'Legacy tools', icon: Printer },
  ];

  return (
    <>
      <aside className="aa-panel">
        <div className="aa-panel-head"><h2 className="aa-panel-title">Settings</h2></div>
        <nav className="aa-groups">
          {SUBS.map(s => {
            const IconEl = s.icon;
            return (
              <button key={s.id} type="button" className={`aa-group${sub === s.id ? ' is-on' : ''}`} onClick={() => { setSub(s.id); onMobileOpen?.(); }}>
                <IconEl width={15} height={15} /><span>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="aa-main lay-scroll">
        <div className="aa-detail lay-content">
          <button type="button" className="aa-back aa-back--mobile" onClick={() => onMobileClose?.()}>
            <ArrowLeft width={15} height={15} /> Settings
          </button>
          {sub === 'security' && (
            <div className="aa-sec">
              <h1 className="aa-settings-h">Change admin password</h1>
              <p className="aa-muted">One password for the whole admin (dashboard, calls, print tools). Takes effect on next sign-in; current sessions stay valid.</p>
              <form onSubmit={changePw} className="aa-pwform">
                <label className="aa-field"><span>Current password</span>
                  <input type="password" className="aa-input" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} autoComplete="current-password" required />
                </label>
                <label className="aa-field"><span>New password (8+ characters)</span>
                  <input type="password" className="aa-input" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} autoComplete="new-password" required minLength={8} />
                </label>
                <label className="aa-field"><span>Confirm new password</span>
                  <input type="password" className="aa-input" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" required />
                </label>
                {pwMsg && <p className={pwMsg.err ? 'aa-msg-err' : 'aa-msg-ok'} role="alert">{pwMsg.text}</p>}
                <button type="submit" className="aa-btn aa-btn--primary"><Key01 width={14} height={14} /> Change password</button>
              </form>
            </div>
          )}

          {sub === 'notifications' && (
            <div className="aa-sec">
              <h1 className="aa-settings-h">Notifications</h1>
              <p className="aa-muted">Where new submissions and orders alert you.</p>
              {prefs && (
                <div className="aa-togglelist">
                  <button type="button" className="aa-togglerow" onClick={() => savePrefs({ ...prefs, pushEnabled: !prefs.pushEnabled })}>
                    <span><strong>Push notifications</strong><br /><span className="aa-muted">To every device you enabled</span></span>
                    <span className={`aa-switch${prefs.pushEnabled ? ' is-on' : ''}`}><span className="aa-switch-thumb" /></span>
                  </button>
                  <button type="button" className="aa-togglerow" onClick={() => savePrefs({ ...prefs, emailEnabled: !prefs.emailEnabled })}>
                    <span><strong>Email backup</strong><br /><span className="aa-muted">contact@visualizeclients.com on every submission</span></span>
                    <span className={`aa-switch${prefs.emailEnabled ? ' is-on' : ''}`}><span className="aa-switch-thumb" /></span>
                  </button>
                </div>
              )}
              <div className="aa-sec" style={{ marginTop: 8 }}>
                <p className="aa-sec-label">This device</p>
                {pushState === 'subscribed'
                  ? <p className="aa-msg-ok">Push is on for this device.</p>
                  : pushState === 'unsupported'
                    ? <p className="aa-muted">This browser can&rsquo;t receive push. On iPhone, install the app to your Home Screen first.</p>
                    : <button type="button" className="aa-btn" onClick={enablePush}><Bell01 width={14} height={14} /> {pushState === 'denied' ? 'Notifications blocked in browser settings' : 'Enable push on this device'}</button>}
              </div>
            </div>
          )}

          {sub === 'export' && (
            <div className="aa-sec">
              <h1 className="aa-settings-h">Export everything</h1>
              <p className="aa-muted">Full unfiltered exports. For filtered exports, use the export button inside Submissions or Orders — it respects whatever filter you have on.</p>
              <div className="aa-exportgrid">
                <a className="aa-btn" href="/api/admin/export?type=submissions&format=csv" download><Download01 width={14} height={14} /> Submissions CSV</a>
                <a className="aa-btn" href="/api/admin/export?type=submissions&format=json" download><Download01 width={14} height={14} /> Submissions JSON</a>
                <a className="aa-btn" href="/api/admin/export?type=orders&format=csv" download><Download01 width={14} height={14} /> Orders CSV</a>
                <a className="aa-btn" href="/api/admin/export?type=orders&format=json" download><Download01 width={14} height={14} /> Orders JSON</a>
              </div>
            </div>
          )}

          {sub === 'deleted' && (
            <div className="aa-sec">
              <div className="aa-panelbox-head">
                <h1 className="aa-settings-h">Recently deleted</h1>
                <button type="button" className="aa-iconbtn" onClick={loadDeleted} title="Refresh"><RefreshCw01 width={14} height={14} /></button>
              </div>
              <p className="aa-muted">Deleted records sit here for 30 days, then purge automatically. Restore puts them right back where they were.</p>
              {(deleted === null || deletedLeads === null) && <Skeletons n={3} />}
              {deleted?.length === 0 && deletedLeads?.length === 0 && <p className="aa-muted">Nothing in the bin.</p>}
              {deleted?.length > 0 && (
                <>
                  <p className="aa-sec-label">Submissions &amp; orders</p>
                  <div className="aa-feed">
                    {deleted.map(it => (
                      <div key={it._id} className="aa-feed-row aa-feed-row--static">
                        <span className="aa-feed-name">{it.business || it.name}</span>
                        <span className="aa-feed-type">{TYPE_LABELS[it.type] || it.type}</span>
                        <span className="aa-feed-date">deleted {fmtDate(it.deletedAt)}</span>
                        <button type="button" className="aa-minibtn" onClick={() => restore([it._id])}>
                          <FlipBackward width={12} height={12} /> Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {deletedLeads?.length > 0 && (
                <>
                  <p className="aa-sec-label">Leads</p>
                  <div className="aa-feed">
                    {deletedLeads.map(it => (
                      <div key={it._id} className="aa-feed-row aa-feed-row--static">
                        <span className="aa-feed-name">{it.business}</span>
                        <span className="aa-feed-type">{it.industry || 'Lead'}</span>
                        <span className="aa-feed-date">deleted {fmtDate(it.deletedAt)}</span>
                        <button type="button" className="aa-minibtn" onClick={() => restoreLeads([it._id])}>
                          <FlipBackward width={12} height={12} /> Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {(deleted?.length > 0 || deletedLeads?.length > 0) && (
                <button type="button" className="aa-btn aa-btn--dangerghost" onClick={() => setConfirmPurge(true)}>
                  <Trash01 width={14} height={14} /> Purge all now
                </button>
              )}
            </div>
          )}

          {sub === 'legacy' && (
            <div className="aa-sec">
              <h1 className="aa-settings-h">Legacy tools</h1>
              <p className="aa-muted">The old print dashboard (invoices, client accounts, maintenance toggle). Its order lists are per-device — Orders in this app is the source of truth now.</p>
              <a className="aa-btn" href={IS_ADMIN_HOST ? '/prints' : '/admin/prints'}><Printer width={14} height={14} /> Open print dashboard</a>
            </div>
          )}
        </div>
      </main>

      {confirmPurge && (
        <ConfirmModal
          title={`Permanently purge ${(deleted?.length || 0) + (deletedLeads?.length || 0)} deleted records?`}
          body="This empties Recently deleted immediately. There is no undo after a purge."
          confirmLabel="Purge all"
          onConfirm={purge}
          onCancel={() => setConfirmPurge(false)}
        />
      )}
    </>
  );
}

/* ── App shell ─────────────────────────────────────────────────── */

export default function AdminApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(null);
  const [items, setItems] = useState([]);
  const [series, setSeries] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selSub, setSelSub] = useState(null);
  const [selOrder, setSelOrder] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookedOpen, setBookedOpen] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const deepLinked = useRef(false);

  // Call leads — loaded at the shell level so the Booked tab badge is live
  // and the Booked workspace has data. The Call Console keeps its own copy;
  // it pings us (onDataChanged) whenever stages/statuses move.
  const [callLeads, setCallLeads] = useState([]);
  const [callLeadsLoading, setCallLeadsLoading] = useState(true);
  const loadCallLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/call-leads');
      if (!res.ok) return;
      const d = await res.json();
      setCallLeads(d.items || []);
    } catch { /* keep last */ }
    finally { setCallLeadsLoading(false); }
  }, []);

  // Optimistic patch for booked-workspace edits, with rollback on failure.
  const patchCallLead = useCallback(async (id, set) => {
    let prev;
    setCallLeads(ls => ls.map(l => { if (l._id === id) { prev = l; return { ...l, ...set }; } return l; }));
    try {
      const res = await fetch('/api/admin/call-leads', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, set }),
      });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      if (prev) setCallLeads(ls => ls.map(l => l._id === id ? prev : l));
      return false;
    }
  }, []);

  const section = useMemo(() => {
    const p = location.pathname.slice(BASE.length) || '/';
    if (p.startsWith('/submissions')) return 'submissions';
    if (p.startsWith('/orders')) return 'orders';
    if (p.startsWith('/calls')) return 'calls';
    if (p.startsWith('/leads')) return 'leads';
    if (p.startsWith('/booked')) return 'booked';
    if (p.startsWith('/clients')) return 'clients';
    if (p.startsWith('/settings')) return 'settings';
    return 'dashboard';
  }, [location.pathname]);

  const go = useCallback((sec, itemId) => {
    navigate(`${BASE}/${sec === 'dashboard' ? '' : sec}` || '/');
    if (itemId) {
      const it = items.find(x => x._id === itemId);
      if (it) (it.type === 'shop-order' ? setSelOrder : setSelSub)(it);
    }
  }, [navigate, items]);

  useEffect(() => {
    fetch('/api/admin/session').then(r => r.json())
      .then(d => setAuthed(!!d.authed))
      .catch(() => setAuthed(false));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/submissions');
      if (res.status === 401) { setAuthed(false); return; }
      const d = await res.json();
      setItems(d.items || []);
      setSeries(d.series || []);
      setUnread(d.unread || 0);
    } catch { /* keep last */ }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (authed) load(); }, [authed, load]);
  useEffect(() => { if (authed) loadCallLeads(); }, [authed, loadCallLeads]);

  const stageCounts = useMemo(() => {
    const c = { lead: 0, booked: 0, won: 0, client: 0, toCall: 0 };
    for (const l of callLeads) {
      const s = effectiveStage(l);
      if (s in c) c[s]++;
      if (s === 'lead' && l.callStatus === 'not-called') c.toCall++;
    }
    return c;
  }, [callLeads]);
  const bookedCount = stageCounts.booked;

  // Lead create/delete for the Leads page (reuses the guarded endpoints).
  const createCallLead = useCallback(async (lead) => {
    const res = await fetch('/api/admin/call-leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    if (res.ok) await loadCallLeads();
    return res.ok;
  }, [loadCallLeads]);
  const deleteCallLead = useCallback(async (id) => {
    await fetch(`/api/admin/call-leads?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setCallLeads(prev => prev.filter(l => l._id !== id));
  }, []);
  const bulkDeleteCallLeads = useCallback(async (ids) => {
    const idSet = new Set(ids);
    const prev = [];
    setCallLeads(cur => cur.filter(l => { if (idSet.has(l._id)) { prev.push(l); return false; } return true; }));
    try {
      const res = await fetch(`/api/admin/call-leads?ids=${ids.map(encodeURIComponent).join(',')}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      setCallLeads(cur => [...cur, ...prev]);
      return false;
    }
  }, []);

  const subs = useMemo(() => items.filter(it => it.type !== 'shop-order'), [items]);
  const orders = useMemo(() => items.filter(it => it.type === 'shop-order'), [items]);
  const unreadSubs = subs.filter(s => !s.read).length;
  const unreadOrders = orders.filter(o => !o.read).length;

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Admin — Visualize` : 'Admin — Visualize';
  }, [unread]);

  // Push-notification deep link: ?submission=<id>
  useEffect(() => {
    if (!authed || deepLinked.current) return;
    const id = new URLSearchParams(window.location.search).get('submission');
    if (!id) return;
    deepLinked.current = true;
    fetch(`/api/admin/submissions?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => {
        if (!d.submission) return;
        if (d.submission.type === 'shop-order') { navigate(`${BASE}/orders`); setSelOrder(d.submission); }
        else { navigate(`${BASE}/submissions`); setSelSub(d.submission); }
      })
      .catch(() => {});
  }, [authed, navigate]);

  // Optimistic patch with rollback.
  const patch = async (id, set) => {
    const prev = items;
    setItems(cur => cur.map(it => it._id === id ? { ...it, ...set } : it));
    setSelSub(cur => (cur && cur._id === id ? { ...cur, ...set } : cur));
    setSelOrder(cur => (cur && cur._id === id ? { ...cur, ...set } : cur));
    if ('read' in set) setUnread(u => Math.max(0, u + (set.read ? -1 : 1)));
    try {
      const res = await fetch('/api/admin/submissions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, set }),
      });
      if (!res.ok) throw new Error();
    } catch { setItems(prev); load(); }
  };

  // Optimistic soft delete with rollback.
  const softDelete = async (ids) => {
    const prev = items;
    const idSet = new Set(ids);
    setItems(cur => cur.filter(it => !idSet.has(it._id)));
    setSelSub(cur => (cur && idSet.has(cur._id) ? null : cur));
    setSelOrder(cur => (cur && idSet.has(cur._id) ? null : cur));
    try {
      const res = await fetch(`/api/admin/submissions?ids=${ids.join(',')}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch { setItems(prev); }
  };

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
  };

  if (authed === null) return <div className="aa-app lay-root"><style>{adminLayoutStyles + aaStyles}</style></div>;
  if (!authed) return <Login onAuthed={() => setAuthed(true)} />;

  // mob: 'tab' = one of the five thumb tabs; 'more' = lives in the More sheet.
  const RAIL = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutAlt01, mob: 'more' },
    { id: 'leads', label: 'Leads', icon: Users01, badge: stageCounts.toCall, mob: 'tab' },
    { id: 'booked', label: 'Booked', icon: CalendarCheck01, badge: bookedCount, mob: 'tab' },
    { id: 'clients', label: 'Clients', icon: Briefcase01, badge: stageCounts.won, mob: 'tab' },
    { id: 'calls', label: 'Calls', icon: PhoneCall01, mob: 'tab' },
    { id: 'submissions', label: 'Submissions', icon: Inbox01, badge: unreadSubs, mob: 'more' },
    { id: 'orders', label: 'Orders', icon: Package, badge: unreadOrders, mob: 'more' },
  ];
  const moreItems = RAIL.filter(r => r.mob === 'more');
  const moreBadge = moreItems.reduce((n, r) => n + (r.badge || 0), 0);
  const linkSubmission = (subId, leadId) => patch(subId, { linkedLeadId: leadId });

  return (
    <div className={`aa-app lay-root${(section === 'submissions' && selSub) || (section === 'orders' && selOrder) || (section === 'settings' && settingsOpen) || (section === 'booked' && bookedOpen) || (section === 'leads' && leadsOpen) || (section === 'clients' && clientsOpen) ? ' has-detail' : ''}`}>
      {/* Icon rail */}
      <nav className="aa-rail" aria-label="Admin sections">
        <a href={BASE || '/'} className="aa-rail-logo" aria-label="Dashboard" onClick={(e) => { e.preventDefault(); go('dashboard'); }}>
          <img src="/logo.svg" alt="" width="26" height="26" />
        </a>
        <div className="aa-rail-items">
          {RAIL.map(r => {
            const IconEl = r.icon;
            return (
              <button key={r.id} type="button"
                className={`aa-rail-btn aa-rail-btn--${r.mob}${section === r.id ? ' is-on' : ''}`}
                onClick={() => go(r.id)} aria-label={r.label} title={r.label}>
                <IconEl width={19} height={19} />
                {r.badge > 0 && <span className="aa-rail-badge">{r.badge}</span>}
                <span className="aa-rail-lbl">{r.label}</span>
              </button>
            );
          })}
          {/* Mobile-only: everything that isn't a thumb tab lives in More */}
          <button type="button"
            className={`aa-rail-btn aa-rail-btn--morebtn${moreOpen || ['dashboard', 'submissions', 'orders', 'settings'].includes(section) ? ' is-on' : ''}`}
            onClick={() => setMoreOpen(true)} aria-label="More sections">
            <DotsGrid width={19} height={19} />
            {moreBadge > 0 && <span className="aa-rail-badge">{moreBadge}</span>}
            <span className="aa-rail-lbl">More</span>
          </button>
        </div>
        <div className="aa-rail-bottom">
          <button type="button" className={`aa-rail-btn${section === 'settings' ? ' is-on' : ''}`} onClick={() => go('settings')} aria-label="Settings" title="Settings">
            <Settings01 width={19} height={19} />
            <span className="aa-rail-lbl">Settings</span>
          </button>
          <button type="button" className="aa-rail-btn aa-rail-btn--quiet" onClick={logout} aria-label="Log out" title="Log out">
            <LogOut01 width={18} height={18} />
            <span className="aa-rail-lbl">Log out</span>
          </button>
        </div>
      </nav>

      {/* Section content */}
      {section === 'dashboard' && (
        <Dashboard subs={subs} orders={orders} unread={unread} onGo={go} stageCounts={stageCounts} callLeads={callLeads} />
      )}
      {section === 'leads' && (
        <AdminLeads
          leads={callLeads} submissions={items} loading={callLeadsLoading}
          onPatch={patchCallLead} onCreate={createCallLead} onDelete={deleteCallLead}
          onBulkDelete={bulkDeleteCallLeads}
          onRefresh={loadCallLeads} onLinkSubmission={linkSubmission}
          onMobileOpen={() => setLeadsOpen(true)} onMobileClose={() => setLeadsOpen(false)} onGo={go}
        />
      )}
      {section === 'clients' && (
        <AdminClients
          leads={callLeads} submissions={items} loading={callLeadsLoading}
          onPatch={patchCallLead} onCreate={createCallLead} onDelete={deleteCallLead}
          onRefresh={loadCallLeads} onLinkSubmission={linkSubmission}
          onMobileOpen={() => setClientsOpen(true)} onMobileClose={() => setClientsOpen(false)} onGo={go}
        />
      )}
      {section === 'submissions' && (
        <ListSection label="Submissions" items={subs} loading={loading} statusSet={LEAD_STATUSES}
          exportType="submissions" sel={selSub} onSelect={setSelSub} onPatch={patch} onDelete={softDelete} />
      )}
      {section === 'orders' && (
        <ListSection label="Orders" items={orders} loading={loading} statusSet={ORDER_STATUSES}
          exportType="orders" sel={selOrder} onSelect={setSelOrder} onPatch={patch} onDelete={softDelete} />
      )}
      {section === 'calls' && (
        <div className="aa-embed"><AdminCalls embedded onDataChanged={loadCallLeads} /></div>
      )}
      {section === 'booked' && (
        <AdminBooked
          leads={callLeads}
          submissions={items}
          loading={callLeadsLoading}
          onPatch={patchCallLead}
          onRefresh={loadCallLeads}
          onLinkSubmission={linkSubmission}
          onMobileOpen={() => setBookedOpen(true)}
          onMobileClose={() => setBookedOpen(false)}
          onGo={go}
        />
      )}
      {section === 'settings' && (
        <SettingsSection onDataChanged={load} onMobileOpen={() => setSettingsOpen(true)} onMobileClose={() => setSettingsOpen(false)} />
      )}

      {/* Mobile "More" sheet — the sections that aren't thumb tabs */}
      {moreOpen && (
        <div className="aa-more-back" onClick={() => setMoreOpen(false)}>
          <div className="aa-more" onClick={e => e.stopPropagation()} role="dialog" aria-label="More sections">
            <div className="aa-more-grid">
              {[...moreItems, { id: 'settings', label: 'Settings', icon: Settings01 }].map(r => {
                const IconEl = r.icon;
                return (
                  <button key={r.id} type="button" className={`aa-more-btn${section === r.id ? ' is-on' : ''}`}
                    onClick={() => { setMoreOpen(false); go(r.id); }}>
                    <IconEl width={20} height={20} />
                    {r.badge > 0 && <span className="aa-rail-badge">{r.badge}</span>}
                    <span>{r.label}</span>
                  </button>
                );
              })}
              <button type="button" className="aa-more-btn" onClick={() => { setMoreOpen(false); logout(); }}>
                <LogOut01 width={20} height={20} />
                <span>Log out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{adminLayoutStyles + aaStyles}</style>
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────────── */

const aaStyles = `
  .aa-app {
    height: 100vh; height: 100dvh; display: flex;
    background: #080808; color: #fafafa;
    font-family: 'Inter', -apple-system, sans-serif;
    --a-border: rgba(255,255,255,0.08);
    --a-panel: #0a0a0a;
    --a-card: #121212;
    --a-raised: #1a1a1a;
    --a-muted: #8a8a8a;
    --a-sec: #cccccc;
    --a-brand: #d44c43;
    overflow: hidden;
    padding-top: var(--lay-safe-top);
  }
  .aa-muted { color: var(--a-muted); font-size: 0.85rem; line-height: 1.6; }

  /* Inputs & buttons */
  .aa-input {
    padding: 9px 12px; border-radius: 10px; width: 100%;
    border: 1px solid rgba(255,255,255,0.13); background: rgba(255,255,255,0.04);
    color: #fafafa; font-size: 0.875rem; font-family: inherit; outline: none;
    transition: border-color 0.2s;
  }
  .aa-input:focus { border-color: var(--a-brand); }
  .aa-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 14px; border-radius: 10px; cursor: pointer;
    border: 1px solid var(--a-border); background: rgba(255,255,255,0.05);
    color: var(--a-sec); font-size: 0.8125rem; font-weight: 600; font-family: inherit;
    text-decoration: none; white-space: nowrap; transition: background 0.15s, color 0.15s;
  }
  .aa-btn:hover { background: rgba(255,255,255,0.1); color: #fafafa; }
  .aa-btn--primary { background: var(--a-brand); border-color: var(--a-brand); color: #fff; }
  .aa-btn--primary:hover { background: #c2413a; color: #fff; }
  .aa-btn--danger { background: #b3362e; border-color: #b3362e; color: #fff; }
  .aa-btn--danger:hover { background: #9d2f28; color: #fff; }
  .aa-btn--dangerghost { color: #f87171; border-color: rgba(239,68,68,0.35); background: rgba(239,68,68,0.07); }
  .aa-btn--dangerghost:hover { background: rgba(239,68,68,0.15); color: #f87171; }
  .aa-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .aa-iconbtn {
    width: 34px; height: 34px; border-radius: 10px; cursor: pointer; flex-shrink: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: 1px solid var(--a-border); background: rgba(255,255,255,0.05);
    color: var(--a-muted); text-decoration: none; transition: color 0.15s, background 0.15s;
  }
  .aa-iconbtn:hover { color: #fafafa; background: rgba(255,255,255,0.1); }
  .aa-minibtn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 11px; border-radius: 8px; cursor: pointer;
    border: 1px solid var(--a-border); background: rgba(255,255,255,0.04);
    color: var(--a-muted); font-size: 0.72rem; font-weight: 700; font-family: inherit;
    text-decoration: none; transition: color 0.15s;
  }
  .aa-minibtn:hover { color: #fafafa; }
  .aa-field { display: flex; flex-direction: column; gap: 5px; }
  .aa-field > span { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.12em; color: var(--a-muted); }

  /* ── Login ── */
  .aa-loginpage { height: 100dvh; display: flex; align-items: center; justify-content: center; background: #080808; color: #fafafa; font-family: 'Inter', sans-serif; }
  .aa-login {
    width: min(360px, 90vw); padding: 40px 32px;
    background: #121212; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.7);
  }
  .aa-login-title { font-size: 1.3rem; font-weight: 800; margin-top: 10px; }
  .aa-login-sub { font-size: 0.8rem; color: #8a8a8a; margin-bottom: 12px; }
  .aa-login-input { text-align: center; }
  .aa-login-btn { width: 100%; justify-content: center; margin-top: 4px; }
  .aa-login-err { font-size: 0.8rem; color: #f87171; }
  @keyframes aaShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-7px)} 40%,80%{transform:translateX(7px)} }
  .aa-shake { animation: aaShake 0.45s ease; }

  /* ── Rail ── */
  .aa-rail {
    width: var(--lay-rail-w); flex-shrink: 0; display: flex; flex-direction: column; align-items: center;
    padding: 14px 0; gap: 10px;
    background: #060606; border-right: 1px solid var(--a-border);
  }
  .aa-rail-logo { display: flex; padding: 6px; border-radius: 10px; margin-bottom: 4px; }
  .aa-rail-items { display: flex; flex-direction: column; gap: 6px; flex: 1; }
  .aa-rail-bottom { display: flex; flex-direction: column; gap: 6px; }
  .aa-rail-btn {
    position: relative; width: 46px; height: 46px; border-radius: 13px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    background: none; border: 1px solid transparent; color: var(--a-muted);
    font-family: inherit; transition: all 0.15s;
  }
  .aa-rail-btn:hover { color: #fafafa; background: rgba(255,255,255,0.06); }
  .aa-rail-btn.is-on { color: var(--a-brand); background: rgba(212,76,67,0.12); border-color: rgba(212,76,67,0.35); }
  .aa-rail-badge {
    position: absolute; top: 6px; right: 6px; min-width: 16px; height: 16px;
    border-radius: 999px; padding: 0 4px;
    background: var(--a-brand); color: #fff; font-size: 0.6rem; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .aa-rail-lbl { display: none; }
  .aa-rail-btn--morebtn { display: none; } /* mobile-only entry */

  /* ── Contextual panel ── */
  .aa-panel {
    width: var(--lay-panel-w); flex-shrink: 0; display: flex; flex-direction: column;
    background: var(--a-panel); border-right: 1px solid var(--a-border); min-height: 0; min-width: 0;
    padding: 16px 12px 12px; gap: 12px; position: relative;
  }
  .aa-panel .aa-groups { overflow-y: auto; min-height: 0; flex-shrink: 1; }
  .aa-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 0 4px; }
  .aa-panel-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.02em; }
  .aa-panel-headbtns { display: flex; gap: 6px; align-items: center; }
  .aa-search-wrap { position: relative; display: flex; align-items: center; color: var(--a-muted); }
  .aa-search-wrap > svg { position: absolute; left: 11px; pointer-events: none; }
  .aa-search { padding-left: 32px; padding-right: 30px; }
  .aa-search-clear { position: absolute; right: 8px; background: none; border: none; color: var(--a-muted); cursor: pointer; display: flex; padding: 4px; }

  .aa-groups { display: flex; flex-direction: column; gap: 3px; }
  .aa-group {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 10px; border-radius: 10px; cursor: pointer;
    background: none; border: none; color: var(--a-sec);
    font-size: 0.83rem; font-weight: 600; font-family: inherit; text-align: left;
    transition: background 0.12s;
  }
  .aa-group:hover { background: rgba(255,255,255,0.05); }
  .aa-group.is-on { background: rgba(212,76,67,0.12); color: #fafafa; }
  .aa-group-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--sc, var(--a-muted)); flex-shrink: 0; }
  .aa-group-n {
    margin-left: auto; font-size: 0.68rem; font-weight: 800; color: var(--a-muted);
    background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 999px; min-width: 24px; text-align: center;
  }
  .aa-group.is-on .aa-group-n { background: rgba(212,76,67,0.25); color: #fff; }

  .aa-selectall {
    display: flex; align-items: center; gap: 8px; padding: 6px 10px;
    background: none; border: none; color: var(--a-muted); cursor: pointer;
    font-size: 0.72rem; font-weight: 700; font-family: inherit;
  }
  .aa-selectall:hover { color: #fafafa; }

  /* The rows list is a ScrollArea; the panel already carries the gutter,
     so the list itself pads only at the bottom. The bulk bar is an in-flow
     sibling below it — no clearance guesswork needed. */
  .aa-rows.lay-scroll { padding: 0 0 12px; display: flex; flex-direction: column; gap: 6px; }
  .aa-row {
    display: flex; align-items: stretch; border-radius: 12px; overflow: hidden;
    background: var(--a-card); border: 1px solid var(--a-border);
    transition: border-color 0.15s;
  }
  .aa-row:hover { border-color: rgba(212,76,67,0.4); }
  .aa-row.is-sel { border-color: var(--a-brand); }
  .aa-row-check {
    display: flex; align-items: center; padding: 0 4px 0 10px;
    background: none; border: none; color: var(--a-muted); cursor: pointer;
  }
  .aa-row-check:hover { color: #fafafa; }
  .aa-row-main {
    flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px;
    padding: 11px 8px; background: none; border: none; cursor: pointer;
    text-align: left; font-family: inherit; color: inherit;
  }
  .aa-row-dot { width: 7px; height: 7px; border-radius: 50%; background: transparent; flex-shrink: 0; }
  .aa-row.is-unread .aa-row-dot { background: var(--a-brand); }
  .aa-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .aa-row-name { font-size: 0.84rem; font-weight: 600; color: #fafafa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .aa-row.is-unread .aa-row-name { font-weight: 800; }
  .aa-row-sub { font-size: 0.68rem; color: var(--a-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .aa-row-del {
    display: flex; align-items: center; padding: 0 10px;
    background: none; border: none; color: transparent; cursor: pointer;
    transition: color 0.15s;
  }
  .aa-row:hover .aa-row-del { color: var(--a-muted); }
  .aa-row-del:hover { color: #f87171 !important; }

  .aa-badge {
    display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
    font-size: 0.62rem; font-weight: 700; padding: 2px 7px; border-radius: 999px;
    color: var(--sc); background: color-mix(in srgb, var(--sc) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--sc) 30%, transparent); white-space: nowrap;
  }
  .aa-badge-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--sc); }

  .aa-bulkbar.lay-footbar {
    flex-direction: row; align-items: center; justify-content: space-between; gap: 10px;
    padding: 10px 14px; border-radius: 12px; border: 1px solid rgba(212,76,67,0.4);
    background: var(--a-raised);
    font-size: 0.82rem; font-weight: 700;
    box-shadow: 0 12px 32px rgba(0,0,0,0.6);
  }

  .aa-empty { padding: 20px 10px; }

  /* Skeletons */
  .aa-skels { display: flex; flex-direction: column; gap: 6px; }
  .aa-skel { border-radius: 12px; background: var(--a-card); border: 1px solid var(--a-border); padding: 12px; display: flex; flex-direction: column; gap: 7px; }
  .aa-skel-a, .aa-skel-b { display: block; height: 10px; border-radius: 5px; background: rgba(255,255,255,0.06); animation: aaPulse 1.4s ease-in-out infinite; }
  .aa-skel-a { width: 60%; } .aa-skel-b { width: 35%; animation-delay: 0.15s; }
  @keyframes aaPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }

  /* ── Main / detail ──
     .aa-main is a ScrollArea (padding + overflow come from .lay-scroll);
     .aa-detail / .aa-dash are .lay-content (width + centering from tokens). */
  .aa-main-empty {
    height: 100%; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 12px; color: var(--a-muted); font-size: 0.9rem; text-align: center; padding: 24px;
  }
  .aa-detail { --lay-stack-gap: 22px; }
  .aa-detail-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .aa-detail-topbtns { display: flex; gap: 8px; }
  .aa-back {
    display: inline-flex; align-items: center; gap: 7px;
    background: none; border: none; color: var(--a-muted); cursor: pointer;
    font-size: 0.85rem; font-weight: 600; font-family: inherit; padding: 0;
  }
  .aa-back:hover { color: #fafafa; }
  .aa-back--mobile { display: none; }
  @media (max-width: 760px) { .aa-back--mobile { display: inline-flex; } }
  .aa-detail-name { font-size: 1.5rem; font-weight: 800; letter-spacing: -0.02em; }
  .aa-detail-meta { font-size: 0.82rem; color: var(--a-muted); margin-top: 3px; }
  .aa-sec { display: flex; flex-direction: column; gap: 10px; }
  .aa-sec-label { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: var(--a-muted); }
  .aa-sec-headrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .aa-socedit { display: flex; flex-direction: column; gap: 12px; }
  .aa-socedit-actions { display: flex; gap: 8px; }
  .aa-status-row { display: flex; gap: 7px; flex-wrap: wrap; }
  .aa-status-opt {
    font-size: 0.78rem; font-weight: 700; padding: 6px 14px; border-radius: 999px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
    color: var(--a-muted); cursor: pointer; font-family: inherit; transition: all 0.15s;
  }
  .aa-status-opt:hover { color: #fafafa; }
  .aa-status-opt.is-on {
    color: var(--sc); background: color-mix(in srgb, var(--sc) 14%, transparent);
    border-color: color-mix(in srgb, var(--sc) 45%, transparent);
  }
  .aa-contact { display: flex; gap: 10px; flex-wrap: wrap; }
  .aa-contact-item {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 0.875rem; font-weight: 600; color: #e66b63;
    padding: 8px 14px; border: 1px solid rgba(212,76,67,0.3); border-radius: 10px;
    background: rgba(212,76,67,0.06); text-decoration: none;
    max-width: 100%; min-width: 0;
  }
  .aa-contact-item:hover { background: rgba(212,76,67,0.14); }
  .aa-answers { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 700px) { .aa-answers { grid-template-columns: 1fr; } }
  .aa-answer {
    display: flex; flex-direction: column; gap: 4px;
    background: var(--a-card); border: 1px solid var(--a-border);
    border-radius: 11px; padding: 12px 14px;
  }
  .aa-answer-k { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--a-muted); }
  .aa-answer-v { font-size: 0.9rem; color: #eaeaea; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
  .aa-notes { resize: vertical; min-height: 90px; }
  .aa-sec .aa-btn { align-self: flex-start; }

  /* ── Dashboard ── */
  .aa-dash { --lay-stack-gap: 20px; }
  .aa-greet-title {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    font-family: 'Barlow Condensed', 'Inter', sans-serif; text-transform: none;
    font-size: clamp(1.9rem, 5vw, 2.7rem); font-weight: 700; letter-spacing: 0.002em;
    overflow-wrap: anywhere;
  }
  .aa-greet-mark { flex-shrink: 0; }
  .aa-funnel { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .aa-funnel-seg { display: inline-flex; align-items: center; gap: 8px; }
  .aa-funnel-arrow { color: var(--a-muted); font-size: 0.9rem; }
  .aa-funnel-btn {
    display: inline-flex; align-items: baseline; gap: 7px; cursor: pointer;
    padding: 8px 15px; border-radius: 999px;
    background: var(--a-card); border: 1px solid var(--a-border);
    color: var(--a-sec); font-size: 0.82rem; font-weight: 700; font-family: inherit;
    transition: border-color 0.15s, color 0.15s; touch-action: manipulation;
  }
  .aa-funnel-btn:hover { border-color: rgba(212,76,67,0.5); color: #fafafa; }
  .aa-funnel-btn strong { font-size: 1.05rem; font-weight: 900; color: #fafafa; }
  .aa-funnel-hint { font-size: 0.72rem; font-weight: 700; color: #fbbf24; }
  .aa-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  @media (max-width: 760px) { .aa-cards { grid-template-columns: 1fr 1fr; } }

  .aa-callprog {
    display: flex; flex-direction: column; gap: 9px;
    background: var(--a-card); border: 1px solid var(--a-border);
    border-radius: 15px; padding: 15px 18px;
  }
  .aa-callprog-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .aa-callprog-lbl { font-size: 0.86rem; color: var(--a-sec); }
  .aa-callprog-lbl strong { color: #fafafa; font-weight: 800; }
  .aa-callprog-pct { font-size: 0.95rem; font-weight: 900; color: var(--a-brand); }
  .aa-callprog-bar { height: 7px; border-radius: 999px; background: rgba(255,255,255,0.07); overflow: hidden; }
  .aa-callprog-bar > span { display: block; height: 100%; border-radius: 999px; background: var(--a-brand); transition: width 0.3s cubic-bezier(0.4,0,0.2,1); }
  .aa-card {
    position: relative; overflow: hidden; text-align: left; cursor: pointer;
    display: flex; flex-direction: column; gap: 4px;
    padding: 18px; border-radius: 18px; font-family: inherit;
    background: var(--a-card); border: 1px solid var(--a-border);
    transition: border-color 0.15s, transform 0.15s;
  }
  .aa-card:hover { border-color: color-mix(in srgb, var(--ac) 45%, transparent); transform: translateY(-2px); }
  .aa-card::after {
    content: ''; position: absolute; top: -28px; right: -28px;
    width: 86px; height: 86px; border-radius: 50%;
    background: var(--ac); opacity: 0.12; filter: blur(6px);
  }
  .aa-card-icon {
    width: 32px; height: 32px; border-radius: 9px; margin-bottom: 6px;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--ac); background: color-mix(in srgb, var(--ac) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--ac) 30%, transparent);
  }
  .aa-card-value { font-size: 1.85rem; font-weight: 900; letter-spacing: -0.03em; color: #fafafa; line-height: 1; }
  .aa-card-label { font-size: 0.72rem; font-weight: 600; color: var(--a-muted); }
  .aa-card-trend { display: inline-flex; align-items: center; gap: 4px; font-size: 0.66rem; font-weight: 700; margin-top: 4px; }
  .aa-card-trend.is-up { color: #22c55e; }
  .aa-card-trend.is-down { color: #f87171; }

  .aa-panelbox { background: var(--a-card); border: 1px solid var(--a-border); border-radius: 18px; padding: 18px 20px; }
  .aa-panelbox-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 10px; }
  .aa-panelbox-title { font-size: 0.92rem; font-weight: 700; }
  .aa-feed { display: flex; flex-direction: column; }
  .aa-feed-row {
    display: grid; grid-template-columns: 12px 1.3fr 0.8fr auto; align-items: center; gap: 12px;
    padding: 11px 4px; border: none; border-bottom: 1px solid var(--a-border);
    background: none; cursor: pointer; text-align: left; font-family: inherit; color: inherit; width: 100%;
    transition: background 0.12s;
  }
  .aa-feed-row--static { grid-template-columns: 1.3fr 0.7fr auto auto; cursor: default; }
  .aa-feed-row:last-child { border-bottom: none; }
  .aa-feed-row:not(.aa-feed-row--static):hover { background: rgba(255,255,255,0.03); }
  .aa-feed-dot { width: 7px; height: 7px; border-radius: 50%; background: transparent; }
  .aa-feed-dot.is-new { background: var(--a-brand); }
  .aa-feed-name { font-size: 0.85rem; font-weight: 600; color: #fafafa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .aa-feed-type { font-size: 0.74rem; color: var(--a-muted); white-space: nowrap; }
  .aa-feed-date { font-size: 0.7rem; color: var(--a-muted); white-space: nowrap; }
  .aa-shortcuts { display: flex; gap: 8px; flex-wrap: wrap; }

  /* ── Settings ── */
  .aa-settings-h { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.02em; }
  .aa-pwform { display: flex; flex-direction: column; gap: 12px; max-width: 380px; margin-top: 6px; }
  .aa-msg-err { color: #f87171; font-size: 0.82rem; font-weight: 600; }
  .aa-msg-ok { color: #22c55e; font-size: 0.82rem; font-weight: 600; }
  .aa-togglelist { display: flex; flex-direction: column; gap: 8px; max-width: 460px; }
  .aa-togglerow {
    display: flex; align-items: center; justify-content: space-between; gap: 14px;
    padding: 13px 16px; border-radius: 13px; cursor: pointer;
    background: var(--a-card); border: 1px solid var(--a-border);
    color: #fafafa; font-size: 0.85rem; font-family: inherit; text-align: left;
    line-height: 1.45;
  }
  .aa-switch {
    width: 42px; height: 24px; border-radius: 999px; flex-shrink: 0;
    background: rgba(255,255,255,0.12); position: relative; transition: background 0.2s;
  }
  .aa-switch.is-on { background: var(--a-brand); }
  .aa-switch-thumb {
    position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
    border-radius: 50%; background: #fff; transition: transform 0.2s; display: block;
  }
  .aa-switch.is-on .aa-switch-thumb { transform: translateX(18px); }
  .aa-exportgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; max-width: 460px; }
  @media (max-width: 560px) { .aa-exportgrid { grid-template-columns: 1fr; } }

  /* ── Modal ── */
  .aa-modal-overlay {
    z-index: 500;
    background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
  }
  .aa-modal {
    width: min(420px, 100%); background: var(--a-raised);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 18px;
    padding: 24px; display: flex; flex-direction: column; gap: 12px;
    box-shadow: 0 24px 80px rgba(0,0,0,0.8);
  }
  .aa-modal-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.01em; }
  .aa-modal-body { font-size: 0.875rem; color: var(--a-sec); line-height: 1.6; }
  .aa-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }

  /* ── Mobile "More" sheet ── */
  .aa-more-back {
    position: fixed; inset: 0; z-index: 400;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(3px);
    display: flex; align-items: flex-end; justify-content: center;
    padding-top: max(16px, env(safe-area-inset-top));
  }
  .aa-more {
    width: 100%; max-width: 560px;
    background: #161616; border: 1px solid rgba(255,255,255,0.12); border-bottom: none;
    border-radius: 18px 18px 0 0;
    padding: 18px 18px calc(18px + env(safe-area-inset-bottom));
  }
  .aa-more-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .aa-more-btn {
    position: relative;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
    min-height: 76px; padding: 12px 8px; border-radius: 13px; cursor: pointer;
    background: rgba(255,255,255,0.04); border: 1px solid var(--a-border);
    color: var(--a-sec); font-size: 0.72rem; font-weight: 700; font-family: inherit;
    touch-action: manipulation; transition: color 0.15s, border-color 0.15s;
  }
  .aa-more-btn:hover { color: #fafafa; }
  .aa-more-btn.is-on { color: var(--a-brand); border-color: rgba(212,76,67,0.4); background: rgba(212,76,67,0.1); }
  .aa-more-btn .aa-rail-badge { top: 8px; right: 14px; }
  @media (min-width: 761px) {
    .aa-more-back { align-items: center; }
    .aa-more { border-radius: 18px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 18px; }
  }

  /* ── Embedded call console ── */
  .aa-embed { flex: 1; min-width: 0; display: flex; }
  .aa-embed .cc-page { height: 100%; flex: 1; }

  /* ── Mobile: rail → bottom tabs, panel-first, full-screen detail ── */
  @media (max-width: 760px) {
    .aa-app { flex-direction: column; }
    .aa-rail {
      order: 2; width: 100%; height: calc(var(--lay-tabbar-h) + var(--lay-safe-bottom));
      flex-direction: row; align-items: center; justify-content: space-around;
      padding: 0 max(6px, env(safe-area-inset-left)) var(--lay-safe-bottom) max(6px, env(safe-area-inset-right)); gap: 0;
      border-right: none; border-top: 1px solid var(--a-border);
    }
    .aa-rail-logo { display: none; }
    .aa-rail-items { flex-direction: row; flex: initial; gap: 2px; display: contents; }
    /* Five thumb tabs: Leads, Booked, Clients, Calls, More.
       Everything else lives in the More sheet on a phone. */
    .aa-rail-bottom { display: none; }
    .aa-rail-btn--more { display: none; }
    .aa-rail-btn--morebtn { display: flex; }
    .aa-rail-btn { width: auto; min-width: 52px; height: 48px; flex-direction: column; gap: 2px; border-radius: 11px; }
    .aa-rail-btn--quiet { display: none; }
    .aa-rail-lbl { display: block; font-size: 0.55rem; font-weight: 700; letter-spacing: 0.02em; }
    .aa-panel { width: 100%; flex: 1; border-right: none; }
    .aa-main { display: none; }
    .aa-main--wide { display: block; flex: 1; }
    .aa-app.has-detail .aa-panel { display: none; }
    .aa-app.has-detail .aa-main { display: block; flex: 1; }
    .aa-embed { flex: 1; min-height: 0; }
  }
`;
