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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

function getAvatarColor(name: string, provider: string): string {
  if (provider === 'gmail') return '#d36b5a';
  if (provider === 'outlook') return '#5a7bd3';
  const colors = ['#8aaab8', '#8ab4d4', '#a8c4a0', '#c8a87a', '#8ab8c0', '#86b89a'];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

export default function EmailView({
  t, accounts, messages, syncing, lastSync, onRefresh, onMarkRead, onArchive, onDelete, onOpen,
}: EmailViewProps) {
  const unreadCount = messages.filter(m => m.unread).length;

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
        title="Inbox"
        t={t}
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {unreadCount > 0 && (
              <span style={{
                fontSize: '0.65rem', color: t.textMuted,
                background: t.bgAlt, border: `1px solid ${t.border}`,
                borderRadius: '999px', padding: '0.15rem 0.6rem',
              }}>
                {unreadCount} unread
              </span>
            )}
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {messages.map(m => {
          const displayName = m.fromName || m.fromEmail;
          const initials = getInitials(displayName);
          const avatarColor = getAvatarColor(displayName, m.provider);
          return (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: m.unread ? t.todoBg : t.bgAlt,
                border: `1px solid ${m.unread ? t.borderStrong : t.border}`,
                borderRadius: '10px', padding: '0.75rem 0.9rem',
                minWidth: 0,
              }}
            >
              {/* Avatar */}
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                background: avatarColor + '28',
                border: `1px solid ${avatarColor}50`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 600, color: avatarColor,
              }}>
                {initials}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.85rem', color: m.unread ? t.text : t.textMuted,
                    fontWeight: m.unread ? 500 : 400,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}>
                    {displayName}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: t.textDim, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {formatDistanceToNowStrict(m.date, { addSuffix: true })}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: m.unread ? t.text : t.textMuted,
                  fontWeight: m.unread ? 400 : 300,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  marginTop: '0.1rem',
                }}>
                  {m.subject || '(no subject)'}
                </div>
                {m.snippet && (
                  <div style={{
                    fontSize: '0.72rem', color: t.textDim, marginTop: '0.1rem',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.snippet}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.1rem', flexShrink: 0 }}>
                {m.unread && (
                  <button onClick={() => onMarkRead(m)} title="Mark read" aria-label="Mark read" style={iconBtn(t)}>
                    <MailOpen size={14} strokeWidth={1.5} />
                  </button>
                )}
                <button onClick={() => onArchive(m)} title="Archive" aria-label="Archive" style={iconBtn(t)}>
                  <Archive size={14} strokeWidth={1.5} />
                </button>
                <button onClick={() => onDelete(m)} title="Delete" aria-label="Delete" style={iconBtn(t)}>
                  <Trash2 size={14} strokeWidth={1.5} />
                </button>
                <button onClick={() => onOpen(m)} title="Open" aria-label="Open" style={iconBtn(t)}>
                  <ExternalLink size={14} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && !syncing && <EmptyState text="inbox zero ✦" t={t} />}
      </div>
    </div>
  );
}

function iconBtn(t: Theme): React.CSSProperties {
  return {
    background: 'transparent', border: 'none', color: t.textMuted, cursor: 'pointer',
    padding: '0.35rem', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', transition: 'color 0.1s',
  };
}
