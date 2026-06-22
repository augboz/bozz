/**
 * Server-side Google OAuth token proxy.
 * Keeps GOOGLE_CLIENT_SECRET off the client binary entirely.
 *
 * POST body (JSON):
 *   action: 'exchange' | 'refresh'
 *
 *   exchange: { code, code_verifier, redirect_uri, client_id }
 *   refresh:  { refresh_token, client_id }
 */
import { authed } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // Require a signed-in Bozz user — this endpoint wields GOOGLE_CLIENT_SECRET.
  if (!(await authed(req, res))) return;

  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) return res.status(500).json({ error: 'Server not configured' });

  const { action, code, code_verifier, redirect_uri, client_id, refresh_token } = req.body ?? {};

  let params;
  if (action === 'exchange') {
    if (!code || !code_verifier || !redirect_uri || !client_id)
      return res.status(400).json({ error: 'Missing required fields for exchange' });
    params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id,
      client_secret: secret,
      redirect_uri,
      code_verifier,
    });
  } else if (action === 'refresh') {
    if (!refresh_token || !client_id)
      return res.status(400).json({ error: 'Missing required fields for refresh' });
    params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id,
      client_secret: secret,
    });
  } else {
    return res.status(400).json({ error: 'action must be exchange or refresh' });
  }

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data = await r.json();
  return res.status(r.status).json(data);
}
