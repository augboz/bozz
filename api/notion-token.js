/**
 * Server-side Notion OAuth token proxy.
 * Keeps NOTION_CLIENT_SECRET off the client binary entirely.
 *
 * POST body (JSON): { code, redirect_uri }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const clientId     = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).json({ error: 'Server not configured' });

  const { code, redirect_uri } = req.body ?? {};
  if (!code || !redirect_uri)
    return res.status(400).json({ error: 'Missing code or redirect_uri' });

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const r = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri }),
  });

  const data = await r.json();
  return res.status(r.status).json(data);
}
