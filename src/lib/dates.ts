import {
  format, isToday, isTomorrow, differenceInCalendarDays, formatDistanceToNowStrict,
} from 'date-fns';

/** Convert a stored deadline (unix ms) to a YYYY-MM-DD value for <input type="date">. */
export function dateInputValue(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Parse a YYYY-MM-DD input value to unix ms at local midnight, or null. */
export function parseDateInput(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

/** A deadline is overdue if its calendar day is before today's. */
export function isOverdue(deadline: number): boolean {
  return differenceInCalendarDays(new Date(deadline), new Date()) < 0;
}

/** "today" / "tomorrow" / "in 4 days" / "2 days ago" / "Tue 3 Jun". */
export function deadlineLabel(deadline: number): string {
  const d = new Date(deadline);
  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) return formatDistanceToNowStrict(d, { addSuffix: true });
  if (isToday(d)) return 'today';
  if (isTomorrow(d)) return 'tomorrow';
  if (diff <= 7) return `in ${diff} days`;
  return format(d, 'EEE d MMM');
}

/** Relative completion label for the Done pile, or "completed" if unknown. */
export function relativeCompleted(ts: number | null): string {
  if (ts == null) return 'completed';
  return formatDistanceToNowStrict(new Date(ts), { addSuffix: true });
}
