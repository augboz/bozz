import { startOfWeek, endOfWeek } from 'date-fns';
import type {
  BudgetData, ReviewSettings, WeeklyReview,
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
  spend: number;
  spendByCategory: Array<{ category: string; amount: number }>;
}

export interface WeeklyStatsInput {
  weekStart: number;
  weekEnd: number;
  budget: BudgetData;
}

export function weeklyStats({
  weekStart, weekEnd, budget,
}: WeeklyStatsInput): WeeklyStats {
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

  return { spend, spendByCategory };
}
