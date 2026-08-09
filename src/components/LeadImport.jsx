import { useState, useCallback } from 'react';
import Upload01 from '@untitled-ui/icons-react/build/esm/Upload01';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import AlertCircle from '@untitled-ui/icons-react/build/esm/AlertCircle';
import ArrowRight from '@untitled-ui/icons-react/build/esm/ArrowRight';
import { LEAD_FIELDS, autoMap, mapRows, summarize } from '../lib/spreadsheet';

const REMEMBER_KEY = 'vz_import_mapping';

// Restore a remembered field→header-name mapping onto the current header row.
function applyRemembered(headers, base) {
  try {
    const saved = JSON.parse(localStorage.getItem(REMEMBER_KEY) || '{}');
    const out = { ...base };
    for (const [field, headerName] of Object.entries(saved)) {
      const idx = headers.findIndex(h => h === headerName);
      if (idx >= 0) out[field] = idx;
    }
    return out;
  } catch { return base; }
}

export default function LeadImport({ existingLeads, onClose, onImported }) {
  const [step, setStep] = useState('pick');   // pick | map | result
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const ingest = useCallback((headers, rows) => {
    if (!headers.length) { setError('No header row found in the file.'); return; }
    setHeaders(headers);
    setRows(rows);
    setMapping(applyRemembered(headers, autoMap(headers)));
    setError('');
    setStep('map');
  }, []);

  const parseInput = useCallback(async (input, kind, name) => {
    setBusy(true); setError('');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(input, kind === 'binary' ? { type: 'array' } : { type: 'string' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error('The file has no sheets.');
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
      const headerRow = (aoa[0] || []).map(h => String(h ?? '').replace(/^﻿/, '').trim());
      setFileName(name || 'pasted data');
      ingest(headerRow, aoa.slice(1));
    } catch (e) {
      setError(`Couldn't read that file: ${e.message || 'unknown error'}`);
    } finally { setBusy(false); }
  }, [ingest]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = /\.(xlsx|xls)$/i.test(file.name) || /sheet|excel/i.test(file.type);
    if (isXlsx) parseInput(await file.arrayBuffer().then(b => new Uint8Array(b)), 'binary', file.name);
    else parseInput(await file.text(), 'text', file.name);
  };

  const usePaste = () => {
    if (!paste.trim()) { setError('Paste some CSV first.'); return; }
    parseInput(paste, 'text', 'pasted CSV');
  };

  const mapped = step === 'map' ? mapRows(rows, mapping) : [];
  const counts = step === 'map' ? summarize(mapped, existingLeads) : null;
  const preview = mapped.slice(0, 10);

  const setField = (fieldKey, idx) => setMapping(m => ({ ...m, [fieldKey]: idx }));

  const runImport = async () => {
    setBusy(true); setError('');
    try {
      // Remember the mapping by header name for next time.
      const remember = {};
      for (const [field, idx] of Object.entries(mapping)) if (idx >= 0 && headers[idx]) remember[field] = headers[idx];
      try { localStorage.setItem(REMEMBER_KEY, JSON.stringify(remember)); } catch { /* private mode */ }

      const res = await fetch('/api/admin/leads/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mapped }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setResult(await res.json());
      setStep('result');
      onImported?.();
    } catch (e) {
      setError(`Import failed: ${e.message}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="li-overlay" role="dialog" aria-modal="true" aria-label="Import leads">
      <div className="li-panel">
        <div className="li-head">
          <h2 className="li-title">Upload spreadsheet</h2>
          <button type="button" className="li-x" onClick={onClose} aria-label="Close"><XClose width={18} height={18} /></button>
        </div>

        {error && <div className="li-error"><AlertCircle width={15} height={15} /> {error}</div>}

        {/* Step 1 — pick a file or paste */}
        {step === 'pick' && (
          <div className="li-body">
            <label className="li-drop">
              <Upload01 width={26} height={26} />
              <span className="li-drop-title">Choose a .csv or .xlsx file</span>
              <span className="li-drop-sub">Exported from Google Sheets or Excel</span>
              <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={onFile} className="li-fileinput" />
            </label>
            <div className="li-or"><span>or paste CSV</span></div>
            <textarea className="li-paste" rows={5} value={paste} onChange={e => setPaste(e.target.value)}
              placeholder="business,phone,instagram&#10;Joe Plumbing,(302) 555-1212,@joeplumb" />
            <button type="button" className="li-btn" onClick={usePaste} disabled={busy || !paste.trim()}>
              {busy ? 'Reading…' : 'Read pasted CSV'}
            </button>
          </div>
        )}

        {/* Step 2 — map columns + preview */}
        {step === 'map' && (
          <div className="li-body">
            <p className="li-file">{fileName} · {rows.length} data row{rows.length !== 1 ? 's' : ''}</p>

            <div className="li-counts">
              <span className="li-count"><b>{counts.total}</b> total</span>
              <span className="li-count li-count--new"><b>{counts.create}</b> new</span>
              <span className="li-count li-count--upd"><b>{counts.update}</b> update existing</span>
              {counts.deleted > 0 && <span className="li-count li-count--del"><b>{counts.deleted}</b> skip (deleted)</span>}
              {counts.invalid > 0 && <span className="li-count li-count--del"><b>{counts.invalid}</b> skip (no name)</span>}
            </div>

            <p className="li-seclabel">Column mapping</p>
            <div className="li-maps">
              {LEAD_FIELDS.map(f => (
                <label key={f.key} className="li-maprow">
                  <span className="li-mapfield">{f.label}{f.required && <i className="li-req">*</i>}</span>
                  <select className="li-select" value={mapping[f.key] ?? -1} onChange={e => setField(f.key, Number(e.target.value))}>
                    <option value={-1}>— none —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>

            <p className="li-seclabel">Preview (first {preview.length})</p>
            <div className="li-tablewrap">
              <table className="li-table">
                <thead><tr><th>Business</th><th>Phone</th><th>Priority</th><th>Status</th><th>Socials</th></tr></thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className={!r.business ? 'li-tr-bad' : ''}>
                      <td>{r.business || <span className="li-bad">missing</span>}</td>
                      <td>{r.phone || '—'}</td>
                      <td>{r.priority || 'warm'}</td>
                      <td>{r.status || 'not called'}</td>
                      <td>{['instagram', 'facebook', 'website', 'google'].filter(k => r[k]).length || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="li-actions">
              <button type="button" className="li-btn" onClick={() => setStep('pick')}>Back</button>
              <button type="button" className="li-btn li-btn--primary" onClick={runImport} disabled={busy || mapping.business == null || mapping.business < 0}>
                {busy ? 'Importing…' : <>Import {counts.total - counts.invalid - counts.deleted} leads <ArrowRight width={15} height={15} /></>}
              </button>
            </div>
            {(mapping.business == null || mapping.business < 0) && <p className="li-hint">Map the <b>Business name</b> column to continue.</p>}
          </div>
        )}

        {/* Step 3 — result */}
        {step === 'result' && result && (
          <div className="li-body">
            <div className="li-done"><Check width={28} height={28} /></div>
            <div className="li-result">
              <span className="li-count li-count--new"><b>{result.created}</b> created</span>
              <span className="li-count li-count--upd"><b>{result.updated}</b> updated</span>
              <span className="li-count li-count--del"><b>{result.skipped.length}</b> skipped</span>
            </div>
            {result.skipped.length > 0 && (
              <div className="li-skips">
                <p className="li-seclabel">Skipped</p>
                {result.skipped.slice(0, 50).map((s, i) => (
                  <p key={i} className="li-skip"><b>{s.business}</b> — {s.reason}</p>
                ))}
              </div>
            )}
            <div className="li-actions">
              <button type="button" className="li-btn" onClick={() => { setStep('pick'); setResult(null); setPaste(''); }}>Import another</button>
              <button type="button" className="li-btn li-btn--primary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
      <style>{liStyles}</style>
    </div>
  );
}

const liStyles = `
  .li-overlay {
    position: fixed; inset: 0; z-index: 600;
    background: rgba(0,0,0,0.72); backdrop-filter: blur(5px);
    display: flex; align-items: center; justify-content: center;
    padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))
             max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    font-family: 'Inter', -apple-system, sans-serif;
  }
  .li-panel {
    width: min(720px, 100%); max-width: 100%; min-width: 0;
    max-height: calc(100dvh - 32px); overflow-y: auto; overscroll-behavior: contain;
    background: #121212; border: 1px solid rgba(255,255,255,0.1); border-radius: 18px;
    box-shadow: 0 30px 90px rgba(0,0,0,0.8); color: #fafafa;
  }
  .li-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 22px; border-bottom: 1px solid rgba(255,255,255,0.08);
    position: sticky; top: 0; background: #121212; z-index: 1;
  }
  .li-title { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em; }
  .li-x {
    width: 34px; height: 34px; border-radius: 9px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #8a8a8a;
  }
  .li-x:hover { color: #fafafa; background: rgba(255,255,255,0.1); }
  .li-body { padding: 20px 22px; display: flex; flex-direction: column; gap: 16px; }

  .li-error {
    display: flex; align-items: center; gap: 8px; margin: 16px 22px 0;
    padding: 10px 14px; border-radius: 10px; font-size: 0.83rem; font-weight: 600;
    color: #fca5a5; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3);
  }

  .li-drop {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 34px 20px; border-radius: 14px; cursor: pointer; text-align: center;
    border: 1.5px dashed rgba(255,255,255,0.2); background: rgba(255,255,255,0.03);
    color: #cfcfcf; transition: border-color 0.15s, background 0.15s;
  }
  .li-drop:hover { border-color: rgba(212,76,67,0.55); background: rgba(212,76,67,0.06); }
  .li-drop svg { color: #d44c43; }
  .li-drop-title { font-size: 0.95rem; font-weight: 700; color: #fafafa; }
  .li-drop-sub { font-size: 0.78rem; color: #8a8a8a; }
  .li-fileinput { display: none; }
  .li-or { display: flex; align-items: center; gap: 12px; color: #6a6a6a; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .li-or::before, .li-or::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
  .li-paste {
    width: 100%; border-radius: 10px; padding: 12px 14px; resize: vertical; min-height: 90px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
    color: #fafafa; font-family: monospace; font-size: 0.8rem; outline: none;
  }
  .li-paste:focus { border-color: #d44c43; }

  .li-file { font-size: 0.8rem; color: #8a8a8a; }
  .li-counts, .li-result { display: flex; gap: 8px; flex-wrap: wrap; }
  .li-count {
    font-size: 0.78rem; color: #cfcfcf; padding: 6px 12px; border-radius: 999px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  }
  .li-count b { color: #fafafa; }
  .li-count--new { color: #86efac; border-color: rgba(34,197,94,0.35); background: rgba(34,197,94,0.08); }
  .li-count--new b { color: #86efac; }
  .li-count--upd { color: #93c5fd; border-color: rgba(96,165,250,0.35); background: rgba(96,165,250,0.08); }
  .li-count--upd b { color: #93c5fd; }
  .li-count--del { color: #fca5a5; border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.07); }
  .li-count--del b { color: #fca5a5; }

  .li-seclabel { font-size: 0.66rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.14em; color: #8a8a8a; }
  .li-maps { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 560px) { .li-maps { grid-template-columns: 1fr; } }
  .li-maprow { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
  .li-mapfield { font-size: 0.8rem; color: #cfcfcf; flex-shrink: 0; }
  .li-req { color: #d44c43; font-style: normal; margin-left: 2px; }
  .li-select {
    flex: 1; min-width: 0; max-width: 58%; padding: 7px 10px; border-radius: 8px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12);
    color: #fafafa; font-family: inherit; font-size: 0.78rem; outline: none; cursor: pointer;
  }
  .li-select:focus { border-color: #d44c43; }
  .li-select option { background: #1a1a1a; }

  .li-tablewrap { overflow-x: auto; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; }
  .li-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  .li-table th { text-align: left; padding: 8px 12px; color: #8a8a8a; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.08); white-space: nowrap; }
  .li-table td { padding: 8px 12px; color: #cfcfcf; border-bottom: 1px solid rgba(255,255,255,0.05); white-space: nowrap; }
  .li-table tr:last-child td { border-bottom: none; }
  .li-tr-bad { background: rgba(239,68,68,0.06); }
  .li-bad { color: #fca5a5; }

  .li-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .li-btn {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 10px 16px; border-radius: 10px; cursor: pointer;
    border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
    color: #cfcfcf; font-size: 0.83rem; font-weight: 700; font-family: inherit;
    transition: background 0.15s, color 0.15s;
  }
  .li-btn:hover { background: rgba(255,255,255,0.1); color: #fafafa; }
  .li-btn--primary { background: #d44c43; border-color: #d44c43; color: #fff; }
  .li-btn--primary:hover { background: #c2413a; color: #fff; }
  .li-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .li-hint { font-size: 0.76rem; color: #f59e0b; text-align: right; }

  .li-done {
    width: 56px; height: 56px; border-radius: 50%; margin: 6px auto 0;
    display: flex; align-items: center; justify-content: center;
    color: #22c55e; background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.35);
  }
  .li-result { justify-content: center; }
  .li-skips { display: flex; flex-direction: column; gap: 5px; max-height: 200px; overflow-y: auto; }
  .li-skip { font-size: 0.8rem; color: #9a9a9a; }
  .li-skip b { color: #cfcfcf; }
`;
