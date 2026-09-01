import { createClient, type Session } from '@supabase/supabase-js';
import { platformFetch } from './http';
import { isTauri } from './platform';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

if (!url || !key) {
  // We don't crash — the app still works locally without sync. Auth screen
  // will show a clear message.
  console.warn('Supabase env vars missing — cloud sync disabled.');
}

/**
 * Auth storage, on desktop, lives in our own JSON store — NOT localStorage.
 *
 * WebView2 keeps localStorage in a LevelDB inside the EBWebView profile, and
 * when that profile goes bad it fails in the worst possible way: silently.
 * Reads hand back corrupted bytes (a token with non-Latin-1 characters, which
 * then makes every request throw inside the HTTP layer) and writes don't
 * persist (the PKCE verifier written at the start of a Google sign-in is gone
 * by the time the callback tries to read it, seconds later). Both symptoms hit
 * the same machine in Aug–Sep 2026, and no amount of app-level retrying can
 * fix storage that isn't storing.
 *
 * dashboard.json is the store the app already trusts with the user's actual
 * data: a plain file, written and fsync'd per key, with dated backups and a
 * health gate. Auth belongs there too. On web there's no such file, so the
 * default localStorage behaviour stays.
 */
function tauriAuthStorage() {
  const PREFIX = 'sbauth__';
  return {
    async getItem(k: string): Promise<string | null> {
      const { getItem } = await import('./storage');
      const r = await getItem(PREFIX + k);
      return r?.value ?? null;
    },
    async setItem(k: string, v: string): Promise<void> {
      const { setItem } = await import('./storage');
      await setItem(PREFIX + k, v);
    },
    async removeItem(k: string): Promise<void> {
      const { deleteItem } = await import('./storage');
      await deleteItem(PREFIX + k);
    },
  };
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      ...(isTauri() ? { storage: tauriAuthStorage() } : {}),
    },
    global: {
      // WebView2 blocks cross-origin window.fetch; route through Tauri's HTTP plugin instead.
      fetch: isTauri() ? (platformFetch as typeof globalThis.fetch) : globalThis.fetch,
    },
  },
);

export const isSupabaseConfigured = (): boolean => Boolean(url && key);

// A JWT is three base64url segments — letters, digits, '-', '_', '.' only.
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * True if a session's tokens are well-formed enough to build an HTTP request
 * from. A corrupted access_token (non-ASCII bytes, truncation, concatenation)
 * can't be caught by retrying — the token doesn't change between attempts —
 * so callers should use this to detect the case and force a clean re-login
 * instead of retrying forever.
 *
 * Found 2026-08-10: a race in the (now-fixed) OAuth callback handler could
 * write a malformed access_token to persisted storage. The write-side bug is
 * gone, but a token it already wrote survives an app update, and the browser's
 * fetch Headers API throws "String contains non ISO-8859-1 code point" the
 * moment anything tries to build an Authorization header from it — surfacing
 * everywhere as a generic-looking upload failure.
 */
export function isSessionUsable(session: Session | null): boolean {
  if (!session) return false;
  if (!JWT_SHAPE.test(session.access_token)) return false;
  // The refresh token is opaque (no fixed shape), so only rule out what can
  // never be valid: a non-string, or bytes that can't survive being sent.
  const refresh = session.refresh_token;
  if (typeof refresh !== 'string' || refresh.length === 0) return false;
  for (let i = 0; i < refresh.length; i++) {
    if (refresh.charCodeAt(i) > 255) return false;
  }
  return true;
}

export type { Session };
