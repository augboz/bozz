/**
 * apiFetch — call one of our own /api/* serverless endpoints with the signed-in
 * user's Supabase access token attached. The backend (api/_auth.js) requires it,
 * since those endpoints wield server-side secrets. Use this instead of
 * platformFetch for any call to our Vercel API.
 */
import { supabase } from './supabase';
import { platformFetch } from './http';

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  let token: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch { /* not signed in — request will get a 401 */ }
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return platformFetch(url, { ...init, headers });
}
