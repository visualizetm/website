import { normalizeChecklists } from './taskRules.js';

/* The checklists sanitizer both routes share (call-leads and projects): the task system's shape, capped, ids kept
 * (a missing one is stamped so a task can be pinned and reminded by id), every string trimmed and bounded. A record
 * written before this carried only text and done on each item; it reads the same and gains the rest on its next write. */
export const sanitizeChecklists = (v) => (Array.isArray(v) ? normalizeChecklists(v) : undefined);
