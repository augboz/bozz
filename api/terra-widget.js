/**
 * POST /api/terra-widget
 * Generates a Terra widget session URL for Apple Health connection.
 * Body: { reference_id: string }
 * Response: { url: string } | { error, setup }
 *
 * Setup: Sign up free at tryterra.co → API Key section → copy DEV_ID and API_KEY
 * Add to Vercel env vars: TERRA_DEV_ID, TERRA_API_KEY
 * Set webhook URL in Terra dashboard → https://life-bozz.vercel.app/api/terra-webhook
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const devId = process.env.TERRA_DEV_ID;
  const apiKey = process.env.TERRA_API_KEY;

  if (!devId || !apiKey) {
    return res.status(503).json({
      error: 'Terra API not configured',
      setup: 'Sign up free at tryterra.co, get your Dev ID and API Key, then add TERRA_DEV_ID and TERRA_API_KEY to your Vercel environment variables.',
    });
  }

  const { reference_id = 'aug-dashboard-user' } = req.body ?? {};

  try {
    const response = await fetch('https://api.tryterra.co/v2/auth/generateWidgetSession', {
      method: 'POST',
      headers: {
        'dev-id': devId,
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providers: 'APPLE',
        language: 'en',
        reference_id: String(reference_id),
        show_disconnect: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message ?? 'Terra API error', detail: data });
    }

    res.json({ url: data.url, session_id: data.session_id });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
