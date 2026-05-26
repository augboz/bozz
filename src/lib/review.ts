import { startOfWeek, endOfWeek } from 'date-fns';
import type {
  Application, BudgetData, ListItem, ReviewSettings, TaskListKey, WeeklyReview,
} from './types';

const WEEK_OPTS = { weekStartsOn: 1 as const };
const DAY = 86_400_000;

export const DEFAULT_REVIEW_SETTINGS: ReviewSettings = { dayOfWeek: 6, hour: 18 };

function triggerTimeForWeekStart(weekStartMs: number, s: ReviewSettings): number {
  const trigger = new Date(weekStartMs + s.dayOfWeek * DAY);
  trigger.setHours(s.hour, 0, 0, 0);
  return trigger.getTime();
}

/**
 * The weekStart for the most-recently-eligible review trigger, or null if
 * the latest such week already has a completed review.
 */
export function pendingWeekStart(
  now: Date,
  settings: ReviewSettings,
  reviews: WeeklyReview[],
): number | null {
  const thisWeekStart = startOfWeek(now, WEEK_OPTS).getTime();
  const thisTrigger = triggerTimeForWeekStart(thisWeekStart, settings);
  const candidate = now.getTime() >= thisTrigger ? thisWeekStart : thisWeekStart - 7 * DAY;
  const existing = reviews.find(r => r.weekStart === candidate);
  if (existing && existing.reviewedAt != null) return null;
  return candidate;
}

export function weekEndFromStart(weekStartMs: number): number {
  return endOfWeek(new Date(weekStartMs), WEEK_OPTS).getTime();
}

export interface WeeklyStats {
  doneBySection: Record<TaskListKey, number>;
  applicationsSnapshot: { open: number; interviewing: number; offers: number; rejected: number };
  spend: number;
  spendByCategory: Array<{ category: string; amount: number }>;
  scheduledDone: Array<{ list: TaskListKey; item: ListItem }>;
  scheduledMissed: Array<{ list: TaskListKey; item: ListItem }>;
  rolledOver: Array<{ list: TaskListKey; item: ListItem }>;
}

export interface WeeklyStatsInput {
  weekStart: number;
  weekEnd: number;
  lists: Record<TaskListKey, ListItem[]>;
  applications: Application[];
  budget: BudgetData;
}

export function weeklyStats({
  weekStart, weekEnd, lists, applications, budget,
}: WeeklyStatsInput): WeeklyStats {
  const inWeek = (ts: number) => ts >= weekStart && ts <= weekEnd;

  const doneBySection: Record<TaskListKey, number> = { music: 0, life: 0, cv: 0, other: 0 };
  const scheduledDone: WeeklyStats['scheduledDone'] = [];
  const scheduledMissed: WeeklyStats['scheduledMissed'] = [];
  const rolledOver: WeeklyStats['rolledOver'] = [];

  (Object.keys(lists) as TaskListKey[]).forEach(k => {
    for (const it of lists[k]) {
      if (it.status === 'done' && it.completedAt != null && inWeek(it.completedAt)) {
        doneBySection[k]++;
      }
      if (it.deadline != null && inWeek(it.deadline)) {
        const done = it.status === 'done' && it.completedAt != null && it.completedAt <= weekEnd;
        if (done) scheduledDone.push({ list: k, item: it });
        else scheduledMissed.push({ list: k, item: it });
      }
      if (it.status !== 'done' && it.deadline != null && it.deadline < weekStart) {
        rolledOver.push({ list: k, item: it });
      }
    }
  });

  // Applications history isn't tracked, so we report a current snapshot
  // (matching what the user can see in the section).
  const applicationsSnapshot = {
    open: applications.filter(a => ['need to apply', 'applied', 'interview'].includes(a.status)).length,
    interviewing: applications.filter(a => a.status === 'interview').length,
    offers: applications.filter(a => a.status === 'offer').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
  };

  const catMap: Record<string, number> = {};
  let spend = 0;
  for (const tx of budget.transactions) {
    if (tx.type === 'expense' && tx.date >= weekStart && tx.date <= weekEnd) {
      spend += tx.amount;
      const c = tx.category || 'Other';
      catMap[c] = (catMap[c] ?? 0) + tx.amount;
    }
  }
  const spendByCategory = Object.entries(catMap)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);

  return { doneBySection, applicationsSnapshot, spend, spendByCategory, scheduledDone, scheduledMissed, rolledOver };
}
