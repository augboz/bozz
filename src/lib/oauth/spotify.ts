import { platformFetch } from '../http';
import { isTauri } from '../platform';
// OAuth connection (listen/invoke/openUrl) is Tauri-desktop-only.
// These are imported lazily inside connectSpotify so they don't crash on web.
import { secretSet, secretGet, tokenKey } from './keyring';
import { pkceChallenge, randomString } from './pkce';
import type { SpotifyAccount, SpotifyTrack } from '../types';

export const SPOTIFY_PORT = 14985;
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = ['user-read-currently-playing', 'user-read-playback-state'];

/** Run PKCE OAuth for Spotify. Returns the new account. */
export async function connectSpotify(clientId: string): Promise<SpotifyAccount> {
  const verifier = randomString(64);
  const challenge = await pkceChallenge(verifier);
  const state = randomString(24);

  let params: Record<string, string>;
  let redirectUri: string;

  if (isTauri()) {
    // ── Desktop (Tauri): Rust spins up a local HTTP server on a fixed port ──
    const { invoke } = await import('@tauri-apps/api/core');
    const { listen } = await import('@tauri-apps/api/event');
    const { openUrl } = await import('@tauri-apps/plugin-opener');

    redirectUri = `http://127.0.0.1:${SPOTIFY_PORT}`;

    let portReject: (e: Error) => void = () => {};
    const portPromise = new Promise<number>((resolve, reject) => {
      portReject = reject;
      const timer = setTimeout(
        () => reject(new Error('OAuth timed out waiting for port — is port 14985 already in use?')),
        5000,
      );
      let unlisten: (() => void) | null = null;
      listen<number>('oauth:port', (e) => {
        clearTimeout(timer);
        if (unlisten) unlisten();
        resolve(e.payload);
      }).then(fn => { unlisten = fn; });
    });

    const runPromise = invoke<Record<string, string>>('oauth_run', { port: SPOTIFY_PORT });
    runPromise.catch((e: unknown) => {
      const msg = String(e);
      if (msg.includes('in use') || msg.includes('EADDRINUSE') || msg.includes('already')) {
        portReject(new Error(
          'Port 14985 is still held by a previous connection attempt. ' +
          'Wait ~2 minutes (or restart the app) then try again.',
        ));
      } else {
        portReject(new Error(msg));
      }
    });

    await portPromise;

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    await openUrl(`${AUTH_URL}?${authParams.toString()}`);
    params = await runPromise;

  } else {
    // ── Browser: popup window posts back via postMessage ─────────────────
    // Spotify redirects back to the app root (?code=…&state=…).
    // App.tsx detects those params and posts them to window.opener.
    // Register this origin (e.g. http://localhost:1420) in your Spotify
    // developer dashboard under Redirect URIs.
    redirectUri = window.location.origin;

    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    params = await new Promise<Record<string, string>>((resolve, reject) => {
      const popup = window.open(
        `${AUTH_URL}?${authParams.toString()}`,
        'spotify_oauth',
        'width=520,height=660,left=200,top=100',
      );
      if (!popup) {
        reject(new Error('Popup was blocked — please allow popups for this page and try again.'));
        return;
      }

      let done = false;

      const onMessage = (e: MessageEvent) => {
        const loopbackPort = window.location.port || '80';
        const allowed = new Set([window.location.origin, `http://127.0.0.1:${loopbackPort}`]);
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

  if (params.error) throw new Error(`Spotify OAuth error: ${params.error}`);
  if (!params.code) throw new Error('Spotify OAuth returned no code');
  if (params.state !== state) throw new Error('Spotify state mismatch');

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: verifier,
  });
  const tokenRes = await platformFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody.toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`Spotify token swap failed: HTTP ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  if (!tokens.refresh_token) throw new Error('Spotify did not return a refresh token');

  const meRes = await platformFetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meRes.ok) throw new Error(`Spotify /me failed: ${meRes.status}`);
  const me = (await meRes.json()) as { id: string; display_name?: string };

  const expiresAt = Date.now() + (tokens.expires_in - 30) * 1000;
  await secretSet(tokenKey('spotify', me.id, 'access'), tokens.access_token);
  await secretSet(tokenKey('spotify', me.id, 'refresh'), tokens.refresh_token);

  return {
    clientId,
    userId: me.id,
    displayName: me.display_name ?? me.id,
    expiresAt,
    lastChecked: null,
  };
}

/** Refresh the Spotify access token using the stored refresh token. */
export async function refreshSpotifyToken(
  account: SpotifyAccount,
): Promise<{ accessToken: string; expiresAt: number }> {
  const refreshToken = await secretGet(tokenKey('spotify', account.userId, 'refresh'));
  if (!refreshToken) throw new Error('No Spotify refresh token stored');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: account.clientId,
  });
  const res = await platformFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const body_text = await res.text().catch(() => '');
    const err = new Error(`Spotify refresh failed: HTTP ${res.status}${body_text ? ` — ${body_text}` : ''}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const expiresAt = Date.now() + (json.expires_in - 30) * 1000;
  await secretSet(tokenKey('spotify', account.userId, 'access'), json.access_token);
  if (json.refresh_token) {
    await secretSet(tokenKey('spotify', account.userId, 'refresh'), json.refresh_token);
  }
  return { accessToken: json.access_token, expiresAt };
}

interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item?: {
    id: string;
    name: string;
    duration_ms: number;
    artists: Array<{ name: string }>;
    album: { images: Array<{ url: string; width: number; height: number }> };
  };
}

/** Fetch the currently-playing track. Returns null if nothing is playing. */
export async function getCurrentlyPlaying(accessToken: string): Promise<SpotifyTrack | null> {
  const res = await platformFetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 204 = no active device / nothing playing; 202 = loading
  if (res.status === 204 || res.status === 202) return null;
  if (!res.ok) {
    const err = new Error(`Spotify player API failed: ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }

  const text = await res.text();
  if (!text) return null;

  const data = JSON.parse(text) as SpotifyPlaybackState;
  if (!data.item) return null;

  const images = data.item.album.images;
  const albumArt = images.length > 0
    ? (images.find(img => img.width >= 64 && img.width <= 300) ?? images[images.length - 1]).url
    : null;

  return {
    id: data.item.id,
    name: data.item.name,
    artist: data.item.artists.map(a => a.name).join(', '),
    albumArt,
    progressMs: data.progress_ms,
    durationMs: data.item.duration_ms,
    isPlaying: data.is_playing,
  };
}
