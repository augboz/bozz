/**
 * GET /api/topic-invite?token=<token>&action=accept|deny
 *
 * For "deny": marks the invite as denied and shows a confirmation page.
 * For "accept": redirects the user to the Aug dashboard with the token
 *               so they can confirm inside the app (requires being logged in).
 *
 * Uses the Supabase service key to bypass RLS for the deny case.
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const { token, action } = req.query;

  if (!token) {
    return res.status(400).send('Missing invite token');
  }

  // For deny: update in DB and show a simple page
  if (action === 'deny') {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase
        .from('topic_members')
        .update({ status: 'denied' })
        .eq('invite_token', token);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Aug — Invitation declined</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         padding: 60px 40px; max-width: 480px; margin: 0 auto; color: #333; background: #f5f0e8; }
  .card { background: #fff; border-radius: 16px; padding: 36px; text-align: center; box-shadow: 0 2px 16px rgba(0,0,0,0.06); }
  h2 { margin: 0 0 0.5rem; font-size: 20px; }
  p { color: #888; line-height: 1.55; }
</style>
</head>
<body>
<div class="card">
  <div style="font-size:2.5rem;margin-bottom:1rem">👋</div>
  <h2>Invitation declined</h2>
  <p>You've declined this topic invitation. The person who invited you will be notified.</p>
</div>
</body>
</html>`);
  }

  // For accept (or no action): bounce to the local dashboard with the token
  const returnUrl = 'http://127.0.0.1:14986';
  const dest = `${returnUrl}?accept_invite=${encodeURIComponent(token)}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Aug — Opening invitation…</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         padding: 60px 40px; max-width: 480px; margin: 0 auto; color: #333; background: #f5f0e8; }
  .card { background: #fff; border-radius: 16px; padding: 36px; text-align: center; box-shadow: 0 2px 16px rgba(0,0,0,0.06); }
  h2 { margin: 0 0 0.5rem; font-size: 20px; }
  p { color: #888; line-height: 1.55; }
</style>
</head>
<body>
<div class="card">
  <div style="font-size:2.5rem;margin-bottom:1rem">🔗</div>
  <h2>Opening Aug Dashboard…</h2>
  <p>If Aug doesn't open automatically, make sure it's running and <a href="${dest}">click here</a>.</p>
</div>
<script>
  window.location.replace(${JSON.stringify(dest)});
</script>
</body>
</html>`);
}
