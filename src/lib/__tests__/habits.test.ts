import { describe, it, expect } from 'vitest';
import { weekStart, doneThisWeek, toggleWeekly, weeklyStreak } from '../habits';
import type { Habit } from '../types';

const mid = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const daysAgo = (n: number, from: Date) => { const d = new Date(from); d.setDate(d.getDate() - n); return mid(d); };
// A Wednesday, so "this week" started two days earlier.
const NOW = new Date(2026, 9, 14, 15, 0, 0);
const habit = (entries: number[]): Habit => ({
  id: 'h', name: 'Watch lecture', color: '#000', activeDays: [], order: 0, frequency: 'weekly',
  entries: Object.fromEntries(entries.map(k => [String(k), true as const])),
});

describe('weekly habits', () => {
  it('weekStart is the Monday of the week', () => {
    expect(new Date(weekStart(NOW)).getDay()).toBe(1);
    expect(weekStart(NOW)).toBe(daysAgo(2, NOW));
  });

  it('doneThisWeek only counts entries on or after Monday', () => {
    expect(doneThisWeek(habit([daysAgo(1, NOW)]), NOW)).toBe(true);
    expect(doneThisWeek(habit([daysAgo(3, NOW)]), NOW)).toBe(false);
  });

  it('toggleWeekly ticks today, and un-ticking clears every entry this week', () => {
    const todayKey = String(mid(NOW));
    const ticked = toggleWeekly(habit([]), todayKey, NOW);
    expect(ticked.entries[todayKey]).toBe(true);
    const cleared = toggleWeekly(habit([daysAgo(1, NOW), daysAgo(9, NOW)]), todayKey, NOW);
    expect(Object.keys(cleared.entries)).toEqual([String(daysAgo(9, NOW))]);
  });

  it('weeklyStreak counts consecutive weeks and forgives an unfinished current week', () => {
    expect(weeklyStreak(habit([daysAgo(7, NOW), daysAgo(14, NOW)]), NOW)).toBe(2);
    expect(weeklyStreak(habit([daysAgo(1, NOW), daysAgo(7, NOW), daysAgo(14, NOW)]), NOW)).toBe(3);
    expect(weeklyStreak(habit([daysAgo(14, NOW)]), NOW)).toBe(0);
  });
});
