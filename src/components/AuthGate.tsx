/**
 * AuthGate — login / sign-up screen + session provider.
 *
 * Auth methods:
 *   • Email + password (sign in)
 *   • Email + password (sign up) — requires email confirmation click
 *   • Google OAuth — both sign-in and sign-up use the same button
 *
 * Google setup (one-time, in browser):
 *   1. Supabase dashboard → Authentication → Providers → Google → enable,
 *      paste your Google Cloud OAuth client ID + secret.
 *   2. Google Cloud Console → OAuth client → Authorized redirect URIs →
 *      add:  https://<your-project>.supabase.co/auth/v1/callback
 *   3. Supabase → Authentication → URL Configuration → Redirect URLs →
 *      add:  http://localhost:1420
 *
 * Email confirmation is ON by default in Supabase. After sign-up the user
 * gets an email; clicking the link sets the session and the app opens.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, type Session } from '../lib/supabase';
import { themes } from '../lib/themes';
import { DEFAULT_APPEARANCE } from '../lib/appearance';
import TitleBar, { TITLE_BAR_HEIGHT } from './TitleBar';
import { isTauri } from '../lib/platform';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    ),
  ]);
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg === 'timeout' ||
    msg.includes('connect error') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('network')
  ) {
    return 'Cannot reach the server — it may be paused or your connection is down. Try again in a moment.';
  }
  return msg;
}

// ── Session context ───────────────────────────────────────────────────────────

interface SessionContextValue { session: Session | null }
const SessionContext = createContext<SessionContextValue>({ session: null });
export function useSession(): Session | null {
  return useContext(SessionContext).session;
}

// ── Component ─────────────────────────────────────────────────────────────────

type Mode = 'signin' | 'signup';

interface Props { children: React.ReactNode }

export default function AuthGate({ children }: Props) {
  const [session,    setSession]    = useState<Session | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [signedOut,  setSignedOut]  = useState(false); // true after explicit sign-out
  const [mode,       setMode]       = useState<Mode>('signin');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [status,     setStatus]     = useState<{ text: string; ok: boolean } | null>(null);
  const [busy,       setBusy]       = useState(false);

  // Restore session on mount + listen for auth events (incl. OAuth callback).
  useEffect(() => {
    let cancelled = false;
    withTimeout(supabase.auth.getSession(), 6000)
      .then(({ data }) => {
        if (!cancelled) { setSession(data.session); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    const { data: sub } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s);
      // When the user explicitly signs out, force the login screen even in dev mode.
      if (evt === 'SIGNED_OUT') setSignedOut(true);
      // If they sign back in, clear the flag.
      if (evt === 'SIGNED_IN') setSignedOut(false);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const submitPassword = async () => {
    const e = email.trim();
    if (!e || !password) { setStatus({ text: 'Enter your email and password.', ok: false }); return; }
    setBusy(true); setStatus(null);
    try {
      if (mode === 'signin') {
        const { error } = await withTimeout(
          supabase.auth.signInWithPassword({ email: e, password }),
          12000
        );
        if (error) setStatus({ text: friendlyError(error), ok: false });
        // on success onAuthStateChange fires → session set → this screen unmounts
      } else {
        const { error } = await withTimeout(
          supabase.auth.signUp({
            email: e, password,
            options: { emailRedirectTo: window.location.origin },
          }),
          12000
        );
        if (error) {
          setStatus({ text: friendlyError(error), ok: false });
        } else {
          setStatus({ text: `Check ${e} for a confirmation link, then sign in.`, ok: true });
          setMode('signin');
          setPassword('');
        }
      }
    } catch (err) { setStatus({ text: friendlyError(err), ok: false }); }
    setBusy(false);
  };

  const signInWithGoogle = async () => {
    setBusy(true); setStatus(null);
    try {
      if (isTauri()) {
        // In the packaged app window.location.origin is tauri://localhost — not a
        // valid OAuth redirect. Use a local TCP server + system browser instead.
        const { invoke } = await import('@tauri-apps/api/core');
        const { listen }  = await import('@tauri-apps/api/event');
        const { openUrl } = await import('@tauri-apps/plugin-opener');

        const tcpPort  = await invoke<number>('start_oauth_server', { port: 14985 }).catch(() => 14985);
        const redirectTo = `http://127.0.0.1:${tcpPort}`;

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
        });
        if (error) { setStatus({ text: error.message, ok: false }); setBusy(false); return; }
        if (!data?.url) { setStatus({ text: 'No auth URL returned.', ok: false }); setBusy(false); return; }

        const unlisten = await listen<string>('oauth:callback', async (e) => {
          unlisten();
          try {
            const code = new URL(e.payload).searchParams.get('code');
            if (!code) { setStatus({ text: 'No auth code in callback.', ok: false }); setBusy(false); return; }
            const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
            if (exchErr) setStatus({ text: exchErr.message, ok: false });
          } catch (err) { setStatus({ text: String(err), ok: false }); }
          setBusy(false);
        });

        await openUrl(data.url);
        setStatus({ text: 'Browser opened — sign in with Google, then return here.', ok: true });
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
        });
        if (error) setStatus({ text: error.message, ok: false });
        setBusy(false);
      }
    } catch (err) { setStatus({ text: String(err), ok: false }); setBusy(false); }
  };

  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') void submitPassword(); };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <Splash text="loading" />;
  if (session) return (
    <SessionContext.Provider value={{ session }}>{children}</SessionContext.Provider>
  );
  // Dev bypass — skip auth gate on initial load. Disabled when the user has
  // explicitly signed out so they always reach the login screen after sign-out.
  if (!signedOut && import.meta.env.DEV && import.meta.env.VITE_DEV_SKIP_AUTH === 'true') {
    return <SessionContext.Provider value={{ session: null }}>{children}</SessionContext.Provider>;
  }

  const configured = isSupabaseConfigured();
  const canSubmit = configured && !busy && !!email.trim() && !!password;
  const tbOffset = isTauri() ? TITLE_BAR_HEIGHT : 0;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      fontFamily: 'var(--app-font)',
      paddingTop: tbOffset,
      position: 'relative',
      backgroundImage: `url('/auth-bg.jpg')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <TitleBar theme={themes[DEFAULT_APPEARANCE.mood]} />

      {/* Left — BOZZ watermark area */}
      <div style={{
        flex: '1 1 55%',
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '2.5rem',
      }}>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.1em' }}>
          BOZZ
        </div>
      </div>

      {/* Right — glassy form panel */}
      <div style={{
        flex: '0 0 420px',
        minHeight: '100vh',
        background: 'rgba(8,10,9,0.55)',
        backdropFilter: 'blur(28px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.2)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem 3rem',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
      }}>

        <div style={{ maxWidth: '320px', width: '100%', margin: '0 auto' }}>

          {/* Heading */}
          <div style={{ marginBottom: '2.25rem' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f5f5f5', lineHeight: 1.15, marginBottom: '0.5rem' }}>
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>
              {mode === 'signin' ? 'Sign in to continue.' : 'Just your email to get started.'}
            </div>
          </div>

          {/* Supabase not configured */}
          {!configured && (
            <div style={{ border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', padding: '0.6rem 0.9rem', borderRadius: '12px', fontSize: '0.72rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Add VITE_SUPABASE_URL + VITE_SUPABASE_KEY to .env.local and restart.
            </div>
          )}

          {/* Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={onKey}
                placeholder="you@example.com"
                disabled={!configured || busy}
                autoComplete="email"
                style={inputStyle(!configured || busy)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', marginBottom: '0.4rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={onKey}
                placeholder="••••••••"
                disabled={!configured || busy}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                style={inputStyle(!configured || busy)}
              />
            </div>

            <button
              onClick={() => { void submitPassword(); }}
              disabled={!canSubmit}
              style={{
                marginTop: '0.5rem',
                background: canSubmit ? '#f0f0f0' : 'rgba(255,255,255,0.06)',
                color: canSubmit ? '#0a0a0a' : 'rgba(255,255,255,0.2)',
                border: 'none', borderRadius: '50px',
                padding: '0.9rem 1rem',
                cursor: !canSubmit ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--app-font)', fontSize: '0.82rem', fontWeight: 600,
                letterSpacing: '0.03em',
                transition: 'background 0.3s var(--ease), color 0.2s',
              }}
            >
              {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.1rem 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
              <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
            </div>

            <button
              onClick={() => { void signInWithGoogle(); }}
              disabled={!configured || busy}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50px',
                padding: '0.8rem 1rem', cursor: !configured || busy ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--app-font)', fontSize: '0.78rem', fontWeight: 500, color: 'rgba(255,255,255,0.5)',
                opacity: !configured || busy ? 0.4 : 1,
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </div>

          {/* Status */}
          {status && (
            <div style={{ marginTop: '1rem', fontSize: '0.73rem', lineHeight: 1.5, color: status.ok ? '#86efac' : '#fca5a5' }}>
              {status.text}
            </div>
          )}

          {/* Toggle */}
          <div style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setStatus(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', fontFamily: 'var(--app-font)', fontSize: 'inherit', fontWeight: 600, padding: 0 }}
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function Splash({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0c0d10', color: '#6b6c70', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--app-font)', fontWeight: 300, letterSpacing: '0.1em', fontSize: '0.75rem', textTransform: 'uppercase' }}>
      {text}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

const inputStyle = (disabled: boolean): React.CSSProperties => ({
  display: 'block', width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '50px',
  padding: '0.8rem 1.1rem', color: '#f0f0f0', fontFamily: 'var(--app-font)',
  fontSize: '0.82rem', outline: 'none', opacity: disabled ? 0.4 : 1,
});