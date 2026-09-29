import { CHECKPOINTS, dealOf, isTicked } from '../../lib/deal';

/* The one action a checkpoint asks for (UI simplification, part A). The
 * header's primary, the outcome bar and the Checkpoints rows all read this,
 * so they never disagree. The Deals cards walk the same order: the current
 * checkpoint is the first one not ticked.
 *   send   the intro or onboarding email through the send modal
 *   met    Met them: ticks Call done and makes the record a deal
 *   build  opens the concepts editor (Concepts built ticks itself once a set exists)
 *   tick   ticks the step by hand
 *   money  switches to the Money tab, where Send and Mark paid live */
const RULES = {
  concepts: { label: 'Build concepts', short: 'Build', kind: 'build', icon: 'LayersThree01' },
  introSent: { label: 'Send intro', short: 'Send', kind: 'send', email: 'intro', icon: 'Send01' },
  callDone: { label: 'Met them', short: 'Met them', kind: 'met', icon: 'Check' },
  onboardingSent: { label: 'Send onboarding', short: 'Send', kind: 'send', email: 'onboarding', icon: 'Send01' },
  formReceived: { label: 'Tick', short: 'Tick', kind: 'tick', icon: 'Check' },
  contractSent: { label: 'Send contract', short: 'Tick', kind: 'tick', icon: 'File06' },
  contractAgreed: { label: 'Tick', short: 'Tick', kind: 'tick', icon: 'Check' },
  invoiceSent: { label: 'Send invoice', short: 'Invoices', kind: 'money', icon: 'CurrencyDollar' },
  paid: { label: 'Mark paid', short: 'Invoices', kind: 'money', icon: 'CurrencyDollar' },
};

export const currentCheckpoint = (lead) => { const d = dealOf(lead); return CHECKPOINTS.find(c => !isTicked(d, c.id)) || null; };

/** The action for one checkpoint: { id, label, short, kind, email?, icon, checkpoint }. */
export function actionFor(checkpoint, { canBuild = true } = {}) {
  if (!checkpoint) return null;
  if (checkpoint.id === 'concepts' && !canBuild) return { id: 'concepts', label: 'Tick', short: 'Tick', kind: 'tick', icon: 'Check', checkpoint };
  return { id: checkpoint.id, ...RULES[checkpoint.id], checkpoint };
}

/** The current checkpoint's action, or null once every step is ticked. */
export const checkpointAction = (lead, opts) => actionFor(currentCheckpoint(lead), opts);

/** What `run` in LeadDetail gets for a checkpoint action. */
export const runKeyFor = (a) => (a.kind === 'send' ? `email:${a.email}` : a.kind === 'met' ? 'met' : a.kind === 'build' ? 'build' : a.kind === 'money' ? 'tab:money' : `tick:${a.id}`);
