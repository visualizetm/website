import { isAuthed, renewSession } from '../_lib/auth.js';
import { route } from '../_lib/handler.js';

function handler(req, res) {
  const authed = isAuthed(req);
  if (authed) renewSession(req, res);
  res.status(200).json({ authed });
}
export default route(handler, { methods: ['GET'], admin: false });
