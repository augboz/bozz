import { useEffect, useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';
import './index.css';
import Dashboard from './components/Dashboard';
import QuickCapture from './components/QuickCapture';
import AuthGate, { useSession } from './components/AuthGate';
import UpdatePrompt from './components/UpdatePrompt';
import { isTauri } from './lib/platform';

function DashboardKeyed() {
  const session = useSession();
  return <Dashboard key={session?.user.id ?? 'anon'} />;
}

/** Persistent warning shown while writes to the local store are failing.
 *  Driven by the 'bozz:storage-failing' / 'bozz:storage-ok' events from
 *  lib/storage (see the save-health notes there). In July 2026 the store
 *  silently failed to persist for 11 days; this banner is why that can't
 *  happen quietly again. Clears itself the moment a write succeeds. */
function StorageHealthBanner() {
  const [failing, setFailing] = useState(false);
  useEffect(() => {
    const bad = () => setFailing(true);
    const ok = () => setFailing(false);
    window.addEventListener('bozz:storage-failing', bad);
    window.addEventListener('bozz:storage-ok', ok);
    return () => {
      window.removeEventListener('bozz:storage-failing', bad);
      window.removeEventListener('bozz:storage-ok', ok);
    };
  }, []);
  if (!failing) return null;
  return (
    <div role="alert" style={{
      position: 'fixed', top: '42px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 100000, maxWidth: '540px',
      background: '#3a1214', border: '1px solid #a33',
      borderRadius: '10px', color: '#ffd9d9',
      padding: '0.55rem 1rem', fontSize: '0.8rem', lineHeight: 1.45,
      fontFamily: 'inherit', boxShadow: '0 6px 24px rgba(0,0,0,0.45)',
    }}>
      <strong>Bozz can't save to this computer.</strong>{' '}
      Your changes are currently only reaching the cloud. Restart Bozz; if this
      warning returns, something on this machine is blocking writes to the
      app-data folder.
    </div>
  );
}

/** Handles OAuth redirects in browser/web mode.
 *  Spotify (and other providers) redirect back to the app root with ?code=&state=
 *  (or ?error=). This component posts those params to the opener popup and closes itself. */
function OAuthCallbackPage() {
  useEffect(() => {
    const params: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => { params[k] = v; });
    if (window.opener) {
      try {
        window.opener.postMessage(
          { type: 'oauth_callback', params },
          window.location.origin,
        );
      } catch { /* cross-origin guard */ }
      window.close();
    }
  }, []);
  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#888',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui', fontSize: '0.85rem',
    }}>
      Connecting… you can close this window.
    </div>
  );
}

export default function App() {
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let lastCheck = 0;
    // Don't hammer GitHub: ignore focus-driven re-checks within 30 min of the
    // last one. Forced checks (launch + periodic timer) bypass this.
    const MIN_GAP = 30 * 60 * 1000;

    const runCheck = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastCheck < MIN_GAP) return;
      lastCheck = now;
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const found = await check();
        if (cancelled || !found) return;
        // Show the themed prompt instead of the native confirm() dialog. The
        // install + relaunch is handled inside UpdatePrompt, which surfaces any
        // error instead of silently swallowing it. Don't clobber a prompt that's
        // already open.
        setUpdate(prev => prev ?? found);
      } catch (err) { console.warn('[updater]', err); }
    };

    // Bozz minimises to the system tray on close, so most instances are launched
    // once and then live for days. A single check on launch means tray-resident
    // copies never notice a release. So in addition to the launch check we re-check
    // periodically AND whenever the window is brought back to the foreground (e.g.
    // clicked open from the tray) — the natural moment to notice an update.
    const timer = setTimeout(() => { void runCheck(true); }, 5000);
    const interval = setInterval(() => { void runCheck(true); }, 6 * 60 * 60 * 1000);
    const onFocus = () => { void runCheck(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void runCheck(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const sp = new URLSearchParams(window.location.search);
  if (sp.get('view') === 'quickcapture') return <QuickCapture />;
  // OAuth callback: provider redirected back with code= or error=
  if (sp.has('code') || sp.has('error')) return <OAuthCallbackPage />;
  return (
    <>
      <AuthGate>
        <DashboardKeyed />
      </AuthGate>
      {update && <UpdatePrompt update={update} onClose={() => setUpdate(null)} />}
      <StorageHealthBanner />
    </>
  );
}
