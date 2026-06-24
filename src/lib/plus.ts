// Bozz Plus entitlement — the single source of truth every paywall gate reads.
//
// During beta everything is unlocked (BETA_UNLOCK = true) so the whole feature
// set ships free and we gather signal. When the paywall goes live, flip
// BETA_UNLOCK = false, implement license validation in src/lib/billing.ts, and
// the gates below start enforcing the free/Plus split.
//
// The check is deliberately SOFT (local, bypassable by recompiling). That is an
// accepted, documented trade-off — the un-bypassable feature is the deferred
// cloud watcher (Phase 4). Do not spend effort hardening this.

import type { Entitlement, PlanTier } from './types';
import { getItem, setItem, deleteItem } from './storage';

/** Flip to false when the paywall goes live (Phase 3). */
export const BETA_UNLOCK = true;

/** Local-only store key — entitlement is a license, not a synced secret. */
const ENTITLEMENT_KEY = 'entitlement';

/** Free-tier ceilings (the target config, applied only post-beta). */
export const FREE_LIMITS = {
  /** Priority-alert rules allowed on the free tier. */
  alertRules: 1,
} as const;

const FREE_ENTITLEMENT: Entitlement = {
  tier: 'free',
  worldsAccess: false,
  plusFeatures: false,
};

const BETA_ENTITLEMENT: Entitlement = {
  tier: 'free',
  worldsAccess: true,
  plusFeatures: true,
  source: 'beta',
};

// Cached so synchronous gates (isPlus/hasWorldsAccess) don't need to await the
// store on every call. Hydrated once at startup via loadEntitlement().
let cached: Entitlement = BETA_UNLOCK ? BETA_ENTITLEMENT : FREE_ENTITLEMENT;

/** Read the persisted entitlement into the sync cache. Call once on startup. */
export async function loadEntitlement(): Promise<Entitlement> {
  try {
    const r = await getItem(ENTITLEMENT_KEY);
    if (r?.value) {
      const e = JSON.parse(r.value) as Entitlement;
      // Expired subscription → downgrade to free.
      if (e.expiresAt && e.expiresAt < Date.now()) {
        cached = FREE_ENTITLEMENT;
      } else {
        cached = e;
      }
    }
  } catch { /* ignore — fall back to default */ }
  return getEntitlement();
}

/** The current entitlement. During beta, everything is unlocked. */
export function getEntitlement(): Entitlement {
  if (BETA_UNLOCK) return { ...BETA_ENTITLEMENT };
  // Guard a stored sub that has lapsed since it was cached.
  if (cached.expiresAt && cached.expiresAt < Date.now()) return { ...FREE_ENTITLEMENT };
  return { ...cached };
}

/** Persist a new entitlement (e.g. after license activation). */
export async function setEntitlement(e: Entitlement): Promise<void> {
  cached = e;
  try { await setItem(ENTITLEMENT_KEY, JSON.stringify(e)); } catch { /* ignore */ }
}

/** Clear the stored entitlement (downgrade to free). */
export async function clearEntitlement(): Promise<void> {
  cached = FREE_ENTITLEMENT;
  try { await deleteItem(ENTITLEMENT_KEY); } catch { /* ignore */ }
}

/** Plus power-features (unlimited alerts, sync depth, …). */
export function isPlus(): boolean {
  return BETA_UNLOCK || getEntitlement().plusFeatures;
}

/** Access to the premium World library + monthly drops. */
export function hasWorldsAccess(): boolean {
  return BETA_UNLOCK || getEntitlement().worldsAccess;
}

const TIER_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  plusMonthly: 'Bozz Plus (monthly)',
  plusAnnual: 'Bozz Plus (annual)',
  worldsLifetime: 'Worlds All-Access (Lifetime)',
  founding: 'Founding Supporter',
};

/** Human-readable name of the current plan. */
export function getPlanLabel(): string {
  return TIER_LABELS[getEntitlement().tier] ?? 'Free';
}
