import { formatDistanceToNowStrict } from 'date-fns';
import { Widget, EmptyWidget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import type { WidgetCtx } from './context';
import type { EmailMessage } from '../../lib/types';

const PROVIDER_DOT: Record<string, string> = { gmail: '#d36b5a', outlook: '#5a7bd3' };

type EmailFilter = { accountEmail: string; count: number };

/**
 * How many email rows fit in a widget of height `h` grid rows.
 * Formula accounts for: grid item height (h×80−16), widget padding (48px),
 * header + gap (34px), and per-row height including gap (~44px).
 */
function maxEmailsForHeight(h: number): number {
  const available = h * 80 - 16 - 48 - 34; // px available for email rows
  return Math.max(1, Math.floor(available / 44));
}

function getDisplayEmails(emails: EmailMessage[], widgetConfig: Record<string, unknown>): EmailMessage[] {
  const filters = widgetConfig.filters as EmailFilter[] | undefined;
  const cap = maxEmailsForHeight((widgetConfig._h as number | undefined) ?? 3);

  if (!filters || filters.length === 0) {
    return [...emails]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, cap);
  }

  // Per-account: take top N per account, then cap total to what fits
  const perAccount = filters.flatMap(f =>
    [...emails]
      .filter(m => m.accountEmail === f.accountEmail)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, Math.min(f.count, cap)),
  );
  return perAccount.slice(0, cap);
}

/** Emails widget — respects per-instance account/count config set during edit mode. */
export default function EmailsWidget({ ctx }: { ctx: WidgetCtx }) {
  const displayed = getDisplayEmails(ctx.emails, ctx.widgetConfig);

  return (
    <Widget t={ctx.t} accent={sectionAccents.email} onClick={() => ctx.setActiveSection('email')}>
      {displayed.length === 0
        ? <EmptyWidget text="nothing important right now" t={ctx.t} />
        : (
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflow: 'hidden' }}>
            {displayed.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', minWidth: 0 }}>
                {/* unread dot */}
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  marginTop: '5px',
                  background: m.unread ? (PROVIDER_DOT[m.provider] ?? ctx.t.borderStrong) : 'transparent',
                  border: m.unread ? 'none' : `1px solid ${ctx.t.textDim}`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.82rem', color: ctx.t.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.fromName || m.fromEmail}
                  </div>
                  <div style={{
                    fontSize: '0.72rem', color: ctx.t.textMuted,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {m.subject || '(no subject)'}
                  </div>
                </div>
                <span style={{ fontSize: '0.65rem', color: ctx.t.textDim, flexShrink: 0, marginTop: '3px' }}>
                  {formatDistanceToNowStrict(m.date)}
                </span>
              </div>
            ))}
          </div>
        )}
    </Widget>
  );
}
