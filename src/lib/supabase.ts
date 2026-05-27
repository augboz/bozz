import { createClient, type Session } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

if (!url || !key) {
  // We don't crash — the app still works locally without sync. Auth screen
  // will show a clear message.
  console.warn('Supabase env vars missing — cloud sync disabled.');
}

export const supabase = createClient(url ?? '', key ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // handles ?code= from magic-link / OAuth callbacks
  },
});

export const isSupabaseConfigured = (): boolean => Boolean(url && key);

export type { Session };
