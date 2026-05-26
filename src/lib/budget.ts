import {
  startOfMonth, endOfMonth, subMonths, addMonths, format, isWithinInterval,
} from 'date-fns';
import type { BudgetData, RecurFrequency, RecurringItem, SavingsGoal } from './types';

export const DEFAULT_BUDGET: BudgetData = {
  recurring: [], transactions: [], goals: [], currency: 'GBP',
};

// 0=Mon … 6=Sun
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CATEGORIES = [
  'Rent', 'Food', 'Transport', 'Subscriptions', 'Bills',
  'Health', 'Fun', 'Salary', 'Savings', 'Other',
];

export const CURRENCIES = ['GBP', 'USD', 'EUR', 'JPY', 'CHF', 'AUD', 'CAD', 'SEK', 'NOK', 'INR'];

export const FREQUENCIES: RecurFrequency[] = ['weekly', 'fortnightly', 'monthly', 'yearly'];
export const FREQUENCY_LABEL: Record<RecurFrequency, string> = {
  weekly: 'every week', fortnightly: 'every 2 weeks', monthly: 'monthly', yearly: 'yearly',
};

// How many times, on average, a frequency occurs per calendar month.
const PER_MONTH: Record<RecurFrequency, number> = {
  weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, yearly: 1 / 12,
};

/** A recurring item's average contribution to a single month. */
export function monthlyEquivalent(r: RecurringItem): number {
  return r.amount * PER_MONTH[r.frequency ?? 'monthly'];
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export interface MonthTotals { income: number; expense: number; net: number }

/** Recurring items apply every month; one-offs apply in their own month. */
export function monthTotals(b: BudgetData, ref: Date): MonthTotals {
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  let income = 0;
  let expense = 0;

  for (const r of b.recurring) {
    const m = monthlyEquivalent(r);
    if (r.type === 'income') income += m;
    else expense += m;
  }
  for (const tx of b.transactions) {
    if (isWithinInterval(new Date(tx.date), { start, end })) {
      // IOU-typed transactions are not realised cash — excluded from net.
      if (tx.type === 'income') income += tx.amount;
      else if (tx.type === 'expense') expense += tx.amount;
    }
  }
  return { income, expense, net: income - expense };
}

export interface CategorySlice { category: string; value: number }

/** Expense breakdown by category for the given month. */
export function categoryBreakdown(b: BudgetData, ref: Date): CategorySlice[] {
  const start = startOfMonth(ref);
  const end = endOfMonth(ref);
  const map = new Map<string, number>();
  const add = (cat: string, amt: number) => map.set(cat, (map.get(cat) ?? 0) + amt);

  for (const r of b.recurring) if (r.type === 'expense') add(r.category || 'Other', monthlyEquivalent(r));
  for (const tx of b.transactions) {
    if (tx.type === 'expense' && isWithinInterval(new Date(tx.date), { start, end })) {
      add(tx.category || 'Other', tx.amount);
    }
  }
  return [...map.entries()]
    .map(([category, value]) => ({ category, value }))
    .sort((a, b2) => b2.value - a.value);
}

export interface MonthBar { label: string; income: number; expense: number }

/** Last six months (oldest → newest) of income & expense. */
export function lastSixMonths(b: BudgetData): MonthBar[] {
  const out: MonthBar[] = [];
  for (let i = 5; i >= 0; i--) {
    const ref = subMonths(new Date(), i);
    const { income, expense } = monthTotals(b, ref);
    out.push({ label: format(ref, 'MMM'), income, expense });
  }
  return out;
}

/** Sum of IOU-typed transactions in each direction. */
export function iouTotals(b: BudgetData): { owedToMe: number; iOwe: number } {
  let owedToMe = 0;
  let iOwe = 0;
  for (const tx of b.transactions) {
    if (tx.type === 'owed-to-me') owedToMe += tx.amount;
    else if (tx.type === 'i-owe') iOwe += tx.amount;
  }
  return { owedToMe, iOwe };
}

export interface GoalProgress {
  saved: number;
  remaining: number;
  pct: number;          // 0–1
  eta: string;          // human label
}

export function goalProgress(goal: SavingsGoal): GoalProgress {
  const saved = goal.contributions.reduce((s, c) => s + c.amount, 0);
  const remaining = Math.max(goal.target - saved, 0);
  const pct = goal.target > 0 ? Math.min(saved / goal.target, 1) : 0;

  let eta = 'no contributions yet';
  if (remaining === 0 && goal.target > 0) {
    eta = 'reached 🎉';
  } else if (goal.contributions.length > 0) {
    const first = Math.min(...goal.contributions.map(c => c.date));
    const monthsElapsed = Math.max(
      1, (Date.now() - first) / (1000 * 60 * 60 * 24 * 30.4),
    );
    const monthlyRate = saved / monthsElapsed;
    if (monthlyRate > 0) {
      const monthsLeft = Math.ceil(remaining / monthlyRate);
      eta = `≈ ${format(addMonths(new Date(), monthsLeft), 'MMM yyyy')}`;
    }
  }
  return { saved, remaining, pct, eta };
}
