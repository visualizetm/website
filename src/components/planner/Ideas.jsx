import { useRef, useState } from 'react';
import Check from '@untitled-ui/icons-react/build/esm/Check';
import Camera01 from '@untitled-ui/icons-react/build/esm/Camera01';
import CalendarDate from '@untitled-ui/icons-react/build/esm/CalendarDate';
import XClose from '@untitled-ui/icons-react/build/esm/XClose';
import Send01 from '@untitled-ui/icons-react/build/esm/Send01';
import { COPY } from '../../shared/copy';
import { Empty } from './parts';
import { ideaProgress, shortDate } from '../../lib/plannerView';
import { SUGGESTION_KINDS, SUGGESTION_GOALS } from '../../shared/semantics';
import { cloudinaryEnabled, uploadToCloudinary, ACCEPT_ATTR } from '../../lib/cloudinary';

/* Ideas (Planner v2, part 1 H). The composer is a card at the top (no
 * sheet on a phone): what they want, what it is for, a labelled box, Add
 * photos and Pick a date, Send to Rob. Below, their ideas, each with the
 * four step line (Sent, Seen, In the plan, Made) and one sentence. */

const PHOTO_MAX = 3;
const SUBJECT_MAX = 120;

function Composer({ onSend }) {
  const I = COPY.planner.ideas;
  const [kind, setKind] = useState('post');
  const [goal, setGoal] = useState('');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]);
  const [date, setDate] = useState('');
  const [dating, setDating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const pickFiles = async (files) => {
    const list = Array.from(files || []).slice(0, Math.max(0, PHOTO_MAX - photos.length));
    if (!list.length) return;
    setUploading(true); setError('');
    const got = [];
    for (const f of list) {
      const r = await uploadToCloudinary(f);
      if (r.url) got.push(r.url);
      else { setError(`${I.uploadFailed} ${r.error || ''}`.trim()); break; }
    }
    setPhotos(p => [...p, ...got].slice(0, PHOTO_MAX));
    setUploading(false);
  };

  const send = async () => {
    const body = text.trim();
    if (!body) { setError(I.needSubject); return; }
    /* The box is one field to them; the door keeps a short subject (its first line) and the rest as details. */
    const first = body.split('\n')[0].trim();
    const subject = first.slice(0, SUBJECT_MAX);
    const details = body === subject ? '' : body.slice(0, 1000);
    setBusy(true); setError('');
    const r = await onSend({ kind, subject, goal: goal || 'other', details, preferredDate: date, link: '', photos });
    setBusy(false);
    if (r === true) { setText(''); setGoal(''); setPhotos([]); setDate(''); setDating(false); setKind('post'); }
    else setError(r === 400 ? I.needSubject : r === 429 ? I.tooMany : COPY.planner.toast.failed);
  };

  return (
    <section className="pl-card pl-composer" aria-labelledby="pl-composer-h">
      <h2 className="pl-card-title" id="pl-composer-h">{I.composer}</h2>
      <fieldset className="pl-field">
        <legend className="pl-label">{I.what}</legend>
        <div className="pl-chips" role="radiogroup" aria-label={I.what}>
          {SUGGESTION_KINDS.map(k => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={`pl-chip${kind === k.id ? ' is-on' : ''}`} onClick={() => setKind(k.id)}>
              {kind === k.id && <Check width={14} height={14} aria-hidden="true" />}{I.kinds[k.id] || k.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="pl-field">
        <legend className="pl-label">{I.forWhat} <span className="pl-opt">{COPY.planner.change.optional}</span></legend>
        <div className="pl-chips" role="radiogroup" aria-label={I.forWhat}>
          {SUGGESTION_GOALS.map(g => (
            <button key={g.id} type="button" role="radio" aria-checked={goal === g.id} className={`pl-chip${goal === g.id ? ' is-on' : ''}`} onClick={() => setGoal(goal === g.id ? '' : g.id)}>
              {goal === g.id && <Check width={14} height={14} aria-hidden="true" />}{g.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="pl-field">
        <label className="pl-label" htmlFor="pl-idea-about">{I.about}</label>
        <textarea id="pl-idea-about" className="pl-textarea" rows={3} maxLength={1000} value={text} placeholder={I.aboutPlaceholder} onChange={(e) => { setText(e.target.value.slice(0, 1000)); if (error) setError(''); }} />
      </div>
      {photos.length > 0 && (
        <div className="pl-photos" role="group" aria-label={I.photos}>
          {photos.map((u, i) => (
            <span key={u} className="pl-photo">
              <img src={u} alt="" width={64} height={64} loading="lazy" decoding="async" />
              <button type="button" className="pl-photo-x" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))} aria-label={I.removePhoto(i + 1)}><XClose width={14} height={14} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      )}
      {dating && (
        <div className="pl-field">
          <label className="pl-label" htmlFor="pl-idea-date">{I.dateLabel}</label>
          <div className="pl-daterow">
            <input id="pl-idea-date" className="pl-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <button type="button" className="pl-iconbtn" onClick={() => { setDate(''); setDating(false); }} aria-label={I.clearDate}><XClose width={16} height={16} aria-hidden="true" /></button>
          </div>
        </div>
      )}
      <div className="pl-composer-actions">
        {cloudinaryEnabled && photos.length < PHOTO_MAX && (
          <button type="button" className="pl-btn pl-btn--secondary" onClick={() => fileRef.current?.click()} disabled={uploading} aria-busy={uploading ? 'true' : undefined}>
            <Camera01 width={16} height={16} aria-hidden="true" />{uploading ? I.uploading : I.photos}
          </button>
        )}
        {!dating && <button type="button" className="pl-btn pl-btn--secondary" onClick={() => setDating(true)}><CalendarDate width={16} height={16} aria-hidden="true" />{I.date}</button>}
        <button type="button" className="pl-btn pl-send-idea" onClick={send} disabled={busy || uploading} aria-busy={busy ? 'true' : undefined}><Send01 width={16} height={16} aria-hidden="true" />{busy ? I.sending : I.send}</button>
        <input ref={fileRef} type="file" accept={ACCEPT_ATTR} multiple hidden onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />
      </div>
      {error && <p className="pl-formerr" role="alert">{error}</p>}
    </section>
  );
}

function Idea({ s }) {
  const I = COPY.planner.ideas;
  const prog = ideaProgress(s);
  const goal = SUGGESTION_GOALS.find(g => g.id === s.goal);
  const line = prog.state === 'declined' ? (s.note || I.line.declined) : I.line[prog.state];
  return (
    <li className="pl-card pl-idea">
      <div className="pl-card-head">
        <p className="pl-idea-subject">{s.subject}</p>
        <span className="pl-muted">{shortDate(String(s.createdAt || '').slice(0, 10))}</span>
      </div>
      <div className="pl-pills">
        <span className="pl-pill pl-pill--outline">{I.kinds[s.kind] || I.kinds.post}</span>
        {goal && s.goal !== 'other' && <span className="pl-pill pl-pill--outline">{goal.label}</span>}
      </div>
      <ol className={`pl-ideasteps${prog.state === 'declined' ? ' is-declined' : ''}`} aria-label={I.where}>
        {prog.steps.map(st => <li key={st.id} className={`pl-ideastep${st.done ? ' is-done' : ''}`}><span className="pl-ideastep-bar" aria-hidden="true" /><span className="pl-ideastep-l">{I.steps[st.id]}{st.done && <span className="v-sr-only">, done</span>}</span></li>)}
      </ol>
      <p className="pl-idea-line">{line}</p>
    </li>
  );
}

export default function IdeasScreen({ suggestions, onSend }) {
  const I = COPY.planner.ideas;
  return (
    <>
      <h1 className="pl-h1">{I.title}</h1>
      {onSend && <Composer onSend={onSend} />}
      <section className="pl-week-group" aria-labelledby="pl-yours-h">
        <h2 className="pl-h2" id="pl-yours-h">{I.yours}</h2>
        {suggestions.length
          ? <ul className="pl-rows pl-ideas">{suggestions.map(s => <Idea key={s.id} s={s} />)}</ul>
          : <Empty {...COPY.planner.empty.ideas} kind="ideas" />}
      </section>
    </>
  );
}
