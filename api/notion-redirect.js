/**
 * Vercel serverless function — Notion OAuth redirect bridge.
 *
 * Notion requires HTTPS redirect URIs. This function receives the callback
 * from Notion (HTTPS) and bounces the user back to the local app (HTTP
 * loopback). Browsers allow HTTPS → http://127.0.0.1 redirects.
 *
 * Deploy: npx vercel --prod  (free tier, one-time setup)
 * Then add https://<your-url>/api/notion-redirect to Notion's redirect URIs.
 */
export default function handler(req, res) {
  // Re-serialise query params so they survive the round-trip cleanly.
  const qs = Object.entries(req.query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Aug Dashboard — connecting…</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 60px 40px;
           color: #333; max-width: 480px; margin: 0 auto; }
    h2   { margin-bottom: 0.4rem; }
    p    { color: #666; }
  </style>
</head>
<body>
  <h2>Connected!</h2>
  <p>Returning to Aug Dashboard — you can close this tab.</p>
  <script>
    window.location.replace('http://127.0.0.1:14986/?' + ${JSON.stringify(qs)});
  </script>
</body>
</html>`);
}
