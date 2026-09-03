// Server mirror of src/shared/semantics.js ID LISTS. Vercel serverless
// functions cannot import from src/, so these arrays are duplicated here on
// purpose and must be kept identical to the client module.
export const CALL_STATUS_IDS = ['not-called', 'callback', 'no-answer', 'booked', 'no'];
export const PRIORITY_IDS = ['hot', 'warm', 'cold'];
export const STAGE_IDS = ['lead', 'booked', 'won', 'client', 'lost'];
export const MEETING_TYPE_IDS = ['call', 'video', 'in-person'];
export const PLAN_IDS = ['full', '6mo', '12mo'];
export const CONTACT_TYPE_IDS = ['call', 'meeting', 'email', 'text', 'other'];
export const LEAD_STATUS_IDS = ['new', 'contacted', 'replied', 'landed', 'denied'];
export const ORDER_STATUS_IDS = ['new', 'paid', 'in-production', 'packaged', 'delivered'];
