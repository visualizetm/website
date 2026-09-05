import { sessionCookie } from '../_lib/auth.js';
import { route } from '../_lib/handler.js';

function handler(req, res) {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.status(200).json({ ok: true });
}
export default route(handler, { methods: ['POST'], admin: false, csrf: true, maxBody: 1024 });
