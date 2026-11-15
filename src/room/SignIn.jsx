import { useState } from 'react';
import { uiStyles, Card, Stack, Input, Button, Reveal, Logo } from '../ui';
import { COPY } from '../shared/copy';
import { roomApi } from './roomApi';
import { roomStyles } from './room.styles';

/* Sign in (Billy's Call Room): Email and Passcode, a POST with a body (never a query string), the vz_caller cookie on a yes.
 * A wrong email and a wrong passcode read the same; the limiter's own sentence shows on a 429. */
export default function SignIn({ onSignedIn }) {
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const r = await roomApi.login(email.trim(), passcode);
    setBusy(false);
    if (r.ok) { setPasscode(''); onSignedIn(); return; }
    setErr(r.status === 401 ? COPY.room.signIn.wrong : r.status === 429 && r.data?.error ? r.data.error : r.status ? 'Something went wrong on our side. Try again in a minute.' : 'No connection. Check your signal and try again.');
  };
  return (
    <main className="lay-root rm-signin" aria-label="Sign in to the Call Room">
      <Reveal as="form" onSubmit={submit} className="rm-signin-form" noValidate>
        <Card className="rm-signin-card">
          <Stack gap={2} align="center">
            <Logo width={112} tone="auto" clearSpace />
            <h1 className="rm-signin-title">{COPY.room.signIn.title}</h1>
          </Stack>
          <Input label="Email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => { setEmail(e.target.value); setErr(''); }} autoFocus />
          <Input label="Passcode" type="password" autoComplete="current-password" autoCapitalize="characters" value={passcode} onChange={(e) => { setPasscode(e.target.value); setErr(''); }} error={err || undefined} />
          <Button type="submit" size="lg" full loading={busy} disabled={!email.trim() || !passcode}>Sign in</Button>
          <p className="rm-signin-help" role="note">{COPY.room.signIn.help}</p>
        </Card>
      </Reveal>
      <style>{uiStyles + roomStyles}</style>
    </main>
  );
}
