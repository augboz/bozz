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
}

async function getTauriStore(): Promise<TauriStoreAPI> {
  if (!_tauriStorePromise) {
    _tauriStorePromise = (async () => {
      const mod = await import('@tauri-apps/plugin-store');
      const store = await mod.load('dashboard.json', { defaults: {}, autoSave: 500 });
      return store as unknown as TauriStoreAPI;
    })();
  }
  return _tauriStorePromise;
}

// ── Web backend (IndexedDB) ────────────────────────────────────────────────

const DB_NAME = 'aug-dashboard';
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
      const s = await getTauriStore();
      await s.set(key, value);
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
      const s = await getTauriStore();
      await s.delete(key);
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
      await invoke('create_backup', { date: today });
      await setItem('_last_backup_date', today);
    }
  } catch (e) {
    console.error('Backup error:', e);
  }
}
