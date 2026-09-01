/**
 * Sync layer — bidirectional sync between local Tauri store and Supabase.
 *
 * Strategy: single-row-per-user `user_data` table holding one big JSON blob.
 * Last-write-wins; we send the entire snapshot on every push (debounced).
 * Pulls happen on app start and after sign-in.
 *
 * The JSON keys mirror the local storage keys, so the load logic can stay
 * untouched — pulled values get written into the same per-key local store
 * before the app reads them.
 */

import { supabase, isSessionUsable } from './supabase';
import { getItem, setItem, deleteItem, listKeysByPrefix, isStoreHealthy } from './storage';

/** All keys that are synced. Add new ones here when new state appears. */
export const SYNCED_KEYS = [
  'appearance', 'topics', 'topicFolders', 'inbox',
  'homeLayout',
  'calendarFeeds', 'calendarConnections', 'calendarNotes',
  'budget',
  'reviews', 'reviewSettings',
  'oauthAccounts', 'imapAccounts',
  'recentSearches',
  'spotifyAccount', 'waAccount',
  'dailyPlan',
  'habits',
  'clearStreak',
  'healthConnections', 'healthDays',
  'sidebarCollapsed',
  'weatherLocation',
  // Bozz Plus — priority-alert settings are synced (small); the alert watch
  // state (notifiedIds) and the entitlement license are deliberately local-only.
  'priorityAlerts',
  // SECURITY — deliberately NOT synced (kept local-only), for the same reason
  // OAuth tokens (__tok__*) aren't: they put secrets or private content at rest
  // in the non-E2EE Supabase blob.
  //   'notionWidget'  — its config embeds the raw Notion integration TOKEN.
  //   'emailsCache'   — cached mailbox content (senders, subjects, snippets).
  //   'calendarCache' — cached event titles/times.
  // All three are re-derivable per device (re-fetched / reconnected), so nothing
  // is lost by keeping them off the wire; only the secret/content exposure goes.
  //
  // SIZE — 'photo__*' (Photo-widget images, base64) are also local-only. Two
  // photos pushed the sync blob past 10MB, which made pushes fail silently while
  // the unconditional startup pull kept "restoring" a stale remote snapshot —
  // the 2026-07-02 data-loss incident. Photos stay on the device that added them.
  //
  //   'homeBackground' — same reason, added 2026-08-10. Its base64 wallpaper was
  //   2.96MB of a 2.98MB blob: 99.5% of every sync round-trip, for one image,
  //   while the actual content (topics) was 9.6KB. Backgrounds are now per-device
  //   like photos.
] as const;

export type SyncedKey = typeof SYNCED_KEYS[number];

/** Keys never imported from a remote row, whatever older builds left in it. */
const NEVER_PULL_PREFIXES = ['__tok__', 'photo__'] as const;
const NEVER_PULL_KEYS = ['homeBackground'] as const;

interface RemoteRow {
  data: Record<string, unknown>;
  updated_at: string;
}

// ── Sync safety ────────────────────────────────────────────────────────────

export type SyncBlockReason = 'dev-build' | 'thin-local' | 'store-unhealthy' | 'push-failed' | 'signed-out';

/**
 * Classify a failed Supabase call: is this device actually signed in?
 *
 * A dead session and a dead network both surface as a failed request, but they
 * need opposite responses from the user ("sign in again" vs "wait"). Reporting
 * an expired session as a network problem sent the 2026-08-10 debugging down
 * the wrong path, so ask the auth client which one it is — and also check the
 * session's tokens are well-formed, not just present: a malformed access_token
 * (found the same day — a race in the OAuth callback handler, now fixed, could
 * persist one) fails the exact same request every retry, since the token never
 * changes, so it's actively signed out here rather than left to fail forever.
 */
async function classifyFailure(): Promise<SyncBlockReason> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return 'signed-out';
    if (!isSessionUsable(session)) {
      await supabase.auth.signOut({ scope: 'local' });
      return 'signed-out';
    }
    // Well-formed but expired. A weeks-old session still looks perfectly valid
    // here and fails every single request, which reads as "sync is broken" with
    // no hint that signing in again is the fix. Try one refresh and let the
    // server decide.
    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAtMs && expiresAtMs <= Date.now()) {
      const { error } = await supabase.auth.refreshSession();
      // Only an auth-level rejection means the session is truly dead. A network
      // error here must NOT sign the user out — that would log people out
      // whenever they open the app offline.
      const status = (error as { status?: number } | null)?.status;
      if (error && (status === 400 || status === 401 || status === 403)) {
        await supabase.auth.signOut({ scope: 'local' });
        return 'signed-out';
      }
    }
    return 'push-failed';
  } catch {
    return 'push-failed';
  }
}

/** Compact, human-readable form of a Supabase/Postgrest error for the banner. */
function describeError(e: unknown): string {
  if (!e) return 'unknown error';
  const err = e as { message?: string; code?: string; status?: number; details?: string };
  const parts = [err.message ?? String(e)];
  if (err.code) parts.push(`code ${err.code}`);
  if (err.status) parts.push(`HTTP ${err.status}`);
  return parts.join(' · ').slice(0, 200);
}

export interface SyncBlock {
  reason: SyncBlockReason;
  detail: string;
  at: number;
}

let lastBlock: SyncBlock | null = null;

/** The most recent reason a push was refused, or null if the last push was fine. */
export function getLastSyncBlock(): SyncBlock | null {
  return lastBlock;
}

function blockPush(reason: SyncBlockReason, detail: string): false {
  lastBlock = { reason, detail, at: Date.now() };
  console.error(`[sync] push BLOCKED (${reason}): ${detail}`);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bozz:sync-blocked', { detail: lastBlock }));
  }
  return false;
}

/**
 * Dev builds are local-only unless explicitly opted in with
 * VITE_ALLOW_DEV_SYNC=true.
 *
 * A dev build signs into the same Supabase project as the shipped app but gets
 * its own app-data dir, so it starts empty. On 2026-07-29 the Outlook branch's
 * dev build did exactly that and pushed its two-topic starter state over a real
 * account. Separate data dir plus shared cloud row is the whole trap.
 */
export function syncEnabled(): boolean {
  if (!import.meta.env.DEV) return true;
  return import.meta.env.VITE_ALLOW_DEV_SYNC === 'true';
}

/**
 * Collections whose disappearance means this device is not the authoritative
 * copy. Topic items count too: a device can keep the topic list and still have
 * lost everything inside it.
 */
const GUARDED_COLLECTIONS = [
  'topics', 'topicFolders', 'inbox', 'calendarNotes', 'reviews',
  'habits', 'calendarFeeds', 'calendarConnections', 'healthDays',
  'oauthAccounts', 'imapAccounts',
] as const;

function countRecords(snapshot: Record<string, unknown>): number {
  let n = 0;
  for (const key of GUARDED_COLLECTIONS) {
    const value = snapshot[key];
    if (!Array.isArray(value)) continue;
    n += value.length;
    if (key === 'topics') {
      for (const topic of value) {
        const items = (topic as { items?: unknown[] })?.items;
        if (Array.isArray(items)) n += items.length;
      }
    }
  }
  // Home widgets count too: an account can be board-only (zero topics) and
  // still be a fully set-up account. This makes the thin-push check a strict
  // superset of the v0.1.60 empty-over-nonempty guard, which compared exactly
  // topics + homeLayout.items.
  const home = (snapshot['homeLayout'] as { items?: unknown[] } | undefined)?.items;
  if (Array.isArray(home)) n += home.length;
  return n;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Id-aware union of this device's data with the remote copy.
 *
 * Arrays of id-bearing records (topics, topic items, reviews, notes, habits,
 * folders…) are unioned by id: records on both sides take this device's
 * version (recursing, so a topic keeps its own items union), records that
 * exist only remotely are appended instead of erased. Plain objects union
 * their keys the same way. Scalars and id-less arrays take this device's
 * value. This is what makes two laptops with disjoint topics converge to the
 * superset instead of the last pusher deleting the other's work.
 */
export function deepUnionMerge(local: unknown, remote: unknown): unknown {
  if (remote === undefined || remote === null) return local;
  if (local === undefined || local === null) return remote;

  if (Array.isArray(local) && Array.isArray(remote)) {
    const idOf = (x: unknown): unknown => (isPlainObject(x) ? x.id : undefined);
    const keyed = [...local, ...remote].every(x => idOf(x) !== undefined);
    // Id-less arrays (recent searches, color banks…) aren't mergeable records;
    // this device's list wins unless it has nothing.
    if (!keyed) return local.length ? local : remote;
    const out = [...local];
    for (const item of remote) {
      const i = out.findIndex(x => idOf(x) === idOf(item));
      if (i === -1) out.push(item);
      else out[i] = deepUnionMerge(out[i], item);
    }
    return out;
  }

  if (isPlainObject(local) && isPlainObject(remote)) {
    const out: Record<string, unknown> = { ...local };
    for (const k of Object.keys(remote)) out[k] = deepUnionMerge(local[k], remote[k]);
    return out;
  }

  return local; // scalar conflict: the device the user is on wins
}

/** Fraction of the remote's records below which a push is treated as data loss. */
const THIN_PUSH_RATIO = 0.5;

/**
 * Returns why this push would destroy data, or null if it's safe.
 *
 * Sync is whole-blob last-write-wins, so the most recently *saving* device wins
 * rather than the most complete one. That is fine until a device comes up empty
 * (failed store load, fresh dev install, interrupted first sign-in), at which
 * point it silently overwrites a full account. This is the tripwire for that.
 */
function thinPushReason(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): string | null {
  const here = countRecords(local);
  const there = countRecords(remote);
  if (there === 0) return null;
  if (here === 0) {
    return `this device has no records while the cloud copy has ${there}`;
  }
  if (there >= 5 && here <= there * THIN_PUSH_RATIO) {
    return `this device has ${here} records, the cloud copy has ${there}`;
  }
  return null;
}

// ── Cross-device freshness ─────────────────────────────────────────────────
// Sync state is only read from the cloud when Dashboard mounts, but Bozz lives
// in the system tray: windows stay open for days, so without this a device
// never notices what another device wrote (the 2026-08-10 "different topics on
// each laptop" report). We remember the row stamp this device last synced with
// (ms precision — PostgREST formats timestamps differently than toISOString,
// so string comparison would false-positive on our own pushes) and expose a
// cheap "did anyone else write?" probe for the foreground-refresh check in
// App.tsx.

/** Row stamp last seen by this device: ms epoch, 0 = "no row existed", null = never synced. */
let lastSeenStampMs: number | null = null;

/** True if the cloud row has been written since this device last pushed/pulled. */
export async function remoteChanged(userId: string): Promise<boolean> {
  if (!syncEnabled()) return false;
  if (lastSeenStampMs === null) return false; // boot flow hasn't synced yet
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return false;
    const stamp = Date.parse((data as { updated_at: string }).updated_at);
    return Number.isFinite(stamp) && stamp !== lastSeenStampMs;
  } catch {
    return false; // offline — the next foreground check retries
  }
}

/**
 * Pull the user's row from Supabase and write every key into local storage.
 * Returns true if the pull found a row and wrote anything.
 */
export async function pullSnapshot(userId: string): Promise<boolean> {
  if (!syncEnabled()) {
    console.warn('[sync] dev build — pull skipped (set VITE_ALLOW_DEV_SYNC=true to opt in)');
    return false;
  }
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('data, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.error('[sync] pull error:', error);
      return false;
    }
    if (!data) { lastSeenStampMs = 0; return false; } // first sign-in for this account
    const row = data as RemoteRow;
    lastSeenStampMs = Date.parse(row.updated_at) || 0;
    // Write all keys to local storage in parallel for faster sign-in.
    await Promise.all(
      Object.entries(row.data ?? {})
        .filter(([, value]) => value !== undefined && value !== null)
        // SECURITY: never import OAuth token keys from the remote blob. Rows
        // written by older builds may still contain leaked access/refresh
        // tokens and client secrets; tokens belong only in the local app data
        // file, never in the synced Supabase row.
        // SIZE: photo__* and homeBackground are local-only now (see the
        // SYNCED_KEYS note) — skip any still sitting in rows written by older
        // builds, so they don't resurrect and re-balloon the local store.
        .filter(([key]) =>
          !NEVER_PULL_PREFIXES.some(p => key.startsWith(p)) &&
          !(NEVER_PULL_KEYS as readonly string[]).includes(key))
        .map(async ([key, value]) => {
          try {
            await setItem(key, JSON.stringify(value));
          } catch (e) {
            console.error(`[sync] writing local ${key}:`, e);
          }
        })
    );
    return true;
  } catch (e) {
    console.error('[sync] pull failed:', e);
    return false;
  }
}

/** Read all synced keys from local storage and return as one object. */
export async function readLocalSnapshot(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};

  // Read all SYNCED_KEYS in parallel.
  const results = await Promise.all(
    SYNCED_KEYS.map(async key => {
      try {
        const r = await getItem(key);
        return r?.value ? { key, value: JSON.parse(r.value) } : null;
      } catch {
        return null;
      }
    })
  );
  for (const entry of results) {
    if (entry) out[entry.key] = entry.value;
  }

  // SECURITY: OAuth tokens (__tok__* keys — access/refresh tokens and client
  // secrets) are deliberately NOT collected for sync. Uploading them into the
  // Supabase row would put credentials at rest in a blob that is not end-to-end
  // encrypted. They stay only in the local app data file; users reconnect
  // integrations per device.

  // Per-widget photos (photo__* keys) are deliberately NOT synced — see the
  // SIZE note on SYNCED_KEYS. Base64 images ballooned the blob past request
  // limits and broke sync silently.

  return out;
}

/**
 * Upload the current local snapshot to Supabase. Returns true on success.
 *
 * If another device wrote the row since this device last synced (or this is
 * the first push of the session, e.g. at boot), the upload is a deep UNION of
 * local and remote rather than a blob replacement — see deepUnionMerge. The
 * union is persisted locally first, so the remote-only records survive even a
 * failed upload.
 *
 * Refuses to push when this device can't be trusted as the authoritative copy:
 * a dev build, a failed store load, or a snapshot far thinner than what's
 * already in the cloud. Every refusal and failure is reported (console +
 * `bozz:sync-blocked`) rather than swallowed; callers skip the pull on false
 * and local data survives.
 *
 * `force` bypasses BOTH the merge and the thinning tripwire: a wholesale
 * replace for when the user really did delete things and means it.
 * `silentMerge` suppresses the `bozz:remote-merged` UI-reload event for call
 * sites that manage their own state lifecycle (boot, sign-out).
 */
export async function pushSnapshot(
  userId: string,
  opts: { force?: boolean; silentMerge?: boolean } = {},
): Promise<boolean> {
  if (!syncEnabled()) {
    return blockPush('dev-build', 'dev builds do not sync (set VITE_ALLOW_DEV_SYNC=true to opt in)');
  }
  try {
    if (!(await isStoreHealthy())) {
      return blockPush('store-unhealthy', 'the local store failed to load, so its contents are not trustworthy');
    }

    let snapshot = await readLocalSnapshot();
    let mergedWithRemote = false;

    if (!opts.force) {
      const { data: remote, error: readError } = await supabase
        .from('user_data')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (readError) {
        console.error('[sync] pre-push read error:', readError);
        return blockPush(await classifyFailure(), `reading the cloud copy failed: ${describeError(readError)}`);
      }
      const remoteRow = remote as { data?: Record<string, unknown>; updated_at?: string } | null;
      const remoteData = remoteRow?.data;
      if (remoteData) {
        // MERGE, DON'T REPLACE. Sync used to upload this device's whole blob,
        // which deleted anything that existed only on another device — each
        // laptop's boot erased the other laptop's topics (2026-08-10). If the
        // row has been written since we last synced (or we've never synced this
        // session, e.g. the boot push), union the remote into our snapshot:
        // records existing only remotely survive, records on both sides take
        // this device's version. Deletions made here while another device was
        // also writing can resurrect — the cost of never losing a topic.
        const remoteMs = Date.parse(remoteRow?.updated_at ?? '') || 0;
        if (lastSeenStampMs === null || remoteMs !== lastSeenStampMs) {
          const filteredRemote = Object.fromEntries(
            Object.entries(remoteData).filter(([key]) =>
              !NEVER_PULL_PREFIXES.some(p => key.startsWith(p)) &&
              !(NEVER_PULL_KEYS as readonly string[]).includes(key)),
          );
          snapshot = deepUnionMerge(snapshot, filteredRemote) as Record<string, unknown>;
          mergedWithRemote = true;
          // Persist the union locally BEFORE uploading, so even if the upsert
          // fails the remote-only records now live on this device too.
          await Promise.all(
            Object.entries(snapshot).map(async ([key, value]) => {
              try {
                await setItem(key, JSON.stringify(value));
              } catch (e) {
                console.error(`[sync] writing merged ${key}:`, e);
              }
            }),
          );
        }
        // After a union this can't trip (the union is a superset of remote);
        // it still guards the no-merge path and pathological snapshots.
        const reason = thinPushReason(snapshot, remoteData);
        if (reason) return blockPush('thin-local', reason);
      }
    }

    const stamp = new Date().toISOString();
    const { error } = await supabase
      .from('user_data')
      .upsert(
        { user_id: userId, data: snapshot, updated_at: stamp },
        { onConflict: 'user_id' },
      );
    if (error) {
      console.error('[sync] push error:', error);
      return blockPush(await classifyFailure(), `uploading failed: ${describeError(error)}`);
    }
    lastSeenStampMs = Date.parse(stamp);
    lastBlock = null;
    // A mid-session merge means local storage now holds records the mounted UI
    // has never seen; tell DashboardKeyed to reload state (skipped for the boot
    // and sign-out call sites, which handle their own state lifecycle).
    if (mergedWithRemote && !opts.silentMerge && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bozz:remote-merged'));
    }
    return true;
  } catch (e) {
    console.error('[sync] push failed:', e);
    return blockPush(await classifyFailure(), `uploading failed: ${describeError(e)}`);
  }
}

/** Returns true if local storage has meaningful synced data (i.e. an unsync'd session exists). */
export async function hasLocalData(): Promise<boolean> {
  try {
    const snap = await readLocalSnapshot();
    return Object.keys(snap).length > 0;
  } catch {
    return false;
  }
}

/** Wipe all synced keys from local storage. Call on sign-out to prevent data leaking between users. */
export async function clearLocalSnapshot(): Promise<void> {
  // Cancel any pending debounced push so it doesn't fire after local storage
  // is cleared and accidentally upload an empty snapshot.
  cancelPendingPush();
  // NEVER_PULL_KEYS are local-only, so they aren't in SYNCED_KEYS — but they're
  // still this user's data and must not survive into the next account on a
  // shared device.
  const deletes: Promise<void>[] = [...SYNCED_KEYS, ...NEVER_PULL_KEYS].map(k => deleteItem(k));
  try {
    const tokenKeys = await listKeysByPrefix('__tok__');
    tokenKeys.forEach(k => deletes.push(deleteItem(k)));
  } catch { /* ignore */ }
  try {
    const photoKeys = await listKeysByPrefix('photo__');
    photoKeys.forEach(k => deletes.push(deleteItem(k)));
  } catch { /* ignore */ }
  await Promise.all(deletes);
}

// ── Foreground refresh handshake ───────────────────────────────────────────
// DashboardKeyed (App.tsx) detects that another device wrote the row and
// remounts Dashboard to reload state. That remount must PULL rather than run
// the normal push-first boot flow — push-first would re-upload this device's
// stale state right over the newer row it came to fetch. One-shot flag so a
// genuine app restart never inherits it.
let pullOnlyReload = false;

/** Arm the next Dashboard mount to pull instead of push-first. */
export function requestPullOnlyReload(): void { pullOnlyReload = true; }

/** Consume the one-shot pull-only flag (see requestPullOnlyReload). */
export function consumePullOnlyReload(): boolean {
  const v = pullOnlyReload;
  pullOnlyReload = false;
  return v;
}

/** True while a debounced push is waiting to fire — local changes are in flight. */
export function hasPendingPush(): boolean { return pushTimer !== null; }

// ── Debounced push helper ────────────────────────────────────────────────
let pushTimer: ReturnType<typeof setTimeout> | null = null;
const PUSH_DEBOUNCE_MS = 1500;

export function schedulePush(userId: string): void {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushSnapshot(userId);
  }, PUSH_DEBOUNCE_MS);
}

/** Cancel any pending debounced push (call before wiping local storage). */
export function cancelPendingPush(): void {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}
