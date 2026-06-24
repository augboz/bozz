// Priority Inbox Alerts — desktop notifications when an email from a sender or
// keyword you care about lands. The hero "Watch" feature of Bozz Plus.
//
// Architecture: desktop-only, no server. The Tauri main window stays alive in
// the tray after "close" (lib.rs prevent_close), so this JS poll loop keeps
// running in the background and fires native OS notifications. Reuses the
// existing email sync + the notification plugin.

import type {
  AlertRule, AlertWatchState, EmailMessage, OAuthAccount, PriorityAlertSettings,
} from './types';
import { syncAllAccounts } from './email';
import { isTauri } from './platform';
import { getItem, setItem } from './storage';

// ── Defaults & persistence ───────────────────────────────────────────────────

export const DEFAULT_ALERT_SETTINGS: PriorityAlertSettings = {
  enabled: false,
  rules: [],
  pollMinutes: 3,
  quietFrom: null,
  quietTo: null,
  sound: true,
};

const SETTINGS_KEY = 'priorityAlerts';   // synced
const STATE_KEY = 'alertWatchState';     // local-only (never synced)

export async function loadAlertSettings(): Promise<PriorityAlertSettings> {
  try {
    const r = await getItem(SETTINGS_KEY);
    if (r?.value) {
      const v = JSON.parse(r.value) as Partial<PriorityAlertSettings>;
      return { ...DEFAULT_ALERT_SETTINGS, ...v, rules: v.rules ?? [] };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_ALERT_SETTINGS };
}

export async function loadWatchState(): Promise<AlertWatchState> {
  try {
    const r = await getItem(STATE_KEY);
    if (r?.value) {
      const v = JSON.parse(r.value) as Partial<AlertWatchState>;
      return { notifiedIds: v.notifiedIds ?? [], lastCheck: v.lastCheck ?? 0 };
    }
  } catch { /* ignore */ }
  return { notifiedIds: [], lastCheck: 0 };
}

async function saveWatchState(state: AlertWatchState): Promise<void> {
  try { await setItem(STATE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

/** Returns the first rule that matches the message, or null. */
export function matchRules(msg: EmailMessage, rules: AlertRule[]): AlertRule | null {
  const haystack = (msg.subject + ' ' + msg.snippet).toLowerCase();
  for (const r of rules) {
    if (!r.enabled) continue;
    if (r.unreadOnly && !msg.unread) continue;
    if (r.accountEmails.length && !r.accountEmails.includes(msg.accountEmail)) continue;
    const v = r.value.trim().toLowerCase();
    if (!v) continue;
    if (r.type === 'sender') {
      if (msg.fromEmail.toLowerCase().includes(v)) return r; // address or domain
    } else if (haystack.includes(v)) {
      return r;
    }
  }
  return null;
}

/** True if `now` falls inside the configured quiet-hours window. */
export function inQuietHours(settings: PriorityAlertSettings, now: Date): boolean {
  const { quietFrom, quietTo } = settings;
  if (quietFrom == null || quietTo == null) return false;
  if (quietFrom === quietTo) return false;
  const h = now.getHours();
  // Same-day window (e.g. 9 → 17) vs overnight window (e.g. 22 → 7).
  return quietFrom < quietTo
    ? h >= quietFrom && h < quietTo
    : h >= quietFrom || h < quietTo;
}

/** Cap a ring buffer to its newest `max` entries. */
export function capRing<T>(arr: T[], max: number): T[] {
  return arr.length <= max ? arr : arr.slice(arr.length - max);
}

// ── Notifications ────────────────────────────────────────────────────────────

let permissionChecked = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (!isTauri()) return false;
  if (permissionChecked) return permissionGranted;
  try {
    const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
    permissionGranted = granted;
    permissionChecked = true;
    return granted;
  } catch {
    permissionChecked = true;
    return false;
  }
}

export async function notify(m: EmailMessage, rule: AlertRule): Promise<void> {
  if (!(await ensurePermission())) return;
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({
      title: `${rule.label}: ${m.fromName || m.fromEmail}`,
      body: m.subject,
    });
  } catch (e) {
    console.warn('[alerts] notify failed:', e);
  }
}

/** Fire a test notification so the user can confirm OS permission is granted. */
export async function testNotification(): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    sendNotification({ title: 'Bozz', body: 'Priority alerts are working ✓' });
    return true;
  } catch {
    return false;
  }
}

// ── Watcher ──────────────────────────────────────────────────────────────────

export interface AlertDeps {
  settings: PriorityAlertSettings;
  accounts: OAuthAccount[];
  /** Optional: called when a caught message should bring the app forward. */
  onCaught?: (m: EmailMessage, rule: AlertRule) => void;
}

let timer: ReturnType<typeof setInterval> | null = null;

export async function runAlertCheck(deps: AlertDeps): Promise<void> {
  const { settings, accounts } = deps;
  if (!settings.enabled) return;
  if (!settings.rules.some(r => r.enabled)) return;
  if (!accounts.length) return;

  let messages: EmailMessage[];
  try {
    ({ messages } = await syncAllAccounts(accounts));
  } catch (e) {
    console.warn('[alerts] sync failed:', e);
    return;
  }

  const state = await loadWatchState();
  const seen = new Set(state.notifiedIds);
  const quiet = inQuietHours(settings, new Date());
  let first: { m: EmailMessage; rule: AlertRule } | null = null;

  for (const m of messages) {
    if (seen.has(m.id)) continue;
    const rule = matchRules(m, settings.rules);
    if (!rule) continue;
    seen.add(m.id);          // mark seen even in quiet hours so it never back-fires
    if (quiet) continue;
    await notify(m, rule);
    if (!first) first = { m, rule };
  }

  await saveWatchState({ notifiedIds: capRing([...seen], 500), lastCheck: Date.now() });
  if (first && deps.onCaught) deps.onCaught(first.m, first.rule);
}

/**
 * First-run seed: mark every message currently in the inbox as already-notified,
 * so enabling a rule only fires on genuinely new mail (no 50-notification dump).
 */
export async function seedWatchState(accounts: OAuthAccount[]): Promise<void> {
  if (!accounts.length) return;
  try {
    const { messages } = await syncAllAccounts(accounts);
    const prev = await loadWatchState();
    const ids = new Set(prev.notifiedIds);
    for (const m of messages) ids.add(m.id);
    await saveWatchState({ notifiedIds: capRing([...ids], 500), lastCheck: Date.now() });
  } catch (e) {
    console.warn('[alerts] seed failed:', e);
  }
}

export function startAlertWatcher(deps: AlertDeps): void {
  stopAlertWatcher();
  void runAlertCheck(deps);
  const minutes = Math.max(1, deps.settings.pollMinutes || 3);
  timer = setInterval(() => void runAlertCheck(deps), minutes * 60_000);
}

export function stopAlertWatcher(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
