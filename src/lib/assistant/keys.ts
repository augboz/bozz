// Where the user's API key lives. Desktop: the OS keychain through the Rust
// `secret_*` commands (never dashboard.json, which syncs to the cloud). Web:
// localStorage, which is the best a browser can do, with a warning in Settings.
import { isTauri } from '../platform';
import type { ProviderId } from './providers/types';

const account = (p: ProviderId) => `assistant:${p}`;
const webKey = (p: ProviderId) => `bozz:assistant-key:${p}`;

export async function getApiKey(p: ProviderId): Promise<string | null> {
  if (p === 'mock') return 'mock';
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    try { return (await invoke<string | null>('secret_get', { account: account(p) })) || null; } catch { return null; }
  }
  try { return localStorage.getItem(webKey(p)); } catch { return null; }
}

export async function setApiKey(p: ProviderId, key: string): Promise<void> {
  const value = key.trim();
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    if (value) await invoke('secret_set', { account: account(p), value });
    else await invoke('secret_delete', { account: account(p) });
    return;
  }
  try { if (value) localStorage.setItem(webKey(p), value); else localStorage.removeItem(webKey(p)); } catch { /* storage blocked */ }
}

export async function clearApiKey(p: ProviderId): Promise<void> {
  return setApiKey(p, '');
}
