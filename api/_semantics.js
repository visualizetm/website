// Server mirror of src/shared/semantics.js ID LISTS. Vercel serverless
// functions cannot import from src/, so these arrays are duplicated here on
// purpose and must be kept identical to the client module.
export const CALL_STATUS_IDS = ['not-called', 'callback', 'no-answer', 'booked', 'no', 'wrong-number'];
export const PRIORITY_IDS = ['hot', 'warm', 'cold'];
/** Mirror of src/shared/semantics.js normalizeStage: the stage field, else booked from the call, else triage for an untouched record, else lead. */
export function normalizeStage(lead) {
  const s = lead?.stage;
  if (s && STAGE_IDS.includes(s)) return s;
  if (lead?.callStatus === 'booked') return 'booked';
  if ((lead?.callStatus || 'not-called') === 'not-called' && !(Array.isArray(lead?.callLog) && lead.callLog.length)) return 'triage';
  return 'lead';
}
export const STAGE_IDS = ['triage', 'lead', 'booked', 'deal', 'client', 'nurture', 'declined', 'won', 'lost'];
export const NEXT_ACTION_KIND_IDS = ['call', 'callback', 'build-concepts', 'log-outcome', 'send-onboarding', 'chase-form', 'send-contract', 'chase-contract', 'send-invoice', 'chase-invoice', 'kickoff', 'revision', 'deliver', 'retainer-pitch', 'review-ask', 'custom'];
export const LIST_WINDOW_IDS = ['any', 'morning', 'midday', 'afternoon', 'evening'];
export const LIST_STATUS_IDS = ['open', 'done'];
export const DECLINE_REASON_IDS = ['well-branded', 'not-fit', 'out-of-area', 'budget', 'shady', 'other'];
export const MEETING_TYPE_IDS = ['call', 'video', 'in-person'];
export const PLAN_IDS = ['full', '6mo', '12mo'];
export const CONTACT_TYPE_IDS = ['call', 'meeting', 'email', 'text', 'other'];
export const LEAD_STATUS_IDS = ['new', 'contacted', 'replied', 'landed', 'denied'];
export const ORDER_STATUS_IDS = ['new', 'paid', 'in-production', 'packaged', 'delivered'];
export const CONCEPT_STATUS_IDS = ['planned', 'generating', 'ready', 'shown'];
// Prompt 10: Clients module enums.
export const PROJECT_KIND_IDS = ['brand', 'web', 'combined', 'print', 'retainer'];
export const PROJECT_STAGE_IDS = ['kickoff', 'design', 'revisions', 'build', 'delivery', 'delivered'];
export const SCHEDULE_STATUS_IDS = ['paid', 'due', 'past-due', 'sent', 'draft', 'upcoming'];
// CRM revamp, step 5: the stored invoice statuses and the deal's checkpoints.
export const INVOICE_STATUS_IDS = ['draft', 'sent', 'paid'];
export const DEAL_CHECKPOINT_IDS = ['concepts', 'introSent', 'callDone', 'onboardingSent', 'formReceived', 'contractSent', 'contractAgreed', 'invoiceSent', 'paid'];
export const DEAL_COLUMN_IDS = ['booked', 'concepts', 'introSent', 'callDone', 'formReceived', 'contractSent', 'invoiceSent'];
export const RETAINER_STATUS_IDS = ['active', 'paused', 'ending', 'cancelled'];
export const CLIENT_STATUS_IDS = ['active', 'paused', 'delivered'];
// Prompt 11: Studio enums.
export const PRINT_ORDER_STATUS_IDS = ['new', 'designed', 'cut', 'packed', 'delivered', 'cancelled'];
export const ORDER_SOURCE_IDS = ['shop', 'client', 'walk-in', 'import'];
export const CONCEPT_KIND_IDS = ['logo', 'brand-board', 'social', 'website', 'signage', 'apparel', 'vehicle', 'packaging', 'ads', 'other'];
// Concepts (the presentation rebuild): a set's life, an item's kind, and what a client can do.
export const CONCEPT_SET_STATUS_IDS = ['draft', 'sent', 'viewed', 'approved', 'changes', 'archived'];
export const CONCEPT_ITEM_KIND_IDS = ['logo', 'board', 'mockup', 'social', 'web', 'print', 'other'];
export const CONCEPT_FEEDBACK_ACTION_IDS = ['approve', 'change', 'note'];
export const REVIEW_CHANNEL_IDS = ['nfc', 'text', 'email', 'in-person'];
export const REVIEW_RESULT_IDS = ['asked', 'left', 'declined'];
// Prompt 12: submission types accepted by api/submissions.js.
export const SUBMISSION_TYPE_IDS = ['start', 'contact', 'review', 'shop-order', 'other'];
// Site Prompt 2: where a showcase testimonial's text came from.
export const TESTIMONIAL_SOURCE_IDS = ['nfc', 'text', 'email', 'in-person', 'website', 'google'];
// Planner prompt 1: the posts collection's two enums.
export const PLATFORM_IDS = ['instagram', 'facebook', 'tiktok', 'other'];
export const POST_STATUS_IDS = ['making', 'review', 'approved', 'posted'];
export const POST_FORMAT_IDS = ['portrait', 'story'];
