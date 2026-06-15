/**
 * GET /api/gc-institutions
 * Returns list of UK bank institutions from GoCardless Bank Account Data.
 *
 * Setup: Sign up free at bankaccountdata.gocardless.com
 * Add to Vercel env vars: GOCARDLESS_SECRET_ID, GOCARDLESS_SECRET_KEY
 */
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
  const secretId = process.env.GOCARDLESS_SECRET_ID;
  const secretKey = process.env.GOCARDLESS_SECRET_KEY;

  if (!secretId || !secretKey) {
    return res.status(503).json({
      error: 'GoCardless not configured',
      setup: 'Sign up free at bankaccountdata.gocardless.com → User Secrets → create secret. Add GOCARDLESS_SECRET_ID and GOCARDLESS_SECRET_KEY to your Vercel environment variables.',
    });
  }

  try {
    const token = await getToken();
    const r = await fetch('https://bankaccountdata.gocardless.com/api/v2/institutions/?country=GB', {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
    });
    const data = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(data));
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
