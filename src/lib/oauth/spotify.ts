import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { secretSet, secretGet, tokenKey } from './keyring';
import { pkceChallenge, randomString } from './pkce';
import type { SpotifyAccount, SpotifyTrack } from '../types';

export const SPOTIFY_PORT = 14985;
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = ['user-read-currently-playing', 'user-read-playback-state'];

/** Run PKCE OAuth for Spotify on a fixed port. Returns the new account. */
export async function connectSpotify(clientId: string): Promise<SpotifyAccount> {
  const verifier = randomString(64);
  const challenge = await pkceChallenge(verifier);
  const state = randomString(24);
  const redirectUri = `http://127.0.0.1:${SPOTIFY_PORT}`;

  // Start listening for the port event BEFORE invoking (prevents race).
  // Expose reject so we can fail fast if oauth_run rejects first (e.g. port in use).
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

  // If oauth_run fails immediately (e.g. EADDRINUSE because a previous attempt is still
  // running), propagate that error to portPromise right away instead of waiting 5 s.
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

  await portPromise; // wait until Rust has bound the port

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

  const params = await runPromise;
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
  const tokenRes = await tauriFetch(TOKEN_URL, {
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

  const meRes = await tauriFetch('https://api.spotify.com/v1/me', {
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
  const res = await tauriFetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Spotify refresh failed: HTTP ${res.status}`);
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
  const res = await tauriFetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 204 = no active device / nothing playing; 202 = loading
  if (res.status === 204 || res.status === 202) return null;
  if (!res.ok) throw new Error(`Spotify player API failed: ${res.status}`);

  const text = await res.text();
  if (!text) return null;

  const data = JSON.parse(text) as SpotifyPlaybackState;
  if (!data.item) return null;

  const images = data.item.album.images;
  // Prefer a medium-sized image (64–300px wide) for thumbnails
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
