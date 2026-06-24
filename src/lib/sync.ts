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
import { getItem, setItem, deleteItem, listKeysByPrefix } from './storage';

/** All keys that are synced. Add new ones here when new state appears. */
export const SYNCED_KEYS = [
  'appearance', 'topics', 'topicFolders', 'inbox',
  'homeLayout', 'homeBackground',
  'calendarFeeds', 'calendarCache', 'calendarConnections', 'calendarNotes',
  'budget',
  'reviews', 'reviewSettings',
  'oauthAccounts', 'imapAccounts', 'emailsCache',
  'recentSearches',
  'notionWidget', 'spotifyAccount', 'waAccount',
  'dailyPlan',
  'habits',
  'healthConnections', 'healthDays',
  'sidebarCollapsed',
  'weatherLocation',
  // Bozz Plus — priority-alert settings are synced (small); the alert watch
  // state (notifiedIds) and the entitlement license are deliberately local-only.
  'priorityAlerts',
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
    // Write all keys to local storage in parallel for faster sign-in.
    await Promise.all(
      Object.entries(row.data ?? {})
        .filter(([, value]) => value !== undefined && value !== null)
        // SECURITY: never import OAuth token keys from the remote blob. Rows
        // written by older builds may still contain leaked access/refresh
        // tokens and client secrets; tokens belong only in the local app data
        // file, never in the synced Supabase row.
        .filter(([key]) => !key.startsWith('__tok__'))
        .map(async ([key, value]) => {
          try {
            await setItem(key, JSON.stringify(value));
          } catch (e) {
            console.error(`[sync] writing local ${key}:`, e);
          }
        })
    );
    return true;
  } catch (e) {
    console.error('[sync] pull failed:', e);
    return false;
  }
}

/** Read all synced keys from local storage and return as one object. */
export async function readLocalSnapshot(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  // Read all SYNCED_KEYS in parallel.
  const results = await Promise.all(
    SYNCED_KEYS.map(async key => {
      try {
        const r = await getItem(key);
        return r?.value ? { key, value: JSON.parse(r.value) } : null;
      } catch {
        return null;
      }
    })
  );
  for (const entry of results) {
    if (entry) out[entry.key] = entry.value;
  }

  // SECURITY: OAuth tokens (__tok__* keys — access/refresh tokens and client
  // secrets) are deliberately NOT collected for sync. Uploading them into the
  // Supabase row would put credentials at rest in a blob that is not end-to-end
  // encrypted. They stay only in the local app data file; users reconnect
  // integrations per device.

  // Sync per-widget photos (photo__* keys — one per Photo widget instance).
  try {
    const photoKeys = await listKeysByPrefix('photo__');
    await Promise.all(photoKeys.map(async key => {
      try {
        const r = await getItem(key);
        if (r?.value) out[key] = JSON.parse(r.value);
      } catch { /* ignore */ }
    }));
  } catch { /* ignore */ }

  return out;
}

/** Upload the current local snapshot to Supabase. Returns true on success. */
export async function pushSnapshot(userId: string): Promise<boolean> {
  try {
    const snapshot = await readLocalSnapshot();
    const { error } = await supabase
      .from('user_data')
      .upsert(
        { user_id: userId, data: snapshot, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
    if (error) {
      console.error('[sync] push error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[sync] push failed:', e);
    return false;
  }
}

/** Returns true if local storage has meaningful synced data (i.e. an unsync'd session exists). */
export async function hasLocalData(): Promise<boolean> {
  try {
    const snap = await readLocalSnapshot();
    return Object.keys(snap).length > 0;
  } catch {
    return false;
  }
}

/** Wipe all synced keys from local storage. Call on sign-out to prevent data leaking between users. */
export async function clearLocalSnapshot(): Promise<void> {
  // Cancel any pending debounced push so it doesn't fire after local storage
  // is cleared and accidentally upload an empty snapshot.
  cancelPendingPush();
  const deletes: Promise<void>[] = SYNCED_KEYS.map(k => deleteItem(k));
  try {
    const tokenKeys = await listKeysByPrefix('__tok__');
    tokenKeys.forEach(k => deletes.push(deleteItem(k)));
  } catch { /* ignore */ }
  try {
    const photoKeys = await listKeysByPrefix('photo__');
    photoKeys.forEach(k => deletes.push(deleteItem(k)));
  } catch { /* ignore */ }
  await Promise.all(deletes);
}

// ── Debounced push helper ────────────────────────────────────────────────
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const PUSH_DEBOUNCE_MS = 1500;

export function schedulePush(userId: string): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushSnapshot(userId);
  }, PUSH_DEBOUNCE_MS);
}

/** Cancel any pending debounced push (call before wiping local storage). */
export function cancelPendingPush(): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}
