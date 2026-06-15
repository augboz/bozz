import React from "react";
import ReactDOM from "react-dom/client";

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
