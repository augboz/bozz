import { RefreshCw, ExternalLink, MailOpen, Archive, Trash2 } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import type { EmailMessage, OAuthAccount, Theme } from '../../../lib/types';
import { SectionHeader, EmptyState } from '../../shared/ui';

interface EmailViewProps {
  t: Theme;
  accounts: OAuthAccount[];
  messages: EmailMessage[];
  syncing: boolean;
  lastSync: number | null;
  onRefresh: () => void;
  onMarkRead: (m: EmailMessage) => void;
  onArchive: (m: EmailMessage) => void;
  onDelete: (m: EmailMessage) => void;
  onOpen: (m: EmailMessage) => void;
}

const PROVIDER_DOT: Record<string, string> = {
  gmail: '#d36b5a',
  outlook: '#5a7bd3',
};

export default function EmailView({
  t, accounts, messages, syncing, lastSync, onRefresh, onMarkRead, onArchive, onDelete, onOpen,
}: EmailViewProps) {

  if (accounts.length === 0) {
    return (
      <div>
        <SectionHeader title="Email" t={t} />
        <p style={{ color: t.textDim, fontSize: '0.85rem', fontStyle: 'italic' }}>
          No accounts connected. Open Settings → Connected accounts to connect Gmail or Outlook.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Email"
        t={t}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.7rem', color: t.textDim }}>
              {syncing ? 'syncing…' : lastSync ? `synced ${formatDistanceToNowStrict(lastSync, { addSuffix: true })}` : 'not synced'}
            </span>
            <button
              onClick={onRefresh}
              disabled={syncing}
              aria-label="Refresh"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px',
                padding: '0.35rem 0.65rem', color: t.textMuted,
                cursor: syncing ? 'wait' : 'pointer',
                fontFamily: 'inherit', fontSize: '0.72rem',
              }}
            >
              <RefreshCw size={12} strokeWidth={1.5} /> Refresh
            </button>
          </div>
        }
      />

      <div style={{ display: 'grid', gap: '0.4rem', minWidth: 0 }}>
        {messages.map(m => (
          <div key={m.id} style={{
            display: 'flex', alignItems: 'center', gap: '0.65rem',
            background: m.unread ? t.todoBg : 'transparent',
            border: `1px solid ${t.border}`,
            borderLeft: `3px solid ${PROVIDER_DOT[m.provider] ?? t.borderStrong}`,
            borderRadius: '8px', padding: '0.7rem 0.85rem',
            minWidth: 0,
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: m.unread ? PROVIDER_DOT[m.provider] : 'transparent',
              border: m.unread ? 'none' : `1px solid ${t.textDim}`,
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', minWidth: 0 }}>
                <span style={{
                  fontSize: '0.82rem', color: t.text,
                  fontWeight: m.unread ? 500 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flexShrink: 1, maxWidth: '32%', minWidth: 0,
                }}>
                  {m.fromName || m.fromEmail}
                </span>
                <span style={{
                  flex: 1, minWidth: 0,
                  fontSize: '0.82rem', color: t.text,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m.subject || '(no subject)'}
                </span>
                <span style={{ fontSize: '0.7rem', color: t.textDim, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {formatDistanceToNowStrict(m.date, { addSuffix: true })}
                </span>
              </div>
              <div style={{
                fontSize: '0.72rem', color: t.textMuted, marginTop: '0.2rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                minWidth: 0,
              }}>
                {m.snippet}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.05rem', flexShrink: 0 }}>
              {m.unread && (
                <button onClick={() => onMarkRead(m)} title="Mark read" aria-label="Mark read" style={iconBtn(t)}>
                  <MailOpen size={13} strokeWidth={1.5} />
                </button>
              )}
              <button onClick={() => onArchive(m)} title="Archive" aria-label="Archive" style={iconBtn(t)}>
                <Archive size={13} strokeWidth={1.5} />
              </button>
              <button onClick={() => onDelete(m)} title="Delete (move to trash)" aria-label="Delete" style={iconBtn(t)}>
                <Trash2 size={13} strokeWidth={1.5} />
              </button>
              <button onClick={() => onOpen(m)} title="Open" aria-label="Open" style={iconBtn(t)}>
                <ExternalLink size={13} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        ))}
        {messages.length === 0 && !syncing && <EmptyState text="inbox zero ✦" t={t} />}
      </div>
    </div>
  );
}

function iconBtn(t: Theme): React.CSSProperties {
  return {
    background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer',
    padding: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
  };
}
