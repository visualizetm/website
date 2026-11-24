import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { uiStyles, LogoSpinner } from '../ui';
import { APP_BASE, appPath } from '../lib/adminPaths';
import { useHead } from '../marketing/useHead';
import { appApi, homeCardSeen } from './appApi';
import { standalone } from './device';
import { DoorSkeleton, Expired, Failed, SetCode, SignIn, AddToHome } from './Door';
import { appStyles } from './app.styles';

/* The client app (client app job): app.visualizeclients.com, one Home Screen app for every client. Its own lazy chunk; the
 * marketing site, the admin and the Call Room never mount here. "Panel" is the portal and the planner behind one sign in.
 *
 *   /                 the panel when this device is signed in (the portal's cards, or the planner for a planner only
 *                     client), else Sign in (phone or email, kept on the device, and the four digits)
 *   /c/:token         a setup link: Set your code when the client has none, Sign in with only the code when they do,
 *                     straight in when this device is already that client; a token alone never shows any client data
 *   /planner/:token   the same door for the planner's link
 *   /planner          the planner of the signed in client
 *   /settings         the panel's settings, Sign out at the bottom
 * Anything else goes to /. On localhost every path sits under /app (APP_BASE). The data doors read the vz_client cookie;
 * a 401 from either sends the device back to Sign in. */
const Portal = lazy(() => import('../pages/Portal'));
const Planner = lazy(() => import('../pages/Planner'));
const Settings = lazy(() => import('./Settings'));
const Boot = () => <LogoSpinner layout="page" className="client-boot" />;
/* The portal and the planner sit in the page's one main landmark, as they did as standalone pages. */
const InMain = ({ children }) => <main className="page-shell page-fade">{children}</main>;
const homePath = (me) => appPath(me?.home === 'planner' || (me && !me.portal) ? '/planner' : '/');

/** A setup link: asks the door which step this token is at, then shows it. */
function TokenDoor({ me, onSignedIn }) {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(null); // null loading | { step, lock } | 'expired' | 'failed'
  const [justSet, setJustSet] = useState(null);
  const ask = useCallback(async () => {
    setStep(null);
    const r = await appApi.token(token);
    if (r.status === 404) setStep('expired');
    else if (!r.ok) setStep('failed');
    else setStep(r.data);
  }, [token]);
  useEffect(() => { ask(); }, [ask]);
  const finish = useCallback(async (data) => { const next = await onSignedIn(data); navigate(homePath(next || data), { replace: true }); }, [onSignedIn, navigate]);
  if (justSet) return <AddToHome onDone={() => finish(justSet)} />;
  if (step === null) return <DoorSkeleton />;
  if (step === 'expired') return <Expired />;
  if (step === 'failed') return <Failed onRetry={ask} />;
  if (step.step === 'in') return <Navigate to={homePath(me)} replace />;
  if (step.step === 'set') return <SetCode token={token} onDone={(data) => (standalone() || homeCardSeen() ? finish(data) : setJustSet(data))} onTaken={ask} onExpired={() => setStep('expired')} />;
  return <SignIn token={token} lock={step.lock} textRob={me?.textRob || ''} onDone={finish} />;
}

export default function ClientApp() {
  const [me, setMe] = useState(null); // null while the door answers, then { signedIn, ... }
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();
  useHead({ title: 'Your panel | Visualize.', description: 'Your portal and your content planner.', noindex: true });
  const loadMe = useCallback(async () => {
    setFailed(false);
    const r = await appApi.me();
    if (!r.ok) { setFailed(true); return null; }
    setMe(r.data);
    return r.data;
  }, []);
  useEffect(() => { loadMe(); }, [loadMe]);
  const signedIn = useCallback(() => loadMe(), [loadMe]);
  /* A data door answered 401: this device's session is gone (signed out elsewhere, or the code was reset). */
  const signInAgain = useCallback(() => { setMe(m => (m ? { signedIn: false, textRob: m.textRob || '' } : m)); navigate(appPath('/'), { replace: true }); loadMe(); }, [navigate, loadMe]);
  const signedOut = useCallback(() => { setMe({ signedIn: false }); navigate(appPath('/'), { replace: true }); loadMe(); }, [navigate, loadMe]);

  const gate = (el) => (failed && !me ? <Failed onRetry={loadMe} /> : !me ? <DoorSkeleton /> : el);
  const home = !me?.signedIn
    ? <SignIn textRob={me?.textRob || ''} onDone={async (data) => { const next = await signedIn(data); navigate(homePath(next || data), { replace: true }); }} />
    : me.portal ? <InMain><Portal api="/api/portal" onSignIn={signInAgain} settingsHref={appPath('/settings')} hint={false} /></InMain>
      : <Navigate to={appPath('/planner')} replace />;
  return (
    <>
      <Suspense fallback={<Boot />}>
        <Routes>
          <Route path={appPath('/')} element={gate(home)} />
          <Route path={`${APP_BASE}/c/:token`} element={gate(<TokenDoor me={me} onSignedIn={signedIn} />)} />
          <Route path={`${APP_BASE}/planner/:token`} element={gate(<TokenDoor me={me} onSignedIn={signedIn} />)} />
          <Route path={`${APP_BASE}/planner`} element={gate(me?.signedIn ? <InMain><Planner api="/api/planner" onSignIn={signInAgain} back={me.portal ? appPath('/') : ''} settingsHref={appPath('/settings')} /></InMain> : <Navigate to={appPath('/')} replace />)} />
          <Route path={`${APP_BASE}/settings`} element={gate(me?.signedIn ? <Settings me={me} onSignedOut={signedOut} /> : <Navigate to={appPath('/')} replace />)} />
          <Route path="*" element={<Navigate to={appPath('/')} replace />} />
        </Routes>
      </Suspense>
      <style>{uiStyles + appStyles}</style>
    </>
  );
}
