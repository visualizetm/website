import ChevronLeft from '@untitled-ui/icons-react/build/esm/ChevronLeft';
import Logo from '../ui/Logo';
import { CONTACT_EMAIL } from '../marketing/links';

/* The chrome for the two pages a client reaches by a link Rob sends: the
 * planner and the review form.
 *
 * Neither is a page on the site. They came from a text message about their
 * own work, so the marketing navbar (with its hamburger, its nav links and
 * its theme control) is noise at best, and at worst an invitation to wander
 * off into the marketing site from the middle of approving a post. What is
 * left is the studio's name, so they know who this is from, and one line at
 * the bottom in case they want to reply to something.
 */

/* The portal's back chip (client portal, prompt 3): a token page opened from the portal carries ?from=portal and nothing
 * else; its own door answers `back`, the owning client's portal path, and the chip shows only with both. The portal token
 * never rides in another page's URL. Nothing else on the page changes. */
const PORTAL_PATH = /^\/c\/[A-Za-z0-9_-]{16,64}$/;
export function portalBackHref(search, back) {
  try { const q = new URLSearchParams(String(search || '')); return q.get('from') === 'portal' && PORTAL_PATH.test(String(back || '')) ? String(back) : ''; } catch { return ''; }
}
export function ClientBar({ label, back = '' }) {
  return (
    <div className="cpc-bar">
      <span className="cpc-mark"><Logo width={104} /></span>
      {label && <><span className="cpc-div" aria-hidden="true" /><span className="cpc-name">{label}</span></>}
      {back && <a className="cpc-back" href={back}><ChevronLeft width={16} height={16} aria-hidden="true" />Back to your portal</a>}
    </div>
  );
}

export function ClientFoot() {
  return (
    <footer className="cpc-foot">
      <span className="cpc-mark"><Logo width={96} /></span>
      <a className="cpc-mail" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </footer>
  );
}

export const clientChromeStyles = `
  .cpc-bar { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-10); flex-wrap: wrap; row-gap: var(--space-2); }
  .cpc-mark { display: inline-flex; }
  .cpc-div { width: 1px; height: 20px; background: var(--border-light); }
  .cpc-name { font-size: 0.9375rem; font-weight: 600; color: var(--text-secondary); }
  .cpc-back { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; min-height: 44px; padding: 0 var(--space-3); border-radius: var(--radius-pill, 999px); background: var(--bg-card); color: var(--text); font-size: 0.8125rem; font-weight: 600; text-decoration: none; white-space: nowrap; }
  .cpc-back:hover { background: var(--hover-soft); }
  .cpc-back:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
  .cpc-foot {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap;
    margin-top: var(--space-16); padding-top: var(--space-6);
    border-top: 1px solid var(--border);
  }
  .cpc-mail { min-height: 44px; display: inline-flex; align-items: center; font-size: 0.875rem; color: var(--text-secondary); }
  .cpc-mail:hover { color: var(--brand-text); }
`;
