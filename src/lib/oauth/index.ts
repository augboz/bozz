import { platformFetch } from '../http';
import { apiFetch } from '../apiClient';
import { isTauri } from '../platform';
import type { EmailProvider, OAuthAccount } from '../types';
import { pkceChallenge, randomString } from './pkce';
import { secretSet, tokenKey } from './keyring';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? 'https://bozz-app.vercel.app';


export interface ProviderConfig {
  provider: EmailProvider;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Google requires client_secret; Microsoft public clients don't. */
  usesClientSecret: boolean;
  /** Extra params on the auth URL (e.g. access_type=offline for Google). */
  extraAuthParams?: Record<string, string>;
  /** Fetches the user's email address with a fresh access token. */
  identify: (accessToken: string) => Promise<string>;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

/**
 * Browser-based OAuth via popup + postMessage.
 * The popup redirects to /callback, main.tsx forwards params via postMessage and
 * closes itself — React never mounts in the popup.
 * redirect_uri to register: <origin>/callback  e.g. http://localhost:5173/callback
 */
/**
 * Build the loopback redirect URI using 127.0.0.1 (not localhost).
 * Spotify (and other providers following IETF rules) ban "localhost" and
 * require an explicit IPv4/IPv6 loopback literal.
 */
function loopbackRedirectUri(): string {
  const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
  return `http://127.0.0.1:${port}/callback`;
}

async function browserOAuthFlow(
  authUrl: string,
): Promise<{ params: Record<string, string>; redirectUri: string }> {
  const redirectUri = loopbackRedirectUri();

  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, 'oauth_popup', 'width=520,height=660,left=200,top=100');
    if (!popup) {
      reject(new Error('Popup was blocked — please allow popups for this page and try again.'));
      return;
    }

    let done = false;

    const onMessage = (e: MessageEvent) => {
      // Accept messages from our own origin or from the 127.0.0.1 loopback
      // variant (Spotify requires 127.0.0.1; opener may still be localhost).
      const port = window.location.port || '80';
      const allowed = new Set([window.location.origin, `http://127.0.0.1:${port}`]);
      if (!allowed.has(e.origin)) return;
      if (e.data?.type !== 'oauth_callback') return;
      done = true;
      window.removeEventListener('message', onMessage);
      clearInterval(closedPoll);
      resolve({ params: e.data.params as Record<string, string>, redirectUri });
    };
    window.addEventListener('message', onMessage);

    // Also watch for the user closing the popup manually
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

/** Run a full PKCE OAuth flow and persist tokens. Returns the new account. */
export async function connectProvider(
  cfg: ProviderConfig,
  clientId: string,
  clientSecret = '',    // kept for non-Google public clients (e.g. Outlook); Google uses server proxy
): Promise<OAuthAccount> {
  const verifier = randomString(64);
  const challenge = await pkceChallenge(verifier);
  const state = randomString(24);

  let params: Record<string, string>;
  let redirectUri: string;

  if (isTauri()) {
    // ── Desktop (Tauri): TCP server + system browser ────────────────────────
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');
    const { openUrl } = await import('@tauri-apps/plugin-opener');

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

    const tcpPort = await invoke<number>('start_oauth_server', { port: 14987 })
      .catch(() => 14987);
    redirectUri = `http://127.0.0.1:${tcpPort}`;

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: cfg.scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...(cfg.extraAuthParams ?? {}),
    });

    try {
      await openUrl(`${cfg.authUrl}?${authParams.toString()}`);
      params = await paramsPromise;
    } finally {
      clearTimeout(timeout);
      unlisten();
    }

  } else {
    // ── Browser: popup window polls for the redirect ────────────────────────
    // redirect_uri = current origin (e.g. http://localhost:5173).
    // You must add this as an authorised redirect URI in your provider's
    // developer console (Google Cloud Console / Azure / etc.).
    const previewRedirectUri = window.location.origin;
    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: previewRedirectUri,
      response_type: 'code',
      scope: cfg.scopes.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      ...(cfg.extraAuthParams ?? {}),
    });

    const result = await browserOAuthFlow(
      `${cfg.authUrl}?${authParams.toString()}`,
    );
    params = result.params;
    redirectUri = result.redirectUri;
  }

  if (params.error) throw new Error(`OAuth error: ${params.error} ${params.error_description ?? ''}`);
  if (!params.code) throw new Error('OAuth returned no code');
  if (params.state !== state) throw new Error('OAuth state mismatch');

  // Exchange code for tokens.
  // Google uses the server-side proxy so the client secret never leaves the server.
  // Other providers (e.g. Outlook public clients) call the token URL directly.
  let tokenRes: Response;
  if (cfg.usesClientSecret && cfg.tokenUrl.includes('google')) {
    tokenRes = await apiFetch(`${API_BASE}/api/google-token`, {
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
  } else {
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
      ...(cfg.usesClientSecret ? { client_secret: clientSecret } : {}),
    });
    tokenRes = await platformFetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });
  }
  if (!tokenRes.ok) throw new Error(`Token swap failed: HTTP ${tokenRes.status} ${await tokenRes.text()}`);
  const tokens = (await tokenRes.json()) as TokenResponse;
  if (!tokens.refresh_token) throw new Error('Provider did not return a refresh token. Ensure offline access scope is requested.');

  const email = await cfg.identify(tokens.access_token);
  const expiresAt = Date.now() + (tokens.expires_in - 30) * 1000;

  await secretSet(tokenKey(cfg.provider, email, 'access'), tokens.access_token);
  await secretSet(tokenKey(cfg.provider, email, 'refresh'), tokens.refresh_token);

  return {
    provider: cfg.provider,
    email,
    clientId,
    clientSecret: '',   // never stored — secret lives server-side
    expiresAt,
    lastSync: null,
  };
}

/** Refresh and persist a new access token. Returns the new accessToken + expiresAt. */
export async function refreshAccessToken(
  cfg: ProviderConfig,
  account: OAuthAccount,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: number; newRefreshToken?: string }> {
  let res: Response;
  if (cfg.usesClientSecret && cfg.tokenUrl.includes('google')) {
    res = await apiFetch(`${API_BASE}/api/google-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'refresh',
        refresh_token: refreshToken,
        client_id: account.clientId,
      }),
    });
  } else {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: account.clientId,
      ...(cfg.usesClientSecret ? { client_secret: account.clientSecret } : {}),
    });
    res = await platformFetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
  if (!res.ok) throw new Error(`Refresh failed: HTTP ${res.status} ${await res.text()}`);
  const json = (await res.json()) as TokenResponse;
  const expiresAt = Date.now() + (json.expires_in - 30) * 1000;
  await secretSet(tokenKey(account.provider, account.email, 'access'), json.access_token);
  if (json.refresh_token) {
    await secretSet(tokenKey(account.provider, account.email, 'refresh'), json.refresh_token);
  }
  return { accessToken: json.access_token, expiresAt, newRefreshToken: json.refresh_token };
}
