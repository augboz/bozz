import { describe, it, expect } from 'vitest';
import { studyTotals, startTimer, stopTimer, formatDuration, formatClock } from '../studyTime';

const H = 3_600_000;
const NOW = new Date(2026, 9, 14, 15, 0, 0).getTime(); // Wednesday 15:00
const at = (daysAgo: number, hour: number) => { const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d.getTime(); };

describe('study timer', () => {
  it('totals today, this week and all time, including the running session', () => {
    const log = {
      sessions: [
        { id: 'a', start: at(0, 9), end: at(0, 9) + H },        // today, 1h
        { id: 'b', start: at(1, 14), end: at(1, 14) + H / 2 },  // yesterday (this week), 30m
        { id: 'c', start: at(8, 10), end: at(8, 10) + 2 * H },  // last week, 2h
      ],
      runningSince: NOW - 15 * 60_000,                            // 15m so far
    };
    const t = studyTotals(log, NOW);
    expect(t.today).toBe(H + 15 * 60_000);
    expect(t.week).toBe(1.5 * H + 15 * 60_000);
    expect(t.total).toBe(3.5 * H + 15 * 60_000);
  });

  it('startTimer keeps an already running session; stopTimer records it', () => {
    const started = startTimer(undefined, NOW);
    expect(started.runningSince).toBe(NOW);
    expect(startTimer(started, NOW + 1000).runningSince).toBe(NOW);
    const stopped = stopTimer(started, NOW + 10 * 60_000);
    expect(stopped.runningSince).toBeUndefined();
    expect(stopped.sessions).toHaveLength(1);
    expect(stopped.sessions[0].end - stopped.sessions[0].start).toBe(10 * 60_000);
  });

  it('stopTimer drops sessions under 5 seconds as misclicks', () => {
    expect(stopTimer(startTimer(undefined, NOW), NOW + 3000).sessions).toHaveLength(0);
  });

  it('formats durations and the live clock', () => {
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(12 * 60_000)).toBe('12m');
    expect(formatDuration(H + 5 * 60_000)).toBe('1h 05m');
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(H + 5 * 60_000 + 9000)).toBe('1:05:09');
  });
});
