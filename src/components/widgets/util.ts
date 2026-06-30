import type { CalendarEvent, Effort, ListItem, SectionId } from '../../lib/types';
import type { WidgetCtx } from './context';

export interface DeadlineEntry {
  item: ListItem;
  section: SectionId;
  accent: string;
  /** Optional effort estimate carried from the topic item (P-B). Calendar-
   *  derived entries have none. */
  effort?: Effort;
}

/** Titles that read as a deadline rather than a regular timed class/meeting. */
const DEADLINE_TITLE = /exam|deadline|due|submission|coursework|assignment|quiz|test/i;

/** Local-midnight ms for a timestamp — used to group/dedupe by calendar day. */
function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * A deterministic non-negative integer derived from a string id, so a calendar
 * event (string id) can stand in as a ListItem (numeric id) for React keys and
 * the daily-plan dedupe check without ever colliding with a real topic item id
 * (those come from nextId(), a monotonic counter / timestamp). Kept negative so
 * it can never match a real item id.
 */
function eventItemId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return -Math.abs(h) - 1;
}

/**
 * Is this calendar event deadline-like? All-day events (the classic exam /
 * coursework block), OR anything whose title reads as a due date / submission.
 * Timed lectures and ordinary meetings are intentionally excluded.
 */
function isDeadlineLikeEvent(e: CalendarEvent): boolean {
  if (e.source === 'deadline') return false; // already surfaced via topic items
  return e.allDay || DEADLINE_TITLE.test(e.title);
}

/**
 * All non-done items that have a deadline, tagged with their section — the single
 * unified "what's due" stream. Includes:
 *   - topic items with a deadline (primary — what most users will have), and
 *   - deadline-like calendar events from imported feeds / notes (next ~14 days),
 *     so imported exams + coursework appear in Today + Upcoming alongside tasks.
 */
export function deadlineEntries(ctx: WidgetCtx): DeadlineEntry[] {
  const out: DeadlineEntry[] = [];

  // Track (title|day) of topic deadlines so a calendar event mirroring the same
  // deadline (same title, same day) isn't double-counted.
  const seen = new Set<string>();
  const key = (title: string, dayMs: number) => `${title.trim().toLowerCase()}|${dayMs}`;

  // Topic items (primary — what most users will have)
  for (const topic of ctx.topics ?? []) {
    const doneStageIds = new Set((topic.stages ?? []).filter(s => s.done).map(s => s.id));
    for (const item of topic.items ?? []) {
      if (item.deadline != null && !doneStageIds.has(item.stageId)) {
        out.push({
          item: { id: item.id, text: item.text, status: 'todo', completedAt: item.completedAt, deadline: item.deadline, dueMin: item.dueMin },
          section: topic.id as SectionId,
          accent: topic.color,
          effort: item.effort,
        });
        seen.add(key(item.text, dayStart(item.deadline)));
      }
    }
  }

  // Deadline-like calendar events (imported feeds + notes), deduped against topic
  // deadlines and against each other (same title + day).
  for (const e of ctx.upcomingEvents ?? []) {
    if (!isDeadlineLikeEvent(e)) continue;
    const dayMs = dayStart(e.start);
    const k = key(e.title, dayMs);
    if (seen.has(k)) continue;
    seen.add(k);
    // Timed deadline-like events keep their time-of-day via dueMin so they sort
    // correctly; all-day ones stay at local midnight (legacy all-day behaviour).
    const dueMin = e.allDay ? null : Math.round((e.start - dayMs) / 60_000);
    out.push({
      item: {
        id: eventItemId(e.id),
        text: e.title,
        status: 'todo',
        completedAt: null,
        deadline: dayMs,
        dueMin,
      },
      // Navigate to the calendar — that's where an imported event lives.
      section: e.sectionId ?? ('calendar' as SectionId),
      accent: e.color,
    });
  }

  return out;
}

/**
 * The precise due timestamp for a deadline-bearing item: the item's local-midnight
 * deadline plus its optional time-of-day (dueMin). With no dueMin this is exactly
 * the all-day deadline (local midnight) — identical to legacy behaviour.
 */
export function dueTimestamp(item: Pick<ListItem, 'deadline' | 'dueMin'>): number | null {
  if (item.deadline == null) return null;
  if (item.dueMin == null) return item.deadline;
  return item.deadline + item.dueMin * 60_000;
}
