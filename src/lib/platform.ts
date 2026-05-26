// Platform detection — used to gate features that only exist in the Tauri
// desktop build (tray, global shortcuts, OAuth loopback, Rust commands) so
// the same React codebase can also ship as a web PWA without crashing.

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

/** True when running inside the Tauri desktop build. */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  // Tauri v2 sets __TAURI_INTERNALS__ on window. Older bundles set __TAURI__.
  return Boolean(window.__TAURI_INTERNALS__ ?? window.__TAURI__);
}

/** True when running in a browser / PWA — i.e. NOT inside Tauri. */
export function isWeb(): boolean {
  return !isTauri();
}

/** Detect a coarse mobile / small-screen layout. Used to swap to bottom-nav. */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

/** True when running on macOS — used to hide custom window controls
 *  (traffic lights stay in their native overlay position via titleBarStyle). */
export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.platform) && !/iphone|ipad/i.test(navigator.userAgent);
}
