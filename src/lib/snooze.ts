/**
 * snooze — the connective "defer this" tissue shared by every priority + deadline
 * row (Round 7, P-A). A snooze rewrites a topic item's `deadline` to a later day
 * (keeping its time-of-day `dueMin` intact) through the existing onTopicChange
 * path. Pure date math + a topic mutation; no schema, no new persistence.
 *
 * Calendar-derived deadline entries (imported feeds / notes) are NOT editable
 * topic items — they get a synthetic NEGATIVE id from eventItemId() in
 * widgets/util.ts — so the snooze control is hidden for them (see isSnoozeable).
 */

import type { Topic } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export type SnoozeOption = 'tomorrow' | 'weekend' | 'nextWeek' | 'clear';

/** Local-midnight ms for a timestamp. */
function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * The local-midnight target for a snooze option, relative to `now`:
 *   tomorrow  — the next calendar day
 *   weekend   — the coming Saturday (today if it's already Sat/Sun stays today+);
 *               picks the next Saturday strictly after today
 *   nextWeek  — next Monday (start of the next week)
 *   clear     — null (remove the deadline entirely)
 */
export function snoozeTarget(option: SnoozeOption, now: number = Date.now()): number | null {
  if (option === 'clear') return null;
  const today = dayStart(now);
  if (option === 'tomorrow') return today + DAY_MS;

  // Mon=0 … Sun=6 for the day-of-week math.
  const dow = (new Date(today).getDay() + 6) % 7;
  if (option === 'weekend') {
    // Coming Saturday (dow 5). If today is Sat/Sun, roll to next week's Saturday
    // so "this weekend" always lands in the future.
    let delta = 5 - dow;
    if (delta <= 0) delta += 7;
    return today + delta * DAY_MS;
  }
  // nextWeek — next Monday (dow 0).
  const delta = 7 - dow;
  return today + delta * DAY_MS;
}

/** Short human label for a snooze menu option. */
export const SNOOZE_LABELS: Record<SnoozeOption, string> = {
  tomorrow: 'Tomorrow',
  weekend: 'This weekend',
  nextWeek: 'Next week',
  clear: 'Clear deadline',
};

/**
 * A priority / deadline row is snoozeable only when it maps to a real, editable
 * topic item. Calendar-derived entries carry a negative synthetic id (see
 * eventItemId) and have no topic — they can't be rewritten, so hide the control.
 */
export function isSnoozeable(itemId: number, topicId: string, topics: Topic[] | undefined): boolean {
  if (itemId < 0) return false; // calendar-derived synthetic id
  return (topics ?? []).some(tp => tp.id === topicId);
}

/**
 * Reschedule a single topic item's deadline (keeping its dueMin) and push the
 * mutated topic back through onTopicChange. Returns true if the item was found
 * and changed. No-op (returns false) for unknown topics/items or when no
 * onTopicChange path is wired.
 */
export function snoozeItem(
  topics: Topic[] | undefined,
  topicId: string,
  itemId: number,
  option: SnoozeOption,
  onTopicChange: ((next: Topic) => void) | undefined,
  now: number = Date.now(),
): boolean {
  if (!onTopicChange) return false;
  const topic = (topics ?? []).find(tp => tp.id === topicId);
  if (!topic) return false;
  const exists = (topic.items ?? []).some(it => it.id === itemId);
  if (!exists) return false;

  const target = snoozeTarget(option, now);
  const next: Topic = {
    ...topic,
    items: (topic.items ?? []).map(it =>
      it.id === itemId
        // Keep dueMin: a "due 5pm" task snoozed to tomorrow is still due 5pm.
        // Clearing the deadline also clears the now-meaningless time-of-day.
        ? { ...it, deadline: target, dueMin: target == null ? null : it.dueMin }
        : it,
    ),
  };
  onTopicChange(next);
  return true;
}
