import { useState, useEffect, useCallback, useRef } from 'react';
import { Music2, RefreshCw } from 'lucide-react';
import { getItem, setItem } from '../../lib/storage';
import { Widget, WidgetHeader, EmptyWidget } from '../shared/Widget';
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

  const getAccessToken = useCallback(async (acc: SpotifyAccount): Promise<string> => {
    if (Date.now() < acc.expiresAt) {
      const stored = await secretGet(tokenKey('spotify', acc.userId, 'access'));
      if (stored) return stored;
    }
    const { accessToken, expiresAt } = await refreshSpotifyToken(acc);
    const updated: SpotifyAccount = { ...acc, expiresAt };
    await setItem('spotifyAccount', JSON.stringify(updated));
    setAccount(updated);
    return accessToken;
  }, []);

  const fetchNowPlaying = useCallback(async (acc: SpotifyAccount) => {
    try {
      const token = await getAccessToken(acc);
      const nowPlaying = await getCurrentlyPlaying(token);
      setTrack(nowPlaying);
      setStatus('ready');
      setError(null);
    } catch (e) {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <WidgetHeader label="Now Playing" accent={ACCENT} t={t} icon={Music2} />
        <button
          onClick={reload}
          aria-label="Reload"
          title="Reload from settings"
          style={{
            background: 'transparent', border: 'none', color: t.textDim,
            cursor: 'pointer', padding: '0.15rem', display: 'flex',
          }}
        >
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
              {account.displayName}
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
