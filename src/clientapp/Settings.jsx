import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Stack, Button, Reveal, IconButton, Icon } from '../ui';
import { COPY } from '../shared/copy';
import { appPath } from '../lib/adminPaths';
import { appApi } from './appApi';
import { pushSupported, needsHomeScreenForPush } from './device';

/* The panel's settings (client app job): who is signed in, pings (the switch lives on the portal's Notifications card and
 * the planner's bell; an iPhone in Safari gets the one line that it needs the Home Screen app), the code, and Sign out as the
 * text link at the bottom. Sign out clears the cookie on this device and goes back to the sign in. */
const C = COPY.clientApp.settings;

export default function Settings({ me, onSignedOut }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const pings = needsHomeScreenForPush() ? C.pingsIos : pushSupported() ? C.pingsLine : C.pingsOff;
  const signOut = async () => {
    setBusy(true);
    await appApi.signOut();
    setBusy(false);
    onSignedOut();
  };
  const back = () => { if (window.history.state?.idx > 0) navigate(-1); else navigate(appPath(me?.portal ? '/' : '/planner'), { replace: true }); };
  return (
    <main className="lay-root ca-page" aria-label={C.title}>
      <header className="ca-bar">
        <IconButton icon="ChevronLeft" label={C.back} onClick={back} />
        <h1 className="ca-bar-title">{C.title}</h1>
        <span className="ca-bar-end" aria-hidden="true" />
      </header>
      <Reveal className="ca-page-body">
        <Stack gap={3}>
          <p className="ca-who">{C.who(me?.firstName)}</p>
          <Card className="ca-row">
            <span className="ca-row-icon" aria-hidden="true"><Icon icon="Bell01" size={20} /></span>
            <span className="ca-row-text"><span className="ca-row-title">{C.pings}</span><span className="ca-row-line" role="note">{pings}</span></span>
          </Card>
          <Card className="ca-row">
            <span className="ca-row-icon" aria-hidden="true"><Icon icon="Lock01" size={20} /></span>
            <span className="ca-row-text"><span className="ca-row-title">{C.code}</span><span className="ca-row-line">{C.codeLine}</span></span>
          </Card>
          <Button variant="ghost" className="ca-signout" onClick={signOut} loading={busy}>{busy ? C.signingOut : C.signOut}</Button>
        </Stack>
      </Reveal>
    </main>
  );
}
