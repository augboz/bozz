import { CalendarClock } from 'lucide-react';
import { Widget, WidgetHeader, EmptyWidget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import { deadlineLabel, isOverdue } from '../../lib/dates';
import { deadlineEntries } from './util';
import type { WidgetCtx } from './context';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export default function UpcomingDeadlinesWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, setActiveSection } = ctx;
  const cutoff = Date.now() + WINDOW_MS;

  const upcoming = deadlineEntries(ctx)
    .filter(e => e.item.deadline != null && e.item.deadline <= cutoff)
    .sort((a, b) => (a.item.deadline ?? 0) - (b.item.deadline ?? 0));

  return (
    <Widget t={t} accent={sectionAccents.home}>
      <WidgetHeader label="Upcoming" accent={sectionAccents.home} t={t} icon={CalendarClock} />
      {upcoming.length === 0
        ? <EmptyWidget text="nothing due in the next 7 days" t={t} />
        : (
          <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.85rem' }}>
            {upcoming.slice(0, 6).map(e => {
              const overdue = e.item.deadline != null && isOverdue(e.item.deadline);
              return (
                <button
                  key={e.item.id}
                  onClick={() => setActiveSection(e.section)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    padding: '0.25rem 0', fontFamily: 'inherit', textAlign: 'left', width: '100%',
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: e.accent, flexShrink: 0 }} />
                  <span style={{
                    flex: 1, fontSize: '0.82rem', color: t.text,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {e.item.text}
                  </span>
                  <span style={{
                    fontSize: '0.68rem', whiteSpace: 'nowrap',
                    color: overdue ? t.alert : t.textMuted,
                  }}>
                    {e.item.deadline != null ? deadlineLabel(e.item.deadline) : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
    </Widget>
  );
}
