// Favicon fetching + caching.
//
// We fetch a link's site icon ONCE (via the Tauri HTTP plugin on desktop, which
// bypasses the webview's CORS/CSP), encode it as a data URL, and the caller
// stores it on the link. After that the logo renders offline with no network at
// all. Sources are ordered best-first and chosen so we never fall back to the
// generic grey "globe" placeholder: DuckDuckGo 404s for unknown domains (we skip
// it), and Google's faviconV2 with fallback_opt returns a generated letter tile
// rather than a globe.

import { platformFetch } from './http';

function hostOf(url: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
}

function sources(host: string): string[] {
  return [
    `https://icons.duckduckgo.com/ip3/${host}.ico`,
    `https://t1.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opt=TRUE&url=https://${host}&size=256`,
  ];
}

function bytesToDataUrl(buf: ArrayBuffer, contentType: string): string {
  const arr = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < arr.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(arr.subarray(i, i + CHUNK)));
  }
  const type = /^image\//.test(contentType) ? contentType : 'image/png';
  return `data:${type};base64,${btoa(bin)}`;
}

/**
 * Fetch a site's favicon and return it as a data URL, or null if none resolved.
 * Tries each source in order and returns the first real image. Small responses
 * (< 70 bytes) are treated as empty/placeholder and skipped.
 */
export async function fetchFaviconDataUrl(url: string): Promise<string | null> {
  const host = hostOf(url);
  if (!host) return null;
  for (const src of sources(host)) {
    try {
      const res = await platformFetch(src);
      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (ct && !/image/i.test(ct)) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 70) continue;
      return bytesToDataUrl(buf, ct);
    } catch {
      /* try next source */
    }
  }
  return null;
}
