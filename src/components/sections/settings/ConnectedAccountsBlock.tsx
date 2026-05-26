import React, { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import type { EmailProvider, OAuthAccount, Theme } from '../../../lib/types';

interface Props {
  t: Theme;
  accounts: OAuthAccount[];
  syncErrors: Array<{ account: string; error: string }>;
  onConnect: (provider: EmailProvider, clientId: string, clientSecret: string) => Promise<void>;
  onDisconnect: (provider: EmailProvider, email: string) => Promise<void>;
}

const PROVIDER_LABEL: Record<EmailProvider, string> = { gmail: 'Gmail', outlook: 'Outlook' };

const GOOGLE_STEPS = [
  'Go to console.cloud.google.com and sign in.',
  'Top bar → "Select a project" → New project → any name → Create.',
  'Left menu: APIs & Services → Library → search "Gmail API" → Enable.',
  'Left menu: APIs & Services → OAuth consent screen → External → Create. Fill in App name + support email + developer email. Save and Continue through every screen until finished.',
  '⚠️ CRITICAL — still on the OAuth consent screen: go to the "Test users" step → + Add users → type in your own Gmail address → Save. If you skip this you will see "Access blocked: App not verified" when you try to sign in.',
  'Left menu: APIs & Services → Credentials → + Create credentials → OAuth client ID → Application type: Desktop app → Create.',
  'A dialog appears with your Client ID and Client secret — copy both and paste them in the fields below, then click Connect.',
];

const MICROSOFT_STEPS = [
  '⚠️ Personal Microsoft accounts only (Outlook.com / Hotmail / Live.com). Work or university accounts (e.g. @ic.ac.uk) are managed by IT — they cannot register apps on Azure without admin approval. If you only have a uni account, skip this.',
  'Open an incognito / private window → go to portal.azure.com → sign in with your PERSONAL Microsoft email. Using incognito prevents your browser from silently picking a cached work account.',
  'If you land on "You do not have access": click your avatar (top-right) → Switch directory → choose the "Default Directory" tied to your personal account.',
  'Top search bar → type "App registrations" → click it → + New registration.',
  'Name: "Bozz". Supported account types: choose "Accounts in any organizational directory … and personal Microsoft accounts (e.g. Skype, Xbox)". Leave Redirect URI blank. Click Register.',
  'Left sidebar → Manage → Authentication → + Add a platform → Mobile and desktop applications → tick the checkbox for "https://login.microsoftonline.com/common/oauth2/nativeclient" → Configure.',
  'Still on Authentication: scroll to "Advanced settings" → set "Allow public client flows" to Yes → Save.',
  'Left sidebar → Manage → API permissions → + Add a permission → Microsoft Graph → Delegated permissions → search and tick "Mail.ReadWrite" and "offline_access" → Add permissions.',
  'Left sidebar → Overview → copy the "Application (client) ID" → paste it in the field below → Connect (no client secret needed for this flow).',
];

export default function ConnectedAccountsBlock({ t, accounts, syncErrors, onConnect, onDisconnect }: Props) {
  return (
    <div>
      <ProviderRow t={t} provider="gmail" steps={GOOGLE_STEPS} needsSecret accounts={accounts}
        syncErrors={syncErrors} onConnect={onConnect} onDisconnect={onDisconnect} />
      <div style={{ height: '0.6rem' }} />
      <ProviderRow t={t} provider="outlook" steps={MICROSOFT_STEPS} needsSecret={false} accounts={accounts}
        syncErrors={syncErrors} onConnect={onConnect} onDisconnect={onDisconnect} />
    </div>
  );
}

function ProviderRow({
  t, provider, steps, needsSecret, accounts, syncErrors, onConnect, onDisconnect,
}: {
  t: Theme; provider: EmailProvider; steps: string[]; needsSecret: boolean;
  accounts: OAuthAccount[];
  syncErrors: Array<{ account: string; error: string }>;
  onConnect: (p: EmailProvider, cid: string, cs: string) => Promise<void>;
  onDisconnect: (p: EmailProvider, email: string) => Promise<void>;
}) {
  const [openGuide, setOpenGuide] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [reconnectingFor, setReconnectingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connected = accounts.filter(a => a.provider === provider);

  const inp: React.CSSProperties = {
    background: t.input, border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.5rem 0.7rem', color: t.text, fontSize: '0.8rem',
    fontFamily: 'inherit', outline: 'none',
  };
  const btn: React.CSSProperties = {
    background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
    padding: '0.45rem 0.85rem', color: t.textMuted, cursor: busy ? 'wait' : 'pointer',
    fontFamily: 'inherit', fontSize: '0.78rem',
  };

  const submit = async () => {
    const cid = clientId.trim();
    if (!cid) return;
    setBusy(true);
    setError(null);
    try {
      await onConnect(provider, cid, clientSecret.trim());
      setClientId(''); setClientSecret('');
    } catch (e) {
      setError(String(e));
    }
    setBusy(false);
  };

  const reconnect = async (a: OAuthAccount) => {
    setReconnectingFor(a.email);
    setError(null);
    try {
      await onConnect(a.provider, a.clientId, a.clientSecret);
    } catch (e) {
      setError(String(e));
    }
    setReconnectingFor(null);
  };

  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: '10px', padding: '0.9rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ fontSize: '0.92rem', color: t.text, fontWeight: 400 }}>{PROVIDER_LABEL[provider]}</div>
        <button onClick={() => setOpenGuide(o => !o)} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: '0.72rem',
        }}>
          {openGuide ? <ChevronDown size={13} strokeWidth={1.5}/> : <ChevronRight size={13} strokeWidth={1.5}/>}
          setup guide
        </button>
      </div>

      {openGuide && (
        <ol style={{
          margin: '0.6rem 0 0.85rem 1.2rem', padding: 0,
          color: t.textMuted, fontSize: '0.78rem', lineHeight: 1.55,
        }}>
          {steps.map((s, i) => <li key={i} style={{ marginBottom: '0.3rem' }}>{s}</li>)}
        </ol>
      )}

      {connected.length > 0 && (
        <div style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.75rem' }}>
          {connected.map(a => {
            const syncErr = syncErrors.find(e => e.account === a.email);
            return (
              <div key={a.email}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.6rem',
                  background: t.todoBg, border: `1px solid ${syncErr ? t.alertBorder : t.border}`,
                  borderRadius: syncErr ? '8px 8px 0 0' : '8px', padding: '0.45rem 0.7rem',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    background: syncErr ? t.alert : t.doneAccent,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', color: t.text }}>{a.email}</div>
                    <div style={{ fontSize: '0.68rem', color: syncErr ? t.alert : t.textDim }}>
                      {syncErr ? 'sync failed' : a.lastSync ? `synced ${formatDistanceToNowStrict(a.lastSync, { addSuffix: true })}` : 'not synced yet'}
                    </div>
                  </div>
                  <button
                    onClick={() => onDisconnect(a.provider, a.email)}
                    aria-label="Disconnect"
                    title="Disconnect"
                    style={{ background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer', padding: '0.2rem' }}
                  >
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
                {syncErr && (
                  <div style={{
                    background: t.todoBg, border: `1px solid ${t.alertBorder}`, borderTop: 'none',
                    borderRadius: '0 0 8px 8px', padding: '0.35rem 0.7rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                  }}>
                    <span style={{
                      fontSize: '0.68rem', color: t.alert, flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {syncErr.error}
                    </span>
                    <button
                      onClick={() => reconnect(a)}
                      disabled={reconnectingFor === a.email}
                      style={{
                        background: 'transparent', border: `1px solid ${t.alertBorder}`,
                        borderRadius: '6px', padding: '0.2rem 0.55rem',
                        color: t.alert, cursor: reconnectingFor === a.email ? 'wait' : 'pointer',
                        fontFamily: 'inherit', fontSize: '0.68rem', flexShrink: 0,
                      }}
                    >
                      {reconnectingFor === a.email ? 'opening…' : 'Reconnect'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID" style={inp} />
        {needsSecret && (
          <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="Client secret" style={inp} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.8rem' }}>
          {error
            ? <span style={{ fontSize: '0.7rem', color: t.alert, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{error}</span>
            : <span style={{ flex: 1 }} />}
          <button onClick={submit} disabled={busy} style={btn}>
            {busy ? 'connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
