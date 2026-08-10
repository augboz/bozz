/**
 * SyncNotice — surfaces the two failure modes that used to be silent.
 *
 * Both of these previously happened with no user-visible signal at all: the app
 * looked like it was syncing, and the damage only showed up days later on
 * another device. A refusal to sync is information the user needs while they
 * can still act on it, so it gets a corner banner rather than a console line.
 *
 * Listens for window events so it can sit at the app root with no wiring into
 * Dashboard's state:
 *   • `bozz:store-unhealthy` — the local store failed to load; writes are off.
 *   • `bozz:sync-blocked`    — a push was refused (see SyncBlock.reason).
 */

import { useEffect, useState } from 'react';
import { AlertCircle, CloudOff } from 'lucide-react';
import { themes } from '../lib/themes';
import { DEFAULT_APPEARANCE } from '../lib/appearance';
import type { SyncBlock } from '../lib/sync';

type Notice =
  | { kind: 'store'; bytes: number }
  | { kind: 'sync'; block: SyncBlock };

export default function SyncNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  // Every debounced save retries the push and re-fires the same block, so a
  // plain boolean would make the banner reappear seconds after each dismissal.
  // Remember which reason was dismissed and stay quiet for repeats of it.
  const [dismissedReason, setDismissedReason] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  useEffect(() => {
    const onStore = (e: Event) => {
      const bytes = (e as CustomEvent<{ bytes: number }>).detail?.bytes ?? 0;
      setNotice({ kind: 'store', bytes });
    };
    const onSync = (e: Event) => {
      const block = (e as CustomEvent<SyncBlock>).detail;
      // A dev build not syncing is expected, not news.
      if (!block || block.reason === 'dev-build') return;
      // The store problem is the more serious of the two; don't let a push
      // refusal that is merely its symptom paper over it.
      setNotice(prev => (prev?.kind === 'store' ? prev : { kind: 'sync', block }));
    };
    window.addEventListener('bozz:store-unhealthy', onStore);
    window.addEventListener('bozz:sync-blocked', onSync);
    return () => {
      window.removeEventListener('bozz:store-unhealthy', onStore);
      window.removeEventListener('bozz:sync-blocked', onSync);
    };
  }, []);

  if (!notice) return null;
  const reasonKey = notice.kind === 'store' ? 'store' : notice.block.reason;
  if (dismissedReason === reasonKey) return null;

  // "I deleted this on purpose" — the one legitimate way local can be much
  // thinner than the cloud. Force-push makes this device authoritative again.
  const forcePush = async () => {
    setPushing(true);
    try {
      const { supabase } = await import('../lib/supabase');
      const { pushSnapshot } = await import('../lib/sync');
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (uid && await pushSnapshot(uid, { force: true })) setNotice(null);
    } finally {
      setPushing(false);
    }
  };

  // Dead session: drop it so AuthGate shows the sign-in screen. Deliberately
  // does NOT clear local data (that's clearLocalSnapshot's job on a real
  // sign-out) — this device's records must survive to be merged back up.
  const reconnect = async () => {
    try {
      const { supabase } = await import('../lib/supabase');
      const { cancelPendingPush } = await import('../lib/sync');
      cancelPendingPush();
      await supabase.auth.signOut({ scope: 'local' });
    } catch { /* AuthGate falls back to the login screen anyway */ }
  };

  const t = themes[DEFAULT_APPEARANCE.mood];
  const isStore = notice.kind === 'store';

  const title = isStore
    ? 'Your data did not load'
    : notice.block.reason === 'signed-out'
      ? 'Signed out on this device'
      : notice.block.reason === 'push-failed'
        ? 'Cloud upload did not go through'
        : 'Cloud sync paused to protect your data';

  const isThin = notice.kind === 'sync' && notice.block.reason === 'thin-local';
  const isSignedOut = notice.kind === 'sync' && notice.block.reason === 'signed-out';
  const isPushFail = notice.kind === 'sync' && notice.block.reason === 'push-failed';
  const body = isStore
    ? 'Bozz could not read its local file, so it is showing an empty app. Saving and syncing are switched off so nothing overwrites your real data. Close Bozz and open it again. If it stays empty, restore the newest file from the backups folder.'
    : isThin
      ? `This device has less data than your cloud copy (${notice.kind === 'sync' ? notice.block.detail : ''}), so Bozz did not upload it. If you just deleted things on purpose, push anyway. Otherwise restart Bozz to bring the cloud copy down.`
      : isSignedOut
        ? 'Your sign-in on this device has expired, so nothing can sync to or from the cloud. Your data here is safe. Sign out and sign back in with Google to reconnect.'
        : isPushFail
          ? 'Bozz could not upload your latest changes. They are safe on this device and will be retried on your next change or restart.'
          : 'This device could not read its own data, so it will not upload anything. Restart Bozz before making changes here.';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', right: '1.1rem', bottom: '1.1rem', zIndex: 99998,
        width: 'min(370px, calc(100vw - 2.2rem))',
        background: t.panel ?? t.bg,
        border: `1px solid ${t.alertBorder}`,
        borderRadius: '16px',
        padding: '1rem 1.05rem',
        boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
        fontFamily: 'var(--app-font, system-ui)',
        display: 'flex', gap: '0.8rem', alignItems: 'flex-start',
      }}
    >
      <div style={{
        width: 32, height: 32, flexShrink: 0, borderRadius: '10px',
        background: t.alertBg, border: `1px solid ${t.alertBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isStore
          ? <AlertCircle size={17} strokeWidth={1.8} color={t.alert} />
          : <CloudOff size={17} strokeWidth={1.8} color={t.alert} />}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: t.text, marginBottom: '0.28rem' }}>
          {title}
        </div>
        <div style={{ fontSize: '0.76rem', color: t.textMuted, lineHeight: 1.55 }}>
          {body}
        </div>
        {/* The underlying error, verbatim. A generic "network or server problem"
            hid an expired session for hours on 2026-08-10 — whatever the app
            actually got back is worth showing. */}
        {(isPushFail || isSignedOut) && notice.kind === 'sync' && (
          <div style={{
            marginTop: '0.5rem', padding: '0.4rem 0.55rem',
            background: t.alertBg, border: `1px solid ${t.alertBorder}`,
            borderRadius: '8px',
            fontSize: '0.68rem', lineHeight: 1.45, color: t.textMuted,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            wordBreak: 'break-word',
          }}>
            {notice.block.detail}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
          {isSignedOut && (
            <button
              onClick={() => { void reconnect(); }}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '999px', border: `1px solid ${t.alertBorder}`,
                background: t.alertBg, color: t.alert,
                fontFamily: 'inherit', fontSize: '0.74rem', fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Sign in again
            </button>
          )}
          {isThin && (
            <button
              onClick={() => { void forcePush(); }}
              disabled={pushing}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '999px', border: `1px solid ${t.alertBorder}`,
                background: t.alertBg, color: t.alert,
                fontFamily: 'inherit', fontSize: '0.74rem', fontWeight: 600,
                cursor: pushing ? 'wait' : 'pointer',
              }}
            >
              {pushing ? 'Pushing…' : 'I deleted on purpose — push'}
            </button>
          )}
          <button
            onClick={() => setDismissedReason(reasonKey)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '999px', border: `1px solid ${t.border}`,
              background: 'transparent', color: t.textMuted,
              fontFamily: 'inherit', fontSize: '0.74rem', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
