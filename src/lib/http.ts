/**
 * Cross-platform fetch wrapper.
 * On Tauri (desktop) we use the Tauri HTTP plugin so requests bypass the
 * webview's CORS/CSP restrictions.
 * On web (PWA) we fall back to the native browser fetch.
 */
import { isTauri } from './platform';

/**
 * Thrown when an outgoing request carries credentials that cannot legally be
 * put in an HTTP header. Callers treat this as "signed out", never as a
 * network blip: it is not retryable, because the stored value never changes.
 */
export class CorruptAuthHeaderError extends Error {
  constructor(detail: string) {
    super(`stored sign-in is corrupted (${detail})`);
    this.name = 'CorruptAuthHeaderError';
  }
}

/** HTTP headers are Latin-1; anything above U+00FF makes Headers.set() throw. */
function firstNonLatin1(value: string): { char: string; index: number } | null {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 255) return { char: value[i], index: i };
  }
  return null;
}

function headerEntries(headers: HeadersInit): Array<[string, string]> {
  if (typeof Headers !== 'undefined' && headers instanceof Headers) return [...headers.entries()];
  if (Array.isArray(headers)) return headers.map(([k, v]) => [k, String(v)]);
  return Object.entries(headers as Record<string, string>).map(([k, v]) => [k, String(v)]);
}

/**
 * Fail fast, and legibly, on a request we know the platform cannot send.
 *
 * A corrupted access token (see isSessionUsable in lib/supabase.ts) surfaces
 * deep inside the HTTP layer as "Failed to execute 'set' on 'Headers': String
 * contains non ISO-8859-1 code point" — an error that names neither the header
 * nor the cause, and that every retry reproduces exactly. It cost days of
 * chasing "sync is broken" in Aug 2026. Catching it here means any request
 * path, on any build, converts it into a clear signed-out state the app can
 * actually recover from, instead of an opaque failure loop.
 */
function assertSendableHeaders(options?: RequestInit): void {
  if (!options?.headers) return;
  for (const [name, value] of headerEntries(options.headers)) {
    const bad = firstNonLatin1(value);
    if (!bad) continue;
    const where = `${name} header, position ${bad.index}`;
    if (name.toLowerCase() === 'authorization') throw new CorruptAuthHeaderError(where);
    throw new TypeError(`Request header cannot be sent: non Latin-1 character in ${where}`);
  }
}

export async function platformFetch(url: string, options?: RequestInit): Promise<Response> {
  assertSendableHeaders(options);
  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    return tauriFetch(url, options);
  }
  return fetch(url, options);
}
