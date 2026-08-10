// Cross-platform key/value storage.
//
// On Tauri (desktop), backed by tauri-plugin-store which persists JSON to
// `dashboard.json` under the OS app-data dir.
//
// On the web (PWA), backed by IndexedDB via a tiny custom wrapper — we use
// IDB rather than localStorage so we're not capped at ~5MB and so writes
// are async like the Tauri equivalent.

import { isTauri } from './platform';

// ── Tauri backend ──────────────────────────────────────────────────────────

let _tauriStorePromise: Promise<TauriStoreAPI> | null = null;

interface TauriStoreAPI {
  get<T>(key: string): Promise<T | null | undefined>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  save(): Promise<void>;
}

async function getTauriStore(): Promise<TauriStoreAPI> {
  if (!_tauriStorePromise) {
    _tauriStorePromise = (async () => {
      const mod = await import('@tauri-apps/plugin-store');
      // autoSave is a debounced background flush — it's a backstop, not the
      // primary persistence path. Every write below calls save() explicitly
      // so a write survives even if the app exits/crashes within the
      // debounce window (this previously caused saved OAuth tokens to
      // outlive their account metadata, since the metadata write landed in
      // a debounce window that never got to flush).
      const store = await mod.load('dashboard.json', { defaults: {}, autoSave: 500 });
      return store as unknown as TauriStoreAPI;
    })();
  }
  return _tauriStorePromise;
}

// ── Web backend (IndexedDB) ────────────────────────────────────────────────

const DB_NAME = 'bozz';
const DB_STORE = 'kv';
const DB_VERSION = 1;

let _dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return _dbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbListKeys(prefix?: string): Promise<string[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as string[]);
      resolve(prefix ? keys.filter(k => k.startsWith(prefix)) : keys);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Store health ───────────────────────────────────────────────────────────

/**
 * Guard against a failed store load masquerading as an empty store.
 *
 * tauri-plugin-store reads `dashboard.json` once at load and then serves every
 * read from memory. If that load fails (unparseable or oversized file), every
 * getItem() returns null and the very first setItem() serialises the empty
 * in-memory state straight over the file. That is how a 22MB store with six
 * topics became 1.5KB between 2026-07-15 and 2026-07-28, and it is upstream of
 * the sync clobber: an app that believes it has no data pushes that emptiness
 * to Supabase and the other device pulls it.
 *
 * So: if the plugin reports zero keys but a substantial file exists on disk,
 * the load failed. Refuse every write until the app is restarted, and say so.
 * A genuine first run has no file at all, so it reads as healthy.
 */
const EMPTY_STORE_MAX_BYTES = 4096;

let _healthPromise: Promise<boolean> | null = null;

async function computeStoreHealth(): Promise<boolean> {
  if (!isTauri()) return true;
  try {
    const s = await getTauriStore();
    const withKeys = s as unknown as { keys?: () => Promise<string[]> };
    if (typeof withKeys.keys !== 'function') return true;
    const keys = await withKeys.keys();
    if (keys.length > 0) return true;

    const { invoke } = await import('@tauri-apps/api/core');
    const bytes = await invoke<number>('store_file_size');
    if (bytes > EMPTY_STORE_MAX_BYTES) {
      console.error(
        `[storage] store loaded 0 keys but dashboard.json is ${bytes} bytes — ` +
        'treating this as a failed load and blocking all writes.',
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bozz:store-unhealthy', { detail: { bytes } }));
      }
      return false;
    }
    return true;
  } catch {
    // Never let the health check itself lock the user out of their own app.
    return true;
  }
}

/** True when it is safe to write to the local store. Cached for the session. */
export function isStoreHealthy(): Promise<boolean> {
  if (!_healthPromise) _healthPromise = computeStoreHealth();
  return _healthPromise;
}

// ── Public API (same shape on both platforms) ──────────────────────────────

export async function getItem(key: string): Promise<{ value: string } | null> {
  try {
    if (isTauri()) {
      const s = await getTauriStore();
      const raw = await s.get<string>(key);
      if (raw === null || raw === undefined) return null;
      return { value: raw };
    }
    const raw = await idbGet(key);
    if (raw == null) return null;
    return { value: raw };
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (isTauri()) {
      // A write on top of a failed load is how the store gets truncated.
      if (!(await isStoreHealthy())) return;
      const s = await getTauriStore();
      await s.set(key, value);
      await s.save();
    } else {
      await idbSet(key, value);
    }
  } catch (e) {
    console.error('Storage error:', e);
  }
}

/** List all storage keys with the given prefix. */
export async function listKeysByPrefix(prefix: string): Promise<string[]> {
  try {
    if (isTauri()) {
      // Tauri store exposes keys() on the store instance
      const s = await getTauriStore();
      const store = s as unknown as { keys(): Promise<string[]> };
      if (typeof store.keys === 'function') {
        const all = await store.keys();
        return all.filter((k: string) => k.startsWith(prefix));
      }
      return [];
    }
    return idbListKeys(prefix);
  } catch {
    return [];
  }
}

export async function deleteItem(key: string): Promise<void> {
  try {
    if (isTauri()) {
      if (!(await isStoreHealthy())) return;
      const s = await getTauriStore();
      await s.delete(key);
      await s.save();
    } else {
      await idbDelete(key);
    }
  } catch (e) {
    console.error('Storage error:', e);
  }
}

/**
 * Calls the Rust `create_backup` command if we haven't backed up today.
 * No-op on the web — backup is meaningful only for the local-file Tauri
 * store. The Supabase sync layer (Phase 2) will replace this.
 */
export async function initBackup(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const today = new Date().toISOString().slice(0, 10);
    const result = await getItem('_last_backup_date');
    if (result?.value !== today) {
      // Returns true if a backup file was actually written; false if the store
      // file didn't exist yet (first launch). Only mark done when written so
      // a subsequent launch on the same day will back up real data.
      const created = await invoke<boolean>('create_backup', { date: today });
      if (created) {
        await setItem('_last_backup_date', today);
      }
    }
  } catch (e) {
    console.error('Backup error:', e);
  }
}
