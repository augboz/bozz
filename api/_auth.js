/**
 * Shared auth gate for the serverless endpoints.
 *
 * These functions wield server-side secrets (Google/Notion client secrets,
 * GoCardless keys, the Supabase service key). They must only run for a
 * signed-in Bozz user. The app sends its Supabase access token as
 * `Authorization: Bearer <jwt>`; we validate it against Supabase's
 * /auth/v1/user endpoint.
 *
 * Safety valve: if Supabase isn't configured in the environment at all, we
 * skip the check (return a sentinel) rather than hard-fail every request — a
 * misconfiguration should not take the whole backend down. When Supabase IS
 * configured (the normal case), auth is enforced.
 */

export async function requireUser(req) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.warn('[auth] Supabase not configured — skipping auth check');
    return { _unconfigured: true };
  }

  const header = req.headers.authorization || req.headers.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;

  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: key },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user && user.id ? user : null;
  } catch (e) {
    console.warn('[auth] validation error:', String(e));
    return null;
  }
}

/** Convenience: enforce auth and write the 401 response. Returns the user, or
 *  null if the caller should stop (response already sent). */
export async function authed(req, res) {
  const user = await requireUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return user;
}
