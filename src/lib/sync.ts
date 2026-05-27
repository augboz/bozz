/**
 * Sync layer — bidirectional sync between local Tauri store and Supabase.
 *
 * Strategy: single-row-per-user `user_data` table holding one big JSON blob.
 * Last-write-wins; we send the entire snapshot on every push (debounced).
 * Pulls happen on app start and after sign-in.
 *
 * The JSON keys mirror the local storage keys, so the load logic can stay
 * untouched — pulled values get written into the same per-key local store
 * before the app reads them.
 */

import { supabase } from './supabase';
import { getItem, setItem } from './storage';

/** All keys that are synced. Add new ones here when new state appears. */
export const SYNCED_KEYS = [
  'appearance', 'topics', 'inbox',
  'musicItems', 'lifeItems', 'cvItems', 'otherItems', 'applications',
  'taskSortPrefs', 'homeLayout',
  'calendarFeeds', 'calendarCache',
  'budget',
  'reviews', 'reviewSettings',
  'oauthAccounts', 'emailsCache',
  'recentSearches',
] as const;

export type SyncedKey = typeof SYNCED_KEYS[number];

interface RemoteRow {
  data: Record<string, unknown>;
  updated_at: string;
}

/**
 * Pull the user's row from Supabase and write every key into local storage.
 * Returns true if the pull found a row and wrote anything.
 */
export async function pullSnapshot(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[sync] pull error:', error);
      return false;
    }
    if (!data) return false; // first sign-in for this account
    const row = data as RemoteRow;
    for (const [key, value] of Object.entries(row.data ?? {})) {
      if (value === undefined || value === null) continue;
      try {
        await setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error(`[sync] writing local ${key}:`, e);
      }
    }
    return true;
  } catch (e) {
    console.error('[sync] pull failed:', e);
    return false;
  }
}

/** Read all synced keys from local storage and return as one object. */
export async function readLocalSnapshot(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const key of SYNCED_KEYS) {
    try {
      const r = await getItem(key);
      if (r?.value) {
        out[key] = JSON.parse(r.value);
      }
    } catch {
      /* ignore individual key errors */
    }
  }
  return out;
}

/** Upload the current local snapshot to Supabase. */
export async function pushSnapshot(userId: string): Promise<void> {
  try {
    const snapshot = await readLocalSnapshot();
    const { error } = await supabase
      .from('user_data')
      .upsert(
        { user_id: userId, data: snapshot, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) console.error('[sync] push error:', error);
  } catch (e) {
    console.error('[sync] push failed:', e);
  }
}

// ── Debounced push helper ────────────────────────────────────────────────
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const PUSH_DEBOUNCE_MS = 1500;

export function schedulePush(userId: string): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void pushSnapshot(userId);
  }, PUSH_DEBOUNCE_MS);
}
