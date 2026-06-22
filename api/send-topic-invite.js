/**
 * POST /api/send-topic-invite
 * Sends a topic sharing invitation email via Resend.
 *
 * Body: { inviteUrl, invitedEmail, ownerEmail, topicName }
 * Response:
 *   { ok: true }                               — email sent
 *   { ok: false, reason: 'no-email', inviteUrl } — Resend not configured, return URL for manual copy
 *
 * Setup: Sign up free at resend.com → API Keys → create key
 * Add RESEND_API_KEY to Vercel environment variables.
 * In Resend, verify a sending domain or use the sandbox (resend.dev) for testing.
 */
import { authed } from './_auth.js';

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');
  if (!(await authed(req, res))) return;

  const { inviteUrl, invitedEmail, ownerEmail, topicName } = req.body ?? {};
  if (!inviteUrl || !invitedEmail) return res.status(400).json({ error: 'Missing fields' });

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Resend not configured — caller will show the link for manual sharing
    return res.json({ ok: false, reason: 'no-email', inviteUrl });
  }

  const ownerName = escHtml(ownerEmail?.split('@')[0] ?? 'Someone');
  const topicLabel = topicName ? `"${topicName}"` : 'a topic';
  const safeTopicName = escHtml(topicName ?? 'a topic');
  // inviteUrl must be an https URL pointing to our own Vercel deployment
  let safeInviteUrl;
  try {
    const u = new URL(inviteUrl);
    if (u.protocol !== 'https:') throw new Error('not https');
    safeInviteUrl = u.href;
  } catch {
    return res.status(400).json({ error: 'Invalid inviteUrl' });
  }
  const safeInvitedEmail = escHtml(invitedEmail);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; padding: 0; background: #f5f0e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrap { max-width: 520px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
  .header { background: linear-gradient(135deg, #6b7dbe 0%, #9b7dbe 100%); padding: 32px 36px 28px; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #fff; letter-spacing: -0.3px; }
  .header p  { margin: 6px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; }
  .body { padding: 32px 36px; }
  .msg { font-size: 16px; color: #333; line-height: 1.6; margin: 0 0 24px; }
  .topic-pill { display: inline-block; background: #f0edf8; color: #6b4cb8; border-radius: 8px; padding: 4px 12px; font-size: 15px; font-weight: 600; margin-bottom: 28px; }
  .cta { display: block; background: linear-gradient(135deg, #6b7dbe 0%, #9b7dbe 100%); color: #fff !important; text-decoration: none; border-radius: 10px; padding: 14px 28px; text-align: center; font-size: 16px; font-weight: 600; margin-bottom: 14px; }
  .decline { display: block; color: #999; text-align: center; font-size: 13px; text-decoration: none; margin-bottom: 28px; }
  .footer { border-top: 1px solid #f0ece4; padding: 20px 36px; font-size: 12px; color: #aaa; line-height: 1.5; }
  .link-copy { background: #f9f6f0; border-radius: 8px; padding: 10px 14px; font-size: 11px; color: #888; word-break: break-all; margin-top: 20px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Aug Dashboard</h1>
    <p>Shared topic invitation</p>
  </div>
  <div class="body">
    <p class="msg">Hi there 👋<br><br>
    <strong>${ownerName}</strong> wants to share the topic</p>
    <div class="topic-pill">📋 ${safeTopicName}</div>
    <p class="msg" style="margin-top:0">with you on Aug Dashboard. Once you accept, you'll both see the same tasks in real time — anything either of you adds or changes will instantly appear for the other.</p>
    <a href="${escHtml(safeInviteUrl)}&amp;action=accept" class="cta">✅ Accept invitation</a>
    <a href="${escHtml(safeInviteUrl)}&amp;action=deny" class="decline">No thanks, decline</a>
    <div class="link-copy">Or paste this link into your Aug Dashboard:<br>${escHtml(safeInviteUrl)}</div>
  </div>
  <div class="footer">
    This invite was sent to ${safeInvitedEmail}. If you weren't expecting this, you can safely ignore it.
  </div>
</div>
</body>
</html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Aug Dashboard <noreply@resend.dev>',
        to: invitedEmail,
        subject: `${ownerEmail?.split('@')[0] ?? 'Someone'} wants to share ${topicLabel} with you`,
        html,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: data?.message ?? 'Resend error', detail: data });
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
