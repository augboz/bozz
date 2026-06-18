/**
 * IntegrationsBlock — one-click service connections.
 *
 * UX contract: users never paste API keys or client IDs.
 * They click "Connect", a browser window opens, they sign in, done.
 *
 * How it works:
 *   - Client IDs / secrets live in .env.local (developer sets them once).
 *   - If an env var is missing the card shows a brief dev-only setup note.
 *   - All OAuth flows use the existing PKCE infrastructure in src/lib/oauth/.
 *
 * Env vars needed (add to .env.local):
 *   VITE_GMAIL_CLIENT_ID        — Google Cloud OAuth client ID (desktop app type)
 *   VITE_GMAIL_CLIENT_SECRET    — Google Cloud OAuth client secret
 *   VITE_OUTLOOK_CLIENT_ID      — Azure app registration client ID
 *   VITE_SPOTIFY_CLIENT_ID      — Spotify developer app client ID
 *   VITE_NOTION_CLIENT_ID       — Notion public integration client ID
 *   VITE_NOTION_CLIENT_SECRET   — Notion public integration client secret
 *                                  (Notion redirect URI: http://127.0.0.1:14986 — add in Notion integration settings)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { isWeb } from '../../../lib/platform';
import { platformFetch } from '../../../lib/http';
// Tauri-only APIs — imported lazily inside functions so they don't crash on web
const tauriInvoke = async <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core'); return invoke<T>(cmd, args);
};
const tauriListen = async <T,>(event: string, cb: (e: { payload: T }) => void) => {
  const { listen } = await import('@tauri-apps/api/event'); return listen<T>(event, cb);
};
const tauriOpenUrl = async (url: string) => {
  const { openUrl } = await import('@tauri-apps/plugin-opener'); return openUrl(url);
};
const tauriWebviewWindow = async (label: string, opts: Record<string, unknown>) => {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new WebviewWindow(label, opts as any);
};
import { getItem, setItem, deleteItem } from '../../../lib/storage';
import { schedulePush } from '../../../lib/sync';
import { supabase } from '../../../lib/supabase';
import { connectSpotify } from '../../../lib/oauth/spotify';
import { secretDelete, secretSet, tokenKey } from '../../../lib/oauth/keyring';
import ColorBankPicker from '../../shared/ColorBankPicker';
import { randomString } from '../../../lib/oauth/pkce';
import { formatDistanceToNowStrict } from 'date-fns';
import type { CalendarConnection, EmailProvider, HealthConnection, ImapAccount, OAuthAccount, SpotifyAccount, Theme } from '../../../lib/types';
import { isWAConfigured, startWASession, getWASessionStatus, deleteWASession } from '../../../lib/whatsapp';

// ── Sync helper ───────────────────────────────────────────────────────────────
// IntegrationsBlock writes directly to storage (not through Dashboard state),
// so it must trigger its own Supabase push after each save.
async function saveAndSync(key: string, value: unknown): Promise<void> {
  await setItem(key, JSON.stringify(value));
  const { data: { user } } = await supabase.auth.getUser();
  if (user) schedulePush(user.id);
}

// ── Env vars (set once in .env.local) ────────────────────────────────────────

const ENV = {
  gmailClientId:        import.meta.env.VITE_GMAIL_CLIENT_ID       as string | undefined,
  gmailClientSecret:    import.meta.env.VITE_GMAIL_CLIENT_SECRET    as string | undefined,
  outlookClientId:      import.meta.env.VITE_OUTLOOK_CLIENT_ID      as string | undefined,
  spotifyClientId:      import.meta.env.VITE_SPOTIFY_CLIENT_ID      as string | undefined,
  notionClientId:       import.meta.env.VITE_NOTION_CLIENT_ID       as string | undefined,
  notionClientSecret:   import.meta.env.VITE_NOTION_CLIENT_SECRET   as string | undefined,
  /** Base URL of the deployed Vercel redirect proxy, e.g. https://life-bozz.vercel.app */
  notionRedirectBase:   import.meta.env.VITE_NOTION_REDIRECT_URL    as string | undefined,
  gcalClientId:         import.meta.env.VITE_GCAL_CLIENT_ID         as string | undefined,
  gcalClientSecret:     import.meta.env.VITE_GCAL_CLIENT_SECRET     as string | undefined,
  gfitClientId:         import.meta.env.VITE_GFIT_CLIENT_ID         as string | undefined,
  gfitClientSecret:     import.meta.env.VITE_GFIT_CLIENT_SECRET     as string | undefined,
  /** Base URL of the self-hosted WhatsApp bridge, e.g. https://wa.yourserver.com */
  waBackendUrl:         import.meta.env.VITE_WA_BACKEND_URL         as string | undefined,
  waBackendKey:         import.meta.env.VITE_WA_BACKEND_KEY         as string | undefined,
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface IntegrationsProps {
  t: Theme;
  colorBank?: string[];
  oauthAccounts: OAuthAccount[];
  emailSyncErrors: Array<{ account: string; error: string }>;
  onConnectAccount:    (provider: EmailProvider, clientId: string, clientSecret: string) => Promise<void>;
  onDisconnectAccount: (provider: EmailProvider, email: string) => Promise<void>;
  calendarConnections: CalendarConnection[];
  onCalendarConnectionsChange: (next: CalendarConnection[]) => void;
  healthConnections: HealthConnection[];
  onHealthConnectionsChange: (next: HealthConnection[]) => void;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inp = (t: Theme): React.CSSProperties => ({
  background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.55rem 0.75rem', color: t.text, fontSize: '0.82rem',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
});

// ── ServiceCard ───────────────────────────────────────────────────────────────

function ServiceIcon({ color, letter }: { color: string; letter: string }) {
  return (
    <div style={{
      width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0,
      background: color, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '1.05rem', fontWeight: 700, userSelect: 'none',
      boxShadow: `0 4px 14px ${color}40`,
    }}>
      {letter}
    </div>
  );
}

/** A connected account row shown inside a card. */
function AccountRow({
  t, label, subLabel, error, onDisconnect, onReauth, color, onColorChange, bank = [],
}: {
  t: Theme; label: string; subLabel: string; error?: string; onDisconnect: () => void;
  onReauth?: () => Promise<void>;
  color?: string; onColorChange?: (c: string | undefined) => void;
  bank?: string[];
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  return (
    <div style={{
      background: t.todoBg,
      border: `1px solid ${error ? t.alertBorder : t.border}`,
      borderRadius: '8px', padding: '0.45rem 0.75rem',
      marginTop: '0.7rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {/* Colour dot — clickable if onColorChange provided */}
        {onColorChange ? (
          <button
            onClick={() => setPickerOpen(o => !o)}
            title="Pick calendar colour"
            style={{
              width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0,
              background: color ?? t.doneAccent,
              border: pickerOpen ? `2px solid ${t.text}` : '2px solid transparent',
              cursor: 'pointer', padding: 0, outline: 'none',
            }}
          />
        ) : (
          <span style={{
            width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
            background: error ? t.alert : t.doneAccent,
          }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.83rem', color: t.text }}>{label}</div>
          <div style={{ fontSize: '0.68rem', color: error ? t.alert : t.textDim, marginTop: '0.05rem' }}>
            {error ?? subLabel}
          </div>
        </div>
        {onReauth && (
          <button
            onClick={onReauth}
            style={{ background: 'none', border: `1px solid ${t.alertBorder}`, borderRadius: '6px', cursor: 'pointer', color: t.alert, padding: '0.15rem 0.45rem', fontSize: '0.68rem', fontFamily: 'inherit', flexShrink: 0 }}
          >
            Re-authorize
          </button>
        )}
        <button
          onClick={onDisconnect}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textDim, padding: '0.15rem', flexShrink: 0 }}
          title="Disconnect"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
      {/* Inline colour bank picker */}
      {pickerOpen && onColorChange && (
        <div style={{ marginTop: '0.45rem' }}>
          <ColorBankPicker
            bank={bank}
            selected={color}
            onChange={(c) => { onColorChange(c); setPickerOpen(false); }}
            swatchSize={16}
          />
        </div>
      )}
    </div>
  );
}

/** Wrapper card for each service. */
function Card({
  t, color, letter, name, status, action,
  children,
}: {
  t: Theme; color: string; letter: string; name: string;
  status?: React.ReactNode; action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${hover ? t.borderStrong : t.border}`, borderRadius: '14px',
        padding: '0.9rem 1rem', marginBottom: '0.65rem',
        background: hover ? t.bgAlt : 'transparent',
        transform: hover ? 'translateY(-1px)' : 'none',
        transition: 'border-color 0.25s, background 0.25s, transform 0.25s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ServiceIcon color={color} letter={letter} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', color: t.text, fontWeight: 600 }}>{name}</div>
          {status && (
            <div style={{ fontSize: '0.73rem', color: t.textMuted, marginTop: '0.1rem' }}>
              {status}
            </div>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ConnectBtn({ t, label = 'Connect', busy, onClick, disabled }: {
  t: Theme; label?: string; busy?: boolean; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      style={{
        background: t.text, color: t.bg, border: 'none', borderRadius: '999px',
        padding: '0.5rem 1.15rem', fontSize: '0.82rem', fontFamily: 'inherit',
        cursor: busy || disabled ? 'wait' : 'pointer', fontWeight: 600,
        opacity: busy || disabled ? 0.55 : 1, flexShrink: 0,
        transition: 'opacity 0.15s',
      }}
    >
      {busy ? 'Connecting…' : label}
    </button>
  );
}

function DisconnectBtn({ t, onClick }: { t: Theme; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: `1px solid ${t.alertBorder}`,
        borderRadius: '999px', padding: '0.45rem 0.85rem',
        fontSize: '0.78rem', fontFamily: 'inherit',
        cursor: 'pointer', color: t.alert, flexShrink: 0,
      }}
    >
      Disconnect
    </button>
  );
}

/** Shown when the env var for a service hasn't been added yet. */
function DevNote({ t, vars }: { t: Theme; vars: string[] }) {
  return (
    <div style={{
      marginTop: '0.7rem', fontSize: '0.72rem', color: t.textDim, lineHeight: 1.6,
      background: t.input, borderRadius: '7px', padding: '0.5rem 0.7rem',
    }}>
      Add to <code style={{ background: t.bgAlt, padding: '0.05rem 0.3rem', borderRadius: '3px', fontSize: '0.68rem' }}>.env.local</code> and restart:
      {vars.map(v => (
        <div key={v} style={{ marginTop: '0.2rem', fontFamily: 'monospace', fontSize: '0.7rem', color: t.text }}>
          {v}=…
        </div>
      ))}
    </div>
  );
}

// ── Gmail ─────────────────────────────────────────────────────────────────────

function GmailCard({ t, accounts, syncErrors, onConnect, onDisconnect }: {
  t: Theme;
  accounts: OAuthAccount[];
  syncErrors: Array<{ account: string; error: string }>;
  onConnect: (cid: string, cs: string) => Promise<void>;
  onDisconnect: (email: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = accounts.filter(a => a.provider === 'gmail');
  const configured = Boolean(ENV.gmailClientId && ENV.gmailClientSecret);

  const connect = async () => {
    if (!ENV.gmailClientId || !ENV.gmailClientSecret) return;
    setBusy(true); setError(null);
    try {
      await onConnect(ENV.gmailClientId, ENV.gmailClientSecret);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  return (
    <Card
      t={t} color="#EA4335" letter="G" name="Gmail"
      status={connected.length ? `${connected.length} account${connected.length > 1 ? 's' : ''} connected` : 'Sync your inbox'}
      action={configured
        ? <ConnectBtn t={t} busy={busy} onClick={connect} label={connected.length ? 'Add account' : 'Connect'} />
        : undefined}
    >
      {connected.map(a => {
        const err = syncErrors.find(e => e.account === a.email)?.error;
        const needsReauth = err?.includes('invalid_grant') || err?.includes('expired') || err?.includes('revoked');
        return (
          <AccountRow
            key={a.email} t={t} label={a.email}
            subLabel={a.lastSync ? `synced ${formatDistanceToNowStrict(a.lastSync, { addSuffix: true })}` : 'not synced yet'}
            error={needsReauth ? 'Session expired — click Re-authorize' : err}
            onDisconnect={() => onDisconnect(a.email)}
            onReauth={needsReauth && configured ? async () => {
              setBusy(true);
              try { await onConnect(ENV.gmailClientId!, ENV.gmailClientSecret!); } catch { /* ignore */ }
              setBusy(false);
            } : undefined}
          />
        );
      })}
      {!configured && <DevNote t={t} vars={['VITE_GMAIL_CLIENT_ID', 'VITE_GMAIL_CLIENT_SECRET']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>{error}</div>}
    </Card>
  );
}

// ── Outlook ───────────────────────────────────────────────────────────────────

function OutlookCard({ t, accounts, syncErrors, onConnect, onDisconnect }: {
  t: Theme;
  accounts: OAuthAccount[];
  syncErrors: Array<{ account: string; error: string }>;
  onConnect: (cid: string) => Promise<void>;
  onDisconnect: (email: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = accounts.filter(a => a.provider === 'outlook');
  const configured = Boolean(ENV.outlookClientId);

  // Hide entirely until a client ID is configured
  if (!configured && connected.length === 0) return null;

  const connect = async () => {
    if (!ENV.outlookClientId) return;
    setBusy(true); setError(null);
    try { await onConnect(ENV.outlookClientId); }
    catch (e) { setError(String(e)); }
    setBusy(false);
  };

  return (
    <Card
      t={t} color="#0078D4" letter="M" name="Outlook / Hotmail"
      status={connected.length ? `${connected.length} account${connected.length > 1 ? 's' : ''} connected` : 'Sync your inbox'}
      action={configured
        ? <ConnectBtn t={t} busy={busy} onClick={connect} label={connected.length ? 'Add account' : 'Connect'} />
        : undefined}
    >
      {connected.map(a => {
        const err = syncErrors.find(e => e.account === a.email)?.error;
        return (
          <AccountRow
            key={a.email} t={t} label={a.email}
            subLabel={a.lastSync ? `synced ${formatDistanceToNowStrict(a.lastSync, { addSuffix: true })}` : 'not synced yet'}
            error={err}
            onDisconnect={() => onDisconnect(a.email)}
          />
        );
      })}
      {!configured && (
        <div style={{
          marginTop: '0.7rem', fontSize: '0.72rem', color: t.textDim, lineHeight: 1.6,
          background: t.input, borderRadius: '7px', padding: '0.5rem 0.7rem',
        }}>
          Register a free app at{' '}
          <button
            onClick={() => tauriOpenUrl('https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade')}
            style={{ background: 'none', border: 'none', padding: 0, color: t.text, cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit', textDecoration: 'underline' }}
          >
            portal.azure.com
          </button>
          {' '}→ New registration → Supported account types: <strong style={{ color: t.text }}>Any Azure AD directory + personal accounts</strong> → Redirect URI: <strong style={{ color: t.text }}>Public client / native</strong> = <code style={{ background: t.bgAlt, padding: '0.05rem 0.3rem', borderRadius: '3px', fontSize: '0.68rem' }}>http://localhost</code>. Then Authentication → Allow public client flows: Yes. Copy the Application (client) ID and add to{' '}
          <code style={{ background: t.bgAlt, padding: '0.05rem 0.3rem', borderRadius: '3px', fontSize: '0.68rem' }}>.env.local</code> and restart:
          <div style={{ marginTop: '0.2rem', fontFamily: 'monospace', fontSize: '0.7rem', color: t.text }}>
            VITE_OUTLOOK_CLIENT_ID=…
          </div>
        </div>
      )}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>{error}</div>}
    </Card>
  );
}

// ── Spotify ───────────────────────────────────────────────────────────────────

function SpotifyCard({ t, onConnectedChange }: { t: Theme; onConnectedChange?: (v: boolean) => void }) {
  const [account, setAccount] = useState<SpotifyAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const configured = Boolean(ENV.spotifyClientId);

  useEffect(() => {
    (async () => {
      const saved = await getItem('spotifyAccount');
      if (saved?.value) {
        try {
          const acc = JSON.parse(saved.value) as SpotifyAccount;
          setAccount(acc);
          onConnectedChange?.(true);
        } catch { /* ignore */ }
      }
      setReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    if (!ENV.spotifyClientId) return;
    setBusy(true); setError(null);
    try {
      const acc = await connectSpotify(ENV.spotifyClientId);
      await saveAndSync('spotifyAccount', acc);
      setAccount(acc);
      onConnectedChange?.(true);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  const disconnect = async () => {
    if (account) {
      await secretDelete(tokenKey('spotify', account.userId, 'access'));
      await secretDelete(tokenKey('spotify', account.userId, 'refresh'));
    }
    await deleteItem('spotifyAccount');
    setAccount(null);
    onConnectedChange?.(false);
  };

  if (!ready) return null;

  return (
    <Card
      t={t} color="#1DB954" letter="S" name="Spotify"
      status={account ? `● ${account.displayName}` : 'Now playing widget'}
      action={account
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : configured
          ? <ConnectBtn t={t} busy={busy} onClick={connect} />
          : undefined}
    >
      {!configured && <DevNote t={t} vars={['VITE_SPOTIFY_CLIENT_ID']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>{error}</div>}
    </Card>
  );
}

// ── Notion ────────────────────────────────────────────────────────────────────

interface NotionPageRef { id: string; label: string; }
interface NotionConfig { token: string; pages: NotionPageRef[]; }

const NOTION_VERSION = '2022-06-28';

function normaliseConfig(raw: unknown): NotionConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { token?: string; pages?: NotionPageRef[]; pageIds?: string[] };
  if (typeof o.token !== 'string') return null;
  if (Array.isArray(o.pages)) return { token: o.token, pages: o.pages.map(p => ({ id: String(p.id), label: typeof p.label === 'string' ? p.label : '' })) };
  if (Array.isArray(o.pageIds)) return { token: o.token, pages: o.pageIds.map(id => ({ id: String(id), label: '' })) };
  return { token: o.token, pages: [] };
}

export const NOTION_LOCAL_PORT = 14986;

/**
 * Unblock a stuck oauth_run server on the Notion port by sending it a
 * cancellation request — this satisfies its pending HTTP wait and releases
 * the port so a fresh attempt can bind immediately.
 */
async function releaseNotionPort(): Promise<void> {
  try {
    await platformFetch(
      `http://127.0.0.1:${NOTION_LOCAL_PORT}/?error=cancelled&state=cancelled`,
      { method: 'GET' },
    );
  } catch { /* ignore — server may already be gone */ }
  // Give the OS a moment to reclaim the port before we rebind.
  await new Promise<void>(r => setTimeout(r, 600));
}

/**
 * Notion OAuth via in-app WebviewWindow + Vercel HTTPS proxy.
 *
 * WHY WebviewWindow instead of openUrl (system browser):
 *   The system browser carries the user's existing Notion session — whoever
 *   is currently logged into Notion gets connected, which is wrong for
 *   multi-user apps. An in-app WebviewWindow starts with NO Notion session,
 *   so every user always sees the Notion login screen and authenticates as
 *   themselves, exactly like a Google sign-in prompt.
 *
 * WHY Vercel proxy:
 *   Notion requires HTTPS redirect URIs. The proxy at /api/notion-redirect
 *   receives the code and immediately redirects to http://127.0.0.1:14986,
 *   which our Rust HTTP server captures.
 *
 * Redirect URI registered in the Notion integration settings:
 *   https://life-bozz.vercel.app/api/notion-redirect
 */
async function connectNotionOAuth(
  clientId: string,
  clientSecret: string,
  redirectBase: string,
): Promise<string> {
  const redirectUri = `${redirectBase.replace(/\/$/, '')}/api/notion-redirect`;
  const state = randomString(24);

  // Start listening for the port event BEFORE invoking to prevent the race.
  let portReject: (e: Error) => void = () => {};
  const portPromise = new Promise<void>((resolve, reject) => {
    portReject = reject;
    const timer = setTimeout(
      () => reject(new Error('OAuth timed out — click Try again')),
      8000,
    );
    let unlisten: (() => void) | null = null;
    tauriListen<number>('oauth:port', () => {
      clearTimeout(timer);
      if (unlisten) unlisten();
      resolve();
    }).then(fn => { unlisten = fn; });
  });

  const runPromise = tauriInvoke<Record<string, string>>('oauth_run', { port: NOTION_LOCAL_PORT });
  runPromise.catch((e: unknown) => {
    const msg = String(e);
    if (msg.includes('10048') || msg.includes('in use') || msg.includes('already')) {
      portReject(new Error('Port still held from previous attempt — click Try again'));
    } else {
      portReject(new Error(msg));
    }
  });

  await portPromise; // confirmed: Rust is listening on 127.0.0.1:14986

  const authUrl = 'https://api.notion.com/v1/oauth/authorize?' + new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    owner: 'user',
    redirect_uri: redirectUri,
    state,
  }).toString();

  // Open in an isolated in-app window — no system-browser Notion session, so
  // the user always logs into their OWN workspace.
  const authWindow = await tauriWebviewWindow(`notion-oauth-${Date.now()}`, {
    url: authUrl,
    title: 'Connect your Notion workspace',
    width: 540,
    height: 740,
    center: true,
    resizable: true,
  });

  // Close the auth window once the flow completes (success or error).
  void runPromise.finally(() => { void authWindow.close(); });

  const params = await runPromise;
  if (params.error) throw new Error(`Notion: ${params.error}`);
  if (!params.code) throw new Error('Notion returned no code');
  if (params.state !== state) throw new Error('State mismatch — possible CSRF');

  // Notion uses HTTP Basic auth for token exchange (not PKCE body params).
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const tokenRes = await platformFetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Notion token exchange failed: ${tokenRes.status} ${await tokenRes.text()}`);
  }
  const json = (await tokenRes.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('Notion returned no access_token');
  return json.access_token;
}

interface AvailablePage { id: string; title: string; }

/** Fetch all pages the integration/token has access to via the search API. */
async function searchNotionPages(token: string): Promise<AvailablePage[]> {
  const pages: AvailablePage[] = [];
  let cursor: string | null = null;
  do {
    const body: Record<string, unknown> = {
      filter: { value: 'page', property: 'object' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 100,
    };
    if (cursor) body.start_cursor = cursor;
    const res = await platformFetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) break;
    const data = (await res.json()) as {
      results: Array<{ id: string; properties: Record<string, { type: string; title?: Array<{ plain_text: string }> }> }>;
      has_more: boolean; next_cursor: string | null;
    };
    for (const p of data.results) {
      let title = '';
      for (const prop of Object.values(p.properties)) {
        if (prop.type === 'title' && prop.title?.length) { title = prop.title.map(s => s.plain_text).join(''); break; }
      }
      pages.push({ id: p.id.replace(/-/g, ''), title: title || `Untitled (${p.id.slice(0, 8)})` });
    }
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return pages;
}

function NotionCard({ t, onConnectedChange }: { t: Theme; onConnectedChange?: (v: boolean) => void }) {
  const [config, setConfig] = useState<NotionConfig | null>(null);
  const [available, setAvailable] = useState<AvailablePage[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingPages, setLoadingPages] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const oauthReady = Boolean(ENV.notionClientId && ENV.notionClientSecret && ENV.notionRedirectBase);

  const persist = useCallback(async (cfg: NotionConfig) => {
    await saveAndSync('notionWidget', cfg);
    setConfig(cfg);
  }, []);

  // Load config from storage on mount — no API call yet
  useEffect(() => {
    (async () => {
      const saved = await getItem('notionWidget');
      if (saved?.value) {
        try {
          const cfg = normaliseConfig(JSON.parse(saved.value));
          if (cfg) { setConfig(cfg); onConnectedChange?.(true); }
        } catch { /* ignore */ }
      }
      setReady(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch available pages — only called when picker is opened
  const openPicker = async () => {
    if (!config?.token) return;
    setPickerOpen(true);
    if (available.length === 0) {
      setLoadingPages(true);
      try {
        setAvailable(await searchNotionPages(config.token));
      } catch { /* ignore */ }
      setLoadingPages(false);
    }
  };

  const afterConnect = async (token: string) => {
    const cfg: NotionConfig = { token, pages: [] };
    await persist(cfg);
    onConnectedChange?.(true);
    // Auto-open picker so user can select pages immediately
    setPickerOpen(true);
    setLoadingPages(true);
    try { setAvailable(await searchNotionPages(token)); } catch { /* ignore */ }
    setLoadingPages(false);
  };

  const connectOAuth = async (releaseFirst = false) => {
    if (!ENV.notionClientId || !ENV.notionClientSecret || !ENV.notionRedirectBase) return;
    setBusy(true); setError(null);
    try {
      if (releaseFirst) await releaseNotionPort();
      const token = await connectNotionOAuth(ENV.notionClientId, ENV.notionClientSecret, ENV.notionRedirectBase);
      await afterConnect(token);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  const saveToken = async () => {
    const v = tokenInput.trim();
    if (!v) return;
    setBusy(true);
    await afterConnect(v);
    setTokenInput('');
    setBusy(false);
  };

  const disconnect = async () => {
    await deleteItem('notionWidget');
    setConfig(null); setAvailable([]); setPickerOpen(false); setError(null);
    onConnectedChange?.(false);
  };

  const togglePage = async (page: AvailablePage, selected: boolean) => {
    if (!config) return;
    const pages = selected
      ? [...config.pages, { id: page.id, label: page.title }]
      : config.pages.filter(p => p.id !== page.id);
    await persist({ ...config, pages });
  };

  if (!ready) return null;

  const isConnected = Boolean(config?.token);
  const selectedIds = new Set(config?.pages.map(p => p.id) ?? []);

  return (
    <Card
      t={t} color="#3d3d3d" letter="N" name="Notion"
      status={isConnected
        ? `● Connected · ${selectedIds.size} page${selectedIds.size !== 1 ? 's' : ''} in widget`
        : 'View your workspace pages'}
      action={isConnected
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : oauthReady
          ? <ConnectBtn t={t} busy={busy} onClick={connectOAuth} />
          : undefined}
    >
      {error && (
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: t.alert, flex: 1 }}>{error}</span>
          {oauthReady && (
            <button
              onClick={() => { void connectOAuth(true); }}
              style={{
                background: 'none', border: `1px solid ${t.border}`, borderRadius: '7px',
                padding: '0.3rem 0.7rem', fontSize: '0.72rem', fontFamily: 'inherit',
                cursor: 'pointer', color: t.text, flexShrink: 0,
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Token-paste fallback */}
      {!isConnected && !oauthReady && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.7rem', borderTop: `1px solid ${t.border}` }}>
          <p style={{ fontSize: '0.73rem', color: t.textMuted, margin: '0 0 0.5rem', lineHeight: 1.5 }}>
            Paste your integration token from{' '}
            <strong style={{ color: t.text }}>notion.so/profile/integrations</strong>.
          </p>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input value={tokenInput} onChange={e => setTokenInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveToken()}
              placeholder="ntn_…" style={{ ...inp(t), flex: 1 }} />
            <ConnectBtn t={t} label="Connect" busy={busy} onClick={saveToken} />
          </div>
        </div>
      )}

      {/* Page access — collapsible, only when connected */}
      {isConnected && (
        <div style={{ marginTop: '0.55rem', borderTop: `1px solid ${t.border}`, paddingTop: '0.55rem' }}>
          {/* Toggle row */}
          <button
            onClick={pickerOpen ? () => setPickerOpen(false) : openPicker}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.1rem 0', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: t.textMuted, fontWeight: 500 }}>
              Pages in widget
              {selectedIds.size > 0 && (
                <span style={{
                  marginLeft: '0.45rem',
                  background: t.doingBg, border: `1px solid ${t.doingBorder}`,
                  borderRadius: '10px', padding: '0.05rem 0.5rem',
                  fontSize: '0.68rem', color: t.doingAccent, fontWeight: 600,
                }}>
                  {selectedIds.size}
                </span>
              )}
            </span>
            <span style={{ fontSize: '0.65rem', color: t.textDim, lineHeight: 1 }}>
              {pickerOpen ? '▲' : '▼'}
            </span>
          </button>

          {/* Page list */}
          {pickerOpen && (
            <div style={{ marginTop: '0.5rem' }}>
              {loadingPages ? (
                <div style={{ fontSize: '0.75rem', color: t.textDim, padding: '0.3rem 0' }}>Fetching pages…</div>
              ) : available.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: t.textDim, padding: '0.3rem 0' }}>No pages found.</div>
              ) : (
                <div style={{ display: 'grid', gap: '0.2rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {available.map(page => {
                    const on = selectedIds.has(page.id);
                    return (
                      <label key={page.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.55rem',
                        padding: '0.3rem 0.65rem',
                        borderRadius: '7px',
                        background: on ? t.doingBg : 'transparent',
                        cursor: 'pointer', userSelect: 'none',
                        transition: 'background 0.1s',
                      }}>
                        <input type="checkbox" checked={on}
                          onChange={e => togglePage(page, e.target.checked)}
                          style={{ accentColor: t.doingAccent, flexShrink: 0, width: '13px', height: '13px' }} />
                        <span style={{
                          fontSize: '0.8rem', color: on ? t.text : t.textMuted,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontWeight: on ? 500 : 400,
                        }}>
                          {page.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
              {!loadingPages && available.length > 0 && (
                <button
                  onClick={async () => {
                    if (!config) return;
                    setLoadingPages(true);
                    try { setAvailable(await searchNotionPages(config.token)); } catch { /* ignore */ }
                    setLoadingPages(false);
                  }}
                  style={{
                    marginTop: '0.4rem', background: 'none', border: 'none',
                    cursor: 'pointer', color: t.textDim, fontSize: '0.7rem',
                    padding: '0', display: 'flex', alignItems: 'center', gap: '0.3rem',
                    fontFamily: 'inherit',
                  }}
                >
                  <RefreshCw size={11} strokeWidth={1.5} /> Refresh
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── IMAP (any inbox) ──────────────────────────────────────────────────────────

// ── iCloud ────────────────────────────────────────────────────────────────────

const ICLOUD_DOMAINS = new Set(['icloud.com', 'me.com', 'mac.com']);
const ICLOUD_HOST = 'imap.mail.me.com';
const ICLOUD_PORT = 993;

function ICloudCard({ t, onConnectedChange }: { t: Theme; onConnectedChange?: (v: boolean) => void }) {
  const [accounts, setAccounts] = useState<ImapAccount[]>([]);
  const [step, setStep] = useState<'idle' | 'form'>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getItem(IMAP_KEY).then(r => {
      if (r?.value) {
        try {
          const all = JSON.parse(r.value) as ImapAccount[];
          const filtered = all.filter(a => ICLOUD_DOMAINS.has(a.email.split('@')[1]?.toLowerCase() ?? ''));
          setAccounts(filtered);
          onConnectedChange?.(filtered.length > 0);
        } catch { /* ignore */ }
      }
      setReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openApple = async () => {
    await tauriOpenUrl('https://appleid.apple.com/account/manage');
    setStep('form');
  };

  const connect = async () => {
    const emailTrim = email.trim();
    if (!emailTrim || !password) { setError('Fill in both fields.'); return; }
    setBusy(true); setError(null);
    try {
      await tauriInvoke('imap_fetch', { host: ICLOUD_HOST, port: ICLOUD_PORT, username: emailTrim, password });
      await tauriInvoke('secret_set', { account: `imap:${emailTrim}`, value: password });
      const newAcc: ImapAccount = { email: emailTrim, host: ICLOUD_HOST, port: ICLOUD_PORT, lastSync: Date.now() };
      // Merge into shared imapAccounts store
      const stored = await getItem(IMAP_KEY);
      const all: ImapAccount[] = stored?.value ? JSON.parse(stored.value) : [];
      const next = [...all.filter(a => a.email !== emailTrim), newAcc];
      await saveAndSync(IMAP_KEY, next);
      const filtered = next.filter(a => ICLOUD_DOMAINS.has(a.email.split('@')[1]?.toLowerCase() ?? ''));
      setAccounts(filtered);
      onConnectedChange?.(filtered.length > 0);
      setEmail(''); setPassword(''); setStep('idle');
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  const disconnect = async (acc: ImapAccount) => {
    await tauriInvoke('secret_delete', { account: `imap:${acc.email}` });
    const stored = await getItem(IMAP_KEY);
    const all: ImapAccount[] = stored?.value ? JSON.parse(stored.value) : [];
    const next = all.filter(a => a.email !== acc.email);
    await saveAndSync(IMAP_KEY, next);
    const filtered = next.filter(a => ICLOUD_DOMAINS.has(a.email.split('@')[1]?.toLowerCase() ?? ''));
    setAccounts(filtered);
    onConnectedChange?.(filtered.length > 0);
  };

  if (!ready) return null;

  return (
    <Card
      t={t} color="#555" letter="" name="iCloud Mail"
      status={accounts.length ? `${accounts.length} account${accounts.length > 1 ? 's' : ''} connected` : 'Sync your iCloud inbox'}
      action={step === 'idle'
        ? <ConnectBtn t={t} onClick={openApple} label={accounts.length ? 'Add account' : 'Connect'} />
        : <button onClick={() => { setStep('idle'); setError(null); }} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', color: t.textMuted }}>Cancel</button>}
    >
      {accounts.map(acc => (
        <AccountRow
          key={acc.email} t={t} label={acc.email}
          subLabel={acc.lastSync ? `synced ${formatDistanceToNowStrict(acc.lastSync, { addSuffix: true })}` : 'not synced yet'}
          onDisconnect={() => disconnect(acc)}
        />
      ))}

      {step === 'form' && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.7rem', borderTop: `1px solid ${t.border}`, display: 'grid', gap: '0.45rem' }}>
          <div style={{ fontSize: '0.73rem', color: t.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: t.text }}>Apple ID page just opened.</strong> Go to{' '}
            <strong style={{ color: t.text }}>Sign-In & Security → App-Specific Passwords</strong>
            {' '}→ Generate one for "BOZZ", then paste it below.
          </div>
          <input
            value={email} onChange={e => setEmail(e.target.value)}
            placeholder="yourname@icloud.com"
            style={inp(t)}
          />
          <input
            value={password} onChange={e => setPassword(e.target.value)}
            type="password"
            placeholder="App-specific password  (xxxx-xxxx-xxxx-xxxx)"
            style={inp(t)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ConnectBtn t={t} busy={busy} onClick={connect} label="Connect & test" />
          </div>
          {error && <div style={{ fontSize: '0.72rem', color: t.alert }}>{error}</div>}
        </div>
      )}
    </Card>
  );
}

// ── IMAP (other inboxes) ──────────────────────────────────────────────────────

/** Well-known IMAP settings auto-detected from the email domain. */
const IMAP_PRESETS: Record<string, { host: string; port: number }> = {
  'yahoo.com':    { host: 'imap.mail.yahoo.com',    port: 993 },
  'yahoo.co.uk':  { host: 'imap.mail.yahoo.com',    port: 993 },
  'ymail.com':    { host: 'imap.mail.yahoo.com',    port: 993 },
  'fastmail.com': { host: 'imap.fastmail.com',      port: 993 },
  'fastmail.fm':  { host: 'imap.fastmail.com',      port: 993 },
  'zoho.com':     { host: 'imap.zoho.com',          port: 993 },
  'proton.me':    { host: '127.0.0.1',              port: 1143 }, // Proton Bridge
  'protonmail.com':{ host: '127.0.0.1',             port: 1143 },
  'pm.me':        { host: '127.0.0.1',              port: 1143 },
  'aol.com':      { host: 'imap.aol.com',           port: 993 },
  'gmx.com':      { host: 'imap.gmx.com',           port: 993 },
  'gmx.net':      { host: 'imap.gmx.net',           port: 993 },
};

function imapPreset(email: string): { host: string; port: number } | null {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return IMAP_PRESETS[domain] ?? null;
}

const IMAP_KEY = 'imapAccounts';

function ImapCard({ t, onConnectedChange }: { t: Theme; onConnectedChange?: (v: boolean) => void }) {
  const [accounts, setAccounts] = useState<ImapAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('993');
  const [autoHost, setAutoHost] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getItem(IMAP_KEY).then(r => {
      if (r?.value) {
        try {
          const all = JSON.parse(r.value) as ImapAccount[];
          const filtered = all.filter(a => !ICLOUD_DOMAINS.has(a.email.split('@')[1]?.toLowerCase() ?? ''));
          setAccounts(filtered);
          onConnectedChange?.(filtered.length > 0);
        } catch { /* ignore */ }
      }
      setReady(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill host when user types their email
  const handleEmailChange = (v: string) => {
    setEmail(v);
    const preset = imapPreset(v);
    if (preset) {
      setAutoHost(preset.host);
      setHost(preset.host);
      setPort(String(preset.port));
    } else {
      setAutoHost(null);
    }
  };

  const connect = async () => {
    const emailTrim = email.trim();
    const hostTrim = host.trim();
    const portNum = parseInt(port, 10);
    if (!emailTrim || !hostTrim || !portNum || !password) {
      setError('Fill in all fields.');
      return;
    }
    setBusy(true); setError(null);
    try {
      // Test connection — throws on bad credentials / host
      await tauriInvoke('imap_fetch', { host: hostTrim, port: portNum, username: emailTrim, password });
      // Store password in system keyring
      await tauriInvoke('secret_set', { account: `imap:${emailTrim}`, value: password });
      const newAccount: ImapAccount = { email: emailTrim, host: hostTrim, port: portNum, lastSync: Date.now() };
      const stored = await getItem(IMAP_KEY);
      const all: ImapAccount[] = stored?.value ? JSON.parse(stored.value) : [];
      const merged = [...all.filter(a => a.email !== emailTrim), newAccount];
      await saveAndSync(IMAP_KEY, merged);
      const filtered = merged.filter(a => !ICLOUD_DOMAINS.has(a.email.split('@')[1]?.toLowerCase() ?? ''));
      setAccounts(filtered);
      onConnectedChange?.(filtered.length > 0);
      setEmail(''); setPassword(''); setHost(''); setPort('993');
      setShowForm(false);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  const disconnect = async (acc: ImapAccount) => {
    await tauriInvoke('secret_delete', { account: `imap:${acc.email}` });
    const stored = await getItem(IMAP_KEY);
    const all: ImapAccount[] = stored?.value ? JSON.parse(stored.value) : [];
    const next = all.filter(a => a.email !== acc.email);
    await saveAndSync(IMAP_KEY, next);
    const filtered = next.filter(a => !ICLOUD_DOMAINS.has(a.email.split('@')[1]?.toLowerCase() ?? ''));
    setAccounts(filtered);
    onConnectedChange?.(filtered.length > 0);
  };

  if (!ready) return null;

  const needsHost = email.includes('@') && !autoHost;

  return (
    <Card
      t={t} color="#6B7280" letter="@" name="Other inbox"
      status={accounts.length
        ? `${accounts.length} account${accounts.length > 1 ? 's' : ''} connected`
        : 'Yahoo, Fastmail, Zoho, any IMAP'}
      action={!showForm
        ? <ConnectBtn t={t} onClick={() => setShowForm(true)} label={accounts.length ? 'Add account' : 'Connect'} />
        : <button onClick={() => { setShowForm(false); setError(null); }} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', color: t.textMuted }}>Cancel</button>}
    >
      {accounts.map(acc => (
        <AccountRow
          key={acc.email} t={t} label={acc.email}
          subLabel={acc.lastSync ? `synced ${formatDistanceToNowStrict(acc.lastSync, { addSuffix: true })}` : 'not synced yet'}
          onDisconnect={() => disconnect(acc)}
        />
      ))}

      {showForm && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.7rem', borderTop: `1px solid ${t.border}`, display: 'grid', gap: '0.45rem' }}>
          <input
            value={email} onChange={e => handleEmailChange(e.target.value)}
            placeholder="Email address"
            style={inp(t)}
          />
          <input
            value={password} onChange={e => setPassword(e.target.value)}
            type="password"
            placeholder={autoHost?.includes('127.0.0.1')
              ? 'Proton Bridge password'
              : 'App password (not your main password)'}
            style={inp(t)}
          />
          {needsHost && (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input value={host} onChange={e => setHost(e.target.value)} placeholder="IMAP host  e.g. mail.example.com" style={{ ...inp(t), flex: 3 }} />
              <input value={port} onChange={e => setPort(e.target.value)} placeholder="993" style={{ ...inp(t), flex: 1 }} />
            </div>
          )}
          {autoHost && (
            <div style={{ fontSize: '0.7rem', color: t.doneAccent }}>
              ✓ Server detected: {autoHost}:{port}
            </div>
          )}
          {!autoHost && !needsHost && !email.includes('@') && (
            <div style={{ fontSize: '0.7rem', color: t.textDim }}>
              Use an <strong style={{ color: t.text }}>app password</strong>, not your main account password.
              For iCloud: appleid.apple.com → Sign-In & Security → App-Specific Passwords.
              For Yahoo: account.yahoo.com → Security → Generate app password.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ConnectBtn t={t} busy={busy} onClick={connect} label="Connect & test" />
          </div>
          {error && <div style={{ fontSize: '0.72rem', color: t.alert }}>{error}</div>}
        </div>
      )}
    </Card>
  );
}

// ── Google Calendar ───────────────────────────────────────────────────────────

function GoogleCalendarCard({ t, connections, onChange, bank }: {
  t: Theme;
  connections: CalendarConnection[];
  onChange: (next: CalendarConnection[]) => void;
  bank: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = connections.filter(c => c.provider === 'googleCalendar');
  const configured = Boolean(ENV.gcalClientId && ENV.gcalClientSecret);

  const connect = async () => {
    if (!ENV.gcalClientId || !ENV.gcalClientSecret) return;
    setBusy(true); setError(null);
    try {
      const { connectGoogle } = await import('../../../lib/oauth/google');
      const result = await connectGoogle(
        ENV.gcalClientId, ENV.gcalClientSecret,
        ['https://www.googleapis.com/auth/calendar.readonly'],
        `gcal:${ENV.gcalClientId}`,
      );
      const conn: CalendarConnection = {
        provider: 'googleCalendar', email: result.email,
        connectedAt: Date.now(), lastSync: null, enabled: true,
      };
      onChange([...connections.filter(c => !(c.provider === 'googleCalendar' && c.email === result.email)), conn]);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  const disconnect = (email: string) =>
    onChange(connections.filter(c => !(c.provider === 'googleCalendar' && c.email === email)));

  return (
    <Card
      t={t} color="#4285F4" letter="G" name="Google Calendar"
      status={connected.length ? `${connected.length} account${connected.length > 1 ? 's' : ''} connected` : 'Sync your Google calendars'}
      action={configured
        ? <ConnectBtn t={t} busy={busy} onClick={connect} label={connected.length ? 'Add account' : 'Connect'} />
        : undefined}
    >
      {connected.map(c => (
        <AccountRow
          key={c.email} t={t} label={c.email}
          subLabel={c.lastSync ? `synced ${formatDistanceToNowStrict(c.lastSync, { addSuffix: true })}` : 'connected — events coming soon'}
          onDisconnect={() => disconnect(c.email)}
          color={c.color}
          onColorChange={(col) => onChange(connections.map(x =>
            x.provider === 'googleCalendar' && x.email === c.email ? { ...x, color: col } : x
          ))}
          bank={bank}
        />
      ))}
      {!configured && <DevNote t={t} vars={['VITE_GCAL_CLIENT_ID', 'VITE_GCAL_CLIENT_SECRET']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>{error}</div>}
    </Card>
  );
}

// ── Apple Calendar ────────────────────────────────────────────────────────────

function AppleCalendarCard({ t, connections, onChange, bank }: {
  t: Theme;
  connections: CalendarConnection[];
  onChange: (next: CalendarConnection[]) => void;
  bank: string[];
}) {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = connections.filter(c => c.provider === 'appleCalendar');

  const connect = async () => {
    const e = email.trim();
    if (!e || !password) { setError('Fill in both fields.'); return; }
    setBusy(true); setError(null);
    try {
      await secretSet(`caldav:${e}`, password);
      const conn: CalendarConnection = {
        provider: 'appleCalendar', email: e,
        connectedAt: Date.now(), lastSync: null, enabled: true,
      };
      onChange([...connections.filter(c => !(c.provider === 'appleCalendar' && c.email === e)), conn]);
      setEmail(''); setPassword(''); setShowForm(false);
    } catch (err) { setError(String(err)); }
    setBusy(false);
  };

  const disconnect = async (email: string) => {
    try { await secretDelete(`caldav:${email}`); } catch { /* ignore */ }
    onChange(connections.filter(c => !(c.provider === 'appleCalendar' && c.email === email)));
  };

  if (isWeb()) {
    return (
      <Card t={t} color="#555" letter="" name="Apple Calendar"
        status="Desktop app only — CalDAV requires direct server access"
        action={null}>
        <div style={{ fontSize: '0.75rem', color: t.textMuted, marginTop: '0.35rem' }}>
          Apple Calendar requires the desktop app. Open BOZZ on your Mac or PC to connect.
        </div>
      </Card>
    );
  }

  return (
    <Card
      t={t} color="#555" letter="" name="Apple Calendar"
      status={connected.length ? `${connected.length} account${connected.length > 1 ? 's' : ''} connected` : 'Sync your iCloud calendars'}
      action={!showForm
        ? <ConnectBtn t={t} onClick={() => { tauriOpenUrl('https://appleid.apple.com/account/manage'); setShowForm(true); }} label={connected.length ? 'Add account' : 'Connect'} />
        : <button onClick={() => { setShowForm(false); setError(null); }} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', color: t.textMuted }}>Cancel</button>}
    >
      {connected.map(c => (
        <AccountRow
          key={c.email} t={t} label={c.email}
          subLabel={c.lastSync ? `synced ${formatDistanceToNowStrict(c.lastSync, { addSuffix: true })}` : 'connected — events coming soon'}
          onDisconnect={() => void disconnect(c.email)}
          color={c.color}
          onColorChange={(col) => onChange(connections.map(x =>
            x.provider === 'appleCalendar' && x.email === c.email ? { ...x, color: col } : x
          ))}
          bank={bank}
        />
      ))}
      {showForm && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.7rem', borderTop: `1px solid ${t.border}`, display: 'grid', gap: '0.45rem' }}>
          <div style={{ fontSize: '0.73rem', color: t.textMuted, lineHeight: 1.6 }}>
            <strong style={{ color: t.text }}>Apple ID page just opened.</strong> Go to{' '}
            <strong style={{ color: t.text }}>Sign-In & Security → App-Specific Passwords</strong>
            {' '}→ Generate one for "BOZZ", then enter it below.
          </div>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@icloud.com" style={inp(t)} />
          <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="App-specific password (xxxx-xxxx-xxxx-xxxx)" style={inp(t)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <ConnectBtn t={t} busy={busy} onClick={connect} label="Connect & test" />
          </div>
          {error && <div style={{ fontSize: '0.72rem', color: t.alert }}>{error}</div>}
        </div>
      )}
    </Card>
  );
}

// ── Google Fit ────────────────────────────────────────────────────────────────

function GoogleFitCard({ t, connections, onChange }: {
  t: Theme;
  connections: HealthConnection[];
  onChange: (next: HealthConnection[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = connections.filter(c => c.provider === 'googleFit');
  const configured = Boolean(ENV.gfitClientId && ENV.gfitClientSecret);

  const connect = async () => {
    if (!ENV.gfitClientId || !ENV.gfitClientSecret) return;
    setBusy(true); setError(null);
    try {
      const { connectGoogle } = await import('../../../lib/oauth/google');
      await connectGoogle(
        ENV.gfitClientId, ENV.gfitClientSecret,
        ['https://www.googleapis.com/auth/fitness.activity.read', 'https://www.googleapis.com/auth/fitness.sleep.read'],
        `gfit:${ENV.gfitClientId}`,
      );
      const conn: HealthConnection = { provider: 'googleFit', connectedAt: Date.now(), lastSync: null };
      onChange([...connections.filter(c => c.provider !== 'googleFit'), conn]);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  const disconnect = () => onChange(connections.filter(c => c.provider !== 'googleFit'));

  return (
    <Card
      t={t} color="#4285F4" letter="G" name="Google Fit"
      status={connected.length ? '● Connected — steps & sleep synced' : 'Sync steps, sleep & activity'}
      action={connected.length
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : configured
          ? <ConnectBtn t={t} busy={busy} onClick={connect} />
          : undefined}
    >
      {!configured && <DevNote t={t} vars={['VITE_GFIT_CLIENT_ID', 'VITE_GFIT_CLIENT_SECRET']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>{error}</div>}
    </Card>
  );
}

// ── Apple Health ──────────────────────────────────────────────────────────────

function AppleHealthCard({ t, connections, onChange }: {
  t: Theme;
  connections: HealthConnection[];
  onChange: (next: HealthConnection[]) => void;
}) {
  const connected = connections.filter(c => c.provider === 'appleHealth');
  const disconnect = () => onChange(connections.filter(c => c.provider !== 'appleHealth'));

  return (
    <Card
      t={t} color="#fc3c44" letter="" name="Apple Health"
      status={connected.length ? '● Connected' : 'Steps, sleep & heart rate from iPhone'}
      action={connected.length
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : (
          <button
            disabled
            style={{
              background: t.bgAlt, color: t.textMuted, border: `1px solid ${t.border}`,
              borderRadius: '8px', padding: '0.5rem 1.15rem', fontSize: '0.82rem',
              fontFamily: 'inherit', cursor: 'not-allowed', fontWeight: 500, opacity: 0.6,
            }}
          >
            Coming soon
          </button>
        )}
    >
      {!connected.length && (
        <div style={{
          marginTop: '0.7rem', fontSize: '0.72rem', color: t.textDim, lineHeight: 1.6,
          background: t.input, borderRadius: '7px', padding: '0.5rem 0.7rem',
        }}>
          Apple HealthKit is only available on iOS. A companion iPhone app is planned for a future release.
          Until then, use the <strong style={{ color: t.text }}>Health section</strong> to log data manually.
        </div>
      )}
    </Card>
  );
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────

function WhatsAppCard({ t, onConnectedChange }: { t: Theme; onConnectedChange?: (v: boolean) => void }) {
  const [connected, setConnected] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const configured = isWAConfigured();

  // Get current user id from Supabase session
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // On mount, check if already connected
  useEffect(() => {
    if (!userId || !configured) { setReady(true); return; }
    getWASessionStatus(userId).then(s => {
      if (s.connected) { setConnected(true); setPhone(s.phone ?? null); onConnectedChange?.(true); }
      setReady(true);
    }).catch(() => setReady(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, configured]);

  // Poll for QR → connected transition
  useEffect(() => {
    if (!scanning || !userId) return;
    const id = setInterval(async () => {
      try {
        const s = await getWASessionStatus(userId);
        if (s.qr && s.qr !== qr) setQr(s.qr);
        if (s.connected) {
          clearInterval(id);
          setConnected(true); setPhone(s.phone ?? null);
          setQr(null); setScanning(false);
          await saveAndSync('waAccount', { userId, phone: s.phone, name: s.name });
          onConnectedChange?.(true);
        }
      } catch { /* bridge may be temporarily unreachable */ }
    }, 3000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, userId]);

  const startConnect = async () => {
    if (!userId) return;
    setError(null); setScanning(true);
    try {
      const s = await startWASession(userId);
      if (s.connected) {
        setConnected(true); setPhone(s.phone ?? null); setScanning(false);
        await saveAndSync('waAccount', { userId, phone: s.phone });
        onConnectedChange?.(true);
      } else if (s.qr) {
        setQr(s.qr);
      }
    } catch (e) { setError(String(e).replace('Error: ', '')); setScanning(false); }
  };

  const disconnect = async () => {
    if (userId) { try { await deleteWASession(userId); } catch { /* ignore */ } }
    await deleteItem('waAccount');
    setConnected(false); setPhone(null); setQr(null); setScanning(false);
    onConnectedChange?.(false);
  };

  const cancel = () => { setScanning(false); setQr(null); setError(null); };

  if (!ready) return null;

  return (
    <Card
      t={t} color="#25D366" letter="W" name="WhatsApp"
      status={connected
        ? `● ${phone ? `+${phone}` : 'Connected'}`
        : scanning ? 'Scan the QR code with your phone' : 'Recent messages widget'}
      action={connected
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : scanning
          ? <button onClick={cancel} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', color: t.textMuted }}>Cancel</button>
          : configured
            ? <ConnectBtn t={t} onClick={startConnect} />
            : undefined}
    >
      {/* QR code */}
      {scanning && qr && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.7rem', borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
          <img src={qr} alt="WhatsApp QR" style={{ width: 180, height: 180, borderRadius: '10px', border: `1px solid ${t.border}` }} />
          <div style={{ fontSize: '0.73rem', color: t.textMuted, textAlign: 'center', lineHeight: 1.55 }}>
            Open <strong style={{ color: t.text }}>WhatsApp</strong> on your phone →{' '}
            <strong style={{ color: t.text }}>Linked devices</strong> → Link a device → scan above
          </div>
        </div>
      )}
      {scanning && !qr && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.73rem', color: t.textMuted, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
          Generating QR code…
        </div>
      )}
      {/* Not configured — dev note (web only; desktop always has local bridge) */}
      {!configured && !isWeb() && <DevNote t={t} vars={['VITE_WA_BACKEND_URL']} />}
      {!configured && isWeb() && (
        <div style={{ marginTop: '0.7rem', fontSize: '0.72rem', color: t.textDim, lineHeight: 1.6, background: t.input, borderRadius: '7px', padding: '0.5rem 0.7rem' }}>
          WhatsApp requires the desktop app, or a deployed bridge.<br />
          Add <code style={{ background: t.bgAlt, padding: '0.05rem 0.3rem', borderRadius: '3px', fontSize: '0.68rem' }}>VITE_WA_BACKEND_URL</code> to enable on web.
        </div>
      )}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>{error}</div>}
    </Card>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ t, label }: { t: Theme; label: string }) {
  return (
    <div style={{
      fontSize: '0.62rem', color: t.textDim, letterSpacing: '0.12em',
      textTransform: 'uppercase', padding: '0.6rem 0 0.4rem',
      borderBottom: `1px solid ${t.border}`, marginBottom: '0.65rem',
    }}>
      {label}
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function IntegrationsBlock({
  t, oauthAccounts, emailSyncErrors, onConnectAccount, onDisconnectAccount,
  calendarConnections, onCalendarConnectionsChange,
  healthConnections, onHealthConnectionsChange,
  colorBank,
}: IntegrationsProps) {
  const bank = colorBank ?? [];
  // Track connected state for storage-based services (loaded async)
  const [localConn, setLocalConn] = useState({ spotify: false, notion: false, icloud: false, imap: false, whatsapp: false });

  // Determine connected state for every service
  const isConnected = {
    gmail:    oauthAccounts.some(a => a.provider === 'gmail'),
    outlook:  oauthAccounts.some(a => a.provider === 'outlook'),
    gcal:     calendarConnections.some(c => c.provider === 'googleCalendar'),
    acal:     calendarConnections.some(c => c.provider === 'appleCalendar'),
    gfit:     healthConnections.some(h => h.provider === 'googleFit'),
    ahealth:  healthConnections.some(h => h.provider === 'appleHealth'),
    spotify:   localConn.spotify,
    notion:    localConn.notion,
    icloud:    localConn.icloud,
    imap:      localConn.imap,
    whatsapp:  localConn.whatsapp,
  };

  const anyConnected = Object.values(isConnected).some(Boolean);

  // Shared card props
  const gmailCard = (
    <GmailCard
      key="gmail" t={t} accounts={oauthAccounts} syncErrors={emailSyncErrors}
      onConnect={(cid, cs) => onConnectAccount('gmail', cid, cs)}
      onDisconnect={email => onDisconnectAccount('gmail', email)}
    />
  );
  const outlookCard = (
    <OutlookCard
      key="outlook" t={t} accounts={oauthAccounts} syncErrors={emailSyncErrors}
      onConnect={cid => onConnectAccount('outlook', cid, '')}
      onDisconnect={email => onDisconnectAccount('outlook', email)}
    />
  );
  const icloudCard = <ICloudCard key="icloud" t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, icloud: v }))} />;
  const imapCard   = <ImapCard   key="imap"   t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, imap: v }))} />;
  const spotifyCard = <SpotifyCard key="spotify" t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, spotify: v }))} />;
  const notionCard    = <NotionCard    key="notion"    t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, notion: v }))} />;
  const whatsappCard  = <WhatsAppCard  key="whatsapp"  t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, whatsapp: v }))} />;
  const gcalCard   = <GoogleCalendarCard  key="gcal"    t={t} connections={calendarConnections} onChange={onCalendarConnectionsChange} bank={bank} />;
  const acalCard   = <AppleCalendarCard   key="acal"    t={t} connections={calendarConnections} onChange={onCalendarConnectionsChange} bank={bank} />;
  const gfitCard   = <GoogleFitCard       key="gfit"    t={t} connections={healthConnections}   onChange={onHealthConnectionsChange} />;
  const ahealthCard = <AppleHealthCard    key="ahealth" t={t} connections={healthConnections}   onChange={onHealthConnectionsChange} />;

  const allCards: Array<{ id: keyof typeof isConnected; node: React.ReactNode }> = [
    { id: 'gmail',   node: gmailCard },
    { id: 'outlook', node: outlookCard },
    { id: 'icloud',  node: icloudCard },
    { id: 'imap',    node: imapCard },
    { id: 'gcal',    node: gcalCard },
    { id: 'acal',    node: acalCard },
    { id: 'spotify', node: spotifyCard },
    { id: 'notion',  node: notionCard },
    { id: 'gfit',      node: gfitCard },
    { id: 'ahealth',   node: ahealthCard },
    { id: 'whatsapp',  node: whatsappCard },
  ];

  const connected  = allCards.filter(c => isConnected[c.id]);
  const available  = allCards.filter(c => !isConnected[c.id]);

  return (
    <div>
      {anyConnected && (
        <>
          <SectionLabel t={t} label="Connected" />
          {connected.map(c => c.node)}
        </>
      )}
      <SectionLabel t={t} label={anyConnected ? 'Available to connect' : 'Connect a service'} />
      {available.map(c => c.node)}
    </div>
  );
}