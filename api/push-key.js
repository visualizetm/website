// Public: the VAPID public key is not a secret — the browser needs it to subscribe.
export default function handler(req, res) {
  res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || null });
}
