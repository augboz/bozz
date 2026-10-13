// Study timer maths for a topic's timeLog (see Topic.timeLog).
import type { StudySession, Topic } from './types';

type Log = NonNullable<Topic['timeLog']>;

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const startOfWeek = (d: Date) => { const x = new Date(startOfDay(d)); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getTime(); };

/** Milliseconds studied inside [from, to), counting the running session up to `now`. */
export function studiedBetween(log: Log | undefined, from: number, to: number, now = Date.now()): number {
  if (!log) return 0;
  const spans: Array<[number, number]> = log.sessions.map(s => [s.start, s.end]);
  if (log.runningSince) spans.push([log.runningSince, now]);
  return spans.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, to) - Math.max(a, from)), 0);
}

export function studyTotals(log: Log | undefined, now = Date.now()) {
  const d = new Date(now);
  return {
    today: studiedBetween(log, startOfDay(d), Infinity, now),
    week: studiedBetween(log, startOfWeek(d), Infinity, now),
    total: studiedBetween(log, 0, Infinity, now),
  };
}

export function startTimer(log: Log | undefined, now = Date.now()): Log {
  return { sessions: log?.sessions ?? [], runningSince: log?.runningSince ?? now };
}

/** Stop the running session and keep it (sessions under 5 s are dropped as misclicks). */
export function stopTimer(log: Log | undefined, now = Date.now()): Log {
  const sessions = log?.sessions ?? [];
  if (!log?.runningSince) return { sessions };
  const s: StudySession = {
    id: now.toString(36) + Math.random().toString(36).slice(2, 6),
    start: log.runningSince, end: now,
  };
  return { sessions: now - s.start >= 5000 ? [...sessions, s] : sessions };
}

/** 1h 05m / 12m / 45s style. */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m`;
  return `${s}s`;
}

/** 1:05:09 style for the live clock. */
export function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(2, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
