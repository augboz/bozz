/**
 * clearStreak — the "close your day" reward loop math (Round 7, P-C).
 *
 * The streak counts consecutive days the user reached zero actionable priorities
 * (overdue + due-today). It's marked once per day, the first time today goes
 * clear, and is persisted the same local+sync way Habits streaks are (a small
 * counter — see lib/sync.ts SYNCED_KEYS and Dashboard clearStreak state).
 */

import type { ClearStreak } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-midnight ms for a timestamp. */
function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const EMPTY_STREAK: ClearStreak = { count: 0, lastClearedKey: null, best: 0 };

/** Has today already been marked clear? (idempotency guard for the auto-mark.) */
export function isTodayCleared(streak: ClearStreak | undefined, now: number = Date.now()): boolean {
  return (streak?.lastClearedKey ?? null) === String(dayStart(now));
}

/**
 * Mark today as clear and return the next streak. Idempotent — calling it again
 * the same day returns the streak unchanged. If yesterday was the last clear day
 * the streak increments; otherwise (a gap) it restarts at 1. `best` is kept as a
 * running maximum.
 */
export function markTodayCleared(streak: ClearStreak | undefined, now: number = Date.now()): ClearStreak {
  const s = streak ?? EMPTY_STREAK;
  const todayMs = dayStart(now);
  const todayKey = String(todayMs);
  if (s.lastClearedKey === todayKey) return s; // already counted today

  const yesterdayKey = String(todayMs - DAY_MS);
  const nextCount = s.lastClearedKey === yesterdayKey ? s.count + 1 : 1;
  return {
    count: nextCount,
    lastClearedKey: todayKey,
    best: Math.max(s.best ?? 0, nextCount),
  };
}
