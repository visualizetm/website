import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { uiStyles, Card, Stack, Reveal, Logo, LogoSpinner } from '../ui';
import { APP_BASE, appPath } from '../lib/adminPaths';
import { COPY } from '../shared/copy';
import { appStyles } from './app.styles';

/* The client app (client app job): app.visualizeclients.com, one Home Screen app for every client. Its own lazy chunk; the
 * marketing site, the admin and the Call Room never mount here. "Panel" is the portal and the planner behind one sign in.
 *
 *   /                 the panel when this device is signed in, else Sign in
 *   /c/:token         the portal's setup link: the code door for that client
 *   /planner/:token   the planner's setup link, the same door
 *   /planner          the planner of the signed in client
 * Anything else goes to /. On localhost every path sits under /app (APP_BASE). */
const Portal = lazy(() => import('../pages/Portal'));
const Planner = lazy(() => import('../pages/Planner'));
const C = COPY.clientApp;

function SignInScreen() {
  return (
    <main className="lay-root ca-door" aria-label={C.signIn.title}>
      <Reveal className="ca-door-form">
        <Card className="ca-door-card">
          <Stack gap={2} align="center">
            <Logo width={112} tone="auto" clearSpace />
            <h1 className="ca-door-title">{C.signIn.title}</h1>
          </Stack>
          <p className="ca-door-lead">{C.signIn.lead}</p>
        </Card>
      </Reveal>
      <style>{uiStyles + appStyles}</style>
    </main>
  );
}

const Boot = () => <LogoSpinner layout="page" className="client-boot" />;

export default function ClientApp() {
  return (
    <Suspense fallback={<Boot />}>
      <Routes>
        <Route path={appPath('/')} element={<SignInScreen />} />
        <Route path={`${APP_BASE}/c/:token`} element={<Portal />} />
        <Route path={`${APP_BASE}/planner/:token`} element={<Planner />} />
        <Route path={`${APP_BASE}/planner`} element={<SignInScreen />} />
        <Route path="*" element={<Navigate to={appPath('/')} replace />} />
      </Routes>
    </Suspense>
  );
}
