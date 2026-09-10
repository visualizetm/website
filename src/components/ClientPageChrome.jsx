import Wordmark from './Wordmark';
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

export function ClientBar({ label }) {
  return (
    <div className="cpc-bar">
      <span className="cpc-mark"><Wordmark size={20} /></span>
      {label && <><span className="cpc-div" aria-hidden="true" /><span className="cpc-name">{label}</span></>}
    </div>
  );
}

export function ClientFoot() {
  return (
    <footer className="cpc-foot">
      <span className="cpc-mark"><Wordmark size={16} /></span>
      <a className="cpc-mail" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
    </footer>
  );
}

export const clientChromeStyles = `
  .cpc-bar { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-10); }
  .cpc-mark { display: inline-flex; }
  .cpc-div { width: 1px; height: 20px; background: var(--border-light); }
  .cpc-name { font-size: 0.9375rem; font-weight: 600; color: var(--text-secondary); }
  .cpc-foot {
    display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap;
    margin-top: var(--space-16); padding-top: var(--space-6);
    border-top: 1px solid var(--border);
  }
  .cpc-mail { min-height: 44px; display: inline-flex; align-items: center; font-size: 0.875rem; color: var(--text-secondary); }
  .cpc-mail:hover { color: var(--brand-text); }
`;
