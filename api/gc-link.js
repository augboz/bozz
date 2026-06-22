/**
 * POST /api/gc-link
 * Creates a GoCardless bank requisition and returns the bank auth URL.
 * Body: { institution_id: string, return_url: string }
 * Response: { requisition_id: string, link: string }
 */
import { authed } from './_auth.js';

async function getToken() {
  const r = await fetch('https://bankaccountdata.gocardless.com/api/v2/token/new/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      secret_id: process.env.GOCARDLESS_SECRET_ID,
      secret_key: process.env.GOCARDLESS_SECRET_KEY,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.detail ?? 'Token error');
  return d.access;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');
  if (!(await authed(req, res))) return;

  if (!process.env.GOCARDLESS_SECRET_ID) {
    return res.status(503).json({ error: 'GoCardless not configured' });
  }

  const { institution_id, return_url } = req.body ?? {};
  if (!institution_id) return res.status(400).json({ error: 'institution_id required' });

  const safeReturnUrl = return_url || 'http://127.0.0.1:14986';
  const baseUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : (process.env.API_BASE_URL || 'https://life-bozz.vercel.app');
  const callbackUrl = `${baseUrl}/api/gc-callback?return_url=${encodeURIComponent(safeReturnUrl)}`;

  try {
    const token = await getToken();

    const r = await fetch('https://bankaccountdata.gocardless.com/api/v2/requisitions/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        redirect: callbackUrl,
        institution_id,
        reference: `aug-${Date.now()}`,
        user_language: 'EN',
        account_selection: false,
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.detail ?? 'GoCardless error', detail: data });

    res.json({ requisition_id: data.id, link: data.link });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
