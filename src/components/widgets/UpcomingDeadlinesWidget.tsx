import { CalendarClock } from 'lucide-react';
import { Widget, WidgetHeader, EmptyWidget } from '../shared/Widget';
import { sectionAccents } from '../../lib/themes';
import { isOverdue } from '../../lib/dates';
import { deadlineEntries, dueTimestamp } from './util';
import type { Theme } from '../../lib/types';
import type { WidgetCtx } from './context';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** Within this window an upcoming deadline is shown amber/warning. */
const SOON_MS = 48 * HOUR_MS;
/** Warning amber — the Theme has no semantic warning colour, and this reads as
 *  "soon, but not yet alarming" across all three moods. */
const WARNING = '#e0a23b';

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

/**
 * Live urgency label + colour for a precise due timestamp relative to now.
 *   overdue 2d · overdue 4h · due today · in 4h · in 3d
 * Colour: overdue → alert, within ~48h → warning/amber, else the item accent.
 */
function urgency(due: number, now: number, todayMs: number, accent: string, t: Theme): { label: string; color: string } {
  const diff = due - now;

  // Overdue — count whole days when ≥1 day late, else hours.
  if (due < todayMs || diff < 0) {
    if (-diff >= DAY_MS) {
      const d = Math.max(1, Math.round(-diff / DAY_MS));
      return { label: `overdue ${d}d`, color: t.alert };
    }
    const h = Math.max(1, Math.round(-diff / HOUR_MS));
    return { label: `overdue ${h}h`, color: t.alert };
  }

  // Due today (same calendar day) — show hours if a time-of-day narrows it down.
  if (dayStart(due) === todayMs) {
    const h = Math.floor(diff / HOUR_MS);
    const color = diff <= SOON_MS ? WARNING : accent;
    if (h < 1) return { label: 'due now', color };
    if (h < 12) return { label: `in ${h}h`, color };
    return { label: 'due today', color };
  }

  const days = Math.ceil(diff / DAY_MS);
  const color = diff <= SOON_MS ? t.doingAccent : accent;
  return { label: `in ${days}d`, color };
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
  // Sort by the PRECISE due timestamp (date + optional time-of-day) so timed
  // deadlines order correctly within a day; the all-day case is identical to
  // sorting by deadline since dueTimestamp falls back to the midnight value.
  const upcoming = deadlineEntries(ctx)
    .filter(e => e.item.deadline != null && e.item.deadline <= cutoff)
    .sort((a, b) => (dueTimestamp(a.item) ?? 0) - (dueTimestamp(b.item) ?? 0));

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
                      const due = dueTimestamp(e.item);
                      const u = due != null ? urgency(due, now, todayMs, e.accent, t) : null;
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
                          {u && (
                            <span style={{
                              flexShrink: 0, fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.02em',
                              color: u.color, whiteSpace: 'nowrap',
                            }}>
                              {u.label}
                            </span>
                          )}
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
