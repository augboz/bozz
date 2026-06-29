import { CalendarClock } from 'lucide-react';
import { Widget, WidgetHeader, EmptyWidget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import { isOverdue } from '../../lib/dates';
import { deadlineEntries } from './util';
import type { WidgetCtx } from './context';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-midnight ms for a timestamp — the key we group days by. */
function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "Today" / "Tomorrow" / "Wed 2 Jul" subheading for a day. */
function dayHeading(dayMs: number, todayMs: number): string {
  if (dayMs === todayMs) return 'Today';
  if (dayMs === todayMs + DAY_MS) return 'Tomorrow';
  return new Date(dayMs).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function UpcomingDeadlinesWidget({ ctx }: { ctx: WidgetCtx }) {
  const { t, setActiveSection } = ctx;
  const now = Date.now();
  const cutoff = now + WINDOW_MS;
  const todayMs = dayStart(now);

  // Include overdue items too (deadline before today): an overdue task is the
  // most urgent thing this widget can show, so dropping it (the old `>= todayMs`
  // floor did) was exactly backwards. The per-item overdue styling below was
  // dead code until this change.
  const upcoming = deadlineEntries(ctx)
    .filter(e => e.item.deadline != null && e.item.deadline <= cutoff)
    .sort((a, b) => (a.item.deadline ?? 0) - (b.item.deadline ?? 0));

  // Bucket into per-day groups, ascending. Everything past due collapses into a
  // single "Overdue" group at the top (sorted ascending, so it comes first).
  const OVERDUE_DAY = -1;
  const groups: { day: number; items: typeof upcoming }[] = [];
  for (const e of upcoming) {
    const raw = dayStart(e.item.deadline!);
    const day = raw < todayMs ? OVERDUE_DAY : raw;
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(e);
    else groups.push({ day, items: [e] });
  }

  return (
    <Widget t={t} accent={sectionAccents.home}>
      <WidgetHeader label="Next 7 Days" accent={sectionAccents.home} t={t} icon={CalendarClock} />
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, marginTop: '0.75rem' }}>
        {upcoming.length === 0
          ? <EmptyWidget text="nothing due in the next 7 days." t={t} actionLabel="capture one →" onAction={() => setActiveSection('inbox')} />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
              {groups.map(({ day, items }) => (
                <div key={day}>
                  {/* Day subheading */}
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.3rem',
                  }}>
                    <span style={{
                      fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      color: day === OVERDUE_DAY ? t.alert : day === todayMs ? sectionAccents.home : t.textMuted,
                    }}>
                      {day === OVERDUE_DAY ? 'Overdue' : dayHeading(day, todayMs)}
                    </span>
                    <span style={{ flex: 1, height: 1, background: t.border }} />
                    <span style={{ fontSize: '0.62rem', color: t.textDim }}>{items.length}</span>
                  </div>
                  {/* Items for this day */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {items.map(e => {
                      const overdue = e.item.deadline != null && e.item.deadline < todayMs && isOverdue(e.item.deadline);
                      return (
                        <button
                          key={`${e.section}-${e.item.id}`}
                          onClick={() => setActiveSection(e.section)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            padding: '0.15rem 0', fontFamily: 'inherit', textAlign: 'left',
                            width: '100%', minHeight: 0, overflow: 'hidden',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: e.accent, flexShrink: 0 }} />
                          <span style={{
                            flex: 1, fontSize: '0.8rem', color: overdue ? t.alert : t.text,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {e.item.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </Widget>
  );
}
