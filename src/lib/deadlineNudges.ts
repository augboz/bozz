/**
 * deadlineNudges — proactive, LOCAL, on-device deadline reminders.
 *
 * FREE and local by design: no server, no Plus/entitlement gate, no email. Drives
 * entirely off the deadline stream the app already computes (deadlineEntries →
 * dueTimestamp) plus today's events, and fires native OS notifications via the
 * Tauri notification plugin, falling back to the Web Notification API in the
 * browser PWA.
 *
 * Two kinds of nudge, both deduped so the same thing is never notified twice:
 *   1. Morning digest — once per calendar day, after a morning hour: a single
 *      "3 due today · 1 overdue · next class 14:00" line.
 *   2. Per-deadline   — the day before (afternoon) and the morning of, one
 *      notification per deadline per phase.
 *
 * Dedupe keys are persisted (local-only) so they survive reloads; quiet and
 * permission-aware so it never spams. If permission isn't granted we simply do
 * nothing — there is no prompt-on-load.
 */

import { isTauri } from './platform';
import { getItem, setItem } from './storage';

// ── Types ────────────────────────────────────────────────────────────────────

/** Minimal shape this module needs about a deadline — kept decoupled from the
 *  widget DeadlineEntry so the caller can pass a plain projection. */
export interface NudgeDeadline {
  /** Stable id (e.g. `${section}:${itemId}`) — used for dedupe keys. */
  id: string;
  text: string;
  /** Precise due timestamp (deadline midnight + optional dueMin). */
  due: number;
}

export interface NudgeInput {
  deadlines: NudgeDeadline[];
  /** Local-midnight ms of the next still-upcoming timed event today, plus a
   *  label like "14:00" — null when there's no upcoming timed event. */
  nextEventLabel: string | null;
  /** Reference time — injectable for tests. Defaults to Date.now(). */
  now?: number;
}

interface NudgeState {
  /** Set of dedupe keys already notified. */
  done: string[];
}

// ── Persistence (local-only, never synced) ────────────────────────────────────

const STATE_KEY = 'deadlineNudgeState';

async function loadState(): Promise<NudgeState> {
  try {
    const r = await getItem(STATE_KEY);
    if (r?.value) {
      const v = JSON.parse(r.value) as Partial<NudgeState>;
      return { done: v.done ?? [] };
    }
  } catch { /* ignore */ }
  return { done: [] };
}

async function saveState(state: NudgeState): Promise<void> {
  // Cap so the dedupe set can't grow without bound.
  const done = state.done.length <= 400 ? state.done : state.done.slice(state.done.length - 400);
  try { await setItem(STATE_KEY, JSON.stringify({ done })); } catch { /* ignore */ }
}

// ── Time helpers ──────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
/** Don't fire morning notifications before this local hour. */
const MORNING_HOUR = 7;
/** Day-before nudges fire from this local hour onward. */
const DAY_BEFORE_HOUR = 16;

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// ── Notifications (Tauri + web fallback) ──────────────────────────────────────

let permissionChecked = false;
let permissionGranted = false;

/**
 * Permission-aware, NEVER prompts on its own in the browser. On desktop the
 * Tauri plugin's requestPermission is a quiet OS-level grant (no web popup), so
 * we may request there; on web we only fire if the user has ALREADY granted.
 */
async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  permissionChecked = true;
  try {
    if (isTauri()) {
      const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
      let granted = await isPermissionGranted();
      if (!granted) granted = (await requestPermission()) === 'granted';
      permissionGranted = granted;
    } else if (typeof Notification !== 'undefined') {
      // Web: only fire if already granted — do not surface a prompt unbidden.
      permissionGranted = Notification.permission === 'granted';
    }
  } catch { permissionGranted = false; }
  return permissionGranted;
}

async function fire(title: string, body: string): Promise<void> {
  if (!(await ensurePermission())) return;
  try {
    if (isTauri()) {
      const { sendNotification } = await import('@tauri-apps/plugin-notification');
      sendNotification({ title, body });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch (e) {
    console.warn('[nudges] fire failed:', e);
  }
}

/**
 * Opt-in entry: explicitly ask for notification permission (used by a Settings
 * toggle / first enable). Resets the cached check so a fresh grant is seen.
 */
export async function requestNudgePermission(): Promise<boolean> {
  permissionChecked = false;
  try {
    if (!isTauri() && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  } catch { /* ignore */ }
  return ensurePermission();
}

// ── Pure planning ─────────────────────────────────────────────────────────────

export interface PlannedNudge {
  key: string;
  title: string;
  body: string;
}

/**
 * Decide which nudges are due RIGHT NOW given the deadline stream + state. Pure
 * and deterministic (modulo `now`) so it's unit-testable; the runner below
 * handles persistence + firing.
 */
export function planNudges(input: NudgeInput, doneKeys: Set<string>): PlannedNudge[] {
  const now = input.now ?? Date.now();
  const todayMs = dayStart(now);
  const tomorrowMs = todayMs + DAY_MS;
  const hour = new Date(now).getHours();
  const dk = dayKey(now);
  const out: PlannedNudge[] = [];

  const deadlines = input.deadlines ?? [];
  const overdue = deadlines.filter(d => dayStart(d.due) < todayMs);
  const dueToday = deadlines.filter(d => dayStart(d.due) === todayMs);

  // 1. Morning digest — once per day, only in/after the morning hour, and only
  //    when there's actually something to say.
  if (hour >= MORNING_HOUR) {
    const digestKey = `digest:${dk}`;
    if (!doneKeys.has(digestKey)) {
      const parts: string[] = [];
      if (overdue.length) parts.push(`${overdue.length} overdue`);
      if (dueToday.length) parts.push(`${dueToday.length} due today`);
      if (input.nextEventLabel) parts.push(`next class ${input.nextEventLabel}`);
      if (parts.length > 0) {
        out.push({
          key: digestKey,
          title: 'Your day',
          body: parts.join(' · '),
        });
      }
    }
  }

  // 2. Per-deadline nudges — morning-of and day-before (afternoon onward).
  for (const d of deadlines) {
    const ds = dayStart(d.due);
    // Morning-of: due today, after the morning hour.
    if (ds === todayMs && hour >= MORNING_HOUR) {
      const key = `due:${d.id}:${dk}`;
      if (!doneKeys.has(key)) {
        out.push({ key, title: 'Due today', body: d.text });
      }
    }
    // Day-before: due tomorrow, from the afternoon onward (one heads-up).
    if (ds === tomorrowMs && hour >= DAY_BEFORE_HOUR) {
      const key = `eve:${d.id}:${dk}`;
      if (!doneKeys.has(key)) {
        out.push({ key, title: 'Due tomorrow', body: d.text });
      }
    }
  }

  return out;
}

// ── Runner ────────────────────────────────────────────────────────────────────

/**
 * Compute + fire any nudges that are due now, then persist their dedupe keys so
 * they never re-fire. Safe to call repeatedly (e.g. on an interval); it's a
 * no-op when nothing's due or permission isn't granted.
 */
export async function runNudgeCheck(input: NudgeInput): Promise<void> {
  const state = await loadState();
  const done = new Set(state.done);
  const planned = planNudges(input, done);
  if (planned.length === 0) return;

  // Bail early (without marking keys) if we can't actually notify, so the digest
  // still fires once permission is later granted.
  if (!(await ensurePermission())) return;

  for (const n of planned) {
    await fire(n.title, n.body);
    done.add(n.key);
  }
  await saveState({ done: [...done] });
}
