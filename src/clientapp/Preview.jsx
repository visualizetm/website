import { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { LogoSpinner } from '../ui';
import { COPY } from '../shared/copy';
import { ADMIN_HOME } from '../lib/adminPaths';
import { useHead } from '../marketing/useHead';

/* Rob's read only preview of a client's panel (client app job), on the admin host at /preview/portal/:id and
 * /preview/planner/:id (/admin/preview/... on localhost). The same screens draw the exact answer the client's door gives
 * (GET /api/admin/client-app, behind the admin cookie), with no write control; no client cookie is ever made for Rob.
 * Opened in its own tab from the CRM, so it has no Back of its own. */
const Portal = lazy(() => import('../pages/Portal'));
const Planner = lazy(() => import('../pages/Planner'));
const PREVIEW = /\/preview\/(portal|planner)\/([A-Za-z0-9_-]{1,64})\/?$/;

export default function ClientPreview() {
  const { pathname } = useLocation();
  useHead({ title: 'Preview | Visualize.', description: 'A read only preview of a client panel.', noindex: true });
  const m = PREVIEW.exec(pathname);
  const [, view, id] = m || [];
  const api = `/api/admin/client-app?view=${view}&id=${encodeURIComponent(id || '')}`;
  const toCrm = () => window.location.assign(ADMIN_HOME);
  return (
    <>
      <header className="ca-preview-note"><p className="ca-preview-line" role="note">{COPY.clientApp.preview.note}</p></header>
      <main className="page-shell">
        <Suspense fallback={<LogoSpinner layout="page" className="client-boot" />}>
          {view === 'planner' ? <Planner api={api} readOnly onSignIn={toCrm} /> : <Portal api={api} readOnly hint={false} onSignIn={toCrm} />}
        </Suspense>
      </main>
      <style>{previewStyles}</style>
    </>
  );
}
const previewStyles = `
  .ca-preview-note { position: sticky; top: 0; z-index: 50; margin: 0; padding: var(--space-2) var(--space-3); text-align: center; font-size: 0.875rem; background: var(--bg-card); color: var(--text); border-bottom: 1px solid var(--border-light); }
  .ca-preview-line { margin: 0; }
`;
