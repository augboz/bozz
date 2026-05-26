import { isSameDay } from 'date-fns';
import { sectionAccents } from './themes';
import type { CalendarEvent, ListItem, SectionId, TaskListKey } from './types';

const LIST_SECTION: Record<TaskListKey, SectionId> = {
  music: 'music', life: 'life', cv: 'cv', other: 'other',
};

/** Non-done tasks with a deadline, as all-day calendar events. */
export function deadlineEvents(lists: Record<TaskListKey, ListItem[]>): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  (Object.keys(lists) as TaskListKey[]).forEach(k => {
    const section = LIST_SECTION[k];
    for (const it of lists[k]) {
      if (it.deadline != null && it.status !== 'done') {
        out.push({
          id: `deadline:${k}:${it.id}`,
          title: it.text,
          start: it.deadline,
          end: null,
          allDay: true,
          color: sectionAccents[section],
          source: 'deadline',
          sectionId: section,
        });
      }
    }
  });
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
