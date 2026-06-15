/**
 * Cross-platform fetch wrapper.
 * On Tauri (desktop) we use the Tauri HTTP plugin so requests bypass the
 * webview's CORS/CSP restrictions.
 * On web (PWA) we fall back to the native browser fetch.
 */
import { isTauri } from './platform';

export async function platformFetch(url: string, options?: RequestInit): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(url, options);
  }
  return fetch(url, options);
}
