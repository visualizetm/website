// Server mirror of src/shared/semantics.js ID LISTS. Vercel serverless
// functions cannot import from src/, so these arrays are duplicated here on
// purpose and must be kept identical to the client module.
export const CALL_STATUS_IDS = ['not-called', 'callback', 'no-answer', 'booked', 'no', 'wrong-number'];
export const PRIORITY_IDS = ['hot', 'warm', 'cold'];
export const STAGE_IDS = ['lead', 'booked', 'won', 'client', 'lost'];
export const MEETING_TYPE_IDS = ['call', 'video', 'in-person'];
export const PLAN_IDS = ['full', '6mo', '12mo'];
export const CONTACT_TYPE_IDS = ['call', 'meeting', 'email', 'text', 'other'];
export const LEAD_STATUS_IDS = ['new', 'contacted', 'replied', 'landed', 'denied'];
export const ORDER_STATUS_IDS = ['new', 'paid', 'in-production', 'packaged', 'delivered'];
export const CONCEPT_STATUS_IDS = ['planned', 'generating', 'ready', 'shown'];
// Prompt 10: Clients module enums.
export const PROJECT_KIND_IDS = ['brand', 'web', 'combined', 'print', 'retainer'];
export const PROJECT_STAGE_IDS = ['kickoff', 'design', 'revisions', 'build', 'delivery', 'delivered'];
export const SCHEDULE_STATUS_IDS = ['paid', 'due', 'past-due', 'upcoming'];
export const RETAINER_STATUS_IDS = ['active', 'paused', 'ending', 'cancelled'];
export const CLIENT_STATUS_IDS = ['active', 'paused', 'delivered'];
// Prompt 11: Studio enums.
export const PRINT_ORDER_STATUS_IDS = ['new', 'designed', 'cut', 'packed', 'delivered', 'cancelled'];
export const ORDER_SOURCE_IDS = ['shop', 'client', 'walk-in', 'import'];
export const CONCEPT_KIND_IDS = ['logo', 'brand-board', 'social', 'website', 'signage', 'apparel', 'vehicle', 'packaging', 'ads', 'other'];
export const REVIEW_CHANNEL_IDS = ['nfc', 'text', 'email', 'in-person'];
export const REVIEW_RESULT_IDS = ['asked', 'left', 'declined'];
// Prompt 12: submission types accepted by api/submissions.js.
export const SUBMISSION_TYPE_IDS = ['start', 'contact', 'review', 'shop-order', 'other'];
