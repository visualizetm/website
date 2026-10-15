/* The email renderer (the email system, milestone 2): blocks plus variables
 * in, { subject, preheader, html, text, missing, warnings } out. Server
 * only: Compose previews what this returns, so the browser never renders
 * an email and never ships an HTML template.
 *
 * The look: table based, every style inline, one 600px column, a dark
 * color-scheme, a hidden preheader, lang="en", role="presentation" on
 * every table. No flex, grid, class, external stylesheet, script or SVG,
 * because Gmail (web, iOS, Android), Apple Mail and Outlook do not agree
 * on any of those. The colours below are the one place in src/ and api/
 * where a literal hex is allowed (scripts/hex-count.js exempts this
 * folder): an email cannot read a CSS custom property.
 *
 * Blocks, the only pieces (anything else is dropped with a warning):
 *   eyebrow { text }                       small red uppercase label
 *   heading { text }                       the headline; the renderer adds the red period
 *   text { text }                          a paragraph; **bold**, [label](url) and line breaks, all else escaped
 *   button { label, url, style }           a bulletproof pill, primary (red) or secondary (grey)
 *   lines { rows: [{ label, sub, value }] | from }      a list of labelled rows with a value on the right
 *   totals { rows: [{ label, value, big }] }           a totals block, one row can be big
 *   list { items: [..] | from }            red bullets
 *   box { title, tone: default | red, blocks }        an inner panel, no box inside a box
 *   files { groups: [{ name, note, count }] | from }  file groups with a count
 *   spacer                                 16px of air
 * `from` names a variable that holds the rows (invoice.items, package.includes, deliverables.groups).
 *
 * Variables are {{name}}, dotted names allowed ({{invoice.dueNow}}). An
 * empty, null or undefined value is a missing field: it is listed in
 * `missing` and the send route refuses, so nothing like {{x}}, undefined,
 * null or NaN ever reaches a client. */
export const BLOCK_TYPES = ['eyebrow', 'heading', 'text', 'button', 'lines', 'totals', 'list', 'box', 'files', 'spacer'];
export const BUTTON_STYLES = ['primary', 'secondary'];
export const BOX_TONES = ['default', 'red'];
export const HTML_LIMIT = 90 * 1024;
export const SITE = 'https://visualizestudio.org';
export const WORDMARK_URL = `${SITE}/email/visualize-wordmark-reversed-480.png`;
export const FOOTER_LINES = ['Rob', 'Visualize Studio | visualizestudio.org | @visualizetm', 'Your vision, our creation. Reply to this email and it comes straight to me.'];
export const OPT_OUT_LINE = 'Not interested? Stop these emails.';
const C = { bg: '#080808', card: '#121212', box: '#1A1A1A', line: '#242424', head: '#FAFAFA', body: '#9A9A9A', red: '#d44c43', btn: '#C2413A', white: '#FFFFFF' };
const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const MAX_BLOCKS = 40;
const MAX_ROWS = 30;

const str = (v, max) => String(v ?? '').slice(0, max);
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isHttp = (u) => /^https?:\/\/[^\s<>"']+$/i.test(String(u || '').trim());
const isMailto = (u) => /^mailto:[^\s@<>"']+@[^\s<>"']+$/i.test(String(u || '').trim());
/** A link an email may carry: http, https or mailto, nothing else (javascript:, data: and the rest read as no link). */
export const safeLink = (u) => { const t = String(u || '').trim(); return isHttp(t) || isMailto(t) ? t.slice(0, 600) : ''; };

/* ── The block schema ─────────────────────────────────────────────── */
function row3(r) { return { label: str(r?.label, 120), sub: str(r?.sub, 160), value: str(r?.value, 60) }; }
function sanitizeOne(b, warnings, depth) {
  if (!b || typeof b !== 'object' || !BLOCK_TYPES.includes(b.type)) { warnings.push(`unknown block ${b && typeof b === 'object' ? String(b.type || '?').slice(0, 20) : '?'} dropped`); return null; }
  switch (b.type) {
    case 'eyebrow': case 'heading': return { type: b.type, text: str(b.text, 160) };
    case 'text': return { type: 'text', text: str(b.text, 2000) };
    case 'button': return { type: 'button', label: str(b.label, 80), url: str(b.url, 600), style: BUTTON_STYLES.includes(b.style) ? b.style : 'primary' };
    case 'lines': return { type: 'lines', from: str(b.from, 60), rows: Array.isArray(b.rows) ? b.rows.slice(0, MAX_ROWS).map(row3) : [] };
    case 'totals': return { type: 'totals', rows: Array.isArray(b.rows) ? b.rows.slice(0, MAX_ROWS).map(r => ({ label: str(r?.label, 120), value: str(r?.value, 60), big: !!r?.big })) : [] };
    case 'list': return { type: 'list', from: str(b.from, 60), items: Array.isArray(b.items) ? b.items.slice(0, MAX_ROWS).map(x => str(x, 300)) : [] };
    case 'files': return { type: 'files', from: str(b.from, 60), groups: Array.isArray(b.groups) ? b.groups.slice(0, MAX_ROWS).map(g => ({ name: str(g?.name, 80), note: str(g?.note, 200), count: Math.max(0, Math.round(Number(g?.count) || 0)) })) : [] };
    case 'spacer': return { type: 'spacer' };
    case 'box': {
      if (depth > 0) { warnings.push('a box inside a box dropped'); return null; }
      const inner = (Array.isArray(b.blocks) ? b.blocks : []).slice(0, 12).map(x => sanitizeOne(x, warnings, depth + 1)).filter(Boolean);
      return { type: 'box', title: str(b.title, 120), tone: BOX_TONES.includes(b.tone) ? b.tone : 'default', blocks: inner };
    }
    default: return null;
  }
}
/** The blocks a template or a request may carry: capped, unknown types dropped (named in warnings), a box never inside a box. */
export function sanitizeBlocks(blocks, warnings = []) {
  return (Array.isArray(blocks) ? blocks : []).slice(0, MAX_BLOCKS).map(b => sanitizeOne(b, warnings, 0)).filter(Boolean);
}

/* ── Variables ────────────────────────────────────────────────────── */
const VAR_RX = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
const isEmpty = (v) => v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v)) || (Array.isArray(v) && v.length === 0);
const asText = (v) => (Array.isArray(v) ? v.map(x => (x && typeof x === 'object' ? String(x.label ?? x.name ?? '') : String(x))).filter(Boolean).join(', ') : String(v));
/** Every {{name}} in a string replaced by its value; an empty value is recorded as missing and replaced by nothing. */
export function fillVars(s, vars, missing) {
  return String(s ?? '').replace(VAR_RX, (m, k) => { const v = vars ? vars[k] : undefined; if (isEmpty(v)) { missing.add(k); return ''; } return asText(v); });
}
/** The variable names a template reads, from its subject, preheader and every block. */
export function varsUsed(tpl) {
  const out = new Set();
  const scan = (s) => { for (const m of String(s ?? '').matchAll(VAR_RX)) out.add(m[1]); };
  scan(tpl?.subject); scan(tpl?.preheader);
  const walk = (b) => { if (!b) return; scan(b.text); scan(b.label); scan(b.url); scan(b.title); if (b.from) out.add(b.from); (b.rows || []).forEach(r => { scan(r.label); scan(r.sub); scan(r.value); }); (b.items || []).forEach(scan); (b.groups || []).forEach(g => { scan(g.name); scan(g.note); }); (b.blocks || []).forEach(walk); };
  (tpl?.blocks || []).forEach(walk);
  return [...out];
}

/* ── Inline marks: **bold** and [label](url), on an escaped string ───── */
function marks(escaped) {
  let s = escaped.replace(/\*\*([^*]+)\*\*/g, (m, t) => `<strong style="font-weight:700;color:${C.head};">${t}</strong>`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => { const u = safeLink(url.replace(/&amp;/g, '&')); return u ? `<a href="${esc(u)}" style="color:${C.head};text-decoration:underline;">${label}</a>` : label; });
  return s.replace(/\r?\n/g, '<br>');
}
function marksText(s) {
  let t = String(s ?? '').replace(/\*\*([^*]+)\*\*/g, '$1');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => { const u = safeLink(url); return u ? `${label} (${u})` : label; });
  return t;
}

/* ── HTML pieces ──────────────────────────────────────────────────── */
const P = (inner, extra = '') => `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${C.body};${extra}">${inner}</p>`;
const headingHtml = (t) => { const base = t.replace(/[.\s]+$/, ''); const end = /[?!]$/.test(base) ? '' : `<span style="color:${C.red};">.</span>`; return `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.02em;color:${C.head};">${marks(esc(base))}${end}</h1>`; };
const eyebrowHtml = (t) => `<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${C.red};">${esc(t)}</p>`;
const buttonHtml = (label, url, style) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;"><tr><td style="border-radius:999px;background:${style === 'secondary' ? C.line : C.btn};"><a href="${esc(url)}" style="display:inline-block;min-height:44px;padding:0 24px;font-family:${FONT};font-size:16px;line-height:44px;font-weight:700;color:${C.white};text-decoration:none;border-radius:999px;">${esc(label)}</a></td></tr></table>`;
const linesHtml = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${rows.map((r, i) => `<tr><td style="padding:10px 0;border-top:${i ? `1px solid ${C.line}` : '0'};font-family:${FONT};font-size:15px;line-height:22px;color:${C.head};">${esc(r.label)}${r.sub ? `<br><span style="font-size:13px;line-height:18px;color:${C.body};">${esc(r.sub)}</span>` : ''}</td><td align="right" valign="top" style="padding:10px 0 10px 12px;border-top:${i ? `1px solid ${C.line}` : '0'};font-family:${FONT};font-size:15px;line-height:22px;color:${C.head};white-space:nowrap;">${esc(r.value)}</td></tr>`).join('')}</table>`;
const totalsHtml = (rows) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border-top:1px solid ${C.line};">${rows.map(r => `<tr><td style="padding:${r.big ? '12px 0 4px' : '8px 0 0'};font-family:${FONT};font-size:${r.big ? '18px' : '15px'};line-height:${r.big ? '26px' : '22px'};font-weight:${r.big ? '700' : '400'};color:${r.big ? C.head : C.body};">${esc(r.label)}</td><td align="right" valign="bottom" style="padding:${r.big ? '12px 0 4px 12px' : '8px 0 0 12px'};font-family:${FONT};font-size:${r.big ? '24px' : '15px'};line-height:${r.big ? '30px' : '22px'};font-weight:${r.big ? '800' : '400'};color:${C.head};white-space:nowrap;">${esc(r.value)}</td></tr>`).join('')}</table>`;
const listHtml = (items) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${items.map(t => `<tr><td valign="top" style="padding:0 10px 8px 0;font-family:${FONT};font-size:16px;line-height:26px;color:${C.red};">&#8226;</td><td style="padding:0 0 8px;font-family:${FONT};font-size:16px;line-height:26px;color:${C.body};">${marks(esc(t))}</td></tr>`).join('')}</table>`;
const filesHtml = (groups) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${groups.map((g, i) => `<tr><td style="padding:10px 0;border-top:${i ? `1px solid ${C.line}` : '0'};font-family:${FONT};font-size:15px;line-height:22px;font-weight:700;color:${C.head};">${esc(g.name)}${g.note ? `<br><span style="font-size:13px;line-height:18px;font-weight:400;color:${C.body};">${esc(g.note)}</span>` : ''}</td><td align="right" valign="top" style="padding:10px 0 10px 12px;border-top:${i ? `1px solid ${C.line}` : '0'};font-family:${FONT};font-size:13px;line-height:22px;color:${C.body};white-space:nowrap;">${g.count} file${g.count === 1 ? '' : 's'}</td></tr>`).join('')}</table>`;
const boxHtml = (title, tone, inner) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr><td style="background:${C.box};border-radius:12px;padding:20px 20px 4px;${tone === 'red' ? `border-left:4px solid ${C.red};` : ''}">${title ? `<p style="margin:0 0 12px;font-family:${FONT};font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${tone === 'red' ? C.red : C.body};">${esc(title)}</p>` : ''}${inner}</td></tr></table>`;
const spacerHtml = () => `<div style="height:16px;line-height:16px;font-size:1px;">&nbsp;</div>`;

/** The rows a `from` variable holds, in the block's own shape. */
function rowsFrom(b, vars, missing) {
  if (!b.from) return null;
  const v = vars ? vars[b.from] : undefined;
  if (isEmpty(v) || !Array.isArray(v)) { missing.add(b.from); return []; }
  if (b.type === 'list') return v.map(x => (x && typeof x === 'object' ? String(x.label ?? x.name ?? '') : String(x))).filter(Boolean).slice(0, MAX_ROWS);
  if (b.type === 'files') return v.map(g => ({ name: str(g?.name, 80), note: str(g?.note, 200), count: Math.max(0, Math.round(Number(g?.count) || 0)) })).filter(g => g.name).slice(0, MAX_ROWS);
  return v.map(row3).filter(r => r.label).slice(0, MAX_ROWS);
}

function renderBlock(b, vars, missing, out, text, depth = 0) {
  const f = (s) => fillVars(s, vars, missing);
  switch (b.type) {
    case 'eyebrow': { const t = f(b.text); if (!t) return; out.push(eyebrowHtml(t)); text.push(t.toUpperCase()); return; }
    case 'heading': { const t = f(b.text); if (!t) return; out.push(headingHtml(t)); text.push(`${t.replace(/[.\s]+$/, '')}${/[?!]$/.test(t.trim()) ? '' : '.'}`); return; }
    case 'text': { const t = f(b.text); if (!t.trim()) return; out.push(P(marks(esc(t)))); text.push(marksText(t)); return; }
    case 'button': { const label = f(b.label); const url = safeLink(f(b.url)); if (!url) { missing.add(b.url && VAR_RX.test(b.url) ? b.url.replace(VAR_RX, '$1') : `button:${label || 'link'}`); VAR_RX.lastIndex = 0; return; } out.push(buttonHtml(label || 'Open', url, b.style)); text.push(`${label || 'Open'}: ${url}`); return; }
    case 'lines': { const rows = (rowsFrom(b, vars, missing) ?? b.rows.map(r => ({ label: f(r.label), sub: f(r.sub), value: f(r.value) }))).filter(r => r.label); if (!rows.length) return; out.push(linesHtml(rows)); rows.forEach(r => text.push(`${r.label}${r.sub ? ` (${r.sub})` : ''}${r.value ? `: ${r.value}` : ''}`)); return; }
    case 'totals': { const rows = b.rows.map(r => ({ label: f(r.label), value: f(r.value), big: r.big })).filter(r => r.label); if (!rows.length) return; out.push(totalsHtml(rows)); rows.forEach(r => text.push(`${r.label}: ${r.value}`)); return; }
    case 'list': { const items = (rowsFrom(b, vars, missing) ?? b.items.map(f)).filter(Boolean); if (!items.length) return; out.push(listHtml(items)); items.forEach(t => text.push(`- ${marksText(t)}`)); return; }
    case 'files': { const groups = (rowsFrom(b, vars, missing) ?? b.groups.map(g => ({ ...g, name: f(g.name), note: f(g.note) }))).filter(g => g.name); if (!groups.length) return; out.push(filesHtml(groups)); groups.forEach(g => text.push(`${g.name}${g.note ? `, ${g.note}` : ''}, ${g.count} file${g.count === 1 ? '' : 's'}`)); return; }
    case 'spacer': { out.push(spacerHtml()); text.push(''); return; }
    case 'box': { if (depth > 0) return; const inner = []; const innerText = []; const title = f(b.title); b.blocks.forEach(x => renderBlock(x, vars, missing, inner, innerText, depth + 1)); if (!inner.length && !title) return; out.push(boxHtml(title, b.tone, inner.join(''))); text.push(''); if (title) text.push(title.toUpperCase()); innerText.forEach(l => text.push(l)); text.push(''); return; }
    default: return;
  }
}

/**
 * renderEmail({ subject, preheader, blocks, vars, marketing, optOutUrl })
 *   -> { subject, preheader, html, text, missing, warnings, bytes, tooBig }
 * A marketing email carries the opt out line and link in its footer; a transactional one never does.
 */
export function renderEmail({ subject = '', preheader = '', blocks = [], vars = {}, marketing = false, optOutUrl = '' } = {}) {
  const missing = new Set(); const warnings = [];
  const clean = sanitizeBlocks(blocks, warnings);
  const subj = fillVars(subject, vars, missing).replace(/\s+/g, ' ').trim().slice(0, 200);
  const pre = fillVars(preheader, vars, missing).replace(/\s+/g, ' ').trim().slice(0, 200);
  const parts = []; const text = [];
  clean.forEach(b => renderBlock(b, vars, missing, parts, text));
  const opt = marketing ? safeLink(optOutUrl) : '';
  if (marketing && !opt) missing.add('optOutUrl');
  const footer = FOOTER_LINES.map(l => esc(l)).join('<br>') + (opt ? `<br><a href="${esc(opt)}" style="color:${C.body};text-decoration:underline;">${esc(OPT_OUT_LINE)}</a>` : '');
  const html = [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<html lang="en" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">',
    `<title>${esc(subj)}</title></head>`,
    `<body style="margin:0;padding:0;background:${C.bg};-webkit-text-size-adjust:100%;">`,
    pre ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;mso-hide:all;">${esc(pre)}${'&nbsp;&zwnj;'.repeat(40)}</div>` : '',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};"><tr><td align="center" style="padding:32px 16px;">`,
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">',
    `<tr><td style="padding:0 0 24px;"><img src="${WORDMARK_URL}" width="132" alt="Visualize." style="display:block;border:0;width:132px;height:auto;"></td></tr>`,
    `<tr><td style="background:${C.card};border-radius:18px;padding:36px 32px 20px;font-family:${FONT};">${parts.join('')}</td></tr>`,
    `<tr><td style="padding:24px 8px 0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.body};">${footer}</td></tr>`,
    '</table></td></tr></table></body></html>',
  ].join('');
  const plain = [...text, '', ...FOOTER_LINES, ...(opt ? [`${OPT_OUT_LINE} ${opt}`] : [])].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > HTML_LIMIT) warnings.push(`the email is ${Math.round(bytes / 1024)} KB, over the 90 KB limit`);
  return { subject: subj, preheader: pre, html, text: plain, missing: [...missing], warnings, bytes, tooBig: bytes > HTML_LIMIT };
}
