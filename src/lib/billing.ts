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

// External links. ALL EMPTY until the real pages/handles exist — an empty value
// means "not live yet", so the UI shows a calm "coming soon" instead of opening
// a dead URL (a non-resolving domain gets hijacked by the browser's default
// search, which is how a placeholder produced a 403). Fill these in when the
// website + merchant-of-record + sponsor handles are real:
//   plans:    the promo site's pricing page, e.g. https://yoursite.com/plus
//   sponsors: https://github.com/sponsors/<handle>
//   kofi:     https://ko-fi.com/<handle>
const LINKS: Record<string, string> = {
  plans: '',
  worldsLifetime: '',
  plusMonthly: '',
  plusAnnual: '',
  managePortal: '',
  sponsors: '',
  kofi: '',
  tip: '',
};

/** Try to open a URL in the system browser. Returns false if not configured. */
function open(url: string): boolean {
  if (!url) return false;
  void (async () => {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(url);
    } catch {
      try { window.open(url, '_blank', 'noopener'); } catch { /* ignore */ }
    }
  })();
  return true;
}

/** Whether a given link is live (has a real URL configured). */
export function isLinkLive(key: 'plans' | DonateMethod): boolean {
  return !!LINKS[key];
}

/** Open the web plans/pricing page. Returns false if it's not live yet. */
export function openPlansPage(): boolean {
  return open(LINKS.plans);
}

/** Open the merchant-of-record checkout. Returns false if not live yet. */
export function openCheckout(product: Product): boolean {
  return open(LINKS[product]);
}

/** Open the MoR customer portal to manage a subscription. */
export function openManageSubscription(): boolean {
  return open(LINKS.managePortal);
}

/** Open a donation link. Returns false if not live yet. */
export function openDonate(method: DonateMethod): boolean {
  return open(LINKS[method]);
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
