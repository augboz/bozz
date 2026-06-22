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

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    global: {
      // WebView2 blocks cross-origin window.fetch; route through Tauri's HTTP plugin instead.
      fetch: isTauri() ? (platformFetch as typeof globalThis.fetch) : globalThis.fetch,
    },
  },
);

export const isSupabaseConfigured = (): boolean => Boolean(url && key);

export type { Session };
