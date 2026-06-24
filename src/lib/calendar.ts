import { isSameDay } from 'date-fns';
import type { CalendarEvent, CalendarNote, SectionId, Topic } from './types';

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

/** Convert user-created CalendarNotes to CalendarEvents for display. */
export function noteEvents(notes: CalendarNote[]): CalendarEvent[] {
  return notes.map(n => {
    const start = n.startMin != null
      ? n.date + n.startMin * 60_000
      : n.date;
    const end = n.endMin != null ? n.date + n.endMin * 60_000 : null;
    return {
      id: `note:${n.id}`,
      title: n.title,
      start,
      end,
      allDay: n.startMin == null,
      color: n.color,
      source: 'note' as const,
      startMin: n.startMin ?? undefined,
      endMin: n.endMin ?? undefined,
    };
  });
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
