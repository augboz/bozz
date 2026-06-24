// Billing — checkout, license validation, restore, donations.
//
// Bozz uses a merchant-of-record (Lemon Squeezy recommended) so a solo UK
// founder never touches VAT/tax/invoicing. Desktop distribution means no
// app-store 30% cut and no in-app-purchase mandate — checkout opens in the
// system browser via tauri-plugin-opener.
//
// During beta there is no live checkout: openCheckout() opens the (placeholder)
// product/waitlist page, and activateLicense() is stubbed. When money turns on
// (Phase 3), wire these to the MoR license API and flip BETA_UNLOCK in plus.ts.
//
// IMPORTANT: all plan/pricing/payment UI lives on the WEBSITE, not in the app.
// The app only shows the current plan and an "Explore plans" button that opens
// the web plans page. Keeps the desktop app calm and avoids app-store IAP rules.

import type { Entitlement } from './types';
import { setEntitlement, BETA_UNLOCK } from './plus';

export type Product = 'worldsLifetime' | 'plusMonthly' | 'plusAnnual';
export type DonateMethod = 'sponsors' | 'kofi' | 'tip';

// Public links. Checkout/portal URLs are placeholders until the MoR store is
// live; the donation links are real and shippable today.
const LINKS = {
  plans: 'https://bozz.app/plus',
  waitlist: 'https://bozz.app/plus',
  worldsLifetime: 'https://bozz.app/plus',
  plusMonthly: 'https://bozz.app/plus',
  plusAnnual: 'https://bozz.app/plus',
  managePortal: 'https://bozz.app/plus',
  sponsors: 'https://github.com/sponsors/augboz',
  kofi: 'https://ko-fi.com/bozz',
  tip: 'https://bozz.app/plus',
} as const;

async function open(url: string): Promise<void> {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    // Web fallback.
    try { window.open(url, '_blank', 'noopener'); } catch { /* ignore */ }
  }
}

/** Open the web plans/pricing page in the system browser. */
export function openPlansPage(): void {
  void open(LINKS.plans);
}

/** Open the merchant-of-record checkout (or the beta waitlist) in the browser. */
export function openCheckout(product: Product): void {
  void open(BETA_UNLOCK ? LINKS.waitlist : LINKS[product]);
}

/** Open the MoR customer portal to manage a subscription. */
export function openManageSubscription(): void {
  void open(LINKS.managePortal);
}

/** Open a donation link. Pure goodwill — never gated, never mixed with Plus. */
export function openDonate(method: DonateMethod): void {
  void open(LINKS[method]);
}

/**
 * Validate + activate a license key via the MoR license API, map it to an
 * Entitlement and persist. Stubbed during beta — there is no key to validate
 * yet. When live, POST the key to the MoR /licenses/validate endpoint.
 */
export async function activateLicense(key: string): Promise<Entitlement> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error('Enter a license key.');
  if (BETA_UNLOCK) {
    throw new Error('Bozz Plus is free while in beta — no key needed yet.');
  }
  // Phase 3: validate `trimmed` against the MoR license API and derive the tier.
  // Until that exists, accept nothing (caller surfaces the message).
  throw new Error('License activation is not available yet.');
}

/** Re-validate the stored key (on launch / weekly) to reflect current status. */
export async function restorePurchases(): Promise<Entitlement | null> {
  if (BETA_UNLOCK) return null;
  // Phase 3: re-validate the stored key and persist the refreshed entitlement.
  return null;
}

// Exported so a future activation flow can persist results without re-importing
// plus.ts at every call site.
export { setEntitlement };
