import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import type { EmailProvider, OAuthAccount } from '../types';
import { pkceChallenge, randomString } from './pkce';
import { secretSet, tokenKey } from './keyring';

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

/** Run a full PKCE OAuth flow and persist tokens. Returns the new account. */
export async function connectProvider(
  cfg: ProviderConfig,
  clientId: string,
  clientSecret: string,    // empty string for public clients
): Promise<OAuthAccount> {
  const verifier = randomString(64);
  const challenge = await pkceChallenge(verifier);
  const state = randomString(24);

  // Wait for Rust to bind a port and emit it.
  const portPromise = new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('OAuth listener never reported a port')), 5000);
    let unlisten: (() => void) | null = null;
    listen<number>('oauth:port', (e) => {
      clearTimeout(timer);
      if (unlisten) unlisten();
      resolve(e.payload);
    }).then(fn => { unlisten = fn; });
  });

  const runPromise = invoke<Record<string, string>>('oauth_run');
  const port = await portPromise;
  const redirectUri = `http://127.0.0.1:${port}`;

  // Build auth URL.
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
  await openUrl(`${cfg.authUrl}?${authParams.toString()}`);

  // Wait for the redirect.
  const params = await runPromise;
  if (params.error) throw new Error(`OAuth error: ${params.error} ${params.error_description ?? ''}`);
  if (!params.code) throw new Error('OAuth returned no code');
  if (params.state !== state) throw new Error('OAuth state mismatch');

  // Exchange code for tokens.
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
    ...(cfg.usesClientSecret ? { client_secret: clientSecret } : {}),
  });
  const tokenRes = await tauriFetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });
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
    clientSecret,
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
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: account.clientId,
    ...(cfg.usesClientSecret ? { client_secret: account.clientSecret } : {}),
  });
  const res = await tauriFetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Refresh failed: HTTP ${res.status} ${await res.text()}`);
  const json = (await res.json()) as TokenResponse;
  const expiresAt = Date.now() + (json.expires_in - 30) * 1000;
  await secretSet(tokenKey(account.provider, account.email, 'access'), json.access_token);
  if (json.refresh_token) {
    await secretSet(tokenKey(account.provider, account.email, 'refresh'), json.refresh_token);
  }
  return { accessToken: json.access_token, expiresAt, newRefreshToken: json.refresh_token };
}
