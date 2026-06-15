import { Widget, EmptyWidget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import { deadlineLabel, isOverdue } from '../../lib/dates';
import { deadlineEntries } from './util';
import type { WidgetCtx } from './context';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default function UpcomingDeadlinesWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, setActiveSection } = ctx;
  const now = Date.now();
  const cutoff = now + WINDOW_MS;
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const upcoming = deadlineEntries(ctx)
    .filter(e => e.item.deadline != null && e.item.deadline >= startOfToday.getTime() && e.item.deadline <= cutoff)
    .sort((a, b) => (a.item.deadline ?? 0) - (b.item.deadline ?? 0));

  // Show as many items as fit; cap row height so text never overflows widget bounds
  const maxItems = Math.max(3, Math.min(upcoming.length, 8));

  return (
    <Widget t={t} accent={sectionAccents.home}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {upcoming.length === 0
          ? <EmptyWidget text="nothing due in the next 7 days" t={t} />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {upcoming.slice(0, maxItems).map(e => {
                const overdue = e.item.deadline != null && isOverdue(e.item.deadline);
                return (
                  <button
                    key={`${e.section}-${e.item.id}`}
                    onClick={() => setActiveSection(e.section)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      padding: '0.2rem 0', fontFamily: 'inherit', textAlign: 'left',
                      width: '100%', minHeight: 0, overflow: 'hidden',
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: e.accent, flexShrink: 0 }} />
                    <span style={{
                      flex: 1, fontSize: '0.8rem', color: t.text,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {e.item.text}
                    </span>
                    <span style={{
                      fontSize: '0.68rem', whiteSpace: 'nowrap', flexShrink: 0,
                      color: overdue ? t.alert : t.textMuted,
                    }}>
                      {e.item.deadline != null ? deadlineLabel(e.item.deadline) : ''}
                    </span>
                  </button>
                );
              })}
              {upcoming.length > maxItems && (
                <span style={{ fontSize: '0.68rem', color: t.textDim, paddingTop: '0.1rem' }}>
                  +{upcoming.length - maxItems} more
                </span>
              )}
            </div>
          )}
      </div>
    </Widget>
  );
}