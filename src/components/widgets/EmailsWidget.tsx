import { Mail } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { Widget, WidgetHeader, EmptyWidget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import type { WidgetCtx } from './context';

const PROVIDER_DOT: Record<string, string> = { gmail: '#d36b5a', outlook: '#5a7bd3' };

/** Top 2 emails by importance score (computed during sync). */
export default function EmailsWidget({ ctx }: { ctx: WidgetCtx }) {
  const top = [...ctx.emails]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 2);

  return (
    <Widget t={ctx.t} accent={sectionAccents.email} onClick={() => ctx.setActiveSection('email')}>
      <WidgetHeader label="Email" accent={sectionAccents.email} t={ctx.t} icon={Mail} />
      {top.length === 0
        ? <EmptyWidget text="nothing important right now" t={ctx.t} />
        : (
          <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.5rem' }}>
            {top.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: m.unread ? (PROVIDER_DOT[m.provider] ?? ctx.t.borderStrong) : 'transparent',
                  border: m.unread ? 'none' : `1px solid ${ctx.t.textDim}`,
                  transform: 'translateY(-1px)',
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
                <span style={{ fontSize: '0.65rem', color: ctx.t.textDim, flexShrink: 0 }}>
                  {formatDistanceToNowStrict(m.date)}
                </span>
              </div>
            ))}
          </div>
        )}
    </Widget>
  );
}
