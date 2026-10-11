// Weekly habits: done once at any point in the week (Mon-Sun).
//
// Entries keep the usual shape (local-midnight ms of the day it was ticked),
// so builds without weekly habits still read the log and treat the habit as a
// daily one; nothing is lost either way.
import type { Habit } from './types';

export const isWeekly = (h: Habit): boolean => h.frequency === 'weekly';

/** Local midnight of the Monday starting the week containing `d`. */
export function weekStart(d: Date = new Date()): number {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m.getTime();
}


/** Entry keys that fall in the week starting at `start` (DST-safe: compares days). */
function keysInWeek(h: Habit, start: number): string[] {
  const end = new Date(start); end.setDate(end.getDate() + 7);
  return Object.keys(h.entries).filter(k => Number(k) >= start && Number(k) < end.getTime());
}

export function doneThisWeek(h: Habit, now: Date = new Date()): boolean {
  return keysInWeek(h, weekStart(now)).length > 0;
}

/** Tick (today) or un-tick (every entry this week) a weekly habit. */
export function toggleWeekly(h: Habit, todayKey: string, now: Date = new Date()): Habit {
  const next = { ...h.entries };
  const inWeek = keysInWeek(h, weekStart(now));
  if (inWeek.length) inWeek.forEach(k => { delete next[k]; });
  else next[todayKey] = true;
  return { ...h, entries: next };
}

/** Consecutive weeks done, counting back from this week; an unfinished
 *  current week doesn't break the streak. */
export function weeklyStreak(h: Habit, now: Date = new Date()): number {
  let streak = 0;
  let start = weekStart(now);
  for (let i = 0; i < 104; i++) {
    if (keysInWeek(h, start).length) streak++;
    else if (i > 0) break;
    const prev = new Date(start); prev.setDate(prev.getDate() - 7);
    start = weekStart(prev);
  }
  return streak;
}

