import { isAuthed, renewSession } from '../_lib/auth.js';

export function handler(req, res) {
  const authed = isAuthed(req);
  if (authed) renewSession(req, res);
  res.status(200).json({ authed });
}