import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { getItem, setItem, deleteItem } from '../../lib/storage';
import { Widget, EmptyWidget } from '../shared/Widget';
import { getCurrentlyPlaying, refreshSpotifyToken } from '../../lib/oauth/spotify';
import { secretGet, tokenKey } from '../../lib/oauth/keyring';
import type { WidgetCtx } from './context';
import type { SpotifyAccount, SpotifyTrack } from '../../lib/types';

const ACCENT = '#c9a8d4';
const POLL_MS = 30_000;

function msToTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${(totalSec % 60).toString().padStart(2, '0')}`;
}

type WidgetStatus = 'loading' | 'ready' | 'error' | 'idle';

export default function NowPlayingWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t } = ctx;
  const [account, setAccount] = useState<SpotifyAccount | null>(null);
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [status, setStatus] = useState<WidgetStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const accountRef = useRef<SpotifyAccount | null>(null);
  accountRef.current = account;

  const getAccessToken = useCallback(async (acc: SpotifyAccount, forceRefresh = false): Promise<string> => {
    if (!forceRefresh && Date.now() < acc.expiresAt) {
      const stored = await secretGet(tokenKey('spotify', acc.userId, 'access'));
      if (stored) return stored;
    }
    try {
      const { accessToken, expiresAt } = await refreshSpotifyToken(acc);
      const updated: SpotifyAccount = { ...acc, expiresAt };
      await setItem('spotifyAccount', JSON.stringify(updated));
      setAccount(updated);
      return accessToken;
    } catch (refreshErr) {
      // invalid_grant (400) — refresh token is dead. Don't mask it by falling
      // back to a stale access token; let it propagate so the caller can
      // discard the account and prompt reconnect.
      const statusCode = (refreshErr as Error & { status?: number }).status;
      if (statusCode === 400) throw refreshErr;
      // Otherwise (network blip, 5xx) — fall back to stored access token if available
      const stored = await secretGet(tokenKey('spotify', acc.userId, 'access'));
      if (stored) return stored;
      throw refreshErr;
    }
  }, []);

  const fetchNowPlaying = useCallback(async (acc: SpotifyAccount, retrying = false) => {
    try {
      const token = await getAccessToken(acc);
      const nowPlaying = await getCurrentlyPlaying(token);
      setTrack(nowPlaying);
      setStatus('ready');
      setError(null);
    } catch (e) {
      const statusCode = (e as Error & { status?: number }).status;
      // 401 = access token rejected → force a refresh and retry once
      if (statusCode === 401 && !retrying) {
        try {
          const fresh = await getAccessToken(acc, true);
          const nowPlaying = await getCurrentlyPlaying(fresh);
          setTrack(nowPlaying);
          setStatus('ready');
          setError(null);
        } catch (retryErr) {
          const retryCode = (retryErr as Error & { status?: number }).status;
          if (retryCode === 400) {
            await deleteItem('spotifyAccount');
            setAccount(null); setTrack(null); setStatus('idle');
          } else {
            setError(String(retryErr)); setStatus('error');
          }
        }
        return;
      }
      // 400 = refresh token revoked — clear and show reconnect prompt
      if (statusCode === 400) {
        await deleteItem('spotifyAccount');
        setAccount(null); setTrack(null); setStatus('idle');
        return;
      }
      setError(String(e));
      setStatus('error');
    }
  }, [getAccessToken]);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    const saved = await getItem('spotifyAccount');
    if (saved?.value) {
      try {
        const acc = JSON.parse(saved.value) as SpotifyAccount;
        setAccount(acc);
        await fetchNowPlaying(acc);
        return;
      } catch { /* fall through */ }
    }
    setAccount(null);
    setTrack(null);
    setStatus('idle');
  }, [fetchNowPlaying]);

  useEffect(() => { reload(); }, [reload]);

  // Poll every 30 s when connected
  useEffect(() => {
    if (!account) return;
    const id = setInterval(() => {
      if (accountRef.current) void fetchNowPlaying(accountRef.current);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [account, fetchNowPlaying]);

  return (
    <Widget t={t} accent={ACCENT}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={reload} aria-label="Reload" title="Reload"
          style={{ background: 'transparent', border: 'none', color: t.textDim, cursor: 'pointer', padding: '0.15rem', display: 'flex' }}>
          <RefreshCw size={11} strokeWidth={1.5} />
        </button>
      </div>

      {status === 'loading' && <EmptyWidget text="Loading…" t={t} />}

      {status === 'idle' && (
        <EmptyWidget text="Connect Spotify in Settings → Connectors" t={t} />
      )}

      {status === 'ready' && !track && (
        <div style={{ marginTop: '0.85rem' }}>
          <div style={{ fontSize: '0.78rem', color: t.textMuted, fontStyle: 'italic' }}>
            Nothing playing right now
          </div>
          {account && (
            <div style={{ fontSize: '0.68rem', color: t.textDim, marginTop: '0.3rem' }}>
              {account.displayName || account.userId}
            </div>
          )}
        </div>
      )}

      {status === 'ready' && track && (
        <div style={{ marginTop: '0.85rem', display: 'flex', gap: '0.8rem', alignItems: 'flex-start' }}>
          {track.albumArt && (
            <img
              src={track.albumArt}
              alt="Album art"
              style={{ width: '48px', height: '48px', borderRadius: '5px', flexShrink: 0, objectFit: 'cover' }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '0.85rem', color: t.text, fontWeight: 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {track.name}
            </div>
            <div style={{
              fontSize: '0.72rem', color: t.textMuted, marginTop: '0.15rem',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {track.artist}
            </div>
            <div style={{
              height: '2px', background: t.bgAlt, borderRadius: '999px',
              overflow: 'hidden', marginTop: '0.5rem',
            }}>
              <div style={{
                width: `${track.durationMs > 0 ? (track.progressMs / track.durationMs) * 100 : 0}%`,
                height: '100%',
                background: ACCENT,
              }} />
            </div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              marginTop: '0.2rem', fontSize: '0.62rem', color: t.textDim,
            }}>
              <span>{msToTime(track.progressMs)}</span>
              <span>{msToTime(track.durationMs)}</span>
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.72rem', color: t.alert }}>{error}</div>
          <div style={{ fontSize: '0.68rem', color: t.textDim }}>
            Fix or reconnect in Settings → Connectors
          </div>
        </div>
      )}
    </Widget>
  );
}
