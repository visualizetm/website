import { Row, Button } from '../ui';
import { useShell } from '../shell/ShellContext';
import { useToast } from '../ui';
import { copyText } from './ClientWorkspace';
import { smsHref, sentLine, canShare, sharePayload, shareWasCancelled } from '../lib/linkSend';

/* The three buttons under a link's message (prompt 3 of 3): Text it (Messages, filled in), Share (the phone's share sheet, hidden where the
 * browser has none) and Draft an email (Compose on the matching template, into Drafts). Copy stays beside them. The link counts as sent the moment
 * Messages is opened or the share sheet resolves, so there is no Mark as sent tap; what is left is the small line "Sent Oct 12, text".
 * `onSent(via)` stamps it. Nothing here sends: a text is the person's own Messages and an email only ever becomes a draft. */
export default function LinkSend({ lead, message, url, title, templateId, sentAt, sentVia, onSent, readOnly = false, className = '' }) {
  const shell = useShell();
  const toast = useToast();
  const share = async () => {
    try { await navigator.share(sharePayload(title, message, url)); } catch (e) { if (shareWasCancelled(e)) return; toast.error('The share sheet would not open.'); return; }
    onSent?.('share');
  };
  const line = sentLine(sentAt, sentVia);
  return (
    <div className={`ls-send ${className}`.trim()}>
      <Row gap={2} wrap>
        <Button variant="secondary" size="md" icon="MessageCircle01" href={smsHref(lead?.phone, message)} onClick={() => { if (!readOnly) onSent?.('text'); }} className="ls-text">Text it</Button>
        {canShare() && <Button variant="secondary" size="md" icon="Share01" onClick={share} className="ls-share">Share</Button>}
        {templateId && lead && <Button variant="secondary" size="md" icon="Mail01" onClick={() => shell?.openCompose?.(lead, { templateId })} className="ls-email">Draft an email</Button>}
        <Button variant="ghost" size="md" icon="Copy01" onClick={() => copyText(toast, message, 'Message')} className="ls-copy">Copy</Button>
      </Row>
      {line && <p className="dt-muted ls-sent" role="status">{line}</p>}
    </div>
  );
}
