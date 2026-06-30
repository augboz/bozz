import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, RefreshCw } from 'lucide-react';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { getItem, setItem, deleteItem } from '../../../lib/storage';
import { connectSpotify, SPOTIFY_PORT } from '../../../lib/oauth/spotify';
import { secretDelete, tokenKey } from '../../../lib/oauth/keyring';
import type { Theme, SpotifyAccount } from '../../../lib/types';
import { extractNotionPageId } from '../../../lib/notion';

// ── Notion ──────────────────────────────────────────────────────────────────

interface NotionPageRef {
  id: string;
  label: string; // user-provided nickname; empty = use fetched title
}
interface NotionConfig {
  token: string;
  pages: NotionPageRef[];
}
interface LoadedPage extends NotionPageRef {
  fetchedTitle: string | null;
  url: string;
}

const NOTION_VERSION = '2022-06-28';

function toUuid(id: string): string {
  const h = id.replace(/-/g, '');
  if (h.length !== 32) return id;
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Migrate any legacy `{ token, pageIds: string[] }` into the new shape. */
function normaliseConfig(raw: unknown): NotionConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { token?: string; pages?: NotionPageRef[]; pageIds?: string[] };
  if (typeof o.token !== 'string') return null;
  if (Array.isArray(o.pages)) {
    return {
      token: o.token,
      pages: o.pages.map(p => ({ id: String(p.id), label: typeof p.label === 'string' ? p.label : '' })),
    };
  }
  if (Array.isArray(o.pageIds)) {
    return { token: o.token, pages: o.pageIds.map(id => ({ id: String(id), label: '' })) };
  }
  return { token: o.token, pages: [] };
}

function NotionSection({ t }: { t: Theme }) {
  const [config, setConfig] = useState<NotionConfig | null>(null);
  const [loaded, setLoaded] = useState<LoadedPage[]>([]);
  const [tokenInput, setTokenInput] = useState('');
  const [editToken, setEditToken] = useState(false);
  const [pageUrlInput, setPageUrlInput] = useState('');
  const [pageNameInput, setPageNameInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const persistConfig = useCallback(async (cfg: NotionConfig) => {
    await setItem('notionWidget', JSON.stringify(cfg));
    setConfig(cfg);
  }, []);

  const fetchTitles = useCallback(async (cfg: NotionConfig) => {
    if (!cfg.token || cfg.pages.length === 0) { setLoaded([]); return; }
    setFetching(true);
    setFetchError(null);
    const results: LoadedPage[] = [];
    for (const ref of cfg.pages) {
      const apiId = toUuid(ref.id);
      try {
        const res = await tauriFetch(`https://api.notion.com/v1/pages/${apiId}`, {
          headers: { Authorization: `Bearer ${cfg.token}`, 'Notion-Version': NOTION_VERSION },
        });
        if (!res.ok) {
          results.push({ ...ref, fetchedTitle: null, url: `https://notion.so/${ref.id}` });
          continue;
        }
        const data = (await res.json()) as {
          id: string; url: string;
          properties: Record<string, { type: string; title?: Array<{ plain_text: string }> }>;
        };
        let title = '';
        for (const prop of Object.values(data.properties)) {
          if (prop.type === 'title' && prop.title?.length) {
            title = prop.title.map(seg => seg.plain_text).join('');
            break;
          }
        }
        results.push({ ...ref, fetchedTitle: title || null, url: data.url });
      } catch (e) {
        setFetchError(String(e));
        results.push({ ...ref, fetchedTitle: null, url: `https://notion.so/${ref.id}` });
      }
    }
    setLoaded(results);
    setFetching(false);
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await getItem('notionWidget');
      if (!saved?.value) { setEditToken(true); return; }
      let cfg: NotionConfig | null = null;
      try { cfg = normaliseConfig(JSON.parse(saved.value)); } catch { /* ignore */ }
      if (!cfg) { setEditToken(true); return; }
      setConfig(cfg);
      if (cfg.token) await fetchTitles(cfg);
      else setEditToken(true);
    })();
  }, [fetchTitles]);

  const saveToken = async () => {
    const token = tokenInput.trim();
    if (!token) return;
    const cfg: NotionConfig = { token, pages: config?.pages ?? [] };
    await persistConfig(cfg);
    setTokenInput('');
    setEditToken(false);
    await fetchTitles(cfg);
  };

  const clearConfig = async () => {
    await deleteItem('notionWidget');
    setConfig(null); setLoaded([]); setEditToken(true);
  };

  const addPage = async () => {
    const raw = pageUrlInput.trim();
    if (!raw || !config?.token) return;
    const id = extractNotionPageId(raw);
    const newPages: NotionPageRef[] = [...(config.pages ?? []), { id, label: pageNameInput.trim() }];
    const cfg: NotionConfig = { token: config.token, pages: newPages };
    await persistConfig(cfg);
    setPageUrlInput(''); setPageNameInput('');
    await fetchTitles(cfg);
  };

  const removePage = async (id: string) => {
    if (!config) return;
    const cfg: NotionConfig = { ...config, pages: config.pages.filter(p => p.id !== id) };
    await persistConfig(cfg);
    setLoaded(ps => ps.filter(p => p.id !== id));
  };

  const startRename = (id: string, currentLabel: string) => {
    setEditingId(id); setEditingLabel(currentLabel);
  };
  const commitRename = async () => {
    if (!config || editingId == null) return;
    const cfg: NotionConfig = {
      ...config,
      pages: config.pages.map(p => p.id === editingId ? { ...p, label: editingLabel.trim() } : p),
    };
    await persistConfig(cfg);
    setLoaded(ps => ps.map(p => p.id === editingId ? { ...p, label: editingLabel.trim() } : p));
    setEditingId(null); setEditingLabel('');
  };

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.45rem 0.65rem', color: t.text, fontSize: '0.8rem',
    fontFamily: 'inherit', outline: 'none', flex: 1, minWidth: 0,
  };
  const btn: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.4rem 0.75rem', color: t.textMuted, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '0.78rem', flexShrink: 0,
  };

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <div style={{ fontSize: '0.92rem', color: t.text, fontWeight: 500 }}>Notion</div>
        {config?.token && !editToken && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => { setEditToken(true); setTokenInput(''); }} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: t.textMuted, fontFamily: 'inherit', fontSize: '0.72rem',
            }}>Change token</button>
            <button onClick={clearConfig} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: t.alert, fontFamily: 'inherit', fontSize: '0.72rem',
            }}>Disconnect</button>
          </div>
        )}
      </div>

      {editToken && (
        <>
          <div style={{ fontSize: '0.74rem', color: t.textMuted, lineHeight: 1.6, marginBottom: '0.6rem' }}>
            <strong style={{ color: t.text }}>1.</strong> Go to{' '}
            <code style={{ fontSize: '0.7rem', background: t.bgAlt, padding: '0.05rem 0.3rem', borderRadius: '3px' }}>notion.so/profile/integrations</code>
            {' '}→ <strong style={{ color: t.text }}>+ New integration</strong> → name it → pick your workspace → Save.{' '}
            <br />
            <strong style={{ color: t.text }}>2.</strong> Under <em>Internal Integration Secret</em>, Show → Copy → paste below.
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveToken(); }}
              placeholder="secret_…"
              style={inp}
            />
            <button onClick={saveToken} style={btn}>Save</button>
            {config?.token && (
              <button onClick={() => setEditToken(false)} style={{ ...btn, borderColor: 'transparent' }}>Cancel</button>
            )}
          </div>
        </>
      )}

      {!editToken && config?.token && (
        <>
          <div style={{ fontSize: '0.7rem', color: t.textDim, marginBottom: '0.6rem' }}>
            Token set · {loaded.length} page{loaded.length !== 1 ? 's' : ''} connected
            {fetching && ' · fetching…'}
          </div>

          {loaded.length > 0 && (
            <div style={{ display: 'grid', gap: '0.3rem', marginBottom: '0.55rem' }}>
              {loaded.map(p => {
                const display = p.label || p.fetchedTitle || `Page ${p.id.slice(0, 8)}…`;
                const isEditing = editingId === p.id;
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                    background: t.todoBg, border: `1px solid ${t.border}`,
                    borderRadius: '6px', padding: '0.3rem 0.4rem 0.3rem 0.7rem',
                  }}>
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingLabel}
                        onChange={e => setEditingLabel(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') { setEditingId(null); setEditingLabel(''); }
                        }}
                        placeholder={p.fetchedTitle || 'Custom name'}
                        style={{ ...inp, padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                      />
                    ) : (
                      <button
                        onClick={() => startRename(p.id, p.label)}
                        title="Rename"
                        style={{
                          flex: 1, minWidth: 0, textAlign: 'left',
                          background: 'transparent', border: 'none',
                          padding: '0.05rem 0', cursor: 'text',
                          fontFamily: 'inherit',
                          color: t.text, fontSize: '0.8rem',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {display}
                        {p.label && p.fetchedTitle && p.label !== p.fetchedTitle && (
                          <span style={{ color: t.textDim, marginLeft: '0.4rem', fontSize: '0.7rem' }}>
                            ({p.fetchedTitle})
                          </span>
                        )}
                      </button>
                    )}
                    <button onClick={() => removePage(p.id)} aria-label="Remove" style={{
                      background: 'transparent', border: 'none', color: t.textDim,
                      cursor: 'pointer', padding: '0.15rem',
                    }}>
                      <X size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {fetchError && <div style={{ fontSize: '0.68rem', color: t.alert, marginBottom: '0.4rem' }}>{fetchError}</div>}

          <div style={{ fontSize: '0.7rem', color: t.textMuted, lineHeight: 1.55, marginBottom: '0.4rem' }}>
            Open each page in Notion → <strong style={{ color: t.text }}>···</strong> (top-right)
            {' '}→ <strong style={{ color: t.text }}>Connections</strong> → connect your integration.
            Then paste the URL or ID below — name it whatever you like, or leave the name blank to use the page's Notion title.
          </div>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            <input
              value={pageUrlInput}
              onChange={e => setPageUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && pageUrlInput.trim()) addPage(); }}
              placeholder="Notion page URL or ID"
              style={inp}
            />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                value={pageNameInput}
                onChange={e => setPageNameInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && pageUrlInput.trim()) addPage(); }}
                placeholder="Name (optional)"
                style={inp}
              />
              <button onClick={addPage} style={btn}>
                <Plus size={12} strokeWidth={1.5} style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '0.2rem' }} />
                Add page
              </button>
              <button
                onClick={() => config && fetchTitles(config)}
                disabled={fetching}
                title="Refresh titles"
                style={{ ...btn, padding: '0.4rem 0.55rem' }}
              >
                <RefreshCw size={12} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Spotify ─────────────────────────────────────────────────────────────────

function SpotifySection({ t }: { t: Theme }) {
  const [account, setAccount] = useState<SpotifyAccount | null>(null);
  const [clientIdInput, setClientIdInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await getItem('spotifyAccount');
      if (saved?.value) {
        try {
          const parsed = JSON.parse(saved.value) as Partial<SpotifyAccount>;
          // Only treat as connected if the account has the required fields
          if (parsed.clientId && parsed.userId) {
            setAccount(parsed as SpotifyAccount);
          }
        } catch { /* ignore */ }
      }
      setLoaded(true);
    })();
  }, []);

  const connect = async () => {
    const cid = clientIdInput.trim();
    if (!cid) return;
    setConnecting(true);
    setError(null);
    try {
      const acc = await connectSpotify(cid);
      await setItem('spotifyAccount', JSON.stringify(acc));
      setAccount(acc);
      setClientIdInput('');
    } catch (e) {
      setError(String(e));
    }
    setConnecting(false);
  };

  const disconnect = async () => {
    if (account) {
      await secretDelete(tokenKey('spotify', account.userId, 'access'));
      await secretDelete(tokenKey('spotify', account.userId, 'refresh'));
    }
    await deleteItem('spotifyAccount');
    setAccount(null);
    setError(null);
  };

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.45rem 0.65rem', color: t.text, fontSize: '0.8rem',
    fontFamily: 'inherit', outline: 'none', flex: 1,
  };
  const btn: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
    padding: '0.4rem 0.75rem', color: t.textMuted, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '0.78rem', flexShrink: 0,
  };

  if (!loaded) return null;

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: '10px', padding: '0.9rem 1rem' }}>
      <div style={{ fontSize: '0.92rem', color: t.text, fontWeight: 500, marginBottom: '0.6rem' }}>Spotify</div>

      {account ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', color: t.text, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: t.doneAccent, display: 'inline-block' }} />
              {account.displayName || account.userId}
            </div>
            <div style={{ fontSize: '0.68rem', color: t.textDim, marginTop: '0.15rem' }}>Connected</div>
          </div>
          <button
            onClick={disconnect}
            style={{ ...btn, borderColor: t.alertBorder, color: t.alert }}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '0.74rem', color: t.textMuted, lineHeight: 1.6, marginBottom: '0.6rem' }}>
            <strong style={{ color: t.text }}>1.</strong> Open{' '}
            <code style={{ fontSize: '0.7rem', background: t.bgAlt, padding: '0.05rem 0.3rem', borderRadius: '3px' }}>developer.spotify.com/dashboard</code>
            {' '}→ create (or open) an app → <strong style={{ color: t.text }}>Edit settings</strong>.
            <br />
            <strong style={{ color: t.text }}>2.</strong> Under <strong style={{ color: t.text }}>Redirect URIs</strong>, add{' '}
            <strong style={{ color: t.text }}>exactly</strong>:{' '}
            <code style={{
              fontSize: '0.72rem', color: t.text, background: t.bgAlt,
              padding: '0.1rem 0.4rem', borderRadius: '4px', userSelect: 'all',
            }}>http://127.0.0.1:{SPOTIFY_PORT}</code>
            {' '}— not localhost, no trailing slash. Click <strong>Add</strong>, then <strong>Save</strong> at the bottom.
            <br />
            <strong style={{ color: t.text }}>3.</strong> Copy the <strong style={{ color: t.text }}>Client ID</strong> and paste below.
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: error ? '0.35rem' : 0 }}>
            <input
              value={clientIdInput}
              onChange={e => setClientIdInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') connect(); }}
              placeholder="Client ID"
              style={inp}
            />
            <button
              onClick={connect}
              disabled={connecting}
              style={{ ...btn, cursor: connecting ? 'wait' : 'pointer' }}
            >
              {connecting ? 'connecting…' : 'Connect'}
            </button>
          </div>
          {error && <div style={{ fontSize: '0.68rem', color: t.alert }}>{error}</div>}
        </>
      )}
    </div>
  );
}
// ── Block ───────────────────────────────────────────────────────────────────

export default function ConnectorsBlock({ t }: { t: Theme }) {
  return (
    <div>
      <NotionSection t={t} />
      <SpotifySection t={t} />
    </div>
  );
}
