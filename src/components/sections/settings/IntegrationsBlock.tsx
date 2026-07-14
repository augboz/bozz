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
import { X, RefreshCw, ChevronDown } from 'lucide-react';
import { isWeb, isTauri } from '../../../lib/platform';
import { platformFetch } from '../../../lib/http';
import { apiFetch } from '../../../lib/apiClient';
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
import { OUTLOOK_CLIENT_ID, OUTLOOK_USES_BORROWED_ID } from '../../../lib/oauth/outlook';
import { secretDelete, secretSet, tokenKey } from '../../../lib/oauth/keyring';
import ColorBankPicker from '../../shared/ColorBankPicker';
import { BrandLogo, type BrandId } from './brandLogos';
import { randomString } from '../../../lib/oauth/pkce';
import { formatDistanceToNowStrict } from 'date-fns';
import type { CalendarConnection, EmailProvider, HealthConnection, ImapAccount, OAuthAccount, SpotifyAccount, Theme } from '../../../lib/types';

// ── Sync helper ───────────────────────────────────────────────────────────────
// IntegrationsBlock writes directly to storage (not through Dashboard state),
// so it must trigger its own Supabase push after each save.
async function saveAndSync(key: string, value: unknown): Promise<void> {
  await setItem(key, JSON.stringify(value));
  const { data: { user } } = await supabase.auth.getUser();
  if (user) schedulePush(user.id);
}

// ── Env vars (set once in .env.local) ────────────────────────────────────────

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://bozz-app.vercel.app';

const ENV = {
  gmailClientId:        import.meta.env.VITE_GMAIL_CLIENT_ID       as string | undefined,
  outlookClientId:      import.meta.env.VITE_OUTLOOK_CLIENT_ID      as string | undefined,
  spotifyClientId:      import.meta.env.VITE_SPOTIFY_CLIENT_ID      as string | undefined,
  notionClientId:       import.meta.env.VITE_NOTION_CLIENT_ID       as string | undefined,
  /** Base URL of the deployed Vercel redirect proxy, e.g. https://bozz-app.vercel.app */
  notionRedirectBase:   import.meta.env.VITE_NOTION_REDIRECT_URL    as string | undefined,
  gcalClientId:         import.meta.env.VITE_GCAL_CLIENT_ID         as string | undefined,
  gfitClientId:         import.meta.env.VITE_GFIT_CLIENT_ID         as string | undefined,
  stravaClientId:       import.meta.env.VITE_STRAVA_CLIENT_ID       as string | undefined,
  zoomClientId:         import.meta.env.VITE_ZOOM_CLIENT_ID         as string | undefined,
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface IntegrationsProps {
  t: Theme;
  colorBank?: string[];
  oauthAccounts: OAuthAccount[];
  emailSyncErrors: Array<{ account: string; error: string }>;
  onConnectAccount:    (provider: EmailProvider, clientId: string, email?: string) => Promise<void>;
  onDisconnectAccount: (provider: EmailProvider, email: string) => Promise<void>;
  calendarConnections: CalendarConnection[];
  onCalendarConnectionsChange: (next: CalendarConnection[]) => void;
  healthConnections: HealthConnection[];
  onHealthConnectionsChange: (next: HealthConnection[]) => void;
  /** Optional free-text filter — matches app names (used by the Apps page search). */
  searchQuery?: string;
  /** 'grid' lays cards out in a responsive ~3-col grid; 'list' (default) stacks them. */
  variant?: 'list' | 'grid';
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inp = (t: Theme): React.CSSProperties => ({
  background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
  padding: '0.55rem 0.75rem', color: t.text, fontSize: '0.82rem',
  fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
});

// Layout mode — Card reads this so grid cards stretch to a uniform height (the
// Apps page lays the same cards out in a grid; Settings stacks them in a list).
const CardLayout = React.createContext<'list' | 'grid'>('list');

// ── ServiceCard ───────────────────────────────────────────────────────────────

function ServiceIcon({ brand, color, letter }: { brand?: BrandId; color: string; letter: string }) {
  // Real brand logo on a neutral "app tile" — reads correctly on light & dark.
  if (brand) {
    return (
      <div style={{
        width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0,
        background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.07)',
        overflow: 'hidden',
      }}>
        <BrandLogo id={brand} size={24} />
      </div>
    );
  }
  // Fallback: coloured initial (used if a card has no brand mark).
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

/** Wrapper card for each service.
 *
 *  Not-yet-connected cards show their `action` (Connect) inline in the header.
 *
 *  Connected cards (`connected`) read as compact as the available ones: the
 *  header shows only the name + status + a dropdown arrow, and a light-green
 *  border marks them as connected. Everything else — the `action`
 *  (Add account / Disconnect), the account-detail rows (`details`) and any
 *  forms/errors (`children`) — collapses behind the arrow. */
function Card({
  t, color, letter, brand, name, status, action, details, connected,
  children,
}: {
  t: Theme; color: string; letter: string; brand?: BrandId; name: string;
  status?: React.ReactNode; action?: React.ReactNode;
  details?: React.ReactNode;
  connected?: boolean;
  children?: React.ReactNode;
}) {
  const grid = React.useContext(CardLayout) === 'grid';
  const [hover, setHover] = React.useState(false);
  // Connected cards collapse their body behind the arrow. In the cramped Apps
  // grid they start collapsed (clean, uniform); in the roomy Settings list they
  // start open so managing accounts stays one glance away.
  const [open, setOpen] = React.useState(!grid);
  const hasDetails = React.Children.toArray(details).length > 0;

  const chevron = (
    <button
      onClick={() => setOpen(o => !o)}
      aria-expanded={open}
      aria-label={open ? 'Hide account details' : 'Show account details'}
      title={open ? 'Hide account details' : 'Show account details'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted,
        padding: '0.25rem', display: 'flex', flexShrink: 0,
      }}
    >
      <ChevronDown
        size={16} strokeWidth={1.7}
        style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}
      />
    </button>
  );

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: `1px solid ${connected
          ? (hover ? t.doneAccent : t.doneBorder)
          : (hover ? t.borderStrong : t.border)}`,
        borderRadius: '14px',
        padding: '0.9rem 1rem', marginBottom: grid ? 0 : '0.65rem',
        background: hover ? (connected ? t.doneBg : t.bgAlt) : 'transparent',
        transform: hover ? 'translateY(-1px)' : 'none',
        transition: 'border-color 0.25s, background 0.25s, transform 0.25s',
        // In the grid, fill the cell so every card in a row is the same height,
        // with a baseline min-height so collapsed cards read as a uniform set.
        ...(grid ? { height: '100%', minHeight: '112px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' as const } : {}),
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ServiceIcon brand={brand} color={color} letter={letter} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', color: t.text, fontWeight: 600 }}>{name}</div>
          {status && (
            <div style={{ fontSize: '0.73rem', color: t.textMuted, marginTop: '0.1rem' }}>
              {status}
            </div>
          )}
        </div>
        {/* Connected → a single arrow reveals the body. Not connected → the
            inline Connect action (plus an arrow only if there are details). */}
        {connected ? chevron : (
          <>
            {action}
            {hasDetails && chevron}
          </>
        )}
      </div>

      {connected ? (
        open && (
          <div>
            {details}
            {action && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.7rem' }}>
                {action}
              </div>
            )}
            {children}
          </div>
        )
      ) : (
        <>
          {hasDetails && open && <div>{details}</div>}
          {children}
        </>
      )}
    </div>
  );
}

function ConnectBtn({ t, label = 'Connect', busy, onClick, disabled, errored }: {
  t: Theme; label?: string; busy?: boolean; onClick: () => void; disabled?: boolean; errored?: boolean;
}) {
  const showError = Boolean(errored) && !busy;
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      style={{
        background: showError ? 'transparent' : t.text,
        color: showError ? t.alert : t.bg,
        border: showError ? `1px solid ${t.alertBorder}` : 'none',
        borderRadius: '999px',
        padding: '0.5rem 1.15rem', fontSize: '0.82rem', fontFamily: 'inherit',
        cursor: busy || disabled ? 'wait' : 'pointer', fontWeight: 600,
        opacity: busy || disabled ? 0.55 : 1, flexShrink: 0,
        transition: 'opacity 0.15s',
      }}
    >
      {busy ? 'Connecting…' : showError ? 'Try connect again' : label}
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

/** Shown when the env var for a service hasn't been added yet. Hidden in the
 *  grid (Apps page) so cards stay a uniform size — the hint still shows in the
 *  Settings list, where a developer wires env vars. */
function DevNote({ t, vars }: { t: Theme; vars: string[] }) {
  if (React.useContext(CardLayout) === 'grid') return null;
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
  onConnect: (cid: string) => Promise<void>;
  onDisconnect: (email: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = accounts.filter(a => a.provider === 'gmail');
  const configured = Boolean(ENV.gmailClientId);

  const connect = async () => {
    if (!ENV.gmailClientId) return;
    setBusy(true); setError(null);
    try {
      await onConnect(ENV.gmailClientId);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  return (
    <Card
      t={t} brand="gmail" color="#EA4335" letter="G" name="Gmail" connected={connected.length > 0}
      status={connected.length ? `${connected.length} account${connected.length > 1 ? 's' : ''} connected` : 'Sync your inbox'}
      action={configured
        ? <ConnectBtn t={t} busy={busy} onClick={connect} label={connected.length ? 'Add account' : 'Connect'} errored={Boolean(error)} />
        : undefined}
      details={connected.map(a => {
        const err = syncErrors.find(e => e.account === a.email)?.error;
        const needsReauth = err?.includes('invalid_grant') || err?.includes('expired') || err?.includes('revoked');
        return (
          <AccountRow
            key={a.email} t={t} label={a.email}
            subLabel={a.lastSync ? `synced ${formatDistanceToNowStrict(a.lastSync, { addSuffix: true })}` : 'not synced yet'}
            error={needsReauth ? 'Session expired. Click Re-authorize' : err}
            onDisconnect={() => onDisconnect(a.email)}
            onReauth={needsReauth && configured ? async () => {
              setBusy(true);
              try { await onConnect(ENV.gmailClientId!); } catch { /* ignore */ }
              setBusy(false);
            } : undefined}
          />
        );
      })}
    >
      {!configured && <DevNote t={t} vars={['VITE_GMAIL_CLIENT_ID']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>Failed to connect. Please try again.</div>}
    </Card>
  );
}

// ── Outlook ───────────────────────────────────────────────────────────────────

function OutlookCard({ t, accounts, syncErrors, onConnect, onDisconnect }: {
  t: Theme;
  accounts: OAuthAccount[];
  syncErrors: Array<{ account: string; error: string }>;
  onConnect: (cid: string, email: string) => Promise<void>;
  onDisconnect: (email: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const connected = accounts.filter(a => a.provider === 'outlook');
  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  // IMAP needs a native TLS socket, which only the desktop build has.
  const desktop = isTauri();

  const connect = async () => {
    if (!emailValid || !desktop) return;
    setBusy(true); setError(null);
    try { await onConnect(OUTLOOK_CLIENT_ID, email.trim()); setEmail(''); }
    catch (e) { setError(String(e)); }
    setBusy(false);
  };

  return (
    <Card
      t={t} brand="outlook" color="#0078D4" letter="M" name="Outlook / Hotmail" connected={connected.length > 0}
      status={connected.length ? `${connected.length} account${connected.length > 1 ? 's' : ''} connected` : 'Sync your inbox'}
      details={connected.map(a => {
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
    >
      {!desktop ? (
        <div style={{
          marginTop: '0.7rem', fontSize: '0.72rem', color: t.textDim, lineHeight: 1.6,
          background: t.input, borderRadius: '7px', padding: '0.5rem 0.7rem',
        }}>
          Outlook email works in the desktop app only. Open Bozz on your Mac or PC to connect.
        </div>
      ) : (
        <div style={{ marginTop: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@outlook.com"
              autoCapitalize="off" autoCorrect="off" spellCheck={false}
              onKeyDown={e => { if (e.key === 'Enter' && emailValid && !busy) connect(); }}
              style={{
                flex: 1, minWidth: 0, background: t.input, border: `1px solid ${t.border}`,
                borderRadius: '7px', padding: '0.42rem 0.6rem', color: t.text,
                fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={connect}
              disabled={!emailValid || busy}
              style={{
                flexShrink: 0, background: emailValid && !busy ? t.doneAccent : t.input,
                border: `1px solid ${emailValid && !busy ? t.doneAccent : t.border}`,
                color: emailValid && !busy ? '#fff' : t.textDim,
                borderRadius: '7px', padding: '0.42rem 0.85rem',
                fontSize: '0.78rem', fontWeight: 500, fontFamily: 'inherit',
                cursor: emailValid && !busy ? 'pointer' : 'default',
              }}
            >
              {busy ? 'Connecting…' : connected.length ? 'Add account' : 'Connect'}
            </button>
          </div>
          <div style={{
            fontSize: '0.72rem', color: t.textDim, lineHeight: 1.6,
            background: t.input, borderRadius: '7px', padding: '0.5rem 0.7rem',
          }}>
            You'll sign in on Microsoft's own website, so your password never touches Bozz.
            {OUTLOOK_USES_BORROWED_ID && (
              <> The approval screen shows <strong style={{ color: t.text }}>Mozilla Thunderbird</strong> — that's the trusted open-source mail connector Bozz uses to reach Outlook without a Microsoft developer account. It's safe to approve.</>
            )}
          </div>
        </div>
      )}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>Couldn't connect. Check the address and try again.</div>}
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
      t={t} brand="spotify" color="#1DB954" letter="S" name="Spotify" connected={Boolean(account)}
      status={account ? `● ${account.displayName}` : 'Now playing widget'}
      action={account
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : configured
          ? <ConnectBtn t={t} busy={busy} onClick={connect} errored={Boolean(error)} />
          : undefined}
    >
      {!configured && <DevNote t={t} vars={['VITE_SPOTIFY_CLIENT_ID']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>Failed to connect. Please try again.</div>}
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
 *   https://bozz-app.vercel.app/api/notion-redirect
 */
async function connectNotionOAuth(
  clientId: string,
  redirectBase: string,
): Promise<string> {
  const redirectUri = `${redirectBase.replace(/\/$/, '')}/api/notion-redirect`;
  const state = randomString(24);

  // Start listening for the port event BEFORE invoking to prevent the race.
  let portReject: (e: Error) => void = () => {};
  const portPromise = new Promise<void>((resolve, reject) => {
    portReject = reject;
    const timer = setTimeout(
      () => reject(new Error('OAuth timed out. Click Try again')),
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
      portReject(new Error('Port still held from previous attempt. Click Try again'));
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
  if (params.state !== state) throw new Error('State mismatch. Possible CSRF');

  // Token exchange via server proxy — Notion client secret stays server-side
  const tokenRes = await apiFetch(`${API_BASE}/api/notion-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: params.code, redirect_uri: redirectUri }),
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
  const [showManualToken, setShowManualToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const oauthReady = Boolean(ENV.notionClientId && ENV.notionRedirectBase);
  const grid = React.useContext(CardLayout) === 'grid';

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
    if (!ENV.notionClientId || !ENV.notionRedirectBase) return;
    if (isWeb()) {
      setError('OAuth connect requires the desktop app. Use the integration token below instead.');
      return;
    }
    setBusy(true); setError(null);
    try {
      if (releaseFirst) await releaseNotionPort();
      const token = await connectNotionOAuth(ENV.notionClientId, ENV.notionRedirectBase);
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

  const tokenRow = (
    <div style={{ display: 'flex', gap: '0.4rem' }}>
      <input value={tokenInput} onChange={e => setTokenInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && saveToken()}
        placeholder="ntn_… or secret_…" style={{ ...inp(t), flex: 1 }} />
      <ConnectBtn t={t} label="Connect" busy={busy} onClick={saveToken} />
    </div>
  );

  return (
    <Card
      t={t} brand="notion" color="#3d3d3d" letter="N" name="Notion" connected={isConnected}
      status={isConnected
        ? `● Connected · ${selectedIds.size} page${selectedIds.size !== 1 ? 's' : ''} in widget`
        : 'View your workspace pages'}
      action={isConnected
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : oauthReady
          ? <ConnectBtn t={t} busy={busy} onClick={connectOAuth} errored={Boolean(error)} />
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

      {/* Manual integration-token connect. Offered when not connected — but only
          in the Settings list, not the Apps grid (keeps grid cards uniform; the
          one-click OAuth Connect button is the grid path). */}
      {!isConnected && !grid && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.7rem', borderTop: `1px solid ${t.border}` }}>
          {oauthReady && !showManualToken ? (
            <button
              onClick={() => setShowManualToken(true)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                color: t.textMuted, fontSize: '0.73rem', fontFamily: 'inherit',
                textDecoration: 'underline', textUnderlineOffset: '2px',
              }}
            >
              Or connect with an integration token
            </button>
          ) : (
            <>
              <p style={{ fontSize: '0.73rem', color: t.textMuted, margin: '0 0 0.5rem', lineHeight: 1.5 }}>
                Create an integration at{' '}
                <strong style={{ color: t.text }}>notion.so/profile/integrations</strong>, copy its
                Internal Integration Secret and paste it here. Then open each page →{' '}
                <strong style={{ color: t.text }}>···</strong> → Connections → add your integration.
              </p>
              {tokenRow}
            </>
          )}
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

// ── Strava / Zoom (generic OAuth-window connectors) ──────────────────────────
// Both providers exchange their code with a client secret, so (like Notion) the
// token round-trip goes through the Vercel proxy. Same UX/structure as every
// other connector; gated on an env client ID until the founder adds one.

/** Generic in-app OAuth-window flow — same approach as connectNotionOAuth:
 *  open the provider's consent page in an isolated window, capture the code on
 *  the local Rust server via the Vercel redirect proxy, exchange it server-side
 *  at /api/<provider>-token. Returns the access token. */
async function connectOAuthWindow(opts: {
  provider: string; clientId: string; authorizeBase: string; scope: string;
  redirectBase: string; extraAuthParams?: Record<string, string>;
}): Promise<string> {
  const redirectUri = `${opts.redirectBase.replace(/\/$/, '')}/api/oauth-redirect`;
  const state = randomString(24);

  let portReject: (e: Error) => void = () => {};
  const portPromise = new Promise<void>((resolve, reject) => {
    portReject = reject;
    const timer = setTimeout(() => reject(new Error('OAuth timed out. Click Try again')), 8000);
    let unlisten: (() => void) | null = null;
    tauriListen<number>('oauth:port', () => { clearTimeout(timer); if (unlisten) unlisten(); resolve(); }).then(fn => { unlisten = fn; });
  });
  const runPromise = tauriInvoke<Record<string, string>>('oauth_run', { port: NOTION_LOCAL_PORT });
  runPromise.catch((e: unknown) => portReject(new Error(String(e))));
  await portPromise;

  const authUrl = opts.authorizeBase + '?' + new URLSearchParams({
    client_id: opts.clientId, response_type: 'code', redirect_uri: redirectUri,
    scope: opts.scope, state, ...(opts.extraAuthParams ?? {}),
  }).toString();
  const win = await tauriWebviewWindow(`${opts.provider}-oauth-${Date.now()}`, {
    url: authUrl, title: `Connect ${opts.provider}`, width: 540, height: 740, center: true, resizable: true,
  });
  void runPromise.finally(() => { void win.close(); });

  const params = await runPromise;
  if (params.error) throw new Error(`${opts.provider}: ${params.error}`);
  if (!params.code || params.state !== state) throw new Error('OAuth failed. Please try again');

  const res = await apiFetch(`${API_BASE}/api/${opts.provider}-token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: params.code, redirect_uri: redirectUri }),
  });
  if (!res.ok) throw new Error(`${opts.provider} token exchange failed: ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error(`${opts.provider} returned no token`);
  return json.access_token;
}

function StravaCard({ t, onConnectedChange }: { t: Theme; onConnectedChange?: (v: boolean) => void }) {
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getItem('stravaAccount').then(r => { if (r?.value) { setConnected(true); onConnectedChange?.(true); } setReady(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    if (!ENV.stravaClientId) { setError('Strava needs setup. Add VITE_STRAVA_CLIENT_ID and an /api/strava-token endpoint.'); return; }
    if (isWeb()) { setError('Connect requires the desktop app.'); return; }
    setBusy(true); setError(null);
    try {
      const token = await connectOAuthWindow({
        provider: 'strava', clientId: ENV.stravaClientId,
        authorizeBase: 'https://www.strava.com/oauth/authorize',
        scope: 'read,activity:read', redirectBase: API_BASE,
        extraAuthParams: { approval_prompt: 'auto' },
      });
      await saveAndSync('stravaAccount', { token, connectedAt: Date.now() });
      setConnected(true); onConnectedChange?.(true);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  const disconnect = async () => { await deleteItem('stravaAccount'); setConnected(false); onConnectedChange?.(false); };

  if (!ready) return null;
  return (
    <Card
      t={t} brand="strava" color="#FC4C02" letter="S" name="Strava" connected={connected}
      status={connected ? '● Connected' : 'Your runs, rides & activity'}
      action={connected
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : <ConnectBtn t={t} busy={busy} onClick={connect} errored={Boolean(error)} />}
    >
      {!ENV.stravaClientId && <DevNote t={t} vars={['VITE_STRAVA_CLIENT_ID']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>Failed to connect. Please try again.</div>}
    </Card>
  );
}

function ZoomCard({ t, onConnectedChange }: { t: Theme; onConnectedChange?: (v: boolean) => void }) {
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getItem('zoomAccount').then(r => { if (r?.value) { setConnected(true); onConnectedChange?.(true); } setReady(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    if (!ENV.zoomClientId) { setError('Zoom needs setup. Add VITE_ZOOM_CLIENT_ID and an /api/zoom-token endpoint.'); return; }
    if (isWeb()) { setError('Connect requires the desktop app.'); return; }
    setBusy(true); setError(null);
    try {
      const token = await connectOAuthWindow({
        provider: 'zoom', clientId: ENV.zoomClientId,
        authorizeBase: 'https://zoom.us/oauth/authorize', scope: '', redirectBase: API_BASE,
      });
      await saveAndSync('zoomAccount', { token, connectedAt: Date.now() });
      setConnected(true); onConnectedChange?.(true);
    } catch (e) { setError(String(e)); }
    setBusy(false);
  };

  const disconnect = async () => { await deleteItem('zoomAccount'); setConnected(false); onConnectedChange?.(false); };

  if (!ready) return null;
  return (
    <Card
      t={t} brand="zoom" color="#2D8CFF" letter="Z" name="Zoom" connected={connected}
      status={connected ? '● Connected' : 'Your meetings on the dashboard'}
      action={connected
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : <ConnectBtn t={t} busy={busy} onClick={connect} errored={Boolean(error)} />}
    >
      {!ENV.zoomClientId && <DevNote t={t} vars={['VITE_ZOOM_CLIENT_ID']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>Failed to connect. Please try again.</div>}
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
      t={t} brand="icloud" color="#555" letter="" name="iCloud Mail" connected={accounts.length > 0}
      status={accounts.length ? `${accounts.length} account${accounts.length > 1 ? 's' : ''} connected` : 'Sync your iCloud inbox'}
      action={step === 'idle'
        ? <ConnectBtn t={t} onClick={openApple} label={accounts.length ? 'Add account' : 'Connect'} />
        : <button onClick={() => { setStep('idle'); setError(null); }} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', color: t.textMuted }}>Cancel</button>}
      details={accounts.map(acc => (
        <AccountRow
          key={acc.email} t={t} label={acc.email}
          subLabel={acc.lastSync ? `synced ${formatDistanceToNowStrict(acc.lastSync, { addSuffix: true })}` : 'not synced yet'}
          onDisconnect={() => disconnect(acc)}
        />
      ))}
    >

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
      t={t} brand="imap" color="#6B7280" letter="@" name="Other inbox" connected={accounts.length > 0}
      status={accounts.length
        ? `${accounts.length} account${accounts.length > 1 ? 's' : ''} connected`
        : 'Yahoo, Fastmail, Zoho, any IMAP'}
      action={!showForm
        ? <ConnectBtn t={t} onClick={() => setShowForm(true)} label={accounts.length ? 'Add account' : 'Connect'} />
        : <button onClick={() => { setShowForm(false); setError(null); }} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', color: t.textMuted }}>Cancel</button>}
      details={accounts.map(acc => (
        <AccountRow
          key={acc.email} t={t} label={acc.email}
          subLabel={acc.lastSync ? `synced ${formatDistanceToNowStrict(acc.lastSync, { addSuffix: true })}` : 'not synced yet'}
          onDisconnect={() => disconnect(acc)}
        />
      ))}
    >

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
  const configured = Boolean(ENV.gcalClientId);

  const connect = async () => {
    if (!ENV.gcalClientId) return;
    setBusy(true); setError(null);
    try {
      const { connectGoogle } = await import('../../../lib/oauth/google');
      const result = await connectGoogle(
        ENV.gcalClientId,
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
      t={t} brand="gcal" color="#4285F4" letter="G" name="Google Calendar" connected={connected.length > 0}
      status={connected.length ? `${connected.length} account${connected.length > 1 ? 's' : ''} connected` : 'Sync your Google calendars'}
      action={configured
        ? <ConnectBtn t={t} busy={busy} onClick={connect} label={connected.length ? 'Add account' : 'Connect'} errored={Boolean(error)} />
        : undefined}
      details={connected.map(c => (
        <AccountRow
          key={c.email} t={t} label={c.email}
          subLabel={c.lastSync ? `synced ${formatDistanceToNowStrict(c.lastSync, { addSuffix: true })}` : 'connected, events coming soon'}
          onDisconnect={() => disconnect(c.email)}
          color={c.color}
          onColorChange={(col) => onChange(connections.map(x =>
            x.provider === 'googleCalendar' && x.email === c.email ? { ...x, color: col } : x
          ))}
          bank={bank}
        />
      ))}
    >
      {!configured && <DevNote t={t} vars={['VITE_GCAL_CLIENT_ID']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>Failed to connect. Please try again.</div>}
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
      <Card t={t} brand="acal" color="#555" letter="" name="Apple Calendar"
        status="Desktop app only. CalDAV requires direct server access"
        action={null}>
        <div style={{ fontSize: '0.75rem', color: t.textMuted, marginTop: '0.35rem' }}>
          Apple Calendar requires the desktop app. Open BOZZ on your Mac or PC to connect.
        </div>
      </Card>
    );
  }

  return (
    <Card
      t={t} brand="acal" color="#555" letter="" name="Apple Calendar" connected={connected.length > 0}
      status={connected.length ? `${connected.length} account${connected.length > 1 ? 's' : ''} connected` : 'Sync your iCloud calendars'}
      action={!showForm
        ? <ConnectBtn t={t} onClick={() => { tauriOpenUrl('https://appleid.apple.com/account/manage'); setShowForm(true); }} label={connected.length ? 'Add account' : 'Connect'} />
        : <button onClick={() => { setShowForm(false); setError(null); }} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.78rem', fontFamily: 'inherit', cursor: 'pointer', color: t.textMuted }}>Cancel</button>}
      details={connected.map(c => (
        <AccountRow
          key={c.email} t={t} label={c.email}
          subLabel={c.lastSync ? `synced ${formatDistanceToNowStrict(c.lastSync, { addSuffix: true })}` : 'connected, events coming soon'}
          onDisconnect={() => void disconnect(c.email)}
          color={c.color}
          onColorChange={(col) => onChange(connections.map(x =>
            x.provider === 'appleCalendar' && x.email === c.email ? { ...x, color: col } : x
          ))}
          bank={bank}
        />
      ))}
    >
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
  const configured = Boolean(ENV.gfitClientId);

  const connect = async () => {
    if (!ENV.gfitClientId) return;
    setBusy(true); setError(null);
    try {
      const { connectGoogle } = await import('../../../lib/oauth/google');
      await connectGoogle(
        ENV.gfitClientId,
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
      t={t} brand="gfit" color="#4285F4" letter="G" name="Google Fit" connected={connected.length > 0}
      status={connected.length ? '● Connected, steps & sleep synced' : 'Sync steps, sleep & activity'}
      action={connected.length
        ? <DisconnectBtn t={t} onClick={disconnect} />
        : configured
          ? <ConnectBtn t={t} busy={busy} onClick={connect} errored={Boolean(error)} />
          : undefined}
    >
      {!configured && <DevNote t={t} vars={['VITE_GFIT_CLIENT_ID']} />}
      {error && <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: t.alert }}>Failed to connect. Please try again.</div>}
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
      t={t} brand="ahealth" color="#fc3c44" letter="" name="Apple Health" connected={connected.length > 0}
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
  colorBank, searchQuery, variant = 'list',
}: IntegrationsProps) {
  const bank = colorBank ?? [];
  // Track connected state for storage-based services (loaded async)
  const [localConn, setLocalConn] = useState({ spotify: false, notion: false, icloud: false, imap: false, strava: false, zoom: false });

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
    strava:    localConn.strava,
    zoom:      localConn.zoom,
  };

  // Shared card props
  const gmailCard = (
    <div key="gmail" data-onb="gmail-card">
      <GmailCard
        t={t} accounts={oauthAccounts} syncErrors={emailSyncErrors}
        onConnect={cid => onConnectAccount('gmail', cid)}
        onDisconnect={email => onDisconnectAccount('gmail', email)}
      />
    </div>
  );
  const outlookCard = (
    <OutlookCard
      key="outlook" t={t} accounts={oauthAccounts} syncErrors={emailSyncErrors}
      onConnect={(cid, email) => onConnectAccount('outlook', cid, email)}
      onDisconnect={email => onDisconnectAccount('outlook', email)}
    />
  );
  const icloudCard = <ICloudCard key="icloud" t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, icloud: v }))} />;
  const imapCard   = <div key="imap" data-onb="imap-card"><ImapCard t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, imap: v }))} /></div>;
  const spotifyCard = <div key="spotify" data-onb="connector-spotify"><SpotifyCard t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, spotify: v }))} /></div>;
  const notionCard    = <div key="notion" data-onb="connector-notion"><NotionCard    t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, notion: v }))} /></div>;
  const stravaCard = <StravaCard key="strava" t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, strava: v }))} />;
  const zoomCard   = <ZoomCard   key="zoom"   t={t} onConnectedChange={v => setLocalConn(c => ({ ...c, zoom: v }))} />;
  const gcalCard   = <div key="gcal" data-onb="connector-gcal"><GoogleCalendarCard  t={t} connections={calendarConnections} onChange={onCalendarConnectionsChange} bank={bank} /></div>;
  const acalCard   = <div key="acal" data-onb="connector-acal"><AppleCalendarCard   t={t} connections={calendarConnections} onChange={onCalendarConnectionsChange} bank={bank} /></div>;
  const gfitCard   = <GoogleFitCard       key="gfit"    t={t} connections={healthConnections}   onChange={onHealthConnectionsChange} />;
  const ahealthCard = <AppleHealthCard    key="ahealth" t={t} connections={healthConnections}   onChange={onHealthConnectionsChange} />;

  // Temporarily hidden integrations — not functional yet, so don't surface them
  // in the connected-apps UI. Remove an id from this set to bring it back.
  const HIDDEN_INTEGRATIONS = new Set(['gfit', 'ahealth']);

  // `name`/`keywords` drive the Apps-page search filter.
  const allCards: Array<{ id: keyof typeof isConnected; name: string; keywords?: string; node: React.ReactNode }> = [
    { id: 'gmail',   name: 'Gmail',           keywords: 'google email mail',          node: gmailCard },
    { id: 'outlook', name: 'Outlook / Hotmail', keywords: 'microsoft email mail hotmail', node: outlookCard },
    { id: 'icloud',  name: 'iCloud Mail',     keywords: 'apple email mail',           node: icloudCard },
    { id: 'imap',    name: 'Other inbox',     keywords: 'imap email mail',            node: imapCard },
    { id: 'gcal',    name: 'Google Calendar', keywords: 'google calendar gcal',       node: gcalCard },
    { id: 'acal',    name: 'Apple Calendar',  keywords: 'apple icloud calendar caldav', node: acalCard },
    { id: 'spotify', name: 'Spotify',         keywords: 'music',                      node: spotifyCard },
    { id: 'notion',  name: 'Notion',          keywords: 'notes docs',                 node: notionCard },
    { id: 'strava',  name: 'Strava',          keywords: 'fitness sport running cycling exercise health', node: stravaCard },
    { id: 'zoom',    name: 'Zoom',            keywords: 'meetings video calls conference',               node: zoomCard },
    { id: 'gfit',    name: 'Google Fit',      keywords: 'google health fitness',      node: gfitCard },
    { id: 'ahealth', name: 'Apple Health',    keywords: 'apple health fitness',       node: ahealthCard },
  ];

  const q = (searchQuery ?? '').trim().toLowerCase();
  const match = (c: { name: string; keywords?: string }) =>
    !q || c.name.toLowerCase().includes(q) || (c.keywords ?? '').includes(q);

  const connected = allCards.filter(c => !HIDDEN_INTEGRATIONS.has(c.id) && isConnected[c.id] && match(c));
  const available = allCards.filter(c => !HIDDEN_INTEGRATIONS.has(c.id) && !isConnected[c.id] && match(c));

  const gridStyle: React.CSSProperties | undefined = variant === 'grid'
    ? { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.65rem', alignItems: 'stretch' }
    : undefined;

  return (
    <CardLayout.Provider value={variant}>
    <div>
      {connected.length > 0 && (
        <>
          <SectionLabel t={t} label="Connected" />
          <div style={gridStyle}>{connected.map(c => c.node)}</div>
        </>
      )}
      {available.length > 0 && (
        <>
          <SectionLabel t={t} label={connected.length > 0 ? 'Available to connect' : 'Connect a service'} />
          <div style={gridStyle}>{available.map(c => c.node)}</div>
        </>
      )}
      {q && connected.length === 0 && available.length === 0 && (
        <div style={{ padding: '2rem 0', textAlign: 'center', color: t.textMuted, fontSize: '0.85rem' }}>
          No apps match “{searchQuery}”.
        </div>
      )}
    </div>
    </CardLayout.Provider>
  );
}