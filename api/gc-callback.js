/**
 * GET /api/gc-callback
 * Handles the OAuth redirect from GoCardless after a user authorises
 * their bank. Bounces back to the Aug dashboard (local or web).
 *
 * GoCardless appends ?ref=<reference> to this URL. We pass the
 * return_url as an additional query parameter when building the
 * redirect URI in gc-link.js.
 */
const ALLOWED_RETURN_HOSTS = /^http:\/\/127\.0\.0\.1(:\d+)?$/;

export default function handler(req, res) {
  const raw = req.query.return_url || 'http://127.0.0.1:14986';
  let returnUrl;
  try {
    const u = new URL(raw);
    if (!ALLOWED_RETURN_HOSTS.test(u.origin)) {
      returnUrl = 'http://127.0.0.1:14986';
    } else {
      returnUrl = u.origin;
    }
  } catch {
    returnUrl = 'http://127.0.0.1:14986';
  }
  const dest = `${returnUrl}?gc_done=1`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Aug — bank connected</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      padding: 60px 40px; color: #111; max-width: 480px; margin: 0 auto;
      background: #fafafa;
    }
    h2 { margin-bottom: 0.4rem; font-weight: 600; }
    p { color: #666; line-height: 1.55; }
    .spinner { font-size: 2rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="spinner">✅</div>
  <h2>Bank authorised!</h2>
  <p>Returning to Aug — this window will close automatically.</p>
  <script>
    (function () {
      var dest = ${JSON.stringify(dest)};
      // If opened as a popup, tell the opener and close ourselves
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: 'gc_done' }, ${JSON.stringify(returnUrl)});
          window.close();
          return;
        } catch (e) {}
      }
      // Otherwise just navigate the current window back
      window.location.replace(dest);
    })();
  </script>
</body>
</html>`);
}
