import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Music } from 'lucide-react';
import { getItem, setItem, deleteItem } from '../../lib/storage';
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <WidgetHeader label="Now Playing" accent={ACCENT} t={t} icon={Music} />
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
        <>
          <style>{`
            @keyframes bozz-wave {
              0%, 100% { transform: scaleY(var(--bar-min)); }
              50% { transform: scaleY(1); }
            }
          `}</style>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
            <div style={{
              width: '64px', height: '64px', flexShrink: 0, borderRadius: '14px',
              position: 'relative',
              boxShadow: track.isPlaying
                ? `0 0 22px ${ACCENT}66, 0 0 44px ${ACCENT}33`
                : `0 0 14px ${ACCENT}33`,
              transition: 'box-shadow 0.4s ease',
            }}>
              {track.albumArt
                ? (
                  <img
                    src={track.albumArt}
                    alt="Album art"
                    style={{ width: '100%', height: '100%', borderRadius: '14px', objectFit: 'cover', display: 'block' }}
                  />
                )
                : (
                  <div style={{
                    width: '100%', height: '100%', borderRadius: '14px',
                    background: `radial-gradient(circle at 50% 45%, ${ACCENT}55, ${t.bgAlt} 72%)`,
                    border: `1px solid ${t.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Music size={24} strokeWidth={1} color={t.textDim} />
                  </div>
                )
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '1rem', color: t.text, fontWeight: 600,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {track.name}
              </div>
              <div style={{
                fontSize: '0.72rem', color: t.textMuted, marginTop: '0.1rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {track.artist}{track.durationMs > 0 ? ` • ${msToTime(track.durationMs)}` : ''}
              </div>
              {/* Waveform */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '2px',
                marginTop: '0.55rem', height: '20px',
              }}>
                {[0.35,0.65,0.45,0.9,0.55,0.8,0.4,1,0.7,0.5,0.85,0.6,0.38,0.72,0.88,0.48,0.62,0.78,0.42,0.68,0.3,0.58,0.5,0.75,0.45].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      width: '2px',
                      height: '20px',
                      background: t.text,
                      borderRadius: '999px',
                      transformOrigin: 'center',
                      opacity: 0.85,
                      ...(track.isPlaying
                        ? {
                            '--bar-min': String(h * 0.3 + 0.1),
                            animation: `bozz-wave ${0.7 + (i % 5) * 0.12}s ease-in-out ${i * 0.04}s infinite`,
                            transform: `scaleY(${h})`,
                          } as React.CSSProperties
                        : { transform: `scaleY(${h * 0.5 + 0.1})` }),
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
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
