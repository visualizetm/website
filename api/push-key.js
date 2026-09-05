import { route } from './_lib/handler.js';
// Public: the VAPID public key is not a secret, the browser needs it to subscribe.
function handler(req, res) {
  res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || null });
}
export default route(handler, { methods: ['GET'], admin: false });
