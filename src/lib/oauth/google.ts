/**
 * Generic Google OAuth PKCE helper — used for Google Calendar and Google Fit.
 * Token exchange is proxied through /api/google-token (server-side) so the
 * Google client secret never lives in the app binary.
 */

import { platformFetch } from '../http';
import { isTauri } from '../platform';
import { pkceChallenge, randomString } from './pkce';
import { secretSet } from './keyring';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? 'https://life-bozz.vercel.app';

export interface GoogleTokenResult {
  accessToken: string;
  refreshToken: string | null;
  email: string;
}

export async function connectGoogle(
  clientId: string,
  scopes: string[],
  storageKey: string,   // e.g. 'gcal:access' — used to persist tokens in keyring
): Promise<GoogleTokenResult> {
  const verifier  = randomString(64);
  const challenge = await pkceChallenge(verifier);
  const state     = randomString(24);

  const buildAuthUrl = (redirectUri: string) =>
    'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: [...scopes, 'https://www.googleapis.com/auth/userinfo.email'].join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    }).toString();

  let params: Record<string, string>;
  let redirectUri: string;

  if (isTauri()) {
    // ── Desktop (Tauri): TCP server + system browser ────────────────────────
    // Opening auth in a WebView2 popup causes Google to detect the embedded
    // browser and route sign-in through Edge, where our popup can't intercept
    // the redirect. Instead we open the URL in the user's real browser and let
    // a local TCP server catch the callback — the standard desktop OAuth flow.
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');
    const { open } = await import('@tauri-apps/plugin-opener');

    let deepResolve: ((p: Record<string, string>) => void) | null = null;
    let deepReject: ((e: Error) => void) | null = null;

    const paramsPromise = new Promise<Record<string, string>>((res, rej) => {
      deepResolve = res;
      deepReject = rej;
    });

    const unlisten = await listen<string>('oauth:callback', (e) => {
      try {
        const url = new URL(e.payload);
        const p: Record<string, string> = {};
        url.searchParams.forEach((v, k) => { p[k] = v; });
        deepResolve?.(p);
      } catch (err) {
        deepReject?.(err instanceof Error ? err : new Error(String(err)));
      }
    });

    const timeout = setTimeout(
      () => deepReject?.(new Error('Sign in timed out')),
      300_000,
    );

    try {
      const tcpPort = await invoke<number>('start_oauth_server', { port: 14987 })
        .catch(() => 14987);
      redirectUri = `http://127.0.0.1:${tcpPort}`;

      // Open in the user's real browser — no WebView2 detection issues.
      await open(buildAuthUrl(redirectUri));
      params = await paramsPromise;
    } finally {
      clearTimeout(timeout);
      unlisten();
    }

  } else {
    // ── Browser: popup window + postMessage from /callback ─────────────────
    const port = window.location.port || '80';
    redirectUri = `http://127.0.0.1:${port}/callback`;

    params = await new Promise<Record<string, string>>((resolve, reject) => {
      const popup = window.open(buildAuthUrl(redirectUri), 'google_oauth', 'width=520,height=660,left=200,top=100');
      if (!popup) {
        reject(new Error('Popup was blocked — please allow popups for this page and try again.'));
        return;
      }
      let done = false;
      const onMessage = (e: MessageEvent) => {
        const allowed = new Set([window.location.origin, `http://127.0.0.1:${port}`]);
        if (!allowed.has(e.origin)) return;
        if (e.data?.type !== 'oauth_callback') return;
        done = true;
        window.removeEventListener('message', onMessage);
        clearInterval(closedPoll);
        resolve(e.data.params as Record<string, string>);
      };
      window.addEventListener('message', onMessage);
      const closedPoll = setInterval(() => {
        if (popup.closed && !done) {
          clearInterval(closedPoll);
          window.removeEventListener('message', onMessage);
          reject(new Error('OAuth popup was closed before completing sign-in.'));
        }
      }, 500);
      setTimeout(() => {
        if (done) return;
        clearInterval(closedPoll);
        window.removeEventListener('message', onMessage);
        if (!popup.closed) popup.close();
        reject(new Error('OAuth timed out — no response after 5 minutes.'));
      }, 5 * 60 * 1000);
    });
  }

  if (params.error) throw new Error(`Google OAuth error: ${params.error}`);
  if (!params.code) throw new Error('Google returned no code');
  if (params.state !== state) throw new Error('State mismatch');

  // Exchange code → tokens via server proxy (secret stays server-side)
  const tokenRes = await platformFetch(`${API_BASE}/api/google-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'exchange',
      code: params.code,
      client_id: clientId,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
  const json = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
  if (!json.access_token) throw new Error('No access_token in response');

  // Fetch profile email
  const profileRes = await platformFetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  const profile = (await profileRes.json()) as { email?: string };
  const email = profile.email ?? 'unknown';

  // Persist tokens
  await secretSet(storageKey + ':access', json.access_token);
  if (json.refresh_token) await secretSet(storageKey + ':refresh', json.refresh_token);

  return { accessToken: json.access_token, refreshToken: json.refresh_token ?? null, email };
}
