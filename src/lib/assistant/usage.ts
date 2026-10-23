// Running token meter for the assistant, so the user can see what their own
// key is spending. Device-only (not in SYNCED_KEYS). Counts come straight from
// the providers' usage fields; cost is up to the provider's price list.
import { getItem, setItem } from '../storage';
import type { Usage } from './providers/types';

export interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  calls: number;
  turns: number;
  /** ms epoch of the last reset. */
  since: number;
}

const KEY = 'assistantUsage';
export const EMPTY_USAGE: UsageTotals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0, turns: 0, since: Date.now() };

export async function loadUsage(): Promise<UsageTotals> {
  try {
    const raw = await getItem(KEY);
    if (!raw?.value) return { ...EMPTY_USAGE, since: Date.now() };
    return { ...EMPTY_USAGE, ...(JSON.parse(raw.value) as Partial<UsageTotals>) };
  } catch { return { ...EMPTY_USAGE, since: Date.now() }; }
}

export async function saveUsage(u: UsageTotals): Promise<void> {
  await setItem(KEY, JSON.stringify(u));
}

export function addUsage(total: UsageTotals, u: Usage): UsageTotals {
  return {
    ...total,
    input: total.input + u.input,
    output: total.output + u.output,
    cacheRead: total.cacheRead + (u.cacheRead ?? 0),
    cacheWrite: total.cacheWrite + (u.cacheWrite ?? 0),
    calls: total.calls + 1,
  };
}

/** Everything that went in, cached or not. */
export function totalInput(u: { input: number; cacheRead?: number; cacheWrite?: number }): number {
  return u.input + (u.cacheRead ?? 0) + (u.cacheWrite ?? 0);
}

export function fmtTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 100_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
