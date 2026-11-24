import { useEffect, useRef, useState } from 'react';
import { Card, Stack, Input, Button, Reveal, Logo, SkeletonBlock, SkeletonText } from '../ui';
import { COPY } from '../shared/copy';
import { isWeakCode, codeShape } from '../shared/clientCode';
import { smsHref } from '../lib/linkSend';
import { appApi, rememberedId, rememberId, markHomeCardSeen } from './appApi';
import { isIOS, installPrompt } from './device';

/* The client app's code door (client app job): Set your code, Sign in, the expired link, the failed read and the Add to
 * Home Screen card. Every screen is one card on the ground, built from the kit under the CRM's tokens (dark only). The code
 * field is a password field with the number pad (inputMode numeric), new-password on the set step and current-password on
 * sign in so a password manager can keep it; errors are the field's own alert. The code only ever goes in a POST body. */
const C = COPY.clientApp;
const digits = (v) => String(v || '').replace(/\D/g, '').slice(0, 4);

function DoorCard({ label, title, lead, children, as = 'div', onSubmit }) {
  return (
    <main className="lay-root ca-door" aria-label={label || title}>
      <Reveal as={as} onSubmit={onSubmit} className="ca-door-form" noValidate={as === 'form' ? true : undefined}>
        <Card className="ca-door-card">
          <Stack gap={2} align="center">
            <Logo width={112} tone="auto" clearSpace />
            <h1 className="ca-door-title">{title}</h1>
            {lead && <p className="ca-door-lead">{lead}</p>}
          </Stack>
          {children}
        </Card>
      </Reveal>
    </main>
  );
}

/** The skeleton while the door asks who this is. */
export function DoorSkeleton() {
  return (
    <main className="lay-root ca-door" aria-label={C.loading} aria-busy="true">
      <div className="ca-door-form">
        <Card className="ca-door-card">
          <Stack gap={2} align="center"><SkeletonBlock width={112} height={28} /><SkeletonBlock width={180} height={32} /><SkeletonText lines={2} /></Stack>
          <SkeletonBlock height={72} /><SkeletonBlock height={48} />
        </Card>
      </div>
    </main>
  );
}

export function Expired() {
  return (
    <DoorCard title={C.expired.title} lead={C.expired.lead}>
      <div className="ca-door-state" data-state="expired" />
    </DoorCard>
  );
}

export function Failed({ onRetry }) {
  return (
    <DoorCard title={C.failed.title} lead={C.failed.lead}>
      <Button size="lg" full onClick={onRetry} data-state="failed">{C.failed.retry}</Button>
    </DoorCard>
  );
}

const sayFor = (r) => (r.status === 0 ? C.offline : r.status === 429 ? C.signIn.busy : C.server);

/** Set your code: four digits, then the same four again. The server refuses a weak code too; this check is only the hint. */
export function SetCode({ token, onDone, onTaken, onExpired }) {
  const [step, setStep] = useState('first');
  const [first, setFirst] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const againRef = useRef(null);
  useEffect(() => { if (step === 'again') againRef.current?.focus(); }, [step]);
  const restart = (why) => { setStep('first'); setFirst(''); setAgain(''); setErr(why); };
  const submit = async (e) => {
    e.preventDefault();
    if (step === 'first') {
      if (!codeShape(first)) { setErr(C.set.shape); return; }
      if (isWeakCode(first)) { setErr(C.set.weak); return; }
      setErr(''); setStep('again'); return;
    }
    if (again !== first) { restart(C.set.mismatch); return; }
    setBusy(true); setErr('');
    const r = await appApi.set(token, first, again);
    setBusy(false);
    if (r.ok) { onDone(r.data); return; }
    if (r.status === 400 && r.data?.error === 'weak') { restart(C.set.weak); return; }
    if (r.status === 400 && r.data?.error === 'mismatch') { restart(C.set.mismatch); return; }
    if (r.status === 400) { restart(C.set.shape); return; }
    if (r.status === 409) { onTaken(); return; }
    if (r.status === 404) { onExpired(); return; }
    setErr(sayFor(r));
  };
  return (
    <DoorCard as="form" onSubmit={submit} label={C.set.title} title={C.set.title} lead={C.set.lead}>
      {step === 'first' ? (
        <Input key="first" label={C.set.first} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="new-password" name="new-code"
          value={first} onChange={(e) => { setFirst(digits(e.target.value)); setErr(''); }} error={err || undefined} autoFocus />
      ) : (
        <Input key="again" ref={againRef} label={C.set.again} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="new-password" name="new-code-again"
          value={again} onChange={(e) => { setAgain(digits(e.target.value)); setErr(''); }} error={err || undefined} />
      )}
      <Button type="submit" size="lg" full loading={busy} disabled={step === 'first' ? first.length !== 4 : again.length !== 4}>{step === 'first' ? C.set.next : C.set.save}</Button>
      {step === 'again' && <Button type="button" variant="ghost" full onClick={() => restart('')}>{C.set.back}</Button>}
    </DoorCard>
  );
}

/** Sign in: by the setup link (only the four digits), or by the phone or email kept on this device, or typed. */
export function SignIn({ token = '', lock = null, textRob = '', onDone }) {
  const kept = token ? '' : rememberedId();
  const [who, setWho] = useState(kept);
  const [editing, setEditing] = useState(!kept);
  const [code, setCode] = useState('');
  const [err, setErr] = useState(() => (lock ? (lock.hard ? C.signIn.hardLocked : C.signIn.locked(lock.minutes)) : ''));
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (code.length !== 4) return;
    setBusy(true); setErr('');
    const r = await appApi.signIn(token ? { token, code } : { identifier: who.trim(), code });
    setBusy(false);
    if (r.ok) { if (!token) rememberId(who); setCode(''); onDone(r.data); return; }
    setCode('');
    if (r.status === 401) setErr(C.signIn.noMatch);
    else if (r.status === 423) setErr(r.data?.hard ? C.signIn.hardLocked : C.signIn.locked(Math.max(1, Number(r.data?.minutes) || 15)));
    else setErr(sayFor(r));
  };
  const forgot = textRob
    ? <a className="ca-door-link" href={smsHref(textRob, C.signIn.forgotText)}>{C.signIn.forgot}</a>
    : <span>{C.signIn.forgot}</span>;
  return (
    <DoorCard as="form" onSubmit={submit} label={C.signIn.title} title={C.signIn.title} lead={token || !editing ? C.signIn.leadKnown : C.signIn.lead}>
      {!token && (editing ? (
        <Input label={C.signIn.who} hint={C.signIn.whoHint} type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} name="username"
          value={who} onChange={(e) => { setWho(e.target.value.slice(0, 200)); setErr(''); }} autoFocus />
      ) : (
        <div className="ca-door-who">
          <input type="text" name="username" autoComplete="username" value={who} readOnly hidden />
          <p className="ca-door-help">{C.signIn.remembered(who)}</p>
          <Button type="button" variant="ghost" full onClick={() => { setEditing(true); setWho(''); rememberId(''); }}>{C.signIn.notYou}</Button>
        </div>
      ))}
      <Input label={C.signIn.code} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4} autoComplete="current-password" name="password"
        value={code} onChange={(e) => { setCode(digits(e.target.value)); setErr(''); }} error={err || undefined} autoFocus={!!token || !editing} />
      <Button type="submit" size="lg" full loading={busy} disabled={code.length !== 4 || (!token && !who.trim())}>{C.signIn.submit}</Button>
      <p className="ca-door-help" role="note">{forgot}</p>
    </DoorCard>
  );
}

/** Shown once, right after the code is set: how to keep the app on the Home Screen. Dismissed for good on this device. */
export function AddToHome({ onDone }) {
  const [canInstall, setCanInstall] = useState(() => installPrompt.available());
  useEffect(() => installPrompt.subscribe(setCanInstall), []);
  const close = () => { markHomeCardSeen(); onDone(); };
  const install = async () => { await installPrompt.show(); close(); };
  const line = isIOS() ? C.home.ios : canInstall ? C.home.android : C.home.other;
  return (
    <DoorCard title={C.home.title} lead={line}>
      {canInstall && <Button size="lg" full onClick={install}>{C.home.install}</Button>}
      <Button size="lg" full variant={canInstall ? 'secondary' : 'primary'} onClick={close}>{canInstall ? C.home.later : C.home.done}</Button>
    </DoorCard>
  );
}
