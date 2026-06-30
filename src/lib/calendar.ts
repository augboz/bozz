import { isSameDay } from 'date-fns';
import type { CalendarEvent, CalendarNote, SectionId, Topic } from './types';

/** How far ahead recurring classes are expanded from "today", in days. Bounded
 *  so a term-long pattern never produces an unbounded event list. */
const RECUR_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function dayStartMs(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Topic items with deadlines, as all-day calendar events. */
export function topicDeadlineEvents(topics: Topic[]): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const topic of topics) {
    const doneStageIds = new Set(topic.stages.filter(s => s.done).map(s => s.id));
    for (const item of topic.items) {
      if (item.deadline != null && !doneStageIds.has(item.stageId)) {
        out.push({
          id: `deadline:topic:${topic.id}:${item.id}`,
          title: item.text,
          start: item.deadline,
          end: null,
          allDay: true,
          color: topic.color,
          source: 'deadline',
          sectionId: topic.id as SectionId,
        });
      }
    }
  }
  return out;
}

/** A single-day CalendarEvent built from a note anchored to `dayMs` (local
 *  midnight). Shared by one-off notes and each expanded recurring occurrence. */
function noteEventForDay(n: CalendarNote, dayMs: number, idSuffix = ''): CalendarEvent {
  const start = n.startMin != null ? dayMs + n.startMin * 60_000 : dayMs;
  const end = n.endMin != null ? dayMs + n.endMin * 60_000 : null;
  return {
    id: `note:${n.id}${idSuffix}`,
    title: n.title,
    start,
    end,
    allDay: n.startMin == null,
    color: n.color,
    source: 'note' as const,
    startMin: n.startMin ?? undefined,
    endMin: n.endMin ?? undefined,
    location: n.location,
  };
}

/**
 * Convert user-created CalendarNotes to CalendarEvents for display.
 *
 * One-off notes (no `repeat`) map 1:1 as before. Recurring notes (a timetable
 * class) are expanded client-side into one event per matching weekday inside a
 * bounded window [today, today+RECUR_WINDOW_DAYS], clamped to the term range —
 * the SAME synthesize-don't-store approach topicDeadlineEvents uses for
 * deadlines, so existing one-off notes keep working untouched.
 *
 * @param now optional reference time (defaults to Date.now()) — injectable for tests.
 */
export function noteEvents(notes: CalendarNote[], now: number = Date.now()): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  const todayMs = dayStartMs(now);
  const windowEnd = todayMs + RECUR_WINDOW_DAYS * DAY_MS;

  for (const n of notes ?? []) {
    if (!n.repeat || (n.repeat.weekdays ?? []).length === 0) {
      // One-off event (legacy path, fully preserved).
      out.push(noteEventForDay(n, n.date));
      continue;
    }
    // Recurring class — expand within the bounded window, clamped to the term.
    const weekdays = new Set(n.repeat.weekdays);
    const from = Math.max(todayMs, dayStartMs(n.repeat.termStart));
    const to = Math.min(windowEnd, dayStartMs(n.repeat.termEnd));
    for (let d = from; d <= to; d += DAY_MS) {
      if (weekdays.has(new Date(d).getDay())) {
        out.push(noteEventForDay(n, d, `:${d}`));
      }
    }
  }
  return out;
}

export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter(e => {
      if (isSameDay(new Date(e.start), day)) return true;
      // Multi-day events: show on every day they span.
      if (e.end != null) {
        const s = new Date(e.start); s.setHours(0, 0, 0, 0);
        const en = new Date(e.end);
        return day >= s && day <= en;
      }
      return false;
    })
    .sort((a, b) => a.start - b.start);
}
