import { format } from 'date-fns';
import { Mail, ArrowRight } from 'lucide-react';
import { Widget, WidgetHeader, EmptyWidget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import type { WidgetCtx } from './context';
import type { EmailMessage } from '../../lib/types';

type EmailFilter = { accountEmail: string; count: number };

function maxEmailsForHeight(h: number): number {
  // h grid units × (32px row + 16px gap) − widget padding − header − footer
  const available = h * 48 - 16 - 48 - 34;
  return Math.max(1, Math.floor(available / 54));
}

function getDisplayEmails(emails: EmailMessage[], widgetConfig: Record<string, unknown>): EmailMessage[] {
  const filters = widgetConfig.filters as EmailFilter[] | undefined;
  const cap = maxEmailsForHeight((widgetConfig._h as number | undefined) ?? 3);

  if (!filters || filters.length === 0) {
    return [...emails]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, cap);
  }

  const perAccount = filters.flatMap(f =>
    [...emails]
      .filter(m => m.accountEmail === f.accountEmail)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, Math.min(f.count, cap)),
  );
  return perAccount.slice(0, cap);
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

export default function EmailsWidget({ ctx }: { ctx: WidgetCtx }) {
  const displayed = getDisplayEmails(ctx.emails, ctx.widgetConfig);
  const unreadCount = displayed.filter(m => m.unread).length;

  return (
    <Widget t={ctx.t} accent={sectionAccents.email}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <WidgetHeader label="Inbox" accent={sectionAccents.email} t={ctx.t} icon={Mail} />
        {unreadCount > 0 && (
          <span style={{
            fontSize: '0.65rem', fontWeight: 500, color: sectionAccents.email,
            background: sectionAccents.email + '1c',
            borderRadius: '999px', padding: '0.15rem 0.55rem',
          }}>
            {unreadCount} unread
          </span>
        )}
      </div>

      {displayed.length === 0
        ? <EmptyWidget text="nothing important right now" t={ctx.t} />
        : (
          <>
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.55rem', overflow: 'hidden' }}>
              {displayed.map(m => {
                const displayName = m.fromName || m.fromEmail;
                const initials = getInitials(displayName);
                const avatarColor = getAvatarColor(displayName, m.provider);
                return (
                  <div
                    key={m.id}
                    onClick={() => ctx.setActiveSection('email')}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', minWidth: 0, cursor: 'pointer' }}
                  >
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                      background: avatarColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.68rem', fontWeight: 700, color: '#fff',
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.4rem' }}>
                        <div style={{
                          fontSize: '0.82rem',
                          color: m.unread ? ctx.t.text : ctx.t.textMuted,
                          fontWeight: m.unread ? 600 : 400,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {displayName}
                        </div>
                        <span style={{ fontSize: '0.62rem', color: ctx.t.textDim, flexShrink: 0 }}>
                          {format(m.date, 'h:mm a')}
                        </span>
                      </div>
                      <div style={{
                        fontSize: '0.75rem',
                        color: m.unread ? ctx.t.text : ctx.t.textMuted,
                        fontWeight: m.unread ? 500 : 300,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                      }}>
                        {m.subject || '(no subject)'}
                      </div>
                      {m.snippet && (
                        <div style={{
                          fontSize: '0.68rem', color: ctx.t.textDim,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {m.snippet}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => ctx.setActiveSection('email')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.3rem',
                marginTop: '0.65rem',
                background: 'none', border: 'none', cursor: 'pointer',
                color: ctx.t.textMuted, fontFamily: 'inherit', fontSize: '0.72rem',
                padding: 0, transition: 'color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = sectionAccents.email)}
              onMouseLeave={e => (e.currentTarget.style.color = ctx.t.textMuted)}
            >
              View all emails
              <ArrowRight size={11} strokeWidth={1.5} />
            </button>
          </>
        )}
    </Widget>
  );
}
