import React from "react";
import ReactDOM from "react-dom/client";

// WebView2 throws "non ISO-8859-1 code point" for any header value with code
// point > 0xFF. Patch Request and Headers early so library code (Supabase-js,
// @tauri-apps/plugin-http) doesn't crash when constructing requests.
if (typeof window.__TAURI_INTERNALS__ !== 'undefined') {
  const _Req  = window.Request;
  const _Hdrs = window.Headers;
  const safe  = (s: string) => s.replace(/[^\x00-\xFF]/g, '');
  const sanitiseInit = (init?: RequestInit): RequestInit | undefined => {
    if (!init?.headers) return init;
    const h = init.headers;
    const out: Record<string, string> = {};
    if (h instanceof _Hdrs) { (h as Headers).forEach((v, k) => { out[k] = safe(v); }); }
    else if (Array.isArray(h)) { (h as [string,string][]).forEach(([k,v]) => { out[k] = safe(v); }); }
    else { Object.entries(h as Record<string,string>).forEach(([k,v]) => { out[k] = safe(v); }); }
    return { ...init, headers: out };
  };
  // @ts-ignore patching globals
  window.Headers = class extends _Hdrs {
    constructor(init?: HeadersInit) {
      if (init && !(init instanceof _Hdrs)) {
        const out: Record<string, string> = {};
        const entries = Array.isArray(init) ? init : Object.entries(init as Record<string,string>);
        (entries as [string,string][]).forEach(([k,v]) => { out[k] = safe(String(v)); });
        super(out); return;
      }
      super(init as undefined);
    }
    set(k: string, v: string) { super.set(k, safe(v)); }
    append(k: string, v: string) { super.append(k, safe(v)); }
  };
  // @ts-ignore patching globals
  window.Request = class extends _Req {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, sanitiseInit(init)); }
  };
}

// OAuth popup callback handler — must run before React mounts.
// When the OAuth provider redirects the popup to /callback?code=..., this
// forwards the params to the opener and closes the popup immediately,
// so React never needs to render in the popup window.
if (window.opener && window.location.pathname === '/callback') {
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  // Use '*' as targetOrigin — the opener may be on localhost while the popup
  // is on 127.0.0.1 (Spotify bans localhost, requires 127.0.0.1). Safe for
  // local dev; the receiver checks data.type to accept only known messages.
  window.opener.postMessage({ type: 'oauth_callback', params }, '*');
  window.close();
  throw new Error('oauth_callback_handled');
}
// Bundled offline fonts (no external CDN). Variable = all weights in one file.
import "@fontsource-variable/geist";
import "@fontsource-variable/syne";
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@fontsource-variable/quicksand";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/fraunces";
import "react-grid-layout/css/styles.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
