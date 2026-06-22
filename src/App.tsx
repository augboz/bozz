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
    const timer = setTimeout(async () => {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const found = await check();
        // Show the themed prompt instead of the native confirm() dialog. The
        // install + relaunch is handled inside UpdatePrompt, which surfaces any
        // error instead of silently swallowing it.
        if (found) setUpdate(found);
      } catch (err) { console.warn('[updater]', err); }
    }, 5000);
    return () => clearTimeout(timer);
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
    </>
  );
}
