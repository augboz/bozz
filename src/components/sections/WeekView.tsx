/**
 * WeekView — the "This Week" landing surface (extends the morning brief to the
 * whole week). A zero-config glance at the days ahead, fused from the THREE
 * signals the app already computes:
 *
 *   - recurring timetable classes (timed note events, via ctx.weekEvents)
 *   - deadline chips on their due day (deadlineEntries → dueTimestamp)
 *   - daily-plan tasks (ctx.dailyPlan), shown as a count per day
 *
 * Rendered as Mon–Sun (or Mon–Fri with a weekend toggle) columns: classes laid
 * out in time order, deadline chips beneath, and visibly-empty "free" days so
 * the user can see heavy days vs. open ones at a glance.
 *
 * Purely a composition over existing WidgetCtx state — no new schema, no sync.
 */

import { useMemo, useState } from 'react';
import {
  Clock, Flag, MapPin,
} from 'lucide-react';
import type { Theme, CalendarEvent } from '../../lib/types';
import type { WidgetCtx } from '../widgets/context';
import { deadlineEntries, dueTimestamp } from '../widgets/util';

const ACCENT = '#bfa8c9';
const WARNING = '#e0a23b';
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Date helpers ───────────────────────────────────────────────────────────────

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local-midnight ms of the Monday on or before `now`. */
function weekStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0=Sun … 6=Sat. Shift so Monday is the start of the week.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

function minToLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getStartMin(e: CalendarEvent): number {
  if (e.startMin != null) return e.startMin;
  const d = new Date(e.start);
  return d.getHours() * 60 + d.getMinutes();
}

function getEndMin(e: CalendarEvent, startMin: number): number {
  if (e.endMin != null) return e.endMin;
  if (e.end != null) return startMin + Math.floor((e.end - e.start) / 60_000);
  return startMin + 60;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface DayBucket {
  dayMs: number;
  label: string;
  dateNum: number;
  isToday: boolean;
  timed: CalendarEvent[];
  allDay: CalendarEvent[];
  deadlines: Array<{ id: string; text: string; color: string; section: string }>;
  plannedCount: number;
}

// ── Day column ─────────────────────────────────────────────────────────────────

function DayColumn({ day, t, setActiveSection, onOpenEvent }: {
  day: DayBucket; t: Theme; setActiveSection: (id: string) => void;
  /** Open the calendar on a specific event's date (day view). */
  onOpenEvent?: (ts: number) => void;
}) {
  const empty = day.timed.length === 0 && day.allDay.length === 0 && day.deadlines.length === 0;
  const heavy = day.timed.length + day.deadlines.length >= 4;
  const openOn = (ts: number) => onOpenEvent ? onOpenEvent(ts) : setActiveSection('calendar');

  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      display: 'flex', flexDirection: 'column', gap: '0.3rem',
      background: day.isToday ? ACCENT + '12' : t.bgAlt + '66',
      border: `1px solid ${day.isToday ? ACCENT + '55' : t.border}`,
      borderRadius: '9px', padding: '0.45rem 0.45rem',
    }}>
      {/* Day header */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: '0.3rem', marginBottom: '0.15rem',
      }}>
        <span style={{
          fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          color: day.isToday ? ACCENT : t.textMuted,
        }}>
          {day.label}
        </span>
        <span style={{ fontSize: '0.6rem', color: t.textDim }}>{day.dateNum}</span>
      </div>

      {/* Heavy-day marker so the user can spot a packed day at a glance. */}
      {heavy && (
        <span style={{
          fontSize: '0.52rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: WARNING, marginBottom: '0.05rem',
        }}>
          busy
        </span>
      )}

      {/* Timed classes, in time order */}
      {day.timed.map(e => {
        const sm = getStartMin(e);
        const em = getEndMin(e, sm);
        return (
          <button key={e.id} onClick={() => openOn(e.start)} title={e.title} style={{
            display: 'flex', flexDirection: 'column', gap: '1px',
            padding: '0.25rem 0.35rem',
            background: e.color + '1a',
            borderLeft: `3px solid ${e.color}`,
            borderRadius: '5px',
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.58rem', color: e.color, fontWeight: 500 }}>
              <Clock size={8} strokeWidth={2} /> {minToLabel(sm)}-{minToLabel(em)}
            </span>
            <span style={{ fontSize: '0.7rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.title}
            </span>
            {e.location && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.15rem', fontSize: '0.56rem', color: t.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <MapPin size={8} strokeWidth={2} />{e.location}
              </span>
            )}
          </button>
        );
      })}

      {/* All-day (non-deadline) events */}
      {day.allDay.map(e => (
        <button key={e.id} onClick={() => openOn(e.start)} title={e.title} style={{
          padding: '0.22rem 0.35rem',
          background: t.bgAlt,
          borderLeft: `3px solid ${e.color}`,
          borderRadius: '5px',
          fontSize: '0.68rem', color: t.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
        }}>
          {e.title}
        </button>
      ))}

      {/* Deadline chips on their due day */}
      {day.deadlines.map(d => (
        <button
          key={d.id}
          onClick={() => setActiveSection(d.section)}
          title={d.text}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            padding: '0.2rem 0.35rem',
            background: d.color + '18', border: `1px dashed ${d.color}66`,
            borderRadius: '5px', cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'left', width: '100%',
          }}
        >
          <Flag size={8} strokeWidth={2} color={d.color} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.66rem', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.text}
          </span>
        </button>
      ))}

      {/* Daily-plan task count — links into the planner for that day. */}
      {day.plannedCount > 0 && (
        <span style={{ fontSize: '0.58rem', color: t.textDim, paddingLeft: '0.1rem' }}>
          {day.plannedCount} planned
        </span>
      )}

      {/* Visibly-empty free day */}
      {empty && day.plannedCount === 0 && (
        <span style={{ fontSize: '0.62rem', color: t.textDim, fontStyle: 'italic', paddingTop: '0.1rem' }}>
          free
        </span>
      )}
    </div>
  );
}

/** Time-of-day greeting, reinforcing the "your week" framing. */
function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'good morning. here is your week.';
  if (h < 18) return 'good afternoon. here is the week ahead.';
  return 'good evening. here is what the week holds.';
}

// ── Main view ──────────────────────────────────────────────────────────────────

export default function WeekView({ ctx }: {
  ctx: WidgetCtx;
}) {
  const t: Theme = ctx.t;
  const [showWeekend, setShowWeekend] = useState(false);

  const days = useMemo<DayBucket[]>(() => {
    const now = Date.now();
    const todayMs = dayStart(now);
    const start = weekStart(now);
    const events = ctx.weekEvents ?? [];
    const plan = ctx.dailyPlan ?? {};

    // Deadlines (topic items + imported deadline-like events) keyed by due day.
    const deadlinesByDay = new Map<number, DayBucket['deadlines']>();
    for (const entry of deadlineEntries(ctx)) {
      const due = dueTimestamp(entry.item);
      if (due == null) continue;
      const dMs = dayStart(entry.item.deadline ?? due);
      const list = deadlinesByDay.get(dMs) ?? [];
      list.push({
        id: `${entry.section}-${entry.item.id}`,
        text: entry.item.text,
        color: entry.accent,
        section: entry.section,
      });
      deadlinesByDay.set(dMs, list);
    }

    const count = showWeekend ? 7 : 5;
    const out: DayBucket[] = [];
    for (let i = 0; i < count; i++) {
      const dayMs = start + i * DAY_MS;
      const nextDay = dayMs + DAY_MS;
      const dayEvents = events.filter(e => e.start >= dayMs && e.start < nextDay && e.source !== 'deadline');
      out.push({
        dayMs,
        label: WEEKDAY_LABELS[i] ?? '',
        dateNum: new Date(dayMs).getDate(),
        isToday: dayMs === todayMs,
        timed: dayEvents.filter(e => !e.allDay).sort((a, b) => a.start - b.start),
        allDay: dayEvents.filter(e => e.allDay),
        deadlines: deadlinesByDay.get(dayMs) ?? [],
        plannedCount: (plan[String(dayMs)] ?? []).length,
      });
    }
    return out;
  }, [ctx, showWeekend]);

  return (
    <div style={{ position: 'relative', zIndex: 1 }}>
      {/* Greeting */}
      <div style={{ fontSize: '0.82rem', color: t.text, fontWeight: 500, marginBottom: '0.85rem' }}>{greeting()}</div>

      {/* Weekend toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
        <button
          onClick={() => setShowWeekend(w => !w)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
            background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '7px',
            color: t.textMuted, padding: '0.25rem 0.6rem', fontSize: '0.7rem',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {showWeekend ? 'Hide weekend' : 'Show weekend'}
        </button>
      </div>

      {/* Day columns — wrap on narrow viewports so a phone stacks them. */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'stretch' }}>
        {days.map(day => (
          <div key={day.dayMs} style={{ flex: '1 1 130px', minWidth: '130px', display: 'flex' }}>
            <DayColumn day={day} t={t} setActiveSection={ctx.setActiveSection} onOpenEvent={ctx.openCalendarOnDate} />
          </div>
        ))}
      </div>
    </div>
  );
}
